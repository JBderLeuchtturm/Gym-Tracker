import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import {
  TIER_LABELS, rankOf, type RankBasis, type RankSnapshot, type RankTier,
} from '../lib/ranks';
import { fmt } from './ui';
import { RankBadge } from './RankBadge';

/** Farbe je Stufe - dieselbe Reihe wie im Abzeichen. */
export const TIER_COLOR: Record<RankTier, string> = {
  bronze: 'var(--tier-bronze-light)',
  silber: 'var(--tier-silber-light)',
  gold: 'var(--tier-gold-light)',
  diamant: 'var(--tier-diamant-light)',
  emerald: 'var(--tier-emerald-light)',
  elite: 'var(--tier-elite-light)',
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

/** Punktestand als Balken durch die aktuelle Division. */
export function DivisionBar({ score }: { score: number }) {
  const rank = rankOf(score);
  return (
    <div className="tier-progress">
      <div className="tier-progress__track">
        <div
          className="tier-progress__fill"
          style={{
            width: `${Math.round(rank.share * 100)}%`,
            background: TIER_COLOR[rank.tier],
          }}
        />
      </div>
      <div className="tiny dim">
        {rank.toNext != null
          ? t('noch {points} Punkte bis zur nächsten Division', { points: fmt(rank.toNext, 1) })
          : t('höchste Division erreicht')}
      </div>
    </div>
  );
}

/**
 * Haelt den zuletzt gesehenen Rang fest und schickt ihn, wenn gewuenscht,
 * in die Rangliste.
 */
export function useRankSideEffects(snapshot: RankSnapshot) {
  const { state } = useStore();
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
              <RankBadge rank={rankOf(row.score)} size="xs" />
              <span className="mono bold">{fmt(row.score, 0)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { TIER_LABELS };
export type { RankTier };

/** Kleine Marke fuer Listen, in denen kein Platz fuer ein Wappen ist. */
export function TierPill({ tier, personal = false }: { tier: RankTier; personal?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      className={`tier-pill ${personal ? 'tier-pill--personal' : ''}`}
      style={{ color: TIER_COLOR[tier] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={hover ? t(TIER_LABELS[tier]) : undefined}
    >
      {t(TIER_LABELS[tier])}
    </span>
  );
}
