import { chromium } from 'playwright';

export const BASE_URL = process.env.TEST_URL ?? 'http://127.0.0.1:4173/';

/** Pfad zum vorinstallierten Chromium, falls einer gesetzt ist. */
const executablePath = process.env.CHROMIUM_PATH || undefined;

export async function launchBrowser() {
  return chromium.launch(executablePath ? { executablePath } : {});
}

/**
 * Legt einen Browser-Kontext an, in dem die App laeuft.
 *
 * Die Synchronisierungs-Konfiguration wird immer abgefangen: Tests sollen
 * niemals das echte Supabase-Projekt anfassen. Wird ein Mock uebergeben,
 * bekommt der Kontext Zugangsdaten und alle Aufrufe gehen an den Mock.
 */
export async function newAppContext(browser, { backend = null, url = BASE_URL, label = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'de-DE' });

  await ctx.route('**/sync-config.json', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: backend
      ? JSON.stringify({ url: 'https://mock.supabase.co', anonKey: 'anon-key-for-tests-0123456789' })
      : JSON.stringify({ url: '', anonKey: '' }),
  }));

  if (backend) {
    await ctx.route('https://mock.supabase.co/**', async (route) => {
      route.fulfill(await backend.handle(route.request()));
    });
  }

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${label}${label ? ': ' : ''}${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/TUNNEL|net::|Failed to load resource/.test(m.text())) {
      errors.push(`${label}${label ? ': ' : ''}${m.text()}`);
    }
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return { ctx, page, errors };
}

/** Sammelt Ergebnisse einzelner Pruefschritte. */
export function createRunner(name) {
  const problems = [];
  const step = async (label, fn) => {
    try {
      await fn();
      console.log(`  ok   ${label}`);
    } catch (error) {
      problems.push(label);
      console.log(`  FAIL ${label} -> ${String(error.message).split('\n')[0]}`);
    }
  };
  return {
    step,
    problems,
    finish(errors = []) {
      const failed = problems.length + errors.length;
      if (errors.length > 0) {
        console.log(`  Skriptfehler (${errors.length}):`);
        errors.slice(0, 5).forEach((e) => console.log(`    ${String(e).slice(0, 180)}`));
      }
      console.log(failed === 0 ? `✓ ${name}` : `✗ ${name} (${failed})`);
      return failed;
    },
  };
}

/** Klappt eine Uebungskarte auf, falls sie zu ist. */
export async function openCard(card, page) {
  if (await card.locator('.set-row').count() === 0) {
    await card.locator('.exercise__head').click();
    await page.waitForTimeout(300);
  }
}

/** Traegt einen Satz ein und hakt ihn ab. */
export async function logSet(page, card, { kg, reps, index = 0 }) {
  await openCard(card, page);
  const row = card.locator('.set-row').nth(index);
  const inputs = row.locator('input');
  if (kg != null) { await inputs.nth(0).fill(String(kg)); await inputs.nth(0).blur(); }
  if (reps != null) { await inputs.nth(1).fill(String(reps)); await inputs.nth(1).blur(); }
  await page.waitForTimeout(200);
  await row.locator('.check').click();
  await page.waitForTimeout(500);
}

export const readState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('gym-tracker:state:v1')));
