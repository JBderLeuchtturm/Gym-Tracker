import { exerciseName, t } from '../i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ID, Todo, TodoCategory, TodoColor, TodoPriority, TodoScope, TodoStep } from '../types';
import { useStore } from '../storage/store';
import { uid } from '../storage/defaults';
import { WEEKDAY_SHORT, addDays, formatDateTiny, startOfWeek, todayISO } from '../lib/date';
import {
  PRIORITY_LABELS, REMIND_CHOICES, REPEAT_LABELS, SCOPE_NAMES, SORT_LABELS, TODO_SCOPES,
  type TodoSort, bucketTodos, carryOverCandidates, categoryById, completeTodo, createStep,
  createTodo, doneByCategory, doneOnDay, editStepIn, habitStats, isOverdue, isPartlyDone,
  matchesSearch, nextColor, overdueDays, periodDate, periodLabel, periodOf, removeStepIn,
  stepProgress, tally, toggleStepIn,
} from '../lib/todos';
import { todosToIcs } from '../lib/todoIcs';
import { addTodoPhoto, deleteTodoPhoto, loadTodoPhotos, todoFilesAvailable } from '../storage/todoFiles';
import { ConfirmDialog, DateInput, EmptyState, Modal, TimeInput, fmt, useToast } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import {
  IconBell, IconCalendar, IconChart, IconCheck, IconChevronDown, IconChevronLeft, IconClock,
  IconDrag, IconDumbbell, IconEdit, IconFlag, IconNote, IconPlus, IconRefresh, IconSearch,
  IconSettings, IconTrash, IconX,
} from '../components/icons';
import { saveBlob } from '../lib/download';

/*
 * Die Aufgabenseite.
 *
 * Eine Trainingsapp fuehrt ohnehin Buch darueber, was man sich vornimmt und was
 * man davon tut - bisher nur fuer Saetze und Wiederholungen. Hier fuer alles
 * andere.
 *
 * Eine Liste, nach Faelligkeit geordnet: Ueberfaellig, Heute, Morgen, Diese
 * Woche, Diesen Monat, Dieses Jahr, Spaeter, Ohne Datum. Der Zeitraum einer
 * Aufgabe (Tag, Woche, Monat, Jahr) bleibt erhalten und bestimmt, in welchem
 * Korb sie landet - aber man schaltet nicht mehr zwischen Ebenen um, sondern
 * sieht immer alles. Das war der Fehler der ersten Fassung: Vier Reiter, von
 * denen drei immer versteckt waren, sind drei Listen, die man vergisst.
 */

type View = 'list' | 'stats';

/* ------------------------------------------------------------------ Seite */

export function TodosPage() {
  const { state, addTodo, updateTodo, updateTodos, deleteTodo, deleteTodos } = useStore();
  const toast = useToast();
  const today = todayISO();

  const [view, setView] = useState<View>('list');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ID | null>(null);
  const [sort, setSort] = useState<TodoSort>('priority');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<ID, boolean>>({});
  const [doneOpen, setDoneOpen] = useState(false);
  const [editing, setEditing] = useState<ID | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const categories = state.todoCategories;
  const todos = state.todos;

  const visible = useMemo(() => todos.filter((todo) =>
    (filterCategory === null || todo.categoryId === filterCategory)
    && matchesSearch(todo, search, categoryById(categories, todo.categoryId))),
  [todos, filterCategory, search, categories]);

  const open = useMemo(() => visible.filter((todo) => !todo.done), [visible]);
  /* Erledigtes der letzten zwei Wochen - aelteres ist Archiv, kein Zustand. */
  const done = useMemo(() => visible
    .filter((todo) => todo.done && (todo.doneAt ?? '').slice(0, 10) >= addDays(today, -14))
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')), [visible, today]);

  const groups = useMemo(() => bucketTodos(open, sort, today), [open, sort, today]);
  const counts = useMemo(() => tally([...open, ...done], today), [open, done, today]);
  const carry = useMemo(() => carryOverCandidates(todos, today), [todos, today]);
  const editingTodo = todos.find((todo) => todo.id === editing) ?? null;

  /* ------------------------------------------------------------ Handgriffe */

  const toggleDone = (todo: Todo) => {
    if (todo.done) {
      updateTodo(todo.id, { done: false, doneAt: null });
      return;
    }
    const before = { ...todo };
    updateTodo(todo.id, completeTodo(todo));
    if (todo.repeat) {
      toast.show(
        t('Erledigt – steht wieder am {date}', {
          date: periodLabel(todo.scope === 'someday' ? 'day' : todo.scope,
            completeTodo(todo).period ?? null, today),
        }),
        { label: t('Rückgängig'), run: () => updateTodo(todo.id, before) },
      );
    }
  };

  const toggleStep = (todo: Todo, stepId: ID) => {
    const steps = toggleStepIn(todo.steps, stepId);
    const all = steps.length > 0 && steps.every((item) => item.done);
    /*
     * Der letzte Teilschritt hakt die Aufgabe mit ab. Wer alle fuenf Schritte
     * abgehakt hat und danach noch einmal die Aufgabe selbst abhaken muesste,
     * fragt sich zu Recht, wofuer die Schritte gut waren.
     */
    updateTodo(todo.id, all ? { steps, ...completeTodo({ ...todo, steps }) } : { steps });
  };

  const addQuick = (title: string, period: string | null, scope: TodoScope) => {
    const todo = createTodo({
      title, scope, period, categoryId: filterCategory, order: Date.now(),
    });
    addTodo(todo);
    return todo;
  };

  const removeTodo = (todo: Todo) => {
    deleteTodo(todo.id);
    setEditing(null);
    toast.show(t('„{title}“ gelöscht', { title: todo.title || t('Aufgabe') }),
      { label: t('Rückgängig'), run: () => addTodo(todo) });
  };

  const takeOver = () => {
    const before = carry.map((todo) => ({ ...todo }));
    updateTodos(before.map((todo) => todo.id), { period: today, scope: 'day' });
    toast.show(
      before.length === 1 ? t('1 Aufgabe übernommen') : t('{count} Aufgaben übernommen', { count: before.length }),
      { label: t('Rückgängig'), run: () => before.forEach((todo) => updateTodo(todo.id, todo)) },
    );
  };

  const clearDone = () => {
    const removed = done.map((todo) => ({ ...todo }));
    deleteTodos(removed.map((todo) => todo.id));
    setConfirmClear(false);
    toast.show(t('{count} erledigte Aufgaben entfernt', { count: removed.length }),
      { label: t('Rückgängig'), run: () => removed.forEach((todo) => addTodo(todo)) });
  };

  /**
   * Verschieben innerhalb eines Korbes.
   *
   * Nur die Reihenfolge wandert, nicht das Datum: Wer in "Diese Woche" etwas
   * nach oben zieht, will es zuerst sehen und nicht auf einen anderen Tag
   * legen.
   */
  const reorder = (list: Todo[], from: number, to: number) => {
    if (from === to) return;
    const moved = [...list];
    const [item] = moved.splice(from, 1);
    moved.splice(to, 0, item);
    const base = Date.now();
    moved.forEach((todo, index) => updateTodo(todo.id, { order: base + index }));
    if (sort !== 'manual') setSort('manual');
  };

  if (view === 'stats') {
    return <TodoStats todos={todos} categories={categories} today={today} onBack={() => setView('list')} />;
  }

  /* ------------------------------------------------------------- Anzeige */

  return (
    <>
      <TodoHead counts={counts} />

      <QuickAdd
        category={categoryById(categories, filterCategory)}
        today={today}
        onAdd={addQuick}
        onDetails={(todo) => setEditing(todo.id)}
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
            {t('Alle')} <span className="mono dim">{open.length}</span>
          </button>
          {categories.map((category) => {
            const count = todos.filter((todo) => !todo.done && todo.categoryId === category.id).length;
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
        </div>
        <button className="btn btn--sm btn--icon" onClick={() => setMenuOpen(true)} aria-label={t('Mehr')}>
          <IconSettings />
        </button>
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

      {carry.length > 0 && !search && (
        <button className="todo-carry" onClick={takeOver}>
          <span className="todo-carry__text">
            {carry.length === 1
              ? t('1 Aufgabe ist liegen geblieben')
              : t('{count} Aufgaben sind liegen geblieben', { count: carry.length })}
          </span>
          <span className="todo-carry__action">{t('Auf heute holen')}</span>
        </button>
      )}

      {open.length === 0 && done.length === 0 ? (
        <EmptyState
          title={search || filterCategory ? t('Nichts gefunden') : t('Noch nichts vorgemerkt')}
          hint={search || filterCategory
            ? t('Andere Kategorie oder anderer Suchbegriff.')
            : t('Trag oben ein, was ansteht – ein Stichwort reicht. Datum, Kategorie und Teilschritte kommen später dazu.')}
        />
      ) : (
        <div className="todo-groups">
          {groups.map((group) => (
            <TodoGroup
              key={group.bucket}
              label={group.label}
              bucket={group.bucket}
              todos={group.todos}
              categories={categories}
              today={today}
              openState={collapsed[group.bucket] !== true}
              expanded={expanded}
              onCollapse={() => setCollapsed((value) => ({ ...value, [group.bucket]: !value[group.bucket] }))}
              onToggle={toggleDone}
              onToggleStep={toggleStep}
              onExpand={(id) => setExpanded((value) => ({ ...value, [id]: !value[id] }))}
              onEdit={(id) => setEditing(id)}
              onDelete={removeTodo}
              onReorder={reorder}
            />
          ))}

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
                <div className="todo-list">
                  {done.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      category={categoryById(categories, todo.categoryId)}
                      today={today}
                      expanded={expanded[todo.id] === true}
                      onToggle={() => toggleDone(todo)}
                      onToggleStep={(stepId) => toggleStep(todo, stepId)}
                      onExpand={() => setExpanded((value) => ({ ...value, [todo.id]: !value[todo.id] }))}
                      onEdit={() => setEditing(todo.id)}
                      onDelete={() => removeTodo(todo)}
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

      {menuOpen && (
        <TodoMenu
          sort={sort}
          hasDone={done.length > 0}
          onSort={setSort}
          onCategories={() => { setMenuOpen(false); setCategoriesOpen(true); }}
          onStats={() => { setMenuOpen(false); setView('stats'); }}
          onClearDone={() => { setMenuOpen(false); setConfirmClear(true); }}
          onClose={() => setMenuOpen(false)}
          todos={todos}
        />
      )}

      {editingTodo && (
        <TodoEditor
          todo={editingTodo}
          categories={categories}
          today={today}
          onChange={(patch) => updateTodo(editingTodo.id, patch)}
          onManageCategories={() => setCategoriesOpen(true)}
          onDelete={() => removeTodo(editingTodo)}
          onClose={() => setEditing(null)}
        />
      )}

      {categoriesOpen && <CategoryManager onClose={() => setCategoriesOpen(false)} />}

      {confirmClear && (
        <ConfirmDialog
          title={t('Erledigte entfernen?')}
          message={t('Die {count} abgehakten Aufgaben werden gelöscht. Rückgängig geht direkt danach.', { count: done.length })}
          onConfirm={clearDone}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------- Kopf */

/**
 * Der Kopf: ein Balken und eine Zeile.
 *
 * Vorher stand hier eine Karte mit Ring, Wochenbalken und Legende - zusammen
 * mit dem Zeitraum-Umschalter ein halber Bildschirm, bevor die erste Aufgabe
 * kam. Alles, was man beim Hinsehen wissen will, sind zwei Dinge: wie weit man
 * ist und ob etwas brennt. Der Rest steht jetzt unter "Auswertung".
 */
function TodoHead({ counts }: { counts: ReturnType<typeof tally> }) {
  const percent = counts.total === 0 ? 0 : Math.round((counts.weighted / counts.total) * 100);
  return (
    <div className="todo-head">
      <div className="todo-head__bar" role="img" aria-label={t('{percent} % erledigt', { percent })}>
        <div className="todo-head__fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="todo-head__line">
        <span className="mono bold">{percent} %</span>
        <span className="dim">·</span>
        <span>{t('{count} offen', { count: counts.open })}</span>
        {counts.done > 0 && <span className="pos">{t('{count} erledigt', { count: counts.done })}</span>}
        {counts.overdue > 0 && <span className="neg bold">{t('{count} überfällig', { count: counts.overdue })}</span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Schnelleingabe */

function QuickAdd({
  category, today, onAdd, onDetails,
}: {
  category: TodoCategory | undefined;
  today: string;
  onAdd: (title: string, period: string | null, scope: TodoScope) => Todo;
  onDetails: (todo: Todo) => void;
}) {
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const submit = (period: string | null, scope: TodoScope, openDetails = false) => {
    const title = text.trim();
    if (!title) return;
    const todo = onAdd(title, period, scope);
    setText('');
    if (openDetails) onDetails(todo);
    else input.current?.focus();
  };

  return (
    <div className="todo-add-wrap">
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
          onKeyDown={(event) => { if (event.key === 'Enter') submit(today, 'day'); }}
        />
        {text.trim() && (
          <button className="btn btn--sm btn--primary" onClick={() => submit(today, 'day')}>
            {t('Heute')}
          </button>
        )}
      </div>
      {/*
        * Die Ablagen erscheinen erst beim Tippen. Vier Knoepfe ueber einer
        * leeren Liste sind Ballast; vier Knoepfe, waehrend man tippt, sind
        * die Antwort auf die Frage "wann denn?".
        */}
      {text.trim() && (
        <div className="chip-scroll todo-add__when">
          <button className="chip chip--button" onClick={() => submit(addDays(today, 1), 'day')}>
            {t('Morgen')}
          </button>
          <button className="chip chip--button" onClick={() => submit(periodOf('week', today), 'week')}>
            {t('Diese Woche')}
          </button>
          <button className="chip chip--button" onClick={() => submit(periodOf('month', today), 'month')}>
            {t('Diesen Monat')}
          </button>
          <button className="chip chip--button" onClick={() => submit(null, 'someday')}>
            {t('Ohne Datum')}
          </button>
          <button className="chip chip--button" onClick={() => submit(today, 'day', true)}>
            <IconEdit style={{ width: 12, height: 12 }} /> {t('Details')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Gruppe */

/**
 * Ein Faelligkeits-Korb mit seinen Zeilen.
 *
 * Das Ziehen lebt hier und nicht in der Zeile: Nur die Gruppe kennt ihre
 * Nachbarn, und verschoben wird immer nur innerhalb eines Korbes - eine
 * Aufgabe von "Heute" nach "Morgen" zu ziehen waere eine Datumsaenderung, die
 * man nicht aus Versehen macht.
 */
function TodoGroup({
  label, bucket, todos, categories, today, openState, expanded,
  onCollapse, onToggle, onToggleStep, onExpand, onEdit, onDelete, onReorder,
}: {
  label: string;
  bucket: string;
  todos: Todo[];
  categories: TodoCategory[];
  today: string;
  openState: boolean;
  expanded: Record<ID, boolean>;
  onCollapse: () => void;
  onToggle: (todo: Todo) => void;
  onToggleStep: (todo: Todo, stepId: ID) => void;
  onExpand: (id: ID) => void;
  onEdit: (id: ID) => void;
  onDelete: (todo: Todo) => void;
  onReorder: (list: Todo[], from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<{ index: number; dy: number; height: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const startDrag = (index: number, event: React.PointerEvent) => {
    const row = (event.currentTarget as HTMLElement).closest('.todo-item') as HTMLElement | null;
    const height = (row?.offsetHeight ?? 56) + 8;
    const startY = event.clientY;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    setDrag({ index, dy: 0, height });

    const move = (moveEvent: PointerEvent) => setDrag((current) =>
      (current ? { ...current, dy: moveEvent.clientY - startY } : current));
    const end = (endEvent: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      const steps = Math.round((endEvent.clientY - startY) / height);
      const target = Math.min(todos.length - 1, Math.max(0, index + steps));
      setDrag(null);
      if (target !== index) onReorder(todos, index, target);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  /** Um wie viele Plaetze eine Zeile beiseite rueckt, solange gezogen wird. */
  const shiftOf = (index: number): number => {
    if (!drag) return 0;
    const target = Math.min(todos.length - 1, Math.max(0, drag.index + Math.round(drag.dy / drag.height)));
    if (index === drag.index) return 0;
    if (drag.index < target && index > drag.index && index <= target) return -drag.height;
    if (drag.index > target && index < drag.index && index >= target) return drag.height;
    return 0;
  };

  return (
    <div className="todo-group">
      <button className="todo-group__head" aria-expanded={openState} onClick={onCollapse}>
        <IconChevronDown
          className="todo-group__chevron"
          style={openState ? undefined : { transform: 'rotate(-90deg)' }}
        />
        <span className={`todo-group__pip todo-group__pip--${bucket}`} />
        <span className="todo-group__name">{label}</span>
        <span className="todo-group__count mono">{todos.length}</span>
      </button>
      {openState && (
        <div className="todo-list" ref={list}>
          {todos.map((todo, index) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              category={categoryById(categories, todo.categoryId)}
              today={today}
              expanded={expanded[todo.id] === true}
              dragging={drag?.index === index}
              offset={drag?.index === index ? drag.dy : shiftOf(index)}
              onDragStart={(event) => startDrag(index, event)}
              onToggle={() => onToggle(todo)}
              onToggleStep={(stepId) => onToggleStep(todo, stepId)}
              onExpand={() => onExpand(todo.id)}
              onEdit={() => onEdit(todo.id)}
              onDelete={() => onDelete(todo)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- Zeile */

/** Ab hier gilt ein Wischen als Handlung und nicht als verrutschter Finger. */
const SWIPE_TRIGGER = 88;

function TodoRow({
  todo, category, today, expanded, dragging = false, offset = 0,
  onDragStart, onToggle, onToggleStep, onExpand, onEdit, onDelete,
}: {
  todo: Todo;
  category: TodoCategory | undefined;
  today: string;
  expanded: boolean;
  dragging?: boolean;
  offset?: number;
  onDragStart?: (event: React.PointerEvent) => void;
  onToggle: () => void;
  onToggleStep: (stepId: ID) => void;
  onExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [swipe, setSwipe] = useState(0);
  const gesture = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const swiped = useRef(false);

  const progress = stepProgress(todo);
  const overdue = isOverdue(todo, today);
  const days = overdueDays(todo, today);
  const hasDetail = todo.steps.length > 0 || todo.note.trim().length > 0 || todo.photoIds.length > 0;

  /*
   * Wischen mit Zeigergeraeten statt nur mit dem Finger: Dieselbe Geste
   * funktioniert dann auch mit der Maus - und laesst sich pruefen.
   */
  const onPointerDown = (event: React.PointerEvent) => {
    if ((event.target as HTMLElement).closest('button, input, textarea, select, a')) return;
    gesture.current = { x: event.clientX, y: event.clientY, active: false };
  };
  const onPointerMove = (event: React.PointerEvent) => {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.active) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { gesture.current = null; return; }
      if (Math.abs(dx) < 10) return;
      start.active = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    setSwipe(dx);
  };
  const onPointerUp = () => {
    const start = gesture.current;
    gesture.current = null;
    if (!start?.active) { setSwipe(0); return; }
    const distance = swipe;
    setSwipe(0);
    /* Ein Wischen ist kein Antippen - der Klick danach darf nichts oeffnen. */
    swiped.current = true;
    window.setTimeout(() => { swiped.current = false; }, 60);
    if (distance >= SWIPE_TRIGGER) onToggle();
    else if (distance <= -SWIPE_TRIGGER) onDelete();
  };

  const openEditor = () => { if (!swiped.current) onEdit(); };

  const armed = Math.abs(swipe) >= SWIPE_TRIGGER;

  return (
    <div
      className={[
        'todo-item',
        todo.done ? 'todo-item--done' : '',
        overdue ? 'todo-item--overdue' : '',
        isPartlyDone(todo) ? 'todo-item--partly' : '',
        `todo-item--${todo.priority}`,
        dragging ? 'todo-item--dragging' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ...(category ? { '--cat': `var(--todo-cat-${category.color})` } : {}),
        ...(offset ? { transform: `translateY(${offset}px)` } : {}),
        ...(dragging || offset ? { transition: dragging ? 'none' : undefined } : {}),
      } as React.CSSProperties}
    >
      {/* Was beim Wischen darunter zum Vorschein kommt. */}
      <div className={`todo-item__behind ${armed ? 'todo-item__behind--armed' : ''}`} aria-hidden="true">
        <span className="todo-item__behind-left">
          <IconCheck /> {todo.done ? t('Öffnen') : t('Erledigt')}
        </span>
        <span className="todo-item__behind-right">
          {t('Löschen')} <IconTrash />
        </span>
      </div>

      <div
        className="todo-item__main"
        style={swipe ? { transform: `translateX(${swipe}px)`, transition: 'none' } : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
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

        {/*
          * Der Rumpf ist ein Knopf seiner Rolle nach, aber kein <button>:
          * Ein echter Knopf verschluckt die Wischgeste (siehe onPointerDown -
          * dort wird alles ignoriert, was in einem Bedienelement beginnt), und
          * dann liesse sich nur in der Luecke neben dem Kaestchen wischen.
          */}
        <span
          className="todo-item__body"
          role="button"
          tabIndex={0}
          onClick={openEditor}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onEdit(); }
          }}
        >
          <span className="todo-item__title">{todo.title}</span>
          {(category || todo.dueTime || progress || todo.priority === 'high' || todo.repeat
            || todo.note.trim() || overdue || todo.tags.length > 0 || todo.place) && (
            <span className="todo-item__meta">
              {todo.dueTime && (
                <span className={overdue ? 'todo-item__late' : 'todo-item__time'}>
                  <IconClock style={{ width: 11, height: 11 }} /> {todo.dueTime}
                  {todo.remindMin != null && <IconBell style={{ width: 10, height: 10 }} />}
                </span>
              )}
              {overdue && (
                <span className="todo-item__late">
                  {days === 1 ? t('1 Tag über') : t('{count} Tage über', { count: days })}
                </span>
              )}
              {category && (
                <span className="todo-item__cat">
                  <span className="todo-chip__dot" />
                  {category.icon} {category.name}
                </span>
              )}
              {progress && (
                <span className="todo-item__steps mono">
                  {progress.done}/{progress.total}
                  <span className="todo-item__meter">
                    <span className="todo-item__meter-fill" style={{ width: `${progress.ratio * 100}%` }} />
                  </span>
                </span>
              )}
              {todo.priority === 'high' && !todo.done && (
                <span className="todo-item__prio"><IconFlag style={{ width: 11, height: 11 }} /></span>
              )}
              {todo.repeat && (
                <span className="todo-item__repeat">
                  <IconRefresh style={{ width: 11, height: 11 }} />
                  {todo.streak > 0 ? t('{count}×', { count: todo.streak }) : ''}
                </span>
              )}
              {todo.tags.map((tag) => <span key={tag} className="todo-item__tag">#{tag}</span>)}
              {todo.place && <span className="dim">{todo.place}</span>}
              {todo.note.trim() && <IconNote style={{ width: 11, height: 11 }} />}
            </span>
          )}
        </span>

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

        {onDragStart && (
          <span
            className="todo-item__grip"
            role="button"
            tabIndex={-1}
            aria-label={t('Verschieben')}
            onPointerDown={onDragStart}
          >
            <IconDrag />
          </span>
        )}
      </div>

      {expanded && hasDetail && (
        <div className="todo-item__detail">
          {todo.note.trim() && <p className="small muted todo-item__note">{todo.note}</p>}
          {todo.steps.map((step) => (
            <div key={step.id}>
              <StepRow step={step} onToggle={() => onToggleStep(step.id)} />
              {step.children?.map((child) => (
                <StepRow key={child.id} step={child} nested onToggle={() => onToggleStep(child.id)} />
              ))}
            </div>
          ))}
          {todo.photoIds.length > 0 && <TodoPhotos ids={todo.photoIds} />}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, nested = false, onToggle }: { step: TodoStep; nested?: boolean; onToggle: () => void }) {
  return (
    <button
      className={`todo-step ${step.done ? 'todo-step--done' : ''} ${nested ? 'todo-step--nested' : ''}`}
      role="checkbox"
      aria-checked={step.done}
      onClick={onToggle}
    >
      <span className="todo-step__box">{step.done && <IconCheck />}</span>
      <span className="todo-step__text">{step.text}</span>
    </button>
  );
}

/** Angehaengte Bilder. Sie liegen im Geraet, deshalb werden sie hier geladen. */
function TodoPhotos({ ids }: { ids: string[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    void loadTodoPhotos(ids).then((photos) => {
      if (!alive) return;
      for (const photo of photos) made.push(URL.createObjectURL(photo.blob));
      setUrls(made);
    });
    return () => {
      alive = false;
      made.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [ids]);

  if (urls.length === 0) return null;
  return (
    <div className="todo-shots">
      {urls.map((url) => <img key={url} src={url} alt="" loading="lazy" />)}
    </div>
  );
}

/* -------------------------------------------------------------------- Menü */

function TodoMenu({
  sort, hasDone, todos, onSort, onCategories, onStats, onClearDone, onClose,
}: {
  sort: TodoSort;
  hasDone: boolean;
  todos: Todo[];
  onSort: (sort: TodoSort) => void;
  onCategories: () => void;
  onStats: () => void;
  onClearDone: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const dated = todos.filter((todo) => !todo.done && todo.period && todo.dueTime);

  const exportIcs = () => {
    const blob = new Blob([todosToIcs(todos)], { type: 'text/calendar' });
    void saveBlob('gym-tracker-aufgaben.ics', blob);
    onClose();
  };

  const askNotifications = async () => {
    try {
      const result = await Notification.requestPermission();
      toast.show(result === 'granted' ? t('Meldungen erlaubt') : t('Meldungen bleiben aus'));
    } catch {
      toast.show(t('Dieser Browser kann das nicht'));
    }
    onClose();
  };

  const canAsk = typeof Notification !== 'undefined' && Notification.permission === 'default';

  return (
    <Modal title={t('Aufgabenliste')} onClose={onClose}>
      <div className="list">
        <div className="field">
          <span className="field__label">{t('Sortierung innerhalb der Abschnitte')}</span>
          <div className="row" style={{ gap: 6 }}>
            {(Object.keys(SORT_LABELS) as TodoSort[]).map((key) => (
              <button
                key={key}
                className={`chip chip--button ${sort === key ? 'chip--accent' : ''}`}
                onClick={() => onSort(key)}
              >
                {t(SORT_LABELS[key])}
              </button>
            ))}
          </div>
        </div>

        <div className="divider" />

        <button className="link-row" onClick={onStats}>
          <IconChart /> <span style={{ flex: 1 }}>{t('Auswertung & Gewohnheiten')}</span>
        </button>
        <button className="link-row" onClick={onCategories}>
          <IconEdit /> <span style={{ flex: 1 }}>{t('Kategorien')}</span>
        </button>
        <button className="link-row" onClick={exportIcs} disabled={dated.length === 0}>
          <IconCalendar />
          <span style={{ flex: 1 }}>
            {t('In den Kalender exportieren')}
            <span className="tiny dim" style={{ display: 'block' }}>
              {dated.length === 0
                ? t('Dafür braucht eine Aufgabe Datum und Uhrzeit.')
                : t('{count} Aufgaben mit Uhrzeit', { count: dated.length })}
            </span>
          </span>
        </button>
        {canAsk && (
          <button className="link-row" onClick={askNotifications}>
            <IconBell />
            <span style={{ flex: 1 }}>
              {t('Meldungen erlauben')}
              <span className="tiny dim" style={{ display: 'block' }}>
                {t('Nur solange die App offen ist – mehr kann eine Web-App nicht.')}
              </span>
            </span>
          </button>
        )}
        {hasDone && (
          <button className="link-row" onClick={onClearDone}>
            <IconTrash /> <span style={{ flex: 1 }}>{t('Erledigte entfernen')}</span>
          </button>
        )}
      </div>
    </Modal>
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
  const { getExercise } = useStore();
  const [stepText, setStepText] = useState('');
  const [subFor, setSubFor] = useState<ID | null>(null);
  const [subText, setSubText] = useState('');
  const [tagText, setTagText] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [pickExercise, setPickExercise] = useState(false);
  const [more, setMore] = useState(
    () => todo.tags.length > 0 || todo.place !== '' || todo.exerciseId !== null || todo.photoIds.length > 0,
  );

  const anchor = todo.period ?? today;
  const linked = todo.exerciseId ? getExercise(todo.exerciseId) : undefined;

  const addStep = () => {
    const text = stepText.trim();
    if (!text) return;
    onChange({ steps: [...todo.steps, createStep(text)] });
    setStepText('');
  };

  const addSub = (parentId: ID) => {
    const text = subText.trim();
    if (!text) return;
    onChange({
      steps: todo.steps.map((step) => (step.id === parentId
        ? { ...step, done: false, children: [...(step.children ?? []), createStep(text)] }
        : step)),
    });
    setSubText('');
  };

  const addTag = () => {
    const tag = tagText.trim().replace(/^#/, '');
    if (!tag || todo.tags.includes(tag)) { setTagText(''); return; }
    onChange({ tags: [...todo.tags, tag] });
    setTagText('');
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const id = await addTodoPhoto(todo.id, file);
    if (id) onChange({ photoIds: [...todo.photoIds, id] });
  };

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
            <button className="chip chip--button" onClick={onManageCategories} aria-label={t('Kategorien')}>
              <IconPlus style={{ width: 12, height: 12 }} />
            </button>
          </div>
        </div>

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

        <div className="divider" />

        <div className="grid-2">
          <label className="field">
            <span className="field__label">{t('Zeitraum')}</span>
            <select
              className="select"
              aria-label={t('Zeitraum')}
              value={todo.scope}
              onChange={(event) => {
                const scope = event.target.value as TodoScope;
                onChange({
                  scope,
                  period: periodOf(scope, anchor),
                  ...(scope !== 'day' ? { dueTime: null, remindMin: null } : {}),
                });
              }}
            >
              {TODO_SCOPES.map((scope) => (
                <option key={scope} value={scope}>{t(SCOPE_NAMES[scope])}</option>
              ))}
            </select>
          </label>

          {todo.scope !== 'someday' && (
            <div className="field">
              <span className="field__label">{todo.scope === 'day' ? t('Tag') : t('Ein Tag darin')}</span>
              <DateInput
                value={anchor}
                ariaLabel={t('Tag')}
                onChange={(value) => { if (value) onChange({ period: periodOf(todo.scope, value) }); }}
              />
            </div>
          )}
        </div>

        {todo.scope !== 'someday' && todo.scope !== 'day' && (
          <p className="tiny dim" style={{ margin: 0 }}>{periodDate(todo.scope, todo.period)}</p>
        )}

        {/*
          * Uhrzeit nur bei einer Tagesaufgabe: "diese Woche um 17 Uhr" ist
          * keine Uhrzeit, sondern ein Missverstaendnis.
          */}
        {todo.scope === 'day' && (
          <div className="grid-2">
            <div className="field">
              <span className="field__label">{t('Uhrzeit')}</span>
              {todo.dueTime ? (
                <div className="row" style={{ gap: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TimeInput
                      value={todo.dueTime}
                      ariaLabel={t('Uhrzeit')}
                      onChange={(value) => onChange({ dueTime: value || null })}
                    />
                  </div>
                  <button
                    className="btn btn--ghost btn--icon"
                    aria-label={t('Uhrzeit entfernen')}
                    onClick={() => onChange({ dueTime: null, remindMin: null })}
                  >
                    <IconX />
                  </button>
                </div>
              ) : (
                <button className="btn btn--sm" onClick={() => onChange({ dueTime: '18:00' })}>
                  <IconClock /> {t('Uhrzeit setzen')}
                </button>
              )}
            </div>

            {todo.dueTime && (
              <label className="field">
                <span className="field__label">{t('Erinnerung')}</span>
                <select
                  className="select"
                  aria-label={t('Erinnerung')}
                  value={todo.remindMin ?? ''}
                  onChange={(event) => onChange({
                    remindMin: event.target.value === '' ? null : Number(event.target.value),
                    remindedOn: null,
                  })}
                >
                  <option value="">{t('Keine')}</option>
                  {REMIND_CHOICES.map((choice) => (
                    <option key={choice.minutes} value={choice.minutes}>{t(choice.label)}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {todo.scope === 'day' && todo.dueTime && todo.remindMin != null && (
          <p className="tiny dim" style={{ margin: 0 }}>
            {t('Die Erinnerung erscheint, sobald die App offen ist. Für alles andere gibt es den Kalender-Export.')}
          </p>
        )}

        <div className="grid-2">
          <label className="field">
            <span className="field__label">{t('Wiederholung')}</span>
            <select
              className="select"
              aria-label={t('Wiederholung')}
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

        {todo.repeat && todo.doneDates.length > 0 && (
          <HabitStrip todo={todo} today={today} />
        )}

        <div className="divider" />

        <div className="row row--between">
          <span className="section-label">{t('Teilschritte')}</span>
          {todo.steps.length > 0 && (
            <span className="tiny dim">
              {t('{done} von {total}', {
                done: todo.steps.filter((step) => step.done).length,
                total: todo.steps.length,
              })}
            </span>
          )}
        </div>

        {todo.steps.map((step) => (
          <div key={step.id} className="todo-edit-step">
            <div className="row" style={{ gap: 6 }}>
              <button
                className={`todo-step__box todo-step__box--wide ${step.done ? 'todo-step__box--on' : ''}`}
                role="checkbox"
                aria-checked={step.done}
                aria-label={step.done ? t('Wieder öffnen') : t('Abhaken')}
                onClick={() => onChange({ steps: toggleStepIn(todo.steps, step.id) })}
              >
                {step.done && <IconCheck />}
              </button>
              <input
                className="input"
                value={step.text}
                aria-label={t('Teilschritt')}
                onChange={(event) => onChange({ steps: editStepIn(todo.steps, step.id, event.target.value) })}
              />
              <button
                className="btn btn--ghost btn--icon"
                aria-label={t('Unterpunkt hinzufügen')}
                onClick={() => { setSubFor(subFor === step.id ? null : step.id); setSubText(''); }}
              >
                <IconPlus />
              </button>
              <button
                className="btn btn--ghost btn--icon"
                aria-label={t('Teilschritt entfernen')}
                onClick={() => onChange({ steps: removeStepIn(todo.steps, step.id) })}
              >
                <IconX />
              </button>
            </div>

            {step.children?.map((child) => (
              <div key={child.id} className="row todo-edit-step__child" style={{ gap: 6 }}>
                <button
                  className={`todo-step__box ${child.done ? 'todo-step__box--on' : ''}`}
                  role="checkbox"
                  aria-checked={child.done}
                  aria-label={child.done ? t('Wieder öffnen') : t('Abhaken')}
                  onClick={() => onChange({ steps: toggleStepIn(todo.steps, child.id) })}
                >
                  {child.done && <IconCheck />}
                </button>
                <input
                  className="input input--sm"
                  value={child.text}
                  aria-label={t('Unterpunkt')}
                  onChange={(event) => onChange({ steps: editStepIn(todo.steps, child.id, event.target.value) })}
                />
                <button
                  className="btn btn--ghost btn--icon"
                  aria-label={t('Teilschritt entfernen')}
                  onClick={() => onChange({ steps: removeStepIn(todo.steps, child.id) })}
                >
                  <IconX />
                </button>
              </div>
            ))}

            {subFor === step.id && (
              <div className="row todo-edit-step__child" style={{ gap: 6 }}>
                <input
                  className="input input--sm"
                  autoFocus
                  value={subText}
                  placeholder={t('Unterpunkt …')}
                  aria-label={t('Unterpunkt')}
                  onChange={(event) => setSubText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') addSub(step.id); }}
                />
                <button className="btn btn--sm" onClick={() => addSub(step.id)}>{t('Hinzufügen')}</button>
              </div>
            )}
          </div>
        ))}

        <div className="row" style={{ gap: 6 }}>
          <input
            className="input"
            value={stepText}
            placeholder={t('Teilschritt hinzufügen …')}
            aria-label={t('Teilschritt hinzufügen')}
            onChange={(event) => setStepText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') addStep(); }}
          />
          <button className="btn btn--icon" onClick={addStep} aria-label={t('Teilschritt hinzufügen')}>
            <IconPlus />
          </button>
        </div>

        <div className="divider" />

        {/*
          * Alles Weitere liegt hinter einem Knopf: Die meisten Aufgaben
          * brauchen weder Schlagwort noch Ort noch Foto, und ein Dialog, in
          * dem man an sieben leeren Feldern vorbeiscrollt, erzieht dazu, ihn
          * gar nicht erst zu oeffnen.
          */}
        {!more ? (
          <button className="btn btn--sm btn--flush" onClick={() => setMore(true)}>
            {t('Schlagworte, Ort, Übung, Bilder …')}
          </button>
        ) : (
          <>
            <div className="field">
              <span className="field__label">{t('Schlagworte')}</span>
              <div className="row row--wrap" style={{ gap: 6 }}>
                {todo.tags.map((tag) => (
                  <button
                    key={tag}
                    className="chip chip--button"
                    aria-label={t('Schlagwort {tag} entfernen', { tag })}
                    onClick={() => onChange({ tags: todo.tags.filter((item) => item !== tag) })}
                  >
                    #{tag} <IconX style={{ width: 11, height: 11 }} />
                  </button>
                ))}
              </div>
              <div className="row" style={{ gap: 6, marginTop: 6 }}>
                <input
                  className="input input--sm"
                  value={tagText}
                  placeholder={t('Schlagwort …')}
                  aria-label={t('Schlagwort')}
                  onChange={(event) => setTagText(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') addTag(); }}
                />
                <button className="btn btn--sm" onClick={addTag}>{t('Hinzufügen')}</button>
              </div>
            </div>

            <label className="field">
              <span className="field__label">{t('Ort')}</span>
              <input
                className="input"
                value={todo.place}
                placeholder={t('Studio, Rewe, zu Hause …')}
                onChange={(event) => onChange({ place: event.target.value })}
              />
            </label>

            <div className="field">
              <span className="field__label">{t('Gehört zu einer Übung')}</span>
              {linked ? (
                <div className="row" style={{ gap: 6 }}>
                  <span className="chip chip--accent" style={{ flex: 1, minWidth: 0 }}>
                    <IconDumbbell style={{ width: 12, height: 12 }} /> {exerciseName(linked)}
                  </span>
                  <button
                    className="btn btn--ghost btn--icon"
                    aria-label={t('Verknüpfung lösen')}
                    onClick={() => onChange({ exerciseId: null })}
                  >
                    <IconX />
                  </button>
                </div>
              ) : (
                <button className="btn btn--sm" onClick={() => setPickExercise(true)}>
                  <IconDumbbell /> {t('Übung wählen')}
                </button>
              )}
            </div>

            {todoFilesAvailable() && (
              <div className="field">
                <span className="field__label">{t('Bilder')}</span>
                {todo.photoIds.length > 0 && <TodoPhotos ids={todo.photoIds} />}
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  <label className="btn btn--sm">
                    <IconPlus /> {t('Bild anhängen')}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(event) => { void pickPhoto(event.target.files?.[0]); event.target.value = ''; }}
                    />
                  </label>
                  {todo.photoIds.length > 0 && (
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => {
                        const last = todo.photoIds[todo.photoIds.length - 1];
                        void deleteTodoPhoto(last);
                        onChange({ photoIds: todo.photoIds.slice(0, -1) });
                      }}
                    >
                      {t('Letztes entfernen')}
                    </button>
                  )}
                </div>
                <span className="field__hint">
                  {t('Bilder bleiben auf diesem Gerät – sie wandern weder in die Sicherung noch zu Freunden.')}
                </span>
              </div>
            )}
          </>
        )}

        <button className="btn btn--danger btn--block" onClick={() => setConfirm(true)}>
          <IconTrash /> {t('Aufgabe löschen')}
        </button>
      </div>

      {pickExercise && (
        <ExercisePicker
          title={t('Übung verknüpfen')}
          onPick={(exercise) => { onChange({ exerciseId: exercise.id }); setPickExercise(false); }}
          onClose={() => setPickExercise(false)}
        />
      )}

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

/* ------------------------------------------------------- Auswertung */

/**
 * Vier Monate einer Gewohnheit als Raster - eine Spalte je Woche.
 *
 * Acht Wochen waren zu wenig: Bei etwas Monatlichem stand dort ein leeres
 * Feld mit zwei Punkten, und genau daran sieht man keine Gewohnheit. Sechzehn
 * Wochen zeigen den Rhythmus und passen noch auf ein Handy.
 */
const HABIT_WEEKS = 16;

function HabitStrip({ todo, today }: { todo: Todo; today: string }) {
  const stats = habitStats(todo, today);
  const done = new Set(stats.days);
  const start = addDays(startOfWeek(today), -7 * (HABIT_WEEKS - 1));
  const weeks = Array.from({ length: HABIT_WEEKS }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)));

  return (
    <div className="habit">
      <div className="habit__grid" role="img" aria-label={t('{count} Tage erledigt', { count: stats.days.length })}>
        {weeks.map((week) => (
          <div key={week[0]} className="habit__week">
            {week.map((day) => (
              <span
                key={day}
                title={`${formatDateTiny(day)}${done.has(day) ? ` · ${t('erledigt')}` : ''}`}
                className={[
                  'habit__cell',
                  done.has(day) ? 'habit__cell--on' : '',
                  day > today ? 'habit__cell--future' : '',
                  day === today ? 'habit__cell--today' : '',
                ].filter(Boolean).join(' ')}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="tiny dim habit__legend">
        {t('{streak} am Stück · bestens {best} · {last30} von 30 Tagen', {
          streak: stats.streak, best: stats.best, last30: stats.last30,
        })}
      </div>
    </div>
  );
}

function TodoStats({
  todos, categories, today, onBack,
}: {
  todos: Todo[];
  categories: TodoCategory[];
  today: string;
  onBack: () => void;
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
  const weekDone = week.reduce((sum, day) => sum + day.done, 0);
  const habits = todos.filter((todo) => todo.repeat);
  const byCategory = useMemo(
    () => doneByCategory(todos, categories, addDays(today, -29), today),
    [todos, categories, today],
  );
  const total = byCategory.reduce((sum, row) => sum + row.count, 0);
  const allDone = todos.reduce((sum, todo) => sum + (todo.doneDates?.length ?? 0), 0);

  return (
    <>
      <div className="row">
        <button className="btn btn--sm" onClick={onBack}><IconChevronLeft /> {t('Zur Liste')}</button>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">{t('Diese Woche')}</div>
          <span className="tiny dim">{t('{count} erledigt', { count: weekDone })}</span>
        </div>
        <div className="todo-week">
          {week.map((day) => (
            <div
              key={day.date}
              className="todo-week__col"
              title={t('{weekday}: {done} erledigt, {open} offen', {
                weekday: t(WEEKDAY_SHORT[day.index]), done: day.done, open: day.open,
              })}
            >
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
          <span>{t('{count} insgesamt erledigt', { count: allDone })}</span>
        </div>
      </div>

      <div className="card">
        <div className="card__header">
          <div className="card__title">{t('Letzte 30 Tage je Kategorie')}</div>
          <span className="tiny dim">{t('{count} erledigt', { count: total })}</span>
        </div>
        {byCategory.length === 0 ? (
          <p className="tiny dim" style={{ margin: 0 }}>{t('Noch nichts abgehakt.')}</p>
        ) : (
          <div className="todo-bars">
            {byCategory.map((row) => (
              <div
                key={row.category?.id ?? 'none'}
                className="todo-bars__row"
                style={{ '--cat': row.category ? `var(--todo-cat-${row.category.color})` : 'var(--border)' } as React.CSSProperties}
              >
                <span className="todo-bars__label">
                  <span className="todo-chip__dot" />
                  {row.category ? `${row.category.icon} ${row.category.name}` : t('Ohne Kategorie')}
                </span>
                <span className="todo-bars__track">
                  <span className="todo-bars__fill" style={{ width: `${(row.count / (byCategory[0]?.count || 1)) * 100}%` }} />
                </span>
                <span className="todo-bars__value mono">{fmt(row.count)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card__title" style={{ marginBottom: 10 }}>{t('Gewohnheiten')}</div>
        {habits.length === 0 ? (
          <p className="tiny dim" style={{ margin: 0 }}>
            {t('Noch keine wiederkehrende Aufgabe. Stell im Dialog einer Aufgabe eine Wiederholung ein – dann steht hier, wie oft sie geklappt hat.')}
          </p>
        ) : (
          <div className="list">
            {habits.map((todo) => (
              <div key={todo.id} className="todo-habit">
                <div className="row row--between">
                  <span className="bold small">{todo.title}</span>
                  <span className="tiny dim">{t(REPEAT_LABELS[todo.repeat!.every])}</span>
                </div>
                <HabitStrip todo={todo} today={today} />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
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
      id: uid('tcat'), name: trimmed, color: nextColor(categories), icon: '',
    };
    upsertTodoCategory(category);
    setName('');
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
