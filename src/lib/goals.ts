/**
 * Ziele mit Datum: "100 kg Bankdruecken bis Juni".
 *
 * Die Hochrechnung gab es schon, das Ziel fehlte. Beides zusammen beantwortet
 * die eigentliche Frage - nicht "wo stehe ich", sondern "reicht das Tempo".
 *
 * Ob ein Ziel erreicht ist, wird aus dem Verlauf abgeleitet und nirgends
 * vermerkt. Ein gespeichertes "geschafft" kann zwischen zwei Geraeten
 * auseinanderlaufen; ein abgeleitetes nie.
 */

import type { AppState, ExerciseGoal, GoalMetric, ID } from '../types';
import { exerciseHistory, familyHistory, type ExerciseSession } from './stats';
import { daysBetween, todayISO } from './date';
import { linearTrend, projectTarget, type Projection } from './forecast';

export const GOAL_LABELS: Record<GoalMetric, string> = {
  oneRm: 'Geschätztes 1RM',
  weight: 'Gewicht in einem Satz',
  reps: 'Wiederholungen in einem Satz',
  volume: 'Volumen in einer Einheit',
  durationSec: 'Dauer eines Satzes',
};

export const GOAL_UNITS: Record<GoalMetric, string> = {
  oneRm: 'kg', weight: 'kg', reps: 'Wdh', volume: 'kg', durationSec: 's',
};

const valueOf = (session: ExerciseSession, metric: GoalMetric): number => {
  if (metric === 'oneRm') return session.best1RM;
  if (metric === 'weight') return session.maxWeight;
  if (metric === 'reps') return session.maxReps;
  if (metric === 'volume') return session.volume;
  return session.bestDurationSec;
};

export interface GoalStatus {
  goal: ExerciseGoal;
  /** Bester Wert bisher. */
  current: number;
  /** Tag, an dem das Ziel zum ersten Mal stand. null = noch offen. */
  achievedOn: string | null;
  /** Tage bis zum Zieldatum; negativ, wenn es schon vorbei ist. */
  daysLeft: number;
  /** Wann es bei diesem Tempo so weit waere. */
  projection: Projection | null;
}

export function goalStatus(
  state: AppState,
  goal: ExerciseGoal,
  familyIds?: Set<ID>,
): GoalStatus {
  const history = familyIds && familyIds.size > 1
    ? familyHistory(state, familyIds)
    : exerciseHistory(state, goal.exerciseId);

  let current = 0;
  let achievedOn: string | null = null;
  for (const session of history) {
    const value = valueOf(session, goal.metric);
    if (value > current) current = value;
    if (achievedOn === null && value >= goal.targetValue) achievedOn = session.date;
  }

  const series = history.map((session) => ({
    date: session.date,
    value: valueOf(session, goal.metric),
  }));

  return {
    goal,
    current: Math.round(current * 10) / 10,
    achievedOn,
    daysLeft: daysBetween(todayISO(), goal.targetDate),
    projection: achievedOn ? null : projectTarget(linearTrend(series), goal.targetValue),
  };
}

/**
 * Reicht das Tempo?
 *
 * Drei Faelle, und einer davon ist "weiss nicht". Eine Gerade durch wenige
 * Punkte taugt nicht fuer eine Zusage, deshalb sagt die App bei duenner
 * Datenlage lieber nichts.
 */
export type GoalPace = 'geschafft' | 'reicht' | 'knapp' | 'zu wenig' | 'unklar';

export function goalPace(status: GoalStatus): GoalPace {
  if (status.achievedOn) return 'geschafft';
  if (!status.projection) return 'unklar';
  const slack = status.daysLeft - status.projection.days;
  if (slack >= 14) return 'reicht';
  if (slack >= -14) return 'knapp';
  return 'zu wenig';
}

export const PACE_LABELS: Record<GoalPace, string> = {
  geschafft: 'geschafft',
  reicht: 'geht sich aus',
  knapp: 'wird knapp',
  'zu wenig': 'so wird es nichts',
  unklar: 'noch zu wenig Verlauf',
};
