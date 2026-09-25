import { createRunner, launchBrowser, newAppContext, openCard, readState } from './helpers.mjs';

/*
 * Runde drei im Browser: Erfassung je Plan-Eintrag, "Anpassen" im Training,
 * die Fokus-Ansicht mit beladener Stange, der gefuehrte Zirkel, Wochenziele
 * aus dem Plan und das Koppeln zum Supersatz im Plan-Editor.
 *
 * Der Plan hat an allen sieben Tagen dieselben Uebungen - sonst haengt das
 * Ergebnis davon ab, an welchem Wochentag die Tests laufen.
 */

const now = new Date().toISOString();

const planExercise = (id, exerciseId, patch = {}) => ({
  id,
  exerciseId,
  targetSets: 3,
  targetRepsMin: 8,
  targetRepsMax: 10,
  targetWeightKg: null,
  restSec: 60,
  ...patch,
});

const day = (weekday) => ({
  weekday,
  title: 'Ganzkörper',
  isRestDay: false,
  exercises: [
    planExercise(`pe_bench_${weekday}`, 'cat_barbell-bench-press', { targetWeightKg: 60, restSec: 90 }),
    planExercise(`pe_push_${weekday}`, 'cat_push-up', { tracking: 'reps', targetRepsMin: 10, targetRepsMax: 15 }),
    // Zwei Zeit-Uebungen als Zirkel: je 2 s, direkt weiter, 1 s Pause nach der Runde.
    planExercise(`pe_plank_${weekday}`, 'cat_plank', {
      tracking: 'time', targetSets: 2, targetDurationSec: 2, targetRepsMin: null, targetRepsMax: null,
      groupId: `g_${weekday}`, transitionSec: 0, restSec: 1,
    }),
    planExercise(`pe_climb_${weekday}`, 'cat_mountain-climber', {
      tracking: 'time', targetSets: 2, targetDurationSec: 2, targetRepsMin: null, targetRepsMax: null,
      groupId: `g_${weekday}`, transitionSec: 0, restSec: 1,
    }),
  ],
});

const SEED = {
  plans: [{
    id: 'plan_r3',
    name: 'Runde drei',
    days: [0, 1, 2, 3, 4, 5, 6].map(day),
    createdAt: now,
    updatedAt: now,
  }],
  activePlanId: 'plan_r3',
  settings: { countdownBeep: false },
};

const todayWorkout = (state) => {
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return state.workouts.find((workout) => workout.date === iso);
};

export async function run() {
  const runner = createRunner('Runde drei: Erfassung, Zirkel, Ziele, Fokus');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser, { label: 'r3', seed: SEED });
  await page.waitForTimeout(500);

  const card = (name) => page.locator('.exercise', { hasText: name }).first();
  /*
   * Der erste abgehakte Satz bringt den ersten Rang - das Fenster dazu legt
   * sich bewusst ueber alles, auch ueber Fokus und Zirkel. Hier wegklicken.
   */
  const closeRankUp = async () => {
    if (await page.locator('.rankup').count() === 0) return;
    await page.locator('.modal').filter({ has: page.locator('.rankup') })
      .getByRole('button', { name: 'Weiter' }).click();
    await page.waitForTimeout(350);
  };

  await runner.step('Der Plan-Eintrag bestimmt die Erfassung', async () => {
    const push = card('Liegestütze');
    await openCard(push, page);
    // "Nur Wdh": eine Zahlenspalte, kein Gewichtsfeld.
    if (await push.locator('.set-row--layout-1').count() === 0) throw new Error('Liegestütze nicht als „Nur Wdh“');
    if (await card('Bankdrücken').locator('.set-row--layout-1').count() > 0) {
      throw new Error('Bankdrücken hat sein Gewichtsfeld verloren');
    }
  });

  await runner.step('Fokus-Ansicht: großes Gewicht, beladene Stange, großer Haken', async () => {
    await page.getByRole('button', { name: 'Fokus', exact: true }).click();
    await page.waitForTimeout(300);
    const focus = page.locator('.focus');
    if (await focus.count() === 0) throw new Error('Keine Fokus-Ansicht');
    if (!/Bankdrücken/i.test(await focus.locator('.focus__name').textContent())) {
      throw new Error('Nicht bei der ersten offenen Übung');
    }
    await focus.getByRole('button', { name: 'kg erhöhen' }).click();
    await page.waitForTimeout(200);
    const weight = (await focus.locator('.focus__digits').first().textContent()).trim();
    if (weight !== '62,5') throw new Error(`Gewicht ${weight} statt 62,5`);
    const bar = focus.locator('.loadbar');
    if (await bar.count() === 0) throw new Error('Keine beladene Stange');
    if (!/Je Seite: 20 \+ 1,25/.test(await bar.getAttribute('aria-label'))) {
      throw new Error(`Stange: ${await bar.getAttribute('aria-label')}`);
    }

    await focus.getByRole('button', { name: 'Satz geschafft' }).click();
    await page.waitForTimeout(400);
    await closeRankUp();
    const bench = todayWorkout(await readState(page))?.exercises.find((item) => item.exerciseId === 'cat_barbell-bench-press');
    if (!bench?.sets[0]?.done || bench.sets[0].weightKg !== 62.5) {
      throw new Error(`Satz nicht gespeichert: ${JSON.stringify(bench?.sets[0])}`);
    }
    if (await focus.locator('.focus__rest').count() === 0) throw new Error('Keine Pause nach dem Satz');

    await focus.locator('.focus__rest-actions').getByRole('button', { name: 'Weiter' }).click();
    await page.waitForTimeout(300);
    if (!/Satz 2 von 3/i.test(await focus.locator('.focus__pip-label').textContent())) {
      throw new Error('Steht nicht beim zweiten Satz');
    }
    await page.getByRole('button', { name: 'Fokus-Ansicht schließen' }).click();
    await page.waitForTimeout(250);
    if (await page.locator('.focus').count() > 0) throw new Error('Fokus-Ansicht blieb offen');
  });

  await runner.step('„Anpassen“ stellt eine Übung auf „Nur Sätze“ um – auch im Plan', async () => {
    await closeRankUp();
    const push = card('Liegestütze');
    await openCard(push, page);
    await push.locator('.exercise__actions').getByRole('button', { name: 'Anpassen' }).click();
    const modal = page.locator('.modal', { hasText: 'Übung anpassen' });
    await modal.waitFor();
    await modal.getByRole('radio', { name: /Nur Sätze/ }).click();
    await modal.getByLabel('Sätze', { exact: true }).fill('2');
    await modal.getByText('Auch im Plan so speichern').click();
    await modal.getByRole('button', { name: 'Übernehmen' }).click();
    await page.waitForTimeout(400);

    // Nur Satzzeilen zaehlen - der Spaltenkopf traegt dieselbe Layout-Klasse.
    const rows = push.locator('.set-row.set-row--layout-sets');
    if (await rows.count() !== 2) throw new Error(`${await rows.count()} Zeilen statt 2 „Nur Sätze“`);
    const state = await readState(page);
    const weekday = (new Date().getDay() + 6) % 7;
    const planned = state.plans[0].days[weekday].exercises.find((item) => item.exerciseId === 'cat_push-up');
    if (planned.tracking !== 'sets' || planned.targetSets !== 2) {
      throw new Error(`Plan nicht mitgeändert: ${JSON.stringify(planned)}`);
    }
    // Die anderen Tage bleiben, wie sie waren.
    const other = state.plans[0].days[(weekday + 1) % 7].exercises.find((item) => item.exerciseId === 'cat_push-up');
    if (other.tracking !== 'reps') throw new Error('Auch andere Tage wurden umgestellt');
  });

  await runner.step('Der Zirkel läuft von selbst durch und hakt ab', async () => {
    await page.getByRole('button', { name: 'Zirkel starten' }).first().click();
    await page.waitForSelector('.circuit');
    await page.waitForSelector('.circuit--done', { timeout: 30000 });
    await closeRankUp();
    await page.locator('.circuit__big').click();
    await page.waitForTimeout(300);
    if (await page.locator('.circuit').count() > 0) throw new Error('Zirkel blieb offen');

    const workout = todayWorkout(await readState(page));
    for (const id of ['cat_plank', 'cat_mountain-climber']) {
      const logged = workout?.exercises.find((item) => item.exerciseId === id);
      const done = logged?.sets.filter((set) => set.done) ?? [];
      if (done.length !== 2) throw new Error(`${id}: ${done.length} statt 2 Sätze abgehakt`);
      if (done.some((set) => !set.durationSec)) throw new Error(`${id}: Zeit fehlt`);
    }
  });

  await runner.step('Wochenziele lassen sich vom aktiven Plan übernehmen', async () => {
    await closeRankUp();
    await page.locator('.goals-empty, .goals-strip').first().click();
    const modal = page.locator('.modal', { hasText: 'Wochenziele' });
    await modal.waitFor();
    await modal.getByRole('button', { name: /Vom aktiven Plan übernehmen/ }).click();
    await page.waitForTimeout(200);
    await modal.locator('.btn--primary', { hasText: 'Speichern' }).click();
    await page.waitForTimeout(300);
    const { settings } = await readState(page);
    if (settings.weeklyGoals.trainingDays !== 7) throw new Error(`Tage: ${settings.weeklyGoals.trainingDays}`);
    if (!(settings.weeklyGoals.minutes > 0)) throw new Error('Keine Minuten');
    if (!(settings.weeklySetTargets.chest > 0)) throw new Error(`Brust: ${settings.weeklySetTargets.chest}`);
    if (await page.locator('.goals-strip').count() === 0) throw new Error('Keine Zielleiste auf der Trainingsseite');
  });

  await runner.step('Im Plan-Editor koppelt ein Tipper zwei Übungen zum Supersatz', async () => {
    await page.locator('.nav__item', { hasText: 'Pläne' }).first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Mit Übung darüber koppeln' }).first().click();
    await page.waitForTimeout(300);
    const { plans } = await readState(page);
    const coupled = plans[0].days.some((item) => item.exercises[0].groupId
      && item.exercises[0].groupId === item.exercises[1].groupId);
    if (!coupled) throw new Error('Bankdrücken und Liegestütze nicht gekoppelt');
    if (await page.locator('.plan-link--on').count() === 0) throw new Error('Kettenglied zeigt es nicht an');
  });

  await browser.close();
  return runner.finish(errors);
}
