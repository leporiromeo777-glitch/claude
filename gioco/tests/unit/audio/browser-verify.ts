/**
 * Verifica del pacchetto audio in Chromium headless (criteri di accettazione che
 * hanno bisogno di WebAudio vero). Non è un test di Vitest: si lancia a mano con
 *
 *   npx tsx tests/unit/audio/browser-verify.ts            (server di sviluppo sulla porta 5220)
 *   AUDIO_VERIFY_URL=http://127.0.0.1:4173/ npx tsx tests/unit/audio/browser-verify.ts
 *
 * Controlla: chiamate innocue prima dello sblocco (e registrate nel log); stato
 * 'running' dopo un clic e 'suspended' con la pagina nascosta; pre-render ≤ 300 ms di
 * CPU; rendering offline di ogni SfxId (RMS > 0,001, nessun NaN, picco ≤ 1); al massimo
 * 48 sorgenti con 200 effetti di fila; didascalie mostrate e tradotte; overlay "Tocca
 * per continuare" dopo un'interruzione; nessun file audio scaricato.
 * Esce con codice 1 se qualcosa non va.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const PORT = Number(process.env.AUDIO_VERIFY_PORT ?? 5220);
const EXTERNAL_URL = process.env.AUDIO_VERIFY_URL;
const AUDIO_FILE = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba|caf)(\?|$)/i;

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
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
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

type AudioApi = Record<string, (...args: unknown[]) => unknown>;

function audio<T>(page: Page, fn: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    ([f, a]) => {
      const api = (window as unknown as { __GAME__: { audio: AudioApi } }).__GAME__.audio;
      const target = api[f as string];
      if (typeof target !== 'function') throw new Error(`__GAME__.audio.${String(f)} missing`);
      return target(...(a as unknown[])) as T;
    },
    [fn, args] as const,
  ) as Promise<T>;
}

async function waitFor(page: Page, fn: string, expected: unknown, ms = 3000): Promise<unknown> {
  const t0 = Date.now();
  let last: unknown = undefined;
  while (Date.now() - t0 < ms) {
    last = await audio(page, fn);
    if (last === expected) return last;
    await page.waitForTimeout(50);
  }
  return last;
}

async function setHidden(page: Page, hidden: boolean): Promise<void> {
  // Stringa e non funzione: tsx aggiunge aiuti (__name) che nella pagina non esistono.
  await page.evaluate(`(() => {
    const h = ${hidden ? 'true' : 'false'};
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  })()`);
}

async function main(): Promise<void> {
  const { url, proc } = await startServer();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'it-IT' });
    const errors: string[] = [];
    const requests: { url: string; type: string }[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('request', (r) => requests.push({ url: r.url(), type: r.resourceType() }));

    await page.goto(`${url}?debug=1`);
    await page.waitForFunction(() => !!(window as unknown as { __GAME__?: { audio?: unknown } }).__GAME__);
    await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
    const namespaces = await page.evaluate(() => (window as unknown as { __GAME__: { namespaces(): string[] } }).__GAME__.namespaces());
    check('namespace audio registrato', namespaces.includes('audio'), namespaces.join(','));

    // ── Prima dello sblocco: tutto innocuo, tutto registrato ──
    check('stato prima del gesto', (await audio<string>(page, 'state')) === 'locked');
    const before = await page.evaluate(() => {
      const a = (window as unknown as { __GAME__: { audio: AudioApi } }).__GAME__.audio;
      const out: string[] = [];
      const calls: [string, unknown[]][] = [
        ['sfx', ['incrocio']],
        ['sfx', ['vaporetto']],
        ['bell', [9, 1]],
        ['note', ['teresa']],
        ['crossing', ['marta', 'teresa', true]],
        ['babble', ['marta', 'No.']],
        ['music', ['titolo', 'g00']],
        ['ambience', ['laguna']],
        ['duck', [true]],
        ['duck', [false]],
        ['mute', [false]],
      ];
      for (const [f, args] of calls) {
        try {
          (a[f] as (...x: unknown[]) => unknown)(...args);
        } catch (err) {
          out.push(`${f}: ${String(err)}`);
        }
      }
      return out;
    });
    check('nessuna eccezione prima di unlock()', before.length === 0, before.join('; '));
    const logBefore = await audio<{ id: string }[]>(page, 'log');
    const ids = logBefore.map((e) => e.id);
    check(
      'log registrato anche senza contesto',
      ['incrocio', 'vaporetto', 'campana', 'nota', 'borbottio', 'musica', 'ambiente'].every((x) => ids.includes(x)),
      ids.join(','),
    );
    check('ancora bloccato dopo le chiamate', (await audio<string>(page, 'state')) === 'locked');

    // ── Primo gesto ──
    await page.mouse.click(195, 300);
    const st = await waitFor(page, 'state', 'running');
    check("dopo un clic lo stato è 'running'", st === 'running', String(st));

    // ── Pre-render ──
    const t0 = Date.now();
    let pre: { done: boolean; cpuMs: number; jobs: number; slices: number } = { done: false, cpuMs: 0, jobs: 0, slices: 0 };
    while (Date.now() - t0 < 10_000) {
      pre = (await audio<{ prerender: typeof pre }>(page, 'stats')).prerender;
      if (pre.done) break;
      await page.waitForTimeout(100);
    }
    check('pre-render completato', pre.done, `${pre.jobs} lavori in ${pre.slices} lotti`);
    check('pre-render ≤ 300 ms di CPU', pre.done && pre.cpuMs <= 300, `${pre.cpuMs.toFixed(1)} ms`);

    // ── Rendering offline di ogni SfxId ──
    const report = await audio<{
      ok: boolean;
      failures: string[];
      results: { id: string; required: boolean; rms: number; peak: number; nan: boolean; ok: boolean }[];
      ms: number;
    }>(page, 'verify', 2);
    const required = report.results.filter((r) => r.required);
    check(`offline: ${required.length} SfxId con RMS > 0,001, senza NaN, picco ≤ 1`, report.ok && required.length === 26, report.failures.join('; '));
    const optional = report.results.filter((r) => !r.required);
    const badOptional = optional.filter((r) => !r.ok).map((r) => `${r.id} rms=${r.rms.toFixed(4)} peak=${r.peak.toFixed(3)}`);
    check(`offline: ${optional.length} controlli in più (campana, incroci, voci, ambienti, musica)`, badOptional.length === 0, badOptional.join('; '));
    for (const r of report.results) {
      console.log(`     ${r.id.padEnd(32)} rms ${r.rms.toFixed(4)}  picco ${r.peak.toFixed(3)}${r.nan ? '  NaN' : ''}`);
    }

    // ── Limitatore ──
    const stress = await audio<{ peak: number; active: number; stolen: number }>(page, 'stress', 200);
    check('200 effetti di fila: mai più di 48 sorgenti', stress.peak <= 48 && stress.active <= 48, `picco ${stress.peak}, attive ${stress.active}, tagliate ${stress.stolen}`);
    await audio(page, 'music', 'notte', 'g03');
    await audio(page, 'ambience', 'tempesta');
    await page.waitForTimeout(1200);
    const stress2 = await audio<{ peak: number; active: number }>(page, 'stress', 200);
    check('200 effetti con musica e tempesta: mai più di 48', stress2.peak <= 48, `picco ${stress2.peak}`);

    // ── Didascalie ──
    await page.evaluate(() =>
      (window as unknown as { __GAME__: { core: { setSettings(p: unknown): unknown } } }).__GAME__.core.setSettings({ captions: true }),
    );
    await audio(page, 'bell', 9, 1);
    const caption = await page
      .locator('[data-test="caption"]')
      .last()
      .textContent({ timeout: 2000 })
      .catch(() => null);
    check('didascalia della campana mostrata e tradotta', !!caption && caption.includes('9') && !caption.includes('audio.'), String(caption));
    const missing = await page.evaluate(() =>
      (window as unknown as { __GAME__: { core: { missingKeys(l?: string): string[] } } }).__GAME__.core.missingKeys('en'),
    );
    const missingAudio = missing.filter((k) => k.startsWith('audio.'));
    check('nessuna chiave audio mancante in inglese', missingAudio.length === 0, missingAudio.join(','));

    // ── Pagina nascosta e di nuovo visibile ──
    await setHidden(page, true);
    const hidden = await audio<string>(page, 'state');
    check("pagina nascosta: 'suspended'", hidden === 'suspended', hidden);
    await setHidden(page, false);
    const back = await waitFor(page, 'state', 'running');
    check("pagina di nuovo visibile: 'running'", back === 'running', String(back));

    // ── Interruzione del sistema: "Tocca per continuare" ──
    await audio(page, 'interrupt');
    const overlay = page.locator('[data-test="audio-tocca"]');
    const shown = await overlay
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    check('interruzione: compare "Tocca per continuare"', shown);
    if (shown) {
      const text = (await overlay.textContent()) ?? '';
      check('overlay tradotto', text.includes('Tocca per continuare') || text.includes('Tap to continue'), text);
      await overlay.click();
      const gone = await overlay
        .waitFor({ state: 'detached', timeout: 3000 })
        .then(() => true)
        .catch(() => false);
      check('tocco sull\'overlay: audio ripreso e overlay chiuso', gone && (await audio<string>(page, 'state')) === 'running');
    }

    // ── Rete: nessun file audio ──
    const audioReq = requests.filter((r) => AUDIO_FILE.test(r.url) || r.type === 'media');
    check('nessun file audio richiesto', audioReq.length === 0, audioReq.map((r) => r.url).join(', '));
    const external = requests.filter((r) => {
      try {
        const h = new URL(r.url).hostname;
        return r.url.startsWith('http') && h !== '127.0.0.1' && h !== 'localhost';
      } catch {
        return false;
      }
    });
    check('nessuna richiesta esterna', external.length === 0, external.map((r) => r.url).join(', '));

    const audioErrors = errors.filter((e) => /audio/i.test(e));
    check('nessun errore o avviso del pacchetto audio in console', audioErrors.length === 0, audioErrors.join(' | '));
    if (errors.length) console.log(`     (altri messaggi in console, di altri pacchetti: ${errors.length})`);
  } finally {
    await browser.close();
    proc?.kill('SIGTERM');
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} controlli superati`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
