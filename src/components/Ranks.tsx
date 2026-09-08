import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import {
  RANKED_FAMILIES, STANDARDS, TIER_LABELS, TIER_FLOOR, exerciseRanks, overallRank,
  type ExerciseRank, type RankTier,
} from '../lib/ranks';
import { formatDateShort } from '../lib/date';
import { Modal, Section, fmt } from './ui';
import { IconInfo, IconTrophy } from './icons';

/** Farbe je Stufe - dieselbe Reihe wie sonst in der App, von blass nach kraeftig. */
const TIER_COLOR: Record<RankTier, string> = {
  einsteiger: 'var(--text-dim)',
  geuebt: 'var(--time)',
  fortgeschritten: 'var(--success)',
  stark: 'var(--accent)',
  elite: 'var(--warn)',
};

/**
 * Rang und Rangliste.
 *
 * Der Rang beantwortet die Frage, die eine reine Kilozahl offen laesst: Ist
 * das viel? 100 kg Bankdruecken heissen bei 70 kg Koerpergewicht etwas anderes
 * als bei 110. Grundlage sind die ueblichen Kraftstandards - Richtwerte, keine
 * Messung; was das genau heisst, steht hinter dem Fragezeichen.
 */
export function RankPanel() {
  const { state, allExercises, getExercise, updateSettings } = useStore();
  const sync = useSync();
  const [explainOpen, setExplainOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);

  const ranks = useMemo(
    () => exerciseRanks(state, allExercises, getExercise),
    [state, allExercises, getExercise],
  );
  const overall = useMemo(() => overallRank(ranks), [ranks]);

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

  const missing = RANKED_FAMILIES.filter(
    (family) => !ranks.some((rank) => rank.family === family));

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
      {/* ------------------------------------------------------- Gesamtrang */}
      <div className="rank-head">
        <div>
          <div className="rank-head__tier" style={{ color: TIER_COLOR[overall.tier] }}>
            {t(TIER_LABELS[overall.tier])}
          </div>
          <div className="tiny dim">
            {overall.covered > 0
              ? t('{done} von {total} gewerteten Bewegungen', {
                  done: overall.covered, total: overall.total,
                })
              : t('Noch keine der gewerteten Bewegungen trainiert')}
          </div>
        </div>
        <div className="rank-head__score">
          <span className="mono">{fmt(overall.score, 0)}</span>
          <span className="dim"> / 100</span>
        </div>
      </div>

      <TierBar score={overall.score} />

      {/* ------------------------------------------------- Rang je Bewegung */}
      {ranks.length > 0 && (
        <div className="list" style={{ marginTop: 14, gap: 9 }}>
          {ranks.map((rank) => <RankRowView key={rank.family} rank={rank} />)}
        </div>
      )}

      {missing.length > 0 && (
        <div className="tiny dim" style={{ marginTop: 10 }}>
          {t('Ohne Eintrag: {list}', {
            list: missing.map((family) => t(STANDARDS[family].label)).join(', '),
          })}
          {' – '}
          {t('sie zählen als null in den Gesamtrang.')}
        </div>
      )}

      {/* --------------------------------------------------------- Vergleich */}
      {!signedIn ? (
        <div className="tiny dim" style={{ marginTop: 14 }}>
          {t('Für den Vergleich mit anderen brauchst du ein Konto unter „Freunde“. Der eigene Rang wird auch ohne gerechnet.')}
        </div>
      ) : (
        <>
          <label className="row" style={{ gap: 9, marginTop: 16, cursor: 'pointer' }}>
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
              <span className="tiny dim" style={{ display: 'block' }}>
                {t('Sichtbar für alle Konten dieses Projekts: dein Punktestand, die Stufe je Bewegung und dein Anzeigename. Keine Gewichte, kein Körpergewicht, kein Trainingseintrag.')}
              </span>
            </span>
          </label>

          {sharing && (
            <>
              <button
                className="btn btn--sm"
                style={{ marginTop: 12, alignSelf: 'flex-start' }}
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

/** Der Punktestand als Leiste mit den fuenf Stufen darunter. */
function TierBar({ score }: { score: number }) {
  const share = Math.max(0, Math.min(100, score));
  return (
    <div className="rank-bar" role="img" aria-label={t('{score} von 100 Punkten', { score: Math.round(score) })}>
      <div className="rank-bar__track">
        <div className="rank-bar__fill" style={{ width: `${share}%` }} />
        {[20, 40, 60, 80].map((mark) => (
          <span key={mark} className="rank-bar__mark" style={{ left: `${mark}%` }} />
        ))}
      </div>
      <div className="rank-bar__labels">
        {(Object.keys(TIER_FLOOR) as RankTier[]).map((tier) => (
          <span key={tier} className={score >= TIER_FLOOR[tier] ? 'is-reached' : ''}>
            {t(TIER_LABELS[tier])}
          </span>
        ))}
      </div>
    </div>
  );
}

function RankRowView({ rank }: { rank: ExerciseRank }) {
  return (
    <div>
      <div className="row row--between" style={{ alignItems: 'baseline' }}>
        <span className="small bold">{t(rank.label)}</span>
        <span className="row" style={{ gap: 8 }}>
          <span className="tiny mono dim">{fmt(rank.bestKg, 1)} kg · {fmt(rank.ratio, 2)}×</span>
          <span className="chip" style={{ color: TIER_COLOR[rank.tier] }}>{t(TIER_LABELS[rank.tier])}</span>
        </span>
      </div>
      <div className="progress-bar" style={{ height: 4, marginTop: 4 }}>
        <div
          className="progress-bar__fill"
          style={{ width: `${Math.min(100, rank.score)}%`, background: TIER_COLOR[rank.tier] }}
        />
      </div>
      <div className="tiny dim" style={{ marginTop: 3 }}>
        {rank.nextKg != null && rank.nextTier
          ? t('{kg} kg fehlen bis „{tier}“', {
              kg: fmt(Math.max(0, rank.nextKg - rank.bestKg), 1),
              tier: t(TIER_LABELS[rank.nextTier]),
            })
          : t('höchste Stufe erreicht')}
        {rank.days > 28 && ` · ${t('zuletzt {date}', { date: formatDateShort(rank.lastDate) })}`}
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
    return <div className="tiny dim" style={{ marginTop: 10 }}>{t('Noch nimmt niemand teil.')}</div>;
  }

  const myIndex = sync.rankBoard.findIndex((row) => row.user_id === sync.user?.id);

  return (
    <div style={{ marginTop: 12 }}>
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
            <div
              key={row.user_id}
              className={`board-row ${isMe ? 'board-row--me' : ''}`}
            >
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
