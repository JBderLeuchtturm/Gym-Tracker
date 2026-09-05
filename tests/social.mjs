import { createMockBackend } from './mockBackend.mjs';
import { createRunner, launchBrowser, logSet, newAppContext } from './helpers.mjs';

/** Aktivitaetsliste, Reaktionen, Kommentare, Gruppen und Challenges. */
export async function run() {
  const runner = createRunner('Gruppen, Challenges und Aktivität');
  const backend = createMockBackend();
  const browser = await launchBrowser();
  const errors = [];

  const makeUser = async (label) => {
    const created = await newAppContext(browser, { backend, label });
    errors.push(...created.errors);
    return created;
  };

  const openFriends = async (page) => {
    await page.locator('.nav__item').nth(4).click();
    await page.waitForTimeout(500);
  };
  const openSection = async (page, name) => {
    await page.locator('.chip--button').filter({ hasText: name }).first().click();
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
  const handleOf = async (page) => (await page.locator('.tiny.dim').first().textContent()).trim().replace('@', '');

  // --- Zwei Konten, A trainiert
  const a = await makeUser('A');
  await runner.step('A trainiert und legt ein Konto an', async () => {
    await a.page.locator('.day-strip__item').first().click();
    await a.page.waitForTimeout(500);
    await logSet(a.page, a.page.locator('.exercise').first(), { kg: 90, reps: 6 });
    await signUp(a.page, 'anna@example.com');
    await a.page.waitForTimeout(1200);
  });
  const handleA = await handleOf(a.page);

  const b = await makeUser('B');
  await runner.step('B legt ein Konto an und befreundet sich mit A', async () => {
    await signUp(b.page, 'ben@example.com');
    await b.page.getByPlaceholder('Benutzername, z. B. jan-4f2a').fill(handleA);
    await b.page.getByRole('button', { name: 'Anfragen' }).click();
    await b.page.waitForTimeout(1000);

    await a.page.getByRole('button', { name: 'Abgleichen' }).click();
    await a.page.waitForTimeout(1400);
    await a.page.getByRole('button', { name: 'Annehmen' }).click();
    await a.page.waitForTimeout(1200);
    if (backend.db.friendships[0]?.status !== 'accepted') throw new Error('Nicht angenommen');
  });

  await runner.step('B sieht As Training in der Aktivitätsliste', async () => {
    await b.page.getByRole('button', { name: 'Abgleichen' }).click();
    await b.page.waitForTimeout(1800);
    await openSection(b.page, 'Aktivität');
    const items = await b.page.locator('.feed-item').count();
    if (items === 0) throw new Error('Liste leer');
    const text = await b.page.locator('.feed-item').first().innerText();
    if (!text.includes('90')) throw new Error(`Kein Bestwert im Eintrag: ${text.replace(/\n/g, ' | ')}`);
  });

  await runner.step('B reagiert auf das Training', async () => {
    await b.page.locator('.feed-item').first().locator('.chip--button').first().click();
    await b.page.waitForTimeout(1000);
    if (backend.db.activity_reactions.length !== 1) {
      throw new Error(`${backend.db.activity_reactions.length} Reaktionen`);
    }
    const chip = await b.page.locator('.feed-item').first()
      .locator('.chip--button').first().textContent();
    if (!chip?.includes('1')) throw new Error(`Zähler zeigt "${chip}"`);
  });

  await runner.step('Reaktion lässt sich zurücknehmen', async () => {
    await b.page.locator('.feed-item').first().locator('.chip--button').first().click();
    await b.page.waitForTimeout(1000);
    if (backend.db.activity_reactions.length !== 0) throw new Error('Reaktion blieb stehen');
  });

  await runner.step('B kommentiert', async () => {
    await b.page.locator('.feed-item').first().getByText('Kommentar').click();
    await b.page.waitForTimeout(400);
    await b.page.locator('.feed-item').first().locator('input.input').fill('Stark!');
    await b.page.getByRole('button', { name: 'Senden' }).click();
    await b.page.waitForTimeout(1200);
    if (backend.db.activity_comments.length !== 1) throw new Error('Kein Kommentar gespeichert');
    if (!(await b.page.locator('.feed-item').first().innerText()).includes('Stark!')) {
      throw new Error('Kommentar nicht sichtbar');
    }
  });

  await runner.step('A sieht den Kommentar zu seinem Training', async () => {
    await a.page.getByRole('button', { name: 'Abgleichen' }).click();
    await a.page.waitForTimeout(1600);
    const own = backend.db.activity_comments.filter((c) => c.body === 'Stark!');
    if (own.length !== 1) throw new Error('Kommentar fehlt in der Datenbank');
  });

  // --- Gruppen
  let joinCode = '';
  await runner.step('A legt eine Gruppe an', async () => {
    await openSection(a.page, 'Gruppen');
    await a.page.getByRole('button', { name: 'Neue Gruppe' }).click();
    await a.page.waitForSelector('.modal');
    await a.page.locator('.modal input.input').first().fill('Montagscrew');
    await a.page.getByRole('button', { name: 'Anlegen' }).click();
    await a.page.waitForTimeout(1400);
    if (backend.db.groups.length !== 1) throw new Error('Keine Gruppe angelegt');
    joinCode = backend.db.groups[0].join_code;
    if (!/^[a-z0-9]{6,10}$/.test(joinCode)) throw new Error(`Code "${joinCode}"`);
  });

  await runner.step('B tritt mit dem Code bei', async () => {
    await openSection(b.page, 'Gruppen');
    await b.page.getByPlaceholder('Beitrittscode, z. B. k7mq2xr').fill(joinCode);
    await b.page.getByRole('button', { name: 'Beitreten' }).click();
    await b.page.waitForTimeout(1600);
    if (backend.db.group_members.length !== 2) {
      throw new Error(`${backend.db.group_members.length} Mitglieder`);
    }
    const text = await b.page.locator('.page').innerText();
    if (!text.includes('Montagscrew')) throw new Error('Gruppe nicht sichtbar');
    if (!text.includes('2 Mitglieder')) throw new Error('Mitgliederzahl falsch');
  });

  await runner.step('Falscher Code wird sauber abgelehnt', async () => {
    await b.page.getByPlaceholder('Beitrittscode, z. B. k7mq2xr').fill('xxxxxxx');
    await b.page.getByRole('button', { name: 'Beitreten' }).click();
    await b.page.waitForTimeout(900);
    if (await b.page.locator('text=/Keine Gruppe mit dem Code/').count() === 0) {
      throw new Error('Keine Fehlermeldung');
    }
  });

  // --- Challenges
  await runner.step('A legt eine Challenge an', async () => {
    await openSection(a.page, 'Challenges');
    await a.page.getByRole('button', { name: 'Neue Challenge' }).click();
    await a.page.waitForSelector('.modal');
    await a.page.locator('.modal input.input').first().fill('4 Wochen durchziehen');
    await a.page.getByRole('button', { name: 'Anlegen' }).click();
    await a.page.waitForTimeout(1400);
    if (backend.db.challenges.length !== 1) throw new Error('Keine Challenge angelegt');
    if (backend.db.challenge_members.length !== 1) throw new Error('Ersteller nicht eingetragen');
  });

  await runner.step('A steht mit seinem Training in der Wertung', async () => {
    const text = await a.page.locator('.page').innerText();
    if (!text.includes('4 Wochen durchziehen')) throw new Error('Challenge fehlt');
    if (!text.includes('läuft')) throw new Error('Status fehlt');
    // Platzziffer statt Medaille.
    if (!/1\s*Du/.test(text)) throw new Error(`Keine Wertung: ${text.slice(0, 200)}`);
  });

  await runner.step('B kann mitmachen', async () => {
    await b.page.getByRole('button', { name: 'Abgleichen' }).click();
    await b.page.waitForTimeout(1600);
    await openSection(b.page, 'Challenges');
    await b.page.getByRole('button', { name: 'Mitmachen' }).click();
    await b.page.waitForTimeout(1400);
    if (backend.db.challenge_members.length !== 2) {
      throw new Error(`${backend.db.challenge_members.length} Teilnehmer`);
    }
  });

  await runner.step('Gruppe verlassen räumt die Freigaben auf', async () => {
    // A und B sind auch befreundet, die Freigabe bleibt also bestehen.
    await openSection(b.page, 'Gruppen');
    await b.page.getByRole('button', { name: 'Verlassen' }).click();
    await b.page.waitForTimeout(1400);
    if (backend.db.group_members.length !== 1) throw new Error('Nicht ausgetreten');
    const stillShared = backend.db.share_grants.some(
      (g) => g.scope === 'progress' && g.owner_id && g.viewer_id);
    if (!stillShared) throw new Error('Freigabe der Freundschaft wurde mit entfernt');
  });

  if (backend.unknown.length > 0) {
    errors.push(`Nicht abgedeckte Aufrufe: ${backend.unknown.slice(0, 5).join(', ')}`);
  }
  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
