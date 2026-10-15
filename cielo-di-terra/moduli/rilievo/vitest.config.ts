import { defineConfig } from 'vitest/config';

// Il catasto è logica pura: i test girano in Node, senza DOM e senza WebGL.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
