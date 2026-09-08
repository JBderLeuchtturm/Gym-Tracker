import type { AppState, Exercise, ID, LoggedExercise, SetLog, Workout } from '../types';
import { parseISODate, weekKey } from './date';
import { formatSet } from './setFormat';

/** Volumen eines Satzes (Gewicht x Wiederholungen). */
/**
 * Zaehlt der Satz in die eigene Auswertung? Aufwaermsaetze, Saetze des
 * Trainingspartners und bewusst ausgelassene tun das nicht - abgehakt sein
 * muss er ohnehin.
 */
export const countsAsWork = (set: SetLog): boolean =>
  set.done && !set.isWarmup && !set.forPartner && !set.skipped;

/**
 * Eine ausgelassene Uebung bleibt im Tag stehen, damit man spaeter noch weiss,
 * was geplant war - aber sie geht in keine Zahl ein.
 */
export const countsAsTrained = (logged: LoggedExercise): boolean => !logged.skipped;

export const setVolume = (set: SetLog): number =>
  countsAsWork(set) ? (set.weightKg ?? 0) * (set.reps ?? 0) : 0;

export const exerciseVolume = (logged: LoggedExercise): number =>
  countsAsTrained(logged) ? logged.sets.reduce((sum, set) => sum + setVolume(set), 0) : 0;

export const workoutVolume = (workout: Workout): number =>
  workout.exercises.reduce((sum, logged) => sum + exerciseVolume(logged), 0);

export const workoutSetCount = (workout: Workout): number =>
  workout.exercises.reduce(
    (sum, logged) => sum + (countsAsTrained(logged) ? logged.sets.filter(countsAsWork).length : 0),
    0,
  );

/**
 * Uebungen, die zuletzt tatsaechlich trainiert wurden - juengste zuerst.
 *
 * Die meisten Leute benutzen zwanzig bis dreissig Uebungen und suchen sie
 * trotzdem jedes Mal im ganzen Katalog. Gezaehlt werden nur gearbeitete
 * Saetze: Was einmal aus Versehen hinzugefuegt und nie ausgefuehrt wurde,
 * gehoert nicht nach oben.
 */
export function recentExerciseIds(state: AppState, limit = 12): ID[] {
  const seen: ID[] = [];
  const known = new Set<ID>();
  const byDate = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date));

  for (const workout of byDate) {
    for (const logged of workout.exercises) {
      if (known.has(logged.exerciseId)) continue;
      if (!logged.sets.some(countsAsWork)) continue;
      known.add(logged.exerciseId);
      seen.push(logged.exerciseId);
      if (seen.length >= limit) return seen;
    }
  }
  return seen;
}

/** Geschaetztes Ein-Wiederholungs-Maximum nach Epley. */
export function estimate1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface ExerciseSession {
  date: string;
  workoutId: ID;
  sets: SetLog[];
  volume: number;
  /** Schwerster gearbeiteter Satz. */
  topSet: SetLog | null;
  maxWeight: number;
  best1RM: number;
  totalReps: number;
  maxReps: number;
  bestDurationSec: number;
  bestDistanceKm: number;
}

/** Alle Trainingseinheiten einer Uebung, aufsteigend nach Datum. */
export function exerciseHistory(state: AppState, exerciseId: ID): ExerciseSession[] {
  return historyOf(state, (id) => id === exerciseId);
}

/**
 * Wie exerciseHistory, aber ueber mehrere Uebungen hinweg - fuer die
 * Spielarten einer Bewegung. Wer flach, schraeg und mit Kurzhanteln
 * bankdrueckt, hat drei Verlaeufe mit je wenigen Punkten und keinen, der
 * etwas zeigt.
 */
export function familyHistory(state: AppState, exerciseIds: Set<ID>): ExerciseSession[] {
  return historyOf(state, (id) => exerciseIds.has(id));
}

function historyOf(state: AppState, matches: (id: ID) => boolean): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];

  for (const workout of state.workouts) {
    for (const logged of workout.exercises) {
      if (!matches(logged.exerciseId)) continue;
      if (logged.skipped) continue;
      const sets = logged.sets.filter((set) => set.done && !set.forPartner && !set.skipped);
      if (sets.length === 0) continue;

      const working = sets.filter((set) => !set.isWarmup);
      const pool = working.length > 0 ? working : sets;

      let topSet: SetLog | null = null;
      let best1RM = 0;
      for (const set of pool) {
        const oneRm = estimate1RM(set.weightKg ?? 0, set.reps ?? 0);
        if (oneRm > best1RM) { best1RM = oneRm; topSet = set; }
      }
      if (!topSet) topSet = pool[0] ?? null;

      sessions.push({
        date: workout.date,
        workoutId: workout.id,
        sets: pool,
        volume: exerciseVolume(logged),
        topSet,
        maxWeight: Math.max(0, ...pool.map((set) => set.weightKg ?? 0)),
        best1RM,
        totalReps: pool.reduce((sum, set) => sum + (set.reps ?? 0), 0),
        maxReps: Math.max(0, ...pool.map((set) => set.reps ?? 0)),
        bestDurationSec: Math.max(0, ...pool.map((set) => set.durationSec ?? 0)),
        bestDistanceKm: Math.max(0, ...pool.map((set) => set.distanceKm ?? 0)),
      });
    }
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}

export interface LastPerformance {
  date: string;
  sets: SetLog[];
  volume: number;
  maxWeight: number;
  best1RM: number;
  /** Aenderung des Volumens gegenueber der Einheit davor, in Prozent. */
  volumeChangePct: number | null;
}

/** Die letzte absolvierte Einheit einer Uebung - optional vor einem Stichtag. */
export function lastPerformance(
  state: AppState,
  exerciseId: ID,
  beforeDate?: string,
): LastPerformance | null {
  const history = exerciseHistory(state, exerciseId).filter(
    (session) => !beforeDate || session.date < beforeDate,
  );
  const last = history[history.length - 1];
  if (!last) return null;
  const previous = history[history.length - 2];
  const volumeChangePct =
    previous && previous.volume > 0
      ? ((last.volume - previous.volume) / previous.volume) * 100
      : null;

  return {
    date: last.date,
    sets: last.sets,
    volume: last.volume,
    maxWeight: last.maxWeight,
    best1RM: last.best1RM,
    volumeChangePct,
  };
}

export interface PersonalRecords {
  maxWeight: { value: number; date: string; reps: number } | null;
  best1RM: { value: number; date: string } | null;
  maxVolume: { value: number; date: string } | null;
  maxReps: { value: number; date: string } | null;
  maxDurationSec: { value: number; date: string } | null;
  totalSessions: number;
  totalSets: number;
  totalVolume: number;
}

export function personalRecords(state: AppState, exerciseId: ID): PersonalRecords {
  const history = exerciseHistory(state, exerciseId);
  const records: PersonalRecords = {
    maxWeight: null, best1RM: null, maxVolume: null, maxReps: null, maxDurationSec: null,
    totalSessions: history.length, totalSets: 0, totalVolume: 0,
  };

  for (const session of history) {
    records.totalSets += session.sets.length;
    records.totalVolume += session.volume;

    for (const set of session.sets) {
      const weight = set.weightKg ?? 0;
      if (weight > 0 && (!records.maxWeight || weight > records.maxWeight.value)) {
        records.maxWeight = { value: weight, date: session.date, reps: set.reps ?? 0 };
      }
      const reps = set.reps ?? 0;
      if (reps > 0 && (!records.maxReps || reps > records.maxReps.value)) {
        records.maxReps = { value: reps, date: session.date };
      }
      const duration = set.durationSec ?? 0;
      if (duration > 0 && (!records.maxDurationSec || duration > records.maxDurationSec.value)) {
        records.maxDurationSec = { value: duration, date: session.date };
      }
    }
    if (session.best1RM > 0 && (!records.best1RM || session.best1RM > records.best1RM.value)) {
      records.best1RM = { value: session.best1RM, date: session.date };
    }
    if (session.volume > 0 && (!records.maxVolume || session.volume > records.maxVolume.value)) {
      records.maxVolume = { value: session.volume, date: session.date };
    }
  }

  return records;
}

export interface WeeklySummary {
  key: string;
  workouts: number;
  volume: number;
  sets: number;
}

export function weeklySummaries(state: AppState, weeks = 12): WeeklySummary[] {
  const map = new Map<string, WeeklySummary>();
  for (const workout of state.workouts) {
    const sets = workoutSetCount(workout);
    if (sets === 0) continue;
    const key = weekKey(workout.date);
    const entry = map.get(key) ?? { key, workouts: 0, volume: 0, sets: 0 };
    entry.workouts += 1;
    entry.volume += workoutVolume(workout);
    entry.sets += sets;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-weeks);
}

/** Trainingsvolumen je Muskelgruppe (Kategorie) im gegebenen Zeitraum. */
export function volumeByCategory(
  state: AppState,
  getCategory: (id: ID) => string,
  sinceDate: string,
): Array<{ category: string; sets: number; volume: number }> {
  const map = new Map<string, { category: string; sets: number; volume: number }>();
  for (const workout of state.workouts) {
    if (workout.date < sinceDate) continue;
    for (const logged of workout.exercises) {
      const category = getCategory(logged.exerciseId);
      const entry = map.get(category) ?? { category, sets: 0, volume: 0 };
      entry.sets += logged.sets.filter(countsAsWork).length;
      entry.volume += exerciseVolume(logged);
      map.set(category, entry);
    }
  }
  return [...map.values()].filter((entry) => entry.sets > 0).sort((a, b) => b.sets - a.sets);
}

/**
 * Trainings-Serie in Wochen: wie viele Kalenderwochen in Folge mindestens
 * einmal trainiert wurde. Das passt besser zu einem Wochenplan als Tage,
 * bei denen Ruhetage die Serie sofort reissen wuerden.
 */
export function streakInfo(state: AppState): { current: number; longest: number; total: number } {
  const trainedDates = [...new Set(
    state.workouts.filter((workout) => workoutSetCount(workout) > 0).map((workout) => workout.date),
  )].sort();

  const weeks = [...new Set(trainedDates.map(weekKey))].sort();

  let longest = 0;
  let run = 0;
  let previous: string | null = null;

  for (const week of weeks) {
    run = previous && isNextWeek(previous, week) ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = week;
  }

  // Die Serie laeuft weiter, solange diese oder die vergangene Woche dabei ist.
  const thisWeek = weekKey(new Date().toISOString().slice(0, 10));
  const lastWeek = weekKey(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const current = previous === thisWeek || previous === lastWeek ? run : 0;

  return { current, longest, total: trainedDates.length };
}

/** Prueft, ob "next" die unmittelbar folgende Kalenderwoche von "week" ist. */
function isNextWeek(week: string, next: string): boolean {
  const [yearA, weekA] = week.split('-KW').map(Number);
  const [yearB, weekB] = next.split('-KW').map(Number);
  if (yearA === yearB) return weekB === weekA + 1;
  // Jahreswechsel: KW 52/53 gefolgt von KW 1.
  return yearB === yearA + 1 && weekB === 1 && weekA >= 52;
}

/* -------------------------------------------------------------- Rueckblick */

export interface PeriodSummary {
  label: string;
  workouts: number;
  sets: number;
  volume: number;
  minutes: number;
}

export interface Review {
  current: PeriodSummary;
  previous: PeriodSummary;
  /** Uebungen, bei denen im Zeitraum ein neuer Bestwert stand. */
  records: Array<{ name: string; value: string; date: string }>;
  /** Meistgenutzte Muskelgruppen im Zeitraum. */
  focus: Array<{ category: string; sets: number }>;
}

const summarize = (workouts: Workout[], label: string): PeriodSummary => ({
  label,
  workouts: workouts.length,
  sets: workouts.reduce((sum, workout) => sum + workoutSetCount(workout), 0),
  volume: workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0),
  minutes: workouts.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0),
});

/**
 * Stellt einen Zeitraum dem gleich langen davor gegenueber und sammelt die
 * Bestleistungen, die in dieser Zeit aufgestellt wurden.
 */
export function buildReview(
  state: AppState,
  fromDate: string,
  toDate: string,
  previousFrom: string,
  /* Ein Nachschlagen statt drei Rueckrufe - Name, Kategorie und Art kommen
   * alle aus derselben Uebung. */
  lookup: (id: ID) => Exercise | undefined,
): Review {
  const done = state.workouts.filter((workout) => workoutSetCount(workout) > 0);
  const current = done.filter((workout) => workout.date >= fromDate && workout.date <= toDate);
  const previous = done.filter((workout) => workout.date >= previousFrom && workout.date < fromDate);

  // Bestwerte: je Uebung pruefen, ob der Hoehepunkt im Zeitraum liegt.
  const records: Review['records'] = [];
  const exerciseIds = new Set<ID>();
  for (const workout of current) {
    for (const logged of workout.exercises) exerciseIds.add(logged.exerciseId);
  }
  for (const id of exerciseIds) {
    const best = personalRecords(state, id);
    const peak = best.maxWeight ?? null;
    if (peak && peak.date >= fromDate && peak.date <= toDate) {
      records.push({
        name: lookup(id)?.name ?? 'Übung',
        value: formatSet(peak.value, peak.reps, lookup(id)?.kind),
        date: peak.date,
      });
    }
  }
  records.sort((a, b) => b.date.localeCompare(a.date));

  const focusMap = new Map<string, number>();
  for (const workout of current) {
    for (const logged of workout.exercises) {
      const category = (lookup(logged.exerciseId)?.category ?? 'other');
      const sets = logged.sets.filter(countsAsWork).length;
      if (sets > 0) focusMap.set(category, (focusMap.get(category) ?? 0) + sets);
    }
  }

  return {
    current: summarize(current, 'Zeitraum'),
    previous: summarize(previous, 'davor'),
    records: records.slice(0, 6),
    focus: [...focusMap.entries()]
      .map(([category, sets]) => ({ category, sets }))
      .sort((a, b) => b.sets - a.sets),
  };
}

/* -------------------------------------------------- Wochentags-Muster */

export interface WeekdayCount {
  /** 0 = Montag ... 6 = Sonntag. */
  weekday: number;
  workouts: number;
  sets: number;
}

/**
 * An welchem Wochentag wird trainiert, an welchem faellt es aus.
 *
 * Nur Tage mit gearbeiteten Saetzen zaehlen. Wer sonntags immer eintraegt, aber
 * nie abhakt, trainiert sonntags nicht.
 */
export function weekdayPattern(state: AppState, sinceDate?: string): WeekdayCount[] {
  const counts: WeekdayCount[] = Array.from({ length: 7 }, (_, weekday) => ({
    weekday, workouts: 0, sets: 0,
  }));
  for (const workout of state.workouts) {
    if (sinceDate && workout.date < sinceDate) continue;
    const sets = workoutSetCount(workout);
    if (sets === 0) continue;
    const weekday = (parseISODate(workout.date).getDay() + 6) % 7;
    counts[weekday].workouts += 1;
    counts[weekday].sets += sets;
  }
  return counts;
}

/* --------------------------------------------- Bestleistungen, alle Uebungen */

export interface AllTimeRecord {
  exerciseId: ID;
  name: string;
  kind?: Exercise['kind'];
  /** Bestwert als lesbarer Text, z. B. "100 kg × 5" oder "1:30". */
  best: string;
  /** Zahl fuer die Sortierung: 1RM, sonst Dauer, sonst Wiederholungen. */
  score: number;
  date: string;
  sessions: number;
}

/**
 * Die Bestleistung jeder Uebung, mit Verlauf, auf einer Liste - statt je Uebung
 * verstreut. Sortiert nach dem geschaetzten Maximum, damit die schweren
 * Bewegungen oben stehen.
 */
export function allTimeRecords(
  state: AppState,
  lookup: (id: ID) => Exercise | undefined,
): AllTimeRecord[] {
  const ids = new Set<ID>();
  for (const workout of state.workouts) {
    for (const logged of workout.exercises) {
      if (logged.sets.some(countsAsWork)) ids.add(logged.exerciseId);
    }
  }

  const rows: AllTimeRecord[] = [];
  for (const id of ids) {
    const records = personalRecords(state, id);
    if (records.totalSessions === 0) continue;
    const exercise = lookup(id);
    let best = '';
    let score = 0;
    if (records.best1RM) {
      best = `1RM ≈ ${fmtKg(records.best1RM.value)}`;
      score = records.best1RM.value;
      if (records.maxWeight) best = formatSet(records.maxWeight.value, records.maxWeight.reps, exercise?.kind);
    } else if (records.maxDurationSec) {
      const seconds = records.maxDurationSec.value;
      best = seconds >= 60 ? `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}` : `${seconds} s`;
      score = seconds;
    } else if (records.maxReps) {
      best = `${records.maxReps.value} Wdh`;
      score = records.maxReps.value;
    } else {
      continue;
    }
    rows.push({
      exerciseId: id,
      name: exercise?.name ?? 'Übung',
      kind: exercise?.kind,
      best,
      score,
      date: records.best1RM?.date ?? records.maxDurationSec?.date ?? records.maxReps?.date ?? '',
      sessions: records.totalSessions,
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}

const fmtKg = (value: number): string =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: value % 1 === 0 ? 0 : 1 })} kg`;

/* ----------------------------------------------------------- Jahresrückblick */

export interface YearReview {
  year: number;
  workouts: number;
  sets: number;
  volume: number;
  minutes: number;
  activeWeeks: number;
  bestStreakWeeks: number;
  topExercise: { name: string; sessions: number } | null;
  topCategory: { category: string; sets: number } | null;
  records: number;
  heaviestLift: { name: string; value: string; date: string } | null;
}

/** Die Zahlen eines Kalenderjahres auf einen Blick. */
export function yearReview(
  state: AppState,
  year: number,
  lookup: (id: ID) => Exercise | undefined,
): YearReview {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const workouts = state.workouts.filter(
    (workout) => workout.date >= from && workout.date <= to && workoutSetCount(workout) > 0,
  );

  const sessionsByExercise = new Map<ID, number>();
  const setsByCategory = new Map<string, number>();
  let heaviest: { name: string; value: number; reps: number; date: string; kind?: Exercise['kind'] } | null = null;

  for (const workout of workouts) {
    for (const logged of workout.exercises) {
      const working = logged.sets.filter(countsAsWork);
      if (working.length === 0) continue;
      sessionsByExercise.set(logged.exerciseId, (sessionsByExercise.get(logged.exerciseId) ?? 0) + 1);
      const category = lookup(logged.exerciseId)?.category ?? 'other';
      setsByCategory.set(category, (setsByCategory.get(category) ?? 0) + working.length);
      for (const set of working) {
        const weight = set.weightKg ?? 0;
        if (weight > 0 && (!heaviest || weight > heaviest.value)) {
          heaviest = {
            name: lookup(logged.exerciseId)?.name ?? 'Übung',
            value: weight,
            reps: set.reps ?? 0,
            date: workout.date,
            kind: lookup(logged.exerciseId)?.kind,
          };
        }
      }
    }
  }

  const weeks = new Set(workouts.map((workout) => weekKey(workout.date)));
  let bestRun = 0;
  let run = 0;
  let previous: string | null = null;
  for (const week of [...weeks].sort()) {
    const [ya, wa] = week.split('-KW').map(Number);
    const cont = previous
      && (() => { const [yb, wb] = previous!.split('-KW').map(Number); return ya === yb ? wa === wb + 1 : (ya === yb + 1 && wa === 1); })();
    run = cont ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
    previous = week;
  }

  const topExerciseEntry = [...sessionsByExercise.entries()].sort((a, b) => b[1] - a[1])[0];
  const topCategoryEntry = [...setsByCategory.entries()].sort((a, b) => b[1] - a[1])[0];

  let records = 0;
  for (const id of sessionsByExercise.keys()) {
    const best = personalRecords(state, id).maxWeight;
    if (best && best.date >= from && best.date <= to) records += 1;
  }

  return {
    year,
    workouts: workouts.length,
    sets: workouts.reduce((sum, workout) => sum + workoutSetCount(workout), 0),
    volume: workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0),
    minutes: workouts.reduce((sum, workout) => sum + (workout.durationMin ?? 0), 0),
    activeWeeks: weeks.size,
    bestStreakWeeks: bestRun,
    topExercise: topExerciseEntry
      ? { name: lookup(topExerciseEntry[0])?.name ?? 'Übung', sessions: topExerciseEntry[1] }
      : null,
    topCategory: topCategoryEntry
      ? { category: topCategoryEntry[0], sets: topCategoryEntry[1] }
      : null,
    records,
    heaviestLift: heaviest
      ? { name: heaviest.name, value: formatSet(heaviest.value, heaviest.reps, heaviest.kind), date: heaviest.date }
      : null,
  };
}

/* ------------------------------------------ Muskelgruppen im Zeitverlauf */

export interface CategoryTrendPoint {
  week: string;
  /** Saetze je Muskelgruppe in dieser Woche. */
  byCategory: Record<string, number>;
}

/** Wie sich die Saetze je Muskelgruppe ueber die Wochen verteilen. */
export function categoryTrend(
  state: AppState,
  getCategory: (id: ID) => string,
  weeks = 12,
): CategoryTrendPoint[] {
  const map = new Map<string, Record<string, number>>();

  for (const workout of state.workouts) {
    if (workoutSetCount(workout) === 0) continue;
    const key = weekKey(workout.date);
    const bucket = map.get(key) ?? {};
    for (const logged of workout.exercises) {
      const category = getCategory(logged.exerciseId);
      const sets = logged.sets.filter(countsAsWork).length;
      if (sets > 0) bucket[category] = (bucket[category] ?? 0) + sets;
    }
    map.set(key, bucket);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-weeks)
    .map(([week, byCategory]) => ({ week, byCategory }));
}
