import type { AppState } from '../types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, SCHEMA_VERSION, createInitialState } from './defaults';

const STORAGE_KEY = 'gym-tracker:state:v1';
const BACKUP_KEY = 'gym-tracker:state:backup';

/**
 * Bittet den Browser, die Daten dauerhaft zu speichern.
 * Ohne das koennen mobile Browser gespeicherte Daten bei Speicherdruck loeschen.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/**
 * Faehrt beliebige gespeicherte Daten auf das aktuelle Schema hoch und fuellt
 * fehlende Felder auf, damit aeltere Staende die App nie zum Absturz bringen.
 */
export function migrate(raw: unknown): AppState {
  if (!isObject(raw)) return createInitialState();

  const base = createInitialState();
  const profile = isObject(raw.profile) ? raw.profile : {};
  const settings = isObject(raw.settings) ? raw.settings : {};
  const yazio = isObject(settings.yazio) ? settings.yazio : {};

  const state: AppState = {
    version: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    settingsUpdatedAt: typeof raw.settingsUpdatedAt === 'string' ? raw.settingsUpdatedAt : undefined,
    profile: { ...DEFAULT_PROFILE, ...(profile as object) },
    exercises: asArray(raw.exercises),
    plans: asArray(raw.plans),
    activePlanId: typeof raw.activePlanId === 'string' ? raw.activePlanId : null,
    workouts: asArray(raw.workouts),
    weightLog: asArray(raw.weightLog),
    measurements: asArray(raw.measurements),
    nutrition: asArray(raw.nutrition),
    goals: asArray(raw.goals),
    lastBackupAt: typeof raw.lastBackupAt === 'string' ? raw.lastBackupAt : null,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(settings as object),
      // Objekte und Listen aus alten Staenden koennen fehlen oder den falschen
      // Typ haben - dann lieber der Standard als ein Absturz beim Lesen.
      weeklySetTargets: isObject(settings.weeklySetTargets)
        ? (settings.weeklySetTargets as Record<string, number>)
        : {},
      availableEquipment: asArray<string>(settings.availableEquipment),
      plateSet: asArray<number>(settings.plateSet).filter((plate) => plate > 0).length > 0
        ? asArray<number>(settings.plateSet).filter((plate) => plate > 0)
        : DEFAULT_SETTINGS.plateSet,
      reminder: { ...DEFAULT_SETTINGS.reminder, ...(isObject(settings.reminder) ? settings.reminder : {}) },
      weather: { ...DEFAULT_SETTINGS.weather, ...(isObject(settings.weather) ? settings.weather : {}) },
      yazio: { ...DEFAULT_SETTINGS.yazio, ...(yazio as object) },
      mealPresets: asArray(settings.mealPresets),
      profileCard: {
        ...DEFAULT_SETTINGS.profileCard,
        ...(isObject(settings.profileCard) ? settings.profileCard : {}),
        // Die beiden Listen kommen aus dem Speicher und koennen alles sein.
        pinnedAchievements: asArray<string>(
          isObject(settings.profileCard) ? settings.profileCard.pinnedAchievements : [],
        ).slice(0, 4),
        favoriteExerciseIds: asArray<string>(
          isObject(settings.profileCard) ? settings.profileCard.favoriteExerciseIds : [],
        ).slice(0, 4),
      },
    },
  };

  // Ohne Plaene waere die App unbenutzbar - dann lieber den Startplan anbieten.
  if (state.plans.length === 0) {
    state.plans = base.plans;
    state.activePlanId = base.activePlanId;
  }
  if (!state.plans.some((plan) => plan.id === state.activePlanId)) {
    state.activePlanId = state.plans[0]?.id ?? null;
  }
  // Jeder Plan braucht genau 7 Tage.
  state.plans = state.plans.map((plan) => {
    const days = Array.isArray(plan.days) ? plan.days.slice(0, 7) : [];
    while (days.length < 7) {
      days.push({ weekday: days.length as 0, title: 'Ruhetag', isRestDay: true, exercises: [] });
    }
    return { ...plan, days: days.map((day, index) => ({ ...day, weekday: index as 0 })) };
  });

  return state;
}

export function loadState(): AppState {
  for (const key of [STORAGE_KEY, BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      return migrate(JSON.parse(raw));
    } catch {
      // Naechsten Schluessel probieren (defektes JSON o.ae.).
    }
  }
  return createInitialState();
}

let backupCounter = 0;

export function saveState(state: AppState): void {
  try {
    const serialized = JSON.stringify(state);
    // Vor dem Ueberschreiben gelegentlich den letzten guten Stand sichern.
    if (backupCounter % 20 === 0) {
      const previous = localStorage.getItem(STORAGE_KEY);
      if (previous) localStorage.setItem(BACKUP_KEY, previous);
    }
    backupCounter += 1;
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error('Speichern fehlgeschlagen', error);
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importState(json: string): AppState {
  return migrate(JSON.parse(json));
}

export function downloadBackup(state: AppState): void {
  const blob = new Blob([exportState(state)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
