import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Zeitpunkt des Baus - wird im Profil als Version angezeigt, damit sich
  // pruefen laesst, ob ein Update wirklich angekommen ist.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', sourcemap: false },
})
