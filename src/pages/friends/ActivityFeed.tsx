import { t } from '../../i18n';
import { useMemo, useState } from 'react';
import { useSync } from '../../sync/SyncProvider';
import type { Friend } from '../../sync/types';
import { formatDateShort, relativeDayLabel, todayISO, weekKey } from '../../lib/date';
import { EmptyState, fmt, useToast } from '../../components/ui';
import { useStore } from '../../storage/store';
import { weeklySummaries } from '../../lib/stats';
import { IconTrash } from '../../components/icons';

const EMOJIS = ['💪', '🔥', '👏', '🤯', '🫡'];

interface FeedItem {
  friend: Friend;
  date: string;
  title: string;
  sets: number;
  volume: number;
  highlight: string | null;
}

/**
 * Was die Freunde zuletzt gemacht haben - mit Reaktion und Kommentar.
 * Die Eintraege kommen aus den geteilten Auswertungen, es gibt also nichts
 * zu sehen, was nicht ohnehin freigegeben waere.
 */
export function ActivityFeed({ friends }: { friends: Friend[] }) {
  const sync = useSync();
  const toast = useToast();
  const [openComment, setOpenComment] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const items = useMemo<FeedItem[]>(() => {
    const list: FeedItem[] = [];
    for (const friend of friends) {
      const recent = sync.friendData[friend.userId]?.progress?.recent ?? [];
      for (const session of recent.slice(0, 8)) {
        list.push({
          friend,
          date: session.date,
          title: session.title,
          sets: session.sets,
          volume: session.volume,
          highlight: session.highlight,
        });
      }
    }
    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  }, [friends, sync.friendData]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title={t("Noch nichts passiert")}
        hint={t("Sobald deine Freunde trainieren und ihren Fortschritt teilen, steht es hier.")}
      />
    );
  }

  return (
    <div className="list">
      <WeeklyRecap friends={friends} />
      {items.map((item) => {
        const key = `${item.friend.userId}:${item.date}`;
        const mine = sync.reactions.filter(
          (r) => r.ownerId === item.friend.userId && r.activityDate === item.date);
        const notes = sync.comments
          .filter((c) => c.ownerId === item.friend.userId && c.activityDate === item.date)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        return (
          <div key={key} className="card feed-item">
            <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
              <span className="feed-item__avatar">{item.friend.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row row--between">
                  <span className="bold small">{item.friend.displayName}</span>
                  <span className="tiny dim nowrap">{relativeDayLabel(item.date)}</span>
                </div>
                <div className="tiny dim">{item.title}</div>
                <div className="row row--wrap tiny" style={{ gap: 6, marginTop: 6 }}>
                  <span className="chip">{item.sets} Sätze</span>
                  {item.volume > 0 && <span className="chip">{fmt(item.volume)} kg</span>}
                  {item.highlight && <span className="chip chip--accent">{item.highlight}</span>}
                </div>
              </div>
            </div>

            <div className="row row--wrap" style={{ gap: 5, marginTop: 10 }}>
              {EMOJIS.map((emoji) => {
                const count = mine.filter((r) => r.emoji === emoji).length;
                const byMe = mine.some((r) => r.emoji === emoji && r.authorId === sync.user?.id);
                return (
                  <button
                    key={emoji}
                    className={`chip chip--button ${byMe ? 'chip--accent' : ''}`}
                    onClick={() => void sync.react(item.friend.userId, item.date, emoji)}
                  >
                    {emoji}{count > 0 && ` ${count}`}
                  </button>
                );
              })}
              <span className="spacer" />
              <button
                className="chip chip--button"
                onClick={() => { setOpenComment(openComment === key ? null : key); setDraft(''); }}
              >
                💬 {notes.length > 0 ? notes.length : 'Kommentar'}
              </button>
            </div>

            {notes.length > 0 && (
              <div className="list" style={{ marginTop: 9, gap: 6 }}>
                {notes.map((note) => (
                  <div key={note.id} className="row" style={{ gap: 7, alignItems: 'flex-start' }}>
                    <span className="tiny bold nowrap" style={{ color: 'var(--accent)' }}>
                      {note.authorId === sync.user?.id ? 'Du' : item.friend.displayName}
                    </span>
                    <span className="tiny" style={{ flex: 1, minWidth: 0 }}>{note.body}</span>
                    {note.authorId === sync.user?.id && (
                      <button
                        className="btn btn--ghost btn--icon btn--sm"
                        onClick={() => void sync.removeComment(note.id)}
                        aria-label={t("Kommentar löschen")}
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {openComment === key && (
              <div className="row" style={{ gap: 7, marginTop: 9 }}>
                <input
                  className="input"
                  placeholder={t("Etwas dazu sagen…")}
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && draft.trim()) {
                      void sync.comment(item.friend.userId, item.date, draft);
                      setDraft(''); setOpenComment(null); toast.show(t("Kommentar gesendet"));
                    }
                  }}
                />
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!draft.trim()}
                  onClick={() => {
                    void sync.comment(item.friend.userId, item.date, draft);
                    setDraft(''); setOpenComment(null); toast.show(t("Kommentar gesendet"));
                  }}
                >
                  Senden
                </button>
              </div>
            )}

            <div className="tiny dim" style={{ marginTop: 7 }}>{formatDateShort(item.date)}</div>
          </div>
        );
      })}
    </div>
  );
}


/**
 * Wochenrueckblick: Wer hat diese Woche was gemacht?
 *
 * Gerechnet wird aus den geteilten Wochenzahlen - keine neuen Daten, nur eine
 * andere Sicht darauf. Wer nichts freigegeben hat, taucht nicht auf; das ist
 * kein Versehen, sondern die Freigabe.
 */
function WeeklyRecap({ friends }: { friends: Friend[] }) {
  const sync = useSync();
  const { state } = useStore();

  // Die eigenen Zahlen kommen aus dem lokalen Stand, nicht ueber den Server.
  const ownWeekly = useMemo(() => weeklySummaries(state, 2), [state]);

  const rows = useMemo(() => {
    const thisWeek = weekKey(todayISO());

    const entries = friends.map((friend) => {
      const weekly = sync.friendData[friend.userId]?.progress?.weekly ?? [];
      const week = weekly.find((item) => item.key === thisWeek);
      return {
        friend,
        workouts: week?.workouts ?? 0,
        sets: week?.sets ?? 0,
        volume: week?.volume ?? 0,
      };
    });

    // Eigene Zahlen mitrechnen, damit der Vergleich einen Bezugspunkt hat.
    const own = ownWeekly.find((item) => item.key === thisWeek);
    if (own) {
      entries.push({
        friend: { userId: 'me', handle: 'du', displayName: t('Du'), scopes: [] } as unknown as Friend,
        workouts: own.workouts,
        sets: own.sets,
        volume: own.volume,
      });
    }

    return entries
      .filter((entry) => entry.sets > 0)
      .sort((a, b) => b.sets - a.sets);
  }, [friends, sync.friendData, ownWeekly]);

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, row) => sum + row.sets, 0);
  const best = rows[0];

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title">{t("Diese Woche")}</div>
        <span className="tiny dim">{t('{count} Sätze zusammen', { count: total })}</span>
      </div>

      <div className="list">
        {rows.map((row) => (
          <div key={row.friend.userId}>
            <div className="row row--between tiny" style={{ marginBottom: 4 }}>
              <span className="bold">
                {row.friend.displayName || `@${row.friend.handle}`}
                {row.friend.userId === best.friend.userId && rows.length > 1 && ' 🏅'}
              </span>
              <span className="dim">
                {row.workouts} × · {row.sets} {t('Sätze')} · {fmt(row.volume)} kg
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-bar__fill"
                style={{
                  width: `${(row.sets / (best.sets || 1)) * 100}%`,
                  background: row.friend.userId === 'me' ? 'var(--accent)' : 'var(--violet)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
