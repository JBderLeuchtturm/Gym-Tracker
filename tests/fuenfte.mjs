import { createRunner, launchBrowser, logSet, newAppContext, openCard } from './helpers.mjs';

/** Kontrastverhaeltnis zweier Farben, im Browser gerechnet. */
const CONTRAST = `(a, b) => {
  const parse = (value) => value.match(/[\\d.]+/g).slice(0, 3).map(Number);
  const lin = (c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const lum = (rgb) => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const hi = Math.max(lum(parse(a)), lum(parse(b)));
  const lo = Math.min(lum(parse(a)), lum(parse(b)));
  return (hi + 0.05) / (lo + 0.05);
}`;

async function addExercise(page, query) {
  await page.locator('.btn--primary', { hasText: 'Übung hinzufügen' }).first().click();
  await page.waitForSelector('.modal');
  await page.locator('.modal .input').first().fill(query);
  await page.waitForTimeout(500);
  await page.locator('.search-result:not([disabled])').first().click();
  await page.waitForTimeout(400);
}

/** Fuenfte Runde: die Funde und die Gestaltung aus Issue 17. */
export async function run() {
  const runner = createRunner('Fünfte Runde');
  const browser = await launchBrowser();
  const { page, errors } = await newAppContext(browser);

  /* ---------------------------------------------------------- Die Funde */

  await runner.step('Körpergewichtsübung zeigt Wiederholungen statt „0 kg“', async () => {
    await addExercise(page, 'Klimmzüge (Obergriff)');
    const card = page.locator('.exercise').last();
    await logSet(page, card, { reps: 9 });
    await page.locator('.rest-timer [aria-label="Pause beenden"]').click().catch(() => {});
    await page.waitForTimeout(400);

    // Einen Tag weiter: dort steht die Vorleistung von heute.
    await page.getByLabel('Woche vor').click();
    await page.waitForTimeout(700);
    await addExercise(page, 'Klimmzüge (Obergriff)');
    const meta = await page.locator('.exercise').last().locator('.exercise__meta').innerText();
    if (/0 kg/.test(meta)) throw new Error(meta);
    if (!/9 Wdh/.test(meta)) throw new Error(meta);

    await page.getByLabel('Woche zurück').click();
    await page.waitForTimeout(600);
  });

  await runner.step('Silhouette hebt sich in beiden Themen ab', async () => {
    for (const theme of ['dark', 'light']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      await page.waitForTimeout(200);
      const ratio = await page.evaluate(([contrast, ]) => {
        const styles = getComputedStyle(document.documentElement);
        const probe = document.createElement('div');
        probe.style.color = styles.getPropertyValue('--body-line');
        probe.style.background = styles.getPropertyValue('--surface');
        document.body.appendChild(probe);
        const shown = getComputedStyle(probe);
        // eslint-disable-next-line no-eval
        const fn = eval(contrast);
        const value = fn(shown.color, shown.backgroundColor);
        probe.remove();
        return value;
      }, [CONTRAST, theme]);
      // Bedeutungstragende Grafik braucht 3 zu 1.
      if (ratio < 3) throw new Error(`${theme}: nur ${ratio.toFixed(2)} zu 1`);
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.waitForTimeout(200);
  });

  await runner.step('Kategorienfarben liegen nicht auf den Systemfarben', async () => {
    const worst = await page.evaluate(() => {
      const hue = (css) => {
        const [r, g, b] = css.match(/[\d.]+/g).slice(0, 3).map((n) => Number(n) / 255);
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) return 0;
        const d = max - min;
        let h = 0;
        if (max === r) h = ((g - b) / d) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        return ((h * 60) + 360) % 360;
      };
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const read = (value) => { probe.style.color = value; return hue(getComputedStyle(probe).color); };
      const styles = getComputedStyle(document.documentElement);
      const system = ['--accent', '--warn', '--danger'].map((name) => read(styles.getPropertyValue(name)));
      // Genau die drei Toene, die frueher zu nah lagen.
      const cats = ['#ba5e6e', '#7d7d36', '#6a8240'].map(read);
      probe.remove();
      let smallest = 360;
      for (const c of cats) {
        for (const s of system) {
          const d = Math.min(Math.abs(c - s), 360 - Math.abs(c - s));
          if (d < smallest) smallest = d;
        }
      }
      return smallest;
    });
    if (worst < 12) throw new Error(`nur ${worst.toFixed(0)} Grad Abstand`);
  });

  await runner.step('Plankarte zeigt die Namen der Trainingstage', async () => {
    await page.locator('.nav__item', { hasText: 'Pläne' }).first().click();
    await page.waitForTimeout(700);
    const sheet = await page.locator('.weeksheet').first().innerText();
    if (!/Push/.test(sheet)) throw new Error(sheet.replace(/\n/g, ' | '));
    if (!/Pull/.test(sheet)) throw new Error(sheet.replace(/\n/g, ' | '));
    if (!/frei/.test(sheet)) throw new Error('Ruhetage nicht als frei erkennbar');
  });

  await runner.step('Planeditor öffnet auf einem Trainingstag', async () => {
    await page.locator('.btn', { hasText: 'Bearbeiten' }).first().click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(400);
    // Heute ist im Startplan oft ein Ruhetag - dann darf der Editor nicht dort landen.
    const active = page.locator('.modal .day-strip__item--active');
    if (await active.count() === 0) throw new Error('kein Tag ausgewählt');
    const rest = await page.locator('.modal input[type="checkbox"]').last().isChecked();
    const exercises = await page.locator('.modal .search-result, .modal .plan-exercise').count();
    if (rest && exercises === 0) throw new Error('Editor öffnet auf einem leeren Ruhetag');
    await page.locator('.modal [aria-label="Schließen"]').first().click();
    await page.waitForTimeout(300);
  });

  await runner.step('Kalorienverlauf sind Balken, keine Linie', async () => {
    await page.locator('.nav__item', { hasText: 'Kalorien' }).first().click();
    await page.waitForTimeout(900);
    // Der Verlauf erscheint erst, wenn ueberhaupt eine Zufuhr eingetragen ist.
    const kcal = page.locator('.field', { hasText: 'Kalorien (kcal)' }).locator('input');
    await kcal.fill('2400');
    await kcal.blur();
    await page.waitForTimeout(500);
    // Der Verlauf liegt seit der Aufraeumrunde hinter einem Knopf.
    const reveal = page.getByRole('button', { name: 'Verlauf der letzten 30 Tage zeigen' });
    if (await reveal.count() > 0) { await reveal.click(); await page.waitForTimeout(500); }
    const section = page.locator('.section', { hasText: 'Verlauf' }).first();
    if (await section.count() === 0) throw new Error('kein Abschnitt für den Verlauf');
    if (await section.locator('rect').count() === 0) throw new Error('keine Balken');
    if (await section.locator('path[d^="M"]').count() > 0) throw new Error('immer noch eine Linie');
  });

  await runner.step('Ohne Vergleichszeitraum steht es einmal statt dreimal', async () => {
    await page.locator('.nav__item', { hasText: 'Fortschritt' }).first().click();
    await page.waitForTimeout(1100);
    const review = page.locator('.section', { hasText: 'Rückblick' }).first();
    const text = await review.innerText();
    const news = (text.match(/\bneu\b/g) ?? []).length;
    if (news > 0) throw new Error(`${news}× „neu“ statt einer Zeile darüber`);
    if (!/kein Vergleichszeitraum/.test(text)) throw new Error(text.slice(0, 120));
  });

  await runner.step('Freunde zeigen erst, wozu es gut ist', async () => {
    await page.locator('.nav__item', { hasText: 'Freunde' }).first().click();
    await page.waitForTimeout(800);
    const text = await page.locator('.page').innerText();
    if (/SQL Editor/.test(text)) throw new Error('Einrichtung steht sofort da');
    if (!/Challenges|Vergleichen|Pläne weitergeben/.test(text)) throw new Error(text.slice(0, 140));

    await page.locator('.btn', { hasText: 'Wie richte ich das ein?' }).click();
    await page.waitForTimeout(400);
    if (!/SQL Editor/.test(await page.locator('.page').innerText())) {
      throw new Error('Anleitung klappt nicht auf');
    }
  });

  /* ------------------------------------------------------- Die Gestaltung */

  await runner.step('Zugeklappte Übungskarte ist nicht mit der Tastatur erreichbar', async () => {
    await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
    await page.waitForTimeout(700);
    const card = page.locator('.exercise').first();
    // Zuklappen und nachsehen, ob die Felder darin noch anspringbar sind.
    await openCard(card, page);
    await card.locator('.exercise__head').click();
    await page.waitForTimeout(400);
    const reachable = await card.locator('.set-row input').first().isVisible();
    if (reachable) throw new Error('Eingabefelder einer zugeklappten Karte sind noch erreichbar');
  });

  await runner.step('Der nächste offene Satz ist markiert', async () => {
    const card = page.locator('.exercise').first();
    await openCard(card, page);
    const marked = await card.locator('.set-row--next').count();
    if (marked !== 1) throw new Error(`${marked} markierte Zeilen statt einer`);
  });

  await runner.step('Einheiten stehen nur in der Kopfzeile', async () => {
    const card = page.locator('.exercise').first();
    const head = await card.locator('.set-header').innerText();
    if (!/KG/i.test(head)) throw new Error(head);
    const placeholders = await card.locator('.set-row input').evaluateAll(
      (nodes) => nodes.map((node) => node.getAttribute('placeholder')).filter(Boolean));
    if (placeholders.some((value) => /kg|wdh|sek/i.test(value))) {
      throw new Error(`Einheit steht doppelt: ${placeholders.join(', ')}`);
    }
  });

  await runner.step('Zwei Spalten auf breiten Fenstern, eine auf schmalen', async () => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.waitForTimeout(500);
    const wide = await page.locator('.split').first().evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    if (wide !== 2) throw new Error(`${wide} Spalten auf 1200 px`);

    await page.setViewportSize({ width: 420, height: 900 });
    await page.waitForTimeout(500);
    const narrow = await page.locator('.split').first().evaluate(
      (el) => getComputedStyle(el).display);
    if (narrow !== 'contents') throw new Error(`Raster bleibt bei 420 px: ${narrow}`);
  });

  await runner.step('Die Lesespalte bleibt schmal, wo sie schmal sein soll', async () => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.locator('.nav__item', { hasText: 'Profil' }).first().click();
    await page.waitForTimeout(900);
    const width = await page.locator('.page').evaluate((el) => el.getBoundingClientRect().width);
    if (width > 800) throw new Error(`${Math.round(width)} px breit`);
    await page.setViewportSize({ width: 420, height: 900 });
    await page.waitForTimeout(400);
  });

  await runner.step('Der leere Zustand bietet einen Weg an', async () => {
    await page.locator('.nav__item', { hasText: 'Heute' }).first().click();
    await page.waitForTimeout(600);
    // Auf einen Ruhetag ohne Eintrag wechseln.
    await page.getByLabel('Woche vor').click();
    await page.waitForTimeout(600);
    const empty = page.locator('.empty').first();
    if (await empty.count() > 0) {
      const text = await empty.innerText();
      if (!/Plan für heute anlegen/.test(text)) throw new Error(text.replace(/\n/g, ' | '));
    }
  });

  await browser.close();
  return runner.finish(errors);
}
