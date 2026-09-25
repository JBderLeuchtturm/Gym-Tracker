import type { ExerciseCategory } from '../types';

/**
 * Eine feste Farbe je Muskelgruppe - die Farben der Wettkampfscheiben.
 *
 * Brust ist rot wie die 25er, Ruecken blau wie die 20er, Beine gelb wie die
 * 15er, Schultern gruen wie die 10er, Arme weiss wie die 5er. Die fuenf grossen
 * Gruppen bekommen die fuenf Scheiben; die kleineren Gruppen Toene dazwischen.
 *
 * Die Farbe steht nur als Streifen an der Kante und als Punkt neben dem
 * Namen - nie als Schriftfarbe und nie als Flaeche eines Knopfs. So bleibt
 * eine rote Brustuebung eine Brustuebung und wird nicht zur Fehlermeldung,
 * obwohl Rot auch "sieh her" heisst: Die Form traegt die Bedeutung, nicht die
 * Farbe allein.
 *
 * Die Werte stehen als Variablen in styles.css (--muscle-*), je Thema eigens
 * gerechnet: "Weiss" ist auf hellem Grund Eisen - fast schwarz wie eine
 * Bumper-Scheibe -, "Gelb" ein Ocker. Die kleineren Gruppen: Rumpf Stahl,
 * Po orange, Cardio petrol, Ganzkoerper pink, Mobilitaet violett, Sonstiges
 * braun. Jeder Ton erreicht auf jedem Kartengrund mindestens 3 zu 1 - das Mass
 * fuer Grafik, die etwas bedeutet -, und je zwei Toene liegen im Lab-Raum
 * mindestens 20 auseinander (geprueft in tests/fuenfte.mjs).
 */
export const CATEGORY_COLORS: Record<ExerciseCategory, string> = {
  chest: 'var(--muscle-chest)',
  back: 'var(--muscle-back)',
  legs: 'var(--muscle-legs)',
  shoulders: 'var(--muscle-shoulders)',
  arms: 'var(--muscle-arms)',
  glutes: 'var(--muscle-glutes)',
  core: 'var(--muscle-core)',
  cardio: 'var(--muscle-cardio)',
  fullbody: 'var(--muscle-fullbody)',
  mobility: 'var(--muscle-mobility)',
  other: 'var(--muscle-other)',
};
export const categoryColor = (category: ExerciseCategory): string =>
  CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;

/** Dieselbe Farbe stark abgeschwaecht - fuer Flaechen hinter Text. */
export const categoryTint = (category: ExerciseCategory, alpha = 0.15): string =>
  `color-mix(in srgb, ${categoryColor(category)} ${Math.round(alpha * 100)}%, transparent)`;
