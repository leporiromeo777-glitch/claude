/**
 * Smoke test (ARCHITETTURA 15.2): il gioco parte su tutti i progetti senza
 * errori in console, __GAME__.ready si risolve, nessuna richiesta esce da
 * localhost. In più: API core di 15.1, tempo deterministico, safe area simulata.
 */
import { expect, test, type Page } from '@playwright/test';
import type { GameDebugRoot } from '../../src/core/debug';

interface CoreApi {
  scene(): string | null;
  goto(id: string, params?: unknown): Promise<string | null>;
  viewport(): { cssW: number; cssH: number; dpr: number; safe: { top: number; bottom: number }; layout: string };
  time: { pause(): void; resume(): void; step(ms: number): void; setSpeed(x: number): void; now(): number; ticks(): number };
  missingAssets(): string[];
  missingKeys(locale?: string): string[];
  save(): { schema: number; settings: { locale: string } };
  events(n?: number): { k: string }[];
  exportSave(): string;
  importSave(s: string): { ok: boolean };
  setSettings(p: Record<string, unknown>): { highContrast: boolean };
  emit(name: string, payload: unknown): boolean;
  perf(): { fps: number; p50: number; p95: number };
}

// Il tipo di window.__GAME__ arriva da src/core/debug.ts (dichiarazione globale).
export type { GameDebugRoot };

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

async function boot(page: Page): Promise<{ errors: string[]; external: string[] }> {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && !LOCAL_HOSTS.has(url.hostname)) {
      external.push(url.href);
      await route.abort();
      return;
    }
    await route.continue();
  });
  await page.goto('');
  await page.waitForFunction(() => !!window.__GAME__);
  await page.evaluate(() => window.__GAME__!.ready);
  return { errors, external };
}

const core = (page: Page) => ({
  call: <T>(fn: (api: CoreApi) => T | Promise<T>) =>
    page.evaluate(`(${fn.toString()})(window.__GAME__.core)`) as Promise<Awaited<T>>,
});

test('avvio pulito: nessun errore, ready risolta, solo richieste locali', async ({ page }) => {
  const { errors, external } = await boot(page);
  const scene = await core(page).call((c) => c.scene());
  expect(['titolo', 'boot']).toContain(scene);
  // Lascia girare qualche fotogramma e qualche secondo di vita.
  await page.waitForTimeout(800);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('__GAME__.core espone tutte le funzioni di ARCHITETTURA 15.1', async ({ page }) => {
  await boot(page);
  const shape = await page.evaluate(() => {
    const c = window.__GAME__!.core as Record<string, unknown>;
    const time = c.time as Record<string, unknown>;
    return {
      ns: window.__GAME__!.namespaces(),
      core: Object.keys(c).filter((k) => typeof c[k] === 'function').sort(),
      time: Object.keys(time).filter((k) => typeof time[k] === 'function').sort(),
    };
  });
  expect(shape.ns).toContain('core');
  for (const fn of ['scene', 'goto', 'save', 'setSettings', 'wipe', 'exportSave', 'importSave', 'viewport', 'events', 'emit', 'perf', 'missingAssets', 'missingKeys']) {
    expect(shape.core, fn).toContain(fn);
  }
  for (const fn of ['pause', 'resume', 'step', 'setSpeed']) expect(shape.time, fn).toContain(fn);

  const save = await core(page).call((c) => c.save());
  expect(save.schema).toBe(1);
  expect(save.settings.locale).toBe('it');
  const exported = await core(page).call((c) => c.exportSave());
  expect(exported.startsWith('TRAMA-SAVE-1:')).toBe(true);
  expect(await page.evaluate((s) => (window.__GAME__!.core as CoreApi).importSave(s), exported)).toEqual({ ok: true });
  expect(await core(page).call((c) => c.setSettings({ highContrast: true }).highContrast)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.dataset.contrast)).toBe('alto');
  await core(page).call((c) => c.emit('toast', { textKey: 'core.ui.ok' }));
  const events = await core(page).call((c) => c.events(5).map((e) => e.k));
  expect(events).toContain('toast');
  expect(await core(page).call((c) => c.missingKeys('it'))).toEqual([]);
});

test('time.pause e time.step fanno avanzare la simulazione in modo deterministico', async ({ page }) => {
  await boot(page);
  const r = await core(page).call(async (c) => {
    c.time.pause();
    const t0 = c.time.ticks();
    await new Promise((res) => setTimeout(res, 300)); // in pausa il tempo reale non conta
    const t1 = c.time.ticks();
    c.time.step(1000);
    const t2 = c.time.ticks();
    c.time.step(250);
    const t3 = c.time.ticks();
    c.time.resume();
    return { paused: t1 - t0, second: t2 - t1, quarter: t3 - t2 };
  });
  expect(r).toEqual({ paused: 0, second: 60, quarter: 15 });
});

test('la scena boot mostra la safe area simulata (--safe-area-inset-top: 47px)', async ({ page }) => {
  await boot(page);
  await core(page).call((c) => c.goto('boot'));
  await expect(page.locator('[data-test="boot"]')).toBeVisible();
  await page.evaluate(() => document.documentElement.style.setProperty('--safe-area-inset-top', '47px'));
  await expect(page.locator('[data-test="boot-safe"]')).toContainText('47');
  const vp = await core(page).call((c) => c.viewport());
  expect(vp.safe.top).toBe(47);
  // Il pannello rispetta la safe area.
  const top = await page.locator('[data-test="boot"]').evaluate((e) => e.getBoundingClientRect().top);
  expect(top).toBeGreaterThanOrEqual(47);
});

test('gesti e tasti arrivano alla scena boot', async ({ page, isMobile }) => {
  await boot(page);
  await core(page).call((c) => c.goto('boot'));
  const vp = await core(page).call((c) => c.viewport());
  const x = Math.round(vp.cssW / 2);
  const y = vp.cssH - 40;
  if (isMobile) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await expect(page.locator('[data-test="boot-log"] li').first()).toContainText(/Tocco|Tap/);
  await page.keyboard.press('h');
  await expect(page.locator('[data-test="boot-log"] li').first()).toContainText(/Suggerimento|Hint/);
});

test('le impostazioni salvate si riapplicano a <html> dopo una ricarica', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => {
    const c = window.__GAME__!.core as { setSettings(p: object): unknown; flush(): Promise<void> };
    c.setSettings({ highContrast: true, textScale: 1.2, reducedMotion: true });
    await c.flush();
  });
  await page.reload();
  await page.waitForFunction(() => !!window.__GAME__);
  await page.evaluate(() => window.__GAME__!.ready);
  const attrs = await page.evaluate(() => ({
    contrast: document.documentElement.dataset.contrast,
    motion: document.documentElement.dataset.motion,
    scale: document.documentElement.style.getPropertyValue('--text-scale'),
    lang: document.documentElement.lang,
  }));
  expect(attrs).toEqual({ contrast: 'alto', motion: 'ridotto', scale: '1.2', lang: 'it' });
});
