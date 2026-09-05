/**
 * Wetter zum Trainingstag - von Open-Meteo (https://open-meteo.com).
 *
 * Frei nutzbar, ohne Schluessel und ohne Anmeldung. Gefragt wird nur, wenn an
 * dem Tag ueberhaupt etwas draussen ansteht; drinnen ist Regen egal.
 *
 * Der Ort geht absichtlich auf zwei Nachkommastellen gerundet hinaus - das
 * sind rund anderthalb Kilometer. Fuer die Frage, ob es beim Laufen regnet,
 * reicht das; die genaue Hausnummer hat bei einem fremden Dienst nichts zu
 * suchen.
 */

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 7000;
const CACHE_KEY = 'gym-tracker:weather:v1';
/** So lange gilt ein einmal geholter Tag als aktuell genug. */
const FRESH_MS = 3 * 60 * 60 * 1000;

export interface DayWeather {
  date: string;
  code: number;
  maxC: number;
  minC: number;
  rainChance: number | null;
  windKmh: number | null;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  region?: string;
}

/** Kurztexte zu den Wettercodes der WMO, so wie Open-Meteo sie liefert. */
const CODES: Array<[number[], string]> = [
  [[0], 'klar'],
  [[1], 'überwiegend klar'],
  [[2], 'wechselnd bewölkt'],
  [[3], 'bedeckt'],
  [[45, 48], 'Nebel'],
  [[51, 53, 55], 'Nieselregen'],
  [[56, 57], 'gefrierender Niesel'],
  [[61], 'leichter Regen'],
  [[63], 'Regen'],
  [[65], 'starker Regen'],
  [[66, 67], 'gefrierender Regen'],
  [[71], 'leichter Schneefall'],
  [[73], 'Schnee'],
  [[75], 'starker Schneefall'],
  [[77], 'Schneegriesel'],
  [[80, 81], 'Schauer'],
  [[82], 'kräftige Schauer'],
  [[85, 86], 'Schneeschauer'],
  [[95], 'Gewitter'],
  [[96, 99], 'Gewitter mit Hagel'],
];

export function describeCode(code: number): string {
  for (const [codes, label] of CODES) if (codes.includes(code)) return label;
  return 'unklar';
}

/** Ein Zeichen, das die Lage auf einen Blick zeigt. */
export function weatherSymbol(code: number): string {
  if (code === 0 || code === 1) return '☀';
  if (code === 2) return '⛅';
  if (code === 3) return '☁';
  if (code === 45 || code === 48) return '≡';
  if (code >= 95) return '⚡';
  if (code >= 71 && code <= 77) return '❄';
  if (code >= 85 && code <= 86) return '❄';
  return '☂';
}

/**
 * Taugt das Wetter zum Trainieren?
 *
 * Bewusst grob und ohne erhobenen Zeigefinger: Die App weiss nicht, wie
 * hart jemand im Nehmen ist. Gemeldet wird nur, was man vorher gerne
 * gewusst haette.
 */
export function weatherWarning(day: DayWeather): string | null {
  if (day.code >= 95) return 'Gewitter – draußen eher nicht.';
  if ((day.rainChance ?? 0) >= 70) return 'Hohe Regenwahrscheinlichkeit.';
  if (day.maxC <= 0) return 'Frost – lang anziehen und länger aufwärmen.';
  if (day.maxC >= 30) return 'Sehr warm – früher los und mehr trinken.';
  if ((day.windKmh ?? 0) >= 45) return 'Kräftiger Wind.';
  return null;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Open-Meteo antwortete mit ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Ortssuche - liefert Koordinaten zu einem eingetippten Namen. */
export async function searchPlace(name: string): Promise<Place[]> {
  const query = name.trim();
  if (query.length < 2) return [];
  try {
    const payload = (await fetchJson(
      `${GEOCODE}?name=${encodeURIComponent(query)}&count=6&language=de&format=json`,
    )) as { results?: Array<Record<string, unknown>> };

    return (payload.results ?? []).map((entry) => ({
      name: String(entry.name ?? ''),
      lat: Number(entry.latitude),
      lon: Number(entry.longitude),
      country: entry.country ? String(entry.country) : undefined,
      region: entry.admin1 ? String(entry.admin1) : undefined,
    })).filter((place) => place.name && Number.isFinite(place.lat) && Number.isFinite(place.lon));
  } catch {
    return [];
  }
}

interface CacheEntry {
  at: number;
  days: DayWeather[];
}

const cacheKey = (lat: number, lon: number): string => `${lat.toFixed(2)},${lon.toFixed(2)}`;

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Wetter fuer einen Ort: knapp drei Monate zurueck und gut zwei Wochen voraus.
 *
 * In einem Rutsch statt Tag fuer Tag - eine Anfrage deckt jeden Tag ab, den
 * man in der App anschauen kann, und der Rest kommt aus dem Zwischenspeicher.
 */
export async function loadWeather(
  lat: number, lon: number, force = false,
): Promise<DayWeather[]> {
  const key = cacheKey(lat, lon);
  const cache = readCache();
  const hit = cache[key];
  if (!force && hit && Date.now() - hit.at < FRESH_MS) return hit.days;

  try {
    const url = `${FORECAST}?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}`
      + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max'
      + '&timezone=auto&past_days=92&forecast_days=16';
    const payload = (await fetchJson(url)) as {
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
        precipitation_probability_max?: Array<number | null>;
        wind_speed_10m_max?: Array<number | null>;
      };
    };

    const daily = payload.daily;
    const times = daily?.time ?? [];
    const days: DayWeather[] = times.map((date, index) => ({
      date,
      code: daily?.weather_code?.[index] ?? 0,
      maxC: daily?.temperature_2m_max?.[index] ?? 0,
      minC: daily?.temperature_2m_min?.[index] ?? 0,
      rainChance: daily?.precipitation_probability_max?.[index] ?? null,
      windKmh: daily?.wind_speed_10m_max?.[index] ?? null,
    }));

    if (days.length > 0) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ [key]: { at: Date.now(), days } }));
      } catch {
        // Voller Speicher - dann eben bei jedem Aufruf frisch.
      }
    }
    return days;
  } catch {
    // Ohne Netz zaehlt, was zuletzt da war - Wetter von gestern ist besser als
    // gar keins, solange klar ist, worauf man schaut.
    return hit?.days ?? [];
  }
}

export const weatherForDate = (days: DayWeather[], date: string): DayWeather | null =>
  days.find((day) => day.date === date) ?? null;
