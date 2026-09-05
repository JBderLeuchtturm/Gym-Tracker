/**
 * Spielarten einer Bewegung zusammenfassen.
 *
 * Wer flach, schraeg und mit Kurzhanteln bankdrueckt, hat drei Verlaeufe mit
 * je wenigen Punkten - und keinen, der etwas zeigt. Zusammen ergeben sie eine
 * Linie, an der man sieht, ob es vorangeht.
 *
 * Zugeordnet wird ueber eine feste, ueberschaubare Liste von Bewegungen statt
 * ueber Namensaehnlichkeit. Aehnlichkeit haette "Beinstrecker" und
 * "Beinbeuger" in einen Topf geworfen - zwei Uebungen, die entgegengesetzte
 * Muskeln treffen. Lieber wenige, sichere Gruppen als viele, die manchmal
 * falsch liegen.
 */

import type { Exercise, ID } from '../types';

export interface Family {
  id: string;
  label: string;
  pattern: RegExp;
  /** Treffer, die trotz Musters nicht dazugehoeren. */
  exclude?: RegExp;
}

/*
 * Die Reihenfolge entscheidet: Der erste Treffer gewinnt. Deshalb stehen die
 * engen Muster vor den weiten - "Wadenheben in der Beinpresse" ist Wadenheben,
 * nicht Beinpresse, und "Reverse Butterfly" trifft die hintere Schulter,
 * nicht die Brust.
 */
export const FAMILIES: Family[] = [
  { id: 'bench', label: 'Bankdrücken', pattern: /bankdrücken|bankdruecken|bench press|brustpresse/i, exclude: /bankdips/i },
  { id: 'squat', label: 'Kniebeuge', pattern: /kniebeuge|\bsquat\b|hackenschmidt/i },
  { id: 'deadlift', label: 'Kreuzheben', pattern: /kreuzheben|deadlift/i },
  { id: 'ohp', label: 'Schulterdrücken', pattern: /schulterdrücken|schulterdruecken|overhead press|military press|nackendrücken/i },
  { id: 'pulldown', label: 'Zug von oben', pattern: /klimmzug|klimmzüge|latzug|latziehen|pull-?up|chin-?up|pulldown/i },
  { id: 'raise', label: 'Seitheben', pattern: /seitheben|frontheben|lateral raise|reverse fly|reverse flys|reverse butterfly/i },
  { id: 'fly', label: 'Fliegende', pattern: /fliegende|butterfly|pec deck|crossover|\bfly\b/i },
  { id: 'dips', label: 'Dips', pattern: /\bdips?\b|bankdips/i },
  { id: 'triceps', label: 'Trizeps', pattern: /trizeps|french press|kickback|pushdown/i },
  { id: 'curl', label: 'Bizepscurl', pattern: /bizeps.?curl|hammercurl|konzentrationscurl|scott.?curl|langhantelcurl|kurzhantelcurl/i },
  { id: 'calf', label: 'Wadenheben', pattern: /wadenheben|calf raise|\bwaden\b/i },
  { id: 'legcurl', label: 'Beinbeuger', pattern: /beinbeuger|leg curl|beincurl/i },
  { id: 'legext', label: 'Beinstrecker', pattern: /beinstrecker|leg extension/i },
  { id: 'legpress', label: 'Beinpresse', pattern: /beinpresse|leg press|ausfallschritt|lunge|bulgarische/i },
  {
    id: 'row',
    label: 'Rudern',
    pattern: /rudern|barbell row|cable row|t-bar/i,
    // Aufrechtes Rudern trifft die Schulter, das Rudergeraet ist Ausdauer.
    exclude: /aufrechtes rudern|upright row|rudergerät|rudergeraet|ergometer|skierg/i,
  },
];

/**
 * Zu welcher Bewegung gehoert die Uebung? Eine ausdrueckliche Zuordnung am
 * Eintrag selbst schlaegt die Liste - wer seine eigene Uebung einer Gruppe
 * zuschlaegt, meint das so.
 */
export function familyOf(
  exercise: Exercise | undefined,
  lookup?: (id: ID) => Exercise | undefined,
): Family | null {
  if (!exercise) return null;

  if (exercise.variantOf && lookup) {
    const parent = lookup(exercise.variantOf);
    // Nur eine Ebene tief: Ketten waeren schwer zu durchschauen und leicht
    // im Kreis zu legen.
    if (parent) return familyOf(parent) ?? syntheticFamily(parent);
  }

  /*
   * Ausdauer und Mobilitaet bleiben aussen vor: Eine Gruppe soll zeigen, ob
   * die Last steigt. Ein Sprungsquat gehoert nicht in dieselbe Linie wie eine
   * schwere Kniebeuge, auch wenn "Squat" im Namen steht.
   */
  if (exercise.kind === 'cardio' || exercise.kind === 'mobility') return null;

  const haystack = [exercise.name, exercise.nameEn ?? ''].join(' ');
  return FAMILIES.find((family) => (
    family.pattern.test(haystack) && !(family.exclude?.test(haystack) ?? false)
  )) ?? null;
}

/** Eine Gruppe, die es nur wegen einer ausdruecklichen Zuordnung gibt. */
const syntheticFamily = (parent: Exercise): Family => ({
  id: `custom:${parent.id}`,
  label: parent.name,
  pattern: /$^/,
});

/** Alle Uebungen einer Gruppe - inklusive der, von der aus gefragt wurde. */
export function familyMembers(
  all: Exercise[],
  family: Family,
  lookup?: (id: ID) => Exercise | undefined,
): Exercise[] {
  return all.filter((exercise) => familyOf(exercise, lookup)?.id === family.id);
}
