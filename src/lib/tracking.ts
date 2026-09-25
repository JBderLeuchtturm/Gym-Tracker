import { t } from '../i18n';
import type { Exercise, ExerciseKind, LoggedExercise, PlanExercise, SetLog, TrackingMode } from '../types';
import { formatClock } from './date';
import { formatSet } from './setFormat';

/*
 * Wie die Saetze einer Uebung erfasst werden - siehe TrackingMode in types.ts.
 *
 * Alles, was davon abhaengt (welche Spalten eine Satzzeile hat, was im Plan
 * als Vorgabe steht, wie ein Satz in Worten heisst), fragt hier nach und nicht
 * mehr selbst bei `exercise.kind`. Vorher standen dieselben drei Vergleiche an
 * einem Dutzend Stellen, und jede neue Art haette alle zwoelf gebraucht.
 */

export const TRACKING_MODES: TrackingMode[] = [
  'weight_reps', 'reps', 'time', 'weight_time', 'distance_time', 'sets',
];

export const TRACKING_LABELS: Record<TrackingMode, string> = {
  weight_reps: 'Gewicht × Wdh',
  reps: 'Nur Wdh',
  time: 'Zeit',
  weight_time: 'Gewicht × Zeit',
  distance_time: 'Strecke & Zeit',
  sets: 'Nur Sätze',
};

/** Ein Beispiel je Art - damit man beim Waehlen nicht raten muss. */
export const TRACKING_EXAMPLES: Record<TrackingMode, string> = {
  weight_reps: 'Bankdrücken, Kniebeuge',
  reps: 'Liegestütze, Klimmzüge',
  time: 'Plank, Wandsitzen, Intervalle',
  weight_time: "Farmer's Walk, gewichtete Plank",
  distance_time: 'Laufen, Rudern, Rad',
  sets: 'Einfach abhaken, ohne Zahlen',
};

/**
 * Die Erfassung, die aus der Art der Uebung folgt, wenn niemand etwas anderes
 * festgelegt hat. Genau das, was die App vorher fest verdrahtet hatte - wer
 * nichts umstellt, merkt keinen Unterschied.
 */
export function defaultTracking(kind: ExerciseKind | undefined): TrackingMode {
  if (kind === 'time') return 'time';
  if (kind === 'cardio') return 'distance_time';
  return 'weight_reps';
}

/** Die Erfassung, die gilt: Training vor Plan vor Uebung vor Art. */
export function resolveTracking(
  exercise: Exercise | undefined,
  planExercise?: PlanExercise | null,
  logged?: LoggedExercise | null,
): TrackingMode {
  return logged?.tracking
    ?? planExercise?.tracking
    ?? exercise?.tracking
    ?? defaultTracking(exercise?.kind);
}

export interface TrackingFields {
  weight: boolean;
  reps: boolean;
  time: boolean;
  distance: boolean;
}

/** Welche Werte ein Satz dieser Art hat. */
export function fieldsOf(mode: TrackingMode): TrackingFields {
  return {
    weight: mode === 'weight_reps' || mode === 'weight_time',
    reps: mode === 'weight_reps' || mode === 'reps',
    time: mode === 'time' || mode === 'weight_time' || mode === 'distance_time',
    distance: mode === 'distance_time',
  };
}

/** Wie viele Zahlenspalten eine Satzzeile braucht (0, 1 oder 2). */
export const valueColumns = (mode: TrackingMode): number => {
  const fields = fieldsOf(mode);
  return [fields.weight, fields.reps, fields.time, fields.distance].filter(Boolean).length;
};

const seconds = (value: number): string =>
  (value >= 60 ? formatClock(value) : `${value} s`);

/**
 * Die Vorgabe eines Plan-Eintrags in Worten: "4 × 8–12", "3 × 30 s",
 * "3 Sätze", "5 km · 30:00".
 */
export function targetText(planExercise: PlanExercise, mode: TrackingMode): string {
  const sets = planExercise.targetSets || 1;
  const { targetRepsMin: min, targetRepsMax: max } = planExercise;
  const reps = min && max && min !== max ? `${min}–${max}` : (min || max || null);
  const weight = planExercise.targetWeightKg ? ` @ ${planExercise.targetWeightKg.toLocaleString('de-DE')} kg` : '';
  const duration = planExercise.targetDurationSec ? seconds(planExercise.targetDurationSec) : null;

  switch (mode) {
    case 'sets':
      return sets === 1 ? t('1 Satz') : t('{count} Sätze', { count: sets });
    case 'time':
      return duration ? `${sets} × ${duration}` : t('{count} Sätze', { count: sets });
    case 'weight_time':
      return `${sets} × ${duration ?? '?'}${weight}`;
    case 'distance_time': {
      const parts = [
        planExercise.targetDistanceKm ? `${planExercise.targetDistanceKm.toLocaleString('de-DE')} km` : null,
        duration,
      ].filter(Boolean);
      return parts.length > 0 ? `${sets > 1 ? `${sets} × ` : ''}${parts.join(' · ')}` : t('{count} Sätze', { count: sets });
    }
    case 'reps':
      return `${sets} × ${reps ?? '?'}`;
    default:
      return `${sets} × ${reps ?? '?'}${weight}`;
  }
}

/** Ein Satz in Worten, passend zur Erfassung. */
export function setText(set: SetLog, mode: TrackingMode, kind?: ExerciseKind): string {
  switch (mode) {
    case 'sets':
      return set.done ? t('erledigt') : t('offen');
    case 'reps':
      return set.reps ? t('{count} Wdh', { count: set.reps }) : '–';
    case 'time':
      return set.durationSec ? seconds(set.durationSec) : '–';
    case 'weight_time': {
      const time = set.durationSec ? seconds(set.durationSec) : '–';
      return set.weightKg ? `${set.weightKg.toLocaleString('de-DE')} kg × ${time}` : time;
    }
    case 'distance_time': {
      const parts = [
        set.distanceKm ? `${set.distanceKm.toLocaleString('de-DE')} km` : null,
        set.durationSec ? formatClock(set.durationSec) : null,
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(' · ') : '–';
    }
    default:
      return formatSet(set.weightKg, set.reps, kind);
  }
}

/**
 * Mehrere Saetze kurz zusammengefasst: "3 × 80 kg × 8", "3 × 45 s",
 * "3 Sätze". Gleiche Saetze werden gezaehlt statt wiederholt.
 */
export function summarizeSets(sets: SetLog[], mode: TrackingMode, kind?: ExerciseKind): string {
  const worked = sets.filter((set) => set.done && !set.isWarmup);
  const list = worked.length > 0 ? worked : sets;
  if (list.length === 0) return '–';
  if (mode === 'sets') return list.length === 1 ? t('1 Satz') : t('{count} Sätze', { count: list.length });

  const texts = list.map((set) => setText(set, mode, kind));
  if (texts.every((text) => text === texts[0])) return `${texts.length} × ${texts[0]}`;
  return texts.join(', ');
}

/**
 * Die Werte, mit denen ein neuer Satz startet - aus dem letzten Mal, sonst aus
 * der Vorgabe im Plan. Bei "nur Saetze" bleibt alles leer: Es gibt nichts
 * einzutragen, und eine vorbelegte Zahl wuerde etwas behaupten.
 */
export function draftValues(
  mode: TrackingMode,
  reference: SetLog | undefined,
  planExercise: PlanExercise | undefined,
  plannedWeight: number | null,
): Pick<SetLog, 'reps' | 'weightKg' | 'durationSec' | 'distanceKm'> {
  const fields = fieldsOf(mode);
  return {
    reps: fields.reps ? (reference?.reps ?? planExercise?.targetRepsMin ?? null) : null,
    weightKg: fields.weight ? (reference?.weightKg ?? plannedWeight ?? null) : null,
    durationSec: fields.time ? (reference?.durationSec ?? planExercise?.targetDurationSec ?? null) : null,
    distanceKm: fields.distance ? (reference?.distanceKm ?? planExercise?.targetDistanceKm ?? null) : null,
  };
}

/**
 * Wird diese Uebung ueber die Zeit gemessen? Fuer Auswertungen ueber den
 * ganzen Verlauf (Bestzeit statt Bestgewicht) - dort zaehlt die Erfassung der
 * Uebung selbst, nicht die eines einzelnen Tages.
 */
export const isTimedExercise = (exercise: Exercise | undefined): boolean => {
  const fields = fieldsOf(resolveTracking(exercise));
  return fields.time && !fields.reps;
};
