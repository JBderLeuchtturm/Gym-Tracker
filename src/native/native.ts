import { SystemBars, SystemBarsStyle, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { RELEASE_API } from './platform';

/*
 * Alles, was die App nur auf dem Handy tut.
 *
 * Wird erst geladen, wenn isNativeApp() stimmt (siehe platform.ts). Das
 * Gegenstueck auf der Android-Seite ist GymNativePlugin.java.
 */

interface GymNativePlugin {
  getLaunchTarget(): Promise<{ target?: string }>;
  updateWidgets(options: { json: string }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
  vibrate(options: { pattern: number[] }): Promise<void>;
  openExternal(options: { url: string }): Promise<void>;
  addListener(event: 'launchTarget', listener: (data: { target?: string }) => void): Promise<PluginListenerHandle>;
}

const GymNative = registerPlugin<GymNativePlugin>('GymNative');

/** Wohin ein Tipp auf ein Widget fuehrt. */
export type LaunchTarget = 'focus' | 'today' | 'goals' | 'todos';

export interface NativeHooks {
  onTarget: (target: LaunchTarget) => void;
  /** Zurueck-Taste, wenn kein Fenster offen ist. true = die App hat einen Schritt zurueckgenommen. */
  onBack: () => boolean;
}

const TARGETS: LaunchTarget[] = ['focus', 'today', 'goals', 'todos'];
const asTarget = (value: string | undefined): LaunchTarget | null =>
  TARGETS.includes(value as LaunchTarget) ? (value as LaunchTarget) : null;

export async function initNative(hooks: NativeHooks): Promise<void> {
  installShims();
  followThemeWithSystemBars();

  void App.addListener('backButton', () => handleBack(hooks));
  // Erst zuhoeren, dann nachfragen - sonst ginge ein Tipp dazwischen verloren.
  await GymNative.addListener('launchTarget', ({ target }) => {
    const known = asTarget(target);
    if (known) hooks.onTarget(known);
  });
  const { target } = await GymNative.getLaunchTarget();
  const known = asTarget(target);
  if (known) hooks.onTarget(known);
}

/**
 * Die Zurueck-Taste von Android.
 *
 * Erst schliesst sie, was obenauf liegt (Fenster, Fokus, Zirkel, grosse
 * Pausenuhr), dann geht sie zur Trainingsseite, und erst dort legt sie die
 * App in den Hintergrund - ohne sie zu beenden, damit eine laufende Pause
 * nicht verloren geht.
 */
function handleBack(hooks: NativeHooks): void {
  if (document.querySelector('.modal') || document.querySelector('.focus')) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return;
  }
  const close = document.querySelector<HTMLButtonElement>('.circuit__close, .rest-full__shrink');
  if (close) {
    close.click();
    return;
  }
  if (hooks.onBack()) return;
  void App.minimizeApp();
}

/**
 * Was die WebView nicht selbst kann, uebernimmt Android.
 *
 * navigator.wakeLock gibt es in der WebView nicht - ohne Ersatz ginge der
 * Bildschirm zwischen zwei Saetzen aus. Die Sperre verhaelt sich wie im
 * Browser: Sie faellt weg, sobald die App in den Hintergrund geht.
 */
function installShims(): void {
  const held = new Set<{ released: boolean }>();
  const releaseAll = () => {
    for (const sentinel of held) sentinel.released = true;
    held.clear();
    void GymNative.keepAwake({ on: false });
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseAll();
  });

  if (!('wakeLock' in navigator)) {
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          const sentinel = {
            released: false,
            release: async () => {
              if (sentinel.released) return;
              sentinel.released = true;
              held.delete(sentinel);
              if (held.size === 0) await GymNative.keepAwake({ on: false });
            },
          };
          held.add(sentinel);
          await GymNative.keepAwake({ on: true });
          return sentinel;
        },
      },
    });
  }

  Object.defineProperty(navigator, 'vibrate', {
    configurable: true,
    value: (pattern: number | number[]) => {
      const list = (Array.isArray(pattern) ? pattern : [pattern]).filter((value) => Number.isFinite(value));
      if (list.length > 0) void GymNative.vibrate({ pattern: list });
      return true;
    },
  });
}

/** Uhrzeit und Akku oben in der Farbe, die zum Thema passt. */
function followThemeWithSystemBars(): void {
  const apply = () => {
    const light = document.documentElement.dataset.theme === 'light';
    void SystemBars.setStyle({ style: light ? SystemBarsStyle.Light : SystemBarsStyle.Dark });
  };
  apply();
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
}

/** Neuer Stand fuer die Widgets (fertiges JSON aus lib/widgetSnapshot.ts). */
export function updateWidgets(json: string): Promise<void> {
  return GymNative.updateWidgets({ json });
}

export function openExternal(url: string): Promise<void> {
  return GymNative.openExternal({ url });
}

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/**
 * Eine Datei "herunterladen" - auf dem Handy heisst das: teilen.
 *
 * Ein Download-Link tut in der WebView nichts. Stattdessen landet die Datei
 * kurz im Zwischenspeicher der App, und der Teilen-Dialog bietet an, sie in
 * "Eigene Dateien", Drive oder einer Nachricht abzulegen.
 */
export async function saveFileNative(filename: string, blob: Blob): Promise<void> {
  const written = await Filesystem.writeFile({
    path: filename,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
  });
  try {
    await Share.share({ title: filename, files: [written.uri] });
  } catch {
    // Abgebrochen ist kein Fehler.
  }
}

export interface AppUpdateInfo {
  build: number;
  url: string;
}

/**
 * Gibt es eine neuere APK?
 *
 * Fragt das Release "app" auf GitHub ab, das der Bau bei jedem Push
 * erneuert. Ohne Netz oder bei einem Fehler: kein Hinweis, kein Aufhebens.
 */
export async function checkForUpdate(current: number): Promise<AppUpdateInfo | null> {
  try {
    const response = await fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) return null;
    const release = await response.json() as {
      name?: string;
      assets?: Array<{ name: string; browser_download_url: string }>;
    };
    const build = Number(/Build (\d+)/.exec(release.name ?? '')?.[1] ?? 0);
    const asset = release.assets?.find((item) => item.name.endsWith('.apk'));
    if (!asset || !build || build <= current) return null;
    return { build, url: asset.browser_download_url };
  } catch {
    return null;
  }
}

/** Bei jeder Rueckkehr in die App - fuer die Update-Pruefung. */
export function onResume(listener: () => void): void {
  void App.addListener('resume', listener);
}
