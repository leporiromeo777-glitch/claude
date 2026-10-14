/**
 * Ambienti (GDD 13.3): loop persistenti con LFO, gabbiani ogni 8-20 s nella laguna,
 * orologio della notte (fermo nel prologo), tuoni nella tempesta, dissolvenze.
 */
import { describe, expect, it } from 'vitest';
import { AmbienceTrack, GULL_EVERY, THUNDER_EVERY } from '../../../src/audio/ambience';
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
});
