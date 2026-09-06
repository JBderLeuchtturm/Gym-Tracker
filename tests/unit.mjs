/**
 * Laeufe ohne Browser fuer die reine Rechnerei - Scheiben, 1RM, Kalorien,
 * Statistik, Zusammenfuehren. Deutlich schneller als der Weg ueber Playwright
 * und die Fehlermeldungen zeigen genau auf die Zeile.
 *
 *   node tests/unit.mjs
 *
 * Die .ts-Dateien werden mit dem esbuild, das ohnehin in Vite steckt, einmal
 * gebuendelt und dann importiert - kein zusaetzliches Werkzeug.
 */
import { build } from 'esbuild';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { rmSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const outfile = join(here, '.unit-bundle.mjs');

await build({
  entryPoints: [join(here, 'unit.spec.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  outfile,
  logLevel: 'silent',
});

let failed = 0;
try {
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`);
  failed = await mod.run();
} finally {
  rmSync(outfile, { force: true });
}

process.exit(failed > 0 ? 1 : 0);
