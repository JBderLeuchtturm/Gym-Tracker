import { chromium } from 'playwright';

export const BASE_URL = process.env.TEST_URL ?? 'http://127.0.0.1:4173/';

/** Pfad zum vorinstallierten Chromium, falls einer gesetzt ist. */
const executablePath = process.env.CHROMIUM_PATH || undefined;

/*
 * Ein Browser fuer alle Laeufe.
 *
 * Vorher startete jeder der dreizehn Laeufe seinen eigenen Chromium - das kostet
 * jedes Mal ein bis zwei Sekunden. Jetzt laeuft einer, und jeder Lauf bekommt
 * frische Kontexte (eigener Speicher, eigene Seiten). "browser.close()" in einem
 * Lauf schliesst nur dessen Kontexte; den Prozess beendet run.mjs am Schluss.
 */
let shared = null;

export async function launchBrowser() {
  if (!shared) shared = await chromium.launch(executablePath ? { executablePath } : {});
  return new Proxy(shared, {
    get(target, prop) {
      if (prop === 'close') {
        return async () => {
          for (const context of target.contexts()) {
            await context.close().catch(() => undefined);
          }
        };
      }
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

/** Beendet den gemeinsamen Browser wirklich - am Ende von run.mjs. */
export async function closeSharedBrowser() {
  if (shared) {
    await shared.close().catch(() => undefined);
    shared = null;
  }
}

/**
 * Legt einen Browser-Kontext an, in dem die App laeuft.
 *
 * Die Synchronisierungs-Konfiguration wird immer abgefangen: Tests sollen
 * niemals das echte Supabase-Projekt anfassen. Wird ein Mock uebergeben,
 * bekommt der Kontext Zugangsdaten und alle Aufrufe gehen an den Mock.
 */
export async function newAppContext(
  browser,
  { backend = null, url = BASE_URL, label = '', seed = null } = {},
) {
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, locale: 'de-DE' });

  /*
   * Vorbelegter Stand fuer Pruefungen, die Verlauf brauchen. Muss vor dem
   * Start der App im Speicher liegen: Nachtraeglich geschrieben wuerde ihn
   * der Speicher-Rueckschreiber beim Verlassen der Seite ueberschreiben.
   */
  if (seed) {
    await ctx.addInitScript((patch) => {
      const key = 'gym-tracker:state:v1';
      const existing = (() => {
        try { return JSON.parse(localStorage.getItem(key)) ?? {}; } catch { return {}; }
      })();
      localStorage.setItem(key, JSON.stringify({
        ...existing, ...patch, updatedAt: new Date().toISOString(),
      }));
    }, seed);
  }

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

/**
 * Klappt eine Uebungskarte auf, falls sie zu ist.
 *
 * Geprueft wird die Sichtbarkeit, nicht das Vorhandensein: Seit die Karte mit
 * einem Uebergang aufklappt, steht ihr Inhalt auch zugeklappt im Dokument -
 * nur eben mit Hoehe null und "visibility: hidden".
 */
export async function openCard(card, page) {
  const firstRow = card.locator('.set-row').first();
  if (await firstRow.count() === 0 || !(await firstRow.isVisible())) {
    await card.locator('.exercise__head').click();
    await page.waitForTimeout(350);
  }
}

/**
 * Klickt eine Aufstiegsmeldung weg, falls eine steht.
 *
 * Ein abgehakter Satz kann eine Stufe knacken, und dann meldet sich die App
 * mit einem Fenster - genau so soll es sein. Im Test liegt es dann aber ueber
 * allem, was danach geklickt wird.
 */
export async function dismissRankUp(page) {
  if (await page.locator('.rankup').count() === 0) return false;
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.waitForTimeout(350);
  return true;
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
  await dismissRankUp(page);
}

export const readState = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('gym-tracker:state:v1')));
