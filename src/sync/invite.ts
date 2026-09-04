/**
 * Einladungslinks.
 *
 * Ein Link der Form  https://…/Gym-Tracker/#add=jan-4f2a  merkt sich den
 * Benutzernamen des Einladenden. Sobald der Eingeladene ein Konto angelegt hat,
 * geht die Freundschaftsanfrage automatisch raus - er muss also nichts
 * abtippen und nichts einrichten.
 */

const KEY = 'gym-tracker:pending-invite';
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,23}$/;

function remember(handle: string): void {
  try { localStorage.setItem(KEY, handle); } catch { /* privater Modus */ }
}

export function readPendingInvite(): string | null {
  try {
    const stored = localStorage.getItem(KEY);
    return stored && HANDLE_PATTERN.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try { localStorage.removeItem(KEY); } catch { /* egal */ }
}

/**
 * Liest eine Einladung aus der Adresszeile, merkt sie sich und raeumt den
 * Anhang wieder weg - er soll nicht dauerhaft in der Adresszeile stehen
 * bleiben oder beim Teilen erneut mitwandern.
 */
export function captureInviteFromUrl(): string | null {
  const match = /[#&]add=([A-Za-z0-9_-]{3,24})/.exec(window.location.hash);
  if (match) {
    const handle = match[1].toLowerCase();
    if (HANDLE_PATTERN.test(handle)) {
      remember(handle);
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return handle;
    }
  }
  return readPendingInvite();
}

/** Baut den Link, den man Freunden schickt. */
export function buildInviteLink(handle: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#add=${handle}`;
}
