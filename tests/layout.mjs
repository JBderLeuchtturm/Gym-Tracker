import { createRunner, launchBrowser } from './helpers.mjs';
import { chromium } from 'playwright';

/** Prueft, dass die Oberflaeche auch auf schmalen Geraeten passt. */
export async function run() {
  const runner = createRunner('Layout auf schmalem Gerät');
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'de-DE' });
  await ctx.route('**/sync-config.json', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '{"url":"","anonKey":""}' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  /*
   * Seit die App eine Huelle in Bildschirmgroesse ist, kann das Dokument gar
   * nicht mehr waagerecht scrollen - die alte Messung an scrollWidth ginge
   * also immer gut aus und pruefte nichts. Stattdessen wird jedes sichtbare
   * Element gefragt, ob es ueber den Rand steht.
   *
   * Ausgenommen ist, was in einem ausdruecklichen Querscroller liegt: Der
   * Trainingskalender zeigt ein halbes Jahr und darf laenger sein als das
   * Gerraet breit ist. Alles andere ist ein Fehler.
   */
  const overflow = () => page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const inScroller = (el) => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
      }
      return false;
    };
    let worst = 0;
    let culprit = '';
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const over = Math.round(Math.max(box.right - width, -box.left));
      if (over > worst && !inScroller(el)) {
        worst = over;
        culprit = `${el.tagName.toLowerCase()}.${String(el.className || '').slice(0, 40)}`;
      }
    }
    return { over: worst, culprit };
  });

  await runner.step('Startseite läuft nicht über', async () => {
    const { over, culprit } = await overflow();
    if (over > 1) throw new Error(`${over} px Überlauf bei ${culprit}`);
  });

  await runner.step('Herauszoomen unter die eigene Breite ist gesperrt', async () => {
    const meta = await page.getAttribute('meta[name=viewport]', 'content');
    if (!/minimum-scale=1/.test(meta ?? '')) throw new Error(`Kopfzeile: ${meta}`);
    if (/user-scalable=no|maximum-scale/.test(meta ?? '')) {
      throw new Error('Hineinzoomen darf nicht gesperrt sein');
    }
  });

  await runner.step('Reiter-Beschriftungen werden nicht abgeschnitten', async () => {
    const clipped = await page.evaluate(() => [...document.querySelectorAll('.nav__item')]
      .map((el) => {
        const span = el.querySelector('span:last-child');
        return span && span.scrollWidth > span.clientWidth + 1 ? span.textContent : null;
      })
      .filter(Boolean));
    if (clipped.length > 0) throw new Error(clipped.join(', '));
  });

  for (const [index, name] of [[0, 'Heute'], [2, 'Fortschritt'], [3, 'Kalorien'], [5, 'Profil']]) {
    await runner.step(`${name} läuft nicht über`, async () => {
      await page.locator('.nav__item').nth(index).click();
      await page.waitForTimeout(700);
      const { over, culprit } = await overflow();
      if (over > 1) throw new Error(`${over} px Überlauf bei ${culprit}`);
    });

    await runner.step(`${name}: die Leisten bleiben beim Scrollen stehen`, async () => {
      const scroller = page.locator('.app__scroll');
      await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
      await page.waitForTimeout(400);
      const height = page.viewportSize().height;
      const nav = await page.locator('.nav').boundingBox();
      const bar = await page.locator('.topbar').boundingBox();
      if (!nav || Math.round(nav.y + nav.height) > height + 1) {
        throw new Error(`Reiterleiste bei ${nav ? Math.round(nav.y) : '?'} statt am unteren Rand`);
      }
      if (!bar || Math.round(bar.y) < -1) throw new Error('Kopfzeile weggescrollt');
      // Das Dokument selbst darf sich dabei nicht bewegen.
      const moved = await page.evaluate(() => window.scrollY);
      if (moved !== 0) throw new Error(`Das Dokument scrollte um ${moved} px mit`);
      await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
      await page.waitForTimeout(250);
    });
  }

  const failed = runner.finish(errors);
  await browser.close();
  return failed;
}
void chromium;
