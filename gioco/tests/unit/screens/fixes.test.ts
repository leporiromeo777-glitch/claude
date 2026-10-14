// @vitest-environment happy-dom
/**
 * Casi limite trovati nella verifica del pacchetto:
 *
 * - i risultati non si aprono sotto un overlay (la Pausa aperta subito dopo
 *   l'ultima riga): si aspetta che il giocatore lo chiuda;
 * - uno spartito ritessuto non si porta via la notte lasciata a metà;
 * - un seme scritto male non fa partire il merletto del seme di prima;
 * - fusi intagliati: sblocchi del Merletto del giorno e scelta nelle Impostazioni;
 * - condivisione: dove il foglio di sistema non c'è, testo copiato e PNG
 *   scaricato; dove c'è ma non va, solo il testo copiato.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LevelDef, NightOutcome, SaveData } from '../../../src/core/types';
import { createContext, dailySpec, generate, metrics, simulate, solve } from '../../../src/engine/index';
import { setActiveNight } from '../../../src/tombolo/active';
import type { NightController } from '../../../src/tombolo/controller';
import { installOutcomeListener } from '../../../src/screens/outcomes';
import { guardNight, guardedNight, rememberLaunch, resetScreensState, restoreGuardedNight, type ResultInfo } from '../../../src/screens/state';
import { LiberoScene, setLiberoChoice } from '../../../src/screens/LiberoScene';
import { availableCosmetics, dailyCosmetics, selectCosmetic } from '../../../src/screens/cosmetics';
import { buildSettingsPanel } from '../../../src/screens/settingsPanel';
import { shareResult } from '../../../src/screens/results';
import { makeServices } from './helpers';

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, test: string): T | null => root.querySelector<T>(`[data-test="${test}"]`);

function dailyOutcome(date = '2026-10-17'): { level: LevelDef; outcome: NightOutcome; min: number } {
  const gen = generate(dailySpec(date));
  const level = gen.level;
  const ctx = createContext(level, {});
  const rows = solve({ level, ctx, goals: level.goals ?? [] }).rows ?? [];
  const sim = simulate(level, ctx, rows);
  const outcome: NightOutcome = {
    origin: 'giornaliero', levelId: level.id, rows: sim.rows, timeline: sim.timeline, events: sim.events, goals: [], requests: [], dropped: [],
    metrics: metrics(level, sim.rows, gen.min, false), spartito: 'TRAMA1-x', hintsUsed: 0, fantasmaUsed: false, discoveredQuirks: [], nomeOn: null,
  };
  return { level, outcome, min: gen.min };
}

const HALF_NIGHT: NonNullable<SaveData['night']> = {
  origin: 'campagna',
  params: { origin: 'campagna', mode: 'normale', flags: { x: true }, accepted: [], goals: [], needsNome: false, levelId: 'g03' },
  resume: { rows: [{ hour: 6, crossings: [{ pair: 0, over: 'L' }] }], draft: [], hintsUsed: 0, fantasmaUsed: false, dropped: [], nomeOn: null } as unknown as NonNullable<SaveData['night']>['resume'],
};

describe('risultati e overlay', () => {
  beforeEach(() => resetScreensState());
  afterEach(() => setActiveNight(null));

  it('con la Pausa aperta i risultati aspettano che si chiuda', async () => {
    const h = makeServices();
    const { level, outcome, min } = dailyOutcome();
    rememberLaunch({ level, min, origin: 'giornaliero', gradi: [], flags: {}, returnTo: 'giornaliero' });
    h.current.id = 'tombolo';
    setActiveNight({ completed: outcome, params: { origin: 'giornaliero', level } } as unknown as NightController);
    let open = ['pausa'];
    (h.s.ui as unknown as { overlays: () => string[] }).overlays = () => open;
    const off = installOutcomeListener(h.s, { delay: () => tick(1), pollMs: 2 });
    h.s.bus.emit('night:complete', { outcome });
    await tick(40);
    expect(h.calls.scenes).toEqual([]);
    open = [];
    await tick(40);
    expect(h.calls.scenes).toEqual([{ id: 'giornaliero', params: { risultato: 'giornaliero' } }]);
    off();
  });

  it('se dalla Pausa si torna al titolo, i risultati non si aprono (ma il record è salvato)', async () => {
    const h = makeServices();
    const { level, outcome, min } = dailyOutcome();
    rememberLaunch({ level, min, origin: 'giornaliero', gradi: [], flags: {}, returnTo: 'giornaliero' });
    h.current.id = 'tombolo';
    setActiveNight({ completed: outcome, params: { origin: 'giornaliero', level } } as unknown as NightController);
    (h.s.ui as unknown as { overlays: () => string[] }).overlays = () => ['pausa'];
    const off = installOutcomeListener(h.s, { delay: () => tick(1), pollMs: 2 });
    h.s.bus.emit('night:complete', { outcome });
    await tick(30);
    h.current.id = 'titolo';
    await tick(30);
    expect(h.calls.scenes).toEqual([]);
    expect(h.s.save.data().daily['2026-10-17']?.incroci).toBe(outcome.metrics.incroci);
    off();
  });
});

describe('spartito e notte lasciata a metà', () => {
  beforeEach(() => resetScreensState());

  it('la notte custodita torna se lo slot si è svuotato, e la custodia finisce', () => {
    const h = makeServices();
    h.s.save.data().night = JSON.parse(JSON.stringify(HALF_NIGHT));
    guardNight(h.s.save.data().night);
    // Il tombolo in modo replay, a fine merletto, toglie lo slot.
    h.s.save.data().night = null;
    expect(restoreGuardedNight(h.s)).toBe(true);
    expect(h.s.save.data().night).toEqual(HALF_NIGHT);
    expect(guardedNight()).toBeNull();
    // Una seconda volta non rimette niente (la custodia è finita).
    h.s.save.data().night = null;
    expect(restoreGuardedNight(h.s)).toBe(false);
    expect(h.s.save.data().night).toBeNull();
  });

  it('se lo slot è ancora occupato non si tocca', () => {
    const h = makeServices();
    guardNight(HALF_NIGHT);
    const other = { ...HALF_NIGHT, origin: 'giornaliero' as const };
    h.s.save.data().night = other;
    expect(restoreGuardedNight(h.s)).toBe(false);
    expect(h.s.save.data().night).toBe(other);
    expect(guardedNight()).toBeNull();
  });

  it('entrando in un’altra scena dopo lo spartito la notte torna', () => {
    const h = makeServices();
    const off = installOutcomeListener(h.s);
    guardNight(HALF_NIGHT);
    h.s.save.data().night = null;
    h.s.bus.emit('scene:enter', { id: 'tombolo' });
    expect(h.s.save.data().night).toBeNull();
    h.s.bus.emit('scene:enter', { id: 'titolo' });
    expect(h.s.save.data().night).toEqual(HALF_NIGHT);
    off();
  });
});

describe('Merletto libero: seme scritto male', () => {
  beforeEach(() => {
    resetScreensState();
    document.body.innerHTML = '';
  });

  it('Tessi e Invio non partono con il seme di prima', async () => {
    const h = makeServices({ save: { unlocks: { daily: true, libero: true, gradi: false, cosmetics: [], tovaglia: false } } });
    setLiberoChoice({ seed: 'mabc123', gradi: [] });
    const scene = new LiberoScene(h.s);
    scene.enter();
    const field = q<HTMLInputElement>(document.body, 'sc-libero-seme');
    expect(field?.value).toBe('mabc123');
    if (!field) return;
    field.value = 'zz!!';
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(await scene.weave(false)).toBe(false);
    await tick(20);
    expect(h.calls.scenes).toEqual([]);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(q(document.body, 'sc-libero-messaggio')?.textContent).toBe(h.s.i18n.t('ui.libero.semeNonValido'));
    // Il campo non torna da solo al seme di prima.
    field.dispatchEvent(new Event('blur'));
    expect(field.value).toBe('zz!!');
    // Corretto, si può tessere.
    field.value = 'gk2';
    field.dispatchEvent(new Event('input'));
    expect(field.hasAttribute('aria-invalid')).toBe(false);
    scene.exit();
  });
});

describe('fusi intagliati', () => {
  it('Merletto del giorno: 7 giorni di fila e 30 in tutto (GDD 7)', () => {
    const h = makeServices();
    const d = h.s.save.data();
    d.stats.dailyStreak = 6;
    expect(dailyCosmetics(d)).toEqual([]);
    d.stats.dailyStreak = 7;
    expect(dailyCosmetics(d)).toEqual(['stile_5']);
    expect(dailyCosmetics(d)).toEqual([]);
    for (let i = 1; i <= 30; i++) d.daily[`2026-09-${String(i).padStart(2, '0')}`] = { date: '', incroci: 1, min: 1, quiete: 0, simmetria: false, spartito: '' };
    expect(dailyCosmetics(d)).toEqual(['stile_6']);
    expect(d.unlocks.cosmetics).toEqual(['stile_5', 'stile_6']);
  });

  it('nelle Impostazioni si sceglie fra quelli sbloccati e disegnati', () => {
    const h = makeServices({ save: { unlocks: { daily: true, libero: true, gradi: true, cosmetics: ['stile_1', 'stile_2', 'stile_5'], tovaglia: false } } });
    const drawn = new Set(['fuso/ada', 'fuso/stile_1', 'fuso/stile_2']);
    Object.assign(h.s, { assets: { has: (n: string) => drawn.has(n), frame: () => { throw new Error('no canvas'); } } });
    expect(availableCosmetics(h.s)).toEqual(['stile_1', 'stile_2']);
    const p = buildSettingsPanel(h.s, { overlay: false });
    document.body.appendChild(p.el);
    expect(q(p.el, 'sc-impostazioni-fuso-stile_5')).toBeNull();
    q<HTMLButtonElement>(p.el, 'sc-impostazioni-fuso-stile_2')?.click();
    expect(h.s.save.data().unlocks.selectedCosmetic).toBe('stile_2');
    q<HTMLButtonElement>(p.el, 'sc-impostazioni-fuso-ada')?.click();
    expect(h.s.save.data().unlocks.selectedCosmetic).toBeUndefined();
    p.destroy();
    // Sopra la notte (overlay) la scelta non c'è.
    const o = buildSettingsPanel(h.s, { overlay: true });
    expect(q(o.el, 'sc-impostazioni-fusi')).toBeNull();
    o.destroy();
    // Senza fusi sbloccati la sezione non c'è.
    const none = makeServices();
    const p2 = buildSettingsPanel(none.s, { overlay: false });
    expect(q(p2.el, 'sc-impostazioni-fusi')).toBeNull();
    p2.destroy();
    selectCosmetic(h.s, 'stile_1');
    expect(h.s.save.data().unlocks.selectedCosmetic).toBe('stile_1');
  });
});

describe('condividere', () => {
  function info(): ResultInfo {
    const { level, outcome, min } = dailyOutcome('2026-10-16');
    return { origin: 'giornaliero', level, outcome, metrics: outcome.metrics, min, flags: {}, improved: true, gradi: [], returnTo: 'giornaliero', shareText: 'TRAMA 16/10 · …\nTRAMA1-x' };
  }

  it('senza foglio di condivisione: il testo si copia (niente share)', async () => {
    const h = makeServices();
    const r = await shareResult(h.s, info(), Promise.resolve(null));
    expect(r).toBe('copiato');
    expect(h.calls.shared).toEqual([]);
    expect(h.calls.copied).toEqual(['TRAMA 16/10 · …\nTRAMA1-x']);
    expect(h.calls.toasts).toContain('ui.condividi.copiato');
  });

  it('con il foglio di sistema: condivide; se non va, copia soltanto', async () => {
    const h = makeServices();
    Object.assign(h.s.platform, { native: true });
    expect(await shareResult(h.s, info(), Promise.resolve(null))).toBe('condiviso');
    expect(h.calls.shared).toHaveLength(1);
    Object.assign(h.s.platform, { share: async () => false });
    expect(await shareResult(h.s, info(), Promise.resolve(new Blob(['x'], { type: 'image/png' })))).toBe('copiato');
    expect(h.calls.toasts.at(-1)).toBe('ui.condividi.copiato');
  });
});
