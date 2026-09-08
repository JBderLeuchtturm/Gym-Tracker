/* Laeuft ueber tests/unit.mjs - dort wird diese Datei gebuendelt und ausgefuehrt. */
import { platesFor, describePlates } from '../src/lib/plates';
import { percentTable, roundToStep } from '../src/lib/oneRm';
import { calcBMR, calcTDEE, calcWorkoutBurn, metCalories, proteinTarget } from '../src/lib/calories';
import { fromRpe, toRpe } from '../src/lib/effort';
import { todayISO } from '../src/lib/date';
import { estimate1RM, weekdayPattern, allTimeRecords, yearReview, countsAsWork, countsAsTrained, workoutSetCount, workoutVolume } from '../src/lib/stats';
import { fatigueSignal } from '../src/lib/fatigue';
import { plannedWeeklyLoad } from '../src/lib/planVolume';
import { roundToPlate, warmupSets } from '../src/lib/coaching';
import {
  exerciseRanks, freshness, overallRank, ratioToScore, thresholdsFor, tierForScore, STANDARDS,
} from '../src/lib/ranks';
import { mergeStates } from '../src/sync/merge';
import { createInitialState } from '../src/storage/defaults';
import type { AppState, Exercise, SetLog, Workout } from '../src/types';

let failed = 0;
const results: string[] = [];

function check(label: string, fn: () => void) {
  try {
    fn();
    results.push(`  ok   ${label}`);
  } catch (error) {
    failed += 1;
    results.push(`  FAIL ${label} -> ${(error as Error).message}`);
  }
}

function eq<T>(actual: T, expected: T, note = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${note} erwartet ${JSON.stringify(expected)}, war ${JSON.stringify(actual)}`);
  }
}
function near(actual: number, expected: number, tol = 0.5) {
  if (Math.abs(actual - expected) > tol) throw new Error(`erwartet ~${expected}, war ${actual}`);
}
function truthy(value: unknown, note = '') {
  if (!value) throw new Error(note || 'erwartet wahr');
}

/* --------------------------------------------------------------- Scheiben */

check('platesFor: 82,5 kg = 25 + 5 + 1,25 je Seite', () => {
  const loaded = platesFor(82.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25]);
  truthy(loaded);
  eq(loaded!.perSide, [25, 5, 1.25]);
  eq(loaded!.offByKg, 0);
});

check('platesFor: exakt statt gierig - 60 kg mit 15 + 15', () => {
  const loaded = platesFor(60, 20, [20, 15, 10]);
  truthy(loaded);
  eq(loaded!.perSide.reduce((a, b) => a + b, 0) * 2 + 20, 60);
});

check('platesFor: unter Stangengewicht gibt nichts', () => {
  eq(platesFor(15, 20, [25, 20]), null);
});

check('describePlates: leere Seite', () => {
  eq(describePlates([]), 'nur die Stange');
  eq(describePlates([25, 5]), '25 + 5');
});

check('roundToPlate rundet auf die Stufe', () => {
  eq(roundToPlate(83, 2.5), 82.5);
  eq(roundToPlate(1, 2.5), 2.5);
});

check('warmupSets steigt an und bleibt unter dem Arbeitsgewicht', () => {
  const sets = warmupSets(100, undefined);
  truthy(sets.length >= 2);
  truthy(sets.every((set) => set.weightKg < 100));
  truthy(sets[0].weightKg < sets[sets.length - 1].weightKg);
});

/* ------------------------------------------------------------------- 1RM */

check('estimate1RM nach Epley', () => {
  near(estimate1RM(100, 1), 100);
  near(estimate1RM(80, 8), 80 * (1 + 8 / 30));
  eq(estimate1RM(0, 5), 0);
});

check('percentTable: 80 % von 100 kg, auf 2,5 gerundet', () => {
  const rows = percentTable(100, 2.5);
  const row80 = rows.find((entry) => entry.pct === 80);
  truthy(row80);
  eq(row80!.kg, 80);
});

check('roundToStep', () => {
  eq(roundToStep(81, 2.5), 80);
  eq(roundToStep(84, 2.5), 85);
});

/* -------------------------------------------------------------- Kalorien */

const male: AppState['profile'] = {
  name: '', sex: 'male', birthDate: '1990-01-01', heightCm: 180, weightKg: 80,
  activityLevel: 'moderate', goal: 'maintain', bodyFatPct: null,
};

check('calcBMR Mifflin-St-Jeor, Mann 80 kg / 180 cm', () => {
  // 10*80 + 6.25*180 - 5*Alter + 5
  const age = new Date().getFullYear() - 1990;
  near(calcBMR(male), 10 * 80 + 6.25 * 180 - 5 * age + 5, 40);
});

check('calcTDEE = BMR * Faktor', () => {
  near(calcTDEE(male), calcBMR(male) * 1.55, 1);
});

check('metCalories: MET 6, 80 kg, 30 min', () => {
  near(metCalories(6, 80, 30), 6 * 3.5 * 80 / 200 * 30, 1);
});

check('proteinTarget = Gewicht * 1,8', () => {
  eq(proteinTarget(80), 144);
});

/* ---------------------------------------------------------------- Effort */

check('RIR und RPE sind zwei Leserichtungen desselben Werts', () => {
  eq(fromRpe(8, true), 2);
  eq(fromRpe(8, false), 8);
  eq(toRpe(2, true), 8);
  eq(toRpe(2, false), 2);
  eq(fromRpe(null, true), null);
});

/* ----------------------------------------------- Statistik auf einem Stand */

function stateWith(workouts: Workout[]): AppState {
  return { ...createInitialState(), workouts };
}
function workoutOn(date: string, weight: number, reps = 8, rpe = 8): Workout {
  return {
    id: `wo_${date}`, date, title: 'Push', planId: 'plan_starter', planDayIndex: 0,
    durationMin: 60, bodyWeightKg: 80, createdAt: date, updatedAt: date,
    exercises: [{
      id: `le_${date}`, exerciseId: 'cat_barbell-bench-press',
      sets: Array.from({ length: 3 }, (_, index) => ({
        id: `s_${date}_${index}`, reps, weightKg: weight, durationSec: null, distanceKm: null,
        rpe, done: true, isWarmup: false,
      })),
    }],
  };
}

check('weekdayPattern zaehlt nur Tage mit gearbeiteten Saetzen', () => {
  const mon = '2026-09-07'; // Montag
  const wed = '2026-09-09';
  const pattern = weekdayPattern(stateWith([workoutOn(mon, 80), workoutOn(wed, 82)]));
  eq(pattern[0].workouts, 1, 'Montag');
  eq(pattern[2].workouts, 1, 'Mittwoch');
  eq(pattern[1].workouts, 0, 'Dienstag');
});

check('allTimeRecords sortiert nach geschaetztem Maximum', () => {
  const rows = allTimeRecords(
    stateWith([workoutOn('2026-08-01', 100, 5), workoutOn('2026-08-08', 60, 10)]),
    () => ({ id: 'cat_barbell-bench-press', name: 'Bankdrücken', category: 'chest', kind: 'strength',
      primaryMuscles: [], secondaryMuscles: [], equipment: [], met: 6, source: 'catalog' }) as Exercise,
  );
  truthy(rows.length === 1);
  truthy(rows[0].best.length > 0);
});

check('yearReview zaehlt Einheiten und aktive Wochen des Jahres', () => {
  const review = yearReview(
    stateWith([workoutOn('2026-03-02', 80), workoutOn('2026-03-09', 82), workoutOn('2025-11-01', 70)]),
    2026,
    () => undefined,
  );
  eq(review.workouts, 2);
  eq(review.activeWeeks, 2);
});

check('fatigueSignal: mehr Volumen und hoehere RPE = steigend', () => {
  const recent = ['2026-09-21', '2026-09-23', '2026-09-25'].map((d) => workoutOn(d, 100, 8, 9));
  const prior = ['2026-09-14', '2026-09-16', '2026-09-18'].map((d) => workoutOn(d, 60, 8, 7));
  const signal = fatigueSignal(stateWith([...prior, ...recent]), '2026-09-26');
  truthy(signal, 'ein Signal');
  truthy(signal!.level === 'rising' || signal!.level === 'high', `war ${signal!.level}`);
});

check('fatigueSignal: ohne Vorwoche kein Signal', () => {
  eq(fatigueSignal(stateWith([workoutOn('2026-09-25', 80)]), '2026-09-26'), null);
});

/* ------------------------------------------------------- Plan-Wochenvolumen */

check('plannedWeeklyLoad summiert Saetze je Region', () => {
  const state = createInitialState();
  const load = plannedWeeklyLoad(
    state.plans[0],
    (id) => (id === 'cat_barbell-bench-press'
      ? { id, name: 'Bank', category: 'chest', kind: 'strength', primaryMuscles: ['Brust groß'],
          secondaryMuscles: [], equipment: [], met: 6, source: 'catalog' } as Exercise
      : undefined),
    {},
  );
  const chest = load.find((entry) => entry.region === 'chest');
  truthy(chest && chest.sets >= 4, 'Brust bekommt mindestens die vier Sätze Bankdrücken');
});

/* ------------------------------------------------------ Ausgelassene Saetze */

/** Ein Satz mit allem, was die Rechnerei braucht. */
function set(patch: Partial<SetLog> = {}): SetLog {
  return {
    id: `s_${Math.random()}`, reps: 8, weightKg: 100, durationSec: null, distanceKm: null,
    rpe: null, done: true, isWarmup: false, ...patch,
  };
}

check('countsAsWork: ausgelassen zaehlt so wenig wie Aufwaermen', () => {
  eq(countsAsWork(set()), true, 'normaler Satz');
  eq(countsAsWork(set({ skipped: true })), false, 'ausgelassen');
  eq(countsAsWork(set({ isWarmup: true })), false, 'Aufwärmsatz');
  eq(countsAsWork(set({ done: false })), false, 'nicht abgehakt');
});

check('countsAsTrained: eine ausgelassene Uebung ist keine gemachte', () => {
  const logged = { id: 'le', exerciseId: 'cat_barbell-bench-press', sets: [set()] };
  eq(countsAsTrained(logged), true);
  eq(countsAsTrained({ ...logged, skipped: true }), false);
});

check('Volumen und Satzzahl uebergehen Ausgelassenes', () => {
  const base = workoutOn('2026-05-04', 100, 8);
  eq(workoutSetCount(base), 3, 'drei gemachte Sätze');

  const oneSkipped: Workout = { ...base, exercises: [{
    ...base.exercises[0],
    sets: base.exercises[0].sets.map((item, index) => (index === 0 ? { ...item, skipped: true } : item)),
  }] };
  eq(workoutSetCount(oneSkipped), 2, 'ein Satz ausgelassen');

  const allSkipped: Workout = { ...base, exercises: [{ ...base.exercises[0], skipped: true }] };
  eq(workoutSetCount(allSkipped), 0, 'ganze Übung ausgelassen');
  eq(workoutVolume(allSkipped), 0, 'kein Volumen');
});

check('Kalorien: ausgelassene Uebungen verbrennen nichts', () => {
  const lookup = () => ({
    id: 'cat_barbell-bench-press', name: 'Bankdrücken', category: 'chest', kind: 'strength',
    primaryMuscles: [], secondaryMuscles: [], equipment: [], met: 6, source: 'catalog',
  }) as Exercise;
  const base = workoutOn('2026-05-04', 100, 8);
  const burn = calcWorkoutBurn(base, lookup, 80);
  truthy(burn.kcal > 0, 'ein Training verbrennt etwas');
  eq(burn.perExercise.length, 1, 'eine Zeile je Übung');

  const skipped: Workout = { ...base, exercises: [{ ...base.exercises[0], skipped: true }] };
  eq(calcWorkoutBurn(skipped, lookup, 80).kcal, 0, 'ausgelassen');
  eq(calcWorkoutBurn(skipped, lookup, 80).perExercise.length, 0, 'keine Zeile');
});

/* ---------------------------------------------------------------- Raenge */

check('ratioToScore trifft die Schwellen genau', () => {
  const bench = thresholdsFor('bench', 'male')!;
  eq(bench, [0.5, 0.75, 1.25, 1.75, 2.0]);
  near(ratioToScore(0.5, bench), 20, 0.01);
  near(ratioToScore(1.25, bench), 60, 0.01);
  near(ratioToScore(1.5, bench), 70, 0.01);  // genau zwischen zwei Stufen
  near(ratioToScore(2.0, bench), 100, 0.01);
  eq(ratioToScore(0, bench), 0);
});

check('ratioToScore daempft ueber Elite und deckelt bei 120', () => {
  const bench = thresholdsFor('bench', 'male')!;
  truthy(ratioToScore(2.4, bench) > 100, 'über Elite geht es weiter');
  truthy(ratioToScore(2.4, bench) < 110, 'aber gedämpft');
  truthy(ratioToScore(20, bench) <= 120, 'gedeckelt');
});

check('tierForScore an den Grenzen', () => {
  eq(tierForScore(0), 'einsteiger');
  eq(tierForScore(19.9), 'einsteiger');
  eq(tierForScore(20), 'geuebt');
  eq(tierForScore(60), 'stark');
  eq(tierForScore(80), 'elite');
});

check('thresholdsFor: "divers" mittelt beide Tabellen', () => {
  const mixed = thresholdsFor('bench', 'diverse')!;
  near(mixed[0], (STANDARDS.bench.male[0] + STANDARDS.bench.female[0]) / 2, 0.001);
  eq(thresholdsFor('gibtesnicht', 'male'), null);
});

check('freshness: frisch zaehlt voll, alt nie unter 60 Prozent', () => {
  eq(freshness(0), 1);
  eq(freshness(28), 1);
  near(freshness(104), 0.8, 0.01);
  eq(freshness(180), 0.6);
  eq(freshness(3650), 0.6, 'auch nach zehn Jahren');
});

check('exerciseRanks: 100 kg Bankdruecken bei 80 kg sind "Stark"', () => {
  const state = stateWith([workoutOn(todayISO(), 100, 1)]);
  state.profile = { ...state.profile, weightKg: 80, sex: 'male' };
  const bench: Exercise = {
    id: 'cat_barbell-bench-press', name: 'Bankdrücken', category: 'chest', kind: 'strength',
    primaryMuscles: [], secondaryMuscles: [], equipment: [], met: 6, source: 'catalog',
  };
  const ranks = exerciseRanks(state, [bench], () => bench);
  eq(ranks.length, 1, 'eine gewertete Bewegung');
  near(ranks[0].bestKg, 100, 0.5);
  near(ranks[0].ratio, 1.25, 0.01);
  near(ranks[0].score, 60, 0.5);
  eq(ranks[0].tier, 'stark');
  eq(ranks[0].nextTier, 'elite');
  near(ranks[0].nextKg!, 160, 0.5);
});

check('exerciseRanks: ohne Koerpergewicht kein Rang', () => {
  const state = stateWith([workoutOn(todayISO(), 100, 1)]);
  state.profile = { ...state.profile, weightKg: 0 };
  eq(exerciseRanks(state, [], () => undefined).length, 0);
});

check('overallRank: untrainierte Bewegungen zaehlen als null', () => {
  const single = overallRank([{
    family: 'bench', label: 'Bankdrücken', bestKg: 100, ratio: 1.25, score: 60, tier: 'stark',
    toNext: 20, nextTier: 'elite', nextKg: 160, lastDate: todayISO(), days: 0,
  }]);
  eq(single.covered, 1);
  eq(single.total, 6);
  near(single.score, 10, 0.05);   // 60 / 6
  eq(single.tier, 'einsteiger');
  eq(overallRank([]).score, 0);
});

check('overallRank: ein alter Bestwert zaehlt weniger', () => {
  const part = {
    family: 'bench', label: 'Bankdrücken', bestKg: 100, ratio: 1.25, score: 60, tier: 'stark' as const,
    toNext: 20, nextTier: 'elite' as const, nextKg: 160, lastDate: '2020-01-01', days: 400,
  };
  near(overallRank([part]).score, 6, 0.05);  // 60 * 0,6 / 6
});

/* --------------------------------------------------------- Zusammenfuehren */

check('mergeStates: nichts geht verloren, juengeres Training gewinnt', () => {
  const a = stateWith([workoutOn('2026-01-05', 80)]);
  a.updatedAt = '2026-01-05T10:00:00Z';
  const b = stateWith([{ ...workoutOn('2026-01-05', 90), updatedAt: '2026-01-06T10:00:00Z' }, workoutOn('2026-01-12', 82)]);
  b.updatedAt = '2026-01-06T10:00:00Z';
  const merged = mergeStates(a, b);
  eq(merged.workouts.length, 2, 'beide Tage');
  const jan5 = merged.workouts.find((workout) => workout.date === '2026-01-05')!;
  eq(jan5.exercises[0].sets[0].weightKg, 90, 'der juengere Stand');
});

check('mergeStates: Einstellungen folgen ihrem eigenen Zeitstempel', () => {
  const a = stateWith([]);
  a.updatedAt = '2026-02-10T00:00:00Z';
  a.settingsUpdatedAt = '2026-02-10T00:00:00Z';
  a.settings = { ...a.settings, restTimerSec: 90 };
  const b = stateWith([]);
  b.updatedAt = '2026-02-11T00:00:00Z';
  b.settingsUpdatedAt = '2026-02-01T00:00:00Z';
  b.settings = { ...b.settings, restTimerSec: 180 };
  const merged = mergeStates(a, b);
  eq(merged.settings.restTimerSec, 90, 'die zuletzt geaenderte Einstellung');
});

export async function run(): Promise<number> {
  console.log('\n▸ unit (ohne Browser)');
  for (const line of results) console.log(line);
  console.log(failed === 0 ? '✓ Rechnerei' : `✗ Rechnerei (${failed})`);
  return failed;
}
