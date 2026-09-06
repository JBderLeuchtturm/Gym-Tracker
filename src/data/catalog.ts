import type { Exercise, ExerciseCategory, ExerciseKind } from '../types';
import catalogData from './catalog.json';

/**
 * Der Katalog liegt fertig geparst als JSON vor - erzeugt beim Bauen aus
 * data/catalogRaw.ts (siehe scripts/build-catalog.mjs). Zur Laufzeit wird nur
 * noch einmal JSON.parse ausgefuehrt, statt gut zweihundert Zeilen einzeln zu
 * zerlegen.
 */

/** Stabile ID aus dem englischen Namen - bleibt über App-Updates hinweg gleich. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const CATALOG: Exercise[] = catalogData as unknown as Exercise[];

export const CATALOG_BY_ID: Record<string, Exercise> = Object.fromEntries(
  CATALOG.map((e) => [e.id, e]),
);

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  chest: 'Brust',
  back: 'Rücken',
  legs: 'Beine',
  shoulders: 'Schultern',
  arms: 'Arme',
  core: 'Rumpf',
  glutes: 'Gesäß',
  cardio: 'Cardio',
  fullbody: 'Ganzkörper',
  mobility: 'Mobility',
  other: 'Sonstige',
};

export const KIND_LABELS: Record<ExerciseKind, string> = {
  strength: 'Kraft',
  bodyweight: 'Körpergewicht',
  cardio: 'Cardio',
  time: 'Zeit / Halten',
  mobility: 'Mobility',
};

/** Alle im Katalog vorkommenden Equipment-Bezeichnungen, alphabetisch. */
export const ALL_EQUIPMENT: string[] = [
  ...new Set(CATALOG.flatMap((e) => e.equipment)),
].sort((a, b) => a.localeCompare(b, 'de'));

/** Alle Muskeln (primaer + sekundaer), alphabetisch. */
export const ALL_MUSCLES: string[] = [
  ...new Set(CATALOG.flatMap((e) => [...e.primaryMuscles, ...e.secondaryMuscles])),
].sort((a, b) => a.localeCompare(b, 'de'));
