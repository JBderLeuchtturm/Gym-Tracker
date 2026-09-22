import { createRunner, launchBrowser, newAppContext, readState } from './helpers.mjs';

/*
 * Die Aufgabenliste im Browser: anlegen, abhaken, halb abhaken, wischen,
 * ziehen, filtern, suchen, uebernehmen, auswerten - und ueberleben, wenn die
 * Seite neu geladen wird.
 *
 * Die Rechnerei dahinter (Koerbe, Wiederholung, Gewohnheiten, Kalenderdatei)
 * steht in unit.spec.ts und laeuft ohne Browser.
 */

const iso = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const monday = () => {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

const now = new Date().toISOString();

const todo = (patch) => ({
  id: `todo_${Math.random().toString(36).slice(2, 10)}`,
  title: '',
  note: '',
  categoryId: null,
  scope: 'day',
  period: iso(0),
  priority: 'normal',
  steps: [],
  done: false,
  doneAt: null,
  repeat: null,
  streak: 0,
  doneDates: [],
  order: Date.now() + Math.random() * 1000,
  dueTime: null,
  remindMin: null,
  remindedOn: null,
  tags: [],
  place: '',
  exerciseId: null,
  photoIds: [],
  createdAt: now,
  updatedAt: now,
  ...patch,
});

const CATEGORIES = [
  { id: 'tcat_training', name: 'Training', color: 1, icon: '' },
  { id: 'tcat_alltag', name: 'Alltag', color: 2, icon: '' },
];

const SEED = {
  todoCategories: CATEGORIES,
  todos: [
    todo({ id: 'todo_steps', title: 'Plan überarbeiten', categoryId: 'tcat_training', priority: 'high',
      steps: [
        { id: 'st1', text: 'Push-Tag ordnen', done: false },
        { id: 'st2', text: 'Pull-Tag kürzen', done: false, children: [{ id: 'st2a', text: 'Rudern raus', done: false }] },
      ] }),
    todo({ id: 'todo_simple', title: 'Waschmaschine anstellen', categoryId: 'tcat_alltag' }),
    todo({ id: 'todo_swipe', title: 'Zum Wischen da', categoryId: 'tcat_alltag' }),
    todo({ id: 'todo_repeat', title: 'Dehnen', categoryId: 'tcat_training', repeat: { every: 'day', interval: 1 }, streak: 3 }),
    todo({ id: 'todo_week', title: 'Dreimal ins Studio', scope: 'week', period: monday(), categoryId: 'tcat_training' }),
    todo({ id: 'todo_late', title: 'Wochenbericht schreiben', period: iso(-3), categoryId: 'tcat_alltag' }),
    todo({ id: 'todo_someday', title: 'Mal wieder klettern', scope: 'someday', period: null }),
  ],
};

const findTodo = (state, id) => (state.todos ?? []).find((item) => item.id === id);

/** Die Karte einer Aufgabe anhand ihres Titels. */
const card = (page, title) => page.locator('.todo-item').filter({ hasText: title }).first();

/** Die Abschnitte der Liste, in der Reihenfolge, in der sie stehen. */
const sections = (page) => page.locator('.todo-group__name').allTextContents();

/** Wischt eine Zeile nach links oder rechts - mit dem Zeiger, wie ein Finger. */
async function swipe(page, title, dx) {
  const row = card(page, title).locator('.todo-item__main');
  const box = await row.boundingBox();
  const startX = box.x + box.width * (dx > 0 ? 0.42 : 0.58);
  const y = box.y + box.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(startX + (dx * step) / 10, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(550);
}

export async function run() {
  const runner = createRunner('Aufgabenliste');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser, { seed: SEED, label: 'todos' });

  await page.getByRole('button', { name: 'To-dos' }).first().click();
  await page.waitForTimeout(700);

  await runner.step('Eine Liste, nach Fälligkeit geordnet', async () => {
    const found = await sections(page);
    const expected = ['Überfällig', 'Heute', 'Diese Woche', 'Ohne Datum'];
    for (const label of expected) {
      if (!found.includes(label)) throw new Error(`"${label}" fehlt in ${found.join(' | ')}`);
    }
    // Überfällig steht immer oben, Ohne Datum immer unten.
    if (found.indexOf('Überfällig') !== 0) throw new Error(found.join(' | '));
    if (found.indexOf('Ohne Datum') !== found.length - 1) throw new Error(found.join(' | '));
    // Kein Zeitraum-Umschalter mehr - alles steht in einer Liste.
    if (await page.locator('.todo-scopes').count() > 0) throw new Error('Umschalter noch da');
  });

  await runner.step('Woche und Tag stehen gemeinsam auf dem Bildschirm', async () => {
    const titles = await page.locator('.todo-item__title').allTextContents();
    for (const title of ['Waschmaschine anstellen', 'Dreimal ins Studio', 'Mal wieder klettern']) {
      if (!titles.includes(title)) throw new Error(`${title} fehlt: ${titles.join(' | ')}`);
    }
  });

  await runner.step('Neue Aufgabe über die Schnelleingabe', async () => {
    await page.locator('.todo-add__field').fill('Proteinpulver bestellen');
    await page.locator('.todo-add__field').press('Enter');
    await page.waitForTimeout(500);
    const created = (await readState(page)).todos.find((item) => item.title === 'Proteinpulver bestellen');
    if (!created) throw new Error('Nicht gespeichert');
    if (created.scope !== 'day' || created.period !== iso(0)) throw new Error(`${created.scope}/${created.period}`);
  });

  await runner.step('Die Ablagen legen eine Aufgabe auf morgen', async () => {
    await page.locator('.todo-add__field').fill('Bandagen waschen');
    await page.waitForTimeout(250);
    await page.locator('.todo-add__when .chip').filter({ hasText: 'Morgen' }).click();
    await page.waitForTimeout(500);
    const created = (await readState(page)).todos.find((item) => item.title === 'Bandagen waschen');
    if (!created) throw new Error('Nicht gespeichert');
    if (created.period !== iso(1)) throw new Error(`Zeitraum ${created.period}`);
    if (!(await sections(page)).includes('Morgen')) throw new Error('Kein Abschnitt "Morgen"');
  });

  await runner.step('Abhaken setzt erledigt', async () => {
    await card(page, 'Waschmaschine anstellen').locator('.todo-check').click();
    await page.waitForTimeout(450);
    const item = findTodo(await readState(page), 'todo_simple');
    if (!item.done || !item.doneAt) throw new Error(JSON.stringify({ done: item.done, at: item.doneAt }));
    if ((item.doneDates ?? []).length !== 1) throw new Error('Kein Verlaufseintrag');
  });

  await runner.step('Nach rechts wischen hakt ab', async () => {
    await swipe(page, 'Dehnen', 130);
    const item = findTodo(await readState(page), 'todo_repeat');
    if (item.period !== iso(1)) throw new Error(`Wiederkehrende blieb bei ${item.period}`);
    if (item.streak !== 4) throw new Error(`Serie ${item.streak}`);
  });

  await runner.step('Nach links wischen löscht – mit Rückgängig', async () => {
    await swipe(page, 'Zum Wischen da', -130);
    if (findTodo(await readState(page), 'todo_swipe')) throw new Error('Noch da');
    const toast = await page.locator('.toast').textContent();
    if (!/Rückgängig/.test(toast ?? '')) throw new Error(`Meldung "${toast}"`);
    await page.locator('.toast__action').click();
    await page.waitForTimeout(450);
    if (!findTodo(await readState(page), 'todo_swipe')) throw new Error('Rückgängig hat nichts geholt');
  });

  await runner.step('Teilschritte und Unterpunkte lassen sich einzeln abhaken', async () => {
    const item = card(page, 'Plan überarbeiten');
    await item.locator('.todo-item__toggle').click();
    await page.waitForTimeout(300);
    await item.locator('.todo-step').first().click();
    await page.waitForTimeout(450);
    const stored = findTodo(await readState(page), 'todo_steps');
    if (stored.steps[0].done !== true) throw new Error('Teilschritt nicht gespeichert');
    if (stored.done === true) throw new Error('Aufgabe zu früh erledigt');
    const meta = await item.locator('.todo-item__meta').textContent();
    if (!meta.includes('1/2')) throw new Error(`Zähler "${meta}"`);

    // Der Unterpunkt zieht seinen Oberpunkt nach - und damit die Aufgabe.
    await item.locator('.todo-step--nested').first().click();
    await page.waitForTimeout(450);
    const after = findTodo(await readState(page), 'todo_steps');
    if (after.steps[1].done !== true) throw new Error('Oberpunkt folgt dem Unterpunkt nicht');
    if (after.done !== true) throw new Error('Aufgabe nicht erledigt');
  });

  await runner.step('Kategorie-Filter blendet den Rest aus', async () => {
    await page.locator('.todo-tools .chip').filter({ hasText: 'Training' }).first().click();
    await page.waitForTimeout(350);
    const titles = await page.locator('.todo-item:not(.todo-item--done) .todo-item__title').allTextContents();
    if (titles.includes('Proteinpulver bestellen')) throw new Error('Fremde Kategorie sichtbar');
    await page.locator('.todo-tools .chip').filter({ hasText: 'Alle' }).first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Suche findet über Titel und Teilschritte', async () => {
    await page.getByRole('button', { name: 'Suchen' }).first().click();
    await page.waitForTimeout(250);
    await page.locator('input[aria-label="Suchen"]').fill('protein');
    await page.waitForTimeout(350);
    const titles = await page.locator('.todo-item__title').allTextContents();
    if (titles.length !== 1 || !titles[0].includes('Proteinpulver')) throw new Error(titles.join(' | '));
    await page.locator('input[aria-label="Suchen"]').fill('');
    await page.getByRole('button', { name: 'Suchen' }).first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Liegengebliebenes lässt sich auf heute holen', async () => {
    await page.getByRole('button', { name: /Auf heute holen/ }).click();
    await page.waitForTimeout(550);
    const stored = findTodo(await readState(page), 'todo_late');
    if (stored.period !== iso(0)) throw new Error(`Zeitraum ${stored.period}`);
    if ((await sections(page)).includes('Überfällig')) throw new Error('Abschnitt steht noch');
  });

  await runner.step('Dialog setzt Uhrzeit, Erinnerung und Schlagwort', async () => {
    await card(page, 'Proteinpulver bestellen').locator('.todo-item__body').click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .todo-prio').filter({ hasText: 'Hoch' }).click();
    await page.getByRole('button', { name: 'Uhrzeit setzen' }).click();
    await page.waitForTimeout(250);
    await page.locator('.modal input[type="time"]').fill('17:45');
    await page.waitForTimeout(250);
    await page.locator('.modal select[aria-label="Erinnerung"]').selectOption('30');
    await page.waitForTimeout(250);
    await page.getByRole('button', { name: /Schlagworte, Ort/ }).click();
    await page.locator('.modal input[aria-label="Schlagwort"]').fill('einkauf');
    await page.locator('.modal input[aria-label="Schlagwort"]').press('Enter');
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Schließen' }).click();
    await page.waitForTimeout(400);

    const stored = (await readState(page)).todos.find((item) => item.title === 'Proteinpulver bestellen');
    if (stored.priority !== 'high') throw new Error(`Priorität ${stored.priority}`);
    if (stored.dueTime !== '17:45') throw new Error(`Uhrzeit ${stored.dueTime}`);
    if (stored.remindMin !== 30) throw new Error(`Erinnerung ${stored.remindMin}`);
    if (!stored.tags.includes('einkauf')) throw new Error(`Schlagworte ${stored.tags.join()}`);
    const meta = await card(page, 'Proteinpulver bestellen').locator('.todo-item__meta').textContent();
    if (!meta.includes('17:45') || !meta.includes('#einkauf')) throw new Error(`Zeile "${meta}"`);
  });

  await runner.step('Auswertung zeigt Woche, Kategorien und Gewohnheiten', async () => {
    // Falls ein Schritt davor mit offenem Dialog gescheitert ist.
    while (await page.locator('.modal').count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'Mehr' }).click();
    await page.waitForSelector('.modal');
    await page.getByRole('button', { name: /Auswertung/ }).click();
    await page.waitForTimeout(600);
    if (await page.locator('.todo-week__col').count() !== 7) throw new Error('Kein Wochenbalken');
    if (await page.locator('.habit__grid').count() === 0) throw new Error('Kein Gewohnheits-Raster');
    if (await page.locator('.todo-bars__row').count() === 0) throw new Error('Keine Kategorienbalken');
    await page.getByRole('button', { name: /Zur Liste/ }).click();
    await page.waitForTimeout(500);
    if (await page.locator('.todo-add__field').count() === 0) throw new Error('Nicht zurück in der Liste');
  });

  await runner.step('Kopf zählt offen, erledigt und überfällig', async () => {
    const line = await page.locator('.todo-head__line').textContent();
    if (!/\d+ %/.test(line ?? '')) throw new Error(`Kopfzeile "${line}"`);
    if (!/offen/.test(line ?? '')) throw new Error(`Kopfzeile "${line}"`);
  });

  /*
   * Fuer das Neuladen ein zweiter Kontext ohne vorgegebene Aufgabenliste:
   * Der Seed aus helpers.mjs wird bei jedem Laden der Seite erneut gesetzt
   * und wuerde eine geseedete Liste jedes Mal auf den Anfang zuruecksetzen.
   * Geprueft wird deshalb eine Aufgabe, die im Test selbst entsteht.
   */
  const second = await newAppContext(browser, { seed: { todoCategories: CATEGORIES }, label: 'neu geladen' });

  await runner.step('Selbst angelegtes übersteht das Neuladen', async () => {
    await second.page.getByRole('button', { name: 'To-dos' }).first().click();
    await second.page.waitForTimeout(600);
    for (const title of ['Kreatin nachfüllen', 'Handtücher waschen']) {
      await second.page.locator('.todo-add__field').fill(title);
      await second.page.locator('.todo-add__field').press('Enter');
      await second.page.waitForTimeout(400);
    }
    await card(second.page, 'Kreatin nachfüllen').locator('.todo-check').click();
    await second.page.waitForTimeout(500);

    await second.page.reload({ waitUntil: 'networkidle' });
    await second.page.waitForTimeout(800);
    await second.page.getByRole('button', { name: 'To-dos' }).first().click();
    await second.page.waitForTimeout(600);

    const state = await readState(second.page);
    const kept = (state.todos ?? []).find((item) => item.title === 'Kreatin nachfüllen');
    const open = (state.todos ?? []).find((item) => item.title === 'Handtücher waschen');
    if (!kept || !open) throw new Error('Aufgaben nach dem Neuladen weg');
    if (kept.done !== true) throw new Error('Erledigt ging verloren');
    if (open.done !== false) throw new Error('Offen ist plötzlich erledigt');
    if (!(await second.page.locator('.todo-item__title').allTextContents()).includes('Handtücher waschen')) {
      throw new Error('Zeile fehlt');
    }
  });

  await runner.step('Ziehen sortiert innerhalb eines Abschnitts um', async () => {
    await second.page.locator('.todo-add__field').fill('Ganz nach oben');
    await second.page.locator('.todo-add__field').press('Enter');
    await second.page.waitForTimeout(500);

    const grips = second.page.locator('.todo-item:not(.todo-item--done) .todo-item__grip');
    if (await grips.count() < 2) throw new Error('Zu wenige Zeilen zum Ziehen');
    const before = await second.page.locator('.todo-item:not(.todo-item--done) .todo-item__title').allTextContents();
    const last = await grips.nth(await grips.count() - 1).boundingBox();
    const first = await grips.nth(0).boundingBox();

    await second.page.mouse.move(last.x + last.width / 2, last.y + last.height / 2);
    await second.page.mouse.down();
    for (let step = 1; step <= 10; step += 1) {
      await second.page.mouse.move(
        last.x + last.width / 2,
        last.y + last.height / 2 - (step * (last.y - first.y)) / 10,
      );
      await second.page.waitForTimeout(20);
    }
    await second.page.mouse.up();
    await second.page.waitForTimeout(700);

    const after = await second.page.locator('.todo-item:not(.todo-item--done) .todo-item__title').allTextContents();
    if (after[0] !== before[before.length - 1]) throw new Error(`${before.join()} -> ${after.join()}`);
  });

  await runner.step('Eine gelöschte Kategorie nimmt ihre Aufgaben nicht mit', async () => {
    await second.page.getByRole('button', { name: 'Mehr' }).click();
    await second.page.waitForSelector('.modal');
    await second.page.getByRole('button', { name: 'Kategorien' }).click();
    await second.page.waitForTimeout(400);
    await second.page.locator('.modal .todo-cat-row').first()
      .getByRole('button', { name: 'Kategorie löschen' }).click();
    await second.page.waitForTimeout(250);
    await second.page.locator('.modal .btn--danger').last().click();
    await second.page.waitForTimeout(450);
    const state = await readState(second.page);
    if ((state.todoCategories ?? []).some((item) => item.id === 'tcat_training')) {
      throw new Error('Kategorie noch da');
    }
    if ((state.todos ?? []).length < 3) throw new Error('Aufgaben mitgelöscht');
  });

  await browser.close();
  return runner.finish([...errors, ...second.errors]);
}
