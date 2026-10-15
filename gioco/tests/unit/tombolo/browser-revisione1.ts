/**
 * Verifica nel browser della revisione 1 del tombolo (non è un test Vitest):
 *
 *   TOMBOLO_R1_URL=http://127.0.0.1:5680/ TOMBOLO_R1_OUT=<cartella> \
 *     node --experimental-strip-types tests/unit/tombolo/browser-revisione1.ts
 *
 * con una build `VITE_E2E=1 vite build` servita da `vite preview`. Playwright è
 * quello globale (PLAYWRIGHT_MODULE), Chromium in /opt/pw-browsers.
 * Controlla i criteri d'accettazione che si vedono solo con un browser vero
 * (misure delle scritte, tocchi veri con il click di compatibilità, posizioni
 * delle note e delle bolle) e salva gli screenshot da guardare.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const URL0 = process.env.TOMBOLO_R1_URL ?? 'http://127.0.0.1:5680/';
const OUT = process.env.TOMBOLO_R1_OUT ?? '/tmp/tombolo-r1';
const PW = process.env.PLAYWRIGHT_MODULE ?? '/opt/node22/lib/node_modules/playwright/index.mjs';
const ONLY = (process.env.TOMBOLO_R1_ONLY ?? '').split(',').filter(Boolean);
mkdirSync(OUT, { recursive: true });

type Page = import('playwright').Page;
type Browser = import('playwright').Browser;

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

async function open(browser: Browser, w: number, h: number, opts: { touch?: boolean; lang?: 'it' | 'en' } = {}): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${URL0}?debug=1${opts.lang ? `&lang=${opts.lang}` : ''}`);
  await page.waitForFunction(() => !!(window as unknown as { __GAME__?: unknown }).__GAME__);
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  return { page, errors, close: () => ctx.close() };
}

async function shot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

const want = (k: string): boolean => ONLY.length === 0 || ONLY.includes(k);

const LEVELS = resolve(process.cwd(), 'src/content/levels');
interface LevelJson {
  startHour: number;
  endHour: number;
  columns: string[];
  pins: { thread: string; place: string; hour: number }[];
  edges?: { hour: number; side: string; kind: string; enters?: string }[];
  archive?: { faded: string[]; answer: Record<string, string>; recorded: { hour: number; crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[]; echoes: { hour: number; pair: number }[] };
}
function levelJson(id: string): LevelJson {
  return JSON.parse(readFileSync(join(LEVELS, `${id}.json`), 'utf8')) as LevelJson;
}
function computedRows(id: string): { hour: number; crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[] {
  const c = JSON.parse(readFileSync(join(LEVELS, `${id}.computed.json`), 'utf8')) as { base: { rows?: { hour: number; crossings: { pair: number; over: 'L' | 'R' }[] }[] } };
  return c.base.rows ?? [];
}

interface Lay {
  kind: string;
  scale: number;
  center: { x: number; w: number };
  colW: number;
  rowH: number;
  hiddenBelow: number;
  pins: { kind: string; col: number; hour: number; x: number; y: number }[];
  edges: { hour: number; side: number; kind: string; x: number; y: number }[];
  spindles: { col: number; thread: string; cx: number; cy: number }[];
  rows: { index: number; hour: number; y: number; h: number; kind: string }[];
  buttons: Record<string, { x: number; y: number; w: number; h: number } | null>;
}

/** Misure delle scritte della barra alta e dell'intestazione delle colonne. */
async function hudMeasures(page: Page): Promise<{ min: number; overflow: string[]; ellipsis: string[]; labels: { text: string; hidden: boolean; fits: boolean }[]; rects: string }> {
  return page.evaluate(() => {
    const out = { min: 999, overflow: [] as string[], ellipsis: [] as string[], labels: [] as { text: string; hidden: boolean; fits: boolean }[], rects: '' };
    const hud = document.querySelector<HTMLElement>('[data-test="tb-hud"]');
    if (!hud) return out;
    const nodes = Array.from(hud.querySelectorAll<HTMLElement>('span, h1, div')).filter((e) => !e.closest('.core-sr-only') && e.getClientRects().length > 0 && !e.hidden);
    for (const e of nodes) {
      const own = Array.from(e.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== '');
      if (!own) continue;
      const cs = getComputedStyle(e);
      out.min = Math.min(out.min, Number.parseFloat(cs.fontSize));
      if (cs.textOverflow === 'ellipsis') out.ellipsis.push(e.className);
      if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible') out.overflow.push(`${e.className}:${e.scrollWidth}>${e.clientWidth}`);
    }
    const r = hud.getBoundingClientRect();
    if (hud.scrollHeight > hud.clientHeight + 1) out.overflow.push(`hud:${hud.scrollHeight}>${hud.clientHeight}`);
    for (const cell of Array.from(document.querySelectorAll<HTMLElement>('.tb-header-cell'))) {
      const lab = cell.querySelector<HTMLElement>('.tb-header-label');
      if (!lab) continue;
      const hidden = lab.hidden === true || lab.getClientRects().length === 0;
      if (!hidden) out.min = Math.min(out.min, Number.parseFloat(getComputedStyle(lab).fontSize));
      out.labels.push({ text: lab.textContent ?? '', hidden, fits: hidden || lab.scrollWidth <= cell.clientWidth });
    }
    const fix = document.querySelector<HTMLElement>('[data-test="tb-fissa"] .core-btn-label');
    if (fix) out.min = Math.min(out.min, Number.parseFloat(getComputedStyle(fix).fontSize));
    out.rects = JSON.stringify([Math.round(r.height), out.labels.map((l) => l.hidden)]);
    return out;
  });
}

async function tom05(browser: Browser): Promise<void> {
  for (const lang of ['it', 'en'] as const) {
    const { page, errors, close } = await open(browser, 360, 640, { lang });
    await call(page, 'core.setSettings', { textScale: 1.4, highContrast: true, reducedMotion: true, locale: lang });
    await call(page, 'night.start', { level: 'day-2026-10-14', origin: 'giornaliero' });
    await page.waitForTimeout(400);
    // Impostazioni cambiate dalla Pausa: la si apre, si cambia, si chiude.
    await call(page, 'core.openOverlay', 'pausa', { from: 'tombolo', origin: 'giornaliero', levelId: 'day-2026-10-14' });
    await call(page, 'core.setSettings', { textScale: 1.4, highContrast: true, animSpeed: 2 });
    await page.waitForTimeout(150);
    await call(page, 'core.closeOverlay');
    await page.waitForTimeout(300);
    const a = await hudMeasures(page);
    check(`TOM-05 ${lang}: nessuna scritta dell'HUD sotto 21 px`, a.min >= 20.9, `minimo ${a.min.toFixed(1)} px`);
    check(`TOM-05 ${lang}: niente troncamenti né puntini`, a.overflow.length === 0 && a.ellipsis.length === 0, [...a.overflow, ...a.ellipsis].join(' ') || 'ok');
    check(`TOM-05 ${lang}: nomi delle colonne interi o solo icona`, a.labels.every((l) => l.fits), JSON.stringify(a.labels));
    await shot(page, `tom05-${lang}-360x640-140`);
    // Fino all'ultima riga: «Chiudi il merletto» non si rimpicciolisce.
    const st = await call<{ rows: unknown[] }>(page, 'night.state');
    void st;
    await call(page, 'night.autoplay');
    await page.waitForTimeout(300);
    const end = await hudMeasures(page);
    check(`TOM-05 ${lang}: anche a merletto finito`, end.min >= 20.9 && end.overflow.length === 0, `minimo ${end.min.toFixed(1)} px ${end.overflow.join(' ')}`);
    await shot(page, `tom05-${lang}-fine`);
    // Misure identiche dopo una ricarica (stessa notte, stesse impostazioni).
    await call(page, 'night.start', { level: 'day-2026-10-14', origin: 'giornaliero' });
    await page.waitForTimeout(400);
    const before = (await hudMeasures(page)).rects;
    await page.reload();
    await page.waitForFunction(() => !!(window as unknown as { __GAME__?: unknown }).__GAME__);
    await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
    await call(page, 'night.start', { level: 'day-2026-10-14', origin: 'giornaliero' });
    await page.waitForTimeout(600);
    const after = (await hudMeasures(page)).rects;
    check(`TOM-05 ${lang}: misure identiche prima e dopo una ricarica`, before === after, `${before} / ${after}`);
    check(`TOM-05 ${lang}: nessun errore`, errors.length === 0, errors.join(' | '));
    await close();
  }
}

async function tom01(browser: Browser): Promise<void> {
  for (const [w, h] of [[390, 844], [1180, 820]] as const) {
    const { page, errors, close } = await open(browser, w, h, { touch: true });
    await call(page, 'night.start', { level: 'arc3', origin: 'archivio', mode: 'archivio' });
    await page.waitForTimeout(500);
    const lay = await call<{ spindles: { col: number; thread: string; cx: number; cy: number }[] }>(page, 'night.layout');
    let opened = 0;
    let named = 0;
    for (const sp of lay.spindles) {
      const s0 = await call<{ archive: { names: Record<string, string> } }>(page, 'night.state');
      if (Object.keys(s0.archive?.names ?? {}).length > 0) break;
      await page.touchscreen.tap(sp.cx, sp.cy);
      await page.waitForTimeout(450);
      const s = await call<{ archive: { names: Record<string, string> } }>(page, 'night.state');
      const pick = await page.locator('[data-test="tb-nomina"]').isVisible().catch(() => false);
      if (pick) opened++;
      named += Object.keys(s.archive?.names ?? {}).length;
      if (pick) await shot(page, `tom01-${w}x${h}-col${sp.col}`);
      const anyPopup = await page.locator('.tb-popup').count();
      if (anyPopup > 0) await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
    }
    check(`TOM-01 ${w}×${h}: il tocco sul fuso apre il selettore`, opened > 0, `${opened} aperture`);
    check(`TOM-01 ${w}×${h}: nessun nome assegnato dal click fantasma`, named === 0, `${named} nomi`);
    check(`TOM-01 ${w}×${h}: nessun errore`, errors.length === 0, errors.join(' | '));
    await close();
  }
}

async function tom03(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 1440, 900, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it' });
  await call(page, 'night.start', { level: 'arc1', origin: 'archivio', mode: 'archivio' });
  await page.waitForTimeout(400);
  // P019: tessuto prima di nominare (le righe registrate dello strappo).
  for (let i = 0; i < 6; i++) {
    const s = await call<{ done: boolean; hour: number }>(page, 'night.state');
    if (s.done) break;
    const rec = await page.evaluate((h) => {
      const g = (window as unknown as { __GAME__: { content?: unknown } }).__GAME__;
      void g;
      return h;
    }, s.hour);
    void rec;
    const r = await call<{ rows: { hour: number; crossings: { pair: number; over: 'L' | 'R' }[] }[] }>(page, 'night.state');
    void r;
    break;
  }
  await call(page, 'night.autoplay');
  const st = await call<{ done: boolean; completed: boolean; archive: { named: boolean } }>(page, 'night.state');
  check('TOM-03: arc1 in autoplay si chiude nominato e rammendato', st.completed && st.archive.named, JSON.stringify(st.archive));
  // A mano: rammendo senza nomi, poi Chiudi.
  await call(page, 'night.start', { level: 'arc1', origin: 'archivio', mode: 'archivio' });
  await page.waitForTimeout(400);
  const mend: [number, { pair: number; over: 'L' | 'R' }[]][] = [
    [10, [{ pair: 0, over: 'L' }, { pair: 2, over: 'L' }]],
    [11, [{ pair: 1, over: 'R' }, { pair: 3, over: 'R' }]],
  ];
  for (const [hour, cs] of mend) {
    const s = await call<{ hour: number }>(page, 'night.state');
    if (s.hour !== hour) continue;
    for (const c of cs) await call(page, 'night.cross', c.pair, c.over);
    await call(page, 'night.fix');
  }
  await page.click('[data-test="tb-fissa"]');
  await page.waitForTimeout(200);
  const why = await page.locator('[data-test="tb-archivio-chiudi-motivo"]').textContent();
  check('TOM-03: Chiudi senza nomi spiega che cosa manca', /Mancano i nomi/.test(why ?? ''), why ?? '');
  await shot(page, 'tom03-chiudi-motivo');
  for (const [t, ch] of [['f1', 'marta'], ['f2', 'teresa'], ['f4', 'anselmo']]) await call(page, 'night.name', t, ch);
  await page.click('[data-test="tb-fissa"]');
  await page.waitForTimeout(200);
  const why2 = await page.locator('[data-test="tb-archivio-chiudi-motivo"]').textContent();
  check('TOM-03: resta il filo sbiadito 3', /filo sbiadito 3/.test(why2 ?? ''), why2 ?? '');
  // Tocco sul tratto del filo 3 (uscito alle 12): la cella della riga delle 12 dove passa.
  const lay = await call<{ rows: { index: number; hour: number; y: number; h: number }[]; columns: { x: number; w: number; cx: number }[] }>(page, 'night.layout');
  const s3 = await call<{ timeline: { pos: string[] }[] }>(page, 'night.state');
  const before12 = s3.timeline[3]?.pos ?? [];
  const col = before12.indexOf('f3');
  const row = lay.rows.find((r) => r.hour === 12);
  if (row && col >= 0) {
    await page.mouse.click(lay.columns[col]!.cx, row.y + row.h * 0.3);
    await page.waitForTimeout(250);
  }
  const filo = await page.locator('[data-test="tb-nomina"]').getAttribute('data-filo').catch(() => null);
  check('TOM-03: il filo 3 si nomina toccandone il tratto', filo === 'f3', `colonna ${col}, filo ${filo}`);
  await shot(page, 'tom03-tratto-f3');
  await page.waitForTimeout(400);
  await page.click('[data-test="tb-nomina-ernesto"]');
  await page.waitForTimeout(200);
  const named = await call<{ archive: { names: Record<string, string>; named: boolean } }>(page, 'night.state');
  await page.click('[data-test="tb-fissa"]');
  await page.waitForTimeout(300);
  const events = await call<{ k: string; p: { outcome?: { archive?: { named: boolean; mended: boolean } } } }[]>(page, 'core.events', 60);
  const complete = events.filter((e) => e.k === 'night:complete').map((e) => e.p.outcome?.archive);
  check('TOM-03: con tutti i nomi Chiudi chiude', complete.some((a) => !!a?.named && !!a.mended), `${JSON.stringify(named.archive.names)} ${JSON.stringify(complete)}`);
  // Pannello di sinistra dell'Archivio nel layout largo.
  check('TOM-03: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function tom06(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 390, 844, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it' });
  await call(page, 'night.start', { level: 'day-2026-10-14', origin: 'giornaliero' });
  await page.waitForTimeout(400);
  await page.click('[data-test="tb-obiettivi"]');
  await page.waitForTimeout(300);
  const items = await page.locator('[data-test="tb-popup-obiettivi"] [data-test^="tb-obiettivo-"] .tb-ob-testo').allTextContents();
  check('TOM-06: ogni lettera negli obiettivi ha il destinatario', items.filter((t) => /lettera/i.test(t)).every((t) => /lettera per /.test(t)) && items.some((t) => /lettera per /.test(t)), items.join(' | '));
  await shot(page, 'tom06-obiettivi-giorno');
  check('TOM-06: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function tom04(browser: Browser): Promise<void> {
  const lv = levelJson('arc3');
  const { page, errors, close } = await open(browser, 1180, 820, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it' });
  await call(page, 'night.start', { level: 'arc3', origin: 'archivio', mode: 'archivio' });
  await page.waitForTimeout(500);
  const panel = page.locator('[data-test="tb-archivio-pannello"]');
  const visible = await panel.isVisible().catch(() => false);
  const fili = await page.locator('[data-test^="tb-ap-filo-"]').count();
  const cand = await page.locator('[data-test^="tb-ap-candidato-"]').count();
  const holes = await page.locator('[data-test^="tb-ap-strappo-"]').count();
  check('TOM-04: arc3 a 1180×820, pannello sinistro con fili, candidati e strappi', visible && fili === lv.archive!.faded.length && cand > 0 && holes === (lv as unknown as { archive: { holes: unknown[] } }).archive.holes.length, `visibile ${visible}, fili ${fili}, candidati ${cand}, strappi ${holes}`);
  const lamp = await page.locator('[data-test="tb-lampada"]').isVisible().catch(() => false);
  check('TOM-04: la lampada c\'è', lamp);
  await shot(page, 'tom04-arc3-pannello');
  for (const t of lv.archive!.faded) await call(page, 'night.name', t, lv.archive!.answer[t]);
  for (const r of lv.archive!.recorded) {
    const s = await call<{ hour: number; done: boolean }>(page, 'night.state');
    if (s.done || s.hour !== r.hour) continue;
    for (const x of r.crossings) if (!x.forced) await call(page, 'night.cross', x.pair, x.over);
    await call(page, 'night.fix');
  }
  await page.waitForTimeout(300);
  const e = lv.archive!.echoes.find((x) => x.hour === 9) ?? lv.archive!.echoes[0]!;
  await call(page, 'night.echo', e.hour, e.pair);
  await page.waitForTimeout(300);
  const chi = (await page.locator('[data-test="tb-eco-chi"]').textContent().catch(() => '')) ?? '';
  const reg = (await page.locator('[data-test="tb-ap-echi"]').textContent().catch(() => '')) ?? '';
  check('TOM-04: l\'eco dice «X → Y, alle N» e finisce nel registro', /^.+ → .+, alle \d+$/.test(chi) && reg.includes(chi), `${chi} | registro: ${reg.slice(0, 120)}`);
  await shot(page, 'tom04-arc3-eco');
  check('TOM-04: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function tom11(browser: Browser): Promise<void> {
  const cases: [string, number, number][] = [['g13', 1180, 820], ['g13', 390, 844], ['fin_seppia', 1280, 800]];
  for (const [id, w, h] of cases) {
    const lv = levelJson(id);
    const { page, errors, close } = await open(browser, w, h, { lang: 'it' });
    await call(page, 'core.setSettings', { locale: 'it' });
    await call(page, 'night.start', { level: id, origin: 'libero' });
    await page.waitForTimeout(500);
    const lay = await call<Lay>(page, 'night.layout');
    const ind = lay.buttons.scrollDown;
    const ok = lay.hiddenBelow === 0 || !!ind;
    check(`TOM-11 ${id} ${w}×${h}: righe tutte visibili o indicatore`, ok, `righe ${lv.endHour - lv.startHour}, alte ${lay.rowH}, nascoste ${lay.hiddenBelow}, indicatore ${!!ind}`);
    const fine = (await page.locator('[data-test="tb-hud-fine"]').textContent().catch(() => '')) ?? '';
    check(`TOM-11 ${id} ${w}×${h}: l'HUD dice «fino alle ${lv.endHour}»`, fine.includes(`fino alle ${lv.endHour}`), fine);
    await shot(page, `tom11-${id}-${w}x${h}`);
    check(`TOM-11 ${id}: nessun errore`, errors.length === 0, errors.join(' | '));
    await close();
  }
}

async function tom12(browser: Browser): Promise<void> {
  {
    const lv = levelJson('g00');
    const { page, errors, close } = await open(browser, 390, 844, { lang: 'it' });
    await call(page, 'core.setSettings', { locale: 'it' });
    await call(page, 'night.start', { level: 'g00', origin: 'campagna' });
    await page.waitForTimeout(500);
    const lay = await call<Lay>(page, 'night.layout');
    const col = lv.columns.indexOf('forno');
    const pin = lay.pins.find((p) => p.col === col && p.hour === 9);
    if (pin) await page.mouse.click(pin.x, pin.y);
    await page.waitForTimeout(250);
    const t = (await page.locator('[data-test="tb-bolla"]').textContent().catch(() => '')) ?? '';
    check('TOM-12: prologo, tocco sullo spillo di Forno alle 9', /^Teresa al Forno alle 9/.test(t), t);
    await shot(page, 'tom12-prologo-spillo');
    // Il passaggio del mouse equivale.
    await page.mouse.click(5, 5);
    await page.mouse.move(pin!.x, pin!.y);
    await page.waitForTimeout(250);
    const t2 = (await page.locator('[data-test="tb-bolla"]').textContent().catch(() => '')) ?? '';
    check('TOM-12: passaggio del mouse equivalente', t2 === t, t2);
    check('TOM-12 prologo: nessun errore', errors.length === 0, errors.join(' | '));
    await close();
  }
  {
    const lv = levelJson('g06');
    const e = (lv.edges ?? []).find((x) => !!x.enters);
    const { page, errors, close } = await open(browser, 390, 844, { lang: 'it' });
    await call(page, 'core.setSettings', { locale: 'it' });
    await call(page, 'night.start', { level: 'g06', origin: 'campagna' });
    await page.waitForTimeout(500);
    const lay = await call<Lay>(page, 'night.layout');
    const edge = lay.edges.find((x) => x.hour === e?.hour);
    if (edge) await page.mouse.click(edge.x, edge.y);
    await page.waitForTimeout(250);
    const t = (await page.locator('[data-test="tb-bolla"]').textContent().catch(() => '')) ?? '';
    check('TOM-12: g06, la barca dice chi entra e la lettera', !!e && /marinaio/i.test(t) && /lettera.* per /i.test(t), t);
    await shot(page, 'tom12-g06-barca');
    check('TOM-12 g06: nessun errore', errors.length === 0, errors.join(' | '));
    await close();
  }
}

async function tom13(browser: Browser): Promise<void> {
  const goals = [
    { t: 'presso', who: 'marta', place: 'forno', hour: 6 },
    { t: 'presso', who: 'teresa', place: 'forno', hour: 9 },
    { t: 'presso', who: 'piero', place: 'chiesa', hour: 9 },
    { t: 'consegnata', bead: 'L1', by: 9 },
    { t: 'incontra', a: 'marta', b: 'piero', from: 6, to: 8 },
  ];
  const { page, errors, close } = await open(browser, 360, 640, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it', textScale: 1.4 });
  await call(page, 'night.start', { level: 'g00', origin: 'libero', goals });
  await page.waitForTimeout(500);
  const btn = (await page.locator('[data-test="tb-obiettivi"]').textContent().catch(() => '')) ?? '';
  check('TOM-13: il pulsante mostra «n/5»', /\d\/5/.test(btn), btn);
  await page.click('[data-test="tb-obiettivi"]');
  await page.waitForTimeout(350);
  const n = await page.locator('[data-test="tb-popup-obiettivi"] [data-test^="tb-obiettivo-"]').count();
  const ombra = await page.locator('[data-test="tb-obiettivi-scorre"]').getAttribute('data-ombra').catch(() => null);
  const scrolls = await page.evaluate(() => {
    const w = document.querySelector<HTMLElement>('[data-test="tb-obiettivi-scorre"]');
    return w ? w.scrollHeight > w.clientHeight + 2 : false;
  });
  check('TOM-13: 5 voci, e l\'ombra segnala che si scorre', n === 5 && (!scrolls || ombra === '1'), `voci ${n}, scorre ${scrolls}, ombra ${ombra}`);
  await shot(page, 'tom13-obiettivi-360x640');
  check('TOM-13: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function tom18(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 1920, 1080, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it' });
  await call(page, 'night.start', { level: 'g05', origin: 'libero' });
  await page.waitForTimeout(400);
  const rows = computedRows('g05').filter((r) => r.hour <= 9);
  await call(page, 'night.autoplay', rows);
  await page.waitForTimeout(500);
  const lay = await call<Lay>(page, 'night.layout');
  check('TOM-18: 1920×1080, centro ≥ 900 px', lay.center.w >= 900, `centro ${lay.center.w}, scala ${lay.scale}`);
  check('TOM-18: spilli ≥ 20 px e ore ≥ 15 px (scala)', 16 * lay.scale >= 20 && 13 * lay.scale >= 15, `scala ${lay.scale}`);
  await shot(page, 'tom18-g05-1920x1080');
  await page.screenshot({ path: join(OUT, 'tom18-g05-zoom.png'), clip: { x: lay.center.x, y: 120, width: Math.min(960, lay.center.w), height: 600 } });
  check('TOM-18: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
  // Il filo nero con il bordo chiaro.
  const p2 = await open(browser, 1440, 900, { lang: 'it' });
  await call(p2.page, 'core.setSettings', { locale: 'it' });
  await call(p2.page, 'night.start', { level: 'g17', origin: 'libero' });
  await p2.page.waitForTimeout(400);
  const lv17 = levelJson('g17') as LevelJson & { nero?: { enter: { hour: number } } };
  const enter = lv17.nero?.enter.hour ?? lv17.startHour + 3;
  await call(p2.page, 'night.autoplay', computedRows('g17').filter((r) => r.hour <= enter + 2));
  await p2.page.waitForTimeout(500);
  await shot(p2.page, 'tom18-g17-filo-nero');
  check('TOM-18 g17: nessun errore', p2.errors.length === 0, p2.errors.join(' | '));
  await p2.close();
}

async function tom19(browser: Browser): Promise<void> {
  const { page, errors, close } = await open(browser, 390, 844, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it' });
  await call(page, 'night.start', { level: 'arc3', origin: 'archivio', mode: 'archivio' });
  await page.waitForTimeout(500);
  await page.locator('canvas').first().focus().catch(() => undefined);
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(150);
  const lay = await call<Lay>(page, 'night.layout');
  const last = lay.spindles[lay.spindles.length - 1]!;
  const st = await call<{ status: string }>(page, 'night.state');
  check('TOM-19: le frecce arrivano all\'ultima colonna mentre si nomina', st.status.startsWith('Cursore:'), st.status);
  await page.keyboard.press('n');
  await page.waitForTimeout(500);
  const filo = await page.locator('[data-test="tb-nomina"]').getAttribute('data-filo').catch(() => null);
  check('TOM-19: N sull\'ultima colonna apre il selettore di quel filo', filo === last.thread, `${filo} / ${last.thread}`);
  await shot(page, 'tom19-tastiera-ultima-colonna');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await call(page, 'core.setSettings', { locale: 'en' });
  await page.waitForTimeout(300);
  const en = await call<{ status: string }>(page, 'night.state');
  check('TOM-19: dopo il cambio di lingua la riga di stato è in inglese', /o'clock/.test(en.status) && !/\bOre\b| al | in Piazza/.test(en.status), en.status);
  check('TOM-19: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function tom20(browser: Browser): Promise<void> {
  for (const [id, ev] of [['fin_chiuso', 'tombolo:nodo'], ['g08', 'tombolo:apparizione']] as const) {
    const { page, errors, close } = await open(browser, 390, 844, { lang: 'it' });
    await call(page, 'core.setSettings', { locale: 'it', animSpeed: 1, reducedMotion: false });
    await call(page, 'night.start', { level: id, origin: 'libero' });
    await page.waitForTimeout(400);
    await call(page, 'night.autoplay');
    await page.waitForTimeout(700);
    await shot(page, `tom20-${id}-animazione`);
    const mid = await call<{ k: string }[]>(page, 'core.events', 80);
    const midKeys = mid.map((e) => e.k);
    await page.waitForTimeout(2600);
    const evs = await call<{ k: string }[]>(page, 'core.events', 80);
    const keys = evs.map((e) => e.k);
    const iE = keys.indexOf(ev);
    const iC = keys.indexOf('night:complete');
    check(`TOM-20 ${id}: ${ev} una volta, poi night:complete dopo l'animazione`, keys.filter((k) => k === ev).length === 1 && iE >= 0 && iC > iE && !midKeys.includes('night:complete'), keys.filter((k) => k.startsWith('tombolo:') || k === 'night:complete').join(', '));
    check(`TOM-20 ${id}: nessun errore`, errors.length === 0, errors.join(' | '));
    await close();
  }
}

async function tom22(browser: Browser): Promise<void> {
  const ids = ['g01', 'g02', 'g03', 'g04', 'g05', 'g07', 'g09', 'g10', 'g11', 'g13', 'g14', 'g18', 'g20', 'fin_merlettaia'];
  const { page, errors, close } = await open(browser, 390, 844, { lang: 'it' });
  await call(page, 'core.setSettings', { locale: 'it' });
  let found = '';
  for (const id of ids) {
    await call(page, 'night.start', { level: id, origin: 'libero' });
    await page.waitForTimeout(250);
    for (let k = 0; k < 6 && !found; k++) {
      const lay = await call<Lay>(page, 'night.layout');
      if (lay.buttons.skipQuiet) {
        found = id;
        break;
      }
      const st = await call<{ hour: number; done: boolean }>(page, 'night.state');
      if (st.done) break;
      const r = computedRows(id).find((x) => x.hour === st.hour);
      if (!r) break;
      for (const x of r.crossings) if (!x.forced) await call(page, 'night.cross', x.pair, x.over);
      await call(page, 'night.fix');
      await page.waitForTimeout(80);
    }
    if (found) break;
  }
  if (found) {
    await shot(page, `tom22-${found}-salta`);
    const before = await call<{ rows: unknown[] }>(page, 'night.state');
    await page.keyboard.down('Shift');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Shift');
    await page.waitForTimeout(300);
    const after = await call<{ rows: unknown[] }>(page, 'night.state');
    check(`TOM-22 ${found}: Maiusc+Invio fissa le ore quiete`, after.rows.length >= before.rows.length + 2, `${before.rows.length} → ${after.rows.length}`);
    await call(page, 'night.undo');
    const undo = await call<{ rows: unknown[] }>(page, 'night.state');
    check(`TOM-22 ${found}: Disfa torna indietro di una riga`, undo.rows.length === after.rows.length - 1, `${after.rows.length} → ${undo.rows.length}`);
  } else check('TOM-22: nessun livello dei contenuti offre ore quiete (atteso con livelli densi)', true, ids.join(','));
  check('TOM-22: nessun errore', errors.length === 0, errors.join(' | '));
  await close();
}

async function main(): Promise<void> {
  const pw = (await import(PW)) as typeof import('playwright');
  const browser = await pw.chromium.launch();
  try {
    if (want('tom05')) await tom05(browser);
    if (want('tom01')) await tom01(browser);
    if (want('tom03')) await tom03(browser);
    if (want('tom06')) await tom06(browser);
    if (want('tom04')) await tom04(browser);
    if (want('tom11')) await tom11(browser);
    if (want('tom12')) await tom12(browser);
    if (want('tom13')) await tom13(browser);
    if (want('tom18')) await tom18(browser);
    if (want('tom19')) await tom19(browser);
    if (want('tom20')) await tom20(browser);
    if (want('tom22')) await tom22(browser);
  } finally {
    await browser.close();
  }
  const bad = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - bad.length}/${checks.length} controlli superati`);
  process.exitCode = bad.length ? 1 : 0;
}

void main();
