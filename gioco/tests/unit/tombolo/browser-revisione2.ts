/**
 * Verifica nel browser della revisione 2 del tombolo e del motore (non è un test Vitest):
 *
 *   TOMBOLO_R2_URL=http://127.0.0.1:6000/ TOMBOLO_R2_OUT=<cartella> \
 *     node --experimental-strip-types tests/unit/tombolo/browser-revisione2.ts
 *
 * con una build `VITE_E2E=1 vite build` servita da `vite preview`. Playwright è
 * quello globale (PLAYWRIGHT_MODULE), Chromium in /opt/pw-browsers.
 * Rifà i passi del secondo playtest (docs/stato/playtest-2.json) che si vedono
 * solo nel browser e salva gli screenshot da guardare.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL0 = process.env.TOMBOLO_R2_URL ?? 'http://127.0.0.1:6000/';
const OUT = process.env.TOMBOLO_R2_OUT ?? '/tmp/tombolo-r2';
const PW = process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs';
const ONLY = (process.env.TOMBOLO_R2_ONLY ?? '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

type Page = import('playwright').Page;
type Browser = import('playwright').Browser;

const checks: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = ''): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function call<T = unknown>(page: Page, path: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([p, a]) => {
      const parts = (p as string).split('.');
      let target: unknown = (window as unknown as { __GAME__?: unknown }).__GAME__;
      let self: unknown = null;
      for (const k of parts) {
        self = target;
        target = (target as Record<string, unknown>)[k];
      }
      return (await (target as (...x: unknown[]) => unknown).apply(self, a as unknown[])) as unknown;
    },
    [path, args] as const,
  ) as Promise<T>;
}

async function open(browser: Browser, w: number, h: number, opts: { touch?: boolean; scale?: number } = {}): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${URL0}?debug=1`);
  await page.waitForFunction(() => !!(window as unknown as { __GAME__?: unknown }).__GAME__);
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await call(page, 'core.setSettings', { animSpeed: 1, textScale: opts.scale ?? 1, locale: 'it' });
  return { page, errors, close: () => ctx.close() };
}

async function shot(page: Page, name: string, clip?: { x: number; y: number; width: number; height: number }): Promise<void> {
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}) });
}

const text = async (page: Page, test: string): Promise<string> => (await page.locator(`[data-test="${test}"]`).first().textContent().catch(() => '')) ?? '';
const want = (k: string): boolean => ONLY.length === 0 || ONLY.includes(k);

interface Lay {
  kind: string;
  spindles: { col: number; thread: string; cx: number; cy: number }[];
  pins: { kind: string; col: number; hour: number; x: number; y: number }[];
  buttons: Record<string, { x: number; y: number; w: number; h: number } | null>;
}

/** Q011, Q052: le perline sotto la riga corrente (g06: la voce di Teresa, unica del suo filo). */
async function perline(browser: Browser): Promise<void> {
  for (const [w, h, scale, touch] of [[1440, 900, 1, false], [360, 640, 1.4, true]] as const) {
    const { page, errors, close } = await open(browser, w, h, { touch, scale });
    await call(page, 'night.start', { level: 'g06', origin: 'campagna', accepted: ['g06.nina', 'g06.zeno'] });
    await page.waitForTimeout(600);
    await shot(page, `q011-g06-${w}x${h}`);
    const lay = await call<Lay>(page, 'night.layout');
    const ter = lay.spindles.find((s) => s.thread === 'teresa');
    if (ter) {
      // Pressione lunga sul fuso: la scheda dice che cosa porta (anche su touch).
      if (touch) {
        await page.touchscreen.tap(ter.cx, ter.cy);
        await page.waitForTimeout(100);
      }
      await call(page, 'night.close').catch(() => undefined);
    }
    check(`Q011 ${w}×${h}: nessun errore`, errors.length === 0, errors.join(' | '));
    await close();
  }
  // Scheda del personaggio con «Adesso» (clic destro su desktop).
  const { page, errors, close } = await open(browser, 1440, 900);
  await call(page, 'night.start', { level: 'g06', origin: 'campagna', accepted: ['g06.nina', 'g06.zeno'] });
  await page.waitForTimeout(600);
  const lay = await call<Lay>(page, 'night.layout');
  const ter = lay.spindles.find((s) => s.thread === 'teresa')!;
  await page.mouse.click(ter.cx, ter.cy, { button: 'right' });
  await page.waitForTimeout(400);
  const card = await text(page, 'tb-scheda-stato');
  check('Q052: la scheda di Teresa dice che cosa porta', /Porta /.test(card), card);
  await shot(page, 'q052-scheda-teresa');
  await page.keyboard.press('Escape');
  // Passaggio del mouse sul fuso (Q021).
  await page.mouse.move(ter.cx, ter.cy);
  await page.waitForTimeout(400);
  const tip = (await page.locator('[data-tipo="fuso"]').first().textContent().catch(() => '')) ?? '';
  check('Q021: col mouse sul fuso nome e motivo', /Teresa/.test(tip) && /filo/.test(tip), tip);
  await shot(page, 'q021-fuso-mouse');
  check('Q052: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

/** Q025, Q041: Indizio con la bozza, Fantasma con tutta la riga (g13). */
async function suggerimenti(browser: Browser): Promise<void> {
  for (const [w, h, scale, touch] of [[1440, 900, 1, false], [360, 640, 1.4, true]] as const) {
    const { page, errors, close } = await open(browser, w, h, { touch, scale });
    await call(page, 'night.start', { level: 'g13', origin: 'campagna', accepted: ['g13.marta', 'g13.nina'], needsNome: true });
    await page.waitForTimeout(500);
    await call(page, 'night.setNome', 'lunardi');
    await call(page, 'night.cross', 1, 'L');
    await page.waitForTimeout(200);
    const ind = await call<{ textKey: string }>(page, 'night.hint', 'indizio');
    await page.waitForTimeout(300);
    const t1 = await text(page, 'tb-suggerimento');
    check(`Q025 ${w}×${h}: l'Indizio nomina l'incrocio che manca`, ind.textKey === 'tombolo.hint.indizio.sopra' && /Gino/.test(t1) && /Piero/.test(t1), t1);
    await shot(page, `q025-g13-indizio-${w}x${h}`);
    await page.keyboard.press('Escape');
    const g = await call<{ textKey: string }>(page, 'night.hint', 'fantasma');
    await page.waitForTimeout(300);
    const t2 = await text(page, 'tb-suggerimento');
    check(`Q041 ${w}×${h}: il Fantasma nomina i due incroci`, g.textKey === 'tombolo.hint.fantasma.due', t2);
    await shot(page, `q041-g13-fantasma-${w}x${h}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await shot(page, `q041-g13-tratteggi-${w}x${h}`);
    check(`Q041 ${w}×${h}: nessun errore`, errors.length === 0, errors.join(' | '));
    await close();
  }
}

/** Q023: g12, la lampada prima del nome non dà verdetti; dopo il nome si ricalcola. */
async function g12(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 1180, 820, { touch: true });
  await call(page, 'night.start', { level: 'g12', origin: 'campagna', accepted: ['g12.lunardi', 'g12.zeno'], needsNome: true });
  await page.waitForTimeout(600);
  const st0 = await call<{ requests: { noteId: string; status: string }[] }>(page, 'night.state');
  const lun0 = st0.requests?.find((r) => r.noteId === 'g12.lunardi');
  check('Q023: Lunardi non è «a rischio» prima del nome', !lun0 || lun0.status === 'in_corso', JSON.stringify(lun0));
  const lay = await call<Lay>(page, 'night.layout');
  const lamp = lay.buttons.lamp ?? lay.buttons.lampada;
  if (lamp) await page.touchscreen.tap(lamp.x + lamp.w / 2, lamp.y + lamp.h / 2);
  else await call(page, 'night.hint');
  await page.waitForTimeout(700);
  const before = await text(page, 'tb-suggerimento');
  check('Q023: prima del nome niente «non si può compiere»', !/non si può compiere/.test(before), before);
  await shot(page, 'q023-g12-prima-del-nome');
  await page.keyboard.press('Escape');
  await call(page, 'night.setNome', 'marta');
  await page.waitForTimeout(300);
  if (lamp) await page.touchscreen.tap(lamp.x + lamp.w / 2, lamp.y + lamp.h / 2);
  else await call(page, 'night.hint');
  await page.waitForTimeout(900);
  const after = await text(page, 'tb-suggerimento');
  check('Q023: dopo il nome la lampada non dice che Lunardi è impossibile', !/non si può compiere/.test(after), after);
  await shot(page, 'q023-g12-dopo-il-nome');
  check('Q023: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

/** Q001: nel prologo nessun «Fissa fino alle N». */
async function prologo(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 390, 844, { touch: true });
  await call(page, 'night.start', { level: 'g00', origin: 'campagna' });
  await page.waitForTimeout(500);
  await call(page, 'night.cross', 0, 'R');
  await call(page, 'night.fix');
  await page.waitForTimeout(1500);
  const vis = await page.locator('[data-test="tb-salta-quiete"]').isVisible().catch(() => false);
  check('Q001: alle 7 del prologo niente «Fissa fino alle N»', !vis);
  await shot(page, 'q001-prologo-ora7');
  check('Q001: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

/** Q033: febbre e nodo sul fuso. */
async function stati(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 1440, 900);
  await call(page, 'night.start', { level: 'g13', origin: 'campagna', needsNome: false });
  await page.waitForTimeout(600);
  const lay = await call<Lay>(page, 'night.layout');
  const sp = lay.spindles;
  const y0 = Math.min(...sp.map((s) => s.cy)) - 120;
  await shot(page, 'q033-g13-febbre-fusi', { x: Math.min(...sp.map((s) => s.cx)) - 60, y: Math.max(0, y0), width: Math.max(...sp.map((s) => s.cx)) - Math.min(...sp.map((s) => s.cx)) + 120, height: 300 });
  await shot(page, 'q033-g13-intero');
  await call(page, 'night.start', { fixture: 'test-rancore', origin: 'libero' });
  await page.waitForTimeout(500);
  await call(page, 'night.cross', 0, 'R');
  await call(page, 'night.fix');
  await page.waitForTimeout(500);
  await shot(page, 'q033-nodo');
  check('Q033: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

/** Q051: il filo nero che entra è annunciato (modalità extra). */
async function nero(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 360, 640, { touch: true, scale: 1.4 });
  await call(page, 'night.start', { fixture: 'test-nero', origin: 'libero' });
  await page.waitForTimeout(700);
  const msg = await text(page, 'tb-explain');
  check('Q051: annuncio del filo nero', /filo nero/.test(msg) && /esce/.test(msg), msg);
  await shot(page, 'q051-annuncio-nero');
  check('Q051: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

/** Q030: finale D, occasioni e lampada. Q029: finale B, filo controllato. */
async function finali(browser: Browser): Promise<void> {
  {
    const { page, errors, close } = await open(browser, 390, 844, { touch: true });
    await call(page, 'night.start', { level: 'fin_aperto', origin: 'campagna', mode: 'occasioni' });
    await page.waitForTimeout(800);
    await shot(page, 'q030-fin-aperto');
    const lay = await call<Lay>(page, 'night.layout');
    const slot = lay.pins.find((p) => p.kind === 'verde' && p.y > 0);
    if (slot) {
      await page.touchscreen.tap(slot.x, slot.y);
      await page.waitForTimeout(400);
    }
    check('Q030: c\'è uno slot da toccare', !!slot, JSON.stringify(slot ?? lay.pins.slice(0, 3)));
    const msg = await text(page, 'tb-explain');
    check('Q030: piantare dice che cosa', /Occasione piantata/.test(msg), msg);
    await shot(page, 'q030-piantata');
    const lampVis = await page.locator('[data-test="tb-lampada"]').isVisible();
    check('Q030: la lampada c\'è', lampVis);
    check('Q030: nessun errore', errors.length === 0, errors.join(' | '));
    await close();
  }
  {
    const { page, errors, close } = await open(browser, 1440, 900);
    await call(page, 'night.start', { level: 'fin_seppia', origin: 'campagna', mode: 'controllato' });
    await page.waitForTimeout(800);
    await shot(page, 'q029-fin-seppia-nota');
    const lay = await call<Lay>(page, 'night.layout');
    const other = lay.spindles.find((s) => s.thread !== 'ada');
    if (other) {
      await page.mouse.move(other.cx, other.cy);
      await page.mouse.down();
      await page.mouse.move(other.cx + 40, other.cy, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(300);
    }
    const msg = await text(page, 'tb-explain');
    check('Q029: trascinare un altro fuso lo dice', /Muovi solo il filo di/.test(msg), msg);
    await shot(page, 'q029-fin-seppia-rifiuto');
    check('Q029: nessun errore', errors.length === 0, errors.join(' | '));
    await close();
  }
}

/** Q064: l'apparizione del filo nero in g08 dura e si vede. */
async function apparizione(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 1440, 900);
  await call(page, 'night.start', { level: 'g08', origin: 'telaio' });
  await page.waitForTimeout(500);
  void call(page, 'night.autoplay');
  await page.waitForTimeout(1500);
  await shot(page, 'q064-g08-apparizione-1500ms');
  const msg = await text(page, 'tb-explain');
  check('Q064: a 1,5 s l\'apparizione è ancora lì, e lo dice', /filo nero/.test(msg), msg);
  await page.waitForTimeout(3000);
  await shot(page, 'q064-g08-dopo');
  check('Q064: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function main(): Promise<void> {
  const { chromium } = (await import(PW)) as typeof import('playwright');
  const browser = await chromium.launch();
  try {
    if (want('perline')) await perline(browser);
    if (want('suggerimenti')) await suggerimenti(browser);
    if (want('g12')) await g12(browser);
    if (want('prologo')) await prologo(browser);
    if (want('stati')) await stati(browser);
    if (want('nero')) await nero(browser);
    if (want('finali')) await finali(browser);
    if (want('apparizione')) await apparizione(browser);
  } finally {
    await browser.close();
  }
  const bad = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - bad.length}/${checks.length} controlli OK`);
  if (bad.length > 0) process.exitCode = 1;
}

void main();
