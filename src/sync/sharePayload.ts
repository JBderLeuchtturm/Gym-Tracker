import type { AppState, Exercise, ID } from '../types';
import { addDays, todayISO } from '../lib/date';
import { calcDayEnergy } from '../lib/calories';
import {
  exerciseHistory, personalRecords, streakInfo, weeklySummaries, workoutSetCount, workoutVolume,
} from '../lib/stats';

/**
 * Die Daten, die Freunde zu sehen bekommen.
 *
 * Bewusst abgeleitet und knapp gehalten: Es werden Auswertungen geteilt,
 * nicht der rohe Trainingszustand. Notizen, Plaene und Profildaten bleiben
 * grundsaetzlich draussen.
 */

export type ShareScope = 'progress' | 'weight' | 'nutrition';

export const SCOPE_LABELS: Record<ShareScope, string> = {
  progress: 'Fortschritt',
  weight: 'Körpergewicht',
  nutrition: 'Kalorien',
};

export const SCOPE_HINTS: Record<ShareScope, string> = {
  progress: 'Trainings, Sätze, Volumen und Bestleistungen je Übung',
  weight: 'Dein Gewichtsverlauf',
  nutrition: 'Verbrauch und Zufuhr je Tag',
};

export interface SharedExercise {
  id: ID;
  name: string;
  category: string;
  kind: string;
  sessions: number;
  lastDate: string;
  bestWeight: number;
  bestReps: number;
  best1RM: number;
  bestDurationSec: number;
  totalVolume: number;
  /** Verlauf des besten Satzes je Einheit - fuer Diagramm und Vergleich. */
  series: Array<{ date: string; value: number }>;
}

export interface ProgressShare {
  generatedAt: string;
  totals: {
    workouts: number;
    sets: number;
    volume: number;
    streakWeeks: number;
    longestStreak: number;
    lastWorkoutDate: string | null;
  };
  weekly: Array<{ key: string; workouts: number; sets: number; volume: number }>;
  exercises: SharedExercise[];
}

export interface WeightShare {
  generatedAt: string;
  entries: Array<{ date: string; kg: number }>;
}

export interface NutritionShare {
  generatedAt: string;
  days: Array<{ date: string; kcalIn: number | null; burn: number; target: number }>;
}

const MAX_SERIES_POINTS = 40;

export function buildProgressShare(
  state: AppState,
  getExercise: (id: ID) => Exercise | undefined,
): ProgressShare {
  const done = state.workouts.filter((workout) => workoutSetCount(workout) > 0);
  const streak = streakInfo(state);

  const exerciseIds = new Set<ID>();
  for (const workout of done) {
    for (const logged of workout.exercises) {
      if (logged.sets.some((set) => set.done)) exerciseIds.add(logged.exerciseId);
    }
  }

  const exercises: SharedExercise[] = [];
  for (const id of exerciseIds) {
    const exercise = getExercise(id);
    if (!exercise) continue;
    const history = exerciseHistory(state, id);
    if (history.length === 0) continue;
    const records = personalRecords(state, id);
    const timed = exercise.kind === 'time' || exercise.kind === 'cardio';

    exercises.push({
      id,
      name: exercise.name,
      category: exercise.category,
      kind: exercise.kind,
      sessions: history.length,
      lastDate: history[history.length - 1].date,
      bestWeight: round(records.maxWeight?.value ?? 0),
      bestReps: records.maxReps?.value ?? 0,
      best1RM: round(records.best1RM?.value ?? 0),
      bestDurationSec: records.maxDurationSec?.value ?? 0,
      totalVolume: round(records.totalVolume),
      series: history.slice(-MAX_SERIES_POINTS).map((session) => ({
        date: session.date,
        value: round(timed ? session.bestDurationSec : session.best1RM || session.volume),
      })),
    });
  }

  exercises.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'de'));

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      workouts: done.length,
      sets: done.reduce((sum, workout) => sum + workoutSetCount(workout), 0),
      volume: round(done.reduce((sum, workout) => sum + workoutVolume(workout), 0)),
      streakWeeks: streak.current,
      longestStreak: streak.longest,
      lastWorkoutDate: done[done.length - 1]?.date ?? null,
    },
    weekly: weeklySummaries(state, 26).map((week) => ({ ...week, volume: round(week.volume) })),
    exercises,
  };
}

export function buildWeightShare(state: AppState): WeightShare {
  const since = addDays(todayISO(), -400);
  return {
    generatedAt: new Date().toISOString(),
    entries: state.weightLog
      .filter((entry) => entry.date >= since)
      .map((entry) => ({ date: entry.date, kg: entry.kg })),
  };
}

export function buildNutritionShare(
  state: AppState,
  getExercise: (id: ID) => Exercise | undefined,
): NutritionShare {
  const days: NutritionShare['days'] = [];
  for (let offset = 89; offset >= 0; offset -= 1) {
    const date = addDays(todayISO(), -offset);
    const workout = state.workouts.find((item) => item.date === date);
    const entry = state.nutrition.find((item) => item.date === date);
    if (!workout && !entry) continue;
    const energy = calcDayEnergy(state.profile, workout, getExercise, state.settings.restTimerSec);
    days.push({
      date,
      kcalIn: entry?.kcalIn ?? null,
      burn: round(energy.total),
      target: round(energy.target),
    });
  }
  return { generatedAt: new Date().toISOString(), days };
}

const round = (value: number): number => Math.round(value * 10) / 10;
