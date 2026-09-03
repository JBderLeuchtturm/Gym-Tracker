import type { AppState, ID, LoggedExercise, SetLog, Workout } from '../types';
import { weekKey } from './date';

/** Volumen eines Satzes (Gewicht x Wiederholungen). */
export const setVolume = (set: SetLog): number =>
  set.done && !set.isWarmup ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0;

export const exerciseVolume = (logged: LoggedExercise): number =>
  logged.sets.reduce((sum, set) => sum + setVolume(set), 0);

export const workoutVolume = (workout: Workout): number =>
  workout.exercises.reduce((sum, logged) => sum + exerciseVolume(logged), 0);

export const workoutSetCount = (workout: Workout): number =>
  workout.exercises.reduce(
    (sum, logged) => sum + logged.sets.filter((set) => set.done && !set.isWarmup).length,
    0,
  );

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
  const sessions: ExerciseSession[] = [];

  for (const workout of state.workouts) {
    for (const logged of workout.exercises) {
      if (logged.exerciseId !== exerciseId) continue;
      const sets = logged.sets.filter((set) => set.done);
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
      entry.sets += logged.sets.filter((set) => set.done && !set.isWarmup).length;
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
