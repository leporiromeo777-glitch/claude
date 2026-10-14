/**
 * Mattoni della sintesi: sinusoidi smorzate (T60), filtri, rumori (bianco, rosa di
 * Voss, marrone), loop senza cuciture, tocco di legno modale.
 */
import { describe, expect, it } from 'vitest';
import {
  Biquad,
  addDecayingSine,
  centsToRatio,
  makeBuffer,
  peakOf,
  ratioToCents,
  rmsOf,
  statsOf,
  t60ToRadius,
} from '../../../src/audio/synth/dsp';
import { NOISE_RMS, brownNoise, noiseLoop, pinkNoise, whiteNoise } from '../../../src/audio/synth/noise';
import { WOOD_AMPS, WOOD_F0_MAX, WOOD_F0_MIN, WOOD_RATIOS, WOOD_T60, renderWood, woodF0 } from '../../../src/audio/synth/wood';
import { seeded } from './fakeAudio';

/** Energia in una banda (DFT diretta su un tratto: abbastanza per i confronti). */
function bandEnergy(x: Float32Array, sr: number, f0: number, f1: number, n = 4096): number {
  let e = 0;
  const step = Math.max(1, Math.round((f1 - f0) / 24));
  for (let f = f0; f <= f1; f += step) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * f) / sr;
    for (let i = 0; i < n; i++) {
      re += x[i]! * Math.cos(w * i);
      im += x[i]! * Math.sin(w * i);
    }
    e += (re * re + im * im) / n;
  }
  return e / (Math.floor((f1 - f0) / step) + 1);
}

describe('dsp', () => {
  it('cent e rapporti', () => {
    expect(centsToRatio(1200)).toBeCloseTo(2, 12);
    expect(ratioToCents(440, 880)).toBeCloseTo(1200, 9);
    expect(ratioToCents(440, 440 * centsToRatio(40))).toBeCloseTo(40, 9);
  });

  it('sinusoide smorzata: ampiezza giusta e -60 dB dopo T60', () => {
    const sr = 8000;
    const b = makeBuffer(1.2, sr);
    addDecayingSine(b, sr, { start: 0, freq: 200, amp: 0.5, t60: 1, phase: Math.PI / 2 });
    expect(b[0]).toBeCloseTo(0.5, 6);
    // Inviluppo: il picco attorno a t ha ampiezza 0,5 · 10^(-3t).
    const at = (t: number): number => peakOf(b.subarray(Math.round(t * sr), Math.round(t * sr) + 80));
    expect(at(0.5) / 0.5).toBeCloseTo(Math.pow(10, -1.5), 2);
    expect(b[Math.round(1.1 * sr)]).toBe(0);
    expect(t60ToRadius(1, sr) ** sr).toBeCloseTo(0.001, 6);
  });

  it('il passa-basso attenua gli acuti, il passa-alto i gravi', () => {
    const sr = 44100;
    const tone = (f: number): Float32Array => {
      const b = makeBuffer(0.2, sr);
      for (let i = 0; i < b.length; i++) b[i] = Math.sin((2 * Math.PI * f * i) / sr);
      return b;
    };
    const lp = (f: number): number => {
      const b = tone(f);
      new Biquad('lowpass', 500, Math.SQRT1_2, sr).process(b);
      return rmsOf(b, 2000);
    };
    expect(lp(100)).toBeGreaterThan(0.6);
    expect(lp(5000)).toBeLessThan(0.02);
    const hp = tone(100);
    new Biquad('highpass', 3000, Math.SQRT1_2, sr).process(hp);
    expect(rmsOf(hp, 2000)).toBeLessThan(0.01);
    const bp = tone(3000);
    new Biquad('bandpass', 3000, 1.5, sr).process(bp);
    expect(rmsOf(bp, 2000)).toBeGreaterThan(0.65);
  });
});

describe('rumori', () => {
  const sr = 22050;
  const n = sr * 2;

  it('bianco piatto, rosa -3 dB/ottava, marrone -6 dB/ottava', () => {
    const w = whiteNoise(n, seeded(1));
    const p = pinkNoise(n, seeded(2));
    const b = brownNoise(n, seeded(3));
    const ratio = (x: Float32Array): number => 10 * Math.log10(bandEnergy(x, sr, 200, 400) / bandEnergy(x, sr, 3200, 6400));
    const rw = ratio(w);
    const rp = ratio(p);
    const rb = ratio(b);
    // 4 ottave fra le due bande: bianco ~0 dB, rosa ~12 dB, marrone ~24 dB.
    expect(Math.abs(rw)).toBeLessThan(4);
    expect(rp).toBeGreaterThan(7);
    expect(rp).toBeLessThan(17);
    expect(rb).toBeGreaterThan(rp + 6);
  });

  it('normalizzati e senza NaN', () => {
    for (const x of [pinkNoise(n, seeded(4)), brownNoise(n, seeded(5))]) {
      const s = statsOf(x);
      expect(s.nan).toBe(false);
      expect(s.rms).toBeCloseTo(NOISE_RMS, 3);
    }
  });

  it('loop senza cuciture: la fine si attacca all\'inizio', () => {
    for (const kind of ['rosa', 'marrone', 'bianco'] as const) {
      const x = noiseLoop(kind, sr, 2, seeded(6));
      expect(x.length).toBe(2 * sr);
      const jump = Math.abs(x[x.length - 1]! - x[0]!);
      // Il salto fra ultimo e primo campione è come un passo qualsiasi del segnale.
      let typical = 0;
      for (let i = 1; i < x.length; i++) typical = Math.max(typical, Math.abs(x[i]! - x[i - 1]!));
      expect(jump).toBeLessThanOrEqual(typical + 1e-6);
    }
  });
});

describe('tocco di legno', () => {
  it('modi e parametri del GDD', () => {
    expect([...WOOD_RATIOS]).toEqual([1, 2.76, 5.4, 8.93]);
    expect([...WOOD_AMPS]).toEqual([1, 0.5, 0.25, 0.12]);
    expect([...WOOD_T60]).toEqual([0.12, 0.06, 0.035, 0.02]);
  });

  it('f0 casuale fra 500 e 900 Hz, ±5% a ogni colpo', () => {
    const r = seeded(8);
    for (let i = 0; i < 500; i++) {
      const f = woodF0(r);
      expect(f).toBeGreaterThanOrEqual(WOOD_F0_MIN * 0.95);
      expect(f).toBeLessThanOrEqual(WOOD_F0_MAX * 1.05);
      const g = woodF0(r, 300);
      expect(g).toBeGreaterThanOrEqual(285);
      expect(g).toBeLessThanOrEqual(315);
    }
  });

  it('colpo breve, con la fondamentale più forte dei modi alti', () => {
    const sr = 44100;
    const b = renderWood(sr, seeded(9), { f0: 600, gain: 0.6 });
    expect(b.length / sr).toBeCloseTo(0.13, 2);
    expect(peakOf(b)).toBeCloseTo(0.6, 5);
    expect(statsOf(b).nan).toBe(false);
    const pad = new Float32Array(4096);
    pad.set(b.subarray(0, 4096));
    const f0 = bandEnergy(pad, sr, 560, 640);
    const m4 = bandEnergy(pad, sr, 600 * 8.93 - 300, 600 * 8.93 + 300);
    expect(f0).toBeGreaterThan(m4 * 4);
  });
});
