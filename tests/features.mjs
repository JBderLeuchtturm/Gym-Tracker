import { createRunner, launchBrowser, logSet, newAppContext, openCard, readState } from './helpers.mjs';

/** Legt eine Übung ins heutige Training. */
async function addExercise(page, query) {
  await page.locator('.btn--primary', { hasText: 'Übung hinzufügen' }).first().click();
  await page.waitForSelector('.modal');
  await page.locator('.modal .input').first().fill(query);
  await page.waitForTimeout(500);
  await page.locator('.search-result:not([disabled])').first().click();
  await page.waitForTimeout(400);
}

/** Zweite Runde: Kopieren, Wochenziele, Ersatz, Zyklus, Partner, Export. */
export async function run() {
  const runner = createRunner('Zweite Runde');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser);

  await runner.step('Ein Plantag lässt sich auf mehrere Tage kopieren', async () => {
    await page.locator('.nav__item', { hasText: 'Pläne' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.btn', { hasText: 'Bearbeiten' }).first().click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(300);

    // Montag ist im Startplan der Push-Tag.
    await page.locator('.modal .day-strip__item').first().click();
    await page.waitForTimeout(300);
    const before = await page.locator('.modal .day-strip__num').allInnerTexts();

    await page.locator('.modal .chip--button', { hasText: /^Di$/ }).click();
    await page.locator('.modal .chip--button', { hasText: /^Do$/ }).click();
    await page.locator('.modal .btn', { hasText: 'Auf 2 Tage kopieren' }).click();
    await page.waitForTimeout(400);

    const after = await page.locator('.modal .day-strip__num').allInnerTexts();
    if (after[1] !== before[0] || after[3] !== before[0]) {
      throw new Error(`${before.join(',')} -> ${after.join(',')}`);
    }
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Zyklus zeigt die aktuelle Woche im Training', async () => {
    await page.locator('.btn', { hasText: 'Bearbeiten' }).first().click();
    await page.waitForSelector('.modal');
    await page.locator('.modal input[type="checkbox"]').first().check();
    await page.waitForTimeout(400);
    if (await page.locator('.modal .chip', { hasText: '100 %' }).count() === 0) {
      throw new Error('keine Wochenübersicht');
    }
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);

    await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
    await page.waitForTimeout(500);
    if (await page.locator('.chip', { hasText: /Woche 1 von 4/ }).count() === 0) {
      throw new Error('kein Hinweis auf den Zyklus');
    }
  });

  await runner.step('Ersatzübung tauscht die Übung, Sätze bleiben', async () => {
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(400);
    const card = page.locator('.exercise').first();
    await openCard(card, page);
    await logSet(page, card, { kg: 60, reps: 8 });
    await page.locator('.rest-timer [aria-label="Pause beenden"]').click().catch(() => {});
    const nameBefore = await page.locator('.exercise__name').first().innerText();

    await page.locator('.exercise .btn', { hasText: 'Mehr' }).first().click();
    await page.waitForTimeout(250);
    await page.locator('.exercise .btn', { hasText: 'Ersatz' }).first().click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(300);
    await page.locator('.modal .search-result').first().click();
    await page.waitForTimeout(600);

    const nameAfter = await page.locator('.exercise__name').first().innerText();
    if (nameAfter === nameBefore) throw new Error('nicht getauscht');
    const state = await readState(page);
    const done = state.workouts.flatMap((w) => w.exercises).flatMap((e) => e.sets).filter((s) => s.done);
    if (done.length !== 1) throw new Error(`${done.length} abgehakte Sätze übrig`);
  });

  await runner.step('Muskelkarte zeigt die Wochenziel-Ampel', async () => {
    await page.locator('.nav__item', { hasText: 'Fortschritt' }).first().click();
    await page.waitForTimeout(700);
    const card = page.locator('.card', { has: page.locator('.bodymap') }).first();
    if (await card.count() === 0) throw new Error('keine Muskelkarte');
    const text = await card.innerText();
    if (!/im Ziel|unter Ziel|drunter/.test(text)) throw new Error(text.slice(0, 80));
  });

  await runner.step('Trainingskalender hat einen Trainingstag', async () => {
    // Der Kalender steht seit der Umgestaltung in einem Abschnitt, nicht in
    // einer Karte - gesucht wird deshalb der Kalender selbst.
    const heatmap = page.locator('.heatmap-wrap').first();
    if (await heatmap.count() === 0) throw new Error('kein Kalender');
    if (await heatmap.locator('.heatmap__cell--4').count() === 0) throw new Error('kein gefüllter Tag');
  });

  await runner.step('Wochenziele lassen sich im Profil ändern', async () => {
    await page.locator('.nav__item', { hasText: 'Profil' }).first().click();
    await page.waitForTimeout(600);
    await page.locator('.btn', { hasText: 'Wochenziele je Muskelgruppe' }).click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .row', { hasText: 'Brust' }).locator('input').first().fill('16');
    await page.locator('.modal .btn--primary', { hasText: 'Speichern' }).click();
    await page.waitForTimeout(400);
    const state = await readState(page);
    if (state.settings.weeklySetTargets.chest !== 16) {
      throw new Error(JSON.stringify(state.settings.weeklySetTargets));
    }
  });

  await runner.step('Körpermaße werden gespeichert', async () => {
    await page.locator('.btn', { hasText: 'Maße' }).first().click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .field', { hasText: 'Taille' }).locator('input').first().fill('82');
    await page.locator('.modal .btn--primary', { hasText: 'Speichern' }).click();
    await page.waitForTimeout(400);
    const state = await readState(page);
    if (state.measurements?.[0]?.waistCm !== 82) throw new Error(JSON.stringify(state.measurements));
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Plan lässt sich als Baustein teilen und wieder einlesen', async () => {
    await page.locator('.nav__item', { hasText: 'Pläne' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.btn', { hasText: 'Teilen' }).first().click();
    await page.waitForSelector('.modal');
    const code = await page.locator('.modal textarea').inputValue();
    if (!code.startsWith('GTPLAN1:')) throw new Error(code.slice(0, 30));
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);

    const planCountBefore = (await readState(page)).plans.length;
    await page.locator('.btn', { hasText: 'Plan einfügen' }).click();
    await page.waitForSelector('.modal');
    await page.locator('.modal textarea').fill(code);
    await page.waitForTimeout(400);
    await page.locator('.modal .btn--primary', { hasText: 'Plan übernehmen' }).click();
    await page.waitForTimeout(600);
    const planCountAfter = (await readState(page)).plans.length;
    if (planCountAfter !== planCountBefore + 1) {
      throw new Error(`${planCountBefore} -> ${planCountAfter}`);
    }
  });

  await browser.close();
  return runner.finish(errors);
}
