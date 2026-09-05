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
  /*
   * Der warme Bereich zwischen 0 und 45 Grad gehoert dem System: Akzent (30),
   * Warnung (41), Gefahr (5). Terrakotta lag drei Grad neben "Gefahr", Ocker
   * fuenf neben dem Akzent - eine Brustuebung sah aus wie ein Fehler, eine
   * Schulteruebung wie ein Knopf. Die warmen Toene sind deshalb aus dem Weg
   * gerueckt, und jeder Ton erreicht auf hellem wie dunklem Grund mindestens
   * 4 zu 1.
   */
  chest: '#ba5e6e',      // Backstein
  shoulders: '#7d7d36',  // Oliv
  core: '#6a8240',       // Moos
  fullbody: '#5a8551',   // Salbei
  arms: '#47857c',       // Petrol
  cardio: '#4b839b',     // Stahlblau
  back: '#5d7ca8',       // Graublau
  legs: '#7b72ac',       // Staubviolett
  mobility: '#996c9d',   // Malve
  glutes: '#a96683',     // Altrosa
  other: '#7d7973',      // Neutral
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

