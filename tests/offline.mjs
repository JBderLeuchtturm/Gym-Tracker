import { createRunner, launchBrowser, newAppContext } from './helpers.mjs';

/** Faellt die Uebungssuche sauber auf den eingebauten Katalog zurueck? */
export async function run() {
  const runner = createRunner('Übungssuche ohne Online-Datenbank');
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'de-DE' });
  await ctx.route('**/sync-config.json', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"","anonKey":""}' }));
  // wger komplett abwuergen
  await ctx.route('https://wger.de/**', (route) => route.abort('failed'));

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  await runner.step('Lokale Treffer trotz Ausfall', async () => {
    await page.getByRole('button', { name: /Übung hinzufügen/ }).click();
    await page.waitForSelector('.modal');
    await page.locator('.modal input.input').first().fill('kniebeuge');
    await page.waitForTimeout(1600);
    const hits = await page.locator('.search-result').count();
    if (hits < 4) throw new Error(`${hits} Treffer`);
  });

  await runner.step('Hinweis auf die nicht erreichbare Datenbank', async () => {
    if (await page.locator('text=Online-Datenbank gerade nicht erreichbar').count() === 0) {
      throw new Error('Kein Hinweis');
    }
  });

  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
void newAppContext;
