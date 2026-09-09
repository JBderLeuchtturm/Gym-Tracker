import {
  createRunner, dismissRankUp, launchBrowser, logSet, newAppContext, openCard, readState,
} from './helpers.mjs';

/**
 * Bindung und Politur: Serie/Woche auf der Trainingsseite, die
 * Rang-Verfall-Warnung, der Abschluss-Bildschirm und der erste Einstieg.
 *
 * Antwort auf Issue 31 ("mehr Grund zum Wiederkommen, weniger
 * Prototyp-Gefuehl"). Was sich rein im Code pruefen liess (Kalorienrundung,
 * Rangformel, ...) ist hier nicht dabei - das steckt schon in raenge.mjs.
 */

const iso = (daysBack) => {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
};

const lift = (id, exerciseId, weightKg, reps, daysBack) => ({
  id: `wo_${id}`,
  date: iso(daysBack),
  title: 'Ganzkörper',
  exercises: [{
    id: `le_${id}`,
    exerciseId,
    sets: [{
      id: `s_${id}`, reps, weightKg, durationSec: null, distanceKm: null,
      rpe: 9, done: true, isWarmup: false,
    }],
  }],
  durationMin: 40,
  bodyWeightKg: 80,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

function seedHome() {
  return {
    workouts: [
      // Heute: traegt zur Serie und zum Wochenvolumen bei.
      lift('bench', 'cat_barbell-bench-press', 80, 5, 0),
      /*
       * 250 Tage her, wie schon in raenge.mjs erprobt: weit genug in den
       * Verfall hinein, dass "decayLoss" verlaesslich ueber der Schwelle
       * von 3 liegt - unabhaengig vom genauen Testtag. "dropsInDays"
       * waere hier keine stabile Wahl gewesen (siehe Kommentar in
       * Today.tsx), deshalb keine Abhaengigkeit davon.
       */
      lift('curl', 'cat_barbell-curl', 45, 8, 250),
    ],
  };
}

const openTraining = async (page) => {
  await dismissRankUp(page);
  await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('.day-strip__item').first().click();
  await page.waitForTimeout(700);
};

const openTab = async (page, name) => {
  await dismissRankUp(page);
  await page.locator('.nav__item', { hasText: name }).first().click();
  await page.waitForTimeout(700);
};

export async function run() {
  const runner = createRunner('Bindung und Politur');
  const browser = await launchBrowser();
  const errors = [];

  /* --------------------------------------------------------- Erster Einstieg */

  const fresh = await newAppContext(browser, { label: 'einstieg', skipOnboarding: false });
  errors.push(...fresh.errors);

  await runner.step('Der erste Start zeigt einen kurzen Einstieg', async () => {
    const modal = fresh.page.locator('.modal', { hasText: 'Willkommen' });
    if (await modal.count() === 0) throw new Error('Kein Einstieg beim ersten Start');
  });

  await runner.step('Ein Name dort landet im Profil, und der Einstieg erscheint kein zweites Mal', async () => {
    await fresh.page.locator('.modal input.input').fill('Nina');
    await fresh.page.getByRole('button', { name: 'Los geht’s' }).click();
    await fresh.page.waitForTimeout(300);
    if (await fresh.page.locator('.modal', { hasText: 'Willkommen' }).count() > 0) {
      throw new Error('Einstieg blieb offen');
    }
    const state = await readState(fresh.page);
    if (state.profile.name !== 'Nina') throw new Error(`Name „${state.profile.name}“`);
    if (!state.settings.onboarded) throw new Error('onboarded nicht gesetzt');

    await fresh.page.reload({ waitUntil: 'networkidle' });
    await fresh.page.waitForTimeout(600);
    if (await fresh.page.locator('.modal', { hasText: 'Willkommen' }).count() > 0) {
      throw new Error('Einstieg kam nach dem Neuladen zurück');
    }
  });

  await fresh.ctx.close();

  /* ------------------------------------------------- Serie, Woche, Verfall */

  const home = await newAppContext(browser, { label: 'zuhause', seed: seedHome() });
  errors.push(...home.errors);
  await openTraining(home.page);

  await runner.step('Serie und Wochenvolumen stehen oben auf der Trainingsseite', async () => {
    const strip = home.page.locator('.home-strip');
    if (await strip.count() === 0) throw new Error('Kein Kopfbereich mit Serie/Woche');
    const text = await strip.innerText();
    if (!/Serie/.test(text)) throw new Error(`Keine Serie: ${text}`);
    if (!/diese Woche/.test(text)) throw new Error(`Kein Wochenvolumen: ${text}`);
  });

  await runner.step('Was spürbar an Wertung verliert, meldet sich von selbst', async () => {
    const banner = home.page.locator('.update-banner', { hasText: 'verliert' });
    if (await banner.count() === 0) throw new Error('Keine Verfall-Warnung trotz alter Bestleistung');
    const text = await banner.innerText();
    if (!/Langhantelcurls/.test(text)) throw new Error(`Falsche Übung genannt: ${text}`);
  });

  await runner.step('„Verstanden“ blendet die Warnung aus, auch nach dem Neuladen', async () => {
    await home.page.locator('.update-banner', { hasText: 'verliert' })
      .getByRole('button', { name: 'Verstanden' }).click();
    await home.page.waitForTimeout(250);
    if (await home.page.locator('.update-banner', { hasText: 'verliert' }).count() > 0) {
      throw new Error('Warnung blieb stehen');
    }
    const state = await readState(home.page);
    const today = new Date().toISOString().slice(0, 10);
    if (state.settings.decayWarnShownOn !== today) throw new Error('decayWarnShownOn nicht gesetzt');

    await home.page.reload({ waitUntil: 'networkidle' });
    await home.page.waitForTimeout(600);
    await openTraining(home.page);
    if (await home.page.locator('.update-banner', { hasText: 'verliert' }).count() > 0) {
      throw new Error('Warnung kam nach dem Neuladen zurück');
    }
  });

  /* ------------------------------------------------------ Abschluss-Bildschirm */

  await runner.step('Das Beenden einer Einheit zeigt eine Zusammenfassung', async () => {
    await home.page.getByRole('button', { name: /Zeit messen|Neu starten/ }).click();
    await home.page.waitForTimeout(300);
    /*
     * Je nach Wochentag ist die erste Karte entweder eine Plan-Übung ohne
     * Eintrag (Reihe 0 frei) oder die oben geseedete, bereits abgehakte
     * Bankdrücken-Karte (Reihe 0 belegt) - je nachdem, ob heute laut
     * Standardplan ein Ruhetag ist. Ein neuer Satz wird deshalb immer erst
     * angelegt und dann genau der neue benutzt, statt Reihe 0 zu vermuten:
     * so bleibt die Prüfung unabhängig vom Wochentag.
     */
    const card = home.page.locator('.exercise').first();
    await openCard(card, home.page);
    const before = await card.locator('.set-row').count();
    await card.locator('.exercise__actions').getByRole('button', { name: 'Satz' }).click();
    await home.page.waitForTimeout(200);
    await logSet(home.page, card, { kg: 60, reps: 10, index: before });

    await home.page.getByRole('button', { name: 'Training beenden' }).click();
    await home.page.waitForTimeout(400);

    const modal = home.page.locator('.modal', { hasText: 'Training beendet' });
    if (await modal.count() === 0) throw new Error('Kein Abschluss-Bildschirm');
    const text = await modal.innerText();
    for (const word of ['Volumen', 'Verbrauch', 'Dauer']) {
      if (!text.includes(word)) throw new Error(`„${word}“ fehlt: ${text}`);
    }

    await modal.getByRole('button', { name: 'Fertig' }).click();
    await home.page.waitForTimeout(250);
    if (await home.page.locator('.modal', { hasText: 'Training beendet' }).count() > 0) {
      throw new Error('Abschluss-Bildschirm blieb offen');
    }
  });

  /* --------------------------------------------------------- Kürzere Erklärungen */

  await runner.step('Lange Erklärungen bleiben zu, bis man sie antippt', async () => {
    await openTab(home.page, 'Rang');
    const hint = home.page.locator('.hint', { hasText: 'Tiefe' });
    if (await hint.count() === 0) throw new Error('Kein Hinweis zur Rangformel');
    if (await hint.locator('.hint__detail').count() > 0) throw new Error('Detail war schon offen');

    await hint.locator('.hint__toggle').click();
    await home.page.waitForTimeout(200);
    const detail = hint.locator('.hint__detail');
    if (await detail.count() === 0) throw new Error('Detail öffnete nicht');
    if (!/Grundübungen/.test(await detail.innerText())) throw new Error('Falscher Text im Detail');

    await hint.locator('.hint__toggle').click();
    await home.page.waitForTimeout(200);
    if (await hint.locator('.hint__detail').count() > 0) throw new Error('Detail schloss nicht wieder');
  });

  await home.ctx.close();

  return runner.finish(errors);
}
