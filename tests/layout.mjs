import { createRunner, launchBrowser } from './helpers.mjs';
import { chromium } from 'playwright';

/** Prueft, dass die Oberflaeche auch auf schmalen Geraeten passt. */
export async function run() {
  const runner = createRunner('Layout auf schmalem Gerät');
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'de-DE' });
  await ctx.route('**/sync-config.json', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"","anonKey":""}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const overflow = () => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);

  await runner.step('Startseite läuft nicht über', async () => {
    const value = await overflow();
    if (value > 0) throw new Error(`${value} px Überlauf`);
  });

  await runner.step('Reiter-Beschriftungen werden nicht abgeschnitten', async () => {
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.nav__item')]
      .map((el) => {
        const span = el.querySelector('span:last-child');
        return span && span.scrollWidth > span.clientWidth + 1 ? span.textContent : null;
      })
      .filter(Boolean));
    if (clipped.length > 0) throw new Error(clipped.join(', '));
  });

  for (const [index, name] of [[0, 'Heute'], [2, 'Fortschritt'], [3, 'Kalorien'], [5, 'Profil']]) {
    await runner.step(`${name} läuft nicht über`, async () => {
      await page.locator('.nav__item').nth(index).click();
      await page.waitForTimeout(600);
      const value = await overflow();
      if (value > 0) throw new Error(`${value} px Überlauf`);
    });
  }

  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
void chromium;
