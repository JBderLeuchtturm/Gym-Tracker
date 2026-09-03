/**
 * Yazio-Anbindung.
 *
 * Wichtig: Yazio bietet keine oeffentliche API an. Es gibt daher zwei Wege,
 * die Kalorienzufuhr hierher zu bekommen:
 *
 * 1. CSV-Import aus dem Yazio-Datenexport (App -> Profil -> Einstellungen ->
 *    Konto -> Daten exportieren). Funktioniert ohne Zusatzsoftware.
 * 2. Eigene Bridge: ein selbst betriebener kleiner Dienst, der sich bei Yazio
 *    anmeldet und die Tageswerte als JSON zurueckgibt. Die erwartete Antwort
 *    ist unten dokumentiert.
 *
 * Ohne beides koennen die Werte jederzeit von Hand eingetragen werden.
 */

import type { NutritionEntry } from '../types';

export interface BridgeDay {
  date: string;
  kcalIn: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

const num = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Erwartetes Antwortformat der Bridge fuer GET {bridgeUrl}/daily?date=yyyy-mm-dd:
 *   { "date": "2026-09-03", "energy": 2140, "protein": 155, "carb": 210, "fat": 70 }
 * Alternative Feldnamen (kcal, calories, proteinG, ...) werden ebenfalls erkannt.
 */
function parseBridgeDay(payload: unknown, fallbackDate: string): BridgeDay {
  const data = (payload ?? {}) as Record<string, unknown>;
  return {
    date: typeof data.date === 'string' ? data.date : fallbackDate,
    kcalIn: num(data.energy) ?? num(data.kcal) ?? num(data.calories) ?? num(data.kcalIn),
    proteinG: num(data.protein) ?? num(data.proteinG),
    carbsG: num(data.carb) ?? num(data.carbs) ?? num(data.carbsG),
    fatG: num(data.fat) ?? num(data.fatG),
  };
}

export async function fetchYazioDay(
  bridgeUrl: string,
  token: string,
  date: string,
): Promise<BridgeDay> {
  const base = bridgeUrl.replace(/\/+$/, '');
  const response = await fetch(`${base}/daily?date=${encodeURIComponent(date)}`, {
    headers: token
      ? { Accept: 'application/json', Authorization: `Bearer ${token}` }
      : { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Bridge antwortete mit ${response.status} ${response.statusText}`);
  }
  return parseBridgeDay(await response.json(), date);
}

/* ------------------------------------------------------------- CSV-Import */

const DATE_PATTERNS = [
  /^(\d{4})-(\d{2})-(\d{2})/,          // 2026-09-03
  /^(\d{2})\.(\d{2})\.(\d{4})/,        // 03.09.2026
  /^(\d{2})\/(\d{2})\/(\d{4})/,        // 09/03/2026
];

function parseDateCell(cell: string): string | null {
  const value = cell.trim().replace(/^"|"$/g, '');
  const iso = DATE_PATTERNS[0].exec(value);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const german = DATE_PATTERNS[1].exec(value);
  if (german) return `${german[3]}-${german[2]}-${german[1]}`;
  const us = DATE_PATTERNS[2].exec(value);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  return null;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') { current += '"'; index += 1; }
      else inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current); current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

const findColumn = (headers: string[], keywords: string[]): number =>
  headers.findIndex((header) => keywords.some((keyword) => header.includes(keyword)));

/**
 * Liest einen Yazio-CSV-Export ein und summiert Energie und Makros je Tag.
 * Der Export enthaelt eine Zeile je Lebensmittel - deshalb wird gruppiert.
 */
export function parseYazioCsv(csv: string): NutritionEntry[] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map((header) => header.toLowerCase());

  const dateColumn = findColumn(headers, ['date', 'datum', 'tag']);
  const energyColumn = findColumn(headers, ['energy', 'kcal', 'kalorien', 'calorie', 'energie']);
  const proteinColumn = findColumn(headers, ['protein', 'eiweiss', 'eiweiß']);
  const carbColumn = findColumn(headers, ['carb', 'kohlenhydrat']);
  const fatColumn = findColumn(headers, ['fat', 'fett']);

  if (dateColumn < 0 || energyColumn < 0) return [];

  const perDay = new Map<string, NutritionEntry>();

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line, delimiter);
    const date = parseDateCell(cells[dateColumn] ?? '');
    if (!date) continue;

    const entry = perDay.get(date) ?? {
      date, kcalIn: 0, proteinG: 0, carbsG: 0, fatG: 0, source: 'yazio' as const,
    };
    entry.kcalIn = (entry.kcalIn ?? 0) + (num(cells[energyColumn]) ?? 0);
    if (proteinColumn >= 0) entry.proteinG = (entry.proteinG ?? 0) + (num(cells[proteinColumn]) ?? 0);
    if (carbColumn >= 0) entry.carbsG = (entry.carbsG ?? 0) + (num(cells[carbColumn]) ?? 0);
    if (fatColumn >= 0) entry.fatG = (entry.fatG ?? 0) + (num(cells[fatColumn]) ?? 0);
    perDay.set(date, entry);
  }

  return [...perDay.values()]
    .map((entry) => ({
      ...entry,
      kcalIn: entry.kcalIn ? Math.round(entry.kcalIn) : null,
      proteinG: entry.proteinG ? Math.round(entry.proteinG) : null,
      carbsG: entry.carbsG ? Math.round(entry.carbsG) : null,
      fatG: entry.fatG ? Math.round(entry.fatG) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
