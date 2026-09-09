/**
 * Erfolge.
 *
 * Alles hier wird aus dem Verlauf abgeleitet und nirgends gespeichert - genau
 * wie bei den Zielen und aus demselben Grund: Ein abgelegtes "geschafft" kann
 * zwischen zwei Geraeten auseinanderlaufen, ein abgeleitetes nie. Wer eine
 * Einheit loescht, verliert das Abzeichen wieder. Das ist richtig so.
 *
 * Jeder Erfolg kennt auch seinen Anteil bis dahin. Ein Abzeichen, von dem man
 * nur weiss, dass es fehlt, ist kein Ziel - eines, bei dem "88 % geschafft"
 * steht, schon.
 */

import type { AppState, Exercise, ID } from '../types';
import { countsAsWork, countsAsTrained, streakInfo, workoutSetCount } from './stats';
import { weekKey } from './date';
import type { FamilyRank, OverallRank } from './ranks';

export type AchievementLevel = 'bronze' | 'silber' | 'gold';

export type AchievementGroup =
  | 'kraft' | 'stufen' | 'serie' | 'volumen' | 'breite' | 'bestaendigkeit';

export const GROUP_LABELS: Record<AchievementGroup, string> = {
  kraft: 'Kraft',
  stufen: 'Stufen',
  serie: 'Dranbleiben',
  volumen: 'Bewegtes Gewicht',
  breite: 'Vielfalt',
  bestaendigkeit: 'Beständigkeit',
};

export const LEVEL_LABELS: Record<AchievementLevel, string> = {
  bronze: 'Bronze', silber: 'Silber', gold: 'Gold',
};

export interface Achievement {
  id: string;
  group: AchievementGroup;
  level: AchievementLevel;
  label: string;
  hint: string;
  earned: boolean;
  /** 0 bis 1 - wie weit ist es bis dahin? */
  share: number;
  /** Der Stand in Worten, z. B. "88 t von 100 t". */
  progress: string;
}

/** Zahlen, die mehrere Erfolge brauchen - einmal gerechnet statt zwanzigmal. */
interface Facts {
  workouts: number;
  days: number;
  sets: number;
  volume: number;
  bestWeekVolume: number;
  bestWeekWorkouts: number;
  exercises: number;
  regionsInBestWeek: number;
  spanDays: number;
  weekStreak: number;
  longestStreak: number;
}

const REGIONS = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

function gather(state: AppState, lookup: (id: ID) => Exercise | undefined): Facts {
  const byWeek = new Map<string, { volume: number; workouts: number; regions: Set<string> }>();
  const days = new Set<string>();
  const exercises = new Set<ID>();
  let volume = 0;
  let sets = 0;
  let counted = 0;

  for (const workout of state.workouts) {
    if (workoutSetCount(workout) === 0) continue;
    counted += 1;
    days.add(workout.date);
    const key = weekKey(workout.date);
    const week = byWeek.get(key) ?? { volume: 0, workouts: 0, regions: new Set<string>() };
    week.workouts += 1;

    for (const logged of workout.exercises) {
      if (!countsAsTrained(logged)) continue;
      let touched = false;
      for (const set of logged.sets) {
        if (!countsAsWork(set)) continue;
        const load = (set.weightKg ?? 0) * (set.reps ?? 0);
        volume += load;
        week.volume += load;
        sets += 1;
        touched = true;
      }
      if (touched) {
        exercises.add(logged.exerciseId);
        const category = lookup(logged.exerciseId)?.category;
        if (category && REGIONS.includes(category)) week.regions.add(category);
      }
    }
    byWeek.set(key, week);
  }

  const dates = [...days].sort();
  const streak = streakInfo(state);

  return {
    workouts: counted,
    days: days.size,
    sets,
    volume,
    bestWeekVolume: Math.max(0, ...[...byWeek.values()].map((week) => week.volume)),
    bestWeekWorkouts: Math.max(0, ...[...byWeek.values()].map((week) => week.workouts)),
    exercises: exercises.size,
    regionsInBestWeek: Math.max(0, ...[...byWeek.values()].map((week) => week.regions.size)),
    spanDays: dates.length >= 2
      ? Math.round((Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000)
      : 0,
    weekStreak: streak.current,
    longestStreak: streak.longest,
  };
}

/* --------------------------------------------------------- Kleine Helfer */

const clamp = (value: number): number => Math.min(1, Math.max(0, value));

/** Ein Erfolg, der eine Zahl erreichen will. */
function milestone(
  id: string, group: AchievementGroup, level: AchievementLevel,
  label: string, hint: string,
  value: number, target: number, unit: string, digits = 0,
): Achievement {
  const fmt = (input: number) => input.toLocaleString('de-DE', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
  return {
    id, group, level, label, hint,
    earned: value >= target,
    share: target > 0 ? clamp(value / target) : 0,
    progress: `${fmt(Math.min(value, target))} von ${fmt(target)}${unit ? ` ${unit}` : ''}`,
  };
}

/* ------------------------------------------------------------- Die Liste */

export function achievements(
  state: AppState,
  lookup: (id: ID) => Exercise | undefined,
  families: FamilyRank[],
  overall: OverallRank,
): Achievement[] {
  const facts = gather(state, lookup);
  const byFamily = new Map(families.map((rank) => [rank.family, rank]));
  const ratio = (family: string) => byFamily.get(family)?.ratio ?? 0;
  const best = (family: string) => byFamily.get(family)?.best ?? 0;
  const bigThree = best('bench') + best('squat') + best('deadlift');
  const trained = families.length;
  const atLeast = (score: number) =>
    (trained > 0 ? families.filter((rank) => rank.score >= score).length / trained : 0);
  const tonnes = facts.volume / 1000;

  const list: Achievement[] = [
    /* ------------------------------------------------------------- Kraft */
    milestone('bank-koerpergewicht', 'kraft', 'silber', 'Bank = Körpergewicht',
      'Einmal das eigene Gewicht bankdrücken', ratio('bench'), 1, '×', 2),
    milestone('bank-anderthalb', 'kraft', 'gold', 'Bank 1,5×',
      'Anderthalbfaches Körpergewicht im Bankdrücken', ratio('bench'), 1.5, '×', 2),
    milestone('kniebeuge-anderthalb', 'kraft', 'silber', 'Kniebeuge 1,5×',
      'Anderthalbfaches Körpergewicht in der Kniebeuge', ratio('squat'), 1.5, '×', 2),
    milestone('kniebeuge-doppelt', 'kraft', 'gold', 'Kniebeuge 2×',
      'Doppeltes Körpergewicht in der Kniebeuge', ratio('squat'), 2, '×', 2),
    milestone('kreuzheben-doppelt', 'kraft', 'silber', 'Kreuzheben 2×',
      'Doppeltes Körpergewicht im Kreuzheben', ratio('deadlift'), 2, '×', 2),
    milestone('kreuzheben-zweieinhalb', 'kraft', 'gold', 'Kreuzheben 2,5×',
      'Zweieinhalbfaches Körpergewicht im Kreuzheben', ratio('deadlift'), 2.5, '×', 2),
    milestone('ohp-dreiviertel', 'kraft', 'silber', 'Schulterdrücken 0,75×',
      'Drei Viertel des Körpergewichts über den Kopf', ratio('ohp'), 0.75, '×', 2),
    milestone('rudern-koerpergewicht', 'kraft', 'silber', 'Rudern = Körpergewicht',
      'Das eigene Gewicht waagerecht ziehen', ratio('row'), 1, '×', 2),
    milestone('klimmzug-plus', 'kraft', 'gold', 'Klimmzug mit Zusatz',
      'Ein Viertel Körpergewicht extra am Gürtel', ratio('pulldown'), 1.25, '×', 2),
    milestone('club-500', 'kraft', 'bronze', 'Club der 500',
      'Bank, Kniebeuge und Kreuzheben zusammen über 500 kg', bigThree, 500, 'kg'),
    milestone('club-1000', 'kraft', 'gold', 'Club der 1000',
      'Bank, Kniebeuge und Kreuzheben zusammen über 1000 kg', bigThree, 1000, 'kg'),

    /* ------------------------------------------------------------ Stufen */
    milestone('erster-rang', 'stufen', 'bronze', 'Erster Rang',
      'Eine gewertete Bewegung im Verlauf', trained, 1, ''),
    milestone('grunduebungen', 'stufen', 'bronze', 'Die drei Großen',
      'Bank, Kniebeuge und Kreuzheben mindestens einmal',
      ['bench', 'squat', 'deadlift'].filter((family) => byFamily.has(family)).length, 3, ''),
    milestone('alles-geuebt', 'stufen', 'silber', 'Überall Silber',
      'Jede trainierte Bewegung mindestens „Silber“', atLeast(20), 1, '', 2),
    milestone('erstes-elite', 'stufen', 'gold', 'Erstes Elite',
      'Eine Bewegung auf der höchsten Stufe',
      families.filter((rank) => rank.tier === 'elite').length, 1, ''),
    milestone('ueberall-stark', 'stufen', 'gold', 'Überall Gold',
      'Jede trainierte Bewegung mindestens „Gold“', atLeast(40), 1, '', 2),
    milestone('gesamt-40', 'stufen', 'bronze', 'Gesamtrang 40',
      'Gold im Gesamtrang', overall.score, 40, 'Punkte'),
    milestone('gesamt-60', 'stufen', 'silber', 'Gesamtrang 60',
      'Diamant im Gesamtrang', overall.score, 60, 'Punkte'),
    milestone('gesamt-80', 'stufen', 'gold', 'Gesamtrang 90',
      'Elite im Gesamtrang', overall.score, 90, 'Punkte'),

    /* ------------------------------------------------------------ Breite */
    milestone('breite-halb', 'breite', 'silber', 'Halbe Landkarte',
      'Die Hälfte aller gewerteten Bewegungen abgedeckt', overall.breadth, 0.5, '', 2),
    milestone('breite-voll', 'breite', 'gold', 'Vollständig',
      'Jede gewertete Bewegung mindestens einmal', trained, overall.total, ''),
    milestone('uebungen-25', 'breite', 'bronze', '25 Übungen',
      'Fünfundzwanzig verschiedene Übungen ausprobiert', facts.exercises, 25, ''),
    milestone('uebungen-50', 'breite', 'silber', '50 Übungen',
      'Fünfzig verschiedene Übungen ausprobiert', facts.exercises, 50, ''),
    milestone('uebungen-100', 'breite', 'gold', '100 Übungen',
      'Hundert verschiedene Übungen ausprobiert', facts.exercises, 100, ''),
    milestone('ganzer-koerper', 'breite', 'silber', 'Ganzer Körper',
      'Brust, Rücken, Beine, Schultern, Arme und Rumpf in einer Woche',
      facts.regionsInBestWeek, 6, 'Regionen'),

    /* ------------------------------------------------------------- Serie */
    milestone('serie-4', 'serie', 'bronze', 'Vier Wochen',
      'Vier Wochen in Folge trainiert', facts.longestStreak, 4, 'Wochen'),
    milestone('serie-10', 'serie', 'silber', 'Zehn Wochen',
      'Zehn Wochen in Folge trainiert', facts.longestStreak, 10, 'Wochen'),
    milestone('serie-26', 'serie', 'gold', 'Ein halbes Jahr',
      'Sechsundzwanzig Wochen in Folge', facts.longestStreak, 26, 'Wochen'),
    milestone('serie-52', 'serie', 'gold', 'Ein ganzes Jahr',
      'Zweiundfünfzig Wochen in Folge – ohne eine Lücke', facts.longestStreak, 52, 'Wochen'),

    /* ---------------------------------------------------------- Volumen */
    milestone('volumen-100t', 'volumen', 'bronze', '100 Tonnen',
      'Hundert Tonnen insgesamt bewegt', tonnes, 100, 't', 1),
    milestone('volumen-500t', 'volumen', 'silber', '500 Tonnen',
      'Fünfhundert Tonnen insgesamt bewegt', tonnes, 500, 't', 1),
    milestone('volumen-1000t', 'volumen', 'gold', '1000 Tonnen',
      'Tausend Tonnen insgesamt bewegt', tonnes, 1000, 't', 1),
    milestone('woche-10t', 'volumen', 'silber', 'Zehn Tonnen in einer Woche',
      'In einer einzigen Woche zehn Tonnen bewegt',
      facts.bestWeekVolume / 1000, 10, 't', 1),

    /* ----------------------------------------------------- Beständigkeit */
    milestone('einheiten-50', 'bestaendigkeit', 'bronze', '50 Einheiten',
      'Fünfzig Trainings aufgezeichnet', facts.workouts, 50, ''),
    milestone('einheiten-200', 'bestaendigkeit', 'silber', '200 Einheiten',
      'Zweihundert Trainings aufgezeichnet', facts.workouts, 200, ''),
    milestone('einheiten-500', 'bestaendigkeit', 'gold', '500 Einheiten',
      'Fünfhundert Trainings aufgezeichnet', facts.workouts, 500, ''),
    milestone('tage-100', 'bestaendigkeit', 'silber', '100 Trainingstage',
      'An hundert verschiedenen Tagen trainiert', facts.days, 100, 'Tage'),
    milestone('woche-fuenf', 'bestaendigkeit', 'bronze', 'Fünf in einer Woche',
      'Fünf Einheiten in einer Woche', facts.bestWeekWorkouts, 5, ''),
    milestone('ein-jahr-dabei', 'bestaendigkeit', 'silber', 'Ein Jahr dabei',
      'Zwischen erster und letzter Einheit liegt ein Jahr', facts.spanDays, 365, 'Tage'),
    milestone('saetze-5000', 'bestaendigkeit', 'gold', '5000 Sätze',
      'Fünftausend gearbeitete Sätze', facts.sets, 5000, 'Sätze'),
  ];

  return list;
}

/** Erreichtes zuerst, dann das, was am naechsten dran ist. */
export function sortAchievements(list: Achievement[]): Achievement[] {
  const rank: Record<AchievementLevel, number> = { gold: 0, silber: 1, bronze: 2 };
  return [...list].sort((a, b) => {
    if (a.earned !== b.earned) return a.earned ? -1 : 1;
    if (a.earned) return rank[a.level] - rank[b.level];
    return b.share - a.share;
  });
}

export const earnedCount = (list: Achievement[]): number =>
  list.filter((item) => item.earned).length;

/** Gruppiert - fuer die Uebersicht im Profil und in der Rangansicht. */
export function byGroup(list: Achievement[]): Array<{
  group: AchievementGroup; label: string; items: Achievement[]; earned: number;
}> {
  const order: AchievementGroup[] = ['kraft', 'stufen', 'serie', 'volumen', 'breite', 'bestaendigkeit'];
  return order.map((group) => {
    const items = sortAchievements(list.filter((item) => item.group === group));
    return { group, label: GROUP_LABELS[group], items, earned: earnedCount(items) };
  }).filter((entry) => entry.items.length > 0);
}
