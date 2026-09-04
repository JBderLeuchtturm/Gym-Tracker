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
      return [...db.profiles.values()].filter((row) => row.id === me || hasLink(me, row.id));
    }
    if (table === 'user_state') {
      return [...db.user_state.values()].filter((row) => row.user_id === me);
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
        (areFriends(row.owner_id, me) &&
          db.share_grants.some((g) => g.owner_id === row.owner_id && g.viewer_id === me && g.scope === row.scope)));
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
            const row = { emoji: '💪', display_name: '', ...item, created_at: new Date().toISOString() };
            db.profiles.set(row.id, row);
            written.push(row);
          } else if (table === 'user_state') {
            if (item.user_id !== me) return json({ message: 'row-level security' }, 403);
            db.user_state.set(item.user_id, { ...item });
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
