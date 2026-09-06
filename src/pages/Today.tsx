import { exerciseName, t } from '../i18n';
import { Fragment, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Exercise, LoggedExercise, PlanExercise, SetLog, Workout } from '../types';
import {
  WEEKDAY_SHORT, addDays, formatClock, formatDateShort, parseISODate, relativeDayLabel,
  startOfWeek, todayISO, weekdayOf,
} from '../lib/date';
import { calcWorkoutBurn } from '../lib/calories';
import { formatSet } from '../lib/setFormat';
import { detectRecord, suggestWeight, warmupSets, type NewRecord } from '../lib/coaching';
import { cycleLabel, cycleWeight, isDeload } from '../lib/cycle';
import {
  countsAsWork, exerciseVolume, lastPerformance, workoutSetCount, workoutVolume,
} from '../lib/stats';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import { uid } from '../storage/defaults';
/*
 * Suche, Detailansicht und Rechner sind Dialoge: Sie erscheinen erst, wenn
 * jemand sie aufruft, und muessen deshalb nicht beim Start mitgeladen werden.
 * In der Detailansicht stecken die Diagramme, also der groesste Brocken.
 */
const ExercisePicker = lazy(
  () => import('../components/ExercisePicker').then((m) => ({ default: m.ExercisePicker })));
const ExerciseDetail = lazy(
  () => import('../components/ExerciseDetail').then((m) => ({ default: m.ExerciseDetail })));
const WeightCalculator = lazy(
  () => import('../components/WeightCalculator').then((m) => ({ default: m.WeightCalculator })));
import { describePlates, platesFor, usesBarbell } from '../lib/plates';
import { cachedGuide, prefetchGuides } from '../api/guide';
import { isOutdoor } from '../lib/outdoor';
import {
  describeCode, loadWeather, weatherForDate, weatherSymbol, weatherWarning, type DayWeather,
} from '../api/weather';
import { useWakeLock } from '../lib/wakeLock';
import { fromRpe, toRpe } from '../lib/effort';
import { BodyMap, type Intensity } from '../components/MuscleMap';
import {
  REGION_LABELS, fitsEquipment, regionsOf, suggestForRegion, type MuscleRegion,
} from '../lib/muscles';
import {
  ConfirmDialog, DateInput, EmptyState, Modal, NumberInput, Section, fmt, useToast,
} from '../components/ui';
import { categoryColor, categoryTint } from '../lib/categoryColors';
import { CATEGORY_LABELS } from '../data/catalog';
import {
  IconBook, IconCalculator, IconCalendar, IconCheck, IconChart, IconChevronDown, IconChevronLeft,
  IconChevronRight, IconClock, IconCopy, IconExpand, IconPlay, IconPlus, IconSwap, IconTrash,
  IconTrophy, IconX,
} from '../components/icons';
import { beep } from '../lib/beep';

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

export function TodayPage({ onNavigate }: { onNavigate?: (tab: 'plans') => void }) {
  const {
    state, getExercise, upsertWorkout, deleteWorkout, snapshot, replaceState, updateSettings,
  } = useStore();
  const toast = useToast();

  const [date, setDate] = useState(todayISO());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<Row | null>(null);
  const sync = useSync();
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState(false);
  const [record, setRecord] = useState<{ name: string; record: NewRecord } | null>(null);
  const [flashSet, setFlashSet] = useState<string | null>(null);

  const plan = state.plans.find((item) => item.id === state.activePlanId) ?? null;
  const planDay = plan?.days[weekdayOf(date)] ?? null;
  const workout = state.workouts.find((item) => item.date === date);

  // Zwischen zwei Saetzen vergehen zwei Minuten, in denen niemand das Handy
  // anfasst. Ohne das hier ist der Bildschirm danach aus und gesperrt.
  useWakeLock(
    state.settings.keepScreenAwake && Boolean(workout?.startedAt) && !workout?.endedAt,
  );

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
          weightKg: reference?.weightKg
            ?? cycleWeight(planExercise.targetWeightKg, plan?.cycle, date)
            ?? null,
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

    // Kurzer Ruettler: Mit feuchten Fingern sieht man den Haken nicht immer.
    navigator.vibrate?.(18);

    // Ist der Satz eine Bestleistung? Dann kurz feiern.
    const beaten = detectRecord(state, row.exerciseId, target, date, row.exercise?.kind);
    if (beaten) {
      setRecord({ name: exerciseName(row.exercise), record: beaten });
      setFlashSet(setId);
      window.setTimeout(() => setFlashSet((current) => (current === setId ? null : current)), 1400);
      navigator.vibrate?.([25, 40, 25]);
    }

    // Beim Supersatz erst nach der letzten Uebung der Gruppe pausieren.
    if (row.groupId) {
      const group = rows.filter((item) => item.groupId === row.groupId);
      const isLast = group[group.length - 1]?.exerciseId === row.exerciseId;
      if (!isLast) return;
    }

    const rest = row.logged?.restSec ?? row.planExercise?.restSec ?? state.settings.restTimerSec;
    if (rest > 0) startRest(rest);
  };

  /**
   * Tauscht die Uebung einer Zeile gegen eine andere. Die bereits
   * eingetragenen Saetze bleiben stehen - das Geraet war besetzt, die Arbeit
   * war es nicht.
   */
  const swapExercise = (row: Row, next: Exercise) => {
    upsertWorkout(date, (current) => {
      const existing = current.exercises.find((logged) => logged.exerciseId === row.exerciseId);
      const exercises = existing
        ? current.exercises.map((logged) => (
            logged.exerciseId === row.exerciseId
              ? { ...logged, exerciseId: next.id, planExerciseId: undefined }
              : logged
          ))
        : [
            ...current.exercises,
            {
              id: uid('le'),
              exerciseId: next.id,
              groupId: row.groupId,
              sets: row.sets.map((set) => ({ ...set, id: uid('set') })),
            },
          ];

      // Die Plan-Uebung wird ersetzt, nicht ergaenzt: ihre Reihenfolge bleibt.
      const order = (current.exerciseOrder ?? rows.map((item) => item.exerciseId))
        .map((id) => (id === row.exerciseId ? next.id : id));

      return { ...current, exercises, exerciseOrder: order };
    });
    setSwapFor(null);
    toast.show(t('Getauscht gegen {name}', { name: exerciseName(next) }));
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
    toast.show(t('„{name}“ hinzugefügt', { name: exercise.name }));
  };

  /**
   * Das letzte gleiche Training noch einmal, samt Gewichten.
   *
   * "Gleich" heisst: derselbe Plantag, sonst derselbe Titel. Abgehakt wird
   * nichts - uebernommen werden die Zahlen, die Arbeit macht man selbst.
   */
  const lastSame = useMemo(() => {
    const candidates = state.workouts
      .filter((item) => item.date < date && workoutSetCount(item) > 0)
      .filter((item) => (
        planDay && item.planDayIndex != null
          ? item.planDayIndex === weekdayOf(date)
          : item.title === (workout?.title || planDay?.title || '')
      ))
      .sort((a, b) => b.date.localeCompare(a.date));
    return candidates[0] ?? null;
  }, [state.workouts, date, planDay, workout?.title]);

  const repeatLast = () => {
    if (!lastSame) return;
    const before = snapshot();
    upsertWorkout(date, (current) => ({
      ...current,
      planId: plan?.id,
      planDayIndex: weekdayOf(date),
      title: current.title || lastSame.title || planDay?.title || '',
      bodyWeightKg: current.bodyWeightKg ?? state.profile.weightKg,
      exerciseOrder: lastSame.exerciseOrder,
      exercises: lastSame.exercises.map((logged) => ({
        ...logged,
        id: uid('le'),
        sets: logged.sets.map((set) => ({
          ...set, id: uid('set'), done: false, note: undefined, rpe: null,
        })),
      })),
    }));
    toast.show(
      t('Training vom {date} übernommen', { date: formatDateShort(lastSame.date) }),
      { label: t('Rückgängig'), run: () => replaceState(before) },
    );
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
    toast.show(t("Training beendet"));
    // Freunde anstupsen - still, und nur wenn Push eingerichtet ist.
    void sync.nudgeFriends();
  };

  /**
   * Schiebt das ganze Training auf einen anderen Tag.
   *
   * Wer abends merkt, dass er am falschen Tag eingetragen hat, musste bisher
   * alles neu tippen. Ist am Zieltag schon etwas eingetragen, wird nicht
   * ueberschrieben - dann sagt der Dialog das vorher.
   */
  const moveWorkout = (target: string) => {
    if (!workout || target === date) { setMoveOpen(false); return; }
    const before = snapshot();
    const moved = { ...workout, date: target, updatedAt: new Date().toISOString() };
    replaceState({
      ...before,
      updatedAt: new Date().toISOString(),
      workouts: [...before.workouts.filter((item) => item.id !== workout.id), moved]
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
    setMoveOpen(false);
    setDate(target);
    toast.show(t('Auf {date} verschoben', { date: formatDateShort(target) }), {
      label: t('Rückgängig'),
      run: () => { replaceState(before); setDate(date); },
    });
  };

  const removeRow = (row: Row) => {
    if (!row.logged) return;
    const before = snapshot();
    upsertWorkout(date, (current) => ({
      ...current,
      exercises: current.exercises.filter((item) => item.id !== row.logged!.id),
    }));
    toast.show(t('„{name}“ entfernt', { name: exerciseName(row.exercise) }), {
      label: t('Rückgängig'),
      run: () => replaceState(before),
    });
  };

  /* ------------------------------------------------------------ Kennzahlen */

  const stats = useMemo(() => {
    if (!workout) {
      return { sets: 0, volume: 0, kcal: 0, minutes: 0, durationImplausible: false };
    }
    const burn = calcWorkoutBurn(workout, getExercise, state.profile.weightKg, state.settings.restTimerSec);
    return {
      sets: workoutSetCount(workout),
      volume: workoutVolume(workout),
      kcal: burn.kcal,
      minutes: burn.minutes,
      durationImplausible: burn.durationImplausible,
    };
  }, [workout, getExercise, state.profile.weightKg, state.settings.restTimerSec]);

  const plannedSets = rows.reduce(
    (sum, row) => sum + (row.planExercise?.targetSets ?? row.sets.length), 0,
  );
  const progress = plannedSets > 0 ? Math.min(100, (stats.sets / plannedSets) * 100) : 0;

  return (
    <>
      {/*
        * Wochenleiste und Tagesnavigation sagten dasselbe: beide wechseln den
        * Tag. Jetzt eine Zeile - die Pfeile springen eine ganze Woche, jeder
        * Tag darin ist ohnehin einen Tipper weit weg.
        */}
      <WeekStrip
        date={date}
        onSelect={setDate}
        workouts={state.workouts}
        onShiftWeek={(direction) => setDate(addDays(date, direction * 7))}
      />

      <div className="dayline">
        <span className="dayline__name">{relativeDayLabel(date)}</span>
        <span className="dayline__plan">
          {planDay && !planDay.isRestDay ? t(planDay.title) : planDay ? t('Ruhetag laut Plan') : t('Kein Plan aktiv')}
        </span>
        {cycleLabel(plan, date) && (
          <span className={`chip ${isDeload(plan?.cycle, date) ? 'chip--warn' : ''}`}>
            {cycleLabel(plan, date)}
          </span>
        )}
        {date !== todayISO() && (
          <button className="btn btn--sm btn--ghost" onClick={() => setDate(todayISO())}>
            {t('Zurück zu heute')}
          </button>
        )}
      </div>

      <div className="split">
      <div className="split__main">

      {(stats.sets > 0 || rows.length > 0) && (
        <div className="tally">
          <div className="tally__row">
            <div className="tally__item">
              <span className="tally__label">{t("Sätze")}</span>
              <span className="tally__value">
                {stats.sets}
                {plannedSets > 0 && <span className="tally__unit">{t('von {count}', { count: plannedSets })}</span>}
              </span>
            </div>
            <div className="tally__item">
              <span className="tally__label">{t("Volumen")}</span>
              <span className="tally__value">
                {fmt(stats.volume)}<span className="tally__unit">{t("kg")}</span>
              </span>
            </div>
            <div className="tally__item">
              <span className="tally__label">{t("Verbrauch")}</span>
              <span className="tally__value">
                {fmt(stats.kcal)}<span className="tally__unit">{t("kcal")}</span>
              </span>
            </div>
          </div>

          {plannedSets > 0 && (
            <div className="tally__meter" role="img" aria-label={t('{done} von {count} Sätzen', { done: stats.sets, count: plannedSets })}>
              <div className="tally__meter-fill" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
          )}

          {stats.minutes > 0 && (
            <div className="tally__note">
              {t('{minutes} min gerechnet', { minutes: Math.round(stats.minutes) })}
            </div>
          )}
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

      {lastSame && stats.sets === 0 && (
        <button className="btn btn--block" onClick={repeatLast}>
          <IconCopy /> {t('Training vom {date} wiederholen', { date: formatDateShort(lastSame.date) })}
        </button>
      )}

      {rows.length === 0 && (
        <EmptyState
          title={planDay?.isRestDay ? t('Heute ist Ruhetag') : t('Für heute ist nichts geplant')}
          hint={t('Du kannst trotzdem jederzeit eine Übung hinzufügen.')}
          actionLabel={onNavigate ? t('Plan für heute anlegen') : undefined}
          onAction={onNavigate ? () => onNavigate('plans') : undefined}
        />
      )}

      <div className="list">
        {rows.map((row, index) => {
          // Beim Supersatz: in welchem Durchgang steht die Gruppe? Der Durchgang
          // ist so weit, wie die schwaechste Uebung der Gruppe abgehakt ist.
          const group = row.groupId ? rows.filter((item) => item.groupId === row.groupId) : null;
          const groupRound = group
            ? Math.min(...group.map((item) => item.sets.filter(countsAsWork).length)) + 1
            : null;
          const groupTotal = group
            ? Math.max(...group.map((item) => item.planExercise?.targetSets ?? item.sets.length))
            : null;
          return (
          <ExerciseCard
            key={row.key}
            row={row}
            index={index}
            total={rows.length}
            date={date}
            sortMode={sortMode}
            groupedWithAbove={index > 0 && !!row.groupId && row.groupId === rows[index - 1].groupId}
            groupRound={groupRound}
            groupTotal={groupTotal}
            flashSet={flashSet}
            onToggleSet={(setId) => toggleSet(row, setId)}
            onUpdate={updateRow}
            onAddSet={() => addSet(row)}
            onRemove={() => removeRow(row)}
            onOpenDetail={() => row.exercise && setDetail(row.exercise)}
            onSwap={() => setSwapFor(row)}
            onStartRest={startRest}
            onMove={(direction) => moveRow(index, direction)}
            onToggleSuperset={() => toggleSuperset(index)}
          />
          );
        })}
      </div>

      <button className="btn btn--primary btn--block" onClick={() => setPickerOpen(true)}>
        <IconPlus /> {t('Übung hinzufügen')}
      </button>

      </div>
      <div className="split__side">

      <WeatherNote rows={rows} date={date} />

      <TrainingCompanions date={date} />

      <SessionMuscles rows={rows} />

      <GuidePrefetch rows={rows} />

      {workout && (
        <Section title={t("Training")}>
          <div className="grid-2">
            <div className="field">
              <label className="field__label">{t("Dauer (min)")}</label>
              <NumberInput
                value={workout.durationMin}
                min={0}
                onChange={(value) => upsertWorkout(date, (current) => ({ ...current, durationMin: value }))}
                placeholder={t("gemessen")}
              />
              <span className="field__hint">
                {stats.durationImplausible
                  ? t('Kürzer als die reine Hebezeit – für den Verbrauch wird geschätzt.')
                  : workout.endedAt
                    ? t('Von der Stoppuhr übernommen')
                    : t('Leer lassen = wird geschätzt')}
              </span>
            </div>
            <div className="field">
              <label className="field__label">{t("Körpergewicht (kg)")}</label>
              <NumberInput
                value={workout.bodyWeightKg}
                min={0}
                onChange={(value) => upsertWorkout(date, (current) => ({ ...current, bodyWeightKg: value }))}
              />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label className="field__label">{t("Notiz zum Training")}</label>
            <textarea
              className="textarea"
              value={workout.notes ?? ''}
              placeholder={t("Wie lief es? Was ist aufgefallen?")}
              onChange={(event) => upsertWorkout(date, (current) => ({ ...current, notes: event.target.value }))}
            />
          </div>
          <div className="row row--wrap" style={{ marginTop: 10, gap: 8 }}>
            <button className="btn btn--sm" onClick={() => setMoveOpen(true)}>
              <IconCalendar /> {t('Datum ändern')}
            </button>
            <span className="spacer" />
          <button className="btn btn--danger btn--sm" onClick={() => setConfirmClear(true)}>
            <IconTrash /> {t('Training löschen')}
          </button>
          </div>
        </Section>
      )}

      </div>
      </div>

      {moveOpen && workout && (
        <MoveWorkoutDialog
          workout={workout}
          taken={state.workouts.filter((item) => workoutSetCount(item) > 0).map((item) => item.date)}
          onClose={() => setMoveOpen(false)}
          onMove={(target) => moveWorkout(target)}
        />
      )}

      {record && (
        <RecordBanner
          name={record.name}
          record={record.record}
          onClose={() => setRecord(null)}
        />
      )}

      {restEndsAt && (
        <RestTimer
          endsAt={restEndsAt}
          fullscreen={state.settings.fullscreenRest}
          onFullscreenChange={(value) => updateSettings({ fullscreenRest: value })}
          onClose={() => setRestEndsAt(null)}
          onExtend={() => setRestEndsAt(restEndsAt + 30000)}
        />
      )}

      {pickerOpen && (
        <Suspense fallback={null}>
          <ExercisePicker
            title={t("Übung hinzufügen")}
            onPick={addExercise}
            onClose={() => setPickerOpen(false)}
            excludeIds={rows.map((row) => row.exerciseId)}
          />
        </Suspense>
      )}

      {swapFor && (
        <SwapDialog
          row={swapFor}
          onClose={() => setSwapFor(null)}
          onPick={(next) => swapExercise(swapFor, next)}
        />
      )}

      {detail && (
        <Suspense fallback={null}>
          <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />
        </Suspense>
      )}

      {confirmClear && workout && (
        <ConfirmDialog
          title={t("Training löschen?")}
          message={t('Alle Sätze vom {date} werden entfernt. Das lässt sich nicht rückgängig machen.', { date: formatDateShort(date) })}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            const before = snapshot();
            deleteWorkout(workout.id);
            setConfirmClear(false);
            toast.show(t('Training gelöscht'), {
              label: t('Rückgängig'),
              run: () => replaceState(before),
            });
          }}
        />
      )}
    </>
  );
}

/* ----------------------------------------------------------- Wochenleiste */

function WeekStrip({
  date, onSelect, workouts, onShiftWeek,
}: {
  date: string;
  onSelect: (date: string) => void;
  workouts: Workout[];
  onShiftWeek: (direction: -1 | 1) => void;
}) {
  const monday = startOfWeek(date);
  const today = todayISO();
  const trained = useMemo(
    () => new Set(workouts.filter((workout) => workoutSetCount(workout) > 0).map((workout) => workout.date)),
    [workouts],
  );

  return (
    <div className="day-strip">
      <button
        className="day-strip__arrow"
        onClick={() => onShiftWeek(-1)}
        aria-label={t('Woche zurück')}
      >
        <IconChevronLeft />
      </button>

      {Array.from({ length: 7 }, (_, index) => {
        const day = addDays(monday, index);
        const classes = [
          'day-strip__item',
          day === today ? 'day-strip__item--today' : '',
          day === date ? 'day-strip__item--active' : '',
        ].filter(Boolean).join(' ');
        return (
          <button key={day} className={classes} onClick={() => onSelect(day)}>
            <span>{t(WEEKDAY_SHORT[index])}</span>
            <span className="day-strip__num">{parseISODate(day).getDate()}</span>
            <span className={`day-strip__dot ${trained.has(day) ? '' : 'day-strip__dot--empty'}`} />
          </button>
        );
      })}

      <button
        className="day-strip__arrow"
        onClick={() => onShiftWeek(1)}
        aria-label={t('Woche vor')}
      >
        <IconChevronRight />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- Übungskarte */

function ExerciseCard({
  row, index, total, date, sortMode, groupedWithAbove, groupRound, groupTotal, flashSet,
  onToggleSet, onUpdate, onAddSet, onRemove, onOpenDetail, onSwap, onStartRest, onMove, onToggleSuperset,
}: {
  row: Row;
  index: number;
  total: number;
  date: string;
  sortMode: boolean;
  groupedWithAbove: boolean;
  /** Supersatz: laufender Durchgang und Gesamtzahl der Durchgaenge. */
  groupRound?: number | null;
  groupTotal?: number | null;
  onToggleSet: (setId: string) => void;
  onUpdate: (row: Row, mutate: (logged: LoggedExercise) => LoggedExercise) => void;
  onAddSet: () => void;
  onRemove: () => void;
  onOpenDetail: () => void;
  onSwap: () => void;
  onStartRest: (seconds: number) => void;
  onMove: (direction: -1 | 1) => void;
  onToggleSuperset: () => void;
  /** Satz, an dem gerade eine Bestleistung passiert ist. */
  flashSet?: string | null;
}) {
  const { state, snapshot, replaceState } = useStore();
  const toast = useToast();
  const previous = useMemo(
    () => lastPerformance(state, row.exerciseId, date),
    [state, row.exerciseId, date],
  );

  const suggestion = useMemo(
    () => suggestWeight(state, row.exerciseId, row.exercise, row.planExercise, date),
    [state, row.exerciseId, row.exercise, row.planExercise, date],
  );

  const doneSets = row.sets.filter(countsAsWork).length;
  const [open, setOpen] = useState(doneSets === 0);
  /** Welcher Satz zeigt gerade seine Zusatzzeile (Notiz, Partner)? */
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const partnerName = state.settings.partnerName.trim();
  const useRir = state.settings.useRir;
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

  /** Plus/Minus auf einem Zahlenwert des Satzes, um den gegebenen Schritt. */
  const bumpSet = (set: SetLog, field: 'weightKg' | 'reps', delta: number) => {
    const current = (field === 'weightKg' ? set.weightKg : set.reps) ?? 0;
    const next = Math.max(0, Math.round((current + delta) * 1000) / 1000);
    patchSet(set.id, { [field]: next || null });
    navigator.vibrate?.(8);
  };

  /** Denselben Satz noch einmal - mit Gewicht und Wiederholungen, ohne Haken. */
  const duplicateSet = (setId: string) => {
    onUpdate(row, (logged) => {
      const index = logged.sets.findIndex((set) => set.id === setId);
      if (index < 0) return logged;
      const source = logged.sets[index];
      const copy = { ...source, id: uid('set'), done: false, note: source.note };
      const sets = [...logged.sets];
      sets.splice(index + 1, 0, copy);
      return { ...logged, sets };
    });
  };

  const removeSet = (setId: string) => {
    const before = snapshot();
    onUpdate(row, (logged) => ({ ...logged, sets: logged.sets.filter((set) => set.id !== setId) }));
    toast.show(t('Satz entfernt'), { label: t('Rückgängig'), run: () => replaceState(before) });
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

  /** Gewicht, Wiederholungen und Dauer dieses Satzes auf alle offenen uebernehmen. */
  const applySetToRest = (setId: string) => {
    onUpdate(row, (logged) => {
      const source = logged.sets.find((set) => set.id === setId);
      if (!source) return logged;
      return {
        ...logged,
        sets: logged.sets.map((set) => (
          set.id === setId || set.done || set.isWarmup
            ? set
            : { ...set, weightKg: source.weightKg, reps: source.reps, durationSec: source.durationSec }
        )),
      };
    });
  };

  /** Pausenlaenge fuer genau diese Uebung - undefined nimmt den Standard zurueck. */
  const effectiveRest = row.logged?.restSec ?? row.planExercise?.restSec ?? state.settings.restTimerSec;
  const planRest = row.planExercise?.restSec ?? state.settings.restTimerSec;
  const setRest = (seconds: number | undefined) => {
    onUpdate(row, (logged) => ({ ...logged, restSec: seconds }));
  };

  // Ein Aufwaermangebot lohnt sich nur, solange nichts abgehakt ist und noch
  // keine Aufwaermsaetze stehen - und nur, wenn daraus ueberhaupt Saetze werden.
  const warmupBase = (row.sets.find((set) => !set.isWarmup && (set.weightKg ?? 0) > 0)?.weightKg)
    ?? suggestion?.weightKg ?? 0;
  // Erst ab einem echten Arbeitsgewicht anbieten - der eine lockere Satz, den
  // "warmupSets" darunter erzeugt, will fast niemand vor Seitheben oder Curls.
  const canOfferWarmup = !isTimed && doneSets === 0
    && warmupBase >= 40
    && !row.sets.some((set) => set.isWarmup)
    && warmupSets(warmupBase, row.exercise).length > 0;

  // Schrittweite fuer Plus/Minus: an der Langhantel die kleinste Scheibe, mal
  // zwei (je Seite eine). Sonst die uebliche Kurzhantel-/Maschinenstufe.
  const kgStep = usesBarbell(row.exercise)
    ? Math.min(...(state.settings.plateSet.length > 0 ? state.settings.plateSet : [1.25])) * 2
    : 2.5;

  // Wischen auf einer Satzzeile: nach rechts abhaken, nach links zurueck. Der
  // Haken bleibt; die ganze Zeile ist zusaetzlich Trefferflaeche.
  const swipeStart = useRef<{ x: number; y: number; id: string } | null>(null);
  const rowSwipe = (setId: string, done: boolean) => ({
    onTouchStart: (event: React.TouchEvent) => {
      if ((event.target as HTMLElement).closest('input, button, textarea, select')) {
        swipeStart.current = null;
        return;
      }
      const touch = event.touches[0];
      swipeStart.current = { x: touch.clientX, y: touch.clientY, id: setId };
    },
    onTouchEnd: (event: React.TouchEvent) => {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start || start.id !== setId) return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 55 || Math.abs(dy) > 35) return;
      if (dx > 0 && !done) onToggleSet(setId);
      if (dx < 0 && done) onToggleSet(setId);
    },
  });

  // Der Rechner soll den Satz zeigen, an dem man gerade steht: den ersten
  // offenen Arbeitssatz, sonst den letzten abgehakten.
  const currentSet = row.sets.find((set) => !set.done && !set.isWarmup)
    ?? [...row.sets].reverse().find((set) => set.done)
    ?? row.sets[0];

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
        <div className="exercise__group-label">
          {t("Supersatz")}
          {groupRound != null && groupTotal != null && groupTotal > 0 && groupRound <= groupTotal && (
            <span className="exercise__group-round">
              {` · ${t('Durchgang {n}/{total}', { n: groupRound, total: groupTotal })}`}
            </span>
          )}
        </div>
      )}

      {sortMode && (
        <div className="exercise__sort">
          <button className="btn btn--sm btn--icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label={t("Nach oben")}>
            <IconChevronDown style={{ transform: 'rotate(180deg)' }} />
          </button>
          <button className="btn btn--sm btn--icon" onClick={() => onMove(1)} disabled={index === total - 1} aria-label={t("Nach unten")}>
            <IconChevronDown />
          </button>
          {index > 0 && (
            <button
              className={`btn btn--sm ${groupedWithAbove ? 'btn--primary' : ''}`}
              onClick={onToggleSuperset}
            >
              {groupedWithAbove ? t('Supersatz lösen') : t('Mit Übung darüber koppeln')}
            </button>
          )}
        </div>
      )}

      <div className="exercise__head" onClick={() => setOpen(!open)}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="exercise__name">{exerciseName(row.exercise)}</div>
          <div className="exercise__meta">
            {/*
              * Die Muskelgruppe bekommt einen Punkt in ihrer Farbe, der Name
              * bleibt neutral. Farbe im Text traegt sonst eine Bedeutung, die
              * sie hier nicht hat - "Brust" sah aus wie eine Fehlermeldung.
              */}
            <span className="cat-dot" style={{ '--cat': accent } as React.CSSProperties} />
            <span style={{ fontWeight: 550 }}>
              {t(CATEGORY_LABELS[row.exercise?.category ?? 'other'])}
            </span>
            {` · ${targetText}`}
            {/*
              * Die Vorleistung steht auf einer eigenen Zeile, nicht mit
              * Mittelpunkten an Kategorie und Sollwert gehaengt - sie ist die
              * Angabe, die man beim Training abliest.
              */}
            <span className="exercise__last">
              {previous
                ? `${t('zuletzt')} ${formatDateShort(previous.date)}: ${summarizeSets(previous.sets, isTimed, row.exercise?.kind)}`
                : t('noch keine Vorleistung')}
            </span>
          </div>
        </div>

        <div className="row" style={{ gap: 9, flexShrink: 0, alignItems: 'center' }}>
          {doneSets > 0 && (
            <span
              className={`exercise__count ${doneSets >= totalTarget ? 'exercise__count--done' : ''}`}
              aria-label={t('{done} von {count} Sätzen', { done: doneSets, count: totalTarget || doneSets })}
            >
              {doneSets}<span className="exercise__count-sep">/</span>{totalTarget || doneSets}
            </span>
          )}
          <IconChevronDown
            style={{ width: 18, height: 18, color: 'var(--text-dim)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.18s' }}
          />
        </div>
      </div>

      {/*
        * Die Karte klappt auf, statt zu erscheinen. Animiert wird die Zeilenhoehe
        * eines Rasters von 0fr auf 1fr - der einzige Weg, in reinem CSS auf eine
        * Hoehe zu blenden, die man vorher nicht kennt.
        */}
      <div className={`reveal ${open ? 'reveal--open' : ''}`}>
      <div className="reveal__inner">
        <div className="exercise__body">
          {previous && (
            <div className="row row--wrap tiny" style={{ gap: 6, padding: '10px 0 2px' }}>
              <span className="chip">Letztes Mal: {summarizeSets(previous.sets, isTimed, row.exercise?.kind)}</span>
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

          {/*
            * Aufwaermsaetze werden dort angeboten, wo man sie braucht - sobald
            * ein Arbeitsgewicht steht und noch nichts abgehakt ist. Vorher lag
            * der Handgriff unter "Mehr" und niemand fand ihn.
            */}
          {canOfferWarmup && (
            <div className="row row--wrap tiny" style={{ gap: 6, padding: '10px 0 0' }}>
              <button className="chip chip--button" onClick={addWarmup}>
                {t('Aufwärmsätze davor')}
              </button>
            </div>
          )}

          {/* Die Einheit steht einmal ueber der Spalte, nicht in jedem Feld. */}
          <div className="set-header">
            <span>#</span>
            <span>{isTimed ? t('Sek.') : t('kg')}</span>
            <span>{isTimed ? t('km') : t('Wdh')}</span>
            <span>{useRir ? t('RIR') : t('RPE')}</span>
            <span />
          </div>

          {row.sets.map((set, index) => (
            <Fragment key={set.id}>
            <div
              {...rowSwipe(set.id, set.done)}
              className={[
                'set-row',
                set.done ? 'set-row--done' : '',
                set.forPartner ? 'set-row--partner' : '',
                // Genau eine Zeile ist die naechste - wer zwischen zwei
                // Saetzen aufs Handy schaut, sucht sie.
                set.id === currentSet?.id && !set.done ? 'set-row--next' : '',
                // Kurzes Aufblitzen dort, wo die Bestleistung passiert ist -
                // die Meldung am unteren Rand sieht man sonst gar nicht.
                set.id === flashSet ? 'set-row--record' : '',
              ].filter(Boolean).join(' ')}
            >
              <button
                className={`set-row__index ${set.isWarmup ? 'set-row__index--warmup' : ''}`}
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                title={t("Als Aufwärmsatz markieren")}
                onClick={() => patchSet(set.id, { isWarmup: !set.isWarmup })}
              >
                {set.isWarmup ? 'W' : index + 1 - row.sets.slice(0, index).filter((item) => item.isWarmup).length}
              </button>

              {isTimed ? (
                <>
                  <div className="row" style={{ gap: 4 }}>
                    <NumberInput
                      value={set.durationSec}
                      ariaLabel={t('Dauer in Sekunden')}
                      onChange={(value) => patchSet(set.id, { durationSec: value })}
                    />
                    {(set.durationSec ?? 0) > 0 && !set.done && (
                      <HoldCountdown
                        seconds={set.durationSec ?? 0}
                        beepOnEnd={state.settings.countdownBeep}
                        onDone={() => onToggleSet(set.id)}
                      />
                    )}
                  </div>
                  <NumberInput
                    value={set.distanceKm}
                    ariaLabel={t('Distanz in Kilometern')}
                    onChange={(value) => patchSet(set.id, { distanceKm: value })}
                  />
                </>
              ) : (
                <>
                  <NumberInput
                    value={set.weightKg}
                    ariaLabel={t('Gewicht in Kilogramm')}
                    onChange={(value) => patchSet(set.id, { weightKg: value })}
                    step={kgStep}
                  />
                  <NumberInput
                    value={set.reps}
                    ariaLabel={t('Wiederholungen')}
                    onChange={(value) => patchSet(set.id, { reps: value })}
                  />
                </>
              )}

              <NumberInput
                value={fromRpe(set.rpe, useRir)}
                ariaLabel={useRir ? t('Wiederholungen in Reserve') : 'RPE'}
                min={0}
                max={useRir ? 9 : 10}
                onChange={(value) => patchSet(set.id, { rpe: toRpe(value, useRir) })}
                placeholder="–"
              />

              <div className="row" style={{ gap: 2 }}>
                <button
                  className={`check ${set.done ? 'check--on' : ''}`}
                  onClick={() => onToggleSet(set.id)}
                  aria-label={set.done ? t('Satz zurücksetzen') : t('Satz abhaken')}
                >
                  <IconCheck />
                </button>
                <button
                  className={`set-more ${openSet === set.id ? 'set-more--on' : ''}`}
                  onClick={() => setOpenSet(openSet === set.id ? null : set.id)}
                  aria-label={t('Notiz und Partner für diesen Satz')}
                  aria-expanded={openSet === set.id}
                >
                  ⋯
                </button>
              </div>
            </div>

            {/*
              * Plus/Minus nur unter dem Satz, an dem man gerade steht - nicht
              * unter jeder Zeile. Ein Tipper je Scheibe statt der Zahlentastatur.
              */}
            {set.id === currentSet?.id && !set.done && !isTimed && (
              <div className="set-steppers">
                <div className="set-steppers__group">
                  <button className="set-steppers__btn" onClick={() => bumpSet(set, 'weightKg', -kgStep)} aria-label={t('Gewicht verringern')}>−</button>
                  <span className="set-steppers__val">
                    {set.weightKg != null ? fmt(set.weightKg, set.weightKg % 1 ? 1 : 0) : '–'}
                    <span className="set-steppers__unit"> kg</span>
                  </span>
                  <button className="set-steppers__btn" onClick={() => bumpSet(set, 'weightKg', kgStep)} aria-label={t('Gewicht erhöhen')}>+</button>
                </div>
                <div className="set-steppers__group">
                  <button className="set-steppers__btn" onClick={() => bumpSet(set, 'reps', -1)} aria-label={t('Eine Wiederholung weniger')}>−</button>
                  <span className="set-steppers__val">
                    {set.reps ?? '–'}<span className="set-steppers__unit"> Wdh</span>
                  </span>
                  <button className="set-steppers__btn" onClick={() => bumpSet(set, 'reps', 1)} aria-label={t('Eine Wiederholung mehr')}>+</button>
                </div>
              </div>
            )}

            {openSet === set.id && (
              <div className="set-extra" key={`${set.id}-extra`}>
                <input
                  className="input input--sm"
                  placeholder={t("Notiz zum Satz, z. B. enger Griff")}
                  value={set.note ?? ''}
                  onChange={(event) => patchSet(set.id, { note: event.target.value || undefined })}
                />
                <button
                  className="chip chip--button"
                  onClick={() => duplicateSet(set.id)}
                >
                  {t('Satz duplizieren')}
                </button>
                {row.sets.filter((item) => !item.done && !item.isWarmup).length > 1 && (
                  <button
                    className="chip chip--button"
                    onClick={() => applySetToRest(set.id)}
                  >
                    {t('Auf alle offenen übernehmen')}
                  </button>
                )}
                <PlateHint exercise={row.exercise} weightKg={set.weightKg} />
                {partnerName && (
                  <button
                    className={`chip chip--button ${set.forPartner ? 'chip--accent' : ''}`}
                    aria-pressed={Boolean(set.forPartner)}
                    onClick={() => patchSet(set.id, { forPartner: !set.forPartner })}
                  >
                    {t('Satz von {name}', { name: partnerName })}
                  </button>
                )}
              </div>
            )}
          </Fragment>
          ))}

          {/*
            * Nur die zwei Handgriffe, die man zwischen den Saetzen wirklich
            * braucht, stehen als Knopf da. Der Rest liegt hinter "Mehr" -
            * sichtbar, wenn man ihn sucht, und still, wenn nicht.
            */}
          <div className="exercise__actions">
            <button className="btn btn--sm" onClick={onAddSet}><IconPlus /> {t("Satz")}</button>
            <button
              className="btn btn--sm"
              onClick={() => onStartRest(effectiveRest)}
            >
              <IconClock /> {t('Pause')}
            </button>
            <button className="btn btn--sm" onClick={() => setCalcOpen(true)}>
              <IconCalculator /> {t('Rechner')}
            </button>
            <span className="spacer" />
            <button
              className={`btn btn--sm btn--ghost ${moreOpen ? 'btn--on' : ''}`}
              onClick={() => setMoreOpen(!moreOpen)}
              aria-expanded={moreOpen}
            >
              {t('Mehr')}
            </button>
          </div>

          {moreOpen && (
            <div className="exercise__more">
              {/* Pause fuer genau diese Uebung - schlaegt Plan und Standard. */}
              <div className="row row--wrap" style={{ gap: 6, alignItems: 'center', marginBottom: 9 }}>
                <span className="tiny dim">{t('Pause')}</span>
                {[60, 90, 120, 150, 180].map((sec) => (
                  <button
                    key={sec}
                    className={`chip chip--button ${effectiveRest === sec ? 'chip--accent' : ''}`}
                    onClick={() => setRest(sec === planRest ? undefined : sec)}
                  >
                    {sec % 60 === 0 ? t('{min} min', { min: sec / 60 }) : t('{sec} s', { sec })}
                  </button>
                ))}
              </div>
              <div className="row row--wrap" style={{ gap: 7 }}>
                {!isTimed && !row.sets.some((set) => set.isWarmup) && (
                  <button className="btn btn--sm" onClick={addWarmup} title={t("Aufwärmsätze davorstellen")}>
                    {t('Aufwärmen')}
                  </button>
                )}
                <button className="btn btn--sm" onClick={onOpenDetail}><IconChart /> {t("Fortschritt")}</button>
                <button className="btn btn--sm" onClick={onSwap} title={t("Gerät besetzt? Ersatz suchen")}>
                  <IconSwap /> {t('Ersatz')}
                </button>
                {row.sets.length > 1 && (
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => removeSet(row.sets[row.sets.length - 1].id)}
                  >
                    <IconX /> {t('Satz entfernen')}
                  </button>
                )}
                {row.logged && !row.fromPlan && (
                  <button className="btn btn--sm btn--ghost" onClick={onRemove} aria-label={t("Übung entfernen")}>
                    <IconTrash /> {t('Übung')}
                  </button>
                )}
              </div>

              {row.logged && (
                <input
                  className="input input--sm"
                  style={{ marginTop: 9 }}
                  placeholder={t("Notiz zur Übung…")}
                  value={row.logged.note ?? ''}
                  onChange={(event) => onUpdate(row, (logged) => ({ ...logged, note: event.target.value }))}
                />
              )}
            </div>
          )}

          {calcOpen && (
            <Suspense fallback={null}>
            <WeightCalculator
              exercise={row.exercise}
              weightKg={currentSet?.weightKg ?? null}
              reps={currentSet?.reps ?? null}
              onClose={() => setCalcOpen(false)}
              onApply={(kg) => onUpdate(row, (logged) => ({
                ...logged,
                sets: logged.sets.map((set) => (
                  set.done || set.isWarmup ? set : { ...set, weightKg: kg }
                )),
              }))}
            />
            </Suspense>
          )}

          {row.logged && exerciseVolume(row.logged) > 0 && (
            <div className="tiny dim right" style={{ marginTop: 7 }}>
              Volumen heute: {fmt(exerciseVolume(row.logged))} kg
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * Was liegt bei diesem Gewicht auf der Stange?
 *
 * Steht direkt unter dem Gewichtsfeld, weil man genau dort danach fragt - und
 * nur dort, wo es die Frage ueberhaupt gibt: an Maschine und Kabelzug steckt
 * man einen Stift in einen Block.
 */
function PlateHint({ exercise, weightKg }: { exercise: Exercise | undefined; weightKg: number | null }) {
  const { state } = useStore();
  if (!usesBarbell(exercise) || !weightKg) return null;
  const loaded = platesFor(weightKg, state.settings.barWeightKg, state.settings.plateSet);
  if (!loaded) return null;
  return (
    <span className="tiny dim nowrap">
      {t('je Seite')}: {describePlates(loaded.perSide)}
      {loaded.offByKg !== 0 && ` (${loaded.totalKg.toLocaleString('de-DE')} kg)`}
    </span>
  );
}

/** Fasst Sätze kompakt zusammen, z. B. "3 × 80 kg × 8". */
function summarizeSets(sets: SetLog[], isTimed: boolean, kind?: Exercise['kind']): string {
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
    .map((group) => `${group.count > 1 ? `${group.count}× ` : ''}${formatSet(group.weight, group.reps, kind)}`)
    .join(', ');
}

/* --------------------------------------------------------------- Pausenuhr */

function RestTimer({
  endsAt, fullscreen, onFullscreenChange, onClose, onExtend,
}: {
  endsAt: number;
  fullscreen: boolean;
  onFullscreenChange: (value: boolean) => void;
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
  const label = remaining > 0 ? formatClock(remaining) : t('Los!');

  useEffect(() => {
    if (remaining > 0) return;
    // Kurzes Vibrieren, wenn das Gerät es unterstützt.
    navigator.vibrate?.([120, 60, 120]);
    const timer = window.setTimeout(onClose, 2500);
    return () => window.clearTimeout(timer);
  }, [remaining, onClose]);

  /*
   * Vollbild: Die Zahl soll von der Bank aus lesbar sein, ohne das Handy in
   * die Hand zu nehmen. Wer das einmal will, will es meistens immer - deshalb
   * merkt sich die App die Entscheidung, statt bei jeder Pause zu fragen.
   */
  if (fullscreen) {
    return (
      <div className="rest-full" role="timer" aria-live="off">
        <button
          className="rest-full__shrink"
          onClick={() => onFullscreenChange(false)}
          aria-label={t('Pausenuhr klein anzeigen')}
        >
          <IconExpand />
        </button>
        <div className="rest-full__time">{label}</div>
        <div className="rest-full__bar"><span style={{ width: `${barWidth}%` }} /></div>
        <div className="row" style={{ gap: 10, marginTop: 22 }}>
          <button className="btn btn--lg" onClick={onExtend}>+30 s</button>
          <button className="btn btn--lg btn--primary" onClick={onClose}>{t('Weiter')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rest-timer" role="timer">
      <IconClock style={{ width: 20, height: 20 }} />
      <span className="rest-timer__time">{label}</span>
      <span className="spacer" />
      <button
        className="btn btn--sm btn--ghost"
        style={{ color: '#fff' }}
        onClick={() => onFullscreenChange(true)}
        aria-label={t('Pausenuhr groß anzeigen')}
      >
        <IconExpand />
      </button>
      <button className="btn btn--sm" style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'transparent', color: '#fff' }} onClick={onExtend}>
        +30 s
      </button>
      <button className="btn btn--sm btn--ghost" style={{ color: '#fff' }} onClick={onClose} aria-label={t("Pause beenden")}>
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
          <button className="btn btn--sm" onClick={onStop}>{t("Training beenden")}</button>
        </>
      ) : (
        <button className="btn btn--sm" onClick={onStart}>
          <IconClock /> {workout?.endedAt ? t('Neu starten') : t('Zeit messen')}
        </button>
      )}

      <span className="spacer" />
      <button className={`btn btn--sm ${sortMode ? 'btn--primary' : ''}`} onClick={onToggleSort}>
        {sortMode ? t('Fertig') : t('Sortieren')}
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
      <span className="record-banner__icon"><IconTrophy /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="bold small">{record.label}</div>
        <div className="tiny" style={{ opacity: 0.85 }}>{name} · {record.value}</div>
      </div>
      <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label={t("Schließen")}>
        <IconX />
      </button>
    </div>
  );
}


/**
 * Wetter zum Trainingstag.
 *
 * Erscheint nur, wenn an dem Tag ueberhaupt etwas draussen ansteht - wer im
 * Studio Bankdruecken macht, dem ist Regen egal, und eine Wetterkarte ueber
 * der Satzliste waere dann nur Zierrat.
 */
function WeatherNote({ rows, date }: { rows: Row[]; date: string }) {
  const { state } = useStore();
  const [days, setDays] = useState<DayWeather[]>([]);
  const settings = state.settings.weather;

  const outdoor = useMemo(
    () => rows.map((row) => row.exercise).filter((exercise) => isOutdoor(exercise)),
    [rows],
  );

  const active = settings.enabled && settings.lat != null && settings.lon != null && outdoor.length > 0;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void loadWeather(settings.lat as number, settings.lon as number).then((result) => {
      if (!cancelled) setDays(result);
    });
    return () => { cancelled = true; };
  }, [active, settings.lat, settings.lon]);

  if (!active) return null;

  const day = weatherForDate(days, date);
  if (!day) return null;

  const warning = weatherWarning(day);

  return (
    <div className="weather">
      <span className="weather__symbol" aria-hidden="true">{weatherSymbol(day.code)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="weather__line">
          {describeCode(day.code)}
          {' · '}
          <span className="mono">{Math.round(day.maxC)}°</span>
          <span className="dim">{' / '}{Math.round(day.minC)}°</span>
          {day.rainChance != null && <span className="dim">{` · ${day.rainChance} % Regen`}</span>}
        </div>
        <div className="tiny dim">
          {warning ?? t('{place} · für {exercise}', {
            place: settings.placeName || t('dein Ort'),
            exercise: exerciseName(outdoor[0]),
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Wer von den Freunden am selben Tag trainiert hat.
 *
 * "Gemeinsames Training" ohne echten gemeinsamen Zustand: Jeder hakt auf
 * seinem Geraet ab, und hier steht, was beim anderen zusammengekommen ist -
 * aus dem, was er ohnehin als Fortschritt freigibt.
 */
function TrainingCompanions({ date }: { date: string }) {
  const sync = useSync();

  const companions = useMemo(() => {
    const out: Array<{ id: string; name: string; emoji: string; sets: number; volume: number; title: string }> = [];
    for (const friend of sync.friends) {
      if (friend.state !== 'accepted') continue;
      const session = sync.friendData[friend.userId]?.progress?.recent?.find((item) => item.date === date);
      if (session && session.sets > 0) {
        out.push({
          id: friend.userId,
          name: friend.displayName,
          emoji: friend.emoji,
          sets: session.sets,
          volume: session.volume,
          title: session.title,
        });
      }
    }
    return out;
  }, [sync.friends, sync.friendData, date]);

  if (companions.length === 0) return null;

  return (
    <Section title={t("Heute auch dabei")}>
      <div className="list">
        {companions.map((companion) => (
          <div key={companion.id} className="row row--between small">
            <span className="row" style={{ gap: 8, minWidth: 0 }}>
              <span className="feed-item__avatar" style={{ width: 28, height: 28, fontSize: '0.95rem' }}>
                {companion.emoji}
              </span>
              <span style={{ minWidth: 0 }}>
                <span className="bold">{companion.name}</span>
                <span className="tiny dim" style={{ display: 'block' }}>{companion.title}</span>
              </span>
            </span>
            <span className="tiny dim mono nowrap">
              {t('{sets} Sätze · {kg} kg', { sets: companion.sets, kg: fmt(companion.volume) })}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * Anleitungen fuer den heutigen Tag im Voraus holen.
 *
 * Gedacht fuer zu Hause, bevor man losfaehrt: Im Studio steht man oft im
 * Keller mit einem Balken Empfang, und dann ist eine Anleitung, die erst
 * geladen werden muss, keine Anleitung. Der Knopf verschwindet, sobald alles
 * da ist - ein Knopf, der nichts mehr zu tun hat, ist nur noch Moebel.
 */
function GuidePrefetch({ rows }: { rows: Row[] }) {
  const { state } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [hidden, setHidden] = useState(false);

  const missing = useMemo(
    () => rows
      .map((row) => row.exercise)
      .filter((exercise): exercise is Exercise => Boolean(exercise))
      .filter((exercise) => !cachedGuide(exercise.id)),
    [rows],
  );

  if (hidden || missing.length === 0 || !state.settings.useWgerApi) return null;

  const run = async () => {
    setBusy({ done: 0, total: missing.length });
    const loaded = await prefetchGuides(missing, (done, total) => setBusy({ done, total }));
    setBusy(null);
    setHidden(true);
    toast.show(loaded > 0
      ? t('{count} Anleitungen liegen jetzt auf dem Gerät', { count: loaded })
      : t('Dazu war nichts zu finden'));
  };

  return (
    <button className="btn btn--sm btn--block" onClick={() => void run()} disabled={Boolean(busy)}>
      <IconBook />
      {busy
        ? t('{done} von {total} …', { done: busy.done, total: busy.total })
        : t('Anleitungen für heute aufs Gerät laden')}
    </button>
  );
}

/**
 * Welche Muskeln das heutige Training abdeckt. Kraeftig eingefaerbt ist,
 * was schon abgehakt wurde, blass das, was noch aussteht.
 */
function SessionMuscles({ rows }: { rows: Row[] }) {
  const [mapOpen, setMapOpen] = useState(false);

  const { done, planned } = useMemo(() => {
    const doneRegions = new Set<MuscleRegion>();
    const plannedRegions = new Set<MuscleRegion>();
    for (const row of rows) {
      if (!row.exercise) continue;
      const { primary, secondary } = regionsOf(row.exercise);
      const target = row.sets.some(countsAsWork) ? doneRegions : plannedRegions;
      for (const region of primary) target.add(region);
      for (const region of secondary) plannedRegions.add(region);
    }
    for (const region of doneRegions) plannedRegions.delete(region);
    return { done: doneRegions, planned: plannedRegions };
  }, [rows]);

  if (done.size === 0 && planned.size === 0) return null;

  const intensity = (region: MuscleRegion): Intensity => {
    if (done.has(region)) return 'primary';
    if (planned.has(region)) return 'secondary';
    return 'none';
  };

  return (
    <Section
      title={t("Heute beansprucht")}
      note={(
        <button
          className="btn btn--sm btn--ghost"
          onClick={() => setMapOpen(!mapOpen)}
          aria-expanded={mapOpen}
        >
          {mapOpen ? t('Liste') : t('Karte')}
        </button>
      )}
    >

      {/*
        * Zwei ganze Koerper unter der Satzliste waren auf dem Handy fast ein
        * Bildschirm. Als Zeile mit Punkten steht dieselbe Auskunft in einem
        * Zehntel des Platzes; die grosse Ansicht ist einen Tipper entfernt und
        * bleibt in der Uebungsansicht ohnehin.
        */}
      {mapOpen ? (
        <>
          <BodyMap intensity={intensity} size={130} />
          <div className="tiny dim center" style={{ marginTop: 8 }}>
            {t("kräftig = schon trainiert")}
          </div>
        </>
      ) : (
        <div className="muscle-strip">
          {[...done].map((region) => (
            <span key={region} className="muscle-strip__item muscle-strip__item--done">
              <span className="muscle-strip__dot" />
              {t(REGION_LABELS[region])}
            </span>
          ))}
          {[...planned].map((region) => (
            <span key={region} className="muscle-strip__item">
              <span className="muscle-strip__dot" />
              {t(REGION_LABELS[region])}
            </span>
          ))}
        </div>
      )}
    </Section>
  );
}


/**
 * Ersatzuebungen: Was trifft dieselben Zielmuskeln? Ist ein Geraeteprofil
 * hinterlegt, stehen die machbaren Uebungen oben; der Rest bleibt sichtbar,
 * denn im fremden Studio steht manchmal doch etwas anderes herum.
 */
function SwapDialog({
  row, onClose, onPick,
}: {
  row: Row;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}) {
  const { state, allExercises, getExercise } = useStore();
  const available = state.settings.availableEquipment;

  // Im Plan hinterlegte Ersatzuebungen stehen oben - dort hat sich jemand die
  // Frage schon einmal beantwortet.
  const chosenAlternatives = useMemo(() => {
    const ids = row.planExercise?.alternativeIds ?? [];
    return ids
      .map((id) => getExercise(id))
      .filter((exercise): exercise is Exercise => Boolean(exercise));
  }, [row.planExercise?.alternativeIds, getExercise]);

  const candidates = useMemo(() => {
    if (!row.exercise) return [];
    const { primary } = regionsOf(row.exercise);
    if (primary.size === 0) return [];

    const chosen = new Set(chosenAlternatives.map((exercise) => exercise.id));
    const seen = new Map<string, { exercise: Exercise; hits: number }>();
    for (const region of primary) {
      for (const exercise of suggestForRegion(allExercises, region)) {
        if (exercise.id === row.exerciseId || chosen.has(exercise.id)) continue;
        const entry = seen.get(exercise.id) ?? { exercise, hits: 0 };
        entry.hits += 1;
        seen.set(exercise.id, entry);
      }
    }

    return [...seen.values()]
      .map((entry) => ({ ...entry, fits: fitsEquipment(entry.exercise, available) }))
      .sort((a, b) => (
        Number(b.fits) - Number(a.fits)
        || b.hits - a.hits
        || a.exercise.name.localeCompare(b.exercise.name)
      ))
      .slice(0, 30);
  }, [row.exercise, row.exerciseId, allExercises, available, chosenAlternatives]);

  const regions = row.exercise ? [...regionsOf(row.exercise).primary] : [];

  return (
    <Modal title={t('Ersatz für {name}', { name: exerciseName(row.exercise) })} onClose={onClose} flush>
      <div style={{ padding: '12px 14px 6px' }}>
        <div className="row row--wrap" style={{ gap: 6 }}>
          {regions.map((region) => (
            <span key={region} className="chip chip--accent">{t(REGION_LABELS[region])}</span>
          ))}
        </div>
        <div className="tiny dim" style={{ marginTop: 8 }}>
          {t("Die eingetragenen Sätze bleiben stehen.")}
        </div>
      </div>

      <div style={{ maxHeight: '54vh', overflowY: 'auto' }}>
        {chosenAlternatives.length > 0 && (
          <>
            <div className="section-label" style={{ padding: '4px 14px 6px' }}>{t('Aus dem Plan')}</div>
            {chosenAlternatives.map((exercise) => (
              <button key={exercise.id} className="search-result" onClick={() => onPick(exercise)}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="search-result__name">{exerciseName(exercise)}</span>
                  <span className="search-result__meta" style={{ display: 'block' }}>
                    <span
                      className="cat-dot"
                      style={{ '--cat': categoryColor(exercise.category) } as React.CSSProperties}
                    />
                    <span style={{ fontWeight: 550 }}>{t(CATEGORY_LABELS[exercise.category])}</span>
                  </span>
                </span>
              </button>
            ))}
            <div className="section-label" style={{ padding: '10px 14px 6px' }}>{t('Weitere')}</div>
          </>
        )}
        {candidates.length === 0 && chosenAlternatives.length === 0 && (
          <div className="empty tiny">{t("Keine passende Alternative gefunden.")}</div>
        )}
        {candidates.map(({ exercise, fits }) => (
          <button key={exercise.id} className="search-result" onClick={() => onPick(exercise)}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exerciseName(exercise)}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                <span
                  className="cat-dot"
                  style={{ '--cat': categoryColor(exercise.category) } as React.CSSProperties}
                />
                <span style={{ fontWeight: 550 }}>{t(CATEGORY_LABELS[exercise.category])}</span>
                {` · ${exercise.equipment.length > 0 ? exercise.equipment.join(', ') : t('ohne Gerät')}`}
              </span>
            </span>
            {!fits && available.length > 0 && <span className="chip chip--warn">{t("fehlt dir")}</span>}
          </button>
        ))}
      </div>
    </Modal>
  );
}


/**
 * Countdown fuer Halteuebungen. Laeuft rueckwaerts, haelt sich an die Uhr statt
 * an gezaehlte Ticks - ein Tab im Hintergrund darf die Zeit nicht verschleppen.
 * Am Ende wird der Satz abgehakt und, wenn gewuenscht, ein Ton gespielt.
 */
function HoldCountdown({
  seconds, beepOnEnd, onDone,
}: {
  seconds: number;
  beepOnEnd: boolean;
  onDone: () => void;
}) {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(false);

  useEffect(() => {
    if (endsAt == null) return undefined;
    doneRef.current = false;

    const tick = () => {
      const remaining = Math.ceil((endsAt - Date.now()) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0 && !doneRef.current) {
        doneRef.current = true;
        if (beepOnEnd) beep();
        navigator.vibrate?.([120, 60, 120]);
        setEndsAt(null);
        onDone();
      }
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [endsAt, beepOnEnd, onDone]);

  if (endsAt == null) {
    return (
      <button
        className="btn btn--sm btn--icon"
        onClick={() => { setLeft(seconds); setEndsAt(Date.now() + seconds * 1000); }}
        aria-label={t('Countdown starten')}
        title={t('Countdown starten')}
      >
        <IconPlay />
      </button>
    );
  }

  return (
    <button
      className="btn btn--sm btn--icon btn--accent"
      onClick={() => setEndsAt(null)}
      aria-label={t('Countdown abbrechen')}
      style={{ minWidth: 42, fontVariantNumeric: 'tabular-nums' }}
    >
      {left}
    </button>
  );
}


/**
 * Ein Training auf einen anderen Tag schieben.
 *
 * Bewusst mit Vorwarnung statt mit stillem Zusammenfuehren: Liegt am Zieltag
 * schon ein Training, muesste man raten, was gewinnt. Dann lieber sagen, dass
 * es dort nicht hingeht.
 */
function MoveWorkoutDialog({
  workout, taken, onClose, onMove,
}: {
  workout: Workout;
  taken: string[];
  onClose: () => void;
  onMove: (date: string) => void;
}) {
  const [target, setTarget] = useState(workout.date);
  const busy = target !== workout.date && taken.includes(target);

  return (
    <Modal title={t('Training verschieben')} onClose={onClose}>
      <div className="list">
        <p className="small muted">
          {t('Das Training vom {date} wandert samt allen Sätzen auf den gewählten Tag.', {
            date: formatDateShort(workout.date),
          })}
        </p>

        <div className="field">
          <label className="field__label">{t("Neues Datum")}</label>
          <DateInput value={target} max={todayISO()} onChange={setTarget} />
        </div>

        {busy && (
          <div className="tiny" style={{ color: 'var(--warn)' }}>
            {t('An diesem Tag steht schon ein Training. Lösch es erst oder wähl einen anderen Tag.')}
          </div>
        )}

        <button
          className="btn btn--primary btn--block"
          disabled={busy || target === workout.date}
          onClick={() => onMove(target)}
        >
          {t('Verschieben')}
        </button>
      </div>
    </Modal>
  );
}
