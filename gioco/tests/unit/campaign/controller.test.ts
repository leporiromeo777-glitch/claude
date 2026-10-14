// @vitest-environment happy-dom
/**
 * Il controller della campagna sul bus (senza il tombolo vero): notti facoltative
 * lasciate a metà, notti da riprendere con "Continua", stranezze scoperte fuori dalla
 * storia, comandi della scena 'sera'.
 */
import { describe, expect, it, vi } from 'vitest';
import type { GameEventMap, NightParams, SaveData, Services } from '../../../src/core/types';
import { createBus } from '../../../src/core/events';
import { CampaignControllerImpl } from '../../../src/campaign/controller';
import { newCampaign } from '../../../src/campaign/flow';
import type { CampaignStateX } from '../../../src/campaign/types';
import { db, emptySave } from './helpers';

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
