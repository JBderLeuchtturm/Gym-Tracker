import { useMemo, useState } from 'react';
import { useSync } from '../../sync/SyncProvider';
import type { Friend } from '../../sync/types';
import { formatDateShort, relativeDayLabel } from '../../lib/date';
import { EmptyState, fmt, useToast } from '../../components/ui';
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
        title="Noch nichts passiert"
        hint="Sobald deine Freunde trainieren und ihren Fortschritt teilen, steht es hier."
      />
    );
  }

  return (
    <div className="list">
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
                        aria-label="Kommentar löschen"
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
                  placeholder="Etwas dazu sagen…"
                  value={draft}
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && draft.trim()) {
                      void sync.comment(item.friend.userId, item.date, draft);
                      setDraft(''); setOpenComment(null); toast.show('Kommentar gesendet');
                    }
                  }}
                />
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!draft.trim()}
                  onClick={() => {
                    void sync.comment(item.friend.userId, item.date, draft);
                    setDraft(''); setOpenComment(null); toast.show('Kommentar gesendet');
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
