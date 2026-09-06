import { createRunner, launchBrowser, logSet, newAppContext } from './helpers.mjs';

/** Sucht eine Uebung und legt sie zum heutigen Training. */
async function addExercise(page, query) {
  await page.locator('.btn--primary', { hasText: 'Übung hinzufügen' }).first().click();
  await page.waitForSelector('.modal');
  await page.locator('.modal .input').first().fill(query);
  await page.waitForTimeout(500);
  await page.locator('.search-result:not([disabled])').first().click();
  await page.waitForTimeout(400);
}

/** Muskelkarte: Zuordnung, Anzeige in den Details und Vorschlaege je Region. */
export async function run() {
  const runner = createRunner('Muskelkarte');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser);

  await runner.step('Beinbizeps landet im Bein, nicht im Arm', async () => {
    await addExercise(page, 'Beinbeuger');
    await page.locator('.exercise').last().locator('.btn', { hasText: 'Mehr' }).click();
    await page.waitForTimeout(250);
    await page.locator('.exercise').last().locator('.btn', { hasText: 'Fortschritt' }).click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(300);
    try {
      if (await page.locator('.modal .bodymap svg').count() !== 2) throw new Error('keine zwei Ansichten');
      const chips = await page.locator('.modal .muscle-legend .chip').allInnerTexts();
      if (chips.includes('Bizeps')) throw new Error(`Armbizeps statt Beinbizeps: ${chips.join(', ')}`);
      if (!chips.includes('Beinbizeps')) throw new Error(chips.join(', '));
    } finally {
      await page.locator('.modal [aria-label="Schließen"]').first().click();
      await page.waitForTimeout(300);
    }
  });

  await runner.step('Antippen der Brust schlägt Brustübungen vor', async () => {
    await page.locator('.btn--primary', { hasText: 'Übung hinzufügen' }).first().click();
    await page.waitForSelector('.modal');
    await page.locator('.chip--button', { hasText: 'Muskelkarte' }).first().click();
    await page.waitForTimeout(300);
    await page.locator('g[role="button"][aria-label="Brust"] path').first().click();
    await page.waitForTimeout(400);
    const names = await page.locator('.search-result__name').allInnerTexts();
    if (names.length < 5) throw new Error(`nur ${names.length} Vorschläge`);
    const meta = await page.locator('.search-result__meta').first().innerText();
    if (!/Zielmuskel|unterstützt/.test(meta)) throw new Error(`kein Hinweis: ${meta}`);
  });

  await runner.step('Filter lässt sich wieder aufheben', async () => {
    const withRegion = await page.locator('.search-result').count();
    await page.locator('.chip--button', { hasText: 'Filter aufheben' }).first().click();
    await page.waitForTimeout(400);
    const withoutRegion = await page.locator('.search-result').count();
    if (withoutRegion <= withRegion) throw new Error(`${withRegion} -> ${withoutRegion}`);
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Heutige Abdeckung erscheint nach dem Abhaken', async () => {
    await logSet(page, page.locator('.exercise').last(), { kg: 40, reps: 10 });
    // Der Tagesueberblick steht jetzt als Streifen da; die Karte ist einen
    // Tipper entfernt.
    const strip = page.locator('.muscle-strip__item--done');
    if (await strip.count() === 0) throw new Error('keine trainierte Region im Streifen');

    await page.locator('.section__head .btn', { hasText: 'Karte' }).first().click();
    await page.waitForTimeout(400);
    if (await page.locator('.bodymap svg').count() < 2) throw new Error('keine Körperkarte');
  });

  await runner.step('Auswertung zeigt die Belastungskarte', async () => {
    await page.locator('.nav__item', { hasText: 'Fortschritt' }).first().click();
    await page.waitForTimeout(700);
    const card = page.locator('.section', { has: page.locator('.bodymap') }).first();
    if (await card.count() === 0) throw new Error('keine Belastungskarte');
    await card.locator('g[role="button"][aria-label="Beinbizeps"] path').first().click();
    await page.waitForTimeout(400);
    const text = await card.innerText();
    if (!/Beinbizeps/.test(text)) throw new Error('Region nicht ausgewählt');
    if (!/Passende Übungen/i.test(text)) throw new Error('keine Vorschläge');
  });

  await browser.close();
  return runner.finish(errors);
}
