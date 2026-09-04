import { exerciseName, t } from '../i18n';
import { useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { CATEGORY_LABELS, KIND_LABELS } from '../data/catalog';
import { categoryColor, categoryTint } from '../lib/categoryColors';
import { formatClock, formatDateShort, formatDateTiny } from '../lib/date';
import { exerciseHistory, personalRecords } from '../lib/stats';
import { useStore } from '../storage/store';
import { LineChart, type Point } from './charts/Charts';
import { Modal, Stat, fmt } from './ui';
import { IconTrophy } from './icons';
import {
  CONFIDENCE_LABELS, linearTrend, nextRoundGoal, perMonth, projectTarget,
} from '../lib/forecast';
import { BodyMap, type Intensity } from './MuscleMap';
import { REGION_LABELS, regionsOf, type MuscleRegion } from '../lib/muscles';

type Metric = '1rm' | 'weight' | 'volume' | 'reps' | 'duration';

const METRIC_LABELS: Record<Metric, string> = {
  '1rm': 'Geschätztes 1RM',
  weight: 'Bestes Gewicht',
  volume: 'Volumen',
  reps: 'Wiederholungen',
  duration: 'Dauer',
};

const METRIC_UNITS: Record<Metric, string> = {
  '1rm': 'kg', weight: 'kg', volume: 'kg', reps: '', duration: 's',
};

export function ExerciseDetail({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { state } = useStore();
  const history = useMemo(() => exerciseHistory(state, exercise.id), [state, exercise.id]);
  const records = useMemo(() => personalRecords(state, exercise.id), [state, exercise.id]);

  const isTimed = exercise.kind === 'time' || exercise.kind === 'cardio';
  const [metric, setMetric] = useState<Metric>(isTimed ? 'duration' : '1rm');

  const points: Point[] = useMemo(() => {
    return history.map((session) => {
      const value =
        metric === '1rm' ? session.best1RM
          : metric === 'weight' ? session.maxWeight
            : metric === 'volume' ? session.volume
              : metric === 'reps' ? session.totalReps
                : session.bestDurationSec;
      return {
        label: formatDateTiny(session.date),
        value: Math.round(value * 10) / 10,
        detail: formatDateShort(session.date),
      };
    }).filter((point) => point.value > 0);
  }, [history, metric]);

  const trend = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0].value;
    const last = points[points.length - 1].value;
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  }, [points]);

  const availableMetrics: Metric[] = isTimed
    ? ['duration', 'volume', 'reps', 'weight']
    : ['1rm', 'weight', 'volume', 'reps'];

  return (
    <Modal title={exerciseName(exercise)} onClose={onClose}>
      <div className="list">
        <div className="row row--wrap" style={{ gap: 6 }}>
          <span
            className="chip chip--cat"
            style={{ '--cat': categoryColor(exercise.category), '--cat-tint': categoryTint(exercise.category, 0.18) } as React.CSSProperties}
          >
            {t(CATEGORY_LABELS[exercise.category])}
          </span>
          <span className="chip">{t(KIND_LABELS[exercise.kind])}</span>
          {exercise.equipment.map((item) => <span key={item} className="chip">{item}</span>)}
        </div>

        <MuscleCard exercise={exercise} />

        {exercise.description && <p className="small muted">{exercise.description}</p>}

        {history.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">📊</div>
            <div>{t("Noch keine Daten zu dieser Übung")}</div>
            <div className="tiny" style={{ marginTop: 5 }}>
              Sobald du sie ein paar Mal trainiert hast, erscheint hier dein Verlauf.
            </div>
          </div>
        ) : (
          <>
            <div className="grid-2">
              <Stat
                label={t("Bestes Gewicht")}
                value={records.maxWeight ? fmt(records.maxWeight.value, 1) : '–'}
                unit={records.maxWeight ? 'kg' : ''}
                sub={records.maxWeight ? `${records.maxWeight.reps} Wdh · ${formatDateShort(records.maxWeight.date)}` : undefined}
                tone="accent"
              />
              <Stat
                label={t("Bestes 1RM (gesch.)")}
                value={records.best1RM ? fmt(records.best1RM.value, 1) : '–'}
                unit={records.best1RM ? 'kg' : ''}
                sub={records.best1RM ? formatDateShort(records.best1RM.date) : undefined}
              />
              <Stat label={t("Einheiten")} value={records.totalSessions} sub={`${records.totalSets} Sätze gesamt`} />
              <Stat label={t("Gesamtvolumen")} value={fmt(records.totalVolume)} unit={t("kg")} />
            </div>

            <div className="card">
              <div className="card__header">
                <div className="card__title">{t("Verlauf")}</div>
                {trend != null && (
                  <span className={`chip ${trend >= 0 ? 'chip--success' : 'chip--danger'}`}>
                    {trend >= 0 ? '▲' : '▼'} {fmt(Math.abs(trend), 1)} %
                  </span>
                )}
              </div>

              <div className="chip-scroll" style={{ marginBottom: 10 }}>
                {availableMetrics.map((key) => (
                  <button
                    key={key}
                    className={`chip chip--button ${metric === key ? 'chip--accent' : ''}`}
                    onClick={() => setMetric(key)}
                  >
                    {t(METRIC_LABELS[key])}
                  </button>
                ))}
              </div>

              <LineChart
                points={points}
                unit={METRIC_UNITS[metric]}
                formatValue={(value) => (metric === 'duration' ? formatClock(value) : fmt(value, 1))}
              />
            </div>

            <ForecastCard exercise={exercise} history={history} />

            <div className="card card--flush">
              <div className="section-label" style={{ padding: '12px 14px 4px' }}>{t("Letzte Einheiten")}</div>
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("Datum")}</th>
                    <th>{t("Sätze")}</th>
                    <th className="right">{t("Bester Satz")}</th>
                    <th className="right">{t("Volumen")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().slice(0, 15).map((session) => (
                    <tr key={`${session.workoutId}-${session.date}`}>
                      <td className="nowrap">{formatDateShort(session.date)}</td>
                      <td>{session.sets.length}</td>
                      <td className="right mono nowrap">
                        {session.topSet?.durationSec
                          ? formatClock(session.topSet.durationSec)
                          : `${fmt(session.topSet?.weightKg ?? 0, 1)} kg × ${session.topSet?.reps ?? 0}`}
                      </td>
                      <td className="right mono nowrap">{session.volume > 0 ? `${fmt(session.volume)} kg` : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card__title" style={{ marginBottom: 8 }}>
                <IconTrophy style={{ color: 'var(--warn)' }} /> Persönliche Bestleistungen
              </div>
              <div className="list">
                {records.maxWeight && (
                  <RecordRow label={t("Schwerster Satz")} value={`${fmt(records.maxWeight.value, 1)} kg × ${records.maxWeight.reps}`} date={records.maxWeight.date} />
                )}
                {records.maxReps && (
                  <RecordRow label={t("Meiste Wiederholungen")} value={`${records.maxReps.value} Wdh`} date={records.maxReps.date} />
                )}
                {records.maxVolume && (
                  <RecordRow label={t("Höchstes Volumen")} value={`${fmt(records.maxVolume.value)} kg`} date={records.maxVolume.date} />
                )}
                {records.maxDurationSec && (
                  <RecordRow label={t("Längste Dauer")} value={formatClock(records.maxDurationSec.value)} date={records.maxDurationSec.date} />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

function RecordRow({ label, value, date }: { label: string; value: string; date: string }) {
  return (
    <div className="row row--between">
      <span className="small muted">{label}</span>
      <span className="row" style={{ gap: 8 }}>
        <span className="bold mono">{value}</span>
        <span className="tiny dim">{formatDateShort(date)}</span>
      </span>
    </div>
  );
}

/**
 * Zeigt auf der Koerperkarte, welche Muskeln die Uebung anspricht.
 * Kraeftig = primaer, blass = unterstuetzend. Darunter stehen die
 * Originalbezeichnungen aus dem Katalog, damit nichts verloren geht.
 */
function MuscleCard({ exercise }: { exercise: Exercise }) {
  const { primary, secondary } = useMemo(() => regionsOf(exercise), [exercise]);
  if (primary.size === 0 && secondary.size === 0) return null;

  const intensity = (region: MuscleRegion): Intensity => {
    if (primary.has(region)) return 'primary';
    if (secondary.has(region)) return 'secondary';
    return 'none';
  };

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">{t("Beanspruchte Muskeln")}</div>
        <span className="tiny dim">{t("kräftig = primär")}</span>
      </div>

      <BodyMap intensity={intensity} size={140} />

      <div className="muscle-legend" style={{ marginTop: 10 }}>
        {[...primary].map((region) => (
          <span key={region} className="chip chip--accent">{t(REGION_LABELS[region])}</span>
        ))}
        {[...secondary].map((region) => (
          <span key={region} className="chip">{t(REGION_LABELS[region])}</span>
        ))}
      </div>

      {exercise.primaryMuscles.length > 0 && (
        <div className="tiny dim" style={{ marginTop: 8, textAlign: 'center' }}>
          {exercise.primaryMuscles.join(', ')}
          {exercise.secondaryMuscles.length > 0 && ` · ${exercise.secondaryMuscles.join(', ')}`}
        </div>
      )}
    </div>
  );
}


/**
 * Hochrechnung: Wohin fuehrt die Linie, wenn es so weiterginge?
 *
 * Bewusst zurueckhaltend formuliert. Kraft waechst nicht ewig gleichmaessig,
 * und eine Gerade durch acht Punkte ist keine Prophezeiung. Deshalb steht
 * dabei, wie gleichmaessig der Verlauf ist - und bei duenner Datenlage
 * erscheint die Karte gar nicht erst.
 */
function ForecastCard({
  exercise, history,
}: {
  exercise: Exercise;
  history: ReturnType<typeof exerciseHistory>;
}) {
  const timed = exercise.kind === 'time' || exercise.kind === 'cardio';

  const series = useMemo(() => history.map((session) => ({
    date: session.date,
    value: timed ? session.bestDurationSec : session.best1RM,
  })), [history, timed]);

  const trend = useMemo(() => linearTrend(series), [series]);
  const goal = trend ? nextRoundGoal(trend.last.value) : 0;
  const projection = useMemo(() => projectTarget(trend, goal), [trend, goal]);

  if (!trend) return null;

  const monthly = perMonth(trend);
  const unit = timed ? t('s') : t('kg');

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">{t("Hochrechnung")}</div>
        <span className="tiny dim">{t('{count} Einheiten', { count: trend.points })}</span>
      </div>

      {monthly != null && Math.abs(monthly) >= 0.1 ? (
        <div className="small">
          {monthly > 0
            ? t('Aktuell etwa +{value} {unit} im Monat.', { value: fmt(monthly, 1), unit })
            : t('Aktuell etwa {value} {unit} im Monat.', { value: fmt(monthly, 1), unit })}
        </div>
      ) : (
        <div className="small">{t("Der Wert bewegt sich gerade kaum.")}</div>
      )}

      {projection ? (
        <div className="list" style={{ marginTop: 8 }}>
          <div className="row row--between">
            <span className="small">
              {t('{value} {unit} erreichst du etwa', { value: fmt(goal, 0), unit })}
            </span>
            <span className="bold">{formatDateShort(projection.date)}</span>
          </div>
          <div className="tiny dim">
            {t(CONFIDENCE_LABELS[projection.confidence])}
            {' · '}
            {t("Hochgerechnet aus dem bisherigen Verlauf – Kraft wächst nicht ewig gleichmäßig.")}
          </div>
        </div>
      ) : (
        <div className="tiny dim" style={{ marginTop: 8 }}>
          {trend.slopePerDay <= 0
            ? t("Es geht gerade nicht aufwärts – deshalb keine Vorhersage.")
            : t("Das nächste runde Ziel liegt zu weit weg für eine sinnvolle Vorhersage.")}
        </div>
      )}
    </div>
  );
}
