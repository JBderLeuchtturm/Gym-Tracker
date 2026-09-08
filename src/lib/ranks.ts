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
import { addDays, daysBetween, todayISO } from './date';

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

/* ------------------------------------------------------- Fortschritt und Ziel */

/**
 * Wo steht man innerhalb der eigenen Stufe?
 *
 * Der nackte Punktestand sagt "35 von 100" - das ist wahr und trotzdem
 * entmutigend, weil 100 weit weg ist. Naeher dran und ehrlicher ist: "drei
 * Viertel durch Geuebt". Genau das rechnet das hier aus.
 */
export interface TierProgress {
  tier: RankTier;
  nextTier: RankTier | null;
  /** 0 bis 1 innerhalb der aktuellen Stufe. */
  share: number;
  /** Punkte bis zur naechsten Stufe; null bei Elite. */
  toNext: number | null;
}

export function tierProgress(score: number): TierProgress {
  const tier = tierForScore(score);
  const index = TIERS.indexOf(tier);
  const nextTier = index < TIERS.length - 1 ? TIERS[index + 1] : null;
  const floor = TIER_FLOOR[tier];
  const ceiling = nextTier ? TIER_FLOOR[nextTier] : 100;
  const span = ceiling - floor;
  return {
    tier,
    nextTier,
    share: span > 0 ? Math.min(1, Math.max(0, (score - floor) / span)) : 1,
    toNext: nextTier ? Math.round((ceiling - score) * 10) / 10 : null,
  };
}

/**
 * Der naechste Schritt, der wirklich in Reichweite ist.
 *
 * Sechs Zeilen mit "noch 114 kg bis Geuebt" sind keine Anleitung, sondern eine
 * Wand. Deshalb wird eine davon herausgesucht: die mit dem kleinsten Abstand
 * zur naechsten Stufe. Ein Kilo, das man sich vorstellen kann, zieht mehr als
 * hundert, die man sich nicht vorstellen kann.
 *
 * Bewegungen ganz ohne Eintrag stehen vor allen anderen: Dort ist der erste
 * Satz der groesste Sprung, den es im ganzen System gibt.
 */
export interface NextStep {
  family: string;
  label: string;
  /** true, wenn die Bewegung ueberhaupt noch keinen Eintrag hat. */
  untouched: boolean;
  tier: RankTier | null;
  nextTier: RankTier | null;
  /** Fehlende Kilogramm bis zur naechsten Stufe. */
  missingKg: number;
  /** Was der Gesamtrang dadurch gewinnt. */
  gainPoints: number;
}

export function nextStep(ranks: ExerciseRank[], bodyWeightKg: number, sex: Sex): NextStep | null {
  if (!(bodyWeightKg > 0)) return null;
  const done = new Map(ranks.map((rank) => [rank.family, rank]));

  const options: NextStep[] = [];
  for (const family of RANKED_FAMILIES) {
    const thresholds = thresholdsFor(family, sex);
    if (!thresholds) continue;
    const rank = done.get(family);

    if (!rank) {
      // Ohne Eintrag zaehlt die Bewegung als null - der erste Satz bringt am meisten.
      options.push({
        family,
        label: STANDARDS[family].label,
        untouched: true,
        tier: null,
        nextTier: TIERS[0],
        missingKg: Math.round(thresholds[0] * bodyWeightKg * 10) / 10,
        gainPoints: Math.round((20 / RANKED_FAMILIES.length) * 10) / 10,
      });
      continue;
    }
    if (!rank.nextTier || rank.nextKg == null) continue;
    options.push({
      family,
      label: rank.label,
      untouched: false,
      tier: rank.tier,
      nextTier: rank.nextTier,
      missingKg: Math.round(Math.max(0, rank.nextKg - rank.bestKg) * 10) / 10,
      gainPoints: Math.round(((TIER_FLOOR[rank.nextTier] - rank.score) / RANKED_FAMILIES.length) * 10) / 10,
    });
  }

  if (options.length === 0) return null;

  /*
   * Unberuehrte Bewegungen zuerst, danach der kleinste Abstand. Bei gleichem
   * Abstand gewinnt, was mehr Punkte bringt.
   */
  options.sort((a, b) => {
    if (a.untouched !== b.untouched) return a.untouched ? -1 : 1;
    if (Math.abs(a.missingKg - b.missingKg) > 0.05) return a.missingKg - b.missingKg;
    return b.gainPoints - a.gainPoints;
  });
  return options[0];
}

/* ------------------------------------------------------------- Abzeichen */

/**
 * Meilensteine, die aus dem Verlauf abgeleitet werden - nichts davon wird
 * gespeichert. Ein abgelegtes "geschafft" kann zwischen zwei Geraeten
 * auseinanderlaufen; ein abgeleitetes nie. Dieselbe Regel wie bei den Zielen.
 */
export interface Badge {
  id: string;
  label: string;
  hint: string;
  earned: boolean;
  /** 0 bis 1 - wie weit ist es bis dahin? */
  share: number;
}

export function badges(
  ranks: ExerciseRank[],
  overall: OverallRank,
  weekStreak: number,
): Badge[] {
  const byFamily = new Map(ranks.map((rank) => [rank.family, rank]));
  const ratioOf = (family: string) => byFamily.get(family)?.ratio ?? 0;

  const list: Badge[] = [
    {
      id: 'erster-rang',
      label: 'Erster Rang',
      hint: 'Eine gewertete Bewegung im Verlauf',
      earned: ranks.length >= 1,
      share: Math.min(1, ranks.length),
    },
    {
      id: 'vollstaendig',
      label: 'Vollständig',
      hint: 'Alle sechs Bewegungen mindestens einmal',
      earned: overall.covered >= overall.total,
      share: overall.covered / overall.total,
    },
    {
      id: 'bank-koerpergewicht',
      label: 'Bank = Körpergewicht',
      hint: 'Einmal das eigene Gewicht bankdrücken',
      earned: ratioOf('bench') >= 1,
      share: Math.min(1, ratioOf('bench')),
    },
    {
      id: 'kniebeuge-anderthalb',
      label: 'Kniebeuge 1,5×',
      hint: 'Anderthalbfaches Körpergewicht in der Kniebeuge',
      earned: ratioOf('squat') >= 1.5,
      share: Math.min(1, ratioOf('squat') / 1.5),
    },
    {
      id: 'kreuzheben-doppelt',
      label: 'Kreuzheben 2×',
      hint: 'Doppeltes Körpergewicht im Kreuzheben',
      earned: ratioOf('deadlift') >= 2,
      share: Math.min(1, ratioOf('deadlift') / 2),
    },
    {
      id: 'tausend-kilo',
      label: 'Club der 1000',
      hint: 'Bank, Kniebeuge und Kreuzheben zusammen über 1000 kg',
      earned: bigThree(byFamily) >= 1000,
      share: Math.min(1, bigThree(byFamily) / 1000),
    },
    {
      id: 'stark-in-allem',
      label: 'Überall stark',
      hint: 'Jede gewertete Bewegung mindestens „Stark“',
      earned: overall.covered === overall.total && ranks.every((rank) => rank.score >= 60),
      share: overall.total > 0
        ? ranks.filter((rank) => rank.score >= 60).length / overall.total
        : 0,
    },
    {
      id: 'zehn-wochen',
      label: 'Zehn Wochen am Stück',
      hint: 'Zehn Wochen in Folge trainiert',
      earned: weekStreak >= 10,
      share: Math.min(1, weekStreak / 10),
    },
  ];

  // Erreichtes zuerst, dann das, was am naechsten dran ist.
  return list.sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    return b.share - a.share;
  });
}

/** Bank + Kniebeuge + Kreuzheben, die uebliche Dreiersumme. */
function bigThree(byFamily: Map<string, ExerciseRank>): number {
  return ['bench', 'squat', 'deadlift']
    .reduce((sum, family) => sum + (byFamily.get(family)?.bestKg ?? 0), 0);
}

/* -------------------------------------------------------------- Verlauf */

/**
 * Der Gesamtrang zu frueheren Zeitpunkten.
 *
 * Gerechnet wird jeweils mit dem Verlauf bis zu diesem Tag - so, wie der Rang
 * damals ausgesehen haette. Das Koerpergewicht von heute wird dabei durchweg
 * benutzt: Das rueckwirkend zu variieren wuerde eine Genauigkeit vortaeuschen,
 * die die Daten nicht hergeben.
 */
export function rankTimeline(
  state: AppState,
  allExercises: Exercise[],
  lookup: (id: ID) => Exercise | undefined,
  points = 8,
): Array<{ date: string; score: number }> {
  if (state.workouts.length === 0) return [];
  const dates = [...new Set(state.workouts.map((workout) => workout.date))].sort();
  const first = dates[0];
  const today = todayISO();
  const span = daysBetween(first, today);
  if (span <= 0) return [];

  const steps = Math.max(2, Math.min(points, dates.length));
  const out: Array<{ date: string; score: number }> = [];

  for (let index = 0; index < steps; index += 1) {
    const day = addDays(first, Math.round((span * index) / (steps - 1)));
    const upTo: AppState = {
      ...state,
      workouts: state.workouts.filter((workout) => workout.date <= day),
    };
    out.push({ date: day, score: overallRank(exerciseRanks(upTo, allExercises, lookup)).score });
  }
  return out;
}
