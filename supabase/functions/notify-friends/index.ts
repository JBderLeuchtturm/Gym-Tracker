/**
 * Stupst die Freunde an, wenn jemand trainiert hat oder auf eine Aktivitaet
 * reagiert.
 *
 * Aufruf aus der App heraus mit dem angemeldeten Konto. Die Funktion sucht die
 * verbundenen Konten, holt deren Geraeteadressen und schickt an jede einen
 * leeren Push mit VAPID-Signatur. Der VAPID-Code selbst steckt in
 * "../_shared/push.ts" - "daily-nudge" braucht denselben.
 *
 * Einrichtung (einmalig):
 *   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:du@example.com
 *   supabase functions deploy notify-friends
 */

import {
  cleanupGone, json, loadVapidConfig, pushOnce, restClient, CORS,
} from '../_shared/push.ts';

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Projekt nicht konfiguriert' }, 500);

  const vapid = await loadVapidConfig();
  if (!vapid) return json({ error: 'VAPID-Schlüssel fehlen' }, 500);

  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Nicht angemeldet' }, 401);

  // Wer ruft an? Das entscheidet der Token, nicht der Aufrufer.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: serviceKey },
  });
  if (!userResponse.ok) return json({ error: 'Nicht angemeldet' }, 401);
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return json({ error: 'Nicht angemeldet' }, 401);

  const rest = restClient(supabaseUrl, serviceKey);

  // Angenommene Freundschaften in beide Richtungen.
  const friendsResponse = await rest.get(
    `friendships?select=requester_id,addressee_id&status=eq.accepted`
    + `&or=(requester_id.eq.${user.id},addressee_id.eq.${user.id})`,
  );
  if (!friendsResponse.ok) return json({ error: 'Freunde nicht lesbar' }, 500);

  const friendships = await friendsResponse.json() as Array<{
    requester_id: string; addressee_id: string;
  }>;
  const friendIds = [...new Set(friendships.map((row) => (
    row.requester_id === user.id ? row.addressee_id : row.requester_id
  )))];

  if (friendIds.length === 0) return json({ sent: 0, note: 'Keine Freunde' });

  const subsResponse = await rest.get(
    `push_subscriptions?select=user_id,endpoint&user_id=in.(${friendIds.join(',')})`,
  );
  if (!subsResponse.ok) return json({ error: 'Abos nicht lesbar' }, 500);
  const subscriptions = await subsResponse.json() as Array<{ user_id: string; endpoint: string }>;

  let sent = 0;
  const gone: string[] = [];

  await Promise.all(subscriptions.map(async (row) => {
    const outcome = await pushOnce(row.endpoint, vapid);
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'gone') gone.push(row.endpoint);
  }));

  await cleanupGone(rest, gone);

  return json({ sent, cleaned: gone.length, targets: subscriptions.length });
});
