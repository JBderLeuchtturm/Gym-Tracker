/**
 * Echte Push-Nachrichten.
 *
 * Der Browser meldet sich beim Push-Dienst seines Herstellers an und gibt uns
 * eine Adresse zurueck. Die legen wir in Supabase ab; eine Edge Function
 * schickt daran spaeter eine Benachrichtigung - auch wenn die App zu ist.
 *
 * Bewusst ohne Inhalt: Es wird nur ein Anstupser verschickt, kein Text. Damit
 * entfaellt die Verschluesselung der Nutzlast, und - wichtiger - es liegen
 * keine Trainingsdaten beim Push-Dienst von Google oder Apple. Was drinsteht,
 * holt sich die App beim Oeffnen selbst.
 */

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

/** Wandelt den oeffentlichen Schluessel in das Format der Push-API. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

const encodeKey = (buffer: ArrayBuffer | null): string => {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Aktueller Stand, ohne etwas zu veraendern. */
export async function pushState(vapidPublicKey: string | undefined): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (!vapidPublicKey) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    return existing ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Meldet dieses Geraet an. Gibt die Daten zurueck, die auf dem Server
 * gespeichert werden muessen - null, wenn der Nutzer ablehnt.
 */
export async function subscribePush(vapidPublicKey: string): Promise<PushSubscriptionRow | null> {
  if (!pushSupported() || !vapidPublicKey) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  return {
    endpoint: subscription.endpoint,
    p256dh: encodeKey(subscription.getKey('p256dh')),
    auth: encodeKey(subscription.getKey('auth')),
  };
}

/** Meldet dieses Geraet wieder ab. Gibt die abgemeldete Adresse zurueck. */
export async function unsubscribePush(): Promise<string | null> {
  if (!pushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return null;
    const { endpoint } = subscription;
    await subscription.unsubscribe();
    return endpoint;
  } catch {
    return null;
  }
}
