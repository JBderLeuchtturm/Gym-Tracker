import { createRunner, launchBrowser, newAppContext, readState } from './helpers.mjs';

/*
 * Die Aufgabenliste: anlegen, abhaken, halb abhaken, filtern, Zeitraum
 * wechseln, wiederholen, uebernehmen - und ueberleben, wenn die Seite neu
 * geladen wird.
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
  order: Date.now() + Math.random() * 1000,
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
        { id: 'st2', text: 'Pull-Tag kürzen', done: false },
      ] }),
    todo({ id: 'todo_simple', title: 'Waschmaschine anstellen', categoryId: 'tcat_alltag' }),
    todo({ id: 'todo_repeat', title: 'Dehnen', categoryId: 'tcat_training', repeat: { every: 'day', interval: 1 }, streak: 3 }),
    todo({ id: 'todo_week', title: 'Dreimal ins Studio', scope: 'week', period: monday(), categoryId: 'tcat_training' }),
    todo({ id: 'todo_late', title: 'Wochenbericht schreiben', period: iso(-3), categoryId: 'tcat_alltag' }),
    todo({ id: 'todo_someday', title: 'Mal wieder klettern', scope: 'someday', period: null }),
  ],
};

const findTodo = (state, id) => (state.todos ?? []).find((item) => item.id === id);

/** Die Karte einer Aufgabe anhand ihres Titels. */
const card = (page, title) => page.locator('.todo-item').filter({ hasText: title }).first();

export async function run() {
  const runner = createRunner('Aufgabenliste');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser, { seed: SEED, label: 'todos' });

  await page.getByRole('button', { name: 'To-dos' }).first().click();
  await page.waitForTimeout(600);

  await runner.step('Reiter öffnet die Aufgabenliste', async () => {
    if (await page.locator('.todo-scopes').count() === 0) throw new Error('Kein Zeitraum-Umschalter');
    const titles = await page.locator('.todo-item__title').allTextContents();
    if (!titles.includes('Waschmaschine anstellen')) throw new Error(titles.join(' | '));
    // Die Wochenaufgabe gehoert nicht in den Tag.
    if (titles.includes('Dreimal ins Studio')) throw new Error('Wochenaufgabe steht im Tag');
  });

  await runner.step('Neue Aufgabe über die Schnelleingabe', async () => {
    await page.locator('.todo-add__field').fill('Proteinpulver bestellen');
    await page.locator('.todo-add__field').press('Enter');
    await page.waitForTimeout(500);
    const state = await readState(page);
    const created = (state.todos ?? []).find((item) => item.title === 'Proteinpulver bestellen');
    if (!created) throw new Error('Nicht gespeichert');
    if (created.scope !== 'day' || created.period !== iso(0)) throw new Error(`${created.scope}/${created.period}`);
  });

  await runner.step('Abhaken setzt erledigt', async () => {
    await card(page, 'Waschmaschine anstellen').locator('.todo-check').click();
    await page.waitForTimeout(450);
    const state = await readState(page);
    const item = findTodo(state, 'todo_simple');
    if (!item.done || !item.doneAt) throw new Error(JSON.stringify({ done: item.done, at: item.doneAt }));
  });

  await runner.step('Erledigte wandern in den eigenen Abschnitt', async () => {
    const open = await page.locator('.todo-item:not(.todo-item--done) .todo-item__title').allTextContents();
    if (open.includes('Waschmaschine anstellen')) throw new Error('Steht noch bei den offenen');
    const heading = page.locator('.todo-group__head').filter({ hasText: 'Erledigt' });
    if (await heading.count() === 0) throw new Error('Kein Abschnitt "Erledigt"');
  });

  await runner.step('Teilschritte lassen sich einzeln abhaken', async () => {
    const item = card(page, 'Plan überarbeiten');
    await item.locator('.todo-item__toggle').click();
    await page.waitForTimeout(300);
    await item.locator('.todo-step').first().click();
    await page.waitForTimeout(450);
    const state = await readState(page);
    const stored = findTodo(state, 'todo_steps');
    if (stored.steps[0].done !== true) throw new Error('Teilschritt nicht gespeichert');
    if (stored.done === true) throw new Error('Aufgabe zu früh erledigt');
    const meta = await item.locator('.todo-item__meta').textContent();
    if (!meta.includes('1/2')) throw new Error(`Zähler "${meta}"`);
  });

  await runner.step('Der letzte Teilschritt hakt die Aufgabe mit ab', async () => {
    const item = card(page, 'Plan überarbeiten');
    await item.locator('.todo-step').nth(1).click();
    await page.waitForTimeout(450);
    const stored = findTodo(await readState(page), 'todo_steps');
    if (stored.done !== true) throw new Error('Aufgabe nicht erledigt');
  });

  await runner.step('Wiederkehrende Aufgabe rückt einen Tag weiter', async () => {
    await card(page, 'Dehnen').locator('.todo-check').click();
    await page.waitForTimeout(500);
    const stored = findTodo(await readState(page), 'todo_repeat');
    if (stored.done === true) throw new Error('Bleibt erledigt stehen statt weiterzurücken');
    if (stored.period !== iso(1)) throw new Error(`Neuer Zeitraum ${stored.period}`);
    if (stored.streak !== 4) throw new Error(`Serie ${stored.streak}`);
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

  await runner.step('Woche zeigt die Wochenaufgaben', async () => {
    await page.getByRole('tab', { name: 'Woche' }).click();
    await page.waitForTimeout(400);
    const titles = await page.locator('.todo-item__title').allTextContents();
    if (!titles.includes('Dreimal ins Studio')) throw new Error(titles.join(' | '));
    if (titles.includes('Proteinpulver bestellen')) throw new Error('Tagesaufgabe steht in der Woche');
  });

  await runner.step('Später sammelt, was keinen Termin hat', async () => {
    await page.getByRole('tab', { name: 'Später' }).click();
    await page.waitForTimeout(400);
    const titles = await page.locator('.todo-item__title').allTextContents();
    if (titles.join() !== 'Mal wieder klettern') throw new Error(titles.join(' | '));
    if (await page.locator('.todo-period').count() !== 0) throw new Error('Zeitraum-Blätterung sichtbar');
  });

  await runner.step('Liegengebliebenes lässt sich auf heute holen', async () => {
    await page.getByRole('tab', { name: 'Tag' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Auf heute holen' }).click();
    await page.waitForTimeout(500);
    const stored = findTodo(await readState(page), 'todo_late');
    if (stored.period !== iso(0)) throw new Error(`Zeitraum ${stored.period}`);
    if (!(await page.locator('.todo-item__title').allTextContents()).includes('Wochenbericht schreiben')) {
      throw new Error('Steht nicht im heutigen Tag');
    }
  });

  await runner.step('Dialog ändert Priorität und Zeitraum', async () => {
    await card(page, 'Proteinpulver bestellen').locator('.todo-item__body').click();
    await page.waitForSelector('.modal');
    await page.locator('.modal .todo-prio').filter({ hasText: 'Hoch' }).click();
    await page.locator('.modal .chip').filter({ hasText: 'Morgen' }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: 'Schließen' }).click();
    await page.waitForTimeout(350);
    const stored = (await readState(page)).todos.find((item) => item.title === 'Proteinpulver bestellen');
    if (stored.priority !== 'high') throw new Error(`Priorität ${stored.priority}`);
    if (stored.period !== iso(1)) throw new Error(`Zeitraum ${stored.period}`);
  });

  await runner.step('Überblick zählt offen und erledigt', async () => {
    const facts = await page.locator('.todo-fact__value').allTextContents();
    if (facts.length !== 3) throw new Error(facts.join('|'));
    if (facts.some((value) => !/^\d+$/.test(value.trim()))) throw new Error(facts.join('|'));
    const ring = await page.locator('.todo-ring__text').textContent();
    if (!/^\d+$/.test(ring.trim())) throw new Error(`Ring "${ring}"`);
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
    await second.page.locator('.todo-add__field').fill('Kreatin nachfüllen');
    await second.page.locator('.todo-add__field').press('Enter');
    await second.page.waitForTimeout(400);
    await second.page.locator('.todo-add__field').fill('Handtücher waschen');
    await second.page.locator('.todo-add__field').press('Enter');
    await second.page.waitForTimeout(400);
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
    const titles = await second.page.locator('.todo-item__title').allTextContents();
    if (!titles.includes('Handtücher waschen')) throw new Error(titles.join(' | '));
  });

  await runner.step('Eine gelöschte Kategorie nimmt ihre Aufgaben nicht mit', async () => {
    await second.page.locator('.todo-tools .chip').filter({ hasText: 'Kategorien' }).click();
    await second.page.waitForSelector('.modal');
    await second.page.locator('.modal .todo-cat-row').first()
      .getByRole('button', { name: 'Kategorie löschen' }).click();
    await second.page.waitForTimeout(250);
    await second.page.locator('.modal .btn--danger').last().click();
    await second.page.waitForTimeout(450);
    const state = await readState(second.page);
    if ((state.todoCategories ?? []).some((item) => item.id === 'tcat_training')) {
      throw new Error('Kategorie noch da');
    }
    if ((state.todos ?? []).length < 2) throw new Error('Aufgaben mitgelöscht');
  });

  await browser.close();
  return runner.finish([...errors, ...second.errors]);
}
