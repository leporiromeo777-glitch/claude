import { defineConfig } from 'vitest/config';

// Test unitari della logica non sonora (mixer, mappature, generatore musicale).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.offline.test.ts'],
    environment: 'node',
  },
});
