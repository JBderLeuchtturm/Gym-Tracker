/**
 * Prozenttabelle zum geschaetzten Ein-Wiederholungs-Maximum.
 *
 * Die Schaetzung selbst gibt es schon (Epley, siehe stats.ts). Was im Studio
 * fehlt, ist der Schritt danach: "70 % davon" steht im Plan, und man rechnet
 * es jedes Mal neu.
 *
 * Die Wiederholungszahlen kommen aus derselben Formel wie die Schaetzung -
 * eine fremde Tabelle danebenzulegen wuerde nur widerspruechliche Zahlen
 * erzeugen. Epley: 1RM = w · (1 + r/30), also w = 1RM · 30/(30+r) und
 * umgekehrt r = 30 · (1RM/w − 1).
 */

export const PERCENT_STEPS = [100, 95, 90, 85, 80, 75, 70, 65, 60] as const;

export interface PercentRow {
  pct: number;
  kg: number;
  /** Wiederholungen, die bei diesem Gewicht rechnerisch drin waeren. */
  reps: number;
}

/** Auf die naechste Stufe runden, die man an der Stange auch einstellen kann. */
export const roundToStep = (kg: number, step = 2.5): number =>
  Math.round(kg / step) * step;

export function percentTable(oneRmKg: number, step = 2.5): PercentRow[] {
  if (!Number.isFinite(oneRmKg) || oneRmKg <= 0) return [];
  return PERCENT_STEPS.map((pct) => {
    const raw = (oneRmKg * pct) / 100;
    const reps = Math.max(1, Math.round(30 * (100 / pct - 1)));
    return { pct, kg: roundToStep(raw, step), reps };
  });
}
