import type { AppState } from '../types';
import { countsAsWork, workoutVolume } from './stats';
import { addDays, todayISO } from './date';

/**
 * Ermuedung, zurueckhaltend.
 *
 * Aus Volumen und Anstrengung der letzten Woche gegen die Woche davor laesst
 * sich ablesen, ob es gerade viel wird. Das ist kein Trainingsrat - nur ein
 * Hinweis auf einen Trend, den man selbst vielleicht nicht sieht. Es gibt
 * bewusst nur drei Stufen und keine Zahl mit Nachkommastelle.
 */

export type FatigueLevel = 'quiet' | 'steady' | 'rising' | 'high';

export interface FatigueSignal {
  level: FatigueLevel;
  /** Volumen der letzten sieben Tage, in Kilogramm. */
  recentVolume: number;
  /** Volumen der sieben Tage davor. */
  priorVolume: number;
  /** Durchschnittliche RPE der Arbeitssaetze in den letzten sieben Tagen. */
  recentRpe: number | null;
  priorRpe: number | null;
  /** Anzahl Arbeitssaetze in den letzten sieben Tagen. */
  recentSets: number;
  text: string;
}

function windowStats(state: AppState, from: string, to: string) {
  const workouts = state.workouts.filter((w) => w.date >= from && w.date < to);
  let volume = 0;
  let rpeSum = 0;
  let rpeCount = 0;
  let sets = 0;
  for (const workout of workouts) {
    volume += workoutVolume(workout);
    for (const logged of workout.exercises) {
      for (const set of logged.sets) {
        if (!countsAsWork(set)) continue;
        sets += 1;
        if (set.rpe != null) { rpeSum += set.rpe; rpeCount += 1; }
      }
    }
  }
  return { volume, sets, rpe: rpeCount > 0 ? rpeSum / rpeCount : null };
}

export function fatigueSignal(state: AppState, today = todayISO()): FatigueSignal | null {
  const recent = windowStats(state, addDays(today, -7), addDays(today, 1));
  const prior = windowStats(state, addDays(today, -14), addDays(today, -7));

  // Ohne eine Vorwoche zum Vergleichen gibt es keinen Trend.
  if (recent.sets < 3 || prior.sets < 3) return null;

  const volumeUp = prior.volume > 0 ? recent.volume / prior.volume : 1;
  const rpeDelta = recent.rpe != null && prior.rpe != null ? recent.rpe - prior.rpe : 0;

  let level: FatigueLevel = 'steady';
  if (volumeUp >= 1.5 && rpeDelta >= 0.7) level = 'high';
  else if (volumeUp >= 1.25 || rpeDelta >= 0.7) level = 'rising';
  else if (volumeUp <= 0.7 && rpeDelta <= 0) level = 'quiet';

  const text = {
    high: 'Volumen und Anstrengung ziehen beide deutlich an. Eine leichtere Woche könnte sich lohnen.',
    rising: 'Es wird gerade mehr als in der Woche davor – nichts Dramatisches, nur zum Mitdenken.',
    steady: 'Belastung etwa wie in der Woche davor.',
    quiet: 'Ruhigere Woche als die davor – gut für die Erholung.',
  }[level];

  return {
    level,
    recentVolume: recent.volume,
    priorVolume: prior.volume,
    recentRpe: recent.rpe,
    priorRpe: prior.rpe,
    recentSets: recent.sets,
    text,
  };
}
