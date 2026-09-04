import { createMockBackend } from './mockBackend.mjs';
import { createRunner, launchBrowser, newAppContext } from './helpers.mjs';

/** Einladungslink: oeffnen, Konto anlegen, Anfrage geht automatisch raus. */
export async function run() {
  const runner = createRunner('Einladungslinks');
  const backend = createMockBackend();
  const browser = await launchBrowser();
  const errors = [];
  const step = runner.step;

  const makeUser = async (label, url) => {
    const created = await newAppContext(browser, { backend, label, ...(url ? { url } : {}) });
    errors.push(...created.errors);
    return created;
  };

  const signUp = async (page, email) => {
    await page.getByRole('button', { name: 'Noch kein Konto? Jetzt anlegen' }).click();
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill('geheim123');
    await page.getByRole('button', { name: 'Konto anlegen' }).click();
    await page.waitForTimeout(2000);
  };

  // Nutzer A legt ein Konto an und erzeugt den Einladungslink
  const a = await makeUser('A');
  await a.page.locator('.nav__item').nth(4).click();
  await a.page.waitForTimeout(500);
  await step('A: Konto anlegen', async () => { await signUp(a.page, 'anna@example.com'); });
  
  const handleA = (await a.page.locator('.tiny.dim').first().textContent()).trim().replace('@', '');
  const inviteLink = `${(process.env.TEST_URL ?? 'http://127.0.0.1:4173/')}#add=${handleA}`;
  console.log('    Einladungslink:', inviteLink);
  
  // Nutzer B öffnet den Link und legt NUR ein Konto an
  const b = await makeUser('B', inviteLink);
  
  await step('B: Link öffnet direkt die Freunde-Seite', async () => {
    const active = await b.page.locator('.nav__item--active span:last-child').textContent();
    if (active !== 'Freunde') throw new Error(`Reiter "${active}" statt "Freunde"`);
  });
  
  await step('B: sieht, von wem die Einladung kommt', async () => {
    const text = await b.page.locator('.page').innerText();
    if (!text.includes(handleA)) throw new Error('Einladender nicht genannt');
    if (!text.includes('hat dich eingeladen')) throw new Error('Kein Einladungshinweis');
  });
  
  await step('B: Adresszeile ist wieder sauber', async () => {
    const url = b.page.url();
    if (url.includes('#add=')) throw new Error(`Anhang blieb stehen: ${url}`);
  });
  
  await step('B: nur Konto anlegen - Anfrage geht von selbst raus', async () => {
    await signUp(b.page, 'ben@example.com');
    await b.page.waitForTimeout(1500);
    if (backend.db.friendships.length !== 1) throw new Error('Keine Anfrage entstanden');
    const link = backend.db.friendships[0];
    const profileB = [...backend.db.profiles.values()].find((p) => p.handle !== handleA);
    if (link.requester_id !== profileB.id) throw new Error('Falsche Richtung');
    const text = await b.page.locator('.page').innerText();
    if (!/Anfrage an .* geschickt/.test(text)) throw new Error('Keine Rückmeldung angezeigt');
  });
  
  await step('B: Einladung wird nicht doppelt eingelöst', async () => {
    await b.page.reload({ waitUntil: 'networkidle' });
    await b.page.waitForTimeout(2500);
    if (backend.db.friendships.length !== 1) throw new Error(`${backend.db.friendships.length} Anfragen`);
  });
  
  await step('A: bekommt die Anfrage', async () => {
    await a.page.getByRole('button', { name: 'Abgleichen' }).click();
    await a.page.waitForTimeout(1500);
    if (await a.page.locator('text=Offene Anfragen an dich').count() === 0) throw new Error('Anfrage fehlt');
    await a.page.getByRole('button', { name: 'Annehmen' }).click();
    await a.page.waitForTimeout(1200);
    if (backend.db.friendships[0].status !== 'accepted') throw new Error('Nicht angenommen');
  });
  
  await step('A: eigener Link löst bei einem selbst nichts aus', async () => {
    const self = await makeUser('A2', `${(process.env.TEST_URL ?? 'http://127.0.0.1:4173/')}#add=${handleA}`);
    await self.page.locator('.nav__item').nth(4).click();
    await self.page.waitForTimeout(400);
    await self.page.locator('input[type=email]').fill('anna@example.com');
    await self.page.locator('input[type=password]').fill('geheim123');
    await self.page.getByRole('button', { name: 'Anmelden' }).click();
    await self.page.waitForTimeout(2500);
    if (backend.db.friendships.length !== 1) throw new Error('Zusätzliche Freundschaft entstanden');
    await self.ctx.close();
  });
  
  
  if (backend.unknown.length > 0) {
    errors.push(`Nicht abgedeckte Aufrufe: ${backend.unknown.slice(0, 5).join(', ')}`);
  }
  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
