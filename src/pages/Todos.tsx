import { t } from '../i18n';
import { useMemo, useRef, useState } from 'react';
import type { ID, Todo, TodoCategory, TodoColor, TodoPriority, TodoScope, TodoStep } from '../types';
import { useStore } from '../storage/store';
import { uid } from '../storage/defaults';
import { WEEKDAY_SHORT, addDays, startOfWeek, todayISO } from '../lib/date';
import {
  PRIORITY_LABELS, REPEAT_LABELS, SCOPE_LABELS, SCOPE_NAMES, SORT_LABELS, TODO_SCOPES,
  type TodoSort, carryOverCandidates, categoryById, compareTodos, completeTodo, createStep,
  createTodo, doneOnDay, groupTodos, isOverdue, isPartlyDone, matchesSearch, nextColor,
  overdueDays, periodDate, periodLabel, periodOf, shiftPeriod, stepProgress, tally,
} from '../lib/todos';
import { ConfirmDialog, DateInput, EmptyState, Modal, Section, useToast } from '../components/ui';
import {
  IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconEdit, IconFlag,
  IconNote, IconPlus, IconRefresh, IconSearch, IconTrash, IconX,
} from '../components/icons';

/*
 * Die Aufgabenseite.
 *
 * Eine Trainingsapp fuehrt ohnehin schon Buch darueber, was man sich vornimmt
 * und was man davon tut - nur bisher ausschliesslich fuer Saetze und
 * Wiederholungen. Das Gleiche fuer alles andere: "Proteinpulver bestellen",
 * "diese Woche zweimal laufen", "dieses Jahr den Klimmzug schaffen".
 *
 * Der Aufbau folgt einer Beobachtung: Eine Aufgabenliste scheitert fast immer
 * daran, dass alles in einem Topf landet. Deshalb hat jede Aufgabe genau einen
 * Zeitraum - Tag, Woche, Monat, Jahr oder gar keinen - und man sieht immer nur
 * einen davon. Die Woche ist nicht die Summe ihrer Tage, sondern eine eigene
 * Ebene: Was man sich fuer die Woche vornimmt, ist etwas anderes als das, was
 * am Dienstag ansteht.
 */

/* ------------------------------------------------------------------ Seite */

export function TodosPage() {
  const { state, addTodo, updateTodo, updateTodos, deleteTodo, deleteTodos } = useStore();
  const toast = useToast();
  const today = todayISO();

  const [scope, setScope] = useState<TodoScope>('day');
  const [period, setPeriod] = useState<string | null>(today);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ID | null>(null);
  const [sort, setSort] = useState<TodoSort>('priority');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<ID, boolean>>({});
  const [doneOpen, setDoneOpen] = useState(false);
  const [editing, setEditing] = useState<Todo | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const categories = state.todoCategories;
  const todos = state.todos;

  /* Der Zeitraum, der gerade auf dem Bildschirm steht. */
  const inPeriod = useMemo(
    () => todos.filter((todo) => todo.scope === scope
      && (scope === 'someday' ? true : todo.period === period)),
    [todos, scope, period],
  );

  const visible = useMemo(() => inPeriod.filter((todo) =>
    (filterCategory === null || todo.categoryId === filterCategory)
    && matchesSearch(todo, search, categoryById(categories, todo.categoryId))),
  [inPeriod, filterCategory, search, categories]);

  const open = visible.filter((todo) => !todo.done);
  const done = visible.filter((todo) => todo.done)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const groups = useMemo(() => groupTodos(open, sort, categories), [open, sort, categories]);

  const counts = useMemo(() => tally(inPeriod, today), [inPeriod, today]);
  const carry = useMemo(() => carryOverCandidates(todos, today), [todos, today]);

  const atCurrent = scope === 'someday' || period === periodOf(scope, today);

  /* Zeitraumart wechseln: der neue Zeitraum ist immer der laufende. */
  const chooseScope = (next: TodoScope) => {
    setScope(next);
    setPeriod(periodOf(next, today));
    setDoneOpen(false);
  };

  const step = (direction: -1 | 1) => {
    if (scope === 'someday' || !period) return;
    setPeriod(shiftPeriod(scope, period, direction));
    setDoneOpen(false);
  };

  /* ------------------------------------------------------------ Handgriffe */

  const toggleDone = (todo: Todo) => {
    if (todo.done) {
      updateTodo(todo.id, { done: false, doneAt: null });
      return;
    }
    const patch = completeTodo(todo);
    updateTodo(todo.id, patch);
    /*
     * Eine wiederkehrende Aufgabe verschwindet beim Abhaken aus dem Blickfeld -
     * sie steht ja jetzt im naechsten Zeitraum. Ohne Rueckmeldung sieht das aus
     * wie ein Fehler, deshalb sagt die Meldung, wohin sie gewandert ist.
     */
    if (todo.repeat) {
      const previous = { ...todo };
      toast.show(
        t('Erledigt – steht wieder am {date}', {
          date: periodLabel(patch.scope ?? todo.scope, patch.period ?? null, today),
        }),
        { label: t('Rückgängig'), run: () => updateTodo(todo.id, previous) },
      );
    }
  };

  const toggleStep = (todo: Todo, stepId: ID) => {
    const steps = todo.steps.map((item) =>
      (item.id === stepId ? { ...item, done: !item.done } : item));
    const all = steps.length > 0 && steps.every((item) => item.done);
    /*
     * Der letzte Teilschritt hakt die Aufgabe mit ab. Wer alle fuenf Schritte
     * abgehakt hat und danach noch einmal die Aufgabe selbst abhaken muesste,
     * fragt sich zu Recht, wofuer die Schritte gut waren.
     */
    updateTodo(todo.id, all
      ? { steps, done: true, doneAt: new Date().toISOString() }
      : { steps });
  };

  const addQuick = (title: string) => {
    const todo = createTodo({
      title,
      scope,
      period: scope === 'someday' ? null : period,
      categoryId: filterCategory,
      order: Date.now(),
    });
    addTodo(todo);
    return todo;
  };

  const removeTodo = (todo: Todo) => {
    deleteTodo(todo.id);
    setEditing(null);
    toast.show(t('Gelöscht'), { label: t('Rückgängig'), run: () => addTodo(todo) });
  };

  const takeOver = () => {
    const ids = carry.map((todo) => todo.id);
    const before = carry.map((todo) => ({ ...todo }));
    updateTodos(ids, { period: today, scope: 'day' });
    setScope('day');
    setPeriod(today);
    toast.show(
      ids.length === 1 ? t('1 Aufgabe übernommen') : t('{count} Aufgaben übernommen', { count: ids.length }),
      { label: t('Rückgängig'), run: () => before.forEach((todo) => updateTodo(todo.id, todo)) },
    );
  };

  const clearDone = () => {
    const removed = done.map((todo) => ({ ...todo }));
    deleteTodos(removed.map((todo) => todo.id));
    setConfirmClear(false);
    toast.show(
      t('{count} erledigte Aufgaben entfernt', { count: removed.length }),
      { label: t('Rückgängig'), run: () => removed.forEach((todo) => addTodo(todo)) },
    );
  };

  const move = (todo: Todo, direction: -1 | 1) => {
    const list = [...open].sort((a, b) => compareTodos(a, b, 'manual'));
    const index = list.findIndex((item) => item.id === todo.id);
    const other = list[index + direction];
    if (!other) return;
    updateTodo(todo.id, { order: other.order });
    updateTodo(other.id, { order: todo.order });
  };

  /* ------------------------------------------------------------- Anzeige */

  return (
    <>
      <TodoOverview counts={counts} todos={todos} today={today} />

      <div className="todo-controls">
      <div className="todo-scopes" role="tablist" aria-label={t('Zeitraum')}>
        {TODO_SCOPES.map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={scope === item}
            className={`todo-scopes__item ${scope === item ? 'todo-scopes__item--on' : ''}`}
            onClick={() => chooseScope(item)}
          >
            {t(SCOPE_LABELS[item])}
          </button>
        ))}
      </div>

      {scope !== 'someday' && (
        <div className="todo-period">
          <button className="btn btn--sm btn--icon" onClick={() => step(-1)} aria-label={t('Zeitraum zurück')}>
            <IconChevronLeft />
          </button>
          <div className="todo-period__label">
            <div className="todo-period__name">{periodLabel(scope, period, today)}</div>
            <div className="tiny dim">{periodDate(scope, period)}</div>
          </div>
          <button className="btn btn--sm btn--icon" onClick={() => step(1)} aria-label={t('Zeitraum weiter')}>
            <IconChevronRight />
          </button>
          {!atCurrent && (
            <button className="btn btn--sm" onClick={() => setPeriod(periodOf(scope, today))}>
              {t('Jetzt')}
            </button>
          )}
        </div>
      )}

      <QuickAdd
        categories={categories}
        activeCategory={filterCategory}
        onAdd={addQuick}
        onDetails={(todo) => setEditing(todo)}
      />

      <div className="todo-tools">
        <button
          className={`btn btn--sm btn--icon ${searchOpen ? 'btn--on' : ''}`}
          onClick={() => { setSearchOpen((value) => !value); if (searchOpen) setSearch(''); }}
          aria-label={t('Suchen')}
          aria-expanded={searchOpen}
        >
          <IconSearch />
        </button>
        <div className="chip-scroll" style={{ flex: 1 }}>
          <button
            className={`chip chip--button ${filterCategory === null ? 'chip--accent' : ''}`}
            onClick={() => setFilterCategory(null)}
          >
            {t('Alle')} <span className="mono dim">{inPeriod.filter((todo) => !todo.done).length}</span>
          </button>
          {categories.map((category) => {
            const count = inPeriod.filter((todo) => !todo.done && todo.categoryId === category.id).length;
            return (
              <button
                key={category.id}
                className={`chip chip--button todo-chip ${filterCategory === category.id ? 'todo-chip--on' : ''}`}
                style={{ '--cat': `var(--todo-cat-${category.color})` } as React.CSSProperties}
                onClick={() => setFilterCategory(filterCategory === category.id ? null : category.id)}
              >
                <span className="todo-chip__dot" />
                {category.icon} {category.name}
                <span className="mono dim">{count}</span>
              </button>
            );
          })}
          <button className="chip chip--button" onClick={() => setCategoriesOpen(true)}>
            <IconEdit style={{ width: 12, height: 12 }} /> {t('Kategorien')}
          </button>
        </div>
        <select
          className="select todo-sort"
          value={sort}
          onChange={(event) => setSort(event.target.value as TodoSort)}
          aria-label={t('Sortierung')}
        >
          {(Object.keys(SORT_LABELS) as TodoSort[]).map((key) => (
            <option key={key} value={key}>{t(SORT_LABELS[key])}</option>
          ))}
        </select>
      </div>

      {searchOpen && (
        <input
          className="input"
          autoFocus
          value={search}
          placeholder={t('In Aufgaben suchen …')}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t('Suchen')}
        />
      )}
      </div>

      {scope === 'day' && atCurrent && carry.length > 0 && (
        <div className="todo-carry" role="status">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">
              {carry.length === 1
                ? t('1 Aufgabe ist liegen geblieben')
                : t('{count} Aufgaben sind liegen geblieben', { count: carry.length })}
            </div>
            <div className="tiny dim">{t('Aus vergangenen Tagen, noch offen.')}</div>
          </div>
          <button className="btn btn--sm" onClick={takeOver}>{t('Auf heute holen')}</button>
        </div>
      )}

      {open.length === 0 && done.length === 0 ? (
        <EmptyState
          title={search || filterCategory
            ? t('Nichts gefunden')
            : t('Hier ist noch nichts vorgemerkt')}
          hint={search || filterCategory
            ? t('Andere Kategorie oder anderer Suchbegriff.')
            : t('Trag oben ein, was in diesem Zeitraum anstehen soll – ein Stichwort reicht.')}
        />
      ) : (
        <div className="todo-groups">
          {groups.map((group) => {
            const isOpen = !collapsed[group.key];
            return (
              <div key={group.key} className="todo-group">
                {group.label && (
                  <button
                    className="todo-group__head"
                    aria-expanded={isOpen}
                    onClick={() => setCollapsed((value) => ({ ...value, [group.key]: isOpen }))}
                  >
                    <IconChevronDown
                      className="todo-group__chevron"
                      style={isOpen ? undefined : { transform: 'rotate(-90deg)' }}
                    />
                    {group.priority && <span className={`todo-group__pip todo-group__pip--${group.priority}`} />}
                    {group.color && (
                      <span
                        className="todo-chip__dot"
                        style={{ '--cat': `var(--todo-cat-${group.color})` } as React.CSSProperties}
                      />
                    )}
                    <span className="todo-group__name">{group.icon} {group.label}</span>
                    <span className="todo-group__count mono">{group.todos.length}</span>
                  </button>
                )}
                {isOpen && (
                  <div className="list">
                    {group.todos.map((todo, index) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        category={categoryById(categories, todo.categoryId)}
                        today={today}
                        expanded={expanded[todo.id] === true}
                        sortable={sort === 'manual'}
                        first={index === 0}
                        last={index === group.todos.length - 1}
                        onToggle={() => toggleDone(todo)}
                        onToggleStep={(stepId) => toggleStep(todo, stepId)}
                        onExpand={() => setExpanded((value) => ({ ...value, [todo.id]: !value[todo.id] }))}
                        onEdit={() => setEditing(todo)}
                        onMove={(direction) => move(todo, direction)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {done.length > 0 && (
            <div className="todo-group">
              <button
                className="todo-group__head"
                aria-expanded={doneOpen}
                onClick={() => setDoneOpen(!doneOpen)}
              >
                <IconChevronDown
                  className="todo-group__chevron"
                  style={doneOpen ? undefined : { transform: 'rotate(-90deg)' }}
                />
                <span className="todo-group__pip todo-group__pip--done" />
                <span className="todo-group__name">{t('Erledigt')}</span>
                <span className="todo-group__count mono">{done.length}</span>
              </button>
              {doneOpen && (
                <div className="list">
                  {done.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      category={categoryById(categories, todo.categoryId)}
                      today={today}
                      expanded={expanded[todo.id] === true}
                      sortable={false}
                      first
                      last
                      onToggle={() => toggleDone(todo)}
                      onToggleStep={(stepId) => toggleStep(todo, stepId)}
                      onExpand={() => setExpanded((value) => ({ ...value, [todo.id]: !value[todo.id] }))}
                      onEdit={() => setEditing(todo)}
                      onMove={() => undefined}
                    />
                  ))}
                  <button className="btn btn--sm btn--flush" onClick={() => setConfirmClear(true)}>
                    <IconTrash /> {t('Erledigte entfernen')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {editing && (
        <TodoEditor
          todo={editing}
          categories={categories}
          today={today}
          onChange={(patch) => {
            updateTodo(editing.id, patch);
            setEditing({ ...editing, ...patch });
          }}
          onManageCategories={() => setCategoriesOpen(true)}
          onDelete={() => removeTodo(editing)}
          onClose={() => setEditing(null)}
        />
      )}

      {categoriesOpen && <CategoryManager onClose={() => setCategoriesOpen(false)} />}

      {confirmClear && (
        <ConfirmDialog
          title={t('Erledigte entfernen?')}
          message={t('Die {count} abgehakten Aufgaben dieses Zeitraums werden gelöscht. Rückgängig geht direkt danach.', { count: done.length })}
          onConfirm={clearDone}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}

/* --------------------------------------------------------------- Überblick */

/**
 * Der Kopf der Seite: wie weit der gewaehlte Zeitraum ist, und wie die Woche
 * bisher lief.
 *
 * Der Ring zaehlt angefangene Aufgaben anteilig mit (siehe `tally`). Der
 * Wochenbalken daneben ist die einzige Stelle, an der die Seite ueber ihren
 * Zeitraum hinausblickt - er beantwortet die Frage, die eine Tagesliste nie
 * beantworten kann: "War das eine gute Woche?"
 */
function TodoOverview({
  counts, todos, today,
}: {
  counts: ReturnType<typeof tally>;
  todos: Todo[];
  today: string;
}) {
  const monday = startOfWeek(today);
  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = addDays(monday, index);
    return {
      date,
      index,
      done: doneOnDay(todos, date),
      open: todos.filter((todo) => !todo.done && todo.scope === 'day' && todo.period === date).length,
    };
  }), [todos, monday]);

  const peak = Math.max(1, ...week.map((day) => day.done + day.open));
  const percent = counts.total === 0 ? 0 : Math.round((counts.weighted / counts.total) * 100);
  const weekDone = week.reduce((sum, day) => sum + day.done, 0);

  return (
    <div className="card todo-overview">
      <div className="todo-overview__top">
        <ProgressRing percent={percent} muted={counts.total === 0} />
        <div className="todo-overview__facts">
          <div className="todo-fact">
            <span className="todo-fact__value mono">{counts.open}</span>
            <span className="todo-fact__label">{t('offen')}</span>
          </div>
          <div className="todo-fact">
            <span className="todo-fact__value mono" style={{ color: counts.done > 0 ? 'var(--success)' : undefined }}>
              {counts.done}
            </span>
            <span className="todo-fact__label">{t('erledigt')}</span>
          </div>
          <div className="todo-fact">
            <span className="todo-fact__value mono" style={{ color: counts.overdue > 0 ? 'var(--danger)' : undefined }}>
              {counts.overdue}
            </span>
            <span className="todo-fact__label">{t('überfällig')}</span>
          </div>
        </div>
      </div>

      <div className="todo-week" role="img" aria-label={t('{count} Aufgaben in dieser Woche erledigt', { count: weekDone })}>
        {week.map((day) => (
          <div key={day.date} className="todo-week__col" title={t('{weekday}: {done} erledigt, {open} offen', {
            weekday: t(WEEKDAY_SHORT[day.index]), done: day.done, open: day.open,
          })}>
            <div className="todo-week__stack">
              {day.open > 0 && (
                <div className="todo-week__bar todo-week__bar--open" style={{ height: `${(day.open / peak) * 100}%` }} />
              )}
              {day.done > 0 && (
                <div className="todo-week__bar todo-week__bar--done" style={{ height: `${(day.done / peak) * 100}%` }} />
              )}
            </div>
            <div className={`todo-week__day ${day.date === today ? 'todo-week__day--today' : ''}`}>
              {t(WEEKDAY_SHORT[day.index])}
            </div>
          </div>
        ))}
      </div>

      <div className="todo-legend tiny dim">
        <span><span className="todo-legend__swatch todo-legend__swatch--done" /> {t('erledigt')}</span>
        <span><span className="todo-legend__swatch todo-legend__swatch--open" /> {t('offen')}</span>
        <span className="spacer" />
        <span>{t('Diese Woche: {count} erledigt', { count: weekDone })}</span>
      </div>
    </div>
  );
}

/** Der Fortschrittsring. Reine Anzeige - deshalb der Erledigt-Ton, kein Akzent. */
function ProgressRing({ percent, muted }: { percent: number; muted: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, percent)) / 100) * circumference;
  return (
    <svg className="todo-ring" viewBox="0 0 64 64" width={64} height={64} aria-hidden="true">
      <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
      <circle
        cx="32" cy="32" r={radius}
        fill="none"
        stroke={muted ? 'var(--border)' : 'var(--success)'}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference - filled}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="33" className="todo-ring__text" textAnchor="middle" dominantBaseline="middle">
        {percent}
      </text>
      <text x="32" y="44" className="todo-ring__unit" textAnchor="middle" dominantBaseline="middle">%</text>
    </svg>
  );
}

/* -------------------------------------------------------------- Schnelleingabe */

/**
 * Eine Zeile, ein Feld, Enter.
 *
 * Alles Weitere - Kategorie, Prioritaet, Teilschritte - kommt spaeter oder gar
 * nicht. Wer eine Aufgabe notieren will, waehrend ihm einfaellt, dass er sie
 * hat, darf dafuer nicht erst ein Formular ausfuellen muessen.
 */
function QuickAdd({
  categories, activeCategory, onAdd, onDetails,
}: {
  categories: TodoCategory[];
  activeCategory: ID | null;
  onAdd: (title: string) => Todo;
  onDetails: (todo: Todo) => void;
}) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const category = categoryById(categories, activeCategory);

  const submit = (openDetails: boolean) => {
    const title = text.trim();
    if (!title) return;
    const todo = onAdd(title);
    setText('');
    if (openDetails) onDetails(todo);
    else input.current?.focus();
  };

  return (
    <div className="todo-add">
      <IconPlus className="todo-add__icon" />
      <input
        ref={input}
        className="todo-add__field"
        value={text}
        placeholder={category
          ? t('Neue Aufgabe in {category} …', { category: category.name })
          : t('Neue Aufgabe …')}
        aria-label={t('Neue Aufgabe')}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') submit(false); }}
      />
      {text.trim() && (
        <>
          <button className="btn btn--sm" onClick={() => submit(true)}>{t('Details')}</button>
          <button className="btn btn--sm btn--primary" onClick={() => submit(false)}>{t('Hinzufügen')}</button>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- Zeile */

function TodoRow({
  todo, category, today, expanded, sortable, first, last,
  onToggle, onToggleStep, onExpand, onEdit, onMove,
}: {
  todo: Todo;
  category: TodoCategory | undefined;
  today: string;
  expanded: boolean;
  sortable: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onToggleStep: (stepId: ID) => void;
  onExpand: () => void;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const progress = stepProgress(todo);
  const overdue = isOverdue(todo, today);
  const days = overdueDays(todo, today);
  const hasDetail = todo.steps.length > 0 || todo.note.trim().length > 0;

  return (
    <div
      className={[
        'todo-item',
        todo.done ? 'todo-item--done' : '',
        overdue ? 'todo-item--overdue' : '',
        isPartlyDone(todo) ? 'todo-item--partly' : '',
        `todo-item--${todo.priority}`,
      ].filter(Boolean).join(' ')}
      style={category ? ({ '--cat': `var(--todo-cat-${category.color})` } as React.CSSProperties) : undefined}
    >
      <div className="todo-item__main">
        <button
          className={`todo-check ${todo.done ? 'todo-check--on' : ''}`}
          role="checkbox"
          aria-checked={todo.done}
          aria-label={todo.done ? t('Wieder öffnen') : t('Abhaken')}
          onClick={onToggle}
        >
          {todo.done && <IconCheck />}
          {!todo.done && progress && progress.done > 0 && (
            <span className="todo-check__part" style={{ height: `${progress.ratio * 100}%` }} />
          )}
        </button>

        <button className="todo-item__body" onClick={onEdit}>
          <span className="todo-item__title">{todo.title}</span>
          <span className="todo-item__meta">
            {category && (
              <span className="todo-item__cat">
                <span className="todo-chip__dot" />
                {category.icon} {category.name}
              </span>
            )}
            {progress && (
              <span className="mono">{progress.done}/{progress.total}</span>
            )}
            {todo.priority === 'high' && !todo.done && (
              <span className="todo-item__prio"><IconFlag style={{ width: 11, height: 11 }} /> {t('Hoch')}</span>
            )}
            {todo.repeat && (
              <span className="todo-item__repeat">
                <IconRefresh style={{ width: 11, height: 11 }} />
                {todo.streak > 0 ? t('{count}×', { count: todo.streak }) : t(REPEAT_LABELS[todo.repeat.every])}
              </span>
            )}
            {todo.note.trim() && <IconNote style={{ width: 11, height: 11 }} />}
            {overdue && (
              <span className="todo-item__late">
                {days === 1 ? t('1 Tag über') : t('{count} Tage über', { count: days })}
              </span>
            )}
          </span>
          {progress && !todo.done && (
            <span className="todo-item__meter" aria-hidden="true">
              <span className="todo-item__meter-fill" style={{ width: `${progress.ratio * 100}%` }} />
            </span>
          )}
        </button>

        {sortable && (
          <span className="todo-item__sort">
            <button className="btn btn--sm btn--icon" disabled={first} onClick={() => onMove(-1)} aria-label={t('Nach oben')}>
              <IconChevronDown style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button className="btn btn--sm btn--icon" disabled={last} onClick={() => onMove(1)} aria-label={t('Nach unten')}>
              <IconChevronDown />
            </button>
          </span>
        )}

        {hasDetail && (
          <button
            className="btn btn--ghost btn--icon todo-item__toggle"
            aria-expanded={expanded}
            aria-label={expanded ? t('Zuklappen') : t('Aufklappen')}
            onClick={onExpand}
          >
            <IconChevronDown style={expanded ? { transform: 'rotate(180deg)' } : undefined} />
          </button>
        )}
      </div>

      {expanded && hasDetail && (
        <div className="todo-item__detail">
          {todo.note.trim() && <p className="small muted todo-item__note">{todo.note}</p>}
          {todo.steps.map((item) => (
            <button
              key={item.id}
              className={`todo-step ${item.done ? 'todo-step--done' : ''}`}
              role="checkbox"
              aria-checked={item.done}
              onClick={() => onToggleStep(item.id)}
            >
              <span className="todo-step__box">{item.done && <IconCheck />}</span>
              <span className="todo-step__text">{item.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Dialog */

function TodoEditor({
  todo, categories, today, onChange, onManageCategories, onDelete, onClose,
}: {
  todo: Todo;
  categories: TodoCategory[];
  today: string;
  onChange: (patch: Partial<Todo>) => void;
  onManageCategories: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [stepText, setStepText] = useState('');
  const [confirm, setConfirm] = useState(false);

  const setSteps = (steps: TodoStep[]) => onChange({ steps });
  const addStep = () => {
    const text = stepText.trim();
    if (!text) return;
    setSteps([...todo.steps, createStep(text)]);
    setStepText('');
  };

  /*
   * Der Zeitraum wird ueber ein gewoehnliches Datumsfeld gewaehlt, auch fuer
   * Woche, Monat und Jahr: Man tippt einen Tag an, und die Aufgabe landet in
   * der Woche, dem Monat oder dem Jahr, in dem dieser Tag liegt. Ein eigener
   * Wochen- und Monatswaehler waere drei Bedienelemente fuer eine Frage, die
   * ein Kalender schon beantwortet.
   */
  const anchor = todo.period ?? today;

  return (
    <Modal title={t('Aufgabe')} onClose={onClose}>
      <div className="list">
        <label className="field">
          <span className="field__label">{t('Aufgabe')}</span>
          <input
            className="input"
            value={todo.title}
            autoFocus={!todo.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('Notiz')}</span>
          <textarea
            className="textarea"
            value={todo.note}
            placeholder={t('Was dazugehört – Telefonnummer, Maße, was schon versucht wurde …')}
            onChange={(event) => onChange({ note: event.target.value })}
          />
        </label>

        <div className="field">
          <span className="field__label">{t('Kategorie')}</span>
          <div className="row row--wrap" style={{ gap: 6 }}>
            <button
              className={`chip chip--button ${todo.categoryId === null ? 'chip--accent' : ''}`}
              onClick={() => onChange({ categoryId: null })}
            >
              {t('Keine')}
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={`chip chip--button todo-chip ${todo.categoryId === category.id ? 'todo-chip--on' : ''}`}
                style={{ '--cat': `var(--todo-cat-${category.color})` } as React.CSSProperties}
                onClick={() => onChange({ categoryId: category.id })}
              >
                <span className="todo-chip__dot" />
                {category.icon} {category.name}
              </button>
            ))}
            <button className="chip chip--button" onClick={onManageCategories}>
              <IconPlus style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">{t('Zeitraum')}</span>
            <select
              className="select"
              value={todo.scope}
              onChange={(event) => {
                const scope = event.target.value as TodoScope;
                onChange({ scope, period: periodOf(scope, anchor) });
              }}
            >
              {TODO_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{t(SCOPE_NAMES[scope])}</option>
              ))}
            </select>
          </label>

          {todo.scope !== 'someday' && (
            <div className="field">
              <span className="field__label">
                {todo.scope === 'day' ? t('Tag') : t('Ein Tag darin')}
              </span>
              <DateInput
                value={anchor}
                ariaLabel={t('Tag')}
                onChange={(value) => { if (value) onChange({ period: periodOf(todo.scope, value) }); }}
              />
            </div>
          )}
        </div>

        {todo.scope !== 'someday' && (
          <>
            {todo.scope !== 'day' && (
              <p className="tiny dim" style={{ margin: 0 }}>{periodDate(todo.scope, todo.period)}</p>
            )}
            <div className="chip-scroll">
              <button className="chip chip--button" onClick={() => onChange({ scope: 'day', period: today })}>
                {t('Heute')}
              </button>
              <button className="chip chip--button" onClick={() => onChange({ scope: 'day', period: addDays(today, 1) })}>
                {t('Morgen')}
              </button>
              <button
                className="chip chip--button"
                onClick={() => onChange({ scope: 'week', period: periodOf('week', addDays(today, 7)) })}
              >
                {t('Nächste Woche')}
              </button>
              <button
                className="chip chip--button"
                onClick={() => onChange({ scope: 'month', period: periodOf('month', today) })}
              >
                {t('Dieser Monat')}
              </button>
            </div>
          </>
        )}

        <div className="field">
          <span className="field__label">{t('Priorität')}</span>
          <div className="row" style={{ gap: 6 }}>
            {(['high', 'normal', 'low'] as TodoPriority[]).map((priority) => (
              <button
                key={priority}
                className={`chip chip--button todo-prio todo-prio--${priority} ${todo.priority === priority ? 'todo-prio--on' : ''}`}
                onClick={() => onChange({ priority })}
              >
                {t(PRIORITY_LABELS[priority])}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <label className="field">
            <span className="field__label">{t('Wiederholung')}</span>
            <select
              className="select"
              value={todo.repeat?.every ?? ''}
              onChange={(event) => {
                const value = event.target.value;
                onChange({
                  repeat: value
                    ? { every: value as 'day' | 'week' | 'month' | 'year', interval: todo.repeat?.interval ?? 1 }
                    : null,
                });
              }}
            >
              <option value="">{t('Einmalig')}</option>
              {(Object.keys(REPEAT_LABELS) as Array<keyof typeof REPEAT_LABELS>).map((every) => (
                <option key={every} value={every}>{t(REPEAT_LABELS[every])}</option>
              ))}
            </select>
          </label>
          {todo.repeat && (
            <label className="field">
              <span className="field__label">{t('Jedes wievielte Mal')}</span>
              <input
                className="input input--num"
                type="number"
                min={1}
                max={99}
                value={todo.repeat.interval}
                onChange={(event) => onChange({
                  repeat: { every: todo.repeat!.every, interval: Math.max(1, Number(event.target.value) || 1) },
                })}
              />
            </label>
          )}
        </div>

        {todo.repeat && todo.streak > 0 && (
          <p className="tiny dim" style={{ margin: 0 }}>
            {t('{count}× am Stück erledigt.', { count: todo.streak })}
          </p>
        )}

        <Section title={t('Teilschritte')} note={todo.steps.length > 0
          ? t('{done} von {total}', {
              done: todo.steps.filter((step) => step.done).length,
              total: todo.steps.length,
            })
          : undefined}>
          <div className="list">
            {todo.steps.map((step, index) => (
              <div key={step.id} className="row" style={{ gap: 6 }}>
                <button
                  className={`todo-step__box todo-step__box--wide ${step.done ? 'todo-step__box--on' : ''}`}
                  role="checkbox"
                  aria-checked={step.done}
                  aria-label={step.done ? t('Wieder öffnen') : t('Abhaken')}
                  onClick={() => setSteps(todo.steps.map((item, position) =>
                    (position === index ? { ...item, done: !item.done } : item)))}
                >
                  {step.done && <IconCheck />}
                </button>
                <input
                  className="input"
                  value={step.text}
                  onChange={(event) => setSteps(todo.steps.map((item, position) =>
                    (position === index ? { ...item, text: event.target.value } : item)))}
                />
                <button
                  className="btn btn--ghost btn--icon"
                  aria-label={t('Teilschritt entfernen')}
                  onClick={() => setSteps(todo.steps.filter((_, position) => position !== index))}
                >
                  <IconX />
                </button>
              </div>
            ))}
            <div className="row" style={{ gap: 6 }}>
              <input
                className="input"
                value={stepText}
                placeholder={t('Teilschritt hinzufügen …')}
                onChange={(event) => setStepText(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') addStep(); }}
              />
              <button className="btn btn--icon" onClick={addStep} aria-label={t('Teilschritt hinzufügen')}>
                <IconPlus />
              </button>
            </div>
          </div>
        </Section>

        <button className="btn btn--danger btn--block" onClick={() => setConfirm(true)}>
          <IconTrash /> {t('Aufgabe löschen')}
        </button>
      </div>

      {confirm && (
        <ConfirmDialog
          title={t('Aufgabe löschen?')}
          message={todo.title || t('Diese Aufgabe')}
          onConfirm={onDelete}
          onCancel={() => setConfirm(false)}
        />
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------- Kategorien */

const EMOJI_CHOICES = ['🏋️', '🥗', '🏠', '💼', '🩺', '💶', '📚', '🛒', '✈️', '🧹', '🎯', '💤'];

function CategoryManager({ onClose }: { onClose: () => void }) {
  const { state, upsertTodoCategory, deleteTodoCategory } = useStore();
  const categories = state.todoCategories;
  const [name, setName] = useState('');
  const [open, setOpen] = useState<ID | null>(null);
  const [removing, setRemoving] = useState<TodoCategory | null>(null);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const category: TodoCategory = {
      id: uid('tcat'),
      name: trimmed,
      color: nextColor(categories),
      icon: '',
    };
    upsertTodoCategory(category);
    setName('');
    // Gleich das Aussehen anbieten - sonst sind alle neuen Kategorien grau-grün.
    setOpen(category.id);
  };

  const used = (id: ID) => state.todos.filter((todo) => todo.categoryId === id).length;

  return (
    <Modal title={t('Kategorien')} onClose={onClose}>
      <div className="list">
        {categories.map((category) => (
          <div
            key={category.id}
            className="card todo-cat-row"
            style={{ '--cat': `var(--todo-cat-${category.color})` } as React.CSSProperties}
          >
            <div className="row" style={{ gap: 8 }}>
              {/*
                * Farbe und Zeichen liegen hinter dem Punkt statt offen in der
                * Zeile: Acht Farbkreise und dreizehn Emoji je Kategorie sind,
                * fuenfmal untereinander, kein Dialog mehr, sondern eine Wand.
                */}
              <button
                className="todo-cat-row__dot"
                aria-expanded={open === category.id}
                aria-label={t('Aussehen von {name}', { name: category.name })}
                onClick={() => setOpen(open === category.id ? null : category.id)}
              >
                <span className="todo-chip__dot todo-chip__dot--lg" />
                <span className="todo-cat-row__icon">{category.icon}</span>
              </button>
              <input
                className="input"
                value={category.name}
                aria-label={t('Name')}
                onChange={(event) => upsertTodoCategory({ ...category, name: event.target.value })}
              />
              <button
                className="btn btn--ghost btn--icon"
                aria-label={t('Kategorie löschen')}
                onClick={() => setRemoving(category)}
              >
                <IconTrash />
              </button>
            </div>

            {open === category.id && (
              <div className="todo-cat-row__picker">
                <div className="row row--wrap" style={{ gap: 5 }}>
                  {([1, 2, 3, 4, 5, 6, 7, 8] as TodoColor[]).map((color) => (
                    <button
                      key={color}
                      className={`todo-swatch ${category.color === color ? 'todo-swatch--on' : ''}`}
                      style={{ '--cat': `var(--todo-cat-${color})` } as React.CSSProperties}
                      aria-label={t('Farbe {number}', { number: color })}
                      aria-pressed={category.color === color}
                      onClick={() => upsertTodoCategory({ ...category, color })}
                    />
                  ))}
                </div>
                <div className="row row--wrap" style={{ gap: 4 }}>
                  <button
                    className={`chip chip--button ${category.icon === '' ? 'chip--accent' : ''}`}
                    onClick={() => upsertTodoCategory({ ...category, icon: '' })}
                  >
                    {t('kein Zeichen')}
                  </button>
                  {EMOJI_CHOICES.map((emoji) => (
                    <button
                      key={emoji}
                      className={`chip chip--button ${category.icon === emoji ? 'chip--accent' : ''}`}
                      aria-pressed={category.icon === emoji}
                      onClick={() => upsertTodoCategory({ ...category, icon: emoji })}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <div className="row" style={{ gap: 6 }}>
          <input
            className="input"
            value={name}
            placeholder={t('Neue Kategorie …')}
            aria-label={t('Neue Kategorie')}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') add(); }}
          />
          <button className="btn btn--icon" onClick={add} aria-label={t('Kategorie hinzufügen')}>
            <IconPlus />
          </button>
        </div>

        <p className="tiny dim" style={{ margin: 0 }}>
          {t('Der Punkt öffnet Farbe und Zeichen. Eine gelöschte Kategorie nimmt ihre Aufgaben nicht mit – sie stehen danach ohne Kategorie da.')}
        </p>
      </div>

      {removing && (
        <ConfirmDialog
          title={t('Kategorie löschen?')}
          message={used(removing.id) === 0
            ? removing.name
            : t('{count} Aufgaben stehen danach ohne Kategorie da.', { count: used(removing.id) })}
          onConfirm={() => { deleteTodoCategory(removing.id); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </Modal>
  );
}
