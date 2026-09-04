import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityComment, ActivityReaction, Challenge, ChallengeMetric, Group, RemoteProfile,
} from './types';

/**
 * Zugriffe auf die geselligen Teile: Gruppen, Challenges, Reaktionen und
 * Kommentare. Bewusst aus dem Provider ausgelagert, damit der uebersichtlich
 * bleibt - hier steckt nur das Reden mit der Datenbank.
 */

/** Kurzer, gut vorlesbarer Beitrittscode ohne leicht verwechselbare Zeichen. */
export function makeJoinCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let index = 0; index < 7; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export async function loadGroups(
  client: SupabaseClient,
  userId: string,
): Promise<Group[]> {
  const memberships = await client.from('group_members').select('group_id, user_id, role');
  if (memberships.error) throw new Error(memberships.error.message);

  const myGroupIds = (memberships.data ?? [])
    .filter((row) => row.user_id === userId)
    .map((row) => row.group_id);
  if (myGroupIds.length === 0) return [];

  const groups = await client
    .from('groups')
    .select('id, name, emoji, join_code, owner_id')
    .in('id', myGroupIds);
  if (groups.error) throw new Error(groups.error.message);

  const memberIds = [...new Set((memberships.data ?? []).map((row) => row.user_id))];
  const profiles = memberIds.length > 0
    ? await client.from('profiles').select('id, handle, display_name, emoji').in('id', memberIds)
    : { data: [] as RemoteProfile[], error: null };
  const byId = new Map(((profiles.data ?? []) as RemoteProfile[]).map((item) => [item.id, item]));

  return (groups.data ?? []).map((group) => {
    const members = (memberships.data ?? [])
      .filter((row) => row.group_id === group.id)
      .map((row) => {
        const info = byId.get(row.user_id);
        return {
          userId: row.user_id,
          handle: info?.handle ?? '…',
          displayName: info?.display_name || info?.handle || 'Unbekannt',
          emoji: info?.emoji || '💪',
        };
      });
    return {
      id: group.id,
      name: group.name,
      emoji: group.emoji,
      joinCode: group.join_code,
      ownerId: group.owner_id,
      memberCount: members.length,
      members,
    };
  });
}

export async function createGroup(
  client: SupabaseClient,
  userId: string,
  name: string,
  emoji: string,
): Promise<Group> {
  // Bei einer Code-Kollision einfach noch einmal versuchen.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const joinCode = makeJoinCode();
    const created = await client
      .from('groups')
      .insert({ name: name.trim(), emoji, owner_id: userId, join_code: joinCode })
      .select('id, name, emoji, join_code, owner_id')
      .single();

    if (created.error) {
      if (created.error.code === '23505') continue;
      throw new Error(created.error.message);
    }

    const joined = await client
      .from('group_members')
      .insert({ group_id: created.data.id, user_id: userId, role: 'owner' });
    if (joined.error) throw new Error(joined.error.message);

    return {
      id: created.data.id,
      name: created.data.name,
      emoji: created.data.emoji,
      joinCode: created.data.join_code,
      ownerId: userId,
      memberCount: 1,
      members: [],
    };
  }
  throw new Error('Es konnte kein freier Beitrittscode vergeben werden');
}

export async function joinGroup(
  client: SupabaseClient,
  userId: string,
  code: string,
): Promise<string> {
  const found = await client.rpc('find_group_by_code', { p_code: code.trim().toLowerCase() });
  if (found.error) throw new Error(found.error.message);
  const group = (found.data ?? [])[0] as { id: string; name: string } | undefined;
  if (!group) throw new Error(`Keine Gruppe mit dem Code „${code.trim()}" gefunden`);

  const joined = await client
    .from('group_members')
    .insert({ group_id: group.id, user_id: userId, role: 'member' });
  if (joined.error) {
    if (joined.error.code === '23505') throw new Error('Du bist schon in dieser Gruppe');
    throw new Error(joined.error.message);
  }
  return group.name;
}

export async function leaveGroup(
  client: SupabaseClient,
  userId: string,
  groupId: string,
): Promise<void> {
  const removed = await client
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (removed.error) throw new Error(removed.error.message);
}

/* ----------------------------------------------------------- Challenges */

export async function loadChallenges(client: SupabaseClient): Promise<Challenge[]> {
  const rows = await client
    .from('challenges')
    .select('id, title, metric, starts_on, ends_on, owner_id, group_id');
  if (rows.error) throw new Error(rows.error.message);

  const ids = (rows.data ?? []).map((row) => row.id);
  const members = ids.length > 0
    ? await client.from('challenge_members').select('challenge_id, user_id').in('challenge_id', ids)
    : { data: [] as Array<{ challenge_id: string; user_id: string }>, error: null };

  return (rows.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    metric: row.metric as ChallengeMetric,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    ownerId: row.owner_id,
    groupId: row.group_id,
    memberIds: (members.data ?? [])
      .filter((item) => item.challenge_id === row.id)
      .map((item) => item.user_id),
  }));
}

export async function createChallenge(
  client: SupabaseClient,
  userId: string,
  input: { title: string; metric: ChallengeMetric; startsOn: string; endsOn: string; groupId: string | null },
): Promise<void> {
  const created = await client
    .from('challenges')
    .insert({
      title: input.title.trim(),
      metric: input.metric,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      owner_id: userId,
      group_id: input.groupId,
    })
    .select('id')
    .single();
  if (created.error) throw new Error(created.error.message);

  const joined = await client
    .from('challenge_members')
    .insert({ challenge_id: created.data.id, user_id: userId });
  if (joined.error) throw new Error(joined.error.message);
}

export async function joinChallenge(
  client: SupabaseClient, userId: string, challengeId: string,
): Promise<void> {
  const joined = await client
    .from('challenge_members')
    .insert({ challenge_id: challengeId, user_id: userId });
  if (joined.error && joined.error.code !== '23505') throw new Error(joined.error.message);
}

export async function leaveChallenge(
  client: SupabaseClient, userId: string, challengeId: string,
): Promise<void> {
  await client.from('challenge_members').delete()
    .eq('challenge_id', challengeId).eq('user_id', userId);
}

export async function deleteChallenge(client: SupabaseClient, challengeId: string): Promise<void> {
  const removed = await client.from('challenges').delete().eq('id', challengeId);
  if (removed.error) throw new Error(removed.error.message);
}

/* ------------------------------------------------ Reaktionen und Kommentare */

export async function loadFeedback(client: SupabaseClient): Promise<{
  reactions: ActivityReaction[];
  comments: ActivityComment[];
}> {
  const [reactions, comments] = await Promise.all([
    client.from('activity_reactions').select('id, owner_id, activity_date, author_id, emoji'),
    client.from('activity_comments').select('id, owner_id, activity_date, author_id, body, created_at'),
  ]);
  if (reactions.error) throw new Error(reactions.error.message);
  if (comments.error) throw new Error(comments.error.message);

  return {
    reactions: (reactions.data ?? []).map((row) => ({
      id: row.id, ownerId: row.owner_id, activityDate: row.activity_date,
      authorId: row.author_id, emoji: row.emoji,
    })),
    comments: (comments.data ?? []).map((row) => ({
      id: row.id, ownerId: row.owner_id, activityDate: row.activity_date,
      authorId: row.author_id, body: row.body, createdAt: row.created_at,
    })),
  };
}

export async function toggleReaction(
  client: SupabaseClient,
  userId: string,
  ownerId: string,
  activityDate: string,
  emoji: string,
  existing: ActivityReaction | undefined,
): Promise<void> {
  if (existing) {
    const removed = await client.from('activity_reactions').delete().eq('id', existing.id);
    if (removed.error) throw new Error(removed.error.message);
    return;
  }
  const added = await client.from('activity_reactions').insert({
    owner_id: ownerId, activity_date: activityDate, author_id: userId, emoji,
  });
  if (added.error && added.error.code !== '23505') throw new Error(added.error.message);
}

export async function addComment(
  client: SupabaseClient,
  userId: string,
  ownerId: string,
  activityDate: string,
  body: string,
): Promise<void> {
  const added = await client.from('activity_comments').insert({
    owner_id: ownerId, activity_date: activityDate, author_id: userId, body: body.trim(),
  });
  if (added.error) throw new Error(added.error.message);
}

export async function deleteComment(client: SupabaseClient, id: string): Promise<void> {
  const removed = await client.from('activity_comments').delete().eq('id', id);
  if (removed.error) throw new Error(removed.error.message);
}
