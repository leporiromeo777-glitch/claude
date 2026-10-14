/**
 * Motore audio con un AudioContext finto: ciclo di vita (sblocco sincrono, sospensione,
 * ripresa, interruzione), chiamate innocue prima dello sblocco, registro, limitatore,
 * pre-render, volumi, ducking e didascalie.
 */
import { describe, expect, it, vi } from 'vitest';
import { WebAudioEngine, LOG_SIZE, BLOCKED_CHECK_MS, type EngineDeps } from '../../../src/audio/engine';
import { DUCK_GAIN, MUSIC_LEVEL } from '../../../src/audio/graph';
import { SFX_IDS, WARM_RECIPES } from '../../../src/audio/synth/sfx';
import type { SfxId } from '../../../src/core/types';
import { FakeAudioContext, FakeOscillator, FakeTimers, type FakeGain, seeded } from './fakeAudio';
import itAudio from '../../../src/i18n/it/audio.json';
import enAudio from '../../../src/i18n/en/audio.json';
import { flatten } from '../../../src/core/i18n';

function keysOf(data: unknown): Set<string> {
  const m = new Map<string, string>();
  flatten(data, 'audio', m);
  return new Set(m.keys());
}
const IT = keysOf(itAudio);
const EN = keysOf(enAudio);

function make(o: Partial<EngineDeps> & { ctx?: FakeAudioContext | null } = {}) {
  const timers = new FakeTimers();
  let clock = 0;
  const ctxs: FakeAudioContext[] = [];
  const captions: { textKey: string; params?: Record<string, string | number> }[] = [];
  const blocked: boolean[] = [];
  const idleQueue: ((remaining: () => number) => void)[] = [];
  const engine = new WebAudioEngine({
    createContext: () => {
      if (o.ctx === null) return null;
      const c = o.ctx ?? new FakeAudioContext();
      ctxs.push(c);
      return c.asAudioContext();
    },
    now: () => clock,
    rand: seeded(42),
    timers,
    idle: (fn) => idleQueue.push(fn),
    caption: (textKey, params) => captions.push(params ? { textKey, params } : { textKey }),
    nameOf: (w) => (w === 'lino' ? 'un passante' : w[0]!.toUpperCase() + w.slice(1)),
    styleOf: () => 'deciso',
    onBlocked: (b) => blocked.push(b),
    visible: () => true,
    ...o,
  });
  const runIdle = (): void => {
    while (idleQueue.length) idleQueue.shift()!(() => 50);
  };
  return {
    engine,
    timers,
    ctxs,
    captions,
    blocked,
    runIdle,
    tick: (ms: number) => {
      clock += ms;
      timers.run(ms);
    },
  };
}

interface FakeGraph {
  master: FakeGain;
  musicDuck: FakeGain;
  buses: { musica: FakeGain; effetti: FakeGain; voci: FakeGain; ambiente: FakeGain };
}
/** Il grafo interno del motore (solo nei test). */
function graphOf(e: WebAudioEngine): FakeGraph {
  return (e as unknown as { rt: { graph: FakeGraph } }).rt.graph;
}

function everything(e: WebAudioEngine): void {
  for (const id of SFX_IDS) e.sfx(id, { pan: -0.5, gain: 0.8, detune: 10 });
  e.note('teresa');
  e.note('lino', { pan: 1 });
  e.crossing('marta', 'teresa', { rancor: true, pan: 0.3 });
  e.crossing('lino', 'piero');
  e.bell({ hour: 9, stonatura: 1 });
  e.carillon({ beatMs: 380, rows: [[['marta', 'teresa']], []] });
  e.babble('marta', 'No.');
  e.babble('clotilde', 'Chi tesse non è tessuto.');
  e.setAmbience('laguna');
  e.setAmbience('notte', 500);
  e.setMusic('notte', { seed: 'g00', notes: ['teresa', 'marta'] });
  e.dyad('marta', 'teresa');
  e.dyad(null, null);
  e.duck(true);
  e.duck(false);
  e.setVolumes({ master: 0.5, music: 0.5, sfx: 0.5, voice: 0.5 });
}

describe('prima dello sblocco', () => {
  it('ogni chiamata è innocua, non crea il contesto e finisce nel registro', () => {
    const { engine, ctxs } = make();
    expect(engine.state()).toBe('locked');
    expect(() => everything(engine)).not.toThrow();
    expect(() => engine.suspend()).not.toThrow();
    expect(() => engine.resume()).not.toThrow();
    expect(engine.state()).toBe('locked');
    expect(ctxs).toHaveLength(0);
    const ids = engine.log().map((e) => e.id);
    for (const id of ['incrocio', 'vaporetto', 'nota', 'campana', 'carillon', 'borbottio', 'ambiente', 'musica']) expect(ids).toContain(id);
  });

  it('senza WebAudio: resta bloccato, nessun errore', () => {
    const { engine } = make({ ctx: null });
    expect(() => {
      engine.unlock();
      engine.unlock();
      everything(engine);
    }).not.toThrow();
    expect(engine.state()).toBe('locked');
  });

  it('babble e carillon finiscono comunque dopo la loro durata', async () => {
    const { engine, tick } = make();
    const p = engine.babble('teresa', 'Buongiorno, cara!');
    const c = engine.carillon({ beatMs: 380, rows: [[['marta', 'teresa']], [], []] });
    let done = 0;
    void p.done.then(() => done++);
    void c.done.then(() => done++);
    tick(100);
    await Promise.resolve();
    expect(done).toBe(0);
    tick(3000);
    await Promise.resolve();
    expect(done).toBe(2);
  });
});

describe('sblocco e ciclo di vita', () => {
  it('unlock() crea un solo contesto, in modo sincrono, ed è idempotente', () => {
    const { engine, ctxs } = make();
    engine.unlock();
    expect(ctxs).toHaveLength(1);
    expect(engine.state()).toBe('running');
    engine.unlock();
    engine.unlock();
    expect(ctxs).toHaveLength(1);
  });

  it('un contesto nato sospeso viene ripreso dentro unlock()', () => {
    const ctx = new FakeAudioContext({ state: 'suspended' });
    const { engine } = make({ ctx });
    engine.unlock();
    expect(ctx.resumeCalls).toBe(1);
    expect(engine.state()).toBe('running');
  });

  it("suspend() → 'suspended' subito; resume() → 'running'", () => {
    const ctx = new FakeAudioContext();
    const { engine } = make({ ctx });
    engine.unlock();
    engine.suspend();
    expect(engine.state()).toBe('suspended');
    expect(ctx.suspendCalls).toBe(1);
    engine.resume();
    expect(engine.state()).toBe('running');
  });

  it('dopo una sospensione, unlock() (un gesto) riprende il contesto', () => {
    const ctx = new FakeAudioContext();
    const { engine } = make({ ctx });
    engine.unlock();
    engine.suspend();
    engine.unlock();
    expect(engine.state()).toBe('running');
  });

  it('interruzione del sistema → "Tocca per continuare"; il tocco riprende', () => {
    const ctx = new FakeAudioContext();
    const { engine, blocked, tick } = make({ ctx });
    engine.unlock();
    ctx.interrupt();
    expect(engine.state()).toBe('suspended');
    tick(BLOCKED_CHECK_MS + 10);
    expect(blocked).toEqual([true]);
    expect(engine.isBlocked()).toBe(true);
    engine.unlock();
    expect(engine.state()).toBe('running');
    expect(blocked).toEqual([true, false]);
  });

  it('ripresa dell\'app che non riesce (iOS) → overlay; niente overlay se la pagina è nascosta', () => {
    const ctx = new FakeAudioContext();
    const { engine, blocked, tick } = make({ ctx });
    engine.unlock();
    engine.suspend();
    ctx.canResume = false;
    engine.resume();
    tick(BLOCKED_CHECK_MS + 10);
    expect(blocked).toEqual([true]);
    engine.suspend();
    expect(blocked).toEqual([true, false]);

    const hidden = make({ ctx: new FakeAudioContext(), visible: () => false });
    hidden.engine.unlock();
    hidden.ctxs[0]!.interrupt();
    hidden.tick(BLOCKED_CHECK_MS + 10);
    expect(hidden.blocked).toEqual([]);
  });

  it('un tocco sull\'overlay che non basta: l\'overlay sparisce e non torna finché l\'audio non riparte', () => {
    const ctx = new FakeAudioContext();
    const { engine, blocked, tick } = make({ ctx });
    engine.unlock();
    ctx.interrupt();
    ctx.canResume = false;
    tick(BLOCKED_CHECK_MS + 10);
    expect(blocked).toEqual([true]);
    engine.retryFromOverlay();
    tick(BLOCKED_CHECK_MS + 10);
    // Il gioco non resta bloccato dietro l'overlay.
    expect(blocked).toEqual([true, false]);
    engine.resume();
    tick(BLOCKED_CHECK_MS + 10);
    expect(blocked).toEqual([true, false]);
    // Più tardi un gesto qualsiasi riprende l'audio; un'interruzione nuova rimostra l'overlay.
    ctx.canResume = true;
    engine.unlock();
    expect(engine.state()).toBe('running');
    ctx.interrupt();
    tick(BLOCKED_CHECK_MS + 10);
    expect(blocked).toEqual([true, false, true]);
    engine.retryFromOverlay();
    expect(engine.state()).toBe('running');
    expect(blocked).toEqual([true, false, true, false]);
  });

  it('contesto chiuso dal sistema: il gesto successivo ne crea uno nuovo, con musica e ambiente', () => {
    const { engine, ctxs, runIdle } = make();
    engine.setMusic('notte', { seed: 'g01' });
    engine.setAmbience('notte');
    engine.unlock();
    runIdle();
    expect(engine.stats().prerender.done).toBe(true);
    void ctxs[0]!.close();
    expect(engine.state()).toBe('suspended');
    engine.unlock();
    expect(ctxs).toHaveLength(2);
    expect(engine.state()).toBe('running');
    const fresh = ctxs[1]!;
    expect(fresh.sources.filter((x) => x instanceof FakeOscillator).length).toBeGreaterThan(0);
    expect(fresh.sources.some((x) => 'loop' in x && (x as { loop: boolean }).loop)).toBe(true);
    // Il pre-render riparte per il contesto nuovo.
    expect(engine.stats().prerender.started).toBe(true);
    runIdle();
    expect(engine.stats().prerender.done).toBe(true);
  });

  it('i suoni non si accumulano mentre il contesto è sospeso', () => {
    const ctx = new FakeAudioContext();
    const { engine } = make({ ctx });
    engine.unlock();
    engine.suspend();
    const before = ctx.sources.length;
    for (let i = 0; i < 20; i++) engine.sfx('incrocio');
    expect(ctx.sources.length).toBe(before);
  });
});

describe('limitatore nel motore', () => {
  it('200 effetti consecutivi: mai più di 48 sorgenti attive', () => {
    const ctx = new FakeAudioContext();
    const { engine } = make({ ctx });
    engine.unlock();
    engine.setMusic('notte', { seed: 'g01' });
    engine.setAmbience('tempesta');
    for (let i = 0; i < 200; i++) {
      engine.sfx(SFX_IDS[i % SFX_IDS.length]! as SfxId);
      expect(ctx.playing().length).toBeLessThanOrEqual(48);
    }
    const s = engine.stats();
    expect(s.peak).toBeLessThanOrEqual(48);
    expect(s.active).toBeLessThanOrEqual(48);
    expect(s.stolen).toBeGreaterThan(100);
    // Bordone, LFO e loop della tempesta non si tagliano.
    const persistent = ctx.sources.filter((x) => x instanceof FakeOscillator);
    expect(persistent.length).toBeGreaterThan(0);
    expect(persistent.every((x) => x.playing(ctx.currentTime))).toBe(true);
  });

  it('stress(200) riporta il picco', () => {
    const { engine } = make();
    engine.unlock();
    const r = engine.stress(200);
    expect(r.requested).toBe(200);
    expect(r.peak).toBeLessThanOrEqual(48);
  });
});

describe('stato ricordato, pre-render, volumi', () => {
  it('musica e ambiente chiesti prima dello sblocco partono allo sblocco', () => {
    const ctx = new FakeAudioContext();
    const { engine } = make({ ctx });
    engine.setMusic('titolo');
    engine.setAmbience('laguna');
    expect(ctx.sources).toHaveLength(0);
    engine.unlock();
    const osc = ctx.sources.filter((x) => x instanceof FakeOscillator) as FakeOscillator[];
    expect(osc.filter((o) => o.type === 'triangle')).toHaveLength(4);
    expect(engine.stats().music).toBe('titolo');
    expect(engine.stats().ambience).toBe('laguna');
    // Loop di rumore dell'ambiente.
    expect(ctx.sources.some((x) => 'loop' in x && (x as { loop: boolean }).loop)).toBe(true);
  });

  it("titolo: laguna e orologio (GDD 9), chiesti prima dello sblocco, con la didascalia dell'orologio", () => {
    let prologo = true;
    const { engine, captions } = make({ game: { clockStopped: () => prologo } });
    engine.setAmbience('laguna', undefined, { clock: true });
    expect(captions.map((c) => c.textKey)).toContain('audio.didascalie.ambiente.lagunaOrologio');
    // L'orologio chiesto apposta ticchetta anche se la campagna salvata è nel prologo.
    expect(engine.stats().clock).toBe(true);
    engine.unlock();
    const track = (engine as unknown as { rt: { ambience: { clockMode(): string; id(): string } } }).rt.ambience;
    expect(track.id()).toBe('laguna');
    expect(track.clockMode()).toBe('on');
    expect(engine.stats()).toMatchObject({ ambience: 'laguna', clock: true });
    expect(engine.log().filter((e) => e.id === 'ambiente').map((e) => e.detail)).toEqual(['laguna +orologio']);
    // Il prologo: la notte con l'orologio fermo («il ticchettio si ferma»).
    engine.setAmbience('notte');
    expect(captions.at(-1)?.textKey).toBe('audio.didascalie.ambiente.notteFerma');
    expect(engine.stats().clock).toBe(false);
    prologo = false;
    expect(engine.stats().clock).toBe(true);
    // Solo l'orologio cambia: nuova didascalia, stesso ambiente.
    engine.setAmbience('notte', undefined, { clock: false });
    expect(captions.at(-1)?.textKey).toBe('audio.didascalie.ambiente.notteFerma');
    expect(track.clockMode()).toBe('off');
    for (const k of ['audio.didascalie.ambiente.lagunaOrologio', 'audio.didascalie.ambiente.orologio']) {
      expect(IT.has(k), k).toBe(true);
      expect(EN.has(k), k).toBe(true);
    }
  });

  it('pre-render in idle dopo lo sblocco: campane, rumori, note, effetti', () => {
    const { engine, runIdle } = make();
    expect(engine.stats().prerender.started).toBe(false);
    engine.unlock();
    const st = engine.stats().prerender;
    expect(st.started).toBe(true);
    expect(st.done).toBe(false);
    runIdle();
    const done = engine.stats().prerender;
    expect(done.done).toBe(true);
    expect(done.completed).toBe(done.jobs);
    // 4 stonature × 3 colpi + 3 rumori + 11 note + 8 legni + gli effetti dei gesti.
    expect(done.jobs).toBe(12 + 3 + 11 + 8 + WARM_RECIPES.length);
  });

  it('volumi con curva quadratica, silenzio di debug', () => {
    const { engine } = make();
    engine.setVolumes({ master: 0.5, music: 1, sfx: 0.8, voice: 0 });
    engine.unlock();
    const g = graphOf(engine);
    expect(g.master.gain.value).toBeCloseTo(0.25, 6);
    expect(g.buses.effetti.gain.value).toBeCloseTo(0.64, 6);
    expect(g.buses.voci.gain.value).toBe(0);
    expect(g.buses.musica.gain.value).toBeCloseTo(MUSIC_LEVEL, 6);
    expect(engine.mute(true)).toBe(true);
    expect(engine.isMuted()).toBe(true);
    expect(g.master.gain.value).toBe(0);
    expect(engine.mute(false)).toBe(false);
    expect(g.master.gain.value).toBeCloseTo(0.25, 6);
    engine.setVolumes({ master: 1, music: 0, sfx: 1, voice: 1 });
    expect(g.master.gain.value).toBe(1);
    expect(g.buses.musica.gain.value).toBe(0);
  });

  it('il registro tiene gli ultimi 200 suoni', () => {
    const { engine } = make();
    for (let i = 0; i < 250; i++) engine.sfx('ui_tap');
    engine.sfx('vaporetto');
    const log = engine.log();
    expect(log).toHaveLength(LOG_SIZE);
    expect(log[log.length - 1]!.id).toBe('vaporetto');
    expect(log[0]).toHaveProperty('t');
  });

  it('un id sconosciuto (dati sbagliati) non rompe nulla', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { engine } = make();
    engine.unlock();
    expect(() => engine.sfx('inesistente' as SfxId)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});

describe('ducking', () => {
  it('duck(true) abbassa la musica di 8 dB; il borbottio la abbassa da solo', () => {
    const ctx = new FakeAudioContext();
    const { engine, tick } = make({ ctx });
    engine.unlock();
    const graph = graphOf(engine);
    expect(graph.buses.musica.gain.value).toBeCloseTo(0.36 * MUSIC_LEVEL, 6);
    engine.duck(true);
    expect(graph.musicDuck.gain.value).toBeCloseTo(DUCK_GAIN, 6);
    expect(20 * Math.log10(DUCK_GAIN)).toBeCloseTo(-8, 6);
    engine.duck(false);
    expect(graph.musicDuck.gain.value).toBe(1);
    const p = engine.babble('teresa', 'Ciao cara, come stai?');
    expect(graph.musicDuck.gain.value).toBeCloseTo(DUCK_GAIN, 6);
    p.stop();
    expect(graph.musicDuck.gain.value).toBe(1);
    engine.babble('teresa', 'Ciao.');
    tick(2000);
    expect(graph.musicDuck.gain.value).toBe(1);
  });
});

describe('contesto del gioco', () => {
  it('duck(true) chiesto prima dello sblocco vale allo sblocco', () => {
    const { engine } = make();
    engine.duck(true);
    engine.unlock();
    expect(graphOf(engine).musicDuck.gain.value).toBeCloseTo(DUCK_GAIN, 6);
  });

  it('refreshContext(): la musica chiesta senza seme prende quello della scena nuova', () => {
    let seed = 'g03';
    let notes: ('teresa' | 'marta' | 'gino')[] = ['teresa', 'marta'];
    const { engine } = make({ game: { musicSeed: () => seed, presentCharacters: () => notes } });
    engine.unlock();
    engine.setMusic('notte');
    const key = (): string => (engine as unknown as { rt: { music: { key: string } } }).rt.music.key;
    expect(key()).toContain('|g03|');
    seed = 'day-2026-10-14';
    notes = ['gino'];
    engine.refreshContext();
    expect(key()).toContain('|day-2026-10-14|');
    expect(key()).toContain('659.25');
    // Con seme e note esplicite il cambio di scena non tocca la musica.
    engine.setMusic('alba', { seed: 'g07', notes: ['marta'] });
    seed = 'altro';
    engine.refreshContext();
    expect(key()).toContain('|g07|');
    expect(engine.log().filter((e) => e.id === 'musica')).toHaveLength(2);
  });

  it('chi non è un personaggio (il narratore) non borbotta, ma la battuta dura lo stesso', async () => {
    const ctx = new FakeAudioContext();
    const { engine, captions, tick } = make({ ctx });
    engine.unlock();
    const before = ctx.sources.length;
    const p = engine.babble('narratore' as never, 'Quella notte la laguna era ferma.');
    expect(ctx.sources.length).toBe(before);
    expect(captions.filter((c) => c.textKey.endsWith('borbottio'))).toHaveLength(0);
    expect(engine.stats().ducked).toBe(false);
    let done = false;
    void p.done.then(() => (done = true));
    tick(200);
    await Promise.resolve();
    expect(done).toBe(false);
    tick(6000);
    await Promise.resolve();
    expect(done).toBe(true);
    expect(engine.log().at(-1)).toMatchObject({ id: 'borbottio', detail: 'narratore' });
  });
});

describe('didascalie', () => {
  it('i suoni significativi emettono una didascalia con chiave esistente in it e en', () => {
    const { engine, captions } = make();
    everything(engine);
    engine.setAmbience('tempesta');
    expect(captions.length).toBeGreaterThan(15);
    for (const c of captions) {
      expect(IT.has(c.textKey), c.textKey).toBe(true);
      expect(EN.has(c.textKey), c.textKey).toBe(true);
    }
    const keys = captions.map((c) => c.textKey);
    expect(keys).toContain('audio.didascalie.campanaStonata');
    expect(keys).toContain('audio.didascalie.vaporetto');
    expect(keys).toContain('audio.didascalie.incrocioRancore');
    expect(keys).toContain('audio.didascalie.borbottio');
    expect(keys).toContain('audio.didascalie.penna');
    expect(keys).toContain('audio.didascalie.ambiente.laguna');
    const bell = captions.find((c) => c.textKey === 'audio.didascalie.campanaStonata')!;
    expect(bell.params).toEqual({ ora: 9 });
    const b = captions.find((c) => c.textKey === 'audio.didascalie.borbottio')!;
    expect(b.params).toEqual({ nome: 'Marta', carattere: 'deciso' });
  });

  it('campana intonata con stonatura 0; nessuna didascalia per i tocchi dei fusi', () => {
    const { engine, captions } = make();
    engine.bell({ hour: 17, stonatura: 0 });
    engine.sfx('fuso_presa');
    engine.sfx('ui_tap');
    expect(captions).toEqual([{ textKey: 'audio.didascalie.campana', params: { ora: 17 } }]);
  });
});
