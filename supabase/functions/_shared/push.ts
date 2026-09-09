/**
 * Gemeinsamer Code für alle Edge Functions, die Web-Push verschicken.
 *
 * Vorher stand die VAPID-Signatur zweimal im Projekt, einmal je Funktion -
 * das ist jetzt hier an einer Stelle. Bewusst ohne Nutzlast ueberall: Ohne
 * Inhalt entfaellt die Verschluesselung, und beim Push-Dienst von Google
 * oder Apple landen keine Trainingsdaten. Was passiert ist, holt sich die
 * App beim Oeffnen selbst.
 */

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200): Response =>
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
export async function importPrivateKey(privateB64: string, publicB64: string): Promise<CryptoKey> {
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
export async function vapidHeader(
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

export interface VapidConfig {
  key: CryptoKey;
  publicKey: string;
  subject: string;
}

export async function loadVapidConfig(): Promise<VapidConfig | null> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:noreply@example.com';
  if (!publicKey || !privateKey) return null;
  return { key: await importPrivateKey(privateKey, publicKey), publicKey, subject };
}

/**
 * Schickt einen leeren Anstupser an ein Geraet.
 *
 * Gibt zurueck, ob es ankam, das Geraet nicht mehr existiert (404/410 - dann
 * gehoert die Adresse aufgeraeumt), oder etwas Drittes schiefging (z. B. der
 * Dienst voruebergehend nicht erreichbar - dann bleibt die Adresse stehen,
 * ein spaeterer Versuch kann klappen).
 */
export async function pushOnce(
  endpoint: string, vapid: VapidConfig,
): Promise<'sent' | 'gone' | 'other'> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(endpoint, vapid.key, vapid.publicKey, vapid.subject),
        TTL: '86400',
        // Ohne Nutzlast muss die Laenge ausdruecklich null sein.
        'Content-Length': '0',
        Urgency: 'normal',
      },
    });
    if (response.ok || response.status === 201 || response.status === 202) return 'sent';
    if (response.status === 404 || response.status === 410) return 'gone';
    return 'other';
  } catch {
    return 'other';
  }
}

/** Ein kleiner REST-Aufruf mit dem Service-Role-Schluessel - kommt an den Zeilenregeln vorbei. */
export function restClient(supabaseUrl: string, serviceKey: string) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  return {
    get: (path: string) => fetch(`${supabaseUrl}/rest/v1/${path}`, { headers }),
    post: (path: string, body: unknown, extraHeaders: Record<string, string> = {}) =>
      fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
      }),
    delete: (path: string) => fetch(`${supabaseUrl}/rest/v1/${path}`, { method: 'DELETE', headers }),
  };
}

/** Adressen loeschen, hinter denen kein Geraet mehr steckt. */
export async function cleanupGone(
  rest: ReturnType<typeof restClient>, endpoints: string[],
): Promise<void> {
  if (endpoints.length === 0) return;
  await rest.delete(
    `push_subscriptions?endpoint=in.(${endpoints.map((endpoint) => `"${endpoint}"`).join(',')})`,
  );
}
