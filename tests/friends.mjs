import { createMockBackend } from './mockBackend.mjs';
import { createRunner, launchBrowser, newAppContext, openCard } from './helpers.mjs';

/** Kompletter Freunde-Ablauf mit zwei Konten gegen ein nachgebautes Supabase. */
export async function run() {
  const runner = createRunner('Freunde und Freigaben');
  const backend = createMockBackend();
  const browser = await launchBrowser();
  const openPages = [];
  const errors = [];
  const step = runner.step;

  async function closeStrayModals() {
    for (const page of openPages) {
      if (page.isClosed()) continue;
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (await page.locator('.modal-backdrop').count() === 0) break;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(220);
        }
      } catch { /* Seite bereits zu */ }
    }
  }

  const guarded = async (label, fn) => {
    const before = runner.problems.length;
    await step(label, fn);
    if (runner.problems.length > before) await closeStrayModals();
  };

  async function makeUser(label) {
    const created = await newAppContext(browser, { backend, label });
    openPages.push(created.page);
    errors.push(...[]);
    created.page.on('pageerror', () => {});
    return created;
  }

  const openFriends = async (page) => {
    await page.locator('.nav__item').nth(4).click();
    await page.waitForTimeout(500);
  };

  const signUp = async (page, email) => {
    await openFriends(page);
    await page.getByRole('button', { name: 'Noch kein Konto? Jetzt anlegen' }).click();
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill('geheim123');
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await page.waitForTimeout(1800);
  };

  /* ---------------------------------------------------------------- Nutzer A */
  
  const a = await makeUser('A');
  await guarded('A: Freunde-Tab ohne Konto zeigt Anmeldung', async () => {
    await openFriends(a.page);
    if (await a.page.getByRole('button', { name: 'Anmelden' }).count() === 0) throw new Error('Kein Anmeldeformular');
  });
  
  await guarded('A: Gewichte eintragen', async () => {
    await a.page.locator('.nav__item').nth(5).click();
    await a.page.waitForTimeout(500);
    for (const [days, kg] of [[14, 84.2], [7, 83.6], [0, 83.1]]) {
      await a.page.getByRole('button', { name: 'Eintrag', exact: true }).click();
      await a.page.waitForSelector('.modal');
      const date = new Date(); date.setDate(date.getDate() - days);
      const iso = date.toISOString().slice(0, 10);
      await a.page.locator('.modal input[type=date]').fill(iso);
      const field = a.page.locator('.modal .input--num').first();
      await field.fill(String(kg)); await field.blur();
      await a.page.getByRole('button', { name: 'Speichern' }).click();
      await a.page.waitForTimeout(500);
    }
  });
  
  await guarded('A: Konto anlegen', async () => {
    await signUp(a.page, 'anna@example.com');
    if (await a.page.locator('text=Freund hinzufügen').count() === 0) throw new Error('Nicht angemeldet');
  });
  
  const handleA = (await a.page.locator('.tiny.dim').first().textContent())?.trim();
  console.log('    Benutzername A:', handleA);
  
  await guarded('A: Trainingsstand liegt auf dem Server', async () => {
    if (backend.db.user_state.size !== 1) throw new Error(`user_state=${backend.db.user_state.size}`);
    if (backend.db.share_payloads.length !== 3) throw new Error(`payloads=${backend.db.share_payloads.length}`);
  });
  
  /* ---------------------------------------------------------------- Nutzer B */
  
  const b = await makeUser('B');
  await guarded('B: Konto anlegen', async () => {
    await signUp(b.page, 'ben@example.com');
  });
  const handleB = (await b.page.locator('.tiny.dim').first().textContent())?.trim();
  console.log('    Benutzername B:', handleB);
  
  await guarded('B: unbekannten Namen anfragen schlägt sauber fehl', async () => {
    await b.page.getByPlaceholder('Benutzername, z. B. jan-4f2a').fill('gibtesnicht');
    await b.page.getByRole('button', { name: 'Anfragen' }).click();
    await b.page.waitForTimeout(700);
    const msg = await b.page.locator('text=/Niemand mit dem Namen/').count();
    if (msg === 0) throw new Error('Keine Fehlermeldung');
  });
  
  await guarded('B: Anfrage an A schicken', async () => {
    await b.page.getByPlaceholder('Benutzername, z. B. jan-4f2a').fill(handleA.replace('@', ''));
    await b.page.getByRole('button', { name: 'Anfragen' }).click();
    await b.page.waitForTimeout(900);
    if (backend.db.friendships.length !== 1) throw new Error('Keine Freundschaftszeile');
    if (await b.page.locator('text=Von dir verschickt').count() === 0) throw new Error('Nicht als ausgehend angezeigt');
  });
  
  await guarded('A: sieht die Anfrage nach Abgleich', async () => {
    await a.page.getByRole('button', { name: 'Abgleichen' }).click();
    await a.page.waitForTimeout(1200);
    if (await a.page.locator('text=Offene Anfragen an dich').count() === 0) throw new Error('Anfrage fehlt');
  });
  
  await guarded('A: Anfrage annehmen', async () => {
    await a.page.getByRole('button', { name: 'Annehmen' }).click();
    await a.page.waitForTimeout(1200);
    const link = backend.db.friendships[0];
    if (link.status !== 'accepted') throw new Error('Status nicht accepted');
    if (backend.db.share_grants.length !== 2) throw new Error(`Standardfreigaben=${backend.db.share_grants.length}`);
  });
  
  await guarded('A: Freund erscheint in der Liste', async () => {
    await a.page.waitForTimeout(800);
    if (await a.page.locator('text=Freunde (1)').count() === 0) throw new Error('Liste leer');
  });
  
  /* ------------------------------------------------------- Sichtbarkeit */
  
  await guarded('B: sieht As Fortschritt, aber nicht Gewicht/Kalorien', async () => {
    await b.page.getByRole('button', { name: 'Abgleichen' }).click();
    await b.page.waitForTimeout(1500);
    await b.page.locator('.search-result').first().click();
    await b.page.waitForTimeout(900);
    const text = await b.page.locator('.modal').innerText();
    if (!text.includes('Trainings')) throw new Error('Fortschritt fehlt');
    if (text.includes('Körpergewicht')) throw new Error('Gewicht sichtbar, obwohl nicht freigegeben');
  });
  
  await guarded('B: Vergleich zeigt gemeinsame Übungen', async () => {
    await b.page.getByRole('button', { name: 'Vergleich' }).click();
    await b.page.waitForTimeout(600);
    const text = await b.page.locator('.modal').innerText();
    if (!/gemeinsame Übungen|Noch keine gemeinsamen/.test(text)) throw new Error('Vergleich fehlt');
    console.log('    Vergleich:', text.split('\n').slice(2, 5).join(' | '));
  });
  
  await guarded('B schließt Detail', async () => {
    await b.page.locator('.modal__head button').last().click();
    await b.page.waitForTimeout(400);
  });
  
  await guarded('A: gibt zusätzlich Gewicht frei', async () => {
    await a.page.locator('.search-result').first().click();
    await a.page.waitForTimeout(700);
    await a.page.getByRole('button', { name: 'Was ich zeige' }).click();
    await a.page.waitForTimeout(400);
    const boxes = a.page.locator('.modal input[type=checkbox]');
    if (await boxes.count() !== 3) throw new Error(`${await boxes.count()} Schalter statt 3`);
    await boxes.nth(1).check();
    await a.page.waitForTimeout(800);
    const granted = backend.db.share_grants.filter((g) => g.scope === 'weight');
    if (granted.length !== 1) throw new Error('Freigabe nicht gespeichert');
    await a.page.locator('.modal__head button').last().click();
  });
  
  console.log('    Gewichts-Payload von A:', JSON.stringify(
    backend.db.share_payloads.find((r) => r.scope === 'weight')?.payload).slice(0, 200));
  
  await guarded('B: sieht jetzt auch das Gewicht', async () => {
    await b.page.getByRole('button', { name: 'Abgleichen' }).click();
    await b.page.waitForTimeout(1500);
    await b.page.locator('.search-result').first().click();
    await b.page.waitForTimeout(900);
    const text = await b.page.locator('.modal').innerText();
    if (!text.includes('Körpergewicht')) throw new Error('Gewicht fehlt trotz Freigabe');
    if (text.includes('noch keine Einträge')) throw new Error('Gewicht ist leer angekommen');
    console.log('    Gewicht bei B sichtbar:', /Körpergewicht[^\n]*\n?([^\n]*)/.exec(text)?.[1] ?? '');
    await b.page.locator('.modal__head button').last().click();
  });
  
  /* ------------------------------------------------- Geräteabgleich (A) */
  
  await guarded('A: zweites Gerät führt Trainings zusammen', async () => {
    const second = await makeUser('A2');
    await openFriends(second.page);
    await second.page.getByRole('button', { name: 'Anmelden' }).first().click().catch(() => {});
    await second.page.locator('input[type=email]').fill('anna@example.com');
    await second.page.locator('input[type=password]').fill('geheim123');
    await second.page.getByRole('button', { name: 'Anmelden' }).click();
    await second.page.waitForTimeout(2200);
  
    // Auf dem zweiten Gerät ein Training eintragen
    await second.page.locator('.nav__item').nth(0).click();
    await second.page.waitForTimeout(400);
    await second.page.locator('.day-strip__item').first().click();
    await second.page.waitForTimeout(500);
    const card = second.page.locator('.exercise').first();
    if (await card.locator('.set-row').count() === 0) await card.locator('.exercise__head').click();
    const inputs = card.locator('.set-row').first().locator('input');
    await inputs.nth(0).fill('95'); await inputs.nth(0).blur();
    await inputs.nth(1).fill('5');  await inputs.nth(1).blur();
    await card.locator('.check').first().click();
    await second.page.waitForTimeout(4500); // auf das gebündelte Hochladen warten
  
    // Erstes Gerät holt den Stand
    await a.page.locator('.nav__item').nth(4).click();
    await a.page.waitForTimeout(300);
    await a.page.getByRole('button', { name: 'Abgleichen' }).click();
    await a.page.waitForTimeout(2000);
    await a.page.locator('.nav__item').nth(0).click();
    await a.page.waitForTimeout(400);
    await a.page.locator('.day-strip__item').first().click();
    await a.page.waitForTimeout(600);
    const chip = await a.page.locator('.exercise').first().locator('.chip').first().textContent().catch(() => '');
    console.log('    Gerät 1 nach Abgleich, erste Übung:', chip);
    if (!chip || !chip.includes('/')) throw new Error('Training vom zweiten Gerät kam nicht an');
  
    // Der Startplan darf sich beim Zusammenfuehren nicht verdoppeln.
    await a.page.locator('.nav__item').nth(1).click();
    await a.page.waitForTimeout(600);
    const planCount = await a.page.locator('.day-strip').count();
    console.log('    Pläne auf Gerät 1:', planCount);
    if (planCount !== 1) throw new Error(`${planCount} Pläne statt 1 - Startplan wurde dupliziert`);
    await second.ctx.close();
  });
  
  /* ------------------------------------------------------ Freund entfernen */
  
  await guarded('B: Freundschaft beenden räumt Freigaben ab', async () => {
    await b.page.locator('.nav__item').nth(4).click();
    await b.page.waitForTimeout(600);
    await b.page.locator('.search-result').first().click();
    await b.page.waitForTimeout(700);
    await b.page.getByRole('button', { name: 'Was ich zeige' }).click();
    await b.page.waitForTimeout(300);
    await b.page.getByRole('button', { name: 'Freundschaft beenden' }).click();
    await b.page.waitForTimeout(1200);
    if (backend.db.friendships.length !== 0) throw new Error('Freundschaft noch da');
    if (backend.db.share_grants.length !== 0) throw new Error('Freigaben nicht entfernt');
  });
  
  await a.page.locator('.nav__item').nth(4).click();
  await a.page.waitForTimeout(500);
  
  
  errors.push(...a.errors, ...b.errors);
  if (backend.unknown.length > 0) {
    errors.push(`Nicht abgedeckte Aufrufe: ${backend.unknown.slice(0, 5).join(', ')}`);
  }
  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
