/*
 * Laeuft die App als Android-App oder im Browser?
 *
 * Diese Datei ist absichtlich winzig und zieht nichts von Capacitor nach:
 * Die Web-App fragt hier nur nach und laedt den Rest (native.ts) erst, wenn
 * die Antwort "Android" ist. Im Browser kommt davon kein Byte an.
 */

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean };
  }
}

export const isNativeApp = (): boolean => Boolean(window.Capacitor?.isNativePlatform?.());

/** Laufnummer des APK-Baus (0 = lokal gebaut). */
export const appBuild = (): number => (typeof __APP_BUILD__ === 'number' ? __APP_BUILD__ : 0);

const REPO = 'JBderLeuchtturm/Gym-Tracker';
/** Die neueste APK - ein Link, der immer gleich bleibt. */
export const APK_URL = `https://github.com/${REPO}/releases/download/app/Gym-Tracker.apk`;
/** Dieselbe Fassung als Datensatz: Name "Gym Tracker – Build 42". */
export const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/tags/app`;
