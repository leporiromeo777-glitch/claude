/**
 * Limitatore di voci (GDD 13.1, ARCHITETTURA 11): mai più di 48 sorgenti attive; si
 * taglia il più vecchio degli effetti, mai le sorgenti persistenti.
 */
import { describe, expect, it } from 'vitest';
import { MAX_VOICES, VoiceLimiter, type VoiceKind } from '../../../src/audio/voices';
import { FakeAudioContext, FakeBufferSource, type FakeSource } from './fakeAudio';

function add(ctx: FakeAudioContext, lim: VoiceLimiter, kind: VoiceKind, o: { persistent?: boolean; dur?: number } = {}): { src: FakeSource; ok: boolean } {
  const ok = lim.reserve();
  const src = ctx.createBufferSource();
  if (!ok) return { src, ok };
  src.start(ctx.currentTime);
  const entry = lim.add(src as unknown as AudioScheduledSourceNode, { kind, persistent: !!o.persistent, end: ctx.currentTime + (o.dur ?? 1) });
  src.onended = () => lim.release(entry);
  return { src, ok };
}

describe('limitatore di voci', () => {
  it('48 sorgenti al massimo', () => {
    expect(MAX_VOICES).toBe(48);
  });

  it('200 effetti di fila: mai più di 48, tagliati i più vecchi', () => {
    const ctx = new FakeAudioContext();
    const lim = new VoiceLimiter(() => ctx.currentTime);
    const all: FakeSource[] = [];
    for (let i = 0; i < 200; i++) {
      all.push(add(ctx, lim, 'sfx').src);
      expect(lim.count()).toBeLessThanOrEqual(48);
      expect(ctx.playing().length).toBeLessThanOrEqual(48);
    }
    expect(lim.peak()).toBe(48);
    expect(lim.stolenCount()).toBe(152);
    // Sono rimasti gli ultimi 48.
    expect(all.slice(-48).every((s) => s.playing(ctx.currentTime))).toBe(true);
    expect(all.slice(0, 152).every((s) => !s.playing(ctx.currentTime))).toBe(true);
  });

  it('prima gli effetti, poi le altre note; mai le persistenti', () => {
    const ctx = new FakeAudioContext();
    const lim = new VoiceLimiter(() => ctx.currentTime, 4);
    const drone = add(ctx, lim, 'music', { persistent: true }).src;
    const note = add(ctx, lim, 'music').src;
    const fx = add(ctx, lim, 'sfx').src;
    add(ctx, lim, 'voice');
    // Pieno: il prossimo taglia l'effetto, anche se la nota è più vecchia.
    add(ctx, lim, 'sfx');
    expect(fx.playing(ctx.currentTime)).toBe(false);
    expect(note.playing(ctx.currentTime)).toBe(true);
    // Un altro: l'effetto appena entrato.
    add(ctx, lim, 'voice');
    expect(lim.byKind().sfx).toBe(0);
    // Niente effetti: si taglia la nota non persistente più vecchia.
    add(ctx, lim, 'voice');
    expect(note.playing(ctx.currentTime)).toBe(false);
    expect(drone.playing(ctx.currentTime)).toBe(true);
    expect(lim.count()).toBe(4);
  });

  it('se tutto il posto è di sorgenti persistenti il suono nuovo non parte', () => {
    const ctx = new FakeAudioContext();
    const lim = new VoiceLimiter(() => ctx.currentTime, 2);
    add(ctx, lim, 'ambience', { persistent: true });
    add(ctx, lim, 'music', { persistent: true });
    expect(add(ctx, lim, 'sfx').ok).toBe(false);
    expect(lim.count()).toBe(2);
  });

  it('le sorgenti finite liberano il posto (fine prevista o ended)', () => {
    const ctx = new FakeAudioContext();
    const lim = new VoiceLimiter(() => ctx.currentTime);
    for (let i = 0; i < 10; i++) add(ctx, lim, 'sfx', { dur: 0.5 });
    expect(lim.count()).toBe(10);
    ctx.advance(0.6);
    expect(lim.count()).toBe(0);
    const s = ctx.createBufferSource() as FakeBufferSource;
    s.start(0);
    const e = lim.add(s as unknown as AudioScheduledSourceNode, { kind: 'sfx', end: Infinity });
    expect(lim.count()).toBe(1);
    lim.release(e);
    expect(lim.count()).toBe(0);
  });
});
