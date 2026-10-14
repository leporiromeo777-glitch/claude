/**
 * Verifica del tombolo nel browser (Chromium di Playwright 1.56.1), con un
 * server di sviluppo proprio. Non è un test Vitest (niente `.test.ts`): si
 * lancia a mano e controlla i criteri d'accettazione del pacchetto:
 *
 *   npx tsx tests/unit/tombolo/browser-verify.ts
 *   TOMBOLO_VERIFY_PORT=5241           porta del server di sviluppo (5240-5244)
 *   TOMBOLO_VERIFY_URL=http://…/      usa un server già avviato
 *   TOMBOLO_VERIFY_OUT=<cartella>      dove salvare gli screenshot
 *
 * - prologo (fixture del motore) con il mouse, con eventi pointer touch, con la
 *   sola tastiera: rifiuto di Marta, nota «Chi sta sopra, dà», incroci 4;
 * - Fissa l'ora: prima violazione in una riga (spillo, corre, matassa);
 * - ripresa dopo il ricaricamento (riga, bozza, richieste lasciate cadere);
 * - test-motivi: screenshot dei 12 motivi; layout a 360×640, 390×844, 1280×720,
 *   ridimensionamento dal vivo 390×844 → 1180×820;
 * - prestazioni: 3 s di trascinamento su 6×14, p95 < 8 ms;
 * - Archivio, occasioni, spartito, lampada dei suggerimenti.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PORT = Number(process.env.TOMBOLO_VERIFY_PORT ?? 5241);
const EXTERNAL_URL = process.env.TOMBOLO_VERIFY_URL;
const OUT = process.env.TOMBOLO_VERIFY_OUT ?? join(tmpdir(), 'tombolo-verify');
mkdirSync(OUT, { recursive: true });

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}
const checks: Check[] = [];
function check(name: string, ok: boolean, detail = ''): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function startServer(): Promise<{ url: string; proc: ChildProcess | null }> {
  if (EXTERNAL_URL) return { url: EXTERNAL_URL, proc: null };
  const proc = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'ignore'],
    env: { ...process.env, BROWSER: 'none' },
    detached: true,
  });
  const url = `http://127.0.0.1:${PORT}/`;
  const t0 = Date.now();
  for (;;) {
    try {
      const r = await fetch(url);
      if (r.ok) break;
    } catch {
      /* non ancora pronto */
    }
    if (Date.now() - t0 > 60_000) throw new Error('vite dev server did not start');
    await new Promise((r) => setTimeout(r, 300));
  }
  return { url, proc };
}

function stopServer(proc: ChildProcess | null): void {
  if (!proc?.pid) return;
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    proc.kill('SIGTERM');
  }
}

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

function night<T = Json>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([f, a]) => {
      const api = (window as unknown as { __GAME__: Record<string, Record<string, (...x: unknown[]) => unknown>> }).__GAME__.night;
      const target = api?.[f as string];
      if (typeof target !== 'function') throw new Error(`__GAME__.night.${String(f)} missing`);
      return (await target(...(a as unknown[]))) as T;
    },
    [fn, args] as const,
  ) as Promise<T>;
}

function core<T = Json>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([f, a]) => {
      const api = (window as unknown as { __GAME__: Record<string, Record<string, (...x: unknown[]) => unknown>> }).__GAME__.core;
      return (await (api[f as string] as (...x: unknown[]) => unknown)(...(a as unknown[]))) as T;
    },
    [fn, args] as const,
  ) as Promise<T>;
}

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function openPage(browser: Browser, url: string, opts: BrowserContextOptions, errors: string[]): Promise<Page> {
  const ctx = await browser.newContext({ locale: 'it-IT', ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?debug=1`);
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  return page;
}

async function start(page: Page, o: Record<string, unknown>): Promise<Json> {
  const st = await night(page, 'start', o);
  await wait(250);
  return st;
}

async function center(page: Page, sel: string): Promise<{ x: number; y: number } | null> {
  const r = await page.locator(sel).first().boundingBox();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}

// ───────── Puntatore: mouse e tocco ─────────

async function mouseDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 14): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await wait(16);
  }
  await page.mouse.up();
  await wait(280);
}

async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 14): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
  for (let i = 1; i <= steps; i++) {
    await wait(16);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await wait(280);
}

async function touchTap(page: Page, p: { x: number; y: number }): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y }] });
  await wait(40);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await wait(250);
}

type Pointer = 'mouse' | 'touch';

async function dragSpindle(page: Page, kind: Pointer, fromCol: number, toCol: number): Promise<void> {
  const l = await night(page, 'layout');
  const a = l.spindles[fromCol];
  const b = l.spindles[toCol];
  const from = { x: a.cx, y: a.cy };
  const to = { x: b.cx, y: a.cy };
  if (kind === 'mouse') await mouseDrag(page, from, to);
  else await touchDrag(page, from, to);
}

async function tapAt(page: Page, kind: Pointer, p: { x: number; y: number }): Promise<void> {
  if (kind === 'mouse') {
    await page.mouse.click(p.x, p.y);
    await wait(250);
  } else await touchTap(page, p);
}

async function pressFix(page: Page, kind: Pointer): Promise<void> {
  const p = await center(page, '[data-test="tb-fissa"]');
  if (p) await tapAt(page, kind, p);
}

async function tapCrossing(page: Page, kind: Pointer, pair: number): Promise<void> {
  const l = await night(page, 'layout');
  const r = l.currentRow;
  await tapAt(page, kind, { x: (l.columns[pair].cx + l.columns[pair + 1].cx) / 2, y: r.y + r.h / 2 });
}

async function completeEvent(page: Page): Promise<Json | null> {
  const ev = (await core<Json[]>(page, 'events', 300)) ?? [];
  const found = ev.filter((e: Json) => e.name === 'night:complete' || e.k === 'night:complete' || e.type === 'night:complete');
  return found.length > 0 ? found[found.length - 1] : null;
}

/** Il prologo giocato con il puntatore (mouse o tocco). */
async function prologueWithPointer(page: Page, kind: Pointer, tag: string): Promise<void> {
  await start(page, { fixture: 'g00', origin: 'campagna' });
  await pressFix(page, kind);
  let s = await night(page, 'state');
  check(`[${tag}] Fissa l'ora senza incroci: prima violazione (spillo) in una riga`, s.message?.key === 'tombolo.violazione.spillo' && /Marta/.test(s.message?.text ?? ''), s.message?.text ?? '');
  await dragSpindle(page, kind, 1, 0);
  s = await night(page, 'state');
  check(`[${tag}] 6: Marta trascinata sopra Teresa`, JSON.stringify(s.draft) === '[{"pair":0,"over":"R"}]', JSON.stringify(s.draft));
  await pressFix(page, kind);
  await dragSpindle(page, kind, 2, 1);
  s = await night(page, 'state');
  const marginVisible = await page.locator('[data-test="tb-margine"]').isVisible();
  check(`[${tag}] 7: verso sbagliato → nota a margine «Chi sta sopra, dà»`, s.margin.current === 'atto1.g00.margine.sopraDa' && marginVisible, `${s.margin.current} visibile=${marginVisible}`);
  await tapCrossing(page, kind, 1);
  s = await night(page, 'state');
  check(`[${tag}] 7: tocco sull'incrocio → rovesciato`, JSON.stringify(s.draft) === '[{"pair":1,"over":"L"}]', JSON.stringify(s.draft));
  await page.screenshot({ path: join(OUT, `${tag}-riga7.png`) });
  await pressFix(page, kind);
  await dragSpindle(page, kind, 2, 1);
  await pressFix(page, kind);
  await dragSpindle(page, kind, 1, 0);
  s = await night(page, 'state');
  check(
    `[${tag}] 9: Teresa su Marta → Violation 'rifiuto', rimbalzo e messaggio`,
    s.lastViolation?.code === 'rifiuto' && s.draft.length === 0 && /No\./.test(s.message?.text ?? ''),
    `${s.lastViolation?.code} bozza=${JSON.stringify(s.draft)} msg=${s.message?.text}`,
  );
  await page.screenshot({ path: join(OUT, `${tag}-rifiuto.png`) });
  await dragSpindle(page, kind, 0, 1);
  await pressFix(page, kind);
  s = await night(page, 'state');
  const ev = await completeEvent(page);
  const metrics = s.outcome?.metrics;
  check(`[${tag}] notte completa, night:complete con incroci 4`, s.completed && metrics?.incroci === 4 && !!ev, `metrics=${JSON.stringify(metrics)} evento=${!!ev}`);
  await page.screenshot({ path: join(OUT, `${tag}-fine.png`) });
}

async function prologueWithKeyboard(page: Page): Promise<void> {
  await start(page, { fixture: 'g00', origin: 'campagna' });
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  const k = page.keyboard;
  await k.press('Enter');
  let s = await night(page, 'state');
  check('[tastiera] Invio senza incroci → violazione spillo', s.message?.key === 'tombolo.violazione.spillo', s.message?.text ?? '');
  await k.press('1');
  await k.press('Shift+Space');
  await k.press('Enter');
  await k.press('ArrowRight');
  await k.press('Shift+Space');
  s = await night(page, 'state');
  check('[tastiera] 7: verso sbagliato → nota a margine', s.margin.current === 'atto1.g00.margine.sopraDa', s.margin.current);
  await k.press('f');
  s = await night(page, 'state');
  check('[tastiera] F rovescia l\'incrocio', JSON.stringify(s.draft) === '[{"pair":1,"over":"L"}]', JSON.stringify(s.draft));
  await k.press('Enter');
  await k.press('Space');
  await k.press('Backspace');
  s = await night(page, 'state');
  check('[tastiera] Backspace disfa', s.draft.length === 0, JSON.stringify(s.draft));
  await k.press('Space');
  await k.press('Enter');
  await k.press('ArrowLeft');
  await k.press('Shift+Space');
  s = await night(page, 'state');
  check('[tastiera] 9: Maiusc+Spazio con Teresa sopra Marta → rifiuto', s.lastViolation?.code === 'rifiuto' && s.draft.length === 0, s.message?.text ?? '');
  await k.press('Space');
  await k.press('Enter');
  s = await night(page, 'state');
  check('[tastiera] notte completa con incroci 4', s.completed && s.outcome?.metrics?.incroci === 4, JSON.stringify(s.outcome?.metrics));
  const sr = await page.locator('[data-test="tb-stato"]').textContent();
  check('riga di stato per gli screen reader aggiornata', /Teresa/.test(sr ?? '') && /Forno/.test(sr ?? ''), sr ?? '');
}

async function violationsAtFix(page: Page): Promise<void> {
  const level = {
    id: 'verifica-corre',
    kind: 'test',
    act: 1,
    titleKey: 'tombolo.test.bordi',
    columns: ['forno', 'piazza', 'chiesa'],
    startHour: 6,
    endHour: 8,
    threads: [
      { id: 'teresa', kind: 'persona', character: 'teresa' },
      { id: 'gino', kind: 'persona', character: 'gino' },
      { id: 'marta', kind: 'persona', character: 'marta' },
    ],
    initial: ['teresa', 'gino', 'marta'],
    beads: [],
    rules: ['incrocio', 'matassa'],
    quirks: ['ginoCorre'],
    pins: [],
    matassa: 1,
  };
  await start(page, { level, origin: 'libero' });
  await pressFix(page, 'mouse');
  let s = await night(page, 'state');
  check("Fissa l'ora con Gino fermo → violazione corre in una riga", s.message?.key === 'tombolo.violazione.corre' && /Gino/.test(s.message?.text ?? ''), s.message?.text ?? '');
  await night(page, 'cross', 0, 'R');
  await pressFix(page, 'mouse');
  await night(page, 'cross', 1, 'L');
  s = await night(page, 'state');
  check('matassa finita → violazione matassa in una riga', s.lastViolation?.code === 'matassa' && s.message?.key === 'tombolo.violazione.matassa', s.message?.text ?? '');
}

async function resumeAfterReload(page: Page): Promise<void> {
  await start(page, { fixture: 'g06', accepted: ['g06.nina', 'g06.marta'], origin: 'campagna' });
  await night(page, 'fix');
  await night(page, 'fix');
  await night(page, 'cross', 3, 'L');
  await night(page, 'drop', 'g06.marta');
  const before = await night(page, 'state');
  await core(page, 'flush');
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  const ok = await night<boolean>(page, 'resume');
  await wait(400);
  const after = await night(page, 'state');
  check(
    'ricarica a metà notte: stessa riga, stessa bozza, stesse richieste lasciate cadere',
    ok && after.hour === before.hour && JSON.stringify(after.draft) === JSON.stringify(before.draft) && JSON.stringify(after.dropped) === '["g06.marta"]',
    `ora ${before.hour}→${after.hour} bozza ${JSON.stringify(after.draft)} lasciate ${JSON.stringify(after.dropped)}`,
  );
}

/** Nessun testo che esce dal suo contenitore, pulsanti ≥ 48 px, colonne ≥ 52 px. */
async function layoutAudit(page: Page, tag: string): Promise<void> {
  const l = await night(page, 'layout');
  check(`[${tag}] colonne ≥ 52 px`, l.colW >= 52, `colW=${l.colW}`);
  const audit = await page.evaluate(() => {
    const root = document.querySelector('.tb-root');
    const small: string[] = [];
    const over: string[] = [];
    const out: string[] = [];
    if (!root) return { small: ['no root'], over, out };
    for (const b of Array.from(root.querySelectorAll<HTMLElement>('button'))) {
      const r = b.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.width < 47.5 || r.height < 47.5) small.push(`${b.dataset.test ?? b.className} ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (r.left < -0.5 || r.right > window.innerWidth + 0.5 || r.top < -0.5 || r.bottom > window.innerHeight + 0.5) out.push(`${b.dataset.test ?? b.className} x ${Math.round(r.left)}..${Math.round(r.right)} y ${Math.round(r.top)}..${Math.round(r.bottom)}`);
    }
    for (const e of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      if (e.closest('.core-sr-only') || e.closest('[hidden]')) continue;
      if (!e.textContent || e.children.length > 0 && e.tagName !== 'SPAN') continue;
      if (e.clientWidth === 0) continue;
      if (e.scrollWidth > e.clientWidth + 1) over.push(`${e.className || e.tagName}: "${e.textContent.slice(0, 30)}" ${e.scrollWidth}>${e.clientWidth}`);
    }
    return { small, over, out };
  });
  check(`[${tag}] pulsanti dentro lo schermo`, audit.out.length === 0, audit.out.join('; '));
  check(`[${tag}] pulsanti ≥ 48 px`, audit.small.length === 0, audit.small.join('; '));
  check(`[${tag}] nessun testo esce dai contenitori`, audit.over.length === 0, audit.over.join('; '));
}

async function main(): Promise<void> {
  const { url, proc } = await startServer();
  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    // ───── Prologo con il mouse, Fissa l'ora, ripresa (desktop) ─────
    const desk = await openPage(browser, url, { viewport: { width: 1280, height: 720 } }, errors);
    const ns = await desk.evaluate(() => (window as unknown as { __GAME__: { namespaces(): string[] } }).__GAME__.namespaces());
    check('namespace night registrato', ns.includes('night'), ns.join(','));
    await prologueWithPointer(desk, 'mouse', 'mouse');
    const spartito = (await night(desk, 'state')).outcome?.spartito as string;
    const prologueRows = JSON.stringify((await night(desk, 'state')).outcome?.rows);
    await violationsAtFix(desk);
    await layoutAudit(desk, '1280×720');
    {
      await start(desk, { fixture: 'test-grande' });
      const l = await night(desk, 'layout');
      const panels = await desk.evaluate(() => [...document.querySelectorAll('[data-test="tb-pannello-sinistro"],[data-test="tb-pannello-destro"]')].map((e) => (e as HTMLElement).getBoundingClientRect().width));
      check('1280×720: tre pannelli (Bigliettini, tombolo, Taccuino)', l.kind === 'largo' && !!l.left && !!l.right && panels.every((w) => w >= 280) && l.center.x >= l.left.x + l.left.w && l.center.x + l.center.w <= l.right.x, JSON.stringify({ left: l.left, center: l.center, right: l.right }));
      await desk.screenshot({ path: join(OUT, 'largo-1280.png') });
      // Prestazioni: 3 secondi di trascinamento continuo su 6 colonne × 14 righe.
      const a = l.spindles[2];
      const b = l.spindles[3];
      await desk.mouse.move(a.cx, a.cy);
      await desk.mouse.down();
      const t0 = Date.now();
      let i = 0;
      while (Date.now() - t0 < 3000) {
        const k = (Math.sin(i / 9) + 1) / 2;
        await desk.mouse.move(a.cx + (b.cx - a.cx) * k * 1.4 - (b.cx - a.cx) * 0.2, a.cy + Math.sin(i / 5) * 6);
        await wait(8);
        i++;
      }
      const perf = await core<Json>(desk, 'perf');
      await desk.mouse.up();
      check('prestazioni: 3 s di trascinamento su 6×14, p95 < 8 ms', perf.p95 < 8, JSON.stringify(perf));
    }
    await resumeAfterReload(desk);
    await desk.close();

    // ───── Prologo solo da tastiera ─────
    const kb = await openPage(browser, url, { viewport: { width: 1280, height: 720 } }, errors);
    await prologueWithKeyboard(kb);
    await kb.close();

    // ───── Prologo con eventi pointer touch (iPhone) ─────
    const phone = await openPage(browser, url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, errors);
    await prologueWithPointer(phone, 'touch', 'touch');
    const pointerType = await phone.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const c = document.getElementById('scene-canvas');
          c?.addEventListener('pointerdown', (e) => resolve(e.pointerType), { once: true });
          setTimeout(() => resolve('nessuno'), 1500);
        }),
    );
    void pointerType;
    {
      await start(phone, { fixture: 'test-grande' });
      await layoutAudit(phone, '390×844');
      await phone.screenshot({ path: join(OUT, 'iphone-grande.png') });
      await phone.evaluate(() => {
        (window as unknown as { __marker: number }).__marker = 42;
      });
      const before = (await night(phone, 'layout')).kind;
      await phone.setViewportSize({ width: 1180, height: 820 });
      await wait(400);
      const after = await night(phone, 'layout');
      const marker = await phone.evaluate(() => (window as unknown as { __marker?: number }).__marker);
      check('ridimensionamento 390×844 → 1180×820 cambia layout senza ricaricare', before === 'stretto' && after.kind === 'largo' && marker === 42 && !!after.left, `${before} → ${after.kind}, marcatore ${marker}`);
      await phone.screenshot({ path: join(OUT, 'ipad-1180.png') });
    }
    await phone.close();

    // ───── Telefono piccolo, testo grande, inglese ─────
    const small = await openPage(browser, url, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true }, errors);
    await start(small, { fixture: 'test-grande' });
    await layoutAudit(small, '360×640');
    await small.screenshot({ path: join(OUT, 'android-360.png') });
    await core(small, 'setSettings', { textScale: 1.4, locale: 'en' });
    await wait(500);
    await start(small, { fixture: 'test-grande' });
    await layoutAudit(small, '360×640 testo 140% inglese');
    await small.screenshot({ path: join(OUT, 'android-360-en-140.png') });
    await core(small, 'setSettings', { textScale: 1, locale: 'it' });
    await small.close();

    // ───── Motivi, Archivio, occasioni, spartito, lampada ─────
    const p = await openPage(browser, url, { viewport: { width: 1280, height: 720 } }, errors);
    await start(p, { fixture: 'test-motivi' });
    await night(p, 'autoplay');
    await wait(400);
    await p.screenshot({ path: join(OUT, 'motivi.png') });
    {
      // Primo piano a risoluzione doppia: i 12 motivi devono distinguersi.
      const hd = await openPage(browser, url, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 }, errors);
      await start(hd, { fixture: 'test-motivi' });
      await night(hd, 'autoplay');
      await wait(4800);
      const lm = await night(hd, 'layout');
      await hd.screenshot({ path: join(OUT, 'motivi-hd.png'), clip: { x: lm.center.x, y: lm.lace.y, width: lm.center.w, height: lm.lace.h } });
      await hd.close();
    }
    const motivi = await night(p, 'state');
    const seen = new Set<string>();
    for (const st of motivi.timeline as { pos: string[] }[]) for (const t of st.pos) seen.add(t);
    check('test-motivi: i 12 fili (12 motivi) compaiono nel merletto', seen.size === 12, [...seen].join(','));

    await start(p, { fixture: 'test-archivio', mode: 'archivio' });
    let s = await night(p, 'state');
    const l0 = await night(p, 'layout');
    const f1 = (l0.spindles as Json[]).find((x) => x.thread === 'f1');
    await p.mouse.click(f1.cx, f1.cy);
    await wait(250);
    const pickerOpen = await p.locator('[data-test="tb-nomina"]').isVisible();
    if (pickerOpen) await p.locator('[data-test="tb-nomina-marta"]').click();
    await wait(200);
    await night(p, 'name', 'f2', 'clotilde');
    await night(p, 'name', 'f3', 'piero');
    s = await night(p, 'state');
    const notYet = s.archive.confirmed.length === 0 && s.archive.counter.correct === 2;
    await night(p, 'name', 'f2', 'teresa');
    s = await night(p, 'state');
    check('Archivio: la conferma scatta solo con 3 nomi giusti', pickerOpen && notYet && s.archive.confirmed.length === 3, `scelta=${pickerOpen} prima=${notYet} confermati=${JSON.stringify(s.archive.confirmed)}`);
    await night(p, 'name', 'f4', 'nina');
    await night(p, 'fix');
    const bad = await night(p, 'fix');
    s = await night(p, 'state');
    const rejected = !bad.ok && s.message?.key === 'tombolo.archivio.nonCoincide';
    await night(p, 'undo');
    await night(p, 'cross', 1, 'R');
    await night(p, 'fix');
    await night(p, 'cross', 0, 'L');
    await night(p, 'cross', 2, 'R');
    const good = await night(p, 'fix');
    s = await night(p, 'state');
    check('Archivio: rammendo accettato solo se lo stato coincide', rejected && good.ok && s.archive.mended, `rifiutato=${rejected} accettato=${good.ok} rammendato=${s.archive.mended}`);
    const echo = await night(p, 'echo', 9, 0);
    check('Archivio: eco sugli incroci a merletto nominato e rammendato', echo === 'tombolo.test.eco' && (await p.locator('[data-test="tb-eco"]').isVisible()), String(echo));
    await p.screenshot({ path: join(OUT, 'archivio.png') });
    await p.keyboard.press('Escape');
    await night(p, 'main');
    s = await night(p, 'state');
    check('Archivio: Chiudi il merletto → night:complete con nominato e rammendato', s.completed && s.outcome?.archive?.named && s.outcome?.archive?.mended, JSON.stringify(s.outcome?.archive));

    await start(p, { fixture: 'test-occasioni', mode: 'occasioni' });
    const sol = await p.evaluate(async () => (await (window as unknown as { __GAME__: { engine: { computed(id: string): unknown } } }).__GAME__.engine.computed('test-occasioni')) as unknown);
    void sol;
    const placed = await night(p, 'occasions', [
      { kind: 'festa', place: 'piazza', hour: 9 },
      { kind: 'lanterna', place: 'chiesa', hour: 11 },
    ]);
    await p.screenshot({ path: join(OUT, 'occasioni-piantate.png') });
    const fixBtn = await center(p, '[data-test="tb-fissa"]');
    if (fixBtn) await p.mouse.click(fixBtn.x, fixBtn.y);
    for (let i = 0; i < 60; i++) {
      s = await night(p, 'state');
      if (s.completed) break;
      await wait(150);
    }
    check(
      'Occasioni: con occasionsSolution e "Lascia accadere" gli obiettivi risultano soddisfatti',
      placed.length === 2 && s.completed && (s.outcome?.goals ?? []).every((g: Json) => g.status === 'soddisfatta'),
      JSON.stringify(s.outcome?.goals),
    );

    await start(p, { fixture: 'g00', replay: spartito, replaySpeedMs: 60 });
    for (let i = 0; i < 60; i++) {
      s = await night(p, 'state');
      if (s.completed) break;
      await wait(100);
    }
    check('Spartito importato: il merletto si ritesse identico', s.completed && JSON.stringify(s.outcome?.rows) === prologueRows && s.outcome?.spartito === spartito, spartito);

    await start(p, { fixture: 'g00' });
    await night(p, 'cross', 0, 'R');
    await night(p, 'undo');
    await night(p, 'cross', 0, 'R');
    await night(p, 'undo');
    await night(p, 'cross', 0, 'R');
    await night(p, 'undo');
    await wait(200);
    const lampOn = await p.locator('[data-test="tb-lampada"]').isVisible();
    if (lampOn) await p.locator('[data-test="tb-lampada"]').click();
    await wait(400);
    const hintCard = await p.locator('[data-test="tb-suggerimento"]').isVisible();
    check('lampada dei suggerimenti dopo 3 Disfa sulla stessa riga, con la scheda', lampOn && hintCard, `lampada=${lampOn} scheda=${hintCard}`);
    const h = await night(p, 'hint', 'fantasma');
    s = await night(p, 'state');
    check('suggerimento fantasma: incrocio della riga corrente, filo d\'oro perso', !!h.ghost && s.fantasmaUsed, JSON.stringify(h));
    await p.screenshot({ path: join(OUT, 'fantasma.png') });
    const png = await night(p, 'png', 'g00', JSON.parse(prologueRows));
    check('renderLacePng: PNG del merletto', png?.type === 'image/png' && png.bytes > 1000, JSON.stringify(png));
    const missingEn = (await core<string[]>(p, 'missingKeys', 'en')).filter((k) => k.startsWith('tombolo.'));
    check('nessuna chiave tombolo mancante in inglese', missingEn.length === 0, missingEn.join(','));
    await p.close();
  } finally {
    await browser.close();
    stopServer(proc);
  }
  const relevant = errors.filter((e) => !/favicon|DevTools/i.test(e));
  check('nessun errore in console', relevant.length === 0, relevant.slice(0, 5).join(' | '));
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} controlli superati. Screenshot in ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

void main();
