import type { PlanExercise } from '../types';
import { uid } from '../storage/defaults';

/*
 * Supersaetze und Zirkel im Plan.
 *
 * Eine Gruppe ist eine zusammenhaengende Folge von Plan-Eintraegen mit
 * derselben `groupId` - im Editor gekoppelt ueber das Kettenglied zwischen
 * zwei Uebungen, im Training als ein Durchgang nacheinander gemacht.
 */

/**
 * Raeumt die Gruppen eines Tages auf.
 *
 * Eine Gruppe ist eine zusammenhaengende Folge mit derselben `groupId`. Nach
 * dem Verschieben oder Loeschen kann dieselbe ID an zwei getrennten Stellen
 * stehen oder eine Gruppe aus einer einzigen Uebung bestehen - beides ist
 * kein Supersatz. Getrennte Stuecke bekommen eigene IDs, Einzelne gar keine.
 */
export function tidyGroups(list: PlanExercise[]): PlanExercise[] {
  const seen = new Set<string>();
  const renamed: PlanExercise[] = [];
  let previousOriginal: string | undefined;
  let currentId: string | undefined;

  for (const item of list) {
    if (!item.groupId) {
      renamed.push(item);
      previousOriginal = undefined;
      continue;
    }
    if (item.groupId !== previousOriginal) {
      currentId = seen.has(item.groupId) ? uid('grp') : item.groupId;
      seen.add(item.groupId);
    }
    previousOriginal = item.groupId;
    renamed.push({ ...item, groupId: currentId });
  }

  return renamed.map((item, index) => {
    if (!item.groupId) return item;
    const alone = renamed[index - 1]?.groupId !== item.groupId && renamed[index + 1]?.groupId !== item.groupId;
    if (!alone) return item;
    const { groupId: _dropped, ...rest } = item;
    return rest;
  });
}
