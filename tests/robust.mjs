import { createRunner, launchBrowser, logSet, newAppContext, openCard, readState } from './helpers.mjs';
import { chromium } from 'playwright';

const BASE_URL = process.env.TEST_URL ?? 'http://127.0.0.1:4173/';

/** Die behobenen Schwächen aus Issue #13. */
export async function run() {
  const runner = createRunner('Behobene Schwächen');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser);

  await runner.step('Wenige Messpunkte zeigen Zahlen statt Diagramm', async () => {
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(400);
    const card = page.locator('.exercise').first();
    await openCard(card, page);
    await logSet(page, card, { kg: 60, reps: 8 });
    await page.locator('.rest-timer [aria-label="Pause beenden"]').click().catch(() => {});

    await page.locator('.nav__item', { hasText: 'Fortschritt' }).first().click();
    await page.waitForTimeout(700);
    if (await page.locator('.sparse').count() === 0) throw new Error('Kein Klartext bei dünner Datenlage');
    if (!/mindestens drei/.test(await page.locator('.sparse').first().innerText())) {
      throw new Error('Kein Hinweis, ab wann gezeichnet wird');
    }
  });

  await runner.step('Datumsfeld zeigt das gelesene Datum daneben', async () => {
    await page.locator('.nav__item', { hasText: 'Profil' }).first().click();
    await page.waitForTimeout(600);
    const read = page.locator('.datefield__read').first();
    await page.locator('.datefield input[type=date]').first().fill('1998-04-09');
    await page.waitForTimeout(400);
    const text = await read.innerText();
    if (!/April/.test(text)) throw new Error(`Klartext fehlt: "${text}"`);
  });

  await runner.step('Gelöschter Gewichtseintrag lässt sich zurückholen', async () => {
    await page.locator('.btn', { hasText: 'Eintrag' }).first().click();
    await page.waitForSelector('.modal');
    const field = page.locator('.modal .input--num').first();
    await field.fill('81.5'); await field.blur();
    await page.locator('.modal .btn', { hasText: 'Speichern' }).click();
    await page.waitForTimeout(500);

    const before = (await readState(page)).weightLog.length;
    await page.locator('[aria-label="Eintrag löschen"]').first().click();
    await page.waitForTimeout(400);
    if ((await readState(page)).weightLog.length !== before - 1) throw new Error('Nicht gelöscht');

    await page.locator('.toast__action').click();
    await page.waitForTimeout(500);
    if ((await readState(page)).weightLog.length !== before) throw new Error('Nicht zurückgeholt');
  });

  await runner.step('Training lässt sich auf einen anderen Tag schieben', async () => {
    await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(400);

    const state = await readState(page);
    const workout = state.workouts.find((item) =>
      item.exercises.some((logged) => logged.sets.some((set) => set.done)));
    if (!workout) throw new Error('Kein Training vorhanden');

    await page.locator('.btn', { hasText: 'Datum ändern' }).first().click();
    await page.waitForSelector('.modal');
    const target = new Date(workout.date);
    target.setDate(target.getDate() + 1);
    const iso = target.toISOString().slice(0, 10);
    await page.locator('.modal input[type=date]').fill(iso);
    await page.waitForTimeout(300);
    await page.locator('.modal .btn--primary', { hasText: 'Verschieben' }).click();
    await page.waitForTimeout(700);

    const after = await readState(page);
    if (!after.workouts.some((item) => item.id === workout.id && item.date === iso)) {
      throw new Error(`Nicht verschoben: ${after.workouts.map((w) => w.date).join(', ')}`);
    }
  });

  await runner.step('Einstellungen gewinnen über ihren eigenen Zeitstempel', async () => {
    const state = await readState(page);
    if (!state.settingsUpdatedAt) throw new Error('Kein eigener Zeitstempel');
  });

  await runner.step('Export warnt, dass Fotos nicht mitkommen', async () => {
    await page.locator('.nav__item', { hasText: 'Profil' }).first().click();
    await page.waitForTimeout(600);
    const text = await page.locator('.page').innerText();
    if (!/Fortschrittsfotos sind nicht dabei/.test(text)) throw new Error('Kein Hinweis beim Export');
  });

  await browser.close();

  /* --------------------------------------------------------- Querformat */

  const wide = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await wide.newContext({ viewport: { width: 844, height: 390 }, locale: 'de-DE' });
  await ctx.route('**/sync-config.json', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"url":"","anonKey":""}',
  }));
  const land = await ctx.newPage();
  await land.goto(BASE_URL, { waitUntil: 'networkidle' });
  await land.waitForTimeout(700);

  await runner.step('Querformat: Navigation steht am Rand, nichts läuft über', async () => {
    const nav = await land.locator('.nav').boundingBox();
    if (!nav || nav.width > 120) throw new Error(`Leiste ${nav?.width}px breit`);
    if (nav.y > 10) throw new Error('Leiste steht nicht oben links');
    const overflow = await land.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`${overflow}px Überlauf`);
  });

  await wide.close();
  return runner.finish(errors);
}
