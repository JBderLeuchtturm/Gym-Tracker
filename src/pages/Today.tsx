import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Exercise, LoggedExercise, PlanExercise, SetLog, Workout } from '../types';
import {
  WEEKDAY_SHORT, addDays, formatClock, formatDateShort, parseISODate, relativeDayLabel,
  startOfWeek, todayISO, weekdayOf,
} from '../lib/date';
import { calcWorkoutBurn } from '../lib/calories';
import { detectRecord, suggestWeight, warmupSets, type NewRecord } from '../lib/coaching';
import { exerciseVolume, lastPerformance, workoutSetCount, workoutVolume } from '../lib/stats';
import { useStore } from '../storage/store';
import { uid } from '../storage/defaults';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { ConfirmDialog, EmptyState, NumberInput, fmt, useToast } from '../components/ui';
import { ProgressRing } from '../components/ProgressRing';
import { CATEGORY_ICONS, categoryColor, categoryTint } from '../lib/categoryColors';
import {
  IconCheck, IconChart, IconChevronDown, IconChevronLeft, IconChevronRight, IconClock,
  IconPlus, IconTrash, IconX,
} from '../components/icons';

/* ------------------------------------------------------------ Zeilenmodell */

interface Row {
  key: string;
  exerciseId: string;
  exercise: Exercise | undefined;
  planExercise?: PlanExercise;
  logged?: LoggedExercise;
  sets: SetLog[];
  fromPlan: boolean;
  /** Uebungen mit derselben Gruppe bilden einen Supersatz. */
  groupId?: string;
}

const newSet = (partial: Partial<SetLog> = {}): SetLog => ({
  id: uid('set'),
  reps: null,
  weightKg: null,
  durationSec: null,
  distanceKm: null,
  rpe: null,
  done: false,
  isWarmup: false,
  ...partial,
});

/* ------------------------------------------------------------------ Seite */

export function TodayPage() {
  const {
    state, getExercise, upsertWorkout, deleteWorkout,
  } = useStore();
  const toast = useToast();

  const [date, setDate] = useState(todayISO());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [record, setRecord] = useState<{ name: string; record: NewRecord } | null>(null);

  const plan = state.plans.find((item) => item.id === state.activePlanId) ?? null;
  const planDay = plan?.days[weekdayOf(date)] ?? null;
  const workout = state.workouts.find((item) => item.date === date);

  /* Plan-Übungen und bereits geloggte Übungen zu einer Liste zusammenführen. */
  const rows: Row[] = useMemo(() => {
    const result: Row[] = [];
    const usedLoggedIds = new Set<string>();

    for (const planExercise of planDay?.exercises ?? []) {
      const logged = workout?.exercises.find(
        (item) =>
          !usedLoggedIds.has(item.id) &&
          (item.planExerciseId === planExercise.id || item.exerciseId === planExercise.exerciseId),
      );
      if (logged) usedLoggedIds.add(logged.id);

      const exercise = getExercise(planExercise.exerciseId);
      const previous = lastPerformance(state, planExercise.exerciseId, date);

      const draftSets = Array.from({ length: Math.max(1, planExercise.targetSets) }, (_, index) => {
        const reference = previous?.sets[index] ?? previous?.sets[previous.sets.length - 1];
        return newSet({
          reps: reference?.reps ?? planExercise.targetRepsMin ?? null,
          weightKg: reference?.weightKg ?? planExercise.targetWeightKg ?? null,
          durationSec: reference?.durationSec ?? null,
        });
      });

      result.push({
        key: logged?.id ?? `plan:${planExercise.id}`,
        exerciseId: planExercise.exerciseId,
        exercise,
        planExercise,
        logged,
        sets: logged?.sets ?? draftSets,
        fromPlan: true,
        groupId: logged?.groupId ?? planExercise.groupId,
      });
    }

    for (const logged of workout?.exercises ?? []) {
      if (usedLoggedIds.has(logged.id)) continue;
      result.push({
        key: logged.id,
        exerciseId: logged.exerciseId,
        exercise: getExercise(logged.exerciseId),
        logged,
        sets: logged.sets,
        fromPlan: false,
        groupId: logged.groupId,
      });
    }

    // Eigene Reihenfolge des Tages beruecksichtigen, falls eine gesetzt wurde.
    const order = workout?.exerciseOrder;
    if (order && order.length > 0) {
      const rank = new Map(order.map((id, index) => [id, index]));
      result.sort((a, b) => (rank.get(a.exerciseId) ?? 999) - (rank.get(b.exerciseId) ?? 999));
    }

    return result;
  }, [planDay, workout, getExercise, state, date]);

  /** Schreibt eine Änderung - legt die Übung im Workout an, falls noch virtuell. */
  const updateRow = useCallback(
    (row: Row, mutate: (logged: LoggedExercise) => LoggedExercise) => {
      upsertWorkout(date, (current) => {
        const existing = row.logged && current.exercises.some((item) => item.id === row.logged!.id)
          ? row.logged
          : null;

        let exercises: LoggedExercise[];
        if (existing) {
          exercises = current.exercises.map((item) => (item.id === existing.id ? mutate(item) : item));
        } else {
          const created: LoggedExercise = {
            id: uid('le'),
            exerciseId: row.exerciseId,
            planExerciseId: row.planExercise?.id,
            sets: row.sets.map((set) => ({ ...set })),
          };
          exercises = [...current.exercises, mutate(created)];
        }

        return {
          ...current,
          exercises,
          planId: plan?.id,
          planDayIndex: weekdayOf(date),
          title: current.title || planDay?.title || '',
          bodyWeightKg: current.bodyWeightKg ?? state.profile.weightKg,
        };
      });
    },
    [upsertWorkout, date, plan?.id, planDay?.title, state.profile.weightKg],
  );

  const startRest = useCallback((seconds: number) => {
    setRestEndsAt(Date.now() + seconds * 1000);
  }, []);

  const toggleSet = (row: Row, setId: string) => {
    // Der Zustand vor dem Klick entscheidet, ob die Pause startet - der
    // State-Updater unten laeuft erst spaeter und taugt dafuer nicht.
    const target = row.sets.find((set) => set.id === setId);
    const becameDone = !target?.done;

    updateRow(row, (logged) => ({
      ...logged,
      sets: logged.sets.map((set) => (set.id === setId ? { ...set, done: !set.done } : set)),
    }));

    if (!becameDone || !target) return;

    // Ist der Satz eine Bestleistung? Dann kurz feiern.
    const beaten = detectRecord(state, row.exerciseId, target, date);
    if (beaten) {
      setRecord({ name: row.exercise?.name ?? 'Übung', record: beaten });
      navigator.vibrate?.([25, 40, 25]);
    }

    // Beim Supersatz erst nach der letzten Uebung der Gruppe pausieren.
    if (row.groupId) {
      const group = rows.filter((item) => item.groupId === row.groupId);
      const isLast = group[group.length - 1]?.exerciseId === row.exerciseId;
      if (!isLast) return;
    }

    const rest = row.planExercise?.restSec ?? state.settings.restTimerSec;
    if (rest > 0) startRest(rest);
  };

  const addSet = (row: Row) => {
    updateRow(row, (logged) => {
      const last = logged.sets[logged.sets.length - 1];
      return {
        ...logged,
        sets: [
          ...logged.sets,
          newSet({ reps: last?.reps ?? null, weightKg: last?.weightKg ?? null, durationSec: last?.durationSec ?? null }),
        ],
      };
    });
  };

  const addExercise = (exercise: Exercise) => {
    const previous = lastPerformance(state, exercise.id, date);
    const sets = Array.from({ length: previous?.sets.length || 3 }, (_, index) => {
      const reference = previous?.sets[index];
      return newSet({
        reps: reference?.reps ?? null,
        weightKg: reference?.weightKg ?? null,
        durationSec: reference?.durationSec ?? null,
      });
    });

    upsertWorkout(date, (current) => ({
      ...current,
      title: current.title || planDay?.title || 'Freies Training',
      planId: plan?.id,
      planDayIndex: weekdayOf(date),
      bodyWeightKg: current.bodyWeightKg ?? state.profile.weightKg,
      exercises: [...current.exercises, { id: uid('le'), exerciseId: exercise.id, sets }],
    }));

    setPickerOpen(false);
    toast.show(`„${exercise.name}“ hinzugefügt`);
  };

  /** Verschiebt eine Uebung im Tagesablauf und haelt die Reihenfolge fest. */
  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const ids = rows.map((row) => row.exerciseId);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    upsertWorkout(date, (current) => ({
      ...current,
      planId: plan?.id,
      planDayIndex: weekdayOf(date),
      title: current.title || planDay?.title || '',
      exerciseOrder: ids,
    }));
  };

  /** Fasst eine Uebung mit der darueberliegenden zu einem Supersatz zusammen. */
  const toggleSuperset = (index: number) => {
    if (index <= 0) return;
    const row = rows[index];
    const above = rows[index - 1];
    const groupId = row.groupId && row.groupId === above.groupId
      ? undefined
      : (above.groupId ?? uid('grp'));

    for (const item of [above, row]) {
      if (groupId === undefined && item !== row) continue; // beim Loesen nur die untere loesen
      updateRow(item, (logged) => ({ ...logged, groupId }));
    }
  };

  const startSession = () => {
    upsertWorkout(date, (current) => ({
      ...current,
      planId: plan?.id,
      planDayIndex: weekdayOf(date),
      title: current.title || planDay?.title || 'Training',
      bodyWeightKg: current.bodyWeightKg ?? state.profile.weightKg,
      startedAt: new Date().toISOString(),
      endedAt: null,
    }));
  };

  const stopSession = () => {
    upsertWorkout(date, (current) => {
      const started = current.startedAt ? new Date(current.startedAt).valueOf() : null;
      const minutes = started ? Math.max(1, Math.round((Date.now() - started) / 60000)) : current.durationMin;
      return { ...current, endedAt: new Date().toISOString(), durationMin: minutes };
    });
    toast.show('Training beendet');
  };

  const removeRow = (row: Row) => {
    if (!row.logged) return;
    upsertWorkout(date, (current) => ({
      ...current,
      exercises: current.exercises.filter((item) => item.id !== row.logged!.id),
    }));
  };

  /* ------------------------------------------------------------ Kennzahlen */

  const stats = useMemo(() => {
    if (!workout) return { sets: 0, volume: 0, kcal: 0, minutes: 0 };
    const burn = calcWorkoutBurn(workout, getExercise, state.profile.weightKg, state.settings.restTimerSec);
    return {
      sets: workoutSetCount(workout),
      volume: workoutVolume(workout),
      kcal: burn.kcal,
      minutes: burn.minutes,
    };
  }, [workout, getExercise, state.profile.weightKg, state.settings.restTimerSec]);

  const plannedSets = rows.reduce(
    (sum, row) => sum + (row.planExercise?.targetSets ?? row.sets.length), 0,
  );
  const progress = plannedSets > 0 ? Math.min(100, (stats.sets / plannedSets) * 100) : 0;

  return (
    <>
      <WeekStrip date={date} onSelect={setDate} workouts={state.workouts} />

      <div className="row row--between">
        <button className="btn btn--ghost btn--icon" onClick={() => setDate(addDays(date, -1))} aria-label="Vorheriger Tag">
          <IconChevronLeft />
        </button>
        <div className="center" style={{ flex: 1, minWidth: 0 }}>
          <div className="bold">{relativeDayLabel(date)}</div>
          <div className="tiny dim">
            {planDay && !planDay.isRestDay ? planDay.title : planDay ? 'Ruhetag laut Plan' : 'Kein Plan aktiv'}
          </div>
        </div>
        <button className="btn btn--ghost btn--icon" onClick={() => setDate(addDays(date, 1))} aria-label="Nächster Tag">
          <IconChevronRight />
        </button>
      </div>

      {date !== todayISO() && (
        <button className="btn btn--sm" style={{ alignSelf: 'center' }} onClick={() => setDate(todayISO())}>
          Zurück zu heute
        </button>
      )}

      {(stats.sets > 0 || rows.length > 0) && (
        <div className="hero">
          <ProgressRing value={stats.sets} max={plannedSets || stats.sets || 1} size={92}>
            <div className="hero__ring-value">
              {plannedSets > 0 ? `${Math.round(progress)}%` : stats.sets}
            </div>
            <div className="hero__ring-unit">{plannedSets > 0 ? 'geschafft' : 'Sätze'}</div>
          </ProgressRing>

          <div className="hero__facts">
            <div className="hero__fact">
              <span className="hero__fact-label">Sätze</span>
              <span className="hero__fact-value">
                {stats.sets}
                {plannedSets > 0 && <span className="hero__fact-unit">von {plannedSets}</span>}
              </span>
            </div>
            <div className="hero__fact">
              <span className="hero__fact-label">Volumen</span>
              <span className="hero__fact-value">
                {fmt(stats.volume)}<span className="hero__fact-unit">kg</span>
              </span>
            </div>
            <div className="hero__fact">
              <span className="hero__fact-label">Verbrauch</span>
              <span className="hero__fact-value" style={{ color: 'var(--warn)' }}>
                {fmt(stats.kcal)}<span className="hero__fact-unit">kcal</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <SessionBar
          workout={workout}
          onStart={startSession}
          onStop={stopSession}
          sortMode={sortMode}
          onToggleSort={() => setSortMode(!sortMode)}
        />
      )}

      {rows.length === 0 && (
        <EmptyState
          icon={planDay?.isRestDay ? '😴' : '🏋️'}
          title={planDay?.isRestDay ? 'Heute ist Ruhetag' : 'Für heute ist nichts geplant'}
          hint="Du kannst trotzdem jederzeit eine Übung hinzufügen."
        />
      )}

      <div className="list">
        {rows.map((row, index) => (
          <ExerciseCard
            key={row.key}
            row={row}
            index={index}
            total={rows.length}
            date={date}
            sortMode={sortMode}
            groupedWithAbove={index > 0 && !!row.groupId && row.groupId === rows[index - 1].groupId}
            onToggleSet={(setId) => toggleSet(row, setId)}
            onUpdate={updateRow}
            onAddSet={() => addSet(row)}
            onRemove={() => removeRow(row)}
            onOpenDetail={() => row.exercise && setDetail(row.exercise)}
            onStartRest={startRest}
            onMove={(direction) => moveRow(index, direction)}
            onToggleSuperset={() => toggleSuperset(index)}
          />
        ))}
      </div>

      <button className="btn btn--primary btn--block" onClick={() => setPickerOpen(true)}>
        <IconPlus /> Übung hinzufügen
      </button>

      {workout && (
        <div className="card">
          <div className="section-label" style={{ marginBottom: 10 }}>Training</div>
          <div className="grid-2">
            <div className="field">
              <label className="field__label">Dauer (min)</label>
              <NumberInput
                value={workout.durationMin}
                min={0}
                onChange={(value) => upsertWorkout(date, (current) => ({ ...current, durationMin: value }))}
                placeholder="gemessen"
              />
              <span className="field__hint">
                {workout.endedAt ? 'Von der Stoppuhr übernommen' : 'Leer lassen = wird geschätzt'}
              </span>
            </div>
            <div className="field">
              <label className="field__label">Körpergewicht (kg)</label>
              <NumberInput
                value={workout.bodyWeightKg}
                min={0}
                onChange={(value) => upsertWorkout(date, (current) => ({ ...current, bodyWeightKg: value }))}
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label className="field__label">Notiz zum Training</label>
            <textarea
              className="textarea"
              value={workout.notes ?? ''}
              placeholder="Wie lief es? Was ist aufgefallen?"
              onChange={(event) => upsertWorkout(date, (current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <button className="btn btn--danger btn--sm" style={{ marginTop: 10 }} onClick={() => setConfirmClear(true)}>
            <IconTrash /> Training löschen
          </button>
        </div>
      )}

      {record && (
        <RecordBanner
          name={record.name}
          record={record.record}
          onClose={() => setRecord(null)}
        />
      )}

      {restEndsAt && (
        <RestTimer endsAt={restEndsAt} onClose={() => setRestEndsAt(null)} onExtend={() => setRestEndsAt(restEndsAt + 30000)} />
      )}

      {pickerOpen && (
        <ExercisePicker
          title="Übung hinzufügen"
          onPick={addExercise}
          onClose={() => setPickerOpen(false)}
          excludeIds={rows.map((row) => row.exerciseId)}
        />
      )}

      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}

      {confirmClear && workout && (
        <ConfirmDialog
          title="Training löschen?"
          message={`Alle Sätze vom ${formatDateShort(date)} werden entfernt. Das lässt sich nicht rückgängig machen.`}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => { deleteWorkout(workout.id); setConfirmClear(false); toast.show('Training gelöscht'); }}
        />
      )}
    </>
  );
}

/* ----------------------------------------------------------- Wochenleiste */

function WeekStrip({
  date, onSelect, workouts,
}: {
  date: string;
  onSelect: (date: string) => void;
  workouts: Workout[];
}) {
  const monday = startOfWeek(date);
  const today = todayISO();
  const trained = useMemo(
    () => new Set(workouts.filter((workout) => workoutSetCount(workout) > 0).map((workout) => workout.date)),
    [workouts],
  );

  return (
    <div className="day-strip">
      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(monday, index);
        const classes = [
          'day-strip__item',
          day === today ? 'day-strip__item--today' : '',
          day === date ? 'day-strip__item--active' : '',
        ].filter(Boolean).join(' ');
        return (
          <button key={day} className={classes} onClick={() => onSelect(day)}>
            <span>{WEEKDAY_SHORT[index]}</span>
            <span className="day-strip__num">{parseISODate(day).getDate()}</span>
            <span className={`day-strip__dot ${trained.has(day) ? '' : 'day-strip__dot--empty'}`} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- Übungskarte */

function ExerciseCard({
  row, index, total, date, sortMode, groupedWithAbove,
  onToggleSet, onUpdate, onAddSet, onRemove, onOpenDetail, onStartRest, onMove, onToggleSuperset,
}: {
  row: Row;
  index: number;
  total: number;
  date: string;
  sortMode: boolean;
  groupedWithAbove: boolean;
  onToggleSet: (setId: string) => void;
  onUpdate: (row: Row, mutate: (logged: LoggedExercise) => LoggedExercise) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onOpenDetail: () => void;
  onStartRest: (seconds: number) => void;
  onMove: (direction: -1 | 1) => void;
  onToggleSuperset: () => void;
}) {
  const { state } = useStore();
  const previous = useMemo(
    () => lastPerformance(state, row.exerciseId, date),
    [state, row.exerciseId, date],
  );

  const suggestion = useMemo(
    () => suggestWeight(state, row.exerciseId, row.exercise, row.planExercise, date),
    [state, row.exerciseId, row.exercise, row.planExercise, date],
  );

  const doneSets = row.sets.filter((set) => set.done && !set.isWarmup).length;
  const [open, setOpen] = useState(doneSets === 0);
  const isTimed = row.exercise?.kind === 'time' || row.exercise?.kind === 'cardio';

  const target = row.planExercise;
  const targetText = target
    ? `${target.targetSets} × ${
        target.targetRepsMin && target.targetRepsMax && target.targetRepsMin !== target.targetRepsMax
          ? `${target.targetRepsMin}–${target.targetRepsMax}`
          : target.targetRepsMin || '?'
      }`
    : `${row.sets.length} Sätze`;

  const patchSet = (setId: string, patch: Partial<SetLog>) => {
    onUpdate(row, (logged) => ({
      ...logged,
      sets: logged.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
    }));
  };

  const removeSet = (setId: string) => {
    onUpdate(row, (logged) => ({ ...logged, sets: logged.sets.filter((set) => set.id !== setId) }));
  };

  /** Setzt den Vorschlag auf alle noch offenen Arbeitssaetze. */
  const applySuggestion = () => {
    if (!suggestion) return;
    onUpdate(row, (logged) => ({
      ...logged,
      sets: logged.sets.map((set) =>
        set.done || set.isWarmup ? set : { ...set, weightKg: suggestion.weightKg }),
    }));
  };

  /** Stellt Aufwaermsaetze vor die Arbeitssaetze. */
  const addWarmup = () => {
    const working = row.sets.find((set) => !set.isWarmup && (set.weightKg ?? 0) > 0);
    const base = working?.weightKg ?? suggestion?.weightKg ?? 0;
    const warmups = warmupSets(base, row.exercise);
    if (warmups.length === 0) return;
    onUpdate(row, (logged) => ({
      ...logged,
      sets: [
        ...warmups.map((item) => newSet({ weightKg: item.weightKg, reps: item.reps, isWarmup: true })),
        ...logged.sets.filter((set) => !set.isWarmup),
      ],
    }));
  };

  const totalTarget = target?.targetSets ?? row.sets.length;
  const allDone = doneSets >= totalTarget && totalTarget > 0;
  const accent = row.exercise ? categoryColor(row.exercise.category) : 'var(--border)';

  return (
    <div
      className={[
        'exercise',
        allDone ? 'exercise--done' : '',
        row.groupId ? 'exercise--grouped' : '',
        groupedWithAbove ? 'exercise--group-cont' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--cat': accent, '--cat-tint': row.exercise ? categoryTint(row.exercise.category) : undefined } as React.CSSProperties}
    >
      {row.groupId && !groupedWithAbove && (
        <div className="exercise__group-label">Supersatz</div>
      )}

      {sortMode && (
        <div className="exercise__sort">
          <button className="btn btn--sm btn--icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Nach oben">
            <IconChevronDown style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button className="btn btn--sm btn--icon" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Nach unten">
            <IconChevronDown />
          </button>
          {index > 0 && (
            <button
              className={`btn btn--sm ${groupedWithAbove ? 'btn--primary' : ''}`}
              onClick={onToggleSuperset}
            >
              {groupedWithAbove ? 'Supersatz lösen' : 'Mit Übung darüber koppeln'}
            </button>
          )}
        </div>
      )}

      <div className="exercise__head" onClick={() => setOpen(!open)}>
        <span className="exercise__tile" aria-hidden="true">
          {row.exercise ? CATEGORY_ICONS[row.exercise.category] : '⚙️'}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="exercise__name">{row.exercise?.name ?? 'Unbekannte Übung'}</div>
          <div className="exercise__meta">
            {targetText}
            {previous
              ? ` · zuletzt ${formatDateShort(previous.date)}: ${summarizeSets(previous.sets, isTimed)}`
              : ' · noch keine Vorleistung'}
          </div>
        </div>

        <div className="row" style={{ gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {doneSets > 0 && (
            <ProgressRing
              value={doneSets}
              max={totalTarget || doneSets}
              size={34}
              stroke={3.5}
              color={accent}
            >
              <span className="exercise__count">{doneSets}</span>
            </ProgressRing>
          )}
          <IconChevronDown
            style={{ width: 18, height: 18, color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.18s' }}
          />
        </div>
      </div>

      {open && (
        <div className="exercise__body">
          {previous && (
            <div className="row row--wrap tiny" style={{ gap: 6, padding: '10px 0 2px' }}>
              <span className="chip">Letztes Mal: {summarizeSets(previous.sets, isTimed)}</span>
              {previous.best1RM > 0 && <span className="chip">1RM ≈ {fmt(previous.best1RM, 1)} kg</span>}
              {suggestion && suggestion.direction !== 'hold' && (
                <button
                  className={`chip chip--button ${suggestion.direction === 'up' ? 'chip--success' : 'chip--warn'}`}
                  onClick={applySuggestion}
                  title={suggestion.reason}
                >
                  {suggestion.direction === 'up' ? '↑' : '↓'} Vorschlag {fmt(suggestion.weightKg, 1)} kg
                </button>
              )}
              {previous.volumeChangePct != null && (
                <span className={`chip ${previous.volumeChangePct >= 0 ? 'chip--success' : 'chip--danger'}`}>
                  {previous.volumeChangePct >= 0 ? '▲' : '▼'} {fmt(Math.abs(previous.volumeChangePct), 0)} % Volumen
                </span>
              )}
            </div>
          )}

          <div className="set-header">
            <span>#</span>
            <span>{isTimed ? 'Sek.' : 'kg'}</span>
            <span>{isTimed ? 'km' : 'Wdh'}</span>
            <span>RPE</span>
            <span />
          </div>

          {row.sets.map((set, index) => (
            <div className={`set-row${set.done ? ' set-row--done' : ''}`} key={set.id}>
              <button
                className={`set-row__index ${set.isWarmup ? 'set-row__index--warmup' : ''}`}
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                title="Als Aufwärmsatz markieren"
                onClick={() => patchSet(set.id, { isWarmup: !set.isWarmup })}
              >
                {set.isWarmup ? 'W' : index + 1 - row.sets.slice(0, index).filter((item) => item.isWarmup).length}
              </button>

              {isTimed ? (
                <>
                  <NumberInput
                    value={set.durationSec}
                    ariaLabel="Dauer in Sekunden"
                    onChange={(value) => patchSet(set.id, { durationSec: value })}
                    placeholder="Sek."
                  />
                  <NumberInput
                    value={set.distanceKm}
                    ariaLabel="Distanz in Kilometern"
                    onChange={(value) => patchSet(set.id, { distanceKm: value })}
                    placeholder="km"
                  />
                </>
              ) : (
                <>
                  <NumberInput
                    value={set.weightKg}
                    ariaLabel="Gewicht in Kilogramm"
                    onChange={(value) => patchSet(set.id, { weightKg: value })}
                    placeholder="kg"
                    step={2.5}
                  />
                  <NumberInput
                    value={set.reps}
                    ariaLabel="Wiederholungen"
                    onChange={(value) => patchSet(set.id, { reps: value })}
                    placeholder="Wdh"
                  />
                </>
              )}

              <NumberInput
                value={set.rpe}
                ariaLabel="RPE"
                min={1}
                max={10}
                onChange={(value) => patchSet(set.id, { rpe: value })}
                placeholder="–"
              />

              <div className="row" style={{ gap: 2 }}>
                <button
                  className={`check ${set.done ? 'check--on' : ''}`}
                  onClick={() => onToggleSet(set.id)}
                  aria-label={set.done ? 'Satz zurücksetzen' : 'Satz abhaken'}
                >
                  <IconCheck />
                </button>
              </div>
            </div>
          ))}

          <div className="row row--wrap" style={{ marginTop: 10, gap: 7 }}>
            <button className="btn btn--sm" onClick={onAddSet}><IconPlus /> Satz</button>
            {!isTimed && !row.sets.some((set) => set.isWarmup) && (
              <button className="btn btn--sm" onClick={addWarmup} title="Aufwärmsätze davorstellen">
                Aufwärmen
              </button>
            )}
            <button className="btn btn--sm" onClick={() => onStartRest(row.planExercise?.restSec ?? state.settings.restTimerSec)}>
              <IconClock /> Pause
            </button>
            <button className="btn btn--sm" onClick={onOpenDetail}><IconChart /> Fortschritt</button>
            <span className="spacer" />
            {row.sets.length > 1 && (
              <button
                className="btn btn--sm btn--ghost"
                onClick={() => removeSet(row.sets[row.sets.length - 1].id)}
                aria-label="Letzten Satz entfernen"
              >
                <IconX /> Satz
              </button>
            )}
            {row.logged && !row.fromPlan && (
              <button className="btn btn--sm btn--ghost" onClick={onRemove} aria-label="Übung entfernen">
                <IconTrash />
              </button>
            )}
          </div>

          {row.logged && (
            <input
              className="input"
              style={{ marginTop: 9 }}
              placeholder="Notiz zur Übung…"
              value={row.logged.note ?? ''}
              onChange={(event) => onUpdate(row, (logged) => ({ ...logged, note: event.target.value }))}
            />
          )}

          {row.logged && exerciseVolume(row.logged) > 0 && (
            <div className="tiny dim right" style={{ marginTop: 7 }}>
              Volumen heute: {fmt(exerciseVolume(row.logged))} kg
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Fasst Sätze kompakt zusammen, z. B. "3 × 80 kg × 8". */
function summarizeSets(sets: SetLog[], isTimed: boolean): string {
  if (sets.length === 0) return '–';
  if (isTimed) {
    return sets
      .map((set) => (set.durationSec ? formatClock(set.durationSec) : `${set.distanceKm ?? 0} km`))
      .slice(0, 4)
      .join(' · ');
  }

  const groups: Array<{ weight: number; reps: number; count: number }> = [];
  for (const set of sets) {
    const weight = set.weightKg ?? 0;
    const reps = set.reps ?? 0;
    const last = groups[groups.length - 1];
    if (last && last.weight === weight && last.reps === reps) last.count += 1;
    else groups.push({ weight, reps, count: 1 });
  }

  return groups
    .slice(0, 3)
    .map((group) => `${group.count > 1 ? `${group.count}× ` : ''}${fmt(group.weight, group.weight % 1 === 0 ? 0 : 1)} kg × ${group.reps}`)
    .join(', ');
}

/* --------------------------------------------------------------- Pausenuhr */

function RestTimer({
  endsAt, onClose, onExtend,
}: {
  endsAt: number;
  onClose: () => void;
  onExtend: () => void;
}) {
  const [remaining, setRemaining] = useState(() => Math.max(0, (endsAt - Date.now()) / 1000));
  // Gesamtdauer einmal merken, damit der Balken einen festen Bezug hat.
  const [total] = useState(() => Math.max(1, (endsAt - Date.now()) / 1000));

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, (endsAt - Date.now()) / 1000));
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const barWidth = Math.min(100, (remaining / Math.max(total, remaining)) * 100);

  useEffect(() => {
    if (remaining > 0) return;
    // Kurzes Vibrieren, wenn das Gerät es unterstützt.
    navigator.vibrate?.([120, 60, 120]);
    const timer = window.setTimeout(onClose, 2500);
    return () => window.clearTimeout(timer);
  }, [remaining, onClose]);

  return (
    <div className="rest-timer">
      <IconClock style={{ width: 20, height: 20 }} />
      <span className="rest-timer__time">{remaining > 0 ? formatClock(remaining) : 'Los!'}</span>
      <span className="spacer" />
      <button className="btn btn--sm" style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'transparent', color: '#fff' }} onClick={onExtend}>
        +30 s
      </button>
      <button className="btn btn--sm btn--ghost" style={{ color: '#fff' }} onClick={onClose} aria-label="Pause beenden">
        <IconX />
      </button>
      <span className="rest-timer__bar" style={{ width: `${barWidth}%` }} />
    </div>
  );
}

/* ------------------------------------------------ Stoppuhr und Sortierleiste */

/** Zeigt die laufende Trainingszeit und den Umschalter fuers Sortieren. */
function SessionBar({
  workout, onStart, onStop, sortMode, onToggleSort,
}: {
  workout: Workout | undefined;
  onStart: () => void;
  onStop: () => void;
  sortMode: boolean;
  onToggleSort: () => void;
}) {
  const running = !!workout?.startedAt && !workout?.endedAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const elapsed = running && workout?.startedAt
    ? Math.max(0, (now - new Date(workout.startedAt).valueOf()) / 1000)
    : 0;

  return (
    <div className="row row--wrap" style={{ gap: 8 }}>
      {running ? (
        <>
          <span className="chip chip--success" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <IconClock style={{ width: 13, height: 13 }} /> {formatClock(elapsed)}
          </span>
          <button className="btn btn--sm" onClick={onStop}>Training beenden</button>
        </>
      ) : (
        <button className="btn btn--sm" onClick={onStart}>
          <IconClock /> {workout?.endedAt ? 'Neu starten' : 'Zeit messen'}
        </button>
      )}

      <span className="spacer" />
      <button className={`btn btn--sm ${sortMode ? 'btn--primary' : ''}`} onClick={onToggleSort}>
        {sortMode ? 'Fertig' : 'Sortieren'}
      </button>
    </div>
  );
}

/* ------------------------------------------------------- Bestleistungs-Meldung */

/** Kurze Rueckmeldung, wenn ein Satz einen bisherigen Bestwert schlaegt. */
function RecordBanner({
  name, record, onClose,
}: {
  name: string;
  record: NewRecord;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 5000);
    return () => window.clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="record-banner" role="status">
      <span className="record-banner__icon">🏆</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bold small">{record.label}</div>
        <div className="tiny" style={{ opacity: 0.85 }}>{name} · {record.value}</div>
      </div>
      <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Schließen">
        <IconX />
      </button>
    </div>
  );
}
