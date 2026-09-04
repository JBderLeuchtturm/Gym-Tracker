import type { AppState, Exercise, NutritionEntry, Plan, WeightEntry, Workout } from '../types';

/**
 * Fuehrt zwei Staende desselben Kontos zusammen - etwa Handy und Rechner.
 *
 * Grundregel: nichts geht verloren. Listen werden vereinigt, und wo derselbe
 * Eintrag auf beiden Seiten existiert, gewinnt der juengere. Einzelwerte ohne
 * eigenen Zeitstempel (Profil, Einstellungen) kommen von dem Stand, der
 * insgesamt zuletzt bearbeitet wurde.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const localNewer = (local.updatedAt ?? '') >= (remote.updatedAt ?? '');
  const primary = localNewer ? local : remote;

  return {
    version: Math.max(local.version, remote.version),
    updatedAt: localNewer ? local.updatedAt : remote.updatedAt,
    profile: primary.profile,
    settings: primary.settings,
    exercises: mergeById(local.exercises, remote.exercises, (item) => item.id) as Exercise[],
    plans: mergeByKeyPreferNewer(
      local.plans, remote.plans,
      (plan) => plan.id,
      (plan) => plan.updatedAt ?? plan.createdAt ?? '',
    ) as Plan[],
    activePlanId: pickActivePlan(primary, local, remote),
    workouts: mergeByKeyPreferNewer(
      local.workouts, remote.workouts,
      (workout) => workout.date,
      (workout) => workout.updatedAt ?? workout.createdAt ?? '',
    ).sort((a, b) => a.date.localeCompare(b.date)) as Workout[],
    weightLog: mergeByKeyPreferSide(
      local.weightLog, remote.weightLog, (entry) => entry.date, localNewer,
    ).sort((a, b) => a.date.localeCompare(b.date)) as WeightEntry[],
    nutrition: mergeByKeyPreferSide(
      local.nutrition, remote.nutrition, (entry) => entry.date, localNewer,
    ).sort((a, b) => a.date.localeCompare(b.date)) as NutritionEntry[],
  };
}

/** Vereinigt zwei Listen; bei gleicher ID bleibt der Eintrag der ersten Liste. */
function mergeById<T>(first: T[], second: T[], key: (item: T) => string): T[] {
  const map = new Map<string, T>();
  for (const item of second) map.set(key(item), item);
  for (const item of first) map.set(key(item), item);
  return [...map.values()];
}

/** Vereinigt zwei Listen; bei gleichem Schluessel gewinnt der juengere Eintrag. */
function mergeByKeyPreferNewer<T>(
  first: T[], second: T[], key: (item: T) => string, stamp: (item: T) => string,
): T[] {
  const map = new Map<string, T>();
  for (const item of [...first, ...second]) {
    const id = key(item);
    const existing = map.get(id);
    if (!existing || stamp(item) > stamp(existing)) map.set(id, item);
  }
  return [...map.values()];
}

/** Vereinigt Listen ohne eigenen Zeitstempel; bei Gleichstand entscheidet die Seite. */
function mergeByKeyPreferSide<T>(
  first: T[], second: T[], key: (item: T) => string, preferFirst: boolean,
): T[] {
  const map = new Map<string, T>();
  const [low, high] = preferFirst ? [second, first] : [first, second];
  for (const item of low) map.set(key(item), item);
  for (const item of high) map.set(key(item), item);
  return [...map.values()];
}

function pickActivePlan(primary: AppState, local: AppState, remote: AppState): string | null {
  const ids = new Set([...local.plans, ...remote.plans].map((plan) => plan.id));
  if (primary.activePlanId && ids.has(primary.activePlanId)) return primary.activePlanId;
  const fallback = [local.activePlanId, remote.activePlanId].find((id) => id && ids.has(id));
  return fallback ?? null;
}

/**
 * Ist an diesem Stand ueberhaupt noch nichts passiert? Dann ist es eine frische
 * Installation, die beim Anmelden einfach den Kontostand uebernehmen soll -
 * sonst wuerde ihr leerer Startplan als zusaetzlicher Plan mitwandern.
 */
export function isPristine(state: AppState): boolean {
  const hasTraining = state.workouts.some((workout) =>
    workout.exercises.some((logged) => logged.sets.some((set) => set.done)));
  return (
    !hasTraining &&
    state.weightLog.length === 0 &&
    state.nutrition.length === 0 &&
    state.exercises.length === 0 &&
    state.plans.length <= 1 &&
    state.plans.every((plan) => plan.id === 'plan_starter')
  );
}

/** Grobe Beschreibung des Unterschieds - fuer die Rueckmeldung an den Nutzer. */
export function describeMerge(local: AppState, remote: AppState, merged: AppState): string {
  const parts: string[] = [];
  const added = merged.workouts.length - local.workouts.length;
  if (added > 0) parts.push(`${added} Training${added === 1 ? '' : 's'} dazugekommen`);
  const plans = merged.plans.length - local.plans.length;
  if (plans > 0) parts.push(`${plans} ${plans === 1 ? 'Plan' : 'Pläne'} dazugekommen`);
  const weights = merged.weightLog.length - local.weightLog.length;
  if (weights > 0) parts.push(`${weights} ${weights === 1 ? 'Gewichtseintrag' : 'Gewichtseinträge'} dazugekommen`);
  if (parts.length === 0) {
    return remote.workouts.length > 0 ? 'Alles war schon aktuell' : 'Nichts zu übernehmen';
  }
  return parts.join(', ');
}
