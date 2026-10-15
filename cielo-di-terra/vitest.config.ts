import { defineConfig } from 'vitest/config';

// I test girano in Node puro: la matematica del cilindro, il terreno, le celle
// e il controller del giocatore non dipendono da WebGL (tests/ui usa happy-dom).
// Tempi larghi: il popolamento di Corbella si costruisce in ~5 s e il simulatore
// delle notti gioca 1.000 partite.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
