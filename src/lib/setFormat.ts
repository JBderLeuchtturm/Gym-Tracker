/**
 * Ein Satz in Worten.
 *
 * Bisher stand an neun Stellen dieselbe Zeile "X kg × Y" - und an allen neun
 * las man bei Klimmzuegen "0 kg × 9". Null Kilo ist keine Angabe, sondern eine
 * fehlende: Bei einer Koerpergewichtsuebung gibt es kein Hantelgewicht, und
 * eine Null hinzuschreiben behauptet, es sei gemessen worden.
 *
 * Deshalb hier einmal, und ueberall benutzt.
 */

import type { ExerciseKind } from '../types';

/*
 * Zwei Nachkommastellen, weil es 1,25er-Scheiben gibt - mit einer wuerde
 * daraus "1,3 kg", und das steht so auf keiner Scheibe.
 */
const kg = (value: number): string =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`;

/**
 * Traegt man bei dieser Uebung sein eigenes Gewicht?
 *
 * Dann bedeutet eine Zahl im Gewichtsfeld Zusatzgewicht - der Guertel mit der
 * Scheibe daran -, nicht das Gesamtgewicht.
 */
export const isBodyweight = (kind: ExerciseKind | undefined): boolean =>
  kind === 'bodyweight';

/**
 * Wurde hier bewusst ohne Zusatzgewicht gearbeitet?
 *
 * Eine eingetragene Null ist etwas anderes als ein leeres Feld: Die Null sagt
 * "Ausfallschritte nur mit meinem Koerpergewicht", das leere Feld sagt "steht
 * nicht drin". Vorher sahen beide gleich aus.
 */
export const isOwnWeightOnly = (
  weightKg: number | null | undefined,
  kind?: ExerciseKind,
): boolean => !isBodyweight(kind) && weightKg === 0;

/**
 * "82,5 kg × 8", "9 Wdh", "+10 kg × 9", "Körpergewicht × 12".
 * Ohne Wiederholungen bleibt nur das Gewicht stehen.
 */
export function formatSet(
  weightKg: number | null | undefined,
  reps: number | null | undefined,
  kind?: ExerciseKind,
): string {
  const weight = weightKg ?? 0;
  const count = reps ?? 0;

  if (isBodyweight(kind)) {
    if (weight > 0) return count > 0 ? `+${kg(weight)} × ${count}` : `+${kg(weight)}`;
    return count > 0 ? `${count} Wdh` : '–';
  }

  // Ausdrueckliche Null: mit dem eigenen Koerpergewicht gearbeitet.
  if (isOwnWeightOnly(weightKg, kind)) {
    return count > 0 ? `Körpergewicht × ${count}` : 'Körpergewicht';
  }

  if (weight <= 0) return count > 0 ? `${count} Wdh` : '–';
  return count > 0 ? `${kg(weight)} × ${count}` : kg(weight);
}

/** Nur das Gewicht - "82,5 kg", "+10 kg" oder "Körpergewicht". */
export function formatWeight(
  weightKg: number | null | undefined,
  kind?: ExerciseKind,
): string {
  const weight = weightKg ?? 0;
  if (isBodyweight(kind)) return weight > 0 ? `+${kg(weight)}` : 'Körpergewicht';
  if (isOwnWeightOnly(weightKg, kind)) return 'Körpergewicht';
  return weight > 0 ? kg(weight) : '–';
}
