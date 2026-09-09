import { t } from '../i18n';
import { useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import {
  DECAY_FLOOR, GRACE_DAYS, TIERS, TIER_FLOOR, TIER_LABELS, allFamilyRows, nextSteps, rankOf,
  rankSnapshot, rankTimeline, tierCounts,
  type ExerciseRankEntry, type RankBasis,
} from '../lib/ranks';
import { achievements, byGroup, earnedCount, LEVEL_LABELS, type Achievement } from '../lib/achievements';
import { CATEGORY_LABELS } from '../data/catalog';
import { formatDateShort } from '../lib/date';
import { EmptyState, Section, fmt } from '../components/ui';
import { Board, DivisionBar, TIER_COLOR, formatValue, useRankSideEffects } from '../components/Ranks';
import { RankBadge, RankLadder } from '../components/RankBadge';
import { IconChevronDown, IconTrophy } from '../components/icons';

type Tab = 'uebersicht' | 'uebungen' | 'bewegungen' | 'erfolge' | 'vergleich';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'uebungen', label: 'Übungen' },
  { id: 'bewegungen', label: 'Bewegungen' },
  { id: 'erfolge', label: 'Erfolge' },
  { id: 'vergleich', label: 'Vergleich' },
];

/**
 * Die Rangseite.
 *
 * Sie hat den Kalorienreiter abgeloest - nicht, weil Kalorien unwichtig
 * waeren, sondern weil man sie einmal am Tag eintraegt und den Rang jedes Mal
 * ansieht. Die Kalorienseite liegt vollstaendig unter Profil, und was man
 * wirklich taeglich davon braucht - der Verbrauch des Trainings - steht jetzt
 * unter dem Training selbst.
 */
export function RankPage() {
  const { state, allExercises, getExercise } = useStore();
  const [tab, setTab] = useState<Tab>('uebersicht');

  const snapshot = useMemo(
    () => rankSnapshot(state, allExercises, getExercise),
    [state, allExercises, getExercise],
  );
  const badges = useMemo(
    () => achievements(state, getExercise, snapshot.families, snapshot.overall),
    [state, getExercise, snapshot],
  );

  useRankSideEffects(snapshot);

  if (snapshot.exercises.length === 0) {
    return (
      <EmptyState
        title={t('Noch kein Rang')}
        hint={t('Trag einen Satz mit Gewicht ein – danach steht hier für jede Übung ein Abzeichen.')}
      />
    );
  }

  return (
    <>
      <RankHero snapshot={snapshot} badges={badges} />

      <div className="seg" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`seg__item ${tab === item.id ? 'seg__item--on' : ''}`}
            onClick={() => setTab(item.id)}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {tab === 'uebersicht' && <Overview snapshot={snapshot} />}
      {tab === 'uebungen' && <Exercises entries={snapshot.exercises} />}
      {tab === 'bewegungen' && <Movements snapshot={snapshot} />}
      {tab === 'erfolge' && <Achievements list={badges} />}
      {tab === 'vergleich' && <Comparison />}
    </>
  );
}

/* ------------------------------------------------------------------- Kopf */

function RankHero({ snapshot, badges }: {
  snapshot: ReturnType<typeof rankSnapshot>; badges: Achievement[];
}) {
  const { overall } = snapshot;
  return (
    <div className="rank-hero">
      <div className="rank-hero__top">
        <RankBadge rank={overall.rank} size="lg" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="tiny dim">{t('Gesamtrang')}</div>
          <div className="rank-hero__tier" style={{ color: TIER_COLOR[overall.tier] }}>
            {overall.rank.label}
          </div>
          <div className="rank-hero__score">
            <span className="mono">{fmt(overall.score, 0)}</span>
            <span className="dim"> / 100</span>
          </div>
        </div>
      </div>

      <DivisionBar score={overall.score} />

      <div className="rank-hero__facts">
        <Fact label={t('Bewegungen')} value={`${overall.covered} / ${overall.total}`} />
        <Fact label={t('Übungen')} value={String(snapshot.exercises.length)} />
        <Fact label={t('Erfolge')} value={`${earnedCount(badges)} / ${badges.length}`} />
      </div>
    </div>
  );
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="rank-fact">
    <div className="rank-fact__value mono">{value}</div>
    <div className="tiny dim">{label}</div>
  </div>
);

/* -------------------------------------------------------------- Übersicht */

function Overview({ snapshot }: { snapshot: ReturnType<typeof rankSnapshot> }) {
  const { state, allExercises, getExercise } = useStore();
  const { overall } = snapshot;
  const steps = useMemo(
    () => nextSteps(snapshot, state.profile.weightKg, state.profile.sex, 3),
    [snapshot, state.profile.weightKg, state.profile.sex],
  );
  const timeline = useMemo(
    () => rankTimeline(state, allExercises, getExercise, 10),
    [state, allExercises, getExercise],
  );
  const counts = useMemo(() => tierCounts(snapshot.families), [snapshot.families]);

  /* Was gerade an Wertung verliert - nach Verlust sortiert. */
  const fading = useMemo(
    () => snapshot.exercises
      .filter((entry) => entry.decayLoss >= 0.5)
      .sort((a, b) => b.decayLoss - a.decayLoss)
      .slice(0, 6),
    [snapshot.exercises],
  );

  return (
    <>
      {/* ------------------------------------------------------ Die Leiter */}
      <Section title={t('Die Stufen')} note={overall.rank.label}>
        <RankLadder current={overall.rank} />
        <div className="tiny dim">
          {t('Sechs Stufen mit je drei Divisionen. Von Bronze I bis Elite III sind es achtzehn Schritte – etwa alle sieben Punkte einer.')}
        </div>
      </Section>

      {/* --------------------------------------------------- Was gerade fällt */}
      {fading.length > 0 && (
        <Section
          title={t('Verliert gerade an Wertung')}
          note={t('{count} Übungen', { count: fading.length })}
        >
          <div className="tiny dim">
            {t('Ein Bestwert zählt {grace} Tage voll. Danach fällt er, bis nach gut einem Jahr noch {floor} % übrig sind. Ein einziger Satz holt ihn zurück.', {
              grace: GRACE_DAYS, floor: Math.round(DECAY_FLOOR * 100),
            })}
          </div>
          <div className="list" style={{ gap: 6 }}>
            {fading.map((entry) => (
              <div key={entry.exerciseId} className="fade-row">
                <RankBadge rank={entry.rank} size="xs" />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="small">{entry.exerciseName}</span>
                  <span className="tiny dim" style={{ display: 'block' }}>
                    {t('seit {days} Tagen nicht gemacht', { days: entry.days })}
                    {entry.dropsInDays != null
                      && ` · ${t('fällt in {days} Tagen weiter', { days: entry.dropsInDays })}`}
                  </span>
                </span>
                <span className="fade-row__loss mono">−{fmt(entry.decayLoss, 1)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ---------------------------------------------------- Nächste Schritte */}
      {steps.length > 0 && (
        <Section title={t('Was als Nächstes am meisten bringt')}>
          <div className="list" style={{ gap: 8 }}>
            {steps.map((step, index) => (
              <div key={step.family} className="step-row">
                <span className="step-row__no">{index + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="small bold">{t(step.label)}</span>
                  <span className="tiny dim" style={{ display: 'block' }}>
                    {step.untouched
                      ? t('noch ohne Eintrag – {value} bringen die erste Stufe', {
                          value: formatValue(step.missing, step.basis),
                        })
                      : t('noch {value} bis „{tier}“', {
                          value: formatValue(step.missing, step.basis),
                          tier: t(TIER_LABELS[step.nextTier!]),
                        })}
                  </span>
                </span>
                <span className="step-row__gain mono">+{fmt(step.gainPoints, 1)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------ Wie die Zahl entsteht */}
      <Section title={t('Woraus sich der Gesamtrang ergibt')}>
        <div className="formula">
          <div className="formula__part">
            <div className="formula__value mono">{fmt(overall.depth, 0)}</div>
            <div className="tiny dim">{t('Tiefe')}</div>
          </div>
          <div className="formula__sign" aria-hidden="true">×</div>
          <div className="formula__part">
            <div className="formula__value mono">{fmt(overall.breadthFactor, 2)}</div>
            <div className="tiny dim">{t('Breite')}</div>
          </div>
          <div className="formula__sign" aria-hidden="true">=</div>
          <div className="formula__part formula__part--result">
            <div className="formula__value mono">{fmt(overall.score, 0)}</div>
            <div className="tiny dim">{t('Punkte')}</div>
          </div>
        </div>
        <p className="tiny dim" style={{ margin: 0 }}>
          {t('Die Tiefe ist der gewichtete Schnitt über die Bewegungen, die du trainierst – die drei Grundübungen zählen voll, die weiteren Grundmuster drei Viertel, Beiwerk weniger. Die Breite sagt, wie viel davon überhaupt abgedeckt ist: Wer nur die drei Großen macht, kommt auf rund drei Viertel des Werts, wer alles abdeckt, auf den vollen.')}
        </p>
        <div className="tiny dim">
          {t('Abgedeckt: {percent} % des möglichen Gewichts.', {
            percent: fmt(overall.breadth * 100, 0),
          })}
        </div>
      </Section>

      {/* -------------------------------------------------- Stufenverteilung */}
      <Section title={t('Wie sich die Bewegungen verteilen')}>
        <div className="tier-bars">
          {TIERS.slice().reverse().map((tier) => {
            const count = counts[tier];
            const share = overall.total > 0 ? (count / overall.total) * 100 : 0;
            return (
              <div key={tier} className="tier-bars__row">
                <span className="tiny" style={{ color: TIER_COLOR[tier] }}>{t(TIER_LABELS[tier])}</span>
                <span className="tier-bars__track">
                  <span
                    className="tier-bars__fill"
                    style={{ width: `${share}%`, background: TIER_COLOR[tier] }}
                  />
                </span>
                <span className="tiny mono dim">{count}</span>
              </div>
            );
          })}
          <div className="tier-bars__row">
            <span className="tiny dim">{t('ohne Eintrag')}</span>
            <span className="tier-bars__track">
              <span
                className="tier-bars__fill tier-bars__fill--empty"
                style={{ width: `${((overall.total - overall.covered) / overall.total) * 100}%` }}
              />
            </span>
            <span className="tiny mono dim">{overall.total - overall.covered}</span>
          </div>
        </div>
      </Section>

      {timeline.length >= 3 && (
        <Section
          title={t('Rang über die Zeit')}
          note={t('seit {date}', { date: formatDateShort(timeline[0].date) })}
        >
          <RankTrend points={timeline} />
        </Section>
      )}

      <Section title={t('Was diese Zahlen nicht sind')}>
        <p className="small" style={{ margin: 0 }}>
          {t('Eine Messung. Die Schwellen sind gerundete Richtwerte aus öffentlich verbreiteten Kraftstandard-Tabellen; sie schwanken je nach Quelle und sagen nichts über Technik, Hebelverhältnisse oder Alter. Sie taugen für „wo stehe ich ungefähr“ und für den Vergleich mit Leuten, die dieselbe Tabelle benutzen.')}
        </p>
        <p className="tiny dim" style={{ margin: 0 }}>
          {t('Für jede Bewegung wird das beste geschätzte Ein-Wiederholungs-Maximum durch dein Körpergewicht geteilt. Bei Klimmzügen und Dips zählt die Gesamtlast einschließlich des eigenen Körpers, bei Liegestützen die Wiederholungen, beim Unterarmstütz die Zeit.')}
        </p>
        {state.profile.sex === 'diverse' && (
          <p className="tiny dim" style={{ margin: 0 }}>
            {t('Für „divers“ gibt es keine veröffentlichten Standards. Gerechnet wird mit dem Mittel aus beiden Tabellen.')}
          </p>
        )}
      </Section>
    </>
  );
}

/** Der Gesamtrang über die Zeit - selbst gezeichnet, wie alles hier. */
function RankTrend({ points }: { points: Array<{ date: string; score: number }> }) {
  const width = 320;
  const height = 96;
  const max = Math.max(40, ...points.map((point) => point.score));
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (score: number) => height - (score / max) * (height - 8) - 4;
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.score).toFixed(1)}`)
    .join(' ');
  const last = points[points.length - 1];
  const first = points[0];
  const change = Math.round((last.score - first.score) * 10) / 10;

  return (
    <>
      <svg
        className="rank-trend rank-trend--large"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('Gesamtrang von {from} bis {to}: {before} auf {after} Punkte', {
          from: formatDateShort(first.date), to: formatDateShort(last.date),
          before: fmt(first.score, 0), after: fmt(last.score, 0),
        })}
      >
        {/* Die Stufengrenzen als Linien - so sieht man, wann es eine Stufe hoch ging. */}
        {[20, 40, 60, 75, 90].filter((mark) => mark < max).map((mark) => (
          <line key={mark} x1="0" x2={width} y1={y(mark)} y2={y(mark)} className="rank-trend__grid" />
        ))}
        <path d={`${line} L${width},${height} L0,${height} Z`} className="rank-trend__area" />
        <path d={line} className="rank-trend__line" />
      </svg>
      <div className="row row--between tiny dim">
        <span>{formatDateShort(first.date)}</span>
        <span>{change >= 0 ? '+' : '−'}{fmt(Math.abs(change), 1)} {t('Punkte')}</span>
        <span>{formatDateShort(last.date)}</span>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Übungen */

function Exercises({ entries }: { entries: ExerciseRankEntry[] }) {
  const [showPersonal, setShowPersonal] = useState(true);

  const groups = useMemo(() => {
    const map = new Map<string, ExerciseRankEntry[]>();
    for (const entry of entries) {
      if (!showPersonal && entry.personal) continue;
      map.set(entry.category, [...(map.get(entry.category) ?? []), entry]);
    }
    return [...map.entries()]
      .map(([category, items]) => ({ category, items: items.sort((a, b) => b.score - a.score) }))
      .sort((a, b) => b.items[0].score - a.items[0].score);
  }, [entries, showPersonal]);

  const personalCount = entries.filter((entry) => entry.personal).length;

  return (
    <Section
      title={t('Jede Übung mit eigenem Rang')}
      note={t('{count} Übungen', { count: entries.length })}
    >
      {personalCount > 0 && (
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showPersonal}
            onChange={(event) => setShowPersonal(event.target.checked)}
          />
          <span className="tiny dim">
            {personalCount === 1
              ? t('Eine Übung ohne Kraftstandard mitzeigen – dort zählt der eigene Verlauf')
              : t('{count} Übungen ohne Kraftstandard mitzeigen – dort zählt der eigene Verlauf', {
                  count: personalCount,
                })}
          </span>
        </label>
      )}

      {groups.map((group) => (
        <div key={group.category}>
          <div className="section-label" style={{ marginBottom: 6 }}>
            {t(CATEGORY_LABELS[group.category as keyof typeof CATEGORY_LABELS] ?? group.category)}
          </div>
          <div className="list" style={{ gap: 6 }}>
            {group.items.map((entry) => (
              <div key={entry.exerciseId} className={`ex-rank ${entry.personal ? 'ex-rank--personal' : ''}`}>
                <RankBadge rank={entry.rank} size="sm" />
                <span style={{ minWidth: 0 }}>
                  <span className="small">{entry.exerciseName}</span>
                  <span className="tiny dim" style={{ display: 'block' }}>
                    {entry.personal
                      ? t('eigener Verlauf · {times}× gemacht', { times: entry.sessions })
                      : `${formatValue(entry.best, entry.basis)}${
                        entry.basis === 'load' || entry.basis === 'bodyload'
                          ? ` · ${fmt(entry.ratio, 2)}×` : ''}`}
                    {entry.decayLoss >= 0.5 && ` · ${t('−{loss} durch Pause', { loss: fmt(entry.decayLoss, 1) })}`}
                  </span>
                </span>
                <span className="ex-rank__score mono">{fmt(entry.score, 0)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Section>
  );
}

/* ------------------------------------------------------------- Bewegungen */

function Movements({ snapshot }: { snapshot: ReturnType<typeof rankSnapshot> }) {
  const { state } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(
    () => allFamilyRows(snapshot.families, state.profile.weightKg, state.profile.sex),
    [snapshot.families, state.profile.weightKg, state.profile.sex],
  );

  return (
    <Section
      title={t('Alle Bewegungen')}
      note={t('{done} von {total}', { done: snapshot.overall.covered, total: rows.length })}
    >
      <div className="tiny dim">
        {t('Antippen zeigt, welcher Wert welche Stufe bedeutet – bei deinem Körpergewicht von {kg} kg.', {
          kg: fmt(state.profile.weightKg, 0),
        })}
      </div>
      <div className="list" style={{ gap: 6 }}>
        {rows.map((row) => {
          const isOpen = open === row.family;
          return (
            <div key={row.family} className={`move-row ${row.rank ? '' : 'move-row--empty'}`}>
              <button
                className="move-row__head"
                onClick={() => setOpen(isOpen ? null : row.family)}
                aria-expanded={isOpen}
              >
                {row.rank
                  ? <RankBadge rank={row.rank.rank} size="sm" />
                  : <RankBadge rank={rankOf(0)} size="sm" dim />}
                <span className="move-row__name">
                  <span className="small bold">{t(row.label)}</span>
                  <span className="tiny dim">
                    {row.rank
                      ? `${formatValue(row.rank.best, row.basis)}${
                        row.basis === 'load' || row.basis === 'bodyload'
                          ? ` · ${fmt(row.rank.ratio, 2)}×` : ''}`
                      : t('noch kein Eintrag')}
                  </span>
                </span>
                <IconChevronDown />
              </button>

              {isOpen && (
                <div className="move-row__body">
                  <div className="threshold-grid">
                    {TIERS.map((tier, index) => (
                      <div
                        key={tier}
                        className={`threshold ${row.rank && row.rank.score >= TIER_FLOOR[tier] ? 'is-reached' : ''}`}
                      >
                        <div className="tiny" style={{ color: TIER_COLOR[tier] }}>{t(TIER_LABELS[tier])}</div>
                        <div className="small mono">
                          {index === 0
                            ? t('ab dem ersten Satz')
                            : formatValue(row.thresholds[index] ?? 0, row.basis)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="tiny dim">
                    {t('Gewicht im Gesamtrang: {weight}', { weight: fmt(row.weight, 2) })}
                    {row.rank && ` · ${t('beste Übung: {name}', { name: row.rank.bestExerciseName })}`}
                    {row.rank && row.rank.days > GRACE_DAYS
                      && ` · ${t('zuletzt {date}', { date: formatDateShort(row.rank.lastDate) })}`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------------------------------------------------------------- Erfolge */

function Achievements({ list }: { list: Achievement[] }) {
  const groups = useMemo(() => byGroup(list), [list]);
  return (
    <>
      <Section
        title={t('Erfolge')}
        note={t('{done} von {total}', { done: earnedCount(list), total: list.length })}
      >
        <div className="tiny dim">
          {t('Alles hier wird aus dem Verlauf abgeleitet und nirgends gespeichert. Wer eine Einheit löscht, verliert das Abzeichen wieder – das ist richtig so.')}
        </div>
      </Section>

      {groups.map((group) => (
        <Section
          key={group.group}
          title={t(group.label)}
          note={t('{done} von {total}', { done: group.earned, total: group.items.length })}
        >
          <div className="badges">
            {group.items.map((badge) => <BadgeCard key={badge.id} badge={badge} />)}
          </div>
        </Section>
      ))}
    </>
  );
}

export function BadgeCard({ badge }: { badge: Achievement }) {
  return (
    <div className={`badge badge--${badge.level} ${badge.earned ? 'badge--earned' : ''}`}>
      <span className="badge__mark" aria-hidden="true">
        {badge.earned ? <IconTrophy /> : <span className="badge__ring" />}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="badge__label">{t(badge.label)}</span>
        <span className="badge__hint">
          <span className="badge__level">{t(LEVEL_LABELS[badge.level])}</span>
          {badge.earned ? t(badge.hint) : badge.progress}
        </span>
        {!badge.earned && (
          <span className="badge__bar" aria-hidden="true">
            <span style={{ width: `${Math.round(badge.share * 100)}%` }} />
          </span>
        )}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- Vergleich */

function Comparison() {
  const { state, updateSettings } = useStore();
  const sync = useSync();
  const sharing = state.settings.shareRank;

  if (sync.status !== 'signed-in') {
    return (
      <Section title={t('Vergleich')}>
        <div className="small dim">
          {t('Für den Vergleich mit anderen brauchst du ein Konto unter „Freunde“. Der eigene Rang wird auch ohne gerechnet.')}
        </div>
      </Section>
    );
  }

  return (
    <Section title={t('Vergleich')}>
      <label className="rank-optin">
        <input
          type="checkbox"
          checked={sharing}
          onChange={(event) => {
            updateSettings({ shareRank: event.target.checked });
            if (!event.target.checked) void sync.withdrawRank();
          }}
        />
        <span className="small">
          {t('Am Rangvergleich teilnehmen')}
          <span className="tiny dim" style={{ display: 'block', marginTop: 2 }}>
            {t('Sichtbar für alle Konten dieses Projekts: dein Punktestand, die Stufe je Bewegung und dein Anzeigename. Keine Gewichte, kein Körpergewicht, kein Trainingseintrag.')}
          </span>
        </span>
      </label>

      {sharing && (
        <>
          <button className="btn btn--sm btn--flush" onClick={() => void sync.loadRankBoard()}>
            {t('Rangliste aktualisieren')}
          </button>
          <Board />
        </>
      )}
    </Section>
  );
}

export type { RankBasis };
