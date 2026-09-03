import type { Exercise } from '../types';

/** Normalisiert Text fuer die Suche: Kleinbuchstaben, Umlaute aufgeloest. */
export const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00df/g, 'ss')
    // "ue"/"oe"/"ae" auf denselben Nenner bringen wie die entschaerften Umlaute,
    // damit "uebung" und "übung" gleich behandelt werden.
    .replace(/ue/g, 'u')
    .replace(/oe/g, 'o')
    .replace(/ae/g, 'a')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface ScoredExercise {
  exercise: Exercise;
  score: number;
  /** Warum dieser Treffer passt - wird in der UI als Hinweis angezeigt. */
  reason: string;
}

const fieldScore = (haystack: string, needle: string, weights: [number, number, number]): number => {
  if (!haystack) return 0;
  if (haystack === needle) return weights[0];
  if (haystack.startsWith(needle)) return weights[1];
  if (haystack.includes(needle)) return weights[2];
  return 0;
};

/**
 * Bewertet eine Uebung gegen eine Suchanfrage.
 * Mehrere Suchwoerter muessen alle irgendwo treffen (UND-Verknuepfung).
 */
export function scoreExercise(exercise: Exercise, query: string): ScoredExercise | null {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (terms.length === 0) return { exercise, score: 1, reason: '' };

  const name = normalize(exercise.name);
  const nameEn = normalize(exercise.nameEn ?? '');
  const aliases = (exercise.aliases ?? []).map(normalize);
  const muscles = [...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(normalize);
  const equipment = exercise.equipment.map(normalize);

  let total = 0;
  let reason = '';

  for (const term of terms) {
    let best = 0;
    let bestReason = '';

    const nameHit = fieldScore(name, term, [100, 70, 45]);
    if (nameHit > best) { best = nameHit; bestReason = ''; }

    const enHit = fieldScore(nameEn, term, [90, 62, 40]);
    if (enHit > best) { best = enHit; bestReason = exercise.nameEn ?? ''; }

    for (const alias of aliases) {
      const hit = fieldScore(alias, term, [85, 58, 36]);
      if (hit > best) { best = hit; bestReason = `auch: ${alias}`; }
    }
    for (const muscle of muscles) {
      const hit = fieldScore(muscle, term, [30, 24, 18]);
      if (hit > best) { best = hit; bestReason = `Muskel: ${muscle}`; }
    }
    for (const item of equipment) {
      const hit = fieldScore(item, term, [26, 20, 15]);
      if (hit > best) { best = hit; bestReason = `Equipment: ${item}`; }
    }

    // Toleranz für Tippfehler ab 4 Zeichen: ein fehlendes/vertauschtes Zeichen.
    if (best === 0 && term.length >= 4) {
      const fuzzy = [name, nameEn, ...aliases].some((h) => fuzzyIncludes(h, term));
      if (fuzzy) best = 12;
    }

    if (best === 0) return null; // Term nicht gefunden -> kein Treffer
    total += best;
    if (!reason && bestReason) reason = bestReason;
  }

  // Kurze, praegnante Namen leicht bevorzugen.
  total += Math.max(0, 24 - name.length) * 0.2;
  return { exercise, score: total, reason };
}

/** Sehr einfache Fuzzy-Pruefung: alle Zeichen des Terms in Reihenfolge enthalten. */
function fuzzyIncludes(haystack: string, term: string): boolean {
  let index = 0;
  for (const char of haystack) {
    if (char === term[index]) index += 1;
    if (index === term.length) return true;
  }
  return false;
}

export function searchExercises(pool: Exercise[], query: string, limit = 60): ScoredExercise[] {
  const results: ScoredExercise[] = [];
  for (const exercise of pool) {
    const scored = scoreExercise(exercise, query);
    if (scored) results.push(scored);
  }
  results.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, 'de'));
  return results.slice(0, limit);
}
