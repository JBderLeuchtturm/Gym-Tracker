import { t } from '../i18n';
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { AppState } from '../types';
import { useStore } from '../storage/store';
import { loadSyncConfig, type SyncConfig } from './config';
import {
  pushState as readPushState, subscribePush, unsubscribePush, type PushState,
} from '../lib/push';
import { describeMerge, isPristine, mergeStates } from './merge';
import {
  buildNutritionShare, buildProgressShare, buildWeightShare, type ShareScope,
} from './sharePayload';
import type {
  ActivityComment, ActivityReaction, Challenge, ChallengeMetric, Friend, FriendData, Group,
  RemoteProfile, SyncStatus,
} from './types';
import {
  addComment, createChallenge, createGroup, deleteChallenge, deleteComment, joinChallenge,
  joinGroup, leaveChallenge, leaveGroup, loadChallenges, loadFeedback, loadGroups, toggleReaction,
} from './social';
import { announceNewActivity, type FriendActivity } from './notify';
import { migrate } from '../storage/db';
import { captureInviteFromUrl, clearPendingInvite, readPendingInvite } from './invite';

const PUSH_DELAY_MS = 3500;
const POLL_INTERVAL_MS = 90_000;

interface SyncValue {
  status: SyncStatus;
  user: User | null;
  profile: RemoteProfile | null;
  error: string | null;
  busy: boolean;
  lastSyncAt: number | null;
  lastMergeNote: string | null;
  /** Benutzername aus einem Einladungslink, solange die Anfrage noch aussteht. */
  pendingInvite: string | null;
  /** Rueckmeldung, nachdem eine Einladung eingeloest wurde. */
  inviteNote: string | null;

  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Verschickt eine E-Mail mit Link zum Zuruecksetzen des Passworts. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Setzt das Passwort der laufenden Wiederherstellungs-Sitzung. */
  setNewPassword: (password: string) => Promise<void>;
  /** true, solange die App aus einem Wiederherstellungs-Link kommt. */
  recoveryMode: boolean;
  endRecoveryMode: () => void;
  saveProfile: (patch: Partial<Pick<RemoteProfile, 'handle' | 'display_name' | 'emoji'>>) => Promise<void>;

  friends: Friend[];
  refreshFriends: () => Promise<void>;
  addFriend: (handle: string) => Promise<string>;
  acceptFriend: (linkId: string) => Promise<void>;
  removeFriend: (linkId: string) => Promise<void>;

  /** Was ich wem zeige: Freund-ID -> Bereiche. */
  grants: Record<string, ShareScope[]>;
  setGrant: (viewerId: string, scope: ShareScope, enabled: boolean) => Promise<void>;

  /** Push-Nachrichten: Stand, An- und Abmelden, Anstupsen der Freunde. */
  pushStatus: PushState;
  enablePush: () => Promise<PushState>;
  disablePush: () => Promise<void>;
  nudgeFriends: () => Promise<void>;

  loadFriendData: (friendId: string) => Promise<FriendData>;
  /** Geteilte Daten aller angenommenen Freunde, zentral geladen. */
  friendData: Record<string, FriendData>;
  syncNow: () => Promise<void>;

  groups: Group[];
  challenges: Challenge[];
  reactions: ActivityReaction[];
  comments: ActivityComment[];
  refreshSocial: () => Promise<void>;
  createGroup: (name: string, emoji: string) => Promise<void>;
  joinGroup: (code: string) => Promise<string>;
  leaveGroup: (groupId: string) => Promise<void>;
  createChallenge: (input: {
    title: string; metric: ChallengeMetric; startsOn: string; endsOn: string; groupId: string | null;
  }) => Promise<void>;
  joinChallenge: (id: string) => Promise<void>;
  leaveChallenge: (id: string) => Promise<void>;
  deleteChallenge: (id: string) => Promise<void>;
  react: (ownerId: string, date: string, emoji: string) => Promise<void>;
  comment: (ownerId: string, date: string, body: string) => Promise<void>;
  removeComment: (id: string) => Promise<void>;
  /** Neue Trainings von Freunden seit dem letzten Blick. */
  freshActivity: FriendActivity[];
  /**
   * true, wenn die Datenbank aelter ist als die App - dann fehlen die Tabellen
   * fuer Gruppen, Challenges und Kommentare.
   */
  schemaOutdated: boolean;
}

/** Erkennt die Meldung von PostgREST fuer eine unbekannte Tabelle. */
function isMissingTable(message: string): boolean {
  return /could not find the table|does not exist|schema cache/i.test(message);
}

const SyncContext = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { state, replaceState, getExercise } = useStore();

  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [status, setStatus] = useState<SyncStatus>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [grants, setGrants] = useState<Record<string, ShareScope[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [lastMergeNote, setLastMergeNote] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [reactions, setReactions] = useState<ActivityReaction[]>([]);
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [freshActivity, setFreshActivity] = useState<FriendActivity[]>([]);
  const [friendData, setFriendData] = useState<Record<string, FriendData>>({});
  const [schemaOutdated, setSchemaOutdated] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<string | null>(() => captureInviteFromUrl());
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  // Der zuletzt hochgeladene Stand - verhindert, dass Hoch- und Runterladen
  // sich gegenseitig immer wieder anstossen.
  const pushedStamp = useRef<string | null>(null);
  const pushTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const getExerciseRef = useRef(getExercise);
  getExerciseRef.current = getExercise;

  /* ------------------------------------------------------------ Aufsetzen */

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadSyncConfig();
      if (cancelled) return;
      if (!loaded) { setStatus('disabled'); return; }
      setConfig(loaded);

      // Die Supabase-Bibliothek wird erst geladen, wenn wirklich synchronisiert
      // wird - so bleibt der Start der App fuer alle anderen schlank.
      const { createClient } = await import('@supabase/supabase-js');
      if (cancelled) return;
      setClient(createClient(loaded.url, loaded.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'gym-tracker:auth' },
      }));
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setUser(data.session?.user ?? null);
      setStatus(data.session?.user ? 'signed-in' : 'signed-out');
    });

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      // Kommt der Nutzer ueber den Link aus der E-Mail, ist er zwar angemeldet,
      // soll aber zuerst ein neues Passwort setzen.
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      setUser(session?.user ?? null);
      setStatus(session?.user ? 'signed-in' : 'signed-out');
      if (!session?.user) {
        setProfile(null);
        setFriends([]);
        setGrants({});
        pushedStamp.current = null;
      }
    });

    return () => { cancelled = true; listener.subscription.unsubscribe(); };
  }, [client]);

  /* --------------------------------------------------------------- Profil */

  const ensureProfile = useCallback(async (): Promise<RemoteProfile | null> => {
    if (!client || !user) return null;

    const existing = await client
      .from('profiles')
      .select('id, handle, display_name, emoji')
      .eq('id', user.id)
      .maybeSingle();

    if (existing.data) {
      setProfile(existing.data as RemoteProfile);
      return existing.data as RemoteProfile;
    }

    // Noch kein Profil: einen freien Benutzernamen aus der E-Mail ableiten.
    const base = (user.email ?? 'sportler').split('@')[0]
      .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'sportler';

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const suffix = Math.random().toString(36).slice(2, 6);
      const handle = `${base.padEnd(3, 'x')}-${suffix}`;
      const inserted = await client
        .from('profiles')
        .insert({ id: user.id, handle, display_name: stateRef.current.profile.name || base, emoji: '💪' })
        .select('id, handle, display_name, emoji')
        .single();
      if (!inserted.error && inserted.data) {
        setProfile(inserted.data as RemoteProfile);
        return inserted.data as RemoteProfile;
      }
      // 23505 = Benutzername schon vergeben -> naechster Versuch
      if (inserted.error && inserted.error.code !== '23505') {
        setError(inserted.error.message);
        return null;
      }
    }
    setError(t('Es konnte kein freier Benutzername vergeben werden.'));
    return null;
  }, [client, user]);

  /* ------------------------------------------------------- Hoch- und Runterladen */

  const pushState = useCallback(async (next: AppState) => {
    if (!client || !user) return;
    const { error: pushError } = await client.from('user_state').upsert({
      user_id: user.id,
      data: next,
      updated_at: new Date().toISOString(),
    });
    if (pushError) { setError(pushError.message); return; }

    pushedStamp.current = next.updatedAt;

    const lookup = getExerciseRef.current;
    const rows = [
      { owner_id: user.id, scope: 'progress', payload: buildProgressShare(next, lookup) },
      { owner_id: user.id, scope: 'weight', payload: buildWeightShare(next) },
      { owner_id: user.id, scope: 'nutrition', payload: buildNutritionShare(next, lookup) },
    ].map((row) => ({ ...row, updated_at: new Date().toISOString() }));

    const { error: shareError } = await client.from('share_payloads').upsert(rows);
    if (shareError) setError(shareError.message);
    else { setError(null); setLastSyncAt(Date.now()); }
  }, [client, user]);

  const pullAndMerge = useCallback(async (): Promise<void> => {
    if (!client || !user) return;
    const { data, error: pullError } = await client
      .from('user_state')
      .select('data')
      .eq('user_id', user.id)
      .maybeSingle();

    if (pullError) { setError(pullError.message); return; }

    const local = stateRef.current;
    if (!data?.data) {
      // Erstes Geraet an diesem Konto - der lokale Stand wird zum Ausgangspunkt.
      await pushState(local);
      return;
    }

    const remote = migrate(data.data);
    if (remote.updatedAt === local.updatedAt) { setLastSyncAt(Date.now()); return; }

    // Frisch installiertes Geraet: den Kontostand einfach uebernehmen.
    if (isPristine(local)) {
      replaceState(remote);
      stateRef.current = remote;
      pushedStamp.current = remote.updatedAt;
      setLastMergeNote(t('Stand vom Konto übernommen'));
      setLastSyncAt(Date.now());
      return;
    }

    const merged = mergeStates(local, remote);
    const note = describeMerge(local, remote, merged);
    replaceState(merged);
    stateRef.current = merged;
    setLastMergeNote(note);
    await pushState(merged);
  }, [client, user, pushState, replaceState]);

  // Nach dem Anmelden: Profil sicherstellen und Staende zusammenfuehren.
  useEffect(() => {
    if (status !== 'signed-in' || !client || !user) return;
    let cancelled = false;
    void (async () => {
      setBusy(true);
      await ensureProfile();
      if (!cancelled) await pullAndMerge();
      if (!cancelled) setBusy(false);
    })();
    return () => { cancelled = true; };
  }, [status, client, user, ensureProfile, pullAndMerge]);

  // Laufende Aenderungen gebuendelt hochladen.
  useEffect(() => {
    if (status !== 'signed-in') return;
    if (pushedStamp.current === null) return; // erster Abgleich laeuft noch
    if (pushedStamp.current === state.updatedAt) return;

    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => { void pushState(stateRef.current); }, PUSH_DELAY_MS);
    return () => { if (pushTimer.current) window.clearTimeout(pushTimer.current); };
  }, [state.updatedAt, status, pushState]);

  /* -------------------------------------------------------------- Freunde */

  const refreshFriends = useCallback(async () => {
    if (!client || !user) return;

    const links = await client
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at');
    if (links.error) { setError(links.error.message); return; }

    const rows = links.data ?? [];
    const otherIds = rows.map((row) => (row.requester_id === user.id ? row.addressee_id : row.requester_id));

    let profiles: RemoteProfile[] = [];
    if (otherIds.length > 0) {
      const result = await client
        .from('profiles')
        .select('id, handle, display_name, emoji')
        .in('id', otherIds);
      if (result.error) { setError(result.error.message); return; }
      profiles = (result.data ?? []) as RemoteProfile[];
    }
    const byId = new Map(profiles.map((item) => [item.id, item]));

    setFriends(rows.map((row) => {
      const otherId = row.requester_id === user.id ? row.addressee_id : row.requester_id;
      const info = byId.get(otherId);
      return {
        linkId: row.id,
        userId: otherId,
        handle: info?.handle ?? 'unbekannt',
        displayName: info?.display_name || info?.handle || 'Unbekannt',
        emoji: info?.emoji || '💪',
        state: row.status === 'accepted'
          ? 'accepted'
          : row.requester_id === user.id ? 'outgoing' : 'incoming',
        since: row.created_at,
      };
    }));

    const grantRows = await client.from('share_grants').select('viewer_id, scope').eq('owner_id', user.id);
    if (!grantRows.error) {
      const map: Record<string, ShareScope[]> = {};
      for (const row of grantRows.data ?? []) {
        const list = map[row.viewer_id] ?? [];
        list.push(row.scope as ShareScope);
        map[row.viewer_id] = list;
      }
      setGrants(map);
    }
  }, [client, user]);

  useEffect(() => { if (status === 'signed-in') void refreshFriends(); }, [status, refreshFriends]);

  const addFriend = useCallback(async (handleInput: string): Promise<string> => {
    if (!client || !user) throw new Error(t('Nicht angemeldet'));
    const handle = handleInput.trim().toLowerCase().replace(/^@/, '');
    if (!handle) throw new Error(t('Bitte einen Benutzernamen eingeben'));
    if (handle === profile?.handle) throw new Error(t('Das bist du selbst'));

    const found = await client.rpc('find_profile_by_handle', { p_handle: handle });
    if (found.error) throw new Error(found.error.message);
    const target = (found.data ?? [])[0] as RemoteProfile | undefined;
    if (!target) throw new Error(t('Niemand mit dem Namen „{handle}“ gefunden', { handle }));

    const inserted = await client
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: target.id, status: 'pending' });

    if (inserted.error) {
      if (inserted.error.code === '23505') throw new Error(t('Mit diesem Konto besteht schon eine Verbindung'));
      // Die Bremse aus schema.sql meldet sich mit einem eigenen Fehlercode.
      if (inserted.error.code === 'P0001' || /Zu viele Anfragen/i.test(inserted.error.message)) {
        throw new Error(t('Zu viele Anfragen in kurzer Zeit. Versuch es später noch einmal.'));
      }
      throw new Error(inserted.error.message);
    }
    await refreshFriends();
    return t('Anfrage an {name} geschickt', { name: target.display_name || target.handle });
  }, [client, user, profile?.handle, refreshFriends]);

  const acceptFriend = useCallback(async (linkId: string) => {
    if (!client) return;
    const updated = await client
      .from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', linkId);
    if (updated.error) { setError(updated.error.message); return; }
    await refreshFriends();
  }, [client, refreshFriends]);

  const removeFriend = useCallback(async (linkId: string) => {
    if (!client) return;
    const removed = await client.from('friendships').delete().eq('id', linkId);
    if (removed.error) { setError(removed.error.message); return; }
    await refreshFriends();
  }, [client, refreshFriends]);

  const setGrant = useCallback(async (viewerId: string, scope: ShareScope, enabled: boolean) => {
    if (!client || !user) return;

    // Sofort in der Oberflaeche spiegeln, damit der Schalter nicht springt.
    setGrants((prev) => {
      const current = new Set(prev[viewerId] ?? []);
      if (enabled) current.add(scope); else current.delete(scope);
      return { ...prev, [viewerId]: [...current] };
    });

    const result = enabled
      ? await client.from('share_grants').upsert({ owner_id: user.id, viewer_id: viewerId, scope })
      : await client.from('share_grants').delete()
          .eq('owner_id', user.id).eq('viewer_id', viewerId).eq('scope', scope);

    if (result.error) { setError(result.error.message); await refreshFriends(); }
  }, [client, user, refreshFriends]);

  const loadFriendData = useCallback(async (friendId: string): Promise<FriendData> => {
    if (!client) return { scopes: [], updatedAt: null };
    const result = await client
      .from('share_payloads')
      .select('scope, payload, updated_at')
      .eq('owner_id', friendId);

    if (result.error) throw new Error(result.error.message);

    const data: FriendData = { scopes: [], updatedAt: null };
    for (const row of result.data ?? []) {
      const scope = row.scope as ShareScope;
      data.scopes.push(scope);
      if (scope === 'progress') data.progress = row.payload;
      if (scope === 'weight') data.weight = row.payload;
      if (scope === 'nutrition') data.nutrition = row.payload;
      if (!data.updatedAt || row.updated_at > data.updatedAt) data.updatedAt = row.updated_at;
    }
    return data;
  }, [client]);

  /**
   * Laedt die geteilten Auswertungen aller Freunde und meldet neue Trainings.
   * Das laeuft zentral, damit die Meldung auch kommt, wenn gerade ein anderer
   * Reiter offen ist.
   */
  const refreshFriendData = useCallback(async (list: Friend[]) => {
    const accepted = list.filter((friend) => friend.state === 'accepted');
    if (accepted.length === 0) { setFriendData({}); return; }

    const entries = await Promise.all(accepted.map(async (friend) => {
      try {
        return [friend.userId, await loadFriendData(friend.userId)] as const;
      } catch {
        return [friend.userId, { scopes: [], updatedAt: null } as FriendData] as const;
      }
    }));

    const map = Object.fromEntries(entries);
    setFriendData(map);

    const activities: FriendActivity[] = accepted
      .map((friend) => {
        const recent = map[friend.userId]?.progress?.recent?.[0];
        if (!recent) return null;
        return {
          userId: friend.userId,
          name: friend.displayName,
          emoji: friend.emoji,
          date: recent.date,
          title: recent.title,
          sets: recent.sets,
        };
      })
      .filter((item): item is FriendActivity => item !== null);

    const fresh = announceNewActivity(activities);
    if (fresh.length > 0) setFreshActivity((previous) => [...fresh, ...previous].slice(0, 10));
  }, [loadFriendData]);

  useEffect(() => {
    if (status !== 'signed-in') return;
    void refreshFriendData(friends);
  }, [status, friends, refreshFriendData]);

  /* -------------------------------------------------- Gruppen und Challenges */

  const refreshSocial = useCallback(async () => {
    if (!client || !user) return;
    try {
      const [loadedGroups, loadedChallenges, feedback] = await Promise.all([
        loadGroups(client, user.id),
        loadChallenges(client),
        loadFeedback(client),
      ]);
      setGroups(loadedGroups);
      setChallenges(loadedChallenges);
      setReactions(feedback.reactions);
      setComments(feedback.comments);
      setSchemaOutdated(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      // Fehlen die Tabellen, ist nur das Schema aelter als die App. Das ist
      // kein Betriebsfehler - Training und Freunde laufen unveraendert weiter.
      if (isMissingTable(message)) {
        setSchemaOutdated(true);
        setGroups([]);
        setChallenges([]);
        setReactions([]);
        setComments([]);
        return;
      }
      setError(message || t('Gruppen konnten nicht geladen werden'));
    }
  }, [client, user]);

  const doCreateGroup = useCallback(async (name: string, emoji: string) => {
    if (!client || !user) return;
    await createGroup(client, user.id, name, emoji);
    await refreshSocial();
  }, [client, user, refreshSocial]);

  const doJoinGroup = useCallback(async (code: string) => {
    if (!client || !user) throw new Error(t('Nicht angemeldet'));
    const name = await joinGroup(client, user.id, code);
    await refreshSocial();
    await refreshFriends();
    return name;
  }, [client, user, refreshSocial, refreshFriends]);

  const doLeaveGroup = useCallback(async (groupId: string) => {
    if (!client || !user) return;
    await leaveGroup(client, user.id, groupId);
    await refreshSocial();
    await refreshFriends();
  }, [client, user, refreshSocial, refreshFriends]);

  const doCreateChallenge = useCallback(async (input: {
    title: string; metric: ChallengeMetric; startsOn: string; endsOn: string; groupId: string | null;
  }) => {
    if (!client || !user) return;
    await createChallenge(client, user.id, input);
    await refreshSocial();
  }, [client, user, refreshSocial]);

  const doJoinChallenge = useCallback(async (id: string) => {
    if (!client || !user) return;
    await joinChallenge(client, user.id, id);
    await refreshSocial();
  }, [client, user, refreshSocial]);

  const doLeaveChallenge = useCallback(async (id: string) => {
    if (!client || !user) return;
    await leaveChallenge(client, user.id, id);
    await refreshSocial();
  }, [client, user, refreshSocial]);

  const doDeleteChallenge = useCallback(async (id: string) => {
    if (!client) return;
    await deleteChallenge(client, id);
    await refreshSocial();
  }, [client, refreshSocial]);

  const react = useCallback(async (ownerId: string, date: string, emoji: string) => {
    if (!client || !user) return;
    const existing = reactions.find((item) =>
      item.ownerId === ownerId && item.activityDate === date
      && item.authorId === user.id && item.emoji === emoji);
    await toggleReaction(client, user.id, ownerId, date, emoji, existing);
    await refreshSocial();
  }, [client, user, reactions, refreshSocial]);

  const comment = useCallback(async (ownerId: string, date: string, body: string) => {
    if (!client || !user || !body.trim()) return;
    await addComment(client, user.id, ownerId, date, body);
    await refreshSocial();
  }, [client, user, refreshSocial]);

  const removeComment = useCallback(async (id: string) => {
    if (!client) return;
    await deleteComment(client, id);
    await refreshSocial();
  }, [client, refreshSocial]);

  // Beim Zurueckkehren zur App und regelmaessig nachsehen, ob anderswo etwas passiert ist.
  useEffect(() => {
    if (status !== 'signed-in') return;
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      void pullAndMerge();
      void refreshSocial();
    };
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, POLL_INTERVAL_MS);
    return () => { document.removeEventListener('visibilitychange', check); window.clearInterval(timer); };
  }, [status, pullAndMerge, refreshSocial]);

  // Gruppen und Challenges nach dem Anmelden und nach Aenderungen laden.
  useEffect(() => { if (status === 'signed-in') void refreshSocial(); }, [status, refreshSocial]);

  /* ----------------------------------------------------------- Anmeldung */

  // Sobald das Profil steht, eine gemerkte Einladung automatisch einloesen.
  useEffect(() => {
    if (status !== 'signed-in' || !profile) return;
    const pending = readPendingInvite();
    if (!pending) return;
    if (pending === profile.handle) { clearPendingInvite(); setPendingInvite(null); return; }

    let cancelled = false;
    void (async () => {
      try {
        const note = await addFriend(pending);
        if (!cancelled) setInviteNote(note);
      } catch (caught) {
        if (!cancelled) setInviteNote(caught instanceof Error ? caught.message : 'Einladung konnte nicht eingelöst werden');
      } finally {
        clearPendingInvite();
        if (!cancelled) setPendingInvite(null);
      }
    })();
    return () => { cancelled = true; };
  }, [status, profile, addFriend]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error(t('Synchronisierung ist nicht eingerichtet'));
    setBusy(true);
    try {
      const { data, error: signUpError } = await client.auth.signUp({ email, password });
      if (signUpError) throw new Error(translateAuthError(signUpError.message));
      return { needsConfirmation: !data.session };
    } finally {
      setBusy(false);
    }
  }, [client]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error(t('Synchronisierung ist nicht eingerichtet'));
    setBusy(true);
    try {
      const { error: signInError } = await client.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(translateAuthError(signInError.message));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const signOut = useCallback(async () => {
    if (!client) return;
    await client.auth.signOut();
  }, [client]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!client) throw new Error(t('Synchronisierung ist nicht eingerichtet'));
    setBusy(true);
    try {
      // Der Link fuehrt zurueck auf dieselbe Seite; Supabase haengt die
      // Wiederherstellungs-Sitzung als Anker an die Adresse.
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw new Error(translateAuthError(resetError.message));
    } finally {
      setBusy(false);
    }
  }, [client]);

  const setNewPassword = useCallback(async (password: string) => {
    if (!client) throw new Error(t('Synchronisierung ist nicht eingerichtet'));
    setBusy(true);
    try {
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError) throw new Error(translateAuthError(updateError.message));
      setRecoveryMode(false);
    } finally {
      setBusy(false);
    }
  }, [client]);

  const endRecoveryMode = useCallback(() => setRecoveryMode(false), []);

  const saveProfile = useCallback(async (
    patch: Partial<Pick<RemoteProfile, 'handle' | 'display_name' | 'emoji'>>,
  ) => {
    if (!client || !user) return;
    const next = { ...patch };
    if (next.handle) next.handle = next.handle.trim().toLowerCase().replace(/^@/, '');

    const updated = await client
      .from('profiles')
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, handle, display_name, emoji')
      .single();

    if (updated.error) {
      if (updated.error.code === '23505') throw new Error(t('Dieser Benutzername ist schon vergeben'));
      if (updated.error.code === '23514') {
        throw new Error(t('Nur Kleinbuchstaben, Ziffern, Bindestrich und Unterstrich, 3 bis 24 Zeichen'));
      }
      throw new Error(updated.error.message);
    }
    setProfile(updated.data as RemoteProfile);
  }, [client, user]);

  const syncNow = useCallback(async () => {
    setBusy(true);
    try {
      await pullAndMerge();
      await refreshFriends();
      await refreshSocial();
    } finally {
      setBusy(false);
    }
  }, [pullAndMerge, refreshFriends, refreshSocial]);

  /* ------------------------------------------------------ Push-Nachrichten */

  const [pushStatus, setPushStatus] = useState<PushState>('unsupported');

  useEffect(() => {
    void readPushState(config?.vapidPublicKey).then(setPushStatus);
  }, [config?.vapidPublicKey, user?.id]);

  const enablePush = useCallback(async (): Promise<PushState> => {
    const key = config?.vapidPublicKey;
    if (!client || !user || !key) return 'unconfigured';
    try {
      const subscription = await subscribePush(key);
      if (!subscription) {
        const next = Notification.permission === 'denied' ? 'denied' : 'off';
        setPushStatus(next);
        return next;
      }
      await client.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      });
      setPushStatus('on');
      return 'on';
    } catch {
      setPushStatus('off');
      return 'off';
    }
  }, [client, user, config?.vapidPublicKey]);

  const disablePush = useCallback(async () => {
    const endpoint = await unsubscribePush();
    if (endpoint && client && user) {
      await client.from('push_subscriptions')
        .delete().eq('user_id', user.id).eq('endpoint', endpoint);
    }
    setPushStatus('off');
  }, [client, user]);

  /**
   * Stupst die Freunde an. Fehler bleiben still: Eine Benachrichtigung, die
   * nicht ankommt, darf das Abgleichen nicht scheitern lassen.
   */
  const nudgeFriends = useCallback(async () => {
    if (!client || !user || !config?.vapidPublicKey) return;
    try {
      await client.functions.invoke('notify-friends', { body: {} });
    } catch {
      /* Ohne Edge Function passiert eben nichts. */
    }
  }, [client, user, config?.vapidPublicKey]);

  const value = useMemo<SyncValue>(() => ({
    status, user, profile, error, busy, lastSyncAt, lastMergeNote, pendingInvite, inviteNote,
    signUp, signIn, signOut, saveProfile,
    requestPasswordReset, setNewPassword, recoveryMode, endRecoveryMode,
    friends, refreshFriends, addFriend, acceptFriend, removeFriend,
    grants, setGrant, loadFriendData, friendData, syncNow,
    pushStatus, enablePush, disablePush, nudgeFriends,
    groups, challenges, reactions, comments, refreshSocial,
    createGroup: doCreateGroup, joinGroup: doJoinGroup, leaveGroup: doLeaveGroup,
    createChallenge: doCreateChallenge, joinChallenge: doJoinChallenge,
    leaveChallenge: doLeaveChallenge, deleteChallenge: doDeleteChallenge,
    react, comment, removeComment, freshActivity, schemaOutdated,
  }), [
    status, user, profile, error, busy, lastSyncAt, lastMergeNote, pendingInvite, inviteNote,
    signUp, signIn, signOut, saveProfile,
    requestPasswordReset, setNewPassword, recoveryMode, endRecoveryMode,
    friends, refreshFriends, addFriend, acceptFriend, removeFriend,
    grants, setGrant, loadFriendData, friendData, syncNow,
    pushStatus, enablePush, disablePush, nudgeFriends,
    groups, challenges, reactions, comments, refreshSocial,
    doCreateGroup, doJoinGroup, doLeaveGroup,
    doCreateChallenge, doJoinChallenge, doLeaveChallenge, doDeleteChallenge,
    react, comment, removeComment, freshActivity, schemaOutdated,
  ]);

  // config wird nur zum Aufbau gebraucht, taucht aber in der Oberflaeche als Hinweis auf.
  void config;

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('useSync muss innerhalb von <SyncProvider> verwendet werden');
  return value;
}

/** Uebersetzt die haeufigsten Meldungen von Supabase ins Deutsche. */
function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')) {
    return t('Der Server ist gerade nicht erreichbar. Prüfe die Internetverbindung – oder das Supabase-Projekt schläft und muss im Dashboard geweckt werden.');
  }
  if (lower.includes('invalid login')) return t('E-Mail oder Passwort stimmt nicht');
  if (lower.includes('already registered')) return t('Für diese E-Mail gibt es schon ein Konto');
  if (lower.includes('password should be')) return t('Das Passwort ist zu kurz (mindestens 6 Zeichen)');
  if (lower.includes('unable to validate email')) return t('Die E-Mail-Adresse sieht nicht gültig aus');
  if (lower.includes('email not confirmed')) return t('Bitte zuerst die E-Mail-Adresse bestätigen');
  if (lower.includes('rate limit')) return t('Zu viele Versuche – bitte kurz warten');
  return message;
}
