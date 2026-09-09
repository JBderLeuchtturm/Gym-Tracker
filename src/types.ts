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
  /**
   * Dauerhafte eigene Notiz zur Uebung ("Bank auf Stufe 3, Griff aussen").
   * Bleibt ueber alle Trainings hinweg stehen - anders als die Notiz am
   * einzelnen Satz, die zum jeweiligen Tag gehoert.
   */
  personalNote?: string;
  /**
   * Spielart einer anderen Uebung. Flach, schraeg und Kurzhantel-Bankdruecken
   * gehoeren im Verlauf zusammen betrachtet, sind aber getrennt zu loggen.
   */
  variantOf?: ID;
  /**
   * Findet draussen statt. Wird sonst aus Name und Geraet geraten; dieses Feld
   * ist die ausdrueckliche Entscheidung des Nutzers und schlaegt die Vermutung.
   */
  outdoor?: boolean;
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
   * Ausdruecklich hinterlegte Ersatzuebungen ("Bankdruecken, sonst Kurzhantel").
   * Der Ersatz-Dialog im Training stellt sie nach oben, statt jedes Mal neu zu
   * raten.
   */
  alternativeIds?: ID[];
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

/* ------------------------------------------------------------------ Ziele */

export type GoalMetric = 'oneRm' | 'weight' | 'reps' | 'volume' | 'durationSec';

/**
 * Ein Ziel mit Datum: "100 kg Bankdruecken bis Juni".
 *
 * Die Hochrechnung dazu gibt es schon (forecast.ts) - was gefehlt hat, war das
 * Ziel selbst.
 *
 * Ob es erreicht ist, wird aus dem Verlauf abgeleitet und nicht gespeichert:
 * Ein gemerktes "geschafft" kann zwischen zwei Geraeten auseinanderlaufen, ein
 * abgeleitetes nie.
 */
export interface ExerciseGoal {
  id: ID;
  exerciseId: ID;
  metric: GoalMetric;
  targetValue: number;
  /** yyyy-mm-dd */
  targetDate: string;
  createdAt: string;
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
  /**
   * Bewusst ausgelassen.
   *
   * Ein uebersprungener Satz ist etwas anderes als ein nicht abgehakter: Der
   * eine ist entschieden, der andere steht noch aus. Beide zaehlen nicht in
   * die Auswertung, aber nur der uebersprungene wird auch so angezeigt - und
   * er zaehlt nicht mehr gegen das Tagesziel.
   */
  skipped?: boolean;
}

export interface LoggedExercise {
  id: ID;
  exerciseId: ID;
  planExerciseId?: ID;
  /** Uebungen mit derselben Gruppe bilden einen Supersatz. */
  groupId?: string;
  sets: SetLog[];
  note?: string;
  /**
   * Pausenlaenge fuer genau diese Uebung an diesem Tag, in Sekunden.
   * Schlaegt den Wert aus dem Plan und die globale Einstellung.
   */
  restSec?: number;
  /**
   * Heute ausgelassen - Geraet besetzt, Zeit knapp, Schulter zwickt.
   *
   * Die Uebung bleibt im Tag stehen und sichtbar, damit man spaeter noch
   * weiss, was eigentlich geplant war. Sie zaehlt aber in nichts hinein und
   * gilt nicht mehr als offen.
   */
  skipped?: boolean;
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

/* ------------------------------------------------------------ Profilkarte */

/** Die Farbstimmungen, aus denen die Profilkarte waehlen kann. */
export type ProfileAccent =
  | 'messing' | 'glut' | 'moos' | 'gezeiten' | 'pflaume' | 'schiefer' | 'rost' | 'tinte';

/**
 * Was man am eigenen Profil einstellen kann.
 *
 * Eine Trainingsapp zeigt Zahlen; ein Profil zeigt einen Menschen. Deshalb
 * gibt es hier ein Emoji, eine Farbe, zwei Zeilen Text und vier Dinge, auf die
 * man stolz ist - und nichts davon rechnet irgendwo mit.
 *
 * Die angehefteten Erfolge sind nur IDs: Ob sie erreicht sind, wird wie alles
 * andere aus dem Verlauf abgeleitet. Wer eine Einheit loescht, verliert das
 * Abzeichen wieder, auch wenn es angeheftet war.
 */
export interface ProfileCard {
  emoji: string;
  accent: ProfileAccent;
  /** Zwei Zeilen ueber sich selbst. */
  bio: string;
  /** Bis zu vier angeheftete Erfolge (IDs aus achievements.ts). */
  pinnedAchievements: string[];
  /** Bis zu vier Lieblingsuebungen. */
  favoriteExerciseIds: ID[];
  /** Rang auf der Karte zeigen. */
  showRank: boolean;
  /** Zahlen (Einheiten, Volumen, Serie) auf der Karte zeigen. */
  showStats: boolean;
}

export interface YazioSettings {
  /** Basis-URL einer eigenen Bridge/eines Proxys (Yazio hat keine offene API). */
  bridgeUrl: string;
  token: string;
  enabled: boolean;
  lastSyncAt: string | null;
}

/**
 * Eine gespeicherte Mahlzeit fuer den schnellen Eintrag - wer jeden Morgen
 * dasselbe isst, tippt es sonst jeden Morgen neu.
 */
export interface MealPreset {
  id: ID;
  name: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/* ----------------------------------------------------------------- State */

/** Erinnerung an geplante Trainingstage. */
export interface ReminderSettings {
  enabled: boolean;
  /** Uhrzeit als "HH:MM" in Ortszeit. */
  time: string;
  /** Zuletzt erinnerter Tag, damit dieselbe Erinnerung nicht zweimal kommt. */
  lastShownOn: string | null;
}

/**
 * Wetter zum Trainingstag.
 *
 * Der Ort wird absichtlich grob gespeichert: Fuer die Frage, ob es beim Laufen
 * regnet, reicht der Kilometer. Genauere Koordinaten waeren nur ein Datenpunkt
 * mehr, der bei einem fremden Dienst landet.
 */
export interface WeatherSettings {
  enabled: boolean;
  lat: number | null;
  lon: number | null;
  placeName: string;
}

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
  /** Gewicht der Hantelstange fuer den Scheibenrechner, in Kilogramm. */
  barWeightKg: number;
  /** Scheiben, die im Studio am Staender haengen. Leer = Standardsatz. */
  plateSet: number[];
  /** Bildschirm wach halten, solange ein Training laeuft. */
  keepScreenAwake: boolean;
  /** Pausenuhr gross ueber den Bildschirm legen statt als Leiste am Rand. */
  fullscreenRest: boolean;
  /**
   * Belastung als Wiederholungen in Reserve statt als RPE anzeigen.
   *
   * Gespeichert wird weiterhin nur RPE. Zwei Felder fuer dieselbe Aussage
   * wuerden frueher oder spaeter auseinanderlaufen; RIR ist schlicht die
   * andere Leserichtung (RIR = 10 - RPE).
   */
  useRir: boolean;
  reminder: ReminderSettings;
  weather: WeatherSettings;
  /** Taegliche Sicherung in den eigenen Supabase-Speicher. */
  autoBackup: boolean;
  /**
   * Am Rangvergleich teilnehmen.
   *
   * Aus heisst: Es verlaesst nichts das Geraet. An heisst: Punktestand, Stufe
   * je Bewegung und der selbst gewaehlte Anzeigename sind fuer alle Konten
   * dieses Projekts sichtbar - keine Gewichte, kein Koerpergewicht, kein
   * Trainingseintrag.
   */
  shareRank: boolean;
  /** Wie die eigene Profilkarte aussieht - siehe ProfileCard. */
  profileCard: ProfileCard;
  /**
   * Zuletzt angezeigte Rangstufe.
   *
   * Nur dafuer da, einen Auf- oder Abstieg einmal zu melden. Der Rang selbst
   * wird immer frisch aus dem Verlauf gerechnet und nie gespeichert - was hier
   * steht, ist eine Erinnerung an das, was zuletzt auf dem Bildschirm stand.
   */
  lastSeenRank?: { tier: string; score: number; on: string };
  yazio: YazioSettings;
  /** Gespeicherte Mahlzeiten fuer den schnellen Eintrag. */
  mealPresets: MealPreset[];
}

export interface AppState {
  version: number;
  /** Zeitpunkt der letzten Aenderung - entscheidet beim Zusammenfuehren zweier Geraete. */
  updatedAt: string;
  /**
   * Eigener Zeitstempel fuer Einstellungen und Profil.
   *
   * Ohne ihn gewinnt beim Abgleich pauschal die Seite, die zuletzt irgendetwas
   * getan hat: Wer am Handy die Wochenziele aendert und danach am Rechner
   * einen Satz eintraegt, verliert die Ziele stillschweigend.
   */
  settingsUpdatedAt?: string;
  profile: Profile;
  exercises: Exercise[];
  plans: Plan[];
  activePlanId: ID | null;
  workouts: Workout[];
  weightLog: WeightEntry[];
  measurements: MeasurementEntry[];
  nutrition: NutritionEntry[];
  goals: ExerciseGoal[];
  /** Zeitpunkt der letzten automatischen Sicherung. */
  lastBackupAt?: string | null;
  settings: Settings;
}
