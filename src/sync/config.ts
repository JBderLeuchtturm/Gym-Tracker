/**
 * Zugangsdaten fuer die Synchronisierung.
 *
 * Sie stehen in public/sync-config.json und werden zur Laufzeit geladen -
 * so laesst sich das Projekt ohne neuen Build umstellen, und die Datei kann
 * direkt auf GitHub bearbeitet werden.
 *
 * Zum Ausprobieren koennen die Werte auch in der App eingegeben werden; die
 * landen dann nur im Browser dieses Geraets und haben Vorrang.
 */

export interface SyncConfig {
  url: string;
  anonKey: string;
  /**
   * Oeffentlicher VAPID-Schluessel fuer echte Push-Nachrichten.
   * Leer heisst: kein Push - die App faellt auf Meldungen zurueck, solange
   * sie offen ist. Der Schluessel ist oeffentlich; der private gehoert
   * ausschliesslich in die Supabase-Secrets.
   */
  vapidPublicKey?: string;
}

const OVERRIDE_KEY = 'gym-tracker:sync-config';

const isUsable = (config: SyncConfig | null): config is SyncConfig =>
  !!config && /^https?:\/\/.+/.test(config.url.trim()) && config.anonKey.trim().length > 20;

function readOverride(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SyncConfig;
    return isUsable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveOverride(config: SyncConfig | null): void {
  try {
    if (config) localStorage.setItem(OVERRIDE_KEY, JSON.stringify(config));
    else localStorage.removeItem(OVERRIDE_KEY);
  } catch {
    // Ohne Schreibrecht bleibt es bei der Datei - kein Grund abzubrechen.
  }
}

export const hasOverride = (): boolean => readOverride() !== null;

/** Laedt die Konfiguration; liefert null, wenn die App rein lokal laufen soll. */
export async function loadSyncConfig(): Promise<SyncConfig | null> {
  const override = readOverride();
  if (override) return override;

  try {
    const base = import.meta.env.BASE_URL || '/';
    const response = await fetch(`${base}sync-config.json`, { cache: 'no-cache' });
    if (!response.ok) return null;
    const parsed = (await response.json()) as Partial<SyncConfig>;
    const config = {
      url: (parsed.url ?? '').trim(),
      anonKey: (parsed.anonKey ?? '').trim(),
      vapidPublicKey: (parsed.vapidPublicKey ?? '').trim(),
    };
    return isUsable(config) ? config : null;
  } catch {
    return null;
  }
}
