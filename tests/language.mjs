import { createRunner, launchBrowser } from './helpers.mjs';
import { chromium } from 'playwright';

/** Sprachwahl: Erkennung, Umschalten, englische Uebungsnamen. */
export async function run() {
  const runner = createRunner('Mehrsprachigkeit');
  const browser = await launchBrowser();
  const url = process.env.TEST_URL ?? 'http://127.0.0.1:4173/';
  const errors = [];

  const open = async (locale) => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale });
    await ctx.route('**/sync-config.json', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"","anonKey":""}' }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    return { ctx, page };
  };

  await runner.step('Deutsches Gerät bekommt Deutsch', async () => {
    const { ctx, page } = await open('de-DE');
    const tabs = await page.locator('.nav__item span:last-child').allTextContents();
    if (tabs[0] !== 'Heute') throw new Error(tabs.join(','));
    await ctx.close();
  });

  const { ctx, page } = await open('en-US');

  await runner.step('Englisches Gerät bekommt Englisch', async () => {
    const tabs = await page.locator('.nav__item span:last-child').allTextContents();
    const expected = ['Today', 'Plans', 'Progress', 'Calories', 'Friends', 'Profile'];
    if (tabs.join(',') !== expected.join(',')) throw new Error(tabs.join(','));
  });

  await runner.step('Übungen erscheinen mit englischem Namen', async () => {
    await page.locator('.day-strip__item').first().click();
    await page.waitForTimeout(600);
    const names = await page.locator('.exercise__name').allTextContents();
    if (!names.some((name) => /Bench Press/i.test(name))) throw new Error(names.join(' | '));
  });

  await runner.step('Beschriftungen im Training sind übersetzt', async () => {
    const card = page.locator('.exercise').first();
    if (await card.locator('.set-row').count() === 0) {
      await card.locator('.exercise__head').click();
      await page.waitForTimeout(300);
    }
    const header = await card.locator('.set-header').innerText();
    if (!/REPS/i.test(header)) throw new Error(`Kopfzeile "${header.replace(/\n/g, ' ')}"`);
  });

  await runner.step('Umschalten auf Deutsch wirkt sofort', async () => {
    await page.locator('.nav__item').nth(5).click();
    await page.waitForTimeout(600);
    const select = page.locator('select').filter({ hasText: 'Deutsch' }).first();
    await select.selectOption('de');
    await page.waitForTimeout(900);
    const tabs = await page.locator('.nav__item span:last-child').allTextContents();
    if (tabs[0] !== 'Heute') throw new Error(tabs.join(','));
  });

  await runner.step('Die Wahl überlebt das Neuladen', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const tabs = await page.locator('.nav__item span:last-child').allTextContents();
    if (tabs[0] !== 'Heute') throw new Error(tabs.join(','));
  });

  await ctx.close();
  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
void chromium;
