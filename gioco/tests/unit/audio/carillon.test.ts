/**
 * Carillon del merletto (GDD 13.2): una riga = un battito di 380 ms; ogni incrocio è il
 * bicordo sopra/sotto (sopra 30 ms prima); righe vuote: un tic. Orologio con anticipo.
 */
import { describe, expect, it } from 'vitest';
import { CARILLON_BEAT_MS, CarillonTrack, beatSeconds, carillonEvents, carillonSeconds } from '../../../src/audio/carillon';
import { Clock, LOOKAHEAD, TICK_MS, type Track } from '../../../src/audio/scheduler';
import { createGraph } from '../../../src/audio/graph';
import { SoundBank } from '../../../src/audio/bank';
import { VoiceLimiter } from '../../../src/audio/voices';
import { Player } from '../../../src/audio/player';
import type { CarillonScore } from '../../../src/core/types';
import { FakeAudioContext, FakeBufferSource, FakeTimers, seeded } from './fakeAudio';

const PROLOGO: CarillonScore = {
  beatMs: 380,
  rows: [[['marta', 'teresa']], [['teresa', 'piero']], [['piero', 'teresa']], [['marta', 'teresa']]],
};

describe('eventi del carillon', () => {
  it('battito di 380 ms, sopra prima di 30 ms', () => {
    expect(CARILLON_BEAT_MS).toBe(380);
    const ev = carillonEvents(PROLOGO);
    expect(ev).toHaveLength(8);
    expect(ev.map((e) => Number(e.t.toFixed(3)))).toEqual([0, 0.03, 0.38, 0.41, 0.76, 0.79, 1.14, 1.17]);
    expect(ev.map((e) => (e.kind === 'nota' ? `${e.who}:${e.role}` : 'tic'))).toEqual([
      'marta:sopra', 'teresa:sotto', 'teresa:sopra', 'piero:sotto', 'piero:sopra', 'teresa:sotto', 'marta:sopra', 'teresa:sotto',
    ]);
    expect(carillonSeconds(PROLOGO)).toBeCloseTo(4 * 0.38 + 1.2, 10);
  });

  it('righe vuote: un tic; più incroci nella stessa riga leggermente sfasati', () => {
    const ev = carillonEvents({ beatMs: 380, rows: [[], [['gino', 'marta'], ['nina', 'lino']], []] });
    expect(ev.filter((e) => e.kind === 'tic').map((e) => e.t)).toEqual([0, 0.76]);
    const second = ev.filter((e) => e.kind === 'nota');
    expect(second).toHaveLength(4);
    expect(second.every((e) => e.t >= 0.38 && e.t < 0.76)).toBe(true);
  });

  it('battito di riserva se il valore non è valido', () => {
    expect(beatSeconds({ beatMs: 0, rows: [] })).toBeCloseTo(0.38, 10);
    expect(beatSeconds({ beatMs: 500, rows: [] })).toBeCloseTo(0.5, 10);
  });
});

describe('traccia del carillon e orologio', () => {
  it('le note si programmano poco alla volta, con le note dei personaggi', () => {
    const ctx = new FakeAudioContext();
    const graph = createGraph(ctx.asAudioContext());
    const limiter = new VoiceLimiter(() => ctx.currentTime);
    const bank = new SoundBank(ctx.asAudioContext(), { rand: seeded(1), characters: () => null });
    const player = new Player(graph, bank, limiter, seeded(2));
    const track = new CarillonTrack(player, carillonEvents(PROLOGO), 0, (w) => bank.noteHz(w));
    track.schedule(0, 0.3);
    expect(ctx.sources).toHaveLength(2);
    track.schedule(0.3, 0.7);
    expect(ctx.sources).toHaveLength(4);
    track.schedule(0.7, 5);
    expect(ctx.sources).toHaveLength(8);
    expect(track.active()).toBe(false);
    const marta = bank.note(bank.noteHz('marta')!);
    expect((ctx.sources[0] as FakeBufferSource).buffer).toBe(marta);
  });

  it('stop() ferma le note già programmate', () => {
    const ctx = new FakeAudioContext();
    const graph = createGraph(ctx.asAudioContext());
    const player = new Player(graph, new SoundBank(ctx.asAudioContext(), { rand: seeded(1), characters: () => null }), new VoiceLimiter(() => ctx.currentTime), seeded(2));
    const track = new CarillonTrack(player, carillonEvents(PROLOGO), 0, () => 440);
    track.schedule(0, 1);
    track.stop();
    expect(ctx.sources.every((s) => s.stopAt !== null)).toBe(true);
    expect(track.active()).toBe(false);
  });

  it('l\'orologio chiede finestre di anticipo sul tempo del contesto e si ferma quando le tracce finiscono', () => {
    let now = 0;
    const timers = new FakeTimers();
    const clock = new Clock(() => now, timers);
    const windows: [number, number][] = [];
    let remaining = 4;
    const t: Track = {
      schedule: (a, b) => {
        windows.push([a, b]);
        remaining--;
      },
      active: () => remaining > 0,
    };
    clock.setRunning(true);
    clock.add(t);
    expect(windows[0]).toEqual([0, LOOKAHEAD]);
    now = 0.1;
    timers.run(TICK_MS);
    expect(windows[1]![0]).toBeCloseTo(0.1, 10);
    expect(windows[1]![1]).toBeCloseTo(0.1 + LOOKAHEAD, 10);
    // Il giro successivo riparte da dove era arrivato il precedente.
    now = 0.15;
    timers.run(TICK_MS);
    expect(windows[2]![0]).toBeCloseTo(0.1 + LOOKAHEAD, 10);
    now = 0.2;
    timers.run(TICK_MS);
    expect(clock.has(t)).toBe(false);
    expect(timers.pending()).toBe(0);
  });

  it('a contesto fermo il timer non gira', () => {
    const timers = new FakeTimers();
    const clock = new Clock(() => 0, timers);
    clock.add({ schedule: () => undefined, active: () => true });
    expect(timers.pending()).toBe(0);
    clock.setRunning(true);
    expect(timers.pending()).toBe(1);
    clock.setRunning(false);
    expect(timers.pending()).toBe(0);
  });
});
