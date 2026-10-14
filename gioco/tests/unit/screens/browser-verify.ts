/**
 * Verifica delle schermate nel browser (Chromium di Playwright 1.56.1), con un
 * server di sviluppo proprio. Non è un test Vitest (niente `.test.ts`): si
 * lancia a mano e controlla i criteri d'accettazione del pacchetto interfaccia:
 *
 *   npx tsx tests/unit/screens/browser-verify.ts
 *   SCREENS_VERIFY_PORT=5271         porta del server di sviluppo (5270-5274)
 *   SCREENS_VERIFY_URL=http://…/     usa un server già avviato
 *   SCREENS_VERIFY_OUT=<cartella>    dove salvare gli screenshot
 *
 * - ogni schermata con il mouse, con il tocco e con la sola tastiera; Esc e
 *   Indietro chiudono l'overlay in cima, nel tombolo aprono la Pausa;
 * - impostazioni applicate subito (salvataggio e attributi di <html>) e
 *   ancora lì dopo un ricaricamento;
 * - esporta → importa: salvataggio identico (tranne writtenAt);
 * - Merletto del giorno: stessa impronta dopo un ricaricamento, autoplay →
 *   DailyRecord e testo da condividere nel formato di GDD 8.3, spartito
 *   copiato e reimportato che ritesse lo stesso merletto;
 * - a 360×640 (anche con il testo al 140% e in inglese) nessun testo esce dal
 *   suo contenitore e ogni bersaglio è almeno 44×44 px.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type BrowserContextOptions, type Page } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PORT = Number(process.env.SCREENS_VERIFY_PORT ?? 5271);
const EXTERNAL_URL = process.env.SCREENS_VERIFY_URL;
const OUT = process.env.SCREENS_VERIFY_OUT ?? join(tmpdir(), 'screens-verify');
mkdirSync(OUT, { recursive: true });

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

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

const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function api<T = Json>(page: Page, ns: string, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([n, f, a]) => {
      const g = (window as unknown as { __GAME__: Record<string, unknown> }).__GAME__;
      let target: unknown = g[n as string];
      for (const part of (f as string).split('.')) target = (target as Record<string, unknown> | undefined)?.[part];
      if (typeof target !== 'function') throw new Error(`__GAME__.${String(n)}.${String(f)} missing`);
      return (await (target as (...x: unknown[]) => unknown)(...(a as unknown[]))) as T;
    },
    [ns, fn, args] as const,
  ) as Promise<T>;
}

async function openPage(browser: Browser, url: string, opts: BrowserContextOptions, errors: string[], query = ''): Promise<Page> {
  const ctx = await browser.newContext({ locale: 'it-IT', ...opts });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?debug=1${query}`);
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await wait(300);
  return page;
}

async function reload(page: Page): Promise<void> {
  await page.reload();
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
  await wait(300);
}

async function scene(page: Page): Promise<string> {
  return api<string>(page, 'core', 'scene');
}

async function waitScene(page: Page, id: string, ms = 8000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await scene(page)) === id) {
      await wait(250);
      return true;
    }
    await wait(80);
  }
  return false;
}

async function overlays(page: Page): Promise<string[]> {
  return api<string[]>(page, 'core', 'overlays');
}

const sel = (t: string): string => `[data-test="${t}"]`;

/**
 * Testi che escono dal contenitore e bersagli piccoli dentro le schermate e gli
 * overlay. È una stringa di JavaScript (non una funzione TypeScript) perché tsx
 * aggiungerebbe aiuti (`__name`) che nella pagina non esistono.
 */
const LAYOUT_PROBLEMS_JS = `(() => {
  const out = [];
  const roots = [...document.querySelectorAll('.core-scene [data-test^="sc-"], .core-overlays, .core-modals')];
  const vw = window.innerWidth;
  const seen = new Set();
  const name = (e) => e.tagName.toLowerCase() + (e.dataset.test ? '[' + e.dataset.test + ']' : '') + '.' + String(e.className).split(' ')[0];
  const scrolls = (c) => ['auto', 'scroll'].includes(getComputedStyle(c).overflowX);
  for (const root of roots) {
    for (const e of [root, ...root.querySelectorAll('*')]) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (e.closest('.core-sr-only, [hidden]')) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const ownText = [...e.childNodes].some((n) => n.nodeType === 3 && (n.textContent || '').trim().length > 0);
      if (ownText && cs.display !== 'inline' && e.scrollWidth > e.clientWidth + 1 && !scrolls(e) && e.tagName !== 'TEXTAREA') out.push('overflow ' + name(e) + ' ' + e.scrollWidth + '>' + e.clientWidth);
      if (ownText && (r.right > vw + 1 || r.left < -1)) out.push('offscreen ' + name(e) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
      const interactive = e.matches('button, a[href], input, select, textarea, [role="button"], [role="switch"], [role="tab"], [role="radio"], [role="slider"]');
      if (interactive && (r.width < 43.5 || r.height < 43.5)) out.push('small ' + name(e) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      const b = ownText ? e.closest('button') : null;
      if (b) {
        const br = b.getBoundingClientRect();
        if (r.right > br.right + 1 || r.left < br.left - 1) out.push('fuori dal pulsante ' + name(e));
      }
    }
  }
  return out;
})()`;

async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(LAYOUT_PROBLEMS_JS) as Promise<string[]>;
}

async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
}

/** Tutte le schermate e gli overlay, con controllo del layout. */
async function layoutTour(browser: Browser, url: string, tag: string, opts: BrowserContextOptions, textScale: number, lang: 'it' | 'en'): Promise<void> {
  const errors: string[] = [];
  const page = await openPage(browser, url, opts, errors, `&lang=${lang}`);
  await api(page, 'core', 'setSettings', { textScale });
  await wait(300);
  const problems: Record<string, string[]> = {};
  const look = async (name: string): Promise<void> => {
    await wait(450);
    problems[name] = await layoutProblems(page);
    await snap(page, `${tag}-${name}`);
  };
  await look('titolo-primo');
  await api(page, 'ui', 'unlock', 'all');
  await look('titolo-sbloccato');
  // Con una storia: Continua, Nuova storia, le tre modalità (Telaio compreso) e il piede.
  await api(page, 'campaign', 'newGame').catch(() => null);
  await wait(300);
  await api(page, 'ui', 'open', 'titolo');
  await waitScene(page, 'titolo');
  await look('titolo-storia');
  await api(page, 'ui', 'open', 'giornaliero');
  await waitScene(page, 'giornaliero');
  await wait(900);
  await look('giornaliero');
  await api(page, 'ui', 'open', 'spartito', { returnTo: 'giornaliero' });
  await look('spartito');
  await api(page, 'core', 'closeOverlay');
  await api(page, 'ui', 'open', 'libero');
  await waitScene(page, 'libero');
  await look('libero');
  await api(page, 'ui', 'open', 'impostazioni');
  await waitScene(page, 'impostazioni');
  await look('impostazioni');
  await page.locator('.sc-corpo').evaluate((e) => e.scrollTo(0, e.scrollHeight));
  await page.click(sel('sc-impostazioni-esporta'));
  await page.click(sel('sc-impostazioni-importa'));
  await look('impostazioni-salvataggi');
  await api(page, 'ui', 'open', 'crediti');
  await waitScene(page, 'crediti');
  await look('crediti');
  // Notte del giorno, pausa, impostazioni sopra la pausa, risultati.
  await api(page, 'ui', 'startDaily');
  await waitScene(page, 'tombolo');
  await api(page, 'core', 'input.action', 'back');
  await look('pausa');
  await api(page, 'ui', 'open', 'impostazioniOverlay');
  await look('pausa-impostazioni');
  await api(page, 'core', 'closeOverlay');
  await api(page, 'core', 'closeOverlay');
  await api(page, 'core', 'time.setSpeed', 8);
  await api(page, 'night', 'autoplay');
  await waitScene(page, 'giornaliero', 10000);
  await wait(800);
  await look('giornaliero-risultato');
  await api(page, 'core', 'time.setSpeed', 1);
  if (tag === 'android-140') {
    // Il controllo vede davvero i problemi: una sonda con un testo che esce e un pulsante piccolo.
    const probe = await page.evaluate(`(() => {
      const box = document.createElement('div');
      box.dataset.test = 'sc-sonda';
      box.className = 'core-solid';
      box.style.cssText = 'position:absolute;top:0;left:0';
      const t = document.createElement('p');
      t.style.cssText = 'width:40px;overflow:hidden;white-space:nowrap';
      t.textContent = 'parolalunghissimasenzaspazi';
      const b = document.createElement('button');
      b.style.cssText = 'width:20px;height:20px';
      box.append(t, b);
      document.querySelector('.core-scene').appendChild(box);
      return true;
    })()`);
    const found = await layoutProblems(page);
    await page.evaluate(`document.querySelector('[data-test="sc-sonda"]').remove()`);
    check('layout: il controllo riconosce un testo che esce e un bersaglio piccolo', !!probe && found.some((x) => x.startsWith('overflow')) && found.some((x) => x.startsWith('small')), found.join('; '));
  }
  const bad = Object.entries(problems).filter(([, p]) => p.length > 0);
  check(
    `layout ${tag}: nessun testo fuori dal contenitore, bersagli ≥ 44 px`,
    bad.length === 0,
    bad.length ? bad.map(([k, p]) => `${k}: ${p.slice(0, 4).join('; ')}`).join(' | ') : `${Object.keys(problems).length} schermate`,
  );
  check(`layout ${tag}: nessun errore in console`, errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.context().close();
}

async function main(): Promise<void> {
  const { url, proc } = await startServer();
  const browser = await chromium.launch();
  try {
    // ───────── Titolo: atmosfera, voci, lucchetti ─────────
    {
      const errors: string[] = [];
      const page = await openPage(browser, url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, errors);
      check('titolo: è la prima scena', (await scene(page)) === 'titolo');
      await wait(2200);
      await snap(page, 'titolo-iphone');
      const title = await api<Json[]>(page, 'ui', 'title');
      check(
        'titolo: primo avvio con una scritta sola («Tocca per iniziare»), Impostazioni e Crediti in fondo (GDD 9)',
        title[0]?.labelKey === 'ui.titolo.inizia' && title.map((i: Json) => i.id).join() === 'nuova,impostazioni,crediti' && (await page.locator(sel('sc-titolo-modi')).count()) === 0,
        JSON.stringify(title.map((i: Json) => `${i.id}${i.locked ? '🔒' : ''}`)),
      );
      const music = await api<Json>(page, 'audio', 'stats').catch(() => null);
      check(
        "titolo: musica del titolo, laguna e orologio che ticchetta (GDD 9)",
        !music || (music.music === 'titolo' && music.ambience === 'laguna' && music.clock === true),
        music ? `${music.music}/${music.ambience}${music.clock ? '+orologio' : ''}` : 'audio assente',
      );
      // Il quadro su canvas: il centro del tombolo non è velluto vuoto.
      const px = await page.evaluate(() => {
        const c = document.getElementById('scene-canvas') as HTMLCanvasElement;
        const st = document.querySelector('[data-test="sc-titolo-palco"]')?.getBoundingClientRect();
        const ctx = c.getContext('2d');
        if (!ctx || !st) return null;
        const k = c.width / c.getBoundingClientRect().width;
        const d = ctx.getImageData(Math.round((st.left + st.width * 0.5) * k), Math.round((st.top + st.height * 0.45) * k), 1, 1).data;
        return [d[0], d[1], d[2]];
      });
      check('titolo: il tombolo è disegnato nel palco', !!px && (px[0] as number) + (px[1] as number) + (px[2] as number) > 60 && !(Math.abs((px[0] as number) - 28) < 10 && Math.abs((px[2] as number) - 51) < 10), JSON.stringify(px));
      // Dopo il primo avvio (una storia cominciata) le modalità chiuse hanno il lucchetto.
      await api(page, 'campaign', 'newGame');
      await wait(400);
      await api(page, 'ui', 'open', 'titolo');
      await wait(500);
      const after = await api<Json[]>(page, 'ui', 'title');
      check('titolo: con una storia, Continua e le modalità con il lucchetto', after[0]?.id === 'continua' && after.some((i: Json) => i.id === 'giornaliero' && i.locked) && after.some((i: Json) => i.id === 'libero' && i.locked), JSON.stringify(after.map((i: Json) => `${i.id}${i.locked ? '🔒' : ''}`)));
      // Lucchetto: tocco → avviso, nessun cambio di scena.
      await page.tap(sel('sc-titolo-giornaliero'), { force: true });
      await wait(300);
      check('titolo: una voce chiusa spiega il lucchetto', (await scene(page)) === 'titolo' && (await page.locator(sel('toast')).count()) > 0);
      // Tocco: Crediti, Indietro (pulsante).
      await page.tap(sel('sc-titolo-crediti'));
      check('tocco: titolo → crediti', await waitScene(page, 'crediti'));
      const r0 = await page.evaluate(() => document.querySelector('[data-test="sc-crediti-rullo"]')?.scrollTop ?? -1);
      await wait(1600);
      const r1 = await page.evaluate(() => document.querySelector('[data-test="sc-crediti-rullo"]')?.scrollTop ?? -1);
      check('crediti: il rullo scorre da solo', r1 > r0, `${r0} → ${r1}`);
      const credits = (await page.locator(sel('sc-crediti')).innerText()).replace(/\s+/g, ' ');
      check(
        'crediti: autore, font OFL, strumenti, Pellestrina e Burano, intelligenza artificiale',
        credits.includes('Ispirato alla tradizione del merletto a fuselli di Pellestrina e Burano') && credits.includes('Open Font License') && credits.includes('Blender') && credits.includes('intelligenza artificiale') && credits.includes('Atkinson Hyperlegible'),
      );
      await snap(page, 'crediti-iphone');
      await page.tap(sel('sc-crediti-indietro'));
      check('tocco: crediti → titolo con Indietro', await waitScene(page, 'titolo'));
      check('titolo: nessun errore in console', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.context().close();
    }

    // ───────── Sola tastiera ─────────
    {
      const errors: string[] = [];
      const page = await openPage(browser, url, { viewport: { width: 1280, height: 720 } }, errors);
      await api(page, 'ui', 'unlock', 'all');
      await wait(900);
      await snap(page, 'titolo-desktop');
      const focusTest = (): Promise<string | null> => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset?.test ?? null);
      const tabTo = async (test: string, max = 30): Promise<boolean> => {
        for (let i = 0; i < max; i++) {
          if ((await focusTest()) === test) return true;
          await page.keyboard.press('Tab');
          await wait(40);
        }
        return (await focusTest()) === test;
      };
      check('tastiera: il fuoco parte dalla voce principale', (await focusTest()) === 'sc-titolo-nuova', String(await focusTest()));
      check('tastiera: Tab arriva a Impostazioni', await tabTo('sc-titolo-impostazioni'));
      await page.keyboard.press('Enter');
      check('tastiera: Invio apre le impostazioni', await waitScene(page, 'impostazioni'));
      check('tastiera: Tab arriva all’alto contrasto', await tabTo('sc-impostazioni-contrasto'));
      await page.keyboard.press('Space');
      await wait(150);
      const st = await api<Json>(page, 'core', 'save');
      const html = await page.evaluate(() => document.documentElement.dataset.contrast);
      check('impostazioni: alto contrasto subito (salvataggio e <html>)', st.settings.highContrast === true && html === 'alto', `${st.settings.highContrast} ${html}`);
      check('tastiera: Tab arriva al testo', await tabTo('sc-impostazioni-testo'));
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
      await wait(200);
      const ts = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim());
      const st2 = await api<Json>(page, 'core', 'save');
      check('impostazioni: testo al 140% subito', st2.settings.textScale === 1.4 && ts === '1.4', `${st2.settings.textScale} ${ts}`);
      check('tastiera: Tab arriva alla velocità', await tabTo('sc-impostazioni-velocita-1'));
      await page.keyboard.press('ArrowRight');
      await wait(100);
      check('impostazioni: velocità 2× con le frecce', (await api<Json>(page, 'core', 'save')).settings.animSpeed === 2 && (await page.evaluate(() => document.documentElement.dataset.animSpeed)) === '2');
      await page.click(sel('sc-impostazioni-movimento'));
      await page.click(sel('sc-impostazioni-captions'));
      await page.click(sel('sc-impostazioni-haptics'));
      await page.click(sel('sc-impostazioni-autoAdvance'));
      const vol = page.locator(sel('sc-impostazioni-volume-music'));
      await vol.focus();
      for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
      await page.click(sel('sc-impostazioni-lingua-en'));
      await wait(400);
      const before = (await api<Json>(page, 'core', 'save')).settings;
      const titleText = await page.locator('.sc-testata-titolo').innerText();
      check('impostazioni: lingua inglese subito', before.locale === 'en' && titleText === 'Settings' && (await page.evaluate(() => document.documentElement.lang)) === 'en', titleText);
      await reload(page);
      const after = (await api<Json>(page, 'core', 'save')).settings;
      const attrs = await page.evaluate(() => ({ c: document.documentElement.dataset.contrast, m: document.documentElement.dataset.motion, s: document.documentElement.dataset.animSpeed, t: getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim(), l: document.documentElement.lang }));
      check('impostazioni: tutte sopravvivono al ricaricamento', JSON.stringify(after) === JSON.stringify(before) && attrs.c === 'alto' && attrs.m === 'ridotto' && attrs.s === '2' && attrs.t === '1.4' && attrs.l === 'en', `${JSON.stringify(after)} ${JSON.stringify(attrs)}`);
      // Esc dalle impostazioni → titolo.
      await api(page, 'ui', 'open', 'impostazioni');
      await waitScene(page, 'impostazioni');
      await page.keyboard.press('Escape');
      check('tastiera: Esc dalle impostazioni torna al titolo', await waitScene(page, 'titolo'));
      // Riporta le impostazioni normali.
      await api(page, 'core', 'setSettings', { highContrast: false, reducedMotion: false, animSpeed: 1, textScale: 1, locale: 'it', captions: false, haptics: true, autoAdvance: false });
      await api(page, 'core', 'flush');
      // Merletto libero da tastiera fino al tombolo, Esc → Pausa, Esc chiude.
      await reload(page);
      check('tastiera: Tab arriva al Merletto libero', await tabTo('sc-titolo-libero'));
      await page.keyboard.press('Enter');
      check('tastiera: Invio apre il Merletto libero', await waitScene(page, 'libero'));
      check('tastiera: il fuoco è su «Tessi»', (await focusTest()) === 'sc-libero-tessi', String(await focusTest()));
      await page.keyboard.press('Enter');
      check('tastiera: «Tessi» apre il tombolo', await waitScene(page, 'tombolo'));
      await page.keyboard.press('Escape');
      await wait(250);
      check('tastiera: Esc nel tombolo apre la Pausa', (await overlays(page)).at(-1) === 'pausa', JSON.stringify(await overlays(page)));
      check('pausa: il fuoco è su Riprendi', (await focusTest()) === 'sc-pausa-riprendi', String(await focusTest()));
      await tabTo('sc-pausa-impostazioni');
      await page.keyboard.press('Enter');
      await wait(300);
      check('pausa: Impostazioni si apre sopra la Pausa', JSON.stringify(await overlays(page)) === '["pausa","impostazioni"]', JSON.stringify(await overlays(page)));
      await page.keyboard.press('Escape');
      await wait(200);
      check('tastiera: Esc chiude l’overlay in cima', JSON.stringify(await overlays(page)) === '["pausa"]', JSON.stringify(await overlays(page)));
      await page.keyboard.press('Escape');
      await wait(200);
      check('tastiera: Esc chiude la Pausa e si torna a tessere', (await overlays(page)).length === 0 && (await scene(page)) === 'tombolo');
      await page.keyboard.press('Escape');
      await wait(250);
      await page.click(sel('sc-pausa-esci'));
      check('mouse: «Torna al titolo» dalla Pausa', await waitScene(page, 'titolo'));
      const saved = await api<Json>(page, 'core', 'save');
      check('pausa: la notte resta salvata (Riprendi nel Merletto libero)', saved.night?.origin === 'libero');
      await api(page, 'ui', 'open', 'libero');
      await waitScene(page, 'libero');
      check('libero: «Riprendi il merletto» c’è', (await page.locator(sel('sc-libero-riprendi')).count()) === 1);
      check('tastiera: nessun errore in console', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.context().close();
    }

    // ───────── Esporta / importa ─────────
    {
      const errors: string[] = [];
      const page = await openPage(browser, url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, errors);
      await api(page, 'ui', 'unlock', 'all');
      await api(page, 'core', 'setSettings', { captions: true });
      await api(page, 'core', 'flush');
      await api(page, 'ui', 'open', 'impostazioni');
      await waitScene(page, 'impostazioni');
      await page.locator(sel('sc-impostazioni-esporta')).scrollIntoViewIfNeeded();
      await page.tap(sel('sc-impostazioni-esporta'));
      await wait(200);
      const exported = await page.locator(sel('sc-impostazioni-esporta-testo')).inputValue();
      const snapshot = await api<Json>(page, 'core', 'save');
      check('esporta: la stringa TRAMA-SAVE-1 appare nel campo', exported.startsWith('TRAMA-SAVE-1:'), `${exported.length} caratteri`);
      await api(page, 'core', 'setSettings', { captions: false, locale: 'en' });
      await page.evaluate(() => (window as unknown as { __GAME__: Json }).__GAME__.ui.setToday('2026-10-14'));
      await page.tap(sel('sc-impostazioni-importa'));
      await page.fill(sel('sc-impostazioni-importa-testo'), exported);
      await page.tap(sel('sc-impostazioni-importa-ok'));
      await wait(200);
      check('importa: chiede conferma', (await page.locator(sel('confirm')).count()) === 1);
      await page.tap(sel('confirm-ok'));
      await wait(400);
      const restored = await api<Json>(page, 'core', 'save');
      const strip = (d: Json): string => JSON.stringify({ ...d, writtenAt: '' });
      check('esporta → importa: salvataggio identico (tranne writtenAt)', strip(restored) === strip(snapshot));
      await reload(page);
      // Dopo il ricaricamento il tempo di gioco è cresciuto: si confronta tutto il resto.
      const played = (d: Json): string => JSON.stringify({ ...d, writtenAt: '', stats: { ...d.stats, playMs: 0 } });
      const reloaded = await api<Json>(page, 'core', 'save');
      const diff = Object.keys(snapshot).filter((k) => JSON.stringify(reloaded[k]) !== JSON.stringify(snapshot[k]));
      check('importa: resta dopo il ricaricamento', played(reloaded) === played(snapshot), `campi diversi: ${diff.join(', ')}`);
      check('esporta/importa: nessun errore in console', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.context().close();
    }

    // ───────── Merletto del giorno ─────────
    {
      const errors: string[] = [];
      const page = await openPage(browser, url, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, errors);
      await api(page, 'ui', 'unlock', 'all');
      const d1 = await api<Json>(page, 'ui', 'daily');
      await reload(page);
      const d2 = await api<Json>(page, 'ui', 'daily');
      check('giornaliero: stessa data → stesso livello dopo il ricaricamento', d1.hash === d2.hash && d1.levelId === d2.levelId && d1.date === d2.date, `${d1.date} ${d1.hash}`);
      const eng = await api<Json>(page, 'engine', 'daily', d1.date).catch(() => null);
      check('giornaliero: lo stesso livello del motore (__GAME__.engine.daily)', !eng || eng.level?.id === d1.levelId || eng.id === d1.levelId || JSON.stringify(eng).includes(d1.levelId));
      await api(page, 'ui', 'open', 'giornaliero');
      await waitScene(page, 'giornaliero');
      await wait(800);
      await snap(page, 'giornaliero-iphone');
      check('giornaliero: data, pagina del Libro con la regola, record e serie', (await page.locator(sel('sc-giornaliero-libro')).count()) === 1 && (await page.locator(sel('sc-giornaliero-data')).count()) === 1 && (await page.locator(sel('sc-giornaliero-serie')).count()) === 1);
      await page.tap(sel('sc-giornaliero-tessi'));
      check('tocco: «Tessi» apre il tombolo con origine giornaliero', (await waitScene(page, 'tombolo')) && (await api<Json>(page, 'night', 'state')).origin === 'giornaliero');
      await api(page, 'core', 'time.setSpeed', 8);
      const outcome = await api<Json>(page, 'night', 'autoplay');
      check('giornaliero: autoplay completa la notte', !!outcome);
      const share = await api<string>(page, 'ui', 'share');
      const line = (share ?? '').split('\n')[0] ?? '';
      check('giornaliero: testo da condividere nel formato di GDD 8.3', /^TRAMA \d{2}\/\d{2} · \d+ incroc(io|i) \(min \d+\) · \d+ or[ae] di quiete( · simmetria ✦)?$/.test(line), line);
      const rec = (await api<Json>(page, 'core', 'save')).daily[d1.date];
      check('giornaliero: DailyRecord salvato', !!rec && rec.date === d1.date && typeof rec.incroci === 'number' && rec.min === d1.min && typeof rec.spartito === 'string' && rec.spartito.startsWith('TRAMA1-G'), JSON.stringify(rec));
      check('giornaliero: la riga ha i numeri del record', line === `TRAMA ${d1.date.slice(8, 10)}/${d1.date.slice(5, 7)} · ${rec.incroci} ${rec.incroci === 1 ? 'incrocio' : 'incroci'} (min ${rec.min}) · ${rec.quiete} ${rec.quiete === 1 ? 'ora' : 'ore'} di quiete${rec.simmetria ? ' · simmetria ✦' : ''}`);
      check('giornaliero: lo spartito condiviso è quello del merletto', (share ?? '').split('\n')[1] === rec.spartito);
      check('giornaliero: dopo la notte, i risultati', await waitScene(page, 'giornaliero', 6000));
      await wait(700);
      await snap(page, 'giornaliero-risultato-iphone');
      check('risultati: Condividi, Copia spartito, immagine del merletto', (await page.locator(sel('sc-risultato-condividi')).count()) === 1 && (await page.locator(sel('sc-risultato-copia')).count()) === 1 && (await page.locator(`${sel('sc-risultato-immagine')} img`).count()) === 1);
      await page.tap(sel('sc-risultato-condividi'));
      await wait(500);
      check('condividi: un avviso dice cosa è successo', (await page.locator(sel('toast')).count()) > 0);
      const finalPos = outcome.timeline[outcome.timeline.length - 1].pos;
      // Ricaricamento: il record resta, la serie è 1.
      await reload(page);
      const after = await api<Json>(page, 'ui', 'daily');
      check('giornaliero: record e serie dopo il ricaricamento', after.record?.spartito === rec.spartito && after.streak === 1 && after.days === 1);
      // Spartito copiato e reimportato dal pannello.
      await api(page, 'ui', 'open', 'giornaliero');
      await waitScene(page, 'giornaliero');
      await page.locator(sel('sc-giornaliero-importa')).scrollIntoViewIfNeeded();
      await page.tap(sel('sc-giornaliero-importa'));
      await wait(200);
      await page.fill(sel('sc-spartito-campo'), rec.spartito);
      await page.tap(sel('sc-spartito-tessi'));
      check('spartito: reimportato apre il tombolo in modo replay', (await waitScene(page, 'tombolo')) && (await api<Json>(page, 'night', 'state')).mode === 'replay');
      await api(page, 'night', 'skip').catch(() => null);
      await wait(400);
      const rs = await api<Json>(page, 'night', 'state');
      check('spartito: ritesse lo stesso merletto', JSON.stringify(rs.positions) === JSON.stringify(finalPos) && rs.rows.length === outcome.rows.length, `${JSON.stringify(rs.positions)} vs ${JSON.stringify(finalPos)}`);
      check('spartito: dopo, i risultati dello spartito', await waitScene(page, 'giornaliero', 6000));
      const sr = await api<Json>(page, 'ui', 'result', 'spartito');
      check('spartito: stesso spartito e stessa eleganza', sr?.spartito === rec.spartito && sr?.metrics.incroci === rec.incroci);
      const bad = await api<Json>(page, 'ui', 'checkSpartito', rec.spartito.slice(0, -1) + (rec.spartito.endsWith('a') ? 'b' : 'a'));
      check('spartito: un carattere alterato si rifiuta con una spiegazione', bad.ok === false && bad.errorKey === 'ui.spartito.errore.formato');
      await api(page, 'core', 'time.setSpeed', 1);
      check('giornaliero: nessun errore in console', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.context().close();
    }

    // ───────── Merletto libero: ripresa dopo il ricaricamento (risolutore lib-…) ─────────
    {
      const errors: string[] = [];
      const page = await openPage(browser, url, { viewport: { width: 1280, height: 720 } }, errors);
      await api(page, 'ui', 'unlock', 'all');
      await api(page, 'ui', 'startLibero', { seed: 'g2k9x', gradi: ['notteCorta', 'spilliVelati'] });
      await waitScene(page, 'tombolo');
      const s0 = await api<Json>(page, 'night', 'state');
      // Una riga qualsiasi che si possa fissare (vuota, o con un incrocio).
      for (let pair = -1; pair < s0.positions.length - 1; pair++) {
        if (pair >= 0) await api(page, 'night', 'cross', pair, 'L');
        const r = await api<Json>(page, 'night', 'fix');
        if (r?.ok) break;
        await api(page, 'night', 'undo');
      }
      await api(page, 'core', 'flush');
      await reload(page);
      await api(page, 'night', 'resume');
      await waitScene(page, 'tombolo');
      const s1 = await api<Json>(page, 'night', 'state');
      check('libero: la notte si riprende dopo il ricaricamento (lib-…)', s1.active && s1.levelId === s0.levelId && s1.levelId === 'lib-g2k9x~notteCorta+spilliVelati' && s1.rows.length >= 1, `${s1.levelId} righe ${s1.rows?.length}`);
      await api(page, 'core', 'time.setSpeed', 8);
      await api(page, 'night', 'autoplay');
      check('libero: dopo la notte, i risultati', await waitScene(page, 'libero', 8000));
      const lr = await api<Json>(page, 'ui', 'result', 'libero');
      check('libero: record del seme e gradi', lr?.record?.minIncroci !== undefined && JSON.stringify(lr.gradi) === '["spilliVelati","notteCorta"]', JSON.stringify(lr?.gradi));
      await wait(600);
      await snap(page, 'libero-risultato-desktop');
      await api(page, 'core', 'time.setSpeed', 1);
      check('libero: nessun errore in console', errors.length === 0, errors.slice(0, 3).join(' | '));
      await page.context().close();
    }

    // ───────── Layout ─────────
    await layoutTour(browser, url, 'android-100', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 1, 'it');
    await layoutTour(browser, url, 'android-140', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 1.4, 'it');
    await layoutTour(browser, url, 'android-140-en', { viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 1.4, 'en');
    await layoutTour(browser, url, 'iphone-120', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true }, 1.2, 'it');
    await layoutTour(browser, url, 'desktop', { viewport: { width: 1280, height: 720 } }, 1, 'it');
    await layoutTour(browser, url, 'ipad', { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true }, 1, 'it');
    await layoutTour(browser, url, 'desktop-hd', { viewport: { width: 1920, height: 1080 } }, 1, 'en');
    await layoutTour(browser, url, 'telefono-orizzontale', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, 1, 'it');
  } finally {
    await browser.close();
    stopServer(proc);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} controlli superati. Screenshot in ${OUT}`);
  process.exit(failed.length > 0 ? 1 : 0);
}

void main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
