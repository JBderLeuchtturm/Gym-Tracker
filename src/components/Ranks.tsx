import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import {
  RANKED_FAMILIES, STANDARDS, TIERS, TIER_LABELS, badges, exerciseRanks, nextStep,
  overallRank, rankTimeline, tierProgress,
  type Badge, type ExerciseRank, type RankTier,
} from '../lib/ranks';
import { streakInfo } from '../lib/stats';
import { formatDateShort } from '../lib/date';
import { Modal, Section, fmt } from './ui';
import { IconCheck, IconInfo, IconTarget, IconTrophy } from './icons';

/** Farbe je Stufe - dieselbe Reihe wie sonst in der App, von blass nach kraeftig. */
const TIER_COLOR: Record<RankTier, string> = {
  einsteiger: 'var(--text-dim)',
  geuebt: 'var(--time)',
  fortgeschritten: 'var(--success)',
  stark: 'var(--accent)',
  elite: 'var(--warn)',
};

/**
 * Rang, Abzeichen und Rangliste.
 *
 * Der Rang beantwortet die Frage, die eine reine Kilozahl offen laesst: Ist
 * das viel? 100 kg Bankdruecken heissen bei 70 kg Koerpergewicht etwas anderes
 * als bei 110. Grundlage sind die ueblichen Kraftstandards - Richtwerte, keine
 * Messung; was das genau heisst, steht hinter dem Fragezeichen.
 *
 * Angezeigt wird bewusst nicht der nackte Punktestand. "35 von 100" ist wahr
 * und entmutigend zugleich, weil 100 unerreichbar weit weg wirkt. Naeher dran
 * ist: wie weit durch die aktuelle Stufe, und welcher einzelne Satz als
 * naechstes etwas bewegt.
 */
export function RankPanel() {
  const { state, allExercises, getExercise, updateSettings } = useStore();
  const sync = useSync();
  const [explainOpen, setExplainOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const [allBadges, setAllBadges] = useState(false);

  const ranks = useMemo(
    () => exerciseRanks(state, allExercises, getExercise),
    [state, allExercises, getExercise],
  );
  const overall = useMemo(() => overallRank(ranks), [ranks]);
  const progress = useMemo(() => tierProgress(overall.score), [overall.score]);
  const step = useMemo(
    () => nextStep(ranks, state.profile.weightKg, state.profile.sex),
    [ranks, state.profile.weightKg, state.profile.sex],
  );
  const streak = useMemo(() => streakInfo(state).current, [state]);
  const earned = useMemo(() => badges(ranks, overall, streak), [ranks, overall, streak]);
  const timeline = useMemo(
    () => rankTimeline(state, allExercises, getExercise),
    [state, allExercises, getExercise],
  );

  const move = useTierMove(overall.tier, overall.score);

  const sharing = state.settings.shareRank;
  const signedIn = sync.status === 'signed-in';

  /*
   * Der eigene Stand wird hochgeladen, wenn er sich geaendert hat - nicht bei
   * jedem Bild. Sonst schriebe die App bei jedem Tastendruck in die Tabelle.
   */
  const publishedScore = sync.rankBoard.find((row) => row.user_id === sync.user?.id)?.score;
  useEffect(() => {
    if (!signedIn || !sharing) return;
    if (publishedScore != null && Math.abs(publishedScore - overall.score) < 0.05) return;
    const timer = window.setTimeout(() => {
      void sync.publishRank({
        display_name: sync.profile?.display_name || t('Jemand'),
        emoji: sync.profile?.emoji || '💪',
        score: overall.score,
        tier: overall.tier,
        covered: overall.covered,
        // Nur die Stufe je Bewegung - nie ein Gewicht.
        parts: Object.fromEntries(ranks.map((rank) => [rank.family, rank.tier])),
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [signedIn, sharing, overall.score, overall.tier, overall.covered, publishedScore, ranks, sync]);

  useEffect(() => {
    if (signedIn && sharing) void sync.loadRankBoard();
  }, [signedIn, sharing]);

  /* Den gesehenen Stand merken, damit der naechste Wechsel auffaellt. */
  useEffect(() => {
    const seen = state.settings.lastSeenRank;
    if (seen?.tier === overall.tier && Math.abs(seen.score - overall.score) < 0.05) return;
    const timer = window.setTimeout(() => {
      updateSettings({
        lastSeenRank: {
          tier: overall.tier,
          score: overall.score,
          on: new Date().toISOString().slice(0, 10),
        },
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [overall.tier, overall.score, state.settings.lastSeenRank, updateSettings]);

  const missing = RANKED_FAMILIES.filter(
    (family) => !ranks.some((rank) => rank.family === family));
  const shownBadges = allBadges ? earned : earned.slice(0, 4);
  const earnedCount = earned.filter((badge) => badge.earned).length;

  return (
    <Section
      title={t('Rang')}
      note={(
        <button
          className="btn btn--ghost btn--icon btn--sm"
          onClick={() => setExplainOpen(true)}
          aria-label={t('Wie wird gerechnet?')}
        >
          <IconInfo />
        </button>
      )}
    >
      {/* --------------------------------------------- Auf- oder Abstieg */}
      {move && (
        <div className={`rank-move rank-move--${move.direction}`} role="status">
          <span className="rank-move__mark" aria-hidden="true">
            {move.direction === 'up' ? '▲' : '▼'}
          </span>
          <span>
            <span className="bold">
              {move.direction === 'up' ? t('Aufstieg') : t('Abstieg')}
              {': '}
              {t(TIER_LABELS[overall.tier])}
            </span>
            <span className="tiny dim" style={{ display: 'block' }}>
              {move.direction === 'up'
                ? t('vorher „{tier}“ – weiter so.', { tier: t(TIER_LABELS[move.from]) })
                : t('vorher „{tier}“. Alte Bestwerte zählen mit der Zeit weniger.', {
                    tier: t(TIER_LABELS[move.from]),
                  })}
            </span>
          </span>
        </div>
      )}

      {/* ------------------------------------------------------- Gesamtrang */}
      <div className="rank-head">
        <div className="rank-head__tier" style={{ color: TIER_COLOR[overall.tier] }}>
          {t(TIER_LABELS[overall.tier])}
        </div>
        <div className="rank-head__score">
          <span className="mono">{fmt(overall.score, 0)}</span>
          <span className="dim"> / 100</span>
        </div>
      </div>

      {/*
        * Der Balken zeigt den Weg durch die aktuelle Stufe, nicht den Weg zur
        * Hundert. Aus "35 von 100" wird "drei Viertel durch Geuebt" - dieselbe
        * Zahl, ein erreichbares Ziel.
        */}
      <div className="tier-progress">
        <div className="tier-progress__track">
          <div
            className="tier-progress__fill"
            style={{ width: `${Math.round(progress.share * 100)}%`, background: TIER_COLOR[overall.tier] }}
          />
        </div>
        <div className="tiny dim">
          {progress.nextTier
            ? t('noch {points} Punkte bis „{tier}“', {
                points: fmt(progress.toNext ?? 0, 1), tier: t(TIER_LABELS[progress.nextTier]),
              })
            : t('höchste Stufe erreicht')}
          {overall.covered > 0 && ` · ${t('{done} von {total} Bewegungen', {
            done: overall.covered, total: overall.total })}`}
        </div>
      </div>

      <TierScale current={overall.tier} />

      {/* --------------------------------------------------- Nächster Schritt */}
      {step && (
        <div className="next-step">
          <div className="next-step__icon" aria-hidden="true"><IconTarget /></div>
          <div style={{ minWidth: 0 }}>
            <div className="section-label">{t('Nächster Schritt')}</div>
            <div className="small">
              {step.untouched
                ? t('„{name}“ steht noch ohne Eintrag. Schon {kg} kg bringen die erste Stufe.', {
                    name: t(step.label), kg: fmt(step.missingKg, 1),
                  })
                : t('„{name}“: noch {kg} kg bis „{tier}“.', {
                    name: t(step.label),
                    kg: fmt(step.missingKg, 1),
                    tier: t(TIER_LABELS[step.nextTier as RankTier]),
                  })}
            </div>
            {step.gainPoints > 0 && (
              <div className="tiny dim">
                {t('bringt etwa {points} Punkte im Gesamtrang', { points: fmt(step.gainPoints, 1) })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------- Rang je Bewegung */}
      {ranks.length > 0 && (
        <div className="rank-list">
          {ranks.map((rank) => <RankRowView key={rank.family} rank={rank} />)}
        </div>
      )}

      {missing.length > 0 && (
        <div className="tiny dim">
          {t('Ohne Eintrag: {list}', {
            list: missing.map((family) => t(STANDARDS[family].label)).join(', '),
          })}
          {' – '}
          {t('sie zählen als null in den Gesamtrang.')}
        </div>
      )}

      {/* ------------------------------------------------------- Abzeichen */}
      <div>
        <div className="row row--between" style={{ alignItems: 'baseline' }}>
          <span className="section-label">{t('Abzeichen')}</span>
          <span className="tiny dim">
            {t('{done} von {total}', { done: earnedCount, total: earned.length })}
          </span>
        </div>
        <div className="badges">
          {shownBadges.map((badge) => <BadgeView key={badge.id} badge={badge} />)}
        </div>
        {earned.length > shownBadges.length && (
          <button className="btn btn--sm btn--ghost btn--flush" onClick={() => setAllBadges(true)}>
            {t('Alle {count} zeigen', { count: earned.length })}
          </button>
        )}
      </div>

      {/* --------------------------------------------------------- Verlauf */}
      {timeline.length >= 3 && <RankTrend points={timeline} />}

      {/* --------------------------------------------------------- Vergleich */}
      {!signedIn ? (
        <div className="tiny dim">
          {t('Für den Vergleich mit anderen brauchst du ein Konto unter „Freunde“. Der eigene Rang wird auch ohne gerechnet.')}
        </div>
      ) : (
        <>
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
              <button
                className="btn btn--sm"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => { setBoardOpen(!boardOpen); void sync.loadRankBoard(); }}
                aria-expanded={boardOpen}
              >
                <IconTrophy /> {boardOpen ? t('Rangliste ausblenden') : t('Rangliste zeigen')}
              </button>
              {boardOpen && <Board />}
            </>
          )}
        </>
      )}

      {explainOpen && <ExplainDialog onClose={() => setExplainOpen(false)} />}
    </Section>
  );
}

/**
 * Auf- oder Abstieg seit dem letzten Besuch.
 *
 * Der Vergleichswert wird beim ersten Bild eingefroren: Sonst verschwaende die
 * Meldung in dem Moment, in dem der neue Stand gespeichert wird.
 */
function useTierMove(tier: RankTier, score: number) {
  const { state } = useStore();
  const [frozen] = useState(() => state.settings.lastSeenRank);
  return useMemo(() => {
    if (!frozen) return null;
    const before = TIERS.indexOf(frozen.tier as RankTier);
    const now = TIERS.indexOf(tier);
    if (before < 0 || before === now) return null;
    return { direction: now > before ? ('up' as const) : ('down' as const), from: TIERS[before] };
  }, [frozen, tier, score]);
}

/** Die fünf Stufen als Kette - die erreichten kräftig, der Rest blass. */
function TierScale({ current }: { current: RankTier }) {
  const index = TIERS.indexOf(current);
  return (
    <ol className="tier-scale" aria-label={t('Stufen')}>
      {TIERS.map((tier, position) => (
        <li
          key={tier}
          className={[
            'tier-scale__step',
            position <= index ? 'is-reached' : '',
            position === index ? 'is-current' : '',
          ].filter(Boolean).join(' ')}
          aria-current={position === index ? 'step' : undefined}
        >
          <span className="tier-scale__dot" aria-hidden="true">
            {position < index ? <IconCheck /> : null}
          </span>
          {t(TIER_LABELS[tier])}
        </li>
      ))}
    </ol>
  );
}

function BadgeView({ badge }: { badge: Badge }) {
  return (
    <div className={`badge ${badge.earned ? 'badge--earned' : ''}`} title={t(badge.hint)}>
      <span className="badge__mark" aria-hidden="true">{badge.earned ? '🏅' : '○'}</span>
      <span style={{ minWidth: 0 }}>
        <span className="badge__label">{t(badge.label)}</span>
        <span className="badge__hint">
          {badge.earned
            ? t(badge.hint)
            : t('{percent} % geschafft', { percent: Math.round(badge.share * 100) })}
        </span>
      </span>
    </div>
  );
}

/** Der Gesamtrang über die Zeit - selbst gezeichnet, wie alles hier. */
function RankTrend({ points }: { points: Array<{ date: string; score: number }> }) {
  const width = 300;
  const height = 54;
  const max = Math.max(20, ...points.map((point) => point.score));
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (score: number) => height - (score / max) * (height - 6) - 3;
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.score).toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1];
  const first = points[0];
  const change = Math.round((last.score - first.score) * 10) / 10;

  return (
    <div>
      <div className="row row--between" style={{ alignItems: 'baseline' }}>
        <span className="section-label">{t('Rang über die Zeit')}</span>
        <span className="tiny dim">
          {change >= 0 ? '+' : '−'}{fmt(Math.abs(change), 1)} {t('seit {date}', { date: formatDateShort(first.date) })}
        </span>
      </div>
      <svg
        className="rank-trend"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t('Gesamtrang von {from} bis {to}: {before} auf {after} Punkte', {
          from: formatDateShort(first.date), to: formatDateShort(last.date),
          before: fmt(first.score, 0), after: fmt(last.score, 0),
        })}
      >
        <path d={area} className="rank-trend__area" />
        <path d={line} className="rank-trend__line" />
      </svg>
    </div>
  );
}

function RankRowView({ rank }: { rank: ExerciseRank }) {
  return (
    <div className="rank-row">
      <div className="rank-row__head">
        <span className="small bold">{t(rank.label)}</span>
        <span className="chip" style={{ color: TIER_COLOR[rank.tier] }}>{t(TIER_LABELS[rank.tier])}</span>
      </div>
      <div className="progress-bar" style={{ height: 4 }}>
        <div
          className="progress-bar__fill"
          style={{ width: `${Math.min(100, rank.score)}%`, background: TIER_COLOR[rank.tier] }}
        />
      </div>
      <div className="rank-row__foot tiny dim">
        <span className="mono">{fmt(rank.bestKg, 1)} kg · {fmt(rank.ratio, 2)}×</span>
        <span>
          {rank.nextKg != null && rank.nextTier
            ? t('noch {kg} kg', { kg: fmt(Math.max(0, rank.nextKg - rank.bestKg), 1) })
            : t('höchste Stufe')}
          {rank.days > 28 && ` · ${formatDateShort(rank.lastDate)}`}
        </span>
      </div>
    </div>
  );
}

/** Die Rangliste: alle teilnehmenden Konten, Freunde hervorgehoben. */
function Board() {
  const sync = useSync();
  const friendIds = useMemo(
    () => new Set(sync.friends.filter((friend) => friend.state === 'accepted').map((friend) => friend.userId)),
    [sync.friends],
  );

  if (sync.rankBoard.length === 0) {
    return <div className="tiny dim">{t('Noch nimmt niemand teil.')}</div>;
  }

  const myIndex = sync.rankBoard.findIndex((row) => row.user_id === sync.user?.id);

  return (
    <div>
      {myIndex >= 0 && (
        <div className="small" style={{ marginBottom: 8 }}>
          {t('Du stehst auf Platz {place} von {total}.', {
            place: myIndex + 1, total: sync.rankBoard.length,
          })}
        </div>
      )}
      <div className="list" style={{ gap: 5 }}>
        {sync.rankBoard.map((row, index) => {
          const isMe = row.user_id === sync.user?.id;
          const isFriend = friendIds.has(row.user_id);
          return (
            <div key={row.user_id} className={`board-row ${isMe ? 'board-row--me' : ''}`}>
              <span className="rank">{index + 1}</span>
              <span className="board-row__name">
                {row.emoji} {isMe ? t('Du') : row.display_name || t('Jemand')}
                {isFriend && !isMe && <span className="tag">{t('Freund')}</span>}
              </span>
              <span className="tiny dim nowrap">{t(TIER_LABELS[row.tier as RankTier] ?? row.tier)}</span>
              <span className="mono bold">{fmt(row.score, 0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExplainDialog({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  return (
    <Modal title={t('Wie der Rang gerechnet wird')} onClose={onClose}>
      <div className="list small">
        <p style={{ margin: 0 }}>
          {t('Für jede der sechs gewerteten Bewegungen wird das beste geschätzte Ein-Wiederholungs-Maximum durch dein Körpergewicht geteilt. Das Verhältnis fällt in eine von fünf Stufen. So heißen 100 kg Bankdrücken bei 70 kg Körpergewicht etwas anderes als bei 110 kg – und genau das ist der Punkt.')}
        </p>
        <p style={{ margin: 0 }}>
          {t('Der Gesamtrang ist der Schnitt über alle sechs. Bewegungen ohne Eintrag zählen als null – deshalb kann er steigen und fallen, je nachdem was du trainierst. Ein Bestwert von vor einem halben Jahr zählt außerdem weniger, weil er als Beleg für den heutigen Stand schwächer ist; unter 60 Prozent fällt er nie.')}
        </p>
        <p style={{ margin: 0 }}>
          {t('Abzeichen werden genauso abgeleitet und nirgends vermerkt. Ein gespeichertes „geschafft“ kann zwischen zwei Geräten auseinanderlaufen, ein abgeleitetes nie.')}
        </p>

        <div className="hint-box">
          <div className="small bold">{t('Was diese Zahlen nicht sind')}</div>
          <div className="tiny dim" style={{ marginTop: 4 }}>
            {t('Eine Messung. Die Schwellen sind gerundete Richtwerte aus öffentlich verbreiteten Kraftstandard-Tabellen; sie schwanken je nach Quelle und sagen nichts über Technik, Hebelverhältnisse oder Alter. Sie taugen für „wo stehe ich ungefähr“ und für den Vergleich mit Leuten, die dieselbe Tabelle benutzen.')}
          </div>
        </div>

        {state.profile.sex === 'diverse' && (
          <div className="tiny dim">
            {t('Für „divers“ gibt es keine veröffentlichten Standards. Gerechnet wird mit dem Mittel aus beiden Tabellen.')}
          </div>
        )}

        <div className="section-label">{t('Gewertet werden')}</div>
        <div className="tiny dim">
          {RANKED_FAMILIES.map((family) => t(STANDARDS[family].label)).join(' · ')}
        </div>
      </div>
    </Modal>
  );
}
