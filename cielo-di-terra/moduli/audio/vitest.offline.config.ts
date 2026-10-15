import { defineConfig } from 'vitest/config';

// Rendering offline (OfflineAudioContext) in Chromium headless tramite Playwright.
export default defineConfig({
  test: {
    include: ['test/**/*.offline.test.ts'],
    environment: 'node',
    testTimeout: 300_000,
    hookTimeout: 120_000,
  },
});
