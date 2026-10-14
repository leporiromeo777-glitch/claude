/**
 * Spartito (ARCHITETTURA 14.6): andata e ritorno su 200 merletti casuali, un
 * carattere alterato viene rilevato, esempio del GDD, ore vere del livello.
 */
import { describe, expect, it } from 'vitest';
import type { Crossing, GradoId, RowMoves } from '../../../src/core/types';
import { rngFromSeed, intBetween, pick } from '../../../src/core/rng';
import { createContext, decodeSpartito, encodeSpartito, simulate, solve, spartitoRef, spartitoRows } from '../../../src/engine/index';
import type { Spartito } from '../../../src/engine/index';
import { fixture } from './helpers';

const GRADI: GradoId[] = ['matassaEsatta', 'senzaDisfa', 'spilliVelati', 'nodoInPiu', 'neroInPiu', 'notteCorta'];

function randomSpartito(i: number): Spartito {
  const rng = rngFromSeed(`spartito-${i}`);
  const W = intBetween(rng, 3, 6);
  const n = intBetween(rng, 1, 14);
  const rows: RowMoves[] = [];
  for (let h = 1; h <= n; h++) {
    const crossings: Crossing[] = [];
    let p = 0;
    while (p < W - 1) {
      if (rng() < 0.45) {
        crossings.push({ pair: p, over: rng() < 0.5 ? 'L' : 'R' });
        p += 2;
      } else p += 1;
    }
    rows.push({ hour: h, crossings });
  }
  const mode = pick(['S', 'G', 'L'] as const, rng);
  const ref = mode === 'S' ? pick(['g00', 'g06', 'g23', 'arc1', 'fin_aperto'], rng) : mode === 'G' ? `2026${String(intBetween(rng, 1, 12)).padStart(2, '0')}${String(intBetween(rng, 1, 28)).padStart(2, '0')}` : Math.floor(rng() * 1e9).toString(36);
  const s: Spartito = { mode, ref, rows };
  if (mode === 'L' && rng() < 0.6) s.gradi = GRADI.filter(() => rng() < 0.4);
  if (s.gradi && s.gradi.length === 0) delete s.gradi;
  return s;
}

describe('spartito', () => {
  const samples = Array.from({ length: 200 }, (_, i) => randomSpartito(i));

  it('andata e ritorno su 200 merletti casuali', () => {
    for (const s of samples) {
      const str = encodeSpartito(s);
      expect(str.startsWith('TRAMA1-')).toBe(true);
      expect(decodeSpartito(str)).toEqual(s);
    }
  });

  it('un carattere alterato viene rilevato', () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789._~+-';
    let checked = 0;
    for (const [i, s] of samples.entries()) {
      const str = encodeSpartito(s);
      const rng = rngFromSeed(`alterato-${i}`);
      const pos = intBetween(rng, 7, str.length - 1);
      const orig = str[pos] as string;
      const choices = alphabet.split('').filter((ch) => ch !== orig);
      const bad = str.slice(0, pos) + pick(choices, rng) + str.slice(pos + 1);
      expect(decodeSpartito(bad), `${str} → ${bad}`).toBeNull();
      checked++;
    }
    expect(checked).toBe(200);
  });

  it('l\'esempio del GDD è uno spartito valido', () => {
    const s = decodeSpartito('TRAMA1-G20261014-b._.ad.c-7k');
    expect(s).toEqual({
      mode: 'G',
      ref: '20261014',
      rows: [
        { hour: 1, crossings: [{ pair: 0, over: 'R' }] },
        { hour: 2, crossings: [] },
        { hour: 3, crossings: [{ pair: 0, over: 'L' }, { pair: 1, over: 'R' }] },
        { hour: 4, crossings: [{ pair: 1, over: 'L' }] },
      ],
    });
    expect(decodeSpartito('TRAMA1-G20261014-b._.ad.c-k7')).toBeNull();
  });

  it('gli incroci forzati non si scrivono; le ore vere tornano con spartitoRows', () => {
    const level = fixture('test-nero');
    const ctx = createContext(level, {});
    const r = solve({ level, ctx, goals: level.goals ?? [] });
    const sim = simulate(level, ctx, r.rows ?? []);
    expect(sim.rows.some((row) => row.crossings.some((c) => c.forced))).toBe(true);
    const str = encodeSpartito({ mode: 'S', ref: level.id.replace('-', '_'), rows: sim.rows });
    const back = decodeSpartito(str);
    expect(back).not.toBeNull();
    const rows = spartitoRows(level, back as Spartito);
    expect(rows.map((x) => x.hour)).toEqual(sim.rows.map((x) => x.hour));
    // Riapplicato, lo spartito ritesse lo stesso merletto (i forzati si ricalcolano).
    const again = simulate(level, ctx, rows);
    expect(again.ok).toBe(true);
    expect(again.rows).toEqual(sim.rows);
  });

  it('riferimenti', () => {
    expect(spartitoRef('G', '2026-10-14')).toBe('20261014');
    expect(spartitoRef('L', 123456)).toBe((123456).toString(36));
    expect(() => encodeSpartito({ mode: 'G', ref: '2026-10-14', rows: [] })).toThrow();
    expect(decodeSpartito('qualcosa')).toBeNull();
    expect(decodeSpartito('')).toBeNull();
  });
});
