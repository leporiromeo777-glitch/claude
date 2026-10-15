import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Test in Node. `three` viene sempre dalla radice del gioco (il modulo oggetti ha una sua copia:
// due copie di three romperebbero instanceof e i tipi).
const radice = fileURLToPath(new URL('../../node_modules/three/', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^three$/, replacement: `${radice}build/three.module.js` },
      { find: /^three\/(.*)$/, replacement: `${radice}$1` },
    ],
    dedupe: ['three'],
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
  },
});
