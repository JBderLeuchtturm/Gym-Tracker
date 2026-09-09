import { t } from '../i18n';
import { useEffect, useMemo, useState } from 'react';
import type { Exercise, ID, ProfileAccent, ProfileCard as CardSettings } from '../types';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import { streakInfo, workoutSetCount, workoutVolume } from '../lib/stats';
import { rankOf, rankSnapshot, TIER_LABELS, type RankTier } from '../lib/ranks';
import { achievements, sortAchievements, type Achievement } from '../lib/achievements';
import { formatDateShort } from '../lib/date';
import { Modal, fmt } from './ui';
import { RankBadge } from './RankBadge';
import { IconCheck, IconEdit, IconTrophy, IconX } from './icons';

/**
 * Die Farbstimmungen der Karte.
 *
 * Acht Stueck, alle aus derselben gedaempften Familie wie der Rest der App -
 * ein Profil soll nach etwas aussehen, aber nicht nach einem anderen Programm.
 */
export const ACCENTS: Record<ProfileAccent, { label: string; from: string; to: string }> = {
  messing: { label: 'Messing', from: '#7a5c2e', to: '#2a2419' },
  glut: { label: 'Glut', from: '#7c3b28', to: '#2a1a16' },
  moos: { label: 'Moos', from: '#3d5c3a', to: '#1a231a' },
  gezeiten: { label: 'Gezeiten', from: '#2f5566', to: '#161f24' },
  pflaume: { label: 'Pflaume', from: '#57365e', to: '#211823' },
  schiefer: { label: 'Schiefer', from: '#3f4750', to: '#1a1d21' },
  rost: { label: 'Rost', from: '#6e4326', to: '#241a13' },
  tinte: { label: 'Tinte', from: '#2f3a5c', to: '#161923' },
};

/** Was die Karte zeigt - eigenes Profil oder das eines Freundes. */
export interface CardData {
  name: string;
  handle?: string;
  card: CardSettings;
  /** Rang, falls bekannt und freigegeben. */
  tier?: RankTier | null;
  score?: number | null;
  /** Zahlen unter dem Namen. */
  stats?: Array<{ label: string; value: string }>;
  achievements?: Achievement[];
  favorites?: Array<{ id: ID; name: string; detail: string }>;
  /** Bis zu vier Rang-Abzeichen mit dem Namen der Übung darunter. */
  rankBadges?: Array<{ id: string; name: string; rank: ReturnType<typeof rankOf> }>;
  since?: string;
}

const gradient = (accent: ProfileAccent): string => {
  const tone = ACCENTS[accent] ?? ACCENTS.messing;
  return `linear-gradient(135deg, ${tone.from}, ${tone.to})`;
};

/**
 * Die Profilkarte.
 *
 * Eine Trainingsapp zeigt Zahlen; ein Profil zeigt einen Menschen. Deshalb
 * gibt es hier ein Emoji, eine Farbe, zwei Zeilen Text und vier Dinge, auf die
 * man stolz ist. Nichts davon rechnet irgendwo mit - und genau deshalb darf es
 * hier stehen.
 */
export function ProfileCardView({ data }: { data: CardData }) {
  const { card } = data;
  const pinned = (data.achievements ?? []).filter(
    (badge) => card.pinnedAchievements.includes(badge.id));

  return (
    <div className="pcard">
      <div className="pcard__banner" style={{ background: gradient(card.accent) }} aria-hidden="true" />

      <div className="pcard__body">
        <div className="pcard__head">
          <div className="pcard__avatar" style={{ background: gradient(card.accent) }}>
            {card.emoji || '💪'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pcard__name">{data.name || t('Ohne Namen')}</div>
            {data.handle && <div className="tiny dim">@{data.handle}</div>}
          </div>
          {card.showRank && data.score != null && (
            <div className="pcard__rank">
              <RankBadge rank={rankOf(data.score)} size="md" />
              <div className="tiny dim">{fmt(data.score, 0)} / 100</div>
            </div>
          )}
        </div>

        {card.bio.trim() && <p className="pcard__bio">{card.bio}</p>}

        {card.showStats && data.stats && data.stats.length > 0 && (
          <div className="pcard__stats">
            {data.stats.map((stat) => (
              <div key={stat.label}>
                <div className="pcard__stat-value mono">{stat.value}</div>
                <div className="tiny dim">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {(data.rankBadges?.length ?? 0) > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 7 }}>{t('Lieblingsabzeichen')}</div>
            <div className="badge-wall">
              {data.rankBadges!.map((entry) => (
                <div key={entry.id} className="badge-wall__item">
                  <RankBadge rank={entry.rank} size="md" />
                  <span className="tiny">{entry.name}</span>
                  <span className="tiny dim">{entry.rank.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {pinned.length > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>{t('Angeheftet')}</div>
            <div className="pcard__pins">
              {pinned.map((badge) => (
                <span key={badge.id} className={`pin pin--${badge.level}`} title={t(badge.hint)}>
                  <IconTrophy /> {t(badge.label)}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.favorites && data.favorites.length > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>{t('Lieblingsübungen')}</div>
            <div className="pcard__favs">
              {data.favorites.map((favorite) => (
                <div key={favorite.id} className="fav">
                  <span className="small">{favorite.name}</span>
                  <span className="tiny dim mono">{favorite.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.since && (
          <div className="tiny dim">{t('Dabei seit {date}', { date: formatDateShort(data.since) })}</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- Die eigene Karte */

/** Baut die Kartendaten aus dem eigenen Stand. */
export function useOwnCard(handle?: string): CardData {
  const { state, allExercises, getExercise } = useStore();
  const card = state.settings.profileCard;

  return useMemo(() => {
    const snapshot = rankSnapshot(state, allExercises, getExercise);
    const badges = achievements(state, getExercise, snapshot.families, snapshot.overall);
    const done = state.workouts.filter((workout) => workoutSetCount(workout) > 0);
    const volume = done.reduce((sum, workout) => sum + workoutVolume(workout), 0);
    const streak = streakInfo(state);
    const first = done.map((workout) => workout.date).sort()[0];

    const favorites = card.favoriteExerciseIds.map((id) => {
      const exercise = getExercise(id);
      const entry = snapshot.exercises.find((item) => item.exerciseId === id);
      return {
        id,
        name: exercise?.name ?? t('Unbekannte Übung'),
        detail: entry ? t(TIER_LABELS[entry.tier]) : t('noch kein Eintrag'),
      };
    }).filter((favorite) => favorite.name !== t('Unbekannte Übung'));

    const rankBadges = card.favoriteRankIds.map((id) => {
      const entry = snapshot.exercises.find((item) => item.exerciseId === id);
      if (!entry) return null;
      return { id, name: entry.exerciseName, rank: entry.rank };
    }).filter((entry): entry is { id: string; name: string; rank: ReturnType<typeof rankOf> } =>
      entry !== null);

    return {
      name: state.profile.name,
      handle,
      card,
      rankBadges,
      tier: snapshot.overall.tier,
      score: snapshot.overall.score,
      stats: [
        { label: t('Einheiten'), value: String(done.length) },
        { label: t('Volumen'), value: `${fmt(volume / 1000, 1)} t` },
        { label: t('Serie'), value: t('{count} Wo.', { count: streak.current }) },
      ],
      achievements: badges,
      favorites,
      since: first,
    };
  }, [state, allExercises, getExercise, card, handle]);
}

/* -------------------------------------------------------------- Bearbeiten */

const EMOJI_CHOICES = [
  '💪', '🏋️', '🦍', '🐺', '🔥', '⚡', '🗿', '🧊', '🎯', '🥇',
  '🦅', '🐻', '🚀', '⛰️', '🌊', '🍀', '☕', '🪨', '🦌', '🥋',
];

/**
 * Der Editor zur eigenen Karte.
 *
 * Vier Dinge lassen sich anheften und vier Uebungen als Lieblinge markieren -
 * mehr nicht. Eine Auswahl ohne Grenze ist keine Auswahl.
 */
export function ProfileCardEditor({ onClose }: { onClose: () => void }) {
  const { state, updateSettings, updateProfile, allExercises, getExercise } = useStore();
  const card = state.settings.profileCard;
  const [tab, setTab] = useState<'aussehen' | 'abzeichen' | 'erfolge' | 'uebungen'>('aussehen');
  const [search, setSearch] = useState('');

  const snapshot = useMemo(
    () => rankSnapshot(state, allExercises, getExercise),
    [state, allExercises, getExercise],
  );
  const badges = useMemo(
    () => sortAchievements(achievements(state, getExercise, snapshot.families, snapshot.overall)),
    [state, getExercise, snapshot],
  );

  const patch = (change: Partial<CardSettings>) =>
    updateSettings({ profileCard: { ...card, ...change } });

  const togglePin = (id: string) => {
    const list = card.pinnedAchievements.includes(id)
      ? card.pinnedAchievements.filter((item) => item !== id)
      : [...card.pinnedAchievements, id].slice(-4);
    patch({ pinnedAchievements: list });
  };

  const toggleRankBadge = (id: ID) => {
    const list = card.favoriteRankIds.includes(id)
      ? card.favoriteRankIds.filter((item) => item !== id)
      : [...card.favoriteRankIds, id].slice(-4);
    patch({ favoriteRankIds: list });
  };

  const toggleFavorite = (id: ID) => {
    const list = card.favoriteExerciseIds.includes(id)
      ? card.favoriteExerciseIds.filter((item) => item !== id)
      : [...card.favoriteExerciseIds, id].slice(-4);
    patch({ favoriteExerciseIds: list });
  };

  /* Nur Uebungen, die auch im Verlauf stehen - eine Lieblingsuebung, die man
     nie gemacht hat, ist keine. */
  const trained: Exercise[] = useMemo(() => {
    const ids = new Set(snapshot.exercises.map((entry) => entry.exerciseId));
    return allExercises
      .filter((exercise) => ids.has(exercise.id))
      .filter((exercise) => !search
        || exercise.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 60);
  }, [allExercises, snapshot.exercises, search]);

  return (
    <Modal title={t("Profil gestalten")} onClose={onClose}>
      <div className="seg" role="tablist">
        {([['aussehen', 'Aussehen'], ['abzeichen', 'Abzeichen'], ['erfolge', 'Erfolge'],
          ['uebungen', 'Übungen']] as const)
          .map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={`seg__item ${tab === id ? 'seg__item--on' : ''}`}
              onClick={() => setTab(id)}
            >
              {t(label)}
            </button>
          ))}
      </div>

      {tab === 'aussehen' && (
        <div className="list">
          <div className="field">
            <label htmlFor="pcard-name">{t('Anzeigename')}</label>
            <input
              id="pcard-name"
              className="input"
              value={state.profile.name}
              onChange={(event) => updateProfile({ name: event.target.value })}
              placeholder={t('Wie du genannt werden willst')}
            />
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>{t('Zeichen')}</div>
            <div className="emoji-grid">
              {EMOJI_CHOICES.map((emoji) => (
                <button
                  key={emoji}
                  className={`emoji-pick ${card.emoji === emoji ? 'is-on' : ''}`}
                  onClick={() => patch({ emoji })}
                  aria-pressed={card.emoji === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>{t('Farbe')}</div>
            <div className="accent-grid">
              {(Object.keys(ACCENTS) as ProfileAccent[]).map((accent) => (
                <button
                  key={accent}
                  className={`accent-pick ${card.accent === accent ? 'is-on' : ''}`}
                  style={{ background: ACCENTS[accent].from }}
                  onClick={() => patch({ accent })}
                  aria-pressed={card.accent === accent}
                  aria-label={t(ACCENTS[accent].label)}
                  title={t(ACCENTS[accent].label)}
                >
                  {card.accent === accent && <IconCheck />}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="pcard-bio">{t('Über dich')}</label>
            <textarea
              id="pcard-bio"
              className="input"
              rows={3}
              maxLength={180}
              value={card.bio}
              onChange={(event) => patch({ bio: event.target.value })}
              placeholder={t('Zwei Zeilen, die dich beschreiben')}
            />
            <div className="tiny dim">{card.bio.length} / 180</div>
          </div>

          <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={card.showRank}
              onChange={(event) => patch({ showRank: event.target.checked })}
            />
            <span className="small">{t('Rang auf der Karte zeigen')}</span>
          </label>
          <label className="row" style={{ gap: 9, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={card.showStats}
              onChange={(event) => patch({ showStats: event.target.checked })}
            />
            <span className="small">{t('Einheiten, Volumen und Serie zeigen')}</span>
          </label>
        </div>
      )}

      {tab === 'abzeichen' && (
        <div className="list">
          <div className="tiny dim">
            {t('Bis zu vier Rang-Abzeichen stehen auf deiner Karte. {count} von 4 vergeben.', {
              count: card.favoriteRankIds.length,
            })}
          </div>
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Übung suchen')}
          />
          <div className="list" style={{ gap: 5 }}>
            {snapshot.exercises
              .filter((entry) => !search
                || entry.exerciseName.toLowerCase().includes(search.toLowerCase()))
              .slice(0, 60)
              .map((entry) => {
                const on = card.favoriteRankIds.includes(entry.exerciseId);
                return (
                  <button
                    key={entry.exerciseId}
                    className={`pick-row ${on ? 'pick-row--on' : ''}`}
                    onClick={() => toggleRankBadge(entry.exerciseId)}
                    aria-pressed={on}
                  >
                    <RankBadge rank={entry.rank} size="sm" />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="small bold">{entry.exerciseName}</span>
                      <span className="tiny dim" style={{ display: 'block' }}>{entry.rank.label}</span>
                    </span>
                    {on && <span className="pick-row__mark"><IconCheck /></span>}
                  </button>
                );
              })}
            {snapshot.exercises.length === 0 && (
              <div className="tiny dim">{t('Noch keine Übung im Verlauf.')}</div>
            )}
          </div>
        </div>
      )}

      {tab === 'erfolge' && (
        <div className="list">
          <div className="tiny dim">
            {t('Bis zu vier Erfolge landen auf der Karte. {count} von 4 vergeben.', {
              count: card.pinnedAchievements.length,
            })}
          </div>
          <div className="list" style={{ gap: 5 }}>
            {badges.map((badge) => {
              const on = card.pinnedAchievements.includes(badge.id);
              return (
                <button
                  key={badge.id}
                  className={`pick-row ${on ? 'pick-row--on' : ''}`}
                  onClick={() => togglePin(badge.id)}
                  aria-pressed={on}
                  disabled={!badge.earned && !on}
                >
                  <span className="pick-row__mark">{on ? <IconCheck /> : <IconTrophy />}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="small bold">{t(badge.label)}</span>
                    <span className="tiny dim" style={{ display: 'block' }}>
                      {badge.earned ? t(badge.hint) : t('noch offen – {progress}', { progress: badge.progress })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'uebungen' && (
        <div className="list">
          <div className="tiny dim">
            {t('Bis zu vier Lieblingsübungen. {count} von 4 vergeben.', {
              count: card.favoriteExerciseIds.length,
            })}
          </div>
          <input
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Übung suchen')}
          />
          <div className="list" style={{ gap: 5 }}>
            {trained.map((exercise) => {
              const on = card.favoriteExerciseIds.includes(exercise.id);
              const entry = snapshot.exercises.find((item) => item.exerciseId === exercise.id);
              return (
                <button
                  key={exercise.id}
                  className={`pick-row ${on ? 'pick-row--on' : ''}`}
                  onClick={() => toggleFavorite(exercise.id)}
                  aria-pressed={on}
                >
                  <span className="pick-row__mark">{on ? <IconCheck /> : <IconX />}</span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="small bold">{exercise.name}</span>
                    {entry && (
                      <span className="tiny dim" style={{ display: 'block' }}>
                        {t(TIER_LABELS[entry.tier])}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
            {trained.length === 0 && (
              <div className="tiny dim">{t('Noch keine Übung im Verlauf.')}</div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Knopf, der den Editor oeffnet - fuer die Profilseite. */
export function EditCardButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn--sm" onClick={onClick}>
      <IconEdit /> {t('Profil gestalten')}
    </button>
  );
}

/* -------------------------------------------------- Karte am Konto halten */

/**
 * Schiebt die Karte ins Konto, wenn sie sich geaendert hat.
 *
 * Uebertragen werden Text, Farbe, Zeichen und die Namen der angehefteten
 * Dinge - nichts, woraus sich ein Trainingswert ablesen liesse. Freunde sehen
 * damit dasselbe Bild wie man selbst, ohne dass dafuer Daten wandern, die
 * sonst hinter einer Freigabe stehen.
 */
export function useProfileCardSync() {
  const { state, allExercises } = useStore();
  const sync = useSync();
  const card = state.settings.profileCard;
  const name = state.profile.name;
  const remote = sync.profile;
  const signedIn = sync.status === 'signed-in';

  const favorites = useMemo(
    () => card.favoriteExerciseIds
      .map((id) => allExercises.find((exercise) => exercise.id === id)?.name)
      .filter((value): value is string => Boolean(value)),
    [card.favoriteExerciseIds, allExercises],
  );

  useEffect(() => {
    if (!signedIn || !remote) return;
    const same = remote.emoji === card.emoji
      && (remote.bio ?? '') === card.bio
      && (remote.accent ?? 'messing') === card.accent
      && (remote.display_name ?? '') === name
      && JSON.stringify(remote.pins ?? []) === JSON.stringify(card.pinnedAchievements)
      && JSON.stringify(remote.favorites ?? []) === JSON.stringify(favorites);
    if (same) return;

    const timer = window.setTimeout(() => {
      void sync.saveProfile({
        display_name: name,
        emoji: card.emoji,
        bio: card.bio,
        accent: card.accent,
        pins: card.pinnedAchievements,
        favorites,
      }).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [signedIn, remote, card, name, favorites, sync]);
}

/**
 * Die Karte eines Freundes.
 *
 * Angeheftete Erfolge kommen als reine Namen herueber - was dahintersteht,
 * bleibt beim Freund. Deshalb sind sie hier Marken ohne Fortschrittsanteil.
 */
export function FriendProfileCard({ friend, score, stats }: {
  friend: {
    displayName: string; handle: string; emoji: string;
    bio?: string; accent?: string; pins?: string[]; favorites?: string[];
  };
  score?: number | null;
  stats?: Array<{ label: string; value: string }>;
}) {
  const accent = (friend.accent as ProfileAccent) in ACCENTS
    ? (friend.accent as ProfileAccent) : 'messing';

  return (
    <div className="pcard">
      <div className="pcard__banner" style={{ background: gradient(accent) }} aria-hidden="true" />
      <div className="pcard__body">
        <div className="pcard__head">
          <div className="pcard__avatar" style={{ background: gradient(accent) }}>
            {friend.emoji || '💪'}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pcard__name">{friend.displayName}</div>
            <div className="tiny dim">@{friend.handle}</div>
          </div>
          {score != null && (
            <div className="pcard__rank">
              <RankBadge rank={rankOf(score)} size="md" />
              <div className="tiny dim">{fmt(score, 0)} / 100</div>
            </div>
          )}
        </div>

        {friend.bio?.trim() && <p className="pcard__bio">{friend.bio}</p>}

        {stats && stats.length > 0 && (
          <div className="pcard__stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="pcard__stat-value mono">{stat.value}</div>
                <div className="tiny dim">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {(friend.pins?.filter(knownBadge).length ?? 0) > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>{t('Angeheftet')}</div>
            <div className="pcard__pins">
              {/* Ein Abzeichen, das diese App nicht kennt, bleibt weg - lieber
                  nichts als eine rohe Kennung auf der Karte. */}
              {friend.pins!.filter(knownBadge).map((id) => (
                <span key={id} className="pin">
                  <IconTrophy /> {t(badgeName(id))}
                </span>
              ))}
            </div>
          </div>
        )}

        {(friend.favorites?.length ?? 0) > 0 && (
          <div>
            <div className="section-label" style={{ marginBottom: 6 }}>{t('Lieblingsübungen')}</div>
            <div className="pcard__pins">
              {friend.favorites!.map((name) => (
                <span key={name} className="pin">{name}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Namen zu den Erfolgs-IDs.
 *
 * Ein Freund schickt nur die ID; den Text dazu kennt die eigene App ohnehin.
 * Gerechnet wird dafuer einmal mit einem leeren Stand - es geht nur um die
 * Namen, nicht um die Werte. Erst beim ersten Bedarf, nicht beim Laden.
 */
let badgeNames: Record<string, string> | null = null;

function badgeName(id: string): string {
  if (!badgeNames) {
    const empty = { workouts: [] } as unknown as Parameters<typeof achievements>[0];
    badgeNames = Object.fromEntries(
      achievements(empty, () => undefined, [], {
        score: 0, tier: 'bronze', rank: rankOf(0), covered: 0, total: 1,
        breadth: 0, breadthFactor: 0, depth: 0, parts: [],
      }).map((badge) => [badge.id, badge.label]),
    );
  }
  return badgeNames[id] ?? id;
}

const knownBadge = (id: string): boolean => badgeName(id) !== id;
