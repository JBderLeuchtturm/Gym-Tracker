import { exerciseName, t } from '../i18n';
import type { AppState, Exercise, LoggedExercise, PlanExercise, SetLog, Todo, TodoColor } from '../types';
import { WEEKDAY_SHORT, addDays, startOfWeek, toISODate, weekdayOf } from './date';
import { countsAsWork } from './stats';
import { resolveTracking, setText, targetText } from './tracking';
import { goalMeters, hasOwnGoals, meterParts, weekProgress, type WeekProgress } from './weeklyGoals';
import { bucketOf, categoryById, dueKey } from './todos';

/*
 * Was die Widgets auf dem Startbildschirm zeigen.
 *
 * Die App rechnet hier alles vor und gibt es als JSON an die Widgets weiter
 * (android/.../widgets). Die Widgets suchen sich nur noch den Eintrag fuer
 * heute heraus. Deshalb stehen die naechsten sieben Tage und die naechste
 * Woche schon mit drin: Wer die App am Abend schliesst, sieht am Morgen
 * trotzdem den richtigen Trainingstag - ohne dass die App dafuer laeuft.
 *
 * Alle Texte sind hier schon in der Sprache der App; das Widget uebersetzt
 * nichts selbst.
 */

export interface WidgetDay {
  title: string;
  rest: boolean;
  done: number;
  planned: number;
  next: string;
  detail: string;
  /** Wohin ein Tipp fuehrt: Fokus-Ansicht, wenn noch etwas offen ist. */
  target: 'focus' | 'today';
}

export interface WidgetMeter {
  label: string;
  text: string;
  ratio: number;
  done: boolean;
}

export interface WidgetTodo {
  title: string;
  meta: string;
  /** Kategorienfarbe fuer dunkles und helles Widget. */
  color: string;
  colorLight: string;
}

export interface WidgetTodoDay {
  count: number;
  items: WidgetTodo[];
}

export interface WidgetSnapshot {
  v: 1;
  generatedAt: string;
  labels: Record<string, string>;
  days: Record<string, WidgetDay>;
  weeks: Record<string, WidgetMeter[]>;
  todos: Record<string, WidgetTodoDay>;
}

/** So viele Tage rechnet die App voraus. */
export const WIDGET_DAYS = 7;
/** So viele Aufgaben passen ins Widget. */
export const WIDGET_TODOS = 5;

/**
 * Die acht Kategorienfarben der Aufgaben - dieselben Werte wie --todo-cat-1
 * bis -8 in styles.css (dunkel und hell). Ein Widget kennt kein CSS; ein
 * Test haelt beide Listen gleich (tests/unit.spec.ts).
 */
export const TODO_COLORS_DARK: Record<TodoColor, string> = {
  1: '#599b5c', 2: '#578bcd', 3: '#af7f2a', 4: '#079e92',
  5: '#c36f52', 6: '#9976c1', 7: '#9a8a2a', 8: '#c06a89',
};
export const TODO_COLORS_LIGHT: Record<TodoColor, string> = {
  1: '#478d4b', 2: '#467cc0', 3: '#a17003', 4: '#0c9084',
  5: '#b55f40', 6: '#8b66b3', 7: '#8b7b02', 8: '#b1597a',
};
const NO_CATEGORY = { dark: '#9a968e', light: '#5a564e' };

interface DayRow {
  exercise: Exercise | undefined;
  planExercise?: PlanExercise;
  logged?: LoggedExercise;
  target: number;
  done: number;
}

/** Die Zeilen eines Tages - wie auf der Trainingsseite: Plan zuerst, dann Dazugenommenes. */
function rowsFor(
  state: AppState,
  getExercise: (id: string) => Exercise | undefined,
  date: string,
): DayRow[] {
  const plan = state.plans.find((item) => item.id === state.activePlanId);
  const planDay = plan?.days[weekdayOf(date)];
  const workout = state.workouts.find((item) => item.date === date);
  const used = new Set<string>();
  const rows: DayRow[] = [];

  if (planDay && !planDay.isRestDay) {
    for (const planExercise of planDay.exercises) {
      const logged = workout?.exercises.find((item) => !used.has(item.id)
        && (item.planExerciseId === planExercise.id || item.exerciseId === planExercise.exerciseId));
      if (logged) used.add(logged.id);
      if (logged?.skipped) continue;
      const done = logged ? logged.sets.filter(countsAsWork).length : 0;
      rows.push({
        exercise: getExercise(planExercise.exerciseId),
        planExercise,
        logged,
        target: Math.max(planExercise.targetSets || 1, done),
        done,
      });
    }
  }
  for (const logged of workout?.exercises ?? []) {
    if (used.has(logged.id) || logged.skipped) continue;
    const done = logged.sets.filter(countsAsWork).length;
    const working = logged.sets.filter((set) => !set.isWarmup && !set.skipped).length;
    rows.push({ exercise: getExercise(logged.exerciseId), logged, target: Math.max(working, done), done });
  }

  const order = workout?.exerciseOrder;
  if (order && order.length > 0) {
    const rank = new Map(order.map((id, index) => [id, index]));
    rows.sort((a, b) => (rank.get(a.exercise?.id ?? '') ?? 999) - (rank.get(b.exercise?.id ?? '') ?? 999));
  }
  return rows;
}

const hasValues = (set: SetLog | undefined): set is SetLog =>
  Boolean(set && (set.weightKg != null || set.reps != null || set.durationSec != null || set.distanceKm != null));

function dayEntry(
  state: AppState,
  getExercise: (id: string) => Exercise | undefined,
  date: string,
): WidgetDay {
  const plan = state.plans.find((item) => item.id === state.activePlanId);
  const planDay = plan?.days[weekdayOf(date)];
  const workout = state.workouts.find((item) => item.date === date);
  const rows = rowsFor(state, getExercise, date);

  if (rows.length === 0) {
    // Ruhetag (oder kein Plan): Wann geht es weiter?
    let hint = '';
    for (let step = 1; step <= 7 && plan; step += 1) {
      const next = addDays(date, step);
      const day = plan.days[weekdayOf(next)];
      if (day && !day.isRestDay && day.exercises.length > 0) {
        hint = t('Nächstes Training: {day} · {title}', { day: t(WEEKDAY_SHORT[weekdayOf(next)]), title: t(day.title) });
        break;
      }
    }
    return {
      title: plan ? t('Ruhetag') : t('Kein Plan aktiv'),
      rest: true,
      done: 0,
      planned: 0,
      next: hint,
      detail: '',
      target: 'today',
    };
  }

  const done = rows.reduce((sum, row) => sum + row.done, 0);
  const planned = rows.reduce((sum, row) => sum + row.target, 0);
  const title = planDay && !planDay.isRestDay ? t(planDay.title) : (workout?.title || t('Freies Training'));
  const open = rows.find((row) => row.done < row.target);

  if (!open) {
    return { title, rest: false, done, planned, next: t('Alle Sätze geschafft'), detail: '', target: 'today' };
  }

  const tracking = resolveTracking(open.exercise, open.planExercise, open.logged);
  const working = open.logged?.sets.filter((set) => !set.isWarmup && !set.skipped) ?? [];
  const upcoming = working.find((set) => !set.done);
  const what = hasValues(upcoming)
    ? setText(upcoming, tracking, open.exercise?.kind)
    : open.planExercise ? targetText(open.planExercise, tracking) : '';
  const setLabel = t('Satz {n} von {total}', { n: open.done + 1, total: open.target });

  return {
    title,
    rest: false,
    done,
    planned,
    next: exerciseName(open.exercise),
    detail: what ? `${setLabel} · ${what}` : setLabel,
    target: 'focus',
  };
}

const EMPTY_WEEK: WeekProgress = { trainingDays: 0, volumeKg: 0, minutes: 0, regions: new Map() };

function weekEntry(state: AppState, progress: WeekProgress): WidgetMeter[] {
  const { weeklyGoals, weeklySetTargets } = state.settings;
  if (!hasOwnGoals(weeklyGoals, weeklySetTargets)) return [];
  return goalMeters(progress, weeklyGoals, weeklySetTargets).map((meter) => ({
    label: t(meter.label),
    text: meterParts(meter).join(' / '),
    ratio: Math.round(meter.ratio * 1000) / 1000,
    done: meter.ratio >= 1,
  }));
}

function todoEntry(state: AppState, date: string): WidgetTodoDay {
  const due = state.todos.filter((todo) => {
    if (todo.done) return false;
    const bucket = bucketOf(todo, date);
    return bucket === 'overdue' || bucket === 'today';
  });
  const overdue = (todo: Todo) => bucketOf(todo, date) === 'overdue';
  due.sort((a, b) => Number(overdue(b)) - Number(overdue(a)) || dueKey(a).localeCompare(dueKey(b)));

  return {
    count: due.length,
    items: due.slice(0, WIDGET_TODOS).map((todo) => {
      const category = categoryById(state.todoCategories, todo.categoryId);
      return {
        title: todo.title,
        meta: todo.dueTime ?? (overdue(todo) ? t('überfällig') : ''),
        color: category ? TODO_COLORS_DARK[category.color] : NO_CATEGORY.dark,
        colorLight: category ? TODO_COLORS_LIGHT[category.color] : NO_CATEGORY.light,
      };
    }),
  };
}

/** Der ganze Stand fuer die Widgets, ab `now` fuer eine Woche im Voraus. */
export function buildWidgetSnapshot(
  state: AppState,
  getExercise: (id: string) => Exercise | undefined,
  now: Date = new Date(),
): WidgetSnapshot {
  const today = toISODate(now);
  const days: Record<string, WidgetDay> = {};
  const todos: Record<string, WidgetTodoDay> = {};
  for (let step = 0; step < WIDGET_DAYS; step += 1) {
    const date = addDays(today, step);
    days[date] = dayEntry(state, getExercise, date);
    todos[date] = todoEntry(state, date);
  }

  const monday = startOfWeek(today);
  const weeks: Record<string, WidgetMeter[]> = {
    [monday]: weekEntry(state, weekProgress(state, getExercise, monday)),
    // Die naechste Woche beginnt bei null - mit denselben Zielen.
    [addDays(monday, 7)]: weekEntry(state, EMPTY_WEEK),
  };

  return {
    v: 1,
    generatedAt: now.toISOString(),
    labels: {
      today: t('Heute'),
      goals: t('Wochenziele'),
      todos: t('To-dos heute'),
      noGoals: t('Wochenziele festlegen'),
      noTodos: t('Nichts mehr für heute'),
      more: t('+{n} weitere'),
      openApp: t('Einmal die App öffnen'),
    },
    days,
    weeks,
    todos,
  };
}
