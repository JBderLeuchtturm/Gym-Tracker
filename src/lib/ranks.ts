/**
 * Raenge: Wo steht ein Gewicht im Verhaeltnis zum eigenen Koerper?
 *
 * Grundlage sind die ueblichen Kraftstandards, wie sie seit Jahrzehnten in
 * Tabellenwerken stehen: Das geschaetzte Ein-Wiederholungs-Maximum wird durch
 * das Koerpergewicht geteilt, und das Verhaeltnis faellt in eine von fuenf
 * Stufen. 100 kg Bankdruecken heissen bei 70 kg Koerpergewicht etwas anderes
 * als bei 110 kg - genau das bildet der Rang ab.
 *
 * Drei Ebenen:
 *   1. Jede einzelne Uebung bekommt einen Rang - auch "Schrägbankdrücken",
 *      auch "Klimmzüge", auch die selbst angelegte.
 *   2. Jede Bewegungsgruppe bekommt einen, aus ihrer besten Uebung.
 *   3. Daraus entsteht der Gesamtrang.
 *
 * Was diese Zahlen NICHT sind: eine Messung. Es sind gerundete Richtwerte aus
 * oeffentlich verbreiteten Tabellen, sie schwanken je nach Quelle, und sie
 * sagen nichts ueber Technik, Hebelverhaeltnisse oder Alter. Sie taugen fuer
 * "wo stehe ich ungefaehr" und fuer den Vergleich mit Freunden, die dieselbe
 * Tabelle benutzen. Fuer sonst nichts.
 */

import type { AppState, Exercise, ID, Sex } from '../types';
import { estimate1RM, exerciseHistory, type ExerciseSession } from './stats';
import { familyOf, FAMILIES } from './variants';
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
 * Woran wird gemessen?
 *
 * - `load`     Gewicht auf der Stange, als Vielfaches des Koerpergewichts.
 * - `bodyload` Gesamtlast einschliesslich des eigenen Koerpers. Ein Klimmzug
 *              ohne Zusatzgewicht ist genau 1,0 - unter "load" waere er null.
 * - `reps`     Wiederholungen in einem Satz. Fuer Liegestuetze gibt es kein
 *              sinnvolles Gewicht, aber sehr wohl einen Unterschied zwischen
 *              fuenf und fuenfzig.
 * - `seconds`  Haltezeit.
 */
export type RankBasis = 'load' | 'bodyload' | 'reps' | 'seconds';

interface Standard {
  label: string;
  basis: RankBasis;
  /** Reihenfolge: Einsteiger, Geuebt, Fortgeschritten, Stark, Elite. */
  male: [number, number, number, number, number];
  female: [number, number, number, number, number];
  /** Gewicht im Gesamtrang. Die Grunduebungen zaehlen voll, Beiwerk weniger. */
  weight: number;
}

export const STANDARDS: Record<string, Standard> = {
  /* ------------------------------------------------- Die drei Grunduebungen */
  squat: {
    label: 'Kniebeuge', basis: 'load', weight: 1,
    male: [0.75, 1.25, 1.75, 2.5, 3.0], female: [0.5, 0.75, 1.25, 1.75, 2.25],
  },
  bench: {
    label: 'Bankdrücken', basis: 'load', weight: 1,
    male: [0.5, 0.75, 1.25, 1.75, 2.0], female: [0.35, 0.5, 0.75, 1.0, 1.35],
  },
  deadlift: {
    label: 'Kreuzheben', basis: 'load', weight: 1,
    male: [1.0, 1.5, 2.0, 2.75, 3.25], female: [0.5, 1.0, 1.5, 2.0, 2.5],
  },

  /* ------------------------------------- Die weiteren Grundmuster: druecken,
     ziehen von oben, ziehen waagerecht. Wer die drei oben macht und diese hier
     auslaesst, hat eine halbe Ausbildung - deshalb zaehlen sie deutlich mit. */
  ohp: {
    label: 'Schulterdrücken', basis: 'load', weight: 0.75,
    male: [0.35, 0.55, 0.8, 1.1, 1.4], female: [0.2, 0.35, 0.5, 0.75, 1.0],
  },
  pulldown: {
    label: 'Klimmzug', basis: 'bodyload', weight: 0.75,
    male: [0.9, 1.05, 1.3, 1.6, 1.95], female: [0.75, 0.95, 1.15, 1.4, 1.7],
  },
  latpulldown: {
    label: 'Latzug', basis: 'load', weight: 0.5,
    male: [0.5, 0.75, 1.0, 1.35, 1.65], female: [0.35, 0.5, 0.7, 0.95, 1.2],
  },
  row: {
    label: 'Rudern', basis: 'load', weight: 0.75,
    male: [0.5, 0.75, 1.0, 1.5, 1.75], female: [0.3, 0.45, 0.65, 0.95, 1.2],
  },

  /* ------------------------------------------------------------- Beiwerk */
  dips: {
    label: 'Dips', basis: 'bodyload', weight: 0.4,
    male: [0.85, 1.0, 1.25, 1.55, 1.9], female: [0.7, 0.9, 1.1, 1.35, 1.65],
  },
  pushup: {
    label: 'Liegestütze', basis: 'reps', weight: 0.3,
    male: [5, 15, 30, 50, 75], female: [3, 10, 22, 38, 60],
  },
  legpress: {
    label: 'Beinpresse', basis: 'load', weight: 0.4,
    male: [1.0, 1.75, 2.5, 3.5, 4.5], female: [0.75, 1.25, 2.0, 2.75, 3.5],
  },
  lunge: {
    label: 'Ausfallschritt', basis: 'load', weight: 0.35,
    male: [0.3, 0.5, 0.75, 1.1, 1.5], female: [0.2, 0.35, 0.55, 0.8, 1.1],
  },
  hipthrust: {
    label: 'Hüftstoß', basis: 'load', weight: 0.35,
    male: [0.75, 1.25, 1.9, 2.6, 3.4], female: [0.6, 1.0, 1.6, 2.25, 3.0],
  },
  curl: {
    label: 'Bizepscurl', basis: 'load', weight: 0.35,
    male: [0.25, 0.4, 0.55, 0.75, 1.0], female: [0.15, 0.25, 0.35, 0.5, 0.65],
  },
  triceps: {
    label: 'Trizeps', basis: 'load', weight: 0.35,
    male: [0.3, 0.45, 0.65, 0.9, 1.15], female: [0.2, 0.3, 0.45, 0.6, 0.8],
  },
  calf: {
    label: 'Wadenheben', basis: 'load', weight: 0.3,
    male: [0.75, 1.25, 1.75, 2.5, 3.25], female: [0.5, 0.9, 1.3, 1.8, 2.4],
  },
  legcurl: {
    label: 'Beinbeuger', basis: 'load', weight: 0.3,
    male: [0.35, 0.55, 0.75, 1.0, 1.3], female: [0.25, 0.4, 0.55, 0.75, 1.0],
  },
  legext: {
    label: 'Beinstrecker', basis: 'load', weight: 0.3,
    male: [0.5, 0.75, 1.0, 1.35, 1.75], female: [0.35, 0.55, 0.75, 1.0, 1.3],
  },
  shrug: {
    label: 'Schulterheben', basis: 'load', weight: 0.25,
    male: [0.6, 1.0, 1.5, 2.1, 2.75], female: [0.4, 0.7, 1.05, 1.5, 2.0],
  },
  raise: {
    label: 'Seitheben', basis: 'load', weight: 0.25,
    male: [0.06, 0.1, 0.15, 0.22, 0.3], female: [0.04, 0.07, 0.1, 0.15, 0.2],
  },
  fly: {
    label: 'Fliegende', basis: 'load', weight: 0.25,
    male: [0.15, 0.25, 0.4, 0.55, 0.75], female: [0.1, 0.17, 0.25, 0.37, 0.5],
  },
  plank: {
    label: 'Unterarmstütz', basis: 'seconds', weight: 0.2,
    male: [30, 60, 120, 180, 300], female: [30, 60, 120, 180, 300],
  },
};

/** Welche Bewegungen ueberhaupt einen Standard haben. */
export const RANKED_FAMILIES = Object.keys(STANDARDS);

/** Summe aller Gewichte - der Nenner des Gesamtrangs. */
const TOTAL_WEIGHT = RANKED_FAMILIES.reduce((sum, id) => sum + STANDARDS[id].weight, 0);

/**
 * Wie schwer faellt eine Spielart im Vergleich zur Leituebung ihrer Gruppe?
 *
 * Schraegbankdruecken laeuft mit rund 85 Prozent des flachen - wer beides mit
 * derselben Tabelle misst, sieht bei jeder Schraegbank einen Rueckschritt, den
 * es nicht gibt. Der Faktor verschiebt die Schwellen entsprechend.
 *
 * Auch das sind Richtwerte. Wo keiner steht, gilt eins.
 */
const EXERCISE_FACTORS: Array<[RegExp, number]> = [
  [/handstand/i, 0.35],
  [/pistol/i, 0.5],
  [/muscle-?up/i, 0.6],
  [/nordic/i, 0.6],
  [/diamant|diamond/i, 0.7],
  [/konzentrationscurl|concentration/i, 0.7],
  [/frontkniebeuge|front squat/i, 0.8],
  [/gestreckte beine|stiff.?leg|romanian|rumänisch/i, 0.82],
  [/ring dips/i, 0.8],
  [/scott|preacher|larry/i, 0.85],
  [/schrägbank|schraegbank|incline/i, 0.85],
  [/erhöht|decline push/i, 0.85],
  [/nackendrücken|behind.?neck/i, 0.85],
  [/enges|close.?grip/i, 0.88],
  [/defizit|deficit/i, 0.9],
  [/mit pause|paused/i, 0.9],
  [/weit\b|wide.?grip/i, 0.92],
  [/sitzend|seated/i, 0.95],
  [/untergriff|chin-?up/i, 1.05],
  [/sumo/i, 1.02],
  [/negativbank|decline bench/i, 1.05],
  [/hammercurl|hammer curl/i, 1.1],
  [/smith|multipresse/i, 1.1],
  [/trap.?bar/i, 1.12],
  [/hackenschmidt|hack squat/i, 1.15],
  [/push press/i, 1.2],
];

export function exerciseFactor(exercise: Exercise | undefined): number {
  if (!exercise) return 1;
  const haystack = `${exercise.name} ${exercise.nameEn ?? ''}`;
  for (const [pattern, factor] of EXERCISE_FACTORS) {
    if (pattern.test(haystack)) return factor;
  }
  return 1;
}

/**
 * Die Tabelle zum Profil.
 *
 * Fuer "divers" gibt es keine veroeffentlichten Standards. Statt eine der
 * beiden Tabellen willkuerlich zu nehmen, wird gemittelt - und in der Anzeige
 * steht, dass es so gerechnet wurde.
 */
export function thresholdsFor(family: string, sex: Sex, factor = 1): number[] | null {
  const standard = STANDARDS[family];
  if (!standard) return null;
  const base = sex === 'male' ? standard.male
    : sex === 'female' ? standard.female
      : standard.male.map((value, index) => (value + standard.female[index]) / 2);
  return base.map((value) => value * factor);
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

/* ---------------------------------------------------- Der Wert einer Uebung */

/**
 * Der Wert, der in die Tabelle geht - je nach Messgroesse ein anderer.
 *
 * Bei Koerpergewichtsuebungen zaehlt die Gesamtlast: Ein Klimmzug bewegt den
 * ganzen Menschen, das Feld im Satz meint nur den Guertel mit der Scheibe.
 * Frueher stand da rechnerisch null, und Klimmzuege kamen im Rang nicht vor.
 */
export function sessionValue(
  session: ExerciseSession,
  basis: RankBasis,
  bodyWeightKg: number,
): number {
  if (basis === 'reps') return session.maxReps;
  if (basis === 'seconds') return session.bestDurationSec;

  if (basis === 'bodyload') {
    let best = 0;
    for (const set of session.sets) {
      if (set.isWarmup && session.sets.some((other) => !other.isWarmup)) continue;
      const load = bodyWeightKg + (set.weightKg ?? 0);
      const reps = set.reps ?? 0;
      if (reps <= 0) continue;
      best = Math.max(best, estimate1RM(load, reps));
    }
    return best;
  }

  return session.best1RM;
}

/** Der Messwert im Verhaeltnis zur Tabelle. */
const ratioOf = (value: number, basis: RankBasis, bodyWeightKg: number): number => (
  basis === 'reps' || basis === 'seconds' ? value : value / bodyWeightKg
);

/* -------------------------------------------------------------- Ein Rang */

export interface RankEntry {
  /** Bewegungsgruppe, zu der das gehoert. */
  family: string;
  label: string;
  basis: RankBasis;
  /** Bester Wert: Kilogramm, Wiederholungen oder Sekunden - je nach basis. */
  best: number;
  /** Vielfaches des Koerpergewichts; bei Wiederholungen und Zeit gleich best. */
  ratio: number;
  score: number;
  tier: RankTier;
  nextTier: RankTier | null;
  /** Wert, mit dem die naechste Stufe erreicht waere. */
  nextValue: number | null;
  /** Die fuenf Schwellen in derselben Einheit wie best. */
  thresholds: number[];
  lastDate: string;
  days: number;
  sessions: number;
  /**
   * Ohne Tabelle gerechnet - aus dem eigenen Verlauf. Dann sagt der Rang
   * "du bist besser geworden", nicht "du bist stark".
   */
  personal: boolean;
}

export interface ExerciseRankEntry extends RankEntry {
  exerciseId: ID;
  exerciseName: string;
  category: string;
  /** Faktor der Spielart gegenueber der Leituebung. */
  factor: number;
}

/** Der Rang der Gruppe - aus ihrer stärksten Uebung. */
export interface FamilyRank extends RankEntry {
  /** Die Uebung, die den Rang traegt. */
  bestExerciseId: ID | null;
  bestExerciseName: string;
  /** Wie viele Uebungen dieser Gruppe im Verlauf stehen. */
  exercises: number;
  /** Gewicht im Gesamtrang. */
  weight: number;
}

/* ---------------------------------------------------------- Rang je Uebung */

/**
 * Ein Rang fuer jede einzelne Uebung, die im Verlauf steht.
 *
 * Gewertet wird der beste Satz, nicht der letzte: Ein Rang ist eine Bestmarke,
 * und die verliert man nicht dadurch, dass man danach leichter trainiert hat.
 */
export function exerciseRanks(
  state: AppState,
  allExercises: Exercise[],
  lookup: (id: ID) => Exercise | undefined,
): ExerciseRankEntry[] {
  const bodyWeight = state.profile.weightKg;
  if (!(bodyWeight > 0)) return [];

  const today = todayISO();
  const seen = new Set<ID>();
  for (const workout of state.workouts) {
    for (const logged of workout.exercises) {
      if (!logged.skipped) seen.add(logged.exerciseId);
    }
  }

  const out: ExerciseRankEntry[] = [];
  for (const id of seen) {
    const exercise = lookup(id) ?? allExercises.find((item) => item.id === id);
    if (!exercise) continue;
    const sessions = exerciseHistory(state, id);
    if (sessions.length === 0) continue;

    const entry = rankFromSessions(exercise, sessions, state.profile.sex, bodyWeight, today, lookup);
    if (entry) out.push({ ...entry, exerciseId: id, exerciseName: exercise.name,
      category: exercise.category, factor: exerciseFactor(exercise) });
  }

  return out.sort((a, b) => b.score - a.score);
}

/** Rang einer Uebung aus ihren Einheiten. */
function rankFromSessions(
  exercise: Exercise,
  sessions: ExerciseSession[],
  sex: Sex,
  bodyWeightKg: number,
  today: string,
  lookup: (id: ID) => Exercise | undefined,
): RankEntry | null {
  const family = familyOf(exercise, lookup);
  const standard = family ? STANDARDS[family.id] : undefined;

  if (!standard) return personalRank(exercise, sessions, family?.id ?? 'sonstiges', today);

  /*
   * Eine Koerpergewichtsuebung in einer Gruppe, die in Kilogramm misst, hat
   * keinen brauchbaren Massstab: Der Beinbeuger am Ball waere sonst mit dem
   * ganzen Koerpergewicht angetreten und haette an der Maschinentabelle fast
   * "Elite" erreicht. Dort zaehlt der eigene Verlauf.
   */
  if (exercise.kind === 'bodyweight' && standard.basis === 'load') {
    return personalRank(exercise, sessions, family!.id, today);
  }

  const factor = exerciseFactor(exercise);
  const thresholds = thresholdsFor(family!.id, sex, factor)!;
  const scaled = standard.basis === 'reps' || standard.basis === 'seconds'
    ? thresholds
    : thresholds.map((value) => value * bodyWeightKg);

  let best = 0;
  let lastDate = '';
  for (const session of sessions) {
    const value = sessionValue(session, standard.basis, bodyWeightKg);
    if (value > best) { best = value; lastDate = session.date; }
  }
  if (best <= 0) return personalRank(exercise, sessions, family!.id, today);

  const ratio = ratioOf(best, standard.basis, bodyWeightKg);
  const score = ratioToScore(ratio, thresholds);
  const tier = tierForScore(score);
  const tierIndex = TIERS.indexOf(tier);
  const nextTier = tierIndex < TIERS.length - 1 ? TIERS[tierIndex + 1] : null;

  return {
    family: family!.id,
    label: standard.label,
    basis: standard.basis,
    best: Math.round(best * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    score: Math.round(score * 10) / 10,
    tier,
    nextTier,
    nextValue: nextTier ? Math.round(scaled[tierIndex + 1] * 10) / 10 : null,
    thresholds: scaled.map((value) => Math.round(value * 10) / 10),
    lastDate,
    days: lastDate ? daysBetween(lastDate, today) : 0,
    sessions: sessions.length,
    personal: false,
  };
}

/**
 * Rang ohne Tabelle - aus dem eigenen Verlauf.
 *
 * Fuer Bauchuebungen, Mobilitaet und alles Selbstangelegte gibt es keine
 * veroeffentlichten Standards, und sich welche auszudenken waere schlechter
 * als gar keine. Was es aber gibt, ist die eigene Entwicklung: Wie viel mehr
 * schaffst du heute als beim ersten Mal, und wie oft warst du dran.
 *
 * Der Rang heisst deshalb dasselbe, meint aber etwas anderes - und das steht
 * in der Anzeige auch so dran.
 */
function personalRank(
  exercise: Exercise,
  sessions: ExerciseSession[],
  family: string,
  today: string,
): RankEntry | null {
  const measure = (session: ExerciseSession): number => (
    session.best1RM > 0 ? session.best1RM
      : session.bestDurationSec > 0 ? session.bestDurationSec
        : session.maxReps
  );

  const first = measure(sessions[0]);
  let best = 0;
  let lastDate = sessions[0].date;
  for (const session of sessions) {
    const value = measure(session);
    if (value > best) { best = value; lastDate = session.date; }
  }
  if (best <= 0) return null;

  const growth = first > 0 ? best / first : 1;
  // Bis 12 Einheiten waechst der Anteil fuer Bestaendigkeit, bis +75 % der fuer Fortschritt.
  const steady = Math.min(1, sessions.length / 12);
  const gain = Math.min(1, Math.max(0, (growth - 1) / 0.75));
  const score = Math.round((35 * steady + 65 * gain) * 10) / 10;
  const tier = tierForScore(score);
  const tierIndex = TIERS.indexOf(tier);
  const nextTier = tierIndex < TIERS.length - 1 ? TIERS[tierIndex + 1] : null;

  return {
    family,
    label: exercise.name,
    basis: sessions[0].best1RM > 0 ? 'load' : sessions[0].bestDurationSec > 0 ? 'seconds' : 'reps',
    best: Math.round(best * 10) / 10,
    ratio: Math.round(growth * 100) / 100,
    score,
    tier,
    nextTier,
    nextValue: null,
    thresholds: [],
    lastDate,
    days: daysBetween(lastDate, today),
    sessions: sessions.length,
    personal: true,
  };
}

/* -------------------------------------------------------- Rang je Bewegung */

/**
 * Der Rang einer Bewegungsgruppe: der ihrer staerksten Uebung.
 *
 * Nicht der Schnitt - wer schwer flach drueckt und daneben leicht schraeg,
 * ist im Bankdruecken so stark wie sein bester Satz, nicht wie sein
 * Durchschnitt.
 */
export function familyRanks(exercises: ExerciseRankEntry[]): FamilyRank[] {
  const byFamily = new Map<string, ExerciseRankEntry[]>();
  for (const entry of exercises) {
    if (entry.personal) continue;
    byFamily.set(entry.family, [...(byFamily.get(entry.family) ?? []), entry]);
  }

  const out: FamilyRank[] = [];
  for (const [family, list] of byFamily) {
    const standard = STANDARDS[family];
    if (!standard) continue;
    const best = list.reduce((top, item) => (item.score > top.score ? item : top), list[0]);
    out.push({
      ...best,
      label: standard.label,
      bestExerciseId: best.exerciseId,
      bestExerciseName: best.exerciseName,
      exercises: list.length,
      weight: standard.weight,
      sessions: list.reduce((sum, item) => sum + item.sessions, 0),
    });
  }
  return out.sort((a, b) => b.score * b.weight - a.score * a.weight);
}

/* ------------------------------------------------------------ Gesamtrang */

export interface OverallRank {
  score: number;
  tier: RankTier;
  /** Wie viele Bewegungen ueberhaupt Daten haben. */
  covered: number;
  total: number;
  /** Anteil des abgedeckten Gewichts, 0 bis 1. */
  breadth: number;
  /** Faktor fuer die Breite, mit dem der Schnitt multipliziert wurde. */
  breadthFactor: number;
  /** Der Schnitt ueber das, was trainiert wurde - vor dem Breitenfaktor. */
  depth: number;
  parts: FamilyRank[];
}

/**
 * Der Gesamtrang.
 *
 * Zwei Zahlen ergeben ihn:
 *
 *   Tiefe   - der gewichtete Schnitt ueber die Bewegungen, die du trainierst.
 *             Die drei Grunduebungen zaehlen voll, die weiteren Grundmuster
 *             drei Viertel, Beiwerk je nach Bedeutung weniger. Jede Bewegung
 *             geht mit ihrer Frische ein.
 *   Breite  - wie viel des Gewichts ueberhaupt abgedeckt ist. Wer nur die drei
 *             Grunduebungen macht, kommt auf rund drei Viertel des Werts; wer
 *             alles abdeckt, auf den vollen.
 *
 * Frueher zaehlten untrainierte Bewegungen schlicht als null. Bei sechs
 * Bewegungen ging das noch; bei zwanzig haette es bedeutet, dass selbst ein
 * sehr starker Mensch nie ueber "Geuebt" hinauskommt, solange er nicht auch
 * Seitheben protokolliert. Die Breite zieht jetzt spuerbar, aber sie erdrueckt
 * die Leistung nicht mehr.
 */
export function overallRank(families: FamilyRank[]): OverallRank {
  const total = RANKED_FAMILIES.length;
  if (families.length === 0) {
    return {
      score: 0, tier: 'einsteiger', covered: 0, total,
      breadth: 0, breadthFactor: 0.35, depth: 0, parts: [],
    };
  }

  let weighted = 0;
  let weightSum = 0;
  for (const family of families) {
    const value = family.score * freshness(family.days);
    weighted += value * family.weight;
    weightSum += family.weight;
  }
  const depth = weightSum > 0 ? weighted / weightSum : 0;

  const breadth = Math.min(1, weightSum / TOTAL_WEIGHT);
  const breadthFactor = 0.35 + 0.65 * Math.sqrt(breadth);
  const score = Math.round(depth * breadthFactor * 10) / 10;

  return {
    score,
    tier: tierForScore(score),
    covered: families.length,
    total,
    breadth: Math.round(breadth * 1000) / 1000,
    breadthFactor: Math.round(breadthFactor * 1000) / 1000,
    depth: Math.round(depth * 10) / 10,
    parts: families,
  };
}

/** Der ganze Rang in einem Rutsch - Uebungen, Bewegungen, Gesamt. */
export interface RankSnapshot {
  exercises: ExerciseRankEntry[];
  families: FamilyRank[];
  overall: OverallRank;
}

export function rankSnapshot(
  state: AppState,
  allExercises: Exercise[],
  lookup: (id: ID) => Exercise | undefined,
): RankSnapshot {
  const exercises = exerciseRanks(state, allExercises, lookup);
  const families = familyRanks(exercises);
  return { exercises, families, overall: overallRank(families) };
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
 * Die naechsten Schritte, die wirklich in Reichweite sind.
 *
 * Zwanzig Zeilen mit "noch 114 kg bis Geuebt" sind keine Anleitung, sondern
 * eine Wand. Deshalb werden die drei herausgesucht, die am wenigsten fehlen -
 * und Bewegungen ganz ohne Eintrag stehen davor: Dort ist der erste Satz der
 * groesste Sprung, den es im ganzen System gibt.
 */
export interface NextStep {
  family: string;
  label: string;
  basis: RankBasis;
  untouched: boolean;
  tier: RankTier | null;
  nextTier: RankTier | null;
  /** Fehlender Wert bis zur naechsten Stufe, in der Einheit der Bewegung. */
  missing: number;
  /** Zielwert. */
  target: number;
  /** Was der Gesamtrang dadurch ungefaehr gewinnt. */
  gainPoints: number;
}

export function nextSteps(
  snapshot: RankSnapshot,
  bodyWeightKg: number,
  sex: Sex,
  limit = 3,
): NextStep[] {
  if (!(bodyWeightKg > 0)) return [];
  const done = new Map(snapshot.families.map((rank) => [rank.family, rank]));
  const weightSum = snapshot.families.reduce((sum, rank) => sum + rank.weight, 0);

  const options: NextStep[] = [];
  for (const family of RANKED_FAMILIES) {
    const standard = STANDARDS[family];
    const thresholds = thresholdsFor(family, sex);
    if (!thresholds) continue;
    const scaled = standard.basis === 'reps' || standard.basis === 'seconds'
      ? thresholds
      : thresholds.map((value) => value * bodyWeightKg);
    const rank = done.get(family);

    if (!rank) {
      // Eine neue Bewegung hebt vor allem die Breite - das rechnet sich.
      const after = 0.35 + 0.65 * Math.sqrt(Math.min(1, (weightSum + standard.weight) / TOTAL_WEIGHT));
      const before = 0.35 + 0.65 * Math.sqrt(Math.min(1, weightSum / TOTAL_WEIGHT));
      options.push({
        family, label: standard.label, basis: standard.basis, untouched: true,
        tier: null, nextTier: TIERS[0],
        missing: Math.round(scaled[0] * 10) / 10,
        target: Math.round(scaled[0] * 10) / 10,
        gainPoints: Math.max(0.5, Math.round(snapshot.overall.depth * (after - before) * 10) / 10),
      });
      continue;
    }
    if (!rank.nextTier || rank.nextValue == null) continue;
    const gain = ((TIER_FLOOR[rank.nextTier] - rank.score) * rank.weight)
      / Math.max(1, weightSum) * snapshot.overall.breadthFactor;
    options.push({
      family, label: standard.label, basis: standard.basis, untouched: false,
      tier: rank.tier, nextTier: rank.nextTier,
      missing: Math.round(Math.max(0, rank.nextValue - rank.best) * 10) / 10,
      target: rank.nextValue,
      gainPoints: Math.round(Math.max(0, gain) * 10) / 10,
    });
  }

  if (options.length === 0) return [];

  /*
   * Unberuehrte Bewegungen zuerst - nach Gewicht, damit "Kniebeuge" vor
   * "Seitheben" steht. Danach das, was am wenigsten fehlt.
   */
  options.sort((a, b) => {
    if (a.untouched !== b.untouched) return a.untouched ? -1 : 1;
    if (a.untouched) return b.gainPoints - a.gainPoints;
    const aShare = a.target > 0 ? a.missing / a.target : 1;
    const bShare = b.target > 0 ? b.missing / b.target : 1;
    if (Math.abs(aShare - bShare) > 0.005) return aShare - bShare;
    return b.gainPoints - a.gainPoints;
  });
  return options.slice(0, limit);
}

/** Der eine naechste Schritt - fuer die kleine Anzeige auf der Fortschrittsseite. */
export const nextStep = (
  snapshot: RankSnapshot, bodyWeightKg: number, sex: Sex,
): NextStep | null => nextSteps(snapshot, bodyWeightKg, sex, 1)[0] ?? null;

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
    out.push({ date: day, score: rankSnapshot(upTo, allExercises, lookup).overall.score });
  }
  return out;
}

/** Wie viele Bewegungen stehen auf welcher Stufe? Fuer die Uebersicht. */
export function tierCounts(families: FamilyRank[]): Record<RankTier, number> {
  const counts: Record<RankTier, number> = {
    einsteiger: 0, geuebt: 0, fortgeschritten: 0, stark: 0, elite: 0,
  };
  for (const family of families) counts[family.tier] += 1;
  return counts;
}

/** Alle Bewegungen, auch die ohne Eintrag - fuer die vollstaendige Tabelle. */
export function allFamilyRows(
  families: FamilyRank[],
  bodyWeightKg: number,
  sex: Sex,
): Array<{ family: string; label: string; basis: RankBasis; weight: number;
  rank: FamilyRank | null; thresholds: number[] }> {
  const done = new Map(families.map((rank) => [rank.family, rank]));
  return RANKED_FAMILIES.map((family) => {
    const standard = STANDARDS[family];
    const thresholds = thresholdsFor(family, sex) ?? [];
    const scaled = standard.basis === 'reps' || standard.basis === 'seconds'
      ? thresholds
      : thresholds.map((value) => value * bodyWeightKg);
    return {
      family,
      label: standard.label,
      basis: standard.basis,
      weight: standard.weight,
      rank: done.get(family) ?? null,
      thresholds: scaled.map((value) => Math.round(value * 10) / 10),
    };
  }).sort((a, b) => (b.rank?.score ?? -1) - (a.rank?.score ?? -1) || b.weight - a.weight);
}

/** Die Bewegungsgruppen, die es überhaupt gibt - auch ohne Standard. */
export const FAMILY_LABELS: Record<string, string> = Object.fromEntries(
  FAMILIES.map((family) => [family.id, family.label]),
);
