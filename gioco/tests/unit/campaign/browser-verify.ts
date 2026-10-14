/**
 * Verifica della campagna nel browser (Chromium di Playwright 1.56.1), con un server di
 * sviluppo proprio. Non è un test Vitest (niente `.test.ts`): si lancia a mano.
 *
 *   npx tsx tests/unit/campaign/browser-verify.ts
 *   CAMPAIGN_VERIFY_PORT=5281          porta di `vite preview` (5280-5284) sulla build di prova
 *   CAMPAIGN_VERIFY_URL=http://…/      usa un server già avviato
 *   CAMPAIGN_VERIFY_OUT=<cartella>     dove salvare gli screenshot
 *
 * Controlla i criteri d'accettazione del pacchetto:
 * - Nuova storia → prologo (schermo nero, stanza, tombolo) → notte g00 → alba (3 vignette,
 *   Salta) → bilancio → sera di g01 (oggetto, 3 bigliettini, 2 spilli, risposta) → notte di
 *   g01; ricaricando a metà notte si riprende alla stessa riga; anche in alba, bilancio e sera;
 * - tutta la campagna con `__GAME__.campaign` fino alla scelta di g23: C torna alla sera di
 *   g23, A, B e D portano agli epiloghi e ai titoli; D solo con i requisiti;
 * - Taccuino fisso nel layout largo, overlay nello stretto chiuso con Indietro (Esc);
 * - bigliettino anonimo (memoria 0) con l'autore sbagliato; Archivio (arc1); Telaio
 *   (Riprendi da qui, Rigioca); sblocchi in save.unlocks;
 * - a 360×640 con il testo al 140%: nessun testo fuori dal contenitore, bersagli ≥ 44 px;
 * - nessun errore in console.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PORT = Number(process.env.CAMPAIGN_VERIFY_PORT ?? 5281);
const EXTERNAL_URL = process.env.CAMPAIGN_VERIFY_URL;
const OUT = process.env.CAMPAIGN_VERIFY_OUT ?? join(tmpdir(), 'campaign-verify');
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
  // Build di prova servita con `vite preview`: il server di sviluppo ricaricherebbe la
  // pagina a ogni file modificato da altri nel repository.
  const outDir = join(OUT, 'build');
  const build = spawnSync('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_E2E: '1' } });
  if (build.status !== 0) throw new Error('vite build failed');
  const proc = spawn('npx', ['vite', 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
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
    if (Date.now() - t0 > 60_000) throw new Error('vite preview did not start');
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

type Rec = Record<string, unknown>;

/** Chiama `__GAME__.<ns>.<fn>(...args)` nella pagina (anche asincrona). */
function call<T = unknown>(page: Page, path: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([p, a]) => {
      const parts = (p as string).split('.');
      let target: unknown = (window as unknown as { __GAME__: unknown }).__GAME__;
      let self: unknown = null;
      for (const k of parts) {
        self = target;
        target = (target as Record<string, unknown>)[k];
      }
      return (target as (...x: unknown[]) => unknown).apply(self, a as unknown[]);
    },
    [path, args] as const,
  ) as Promise<T>;
}

async function until(page: Page, what: string, fn: () => Promise<boolean>, ms = 15000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await page.waitForTimeout(80);
  }
  console.log(`  (attesa scaduta: ${what}; scena ${await call(page, 'core.scene')})`);
  return false;
}

const scene = (page: Page): Promise<string> => call<string>(page, 'core.scene');
const phase = (page: Page): Promise<string | null> => call<string | null>(page, 'campaign.phase');
const waitScene = (page: Page, id: string, ms?: number): Promise<boolean> => until(page, `scena ${id}`, async () => (await scene(page)) === id, ms);
const waitNight = (page: Page): Promise<boolean> =>
  until(page, 'notte attiva', async () => (await scene(page)) === 'tombolo' && !!(await call<Rec>(page, 'night.state')).active);

async function boot(page: Page, url: string): Promise<void> {
  await page.goto(`${url}?debug=1`);
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
}

async function fresh(page: Page, url: string): Promise<void> {
  await boot(page, url);
  await call(page, 'core.wipe');
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
}

/** Testi che escono dal contenitore e bersagli più piccoli di 44 px nel DOM della scena. */
async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const root = document.getElementById('ui-root');
    if (!root) return out;
    for (const node of Array.from(root.querySelectorAll<HTMLElement>('*'))) {
      if (node.closest('.core-sr-only') || node.closest('.core-toasts') || node.closest('.cp-titoli')) continue;
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(node);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const hasText = Array.from(node.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      if (hasText && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && node.scrollWidth > node.clientWidth + 1 && !cs.webkitLineClamp?.match(/\d/)) {
        out.push(`testo fuori: ${node.className || node.tagName} (${node.scrollWidth} > ${node.clientWidth})`);
      }
      const interactive = node.matches('button, a[href], [role="tab"], [role="switch"], input');
      if (interactive && !(node as HTMLButtonElement).disabled && (r.width < 44 || r.height < 44)) {
        out.push(`bersaglio piccolo: ${node.dataset.test ?? node.className} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
    }
    return out;
  });
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

// ───────── Prologo e prima giornata ─────────

async function prologueAndFirstDay(browser: Browser, url: string): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'it-IT', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page, url);

  check('titolo senza storia', (await scene(page)) === 'titolo' || (await scene(page)) === 'boot');
  await call(page, 'core.goto', 'sera', { cmd: 'nuova' });
  await waitScene(page, 'sera');
  check('nuova storia: sera del prologo', (await phase(page)) === 'sera');
  check('prologo: schermo nero', await page.isVisible('[data-test="cp-prologo-buio"]'));
  await shot(page, '01-prologo-buio');
  await page.tap('[data-test="cp-prologo-buio"]');
  check('prologo: biglietto della nonna', await page.isVisible('[data-test="cp-prologo-biglietto"]'));
  await shot(page, '02-prologo-stanza');
  await page.tap('[data-test="cp-prologo-tombolo"]');
  check('prologo: si apre il tombolo', await waitNight(page));
  const n0 = await call<Rec>(page, 'night.state');
  check('notte g00 della campagna', n0.levelId === 'g00' && n0.origin === 'campagna', `${String(n0.levelId)} ${String(n0.origin)}`);
  await call(page, 'night.autoplay', undefined, 60);
  check('dopo la notte: alba', await waitScene(page, 'alba'));
  const dawn = await call<{ report: string[] }>(page, 'campaign.dawn');
  check('alba del prologo: 3 vignette del GDD 9', dawn.report.join(',') === 'g00.alba.marta,g00.alba.teresa,g00.alba.piero', dawn.report.join(','));
  await shot(page, '03-alba');
  const pos0 = JSON.stringify((await call<{ position: Rec | null }>(page, 'campaign.dawn')).position);
  await page.tap('[data-test="cp-vignetta-avanti"]');
  const pos1 = JSON.stringify((await call<{ position: Rec | null }>(page, 'campaign.dawn')).position);
  check('alba: il tocco avanza', pos0 !== pos1, `${pos0} → ${pos1}`);
  check('alba: Salta visibile', await page.isVisible('[data-test="cp-vignetta-salta"]'));
  await page.tap('[data-test="cp-vignetta-salta"]');
  check('Salta → bilancio', await waitScene(page, 'bilancio'));
  check('bilancio: obiettivo del prologo soddisfatto', await page.isVisible('[data-test="cp-bilancio-obiettivi"] .cp-ok'));
  check('bilancio: voci nuove del Taccuino', (await page.locator('[data-test^="cp-bilancio-voce-"]').count()) > 0);
  check('bilancio del prologo: eleganza non ancora (GDD 7: da g02)', !(await page.isVisible('[data-test="cp-bilancio-eleganza"]')));
  await shot(page, '04-bilancio');
  await page.tap('[data-test="cp-bilancio-continua"]');
  check('bilancio → sera di g01', (await waitScene(page, 'sera')) && (await call<Rec>(page, 'campaign.state')).levelId === 'g01');
  const ev = await call<Rec>(page, 'campaign.evening');
  check('sera di g01: oggetto (merletto della nonna e Libro)', JSON.stringify(ev.objects) === '["merletto_avorio","libro_punti"]', JSON.stringify(ev.objects));
  check('sera di g01: 3 bigliettini, 2 spilli', (ev.noteIds as string[]).length === 3 && ev.pinsLeft === 2, JSON.stringify(ev.noteIds));
  await shot(page, '05-sera-porta');
  await page.tap('[data-test="cp-oggetto"]');
  check('oggetto: si legge', await page.isVisible('[data-test="cp-oggetto-merletto_avorio"]'));
  await page.tap('[data-test="cp-oggetto-continua"]');
  await page.waitForTimeout(400);
  check('bigliettini sotto la porta', (await page.locator('[data-test^="cp-bigliettino-"]').count()) === 3);
  await shot(page, '06-sera-bigliettini');
  await page.tap('[data-test="cp-bigliettino-g01.marta"]');
  await page.tap('[data-test="cp-appunta"]');
  await page.tap('[data-test="cp-bigliettino-g01.piero"]');
  await page.tap('[data-test="cp-appunta"]');
  await page.tap('[data-test="cp-bigliettino-g01.gino"]');
  check('terzo spillo: niente (spilli finiti)', await page.isDisabled('[data-test="cp-appunta"]'));
  await page.tap('[data-test="cp-rispondi"]');
  await page.tap('[data-test="cp-risposta-R2"]');
  check('risposta data', await page.isVisible('[data-test="cp-nota-risposta-data"]'));
  await page.keyboard.press('Escape');
  const ev2 = await call<Rec>(page, 'campaign.evening');
  check('due spilli e una risposta', (ev2.accepted as unknown[]).length === 2 && JSON.stringify(ev2.replies) === '{"g01.gino":"R2"}', JSON.stringify(ev2));
  await page.tap('[data-test="cp-al-tombolo"]');
  check('notte di g01', await waitNight(page));
  const n1 = await call<Rec>(page, 'night.state');
  const reqs = (n1.requests as { noteId: string }[]).map((r) => r.noteId).join(',');
  check('notte di g01 con le richieste appuntate', n1.levelId === 'g01' && reqs === 'g01.marta,g01.piero', reqs);

  // Due righe, poi ricarica a metà notte.
  const sol = await call<{ rows: { hour: number; crossings: { pair: number; over: string; forced?: boolean }[] }[] }>(page, 'engine.solve', 'g01', ['g01.marta', 'g01.piero']);
  for (const r of sol.rows.slice(0, 2)) {
    for (const c of r.crossings) if (!c.forced) await call(page, 'night.cross', c.pair, c.over);
    await call(page, 'night.fix');
  }
  const before = await call<Rec>(page, 'night.state');
  await call(page, 'core.flush');
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  check('dopo il ricaricamento: fase notte', (await phase(page)) === 'notte');
  await call(page, 'core.goto', 'sera', { cmd: 'continua' });
  await waitNight(page);
  const after = await call<Rec>(page, 'night.state');
  check('Continua a metà notte: stessa riga', after.hour === before.hour && (after.rows as unknown[]).length === (before.rows as unknown[]).length && after.levelId === 'g01', `${String(before.hour)} → ${String(after.hour)}`);
  await call(page, 'night.autoplay');
  await waitScene(page, 'alba');
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await call(page, 'core.goto', 'sera', { cmd: 'continua' });
  check('Continua in alba', await waitScene(page, 'alba'));
  await call(page, 'campaign.skipDawn');
  await waitScene(page, 'bilancio');
  const rep = await call<{ requests: { noteId: string; status: string }[] }>(page, 'campaign.report');
  check('bilancio di g01: due richieste valutate', rep.requests.length === 2, JSON.stringify(rep.requests.map((r) => [r.noteId, r.status])));
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await call(page, 'core.goto', 'sera', { cmd: 'continua' });
  check('Continua nel bilancio', await waitScene(page, 'bilancio'));
  await call(page, 'campaign.next');
  await waitScene(page, 'sera');
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await call(page, 'core.goto', 'sera', { cmd: 'continua' });
  check('Continua nella sera di g02', (await waitScene(page, 'sera')) && (await call<Rec>(page, 'campaign.state')).levelId === 'g02');

  // Taccuino nello stretto: overlay, Indietro lo chiude; Tab lo apre.
  await page.tap('[data-test="cp-apri-taccuino"]');
  check('Taccuino stretto: overlay', JSON.stringify(await call(page, 'core.overlays')) === '["taccuino"]');
  await shot(page, '07-taccuino');
  await page.keyboard.press('Escape');
  check('Indietro chiude il Taccuino', JSON.stringify(await call(page, 'core.overlays')) === '[]');
  await page.keyboard.press('Tab');
  check('Tab apre il Taccuino', JSON.stringify(await call(page, 'core.overlays')) === '["taccuino"]');
  await page.keyboard.press('Escape');

  check('nessun errore in console (prima giornata)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ───────── Tutta la campagna e i finali ─────────

async function wholeCampaign(browser: Browser, url: string): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'it-IT' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page, url);
  await call(page, 'campaign.newGame');
  await waitScene(page, 'sera');
  // Ogni notte con il tombolo vero e l'autoplay.
  for (let i = 0; i < 30; i++) {
    const ph = await phase(page);
    if (ph === 'scelta') break;
    if (ph === 'sera') {
      await call(page, 'campaign.objectSeen');
      await call(page, 'campaign.toNight');
    }
    if (!(await waitNight(page))) break;
    await call(page, 'night.autoplay');
    await until(page, 'fine della notte', async () => (await phase(page)) !== 'notte');
    await call(page, 'campaign.finishDay');
    await until(page, 'sera', async () => (await scene(page)) === 'sera');
  }
  const st = await call<Rec>(page, 'campaign.state');
  check('si raggiunge la scelta di g23', st.phase === 'scelta' && st.levelId === 'g23', `${String(st.phase)} ${String(st.levelId)}`);
  check('24 giornate nella storia', Object.keys(st.history as Rec).length === 24);
  const unlocks = await call<Rec>(page, 'core.save');
  const u = unlocks.unlocks as Rec;
  check('sblocchi di GDD 7 in save.unlocks', u.daily === true && u.libero === true && u.gradi === true, JSON.stringify(u));
  await page.waitForTimeout(300);
  await call(page, 'campaign.objectSeen');
  await page.waitForTimeout(300);
  await shot(page, '10-scelta');
  const cards = await call<{ ending: string; available: boolean }[]>(page, 'campaign.cards');
  check('quattro carte', cards.length === 4, cards.map((c) => c.ending).join(','));
  check('D strappata senza requisiti', cards.find((c) => c.ending === 'aperto')?.available === false);
  const noD = await call<Rec>(page, 'campaign.choose', 'aperto');
  check('D non si appunta senza requisiti', noD.ok === false && Array.isArray(noD.missing) && (noD.missing as unknown[]).length > 0);
  await page.click('[data-test="cp-carta-aperto"]');
  check('D strappata mostra le mancanze', (await page.locator('[data-test="cp-mancanze"] li').count()) > 0);
  await shot(page, '11-strappata');
  await page.keyboard.press('Escape');

  // C: il merletto chiuso torna alla sera di g23.
  await call(page, 'campaign.choose', 'chiuso');
  await waitNight(page);
  check('C: notte di fin_chiuso', (await call<Rec>(page, 'night.state')).levelId === 'fin_chiuso');
  await call(page, 'night.autoplay');
  await waitScene(page, 'finale');
  await shot(page, '12-chiuso');
  await until(page, 'vignette del chiuso', async () => JSON.stringify(await call(page, 'campaign.finale')).includes('vignette'));
  await page.click('[data-test="cp-vignetta-salta"]');
  await waitScene(page, 'sera');
  const kc = await call<Rec>(page, 'campaign.knowledge');
  const sc = await call<Rec>(page, 'campaign.state');
  check('C torna alla sera di g23 (scelta)', sc.phase === 'scelta' && sc.levelId === 'g23');
  check('C non conta come finale', (sc.endingsSeen as unknown[]).length === 0);
  check('C lascia la voce «Il punto di Clotilde»', (kc.diary as string[]).includes('domande.chiuso.punto'));

  for (const ending of ['merlettaia', 'seppia', 'aperto'] as const) {
    if (ending === 'aperto') {
      await call(page, 'campaign.setFlag', 'lettereLivia', 'liberate');
      await call(page, 'campaign.setFlag', 'riconciliate', true);
      for (const c of ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi']) await call(page, 'campaign.learn', 'desire', c);
      for (const c of ['teresa', 'marta', 'piero', 'gino']) await call(page, 'campaign.setMemoria', c, 2);
      const cd = await call<{ ending: string; available: boolean }[]>(page, 'campaign.cards');
      check('D disponibile con i requisiti', cd.find((c) => c.ending === 'aperto')?.available === true);
    }
    const r = await call<Rec>(page, 'campaign.choose', ending);
    check(`scelta ${ending}`, r.ok === true, JSON.stringify(r));
    await waitNight(page);
    const lv = (await call<Rec>(page, 'night.state')).levelId;
    await call(page, 'night.autoplay');
    const reached = await waitScene(page, 'finale', 20000);
    const fin = await call<Rec | null>(page, 'campaign.finale');
    check(`${ending}: epilogo dopo ${String(lv)}`, reached && fin?.mode === 'epilogo' && fin?.ending === ending, JSON.stringify(fin));
    await page.waitForTimeout(300);
    await shot(page, `13-epilogo-${ending}`);
    await page.click('[data-test="cp-vignetta-salta"]');
    await until(page, 'titoli', async () => JSON.stringify(await call(page, 'campaign.finale')).includes('titoli'));
    check(`${ending}: titoli di coda`, await page.isVisible('[data-test="cp-titoli"]'));
    const log = await call<{ id: string }[]>(page, 'audio.log');
    check(`${ending}: carillon dei titoli`, log.some((x) => String(x.id).includes('carillon')), log.slice(-3).map((x) => x.id).join(','));
    await page.click('[data-test="cp-titoli-fine"]');
    check(`${ending}: fine`, (await phase(page)) === 'fine' && (await page.isVisible('[data-test="cp-finale-fine"]')));
    const seen = (await call<Rec>(page, 'campaign.state')).endingsSeen as string[];
    check(`${ending}: tra gli epiloghi visti`, seen.includes(ending), seen.join(','));
    if (ending !== 'aperto') {
      await call(page, 'campaign.goto', 'g23', 'scelta');
      await waitScene(page, 'sera');
    }
  }
  const save = await call<Rec>(page, 'core.save');
  check('finale vero: Tovaglia sbloccata', (save.unlocks as Rec).tovaglia === true);
  check('nessun errore in console (campagna intera)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

// ───────── Layout largo, anonimi, Archivio, Telaio, misure ─────────

async function extras(browser: Browser, url: string): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await fresh(page, url);
  await call(page, 'campaign.newGame');
  await waitScene(page, 'sera');
  await call(page, 'campaign.finishDay');
  await waitScene(page, 'sera');
  await page.waitForTimeout(300);
  check('largo: Taccuino montato fisso nella sera', await page.isVisible('[data-test="cp-taccuino-fisso"] [data-test="cp-taccuino"]'));
  check('largo: niente overlay', JSON.stringify(await call(page, 'core.overlays')) === '[]');
  await shot(page, '20-largo-sera');
  await call(page, 'campaign.objectSeen');
  await call(page, 'campaign.accept', ['g01.marta']);
  await call(page, 'campaign.toNight');
  await waitNight(page);
  await page.waitForTimeout(300);
  check('largo: Bigliettini e Taccuino nel tombolo', (await page.isVisible('[data-test="cp-pannello-bigliettini"]')) && (await page.isVisible('[data-test="tb-pannello-destro"] [data-test="cp-taccuino"]')));
  check('largo: all’inizio della notte i Bigliettini mostrano la richiesta appuntata', await page.isVisible('[data-test="cp-pannello-bigliettini"] [data-test="cp-richiesta-g01.marta"]'));
  await shot(page, '21-largo-notte');
  await call(page, 'night.autoplay');
  await waitScene(page, 'alba');

  // Archivio (dopo g03).
  await call(page, 'campaign.finishDay'); // chiude g01
  await call(page, 'campaign.finishDay'); // g02
  await waitScene(page, 'sera');
  await call(page, 'campaign.objectSeen');
  await call(page, 'campaign.toNight');
  await waitNight(page);
  await call(page, 'night.autoplay');
  await waitScene(page, 'alba');
  await call(page, 'campaign.skipDawn');
  await waitScene(page, 'bilancio');
  await call(page, 'campaign.next');
  check('dopo il bilancio di g03: la cassapanca', (await waitScene(page, 'archivio')) && (await phase(page)) === 'archivio');
  await page.click('[data-test="cp-apri-arc1"]');
  await waitNight(page);
  check('arc1 in modo archivio', (await call<Rec>(page, 'night.state')).mode === 'archivio');
  await call(page, 'night.autoplay');
  await waitScene(page, 'archivio');
  await page.waitForTimeout(300);
  await shot(page, '22-rivelazione');
  if (await page.isVisible('[data-test="cp-vignetta-salta"]')) await page.click('[data-test="cp-vignetta-salta"]');
  const k = await call<Rec>(page, 'campaign.knowledge');
  check('arc1 rammendato: done(arc1), domanda chiusa', (k.archive as Rec).arc1 === 'rammendato' && (k.questions as Rec).martaTeresa === 'risolta');
  await page.click('[data-test="cp-archivio-continua"]');
  check('Archivio → sera di g04', (await waitScene(page, 'sera')) && (await call<Rec>(page, 'campaign.state')).levelId === 'g04');

  // Un merletto d'Archivio aperto dalla cassapanca durante la sera: ricaricando si
  // riprende; lasciato a metà (Torna al titolo) si abbandona e "Continua" torna alla sera.
  await call(page, 'campaign.archive', 'arc1');
  await waitNight(page);
  await call(page, 'core.flush');
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await call(page, 'core.goto', 'sera', { cmd: 'continua' });
  check('cassapanca: dopo il ricaricamento si riprende il merletto d’Archivio', (await waitNight(page)) && (await call<Rec>(page, 'night.state')).origin === 'archivio');
  await call(page, 'core.goto', 'titolo');
  await waitScene(page, 'titolo');
  await call(page, 'core.goto', 'sera', { cmd: 'continua' });
  check('cassapanca: lasciato a metà, Continua torna alla sera', (await waitScene(page, 'sera')) && (await phase(page)) === 'sera' && (await call<Rec>(page, 'core.save')).night === null);

  // Bigliettino anonimo con l'autore sbagliato (g13).
  await call(page, 'campaign.goto', 'g13', 'sera');
  await waitScene(page, 'sera');
  await call(page, 'campaign.setMemoria', 'marta', 0);
  await call(page, 'campaign.objectSeen');
  const ev = await call<Rec>(page, 'campaign.evening');
  check('memoria 0: bigliettino anonimo', (ev.anonymous as string[]).includes('g13.marta'), JSON.stringify(ev.anonymous));
  await page.waitForTimeout(300);
  await page.click('[data-test="cp-bigliettino-g13.marta"]');
  await page.click('[data-test="cp-appunta"]');
  check('anonimo: prima chi l’ha scritto', await page.isVisible('[data-test="cp-nota-chi"] ~ .cp-errore, .cp-errore'));
  await shot(page, '23-anonimo');
  const wrong = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-test^="cp-chi-"]'))
      .map((e) => e.dataset.test ?? '')
      .find((t) => t !== 'cp-chi-marta' && t.startsWith('cp-chi-') && t !== 'cp-chi-'),
  );
  check('anonimo: fila dei ritratti', !!wrong && (await page.locator('[data-test="cp-chi-marta"]').count()) === 1, String(wrong));
  await page.click(`[data-test="${wrong ?? 'cp-chi-teresa'}"]`);
  await page.click('[data-test="cp-appunta"]');
  await call(page, 'campaign.toNight');
  await waitNight(page);
  await call(page, 'night.autoplay');
  await waitScene(page, 'alba');
  const rep = await call<{ requests: { noteId: string; wrongGuess: boolean; status: string }[]; dawn: { id: string }[] }>(page, 'campaign.report');
  const r13 = rep.requests.find((r) => r.noteId === 'g13.marta');
  check('autore sbagliato: richiesta fallita', !!r13 && r13.wrongGuess && r13.status === 'fallita');
  check('autore sbagliato: quadro del fallimento all’alba', rep.dawn.some((v) => v.id === 'delusione:g13.marta'), rep.dawn.map((v) => v.id).join(','));

  // Telaio: Riprendi da qui (flag allo snapshot, Taccuino invariato) e Rigioca.
  await call(page, 'campaign.skipDawn');
  await call(page, 'campaign.setFlag', 'provaTelaio', true);
  const kBefore = JSON.stringify(await call(page, 'campaign.knowledge'));
  await call(page, 'core.goto', 'telaio');
  await page.click('[data-test="cp-nodo-apri-g01"]');
  await page.click('[data-test="cp-riprendi-g01"]');
  await page.click('[data-test="confirm-ok"]');
  await waitScene(page, 'sera');
  const sr = await call<Rec>(page, 'campaign.state');
  check('Riprendi da qui: sera di g01', sr.levelId === 'g01' && sr.phase === 'sera');
  check('Riprendi da qui: flag dello snapshot', (sr.flags as Rec).provaTelaio === undefined);
  check('Riprendi da qui: Taccuino invariato', JSON.stringify(await call(page, 'campaign.knowledge')) === kBefore);
  await call(page, 'core.goto', 'telaio');
  await page.click('[data-test="cp-nodo-apri-g00"]');
  await page.click('[data-test="cp-rigioca-g00"]');
  await waitNight(page);
  check('Rigioca: notte del Telaio', (await call<Rec>(page, 'night.state')).origin === 'telaio');
  await call(page, 'night.autoplay');
  await waitScene(page, 'bilancio');
  await page.click('[data-test="cp-bilancio-continua"]');
  await waitScene(page, 'telaio');
  check('Rigioca non cambia la storia', JSON.stringify(Object.keys((await call<Rec>(page, 'campaign.state')).history as Rec)) === '["g00"]');
  // Ripassa dal Telaio (dopo g08): la notte rigioca da sola il merletto già trovato.
  await call(page, 'campaign.unlockAll');
  await call(page, 'core.goto', 'telaio', { back: 'sera' });
  await page.click('[data-test="cp-nodo-apri-g00"]');
  await page.click('[data-test="cp-ripassa-g00"]');
  await waitNight(page);
  const rp = await call<Rec>(page, 'night.state');
  check('Ripassa dal Telaio: notte in modo replay', rp.origin === 'telaio' && rp.mode === 'replay', `${String(rp.origin)} ${String(rp.mode)}`);
  await waitScene(page, 'bilancio', 20000);
  await page.click('[data-test="cp-bilancio-continua"]');
  await waitScene(page, 'telaio');
  check('Ripassa non cambia la storia', JSON.stringify(Object.keys((await call<Rec>(page, 'campaign.state')).history as Rec)) === '["g00"]');
  await page.click('[data-test="cp-telaio-indietro"]');
  check('Telaio dopo Ripassa: Indietro torna alla sera da cui si era entrati', await waitScene(page, 'sera'));
  check('nessun errore in console (extra)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function measures(browser: Browser, url: string): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, locale: 'it-IT', hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await fresh(page, url);
  await call(page, 'core.setSettings', { textScale: 1.4 });
  await call(page, 'campaign.newGame');
  await waitScene(page, 'sera');
  const report = async (name: string): Promise<void> => {
    await page.waitForTimeout(500);
    const p = await layoutProblems(page);
    await shot(page, `30-misure-${name}`);
    check(`360×640, testo 140%: ${name}`, p.length === 0, p.slice(0, 4).join(' | '));
  };
  await report('prologo');
  await call(page, 'campaign.finishDay');
  await waitScene(page, 'sera');
  await report('porta');
  await call(page, 'campaign.objectSeen');
  await report('bigliettini');
  await page.tap('[data-test="cp-bigliettino-g01.gino"]');
  await page.tap('[data-test="cp-rispondi"]');
  await report('bigliettino');
  await page.keyboard.press('Escape');
  await call(page, 'core.openOverlay', 'taccuino', { from: 'sera' });
  await report('taccuino');
  await call(page, 'core.closeOverlay');
  await call(page, 'campaign.goto', 'g02', 'bilancio');
  await waitScene(page, 'bilancio');
  check('bilancio di g02: eleganza e record', await page.isVisible('[data-test="cp-bilancio-eleganza"]'));
  await report('bilancio');
  // "Continua" resta a portata anche con molte voci nuove (azioni nel terzo basso).
  const cont = await page.locator('[data-test="cp-bilancio-continua"]').boundingBox();
  check('bilancio: Continua visibile senza scorrere', !!cont && cont.y + cont.height <= 640 && cont.y > 640 / 3, JSON.stringify(cont));
  await call(page, 'core.goto', 'telaio');
  await report('telaio');
  await ctx.close();
}

async function main(): Promise<void> {
  const { url, proc } = await startServer();
  const browser = await chromium.launch();
  try {
    await prologueAndFirstDay(browser, url);
    await wholeCampaign(browser, url);
    await extras(browser, url);
    await measures(browser, url);
  } finally {
    await browser.close();
    stopServer(proc);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} controlli superati. Screenshot in ${OUT}`);
  if (failed.length > 0) process.exitCode = 1;
}

void main();
