import { exerciseName, t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type { Exercise } from '../types';
import { CATEGORY_LABELS, KIND_LABELS } from '../data/catalog';
import { categoryColor, categoryTint } from '../lib/categoryColors';
import { formatClock, formatDateShort, formatDateTiny } from '../lib/date';
import { exerciseHistory, familyHistory, personalRecords } from '../lib/stats';
import { formatSet } from '../lib/setFormat';
import { STANDARDS, TIER_LABELS, exerciseRanks } from '../lib/ranks';
import { familyMembers, familyOf } from '../lib/variants';
import { GOAL_LABELS, GOAL_UNITS, PACE_LABELS, goalPace, goalStatus } from '../lib/goals';
import { addDays, todayISO } from '../lib/date';
import { uid } from '../storage/defaults';
import type { ExerciseGoal, GoalMetric } from '../types';
import { useStore } from '../storage/store';
import { LineChart, type Point } from './charts/Charts';
import { DateInput, Modal, NumberInput, Stat, fmt } from './ui';
import { IconBook, IconTarget, IconTrophy } from './icons';
import { cachedGuide, fetchGuide, type Guide } from '../api/guide';
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
  const { state, allExercises, getExercise } = useStore();
  const records = useMemo(() => personalRecords(state, exercise.id), [state, exercise.id]);

  /*
   * Spielarten derselben Bewegung koennen zusammen betrachtet werden. Flach,
   * schraeg und mit Kurzhanteln sind drei duenne Verlaeufe; zusammen ist es
   * eine Linie, an der man sieht, ob es vorangeht.
   */
  const family = useMemo(() => familyOf(exercise, getExercise), [exercise, getExercise]);
  const siblings = useMemo(
    () => (family ? familyMembers(allExercises, family, getExercise) : []),
    [family, allExercises, getExercise],
  );
  const [wholeFamily, setWholeFamily] = useState(false);
  const familyIds = useMemo(() => new Set(siblings.map((item) => item.id)), [siblings]);

  const history = useMemo(
    () => (wholeFamily && familyIds.size > 1
      ? familyHistory(state, familyIds)
      : exerciseHistory(state, exercise.id)),
    [state, exercise.id, wholeFamily, familyIds],
  );

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

        <ExerciseRankLine exercise={exercise} />

        <GuideCard exercise={exercise} />

        <PersonalNote exercise={exercise} />

        <GoalCard
          exercise={exercise}
          familyIds={wholeFamily ? familyIds : undefined}
          isTimed={isTimed}
        />

        {history.length === 0 ? (
          <div className="empty">
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

              {siblings.length > 1 && (
                <div className="row row--wrap" style={{ gap: 6, marginBottom: 10 }}>
                  <button
                    className={`chip chip--button ${wholeFamily ? '' : 'chip--accent'}`}
                    aria-pressed={!wholeFamily}
                    onClick={() => setWholeFamily(false)}
                  >
                    {t('Nur diese Übung')}
                  </button>
                  <button
                    className={`chip chip--button ${wholeFamily ? 'chip--accent' : ''}`}
                    aria-pressed={wholeFamily}
                    onClick={() => setWholeFamily(true)}
                    title={siblings.map((item) => item.name).join(', ')}
                  >
                    {t('Alle {count} Spielarten', { count: siblings.length })}
                  </button>
                </div>
              )}

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
                label={`${exerciseName(exercise)} – ${t(METRIC_LABELS[metric])}`}
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
                          : formatSet(session.topSet?.weightKg, session.topSet?.reps, exercise.kind)}
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
                  <RecordRow
                    label={t("Schwerster Satz")}
                    value={formatSet(records.maxWeight.value, records.maxWeight.reps, exercise.kind)}
                    date={records.maxWeight.date}
                  />
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

/**
 * Wie geht die Uebung noch mal?
 *
 * Text und Bilder kommen aus dem wger-Bestand und bleiben danach im Geraet -
 * im Keller mit einem Balken Empfang ist eine Anleitung, die erst geladen
 * werden muss, keine Anleitung. Geholt wird nur auf Ansage: wger ist ein
 * freier Dienst, und nicht jeder, der seinen Verlauf ansieht, will nachlesen.
 */
function GuideCard({ exercise }: { exercise: Exercise }) {
  const { state } = useStore();
  const [guide, setGuide] = useState<Guide | null>(() => cachedGuide(exercise.id));
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    setGuide(cachedGuide(exercise.id));
    setFailed(false);
  }, [exercise.id]);

  const load = async () => {
    setLoading(true);
    setFailed(false);
    const result = await fetchGuide(exercise);
    setGuide(result);
    setFailed(result === null);
    setLoading(false);
  };

  if (!guide && !state.settings.useWgerApi) return null;

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">
          <IconBook style={{ width: 15, height: 15, verticalAlign: '-2px' }} /> {t('Ausführung')}
        </div>
        {guide && (
          <a
            className="tiny dim"
            href={`https://wger.de/de/exercise/${guide.baseId}/view/`}
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('wger.de')}
          </a>
        )}
      </div>

      {!guide && (
        <>
          <button className="btn btn--sm" onClick={() => void load()} disabled={loading}>
            {loading ? t('wird geladen …') : t('Anleitung nachschlagen')}
          </button>
          {failed && (
            <div className="tiny dim" style={{ marginTop: 8 }}>
              {t('Dazu ist im wger-Bestand nichts zu finden – oder gerade kein Netz.')}
            </div>
          )}
        </>
      )}

      {guide && (
        <>
          {guide.images.length > 0 && (
            <div className="guide-shots">
              {guide.images.map((url) => (
                <button key={url} className="guide-shots__item" onClick={() => setZoom(url)}>
                  <img src={url} alt={t('Ausführung von {name}', { name: exerciseName(exercise) })} loading="lazy" />
                </button>
              ))}
            </div>
          )}

          {guide.text && <p className="small guide-text">{guide.text}</p>}

          {guide.videos.map((url) => (
            <video key={url} className="guide-video" src={url} controls preload="none" />
          ))}

          <div className="tiny dim" style={{ marginTop: 8 }}>
            {t('Aus der wger-Datenbank, CC BY-SA. Einmal geladen, bleibt es auch ohne Netz da.')}
          </div>
        </>
      )}

      {zoom && (
        <Modal title={exerciseName(exercise)} onClose={() => setZoom(null)}>
          <img src={zoom} alt="" style={{ width: '100%', borderRadius: 8 }} />
        </Modal>
      )}
    </div>
  );
}

/**
 * Ein Ziel mit Datum.
 *
 * "100 kg bis Juni" ist die Frage, die man wirklich hat - nicht "wo stehe
 * ich", sondern "reicht das Tempo". Die Antwort kommt aus derselben
 * Hochrechnung wie oben und ist entsprechend zurueckhaltend formuliert: Bei
 * duenner Datenlage sagt sie lieber nichts als etwas Erfundenes.
 */
function GoalCard({
  exercise, familyIds, isTimed,
}: {
  exercise: Exercise;
  familyIds?: Set<string>;
  isTimed: boolean;
}) {
  const { state, addGoal, deleteGoal } = useStore();
  const [open, setOpen] = useState(false);

  const goal = (state.goals ?? []).find((item) => item.exerciseId === exercise.id) ?? null;
  const status = useMemo(
    () => (goal ? goalStatus(state, goal, familyIds) : null),
    [state, goal, familyIds],
  );

  if (!goal) {
    return (
      <>
        <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>
          <IconTarget /> {t('Ziel setzen')}
        </button>
        {open && <GoalDialog exercise={exercise} isTimed={isTimed} onClose={() => setOpen(false)} />}
      </>
    );
  }

  const pace = status ? goalPace(status) : 'unklar';
  const share = status && goal.targetValue > 0
    ? Math.min(100, (status.current / goal.targetValue) * 100)
    : 0;
  const unit = t(GOAL_UNITS[goal.metric]);

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">
          <IconTarget style={{ width: 15, height: 15, verticalAlign: '-2px' }} /> {t('Ziel')}
        </div>
        <span className={`chip ${
          pace === 'geschafft' || pace === 'reicht' ? 'chip--success'
            : pace === 'knapp' ? 'chip--warn'
              : pace === 'zu wenig' ? 'chip--danger' : ''
        }`}>
          {t(PACE_LABELS[pace])}
        </span>
      </div>

      <div className="row row--between" style={{ alignItems: 'baseline' }}>
        <span className="small">{t(GOAL_LABELS[goal.metric])}</span>
        <span className="bold mono">
          {fmt(status?.current ?? 0, 1)} <span className="dim">{`/ ${fmt(goal.targetValue, 1)} ${unit}`}</span>
        </span>
      </div>

      <div className="progress-bar" style={{ height: 6, marginTop: 8 }}>
        <div className="progress-bar__fill" style={{ width: `${share}%` }} />
      </div>

      <div className="tiny dim" style={{ marginTop: 8 }}>
        {status?.achievedOn
          ? t('Am {date} geschafft.', { date: formatDateShort(status.achievedOn) })
          : status?.projection
            ? t('Bei diesem Tempo etwa am {date} – Ziel ist der {target}.', {
                date: formatDateShort(status.projection.date),
                target: formatDateShort(goal.targetDate),
              })
            : t('Bis {date}. Für eine Vorhersage fehlt noch Verlauf.', {
                date: formatDateShort(goal.targetDate),
              })}
        {status && !status.achievedOn && status.daysLeft >= 0 && (
          ` · ${t('{days} Tage', { days: status.daysLeft })}`
        )}
        {status && !status.achievedOn && status.daysLeft < 0 && ` · ${t('Termin vorbei')}`}
      </div>

      <div className="row" style={{ gap: 7, marginTop: 10 }}>
        <button className="btn btn--sm" onClick={() => setOpen(true)}>{t('Ändern')}</button>
        <button className="btn btn--sm btn--ghost" onClick={() => deleteGoal(goal.id)}>
          {t('Ziel entfernen')}
        </button>
      </div>

      {open && (
        <GoalDialog
          exercise={exercise}
          isTimed={isTimed}
          existing={goal}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );

  function GoalDialog({
    exercise: target, isTimed: timed, existing, onClose,
  }: {
    exercise: Exercise;
    isTimed: boolean;
    existing?: ExerciseGoal;
    onClose: () => void;
  }) {
    const metrics: GoalMetric[] = timed
      ? ['durationSec', 'volume', 'reps']
      : ['oneRm', 'weight', 'reps', 'volume'];
    const [metric, setMetric] = useState<GoalMetric>(existing?.metric ?? metrics[0]);
    const [value, setValue] = useState<number | null>(existing?.targetValue ?? null);
    const [date, setDate] = useState(existing?.targetDate ?? addDays(todayISO(), 90));

    return (
      <Modal title={t('Ziel für {name}', { name: exerciseName(target) })} onClose={onClose}>
        <div className="list">
          <div className="field">
            <label className="field__label">{t('Worauf')}</label>
            <select
              className="select"
              value={metric}
              onChange={(event) => setMetric(event.target.value as GoalMetric)}
            >
              {metrics.map((key) => (
                <option key={key} value={key}>{t(GOAL_LABELS[key])}</option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field__label">{t('Zielwert')} ({t(GOAL_UNITS[metric])})</label>
              <NumberInput value={value} min={0} step={2.5} onChange={setValue} />
            </div>
            <div className="field">
              <label className="field__label">{t('Bis wann')}</label>
              <DateInput value={date} min={todayISO()} onChange={setDate} />
            </div>
          </div>

          <button
            className="btn btn--primary btn--block"
            disabled={!value || value <= 0}
            onClick={() => {
              addGoal({
                id: existing?.id ?? uid('goal'),
                exerciseId: target.id,
                metric,
                targetValue: value ?? 0,
                targetDate: date,
                createdAt: existing?.createdAt ?? new Date().toISOString(),
              });
              onClose();
            }}
          >
            {existing ? t('Ziel ändern') : t('Ziel setzen')}
          </button>
        </div>
      </Modal>
    );
  }
}

/**
 * Der Rang dieser Bewegung, wenn sie gewertet wird.
 *
 * Beantwortet die Frage, die eine Kilozahl offen laesst: Ist das viel? Steht
 * bewusst weit oben - direkt unter den Muskeln, vor Verlauf und Bestleistungen.
 */
function ExerciseRankLine({ exercise }: { exercise: Exercise }) {
  const { state, allExercises, getExercise } = useStore();
  const family = familyOf(exercise, getExercise);

  const rank = useMemo(() => {
    if (!family || !STANDARDS[family.id]) return null;
    return exerciseRanks(state, allExercises, getExercise)
      .find((item) => item.family === family.id) ?? null;
  }, [state, allExercises, getExercise, family]);

  if (!family || !STANDARDS[family.id]) return null;

  if (!rank) {
    return (
      <div className="tiny dim">
        {t('Diese Bewegung wird gewertet – sobald ein Satz mit Gewicht drinsteht, steht hier dein Rang.')}
      </div>
    );
  }

  return (
    <div className="row row--between" style={{ alignItems: 'baseline', gap: 10 }}>
      <span className="small">
        {t('Rang')}: <span className="bold">{t(TIER_LABELS[rank.tier])}</span>
        <span className="dim">{` · ${fmt(rank.ratio, 2)}× ${t('Körpergewicht')}`}</span>
      </span>
      {rank.nextKg != null && rank.nextTier && (
        <span className="tiny dim nowrap">
          {t('{kg} kg bis „{tier}“', {
            kg: fmt(Math.max(0, rank.nextKg - rank.bestKg), 1),
            tier: t(TIER_LABELS[rank.nextTier]),
          })}
        </span>
      )}
    </div>
  );
}

/**
 * Die eigene Notiz zur Uebung - "Bank auf Stufe 3, Griff aussen".
 *
 * Gehoert zur Uebung, nicht zum Tag: Solche Einstellungen sind naechste Woche
 * dieselben. Deshalb steht sie hier und nicht am einzelnen Satz.
 */
function PersonalNote({ exercise }: { exercise: Exercise }) {
  const { updateExercise } = useStore();
  const [text, setText] = useState(exercise.personalNote ?? '');

  useEffect(() => { setText(exercise.personalNote ?? ''); }, [exercise.id, exercise.personalNote]);

  return (
    <div className="field">
      <label className="field__label">{t('Deine Notiz zu dieser Übung')}</label>
      <textarea
        className="textarea textarea--sm"
        value={text}
        placeholder={t('z. B. Bank auf Stufe 3, Griff außen')}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => updateExercise(exercise.id, { personalNote: text.trim() || undefined })}
      />
      <span className="field__hint">{t('Bleibt stehen, Training für Training.')}</span>
    </div>
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
