import { defineConfig } from 'vite';

// Configurazione Vite. La modalità "e2e" (npm run build:e2e) attiva VITE_E2E=1
// tramite il file .env.e2e, così la build di produzione espone window.__GAME__.
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
});
