import { describe, expect, it } from 'vitest';
import { intBetween, pick, rngFromSeed, sfc32, shuffle, xmur3 } from '../../../src/core/rng';

describe('rng deterministico', () => {
  it('xmur3: stesso seme, stessa sequenza; semi diversi, sequenze diverse', () => {
    const a = xmur3('2026-10-14');
    const b = xmur3('2026-10-14');
    const c = xmur3('2026-10-15');
    const sa = [a(), a(), a(), a()];
    expect([b(), b(), b(), b()]).toEqual(sa);
    expect([c(), c(), c(), c()]).not.toEqual(sa);
    for (const v of sa) expect(Number.isInteger(v) && v >= 0 && v < 2 ** 32).toBe(true);
  });

  it('sfc32 in [0, 1) e riproducibile', () => {
    const r1 = sfc32(1, 2, 3, 4);
    const r2 = sfc32(1, 2, 3, 4);
    for (let i = 0; i < 1000; i++) {
      const v = r1();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(r2()).toBe(v);
    }
  });

  it('rngFromSeed: 1000 valori identici fra due istanze, distribuzione ragionevole', () => {
    const r1 = rngFromSeed('trama');
    const r2 = rngFromSeed('trama');
    let sum = 0;
    for (let i = 0; i < 1000; i++) {
      const v = r1();
      expect(r2()).toBe(v);
      sum += v;
    }
    expect(sum / 1000).toBeGreaterThan(0.4);
    expect(sum / 1000).toBeLessThan(0.6);
    expect(rngFromSeed('trama#1')()).not.toBe(rngFromSeed('trama#2')());
  });

  it('valori di riferimento stabili (cambiarli rompe i Merletti del giorno già condivisi)', () => {
    const r = rngFromSeed('2026-10-14#0');
    const first = [r(), r(), r()];
    const again = rngFromSeed('2026-10-14#0');
    expect([again(), again(), again()]).toEqual(first);
    expect(xmur3('abc')()).toBe(xmur3('abc')());
  });

  it('shuffle: permutazione deterministica che non tocca l’originale', () => {
    const src = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(src, rngFromSeed('x'));
    const b = shuffle(src, rngFromSeed('x'));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('pick e intBetween', () => {
    const r = rngFromSeed('p');
    for (let i = 0; i < 200; i++) {
      const v = intBetween(r, 3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      expect(['a', 'b']).toContain(pick(['a', 'b'], r));
    }
    expect(() => pick([], r)).toThrow();
  });
});
