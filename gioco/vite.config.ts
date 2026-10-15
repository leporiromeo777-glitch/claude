import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// Configurazione di Vite (ARCHITETTURA 1, 13): base relativa, perché la build
// funzioni in qualsiasi sottocartella e dentro la WebView di Capacitor.
const root = fileURLToPath(new URL('.', import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { version: string };

// Il manifest degli asset lo genera la pipeline Blender (pacchetto B). Se non
// esiste ancora, il gioco non lo chiede nemmeno (nessun 404 in console) e usa
// i segnaposto disegnati in codice.
const hasAssetManifest = existsSync(`${root}public/assets/manifest.json`);

/** Tutti i file di una cartella (percorsi relativi con '/'). */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(relative(`${root}public`, full).split(sep).join('/'));
  }
  return out;
}

/**
 * Elenco per il service worker (revisione 1, SCH-08): `precache.json` con la
 * versione del gioco, un identificativo della build e i file da mettere in
 * cache al primo caricamento (index, chunk, CSS, font woff2, Worker, file di
 * public/ come assets/manifest.json, atlanti, diorami, icone). L'identificativo
 * va anche in index.html (`<meta name="trama-build">`): main.ts registra
 * `sw.js?v=<versione>-<build>`, così ogni build nuova installa un worker nuovo.
 */
export function precachePlugin(): Plugin {
  return {
    name: 'trama-precache',
    apply: 'build',
    enforce: 'post',
    generateBundle(_opts, bundle) {
      const files = new Set<string>(['./', 'index.html']);
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        // I .woff sono il ripiego dei browser vecchi (si usano solo i .woff2).
        if (name.endsWith('.woff') || name.endsWith('.map') || name === 'index.html' || name === 'precache.json') continue;
        files.add(name);
        hash.update(name);
      }
      for (const f of walk(`${root}public`).sort()) {
        if (f === 'sw.js' || f.startsWith('.') || f.includes('/.')) continue;
        files.add(f);
        hash.update(f);
        hash.update(readFileSync(`${root}public/${f}`));
      }
      const build = hash.digest('hex').slice(0, 12);
      const html = bundle['index.html'];
      if (html && html.type === 'asset') {
        const src = typeof html.source === 'string' ? html.source : new TextDecoder().decode(html.source);
        html.source = src.replace('<head>', `<head>\n    <meta name="trama-build" content="${build}" />`);
      }
      this.emitFile({
        type: 'asset',
        fileName: 'precache.json',
        source: JSON.stringify({ version: pkg.version, build, files: [...files].sort() }, null, 1),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [precachePlugin()],
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
    // Revisione 1 (SCH-14): il pacchetto principale si divide in contenuti, testi e
    // motore, così nessun pezzo supera il limite e la build non dà avvisi.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      // Niente avviso PLUGIN_TIMINGS: misura solo quanto è lenta la macchina (il plugin
      // dei Worker di Vite), non dice niente del gioco, e la build deve restare senza avvisi.
      checks: { bundlerTimings: false },
      output: {
        codeSplitting: {
          groups: [
            { name: 'contenuti', test: /[\\/]src[\\/]content[\\/](?!text[\\/]).*\.json$/ },
            { name: 'testi', test: /[\\/]src[\\/](i18n|content[\\/]text)[\\/].*\.json$/ },
            { name: 'motore', test: /[\\/]src[\\/]engine[\\/]/ },
          ],
        },
      },
    },
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
