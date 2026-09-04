/**
 * Stupst die Freunde an, wenn jemand trainiert hat.
 *
 * Aufruf aus der App heraus mit dem angemeldeten Konto. Die Funktion sucht die
 * verbundenen Konten, holt deren Geraeteadressen und schickt an jede einen
 * leeren Push mit VAPID-Signatur.
 *
 * Bewusst ohne Inhalt: Ohne Nutzlast entfaellt die Verschluesselung, und beim
 * Push-Dienst von Google oder Apple landen keine Trainingsdaten. Was passiert
 * ist, holt sich die App beim Oeffnen selbst.
 *
 * Einrichtung (einmalig):
 *   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:du@example.com
 *   supabase functions deploy notify-friends
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

/* ------------------------------------------------------------------- VAPID */

const base64url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64url = (value: string): Uint8Array => {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
};

/**
 * Importiert den privaten VAPID-Schluessel. Erwartet wird der rohe
 * 32-Byte-Skalar in base64url, wie ihn `web-push generate-vapid-keys` ausgibt.
 */
async function importPrivateKey(privateB64: string, publicB64: string): Promise<CryptoKey> {
  const priv = fromBase64url(privateB64);
  const pub = fromBase64url(publicB64);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error('VAPID_PUBLIC_KEY muss der unkomprimierte Punkt sein (65 Byte, beginnt mit 0x04)');
  }

  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    d: base64url(priv),
    x: base64url(pub.slice(1, 33)),
    y: base64url(pub.slice(33, 65)),
    ext: true,
  };

  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** Baut den Authorization-Header fuer einen Push-Dienst. */
async function vapidHeader(
  endpoint: string,
  key: CryptoKey,
  publicB64: string,
  subject: string,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = base64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    // Zwoelf Stunden ist das uebliche Maximum der Dienste.
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  })));

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  const jwt = `${header}.${payload}.${base64url(new Uint8Array(signature))}`;
  return `vapid t=${jwt}, k=${publicB64}`;
}

/* -------------------------------------------------------------- Hauptteil */

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json({ error: 'Nur POST' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';

  if (!supabaseUrl || !serviceKey) return json({ error: 'Projekt nicht konfiguriert' }, 500);
  if (!publicKey || !privateKey) return json({ error: 'VAPID-Schlüssel fehlen' }, 500);

  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Nicht angemeldet' }, 401);

  // Wer ruft an? Das entscheidet der Token, nicht der Aufrufer.
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: serviceKey },
  });
  if (!userResponse.ok) return json({ error: 'Nicht angemeldet' }, 401);
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return json({ error: 'Nicht angemeldet' }, 401);

  const rest = (path: string) => fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  // Angenommene Freundschaften in beide Richtungen.
  const friendsResponse = await rest(
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

  const subsResponse = await rest(
    `push_subscriptions?select=user_id,endpoint&user_id=in.(${friendIds.join(',')})`,
  );
  if (!subsResponse.ok) return json({ error: 'Abos nicht lesbar' }, 500);
  const subscriptions = await subsResponse.json() as Array<{ user_id: string; endpoint: string }>;

  const key = await importPrivateKey(privateKey, publicKey);

  let sent = 0;
  const gone: string[] = [];

  await Promise.all(subscriptions.map(async (row) => {
    try {
      const response = await fetch(row.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidHeader(row.endpoint, key, publicKey, subject),
          TTL: '86400',
          // Ohne Nutzlast muss die Laenge ausdruecklich null sein.
          'Content-Length': '0',
          Urgency: 'normal',
        },
      });
      if (response.ok || response.status === 201 || response.status === 202) {
        sent += 1;
      } else if (response.status === 404 || response.status === 410) {
        // Das Geraet gibt es nicht mehr - Adresse aufraeumen.
        gone.push(row.endpoint);
      }
    } catch {
      /* Ein nicht erreichbarer Dienst darf den Rest nicht aufhalten. */
    }
  }));

  if (gone.length > 0) {
    await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=in.(${
        gone.map((endpoint) => `"${endpoint}"`).join(',')})`,
      {
        method: 'DELETE',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      },
    );
  }

  return json({ sent, cleaned: gone.length, targets: subscriptions.length });
});
