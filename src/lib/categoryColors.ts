import type { ExerciseCategory } from '../types';

/**
 * Eine feste Farbe je Muskelgruppe.
 *
 * Die Farben ziehen sich durch die ganze App - Uebungsnamen, Suchergebnisse,
 * Auswertungen. Dadurch erkennt man eine Gruppe am Farbton, bevor man den Text
 * gelesen hat.
 *
 * Bewusst gedaempft: Ein voll gesaettigter Regenbogen zieht mehr Aufmerksamkeit
 * auf sich als der Inhalt, den er einordnen soll. Diese Toene sind im Farbkreis
 * verteilt, aber alle in aehnlicher Saettigung und Helligkeit gehalten - so
 * bleiben sie unterscheidbar, ohne zu schreien, und sind auf dunklem wie auf
 * hellem Grund lesbar.
 */
export const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  chest: '#c4695c',      // Terrakotta
  shoulders: '#c08a3e',  // Ocker
  core: '#a2903f',       // Oliv
  fullbody: '#6f9160',   // Salbei
  arms: '#4f9184',       // Petrol
  cardio: '#4d87a0',     // Stahlblau
  back: '#5b7fa8',       // Graublau
  legs: '#7d76ab',       // Staubviolett
  mobility: '#9a6f9e',   // Malve
  glutes: '#b06a86',     // Altrosa
  other: '#7d7a74',      // Neutral
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

