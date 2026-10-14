/**
 * Revisione 1, audio (gruppo schermi):
 * - SCH-06: nelle notti del Merletto del giorno, del libero e degli spartiti
 *   la musica passa allo stato 'notte' con il seme del livello e i personaggi
 *   presenti; con il motore vero `stats().music` vale 'notte';
 * - SCH-13 (C11, C12): `tombolo:nodo` suona il nodo e la campana dell'ora 3
 *   con stonatura 1, niente successo per un livello con chiusura 'nodo',
 *   `resolveStonatura` dà 1 per fin_chiuso anche dopo il finale vero;
 *   `tombolo:apparizione` suona il filo nero.
 */
import { describe, expect, it } from 'vitest';
import { createBus } from '../../../src/core/events';
import { emptyContentDB } from '../../../src/content/loader';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { defaultSettings } from '../../../src/core/settings';
import { AudioAutomation, NODO_BELL_HOUR, resolveStonatura, type AutomationTarget, type CaptionRef } from '../../../src/audio/automation';
import { WebAudioEngine } from '../../../src/audio/engine';
import { dailySpec, generate } from '../../../src/engine/index';
import type { CharacterId, GameEventMap, LevelDef, MusicState, NightOutcome, SaveData } from '../../../src/core/types';
import { FakeAudioContext, FakeTimers, seeded } from './fakeAudio';

type Played = { fn: string; detail?: string };

class Recorder implements AutomationTarget {
  out: Played[] = [];
  music: { s: MusicState; o?: unknown }[] = [];
  sfx(id: string): void {
    this.out.push({ fn: 'sfx', detail: id });
  }
  play(id: string, _o?: unknown, _c?: CaptionRef | null): void {
    this.out.push({ fn: 'play', detail: id });
  }
  crossing(): void {
    this.out.push({ fn: 'incrocio' });
  }
  bell(o: { hour: number; stonatura: number }): void {
    this.out.push({ fn: 'campana', detail: `${o.hour} s=${o.stonatura}` });
  }
  setMusic(s: MusicState, o?: unknown): void {
    this.music.push({ s, o });
  }
  dyad(): void {}
  caption(): void {}
  suspend(): void {}
  resume(): void {}
}

function lv(o: Partial<LevelDef> & Pick<LevelDef, 'id'>): LevelDef {
  return {
    kind: 'storia', act: 3, titleKey: 'x', columns: ['forno', 'piazza', 'chiesa'], startHour: 5, endHour: 8,
    threads: [
      { id: 'teresa', kind: 'persona', character: 'teresa' },
      { id: 'lino1', kind: 'lino' },
      { id: 'gino', kind: 'persona', character: 'gino' },
    ],
    initial: ['teresa', 'lino1', 'gino'], beads: [], rules: ['incrocio'], quirks: [], pins: [], matassa: 9,
    ...o,
  };
}

function setup(save: SaveData = defaultSaveData('t')) {
  const bus = createBus<GameEventMap>();
  const rec = new Recorder();
  const db = emptyContentDB();
  db.campaign.days = [{ id: 'g00', act: 0, pins: 0, stonatura: 1 }];
  const auto = new AudioAutomation({ bus, engine: rec, content: () => db, save: () => save, settings: () => defaultSettings(), nameOf: (w: CharacterId | 'lino') => w });
  auto.install();
  return { bus, rec, db };
}

const params = (level: LevelDef, origin: string, mode = 'normale') => ({ origin, mode, level, flags: {}, accepted: [], goals: [], needsNome: false });

function outcome(levelId: string, ok = true): NightOutcome {
  return {
    origin: 'campagna', levelId, rows: [], timeline: [], events: [], goals: [], requests: ok ? [] : [{ noteId: 'n', status: 'fallita' }], dropped: [],
    metrics: { incroci: 0, minIncroci: 0, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', hintsUsed: 0, fantasmaUsed: false, discoveredQuirks: [], nomeOn: null,
  };
}

describe('SCH-06: musica della notte nelle modalità extra', () => {
  it('giornaliero, libero e spartito: setMusic notte con il seme del livello e i personaggi presenti', () => {
    for (const origin of ['giornaliero', 'libero', 'spartito']) {
      const { bus, rec } = setup();
      const level = lv({ id: `x-${origin}`, musicSeed: '2026-10-14#4' });
      bus.emit('scene:enter', { id: 'tombolo', params: params(level, origin, origin === 'spartito' ? 'replay' : 'normale') });
      expect(rec.music).toEqual([{ s: 'notte', o: { seed: '2026-10-14#4', notes: ['teresa', 'lino', 'gino'] } }]);
    }
    // Senza musicSeed: l'id del livello.
    const { bus, rec } = setup();
    bus.emit('scene:enter', { id: 'tombolo', params: params(lv({ id: 'lib-abc' }), 'libero') });
    expect((rec.music[0]?.o as { seed: string }).seed).toBe('lib-abc');
  });

  it('la campagna e il Telaio no (la musica la chiedono loro)', () => {
    for (const origin of ['campagna', 'telaio', 'archivio']) {
      const { bus, rec } = setup();
      bus.emit('scene:enter', { id: 'tombolo', params: params(lv({ id: 'g05' }), origin) });
      expect(rec.music).toEqual([]);
    }
  });

  it('con il motore vero: stats().music vale notte durante la notte del giorno e del libero, e torna titolo', () => {
    const timers = new FakeTimers();
    const engine = new WebAudioEngine({
      createContext: () => new FakeAudioContext().asAudioContext(),
      now: () => 0, rand: seeded(1), timers, idle: () => undefined,
      caption: () => undefined, nameOf: (w) => w, styleOf: () => '', onBlocked: () => undefined, visible: () => true,
    });
    engine.unlock();
    const bus = createBus<GameEventMap>();
    const auto = new AudioAutomation({ bus, engine, content: () => emptyContentDB(), save: () => defaultSaveData('t'), settings: () => defaultSettings(), nameOf: (w) => w });
    auto.install();
    engine.setMusic('titolo');
    expect(engine.stats().music).toBe('titolo');
    const day = generate(dailySpec('2026-10-15')).level;
    bus.emit('scene:enter', { id: 'tombolo', params: params(day, 'giornaliero') });
    expect(engine.stats().music).toBe('notte');
    // I risultati (scena giornaliero) rimettono la musica del titolo.
    engine.setMusic('titolo');
    bus.emit('scene:enter', { id: 'giornaliero' });
    expect(engine.stats().music).toBe('titolo');
    bus.emit('scene:enter', { id: 'tombolo', params: params(lv({ id: 'lib-gdjm8dc' }), 'libero') });
    expect(engine.stats().music).toBe('notte');
  });
});

describe('SCH-13: audio del finale C (C11) e apparizione del filo nero (C12)', () => {
  it('tombolo:nodo suona il nodo e la campana dell\'ora 3 con s=1; niente successo a chiusura nodo', () => {
    const after = defaultSaveData('t');
    after.unlocks.tovaglia = true;
    after.campaign = { levelId: 'fin_chiuso', endingsSeen: ['aperto'] } as unknown as SaveData['campaign'];
    const { bus, rec } = setup(after);
    const fin = lv({ id: 'fin_chiuso', kind: 'finale', chiusura: 'nodo', startHour: 0, endHour: 3 });
    bus.emit('scene:enter', { id: 'tombolo', params: params(fin, 'campagna') });
    bus.emit('tombolo:nodo', { levelId: 'fin_chiuso' });
    bus.emit('night:complete', { outcome: outcome('fin_chiuso') });
    expect(rec.out).toEqual([{ fn: 'sfx', detail: 'nodo' }, { fn: 'campana', detail: `${NODO_BELL_HOUR} s=1` }]);
    expect(rec.out.some((p) => p.detail === 'successo' || p.detail === 'fallimento')).toBe(false);
  });

  it('un livello senza chiusura nodo suona ancora successo', () => {
    const { bus, rec } = setup();
    bus.emit('scene:enter', { id: 'tombolo', params: params(lv({ id: 'g05' }), 'campagna') });
    bus.emit('night:complete', { outcome: outcome('g05') });
    expect(rec.out).toEqual([{ fn: 'sfx', detail: 'successo' }]);
  });

  it('resolveStonatura: fin_chiuso stona (1) anche dopo il finale vero; il resto resta intonato', () => {
    const db = emptyContentDB();
    db.campaign.days = [{ id: 'g00', act: 0, pins: 0, stonatura: 1 }];
    const after = defaultSaveData('t');
    after.unlocks.tovaglia = true;
    expect(resolveStonatura('fin_chiuso', null, db, after)).toBe(1);
    expect(resolveStonatura('g00', null, db, after)).toBe(0);
    expect(resolveStonatura('fin_aperto', null, db, after)).toBe(0);
  });

  it('tombolo:apparizione suona il filo nero', () => {
    const { bus, rec } = setup();
    bus.emit('tombolo:apparizione', { levelId: 'g08' });
    expect(rec.out).toEqual([{ fn: 'sfx', detail: 'nero' }]);
  });
});
