import { t } from '../i18n';
import type { AppState, Exercise, ID, PlanExercise, SetLog } from '../types';
import { estimate1RM, exerciseHistory, personalRecords } from './stats';

/**
 * Kleine Trainingshelfer: Aufwaermsaetze, Gewichtsvorschlag und das Erkennen
 * neuer Bestleistungen. Alles bewusst konservativ - lieber ein Vorschlag zu
 * wenig als einer, der zu einem missglueckten Satz fuehrt.
 */

/** Auf die naechste sinnvolle Hantelstufe runden. */
export const roundToPlate = (kg: number, step = 2.5): number =>
  Math.max(step, Math.round(kg / step) * step);

/** Grosse Beinuebungen springen in groesseren Schritten als Armuebungen. */
function increment(exercise: Exercise | undefined): number {
  if (!exercise) return 2.5;
  if (exercise.category === 'legs' || exercise.category === 'glutes') return 5;
  if (exercise.category === 'arms' || exercise.category === 'shoulders') return 2.5;
  return 2.5;
}

export interface WeightSuggestion {
  weightKg: number;
  /** Kurze Begruendung fuer die Anzeige. */
  reason: string;
  direction: 'up' | 'hold' | 'down';
}

/**
 * Schlaegt das Gewicht fuer die naechste Einheit vor.
 *
 * Wurden beim letzten Mal alle Arbeitssaetze am oberen Ende des
 * Wiederholungsbereichs geschafft, geht es hoch. Wurde das untere Ende
 * mehrfach verfehlt, geht es zurueck. Sonst bleibt es, wie es war.
 */
export function suggestWeight(
  state: AppState,
  exerciseId: ID,
  exercise: Exercise | undefined,
  target: PlanExercise | undefined,
  beforeDate?: string,
): WeightSuggestion | null {
  const history = exerciseHistory(state, exerciseId)
    .filter((session) => !beforeDate || session.date < beforeDate);
  const last = history[history.length - 1];
  if (!last) return null;

  const working = last.sets.filter((set) => !set.isWarmup && (set.weightKg ?? 0) > 0);
  if (working.length === 0) return null;

  const weight = Math.max(...working.map((set) => set.weightKg ?? 0));
  const atWeight = working.filter((set) => (set.weightKg ?? 0) === weight);
  // Eigene Schrittweite aus dem Plan schlaegt die Faustregel.
  // 0 heisst ausdruecklich: nicht automatisch erhoehen.
  const own = target?.progressionKg;
  const step = typeof own === 'number' ? own : increment(exercise);

  const upper = target?.targetRepsMax ?? null;
  const lower = target?.targetRepsMin ?? null;

  if (upper != null && step > 0) {
    const allHitTop = atWeight.every((set) => (set.reps ?? 0) >= upper);
    if (allHitTop && atWeight.length >= Math.max(1, (target?.targetSets ?? atWeight.length) - 1)) {
      return {
        weightKg: roundToPlate(weight + step, step),
        reason: t('letztes Mal {reps}+ Wdh in allen Sätzen', { reps: upper }),
        direction: 'up',
      };
    }
  }

  if (lower != null && step > 0) {
    const missed = atWeight.filter((set) => (set.reps ?? 0) < lower).length;
    if (missed >= 2) {
      return {
        weightKg: roundToPlate(weight - step, step),
        reason: t('letztes Mal {count}× unter {reps} Wdh', { count: missed, reps: lower }),
        direction: 'down',
      };
    }
  }

  return { weightKg: weight, reason: t('wie beim letzten Mal'), direction: 'hold' };
}

/**
 * Baut Aufwaermsaetze zu einem Arbeitsgewicht.
 * Faustregel: leichte Steigerung mit sinkender Wiederholungszahl.
 */
export function warmupSets(workingWeightKg: number, exercise: Exercise | undefined): Array<{
  weightKg: number;
  reps: number;
}> {
  if (workingWeightKg <= 0) return [];
  const bar = exercise?.equipment.some((item) => /langhantel|sz-stange|smith/i.test(item)) ? 20 : 0;

  // Unter 40 kg lohnt sich nur ein lockerer Satz.
  if (workingWeightKg < 40) {
    return [{ weightKg: roundToPlate(workingWeightKg * 0.5), reps: 10 }];
  }

  const steps: Array<[number, number]> = [[0.4, 8], [0.6, 5], [0.8, 3]];
  return steps
    .map(([factor, reps]) => ({ weightKg: roundToPlate(workingWeightKg * factor), reps }))
    // Saetze unterhalb des leeren Hantelgewichts bringen nichts.
    .filter((set) => set.weightKg > bar || bar === 0);
}

export interface NewRecord {
  kind: 'weight' | 'oneRm' | 'reps' | 'duration';
  label: string;
  value: string;
}

/**
 * Prueft, ob ein gerade abgehakter Satz eine Bestleistung ist.
 * Verglichen wird gegen alles, was VOR dem heutigen Tag liegt.
 */
export function detectRecord(
  state: AppState,
  exerciseId: ID,
  set: SetLog,
  date: string,
): NewRecord | null {
  if (set.isWarmup) return null;

  // Nur Einheiten vor dem heutigen Tag zaehlen als bisheriger Bestwert.
  const past: AppState = { ...state, workouts: state.workouts.filter((w) => w.date < date) };
  const before = personalRecords(past, exerciseId);
  if (before.totalSessions === 0) return null;

  const weight = set.weightKg ?? 0;
  const reps = set.reps ?? 0;
  const duration = set.durationSec ?? 0;

  if (weight > 0 && weight > (before.maxWeight?.value ?? 0)) {
    return { kind: 'weight', label: t('Neues Bestgewicht'), value: `${fmtKg(weight)} × ${reps}` };
  }

  const oneRm = estimate1RM(weight, reps);
  if (oneRm > 0 && oneRm > (before.best1RM?.value ?? 0) + 0.05) {
    return { kind: 'oneRm', label: t('Stärkster Satz bisher'), value: `1RM ≈ ${fmtKg(oneRm)}` };
  }

  if (duration > 0 && duration > (before.maxDurationSec?.value ?? 0)) {
    return { kind: 'duration', label: t('Längste Zeit bisher'), value: `${Math.round(duration)} s` };
  }

  if (weight === 0 && reps > 0 && reps > (before.maxReps?.value ?? 0)) {
    return { kind: 'reps', label: t('Meiste Wiederholungen'), value: `${reps} Wdh` };
  }

  return null;
}

const fmtKg = (value: number): string =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: value % 1 === 0 ? 0 : 1 })} kg`;
