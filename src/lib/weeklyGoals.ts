import type { AppState, Exercise, Plan, WeeklyGoals } from '../types';
import { addDays } from './date';
import { calcWorkoutBurn } from './calories';
import { lastPerformance, workoutSetCount, workoutVolume } from './stats';
import { regionLoad, targetFor } from './muscleLoad';
import { ALL_REGIONS, type MuscleRegion } from './muscles';
import { plannedWeeklyLoad } from './planVolume';
import { fieldsOf, resolveTracking } from './tracking';

/*
 * Wochenziele: was man sich vornimmt, und wie weit die laufende Woche ist.
 *
 * Vier Masse neben den Saetzen je Muskelgruppe (siehe WeeklyGoals in
 * types.ts). Alles wird aus dem Verlauf gerechnet und nichts gespeichert -
 * ausser dem Ziel selbst.
 */

export interface WeekProgress {
  trainingDays: number;
  volumeKg: number;
  minutes: number;
  /** Arbeitssaetze je Muskelregion; sekundaere Muskeln zaehlen halb. */
  regions: Map<MuscleRegion, number>;
}

/** Der Stand einer Woche, die an `weekStart` (Montag) beginnt. */
export function weekProgress(
  state: AppState,
  getExercise: (id: string) => Exercise | undefined,
  weekStart: string,
): WeekProgress {
  const end = addDays(weekStart, 6);
  const workouts = state.workouts.filter(
    (workout) => workout.date >= weekStart && workout.date <= end && workoutSetCount(workout) > 0,
  );

  const load = regionLoad(workouts, getExercise);
  const regions = new Map<MuscleRegion, number>();
  for (const region of ALL_REGIONS) regions.set(region, Math.round((load.get(region)?.sets ?? 0) * 10) / 10);

  return {
    trainingDays: new Set(workouts.map((workout) => workout.date)).size,
    volumeKg: workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0),
    minutes: Math.round(workouts.reduce((sum, workout) => sum + calcWorkoutBurn(
      workout, getExercise, state.profile.weightKg, state.settings.restTimerSec,
    ).minutes, 0)),
    regions,
  };
}

export interface GoalsFromPlan {
  goals: WeeklyGoals;
  setTargets: Record<string, number>;
}

/** Sekunden je Wiederholung - dieselbe Annahme wie in der Kalorienschaetzung. */
const SECONDS_PER_REP = 3.5;

/**
 * Was der Plan fuer eine Woche vorsieht - als Vorschlag fuer die Ziele.
 *
 * Tage und Saetze stehen im Plan und sind genau. Minuten und Volumen muessen
 * geschaetzt werden: Minuten aus Saetzen, Wiederholungen oder Zeit und der
 * Pause; Volumen aus dem Zielgewicht, sonst aus dem, was man zuletzt bewegt
 * hat. Fehlt beides, bleibt das Volumenziel leer - lieber kein Vorschlag als
 * eine erfundene Zahl.
 */
export function goalsFromPlan(
  plan: Plan,
  state: AppState,
  getExercise: (id: string) => Exercise | undefined,
  today: string,
): GoalsFromPlan {
  let seconds = 0;
  let volume = 0;
  let trainingDays = 0;

  for (const day of plan.days) {
    if (day.isRestDay || day.exercises.length === 0) continue;
    trainingDays += 1;
    for (const planExercise of day.exercises) {
      const exercise = getExercise(planExercise.exerciseId);
      const fields = fieldsOf(resolveTracking(exercise, planExercise));
      const sets = planExercise.targetSets || 0;
      const reps = planExercise.targetRepsMin && planExercise.targetRepsMax
        ? (planExercise.targetRepsMin + planExercise.targetRepsMax) / 2
        : (planExercise.targetRepsMin ?? planExercise.targetRepsMax ?? 10);
      const work = fields.time
        ? (planExercise.targetDurationSec ?? 30)
        : fields.reps ? reps * SECONDS_PER_REP : 30;
      const rest = planExercise.restSec ?? state.settings.restTimerSec;
      seconds += sets * (work + rest);

      if (fields.weight && fields.reps) {
        const weight = planExercise.targetWeightKg
          ?? lastPerformance(state, planExercise.exerciseId, today)?.sets
            .filter((set) => !set.isWarmup)
            .reduce((best, set) => Math.max(best, set.weightKg ?? 0), 0)
          ?? 0;
        volume += sets * reps * weight;
      }
    }
  }

  const setTargets: Record<string, number> = {};
  const planned = new Map(plannedWeeklyLoad(plan, getExercise, undefined).map((entry) => [entry.region, entry.sets]));
  for (const region of ALL_REGIONS) setTargets[region] = Math.round(planned.get(region) ?? 0);

  return {
    goals: {
      trainingDays: trainingDays || null,
      minutes: seconds > 0 ? Math.max(5, Math.round(seconds / 60 / 5) * 5) : null,
      volumeKg: volume > 0 ? Math.round(volume / 100) * 100 : null,
    },
    setTargets,
  };
}

export interface GoalMeter {
  key: 'days' | 'minutes' | 'volume' | 'muscles';
  label: string;
  value: number;
  target: number;
  /** 0 bis 1, gekappt. */
  ratio: number;
}

/**
 * Die Ziele der Woche als Messleisten - nur die, die auch gesetzt sind.
 *
 * Die Muskelgruppen zaehlen als eine Leiste: wie viele der Gruppen mit einem
 * Ziel es schon erreicht haben. Acht einzelne Balken gehoeren auf die
 * Koerperkarte, nicht in eine Zeile auf der Trainingsseite.
 */
export function goalMeters(
  progress: WeekProgress,
  goals: WeeklyGoals,
  setTargets: Record<string, number> | undefined,
): GoalMeter[] {
  const meters: GoalMeter[] = [];
  const push = (key: GoalMeter['key'], label: string, value: number, target: number | null) => {
    if (!target || target <= 0) return;
    meters.push({ key, label, value, target, ratio: Math.min(1, value / target) });
  };
  push('days', 'Tage', progress.trainingDays, goals.trainingDays);
  push('minutes', 'Minuten', progress.minutes, goals.minutes);
  push('volume', 'Volumen', progress.volumeKg, goals.volumeKg);

  const withTarget = ALL_REGIONS.filter((region) => targetFor(setTargets, region) > 0);
  if (withTarget.length > 0) {
    const reached = withTarget.filter((region) => (progress.regions.get(region) ?? 0) >= targetFor(setTargets, region));
    push('muscles', 'Muskelgruppen', reached.length, withTarget.length);
  }
  return meters;
}

/** Stand und Ziel als Text - Volumen ab 10 000 kg verkuerzt ("13,9k"). */
export const meterParts = (meter: GoalMeter): [string, string] => {
  const plain = (value: number) => value.toLocaleString('de-DE', { maximumFractionDigits: 0 });
  if (meter.key === 'volume') {
    const short = (value: number) => (value >= 10000
      ? `${(value / 1000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`
      : plain(value));
    return [short(meter.value), short(meter.target)];
  }
  return [plain(meter.value), plain(meter.target)];
};

/** Hat jemand ueberhaupt eigene Ziele gesetzt - ausser den Standard-Saetzen? */
export const hasOwnGoals = (goals: WeeklyGoals, setTargets: Record<string, number>): boolean =>
  goals.trainingDays != null || goals.minutes != null || goals.volumeKg != null
  || Object.keys(setTargets).length > 0;
