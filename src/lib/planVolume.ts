import type { Exercise, Plan } from '../types';
import { regionsOf, type MuscleRegion, ALL_REGIONS, REGION_LABELS } from './muscles';
import { SECONDARY_WEIGHT, targetFor } from './muscleLoad';

export interface PlannedRegion {
  region: MuscleRegion;
  label: string;
  /** Geplante Arbeitssaetze je Woche (sekundaere Muskeln zaehlen halb). */
  sets: number;
  target: number;
}

/**
 * Wochenvolumen je Muskelregion, aus den Vorgaben eines Plans - nicht aus
 * geloggten Trainings. So sieht man vor dem ersten Training, ob der Plan
 * aufgeht: wo zu wenig steht und wo zu viel.
 */
export function plannedWeeklyLoad(
  plan: Plan,
  getExercise: (id: string) => Exercise | undefined,
  targets: Record<string, number> | undefined,
): PlannedRegion[] {
  const sets = new Map<MuscleRegion, number>();

  for (const day of plan.days) {
    if (day.isRestDay) continue;
    for (const planExercise of day.exercises) {
      const exercise = getExercise(planExercise.exerciseId);
      if (!exercise) continue;
      const count = planExercise.targetSets || 0;
      if (count <= 0) continue;
      const { primary, secondary } = regionsOf(exercise);
      for (const region of primary) sets.set(region, (sets.get(region) ?? 0) + count);
      for (const region of secondary) {
        sets.set(region, (sets.get(region) ?? 0) + count * SECONDARY_WEIGHT);
      }
    }
  }

  return ALL_REGIONS
    .map((region) => ({
      region,
      label: REGION_LABELS[region],
      sets: Math.round((sets.get(region) ?? 0) * 10) / 10,
      target: targetFor(targets, region),
    }))
    .filter((entry) => entry.sets > 0 || entry.target > 0)
    .sort((a, b) => b.sets - a.sets);
}
