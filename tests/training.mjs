import { createRunner, launchBrowser, newAppContext, openCard, readState } from './helpers.mjs';

/** Stoppuhr, Sortieren, Supersaetze, Aufwaermsaetze, Vorschlag, Bestleistung. */
export async function run() {
  const runner = createRunner('Trainingsfunktionen');
  const browser = await launchBrowser();
  const first = await newAppContext(browser);
  let page = first.page;
  const errors = first.errors;

  const toMonday = async () => {
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(500);
  };
  const names = () => page.locator('.exercise__name').allTextContents();
  const bench = () => page.locator('.exercise').filter({ hasText: 'Bankdrücken (Langhantel)' }).first();

  await toMonday();

  await runner.step('Stoppuhr misst und beendet', async () => {
    await page.getByRole('button', { name: 'Zeit messen' }).click();
    await page.waitForTimeout(2200);
    const clock = await page.locator('.chip--success').first().textContent();
    if (!/0:0[12]/.test(clock ?? '')) throw new Error(`Anzeige "${clock}"`);
    await page.getByRole('button', { name: 'Training beenden' }).click();
    await page.waitForTimeout(700);
    const state = await readState(page);
    if (state.workouts[0]?.durationMin !== 1) throw new Error(`Dauer ${state.workouts[0]?.durationMin}`);
  });

  let before = [];
  await runner.step('Übungen umsortieren und Reihenfolge merken', async () => {
    before = await names();
    await page.getByRole('button', { name: 'Sortieren' }).click();
    await page.waitForTimeout(400);
    await page.locator('.exercise__sort').first().locator('button').nth(1).click();
    await page.waitForTimeout(700);
    const after = await names();
    if (after[0] !== before[1]) throw new Error(`Erste Übung ${after[0]}`);

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    await toMonday();
    if ((await names())[0] !== before[1]) throw new Error('Reihenfolge nach Neuladen verloren');
  });

  await runner.step('Supersatz koppeln und lösen', async () => {
    await page.getByRole('button', { name: 'Sortieren' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Mit Übung darüber koppeln' }).first().click();
    await page.waitForTimeout(700);
    if (await page.locator('.exercise__group-label').count() === 0) throw new Error('Keine Markierung');
    let state = await readState(page);
    if (state.workouts[0].exercises.filter((e) => e.groupId).length !== 2) throw new Error('Nicht zwei gruppiert');

    await page.getByRole('button', { name: 'Supersatz lösen' }).first().click();
    await page.waitForTimeout(700);
    state = await readState(page);
    if (state.workouts[0].exercises.filter((e) => e.groupId).length !== 1) throw new Error('Lösen unvollständig');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await page.waitForTimeout(300);
  });

  await runner.step('Aufwärmsätze werden vorangestellt', async () => {
    const card = page.locator('.exercise').first();
    await openCard(card, page);
    const input = card.locator('.set-row').first().locator('input').first();
    await input.fill('80'); await input.blur();
    await page.waitForTimeout(400);
    await card.getByRole('button', { name: 'Aufwärmen' }).click();
    await page.waitForTimeout(700);
    if (await card.locator('.set-row__index--warmup').count() < 2) throw new Error('Zu wenige Aufwärmsätze');
  });

  await runner.step('Bestleistung wird gemeldet', async () => {
    const log = async (kg, reps) => {
      const card = bench();
      await openCard(card, page);
      const row = card.locator('.set-row').first();
      const inputs = row.locator('input');
      await inputs.nth(0).fill(String(kg)); await inputs.nth(0).blur();
      await inputs.nth(1).fill(String(reps)); await inputs.nth(1).blur();
      await page.waitForTimeout(220);
      await row.locator('.check').click();
      await page.waitForTimeout(650);
    };

    for (let i = 0; i < 7; i += 1) { await page.getByLabel('Vorheriger Tag').click(); await page.waitForTimeout(110); }
    await page.waitForTimeout(600);
    await log(60, 5);
    if (await page.locator('.record-banner').count() > 0) throw new Error('Erste Einheit darf nichts melden');

    for (let i = 0; i < 7; i += 1) { await page.getByLabel('Nächster Tag').click(); await page.waitForTimeout(110); }
    await page.waitForTimeout(700);
    await log(100, 5);
    if (await page.locator('.record-banner').count() === 0) throw new Error('Keine Meldung');
  });

  await runner.step('Gewichtsvorschlag geht hoch und lässt sich übernehmen', async () => {
    // Frischer Kontext: die App sichert ihren Stand beim Verlassen der Seite,
    // ein blosses Leeren des Speichers haelt dem nicht stand.
    const fresh = await newAppContext(browser, { label: 'B' });
    page = fresh.page;
    errors.push(...fresh.errors);
    await toMonday();

    for (let i = 0; i < 7; i += 1) { await page.getByLabel('Vorheriger Tag').click(); await page.waitForTimeout(110); }
    await page.waitForTimeout(600);

    const card = bench();
    await openCard(card, page);
    const rows = card.locator('.set-row');
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      const inputs = rows.nth(i).locator('input');
      await inputs.nth(0).fill('70'); await inputs.nth(0).blur();
      await inputs.nth(1).fill('10'); await inputs.nth(1).blur();
      await page.waitForTimeout(150);
      await rows.nth(i).locator('.check').click();
      await page.waitForTimeout(240);
    }

    for (let i = 0; i < 7; i += 1) { await page.getByLabel('Nächster Tag').click(); await page.waitForTimeout(110); }
    await page.waitForTimeout(700);
    await openCard(bench(), page);

    const chip = page.locator('.chip--button').filter({ hasText: 'Vorschlag' }).first();
    if (await chip.count() === 0) throw new Error('Kein Vorschlag');
    const text = (await chip.textContent()) ?? '';
    if (!text.includes('72,5')) throw new Error(`Vorschlag "${text.trim()}"`);
    await chip.click();
    await page.waitForTimeout(600);
    const applied = await bench().locator('.set-row').first().locator('input').first().inputValue();
    if (applied !== '72.5') throw new Error(`Übernommen: ${applied}`);
  });

  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
