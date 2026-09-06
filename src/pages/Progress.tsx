import { exerciseName, t } from '../i18n';
import { useMemo, useState } from 'react';
import type { Exercise, Workout } from '../types';
import { CATEGORY_LABELS } from '../data/catalog';
import { categoryColor } from '../lib/categoryColors';
import { addDays, formatDateShort, formatDateTiny, startOfWeek, todayISO } from '../lib/date';
import {
  buildReview, categoryTrend, exerciseHistory, personalRecords, streakInfo, volumeByCategory,
  weeklySummaries, workoutSetCount, workoutVolume,
  countsAsWork,
} from '../lib/stats';
import { useStore } from '../storage/store';
import {
  BarChart, LineChart, Sparkline, StackedBarChart, YearHeatmap, type Point,
} from '../components/charts/Charts';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { BodyMap, type Intensity } from '../components/MuscleMap';
import { ALL_REGIONS, REGION_LABELS, suggestForRegion, type MuscleRegion } from '../lib/muscles';
import { daysSince, loadStatus, regionLoad, targetFor } from '../lib/muscleLoad';
import { Block, EmptyState, Section, Stat, fmt, useToast } from '../components/ui';
import { formatSet } from '../lib/setFormat';
import { formatClock } from '../lib/date';
import {
  IconChevronRight, IconDownload, IconPrinter, IconSearch, IconTrophy,
} from '../components/icons';
import {
  bodyToCsv, downloadText, printReport, summaryToCsv, workoutsToCsv,
} from '../lib/exportData';

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
    return ` · ${t('Bestwert')} ${formatSet(records.maxWeight.value, records.maxWeight.reps, exercise.kind)}`;
  }
  if (records.maxReps) return ` · max. ${records.maxReps.value} Wdh`;
  return '';
}

export function ProgressPage() {
  const { state, getExercise, allExercises } = useStore();
  const [range, setRange] = useState<Range>(90);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [filter, setFilter] = useState('');
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const toast = useToast();

  const since = range === 0 ? '0000-01-01' : addDays(todayISO(), -range);

  const workouts = useMemo(
    () => state.workouts.filter((workout) => workout.date >= since && workoutSetCount(workout) > 0),
    [state.workouts, since],
  );

  const streak = useMemo(() => streakInfo(state), [state]);

  /** Ein Punkt je Trainingstag fuer den Kalender - Wert sind die Arbeitssaetze. */
  const calendarDays = useMemo(() => state.workouts
    .map((workout) => {
      const sets = workoutSetCount(workout);
      return {
        date: workout.date,
        value: sets,
        title: sets > 0
          ? `${formatDateShort(workout.date)}: ${sets} ${t('Sätze')} · ${fmt(workoutVolume(workout))} kg`
          : formatDateShort(workout.date),
      };
    })
    .filter((day) => day.value > 0), [state.workouts]);

  /** Zusammenfassung fuer den Ausdruck. */
  const printReport_ = () => {
    printReport({
      title: t('Trainingsbericht'),
      rangeLabel: RANGE_LABELS[range],
      stats: [
        { label: t('Einheiten'), value: String(totals.count) },
        { label: t('Sätze'), value: String(totals.sets) },
        { label: t('Volumen'), value: `${fmt(totals.volume)} kg` },
        { label: t('Wochen-Serie'), value: String(streak.current) },
      ],
      sections: [
        {
          heading: t('Fortschritt je Übung'),
          rows: trackedExercises.slice(0, 40).map((item) => [
            `${item.exercise!.name} (${item.sessions} ${t('Einheiten')})`,
            `${item.records.maxWeight ? formatSet(item.records.maxWeight.value, item.records.maxWeight.reps, item.exercise?.kind) : '–'}${
              item.trend != null ? ` · ${item.trend >= 0 ? '+' : ''}${fmt(item.trend, 0)} %` : ''}`,
          ]),
        },
        {
          heading: t('Verteilung nach Muskelgruppe'),
          rows: byCategory.map((entry) => [
            labelOf(entry.category),
            `${entry.sets} ${t('Sätze')} · ${fmt(entry.volume)} kg`,
          ]),
        },
      ],
    });
  };

  /** Trainings der laufenden Kalenderwoche - Grundlage fuer die Wochenziele. */
  const weekWorkouts = useMemo(() => {
    const monday = startOfWeek(todayISO());
    return state.workouts.filter((workout) => workout.date >= monday);
  }, [state.workouts]);

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
      getExercise,
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
        if (logged.sets.some(countsAsWork)) ids.add(logged.exerciseId);
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
          title={t("Noch keine Trainings im Zeitraum")}
          hint={t("Sobald du Sätze abhakst, entstehen hier automatisch Auswertungen.")}
          actionLabel={range !== 0 ? t('Ganzen Zeitraum zeigen') : undefined}
          onAction={range !== 0 ? () => setRange(0) : undefined}
        />
      ) : (
        <div className="split">
          <div className="split__main">
          <Section title={t('Woche für Woche')} note={RANGE_LABELS[range]}>
          <Block title={t("Volumen je Woche")} note={t("kg gesamt")}>
            <BarChart points={weeklyVolumePoints} unit={t("kg")} color="var(--time)" label={t("Volumen je Woche")} />
          </Block>

          <Block title={t("Sätze je Woche")} note={t("abgehakte Arbeitssätze")}>
            {/*
              * Flacher als das Volumen und eine Stufe blasser: die Satzzahl je
              * Woche schwankt kaum, ein zweites Diagramm in voller Höhe
              * daneben doppelt nur die Form darüber.
              */}
            <BarChart
              points={weeklySetPoints}
              height={96}
              color="color-mix(in srgb, var(--time) 52%, var(--surface-3))"
              label={t("Sätze je Woche")}
            />
          </Block>

          {trend.length > 1 && trendSeries.length > 0 && (
            <Block title={t("Muskelgruppen über die Wochen")} note={t("Sätze")}>
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
                label={t("Muskelgruppen über die Wochen")}
              />
              <div className="row row--wrap tiny" style={{ gap: 9, marginTop: 10 }}>
                {trendSeries.map((key) => (
                  <span key={key} className="row" style={{ gap: 5 }}>
                    <span className="cat-dot" style={{ '--cat': categoryColor(key as never) } as React.CSSProperties} />
                    <span className="dim">{labelOf(key)}</span>
                  </span>
                ))}
              </div>
            </Block>
          )}
          </Section>

          {byCategory.length > 0 && (
            <Section title={t('Verteilung')} note={RANGE_LABELS[range]}>
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
                      {/*
                        * Mit nur einer Gruppe waere der Balken immer voll und
                        * saehe kaputt aus - dann reicht die Zeile.
                        */}
                      {byCategory.length > 1 && (
                        <div className="progress-bar">
                          <div
                            className="progress-bar__fill"
                            style={{
                              width: `${(entry.sets / max) * 100}%`,
                              background: categoryColor(entry.category as never),
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title={t("Trainingskalender")} note={t("letzte 27 Wochen")}>
            <YearHeatmap
              days={calendarDays}
              onSelect={(day) => {
                const workout = state.workouts.find((item) => item.date === day);
                if (workout && workoutSetCount(workout) > 0) setCalendarDay(day);
              }}
            />
            <div className="row row--between tiny dim" style={{ marginTop: 8 }}>
              <span>{t('{count} Trainingstage', { count: calendarDays.filter((day) => day.value > 0).length })}</span>
              <span>{t("weniger")} → {t("mehr")}</span>
            </div>
            {calendarDay && (
              <div className="tiny" style={{ marginTop: 8 }}>
                {calendarDays.find((day) => day.date === calendarDay)?.title}
              </div>
            )}
          </Section>
          </div>

          <div className="split__side">
            <ReviewCard review={review} label={RANGE_LABELS[range]} />

            <MuscleLoadCard
              workouts={workouts}
              weekWorkouts={weekWorkouts}
              targets={state.settings.weeklySetTargets}
              getExercise={getExercise}
              allExercises={allExercises}
              rangeLabel={RANGE_LABELS[range]}
              onOpen={setDetail}
            />
          </div>
        </div>
      )}

      {weightPoints.length > 1 && (
        <Section
          title={t("Körpergewicht")}
          note={t('{kg} kg aktuell', { kg: fmt(weightPoints[weightPoints.length - 1].value, 1) })}
        >
          <LineChart
            points={weightPoints}
            unit={t("kg")}
            color="var(--time)"
            label={t("Körpergewicht")}
            formatValue={(value) => fmt(value, 1)}
          />
        </Section>
      )}

      <Section title={t("Fortschritt je Übung")}>
        <div style={{ position: 'relative' }}>
          <IconSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'var(--text-dim)' }} />
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
        <div className="card card--flush">

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
      </Section>

      <Section title={t("Auswertung mitnehmen")}>
        <div className="tiny dim" style={{ marginTop: -6 }}>
          {t("CSV öffnet sich in jeder Tabellenkalkulation. Der Ausdruck lässt sich im Druckdialog als PDF speichern.")}
        </div>
        <div className="grid-2">
          <button
            className="btn"
            onClick={() => {
              downloadText(`gym-tracker-saetze-${todayISO()}.csv`, workoutsToCsv(state, getExercise));
              toast.show(t('CSV gespeichert'));
            }}
          >
            <IconDownload /> {t('Sätze als CSV')}
          </button>
          <button
            className="btn"
            onClick={() => {
              downloadText(`gym-tracker-trainings-${todayISO()}.csv`, summaryToCsv(state));
              toast.show(t('CSV gespeichert'));
            }}
          >
            <IconDownload /> {t('Trainings als CSV')}
          </button>
          <button
            className="btn"
            onClick={() => {
              downloadText(`gym-tracker-koerper-${todayISO()}.csv`, bodyToCsv(state));
              toast.show(t('CSV gespeichert'));
            }}
          >
            <IconDownload /> {t('Körperdaten als CSV')}
          </button>
          <button className="btn" onClick={printReport_}>
            <IconPrinter /> {t('Bericht drucken')}
          </button>
        </div>
      </Section>

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

  /*
   * Stand im Vorzeitraum ueberhaupt nichts, bekam vorher jede Zeile ein
   * eigenes "neu" - dreimal dieselbe Auskunft untereinander. Einmal darueber
   * gesagt reicht.
   */
  const noComparison = review.previous.workouts === 0
    && review.previous.sets === 0
    && review.previous.volume === 0;

  return (
    <Section
      title={t("Rückblick")}
      note={noComparison ? t('kein Vergleichszeitraum') : t('{label} gegen den Zeitraum davor', { label })}
    >
      <div className="list">
        {rows.map((row) => {
          const change = noComparison ? null : describeChange(row.now, row.before);
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
                <span className="small row" style={{ gap: 6 }}><IconTrophy style={{ width: 14, height: 14, color: 'var(--warn)' }} /> {record.name}</span>
                <span className="row" style={{ gap: 8 }}>
                  <span className="bold mono tiny">{record.value}</span>
                  <span className="tiny dim">{formatDateShort(record.date)}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}


/**
 * Belastungskarte. Zwei Ansichten:
 *
 * - "Diese Woche" misst gegen das Wochenziel je Region und faerbt als Ampel:
 *   rot deutlich darunter, gelb knapp darunter, gruen im Ziel, violett darueber.
 * - "Zeitraum" zeigt die Verteilung ueber den gewaehlten Bereich.
 *
 * Ein Tipp auf eine Region zeigt, woher die Saetze kommen, wann sie zuletzt
 * drankam und schlaegt bei Luecken Uebungen vor.
 */
function MuscleLoadCard({
  workouts, weekWorkouts, getExercise, allExercises, rangeLabel, targets, onOpen,
}: {
  workouts: Workout[];
  weekWorkouts: Workout[];
  getExercise: (id: string) => Exercise | undefined;
  allExercises: Exercise[];
  rangeLabel: string;
  targets: Record<string, number>;
  onOpen: (exercise: Exercise) => void;
}) {
  const [selected, setSelected] = useState<MuscleRegion | null>(null);
  const [mode, setMode] = useState<'week' | 'range'>('week');

  const today = todayISO();
  const rangeLoad = useMemo(() => regionLoad(workouts, getExercise), [workouts, getExercise]);
  const weekLoad = useMemo(() => regionLoad(weekWorkouts, getExercise), [weekWorkouts, getExercise]);
  const load = mode === 'week' ? weekLoad : rangeLoad;

  const max = useMemo(
    () => Math.max(1, ...[...load.values()].map((entry) => entry.sets)),
    [load],
  );

  const detail = selected ? load.get(selected) : undefined;
  /** Fuer "zuletzt trainiert" zaehlt der ganze Zeitraum, nicht nur diese Woche. */
  const lastSeen = selected ? daysSince(rangeLoad.get(selected)?.lastDate ?? null, today) : null;

  const intensity = (region: MuscleRegion): Intensity | number => {
    const sets = load.get(region)?.sets ?? 0;
    if (mode === 'range') return sets / max;
    return loadStatus(sets, targetFor(targets, region));
  };

  /** Uebungen, die auf die gewaehlte Region eingezahlt haben. */
  const trained = useMemo(() => {
    if (!detail) return [];
    return [...detail.byExercise.entries()]
      .map(([id, sets]) => ({ exercise: getExercise(id), sets }))
      .filter((item): item is { exercise: Exercise; sets: number } => Boolean(item.exercise))
      .sort((a, b) => b.sets - a.sets);
  }, [detail, getExercise]);

  const suggestions = useMemo(() => {
    if (!selected) return [];
    const known = new Set(trained.map((item) => item.exercise.id));
    return suggestForRegion(allExercises, selected)
      .filter((exercise) => !known.has(exercise.id))
      .slice(0, 5);
  }, [selected, allExercises, trained]);

  /** Was diese Woche noch fehlt - nach Groesse der Luecke sortiert. */
  const gaps = useMemo(() => {
    return ALL_REGIONS
      .map((region) => {
        const sets = weekLoad.get(region)?.sets ?? 0;
        const target = targetFor(targets, region);
        return { region, sets, target, missing: target - sets };
      })
      .filter((entry) => entry.target > 0 && entry.missing > 0)
      .sort((a, b) => b.missing - a.missing);
  }, [weekLoad, targets]);

  /** Regionen, die im Zeitraum lange nicht drankamen. */
  const stale = useMemo(() => {
    return ALL_REGIONS
      .map((region) => ({
        region,
        target: targetFor(targets, region),
        days: daysSince(rangeLoad.get(region)?.lastDate ?? null, today),
      }))
      .filter((entry) => entry.target > 0 && (entry.days === null || entry.days >= 7))
      .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
      .slice(0, 6);
  }, [rangeLoad, targets, today]);

  if (rangeLoad.size === 0) return null;

  return (
    <Section
      title={t("Muskelkarte")}
      note={(
        <span className="row" style={{ gap: 6 }}>
          <button
            className={`chip chip--button ${mode === 'week' ? 'chip--accent' : ''}`}
            onClick={() => setMode('week')}
          >
            {t("Diese Woche")}
          </button>
          <button
            className={`chip chip--button ${mode === 'range' ? 'chip--accent' : ''}`}
            onClick={() => setMode('range')}
          >
            {rangeLabel}
          </button>
        </span>
      )}
    >
      <BodyMap
        size={150}
        selected={selected}
        onSelect={(region) => setSelected(region === selected ? null : region)}
        intensity={intensity}
      />

      {mode === 'week' ? (
        <div className="muscle-legend" style={{ marginTop: 10 }}>
          <span className="chip chip--danger">{t("deutlich unter Ziel")}</span>
          <span className="chip chip--warn">{t("knapp drunter")}</span>
          <span className="chip chip--success">{t("im Ziel")}</span>
          <span className="chip">{t("darüber")}</span>
          <span className="chip">{t("grau = noch nichts")}</span>
        </div>
      ) : (
        <div className="tiny dim" style={{ textAlign: 'center', marginTop: 8 }}>
          {t("Je kräftiger die Farbe, desto mehr Sätze. Tippe eine Region an.")}
        </div>
      )}

      {selected && (
        <div className="list" style={{ marginTop: 12 }}>
          <div className="row row--between">
            <span className="bold">{t(REGION_LABELS[selected])}</span>
            <span className="tiny dim">
              {fmt(detail?.sets ?? 0, 1)} / {targetFor(targets, selected)} {t("Sätze")}
            </span>
          </div>

          <div className="tiny dim">
            {lastSeen === null
              ? t('Im Zeitraum nie trainiert.')
              : lastSeen === 0
                ? t('Heute trainiert.')
                : t('Zuletzt vor {days} Tagen', { days: lastSeen })}
          </div>

          {trained.length > 0 ? (
            <div className="list">
              {trained.slice(0, 6).map((item) => (
                <button
                  key={item.exercise.id}
                  className="row row--between link-row"
                  onClick={() => onOpen(item.exercise)}
                >
                  <span className="small">{exerciseName(item.exercise)}</span>
                  <span className="tiny dim mono">{fmt(item.sets, 1)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="tiny dim">{t("Hier ist im gewählten Bereich nichts angekommen.")}</div>
          )}

          {suggestions.length > 0 && (
            <>
              <div className="section-label">{t("Passende Übungen")}</div>
              <div className="row row--wrap" style={{ gap: 6 }}>
                {suggestions.map((exercise) => (
                  <button
                    key={exercise.id}
                    className="chip chip--button"
                    onClick={() => onOpen(exercise)}
                  >
                    {exerciseName(exercise)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {!selected && mode === 'week' && gaps.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="section-label">{t("Diese Woche fehlt noch")}</div>
          <div className="list">
            {gaps.slice(0, 5).map((entry) => (
              <button
                key={entry.region}
                className="row row--between link-row"
                onClick={() => setSelected(entry.region)}
              >
                <span className="small">{t(REGION_LABELS[entry.region])}</span>
                <span className="tiny dim mono">
                  {fmt(entry.sets, 1)} / {entry.target}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!selected && stale.length > 0 && (
        <div className="tiny dim" style={{ marginTop: 12 }}>
          <strong style={{ color: 'var(--text-muted)' }}>{t("Lange nicht dran:")}</strong>{' '}
          {stale.map((entry) => (
            entry.days === null
              ? `${t(REGION_LABELS[entry.region])} (${t('nie')})`
              : `${t(REGION_LABELS[entry.region])} (${entry.days} ${t('Tage')})`
          )).join(', ')}
        </div>
      )}
    </Section>
  );
}
