import { createRunner, launchBrowser, logSet, newAppContext, readState } from './helpers.mjs';

/** Grundbedienung ohne Synchronisierung: Logging, Speichern, Suche, Navigation. */
export async function run() {
  const runner = createRunner('Grundbedienung');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser);

  await runner.step('App startet mit allen Reitern', async () => {
    const tabs = await page.locator('.nav__item span:last-child').allTextContents();
    const expected = ['Heute', 'Pläne', 'Fortschritt', 'Kalorien', 'Freunde', 'Profil'];
    if (tabs.join(',') !== expected.join(',')) throw new Error(tabs.join(','));
  });

  await runner.step('Trainingstag zeigt die Plan-Übungen', async () => {
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(500);
    const count = await page.locator('.exercise').count();
    if (count < 4) throw new Error(`${count} Übungen`);
  });

  await runner.step('Satz eintragen und abhaken', async () => {
    await logSet(page, page.locator('.exercise').first(), { kg: 80, reps: 8 });
    const state = await readState(page);
    const done = (state.workouts ?? []).flatMap((w) => w.exercises).flatMap((e) => e.sets).filter((s) => s.done);
    if (done.length !== 1) throw new Error(`${done.length} abgehakte Sätze`);
    if (done[0].weightKg !== 80 || done[0].reps !== 8) throw new Error('Werte nicht gespeichert');
  });

  await runner.step('Pausenuhr läuft an', async () => {
    if (await page.locator('.rest-timer').count() === 0) throw new Error('Keine Pausenuhr');
  });

  await runner.step('Daten überleben das Neuladen', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(500);
    const chip = await page.locator('.exercise').first().locator('.chip').first().textContent();
    if (!chip?.includes('1/')) throw new Error(`Chip "${chip}"`);
  });

  await runner.step('Suche findet deutsch, englisch und nach Muskel', async () => {
    await page.getByRole('button', { name: /Übung hinzufügen/ }).click();
    await page.waitForSelector('.modal');
    const field = page.locator('.modal input.input').first();

    for (const [term, minimum] of [['bank', 10], ['squat', 5], ['latissimus', 10], ['kurzhantel', 10]]) {
      await field.fill(term);
      await page.waitForTimeout(500);
      const hits = await page.locator('.search-result').count();
      if (hits < minimum) throw new Error(`"${term}" ergab ${hits} Treffer`);
    }
  });

  await runner.step('Übung hinzufügen', async () => {
    await page.locator('.modal input.input').first().fill('face pull');
    await page.waitForTimeout(600);
    const before = await page.locator('.exercise').count();
    await page.locator('.search-result').first().click();
    await page.waitForTimeout(700);
    const after = await page.locator('.exercise').count();
    if (after <= before) throw new Error('Keine Übung dazugekommen');
  });

  for (const [index, name] of [[1, 'Pläne'], [2, 'Fortschritt'], [3, 'Kalorien'], [4, 'Freunde'], [5, 'Profil']]) {
    await runner.step(`Reiter ${name} rendert`, async () => {
      await page.locator('.nav__item').nth(index).click();
      await page.waitForTimeout(600);
      const text = await page.locator('.page').innerText();
      if (text.trim().length < 20) throw new Error('Seite leer');
    });
  }

  await runner.step('Planvorlagen sind vollständig', async () => {
    await page.locator('.nav__item').nth(1).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Aus Vorlage/ }).click();
    await page.waitForSelector('.modal');
    const titles = await page.locator('.modal .card .bold').allTextContents();
    if (titles.length !== 5) throw new Error(`${titles.length} Vorlagen`);
  });

  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
