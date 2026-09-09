import { createRunner, launchBrowser, logSet, newAppContext, openCard, readState } from './helpers.mjs';

/** Antwort von wger, wie sie fuer eine Anleitung gebraucht wird. */
const WGER_BASEINFO = {
  id: 192,
  images: [{ image: 'https://wger.de/media/exercise-images/192/beispiel.png', is_main: true }],
  videos: [],
  translations: [
    { language: 1, name: 'Bankdrücken', description: '<p>Schulterblätter zusammen.</p><ul><li>Stange zur Brust</li><li>Ellenbogen leicht angelegt</li></ul>' },
    { language: 2, name: 'Bench Press', description: '<p>Retract the scapula.</p>' },
  ],
};

/** Antwort von Open-Meteo: heute Regen. */
function meteoAnswer() {
  const today = new Date();
  // Ortszeit, nicht UTC: "toISOString" verschiebt in manchen Zeitzonen um einen
  // Tag, und dann trifft "heute" im Mock nicht "heute" im Browser.
  const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const days = Array.from({ length: 5 }, (_, index) =>
    iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + index - 2)));
  return {
    daily: {
      time: days,
      weather_code: [0, 3, 63, 1, 2],
      temperature_2m_max: [19, 17, 14.4, 21, 20],
      temperature_2m_min: [9, 8, 7, 11, 10],
      precipitation_probability_max: [5, 20, 85, 10, 15],
      wind_speed_10m_max: [9, 12, 22, 8, 11],
    },
  };
}

/**
 * Vier Wochen Verlauf, damit die Diagramme ueberhaupt zeichnen.
 * Bewusst genau so viel, wie die Schwelle von drei Messpunkten verlangt.
 */
function seedHistory() {
  const today = new Date();
  const workouts = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - index * 7);
    const iso = date.toISOString().slice(0, 10);
    return {
      id: `wo_seed_${index}`,
      date: iso,
      title: 'Push',
      exercises: [{
        id: `le_seed_${index}`,
        exerciseId: 'cat_barbell-bench-press',
        sets: [
          { id: `s_${index}_1`, reps: 8, weightKg: 70 + index * 2.5, durationSec: null, distanceKm: null, rpe: 8, done: true, isWarmup: false },
          { id: `s_${index}_2`, reps: 8, weightKg: 70 + index * 2.5, durationSec: null, distanceKm: null, rpe: 8, done: true, isWarmup: false },
        ],
      }],
      durationMin: 60,
      bodyWeightKg: 80,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  return { workouts };
}

/**
 * Uebung zum Tag hinzufuegen.
 *
 * Steht sie schon im Plan des Tages, ist ihr Treffer deaktiviert - dann bleibt
 * als einziger anklickbarer Eintrag "als eigene Uebung anlegen" uebrig, und
 * der oeffnet ein zweites Fenster, das alles Weitere blockiert. Welcher Tag
 * heute ist, entscheidet also darueber; deshalb wird der Fall hier behandelt
 * statt darauf zu hoffen.
 */
async function addExercise(page, query) {
  await page.locator('.btn--primary', { hasText: 'Übung hinzufügen' }).first().click();
  await page.waitForSelector('.modal');
  await page.locator('.modal .input').first().fill(query);
  await page.waitForTimeout(600);

  const hit = page.locator('.search-result:not([disabled])')
    .filter({ hasNotText: 'als eigene Übung anlegen' }).first();
  if (await hit.count() > 0) {
    await hit.click();
  } else {
    // Schon im Tag - Fenster schliessen und die vorhandene Karte benutzen.
    await page.locator('.modal [aria-label="Schließen"]').first().click();
  }
  await page.waitForTimeout(400);
}

/**
 * Vierte Runde: Rechner, Bedienung im Studio, Ziele, Anleitungen, Wetter.
 *
 * wger und Open-Meteo werden abgefangen. Die echten Dienste sind aus der
 * Pruefumgebung nicht erreichbar, und ein Test, der an einem fremden Server
 * haengt, ist kein Test - er ist eine Wettervorhersage.
 */
export async function run() {
  const runner = createRunner('Vierte Runde');
  const browser = await launchBrowser();
  const { ctx, page, errors } = await newAppContext(browser);

  await ctx.route('https://wger.de/api/v2/exercisebaseinfo/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(WGER_BASEINFO),
  }));
  await ctx.route('https://wger.de/api/v2/exercise/search/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ suggestions: [{ data: { base_id: 192, name: 'Bench Press', category: 'Chest' } }] }),
  }));
  await ctx.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(meteoAnswer()),
  }));
  await ctx.route('https://geocoding-api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      results: [{ name: 'Berlin', latitude: 52.5244, longitude: 13.4105, country: 'Deutschland', admin1: 'Berlin' }],
    }),
  }));
  await ctx.route('https://wger.de/media/**', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>',
  }));

  /* ------------------------------------------------------ Scheibenrechner */

  await runner.step('Scheibenrechner rechnet 82,5 kg auf 25 + 5 + 1,25 je Seite', async () => {
    await addExercise(page, 'Bankdrücken (Langhantel)');
    const card = page.locator('.exercise').last();
    await openCard(card, page);
    const row = card.locator('.set-row').first();
    await row.locator('input').nth(0).fill('82.5');
    await row.locator('input').nth(0).blur();
    await row.locator('input').nth(1).fill('8');
    await row.locator('input').nth(1).blur();
    await page.waitForTimeout(300);

    await card.locator('.btn', { hasText: 'Rechner' }).click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(300);
    const plates = await page.locator('.modal .barbell__read').innerText();
    if (!/25 \+ 5 \+ 1,25/.test(plates)) throw new Error(plates);
    if (!/82,5 kg/.test(plates)) throw new Error(plates);
  });

  await runner.step('Prozenttabelle zeigt 80 % vom geschätzten Maximum', async () => {
    const table = await page.locator('.modal table.data').innerText();
    // 82,5 kg x 8 ergibt nach Epley 104,5 kg; 80 % davon sind gerundet 82,5.
    if (!/104,5/.test(await page.locator('.modal .section-label').first().innerText())) {
      throw new Error(await page.locator('.modal .section-label').first().innerText());
    }
    if (!/80 %\s+82,5 kg/.test(table.replace(/\n/g, ' '))) throw new Error(table.slice(0, 160));
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Scheiben stehen auch neben dem Gewichtsfeld', async () => {
    const card = page.locator('.exercise').last();
    await card.locator('.set-more').first().click();
    await page.waitForTimeout(250);
    const extra = await card.locator('.set-extra').first().innerText();
    if (!/25 \+ 5 \+ 1,25/.test(extra)) throw new Error(extra);
  });

  await runner.step('Satz duplizieren übernimmt Gewicht und Wiederholungen', async () => {
    const card = page.locator('.exercise').last();
    const before = await card.locator('.set-row').count();
    await card.locator('.set-extra .chip', { hasText: 'Satz duplizieren' }).click();
    await page.waitForTimeout(400);
    const after = await card.locator('.set-row').count();
    if (after !== before + 1) throw new Error(`${before} -> ${after}`);
    const copy = card.locator('.set-row').nth(1);
    if (await copy.locator('input').nth(0).inputValue() !== '82.5') {
      throw new Error(await copy.locator('input').nth(0).inputValue());
    }

    // Einen Satz wirklich abhaken - darauf bauen spaetere Schritte auf.
    await card.locator('.set-row').first().locator('.check').click();
    await page.waitForTimeout(600);
    await page.locator('.rest-timer [aria-label="Pause beenden"]').click().catch(() => {});
    await page.waitForTimeout(300);
  });

  /* -------------------------------------------------------- Anleitungen */

  await runner.step('Anleitung aus wger erscheint und bleibt gespeichert', async () => {
    const card = page.locator('.exercise').last();
    await card.locator('.btn', { hasText: 'Mehr' }).first().click();
    await page.waitForTimeout(250);
    await card.locator('.btn', { hasText: 'Fortschritt' }).first().click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(400);

    await page.locator('.modal .btn', { hasText: 'Anleitung nachschlagen' }).click();
    await page.waitForTimeout(900);

    const text = await page.locator('.modal .guide-text').innerText();
    if (!/Schulterblätter/.test(text)) throw new Error(text.slice(0, 120));
    if (!/· Stange zur Brust/.test(text)) throw new Error('Aufzählung verloren');
    if (await page.locator('.modal .guide-shots__item img').count() === 0) throw new Error('kein Bild');

    const cached = await page.evaluate(() => localStorage.getItem('gym-tracker:guides:v1'));
    if (!cached || !cached.includes('Schulterblätter')) throw new Error('nicht gespeichert');
  });

  /* -------------------------------------------------------------- Ziele */

  await runner.step('Ziel mit Datum erscheint mit Fortschritt', async () => {
    await page.locator('.modal .btn', { hasText: 'Ziel setzen' }).first().click();
    await page.waitForTimeout(300);
    const dialog = page.locator('.modal').last();
    await dialog.locator('.field', { hasText: 'Zielwert' }).locator('input').fill('120');
    await dialog.locator('.field', { hasText: 'Zielwert' }).locator('input').blur();
    await page.waitForTimeout(200);
    await dialog.locator('.btn--primary', { hasText: 'Ziel setzen' }).click();
    await page.waitForTimeout(500);

    const state = await readState(page);
    if (state.goals?.length !== 1) throw new Error(JSON.stringify(state.goals));
    if (state.goals[0].targetValue !== 120) throw new Error(JSON.stringify(state.goals[0]));
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(400);
  });

  /* ------------------------------------------------------------- Wetter */

  await runner.step('Ort lässt sich über die Suche setzen', async () => {
    await page.locator('.nav__item', { hasText: 'Profil' }).first().click();
    await page.waitForTimeout(700);
    const card = page.locator('.card', { hasText: 'Wetter beim Training draußen' });
    await card.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(300);
    await card.locator('.field', { hasText: 'Ort' }).locator('input').fill('Berlin');
    await card.locator('.btn', { hasText: 'Suchen' }).click();
    await page.waitForTimeout(700);
    await card.locator('.search-result').first().click();
    await page.waitForTimeout(500);

    const state = await readState(page);
    if (state.settings.weather.lat !== 52.52) throw new Error(JSON.stringify(state.settings.weather));
    if (state.settings.weather.placeName !== 'Berlin') throw new Error(JSON.stringify(state.settings.weather));
  });

  await runner.step('Wetter erscheint nur an Tagen mit Training draußen', async () => {
    await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
    await page.waitForTimeout(600);

    // Ohne Draußen-Übung darf nichts stehen.
    if (await page.locator('.weather').count() !== 0) throw new Error('Wetter ohne Anlass');

    await addExercise(page, 'Joggen draußen');
    await page.waitForTimeout(1500);
    const line = await page.locator('.weather').first().innerText();
    if (!/Regen/.test(line)) throw new Error(line);
    if (!/14°/.test(line)) throw new Error(line);
  });

  /* ------------------------------------------------- Bedienung im Studio */

  await runner.step('RIR statt RPE dreht die Spalte um', async () => {
    await page.locator('.nav__item', { hasText: 'Profil' }).first().click();
    await page.waitForTimeout(700);
    await page.locator('.card', { hasText: 'Im Studio' })
      .locator('label', { hasText: 'RIR' }).locator('input').check();
    await page.waitForTimeout(300);

    await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
    await page.waitForTimeout(600);
    const card = page.locator('.exercise').first();
    await openCard(card, page);
    const head = await card.locator('.set-header').innerText();
    if (!/RIR/.test(head)) throw new Error(head);

    // RIR 2 muss als RPE 8 gespeichert werden.
    const rpeField = card.locator('.set-row').first().locator('input').nth(2);
    await rpeField.fill('2');
    await rpeField.blur();
    await page.waitForTimeout(400);
    const state = await readState(page);
    const values = state.workouts.flatMap((w) => w.exercises).flatMap((e) => e.sets)
      .map((s) => s.rpe).filter((v) => v != null);
    if (!values.includes(8)) throw new Error(JSON.stringify(values));
  });

  await runner.step('Pausenuhr lässt sich groß schalten', async () => {
    const card = page.locator('.exercise').first();
    await card.locator('.btn', { hasText: 'Pause' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('.rest-timer [aria-label="Pausenuhr groß anzeigen"]').click();
    await page.waitForTimeout(400);
    const big = await page.locator('.rest-full__time').innerText();
    if (!/^\d+:\d\d$/.test(big.trim())) throw new Error(big);
    const size = await page.locator('.rest-full__time')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    if (size < 70) throw new Error(`nur ${size}px gross`);
    await page.locator('.rest-full .btn--primary').click();
    await page.waitForTimeout(300);
  });

  await runner.step('Zuletzt benutzte Übungen stehen oben in der Suche', async () => {
    await page.locator('.btn--primary', { hasText: 'Übung hinzufügen' }).first().click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(400);
    const first = await page.locator('.modal .section-label').first().innerText();
    if (!/zuletzt benutzt/i.test(first)) throw new Error(first);
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);
  });

  /* --------------------------------------------------- Wochenblatt, Text */

  await runner.step('Wochenblatt zeigt sieben Tage nebeneinander', async () => {
    await page.locator('.btn', { hasText: 'Verlauf' }).first().click();
    await page.waitForTimeout(700);
    const days = await page.locator('.weeksheet__day').count();
    if (days !== 7) throw new Error(`${days} Spalten`);
    if (await page.locator('.weeksheet__day--done').count() === 0) throw new Error('kein Trainingstag markiert');
  });

  await runner.step('Diagramme haben eine Textfassung für Vorleseprogramme', async () => {
    /*
     * Unter drei Messpunkten zeigt die App absichtlich Zahlen statt eines
     * Diagramms - fuer diese Pruefung braucht es also erst einmal Verlauf.
     * Der wird vorab ins Geraet gelegt, bevor die App startet: Nachtraeglich
     * geschrieben wuerde ihn der Speicher-Rueckschreiber beim Verlassen der
     * Seite gleich wieder ueberschreiben.
     */
    const seeded = await newAppContext(browser, { label: 'verlauf', seed: seedHistory() });
    try {
      await seeded.page.locator('.nav__item', { hasText: 'Fortschritt' }).first().click();
      await seeded.page.waitForTimeout(1100);

      const captions = await seeded.page.locator('.visually-hidden caption').allInnerTexts();
      if (captions.length === 0) throw new Error('keine Textfassung');
      if (!captions.some((text) => /Volumen je Woche/.test(text))) throw new Error(captions.join(' | '));

      const rows = await seeded.page.locator('.visually-hidden tbody tr').count();
      if (rows < 3) throw new Error(`nur ${rows} Zeilen in der Textfassung`);

      // Jede Grafik ist entweder Schmuck (aria-hidden) oder hat einen Namen.
      // Die Koerperkarte etwa traegt einen; die Diagramme sind Schmuck, weil
      // ihr Inhalt daneben als Tabelle steht.
      const loud = await seeded.page.locator('svg:not([aria-hidden="true"]):not([aria-label])').count();
      if (loud > 0) throw new Error(`${loud} Grafiken ohne Beschriftung`);
    } finally {
      await seeded.ctx.close();
    }
  });

  await runner.step('Kontrast der blassesten Schrift reicht für 4,5 zu 1', async () => {
    const ratio = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      const parse = (value) => value.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
      const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
      const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
      const probe = document.createElement('div');
      probe.style.color = styles.getPropertyValue('--text-dim');
      probe.style.background = styles.getPropertyValue('--surface-3');
      document.body.appendChild(probe);
      const fg = lum(parse(getComputedStyle(probe).color));
      const bg = lum(parse(getComputedStyle(probe).backgroundColor));
      probe.remove();
      const hi = Math.max(fg, bg);
      const lo = Math.min(fg, bg);
      return (hi + 0.05) / (lo + 0.05);
    });
    if (ratio < 4.5) throw new Error(`nur ${ratio.toFixed(2)} zu 1`);
  });

  await browser.close();
  return runner.finish(errors);
}
