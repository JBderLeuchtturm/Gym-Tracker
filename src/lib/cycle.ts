import { t } from '../i18n';
import type { Plan, PlanCycle } from '../types';
import { daysBetween, startOfWeek } from './date';

/**
 * Mehrwoechige Zyklen.
 *
 * Die Idee: Ein Plan bleibt derselbe, nur die Zielgewichte wandern. Woche 1
 * ist der Ausgangspunkt, jede weitere Woche legt einen Prozentsatz drauf, und
 * die Entlastungswoche nimmt bewusst Last heraus. Danach beginnt der Zyklus
 * von vorn - mit dem, was du inzwischen tatsaechlich schaffst.
 *
 * Bewusst nicht enthalten: eine automatische Erhoehung der Ausgangsgewichte.
 * Was der naechste Zyklus wert ist, entscheidest du, nicht die App.
 */

export const DEFAULT_CYCLE: PlanCycle = {
  weeks: 4,
  deloadWeek: 4,
  stepPct: 2.5,
  deloadPct: 60,
  startDate: '',
};

/**
 * In welcher Woche des Zyklus liegt das Datum? 1-basiert.
 * null, wenn kein Zyklus laeuft oder das Datum davor liegt.
 */
export function cycleWeek(cycle: PlanCycle | null | undefined, date: string): number | null {
  if (!cycle || cycle.weeks < 1 || !cycle.startDate) return null;
  const weeks = Math.floor(daysBetween(startOfWeek(cycle.startDate), startOfWeek(date)) / 7);
  if (weeks < 0) return null;
  return (weeks % cycle.weeks) + 1;
}

/** Ist die Woche eine Entlastungswoche? */
export function isDeload(cycle: PlanCycle | null | undefined, date: string): boolean {
  const week = cycleWeek(cycle, date);
  return week != null && cycle?.deloadWeek === week;
}

/**
 * Faktor auf das Zielgewicht. 1 = unveraendert.
 * Ohne Zyklus - oder vor dessen Beginn - bleibt alles, wie es im Plan steht.
 */
export function cycleFactor(cycle: PlanCycle | null | undefined, date: string): number {
  const week = cycleWeek(cycle, date);
  if (!cycle || week == null) return 1;
  if (cycle.deloadWeek === week) return Math.max(0.1, cycle.deloadPct / 100);
  return 1 + (cycle.stepPct / 100) * (week - 1);
}

/** Kurze Beschreibung fuer die Anzeige, etwa "Woche 2 von 4 · +2,5 %". */
export function cycleLabel(plan: Plan | null | undefined, date: string): string | null {
  const cycle = plan?.cycle;
  const week = cycleWeek(cycle, date);
  if (!cycle || week == null) return null;

  if (cycle.deloadWeek === week) {
    return t('Woche {week} von {weeks} · Entlastung', { week, weeks: cycle.weeks });
  }
  const plus = Math.round((cycleFactor(cycle, date) - 1) * 1000) / 10;
  return plus === 0
    ? t('Woche {week} von {weeks}', { week, weeks: cycle.weeks })
    : t('Woche {week} von {weeks} · +{pct} %', { week, weeks: cycle.weeks, pct: plus });
}

/** Zielgewicht der Woche, auf halbe Kilo gerundet. */
export function cycleWeight(
  targetWeightKg: number | null,
  cycle: PlanCycle | null | undefined,
  date: string,
): number | null {
  if (targetWeightKg == null) return null;
  const factor = cycleFactor(cycle, date);
  if (factor === 1) return targetWeightKg;
  return Math.round(targetWeightKg * factor * 2) / 2;
}
