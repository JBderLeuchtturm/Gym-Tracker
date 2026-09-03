/**
 * Anbindung an die wger-Datenbank (https://wger.de) - eine freie, quelloffene
 * Uebungsdatenbank mit mehreren tausend Eintraegen. Kein API-Key noetig.
 *
 * Die App funktioniert auch ohne diese API vollstaendig: Schlaegt ein Aufruf
 * fehl (offline, CORS, Rate-Limit), wird nur der eingebaute Katalog benutzt.
 */

import type { Exercise, ExerciseCategory } from '../types';
import { slugify } from '../data/catalog';

const BASE = 'https://wger.de/api/v2';
const TIMEOUT_MS = 7000;

/** wger-Sprach-IDs: 1 = Deutsch, 2 = Englisch. */
const LANG_DE = 1;
const LANG_EN = 2;

const CATEGORY_MAP: Record<string, ExerciseCategory> = {
  abs: 'core', bauch: 'core',
  arms: 'arms', arme: 'arms',
  back: 'back', rücken: 'back', ruecken: 'back',
  calves: 'legs', waden: 'legs',
  chest: 'chest', brust: 'chest',
  legs: 'legs', beine: 'legs',
  shoulders: 'shoulders', schultern: 'shoulders',
  cardio: 'cardio',
};

const mapCategory = (name: string | undefined): ExerciseCategory =>
  CATEGORY_MAP[(name ?? '').trim().toLowerCase()] ?? 'other';

/** MET-Schaetzung, wenn wger keine Angabe liefert. */
const metForCategory = (category: ExerciseCategory): number => {
  if (category === 'cardio') return 8;
  if (category === 'legs' || category === 'fullbody') return 6;
  if (category === 'mobility') return 2.5;
  return 5;
};

let apiUnavailable = false;

/** Meldet, ob die API in dieser Sitzung bereits als nicht erreichbar erkannt wurde. */
export const isWgerUnavailable = (): boolean => apiUnavailable;
export const resetWgerAvailability = (): void => { apiUnavailable = false; };

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`wger antwortete mit ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

interface WgerSuggestion {
  value?: string;
  data?: {
    id?: number;
    base_id?: number;
    name?: string;
    category?: string;
    image?: string | null;
    image_thumbnail?: string | null;
  };
}

function toExercise(suggestion: WgerSuggestion, language: number): Exercise | null {
  const data = suggestion.data ?? {};
  const name = (data.name ?? suggestion.value ?? '').trim();
  if (!name) return null;

  const baseId = data.base_id ?? data.id;
  const category = mapCategory(data.category);
  const image = data.image_thumbnail ?? data.image ?? undefined;

  return {
    id: `wger_${baseId ?? slugify(name)}`,
    name,
    nameEn: language === LANG_EN ? name : undefined,
    category,
    kind: category === 'cardio' ? 'cardio' : 'strength',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
    met: metForCategory(category),
    imageUrl: image ? (image.startsWith('http') ? image : `https://wger.de${image}`) : undefined,
    source: 'wger',
    externalId: baseId != null ? String(baseId) : undefined,
  };
}

/**
 * Sucht Uebungen in der wger-Datenbank - parallel auf Deutsch und Englisch,
 * damit sowohl "Bankdruecken" als auch "bench press" Treffer liefern.
 */
export async function searchWger(term: string): Promise<Exercise[]> {
  const query = term.trim();
  if (query.length < 2 || apiUnavailable) return [];

  const request = async (language: number): Promise<Exercise[]> => {
    const url = `${BASE}/exercise/search/?term=${encodeURIComponent(query)}&language=${language}&format=json`;
    const payload = (await fetchJson(url)) as { suggestions?: WgerSuggestion[] };
    return (payload.suggestions ?? [])
      .map((suggestion) => toExercise(suggestion, language))
      .filter((exercise): exercise is Exercise => exercise !== null);
  };

  try {
    const [german, english] = await Promise.all([
      request(LANG_DE).catch(() => [] as Exercise[]),
      request(LANG_EN).catch(() => [] as Exercise[]),
    ]);

    const merged = new Map<string, Exercise>();
    for (const exercise of [...german, ...english]) {
      const existing = merged.get(exercise.id);
      if (existing) {
        // Englischen Namen ergaenzen, deutschen bevorzugt anzeigen.
        if (!existing.nameEn && exercise.nameEn) existing.nameEn = exercise.nameEn;
        continue;
      }
      merged.set(exercise.id, exercise);
    }

    const results = [...merged.values()];
    if (results.length === 0 && german.length === 0 && english.length === 0) {
      apiUnavailable = true;
    }
    return results;
  } catch {
    apiUnavailable = true;
    return [];
  }
}

interface WgerBaseInfo {
  category?: { name?: string };
  muscles?: Array<{ name?: string; name_en?: string }>;
  muscles_secondary?: Array<{ name?: string; name_en?: string }>;
  equipment?: Array<{ name?: string }>;
  exercises?: Array<{ language?: number; name?: string; description?: string }>;
  translations?: Array<{ language?: number; name?: string; description?: string }>;
}

const stripHtml = (html: string): string =>
  html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

const muscleName = (muscle: { name?: string; name_en?: string }): string =>
  (muscle.name_en || muscle.name || '').trim();

/**
 * Holt Details (Muskeln, Equipment, Beschreibung) zu einer wger-Uebung.
 * Schlaegt das fehl, wird die Uebung einfach ohne Zusatzinfos uebernommen.
 */
export async function enrichWgerExercise(exercise: Exercise): Promise<Exercise> {
  if (!exercise.externalId || apiUnavailable) return exercise;

  try {
    const info = (await fetchJson(
      `${BASE}/exercisebaseinfo/${exercise.externalId}/?format=json`,
    )) as WgerBaseInfo;

    const translations = info.translations ?? info.exercises ?? [];
    const german = translations.find((entry) => entry.language === LANG_DE);
    const english = translations.find((entry) => entry.language === LANG_EN);
    const description = german?.description ?? english?.description ?? '';
    const category = mapCategory(info.category?.name);

    return {
      ...exercise,
      name: german?.name?.trim() || exercise.name,
      nameEn: english?.name?.trim() || exercise.nameEn,
      category: category === 'other' ? exercise.category : category,
      primaryMuscles: (info.muscles ?? []).map(muscleName).filter(Boolean),
      secondaryMuscles: (info.muscles_secondary ?? []).map(muscleName).filter(Boolean),
      equipment: (info.equipment ?? []).map((item) => (item.name ?? '').trim()).filter(Boolean),
      description: description ? stripHtml(description).slice(0, 900) : exercise.description,
      met: exercise.met || metForCategory(category),
    };
  } catch {
    return exercise;
  }
}
