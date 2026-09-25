/**
 * Erkennt neue Fassungen der installierten App.
 *
 * Die Datei index.html wird immer zuerst aus dem Netz geholt, deshalb kommt
 * ein Update grundsaetzlich beim naechsten Start an. Damit es auch bemerkt
 * wird, waehrend die App offen ist, meldet sich der Service Worker hier - und
 * uebernimmt erst, wenn der Nutzer zustimmt. Ein stiller Austausch mitten im
 * Training waere die schlechtere Wahl.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export type UpdateListener = (available: boolean) => void;

let waitingWorker: ServiceWorker | null = null;
let listener: UpdateListener | null = null;

/**
 * In der Android-App gibt es keinen Service Worker: Die Dateien liegen in der
 * APK. Ein Update ist dort eine neue APK - gefunden von native.ts, hier nur
 * gemerkt, damit derselbe Hinweis-Balken erscheint.
 */
export interface AppDownload {
  build: number;
  url: string;
}
let appDownload: AppDownload | null = null;

export function onUpdateAvailable(callback: UpdateListener): () => void {
  listener = callback;
  if (waitingWorker || appDownload) callback(true);
  return () => { listener = null; };
}

export function announceAppDownload(info: AppDownload): void {
  appDownload = info;
  listener?.(true);
}

export const pendingAppDownload = (): AppDownload | null => appDownload;

/** Uebernimmt die wartende Fassung und laedt die Seite neu - oder laedt die neue APK. */
export function applyUpdate(): void {
  if (appDownload) {
    const { url } = appDownload;
    void import('../native/native').then((native) => native.openExternal(url));
    return;
  }
  if (!waitingWorker) { window.location.reload(); return; }
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(baseUrl: string): void {
  if (!('serviceWorker' in navigator)) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Nur neu laden, wenn vorher schon eine Fassung lief - beim allerersten
    // Besuch uebernimmt der Worker ohnehin, ohne dass sich etwas aendert.
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  void navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl })
    .then((registration) => {
      const announce = (worker: ServiceWorker | null) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        waitingWorker = worker;
        listener?.(true);
      };

      announce(registration.waiting);

      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') announce(installing);
        });
      });

      // Beim Zurueckkehren zur App und stuendlich nachsehen.
      const check = () => {
        if (document.visibilityState === 'visible') void registration.update();
      };
      document.addEventListener('visibilitychange', check);
      window.setInterval(check, CHECK_INTERVAL_MS);
    })
    .catch(() => {
      // Ohne Service Worker laeuft die App weiter, nur eben nicht offline.
    });
}
