import { defineConfig } from 'vite';

// Configurazione Vite. La modalità "e2e" (npm run build:e2e) attiva VITE_E2E=1
// tramite il file .env.e2e, così la build di produzione espone window.__GAME__.
// Data e ora della build (ora svizzera), mostrata nel titolo: dice al giocatore se ha la versione nuova.
const AGGIORNAMENTO = new Date().toLocaleString('it-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default defineConfig({
  base: './',
  define: { __AGGIORNAMENTO__: JSON.stringify(AGGIORNAMENTO) },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});
