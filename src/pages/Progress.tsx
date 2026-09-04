import { exerciseName, t } from '../i18n';
import { useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { CATEGORY_LABELS } from '../data/catalog';
import { categoryColor } from '../lib/categoryColors';
import { addDays, formatDateShort, formatDateTiny, todayISO } from '../lib/date';
import {
  buildReview, categoryTrend, exerciseHistory, personalRecords, streakInfo, volumeByCategory,
  weeklySummaries, workoutSetCount, workoutVolume,
} from '../lib/stats';
import { useStore } from '../storage/store';
import { BarChart, LineChart, Sparkline, StackedBarChart, type Point } from '../components/charts/Charts';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { EmptyState, Stat, fmt } from '../components/ui';
import { formatClock } from '../lib/date';
import { IconChevronRight, IconSearch } from '../components/icons';

type Range = 30 | 90 | 365 | 0;

const RANGE_LABELS: Record<Range, string> = {
  30: '30 Tage', 90: '3 Monate', 365: '1 Jahr', 0: 'Alles',
};

/** Deutscher Name einer Muskelgruppe, mit Rueckfall auf den Schluessel. */
const labelOf = (key: string): string =>
  t(CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]) ?? key;

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

  /** Rueckblick: der gewaehlte Zeitraum gegen den gleich langen davor. */
  const review = useMemo(() => {
    const span = range === 0 ? 365 : range;
    return buildReview(
      state,
      addDays(todayISO(), -span),
      todayISO(),
      addDays(todayISO(), -span * 2),
      (id) => getExercise(id)?.name,
      (id) => getExercise(id)?.category ?? 'other',
    );
  }, [state, range, getExercise]);

  const trend = useMemo(
    () => categoryTrend(state, (id) => getExercise(id)?.category ?? 'other', range === 0 ? 26 : Math.ceil(range / 7)),
    [state, getExercise, range],
  );

  /** Nur Gruppen anzeigen, die im Zeitraum ueberhaupt vorkommen. */
  const trendSeries = useMemo(() => {
    const seen = new Set<string>();
    for (const point of trend) for (const key of Object.keys(point.byCategory)) seen.add(key);
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [trend]);

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
        <Stat label={t("Einheiten")} value={totals.count} sub={`${RANGE_LABELS[range]}`} tone="accent" />
        <Stat label={t("Sätze")} value={totals.sets} />
        <Stat label={t("Volumen")} value={fmt(totals.volume)} unit={t("kg")} />
        <Stat
          label={t("Wochen-Serie")}
          value={streak.current}
          unit={streak.current === 1 ? t('Woche') : t('Wochen')}
          sub={t('Rekord: {value}', { value: streak.longest })}
          tone="success"
        />
      </div>

      {totals.count === 0 ? (
        <EmptyState
          icon="📈"
          title={t("Noch keine Trainings im Zeitraum")}
          hint={t("Sobald du Sätze abhakst, entstehen hier automatisch Auswertungen.")}
        />
      ) : (
        <>
          <ReviewCard review={review} label={RANGE_LABELS[range]} />

          <div className="card">
            <div className="card__header">
              <div className="card__title">{t("Volumen je Woche")}</div>
              <span className="tiny dim">{t("kg gesamt")}</span>
            </div>
            <BarChart points={weeklyVolumePoints} unit={t("kg")} />
          </div>

          <div className="card">
            <div className="card__header">
              <div className="card__title">{t("Sätze je Woche")}</div>
              <span className="tiny dim">{t("abgehakte Arbeitssätze")}</span>
            </div>
            <BarChart points={weeklySetPoints} color="var(--violet)" />
          </div>

          {trend.length > 1 && trendSeries.length > 0 && (
            <div className="card">
              <div className="card__header">
                <div className="card__title">{t("Muskelgruppen über die Wochen")}</div>
                <span className="tiny dim">{t("Sätze")}</span>
              </div>
              <StackedBarChart
                points={trend.map((point) => ({
                  label: point.week.replace(/^\d{4}-/, ''),
                  values: Object.fromEntries(
                    Object.entries(point.byCategory).map(([key, value]) => [labelOf(key), value]),
                  ),
                  detail: point.week,
                }))}
                series={trendSeries.map(labelOf)}
                colors={Object.fromEntries(
                  trendSeries.map((key) => [labelOf(key), categoryColor(key as never)]),
                )}
                unit={t("Sätze")}
              />
              <div className="row row--wrap tiny" style={{ gap: 9, marginTop: 10 }}>
                {trendSeries.map((key) => (
                  <span key={key} className="row" style={{ gap: 5 }}>
                    <span className="cat-dot" style={{ '--cat': categoryColor(key as never) } as React.CSSProperties} />
                    <span className="dim">{labelOf(key)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {byCategory.length > 0 && (
            <div className="card">
              <div className="card__header">
                <div className="card__title">{t("Verteilung nach Muskelgruppe")}</div>
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
                          {t(CATEGORY_LABELS[entry.category as keyof typeof CATEGORY_LABELS]) ?? entry.category}
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
            <div className="card__title">{t("Körpergewicht")}</div>
            <span className="tiny dim">
              {fmt(weightPoints[weightPoints.length - 1].value, 1)} kg aktuell
            </span>
          </div>
          <LineChart points={weightPoints} unit={t("kg")} color="var(--success)" formatValue={(value) => fmt(value, 1)} />
        </div>
      )}

      <div className="card card--flush">
        <div className="row" style={{ padding: '12px 14px 8px', gap: 8 }}>
          <div className="card__title" style={{ flex: 1 }}>{t("Fortschritt je Übung")}</div>
        </div>
        <div style={{ padding: '0 14px 10px', position: 'relative' }}>
          <IconSearch style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-dim)' }} />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder={t("Übung filtern…")}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>

        {visibleExercises.length === 0 && (
          <div className="empty tiny">{t("Keine passenden Übungen mit Daten.")}</div>
        )}

        {visibleExercises.map((item) => (
          <button
            key={item.id}
            className="search-result"
            onClick={() => setDetail(item.exercise!)}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="search-result__name">{exerciseName(item.exercise!)}</span>
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

/**
 * Beschreibt die Veraenderung gegenueber dem Vorzeitraum.
 * Bei sehr kleiner Ausgangsbasis wird ein Vielfaches angezeigt - eine Angabe
 * wie "+1.200 %" saehe zwar richtig aus, sagt aber nichts.
 */
function describeChange(now: number, before: number): { text: string; tone: string } | null {
  if (before <= 0) return now > 0 ? { text: 'neu', tone: 'chip--accent' } : null;
  const ratio = now / before;
  if (ratio >= 3) return { text: `×${fmt(ratio, 1)}`, tone: 'chip--success' };
  const delta = (now - before) / before * 100;
  if (Math.abs(delta) < 1) return { text: 'gleich', tone: '' };
  return {
    text: `${delta >= 0 ? '+' : ''}${fmt(delta, 0)} %`,
    tone: delta >= 0 ? 'chip--success' : 'chip--danger',
  };
}

/* --------------------------------------------------------------- Rückblick */

/** Stellt den Zeitraum dem gleich langen davor gegenüber. */
function ReviewCard({ review, label }: { review: ReturnType<typeof buildReview>; label: string }) {
  const rows: Array<{ name: string; now: number; before: number; unit?: string }> = [
    { name: 'Einheiten', now: review.current.workouts, before: review.previous.workouts },
    { name: 'Sätze', now: review.current.sets, before: review.previous.sets },
    { name: 'Volumen', now: review.current.volume, before: review.previous.volume, unit: 'kg' },
  ];

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">{t("Rückblick")}</div>
        <span className="tiny dim">{label} gegen den Zeitraum davor</span>
      </div>

      <div className="list">
        {rows.map((row) => {
          const change = describeChange(row.now, row.before);
          return (
            <div key={row.name} className="row row--between">
              <span className="small muted">{row.name}</span>
              <span className="row" style={{ gap: 9 }}>
                <span className="bold mono">
                  {fmt(row.now)}{row.unit && <span className="dim"> {row.unit}</span>}
                </span>
                {change && (
                  <span className={`chip ${change.tone}`}>{change.text}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {review.records.length > 0 && (
        <>
          <div className="divider" style={{ margin: '12px 0 9px' }} />
          <div className="section-label" style={{ marginBottom: 7 }}>
            Bestleistungen in diesem Zeitraum
          </div>
          <div className="list">
            {review.records.map((record) => (
              <div key={`${record.name}-${record.date}`} className="row row--between">
                <span className="small">🏆 {record.name}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="bold mono tiny">{record.value}</span>
                  <span className="tiny dim">{formatDateShort(record.date)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
