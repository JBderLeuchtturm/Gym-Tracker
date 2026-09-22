import type { AppState, Plan, PlanDay, Profile, Settings, TodoCategory, Weekday } from '../types';

export const SCHEMA_VERSION = 1;

export const uid = (prefix = 'id'): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

export const DEFAULT_PROFILE: Profile = {
  name: '',
  sex: 'male',
  birthDate: null,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'light',
  goal: 'maintain',
  bodyFatPct: null,
};

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  restTimerSec: 120,
  weekStartsMonday: true,
  useWgerApi: true,
  weeklySetTargets: {},
  availableEquipment: [],
  partnerName: '',
  countdownBeep: true,
  barWeightKg: 20,
  plateSet: [25, 20, 15, 10, 5, 2.5, 1.25],
  keepScreenAwake: true,
  fullscreenRest: false,
  useRir: false,
  reminder: { enabled: false, time: '17:00', lastShownOn: null },
  weather: { enabled: false, lat: null, lon: null, placeName: '' },
  autoBackup: false,
  shareRank: false,
  seenRanks: {},
  profileCard: {
    emoji: '💪',
    accent: 'messing',
    bio: '',
    pinnedAchievements: [],
    favoriteExerciseIds: [],
    favoriteRankIds: [],
    showRank: true,
    showStats: true,
  },
  yazio: { bridgeUrl: '', token: '', enabled: false, lastSyncAt: null },
  mealPresets: [],
};

export const emptyDays = (): PlanDay[] =>
  ([0, 1, 2, 3, 4, 5, 6] as Weekday[]).map((weekday) => ({
    weekday,
    title: 'Ruhetag',
    isRestDay: true,
    exercises: [],
  }));

/**
 * Die Kategorien, mit denen die Aufgabenliste startet.
 *
 * Feste IDs, aus demselben Grund wie beim Startplan: Legt ein zweites Geraet
 * dieselben Kategorien an, erkennt die Synchronisierung sie als dieselben und
 * macht keine Dubletten daraus.
 *
 * Fuenf, nicht zwoelf. Eine Liste, die mit zwoelf fremden Schubladen anfaengt,
 * erzieht dazu, in fremden Schubladen zu denken; fuenf sind ein Anfang, und
 * jede weitere legt man selbst an.
 */
export const DEFAULT_TODO_CATEGORIES: TodoCategory[] = [
  { id: 'tcat_training', name: 'Training', color: 1, icon: '\u{1F3CB}\uFE0F' },
  { id: 'tcat_ernaehrung', name: 'Ernährung', color: 4, icon: '\u{1F957}' },
  { id: 'tcat_alltag', name: 'Alltag', color: 2, icon: '\u{1F3E0}' },
  { id: 'tcat_arbeit', name: 'Arbeit', color: 3, icon: '\u{1F4BC}' },
  { id: 'tcat_gesundheit', name: 'Gesundheit', color: 6, icon: '\u{1FA7A}' },
];

/** Beispielplan (Push/Pull/Legs), damit die App nicht leer startet. */
export function createStarterPlan(): Plan {
  const now = new Date().toISOString();
  const days = emptyDays();

  const set = (
    weekday: Weekday,
    title: string,
    exercises: Array<[string, number, number, number]>,
  ) => {
    days[weekday] = {
      weekday,
      title,
      isRestDay: false,
      exercises: exercises.map(([exerciseId, targetSets, repsMin, repsMax]) => ({
        id: uid('pe'),
        exerciseId,
        targetSets,
        targetRepsMin: repsMin,
        targetRepsMax: repsMax,
        targetWeightKg: null,
        restSec: 120,
      })),
    };
  };

  set(0, 'Push (Brust / Schulter / Trizeps)', [
    ['cat_barbell-bench-press', 4, 6, 10],
    ['cat_incline-dumbbell-press', 3, 8, 12],
    ['cat_overhead-press', 3, 6, 10],
    ['cat_dumbbell-lateral-raise', 3, 12, 15],
    ['cat_rope-pushdown', 3, 10, 15],
  ]);
  set(2, 'Pull (Rücken / Bizeps)', [
    ['cat_pull-up', 4, 5, 10],
    ['cat_barbell-bent-over-row', 4, 6, 10],
    ['cat_seated-cable-row', 3, 10, 12],
    ['cat_face-pull', 3, 12, 20],
    ['cat_ez-bar-curl', 3, 8, 12],
  ]);
  set(4, 'Legs (Beine / Rumpf)', [
    ['cat_barbell-back-squat', 4, 5, 8],
    ['cat_romanian-deadlift', 3, 8, 12],
    ['cat_leg-press', 3, 10, 15],
    ['cat_lying-leg-curl', 3, 10, 15],
    ['cat_standing-calf-raise', 4, 12, 20],
    ['cat_plank', 3, 0, 0],
  ]);

  return {
    // Feste ID: Legt ein zweites Geraet denselben Startplan an, erkennt die
    // Synchronisierung ihn als denselben und macht keine Kopie daraus.
    id: 'plan_starter',
    name: 'Push / Pull / Legs',
    description: 'Klassischer 3er-Split: Mo Push, Mi Pull, Fr Beine.',
    days,
    createdAt: now,
    updatedAt: now,
  };
}

export function createInitialState(): AppState {
  const plan = createStarterPlan();
  return {
    version: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    profile: { ...DEFAULT_PROFILE },
    exercises: [],
    plans: [plan],
    activePlanId: plan.id,
    workouts: [],
    weightLog: [],
    measurements: [],
    nutrition: [],
    goals: [],
    todos: [],
    todoCategories: DEFAULT_TODO_CATEGORIES.map((category) => ({ ...category })),
    lastBackupAt: null,
    settings: {
      ...DEFAULT_SETTINGS,
      plateSet: [...DEFAULT_SETTINGS.plateSet],
      reminder: { ...DEFAULT_SETTINGS.reminder },
      weather: { ...DEFAULT_SETTINGS.weather },
      yazio: { ...DEFAULT_SETTINGS.yazio },
      mealPresets: [],
    },
  };
}
