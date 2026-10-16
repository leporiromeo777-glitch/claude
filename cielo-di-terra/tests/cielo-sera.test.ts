/**
 * Il cielo della sera e dell'alba (rifinitura «mondo»): ore dorate larghe, fase rosa mentre la
 * Linea si ritira, luce più radente; le grandezze che usa il gioco (sunIntensity per le termiche
 * del Velo, night) restano quelle di prima.
 */
import { describe, expect, it } from 'vitest';
import { computeSky } from '../src/world/sky';
import { applySky, createWorldUniforms } from '../src/render/uniforms';

const rosato = (c: [number, number, number]) => c[0] > c[2] && c[0] > c[1];

describe('tramonto e fase rosa', () => {
  it('a mezzogiorno niente oro né rosa; alle 19:48 piena luce dorata', () => {
    const m = computeSky(12.75);
    expect(m.golden).toBe(0);
    expect(m.rosa).toBe(0);
    expect(m.forzaLuce).toBe(1);
    const s = computeSky(19.8);
    expect(s.golden).toBeGreaterThan(0.8);
    // la foschia della sera è calda (pesca), non lilla di giorno
    expect(s.hazeColor[0]).toBeGreaterThan(s.hazeColor[2]);
    expect(s.forzaLuce).toBeGreaterThan(1.1);
  });

  it('alle 20:24 il cielo passa dal rosa prima del blu della notte', () => {
    const s = computeSky(20.4);
    expect(s.rosa).toBeGreaterThan(0.5);
    expect(s.night).toBeGreaterThan(0.5);
    const notte = computeSky(23);
    expect(notte.rosa).toBe(0);
    // più rosa e più chiaro della notte piena
    expect(s.hazeColor[0] - s.hazeColor[2]).toBeGreaterThan(notte.hazeColor[0] - notte.hazeColor[2]);
    expect(s.hazeColor[0]).toBeGreaterThan(notte.hazeColor[0]);
  });

  it('anche prima dell’alba c’è la fase rosa (la miccia a metà)', () => {
    expect(computeSky(5.75).rosa).toBeGreaterThan(0.5);
  });

  it('le ore dorate fanno la luce più radente', () => {
    expect(computeSky(19.8).coreFlat).toBeLessThan(0.35);
    expect(computeSky(12.75).coreFlat).toBeCloseTo(1, 5);
  });

  it('sunIntensity e night non cambiano (le termiche del Velo e la regia le leggono)', () => {
    for (const h of [5.6, 6, 7, 12, 19.6, 20.4, 21.5]) {
      const s = computeSky(h);
      const lit = h < 5.5 || h >= 21 ? 0 : h < 6 ? (h - 5.5) / 0.5 : h < 19.5 ? 1 : 1 - (h - 19.5) / 1.5;
      const dayK = lit * lit * (3 - 2 * lit);
      expect(s.sunIntensity).toBeCloseTo(0.1 + 0.9 * dayK, 6);
      expect(s.night).toBeCloseTo(1 - dayK, 6);
    }
  });

  it('la forza della luce dorata arriva allo shader in uSole.w', () => {
    const u = createWorldUniforms();
    const s = computeSky(19.8);
    applySky(u, s);
    expect(u.uSole.value.w).toBeCloseTo(s.forzaLuce, 6);
    expect(rosato(computeSky(20.4).hazeColor)).toBe(true);
  });
});
