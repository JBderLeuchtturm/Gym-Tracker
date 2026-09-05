/**
 * Anleitungen zur Ausfuehrung - Text und Bilder aus dem wger-Bestand.
 *
 * Gedacht fuer den Fall im Studio: Man steht vor einem Geraet, das man selten
 * benutzt, und will kurz nachsehen, wie das noch mal ging. Deshalb wird alles,
 * was einmal geladen wurde, dauerhaft aufbewahrt - im Keller mit einem Balken
 * Empfang ist eine Anleitung, die erst geladen werden muss, keine Anleitung.
 *
 * Die Inhalte stammen von wger.de und stehen unter CC-BY-SA. Deshalb steht bei
 * jeder angezeigten Anleitung, woher sie kommt.
 */

import type { Exercise } from '../types';
import { searchWger } from './wger';

const BASE = 'https://wger.de/api/v2';
const TIMEOUT_MS = 8000;
const CACHE_KEY = 'gym-tracker:guides:v1';
/** So viele Anleitungen bleiben liegen; die aeltesten fallen heraus. */
const CACHE_LIMIT = 150;

export interface Guide {
  /** Beschreibung der Ausfuehrung, bereits von HTML befreit. */
  text: string;
  images: string[];
  videos: string[];
  /** wger-Kennung der gefundenen Uebung - fuer den Link zur Quelle. */
  baseId: string | null;
  fetchedAt: string;
}

type GuideCache = Record<string, Guide>;

function readCache(): GuideCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as GuideCache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: GuideCache): void {
  try {
    const entries = Object.entries(cache);
    // Nur die juengsten behalten, damit der Speicher nicht unbegrenzt waechst.
    const kept = entries
      .sort((a, b) => (b[1].fetchedAt ?? '').localeCompare(a[1].fetchedAt ?? ''))
      .slice(0, CACHE_LIMIT);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Voller Speicher: Dann gibt es die Anleitung eben nur online.
  }
}

/** Bereits vorhandene Anleitung, ohne das Netz zu bemuehen. */
export const cachedGuide = (exerciseId: string): Guide | null =>
  readCache()[exerciseId] ?? null;

export function forgetGuides(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* egal */ }
}

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

const stripHtml = (html: string): string =>
  html
    .replace(/<li[^>]*>/gi, '\n· ')
    .replace(/<\/(p|div|li|ul|ol|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

const absolute = (url: string): string =>
  url.startsWith('http') ? url : `https://wger.de${url.startsWith('/') ? '' : '/'}${url}`;

interface BaseInfo {
  images?: Array<{ image?: string; is_main?: boolean }>;
  videos?: Array<{ video?: string }>;
  exercises?: Array<{ language?: number; description?: string }>;
  translations?: Array<{ language?: number; description?: string }>;
}

/** Welche wger-Uebung ist gemeint? Bekannte Kennung schlaegt Namenssuche. */
async function resolveBaseId(exercise: Exercise): Promise<string | null> {
  if (exercise.externalId) return exercise.externalId;

  for (const term of [exercise.name, exercise.nameEn].filter(Boolean) as string[]) {
    const hits = await searchWger(term).catch(() => []);
    const match = hits.find((hit) => hit.externalId);
    if (match?.externalId) return match.externalId;
  }
  return null;
}

/**
 * Holt die Anleitung - erst aus dem Speicher, sonst von wger.
 *
 * Gibt null zurueck, wenn nichts zu finden war: kein Netz, keine Entsprechung
 * im Bestand, oder die Uebung ist eine eigene. Das ist kein Fehler, sondern
 * der Normalfall bei selbst angelegten Uebungen.
 */
export async function fetchGuide(exercise: Exercise, force = false): Promise<Guide | null> {
  if (!force) {
    const hit = cachedGuide(exercise.id);
    if (hit) return hit;
  }

  const baseId = await resolveBaseId(exercise);
  if (!baseId) return null;

  try {
    const info = (await fetchJson(`${BASE}/exercisebaseinfo/${baseId}/?format=json`)) as BaseInfo;
    const translations = info.translations ?? info.exercises ?? [];
    // 1 = Deutsch, 2 = Englisch. Deutsch bevorzugt, englisch besser als nichts.
    const german = translations.find((entry) => entry.language === 1 && entry.description);
    const english = translations.find((entry) => entry.language === 2 && entry.description);
    const text = stripHtml(german?.description ?? english?.description ?? '');

    const images = (info.images ?? [])
      .map((item) => item.image)
      .filter((url): url is string => Boolean(url))
      .map(absolute)
      .slice(0, 6);

    const videos = (info.videos ?? [])
      .map((item) => item.video)
      .filter((url): url is string => Boolean(url))
      .map(absolute)
      .slice(0, 2);

    if (!text && images.length === 0 && videos.length === 0) return null;

    const guide: Guide = { text, images, videos, baseId, fetchedAt: new Date().toISOString() };
    const cache = readCache();
    cache[exercise.id] = guide;
    writeCache(cache);
    return guide;
  } catch {
    return null;
  }
}

/**
 * Laedt die Anleitungen mehrerer Uebungen im Voraus - gedacht fuer zu Hause,
 * bevor man losfaehrt. Nacheinander statt gleichzeitig: wger ist ein freier
 * Dienst, den ein einzelner Nutzer nicht mit einem Schwung Anfragen belegen
 * sollte.
 */
export async function prefetchGuides(
  exercises: Exercise[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const missing = exercises.filter((exercise) => !cachedGuide(exercise.id));
  let loaded = 0;
  for (let index = 0; index < missing.length; index += 1) {
    const guide = await fetchGuide(missing[index]);
    if (guide) loaded += 1;
    onProgress?.(index + 1, missing.length);
  }
  return loaded;
}
