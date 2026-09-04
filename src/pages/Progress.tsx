import { useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { CATEGORY_LABELS } from '../data/catalog';
import { categoryColor } from '../lib/categoryColors';
import { addDays, formatDateShort, formatDateTiny, todayISO } from '../lib/date';
import {
  exerciseHistory, personalRecords, streakInfo, volumeByCategory, weeklySummaries,
  workoutSetCount, workoutVolume,
} from '../lib/stats';
import { useStore } from '../storage/store';
import { BarChart, LineChart, Sparkline, type Point } from '../components/charts/Charts';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { EmptyState, Stat, fmt } from '../components/ui';
import { formatClock } from '../lib/date';
import { IconChevronRight, IconSearch } from '../components/icons';

type Range = 30 | 90 | 365 | 0;

const RANGE_LABELS: Record<Range, string> = {
  30: '30 Tage', 90: '3 Monate', 365: '1 Jahr', 0: 'Alles',
};

/** Waehlt den passenden Bestwert: Zeit bei Halte-/Cardio-Uebungen, sonst Gewicht. */
function bestLabel(exercise: Exercise, records: ReturnType<typeof personalRecords>): string {
  const timed = exercise.kind === 'time' || exercise.kind === 'cardio';
  if (timed && records.maxDurationSec) return ` · Bestzeit ${formatClock(records.maxDurationSec.value)}`;
  if (!timed && records.maxWeight) {
    return ` · Bestwert ${fmt(records.maxWeight.value, 1)} kg × ${records.maxWeight.reps}`;
  }
  if (records.maxReps) return ` · max. ${records.maxReps.value} Wdh`;
  return '';
}

export function ProgressPage() {
  const { state, getExercise } = useStore();
  const [range, setRange] = useState<Range>(90);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [filter, setFilter] = useState('');

  const since = range === 0 ? '0000-01-01' : addDays(todayISO(), -range);

  const workouts = useMemo(
    () => state.workouts.filter((workout) => workout.date >= since && workoutSetCount(workout) > 0),
    [state.workouts, since],
  );

  const streak = useMemo(() => streakInfo(state), [state]);

  const totals = useMemo(() => {
    const volume = workouts.reduce((sum, workout) => sum + workoutVolume(workout), 0);
    const sets = workouts.reduce((sum, workout) => sum + workoutSetCount(workout), 0);
    return { volume, sets, count: workouts.length };
  }, [workouts]);

  const weekly = useMemo(() => weeklySummaries(state, range === 0 ? 26 : Math.ceil(range / 7)), [state, range]);

  const weeklyVolumePoints: Point[] = weekly.map((week) => ({
    label: week.key.replace(/^\d{4}-/, ''),
    value: Math.round(week.volume),
    detail: `${week.key} · ${week.workouts} Einheiten`,
  }));

  const weeklySetPoints: Point[] = weekly.map((week) => ({
    label: week.key.replace(/^\d{4}-/, ''),
    value: week.sets,
    detail: `${week.key} · ${week.workouts} Einheiten`,
  }));

  const weightPoints: Point[] = useMemo(
    () => state.weightLog
      .filter((entry) => entry.date >= since)
      .map((entry) => ({ label: formatDateTiny(entry.date), value: entry.kg, detail: formatDateShort(entry.date) })),
    [state.weightLog, since],
  );

  const byCategory = useMemo(
    () => volumeByCategory(state, (id) => getExercise(id)?.category ?? 'other', since),
    [state, getExercise, since],
  );

  /** Alle Übungen, zu denen es im Zeitraum Daten gibt - mit Trend. */
  const trackedExercises = useMemo(() => {
    const ids = new Set<string>();
    for (const workout of workouts) {
      for (const logged of workout.exercises) {
        if (logged.sets.some((set) => set.done)) ids.add(logged.exerciseId);
      }
    }

    return [...ids]
      .map((id) => {
        const exercise = getExercise(id);
        const history = exerciseHistory(state, id).filter((session) => session.date >= since);
        const records = personalRecords(state, id);
        const series = history.map((session) => session.best1RM || session.volume || session.totalReps);
        const first = series[0] ?? 0;
        const last = series[series.length - 1] ?? 0;
        const trend = first > 0 && series.length > 1 ? ((last - first) / first) * 100 : null;
        return { id, exercise, sessions: history.length, records, series, trend };
      })
      .filter((item) => item.exercise)
      .sort((a, b) => b.sessions - a.sessions);
  }, [workouts, getExercise, state, since]);

  const visibleExercises = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return trackedExercises;
    return trackedExercises.filter((item) => item.exercise!.name.toLowerCase().includes(needle));
  }, [trackedExercises, filter]);

  return (
    <>
      <div className="chip-scroll">
        {(Object.keys(RANGE_LABELS) as unknown as Range[]).map((key) => (
          <button
            key={key}
            className={`chip chip--button ${range === Number(key) ? 'chip--accent' : ''}`}
            onClick={() => setRange(Number(key) as Range)}
          >
            {RANGE_LABELS[Number(key) as Range]}
          </button>
        ))}
      </div>

      <div className="grid-auto">
        <Stat label="Einheiten" value={totals.count} sub={`${RANGE_LABELS[range]}`} tone="accent" />
        <Stat label="Sätze" value={totals.sets} />
        <Stat label="Volumen" value={fmt(totals.volume)} unit="kg" />
        <Stat
          label="Wochen-Serie"
          value={streak.current}
          unit={streak.current === 1 ? 'Woche' : 'Wochen'}
          sub={`Rekord: ${streak.longest}`}
          tone="success"
        />
      </div>

      {totals.count === 0 ? (
        <EmptyState
          icon="📈"
          title="Noch keine Trainings im Zeitraum"
          hint="Sobald du Sätze abhakst, entstehen hier automatisch Auswertungen."
        />
      ) : (
        <>
          <div className="card">
            <div className="card__header">
              <div className="card__title">Volumen je Woche</div>
              <span className="tiny dim">kg gesamt</span>
            </div>
            <BarChart points={weeklyVolumePoints} unit="kg" />
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title">Sätze je Woche</div>
              <span className="tiny dim">abgehakte Arbeitssätze</span>
            </div>
            <BarChart points={weeklySetPoints} color="var(--violet)" />
          </div>

          {byCategory.length > 0 && (
            <div className="card">
              <div className="card__header">
                <div className="card__title">Verteilung nach Muskelgruppe</div>
                <span className="tiny dim">{RANGE_LABELS[range]}</span>
              </div>
              <div className="list">
                {byCategory.map((entry) => {
                  const max = byCategory[0].sets || 1;
                  return (
                    <div key={entry.category}>
                      <div className="row row--between tiny" style={{ marginBottom: 4 }}>
                        <span className="row bold" style={{ gap: 6 }}>
                          <span
                            className="cat-dot"
                            style={{ '--cat': categoryColor(entry.category as never) } as React.CSSProperties}
                          />
                          {CATEGORY_LABELS[entry.category as keyof typeof CATEGORY_LABELS] ?? entry.category}
                        </span>
                        <span className="dim">{entry.sets} Sätze · {fmt(entry.volume)} kg</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar__fill"
                          style={{
                            width: `${(entry.sets / max) * 100}%`,
                            background: categoryColor(entry.category as never),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {weightPoints.length > 1 && (
        <div className="card">
          <div className="card__header">
            <div className="card__title">Körpergewicht</div>
            <span className="tiny dim">
              {fmt(weightPoints[weightPoints.length - 1].value, 1)} kg aktuell
            </span>
          </div>
          <LineChart points={weightPoints} unit="kg" color="var(--success)" formatValue={(value) => fmt(value, 1)} />
        </div>
      )}

      <div className="card card--flush">
        <div className="row" style={{ padding: '12px 14px 8px', gap: 8 }}>
          <div className="card__title" style={{ flex: 1 }}>Fortschritt je Übung</div>
        </div>
        <div style={{ padding: '0 14px 10px', position: 'relative' }}>
          <IconSearch style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-dim)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Übung filtern…"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>

        {visibleExercises.length === 0 && (
          <div className="empty tiny">Keine passenden Übungen mit Daten.</div>
        )}

        {visibleExercises.map((item) => (
          <button
            key={item.id}
            className="search-result"
            onClick={() => setDetail(item.exercise!)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{item.exercise!.name}</span>
              <span className="search-result__meta" style={{ display: 'block' }}>
                {item.sessions} Einheiten{bestLabel(item.exercise!, item.records)}
              </span>
            </span>
            {item.series.length > 1 && (
              <Sparkline
                values={item.series}
                width={56}
                color={item.trend != null && item.trend < 0 ? 'var(--danger)' : 'var(--success)'}
              />
            )}
            {item.trend != null && (
              <span className={`chip ${item.trend >= 0 ? 'chip--success' : 'chip--danger'}`}>
                {item.trend >= 0 ? '+' : ''}{fmt(item.trend, 0)} %
              </span>
            )}
            <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
          </button>
        ))}
      </div>

      {detail && <ExerciseDetail exercise={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
