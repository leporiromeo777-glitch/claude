/**
 * Aiuti condivisi dei test end-to-end (ARCHITETTURA 15.2, pacchetto piattaforma-qa).
 *
 * - `test`: il `test` di Playwright con la fixture `game`, installata in ogni test:
 *   raccoglie gli errori della console e le richieste verso host diversi da
 *   localhost (bloccate), apre il gioco e aspetta `__GAME__.ready`.
 * - `call(page, 'ns.fn', ...args)`: chiama una funzione di `window.__GAME__`.
 * - attese: `until`, `waitScene`, `waitNight`, `waitPhase`.
 * - `onlyProjects(testInfo, ...)`: limita una suite a certi progetti.
 *
 * Le chiamate di debug sono quelle documentate in ARCHITETTURA 15.1 e nei rapporti
 * dei pacchetti (docs/stato/*.md): core, engine, night, campaign, ui, audio.
 */
import { test as base, expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import type { GameDebugRoot } from '../../../src/core/debug';

export { expect };
export type { GameDebugRoot };

/** Valore JSON restituito da __GAME__ (tutto è serializzabile, ARCHITETTURA 15.1). */
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Rec = Record<string, unknown>;

export const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Messaggi della console che non sono difetti del gioco (rumore del browser headless). */
const IGNORED_CONSOLE = [/favicon\.ico/i, /DevTools/i, /Download the React DevTools/i];

export interface NetworkLog {
  /** Richieste verso host diversi da localhost (bloccate con abort). */
  external: string[];
  /** Tutte le richieste http(s) viste (per i controlli sui file audio e simili). */
  all: { url: string; type: string }[];
}

/** Blocca e registra le richieste che escono da localhost in tutto il contesto. */
export async function guardNetwork(context: BrowserContext): Promise<NetworkLog> {
  const log: NetworkLog = { external: [], all: [] };
  await context.route(
    (url) => url.protocol.startsWith('http') && !LOCAL_HOSTS.has(url.hostname),
    async (route) => {
      log.external.push(route.request().url());
      await route.abort('blockedbyclient');
    },
  );
  context.on('request', (r) => {
    const url = r.url();
    if (!url.startsWith('http')) return;
    log.all.push({ url, type: r.resourceType() });
    try {
      const host = new URL(url).hostname;
      if (!LOCAL_HOSTS.has(host) && !log.external.includes(url)) log.external.push(url);
    } catch {
      /* URL non analizzabile: non è una richiesta di rete vera */
    }
  });
  return log;
}

/** Raccoglie errori ed eccezioni non gestite della pagina. */
export function captureErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORED_CONSOLE.some((r) => r.test(text))) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Chiama `__GAME__.<percorso>(...args)` nella pagina (anche asincrona). */
export function call<T = Json>(page: Page, path: string, ...args: unknown[]): Promise<T> {
  return page.evaluate(
    async ([p, a]) => {
      const parts = (p as string).split('.');
      let target: unknown = (window as unknown as { __GAME__?: unknown }).__GAME__;
      let self: unknown = null;
      for (const k of parts) {
        if (target === null || target === undefined) break;
        self = target;
        target = (target as Record<string, unknown>)[k];
      }
      if (typeof target !== 'function') throw new Error(`__GAME__.${p as string} non è una funzione`);
      return (await (target as (...x: unknown[]) => unknown).apply(self, a as unknown[])) as unknown;
    },
    [path, args] as const,
  ) as Promise<T>;
}

/** Aspetta `__GAME__.ready` (dopo goto o reload). */
export async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as unknown as { __GAME__?: unknown }).__GAME__, null, { timeout: 30_000 });
  await page.evaluate(() => (window as unknown as { __GAME__: { ready: Promise<void> } }).__GAME__.ready);
}

/** Ricarica la pagina e aspetta la fine dell'avvio. */
export async function reload(page: Page): Promise<void> {
  await page.reload();
  await ready(page);
}

export interface BootOptions {
  /** Cancella il salvataggio e riparte da un primo avvio pulito (default true). */
  fresh?: boolean;
  /** Lingua forzata all'avvio (?lang=…). */
  lang?: 'it' | 'en';
}

/** Apre il gioco (baseURL ha già ?debug=1) e, se chiesto, riparte da un salvataggio vuoto. */
export async function openGame(page: Page, opts: BootOptions = {}): Promise<void> {
  const query = opts.lang ? `&lang=${opts.lang}` : '';
  await page.goto(query ? `./?debug=1${query}` : '');
  await ready(page);
  if (opts.fresh !== false) {
    await call(page, 'core.wipe');
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch {
        /* storage non disponibile */
      }
    });
    await reload(page);
  }
}

/** Ripete `fn` finché restituisce true (o scade il tempo). */
export async function until(page: Page, fn: () => Promise<boolean>, ms = 15_000, every = 80): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await page.waitForTimeout(every);
  }
  return fn();
}

export const scene = (page: Page): Promise<string | null> => call<string | null>(page, 'core.scene');
export const phase = (page: Page): Promise<string | null> => call<string | null>(page, 'campaign.phase');

export async function waitScene(page: Page, id: string, ms = 15_000): Promise<boolean> {
  return until(page, async () => (await scene(page)) === id, ms);
}

export async function waitPhase(page: Page, id: string, ms = 15_000): Promise<boolean> {
  return until(page, async () => (await phase(page)) === id, ms);
}

/** La scena tombolo è aperta e la notte è attiva (prima di autoplay, ARCHITETTURA 15.1). */
export async function waitNight(page: Page, ms = 20_000): Promise<boolean> {
  return until(page, async () => (await scene(page)) === 'tombolo' && !!(await call<Rec>(page, 'night.state')).active, ms);
}

export interface NightOutcomeLite {
  levelId?: string;
  metrics?: { incroci?: number; quiete?: number; simmetria?: boolean; filoDOro?: boolean };
  rows?: { hour: number; crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[];
  spartito?: string;
  goals?: { status: string }[];
  timeline?: { pos: string[] }[];
  archive?: { named: boolean; mended: boolean };
}

/** Stato della notte (`__GAME__.night.state()`), con i campi usati dai test. */
export interface NightState {
  active: boolean;
  levelId: string;
  mode: string;
  origin: string;
  hour: number;
  done: boolean;
  completed: boolean;
  /** Esito della notte (NightOutcome) quando è finita, altrimenti null. */
  outcome: null | NightOutcomeLite;
  rows: { hour: number; crossings: { pair: number; over: 'L' | 'R'; forced?: boolean }[] }[];
  draft: { pair: number; over: 'L' | 'R' }[];
  positions: string[];
  timeline: { hour: number; pos: string[]; holders?: Record<string, string>; delivered?: string[] }[];
  requests: { noteId: string; status: string; dropped: boolean }[];
  goals: { status: string }[] | unknown;
  dropped: string[];
  lastViolation: { code: string } | null;
  message: { key: string; text: string } | null;
  margin: { current: string | null; shown: string[] };
  archive: null | { names: Record<string, string | null>; confirmed: string[]; counter: { correct: number }; named: boolean; mended: boolean; holes: unknown };
  layout: string;
}

export const nightState = (page: Page): Promise<NightState> => call<NightState>(page, 'night.state');

/** Limita un test a certi progetti (ARCHITETTURA 15.2: `desktop-hd` è solo per gli screenshot). */
export function onlyProjects(testInfo: TestInfo, ...names: string[]): void {
  base.skip(!names.includes(testInfo.project.name), `solo su ${names.join(', ')}`);
}

/** Tutti i progetti tranne quelli solo da screenshot. */
export const PLAY_PROJECTS = ['desktop', 'iphone', 'android-piccolo', 'ipad-orizzontale'] as const;

export interface Game {
  page: Page;
  errors: string[];
  net: NetworkLog;
  /** Nessun errore in console e nessuna richiesta esterna fino a questo punto. */
  expectClean(): void;
}

/**
 * `test` con la fixture `game`: rete sorvegliata ed errori raccolti dal primo
 * istante, gioco aperto da un salvataggio vuoto (`fresh`).
 */
export const test = base.extend<{ game: Game; fresh: boolean; lang: 'it' | 'en' | undefined }>({
  fresh: [true, { option: true }],
  lang: [undefined, { option: true }],
  game: async ({ page, fresh, lang }, use) => {
    const net = await guardNetwork(page.context());
    const errors = captureErrors(page);
    await openGame(page, { fresh, ...(lang ? { lang } : {}) });
    const game: Game = {
      page,
      errors,
      net,
      expectClean() {
        expect(errors, 'errori in console').toEqual([]);
        expect(net.external, 'richieste fuori da localhost').toEqual([]);
      },
    };
    await use(game);
  },
});
