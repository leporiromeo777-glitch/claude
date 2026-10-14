import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Configurazione di Vite (ARCHITETTURA 1, 13): base relativa, perché la build
// funzioni in qualsiasi sottocartella e dentro la WebView di Capacitor.
const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };

// Il manifest degli asset lo genera la pipeline Blender (pacchetto B). Se non
// esiste ancora, il gioco non lo chiede nemmeno (nessun 404 in console) e usa
// i segnaposto disegnati in codice.
const hasAssetManifest = existsSync(`${root}public/assets/manifest.json`);

export default defineConfig({
  base: './',
  define: {
    __GAME_VERSION__: JSON.stringify(pkg.version),
    __ASSET_MANIFEST__: JSON.stringify(hasAssetManifest),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 600,
  },
  worker: {
    format: 'es',
  },
  server: {
    host: true,
  },
  preview: {
    port: 4173,
  },
});
