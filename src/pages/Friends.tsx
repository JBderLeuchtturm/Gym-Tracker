import { t } from '../i18n';
import { useMemo, useState } from 'react';
import { useStore } from '../storage/store';
import { useSync } from '../sync/SyncProvider';
import type { Friend, FriendData } from '../sync/types';
import {
  SCOPE_HINTS, SCOPE_LABELS, buildProgressShare, type ProgressShare, type ShareScope,
} from '../sync/sharePayload';
import { hasOverride, saveOverride } from '../sync/config';
import { categoryColor } from '../lib/categoryColors';
import { formatSet } from '../lib/setFormat';
import { ActivityFeed } from './friends/ActivityFeed';
import { GroupsSection } from './friends/GroupsSection';
import { ChallengesSection } from './friends/ChallengesSection';
import { notificationPermission, requestNotifications } from '../sync/notify';
import { buildInviteLink } from '../sync/invite';
import { formatClock, formatDateShort, formatDateTiny, relativeDayLabel } from '../lib/date';
import { BarChart, LineChart, Sparkline } from '../components/charts/Charts';
import { EmptyState, Modal, Stat, fmt, useToast } from '../components/ui';
import {
  IconBell, IconCheck, IconChevronRight, IconCopy, IconPlus, IconRefresh,
  IconTrash, IconTrophy, IconUser, IconUsers, IconX,
} from '../components/icons';

const SCOPES: ShareScope[] = ['progress', 'weight', 'nutrition'];

export function FriendsPage() {
  const sync = useSync();

  if (sync.status === 'loading') {
    return <div className="empty">{t("Verbindung wird geprüft…")}</div>;
  }
  if (sync.status === 'disabled') {
    return <SetupNotice />;
  }
  if (sync.recoveryMode) {
    return <NewPasswordPanel />;
  }
  if (sync.status === 'signed-out') {
    return <AuthPanel />;
  }
  return <FriendsHome />;
}

/* ------------------------------------------------- Noch nicht eingerichtet */

/** Was die Funktion kann - in einem Satz je Punkt. */
const WHAT_YOU_GET: Array<{ title: string; text: string }> = [
  {
    title: 'Sehen, wie es bei den anderen läuft',
    text: 'Trainings der Freunde in einer Liste, mit Reaktion und Kommentar.',
  },
  {
    title: 'Vergleichen, wo es sich lohnt',
    text: 'Gemeinsame Übungen nebeneinander – wer bei was gerade wo steht.',
  },
  {
    title: 'Gemeinsame Ziele über ein paar Wochen',
    text: 'Challenges auf Anzahl Trainings, Sätze oder bewegtes Gewicht.',
  },
  {
    title: 'Pläne weitergeben',
    text: 'Einen Wochenplan als Baustein verschicken, samt eigener Übungen.',
  },
  {
    title: 'Deine Daten auf allen Geräten',
    text: 'Handy und Rechner führen ihre Stände zusammen, ohne dass etwas verloren geht.',
  },
  {
    title: 'Du entscheidest, was sichtbar ist',
    text: 'Fortschritt, Gewicht und Kalorien werden einzeln freigegeben – je Freund.',
  },
];

/**
 * Der erste Bildschirm, wenn noch kein Konto eingerichtet ist.
 *
 * Vorher standen hier sofort vier Schritte mit SQL-Editor und anon-Schluessel -
 * eine Einrichtungsanleitung fuer etwas, von dem man noch gar nicht weiss, was
 * es kann. Deshalb erst, wozu es gut ist, und die Anleitung dahinter.
 */
function SetupNotice() {
  const toast = useToast();
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [howOpen, setHowOpen] = useState(false);

  return (
    <>
      <div className="card">
        <div className="card__title" style={{ marginBottom: 8 }}><IconUsers /> {t("Zu zweit macht es mehr her")}</div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {t('Der Tracker läuft ohne Konto vollständig. Mit einem kommt dazu:')}
        </p>

        <div className="list" style={{ marginTop: 12, gap: 11 }}>
          {WHAT_YOU_GET.map((item) => (
            <div key={item.title}>
              <div className="small bold">{t(item.title)}</div>
              <div className="tiny dim" style={{ marginTop: 2 }}>{t(item.text)}</div>
            </div>
          ))}
        </div>

        <div className="hint-box" style={{ marginTop: 14 }}>
          <div className="small">
            {t('Dafür braucht es einen gemeinsamen Speicherort. Vorgesehen ist ein kostenloses Supabase-Projekt – ohne Kreditkarte, und die Daten gehören weiter dir.')}
          </div>
          <button
            className="btn btn--sm"
            style={{ marginTop: 10 }}
            onClick={() => setHowOpen(!howOpen)}
            aria-expanded={howOpen}
          >
            {howOpen ? t('Anleitung ausblenden') : t('Wie richte ich das ein?')}
          </button>
        </div>
      </div>

      {howOpen && (
      <div className="card">
        <div className="card__title" style={{ marginBottom: 8 }}><IconUser /> {t("Einrichten, etwa fünf Minuten")}</div>
        <ol className="small muted" style={{ paddingLeft: 18, margin: '10px 0 0' }}>
          <li style={{ marginBottom: 6 }}>
            Auf <strong>{t("supabase.com")}</strong> anmelden und ein neues Projekt anlegen.
          </li>
          <li style={{ marginBottom: 6 }}>
            Im Projekt den <strong>{t("SQL Editor")}</strong> öffnen, den Inhalt von
            {' '}<code>supabase/schema.sql</code> aus diesem Repository einfügen und ausführen.
          </li>
          <li style={{ marginBottom: 6 }}>
            Unter <strong>{t("Project Settings → API")}</strong> {t("die")} <em>{t("Project URL")}</em> und den
            {' '}<em>{t("anon public")}</em>-Schlüssel kopieren.
          </li>
          <li>
            Beides in die Datei <code>public/sync-config.json</code> eintragen und
            committen – danach ist die Funktion für alle da, die deinen Link benutzen.
          </li>
        </ol>
      </div>
      )}

      {howOpen && (
      <div className="card">
        <div className="card__title" style={{ marginBottom: 4 }}>{t("Nur zum Ausprobieren")}</div>
        <div className="tiny dim" style={{ marginBottom: 10 }}>
          {t('Die Werte hier bleiben nur in diesem Browser. Für Freunde muss es die Datei sein.')}
        </div>
        <div className="list">
          <div className="field">
            <label className="field__label">{t("Project URL")}</label>
            <input className="input" value={url} placeholder={t("https://abcdef.supabase.co")} onChange={(event) => setUrl(event.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">{t("anon public key")}</label>
            <input className="input" value={key} placeholder={t("eyJhbGciOi…")} onChange={(event) => setKey(event.target.value)} />
          </div>
          <button
            className="btn btn--primary btn--block"
            disabled={!url.trim() || key.trim().length < 20}
            onClick={() => {
              saveOverride({ url: url.trim(), anonKey: key.trim() });
              toast.show(t("Gespeichert – App wird neu geladen"));
              setTimeout(() => window.location.reload(), 600);
            }}
          >
            {t('Speichern und neu laden')}
          </button>
          {hasOverride() && (
            <button
              className="btn btn--ghost btn--block"
              onClick={() => { saveOverride(null); window.location.reload(); }}
            >
              Lokale Werte wieder entfernen
            </button>
          )}
        </div>
      </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------- Anmelden */

function AuthPanel() {
  const sync = useSync();
  const toast = useToast();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const submit = async () => {
    setFailure(null);
    setMessage(null);
    try {
      if (mode === 'up') {
        const { needsConfirmation } = await sync.signUp(email.trim(), password);
        if (needsConfirmation) {
          setMessage('Fast fertig: Bestätige den Link in der E-Mail, dann kannst du dich anmelden.');
        } else {
          toast.show(t("Konto angelegt"));
        }
      } else {
        await sync.signIn(email.trim(), password);
        toast.show(t("Angemeldet"));
      }
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Es hat nicht geklappt');
    }
  };

  return (
    <div className="card">
      {sync.pendingInvite && (
        <div
          className="row"
          style={{
            gap: 9, alignItems: 'flex-start', marginBottom: 13, padding: '10px 12px',
            borderRadius: 'var(--radius-sm)', background: 'var(--accent-soft)',
          }}
        >
                    <span className="small">
            <strong>@{sync.pendingInvite}</strong> hat dich eingeladen.
            <span className="tiny dim" style={{ display: 'block' }}>
              Leg einfach ein Konto an – die Freundschaftsanfrage geht danach von selbst raus.
            </span>
          </span>
        </div>
      )}

      <div className="card__title" style={{ marginBottom: 4 }}>
        {mode === 'in' ? t('Anmelden') : t('Konto anlegen')}
      </div>
      <div className="tiny dim" style={{ marginBottom: 12 }}>
        Dein Konto verbindet deine Geräte und macht das Teilen mit Freunden möglich.
        Deine Trainingsdaten bleiben privat, bis du jemanden freischaltest.
      </div>

      <div className="list">
        <div className="field">
          <label className="field__label">{t("E-Mail")}</label>
          <input
            className="input" type="email" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label">{t("Passwort")}</label>
          <input
            className="input" type="password" value={password}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }}
          />
          {mode === 'up' && <span className="field__hint">{t("Mindestens 6 Zeichen")}</span>}
        </div>

        {failure && <div className="small" style={{ color: 'var(--danger)' }}>{failure}</div>}
        {message && <div className="small" style={{ color: 'var(--success)' }}>{message}</div>}

        <button
          className="btn btn--primary btn--block"
          disabled={sync.busy || !email.trim() || password.length < 6}
          onClick={submit}
        >
          {sync.busy ? t('Einen Moment…') : mode === 'in' ? t('Anmelden') : t('Konto anlegen')}
        </button>
        <button
          className="btn btn--ghost btn--block"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setFailure(null); setMessage(null); }}
        >
          {mode === 'in' ? t('Noch kein Konto? Jetzt anlegen') : t('Ich habe schon ein Konto')}
        </button>

        {mode === 'in' && (
          <button
            className="btn btn--ghost btn--block btn--sm"
            onClick={() => { setResetOpen(true); setFailure(null); setMessage(null); }}
          >
            {t('Passwort vergessen?')}
          </button>
        )}
      </div>

      {resetOpen && (
        <PasswordResetDialog
          initialEmail={email}
          onClose={() => setResetOpen(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------- Passwort zurücksetzen */

/** Verschickt den Wiederherstellungs-Link an die angegebene Adresse. */
function PasswordResetDialog({
  initialEmail, onClose,
}: {
  initialEmail: string;
  onClose: () => void;
}) {
  const sync = useSync();
  const [email, setEmail] = useState(initialEmail);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Modal title={t('Passwort zurücksetzen')} onClose={onClose}>
      <div className="list">
        {sent ? (
          <>
            <div className="small" style={{ color: 'var(--success)' }}>
              {t('Wir haben dir einen Link geschickt. Öffne ihn auf diesem Gerät, dann kannst du hier direkt ein neues Passwort setzen.')}
            </div>
            <div className="tiny dim">
              {t('Nichts angekommen? Sieh im Spam-Ordner nach – und prüfe, ob die Adresse stimmt.')}
            </div>
            <button className="btn btn--block" onClick={onClose}>{t('Alles klar')}</button>
          </>
        ) : (
          <>
            <div className="small muted">
              {t('Gib die E-Mail-Adresse deines Kontos ein. Du bekommst einen Link, mit dem du ein neues Passwort vergeben kannst.')}
            </div>
            <div className="field">
              <label className="field__label">{t('E-Mail')}</label>
              <input
                className="input" type="email" autoComplete="email" value={email} autoFocus
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            {failure && <div className="small" style={{ color: 'var(--danger)' }}>{failure}</div>}
            <button
              className="btn btn--primary btn--block"
              disabled={sync.busy || !email.trim()}
              onClick={async () => {
                setFailure(null);
                try {
                  await sync.requestPasswordReset(email);
                  setSent(true);
                } catch (caught) {
                  setFailure(caught instanceof Error ? caught.message : t('Hat nicht geklappt'));
                }
              }}
            >
              {sync.busy ? t('Einen Moment…') : t('Link schicken')}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------- Neues Passwort setzen */

/** Erscheint, wenn die App aus einem Wiederherstellungs-Link geoeffnet wurde. */
function NewPasswordPanel() {
  const sync = useSync();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [failure, setFailure] = useState<string | null>(null);

  const mismatch = repeat.length > 0 && password !== repeat;

  return (
    <div className="card">
      <div className="card__title" style={{ marginBottom: 4 }}>{t('Neues Passwort setzen')}</div>
      <div className="tiny dim" style={{ marginBottom: 12 }}>
        {t('Du bist über den Link aus der E-Mail hier gelandet. Vergib jetzt ein neues Passwort.')}
      </div>

      <div className="list">
        <div className="field">
          <label className="field__label">{t('Neues Passwort')}</label>
          <input
            className="input" type="password" autoComplete="new-password" value={password} autoFocus
            onChange={(event) => setPassword(event.target.value)}
          />
          <span className="field__hint">{t('Mindestens 6 Zeichen')}</span>
        </div>
        <div className="field">
          <label className="field__label">{t('Wiederholen')}</label>
          <input
            className="input" type="password" autoComplete="new-password" value={repeat}
            onChange={(event) => setRepeat(event.target.value)}
          />
          {mismatch && <span className="field__hint" style={{ color: 'var(--danger)' }}>
            {t('Die beiden stimmen nicht überein')}
          </span>}
        </div>

        {failure && <div className="small" style={{ color: 'var(--danger)' }}>{failure}</div>}

        <button
          className="btn btn--primary btn--block"
          disabled={sync.busy || password.length < 6 || mismatch || repeat.length === 0}
          onClick={async () => {
            setFailure(null);
            try {
              await sync.setNewPassword(password);
              toast.show(t('Passwort geändert'));
            } catch (caught) {
              setFailure(caught instanceof Error ? caught.message : t('Hat nicht geklappt'));
            }
          }}
        >
          {sync.busy ? t('Einen Moment…') : t('Passwort speichern')}
        </button>
        <button className="btn btn--ghost btn--block btn--sm" onClick={sync.endRecoveryMode}>
          {t('Doch nicht ändern')}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Angemeldet */

function FriendsHome() {
  const sync = useSync();
  const { state, getExercise } = useStore();
  const toast = useToast();

  const [handleInput, setHandleInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [open, setOpen] = useState<Friend | null>(null);
  const [editing, setEditing] = useState(false);
  const [section, setSection] = useState<'feed' | 'friends' | 'groups' | 'challenges'>('feed');
  const friendData = sync.friendData;

  const accepted = useMemo(() => sync.friends.filter((f) => f.state === 'accepted'), [sync.friends]);
  const incoming = useMemo(() => sync.friends.filter((f) => f.state === 'incoming'), [sync.friends]);
  const outgoing = useMemo(() => sync.friends.filter((f) => f.state === 'outgoing'), [sync.friends]);

  const myProgress = useMemo(
    () => buildProgressShare(state, getExercise),
    [state, getExercise],
  );

  const submitAdd = async () => {
    setAddError(null);
    try {
      const note = await sync.addFriend(handleInput);
      setHandleInput('');
      toast.show(note);
    } catch (caught) {
      setAddError(caught instanceof Error ? caught.message : 'Hat nicht geklappt');
    }
  };

  const inviteLink = sync.profile ? buildInviteLink(sync.profile.handle) : '';

  return (
    <>
      {/* --------------------------------------------------- Eigenes Konto */}
      <div className="card">
        <div className="row" style={{ gap: 11 }}>
          <span style={{ fontSize: '1.7rem' }}>{sync.profile?.emoji ?? '💪'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold">{sync.profile?.display_name || 'Ohne Namen'}</div>
            <div className="tiny dim">@{sync.profile?.handle ?? '…'}</div>
          </div>
          <button className="btn btn--sm" onClick={() => setEditing(true)}>{t("Ändern")}</button>
        </div>

        <div className="divider" style={{ margin: '11px 0' }} />

        <div className="row row--wrap" style={{ gap: 7 }}>
          <button
            className="btn btn--sm"
            onClick={() => {
              void navigator.clipboard?.writeText(inviteLink);
              toast.show(t("Einladungslink kopiert"));
            }}
          >
            <IconCopy /> Link kopieren
          </button>
          <button
            className="btn btn--sm"
            onClick={() => {
              const text = `Trainier mit mir im Gym Tracker – Konto anlegen, fertig:\n${inviteLink}`;
              if (navigator.share) void navigator.share({ text }).catch(() => undefined);
              else { void navigator.clipboard?.writeText(text); toast.show(t("Einladungslink kopiert")); }
            }}
          >
            Einladung teilen
          </button>
          <button className="btn btn--sm" disabled={sync.busy} onClick={() => void sync.syncNow()}>
            <IconRefresh /> {t('Abgleichen')}
          </button>
          <span className="spacer" />
          <button className="btn btn--sm btn--ghost" onClick={() => void sync.signOut()}>{t("Abmelden")}</button>
        </div>

        {accepted.length > 0 && sync.pushStatus === 'on' && (
          <button
            className="btn btn--sm btn--block"
            style={{ marginTop: 9 }}
            onClick={async () => {
              await sync.disablePush();
              toast.show(t('Push ist aus'));
            }}
          >
            <IconBell /> {t('Push ist an – abschalten')}
          </button>
        )}

        {accepted.length > 0 && sync.pushStatus === 'off' && (
          <button
            className="btn btn--sm btn--block"
            style={{ marginTop: 9 }}
            onClick={async () => {
              const result = await sync.enablePush();
              toast.show(result === 'on'
                ? t('Du wirst benachrichtigt, auch wenn die App zu ist')
                : t('Benachrichtigungen bleiben aus'));
            }}
          >
            <IconBell /> {t('Bescheid geben, wenn Freunde trainiert haben')}
          </button>
        )}

        {accepted.length > 0 && sync.pushStatus === 'denied' && (
          <div className="tiny dim" style={{ marginTop: 9 }}>
            {t("Benachrichtigungen sind für diese Seite im Browser gesperrt. Das lässt sich nur dort wieder freigeben.")}
          </div>
        )}

        {accepted.length > 0 && sync.pushStatus === 'unconfigured'
          && notificationPermission() === 'default' && (
          <button
            className="btn btn--sm btn--block"
            style={{ marginTop: 9 }}
            onClick={async () => {
              const result = await requestNotifications();
              toast.show(result === 'granted'
                ? t('Du wirst benachrichtigt, solange die App offen ist')
                : t('Benachrichtigungen bleiben aus'));
            }}
          >
            <IconBell /> {t('Bescheid geben, solange die App offen ist')}
          </button>
        )}

        <div className="tiny dim" style={{ marginTop: 9 }}>
          {sync.busy
            ? 'Abgleich läuft…'
            : sync.lastSyncAt
              ? `Zuletzt abgeglichen um ${new Date(sync.lastSyncAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Noch nicht abgeglichen'}
          {sync.lastMergeNote && ` · ${sync.lastMergeNote}`}
        </div>
        {sync.error && <div className="tiny" style={{ color: 'var(--danger)', marginTop: 4 }}>{sync.error}</div>}
      </div>

      {sync.schemaOutdated && (
        <div className="card" style={{ borderColor: 'var(--warn)' }}>
          <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <div className="small">
              <div className="bold" style={{ marginBottom: 3 }}>
                {t('Die Datenbank ist älter als die App')}
              </div>
              <span className="muted">
                {t('Gruppen, Challenges und Kommentare brauchen ein paar zusätzliche Tabellen. Führe supabase/schema.sql noch einmal im SQL-Editor deines Supabase-Projekts aus – das Skript ist wiederholbar und ändert an den vorhandenen Daten nichts.')}
              </span>
              <div className="tiny dim" style={{ marginTop: 6 }}>
                {t('Training, Freunde und Freigaben funktionieren solange normal weiter.')}
              </div>
            </div>
          </div>
        </div>
      )}

      {sync.inviteNote && (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="row" style={{ gap: 9 }}>
                        <span className="small">{sync.inviteNote}</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- Freund hinzufügen */}
      <div className="card">
        <div className="card__title" style={{ marginBottom: 9 }}><IconPlus /> {t("Freund hinzufügen")}</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder={t("Benutzername, z. B. jan-4f2a")}
            value={handleInput}
            onChange={(event) => setHandleInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void submitAdd(); }}
          />
          <button className="btn btn--primary" disabled={!handleInput.trim()} onClick={submitAdd}>
            Anfragen
          </button>
        </div>
        {addError && <div className="tiny" style={{ color: 'var(--danger)', marginTop: 6 }}>{addError}</div>}
        <div className="tiny dim" style={{ marginTop: 7 }}>
          Am einfachsten geht es über „Einladung teilen“ – wer den Link öffnet, legt nur ein
          Konto an, die Anfrage kommt dann automatisch bei dir an.
        </div>
      </div>

      {/* ------------------------------------------------------- Anfragen */}
      {incoming.length > 0 && (
        <div className="card">
          <div className="card__title" style={{ marginBottom: 9 }}>{t("Offene Anfragen an dich")}</div>
          <div className="list">
            {incoming.map((friend) => (
              <div key={friend.linkId} className="row row--between">
                <div className="row" style={{ gap: 9, minWidth: 0 }}>
                  <span style={{ fontSize: '1.3rem' }}>{friend.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="bold small">{friend.displayName}</div>
                    <div className="tiny dim">@{friend.handle}</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 5 }}>
                  <button className="btn btn--sm btn--success" onClick={() => void sync.acceptFriend(friend.linkId)}>
                    <IconCheck /> {t('Annehmen')}
                  </button>
                  <button className="btn btn--sm btn--ghost" onClick={() => void sync.removeFriend(friend.linkId)} aria-label={t("Ablehnen")}>
                    <IconX />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="card">
          <div className="card__title" style={{ marginBottom: 9 }}>{t("Von dir verschickt")}</div>
          <div className="list">
            {outgoing.map((friend) => (
              <div key={friend.linkId} className="row row--between">
                <div className="small">@{friend.handle} <span className="dim">{t("wartet auf Antwort")}</span></div>
                <button className="btn btn--sm btn--ghost" onClick={() => void sync.removeFriend(friend.linkId)}>
                  Zurückziehen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chip-scroll">
        {([
          ['feed', 'Aktivität'], ['friends', `Freunde${accepted.length ? ` (${accepted.length})` : ''}`],
          ['groups', 'Gruppen'], ['challenges', 'Challenges'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={`chip chip--button ${section === key ? 'chip--accent' : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'feed' && <ActivityFeed friends={accepted} />}
      {section === 'groups' && (sync.schemaOutdated
        ? <EmptyState title={t('Gruppen brauchen das neue Schema')} hint={t('Siehe Hinweis oben.')} />
        : <GroupsSection />)}
      {section === 'challenges' && (sync.schemaOutdated
        ? <EmptyState title={t('Challenges brauchen das neue Schema')} hint={t('Siehe Hinweis oben.')} />
        : <ChallengesSection friends={accepted} />)}

      {/* -------------------------------------------------------- Freunde */}
      {section === 'friends' && (accepted.length === 0 ? (
        <EmptyState
          title={t("Noch keine Freunde verbunden")}
          hint={t("Sobald ihr verbunden seid, seht ihr gegenseitig euren Fortschritt.")}
        />
      ) : (
        <>
          <div className="card card--flush">
            <div className="section-label" style={{ padding: '12px 14px 6px' }}>
              Freunde ({accepted.length})
            </div>
            {accepted.map((friend) => {
              const data = friendData[friend.userId];
              const last = data?.progress?.totals.lastWorkoutDate;
              return (
                <button key={friend.linkId} className="search-result" onClick={() => setOpen(friend)}>
                  <span className="search-result__thumb" style={{ fontSize: '1.2rem' }}>{friend.emoji}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="search-result__name">{friend.displayName}</span>
                    <span className="search-result__meta" style={{ display: 'block' }}>
                      {data
                        ? data.scopes.length === 0
                          ? 'teilt gerade nichts mit dir'
                          : last
                            ? `zuletzt trainiert: ${relativeDayLabel(last)}`
                            : t('noch kein Training')
                        : 'wird geladen…'}
                    </span>
                  </span>
                  {data?.progress && data.progress.totals.streakWeeks > 0 && (
                    <span className="chip chip--success">{data.progress.totals.streakWeeks} Wo.</span>
                  )}
                  <IconChevronRight style={{ width: 16, height: 16, color: 'var(--text-dim)', flexShrink: 0 }} />
                </button>
              );
            })}
          </div>

          <Leaderboard mine={myProgress} friends={accepted} data={friendData} myName="Du" />
        </>
      ))}

      {open && (
        <FriendDetail
          friend={open}
          data={friendData[open.userId]}
          mine={myProgress}
          onClose={() => setOpen(null)}
          onRemove={() => { void sync.removeFriend(open.linkId); setOpen(null); toast.show(t("Freund entfernt")); }}
        />
      )}

      {editing && <ProfileEditor onClose={() => setEditing(false)} />}
    </>
  );
}

/* -------------------------------------------------------- Profil ändern */

function ProfileEditor({ onClose }: { onClose: () => void }) {
  const sync = useSync();
  const toast = useToast();
  const [name, setName] = useState(sync.profile?.display_name ?? '');
  const [handle, setHandle] = useState(sync.profile?.handle ?? '');
  const [emoji, setEmoji] = useState(sync.profile?.emoji ?? '💪');
  const [failure, setFailure] = useState<string | null>(null);

  const EMOJIS = ['💪', '🏋️', '🔥', '🦍', '🐺', '⚡', '🎯', '🚀', '🥇', '🧗', '🏃', '🥊'];

  return (
    <Modal title={t("Wie sollen dich Freunde sehen?")} onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">{t("Anzeigename")}</label>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label">{t("Benutzername")}</label>
          <input className="input" value={handle} onChange={(event) => setHandle(event.target.value)} />
          <span className="field__hint">
            Darüber finden dich Freunde. Kleinbuchstaben, Ziffern, Bindestrich – 3 bis 24 Zeichen.
          </span>
        </div>
        <div className="field">
          <label className="field__label">{t("Symbol")}</label>
          <div className="row row--wrap" style={{ gap: 6 }}>
            {EMOJIS.map((item) => (
              <button
                key={item}
                className={`chip chip--button ${emoji === item ? 'chip--accent' : ''}`}
                style={{ fontSize: '1.1rem', padding: '5px 10px' }}
                onClick={() => setEmoji(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {failure && <div className="small" style={{ color: 'var(--danger)' }}>{failure}</div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t("Abbrechen")}</button>
          <button
            className="btn btn--primary"
            onClick={async () => {
              setFailure(null);
              try {
                await sync.saveProfile({ display_name: name, handle, emoji });
                toast.show(t("Gespeichert"));
                onClose();
              } catch (caught) {
                setFailure(caught instanceof Error ? caught.message : 'Hat nicht geklappt');
              }
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------- Freund-Detail */

function FriendDetail({
  friend, data, mine, onClose, onRemove,
}: {
  friend: Friend;
  data: FriendData | undefined;
  mine: ProgressShare;
  onClose: () => void;
  onRemove: () => void;
}) {
  const sync = useSync();
  const myGrants = sync.grants[friend.userId] ?? [];
  const [tab, setTab] = useState<'progress' | 'compare' | 'sharing'>('progress');

  const progress = data?.progress;
  const weight = data?.weight;
  const nutrition = data?.nutrition;

  return (
    <Modal title={`${friend.emoji} ${friend.displayName}`} onClose={onClose}>
      <div className="list">
        <div className="tiny dim">@{friend.handle}</div>

        <div className="chip-scroll">
          <button className={`chip chip--button ${tab === 'progress' ? 'chip--accent' : ''}`} onClick={() => setTab('progress')}>
            Fortschritt
          </button>
          <button className={`chip chip--button ${tab === 'compare' ? 'chip--accent' : ''}`} onClick={() => setTab('compare')}>
            Vergleich
          </button>
          <button className={`chip chip--button ${tab === 'sharing' ? 'chip--accent' : ''}`} onClick={() => setTab('sharing')}>
            Was ich zeige
          </button>
        </div>

        {tab === 'sharing' && (
          <div className="card" style={{ background: 'var(--surface-2)' }}>
            <div className="tiny dim" style={{ marginBottom: 10 }}>
              Das hier bestimmt, was <strong>{friend.displayName}</strong> {t("von")} <strong>{t("dir")}</strong> sieht.
              Änderungen gelten sofort.
            </div>
            <div className="list">
              {SCOPES.map((scope) => {
                const on = myGrants.includes(scope);
                return (
                  <label key={scope} className="row" style={{ gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
                    <input
                      type="checkbox"
                      checked={on}
                      style={{ marginTop: 3 }}
                      onChange={(event) => void sync.setGrant(friend.userId, scope, event.target.checked)}
                    />
                    <span>
                      <span className="small bold">{t(SCOPE_LABELS[scope])}</span>
                      <span className="tiny dim" style={{ display: 'block' }}>{t(SCOPE_HINTS[scope])}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <button className="btn btn--danger btn--sm btn--block" style={{ marginTop: 14 }} onClick={onRemove}>
              <IconTrash /> {t('Freundschaft beenden')}
            </button>
          </div>
        )}

        {tab === 'progress' && (
          <>
            {!data || data.scopes.length === 0 ? (
              <EmptyState
                title={`${friend.displayName} teilt gerade nichts mit dir`}
                hint={t("Jede Seite entscheidet selbst, was sichtbar ist.")}
              />
            ) : (
              <>
                {progress && progress.totals.workouts === 0 && (
                  <div className="tiny dim">{t("Fortschritt ist freigegeben, aber es wurde noch nichts aufgezeichnet.")}</div>
                )}

                {progress ? (
                  <>
                    <div className="grid-2">
                      <Stat label={t("Trainings")} value={progress.totals.workouts} tone="accent" />
                      <Stat label={t("Sätze")} value={progress.totals.sets} />
                      <Stat label={t("Volumen")} value={fmt(progress.totals.volume)} unit={t("kg")} />
                      <Stat
                        label={t("Wochen-Serie")}
                        value={progress.totals.streakWeeks}
                        sub={`Rekord: ${progress.totals.longestStreak}`}
                        tone="success"
                      />
                    </div>

                    {progress.weekly.length > 0 && (
                      <div className="card">
                        <div className="card__header"><div className="card__title">{t("Volumen je Woche")}</div></div>
                        <BarChart
                          points={progress.weekly.map((week) => ({
                            label: week.key.replace(/^\d{4}-/, ''),
                            value: week.volume,
                            detail: `${week.key} · ${week.workouts} Einheiten`,
                          }))}
                          unit={t("kg")}
                        />
                      </div>
                    )}

                    <div className="card card--flush">
                      <div className="section-label" style={{ padding: '12px 14px 4px' }}>{t("Übungen")}</div>
                      {progress.exercises.slice(0, 25).map((exercise) => (
                        <div key={exercise.id} className="search-result" style={{ cursor: 'default' }}>
                          <span
                            className="cat-dot"
                            style={{ '--cat': categoryColor(exercise.category as never) } as React.CSSProperties}
                          />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span className="search-result__name">{exercise.name}</span>
                            <span className="search-result__meta" style={{ display: 'block' }}>
                              {exercise.sessions} Einheiten
                              {exercise.bestDurationSec > 0
                                ? ` · ${formatClock(exercise.bestDurationSec)}`
                                : exercise.bestWeight > 0 || exercise.bestReps > 0
                                  ? ` · ${formatSet(exercise.bestWeight, exercise.bestReps)}`
                                  : ''}
                            </span>
                          </span>
                          {exercise.series.length > 1 && (
                            <Sparkline values={exercise.series.map((point) => point.value)} color="var(--success)" />
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="tiny dim">{t("Fortschritt ist nicht freigegeben.")}</div>
                )}

                {weight && (
                  <div className="card">
                    <div className="card__header">
                      <div className="card__title">{t("Körpergewicht")}</div>
                      {weight.entries.length > 0 && (
                        <span className="tiny dim">{fmt(weight.entries[weight.entries.length - 1].kg, 1)} kg</span>
                      )}
                    </div>
                    {weight.entries.length > 1 ? (
                      <LineChart
                        points={weight.entries.map((entry) => ({
                          label: formatDateTiny(entry.date), value: entry.kg, detail: formatDateShort(entry.date),
                        }))}
                        unit={t("kg")} color="var(--success)" formatValue={(value) => fmt(value, 1)}
                      />
                    ) : (
                      <div className="tiny dim">
                        {weight.entries.length === 1
                          ? `Bisher nur ein Eintrag: ${fmt(weight.entries[0].kg, 1)} kg`
                          : 'Freigegeben, aber noch keine Einträge vorhanden.'}
                      </div>
                    )}
                  </div>
                )}

                {nutrition && (
                  <div className="card">
                    <div className="card__header"><div className="card__title">{t("Kalorien")}</div></div>
                    {nutrition.days.length > 1 ? (
                      <LineChart
                        points={nutrition.days.map((day) => ({
                          label: formatDateTiny(day.date), value: day.burn, detail: `${formatDateShort(day.date)} · Verbrauch`,
                        }))}
                        unit={t("kcal")} color="var(--warn)"
                      />
                    ) : (
                      <div className="tiny dim">{t("Freigegeben, aber noch keine Tage erfasst.")}</div>
                    )}
                  </div>
                )}

                {data.updatedAt && (
                  <div className="tiny dim center">
                    Stand: {new Date(data.updatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'compare' && <Comparison mine={mine} theirs={progress} theirName={friend.displayName} />}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ Vergleich */

function Comparison({
  mine, theirs, theirName,
}: {
  mine: ProgressShare;
  theirs: ProgressShare | undefined;
  theirName: string;
}) {
  const rows = useMemo(() => {
    if (!theirs) return [];
    const byId = new Map(theirs.exercises.map((exercise) => [exercise.id, exercise]));
    return mine.exercises
      .map((exercise) => {
        const other = byId.get(exercise.id);
        if (!other) return null;
        const timed = exercise.kind === 'time' || exercise.kind === 'cardio';
        const my = timed ? exercise.bestDurationSec : exercise.best1RM || exercise.bestWeight;
        const their = timed ? other.bestDurationSec : other.best1RM || other.bestWeight;
        if (my <= 0 && their <= 0) return null;
        return { name: exercise.name, timed, my, their };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((a, b) => Math.max(b.my, b.their) - Math.max(a.my, a.their));
  }, [mine, theirs]);

  if (!theirs) {
    return <div className="tiny dim">{t("Für einen Vergleich muss der Fortschritt freigegeben sein.")}</div>;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title={t("Noch keine gemeinsamen Übungen")}
        hint={`Sobald ihr beide dieselbe Übung trainiert, wird hier verglichen.`}
      />
    );
  }

  const wins = rows.filter((row) => row.my > row.their).length;

  return (
    <>
      <div className="row row--wrap" style={{ gap: 7 }}>
        <span className="chip chip--success">Du vorn: {wins}</span>
        <span className="chip chip--warn">{theirName} vorn: {rows.length - wins}</span>
        <span className="chip">{rows.length} gemeinsame Übungen</span>
      </div>

      <div className="card card--flush">
        <table className="data">
          <thead>
            <tr>
              <th>{t("Übung")}</th>
              <th className="right">{t("Du")}</th>
              <th className="right">{theirName.split(' ')[0]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const format = (value: number) => (row.timed ? formatClock(value) : `${fmt(value, 1)} kg`);
              return (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td className="right mono" style={{ color: row.my >= row.their ? 'var(--success)' : undefined }}>
                    {row.my > 0 ? format(row.my) : '–'}
                  </td>
                  <td className="right mono" style={{ color: row.their > row.my ? 'var(--warn)' : undefined }}>
                    {row.their > 0 ? format(row.their) : '–'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tiny dim">
        Verglichen wird das geschätzte Ein-Wiederholungs-Maximum, bei Halte- und Cardio-Übungen die Bestzeit.
      </div>
    </>
  );
}

/* --------------------------------------------------------- Bestenliste */

function Leaderboard({
  mine, friends, data, myName,
}: {
  mine: ProgressShare;
  friends: Friend[];
  data: Record<string, FriendData>;
  myName: string;
}) {
  const [expanded, setExpanded] = useState(false);

  const boards = useMemo(() => {
    interface Entry { name: string; emoji: string; value: number; timed: boolean }
    const perExercise = new Map<string, { name: string; timed: boolean; entries: Entry[] }>();

    const add = (
      exercises: ProgressShare['exercises'], who: string, emoji: string,
    ) => {
      for (const exercise of exercises) {
        const timed = exercise.kind === 'time' || exercise.kind === 'cardio';
        const value = timed ? exercise.bestDurationSec : exercise.best1RM || exercise.bestWeight;
        if (value <= 0) continue;
        const bucket = perExercise.get(exercise.id)
          ?? { name: exercise.name, timed, entries: [] as Entry[] };
        bucket.entries.push({ name: who, emoji, value, timed });
        perExercise.set(exercise.id, bucket);
      }
    };

    add(mine.exercises, myName, '');
    for (const friend of friends) {
      const progress = data[friend.userId]?.progress;
      if (progress) add(progress.exercises, friend.displayName, friend.emoji);
    }

    return [...perExercise.values()]
      .filter((bucket) => bucket.entries.length >= 2)
      .map((bucket) => ({ ...bucket, entries: bucket.entries.sort((a, b) => b.value - a.value) }))
      .sort((a, b) => b.entries.length - a.entries.length || a.name.localeCompare(b.name, 'de'));
  }, [mine, friends, data, myName]);

  if (boards.length === 0) return null;
  const shown = expanded ? boards : boards.slice(0, 4);

  return (
    <div className="card">
      <div className="card__header">
        <div className="card__title"><IconTrophy style={{ color: 'var(--warn)' }} /> {t("Bestenliste")}</div>
        <span className="tiny dim">{boards.length} Übungen</span>
      </div>

      <div className="list">
        {shown.map((board) => (
          <div key={board.name}>
            <div className="tiny bold" style={{ marginBottom: 4 }}>{board.name}</div>
            {board.entries.slice(0, 5).map((entry, index) => {
              const best = board.entries[0].value || 1;
              return (
                <div key={`${entry.name}-${index}`} style={{ marginBottom: 4 }}>
                  <div className="row row--between tiny">
                    <span className="nowrap">
                      <span className="rank">{index + 1}</span> {entry.emoji} {entry.name}
                    </span>
                    <span className="mono dim">
                      {board.timed ? formatClock(entry.value) : `${fmt(entry.value, 1)} kg`}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 5 }}>
                    <div
                      className="progress-bar__fill"
                      style={{
                        width: `${(entry.value / best) * 100}%`,
                        background: entry.name === myName ? 'var(--accent)' : 'var(--violet)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {boards.length > 4 && (
        <button className="btn btn--ghost btn--sm btn--block" style={{ marginTop: 8 }} onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Weniger anzeigen' : `Alle ${boards.length} anzeigen`}
        </button>
      )}
    </div>
  );
}
