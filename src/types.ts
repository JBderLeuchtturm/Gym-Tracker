/** Zentrale Datentypen des Gym-Trackers. */

export type ID = string;

/* ------------------------------------------------------------------ Profil */

export type Sex = 'male' | 'female' | 'diverse';

/** Aktivitaet im Alltag OHNE Training - Training wird separat berechnet. */
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export type Goal = 'lose' | 'maintain' | 'gain';

export interface Profile {
  name: string;
  sex: Sex;
  birthDate: string | null; // ISO yyyy-mm-dd
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Optionaler manueller Koerperfettanteil in % (fuer Katch-McArdle). */
  bodyFatPct: number | null;
}

export interface WeightEntry {
  date: string; // yyyy-mm-dd
  kg: number;
}

/* --------------------------------------------------------------- Uebungen */

export type ExerciseCategory =
  | 'chest' | 'back' | 'legs' | 'shoulders' | 'arms'
  | 'core' | 'glutes' | 'cardio' | 'fullbody' | 'mobility' | 'other';

export type ExerciseKind = 'strength' | 'bodyweight' | 'cardio' | 'time' | 'mobility';

export interface Exercise {
  id: ID;
  name: string;
  nameEn?: string;
  category: ExerciseCategory;
  kind: ExerciseKind;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  /** MET-Wert fuer die Kalorienschaetzung. */
  met: number;
  description?: string;
  imageUrl?: string;
  aliases?: string[];
  source: 'catalog' | 'wger' | 'custom';
  externalId?: string;
  createdAt?: string;
}

/* ----------------------------------------------------------------- Plaene */

/** 0 = Montag ... 6 = Sonntag */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface PlanExercise {
  id: ID;
  exerciseId: ID;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restSec: number | null;
  note?: string;
}

export interface PlanDay {
  weekday: Weekday;
  title: string;
  isRestDay: boolean;
  exercises: PlanExercise[];
}

export interface Plan {
  id: ID;
  name: string;
  description?: string;
  days: PlanDay[]; // immer 7 Eintraege, Index === weekday
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------- Trainings */

export interface SetLog {
  id: ID;
  reps: number | null;
  weightKg: number | null;
  durationSec: number | null;
  distanceKm: number | null;
  rpe: number | null;
  done: boolean;
  isWarmup: boolean;
}

export interface LoggedExercise {
  id: ID;
  exerciseId: ID;
  planExerciseId?: ID;
  sets: SetLog[];
  note?: string;
}

export interface Workout {
  id: ID;
  date: string; // yyyy-mm-dd
  planId?: ID;
  planDayIndex?: number;
  title: string;
  exercises: LoggedExercise[];
  /** Tatsaechliche Dauer in Minuten (optional, sonst geschaetzt). */
  durationMin: number | null;
  bodyWeightKg: number | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------- Ernaehrung */

export interface NutritionEntry {
  date: string; // yyyy-mm-dd
  kcalIn: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: 'manual' | 'yazio';
}

export interface YazioSettings {
  /** Basis-URL einer eigenen Bridge/eines Proxys (Yazio hat keine offene API). */
  bridgeUrl: string;
  token: string;
  enabled: boolean;
  lastSyncAt: string | null;
}

/* ----------------------------------------------------------------- State */

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  restTimerSec: number;
  weekStartsMonday: boolean;
  useWgerApi: boolean;
  yazio: YazioSettings;
}

export interface AppState {
  version: number;
  /** Zeitpunkt der letzten Aenderung - entscheidet beim Zusammenfuehren zweier Geraete. */
  updatedAt: string;
  profile: Profile;
  exercises: Exercise[];
  plans: Plan[];
  activePlanId: ID | null;
  workouts: Workout[];
  weightLog: WeightEntry[];
  nutrition: NutritionEntry[];
  settings: Settings;
}
