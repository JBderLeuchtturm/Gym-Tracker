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
  DECAY_END_DAYS, DECAY_FLOOR, GRACE_DAYS, RANKED_FAMILIES, STANDARDS, TIERS,
  daysUntilNextDrop, exerciseFactor, exerciseRanks, familyRanks, freshness, nextSteps,
  overallRank, rankDistance, rankOf, rankSnapshot, rankTimeline, ratioToScore,
  thresholdsFor, tierCounts, tierForScore, tierProgress,
} from '../src/lib/ranks';
import { achievements, byGroup, earnedCount } from '../src/lib/achievements';
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

check('ratioToScore trifft die Eintrittsschwellen genau', () => {
  // Sechs Eintrittswerte: Bronze ab null, danach die fuenf Tabellenwerte.
  const bench = thresholdsFor('bench', 'male')!;
  eq(bench.length, 6);
  eq(bench, [0, 0.5, 0.75, 1.25, 1.75, 2.0]);

  near(ratioToScore(0, bench), 0, 0.01, 'Bronze faengt bei null an');
  near(ratioToScore(0.5, bench), 20, 0.01, 'Silber');
  near(ratioToScore(0.75, bench), 40, 0.01, 'Gold');
  near(ratioToScore(1.25, bench), 60, 0.01, 'Diamant');
  near(ratioToScore(1.75, bench), 75, 0.01, 'Emerald');
  near(ratioToScore(2.0, bench), 90, 0.01, 'Elite');
  // Genau zwischen zwei Schwellen liegt man in der Mitte der Punktespanne.
  near(ratioToScore(0.625, bench), 30, 0.01);
});

check('ratioToScore daempft ueber Elite und deckelt bei 120', () => {
  const bench = thresholdsFor('bench', 'male')!;
  truthy(ratioToScore(2.1, bench) > 90, 'über Elite geht es weiter');
  truthy(ratioToScore(2.1, bench) < 100, 'aber langsam');
  truthy(ratioToScore(20, bench) <= 120, 'gedeckelt');
});

check('thresholdsFor: "divers" mittelt beide Tabellen', () => {
  const mixed = thresholdsFor('bench', 'diverse')!;
  near(mixed[1], (STANDARDS.bench.male[0] + STANDARDS.bench.female[0]) / 2, 0.001);
  eq(thresholdsFor('gibtesnicht', 'male'), null);
  // Ein Faktor skaliert alle Schwellen mit.
  near(thresholdsFor('bench', 'male', 0.85)![1], STANDARDS.bench.male[0] * 0.85, 0.001);
});

/** Eine Bank und ein Stand, in dem sie mit dem gegebenen Gewicht steht. */
const benchExercise: Exercise = {
  id: 'cat_barbell-bench-press', name: 'Bankdrücken', category: 'chest', kind: 'strength',
  primaryMuscles: [], secondaryMuscles: [], equipment: [], met: 6, source: 'catalog',
};
function rankState(weightKg: number): AppState {
  const state = stateWith([workoutOn(todayISO(), weightKg, 1)]);
  state.profile = { ...state.profile, weightKg: 80, sex: 'male' };
  return state;
}

/* -------------------------------------------------- Raenge zum Weitermachen */

check('tierProgress misst den Weg durch die eigene Stufe', () => {
  const start = tierProgress(20);   // genau auf der Schwelle zu "Silber"
  eq(start.tier, 'silber');
  eq(start.nextTier, 'gold');
  near(start.share, 0, 0.001);
  near(start.toNext!, 20, 0.001);

  const half = tierProgress(30);    // Mitte zwischen 20 und 40
  near(half.share, 0.5, 0.001);
  near(half.toNext!, 10, 0.001);

  const top = tierProgress(95);
  eq(top.tier, 'elite');
  eq(top.nextTier, null);
  eq(top.toNext, null);
});

/* --------------------------------------------------- Stufen und Divisionen */

check('Sechs Stufen in der Reihenfolge von Bronze bis Elite', () => {
  eq(TIERS, ['bronze', 'silber', 'gold', 'diamant', 'emerald', 'elite']);
  eq(tierForScore(0), 'bronze');
  eq(tierForScore(19.9), 'bronze');
  eq(tierForScore(20), 'silber');
  eq(tierForScore(40), 'gold');
  eq(tierForScore(60), 'diamant');
  eq(tierForScore(75), 'emerald');
  eq(tierForScore(90), 'elite');
  eq(tierForScore(100), 'elite');
});

check('rankOf teilt jede Stufe in drei Divisionen', () => {
  // Bronze spannt 0 bis 20, also je Division knapp sieben Punkte.
  eq(rankOf(0).label, 'Bronze I');
  eq(rankOf(6).label, 'Bronze I');
  eq(rankOf(7).label, 'Bronze II');
  eq(rankOf(14).label, 'Bronze III');
  eq(rankOf(20).label, 'Silber I');
  // Elite spannt nur zehn Punkte.
  eq(rankOf(90).label, 'Elite I');
  eq(rankOf(97).label, 'Elite III');
  eq(rankOf(100).label, 'Elite III');
});

check('rankOf: der Anteil laeuft je Division von null bis eins', () => {
  const low = rankOf(0);
  near(low.share, 0, 0.01);
  truthy(low.toNext! > 0, 'es geht weiter');
  const top = rankOf(100);
  eq(top.toNext, null, 'ganz oben geht nichts mehr');
});

check('rankDistance zaehlt Divisionen, nicht Stufen', () => {
  eq(rankDistance(rankOf(0), rankOf(7)), 1, 'eine Division');
  eq(rankDistance(rankOf(0), rankOf(20)), 3, 'eine ganze Stufe sind drei');
  eq(rankDistance(rankOf(20), rankOf(0)), -3, 'abwärts zählt negativ');
  eq(rankDistance(rankOf(5), rankOf(6)), 0, 'dieselbe Division');
});

/* ---------------------------------------------------------------- Verfall */

check('freshness: Schonfrist, dann Verfall bis auf einen Boden', () => {
  eq(freshness(0), 1);
  eq(freshness(GRACE_DAYS), 1, 'am letzten Tag der Schonfrist noch voll');
  truthy(freshness(GRACE_DAYS + 1) < 1, 'danach faellt es');
  eq(freshness(DECAY_END_DAYS), DECAY_FLOOR);
  eq(freshness(3650), DECAY_FLOOR, 'tiefer geht es nie');
  // In der Mitte genau die Haelfte des Verlusts.
  near(freshness((GRACE_DAYS + DECAY_END_DAYS) / 2), 1 - (1 - DECAY_FLOOR) / 2, 0.01);
});

check('daysUntilNextDrop sagt, wann es weiter faellt', () => {
  eq(daysUntilNextDrop(0, 80), GRACE_DAYS + 1, 'in der Schonfrist sagt es, wann es losgeht');
  truthy((daysUntilNextDrop(100, 80) ?? 0) > 0, 'danach schon');
  eq(daysUntilNextDrop(DECAY_END_DAYS, 80), null, 'am Boden faellt nichts mehr');
  eq(daysUntilNextDrop(100, 0), null, 'ohne Punkte auch nicht');
});

check('Der Verfall steckt im Rang der Uebung, nicht erst im Gesamtrang', () => {
  const state = rankState(100);
  state.workouts = [{ ...workoutOn('2020-01-01', 100, 1), bodyWeightKg: 80 }];
  const [old] = exerciseRanks(state, [benchExercise], () => benchExercise);
  const [fresh] = exerciseRanks(rankState(100), [benchExercise], () => benchExercise);

  near(old.rawScore, fresh.rawScore, 0.1, 'dieselbe Leistung');
  truthy(old.score < fresh.score, `${old.score} sollte unter ${fresh.score} liegen`);
  near(old.freshness, DECAY_FLOOR, 0.01, 'nach Jahren am Boden');
  near(old.decayLoss, old.rawScore - old.score, 0.05);
  truthy(fresh.decayLoss === 0, 'frisch kostet nichts');
  // Und der Rang faellt sichtbar mit.
  truthy(TIERS.indexOf(old.tier) < TIERS.indexOf(fresh.tier), `${old.tier} vs ${fresh.tier}`);
});

check('Wer nach der Pause wieder trainiert, holt den Rang zurueck', () => {
  const state = rankState(100);
  state.workouts = [
    { ...workoutOn('2020-01-01', 100, 1), bodyWeightKg: 80 },
    { ...workoutOn(todayISO(), 100, 1), bodyWeightKg: 80 },
  ];
  const [entry] = exerciseRanks(state, [benchExercise], () => benchExercise);
  eq(entry.decayLoss, 0, 'der frische Satz zählt wieder voll');
});

check('Einundzwanzig Bewegungen haben einen Standard', () => {
  eq(RANKED_FAMILIES.length, 21);
  for (const family of RANKED_FAMILIES) {
    const standard = STANDARDS[family];
    truthy(standard.weight > 0, `${family} ohne Gewicht`);
    // Die Schwellen muessen aufsteigen - sonst waere eine Stufe unerreichbar.
    for (let index = 1; index < 5; index += 1) {
      truthy(standard.male[index] > standard.male[index - 1], `${family} maennlich Stufe ${index}`);
      truthy(standard.female[index] > standard.female[index - 1], `${family} weiblich Stufe ${index}`);
    }
  }
});

check('Die drei Grunduebungen wiegen am schwersten', () => {
  for (const family of ['bench', 'squat', 'deadlift']) eq(STANDARDS[family].weight, 1);
  for (const family of ['ohp', 'row', 'pulldown']) eq(STANDARDS[family].weight, 0.75);
  truthy(STANDARDS.raise.weight < 0.5, 'Seitheben ist Beiwerk');
});

check('exerciseFactor kennt die Spielarten', () => {
  const make = (name: string): Exercise => ({
    id: 'x', name, category: 'chest', kind: 'strength', primaryMuscles: [],
    secondaryMuscles: [], equipment: [], met: 6, source: 'catalog',
  });
  near(exerciseFactor(make('Schrägbankdrücken (Langhantel)')), 0.85, 0.001);
  near(exerciseFactor(make('Frontkniebeuge')), 0.8, 0.001);
  near(exerciseFactor(make('Handstand-Liegestütze')), 0.35, 0.001);
  near(exerciseFactor(make('Bankdrücken (Langhantel)')), 1, 0.001);
});

check('exerciseRanks: 100 kg Bankdruecken bei 80 kg sind "Diamant"', () => {
  const ranks = exerciseRanks(rankState(100), [benchExercise], () => benchExercise);
  eq(ranks.length, 1, 'eine Übung');
  near(ranks[0].best, 100, 0.5);
  near(ranks[0].ratio, 1.25, 0.01);
  near(ranks[0].score, 60, 0.5);
  eq(ranks[0].tier, 'diamant');
  eq(ranks[0].nextTier, 'emerald');
  near(ranks[0].nextValue!, 140, 0.5, 'Emerald = 1,75 × 80 kg');
  eq(ranks[0].personal, false);
  eq(ranks[0].thresholds.length, 6, 'sechs Schwellen in Kilogramm');
  eq(ranks[0].thresholds[0], 0, 'Bronze gibt es ab dem ersten Satz');
  near(ranks[0].thresholds[1], 40, 0.5, 'Silber = 0,5 × 80 kg');
});

check('Die Spielart verschiebt die Schwellen der Uebung', () => {
  const incline: Exercise = { ...benchExercise, id: 'cat_incline', name: 'Schrägbankdrücken (Langhantel)' };
  const state = rankState(100);
  state.workouts = [{ ...workoutOn(todayISO(), 100, 1), exercises: [{
    id: 'le', exerciseId: 'cat_incline',
    sets: [{ id: 's', reps: 1, weightKg: 100, durationSec: null, distanceKm: null,
      rpe: null, done: true, isWarmup: false }],
  }] }];
  const ranks = exerciseRanks(state, [incline], () => incline);
  eq(ranks.length, 1);
  eq(ranks[0].family, 'bench', 'gehört zum Bankdrücken');
  // 0,85 × 40 = 34 kg statt 40 kg fuer Silber.
  near(ranks[0].thresholds[1], 34, 0.5);
  truthy(ranks[0].score > 60, `mit Faktor mehr Punkte: ${ranks[0].score}`);
});

check('Koerpergewichtsuebungen zaehlen die Gesamtlast', () => {
  const pullup: Exercise = {
    id: 'cat_pull-up', name: 'Klimmzüge (Obergriff)', category: 'back', kind: 'bodyweight',
    primaryMuscles: [], secondaryMuscles: [], equipment: [], met: 8, source: 'catalog',
  };
  const state = createInitialState();
  state.profile = { ...state.profile, weightKg: 80, sex: 'male' };
  state.workouts = [{ ...workoutOn(todayISO(), 0, 1), exercises: [{
    id: 'le', exerciseId: 'cat_pull-up',
    sets: [{ id: 's', reps: 1, weightKg: 0, durationSec: null, distanceKm: null,
      rpe: null, done: true, isWarmup: false }],
  }] }];
  const ranks = exerciseRanks(state, [pullup], () => pullup);
  eq(ranks.length, 1);
  eq(ranks[0].basis, 'bodyload');
  // Ein Klimmzug ohne Zusatz ist genau das eigene Gewicht - nicht null.
  near(ranks[0].best, 80, 1);
  near(ranks[0].ratio, 1, 0.02);
});

check('Ohne Standard zaehlt der eigene Verlauf', () => {
  const crunch: Exercise = {
    id: 'cat_crunch', name: 'Crunches', category: 'core', kind: 'bodyweight',
    primaryMuscles: [], secondaryMuscles: [], equipment: [], met: 3, source: 'catalog',
  };
  const state = createInitialState();
  state.profile = { ...state.profile, weightKg: 80 };
  const day = (date: string, reps: number): Workout => ({
    ...workoutOn(date, 0, reps),
    exercises: [{ id: `le_${date}`, exerciseId: 'cat_crunch', sets: [{
      id: `s_${date}`, reps, weightKg: null, durationSec: null, distanceKm: null,
      rpe: null, done: true, isWarmup: false,
    }] }],
  });
  state.workouts = [day('2026-01-05', 10), day('2026-02-05', 15), day('2026-03-05', 20)];
  const ranks = exerciseRanks(state, [crunch], () => crunch);
  eq(ranks.length, 1);
  eq(ranks[0].personal, true, 'aus dem eigenen Verlauf');
  eq(ranks[0].thresholds.length, 0, 'keine Schwellen aus einer Tabelle');
  truthy(ranks[0].score > 0, `Punkte: ${ranks[0].score}`);
});

check('familyRanks nimmt die staerkste Uebung, nicht den Schnitt', () => {
  const incline: Exercise = { ...benchExercise, id: 'cat_incline', name: 'Schrägbankdrücken (Langhantel)' };
  const state = rankState(100);
  state.workouts = [
    { ...workoutOn('2026-05-01', 100, 1) },
    { ...workoutOn('2026-05-08', 100, 1), exercises: [{
      id: 'le2', exerciseId: 'cat_incline',
      sets: [{ id: 's2', reps: 1, weightKg: 40, durationSec: null, distanceKm: null,
        rpe: null, done: true, isWarmup: false }],
    }] },
  ];
  const lookup = (id: string) => (id === 'cat_incline' ? incline : benchExercise);
  const exercises = exerciseRanks(state, [benchExercise, incline], lookup);
  const families = familyRanks(exercises);
  const bench = families.find((rank) => rank.family === 'bench')!;
  eq(bench.exercises, 2, 'beide Übungen in der Gruppe');
  eq(bench.bestExerciseId, 'cat_barbell-bench-press', 'die stärkere trägt den Rang');
  near(bench.score, Math.max(...exercises.map((entry) => entry.score)), 0.01);
});

check('overallRank: Tiefe mal Breite', () => {
  const empty = overallRank([]);
  eq(empty.score, 0);
  eq(empty.covered, 0);
  eq(empty.total, 21);

  const ranks = exerciseRanks(rankState(100), [benchExercise], () => benchExercise);
  const overall = overallRank(familyRanks(ranks));
  eq(overall.covered, 1);
  near(overall.depth, 60, 0.5, 'die Tiefe ist der Wert der einen Bewegung');
  truthy(overall.breadthFactor > 0.35 && overall.breadthFactor < 0.6,
    `Breite bei einer von einundzwanzig: ${overall.breadthFactor}`);
  near(overall.score, overall.depth * overall.breadthFactor, 0.2);
});

check('overallRank: mehr Breite bringt mehr Punkte bei gleicher Tiefe', () => {
  const part = (family: string, weight: number) => ({
    family, label: family, basis: 'load' as const, best: 100, ratio: 1.25,
    rawScore: 60, score: 60, decayLoss: 0, freshness: 1, dropsInDays: null,
    rank: rankOf(60), tier: 'diamant' as const, nextTier: 'emerald' as const,
    nextValue: 160, thresholds: [], lastDate: todayISO(), days: 0, sessions: 3,
    personal: false, bestExerciseId: null, bestExerciseName: '', exercises: 1, weight,
  });
  const one = overallRank([part('bench', 1)]);
  const three = overallRank([part('bench', 1), part('squat', 1), part('deadlift', 1)]);
  near(one.depth, three.depth, 0.01, 'dieselbe Tiefe');
  truthy(three.score > one.score, `${three.score} sollte über ${one.score} liegen`);
});

check('nextSteps stellt Unberuehrtes nach vorn und rechnet den Gewinn', () => {
  const snapshot = rankSnapshot(rankState(100), [benchExercise], () => benchExercise);
  const steps = nextSteps(snapshot, 80, 'male', 3);
  eq(steps.length, 3);
  truthy(steps[0].untouched, 'zuerst etwas ohne Eintrag');
  truthy(steps.every((step) => step.gainPoints > 0), 'jeder Schritt bringt Punkte');
  // Die Grunduebungen bringen mehr als Beiwerk.
  truthy(['squat', 'deadlift'].includes(steps[0].family), `war ${steps[0].family}`);
});

check('nextSteps ohne Koerpergewicht gibt nichts', () => {
  eq(nextSteps({ exercises: [], families: [], overall: overallRank([]) }, 0, 'male').length, 0);
});

check('tierCounts zaehlt die Bewegungen je Stufe', () => {
  const snapshot = rankSnapshot(rankState(100), [benchExercise], () => benchExercise);
  const counts = tierCounts(snapshot.families);
  eq(counts.diamant, 1);
  eq(counts.elite, 0);
});

/* ---------------------------------------------------------------- Erfolge */

check('Vierzig Erfolge in sechs Gruppen', () => {
  const state = rankState(100);
  const snapshot = rankSnapshot(state, [benchExercise], () => benchExercise);
  const list = achievements(state, () => benchExercise, snapshot.families, snapshot.overall);
  eq(list.length, 40);
  eq(byGroup(list).length, 6);
  // Jede ID nur einmal - sonst ueberschreiben sich angeheftete Erfolge.
  eq(new Set(list.map((item) => item.id)).size, 40);
  for (const item of list) {
    truthy(item.share >= 0 && item.share <= 1, `${item.id}: Anteil ${item.share}`);
    truthy(item.progress.includes('von'), `${item.id} ohne Stand`);
  }
});

check('Erfolge: 100 kg Bank bei 80 kg loesen "Bank = Koerpergewicht" aus', () => {
  const state = rankState(100);
  const snapshot = rankSnapshot(state, [benchExercise], () => benchExercise);
  const list = achievements(state, () => benchExercise, snapshot.families, snapshot.overall);
  const find = (id: string) => list.find((item) => item.id === id)!;
  eq(find('bank-koerpergewicht').earned, true);
  eq(find('bank-anderthalb').earned, false, '1,25 ist nicht 1,5');
  near(find('bank-anderthalb').share, 1.25 / 1.5, 0.01);
  eq(find('erster-rang').earned, true);
  eq(find('breite-voll').earned, false);
  truthy(earnedCount(list) > 0);
});

check('Erfolge ohne Verlauf sind alle offen', () => {
  const state = createInitialState();
  const list = achievements(state, () => undefined, [], overallRank([]));
  eq(earnedCount(list), 0);
});

check('rankTimeline rechnet den Rang von damals mit den Daten von damals', () => {
  const state = stateWith([
    { ...workoutOn('2026-06-01', 60, 5), bodyWeightKg: 80 },
    { ...workoutOn('2026-09-01', 120, 5), bodyWeightKg: 80 },
  ]);
  state.profile = { ...state.profile, weightKg: 80, sex: 'male' };
  const line = rankTimeline(state, [benchExercise], () => benchExercise, 4);
  truthy(line.length >= 2, `${line.length} Punkte`);
  truthy(line[0].score < line[line.length - 1].score, 'es geht aufwärts');
  eq(line[0].date, '2026-06-01', 'beginnt am ersten Training');
});

check('rankTimeline ohne Training bleibt leer', () => {
  eq(rankTimeline(stateWith([]), [], () => undefined).length, 0);
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
