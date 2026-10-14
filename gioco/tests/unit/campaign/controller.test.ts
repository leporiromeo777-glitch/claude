// @vitest-environment happy-dom
/**
 * Il controller della campagna sul bus (senza il tombolo vero): notti facoltative
 * lasciate a metà, notti da riprendere con "Continua", stranezze scoperte fuori dalla
 * storia, comandi della scena 'sera'.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEventMap, NightOutcome, NightParams, SaveData, Services } from '../../../src/core/types';
import { createBus } from '../../../src/core/events';
import { CampaignControllerImpl } from '../../../src/campaign/controller';
import { finalParams, newCampaign, rereadParams } from '../../../src/campaign/flow';
import type { CampaignStateX } from '../../../src/campaign/types';
import { setActiveNight } from '../../../src/tombolo/active';
import { db, emptySave, playNight } from './helpers';

const flowFinalParams = (d: SaveData): NightParams => finalParams(d, db());

function setup(): { ctl: CampaignControllerImpl; d: SaveData; bus: ReturnType<typeof createBus<GameEventMap>>; go: ReturnType<typeof vi.fn> } {
  const d = emptySave();
  const bus = createBus<GameEventMap>();
  const go = vi.fn(async () => undefined);
  const s = {
    bus,
    content: db(),
    save: { data: () => d, update: (mut: (x: SaveData) => void) => mut(d) },
    scenes: { go, current: () => 'tombolo', has: () => true },
    audio: { setMusic: vi.fn(), setAmbience: vi.fn() },
    ui: { toast: vi.fn() },
    settings: { get: () => ({ animSpeed: 1 }) },
  } as unknown as Services;
  const ctl = new CampaignControllerImpl(() => s);
  ctl.install();
  return { ctl, d, bus, go };
}

function savedNight(d: SaveData, origin: NightParams['origin'], levelId: string, mode: NightParams['mode'] = 'normale'): void {
  d.night = {
    origin,
    params: { origin, mode, levelId, flags: {}, accepted: [], goals: [], needsNome: false },
    resume: { levelId, rows: [], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false },
  };
}

describe('controller: notti lasciate a metà', () => {
  it('Rigioca lasciato (Torna al titolo) si abbandona; la notte della storia resta da riprendere', () => {
    const { d, bus } = setup();
    newCampaign(d, db());
    savedNight(d, 'telaio', 'g00');
    bus.emit('night:exit', { origin: 'telaio' });
    expect(d.night).toBeNull();
    savedNight(d, 'campagna', 'g00');
    bus.emit('night:exit', { origin: 'campagna' });
    expect(d.night?.origin).toBe('campagna');
  });

  it('un merletto d’Archivio aperto dalla cassapanca si abbandona; nella fase d’Archivio resta', () => {
    const { d, bus } = setup();
    newCampaign(d, db());
    savedNight(d, 'archivio', 'arc1', 'archivio');
    bus.emit('night:exit', { origin: 'archivio' });
    expect(d.night).toBeNull();
    (d.campaign as CampaignStateX).phase = 'archivio';
    savedNight(d, 'archivio', 'arc1', 'archivio');
    bus.emit('night:exit', { origin: 'archivio' });
    expect(d.night?.origin).toBe('archivio');
  });

  it('"Continua" riprende prima una notte d’Archivio o del Telaio rimasta salvata (app chiusa a metà)', async () => {
    const { ctl, d } = setup();
    newCampaign(d, db());
    savedNight(d, 'archivio', 'arc1', 'archivio');
    const r = await ctl.prepare({ cmd: 'continua' });
    expect(r && 'night' in r ? r.night.origin : null).toBe('archivio');
    expect(r && 'night' in r ? r.night.level.id : null).toBe('arc1');
    d.night = null;
    const r2 = await ctl.prepare({ cmd: 'continua' });
    expect(r2).toEqual({ scene: 'sera' });
  });
});

describe('controller: stranezze scoperte', () => {
  it('nel Merletto del giorno non entrano nel Taccuino; nella notte della storia sì', () => {
    const { d, bus } = setup();
    newCampaign(d, db());
    savedNight(d, 'giornaliero', 'day-2026-10-14');
    bus.emit('quirk:discovered', { quirk: 'lunardiCura', thread: 'lunardi' });
    expect(d.knowledge.quirks).not.toContain('lunardiCura');
    expect(d.knowledge.diary).not.toContain('persone.lunardi.cura');
    savedNight(d, 'campagna', 'g00');
    bus.emit('quirk:discovered', { quirk: 'martaNoSotto', thread: 'marta' });
    expect(d.knowledge.quirks).toContain('martaNoSotto');
    expect(d.knowledge.diary).toContain('persone.marta.noSotto');
  });
});

describe('revisione 1: controller', () => {
  function setup2(scene = 'tombolo') {
    const d = emptySave();
    const bus = createBus<GameEventMap>();
    const go = vi.fn(async () => undefined);
    const toast = vi.fn();
    const root = document.createElement('div');
    document.body.appendChild(root);
    let current = scene;
    const s = {
      bus,
      content: db(),
      save: { data: () => d, update: (mut: (x: SaveData) => void) => mut(d) },
      scenes: { go, current: () => current, has: () => true },
      audio: { setMusic: vi.fn(), setAmbience: vi.fn() },
      ui: { toast, root },
      i18n: { t: (k: string) => k },
      settings: { get: () => ({ animSpeed: 0 }) },
      viewport: { get: () => ({ layout: 'stretto' }) },
    } as unknown as Services;
    const ctl = new CampaignControllerImpl(() => s);
    ctl.install();
    return { ctl, d, bus, go, toast, root, setScene: (id: string) => (current = id) };
  }

  afterEach(() => {
    setActiveNight(null);
    vi.useRealTimers();
  });

  it('«Lascia per ora» (C10): la notte d’Archivio salvata si toglie, l’Archivio resta', () => {
    const { ctl, d } = setup2();
    newCampaign(d, db());
    d.knowledge.archive['arc1'] = 'nuovo';
    savedNight(d, 'archivio', 'arc1', 'archivio');
    expect(ctl.leaveArchive('arc2')).toBe(false);
    expect(d.night?.origin).toBe('archivio');
    expect(ctl.leaveArchive('arc1')).toBe(true);
    expect(d.night).toBeNull();
    expect(d.knowledge.archive['arc1']).toBe('nuovo');
  });

  it('Rileggi: il merletto finito resta con «Alla cassapanca», niente record né cambi d’Archivio', async () => {
    vi.useFakeTimers();
    const { d, bus, root, go } = setup2();
    newCampaign(d, db());
    d.knowledge.archive['arc1'] = 'rammendato';
    const p = rereadParams(db(), 'arc1');
    const outcome = { origin: 'archivio', levelId: 'arc1', rows: [], timeline: [], events: [], goals: [], requests: [], dropped: [], metrics: { incroci: 3, minIncroci: 3, quiete: 0, simmetria: false, filoDOro: true }, spartito: '', hintsUsed: 0, fantasmaUsed: false, discoveredQuirks: [], nomeOn: null } as NightOutcome;
    setActiveNight({ params: p, completed: outcome } as never);
    bus.emit('night:complete', { outcome });
    await vi.advanceTimersByTimeAsync(10);
    expect(d.records['arc1']).toBeUndefined();
    expect(d.knowledge.archive['arc1']).toBe('rammendato');
    const b = root.querySelector<HTMLButtonElement>('[data-test="cp-rileggi-chiudi"]');
    expect(b).not.toBeNull();
    b?.click();
    expect(go).toHaveBeenCalledWith('archivio', { browse: true });
  });

  it('finali: A, B e D restano con «Continua»; C passa subito al cartello nero', async () => {
    vi.useFakeTimers();
    const { ctl, d, bus, root, go } = setup2();
    newCampaign(d, db());
    await ctl.goto('fin_merlettaia').catch(() => undefined);
    const p = flowFinalParams(d);
    const o = playNight(d);
    setActiveNight({ params: p, completed: o } as never);
    go.mockClear();
    bus.emit('night:complete', { outcome: { ...o, origin: 'campagna' } });
    await vi.advanceTimersByTimeAsync(5000);
    expect(go).not.toHaveBeenCalledWith('finale', expect.anything());
    const cont = root.querySelector<HTMLButtonElement>('[data-test="cp-finale-continua"]');
    expect(cont).not.toBeNull();
    cont?.click();
    expect(go).toHaveBeenCalledWith('finale', { mode: 'epilogo', ending: 'merlettaia' });

    await ctl.goto('fin_chiuso').catch(() => undefined);
    const pc = flowFinalParams(d);
    const oc = playNight(d);
    setActiveNight({ params: pc, completed: oc } as never);
    go.mockClear();
    bus.emit('night:complete', { outcome: { ...oc, origin: 'campagna' } });
    await vi.advanceTimersByTimeAsync(10);
    expect(go).toHaveBeenCalledWith('finale', { mode: 'chiuso', ending: 'chiuso' });
  });

  it('gli avvisi del Taccuino aspettano la fine dell’alba (D11)', async () => {
    vi.useFakeTimers();
    const { ctl, d, toast, setScene } = setup2('alba');
    newCampaign(d, db());
    ctl.notice('x.voce');
    expect(toast).not.toHaveBeenCalled();
    setScene('bilancio');
    ctl.flushNotices();
    expect(toast).toHaveBeenCalledWith('x.voce', undefined, 'info');
  });
});
