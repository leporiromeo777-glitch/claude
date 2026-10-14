/**
 * Ricette degli effetti (GDD 13.2), rese in JavaScript: ogni SfxId (e i suoni interni)
 * su 2 s ha RMS > 0,001, nessun NaN e picco ≤ 1 già prima del grafo; durate delle ricette.
 * Il rendering attraverso il grafo vero (OfflineAudioContext in Chromium) lo fa
 * browser-verify.ts.
 */
import { describe, expect, it } from 'vitest';
import { EXTRA_SOUND_IDS, SFX_IDS, recipeBand, recipeVariants, renderRainLoop, renderRecipe } from '../../../src/audio/synth/sfx';
import { statsOf } from '../../../src/audio/synth/dsp';
import type { SfxId } from '../../../src/core/types';
import { seeded } from './fakeAudio';

const ALL_SFX: SfxId[] = [
  'fuso_presa', 'fuso_rilascio', 'incrocio', 'rovescia', 'lettera', 'voce', 'segreto',
  'febbre', 'cura', 'nodo', 'rifiuto', 'disfa', 'ora_fissata', 'vaporetto', 'barca',
  'gabbiano', 'pagina', 'bottiglia', 'carta', 'successo', 'fallimento', 'trabocco',
  'marea', 'nero', 'ui_tap', 'ui_indietro',
];

describe('ricette', () => {
  it('tutti gli SfxId del contratto hanno una ricetta', () => {
    expect([...SFX_IDS].sort()).toEqual([...ALL_SFX].sort());
  });

  for (const id of [...SFX_IDS, ...EXTRA_SOUND_IDS]) {
    it(`${id}: 2 s con RMS > 0,001, nessun NaN, picco ≤ 1`, () => {
      for (const sr of [44100, 48000]) {
        const rate = recipeBand(id) === 'lo' ? sr / 2 : sr;
        const b = renderRecipe(id, rate, { rand: seeded(17) });
        const two = new Float32Array(2 * rate);
        two.set(b.subarray(0, two.length));
        const s = statsOf(two);
        expect(s.nan).toBe(false);
        expect(s.rms).toBeGreaterThan(0.001);
        expect(s.peak).toBeLessThanOrEqual(1);
        expect(s.peak).toBeLessThanOrEqual(0.71);
      }
    });
  }

  it('durate delle ricette del GDD', () => {
    const sr = 44100;
    const len = (id: Parameters<typeof renderRecipe>[0]): number => {
      const rate = recipeBand(id) === 'lo' ? sr / 2 : sr;
      return renderRecipe(id, rate, { rand: seeded(3) }).length / rate;
    };
    expect(len('lettera')).toBeCloseTo(0.06, 2);
    expect(len('voce')).toBeCloseTo(0.2, 2);
    expect(len('febbre')).toBeCloseTo(0.4, 2);
    expect(len('nodo')).toBeCloseTo(0.5, 2);
    expect(len('vaporetto')).toBeCloseTo(1.5, 2);
    expect(len('barca')).toBeCloseTo(2, 2);
    expect(len('marea')).toBeCloseTo(2, 2);
    expect(len('nero')).toBeCloseTo(2, 2);
    expect(len('tuono')).toBeCloseTo(2.5, 2);
  });

  it('il rifiuto contiene la sillaba di Marta, il tonfo no', () => {
    const sr = 44100;
    const a = renderRecipe('rifiuto', sr, { rand: seeded(5) });
    const b = renderRecipe('tonfo', sr, { rand: seeded(5) });
    // Mentre il legno si spegne, nel rifiuto c'è la voce (35-130 ms).
    const tail = (x: Float32Array): number => statsOf(x.subarray(Math.round(0.07 * sr), Math.round(0.12 * sr))).rms;
    expect(tail(a)).toBeGreaterThan(tail(b) * 3);
  });

  it('varianti e bande', () => {
    expect(recipeVariants('incrocio')).toBeGreaterThan(recipeVariants('vaporetto'));
    expect(recipeBand('vaporetto')).toBe('lo');
    expect(recipeBand('lettera')).toBe('hi');
  });

  it('pioggia granulare in loop', () => {
    const sr = 22050;
    const r = renderRainLoop(sr, 4, seeded(9));
    expect(r.length).toBe(4 * sr);
    const s = statsOf(r);
    expect(s.nan).toBe(false);
    expect(s.rms).toBeGreaterThan(0.01);
  });
});
