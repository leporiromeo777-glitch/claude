/**
 * Campana dell'ora (GDD 13.2): parziali, ampiezze, decadimenti e stonatura come nella
 * tabella, entro 0,1 cent, per s = 0, 0,25, 0,6 e 1.
 */
import { describe, expect, it } from 'vitest';
import {
  BELL_PRIME,
  STONATURE,
  bellHum,
  bellPartials,
  renderBell,
  stonaturaKey,
} from '../../../src/audio/synth/bell';
import { ratioToCents, rmsOf, statsOf } from '../../../src/audio/synth/dsp';
import { seeded } from './fakeAudio';

/** Tabella del GDD 13.2, trascritta qui a mano (non dal codice). */
const GDD = {
  prime: 196,
  ratios: [0.5, 1, 1.2, 1.5, 2, 2.5, 3, 4],
  amps: [0.6, 0.8, 0.5, 0.35, 0.7, 0.25, 0.2, 0.15],
  decays: [4, 3, 2.5, 2, 1.8, 1.2, 1, 0.8],
  cents: [-35, 20, -45, 30, -25, 40, -15, 10],
};

describe('campana: parziali e stonatura', () => {
  it('fondamentale 196 Hz e valori di stonatura del gioco', () => {
    expect(BELL_PRIME).toBe(GDD.prime);
    expect([...STONATURE]).toEqual([1, 0.6, 0.25, 0]);
  });

  for (const s of [0, 0.25, 0.6, 1]) {
    it(`s = ${s}: frequenze entro 0,1 cent dalla tabella`, () => {
      const parts = bellPartials(s);
      expect(parts).toHaveLength(8);
      parts.forEach((p, i) => {
        const expected = GDD.prime * GDD.ratios[i]! * Math.pow(2, (s * GDD.cents[i]!) / 1200);
        expect(Math.abs(ratioToCents(expected, p.freq))).toBeLessThan(0.1);
        // Lo spostamento rispetto alla parziale intonata è esattamente s × tabella.
        const tuned = GDD.prime * GDD.ratios[i]!;
        expect(Math.abs(ratioToCents(tuned, p.freq) - s * GDD.cents[i]!)).toBeLessThan(0.1);
        expect(p.amp).toBe(GDD.amps[i]);
        expect(p.t60).toBe(GDD.decays[i]);
      });
    });
  }

  it('s = 0 è intonata: rapporti esatti', () => {
    const f = bellPartials(0).map((p) => p.freq);
    expect(f).toEqual(GDD.ratios.map((r) => r * 196));
  });

  it('ronzio di ampiezza 0,15 × s', () => {
    expect(bellHum(0)).toBe(0);
    expect(bellHum(0.25)).toBeCloseTo(0.0375, 10);
    expect(bellHum(0.6)).toBeCloseTo(0.09, 10);
    expect(bellHum(1)).toBeCloseTo(0.15, 10);
  });

  it('stonatura fuori intervallo limitata a 0..1', () => {
    expect(bellPartials(2)[0]!.cents).toBe(-35);
    expect(Math.abs(bellPartials(-1)[0]!.cents)).toBe(0);
    expect(stonaturaKey(0.6)).toBe(60);
    expect(stonaturaKey(Number.NaN)).toBe(100);
  });
});

describe('campana: rendering', () => {
  it('colpo finito, picco 0,7, decadimento lungo', () => {
    for (const s of [1, 0]) {
      const sr = 22050;
      const b = renderBell(sr, s, seeded(3));
      const st = statsOf(b);
      expect(st.nan).toBe(false);
      expect(st.peak).toBeCloseTo(0.7, 3);
      // Suona ancora dopo 2 s ma molto meno che all'inizio.
      const head = rmsOf(b, 0, sr / 2);
      const tail = rmsOf(b, 3 * sr, 3.5 * sr);
      expect(tail).toBeGreaterThan(0);
      expect(tail).toBeLessThan(head / 8);
    }
  });

  it('tre colpi diversi fra loro (varianti naturali)', () => {
    const rand = seeded(9);
    const a = renderBell(22050, 1, rand);
    const b = renderBell(22050, 1, rand);
    let diff = 0;
    for (let i = 0; i < 2000; i++) diff += Math.abs(a[i]! - b[i]!);
    expect(diff).toBeGreaterThan(0.1);
  });
});
