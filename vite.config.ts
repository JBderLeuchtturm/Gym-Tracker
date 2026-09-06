import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Traegt die gebauten App-Dateien in den Service Worker ein.
 *
 * Ohne das kennt der Worker nur die Startseite; wer offline zum ersten Mal die
 * Auswertung oder die Diagramme oeffnet, bekommt sie nicht. Der Cache-Name
 * bekommt einen Bau-Stempel, damit alte Dateien beim naechsten Start weichen.
 */
function serviceWorkerPrecache(): Plugin {
  const assets: string[] = []
  return {
    name: 'service-worker-precache',
    apply: 'build',
    generateBundle(_options, bundle) {
      for (const file of Object.keys(bundle)) {
        if (/\.(js|css|woff2?|png|svg)$/.test(file)) assets.push(`./${file}`)
      }
    },
    closeBundle() {
      const swPath = join('dist', 'sw.js')
      let source: string
      try { source = readFileSync(swPath, 'utf8') } catch { return }
      const list = ['./', './index.html', ...assets]
      const stamp = Date.now().toString(36)
      const patched = source
        .replace(/const CACHE = '[^']*'/, `const CACHE = 'gym-tracker-${stamp}'`)
        .replace(/const PRECACHE = \[[^\]]*\]/, `const PRECACHE = ${JSON.stringify(list)}`)
      writeFileSync(swPath, patched)
    },
  }
}

export default defineConfig({
  // Zeitpunkt des Baus - wird im Profil als Version angezeigt, damit sich
  // pruefen laesst, ob ein Update wirklich angekommen ist.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [react(), serviceWorkerPrecache()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
})
