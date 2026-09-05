/**
 * Scheibenrechner.
 *
 * "82,5 kg" heisst an der Langhantel: pro Seite 20 + 10 + 1,25. Das rechnet
 * man sonst zwischen zwei Saetzen im Kopf, und zwar jedes Mal neu.
 *
 * Gerechnet wird exakt, nicht gierig. Der naheliegende Weg - immer die
 * schwerste Scheibe nehmen, die noch passt - liefert bei manchen Saetzen zu
 * viele Scheiben oder gar keine Loesung: 30 kg je Seite sind mit 20 + 15 nicht
 * zu machen, mit 15 + 15 schon. Deshalb eine kleine vollstaendige Suche.
 */

import type { Exercise } from '../types';

/** Uebliche Hantelstangen in Kilogramm. */
export const BAR_WEIGHTS = [20, 15, 10, 7.5] as const;

export const DEFAULT_BAR_KG = 20;

/** Was in einem durchschnittlichen Studio am Staender haengt. */
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Feinste Stufe, mit der gerechnet wird: ein Viertelkilo. */
const UNIT = 0.25;

export interface PlateResult {
  /** Scheiben je Seite, schwerste zuerst. */
  perSide: number[];
  /** Gewicht, das damit tatsaechlich auf der Stange liegt. */
  totalKg: number;
  /** Differenz zum Wunschgewicht - 0, wenn es genau aufgeht. */
  offByKg: number;
  /** Gewicht der Stange, das in die Rechnung eingegangen ist. */
  barKg: number;
}

/**
 * Welche Scheiben je Seite? Geht das Wunschgewicht nicht exakt auf, wird das
 * naechstgelegene erreichbare genommen und die Differenz mitgeliefert - eine
 * erfundene Zahl waere hier schlimmer als ein ehrliches "1,25 kg daneben".
 */
export function platesFor(
  targetKg: number,
  barKg: number = DEFAULT_BAR_KG,
  plates: number[] = DEFAULT_PLATES,
): PlateResult | null {
  if (!Number.isFinite(targetKg) || targetKg <= 0) return null;
  if (targetKg < barKg) return null;

  const usable = [...new Set(plates.filter((plate) => plate > 0))].sort((a, b) => b - a);
  if (usable.length === 0) return null;

  const perSideTarget = (targetKg - barKg) / 2;
  const steps = Math.round(perSideTarget / UNIT);
  if (steps < 0) return null;
  if (steps === 0) return { perSide: [], totalKg: barKg, offByKg: targetKg - barKg, barKg };

  // Wie viele Scheiben braucht es fuer n Viertelkilo? Unendlich = nicht machbar.
  const cost = new Array<number>(steps + 1).fill(Infinity);
  const used = new Array<number>(steps + 1).fill(0);
  cost[0] = 0;

  const plateSteps = usable
    .map((plate) => ({ plate, step: Math.round(plate / UNIT) }))
    .filter((item) => item.step > 0);

  for (let index = 1; index <= steps; index += 1) {
    for (const { plate, step } of plateSteps) {
      if (step > index || cost[index - step] + 1 >= cost[index]) continue;
      cost[index] = cost[index - step] + 1;
      used[index] = plate;
    }
  }

  // Das naechstgelegene erreichbare Gewicht suchen - erst nach unten, dann nach oben.
  let best = -1;
  for (let distance = 0; distance <= steps; distance += 1) {
    if (Number.isFinite(cost[steps - distance])) { best = steps - distance; break; }
    const up = steps + distance;
    if (up < cost.length && Number.isFinite(cost[up])) { best = up; break; }
  }
  if (best < 0) return null;

  const perSide: number[] = [];
  for (let index = best; index > 0; index -= Math.round(used[index] / UNIT)) {
    perSide.push(used[index]);
  }
  perSide.sort((a, b) => b - a);

  const totalKg = barKg + best * UNIT * 2;
  return {
    perSide,
    totalKg: Math.round(totalKg * 100) / 100,
    offByKg: Math.round((totalKg - targetKg) * 100) / 100,
    barKg,
  };
}

/** Kurzform fuer eine Zeile, z. B. "20 + 10 + 1,25". */
export const describePlates = (perSide: number[]): string =>
  perSide.length === 0
    ? 'nur die Stange'
    : perSide.map((plate) => plate.toLocaleString('de-DE')).join(' + ');

const BARBELL_HINTS = /langhantel|sz-stange|curlstange|t-bar|barbell|olympi/i;
const NO_BAR_HINTS = /kurzhantel|maschine|kabel|körpergewicht|koerpergewicht|band|kettlebell/i;

/**
 * Lohnt der Scheibenrechner ueberhaupt? An der Maschine und am Kabelzug steckt
 * man einen Stift in einen Block - da gibt es nichts je Seite zu rechnen.
 */
export function usesBarbell(exercise: Exercise | undefined): boolean {
  if (!exercise) return false;
  const equipment = exercise.equipment.join(' ');
  if (BARBELL_HINTS.test(equipment)) return true;
  if (NO_BAR_HINTS.test(equipment)) return false;
  return BARBELL_HINTS.test(exercise.name);
}
