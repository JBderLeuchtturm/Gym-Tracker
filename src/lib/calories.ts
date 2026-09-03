import type { ActivityLevel, Exercise, Goal, Profile, Workout } from '../types';
import { ageFromBirthDate } from './date';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sitzend (Büro, kaum Bewegung)',
  light: 'Leicht aktiv (etwas Bewegung im Alltag)',
  moderate: 'Mäßig aktiv (viel auf den Beinen)',
  active: 'Sehr aktiv (körperliche Arbeit)',
  very_active: 'Extrem aktiv (schwere körperliche Arbeit)',
};

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Abnehmen',
  maintain: 'Gewicht halten',
  gain: 'Aufbauen',
};

/** Kalorien-Anpassung pro Tag je nach Ziel. */
export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 300,
};

/**
 * Grundumsatz nach Mifflin-St Jeor.
 * Ist ein Koerperfettanteil hinterlegt, wird stattdessen Katch-McArdle genutzt
 * (genauer, weil es auf der fettfreien Masse basiert).
 */
export function calcBMR(profile: Profile): number {
  const { weightKg, heightCm, sex, bodyFatPct } = profile;
  if (bodyFatPct != null && bodyFatPct > 3 && bodyFatPct < 60) {
    const leanMass = weightKg * (1 - bodyFatPct / 100);
    return 370 + 21.6 * leanMass;
  }
  const age = ageFromBirthDate(profile.birthDate) ?? 30;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  return base - 78; // Mittelwert, wenn keine Angabe passt
}

/** Gesamtumsatz im Alltag OHNE Training. */
export function calcTDEE(profile: Profile): number {
  return calcBMR(profile) * ACTIVITY_FACTORS[profile.activityLevel];
}

/**
 * Kalorien einer Aktivitaet nach der MET-Formel:
 * kcal = MET x 3,5 x kg / 200 x Minuten
 */
export function metCalories(met: number, weightKg: number, minutes: number): number {
  return (met * 3.5 * weightKg) / 200 * minutes;
}

export interface ExerciseBurn {
  exerciseId: string;
  name: string;
  minutes: number;
  kcal: number;
}

export interface WorkoutBurn {
  kcal: number;
  minutes: number;
  /** true, wenn die Dauer geschaetzt statt gemessen wurde. */
  estimated: boolean;
  perExercise: ExerciseBurn[];
}

/** Angenommene Sekunden pro Wiederholung, je nach Uebungsart. */
const SECONDS_PER_REP = 3.5;

/**
 * Schaetzt die aktive Zeit eines Satzes in Minuten.
 * Die Pause zaehlt anteilig mit (halb), weil der Puls dabei erhoeht bleibt.
 */
function setMinutes(reps: number | null, durationSec: number | null, restSec: number): number {
  const workSec = durationSec ?? (reps ?? 10) * SECONDS_PER_REP;
  return (workSec + restSec * 0.5) / 60;
}

/**
 * Berechnet den Trainingsverbrauch eines Workouts.
 * Ist eine echte Trainingsdauer eingetragen, wird der geschaetzte Zeitbedarf
 * proportional darauf skaliert - so bleibt die MET-Gewichtung erhalten.
 */
export function calcWorkoutBurn(
  workout: Workout,
  getExercise: (id: string) => Exercise | undefined,
  bodyWeightKg: number,
  defaultRestSec = 90,
): WorkoutBurn {
  const weight = workout.bodyWeightKg ?? bodyWeightKg;
  const rows: Array<{ exerciseId: string; name: string; met: number; minutes: number }> = [];

  for (const logged of workout.exercises) {
    const exercise = getExercise(logged.exerciseId);
    const met = exercise?.met ?? 5;
    const name = exercise?.name ?? 'Unbekannte Übung';
    let minutes = 0;
    for (const set of logged.sets) {
      if (!set.done) continue;
      minutes += setMinutes(set.reps, set.durationSec, defaultRestSec);
    }
    if (minutes > 0) rows.push({ exerciseId: logged.exerciseId, name, met, minutes });
  }

  const estimatedMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const measured = workout.durationMin;
  const scale = measured && estimatedMinutes > 0 ? measured / estimatedMinutes : 1;

  const perExercise: ExerciseBurn[] = rows.map((row) => {
    const minutes = row.minutes * scale;
    return {
      exerciseId: row.exerciseId,
      name: row.name,
      minutes,
      kcal: metCalories(row.met, weight, minutes),
    };
  });

  return {
    kcal: perExercise.reduce((sum, row) => sum + row.kcal, 0),
    minutes: perExercise.reduce((sum, row) => sum + row.minutes, 0),
    estimated: measured == null,
    perExercise,
  };
}

export interface DayEnergy {
  bmr: number;
  tdee: number;
  workoutKcal: number;
  workoutMinutes: number;
  /** true, wenn die Trainingszeit geschaetzt statt gemessen wurde. */
  estimated: boolean;
  /** Gesamtverbrauch = Alltag + Training. */
  total: number;
  /** Empfohlene Zufuhr fuer das gewaehlte Ziel. */
  target: number;
  perExercise: ExerciseBurn[];
}

export function calcDayEnergy(
  profile: Profile,
  workout: Workout | undefined,
  getExercise: (id: string) => Exercise | undefined,
  defaultRestSec = 90,
): DayEnergy {
  const bmr = calcBMR(profile);
  const tdee = calcTDEE(profile);
  const burn = workout
    ? calcWorkoutBurn(workout, getExercise, profile.weightKg, defaultRestSec)
    : { kcal: 0, minutes: 0, estimated: true, perExercise: [] as ExerciseBurn[] };
  const total = tdee + burn.kcal;
  return {
    bmr,
    tdee,
    workoutKcal: burn.kcal,
    workoutMinutes: burn.minutes,
    estimated: burn.estimated,
    total,
    target: total + GOAL_ADJUSTMENT[profile.goal],
    perExercise: burn.perExercise,
  };
}

/** Empfohlene Proteinmenge in Gramm (1,8 g je kg Koerpergewicht). */
export const proteinTarget = (weightKg: number): number => Math.round(weightKg * 1.8);
