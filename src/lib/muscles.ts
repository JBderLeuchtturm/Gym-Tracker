import type { Exercise } from '../types';

/**
 * Zuordnung der Muskelbezeichnungen aus dem Katalog zu Regionen der
 * Koerperkarte. Die Katalogtexte sind frei formuliert ("Brust groß (oberer
 * Teil)", "Rumpf (schräg)"), deshalb wird ueber Muster zugeordnet statt ueber
 * eine feste Liste.
 */

export type MuscleRegion =
  | 'neck' | 'trapezius' | 'deltoids' | 'chest' | 'biceps' | 'triceps'
  | 'forearms' | 'abs' | 'obliques' | 'lats' | 'lowerback' | 'glutes'
  | 'quads' | 'hamstrings' | 'adductors' | 'calves';

export const REGION_LABELS: Record<MuscleRegion, string> = {
  neck: 'Nacken',
  trapezius: 'Trapez',
  deltoids: 'Schultern',
  chest: 'Brust',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  obliques: 'Seitliche Bauchmuskeln',
  lats: 'Latissimus',
  lowerback: 'Unterer Rücken',
  glutes: 'Gesäß',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbizeps',
  adductors: 'Adduktoren',
  calves: 'Waden',
};

/** Auf welcher Ansicht die Region liegt. Manche sind von beiden Seiten sichtbar. */
export const REGION_SIDE: Record<MuscleRegion, 'front' | 'back' | 'both'> = {
  neck: 'both',
  trapezius: 'back',
  deltoids: 'both',
  chest: 'front',
  biceps: 'front',
  triceps: 'back',
  forearms: 'both',
  abs: 'front',
  obliques: 'front',
  lats: 'back',
  lowerback: 'back',
  glutes: 'back',
  quads: 'front',
  hamstrings: 'back',
  adductors: 'front',
  calves: 'both',
};

/** Reihenfolge der Muster ist wichtig: Spezifisches zuerst. */
const PATTERNS: Array<[RegExp, MuscleRegion]> = [
  [/nacken|hals/i, 'neck'],
  [/brustwirbels(ä|ae)ule/i, 'trapezius'],
  [/trapez|rautenmuskel/i, 'trapezius'],
  [/rotatorenmanschette|schulter/i, 'deltoids'],
  [/brust/i, 'chest'],
  [/trizeps/i, 'triceps'],
  // Vor der Bizeps-Regel: "Beinbizeps" ist die Rueckseite des Oberschenkels.
  [/beinbizeps|hamstring|ischio/i, 'hamstrings'],
  [/bizeps|brachialis/i, 'biceps'],
  [/unterarm/i, 'forearms'],
  [/latissimus/i, 'lats'],
  [/r(ü|ue)ckenstrecker|unterer r(ü|ue)cken|wirbels(ä|ae)ule/i, 'lowerback'],
  [/ges(ä|ae)(ß|ss)/i, 'glutes'],
  [/quadrizeps/i, 'quads'],
  [/adduktor|abduktor|h(ü|ue)fte|h(ü|ue)ftbeuger/i, 'adductors'],
  [/wade|soleus|gastrocnemius/i, 'calves'],
  [/rumpf \(schr(ä|ae)g\)|schr(ä|ae)g/i, 'obliques'],
  [/rumpf|bauch|core/i, 'abs'],
  // Auffangregel: ein blosses "Rücken" ist im Zweifel der Latissimus.
  [/r(ü|ue)cken/i, 'lats'],
];

/** Ordnet eine einzelne Muskelbezeichnung einer Region zu. */
export function regionOf(muscle: string): MuscleRegion | null {
  for (const [pattern, region] of PATTERNS) {
    if (pattern.test(muscle)) return region;
  }
  return null;
}

export interface ExerciseRegions {
  primary: Set<MuscleRegion>;
  secondary: Set<MuscleRegion>;
}

/**
 * Welche Regionen eine Uebung anspricht.
 * Fehlen im Katalog Muskelangaben (etwa bei Eintraegen aus wger), wird
 * ersatzweise die Kategorie herangezogen - besser als eine leere Karte.
 */
export function regionsOf(exercise: Exercise | undefined): ExerciseRegions {
  const primary = new Set<MuscleRegion>();
  const secondary = new Set<MuscleRegion>();
  if (!exercise) return { primary, secondary };

  for (const muscle of exercise.primaryMuscles) {
    const region = regionOf(muscle);
    if (region) primary.add(region);
  }
  for (const muscle of exercise.secondaryMuscles) {
    const region = regionOf(muscle);
    if (region && !primary.has(region)) secondary.add(region);
  }

  if (primary.size === 0) {
    for (const region of CATEGORY_FALLBACK[exercise.category] ?? []) primary.add(region);
  }
  return { primary, secondary };
}

/** Grobe Zuordnung, falls eine Uebung keine Muskelangaben mitbringt. */
const CATEGORY_FALLBACK: Record<string, MuscleRegion[]> = {
  chest: ['chest'],
  back: ['lats', 'trapezius'],
  legs: ['quads', 'hamstrings'],
  shoulders: ['deltoids'],
  arms: ['biceps', 'triceps'],
  core: ['abs'],
  glutes: ['glutes'],
  cardio: ['quads', 'calves'],
  fullbody: ['quads', 'chest', 'lats'],
  mobility: [],
  other: [],
};

/** Alle Regionen in einer sinnvollen Reihenfolge fuer Listen. */
export const ALL_REGIONS: MuscleRegion[] = [
  'chest', 'lats', 'trapezius', 'deltoids', 'biceps', 'triceps', 'forearms',
  'abs', 'obliques', 'lowerback', 'glutes', 'quads', 'hamstrings', 'adductors',
  'calves', 'neck',
];

/** Trifft eine Uebung die Region primaer, sekundaer oder gar nicht? */
export function regionRole(
  exercise: Exercise,
  region: MuscleRegion,
): 'primary' | 'secondary' | null {
  const { primary, secondary } = regionsOf(exercise);
  if (primary.has(region)) return 'primary';
  if (secondary.has(region)) return 'secondary';
  return null;
}

/**
 * Uebungen fuer eine Region, primaere zuerst. Innerhalb einer Gruppe wird
 * nach Anzahl der Zielmuskeln sortiert: eine Uebung, die vor allem diese
 * Region trifft, ist ein besserer Vorschlag als eine Ganzkoerperuebung.
 */
export function suggestForRegion(exercises: Exercise[], region: MuscleRegion): Exercise[] {
  const scored: Array<{ exercise: Exercise; rank: number; spread: number }> = [];
  for (const exercise of exercises) {
    const role = regionRole(exercise, region);
    if (!role) continue;
    const { primary, secondary } = regionsOf(exercise);
    scored.push({
      exercise,
      rank: role === 'primary' ? 0 : 1,
      spread: primary.size + secondary.size,
    });
  }
  scored.sort((a, b) => (
    a.rank - b.rank
    || a.spread - b.spread
    || a.exercise.name.localeCompare(b.exercise.name)
  ));
  return scored.map((item) => item.exercise);
}
