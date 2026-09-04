import type { Exercise, Workout } from '../types';
import { countsAsWork } from './stats';
import { regionsOf, type MuscleRegion } from './muscles';
import { daysBetween } from './date';

/**
 * Belastung je Muskelregion: wie viele Arbeitssaetze auf sie entfallen, wann
 * sie zuletzt drankam und aus welchen Uebungen die Saetze stammen.
 *
 * Sekundaere Muskeln zaehlen halb. Sie arbeiten mit, sind aber nicht das Ziel
 * des Satzes - ein Klimmzug ist keine Bizepsuebung, auch wenn der Bizeps zieht.
 */
export const SECONDARY_WEIGHT = 0.5;

export interface RegionLoad {
  sets: number;
  /** Letzter Tag mit Arbeit an dieser Region, yyyy-mm-dd. */
  lastDate: string | null;
  byExercise: Map<string, number>;
}

export function regionLoad(
  workouts: Workout[],
  getExercise: (id: string) => Exercise | undefined,
): Map<MuscleRegion, RegionLoad> {
  const map = new Map<MuscleRegion, RegionLoad>();

  const add = (region: MuscleRegion, sets: number, exerciseId: string, date: string) => {
    const entry = map.get(region) ?? { sets: 0, lastDate: null, byExercise: new Map<string, number>() };
    entry.sets += sets;
    entry.byExercise.set(exerciseId, (entry.byExercise.get(exerciseId) ?? 0) + sets);
    if (!entry.lastDate || date > entry.lastDate) entry.lastDate = date;
    map.set(region, entry);
  };

  for (const workout of workouts) {
    for (const logged of workout.exercises) {
      const sets = logged.sets.filter(countsAsWork).length;
      if (sets === 0) continue;
      const exercise = getExercise(logged.exerciseId);
      if (!exercise) continue;
      const { primary, secondary } = regionsOf(exercise);
      for (const region of primary) add(region, sets, exercise.id, workout.date);
      for (const region of secondary) add(region, sets * SECONDARY_WEIGHT, exercise.id, workout.date);
    }
  }
  return map;
}

/**
 * Uebliche Empfehlung sind 10 bis 20 harte Saetze je Woche und Muskelgruppe.
 * Kleine Muskeln bekommen weniger, weil sie bei den grossen Uebungen ohnehin
 * mitarbeiten. Das sind Startwerte - jeder Wert laesst sich im Profil aendern.
 */
export const DEFAULT_WEEKLY_TARGET: Record<MuscleRegion, number> = {
  chest: 12,
  lats: 12,
  trapezius: 8,
  deltoids: 12,
  biceps: 8,
  triceps: 8,
  forearms: 4,
  abs: 8,
  obliques: 6,
  lowerback: 6,
  glutes: 10,
  quads: 12,
  hamstrings: 10,
  adductors: 6,
  calves: 8,
  neck: 0,
};

/** Wochenziel einer Region: eigener Wert, sonst der Standard. */
export function targetFor(
  targets: Record<string, number> | undefined,
  region: MuscleRegion,
): number {
  const own = targets?.[region];
  if (typeof own === 'number' && own >= 0) return own;
  return DEFAULT_WEEKLY_TARGET[region];
}

export type LoadStatus = 'off' | 'none' | 'low' | 'mid' | 'good' | 'over';

/**
 * Ampel: Wie steht die Region zu ihrem Wochenziel?
 * "off" heisst, dass fuer diese Region kein Ziel gesetzt ist.
 */
export function loadStatus(sets: number, target: number): LoadStatus {
  if (target <= 0) return 'off';
  if (sets <= 0) return 'none';
  if (sets < target * 0.5) return 'low';
  if (sets < target) return 'mid';
  if (sets <= target * 2) return 'good';
  return 'over';
}

/** Tage seit der letzten Einheit fuer diese Region. null = noch nie. */
export function daysSince(lastDate: string | null, today: string): number | null {
  if (!lastDate) return null;
  return Math.max(0, daysBetween(lastDate, today));
}
