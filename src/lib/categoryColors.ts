import type { ExerciseCategory } from '../types';

/**
 * Eine feste Farbe je Muskelgruppe.
 *
 * Die Farben ziehen sich durch die ganze App - Uebungskarten, Suchergebnisse,
 * Planuebersicht und Auswertungen. Dadurch erkennt man eine Gruppe am Farbton,
 * bevor man den Text gelesen hat.
 *
 * Die Toene sind ueber den Farbkreis verteilt, damit benachbarte Gruppen gut
 * unterscheidbar bleiben, und liegen in einer Helligkeit, die sowohl auf dem
 * dunklen als auch auf dem hellen Hintergrund lesbar ist.
 */
export const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  chest: '#ff6b6b',      // Koralle
  shoulders: '#ff922b',  // Orange
  core: '#fcc419',       // Gelb
  fullbody: '#51cf66',   // Gruen
  arms: '#20c997',       // Minze
  cardio: '#22b8cf',     // Cyan
  back: '#4dabf7',       // Blau
  legs: '#9775fa',       // Violett
  mobility: '#cc5de8',   // Magenta
  glutes: '#f06595',     // Pink
  other: '#868e96',      // Neutral
};

export const categoryColor = (category: ExerciseCategory): string =>
  CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;

/** Dieselbe Farbe stark abgeschwaecht - fuer Flaechen hinter Text. */
export const categoryTint = (category: ExerciseCategory, alpha = 0.15): string => {
  const hex = categoryColor(category);
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
