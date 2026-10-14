import { defineConfig, devices } from '@playwright/test';

// Test end-to-end (ARCHITETTURA 15.2). Playwright è fissato a 1.56.1, la
// versione del Chromium presente in /opt/pw-browsers. Mai --use-angle=swiftshader:
// rende il canvas dieci volte più lento.
// La porta si può cambiare con E2E_PORT (utile quando più persone lanciano i test
// sulla stessa macchina); il valore normativo è 4173.
const PORT = Number(process.env.E2E_PORT ?? 4173);
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `${ORIGIN}/?debug=1`,
    browserName: 'chromium',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    },
    {
      name: 'desktop-hd',
      use: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    },
    {
      name: 'iphone',
      use: {
        userAgent: devices['iPhone 13'].userAgent,
        viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      },
    },
    {
      name: 'android-piccolo',
      use: {
        userAgent: devices['Galaxy S8'].userAgent,
        viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      },
    },
    {
      name: 'ipad-orizzontale',
      use: {
        userAgent: devices['iPad Pro 11 landscape'].userAgent,
        viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
      },
    },
  ],
  webServer: {
    // Build di test (VITE_E2E=1: API di debug sempre attiva) servita da vite preview.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `${ORIGIN}/`,
    env: { VITE_E2E: '1' },
    // Di norma si rifà sempre la build: niente server vecchi o di altri progetti
    // sulla stessa porta. E2E_REUSE=1 riusa un server già avviato.
    reuseExistingServer: process.env.E2E_REUSE === '1',
    timeout: 300_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
