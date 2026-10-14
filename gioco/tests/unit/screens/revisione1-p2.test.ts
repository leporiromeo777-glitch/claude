// @vitest-environment happy-dom
/**
 * Revisione 1, gruppo schermi, P2:
 * - SCH-10: titolo al primo avvio con le modalità chiuse, ombra di scorrimento;
 * - SCH-11: data della condivisione con Intl, PNG con il cartiglio, «Condividi il seme»;
 * - SCH-12: testi per stato e modalità (giorno già tessuto, ricomincio senza richieste);
 * - SCH-15: dopo il finale vero, il filo corallo e la stella accanto a Telaio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rendered: unknown[][] = [];
vi.mock('../../../src/tombolo/index', async (orig) => {
  const real = await orig<typeof import('../../../src/tombolo/index')>();
  return {
    ...real,
    renderLacePng: vi.fn(async (...args: unknown[]) => {
      rendered.push(args);
      return new Blob(['png'], { type: 'image/png' });
    }),
  };
});

import type { NightOutcome, SaveData, Viewport } from '../../../src/core/types';
import { createContext, dailySpec, generate, metrics, simulate, solve } from '../../../src/engine/index';
import { dateTag, shareParams, shortDate } from '../../../src/screens/daily';
import { captionOf, resultsSheet, seedShareText } from '../../../src/screens/results';
import { liberoSpec } from '../../../src/screens/libero';
import { pausePanel } from '../../../src/screens/pausePanel';
import { GiornalieroScene } from '../../../src/screens/GiornalieroScene';
import { TitoloScene } from '../../../src/screens/TitoloScene';
import { drawCoralThread } from '../../../src/screens/titleArt';
import { resetScreensState, setTodayOverride, type ResultInfo } from '../../../src/screens/state';
import { makeServices } from './helpers';

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, test: string): T | null => root.querySelector<T>(`[data-test="${test}"]`);

function resultOf(origin: 'giornaliero' | 'libero', spec = origin === 'giornaliero' ? dailySpec('2026-10-18') : liberoSpec('gdjm8dc', ['senzaDisfa', 'notteCorta'])): ResultInfo {
  const gen = generate(spec);
  const level = gen.level;
  const ctx = createContext(level, {});
  const rows = solve({ level, ctx, goals: level.goals ?? [] }).rows ?? [];
  const sim = simulate(level, ctx, rows);
  const m = metrics(level, sim.rows, gen.min, false);
  const outcome: NightOutcome = {
    origin, levelId: level.id, rows: sim.rows, timeline: sim.timeline, events: sim.events, goals: [], requests: [], dropped: [],
    metrics: m, spartito: 'TRAMA1-L-abc', hintsUsed: 0, fantasmaUsed: false, discoveredQuirks: [], nomeOn: null,
  };
  return { origin, level, outcome, metrics: m, min: gen.min, flags: {}, improved: true, gradi: origin === 'libero' ? ['senzaDisfa', 'notteCorta'] : [], returnTo: origin };
}

describe('SCH-11: condivisione', () => {
  beforeEach(() => {
    resetScreensState();
    rendered.length = 0;
    document.body.replaceChildren();
  });

  it('data nel formato della lingua (Intl): en-US «10/18», it «18/10»', () => {
    expect(shortDate('2026-10-18', 'en-US')).toBe('10/18');
    expect(shortDate('2026-10-18', 'it-IT')).toBe('18/10');
    expect(shortDate('2026-10-18', 'en-GB')).toBe('18/10');
    expect(dateTag('en', ['en-US', 'it-IT'])).toBe('en-US');
    expect(dateTag('en', ['it-IT'])).toBe('en-GB');
    expect(dateTag('it', ['en-US', 'it-CH'])).toBe('it-CH');
    expect(shareParams({ date: '2026-10-18', incroci: 7, min: 7, quiete: 1, simmetria: false }, 'en-US').data).toBe('10/18');
  });

  it('il PNG ha il cartiglio: TRAMA, data, incroci e minimo', async () => {
    const h = makeServices();
    const info = resultOf('giornaliero');
    const cap = captionOf(h.s, info);
    expect(cap.titolo).toBe('TRAMA');
    expect(cap.sottotitolo).toMatch(/Merletto del giorno · Domenica 18 ottobre/);
    expect(cap.riga).toBe(`${info.metrics.incroci} incroci · minimo ${info.min}`);
    const view = resultsSheet(h.s, info, { onAgain: () => undefined, onBack: () => undefined });
    await tick(5);
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.[3]).toEqual(cap);
    view.destroy();
  });

  it('nel libero «Condividi il seme» con seme, gradi, incroci e spartito', async () => {
    const h = makeServices();
    const info = resultOf('libero');
    const text = seedShareText(h.s, info);
    expect(text).toContain('seme gdjm8dc');
    expect(text).toContain('Senza Disfa, Notte corta');
    expect(text.split('\n')[1]).toBe('TRAMA1-L-abc');
    const view = resultsSheet(h.s, info, { onAgain: () => undefined, onBack: () => undefined });
    document.body.append(view.el, view.foot);
    const b = q<HTMLButtonElement>(view.el, 'sc-libero-condividi-seme');
    expect(b?.textContent).toContain('Condividi il seme');
    b?.click();
    await tick(10);
    expect(h.calls.copied.at(-1)).toBe(text);
    expect(captionOf(h.s, info).sottotitolo).toBe('Merletto libero · seme gdjm8dc');
    // Nel Merletto del giorno il pulsante non c'è.
    const day = resultsSheet(h.s, resultOf('giornaliero'), { onAgain: () => undefined, onBack: () => undefined });
    expect(q(day.el, 'sc-libero-condividi-seme')).toBeNull();
    day.destroy();
    view.destroy();
  });
});

describe('SCH-12: testi per stato e modalità', () => {
  beforeEach(() => {
    resetScreensState();
    document.body.replaceChildren();
  });
  afterEach(() => setTodayOverride(null));

  const UNLOCKED = { daily: true, libero: true, gradi: false, cosmetics: [], tovaglia: false };
  async function daily(record: { incroci: number; min: number } | null): Promise<GiornalieroScene> {
    const d: Partial<SaveData> = { unlocks: UNLOCKED };
    if (record) d.daily = { '2026-10-18': { date: '2026-10-18', incroci: record.incroci, min: record.min, quiete: 0, simmetria: false, spartito: '' } };
    const h = makeServices({ save: d });
    setTodayOverride('2026-10-18');
    const scene = new GiornalieroScene(h.s);
    scene.enter();
    for (let i = 0; i < 100 && q(document.body, 'sc-giornaliero-stato')?.dataset.stato !== 'pronto'; i++) await tick(10);
    return scene;
  }

  it('giorno già tessuto con il minimo: «Tessuto oggi: 7 incroci, già il minimo» e «Tessilo di nuovo»', async () => {
    const scene = await daily({ incroci: 7, min: 7 });
    expect(q(document.body, 'sc-giornaliero-stato')?.textContent).toBe('Tessuto oggi: 7 incroci, già il minimo.');
    expect(q(document.body, 'sc-giornaliero-tessi')?.textContent).toContain('Tessilo di nuovo');
    scene.exit();
  });

  it('giorno già tessuto sopra il minimo: il record da battere', async () => {
    const scene = await daily({ incroci: 9, min: 7 });
    expect(q(document.body, 'sc-giornaliero-stato')?.textContent).toBe('Tessuto oggi: 9 incroci. Il minimo è 7: si può fare meglio.');
    expect(q(document.body, 'sc-giornaliero-tessi')?.textContent).toContain('Ritessi per il record');
    scene.exit();
  });

  it('giorno non ancora tessuto: «pronto»', async () => {
    const scene = await daily(null);
    expect(q(document.body, 'sc-giornaliero-stato')?.textContent).toContain('pronto');
    scene.exit();
  });

  it('ricomincio senza richieste: il testo non le cita; nella campagna sì', async () => {
    const h = makeServices();
    const bodies: (string | undefined)[] = [];
    h.s.ui.confirm = async (c) => {
      bodies.push(c.bodyKey);
      return false;
    };
    const box = document.createElement('div');
    let p = pausePanel(h.s, box, { from: 'tombolo', origin: 'libero', levelId: 'lib-x' });
    q<HTMLButtonElement>(box, 'sc-pausa-ricomincia')?.click();
    await tick(5);
    p.destroy();
    p = pausePanel(h.s, box, { from: 'tombolo', origin: 'campagna', levelId: 'g03' });
    q<HTMLButtonElement>(box, 'sc-pausa-ricomincia')?.click();
    await tick(5);
    p.destroy();
    expect(bodies).toEqual(['ui.pausa.ricominciaDomanda.corpoSenzaRichieste', 'ui.pausa.ricominciaDomanda.corpo']);
    expect(h.s.i18n.t('ui.pausa.ricominciaDomanda.corpoSenzaRichieste')).not.toMatch(/richiest/);
  });
});

const VP: Viewport = { cssW: 360, cssH: 640, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 }, orientation: 'portrait', layout: 'stretto', textScale: 1 };

describe('SCH-10 e SCH-15: titolo', () => {
  let scene: TitoloScene | null = null;
  afterEach(() => {
    scene?.exit();
    scene = null;
    document.body.innerHTML = '';
  });

  function enter(tovaglia: boolean, extra: Partial<SaveData> = {}): TitoloScene {
    const h = makeServices({ save: { unlocks: { daily: false, libero: false, gradi: false, cosmetics: [], tovaglia }, ...extra }, registered: ['titolo', 'giornaliero', 'libero', 'impostazioni', 'crediti', 'tombolo', 'telaio'] });
    const s = Object.assign(h.s, {
      viewport: { get: () => VP },
      input: { lastDevice: () => 'touch' },
      assets: { frame: () => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 96, sh: 320, ax: 0.5, ay: 0.125, placeholder: true }), has: () => false },
    });
    scene = new TitoloScene(s);
    scene.enter();
    return scene;
  }

  it('primo avvio: le modalità chiuse si vedono col lucchetto e la condizione', () => {
    enter(false);
    const modi = q(document.body, 'sc-titolo-modi') as HTMLElement;
    expect(q(modi, 'sc-titolo-giornaliero')?.textContent).toMatch(/Dopo la giornata\s7/);
    expect(q(modi, 'sc-titolo-giornaliero')?.dataset.bloccato).toBe('1');
    expect(q(modi, 'sc-titolo-libero')?.textContent).toMatch(/Dopo la giornata\s8/);
    expect(q(document.body, 'sc-titolo-nuova')?.textContent).toContain('Tocca per iniziare');
    // L'ombra di scorrimento c'è (si accende quando il menu scorre).
    expect(q(document.body, 'sc-titolo-ombra')).not.toBeNull();
    expect(q(document.body, 'sc-titolo-menu')?.dataset.scorre).toBe('no');
  });

  it('finale vero: la stella accanto a Telaio e il filo corallo nel quadro; senza, niente', () => {
    const story = { campaign: { history: { g00: {} } } as unknown as SaveData['campaign'], stats: { playMs: 1, nights: 1, goldThreads: 0, dailyStreak: 0 } };
    let t = enter(true, story);
    expect(q(document.body, 'sc-titolo-telaio-stella')).not.toBeNull();
    expect((t as unknown as { art: { trueEnding: boolean } }).art.trueEnding).toBe(true);
    t.exit();
    scene = null;
    document.body.innerHTML = '';
    t = enter(false, story);
    expect(q(document.body, 'sc-titolo-telaio-stella')).toBeNull();
    expect((t as unknown as { art: { trueEnding: boolean } }).art.trueEnding).toBe(false);
  });

  it('il filo corallo si disegna solo sopra il tombolo (source-atop), con due spilli', () => {
    const ops: string[] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (_t, k) => (k === 'save' || k === 'restore' || k === 'beginPath' || k === 'moveTo' || k === 'bezierCurveTo' || k === 'stroke' || k === 'arc' || k === 'fill' ? (..._a: unknown[]) => ops.push(String(k)) : undefined),
      set: (_t, k, v) => {
        ops.push(`${String(k)}=${String(v)}`);
        return true;
      },
    });
    drawCoralThread(ctx as unknown as CanvasRenderingContext2D, 500, '#F07C6C');
    expect(ops).toContain('globalCompositeOperation=source-atop');
    expect(ops).toContain('strokeStyle=#F07C6C');
    expect(ops.filter((o) => o === 'arc').length).toBe(4);
  });
});
