import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Banco di prova (npm run dev / npm run build:demo): demo/index.html importa il motore da ../../src.
// `three` viene sempre dalla radice del gioco (il modulo oggetti ne ha una copia propria).
const radiceGioco = fileURLToPath(new URL('../../', import.meta.url));
const three = `${radiceGioco}node_modules/three/`;

export default defineConfig({
  root: 'demo',
  base: './',
  resolve: {
    alias: [
      { find: /^three$/, replacement: `${three}build/three.module.js` },
      { find: /^three\/(.*)$/, replacement: `${three}$1` },
    ],
    dedupe: ['three'],
  },
  server: { host: '127.0.0.1', port: 5190, fs: { allow: [radiceGioco] } },
  build: { outDir: '../dist-demo', emptyOutDir: true, target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 4000 },
});
