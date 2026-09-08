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
  /** true, wenn eine eingetragene Dauer verworfen wurde, weil sie nicht sein kann. */
  durationImplausible: boolean;
  perExercise: ExerciseBurn[];
}

/** Angenommene Sekunden pro Wiederholung, je nach Uebungsart. */
const SECONDS_PER_REP = 3.5;

/** Reine Arbeitszeit eines Satzes in Minuten - ohne Pause. */
function workMinutes(reps: number | null, durationSec: number | null): number {
  return (durationSec ?? (reps ?? 10) * SECONDS_PER_REP) / 60;
}

/**
 * Geschaetzte Zeit eines Satzes in Minuten.
 * Die Pause zaehlt anteilig mit (halb), weil der Puls dabei erhoeht bleibt.
 */
function setMinutes(reps: number | null, durationSec: number | null, restSec: number): number {
  return workMinutes(reps, durationSec) + (restSec * 0.5) / 60;
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
  const rows: Array<{
    exerciseId: string; name: string; met: number; minutes: number; work: number;
  }> = [];

  for (const logged of workout.exercises) {
    // Ausgelassene Uebungen stehen im Tag, wurden aber nicht gemacht.
    if (logged.skipped) continue;
    const exercise = getExercise(logged.exerciseId);
    const met = exercise?.met ?? 5;
    const name = exercise?.name ?? 'Unbekannte Übung';
    let minutes = 0;
    let work = 0;
    for (const set of logged.sets) {
      // Saetze des Partners sind fremde Arbeit und zaehlen nicht in den eigenen Verbrauch.
      if (!set.done || set.forPartner || set.skipped) continue;
      minutes += setMinutes(set.reps, set.durationSec, defaultRestSec);
      work += workMinutes(set.reps, set.durationSec);
    }
    if (minutes > 0) rows.push({ exerciseId: logged.exerciseId, name, met, minutes, work });
  }

  const estimatedMinutes = rows.reduce((sum, row) => sum + row.minutes, 0);
  const workedMinutes = rows.reduce((sum, row) => sum + row.work, 0);
  const measured = workout.durationMin;

  /*
   * Eine gemessene Dauer skaliert die Schaetzung. Sie muss aber mindestens so
   * lang sein wie die reine Hebezeit - sonst ist sie nachweislich falsch,
   * etwa nach einer versehentlich kurz gestoppten Uhr. Frueher machte das aus
   * zwoelf Saetzen neun Kilokalorien; jetzt zaehlt in dem Fall die Schaetzung.
   */
  const usable = measured != null && measured > 0 && measured >= workedMinutes;
  const totalMinutes = usable ? measured : estimatedMinutes;
  const scale = estimatedMinutes > 0 ? totalMinutes / estimatedMinutes : 1;

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
    estimated: !usable,
    /** Die eingetragene Dauer war kuerzer als die reine Hebezeit. */
    durationImplausible: measured != null && measured > 0 && !usable,
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

export type BudgetTone = 'good' | 'warn' | 'open';

export interface BudgetVerdict {
  /** Kurzer Satz fuer die Anzeige. */
  label: string;
  tone: BudgetTone;
}

/**
 * Ein Satz zur Tagesbilanz, passend zum Ziel.
 *
 * "target" hat den Ziel-Aufschlag schon drin: Wer es genau trifft, macht alles
 * richtig. Beim Abnehmen ist Weniger gut, beim Aufbauen ist Weniger noch offen,
 * beim Halten zaehlt die Naehe.
 */
export function budgetVerdict(goal: Goal, eaten: number, target: number): BudgetVerdict {
  const diff = eaten - target;
  if (goal === 'lose') {
    if (diff <= 0) return { label: 'Im Defizit – passt zum Abnehmen', tone: 'good' };
    return { label: 'Über dem Ziel – das Defizit ist weg', tone: 'warn' };
  }
  if (goal === 'gain') {
    if (diff >= 0) return { label: 'Im Überschuss – passt zum Aufbauen', tone: 'good' };
    if (diff > -300) return { label: 'Fast am Aufbau-Ziel', tone: 'good' };
    return { label: 'Noch Luft bis zum Aufbau-Ziel', tone: 'open' };
  }
  if (Math.abs(diff) <= 200) return { label: 'Nah am Ziel – gut zum Halten', tone: 'good' };
  if (diff > 200) return { label: 'Über dem Verbrauch', tone: 'warn' };
  return { label: 'Noch Luft zum Ziel', tone: 'open' };
}
