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

/** Umfaenge in Zentimetern. Alles freiwillig - leere Felder bleiben null. */
export interface MeasurementEntry {
  date: string; // yyyy-mm-dd
  neckCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
  calfCm: number | null;
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
  /** Uebungen mit derselben Gruppe bilden einen Supersatz. */
  groupId?: string;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  restSec: number | null;
  note?: string;
  /**
   * Doppelte Progression: Erreichen alle Arbeitssaetze das obere Ende des
   * Wiederholungsbereichs, wird beim naechsten Mal um diesen Betrag erhoeht.
   * null oder fehlend = keine automatische Steigerung.
   */
  progressionKg?: number | null;
}

export interface PlanDay {
  weekday: Weekday;
  title: string;
  isRestDay: boolean;
  exercises: PlanExercise[];
}

/**
 * Mehrwoechiger Zyklus: Die Zielgewichte steigen Woche fuer Woche und fallen
 * in der Entlastungswoche zurueck. Ohne Zyklus bleibt jede Woche gleich.
 */
export interface PlanCycle {
  /** Laenge in Wochen. */
  weeks: number;
  /** Entlastungswoche, 1-basiert. null = keine. */
  deloadWeek: number | null;
  /** Steigerung je Woche in Prozent des Zielgewichts. */
  stepPct: number;
  /** Anteil des Zielgewichts in der Entlastungswoche, in Prozent. */
  deloadPct: number;
  /** Montag der ersten Zykluswoche, yyyy-mm-dd. */
  startDate: string;
}

export interface Plan {
  id: ID;
  name: string;
  description?: string;
  days: PlanDay[]; // immer 7 Eintraege, Index === weekday
  cycle?: PlanCycle | null;
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
  note?: string;
  /** Satz des Trainingspartners - zaehlt nicht in die eigene Auswertung. */
  forPartner?: boolean;
}

export interface LoggedExercise {
  id: ID;
  exerciseId: ID;
  planExerciseId?: ID;
  /** Uebungen mit derselben Gruppe bilden einen Supersatz. */
  groupId?: string;
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
  /** Laufende Zeitmessung: gesetzt, solange das Training laeuft. */
  startedAt?: string | null;
  endedAt?: string | null;
  /** Eigene Reihenfolge der Uebungen an diesem Tag (Uebungs-IDs). */
  exerciseOrder?: ID[];
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
  /** Wochenziel an Arbeitssaetzen je Muskelregion. Fehlt ein Wert, gilt der Standard. */
  weeklySetTargets: Record<string, number>;
  /** Verfuegbare Geraete. Leere Liste = keine Einschraenkung. */
  availableEquipment: string[];
  /** Name des Trainingspartners. Leer = Partner-Modus aus. */
  partnerName: string;
  /** Signalton, wenn der Countdown einer Halteuebung ablaeuft. */
  countdownBeep: boolean;
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
  measurements: MeasurementEntry[];
  nutrition: NutritionEntry[];
  settings: Settings;
}
