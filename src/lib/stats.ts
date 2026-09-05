import type { AppState, ID, LoggedExercise, SetLog, Workout } from '../types';
import { weekKey } from './date';

/** Volumen eines Satzes (Gewicht x Wiederholungen). */
/**
 * Zaehlt der Satz in die eigene Auswertung? Aufwaermsaetze und Saetze des
 * Trainingspartners tun das nicht - abgehakt sein muss er ohnehin.
 */
export const countsAsWork = (set: SetLog): boolean =>
  set.done && !set.isWarmup && !set.forPartner;

export const setVolume = (set: SetLog): number =>
  countsAsWork(set) ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0;

export const exerciseVolume = (logged: LoggedExercise): number =>
  logged.sets.reduce((sum, set) => sum + setVolume(set), 0);

export const workoutVolume = (workout: Workout): number =>
  workout.exercises.reduce((sum, logged) => sum + exerciseVolume(logged), 0);

export const workoutSetCount = (workout: Workout): number =>
  workout.exercises.reduce(
    (sum, logged) => sum + logged.sets.filter(countsAsWork).length,
    0,
  );

/**
 * Uebungen, die zuletzt tatsaechlich trainiert wurden - juengste zuerst.
 *
 * Die meisten Leute benutzen zwanzig bis dreissig Uebungen und suchen sie
 * trotzdem jedes Mal im ganzen Katalog. Gezaehlt werden nur gearbeitete
 * Saetze: Was einmal aus Versehen hinzugefuegt und nie ausgefuehrt wurde,
 * gehoert nicht nach oben.
 */
export function recentExerciseIds(state: AppState, limit = 12): ID[] {
  const seen: ID[] = [];
  const known = new Set<ID>();
  const byDate = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));

  for (const workout of byDate) {
    for (const logged of workout.exercises) {
      if (known.has(logged.exerciseId)) continue;
      if (!logged.sets.some(countsAsWork)) continue;
      known.add(logged.exerciseId);
      seen.push(logged.exerciseId);
      if (seen.length >= limit) return seen;
    }
  }
  return seen;
}

/** Geschaetztes Ein-Wiederholungs-Maximum nach Epley. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface ExerciseSession {
  date: string;
  workoutId: ID;
  sets: SetLog[];
  volume: number;
  /** Schwerster gearbeiteter Satz. */
  topSet: SetLog | null;
  maxWeight: number;
  best1RM: number;
  totalReps: number;
  maxReps: number;
  bestDurationSec: number;
  bestDistanceKm: number;
}

/** Alle Trainingseinheiten einer Uebung, aufsteigend nach Datum. */
export function exerciseHistory(state: AppState, exerciseId: ID): ExerciseSession[] {
  return historyOf(state, (id) => id === exerciseId);
}

/**
 * Wie exerciseHistory, aber ueber mehrere Uebungen hinweg - fuer die
 * Spielarten einer Bewegung. Wer flach, schraeg und mit Kurzhanteln
 * bankdrueckt, hat drei Verlaeufe mit je wenigen Punkten und keinen, der
 * etwas zeigt.
 */
export function familyHistory(state: AppState, exerciseIds: Set<ID>): ExerciseSession[] {
  return historyOf(state, (id) => exerciseIds.has(id));
}

function historyOf(state: AppState, matches: (id: ID) => boolean): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];

  for (const workout of state.workouts) {
    for (const logged of workout.exercises) {
      if (!matches(logged.exerciseId)) continue;
      const sets = logged.sets.filter((set) => set.done && !set.forPartner);
      if (sets.length === 0) continue;

      const working = sets.filter((set) => !set.isWarmup);
      const pool = working.length > 0 ? working : sets;

      let topSet: SetLog | null = null;
      let best1RM = 0;
      for (const set of pool) {
        const oneRm = estimate1RM(set.weightKg ?? 0, set.reps ?? 0);
        if (oneRm > best1RM) { best1RM = oneRm; topSet = set; }
      }
      if (!topSet) topSet = pool[0] ?? null;

      sessions.push({
        date: workout.date,
        workoutId: workout.id,
        sets: pool,
        volume: exerciseVolume(logged),
        topSet,
        maxWeight: Math.max(0, ...pool.map((set) => set.weightKg ?? 0)),
        best1RM,
        totalReps: pool.reduce((sum, set) => sum + (set.reps ?? 0), 0),
        maxReps: Math.max(0, ...pool.map((set) => set.reps ?? 0)),
        bestDurationSec: Math.max(0, ...pool.map((set) => set.durationSec ?? 0)),
        bestDistanceKm: Math.max(0, ...pool.map((set) => set.distanceKm ?? 0)),
      });
    }
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

export interface LastPerformance {
  date: string;
  sets: SetLog[];
  volume: number;
  maxWeight: number;
  best1RM: number;
  /** Aenderung des Volumens gegenueber der Einheit davor, in Prozent. */
  volumeChangePct: number | null;
}

/** Die letzte absolvierte Einheit einer Uebung - optional vor einem Stichtag. */
export function lastPerformance(
  state: AppState,
  exerciseId: ID,
  beforeDate?: string,
): LastPerformance | null {
  const history = exerciseHistory(state, exerciseId).filter(
    (session) => !beforeDate || session.date < beforeDate,
  );
  const last = history[history.length - 1];
  if (!last) return null;
  const previous = history[history.length - 2];
  const volumeChangePct =
    previous && previous.volume > 0
      ? ((last.volume - previous.volume) / previous.volume) * 100
      : null;

  return {
    date: last.date,
    sets: last.sets,
    volume: last.volume,
    maxWeight: last.maxWeight,
    best1RM: last.best1RM,
    volumeChangePct,
  };
}

export interface PersonalRecords {
  maxWeight: { value: number; date: string; reps: number } | null;
  best1RM: { value: number; date: string } | null;
  maxVolume: { value: number; date: string } | null;
  maxReps: { value: number; date: string } | null;
  maxDurationSec: { value: number; date: string } | null;
  totalSessions: number;
  totalSets: number;
  totalVolume: number;
}

export function personalRecords(state: AppState, exerciseId: ID): PersonalRecords {
  const history = exerciseHistory(state, exerciseId);
  const records: PersonalRecords = {
    maxWeight: null, best1RM: null, maxVolume: null, maxReps: null, maxDurationSec: null,
    totalSessions: history.length, totalSets: 0, totalVolume: 0,
  };

  for (const session of history) {
    records.totalSets += session.sets.length;
    records.totalVolume += session.volume;

    for (const set of session.sets) {
      const weight = set.weightKg ?? 0;
      if (weight > 0 && (!records.maxWeight || weight > records.maxWeight.value)) {
        records.maxWeight = { value: weight, date: session.date, reps: set.reps ?? 0 };
      }
      const reps = set.reps ?? 0;
      if (reps > 0 && (!records.maxReps || reps > records.maxReps.value)) {
        records.maxReps = { value: reps, date: session.date };
      }
      const duration = set.durationSec ?? 0;
      if (duration > 0 && (!records.maxDurationSec || duration > records.maxDurationSec.value)) {
        records.maxDurationSec = { value: duration, date: session.date };
      }
    }
    if (session.best1RM > 0 && (!records.best1RM || session.best1RM > records.best1RM.value)) {
      records.best1RM = { value: session.best1RM, date: session.date };
    }
    if (session.volume > 0 && (!records.maxVolume || session.volume > records.maxVolume.value)) {
      records.maxVolume = { value: session.volume, date: session.date };
    }
  }

  return records;
}

export interface WeeklySummary {
  key: string;
  workouts: number;
  volume: number;
  sets: number;
}

export function weeklySummaries(state: AppState, weeks = 12): WeeklySummary[] {
  const map = new Map<string, WeeklySummary>();
  for (const workout of state.workouts) {
    const sets = workoutSetCount(workout);
    if (sets === 0) continue;
    const key = weekKey(workout.date);
    const entry = map.get(key) ?? { key, workouts: 0, volume: 0, sets: 0 };
    entry.workouts += 1;
    entry.volume += workoutVolume(workout);
    entry.sets += sets;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-weeks);
}

/** Trainingsvolumen je Muskelgruppe (Kategorie) im gegebenen Zeitraum. */
export function volumeByCategory(
  state: AppState,
  getCategory: (id: ID) => string,
  sinceDate: string,
): Array<{ category: string; sets: number; volume: number }> {
  const map = new Map<string, { category: string; sets: number; volume: number }>();
  for (const workout of state.workouts) {
    if (workout.date < sinceDate) continue;
    for (const logged of workout.exercises) {
      const category = getCategory(logged.exerciseId);
      const entry = map.get(category) ?? { category, sets: 0, volume: 0 };
      entry.sets += logged.sets.filter(countsAsWork).length;
      entry.volume += exerciseVolume(logged);
      map.set(category, entry);
    }
  }
  return [...map.values()].filter((entry) => entry.sets > 0).sort((a, b) => b.sets - a.sets);
}

/**
 * Trainings-Serie in Wochen: wie viele Kalenderwochen in Folge mindestens
 * einmal trainiert wurde. Das passt besser zu einem Wochenplan als Tage,
 * bei denen Ruhetage die Serie sofort reissen wuerden.
 */
export function streakInfo(state: AppState): { current: number; longest: number; total: number } {
  const trainedDates = [...new Set(
    state.workouts.filter((workout) => workoutSetCount(workout) > 0).map((workout) => workout.date),
  )].sort();

  const weeks = [...new Set(trainedDates.map(weekKey))].sort();

  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const week of weeks) {
    run = previous && isNextWeek(previous, week) ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = week;
  }

  // Die Serie laeuft weiter, solange diese oder die vergangene Woche dabei ist.
  const thisWeek = weekKey(new Date().toISOString().slice(0, 10));
  const lastWeek = weekKey(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const current = previous === thisWeek || previous === lastWeek ? run : 0;

  return { current, longest, total: trainedDates.length };
}

/** Prueft, ob "next" die unmittelbar folgende Kalenderwoche von "week" ist. */
function isNextWeek(week: string, next: string): boolean {
  const [yearA, weekA] = week.split('-KW').map(Number);
  const [yearB, weekB] = next.split('-KW').map(Number);
  if (yearA === yearB) return weekB === weekA + 1;
  // Jahreswechsel: KW 52/53 gefolgt von KW 1.
  return yearB === yearA + 1 && weekB === 1 && weekA >= 52;
}

/* -------------------------------------------------------------- Rueckblick */

export interface PeriodSummary {
  label: string;
  workouts: number;
  sets: number;
  volume: number;
  minutes: number;
}

export interface Review {
  current: PeriodSummary;
  previous: PeriodSummary;
  /** Uebungen, bei denen im Zeitraum ein neuer Bestwert stand. */
  records: Array<{ name: string; value: string; date: string }>;
  /** Meistgenutzte Muskelgruppen im Zeitraum. */
  focus: Array<{ category: string; sets: number }>;
}

const summarize = (workouts: Workout[], label: string): PeriodSummary => ({
  label,
  workouts: workouts.length,
  sets: workouts.reduce((sum, workout) => sum + workoutSetCount(workout), 0),
  volume: workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0),
  minutes: workouts.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0),
});

/**
 * Stellt einen Zeitraum dem gleich langen davor gegenueber und sammelt die
 * Bestleistungen, die in dieser Zeit aufgestellt wurden.
 */
export function buildReview(
  state: AppState,
  fromDate: string,
  toDate: string,
  previousFrom: string,
  getName: (id: ID) => string | undefined,
  getCategory: (id: ID) => string,
): Review {
  const done = state.workouts.filter((workout) => workoutSetCount(workout) > 0);
  const current = done.filter((workout) => workout.date >= fromDate && workout.date <= toDate);
  const previous = done.filter((workout) => workout.date >= previousFrom && workout.date < fromDate);

  // Bestwerte: je Uebung pruefen, ob der Hoehepunkt im Zeitraum liegt.
  const records: Review['records'] = [];
  const exerciseIds = new Set<ID>();
  for (const workout of current) {
    for (const logged of workout.exercises) exerciseIds.add(logged.exerciseId);
  }
  for (const id of exerciseIds) {
    const best = personalRecords(state, id);
    const peak = best.maxWeight ?? null;
    if (peak && peak.date >= fromDate && peak.date <= toDate) {
      records.push({
        name: getName(id) ?? 'Übung',
        value: `${peak.value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg × ${peak.reps}`,
        date: peak.date,
      });
    }
  }
  records.sort((a, b) => b.date.localeCompare(a.date));

  const focusMap = new Map<string, number>();
  for (const workout of current) {
    for (const logged of workout.exercises) {
      const category = getCategory(logged.exerciseId);
      const sets = logged.sets.filter(countsAsWork).length;
      if (sets > 0) focusMap.set(category, (focusMap.get(category) ?? 0) + sets);
    }
  }

  return {
    current: summarize(current, 'Zeitraum'),
    previous: summarize(previous, 'davor'),
    records: records.slice(0, 6),
    focus: [...focusMap.entries()]
      .map(([category, sets]) => ({ category, sets }))
      .sort((a, b) => b.sets - a.sets),
  };
}

/* ------------------------------------------ Muskelgruppen im Zeitverlauf */

export interface CategoryTrendPoint {
  week: string;
  /** Saetze je Muskelgruppe in dieser Woche. */
  byCategory: Record<string, number>;
}

/** Wie sich die Saetze je Muskelgruppe ueber die Wochen verteilen. */
export function categoryTrend(
  state: AppState,
  getCategory: (id: ID) => string,
  weeks = 12,
): CategoryTrendPoint[] {
  const map = new Map<string, Record<string, number>>();

  for (const workout of state.workouts) {
    if (workoutSetCount(workout) === 0) continue;
    const key = weekKey(workout.date);
    const bucket = map.get(key) ?? {};
    for (const logged of workout.exercises) {
      const category = getCategory(logged.exerciseId);
      const sets = logged.sets.filter(countsAsWork).length;
      if (sets > 0) bucket[category] = (bucket[category] ?? 0) + sets;
    }
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weeks)
    .map(([week, byCategory]) => ({ week, byCategory }));
}
