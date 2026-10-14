/**
 * Ambienti (GDD 13.3): loop persistenti con LFO, gabbiani ogni 8-20 s nella laguna,
 * orologio della notte (fermo nel prologo), tuoni nella tempesta, dissolvenze.
 */
import { describe, expect, it } from 'vitest';
import { AmbienceTrack, CLOCK_FIRST_TICK, GULL_EVERY, THUNDER_EVERY, clockModeFor } from '../../../src/audio/ambience';
import { FADE_TC, createGraph } from '../../../src/audio/graph';
import { SoundBank } from '../../../src/audio/bank';
import { VoiceLimiter } from '../../../src/audio/voices';
import { Player } from '../../../src/audio/player';
import type { AmbienceId } from '../../../src/core/types';
import { FakeAudioContext, FakeBufferSource, FakeOscillator, seeded } from './fakeAudio';

function setup(o: { clockStopped?: boolean } = {}) {
  const ctx = new FakeAudioContext();
  const graph = createGraph(ctx.asAudioContext());
  const limiter = new VoiceLimiter(() => ctx.currentTime);
  const bank = new SoundBank(ctx.asAudioContext(), { rand: seeded(3), characters: () => null });
  const player = new Player(graph, bank, limiter, seeded(4));
  const events: string[] = [];
  const track = new AmbienceTrack({ player, rand: seeded(5), clockStopped: () => !!o.clockStopped, onEvent: (id) => events.push(id) });
  /** Sorgenti one-shot (non in loop) avviate dopo il tempo t0, con il loro buffer. */
  const shots = (t0 = 0) =>
    (ctx.sources.filter((s) => s instanceof FakeBufferSource && !s.loop && s.startAt! >= t0) as FakeBufferSource[]).map((s) => ({
      t: s.startAt!,
      buf: s.buffer,
    }));
  return { ctx, bank, track, events, shots, limiter };
}

describe('ambienti', () => {
  it('ogni ambiente parte con loop persistenti e si sostituisce con una dissolvenza', () => {
    for (const a of ['laguna', 'notte', 'pioggia', 'vento', 'tempesta'] as AmbienceId[]) {
      const { ctx, track, limiter } = setup();
      track.set(a);
      expect(track.id()).toBe(a);
      const loops = ctx.sources.filter((s) => s instanceof FakeBufferSource && s.loop);
      expect(loops.length, a).toBeGreaterThan(0);
      expect(limiter.byKind().ambience).toBeGreaterThan(0);
      track.set('silenzio');
      expect(track.id()).toBe('silenzio');
      // Le sorgenti si fermano alla fine della dissolvenza (≈ 7 costanti di tempo).
      for (const s of ctx.sources) expect(s.stopAt, a).toBeCloseTo(FADE_TC * 7 + 0.05, 6);
      expect(track.active()).toBe(true);
      ctx.advance(3);
      track.schedule(3, 3.3);
      expect(track.active()).toBe(false);
    }
  });

  it('chiedere lo stesso ambiente due volte non lo ricostruisce', () => {
    const { ctx, track } = setup();
    track.set('vento');
    const n = ctx.sources.length;
    track.set('vento');
    expect(ctx.sources.length).toBe(n);
  });

  it('laguna: onde con LFO a 0,08 Hz e gabbiani ogni 8-20 s', () => {
    const { ctx, track, shots } = setup();
    track.set('laguna');
    const lfo = ctx.sources.filter((s) => s instanceof FakeOscillator) as FakeOscillator[];
    expect(lfo.map((o) => o.frequency.value)).toContain(0.08);
    track.schedule(0, 120);
    // Nella laguna gli unici suoni non in loop sono i gabbiani.
    const times = shots().map((g) => g.t);
    expect(times.length).toBeGreaterThanOrEqual(120 / GULL_EVERY[1]);
    expect(times[0]!).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(GULL_EVERY[0]);
      expect(times[i]! - times[i - 1]!).toBeLessThanOrEqual(GULL_EVERY[1]);
    }
  });

  it('notte: acqua modulata a 0,3 Hz e un orologio a un colpo al secondo', () => {
    const { ctx, track, shots } = setup();
    track.set('notte');
    expect((ctx.sources.filter((s) => s instanceof FakeOscillator) as FakeOscillator[]).map((o) => o.frequency.value)).toContain(0.3);
    track.schedule(0, 10);
    const ticks = shots();
    expect(ticks.length).toBe(10);
    expect(ticks[1]!.t - ticks[0]!.t).toBeCloseTo(1, 10);
  });

  it('nel prologo l\'orologio è fermo', () => {
    const { track, shots } = setup({ clockStopped: true });
    track.set('notte');
    track.schedule(0, 10);
    expect(shots()).toHaveLength(0);
  });

  it('tempesta: vento, pioggia e tuoni ogni 9-22 s (con didascalia)', () => {
    const { track, shots, events } = setup();
    track.set('tempesta');
    track.schedule(0, 90);
    const thunders = shots();
    expect(thunders.length).toBeGreaterThanOrEqual(90 / THUNDER_EVERY[1] - 1);
    expect(events.filter((e) => e === 'tuono')).toHaveLength(thunders.length);
    for (let i = 1; i < thunders.length; i++) expect(thunders[i]!.t - thunders[i - 1]!.t).toBeGreaterThanOrEqual(THUNDER_EVERY[0]);
  });

  it('dissolvenza personalizzata', () => {
    const { ctx, track } = setup();
    track.set('pioggia');
    track.set('vento', 3000);
    const first = ctx.sources.filter((s) => s.stopAt !== null);
    expect(first.length).toBeGreaterThan(0);
    // fadeMs 3000 → costante 1 s → fine a 7 × 1 + 0,05.
    for (const s of first) expect(s.stopAt!).toBeCloseTo(7.05, 6);
  });

  describe("l'orologio (GDD 9: nel titolo «laguna e orologio che ticchetta»)", () => {
    /** I tic cadono a CLOCK_FIRST_TICK + k secondi esatti; i gabbiani a tempi casuali. */
    const tickTimes = (all: { t: number }[]): number[] =>
      all
        .map((x) => x.t)
        .filter((t) => {
          const frac = (((t - CLOCK_FIRST_TICK) % 1) + 1) % 1;
          return frac < 1e-9 || frac > 1 - 1e-9;
        });

    it('di serie solo nella notte; clock lo forza o lo toglie', () => {
      expect(clockModeFor('notte')).toBe('auto');
      expect(clockModeFor('laguna')).toBe('off');
      expect(clockModeFor('laguna', true)).toBe('on');
      expect(clockModeFor('notte', false)).toBe('off');
      expect(clockModeFor('silenzio', true)).toBe('on');
    });

    it('laguna con orologio: gabbiani e un tic al secondo, anche quando il prologo ferma quello della notte', () => {
      const { track, shots } = setup({ clockStopped: true });
      track.set('laguna', undefined, true);
      expect(track.clockMode()).toBe('on');
      expect(track.ticking()).toBe(true);
      track.schedule(0, 20);
      const all = shots();
      const ticks = tickTimes(all);
      expect(ticks).toHaveLength(20);
      expect(ticks[0]!).toBeCloseTo(CLOCK_FIRST_TICK, 10);
      // Restano anche i gabbiani della laguna.
      expect(all.length).toBeGreaterThan(ticks.length);
    });

    it('la laguna senza orologio non ticchetta', () => {
      const { track, shots } = setup();
      track.set('laguna');
      expect(track.ticking()).toBe(false);
      track.schedule(0, 20);
      expect(tickTimes(shots())).toHaveLength(0);
    });

    it("accendere e spegnere solo l'orologio non ricostruisce l'ambiente", () => {
      const { ctx, track, shots } = setup();
      track.set('laguna');
      const n = ctx.sources.length;
      track.set('laguna', undefined, true);
      expect(ctx.sources.length).toBe(n);
      expect(ctx.sources.every((x) => x.stopAt === null)).toBe(true);
      track.schedule(0, 5);
      expect(tickTimes(shots())).toHaveLength(5);
      // Di nuovo senza: nessun tic dopo, la laguna resta.
      track.set('laguna');
      expect(track.clockMode()).toBe('off');
      ctx.advance(5);
      track.schedule(5, 15);
      expect(tickTimes(shots(5))).toHaveLength(0);
      expect(ctx.sources.every((x) => x.stopAt === null)).toBe(true);
    });

    it('notte con clock false: acqua senza orologio', () => {
      const { track, shots } = setup();
      track.set('notte', undefined, false);
      track.schedule(0, 10);
      expect(shots()).toHaveLength(0);
    });

    it('silenzio con orologio: solo il tic; stop() spegne anche quello', () => {
      const { ctx, track, shots } = setup();
      track.set('silenzio', undefined, true);
      expect(track.active()).toBe(true);
      expect(ctx.sources.filter((x) => x instanceof FakeBufferSource && x.loop)).toHaveLength(0);
      track.schedule(0, 4);
      expect(shots()).toHaveLength(4);
      track.stop();
      expect(track.clockMode()).toBe('off');
      ctx.advance(4);
      track.schedule(4, 10);
      expect(shots(4)).toHaveLength(0);
      expect(track.active()).toBe(false);
    });
  });
});
