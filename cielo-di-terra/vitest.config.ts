import { defineConfig } from 'vitest/config';

// I test girano in Node puro: la matematica del cilindro, il terreno, le celle
// e il controller del giocatore non dipendono da WebGL.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
