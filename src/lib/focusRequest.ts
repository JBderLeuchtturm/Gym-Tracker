/**
 * "Oeffne die Fokus-Ansicht" - von ausserhalb der Trainingsseite.
 *
 * Ein Tipp aufs Widget "Heute-Training" startet die App und will direkt zum
 * naechsten Satz. Die Trainingsseite ist in dem Moment vielleicht noch gar
 * nicht aufgebaut; deshalb bleibt der Wunsch liegen, bis sie ihn abholt.
 */

let pending = false;
const listeners = new Set<() => void>();

export function requestFocusView(): void {
  pending = true;
  for (const listener of listeners) listener();
}

/** true, wenn ein Wunsch vorlag - er gilt damit als erledigt. */
export function consumeFocusRequest(): boolean {
  const was = pending;
  pending = false;
  return was;
}

export function onFocusRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
