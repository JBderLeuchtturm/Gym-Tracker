import { t } from '../i18n';
import type {
  ID, Todo, TodoCategory, TodoColor, TodoPriority, TodoRepeat, TodoScope, TodoStep,
} from '../types';
import {
  addDays, formatDateLong, formatDateTiny, locale, parseISODate, startOfWeek, todayISO, weekKey,
} from './date';
import { uid } from '../storage/defaults';

/*
 * Alles, was die Aufgabenliste rechnet - ohne React, ohne Speicher.
 *
 * Die Seite selbst soll nur noch anzeigen und weiterreichen. Was ein Zeitraum
 * ist, wann etwas ueberfaellig wird und in welcher Reihenfolge Aufgaben stehen,
 * steht hier und laesst sich einzeln pruefen.
 */

/* --------------------------------------------------------------- Zeitraeume */

export const TODO_SCOPES: TodoScope[] = ['day', 'week', 'month', 'year', 'someday'];

/** Kurzform fuer die Umschalter. */
export const SCOPE_LABELS: Record<TodoScope, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
  someday: 'Später',
};

/** Ausgeschrieben - fuer Auswahllisten, wo mehr Platz ist. */
export const SCOPE_NAMES: Record<TodoScope, string> = {
  day: 'An einem Tag',
  week: 'In dieser Woche',
  month: 'In diesem Monat',
  year: 'In diesem Jahr',
  someday: 'Irgendwann',
};

/**
 * Der Zeitraum, in dem ein Datum liegt - als Datum seines ersten Tages.
 *
 * Das ist der Schluessel, unter dem eine Aufgabe abgelegt wird: Alle Aufgaben
 * derselben Woche tragen denselben Montag, alle desselben Monats denselben
 * Ersten. Damit ist "gehoert in diesen Zeitraum" ein Zeichenkettenvergleich
 * und keine Datumsrechnerei.
 */
export function periodOf(scope: TodoScope, iso: string): string | null {
  switch (scope) {
    case 'day': return iso;
    case 'week': return startOfWeek(iso);
    case 'month': return `${iso.slice(0, 7)}-01`;
    case 'year': return `${iso.slice(0, 4)}-01-01`;
    default: return null;
  }
}

/** Der letzte Tag eines Zeitraums - fuer "ist das vorbei?". */
export function periodEnd(scope: TodoScope, period: string): string {
  switch (scope) {
    case 'day': return period;
    case 'week': return addDays(period, 6);
    case 'month': {
      const date = parseISODate(period);
      // Der 0. des Folgemonats ist dessen letzter Tag.
      const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return `${period.slice(0, 7)}-${`${last.getDate()}`.padStart(2, '0')}`;
    }
    case 'year': return `${period.slice(0, 4)}-12-31`;
    default: return period;
  }
}

/** Einen Zeitraum vor oder zurueck. */
export function shiftPeriod(scope: TodoScope, period: string, step: number): string {
  switch (scope) {
    case 'day': return addDays(period, step);
    case 'week': return addDays(period, step * 7);
    case 'month': {
      const date = parseISODate(period);
      const moved = new Date(date.getFullYear(), date.getMonth() + step, 1);
      return `${moved.getFullYear()}-${`${moved.getMonth() + 1}`.padStart(2, '0')}-01`;
    }
    case 'year': return `${Number(period.slice(0, 4)) + step}-01-01`;
    default: return period;
  }
}

/**
 * Wie ein Zeitraum heisst.
 *
 * "Heute", "Diese Woche", "Dieser Monat" statt des Datums, wo es zutrifft -
 * ein Datum ist richtig, aber man muss es erst mit dem heutigen vergleichen,
 * um zu wissen, ob man gerade in der Gegenwart steht.
 */
export function periodLabel(scope: TodoScope, period: string | null, today = todayISO()): string {
  if (scope === 'someday' || !period) return t('Irgendwann');
  const current = periodOf(scope, today);
  const previous = shiftPeriod(scope, current ?? period, -1);
  const next = shiftPeriod(scope, current ?? period, 1);

  if (period === current) {
    return { day: t('Heute'), week: t('Diese Woche'), month: t('Dieser Monat'), year: t('Dieses Jahr'), someday: '' }[scope];
  }
  if (period === previous) {
    return { day: t('Gestern'), week: t('Letzte Woche'), month: t('Letzter Monat'), year: t('Letztes Jahr'), someday: '' }[scope];
  }
  if (period === next) {
    return { day: t('Morgen'), week: t('Nächste Woche'), month: t('Nächster Monat'), year: t('Nächstes Jahr'), someday: '' }[scope];
  }
  return periodDate(scope, period);
}

/** Der Zeitraum als Datum ausgeschrieben - immer, unabhaengig von heute. */
export function periodDate(scope: TodoScope, period: string | null): string {
  if (scope === 'someday' || !period) return t('Ohne festen Zeitpunkt');
  switch (scope) {
    case 'day': return formatDateLong(period);
    case 'week':
      return `${weekKey(period).replace('-KW', ' · KW ')} · ${formatDateTiny(period)}–${formatDateTiny(addDays(period, 6))}`;
    case 'month':
      return parseISODate(period).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
    default: return period.slice(0, 4);
  }
}

/* ------------------------------------------------------------ Eigenschaften */

export const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: 'Hoch',
  normal: 'Normal',
  low: 'Niedrig',
};

const PRIORITY_RANK: Record<TodoPriority, number> = { high: 0, normal: 1, low: 2 };

export const REPEAT_LABELS: Record<TodoRepeat['every'], string> = {
  day: 'Täglich',
  week: 'Wöchentlich',
  month: 'Monatlich',
  year: 'Jährlich',
};

/** Anteil erledigter Teilschritte - null, wenn es keine gibt. */
export function stepProgress(todo: Todo): { done: number; total: number; ratio: number } | null {
  const total = todo.steps.length;
  if (total === 0) return null;
  const done = todo.steps.filter((step) => step.done).length;
  return { done, total, ratio: done / total };
}

/**
 * Halb erledigt: Teilschritte abgehakt, die Aufgabe selbst aber noch offen.
 *
 * Das ist der Zustand, den eine Hakenliste sonst verschweigt - zwischen "noch
 * nichts getan" und "fertig" liegt bei den meisten Aufgaben die eigentliche
 * Arbeit.
 */
export const isPartlyDone = (todo: Todo): boolean => {
  const progress = stepProgress(todo);
  return !todo.done && progress !== null && progress.done > 0;
};

/**
 * Ueberfaellig: Der Zeitraum ist vorbei und die Aufgabe steht noch offen.
 *
 * Aufgaben ohne festen Zeitpunkt werden nie ueberfaellig - sie sind
 * ausdruecklich nicht terminiert, und eine Mahnung fuer etwas, das man sich
 * nie vorgenommen hat, ist nur Laerm.
 */
export function isOverdue(todo: Todo, today = todayISO()): boolean {
  if (todo.done || todo.scope === 'someday' || !todo.period) return false;
  return periodEnd(todo.scope, todo.period) < today;
}

/** Wie viele Tage ein Zeitraum schon vorbei ist. */
export function overdueDays(todo: Todo, today = todayISO()): number {
  if (!isOverdue(todo, today) || !todo.period) return 0;
  const end = parseISODate(periodEnd(todo.scope, todo.period)).getTime();
  return Math.max(1, Math.round((parseISODate(today).getTime() - end) / 86400000));
}

/* --------------------------------------------------------------- Anlegen */

export function createTodo(patch: Partial<Todo> = {}): Todo {
  const now = new Date().toISOString();
  return {
    id: uid('todo'),
    title: '',
    note: '',
    categoryId: null,
    scope: 'day',
    period: todayISO(),
    priority: 'normal',
    steps: [],
    done: false,
    doneAt: null,
    repeat: null,
    streak: 0,
    doneDates: [],
    order: Date.now(),
    dueTime: null,
    remindMin: null,
    remindedOn: null,
    tags: [],
    place: '',
    exerciseId: null,
    photoIds: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export const createStep = (text: string) => ({ id: uid('step'), text, done: false });

/**
 * Was beim Abhaken geschieht.
 *
 * Eine gewoehnliche Aufgabe wird erledigt und bleibt es. Eine wiederkehrende
 * springt in ihren naechsten Zeitraum und faengt von vorn an - mit einem
 * Zaehler, der sagt, wie oft das schon geklappt hat. Sie in der Vergangenheit
 * als erledigt stehen zu lassen und eine Kopie anzulegen waere die andere
 * Moeglichkeit; sie fuellt die Liste mit Leichen, ohne mehr zu sagen.
 */
export function completeTodo(todo: Todo, now = new Date()): Partial<Todo> {
  const day = toISO(now);
  /* Jeder erledigte Tag genau einmal - zweimal abhaken ist kein zweiter Tag. */
  const doneDates = [...new Set([...(todo.doneDates ?? []), day])].sort().slice(-400);

  if (!todo.repeat || !todo.period) {
    return { done: true, doneAt: now.toISOString(), doneDates };
  }
  const scope: TodoScope = todo.scope === 'someday' ? 'day' : todo.scope;
  const steps = todo.steps.map(resetStep);
  return {
    period: repeatNext(todo.period, todo.repeat, scope),
    scope,
    steps,
    done: false,
    doneAt: now.toISOString(),
    doneDates,
    remindedOn: null,
    streak: (todo.streak ?? 0) + 1,
  };
}

const resetStep = (step: TodoStep): TodoStep => ({
  ...step,
  done: false,
  ...(step.children ? { children: step.children.map(resetStep) } : {}),
});

/** Der naechste Termin einer Wiederholung. */
export function repeatNext(period: string, repeat: TodoRepeat, scope: TodoScope): string {
  const step = Math.max(1, Math.round(repeat.interval || 1));
  const date = parseISODate(period);
  switch (repeat.every) {
    case 'day': return addDays(period, step);
    case 'week': return addDays(period, step * 7);
    case 'month': {
      const moved = new Date(date.getFullYear(), date.getMonth() + step, date.getDate());
      return periodOf(scope, toISO(moved)) ?? toISO(moved);
    }
    default: {
      const moved = new Date(date.getFullYear() + step, date.getMonth(), date.getDate());
      return periodOf(scope, toISO(moved)) ?? toISO(moved);
    }
  }
}

const toISO = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

/* ------------------------------------------------------------- Sortieren */

export type TodoSort = 'priority' | 'category' | 'manual';

export const SORT_LABELS: Record<TodoSort, string> = {
  priority: 'Priorität',
  category: 'Kategorie',
  manual: 'Reihenfolge',
};

/**
 * Sortierung innerhalb einer Gruppe.
 *
 * Halb Angefangenes steht oben: Was schon laeuft, will man zu Ende bringen,
 * bevor man Neues anfaengt. Danach die Prioritaet, danach die eigene
 * Reihenfolge.
 */
export function compareTodos(a: Todo, b: Todo, sort: TodoSort): number {
  if (sort === 'manual') return a.order - b.order;
  if (sort === 'priority' && PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }
  const partly = Number(isPartlyDone(b)) - Number(isPartlyDone(a));
  if (partly !== 0) return partly;
  return a.order - b.order;
}

export interface TodoGroup {
  key: string;
  label: string;
  /** Farbplatz der Kategorie - nur bei Gruppierung nach Kategorie. */
  color?: TodoColor;
  icon?: string;
  priority?: TodoPriority;
  todos: Todo[];
}

/** Teilt die offenen Aufgaben in die Gruppen der gewaehlten Sortierung. */
export function groupTodos(todos: Todo[], sort: TodoSort, categories: TodoCategory[]): TodoGroup[] {
  const sorted = [...todos].sort((a, b) => compareTodos(a, b, sort));
  if (sort === 'manual') {
    return sorted.length > 0 ? [{ key: 'all', label: '', todos: sorted }] : [];
  }

  if (sort === 'category') {
    const groups: TodoGroup[] = [];
    for (const category of categories) {
      const items = sorted.filter((todo) => todo.categoryId === category.id);
      if (items.length > 0) {
        groups.push({
          key: category.id, label: category.name, color: category.color, icon: category.icon, todos: items,
        });
      }
    }
    const loose = sorted.filter((todo) => !categories.some((c) => c.id === todo.categoryId));
    if (loose.length > 0) groups.push({ key: 'none', label: t('Ohne Kategorie'), todos: loose });
    return groups;
  }

  return (['high', 'normal', 'low'] as TodoPriority[])
    .map((priority) => ({
      key: priority,
      label: t(PRIORITY_LABELS[priority]),
      priority,
      todos: sorted.filter((todo) => todo.priority === priority),
    }))
    .filter((group) => group.todos.length > 0);
}

/* ---------------------------------------------------------------- Zahlen */

export interface TodoTally {
  open: number;
  done: number;
  overdue: number;
  /** Erledigte und offene zusammen - der Nenner des Fortschritts. */
  total: number;
  ratio: number;
  /** Auch angefangene Teilschritte zaehlen anteilig mit. */
  weighted: number;
}

/**
 * Der Stand eines Zeitraums.
 *
 * `weighted` ist der ehrlichere Fortschritt: Eine Aufgabe mit drei von vier
 * erledigten Teilschritten zaehlt drei Viertel, nicht null. Genau das ist der
 * Unterschied zwischen einem Balken, der einen Tag lang auf Null steht, und
 * einem, der die Arbeit zeigt, die schon drinsteckt.
 */
export function tally(todos: Todo[], today = todayISO()): TodoTally {
  let open = 0;
  let done = 0;
  let overdue = 0;
  let weighted = 0;

  for (const todo of todos) {
    if (todo.done) {
      done += 1;
      weighted += 1;
    } else {
      open += 1;
      weighted += stepProgress(todo)?.ratio ?? 0;
      if (isOverdue(todo, today)) overdue += 1;
    }
  }

  const total = open + done;
  return { open, done, overdue, total, ratio: total === 0 ? 0 : done / total, weighted };
}

/** Durchsuchen: Titel, Notiz, Teilschritte und Kategoriename. */
export function matchesSearch(todo: Todo, term: string, category?: TodoCategory): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    todo.title, todo.note, category?.name ?? '',
    ...todo.steps.map((step) => step.text),
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

/** Wie viele Aufgaben an einem Tag erledigt wurden - fuer den Wochenbalken. */
export function doneOnDay(todos: Todo[], iso: string): number {
  return todos.filter((todo) => (todo.doneAt ?? '').slice(0, 10) === iso).length;
}

/**
 * Offene Aufgaben eines vergangenen Tages - Grundlage fuer "übernehmen".
 *
 * Bewusst nur Tagesaufgaben: Eine Wochenaufgabe auf einen Tag zu schieben
 * waere eine andere Entscheidung als "das steht immer noch an".
 */
export function carryOverCandidates(todos: Todo[], today = todayISO()): Todo[] {
  return todos.filter((todo) =>
    !todo.done && todo.scope === 'day' && todo.period !== null && todo.period < today);
}

export const categoryById = (categories: TodoCategory[], id: ID | null): TodoCategory | undefined =>
  (id ? categories.find((category) => category.id === id) : undefined);

/** Der naechste freie Farbplatz - damit zwei neue Kategorien nicht gleich aussehen. */
export function nextColor(categories: TodoCategory[]): TodoColor {
  const used = new Set(categories.map((category) => category.color));
  for (let slot = 1; slot <= 8; slot += 1) {
    if (!used.has(slot as TodoColor)) return slot as TodoColor;
  }
  return ((categories.length % 8) + 1) as TodoColor;
}

/**
 * Die Zahl am Reiter: offene Tagesaufgaben, die heute oder frueher faellig sind.
 *
 * Bewusst nicht alle offenen: Wer sich fuer das Jahr zwanzig Dinge vornimmt,
 * braucht dafuer keine Zahl an der Leiste. Was heute ansteht - und was liegen
 * geblieben ist - ist die Zahl, die man sehen will.
 *
 * Sie steht hier und nicht in der Seite, damit der Reiter sie zeigen kann,
 * ohne die ganze Aufgabenseite in den Startcode zu ziehen.
 */
export function dueTodoCount(todos: Todo[], today = todayISO()): number {
  return todos.filter((todo) =>
    !todo.done && todo.scope === 'day' && todo.period !== null && todo.period <= today).length;
}

/* ------------------------------------------------------- Fälligkeits-Körbe */

/**
 * Wohin eine Aufgabe in der einen Liste gehoert.
 *
 * Der Umschalter Tag/Woche/Monat/Jahr ist weg - und mit ihm das Umschalten.
 * Der Zeitraum bleibt trotzdem: Eine Wochenaufgabe ist weiterhin eine
 * Wochenaufgabe, sie steht nur nicht mehr hinter einem eigenen Reiter,
 * sondern unter "Diese Woche". Was man sieht, ist dadurch immer alles.
 */
export type TodoBucket =
  | 'overdue' | 'today' | 'tomorrow' | 'week' | 'month' | 'year' | 'later' | 'none';

export const BUCKET_LABELS: Record<TodoBucket, string> = {
  overdue: 'Überfällig',
  today: 'Heute',
  tomorrow: 'Morgen',
  week: 'Diese Woche',
  month: 'Diesen Monat',
  year: 'Dieses Jahr',
  later: 'Später',
  none: 'Ohne Datum',
};

const BUCKET_ORDER: TodoBucket[] = [
  'overdue', 'today', 'tomorrow', 'week', 'month', 'year', 'later', 'none',
];

/**
 * Der Korb einer Aufgabe - aus einer einzigen Regel.
 *
 * Entscheidend ist nicht die Art des Zeitraums, sondern sein letzter Tag: Eine
 * Tagesaufgabe fuer Samstag und eine Wochenaufgabe fuer diese Woche laufen
 * beide am Sonntag ab und stehen deshalb beide unter "Diese Woche". Das
 * erspart acht Sonderfaelle und liest sich genau so, wie man es erwartet.
 */
export function bucketOf(todo: Todo, today = todayISO()): TodoBucket {
  if (todo.scope === 'someday' || !todo.period) return 'none';
  const end = periodEnd(todo.scope, todo.period);
  if (end < today) return 'overdue';
  if (end === today) return 'today';
  if (end === addDays(today, 1)) return 'tomorrow';
  if (end <= addDays(startOfWeek(today), 6)) return 'week';
  if (end <= periodEnd('month', periodOf('month', today) ?? today)) return 'month';
  if (end <= `${today.slice(0, 4)}-12-31`) return 'year';
  return 'later';
}

/** Der Zeitpunkt, nach dem innerhalb eines Korbes sortiert wird. */
export const dueKey = (todo: Todo): string =>
  `${todo.period ?? '9999-99-99'} ${todo.dueTime ?? '99:99'}`;

export interface TodoBucketGroup {
  bucket: TodoBucket;
  label: string;
  todos: Todo[];
}

/**
 * Teilt die offenen Aufgaben in die Faelligkeits-Koerbe.
 *
 * Innerhalb eines Korbes entscheidet die gewaehlte Sortierung; leere Koerbe
 * fallen weg, damit die Liste nicht aus Ueberschriften besteht.
 */
export function bucketTodos(todos: Todo[], sort: TodoSort, today = todayISO()): TodoBucketGroup[] {
  const map = new Map<TodoBucket, Todo[]>();
  for (const todo of todos) {
    const bucket = bucketOf(todo, today);
    map.set(bucket, [...(map.get(bucket) ?? []), todo]);
  }
  return BUCKET_ORDER
    .filter((bucket) => (map.get(bucket) ?? []).length > 0)
    .map((bucket) => ({
      bucket,
      label: t(BUCKET_LABELS[bucket]),
      todos: [...(map.get(bucket) ?? [])].sort((a, b) => {
        const byOrder = compareTodos(a, b, sort);
        if (byOrder !== 0) return byOrder;
        return dueKey(a).localeCompare(dueKey(b));
      }),
    }));
}

/* ------------------------------------------------------------ Erinnerungen */

/** Die Auswahl, die der Dialog anbietet - Minuten vor der Uhrzeit. */
export const REMIND_CHOICES: Array<{ minutes: number; label: string }> = [
  { minutes: 0, label: 'Pünktlich' },
  { minutes: 10, label: '10 Minuten vorher' },
  { minutes: 30, label: '30 Minuten vorher' },
  { minutes: 60, label: '1 Stunde vorher' },
  { minutes: 24 * 60, label: 'Einen Tag vorher' },
];

/** Datum und Uhrzeit einer Aufgabe als echter Zeitpunkt, sofern beides da ist. */
export function dueAt(todo: Todo): Date | null {
  if (!todo.period || !todo.dueTime) return null;
  const [hour, minute] = todo.dueTime.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const date = parseISODate(todo.period);
  date.setHours(hour, minute, 0, 0);
  return date;
}

/**
 * Aufgaben, an die jetzt zu erinnern ist.
 *
 * "Jetzt" heisst: Der Erinnerungszeitpunkt ist erreicht und heute wurde noch
 * nicht erinnert. Eine Aufgabe, deren Uhrzeit laengst vorbei ist, meldet sich
 * trotzdem einmal - wer die App erst am Abend oeffnet, will wissen, was er
 * verpasst hat, und nicht, dass nichts war.
 */
export function dueReminders(todos: Todo[], now = new Date()): Todo[] {
  const today = toISO(now);
  return todos.filter((todo) => {
    if (todo.done || todo.remindMin == null || todo.remindedOn === today) return false;
    const at = dueAt(todo);
    if (!at) return false;
    return now.getTime() >= at.getTime() - todo.remindMin * 60000;
  });
}

/* --------------------------------------------------------- Teilschritte */

/** Alle Teilschritte flach - beide Ebenen, in Anzeigereihenfolge. */
export function flatSteps(steps: TodoStep[]): TodoStep[] {
  return steps.flatMap((step) => [step, ...(step.children ?? [])]);
}

/**
 * Setzt einen Teilschritt und zieht die Ebenen nach.
 *
 * Ein Unterpunkt haengt an seinem Oberpunkt: Sind alle Unterpunkte erledigt,
 * ist der Oberpunkt es auch; wird ein Oberpunkt abgehakt, gilt das fuer seine
 * Unterpunkte mit. Alles andere waere ein Haken, der etwas anderes behauptet
 * als die Zeilen darunter.
 */
export function toggleStepIn(steps: TodoStep[], id: ID): TodoStep[] {
  return steps.map((step) => {
    if (step.id === id) {
      const done = !step.done;
      return { ...step, done, ...(step.children ? { children: step.children.map((child) => ({ ...child, done })) } : {}) };
    }
    if (!step.children?.some((child) => child.id === id)) return step;
    const children = step.children.map((child) => (child.id === id ? { ...child, done: !child.done } : child));
    return { ...step, children, done: children.every((child) => child.done) };
  });
}

export function removeStepIn(steps: TodoStep[], id: ID): TodoStep[] {
  return steps
    .filter((step) => step.id !== id)
    .map((step) => (step.children
      ? { ...step, children: step.children.filter((child) => child.id !== id) }
      : step));
}

export function editStepIn(steps: TodoStep[], id: ID, text: string): TodoStep[] {
  return steps.map((step) => {
    if (step.id === id) return { ...step, text };
    if (!step.children) return step;
    return { ...step, children: step.children.map((child) => (child.id === id ? { ...child, text } : child)) };
  });
}

/* ------------------------------------------------------------ Gewohnheiten */

export interface HabitStats {
  /** Serie bis heute, in Zeiträumen der Wiederholung. */
  streak: number;
  /** Die längste je erreichte Serie. */
  best: number;
  /** Wie viele der letzten 30 Tage abgehakt wurden. */
  last30: number;
  /** Erledigt-Tage, aufsteigend. */
  days: string[];
}

/**
 * Was aus dem Verlauf einer wiederkehrenden Aufgabe abzulesen ist.
 *
 * Die Serie wird gerechnet und nicht gespeichert - ein gemerkter Zaehler laeuft
 * zwischen zwei Geraeten auseinander, ein abgeleiteter nie. Der gespeicherte
 * `streak` bleibt trotzdem: Er zaehlt auch das, was vor dem Verlauf lag.
 */
export function habitStats(todo: Todo, today = todayISO()): HabitStats {
  const days = [...new Set(todo.doneDates ?? [])].sort();
  const set = new Set(days);
  const stepDays = todo.repeat?.every === 'week' ? 7 : 1;

  let streak = 0;
  for (let cursor = today; ; cursor = addDays(cursor, -stepDays)) {
    if (set.has(cursor)) streak += 1;
    else if (cursor !== today) break;
    else continue;
  }

  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous && addDays(previous, stepDays) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  const from = addDays(today, -29);
  return { streak, best, last30: days.filter((day) => day >= from && day <= today).length, days };
}

/** Wie oft je Kategorie erledigt wurde - für die Auswertung. */
export function doneByCategory(
  todos: Todo[], categories: TodoCategory[], from: string, to: string,
): Array<{ category: TodoCategory | null; count: number }> {
  const inRange = (todo: Todo) => (todo.doneDates ?? []).filter((day) => day >= from && day <= to).length;
  const rows: Array<{ category: TodoCategory | null; count: number }> = categories.map((category) => ({
    category,
    count: todos.filter((todo) => todo.categoryId === category.id).reduce((sum, todo) => sum + inRange(todo), 0),
  }));
  const loose = todos.filter((todo) => !categories.some((c) => c.id === todo.categoryId))
    .reduce((sum, todo) => sum + inRange(todo), 0);
  if (loose > 0) rows.push({ category: null, count: loose });
  return rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
}
