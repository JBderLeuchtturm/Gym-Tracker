/**
 * Findet diese Uebung draussen statt?
 *
 * Wird gebraucht, um zu entscheiden, ob das Wetter am Trainingstag ueberhaupt
 * interessiert. Wer im Studio Bankdruecken macht, dem ist Regen egal.
 *
 * Geraten wird aus Name und Geraet, weil der Katalog kein eigenes Feld dafuer
 * hat. Wer es besser weiss, kann es an der Uebung ausdruecklich setzen - dann
 * gilt das und nicht die Vermutung.
 */

import type { Exercise } from '../types';

/** Wortteile, die auf draussen deuten. */
const OUTDOOR = /drau(ss|ß)en|outdoor|joggen|jogging|laufen(?!band)|running|walking|wandern|trail|sprint|radfahren|rennrad|mountainbike|nordic walking|schwimmen im see|freibad|ruder(n|boot) auf/i;

/** Geraete, die es nur drinnen gibt - die schlagen den Namen. */
const INDOOR_GEAR = /laufband|treadmill|ergometer|crosstrainer|stairmaster|rudergeraet|rudergerät|assault|skierg|maschine|kabelzug|langhantel|kurzhantel|schwimmbad|multipresse/i;

export function isOutdoor(exercise: Exercise | undefined): boolean {
  if (!exercise) return false;
  if (typeof exercise.outdoor === 'boolean') return exercise.outdoor;

  const gear = exercise.equipment.join(' ');
  if (INDOOR_GEAR.test(gear)) return false;

  const haystack = [exercise.name, exercise.nameEn ?? '', ...(exercise.aliases ?? [])].join(' ');
  return OUTDOOR.test(haystack);
}
