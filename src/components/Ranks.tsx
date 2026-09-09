import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import {
  STANDARDS, TIERS, TIER_LABELS, nextSteps, rankSnapshot, tierProgress,
  type NextStep, type RankBasis, type RankSnapshot, type RankTier,
} from '../lib/ranks';
import { Section, fmt } from './ui';
import { IconCheck, IconChevronRight, IconTarget, IconTrophy } from './icons';

/** Farbe je Stufe - dieselbe Reihe wie sonst in der App, von blass nach kraeftig. */
export const TIER_COLOR: Record<RankTier, string> = {
  einsteiger: 'var(--text-dim)',
  geuebt: 'var(--time)',
  fortgeschritten: 'var(--success)',
  stark: 'var(--accent)',
  elite: 'var(--warn)',
};

/** "112,5 kg", "30 Wdh", "2:00 min" - je nachdem, woran die Bewegung gemessen wird. */
export function formatValue(value: number, basis: RankBasis): string {
  if (basis === 'reps') return t('{count} Wdh', { count: fmt(value, 0) });
  if (basis === 'seconds') {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60);
    return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')} min` : `${seconds} s`;
  }
  return `${fmt(value, value % 1 ? 1 : 0)} kg`;
}

/** Die fünf Stufen als Kette - die erreichten kräftig, der Rest blass. */
export function TierScale({ current }: { current: RankTier }) {
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

/** Die Stufe als kleine Marke in ihrer Farbe. */
export function TierPill({ tier, personal = false }: { tier: RankTier; personal?: boolean }) {
  return (
    <span
      className={`tier-pill ${personal ? 'tier-pill--personal' : ''}`}
      style={{ color: TIER_COLOR[tier] }}
    >
      {t(TIER_LABELS[tier])}
    </span>
  );
}

/** Punktestand als Balken durch die aktuelle Stufe. */
export function TierProgressBar({ score }: { score: number }) {
  const progress = tierProgress(score);
  return (
    <div className="tier-progress">
      <div className="tier-progress__track">
        <div
          className="tier-progress__fill"
          style={{
            width: `${Math.round(progress.share * 100)}%`,
            background: TIER_COLOR[progress.tier],
          }}
        />
      </div>
      <div className="tiny dim">
        {progress.nextTier
          ? t('noch {points} Punkte bis „{tier}“', {
              points: fmt(progress.toNext ?? 0, 1), tier: t(TIER_LABELS[progress.nextTier]),
            })
          : t('höchste Stufe erreicht')}
      </div>
    </div>
  );
}

/** Ein nächster Schritt als Kasten. */
export function NextStepBox({ step }: { step: NextStep }) {
  return (
    <div className="next-step">
      <div className="next-step__icon" aria-hidden="true"><IconTarget /></div>
      <div style={{ minWidth: 0 }}>
        <div className="small">
          {step.untouched
            ? t('„{name}“ steht noch ohne Eintrag. Schon {value} bringen die erste Stufe.', {
                name: t(step.label), value: formatValue(step.missing, step.basis),
              })
            : t('„{name}“: noch {value} bis „{tier}“.', {
                name: t(step.label),
                value: formatValue(step.missing, step.basis),
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
  );
}

/**
 * Auf- oder Abstieg seit dem letzten Besuch.
 *
 * Der Vergleichswert wird beim ersten Bild eingefroren: Sonst verschwaende die
 * Meldung in dem Moment, in dem der neue Stand gespeichert wird.
 */
export function useTierMove(tier: RankTier) {
  const { state } = useStore();
  const [frozen] = useState(() => state.settings.lastSeenRank);
  return useMemo(() => {
    if (!frozen) return null;
    const before = TIERS.indexOf(frozen.tier as RankTier);
    const now = TIERS.indexOf(tier);
    if (before < 0 || before === now) return null;
    return { direction: now > before ? ('up' as const) : ('down' as const), from: TIERS[before] };
  }, [frozen, tier]);
}

export function TierMoveNote({ tier }: { tier: RankTier }) {
  const move = useTierMove(tier);
  if (!move) return null;
  return (
    <div className={`rank-move rank-move--${move.direction}`} role="status">
      <span className="rank-move__mark" aria-hidden="true">
        {move.direction === 'up' ? '▲' : '▼'}
      </span>
      <span>
        <span className="bold">
          {move.direction === 'up' ? t('Aufstieg') : t('Abstieg')}
          {': '}
          {t(TIER_LABELS[tier])}
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
  );
}

/**
 * Haelt den zuletzt gesehenen Rang fest und schickt ihn, wenn gewuenscht,
 * in die Rangliste. Beides gehoert zusammen an einen Ort, damit es nicht in
 * zwei Ansichten doppelt passiert.
 */
export function useRankSideEffects(snapshot: RankSnapshot) {
  const { state, updateSettings } = useStore();
  const sync = useSync();
  const { overall } = snapshot;
  const sharing = state.settings.shareRank;
  const signedIn = sync.status === 'signed-in';
  const publishedScore = sync.rankBoard.find((row) => row.user_id === sync.user?.id)?.score;

  useEffect(() => {
    if (!signedIn || !sharing) return;
    if (publishedScore != null && Math.abs(publishedScore - overall.score) < 0.05) return;
    const timer = window.setTimeout(() => {
      void sync.publishRank({
        display_name: sync.profile?.display_name || t('Jemand'),
        emoji: state.settings.profileCard.emoji || sync.profile?.emoji || '💪',
        score: overall.score,
        tier: overall.tier,
        covered: overall.covered,
        // Nur die Stufe je Bewegung - nie ein Gewicht.
        parts: Object.fromEntries(snapshot.families.map((rank) => [rank.family, rank.tier])),
      });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [signedIn, sharing, overall.score, overall.tier, overall.covered, publishedScore, snapshot, sync]);

  useEffect(() => {
    if (signedIn && sharing) void sync.loadRankBoard();
  }, [signedIn, sharing]);

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
}

/**
 * Das Rangfeld auf der Fortschrittsseite.
 *
 * Bewusst knapp: Stufe, Weg durch die Stufe, der eine naechste Schritt - und
 * ein Knopf in die Vollansicht, wo alles steht. Was hier stand, bevor es die
 * Vollansicht gab, war eine halbe Seite, die man jedes Mal wegscrollte.
 */
export function RankPanel({ onOpenDetail }: { onOpenDetail: () => void }) {
  const { state, allExercises, getExercise } = useStore();

  const snapshot = useMemo(
    () => rankSnapshot(state, allExercises, getExercise),
    [state, allExercises, getExercise],
  );
  const { overall } = snapshot;
  const steps = useMemo(
    () => nextSteps(snapshot, state.profile.weightKg, state.profile.sex, 1),
    [snapshot, state.profile.weightKg, state.profile.sex],
  );

  useRankSideEffects(snapshot);

  return (
    <Section
      title={t('Rang')}
      note={(
        <button className="btn btn--sm btn--ghost btn--flush" onClick={onOpenDetail}>
          {t('Alles ansehen')} <IconChevronRight />
        </button>
      )}
    >
      <TierMoveNote tier={overall.tier} />

      <div className="rank-head">
        <div className="rank-head__tier" style={{ color: TIER_COLOR[overall.tier] }}>
          {t(TIER_LABELS[overall.tier])}
        </div>
        <div className="rank-head__score">
          <span className="mono">{fmt(overall.score, 0)}</span>
          <span className="dim"> / 100</span>
        </div>
      </div>

      <TierProgressBar score={overall.score} />
      <TierScale current={overall.tier} />

      {steps[0] && <NextStepBox step={steps[0]} />}

      <button className="rank-open" onClick={onOpenDetail}>
        <span className="rank-open__icon" aria-hidden="true"><IconTrophy /></span>
        <span style={{ minWidth: 0 }}>
          <span className="small bold">{t('Alle Ränge und Erfolge')}</span>
          <span className="tiny dim" style={{ display: 'block' }}>
            {t('{families} von {total} Bewegungen · {exercises} Übungen mit eigenem Rang', {
              families: overall.covered,
              total: overall.total,
              exercises: snapshot.exercises.length,
            })}
          </span>
        </span>
        <IconChevronRight />
      </button>
    </Section>
  );
}

/** Die Rangliste: alle teilnehmenden Konten, Freunde hervorgehoben. */
export function Board() {
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

/** Der Standard-Text zu einer Bewegung - fuer Erklaerungen. */
export const standardLabel = (family: string): string =>
  STANDARDS[family]?.label ?? family;
