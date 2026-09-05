import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import type {
  AppState, Exercise, ExerciseGoal, ID, MeasurementEntry, NutritionEntry, Plan, Profile, Settings,
  Workout,
} from '../types';
import { CATALOG } from '../data/catalog';
import { loadState, requestPersistence, saveState } from './db';
import { uid } from './defaults';

interface StoreValue {
  state: AppState;
  /** Katalog + eigene/importierte Uebungen, nach Namen sortiert. */
  allExercises: Exercise[];
  getExercise: (id: ID) => Exercise | undefined;
  updateProfile: (patch: Partial<Profile>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  logBodyWeight: (date: string, kg: number) => void;
  removeBodyWeight: (date: string) => void;
  logMeasurement: (entry: MeasurementEntry) => void;
  removeMeasurement: (date: string) => void;
  addExercise: (exercise: Exercise) => Exercise;
  updateExercise: (id: ID, patch: Partial<Exercise>) => void;
  deleteExercise: (id: ID) => void;
  addPlan: (plan: Plan) => void;
  updatePlan: (id: ID, updater: (plan: Plan) => Plan) => void;
  deletePlan: (id: ID) => void;
  setActivePlan: (id: ID) => void;
  upsertWorkout: (date: string, updater: (workout: Workout) => Workout) => void;
  deleteWorkout: (id: ID) => void;
  setNutrition: (entry: NutritionEntry) => void;
  addGoal: (goal: ExerciseGoal) => void;
  deleteGoal: (id: ID) => void;
  replaceState: (next: AppState) => void;
  /** Der aktuelle Stand als Kopie - Grundlage fuer "Rueckgaengig". */
  snapshot: () => AppState;
  lastSavedAt: number | null;
}

const StoreContext = createContext<StoreValue | null>(null);

const emptyWorkout = (date: string): Workout => ({
  id: uid('wo'),
  date,
  title: '',
  exercises: [],
  durationMin: null,
  bodyWeightKg: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  /**
   * Jede Aenderung bekommt einen Zeitstempel. Daran erkennt die
   * Synchronisierung, welcher von zwei Geraetestaenden der juengere ist.
   */
  const commit = useCallback((updater: (prev: AppState) => AppState) => {
    setState((prev) => {
      const next = updater(prev);
      return next === prev ? prev : { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);
  const saveTimer = useRef<number | null>(null);

  /* Immer der aktuelle Stand - fuer "Rueckgaengig", ohne Abhaengigkeitsketten. */
  const stateRef = useRef(state);
  stateRef.current = state;

  // Schreiben wird gebuendelt, damit schnelles Tippen nicht bei jedem Zeichen speichert.
  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveState(state);
      setLastSavedAt(Date.now());
    }, 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [state]);

  // Beim Verlassen der Seite sofort sichern - sonst geht die letzte Aenderung verloren.
  useEffect(() => {
    const flush = () => saveState(state);
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state]);

  useEffect(() => {
    void requestPersistence();
  }, []);

  const allExercises = useMemo(() => {
    const custom = state.exercises;
    const customIds = new Set(custom.map((e) => e.id));
    const merged = [...custom, ...CATALOG.filter((e) => !customIds.has(e.id))];
    return merged.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [state.exercises]);

  const exerciseIndex = useMemo(() => {
    const map = new Map<ID, Exercise>();
    for (const exercise of allExercises) map.set(exercise.id, exercise);
    return map;
  }, [allExercises]);

  const getExercise = useCallback((id: ID) => exerciseIndex.get(id), [exerciseIndex]);

  /* Profil und Einstellungen tragen einen eigenen Zeitstempel - siehe AppState. */
  const updateProfile = useCallback((patch: Partial<Profile>) => {
    commit((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...patch },
      settingsUpdatedAt: new Date().toISOString(),
    }));
  }, [commit]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    commit((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
      settingsUpdatedAt: new Date().toISOString(),
    }));
  }, [commit]);

  const logBodyWeight = useCallback((date: string, kg: number) => {
    commit((prev) => {
      const rest = prev.weightLog.filter((entry) => entry.date !== date);
      const weightLog = [...rest, { date, kg }].sort((a, b) => a.date.localeCompare(b.date));
      // Das Profilgewicht folgt immer dem juengsten Eintrag.
      const latest = weightLog[weightLog.length - 1];
      return { ...prev, weightLog, profile: { ...prev.profile, weightKg: latest.kg } };
    });
  }, [commit]);

  const removeBodyWeight = useCallback((date: string) => {
    commit((prev) => ({
      ...prev,
      weightLog: prev.weightLog.filter((entry) => entry.date !== date),
    }));
  }, [commit]);

  const logMeasurement = useCallback((entry: MeasurementEntry) => {
    commit((prev) => {
      const rest = (prev.measurements ?? []).filter((item) => item.date !== entry.date);
      return {
        ...prev,
        measurements: [...rest, entry].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  }, [commit]);

  const removeMeasurement = useCallback((date: string) => {
    commit((prev) => ({
      ...prev,
      measurements: (prev.measurements ?? []).filter((entry) => entry.date !== date),
    }));
  }, [commit]);

  const addExercise = useCallback((exercise: Exercise) => {
    commit((prev) => {
      if (prev.exercises.some((e) => e.id === exercise.id)) return prev;
      return { ...prev, exercises: [...prev.exercises, exercise] };
    });
    return exercise;
  }, [commit]);

  const updateExercise = useCallback((id: ID, patch: Partial<Exercise>) => {
    commit((prev) => {
      const existing = prev.exercises.find((e) => e.id === id);
      if (existing) {
        return {
          ...prev,
          exercises: prev.exercises.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        };
      }
      // Katalogeintrag bearbeiten: als eigene Kopie unter derselben ID ablegen.
      const fromCatalog = CATALOG.find((e) => e.id === id);
      if (!fromCatalog) return prev;
      return { ...prev, exercises: [...prev.exercises, { ...fromCatalog, ...patch }] };
    });
  }, [commit]);

  const deleteExercise = useCallback((id: ID) => {
    commit((prev) => ({ ...prev, exercises: prev.exercises.filter((e) => e.id !== id) }));
  }, [commit]);

  const addPlan = useCallback((plan: Plan) => {
    commit((prev) => ({ ...prev, plans: [...prev.plans, plan], activePlanId: plan.id }));
  }, [commit]);

  const updatePlan = useCallback((id: ID, updater: (plan: Plan) => Plan) => {
    commit((prev) => ({
      ...prev,
      plans: prev.plans.map((plan) =>
        plan.id === id ? { ...updater(plan), updatedAt: new Date().toISOString() } : plan,
      ),
    }));
  }, [commit]);

  const deletePlan = useCallback((id: ID) => {
    commit((prev) => {
      const plans = prev.plans.filter((plan) => plan.id !== id);
      const activePlanId = prev.activePlanId === id ? (plans[0]?.id ?? null) : prev.activePlanId;
      return { ...prev, plans, activePlanId };
    });
  }, [commit]);

  const setActivePlan = useCallback((id: ID) => {
    commit((prev) => ({ ...prev, activePlanId: id }));
  }, [commit]);

  const upsertWorkout = useCallback((date: string, updater: (workout: Workout) => Workout) => {
    commit((prev) => {
      const existing = prev.workouts.find((workout) => workout.date === date);
      const next = { ...updater(existing ?? emptyWorkout(date)), updatedAt: new Date().toISOString() };
      const workouts = existing
        ? prev.workouts.map((workout) => (workout.date === date ? next : workout))
        : [...prev.workouts, next];
      workouts.sort((a, b) => a.date.localeCompare(b.date));
      return { ...prev, workouts };
    });
  }, [commit]);

  const deleteWorkout = useCallback((id: ID) => {
    commit((prev) => ({ ...prev, workouts: prev.workouts.filter((w) => w.id !== id) }));
  }, [commit]);

  const setNutrition = useCallback((entry: NutritionEntry) => {
    commit((prev) => {
      const rest = prev.nutrition.filter((item) => item.date !== entry.date);
      return { ...prev, nutrition: [...rest, entry].sort((a, b) => a.date.localeCompare(b.date)) };
    });
  }, [commit]);

  const addGoal = useCallback((goal: ExerciseGoal) => {
    commit((prev) => ({
      ...prev,
      // Ein Ziel je Uebung und Groesse - zwei waeren nur verwirrend.
      goals: [
        ...(prev.goals ?? []).filter(
          (item) => !(item.exerciseId === goal.exerciseId && item.metric === goal.metric),
        ),
        goal,
      ],
    }));
  }, [commit]);

  const deleteGoal = useCallback((id: ID) => {
    commit((prev) => ({ ...prev, goals: (prev.goals ?? []).filter((goal) => goal.id !== id) }));
  }, [commit]);

  const replaceState = useCallback((next: AppState) => setState(next), []);

  /*
   * Fuer "Rueckgaengig" wird der ganze Stand festgehalten und im Fall der
   * Faelle wieder eingesetzt. Das ist grob, aber ehrlich: Es gibt kein
   * halbes Zuruecknehmen, bei dem hinterher unklar waere, was gilt.
   */
  const snapshot = useCallback(() => stateRef.current, []);

  const value = useMemo<StoreValue>(
    () => ({
      state, allExercises, getExercise, updateProfile, updateSettings, logBodyWeight,
      removeBodyWeight, logMeasurement, removeMeasurement,
      addExercise, updateExercise, deleteExercise, addPlan, updatePlan,
      deletePlan, setActivePlan, upsertWorkout, deleteWorkout, setNutrition, addGoal, deleteGoal,
      replaceState, snapshot, lastSavedAt,
    }),
    [
      state, allExercises, getExercise, updateProfile, updateSettings, logBodyWeight,
      removeBodyWeight, logMeasurement, removeMeasurement,
      addExercise, updateExercise, deleteExercise, addPlan, updatePlan,
      deletePlan, setActivePlan, upsertWorkout, deleteWorkout, setNutrition, addGoal, deleteGoal,
      replaceState, snapshot, lastSavedAt,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore muss innerhalb von <StoreProvider> verwendet werden');
  return value;
}
