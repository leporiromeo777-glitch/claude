import { defineConfig, type Plugin } from 'vite';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Gli artifact di claude.ai non servono i file .glb: nella build i modelli dei personaggi
 * diventano testo base64 (<id>.glb.txt) e l'indice punta a quelli; src/personaggi/precarica.ts
 * li decodifica. In sviluppo e nei test restano i .glb di public/personaggi.
 */
function glbComeTesto(): Plugin {
  let uscita = 'dist';
  return {
    name: 'glb-come-testo',
    apply: 'build',
    configResolved(c) {
      uscita = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const cartella = join(uscita, 'personaggi');
      if (!existsSync(cartella)) return;
      for (const f of readdirSync(cartella).filter((x) => x.endsWith('.glb'))) {
        writeFileSync(join(cartella, `${f}.txt`), readFileSync(join(cartella, f)).toString('base64'));
        rmSync(join(cartella, f));
      }
      const percorsoIndice = join(cartella, 'indice.json');
      if (!existsSync(percorsoIndice)) return;
      const indice = JSON.parse(readFileSync(percorsoIndice, 'utf8')) as { personaggi?: { file?: string; lod1?: { file?: string } }[] };
      for (const p of indice.personaggi ?? []) {
        if (p.file?.endsWith('.glb')) p.file = `${p.file}.txt`;
        if (p.lod1?.file?.endsWith('.glb')) p.lod1.file = `${p.lod1.file}.txt`;
      }
      writeFileSync(percorsoIndice, JSON.stringify(indice, null, 1));
    },
  };
}

// Configurazione Vite. La modalità "e2e" (npm run build:e2e) attiva VITE_E2E=1
// tramite il file .env.e2e, così la build di produzione espone window.__GAME__.
// Data e ora della build (ora svizzera), mostrata nel titolo: dice al giocatore se ha la versione nuova.
const AGGIORNAMENTO = new Date().toLocaleString('it-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default defineConfig({
  base: './',
  define: { __AGGIORNAMENTO__: JSON.stringify(AGGIORNAMENTO) },
  plugins: [glbComeTesto()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});
