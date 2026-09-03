import type { Exercise, ExerciseCategory, ExerciseKind } from '../types';
import { CATALOG_RAW } from './catalogRaw';

const CATEGORIES = new Set<ExerciseCategory>([
  'chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'glutes', 'cardio', 'fullbody', 'mobility', 'other',
]);
const KINDS = new Set<ExerciseKind>(['strength', 'bodyweight', 'cardio', 'time', 'mobility']);

const splitList = (raw: string): string[] =>
  raw.split(';').map((s) => s.trim()).filter((s) => s.length > 0 && s !== '-');

/** Stabile ID aus dem englischen Namen - bleibt über App-Updates hinweg gleich. */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function parseCatalog(): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();

  for (const line of CATALOG_RAW.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split('|');
    if (parts.length < 8) continue;

    const [name, nameEn, category, kind, primary, secondary, equipment, met, aliases] = parts;
    const cat = category.trim() as ExerciseCategory;
    const knd = kind.trim() as ExerciseKind;
    if (!CATEGORIES.has(cat) || !KINDS.has(knd)) continue;

    const id = `cat_${slugify(nameEn || name)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    out.push({
      id,
      name: name.trim(),
      nameEn: nameEn.trim(),
      category: cat,
      kind: knd,
      primaryMuscles: splitList(primary),
      secondaryMuscles: splitList(secondary),
      equipment: splitList(equipment),
      met: Number.parseFloat(met) || 5,
      aliases: aliases ? splitList(aliases) : [],
      source: 'catalog',
    });
  }
  return out;
}

export const CATALOG: Exercise[] = parseCatalog();

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
