/**
 * Raenge: Wo steht ein Gewicht im Verhaeltnis zum eigenen Koerper?
 *
 * Grundlage sind die ueblichen Kraftstandards, wie sie seit Jahrzehnten in
 * Tabellenwerken stehen: Das geschaetzte Ein-Wiederholungs-Maximum wird durch
 * das Koerpergewicht geteilt, und das Verhaeltnis faellt in eine von fuenf
 * Stufen. 100 kg Bankdruecken heissen bei 70 kg Koerpergewicht etwas anderes
 * als bei 110 kg - genau das bildet der Rang ab.
 *
 * Was diese Zahlen NICHT sind: eine Messung. Es sind gerundete Richtwerte aus
 * oeffentlich verbreiteten Tabellen, sie schwanken je nach Quelle, und sie
 * sagen nichts ueber Technik, Hebelverhaeltnisse oder Alter. Sie taugen fuer
 * "wo stehe ich ungefaehr" und fuer den Vergleich mit Freunden, die dieselbe
 * Tabelle benutzen. Fuer sonst nichts.
 */

import type { AppState, Exercise, ID, Sex } from '../types';
import { exerciseHistory } from './stats';
import { familyOf } from './variants';
import { daysBetween, todayISO } from './date';

/* ------------------------------------------------------------------ Stufen */

export type RankTier = 'einsteiger' | 'geuebt' | 'fortgeschritten' | 'stark' | 'elite';

export const TIERS: RankTier[] = ['einsteiger', 'geuebt', 'fortgeschritten', 'stark', 'elite'];

export const TIER_LABELS: Record<RankTier, string> = {
  einsteiger: 'Einsteiger',
  geuebt: 'Geübt',
  fortgeschritten: 'Fortgeschritten',
  stark: 'Stark',
  elite: 'Elite',
};

/** Punktebereich je Stufe - fuer die Anzeige des Fortschritts innerhalb einer Stufe. */
export const TIER_FLOOR: Record<RankTier, number> = {
  einsteiger: 0, geuebt: 20, fortgeschritten: 40, stark: 60, elite: 80,
};

/* -------------------------------------------------------------- Standards */

/**
 * Vielfache des Koerpergewichts, ab denen eine Stufe beginnt.
 * Reihenfolge: Einsteiger, Geuebt, Fortgeschritten, Stark, Elite.
 */
interface Standard {
  label: string;
  male: [number, number, number, number, number];
  female: [number, number, number, number, number];
}

export const STANDARDS: Record<string, Standard> = {
  bench: {
    label: 'Bankdrücken',
    male: [0.5, 0.75, 1.25, 1.75, 2.0],
    female: [0.35, 0.5, 0.75, 1.0, 1.35],
  },
  squat: {
    label: 'Kniebeuge',
    male: [0.75, 1.25, 1.75, 2.5, 3.0],
    female: [0.5, 0.75, 1.25, 1.75, 2.25],
  },
  deadlift: {
    label: 'Kreuzheben',
    male: [1.0, 1.5, 2.0, 2.75, 3.25],
    female: [0.5, 1.0, 1.5, 2.0, 2.5],
  },
  ohp: {
    label: 'Schulterdrücken',
    male: [0.35, 0.55, 0.8, 1.1, 1.4],
    female: [0.2, 0.35, 0.5, 0.75, 1.0],
  },
  row: {
    label: 'Rudern',
    male: [0.5, 0.75, 1.0, 1.5, 1.75],
    female: [0.3, 0.45, 0.65, 0.95, 1.2],
  },
  curl: {
    label: 'Bizepscurl',
    male: [0.25, 0.4, 0.55, 0.75, 1.0],
    female: [0.15, 0.25, 0.35, 0.5, 0.65],
  },
};

/** Welche Bewegungen ueberhaupt einen Rang haben. */
export const RANKED_FAMILIES = Object.keys(STANDARDS);

/**
 * Die Tabelle zum Profil.
 *
 * Fuer "divers" gibt es keine veroeffentlichten Standards. Statt eine der
 * beiden Tabellen willkuerlich zu nehmen, wird gemittelt - und in der Anzeige
 * steht, dass es so gerechnet wurde.
 */
export function thresholdsFor(family: string, sex: Sex): number[] | null {
  const standard = STANDARDS[family];
  if (!standard) return null;
  if (sex === 'male') return standard.male;
  if (sex === 'female') return standard.female;
  return standard.male.map((value, index) => (value + standard.female[index]) / 2);
}

/* ------------------------------------------------------------- Punktestand */

/**
 * Verhaeltnis zu Punkten von 0 bis 100.
 *
 * Zwischen zwei Stufen wird linear geteilt: Wer genau auf der Schwelle zu
 * "Stark" liegt, hat 60 Punkte, in der Mitte zwischen zwei Schwellen 10 mehr.
 * Ueber Elite hinaus geht es weiter, aber gedaempft - sonst haette ein
 * einzelner sehr starker Wert das Gesamtbild in der Hand.
 */
export function ratioToScore(ratio: number, thresholds: number[]): number {
  if (ratio <= 0) return 0;
  if (ratio < thresholds[0]) return Math.max(0, (ratio / thresholds[0]) * 20);

  for (let index = 0; index < thresholds.length - 1; index += 1) {
    const low = thresholds[index];
    const high = thresholds[index + 1];
    if (ratio < high) {
      const share = (ratio - low) / (high - low);
      return 20 * (index + 1) + share * 20;
    }
  }

  // Oberhalb von Elite: gedaempft weiter, bei 120 gedeckelt.
  const elite = thresholds[thresholds.length - 1];
  const over = (ratio - elite) / elite;
  return Math.min(120, 100 + over * 25);
}

export const tierForScore = (score: number): RankTier => {
  if (score >= 80) return 'elite';
  if (score >= 60) return 'stark';
  if (score >= 40) return 'fortgeschritten';
  if (score >= 20) return 'geuebt';
  return 'einsteiger';
};

/**
 * Wie frisch ist ein Wert?
 *
 * Ein Bestwert von vor einem halben Jahr sagt etwas ueber damals. Er zaehlt
 * deshalb weniger - nicht, weil die Kraft weg waere, sondern weil er als
 * Beleg fuer den heutigen Stand schwaecher ist. Unter 60 Prozent faellt er
 * nie: Wer einmal 140 kg gehoben hat, faengt nicht bei null wieder an.
 */
export function freshness(days: number): number {
  if (days <= 28) return 1;
  if (days >= 180) return 0.6;
  return 1 - ((days - 28) / (180 - 28)) * 0.4;
}

export interface ExerciseRank {
  family: string;
  label: string;
  /** Bestes geschaetztes 1RM in dieser Bewegung. */
  bestKg: number;
  /** Vielfaches des Koerpergewichts. */
  ratio: number;
  score: number;
  tier: RankTier;
  /** Punkte bis zur naechsten Stufe; null bei Elite. */
  toNext: number | null;
  nextTier: RankTier | null;
  /** Gewicht, mit dem die naechste Stufe erreicht waere. */
  nextKg: number | null;
  lastDate: string;
  days: number;
}

/**
 * Rang je Bewegung aus dem gesamten Verlauf.
 *
 * Gewertet wird der beste Satz - nicht der letzte. Ein Rang ist eine Bestmarke,
 * und die verliert man nicht dadurch, dass man danach leichter trainiert hat.
 */
export function exerciseRanks(
  state: AppState,
  allExercises: Exercise[],
  lookup: (id: ID) => Exercise | undefined,
): ExerciseRank[] {
  const bodyWeight = state.profile.weightKg;
  if (!(bodyWeight > 0)) return [];

  const byFamily = new Map<string, Exercise[]>();
  for (const exercise of allExercises) {
    const family = familyOf(exercise, lookup);
    if (!family || !STANDARDS[family.id]) continue;
    byFamily.set(family.id, [...(byFamily.get(family.id) ?? []), exercise]);
  }

  const ranks: ExerciseRank[] = [];
  const today = todayISO();

  for (const [familyId, exercises] of byFamily) {
    const thresholds = thresholdsFor(familyId, state.profile.sex);
    if (!thresholds) continue;

    let bestKg = 0;
    let lastDate = '';
    for (const exercise of exercises) {
      for (const session of exerciseHistory(state, exercise.id)) {
        if (session.best1RM > bestKg) { bestKg = session.best1RM; lastDate = session.date; }
      }
    }
    if (bestKg <= 0) continue;

    const ratio = bestKg / bodyWeight;
    const score = ratioToScore(ratio, thresholds);
    const tier = tierForScore(score);
    const tierIndex = TIERS.indexOf(tier);
    const nextTier = tierIndex < TIERS.length - 1 ? TIERS[tierIndex + 1] : null;
    const nextKg = nextTier ? Math.round(thresholds[tierIndex + 1] * bodyWeight * 10) / 10 : null;

    ranks.push({
      family: familyId,
      label: STANDARDS[familyId].label,
      bestKg: Math.round(bestKg * 10) / 10,
      ratio: Math.round(ratio * 100) / 100,
      score: Math.round(score * 10) / 10,
      tier,
      toNext: nextTier ? Math.round((TIER_FLOOR[nextTier] - score) * 10) / 10 : null,
      nextTier,
      nextKg,
      lastDate,
      days: lastDate ? daysBetween(lastDate, today) : 0,
    });
  }

  return ranks.sort((a, b) => b.score - a.score);
}

export interface OverallRank {
  score: number;
  tier: RankTier;
  /** Wie viele der sechs Bewegungen ueberhaupt Daten haben. */
  covered: number;
  total: number;
  parts: ExerciseRank[];
}

/**
 * Der Gesamtrang.
 *
 * Der Schnitt ueber alle gewerteten Bewegungen, jede mit ihrer Frische
 * gewichtet - und Bewegungen ohne einen einzigen Eintrag zaehlen als Null.
 * Das ist der Grund, warum der Wert steigen und fallen kann: Wer nur noch
 * Bizeps trainiert, verliert ueber die Monate Punkte bei allem anderen.
 */
export function overallRank(ranks: ExerciseRank[]): OverallRank {
  const total = RANKED_FAMILIES.length;
  if (ranks.length === 0) {
    return { score: 0, tier: 'einsteiger', covered: 0, total, parts: [] };
  }

  const sum = ranks.reduce((acc, rank) => acc + rank.score * freshness(rank.days), 0);
  const score = Math.round((sum / total) * 10) / 10;

  return {
    score,
    tier: tierForScore(score),
    covered: ranks.length,
    total,
    parts: ranks,
  };
}
