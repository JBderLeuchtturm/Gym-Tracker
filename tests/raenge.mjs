import { createMockBackend } from './mockBackend.mjs';
import { createRunner, launchBrowser, logSet, newAppContext, openCard, readState } from './helpers.mjs';

/**
 * Sechste Runde: schlanke Kalorienseite, Ausgelassenes und die Raenge.
 *
 * Der Rang wird an zwei Stellen geprueft - einmal auf dem eigenen Geraet
 * (rechnet auch ohne Konto) und einmal in der Rangliste, wo zwei Konten
 * nebeneinander stehen. Dass dabei nur Punkte und Stufen die Datenbank
 * erreichen und keine Gewichte, ist die eigentliche Zusicherung.
 */

const iso = (daysBack) => {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  return date.toISOString().slice(0, 10);
};

/** Ein Verlauf, aus dem sich ein Rang rechnen laesst: Bank, Kreuzheben, Rudern. */
function seedRanks() {
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
    durationMin: 55,
    bodyWeightKg: 80,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return {
    workouts: [
      lift('bench', 'cat_barbell-bench-press', 100, 1, 3),
      lift('dead', 'cat_deadlift', 180, 3, 6),
      lift('row', 'cat_barbell-bent-over-row', 80, 8, 9),
    ],
  };
}

const openTab = async (page, name) => {
  await page.locator('.nav__item', { hasText: name }).first().click();
  await page.waitForTimeout(900);
};

/**
 * Zurueck auf den Trainingstag.
 *
 * Die Seite "Heute" faellt beim Tabwechsel auf das heutige Datum zurueck, und
 * heute ist im Standardplan ein freier Tag. Der geplante Tag muss also jedes
 * Mal neu gewaehlt werden.
 */
const openTraining = async (page) => {
  await openTab(page, 'Heute');
  await page.locator('.day-strip__item').first().click();
  await page.waitForTimeout(700);
};

/** Oeffnet die Kalorienseite und blaettert zum gewuenschten Tag zurueck. */
const openCaloriesOn = async (page, date) => {
  await openTab(page, 'Kalorien');
  const days = Math.round((Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
    - Date.parse(`${date}T00:00:00Z`)) / 86400000);
  for (let step = 0; step < days; step += 1) {
    await page.getByLabel('Vorheriger Tag').click();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(400);
};

export async function run() {
  const runner = createRunner('Kalorien, Ausgelassenes und Ränge');
  const browser = await launchBrowser();
  const errors = [];

  /* ------------------------------------------------ Kalorien: nur das Nötige */

  const solo = await newAppContext(browser, { label: 'kalorien', seed: seedRanks() });
  errors.push(...solo.errors);

  await runner.step('Kalorien zeigt zuerst nur Kalorien und Protein', async () => {
    await openTab(solo.page, 'Kalorien');
    const text = await solo.page.locator('.page').innerText();
    if (!/Kalorien/.test(text)) throw new Error('Keine Kalorienangabe');
    if (/Kohlenhydrate/.test(text)) throw new Error('Kohlenhydrate stehen offen da');
    if (/Yazio/.test(text)) throw new Error('Yazio steht offen da');
  });

  await runner.step('„Mehr“ holt Kohlenhydrate, Fett und Yazio hervor', async () => {
    await solo.page.getByRole('button', { name: 'Mehr' }).first().click();
    await solo.page.waitForTimeout(400);
    const text = await solo.page.locator('.page').innerText();
    if (!/Kohlenhydrate/.test(text)) throw new Error('Kohlenhydrate fehlen');
    if (!/Yazio/.test(text)) throw new Error('Yazio fehlt');
  });

  await runner.step('Der Verlauf der letzten 30 Tage bleibt zugeklappt', async () => {
    const text = await solo.page.locator('.page').innerText();
    if (!/Verlauf der letzten 30 Tage zeigen/.test(text) && /Verlauf/.test(text)) {
      // Ohne Einträge gibt es gar keinen Verlauf - dann ist auch nichts zu viel.
      throw new Error('Verlauf steht offen da');
    }
  });

  /* --------------------------------------------- Übung und Satz auslassen */

  const gym = await newAppContext(browser, { label: 'auslassen' });
  errors.push(...gym.errors);

  let firstName = '';
  let trainingDay = '';
  await runner.step('Eine geplante Übung lässt sich auslassen', async () => {
    await openTraining(gym.page);
    const card = gym.page.locator('.exercise').first();
    firstName = (await card.locator('.exercise__name').first().innerText()).trim();

    // Erst arbeiten, dann auslassen: So laesst sich pruefen, dass der schon
    // eingetragene Satz aus dem Verbrauch wieder verschwindet.
    await logSet(gym.page, gym.page.locator('.exercise').first(), { kg: 60, reps: 10 });
    trainingDay = (await readState(gym.page)).workouts.at(-1).date;
    await openCaloriesOn(gym.page, trainingDay);
    if (!(await gym.page.locator('.page').innerText()).includes(firstName)) {
      throw new Error(`„${firstName}“ fehlt im Verbrauch, bevor überhaupt ausgelassen wird`);
    }
    await openTraining(gym.page);

    await openCard(card, gym.page);
    await card.locator('.exercise__actions').getByRole('button', { name: 'Mehr' }).click();
    await gym.page.waitForTimeout(300);
    await card.getByRole('button', { name: 'Heute auslassen' }).click();
    await gym.page.waitForTimeout(700);

    if (await card.locator('.tag--skipped').count() === 0) {
      throw new Error('Keine Kennzeichnung „ausgelassen“');
    }
    const classes = await card.getAttribute('class');
    if (!classes.includes('exercise--skipped')) throw new Error(`Karte unverändert: ${classes}`);
  });

  await runner.step('Die ausgelassene Übung steht im Stand und zählt nicht mit', async () => {
    const state = await readState(gym.page);
    const workout = state.workouts.at(-1);
    const skipped = workout.exercises.find((item) => item.skipped);
    if (!skipped) throw new Error('Nichts als ausgelassen gespeichert');
    if (skipped.sets.some((item) => item.done)) throw new Error('Offene Haken blieben stehen');
  });

  await runner.step('Ausgelassenes zählt nicht in den Kalorienverbrauch', async () => {
    await openCaloriesOn(gym.page, trainingDay);
    const text = await gym.page.locator('.page').innerText();
    if (firstName && text.includes(firstName)) {
      throw new Error(`„${firstName}“ steht trotzdem in der Verbrauchsliste`);
    }
  });

  await runner.step('„Doch machen“ nimmt das Auslassen zurück', async () => {
    await openTraining(gym.page);
    const card = gym.page.locator('.exercise').first();
    await openCard(card, gym.page);
    await card.locator('.exercise__actions').getByRole('button', { name: 'Mehr' }).click();
    await gym.page.waitForTimeout(300);
    await card.getByRole('button', { name: 'Doch machen' }).click();
    await gym.page.waitForTimeout(700);
    if (await card.locator('.tag--skipped').count() > 0) throw new Error('Bleibt ausgelassen');
  });

  await runner.step('Ein einzelner Satz lässt sich auslassen', async () => {
    const card = gym.page.locator('.exercise').first();
    await openCard(card, gym.page);
    const row = card.locator('.set-row').first();
    await row.locator('.set-more').click();
    await gym.page.waitForTimeout(350);
    await card.locator('.set-extra').getByRole('button', { name: 'Satz auslassen' }).click();
    await gym.page.waitForTimeout(700);

    const state = await readState(gym.page);
    const sets = state.workouts.at(-1).exercises[0].sets;
    if (!sets.some((item) => item.skipped)) throw new Error('Nichts als ausgelassen gespeichert');

    const back = card.locator('.set-extra').getByRole('button', { name: 'Satz doch machen' });
    if (await back.count() === 0) throw new Error('Kein Weg zurück');
  });

  await runner.step('Abhaken holt einen ausgelassenen Satz zurück', async () => {
    const card = gym.page.locator('.exercise').first();
    await card.locator('.set-row').first().locator('.check').click();
    await gym.page.waitForTimeout(700);
    const state = await readState(gym.page);
    const first = state.workouts.at(-1).exercises[0].sets[0];
    if (first.skipped) throw new Error('Bleibt ausgelassen');
    if (!first.done) throw new Error('Nicht abgehakt');
  });

  await gym.ctx.close();

  /* ------------------------------------------------------- Rang ohne Konto */

  await runner.step('Der Rang steht auf der Fortschrittsseite', async () => {
    await openTab(solo.page, 'Fortschritt');
    const panel = solo.page.locator('.rank-head');
    if (await panel.count() === 0) throw new Error('Kein Rangfeld');
    const text = await solo.page.locator('.section', { has: solo.page.locator('.rank-head') }).innerText();
    if (!/3 von 21 Bewegungen/.test(text)) {
      throw new Error(`Falsche Abdeckung: ${text.replace(/\n/g, ' | ')}`);
    }
    if (!/Übungen mit eigenem Rang/.test(text)) throw new Error('Kein Weg in die Vollansicht');
  });

  await runner.step('Der nächste Schritt nennt eine Bewegung und einen Wert', async () => {
    const step = await solo.page.locator('.next-step').innerText();
    if (!/kg|Wdh|min|\bs\b/.test(step)) throw new Error(`Kein Wert: ${step.replace(/\n/g, ' | ')}`);
    if (!/Kniebeuge|Schulterdrücken|Bizepscurl|Rudern|Bankdrücken|Kreuzheben|Dips|Liegestütze|Klimmzug|Latzug/.test(step)) {
      throw new Error(`Keine Bewegung genannt: ${step.replace(/\n/g, ' | ')}`);
    }
  });

  await runner.step('Die Stufenleiste überlappt nicht', async () => {
    const boxes = await solo.page.locator('.tier-scale__step').evaluateAll(
      (list) => list.map((el) => el.getBoundingClientRect()).map((b) => ({
        left: b.left, right: b.right, top: b.top, bottom: b.bottom,
      })));
    if (boxes.length !== 5) throw new Error(`${boxes.length} Stufen`);
    for (let a = 0; a < boxes.length; a += 1) {
      for (let b = a + 1; b < boxes.length; b += 1) {
        const overlap = boxes[a].right > boxes[b].left + 0.5
          && boxes[b].right > boxes[a].left + 0.5
          && boxes[a].bottom > boxes[b].top + 0.5
          && boxes[b].bottom > boxes[a].top + 0.5;
        if (overlap) throw new Error(`Stufe ${a + 1} und ${b + 1} liegen übereinander`);
      }
    }
  });

  /* ------------------------------------------------------- Die Vollansicht */

  await runner.step('Die Vollansicht zeigt, woraus sich der Rang ergibt', async () => {
    await solo.page.locator('.rank-open').click();
    await solo.page.waitForTimeout(900);
    const hero = await solo.page.locator('.rank-hero').innerText();
    if (!/\/100/.test(hero)) throw new Error(`Kein Punktestand: ${hero.replace(/\n/g, ' | ')}`);

    const formula = await solo.page.locator('.formula').innerText();
    for (const word of ['Tiefe', 'Breite', 'Punkte']) {
      if (!formula.includes(word)) throw new Error(`„${word}“ fehlt in der Rechnung`);
    }
  });

  await runner.step('Jede Bewegung zeigt ihre fünf Schwellen in Kilogramm', async () => {
    await solo.page.locator('.seg__item', { hasText: 'Bewegungen' }).click();
    await solo.page.waitForTimeout(600);
    const rows = await solo.page.locator('.move-row').count();
    if (rows !== 21) throw new Error(`${rows} Bewegungen statt 21`);

    await solo.page.locator('.move-row__head').first().click();
    await solo.page.waitForTimeout(400);
    const cells = await solo.page.locator('.threshold').count();
    if (cells !== 5) throw new Error(`${cells} Schwellen`);
    const body = await solo.page.locator('.move-row__body').first().innerText();
    if (!/Einsteiger/.test(body) || !/Elite/.test(body)) throw new Error(body.replace(/\n/g, ' | '));
  });

  await runner.step('Jede einzelne Übung hat einen eigenen Rang', async () => {
    await solo.page.locator('.seg__item', { hasText: 'Übungen' }).click();
    await solo.page.waitForTimeout(600);
    const rows = await solo.page.locator('.ex-rank').count();
    if (rows < 3) throw new Error(`${rows} Übungen`);
    const text = await solo.page.locator('.ex-rank').first().innerText();
    if (!/Einsteiger|Geübt|Fortgeschritten|Stark|Elite/.test(text)) {
      throw new Error(`Keine Stufe: ${text.replace(/\n/g, ' | ')}`);
    }
  });

  await runner.step('Erfolge zeigen Erreichtes und den Stand bei den offenen', async () => {
    await solo.page.locator('.seg__item', { hasText: 'Erfolge' }).click();
    await solo.page.waitForTimeout(700);
    const count = await solo.page.locator('.badge').count();
    if (count < 30) throw new Error(`Nur ${count} Erfolge`);
    const open = await solo.page.locator('.badge:not(.badge--earned)').first().innerText();
    if (!/von/.test(open)) throw new Error(`Kein Stand am offenen Erfolg: ${open.replace(/\n/g, ' ')}`);
    if (await solo.page.locator('.badge--earned').count() === 0) {
      throw new Error('Mit drei Bewegungen sollte etwas erreicht sein');
    }
  });

  await runner.step('Ohne Konto steht da, dass der Vergleich ein Konto braucht', async () => {
    await solo.page.locator('.seg__item', { hasText: 'Vergleich' }).click();
    await solo.page.waitForTimeout(600);
    const text = await solo.page.locator('.page').innerText();
    if (!/Konto/.test(text)) throw new Error('Kein Hinweis auf das Konto');
    if (/Am Rangvergleich teilnehmen/.test(text)) throw new Error('Teilnahme ohne Konto angeboten');
  });

  await solo.ctx.close();

  /* ------------------------------------------------------------- Rangliste */

  const backend = createMockBackend();
  const signUp = async (page, email) => {
    await openTab(page, 'Freunde');
    await page.getByRole('button', { name: 'Noch kein Konto? Jetzt anlegen' }).click();
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill('geheim123');
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await page.waitForTimeout(1800);
  };
  /* Die Zustimmung liegt seit der Vollansicht im Reiter "Vergleich". */
  const openComparison = async (page) => {
    await openTab(page, 'Fortschritt');
    const back = page.locator('.rank-open');
    if (await back.count() > 0) { await back.click(); await page.waitForTimeout(800); }
    await page.locator('.seg__item', { hasText: 'Vergleich' }).click();
    await page.waitForTimeout(700);
  };
  const joinBoard = async (page) => {
    await openComparison(page);
    await page.getByText('Am Rangvergleich teilnehmen').click();
    await page.waitForTimeout(2600);
  };
  const showBoard = async (page) => {
    await page.waitForTimeout(900);
  };

  const a = await newAppContext(browser, { backend, label: 'A', seed: seedRanks() });
  errors.push(...a.errors);
  const b = await newAppContext(browser, {
    backend, label: 'B',
    seed: { workouts: seedRanks().workouts.slice(0, 1) },  // nur Bankdrücken: schwächer
  });
  errors.push(...b.errors);

  await runner.step('Ohne Zustimmung steht nichts in der Rangliste', async () => {
    await signUp(a.page, 'anna@example.com');
    await openComparison(a.page);
    await a.page.waitForTimeout(1500);
    if (backend.db.rank_board.size !== 0) {
      throw new Error(`${backend.db.rank_board.size} Zeilen ohne Zustimmung`);
    }
  });

  await runner.step('Mit Zustimmung wird der eigene Stand veröffentlicht', async () => {
    await joinBoard(a.page);
    if (backend.db.rank_board.size !== 1) {
      throw new Error(`${backend.db.rank_board.size} Zeilen`);
    }
  });

  await runner.step('Veröffentlicht werden nur Punkte, Stufen und der Name', async () => {
    const row = [...backend.db.rank_board.values()][0];
    const allowed = new Set([
      'user_id', 'display_name', 'emoji', 'score', 'tier', 'covered', 'parts', 'updated_at',
    ]);
    const extra = Object.keys(row).filter((key) => !allowed.has(key));
    if (extra.length > 0) throw new Error(`Zusätzliche Felder: ${extra.join(', ')}`);

    const serialized = JSON.stringify(row);
    for (const leak of ['weightKg', 'bodyWeight', 'bestKg', 'workouts', 'sets']) {
      if (serialized.includes(leak)) throw new Error(`„${leak}“ steht in der Zeile`);
    }
    // Die Stufe je Bewegung ist erlaubt, das Gewicht dahinter nicht.
    for (const value of Object.values(row.parts ?? {})) {
      if (typeof value !== 'string') throw new Error(`Kein Stufenname: ${JSON.stringify(value)}`);
    }
    if (typeof row.score !== 'number' || row.score <= 0) throw new Error(`Punktestand ${row.score}`);
  });

  await runner.step('Das zweite Konto steht daneben, der stärkere oben', async () => {
    await signUp(b.page, 'ben@example.com');
    await joinBoard(b.page);
    if (backend.db.rank_board.size !== 2) {
      throw new Error(`${backend.db.rank_board.size} Zeilen`);
    }
    await showBoard(b.page);
    const rows = b.page.locator('.board-row');
    if (await rows.count() !== 2) throw new Error(`${await rows.count()} Zeilen in der Liste`);

    const scores = (await rows.locator('.mono').allInnerTexts()).map((value) => Number(value));
    if (!(scores[0] >= scores[1])) throw new Error(`Reihenfolge ${scores.join(' / ')}`);

    const me = b.page.locator('.board-row--me');
    if (await me.count() !== 1) throw new Error('Das eigene Konto ist nicht hervorgehoben');
  });

  await runner.step('Freunde werden in der Rangliste erkannt', async () => {
    await openTab(a.page, 'Freunde');
    const handleA = (await a.page.locator('.tiny.dim').first().textContent()).trim().replace('@', '');
    await openTab(b.page, 'Freunde');
    await b.page.getByPlaceholder('Benutzername, z. B. jan-4f2a').fill(handleA);
    await b.page.getByRole('button', { name: 'Anfragen' }).click();
    await b.page.waitForTimeout(1200);

    await openTab(a.page, 'Freunde');
    await a.page.getByRole('button', { name: 'Abgleichen' }).click();
    await a.page.waitForTimeout(1500);
    await a.page.getByRole('button', { name: 'Annehmen' }).click();
    await a.page.waitForTimeout(1500);

    if (backend.db.friendships[0]?.status !== 'accepted') {
      throw new Error(`Freundschaft steht auf „${backend.db.friendships[0]?.status}“`);
    }

    await openTab(b.page, 'Freunde');
    await b.page.getByRole('button', { name: 'Abgleichen' }).click();
    await b.page.waitForTimeout(2000);
    await openComparison(b.page);
    await showBoard(b.page);
    const all = await b.page.locator('.board-row').allInnerTexts();
    // Die Kennzeichnung steht in Grossbuchstaben - das macht die Schriftart.
    if (!all.some((line) => /freund/i.test(line))) {
      throw new Error(`Kein Freund gekennzeichnet: ${all.join(' / ').replace(/\n/g, ' ')}`);
    }
  });

  await runner.step('Wer die Zustimmung zurücknimmt, verschwindet aus der Liste', async () => {
    await openComparison(b.page);
    await b.page.getByText('Am Rangvergleich teilnehmen').click();
    await b.page.waitForTimeout(1800);
    if (backend.db.rank_board.size !== 1) {
      throw new Error(`${backend.db.rank_board.size} Zeilen nach dem Austritt`);
    }
    if ([...backend.db.rank_board.values()].some((row) => row.display_name === 'ben')) {
      throw new Error('Die eigene Zeile blieb stehen');
    }
    const state = await readState(b.page);
    if (state.settings.shareRank) throw new Error('Die Einstellung blieb an');
  });

  await a.ctx.close();
  await b.ctx.close();
  await browser.close();
  return runner.finish(errors);
}
