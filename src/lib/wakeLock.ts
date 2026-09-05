/**
 * Bildschirm wach halten, solange ein Training laeuft.
 *
 * Zwischen zwei Saetzen vergehen zwei Minuten, in denen niemand das Handy
 * anfasst - und danach ist der Bildschirm aus und man tippt erst den Code ein,
 * bevor man den Satz abhaken kann.
 *
 * Die Sperre geht verloren, sobald der Tab in den Hintergrund geraet; deshalb
 * wird sie beim Zurueckkommen neu angefordert. Browser ohne wakeLock (Firefox
 * auf Android, aeltere Fassungen) laufen einfach ohne - die App merkt es nicht.
 */

import { useEffect } from 'react';

interface SentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    const api = (navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<SentinelLike> };
    }).wakeLock;
    if (!api) return undefined;

    let sentinel: SentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        sentinel = await api.request('screen');
      } catch {
        // Akkusparmodus oder abgelehnt - dann bleibt es beim Standardverhalten.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
