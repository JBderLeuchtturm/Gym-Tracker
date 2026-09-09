import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import {
  TIER_LABELS, exerciseRanks, rankDistance, rankOf, rankSnapshot,
  type Rank, type RankTier,
} from '../lib/ranks';
import { Modal, fmt } from './ui';
import { RankBadge } from './RankBadge';
import { TIER_COLOR } from './Ranks';

/** Ein Wechsel, der gemeldet werden will. */
interface Move {
  key: string;
  /** "Gesamtrang" oder der Name der Uebung. */
  name: string;
  from: Rank;
  to: Rank;
  up: boolean;
  overall: boolean;
}

const keyOf = (rank: Rank): string => `${rank.tier}:${rank.division}`;

function parseKey(value: string | undefined): Rank | null {
  if (!value) return null;
  const [tier, division] = value.split(':');
  if (!tier || !division) return null;
  return {
    tier: tier as RankTier,
    division: Number(division) as 1 | 2 | 3,
    score: 0,
    share: 0,
    toNext: null,
    label: `${TIER_LABELS[tier as RankTier] ?? tier} ${'I'.repeat(Number(division))}`,
  };
}

/**
 * Meldet Auf- und Abstiege.
 *
 * Gespeichert wird nur, welche Stufe zuletzt gemeldet wurde - der Rang selbst
 * kommt wie immer frisch aus dem Verlauf. Beim allerersten Mal wird nichts
 * gemeldet, sondern nur festgehalten: Sonst begruesste die App einen beim
 * ersten Start mit achtzehn Aufstiegen auf einmal.
 *
 * Die Meldung haengt an der App, nicht an einer Seite. Wer einen Satz
 * eintraegt und dabei eine Stufe knackt, soll das im selben Moment sehen -
 * nicht erst, wenn er zufaellig auf die Rangseite geht.
 */
export function RankUpWatcher() {
  const { state, allExercises, getExercise, updateSettings } = useStore();
  const [queue, setQueue] = useState<Move[]>([]);

  const current = useMemo(() => {
    if (state.workouts.length === 0) return null;
    const snapshot = rankSnapshot(state, allExercises, getExercise);
    const map: Record<string, { rank: Rank; name: string }> = {
      overall: { rank: snapshot.overall.rank, name: t('Gesamtrang') },
    };
    for (const entry of snapshot.exercises) {
      map[entry.exerciseId] = { rank: entry.rank, name: entry.exerciseName };
    }
    return map;
  }, [state, allExercises, getExercise]);

  useEffect(() => {
    if (!current) return;
    const seen = state.settings.seenRanks ?? {};
    const next: Record<string, string> = { ...seen };
    const moves: Move[] = [];

    for (const [key, entry] of Object.entries(current)) {
      const before = parseKey(seen[key]);
      next[key] = keyOf(entry.rank);
      // Beim ersten Sehen nur merken, nicht melden.
      if (!before) continue;
      const distance = rankDistance(before, entry.rank);
      if (distance === 0) continue;
      moves.push({
        key,
        name: entry.name,
        from: before,
        to: entry.rank,
        up: distance > 0,
        overall: key === 'overall',
      });
    }

    const changed = Object.keys(next).some((key) => next[key] !== seen[key])
      || Object.keys(seen).length !== Object.keys(next).length;
    if (!changed) return;

    // Der Gesamtrang zuerst, danach Aufstiege vor Abstiegen.
    moves.sort((a, b) => Number(b.overall) - Number(a.overall) || Number(b.up) - Number(a.up));
    if (moves.length > 0) setQueue(moves);
    updateSettings({ seenRanks: next });
  }, [current]);

  if (queue.length === 0) return null;
  return <RankUpDialog moves={queue} onClose={() => setQueue([])} />;
}

function RankUpDialog({ moves, onClose }: { moves: Move[]; onClose: () => void }) {
  const lead = moves[0];
  const rest = moves.slice(1);

  return (
    <Modal title={lead.up ? t('Aufstieg') : t('Abstieg')} onClose={onClose}>
      <div className={`rankup ${lead.up ? 'rankup--up' : 'rankup--down'}`}>
        <div className="rankup__stage">
          <span className="rankup__from">
            <RankBadge rank={lead.from} size="md" dim />
            <span className="tiny dim">{lead.from.label}</span>
          </span>
          <span className="rankup__arrow" aria-hidden="true">{lead.up ? '→' : '←'}</span>
          <span className="rankup__to">
            <RankBadge rank={lead.to} size="lg" />
            <span className="small bold" style={{ color: TIER_COLOR[lead.to.tier] }}>
              {lead.to.label}
            </span>
          </span>
        </div>

        <div className="rankup__what">{lead.name}</div>
        <p className="small dim" style={{ margin: 0, textAlign: 'center' }}>
          {lead.up
            ? t('Eine Division weiter. Weiter so.')
            : t('Eine Division zurück – ein Bestwert zählt mit der Zeit weniger. Ein einziger Satz holt ihn zurück.')}
        </p>
      </div>

      {rest.length > 0 && (
        <div className="list" style={{ gap: 6, marginTop: 14 }}>
          <div className="section-label">{t('Außerdem')}</div>
          {rest.map((move) => (
            <div key={move.key} className="rankup-row">
              <RankBadge rank={move.to} size="xs" />
              <span className="small" style={{ flex: 1, minWidth: 0 }}>{move.name}</span>
              <span className="tiny dim nowrap">
                {move.up ? '▲' : '▼'} {move.to.label}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="row" style={{ justifyContent: 'center', marginTop: 18 }}>
        <button className="btn btn--primary" onClick={onClose}>{t('Weiter')}</button>
      </div>
    </Modal>
  );
}

/** Der aktuelle Rang einer Uebung - fuer Stellen, die nur einen brauchen. */
export function useExerciseRank(exerciseId: string) {
  const { state, allExercises, getExercise } = useStore();
  return useMemo(
    () => exerciseRanks(state, allExercises, getExercise)
      .find((entry) => entry.exerciseId === exerciseId) ?? null,
    [state, allExercises, getExercise, exerciseId],
  );
}

export { rankOf, fmt };
