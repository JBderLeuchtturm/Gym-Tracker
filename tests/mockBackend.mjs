/**
 * Kleines Supabase-Double: bildet die Endpunkte nach, die die App benutzt,
 * inklusive der Sichtbarkeitsregeln aus supabase/schema.sql.
 * Der Zustand lebt in Node und wird von beiden Browser-Kontexten geteilt.
 */
export function createMockBackend({ log = () => {} } = {}) {
  const db = {
    users: new Map(),        // id -> {id,email,password}
    profiles: new Map(),     // id -> row
    user_state: new Map(),   // user_id -> row
    friendships: [],
    share_payloads: [],
    share_grants: [],
    groups: [],
    group_members: [],
    challenges: [],
    challenge_members: [],
    activity_reactions: [],
    activity_comments: [],
    rank_board: new Map(),   // user_id -> row
  };
  const unknown = [];

  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

  const session = (user) => ({
    access_token: `token-${user.id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${user.id}`,
    user: { id: user.id, email: user.email, aud: 'authenticated', role: 'authenticated',
            app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
  });

  const callerId = (headers) => {
    const auth = headers.authorization || headers.Authorization || '';
    const match = /token-([0-9a-f-]+)/.exec(auth);
    return match ? match[1] : null;
  };

  const areFriends = (a, b) => db.friendships.some((f) =>
    f.status === 'accepted' &&
    ((f.requester_id === a && f.addressee_id === b) || (f.requester_id === b && f.addressee_id === a)));

  const hasLink = (a, b) => db.friendships.some((f) =>
    (f.requester_id === a && f.addressee_id === b) || (f.requester_id === b && f.addressee_id === a));

  // Zwei Konten teilen eine Gruppe?
  const shareGroup = (a, b) => a !== b && db.group_members.some((ma) =>
    ma.user_id === a && db.group_members.some((mb) => mb.group_id === ma.group_id && mb.user_id === b));

  const areConnected = (a, b) => areFriends(a, b) || shareGroup(a, b);

  const myGroupIds = (me) => db.group_members.filter((m) => m.user_id === me).map((m) => m.group_id);

  /** Wertet die PostgREST-Filter aus, die die App verwendet. */
  const matches = (row, params) => {
    for (const [key, raw] of params) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key)) continue;
      if (raw.startsWith('eq.')) {
        if (String(row[key]) !== raw.slice(3)) return false;
      } else if (raw.startsWith('in.')) {
        const list = raw.slice(3).replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, ''));
        if (!list.includes(String(row[key]))) return false;
      } else {
        return false;
      }
    }
    return true;
  };

  const rowsFor = (table, me) => {
    if (table === 'profiles') {
      return [...db.profiles.values()].filter(
        (row) => row.id === me || hasLink(me, row.id) || shareGroup(me, row.id));
    }
    if (table === 'user_state') {
      return [...db.user_state.values()].filter((row) => row.user_id === me);
    }
    // Die Rangliste darf jedes angemeldete Konto lesen - das ist ihr Sinn.
    if (table === 'rank_board') {
      return [...db.rank_board.values()];
    }
    if (table === 'friendships') {
      return db.friendships.filter((row) => row.requester_id === me || row.addressee_id === me);
    }
    if (table === 'share_grants') {
      return db.share_grants.filter((row) => row.owner_id === me || row.viewer_id === me);
    }
    if (table === 'share_payloads') {
      return db.share_payloads.filter((row) =>
        row.owner_id === me ||
        (areConnected(row.owner_id, me) &&
          db.share_grants.some((g) => g.owner_id === row.owner_id && g.viewer_id === me && g.scope === row.scope)));
    }
    if (table === 'groups') {
      const mine = myGroupIds(me);
      return db.groups.filter((row) => mine.includes(row.id));
    }
    if (table === 'group_members') {
      return db.group_members.filter((row) => row.user_id === me || shareGroup(me, row.user_id));
    }
    if (table === 'challenges') {
      const mine = myGroupIds(me);
      return db.challenges.filter((row) =>
        row.owner_id === me
        || areConnected(me, row.owner_id)
        || db.challenge_members.some((m) => m.challenge_id === row.id && m.user_id === me)
        || (row.group_id && mine.includes(row.group_id)));
    }
    if (table === 'challenge_members') {
      return db.challenge_members.filter((row) => row.user_id === me || areConnected(me, row.user_id));
    }
    if (table === 'activity_reactions') {
      return db.activity_reactions.filter((row) =>
        row.owner_id === me || row.author_id === me || areConnected(me, row.owner_id));
    }
    if (table === 'activity_comments') {
      return db.activity_comments.filter((row) =>
        row.owner_id === me || row.author_id === me || areConnected(me, row.owner_id));
    }
    return [];
  };

  const project = (rows, params) => {
    const select = params.get('select');
    if (!select || select === '*') return rows;
    const fields = select.split(',').map((f) => f.trim()).filter((f) => f && f !== '*');
    return rows.map((row) => Object.fromEntries(fields.map((f) => [f, row[f]])));
  };

  const json = (body, status = 200) => ({
    status, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });

  const respondRows = (rows, headers) => {
    const wantsObject = String(headers.accept || '').includes('pgrst.object');
    if (!wantsObject) return json(rows);
    if (rows.length === 1) return json(rows[0]);
    return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned',
                  details: `Results contain ${rows.length} rows`, hint: null }, 406);
  };

  /** Beantwortet eine abgefangene Anfrage. */
  async function handle(request) {
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const headers = await request.allHeaders();
    const params = [...url.searchParams.entries()];
    const search = url.searchParams;
    let body = null;
    try { body = request.postDataJSON(); } catch { body = null; }

    log(`${method} ${path}${url.search}`);

    if (method === 'OPTIONS') {
      return { status: 204, headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      }, body: '' };
    }

    /* ------------------------------------------------------------- Auth */
    if (path === '/auth/v1/signup') {
      const existing = [...db.users.values()].find((u) => u.email === body.email);
      if (existing) return json({ error_code: 'user_already_exists', msg: 'User already registered' }, 400);
      const user = { id: uuid(), email: body.email, password: body.password };
      db.users.set(user.id, user);
      return json(session(user));
    }

    if (path === '/auth/v1/token') {
      if (search.get('grant_type') === 'refresh_token') {
        const id = /refresh-([0-9a-f-]+)/.exec(body.refresh_token ?? '')?.[1];
        const user = id && db.users.get(id);
        if (!user) return json({ error: 'invalid_grant', error_description: 'Invalid Refresh Token' }, 400);
        return json(session(user));
      }
      const user = [...db.users.values()].find((u) => u.email === body.email && u.password === body.password);
      if (!user) return json({ error: 'invalid_grant', error_description: 'Invalid login credentials' }, 400);
      return json(session(user));
    }

    if (path === '/auth/v1/user') {
      const me = callerId(headers);
      const user = me && db.users.get(me);
      if (!user) return json({ message: 'invalid claim' }, 401);
      return json(session(user).user);
    }

    if (path === '/auth/v1/logout') {
      return { status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' };
    }

    /* -------------------------------------------------------------- RPC */
    if (path === '/rest/v1/rpc/find_profile_by_handle') {
      const me = callerId(headers);
      const wanted = String(body?.p_handle ?? '').trim().toLowerCase();
      const hit = [...db.profiles.values()].find((p) => p.handle === wanted && p.id !== me);
      return json(hit ? [{ id: hit.id, handle: hit.handle, display_name: hit.display_name, emoji: hit.emoji }] : []);
    }

    if (path === '/rest/v1/rpc/find_group_by_code') {
      const wanted = String(body?.p_code ?? '').trim().toLowerCase();
      const hit = db.groups.find((g) => g.join_code === wanted);
      return json(hit ? [{
        id: hit.id, name: hit.name, emoji: hit.emoji,
        member_count: db.group_members.filter((m) => m.group_id === hit.id).length,
      }] : []);
    }

    /* ------------------------------------------------------------- REST */
    const table = path.startsWith('/rest/v1/') ? path.slice('/rest/v1/'.length) : null;
    if (table) {
      const me = callerId(headers);
      if (!me) return json({ message: 'JWT missing' }, 401);
      const prefer = String(headers.prefer || '');
      const filters = params.filter(([k]) => !['select', 'on_conflict', 'columns'].includes(k));

      if (method === 'GET') {
        const rows = rowsFor(table, me).filter((row) => matches(row, filters));
        return respondRows(project(rows, search), headers);
      }

      if (method === 'POST') {
        const incoming = Array.isArray(body) ? body : [body];
        const upsert = prefer.includes('merge-duplicates');
        const written = [];

        for (const item of incoming) {
          if (table === 'profiles') {
            if (item.id !== me) return json({ message: 'new row violates row-level security policy' }, 403);
            const taken = [...db.profiles.values()].some((p) => p.handle === item.handle && p.id !== item.id);
            if (taken) return json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
            if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(item.handle)) {
              return json({ code: '23514', message: 'violates check constraint' }, 400);
            }
            const row = {
              emoji: '💪', display_name: '', bio: '', accent: 'messing', pins: [], favorites: [],
              ...item, created_at: new Date().toISOString(),
            };
            db.profiles.set(row.id, row);
            written.push(row);
          } else if (table === 'user_state') {
            if (item.user_id !== me) return json({ message: 'row-level security' }, 403);
            db.user_state.set(item.user_id, { ...item });
            written.push({ ...item });
          } else if (table === 'rank_board') {
            if (item.user_id !== me) return json({ message: 'row-level security' }, 403);
            db.rank_board.set(item.user_id, { ...item });
            written.push({ ...item });
          } else if (table === 'share_payloads') {
            if (item.owner_id !== me) return json({ message: 'row-level security' }, 403);
            const index = db.share_payloads.findIndex((r) => r.owner_id === item.owner_id && r.scope === item.scope);
            if (index >= 0 && upsert) db.share_payloads[index] = { ...item };
            else if (index >= 0) return json({ code: '23505', message: 'duplicate key' }, 409);
            else db.share_payloads.push({ ...item });
            written.push({ ...item });
          } else if (table === 'share_grants') {
            if (item.owner_id !== me) return json({ message: 'row-level security' }, 403);
            if (!areFriends(item.owner_id, item.viewer_id)) {
              return json({ message: 'new row violates row-level security policy' }, 403);
            }
            const exists = db.share_grants.some((g) =>
              g.owner_id === item.owner_id && g.viewer_id === item.viewer_id && g.scope === item.scope);
            if (!exists) db.share_grants.push({ ...item });
            written.push({ ...item });
          } else if (table === 'friendships') {
            if (item.requester_id !== me) return json({ message: 'row-level security' }, 403);
            if (hasLink(item.requester_id, item.addressee_id)) {
              return json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
            }
            const row = { id: uuid(), status: 'pending', created_at: new Date().toISOString(), ...item };
            db.friendships.push(row);
            written.push(row);
          } else if (table === 'groups') {
            if (item.owner_id !== me) return json({ message: 'row-level security' }, 403);
            if (db.groups.some((g) => g.join_code === item.join_code)) {
              return json({ code: '23505', message: 'duplicate key' }, 409);
            }
            const row = { id: uuid(), emoji: '👥', created_at: new Date().toISOString(), ...item };
            db.groups.push(row);
            written.push(row);
          } else if (table === 'group_members') {
            if (item.user_id !== me) return json({ message: 'row-level security' }, 403);
            if (db.group_members.some((m) => m.group_id === item.group_id && m.user_id === item.user_id)) {
              return json({ code: '23505', message: 'duplicate key' }, 409);
            }
            // Trigger: alle Mitglieder geben sich gegenseitig den Fortschritt frei.
            for (const other of db.group_members.filter((m) => m.group_id === item.group_id)) {
              for (const [owner, viewer] of [[item.user_id, other.user_id], [other.user_id, item.user_id]]) {
                if (!db.share_grants.some((g) => g.owner_id === owner && g.viewer_id === viewer && g.scope === 'progress')) {
                  db.share_grants.push({ owner_id: owner, viewer_id: viewer, scope: 'progress' });
                }
              }
            }
            const row = { role: 'member', joined_at: new Date().toISOString(), ...item };
            db.group_members.push(row);
            written.push(row);
          } else if (table === 'challenges') {
            if (item.owner_id !== me) return json({ message: 'row-level security' }, 403);
            const row = { id: uuid(), group_id: null, created_at: new Date().toISOString(), ...item };
            db.challenges.push(row);
            written.push(row);
          } else if (table === 'challenge_members') {
            if (item.user_id !== me) return json({ message: 'row-level security' }, 403);
            if (db.challenge_members.some((m) => m.challenge_id === item.challenge_id && m.user_id === item.user_id)) {
              return json({ code: '23505', message: 'duplicate key' }, 409);
            }
            db.challenge_members.push({ ...item });
            written.push({ ...item });
          } else if (table === 'activity_reactions') {
            if (item.author_id !== me) return json({ message: 'row-level security' }, 403);
            if (!areConnected(me, item.owner_id)) return json({ message: 'row-level security' }, 403);
            if (db.activity_reactions.some((r) => r.owner_id === item.owner_id
              && r.activity_date === item.activity_date && r.author_id === item.author_id && r.emoji === item.emoji)) {
              return json({ code: '23505', message: 'duplicate key' }, 409);
            }
            const row = { id: uuid(), created_at: new Date().toISOString(), ...item };
            db.activity_reactions.push(row);
            written.push(row);
          } else if (table === 'activity_comments') {
            if (item.author_id !== me) return json({ message: 'row-level security' }, 403);
            if (!areConnected(me, item.owner_id)) return json({ message: 'row-level security' }, 403);
            const row = { id: uuid(), created_at: new Date().toISOString(), ...item };
            db.activity_comments.push(row);
            written.push(row);
          } else {
            unknown.push(`POST ${table}`);
            return json({ message: 'unknown table' }, 404);
          }
        }

        if (!prefer.includes('return=representation')) {
          return { status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' };
        }
        return respondRows(project(written, search), headers);
      }

      if (method === 'PATCH') {
        const target = rowsFor(table, me).filter((row) => matches(row, filters));
        const updated = [];
        for (const row of target) {
          if (table === 'profiles') {
            if (row.id !== me) continue;
            if (body.handle && [...db.profiles.values()].some((p) => p.handle === body.handle && p.id !== row.id)) {
              return json({ code: '23505', message: 'duplicate key value violates unique constraint' }, 409);
            }
            if (body.handle && !/^[a-z0-9][a-z0-9_-]{2,23}$/.test(body.handle)) {
              return json({ code: '23514', message: 'violates check constraint' }, 400);
            }
          }
          if (table === 'friendships') {
            // Nur der Angefragte darf annehmen.
            if (row.addressee_id !== me) return json({ message: 'row-level security' }, 403);
            const before = row.status;
            Object.assign(row, body);
            if (body.status === 'accepted' && before !== 'accepted') {
              for (const [owner, viewer] of [[row.requester_id, row.addressee_id], [row.addressee_id, row.requester_id]]) {
                if (!db.share_grants.some((g) => g.owner_id === owner && g.viewer_id === viewer && g.scope === 'progress')) {
                  db.share_grants.push({ owner_id: owner, viewer_id: viewer, scope: 'progress' });
                }
              }
            }
            updated.push(row);
            continue;
          }
          Object.assign(row, body);
          updated.push(row);
        }
        if (!prefer.includes('return=representation')) {
          return { status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' };
        }
        return respondRows(project(updated, search), headers);
      }

      if (method === 'DELETE') {
        if (table === 'friendships') {
          const doomed = db.friendships.filter((row) => matches(row, filters) &&
            (row.requester_id === me || row.addressee_id === me));
          for (const row of doomed) {
            db.friendships = db.friendships.filter((f) => f !== row);
            db.share_grants = db.share_grants.filter((g) =>
              !((g.owner_id === row.requester_id && g.viewer_id === row.addressee_id) ||
                (g.owner_id === row.addressee_id && g.viewer_id === row.requester_id)));
          }
        } else if (table === 'share_grants') {
          db.share_grants = db.share_grants.filter((row) => !(row.owner_id === me && matches(row, filters)));
        } else if (table === 'rank_board') {
          // Teilnahme zurueckziehen loescht die eigene Zeile.
          db.rank_board.delete(me);
        } else if (table === 'group_members') {
          const doomed = db.group_members.filter((row) => matches(row, filters) && row.user_id === me);
          for (const row of doomed) {
            db.group_members = db.group_members.filter((m) => m !== row);
            // Trigger: Freigaben zurueckziehen, sofern nicht anders begruendet.
            const others = db.group_members.filter((m) => m.group_id === row.group_id).map((m) => m.user_id);
            db.share_grants = db.share_grants.filter((g) => {
              const touched = g.scope === 'progress'
                && ((g.owner_id === row.user_id && others.includes(g.viewer_id))
                  || (g.viewer_id === row.user_id && others.includes(g.owner_id)));
              if (!touched) return true;
              return areFriends(g.owner_id, g.viewer_id) || shareGroup(g.owner_id, g.viewer_id);
            });
          }
        } else if (table === 'challenges') {
          db.challenges = db.challenges.filter((row) => !(matches(row, filters) && row.owner_id === me));
        } else if (table === 'challenge_members') {
          db.challenge_members = db.challenge_members.filter(
            (row) => !(matches(row, filters) && row.user_id === me));
        } else if (table === 'activity_reactions') {
          db.activity_reactions = db.activity_reactions.filter(
            (row) => !(matches(row, filters) && row.author_id === me));
        } else if (table === 'activity_comments') {
          db.activity_comments = db.activity_comments.filter(
            (row) => !(matches(row, filters) && (row.author_id === me || row.owner_id === me)));
        } else {
          unknown.push(`DELETE ${table}`);
        }
        return { status: 204, headers: { 'access-control-allow-origin': '*' }, body: '' };
      }
    }

    unknown.push(`${method} ${path}`);
    return json({ message: 'not mocked' }, 404);
  }

  return { db, handle, unknown };
}
