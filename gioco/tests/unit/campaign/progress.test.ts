/**
 * Progressione (GDD 3.14, 7): record di eleganza, fili d'oro e fusi intagliati,
 * sblocchi di fine giornata e dei finali.
 */
import { describe, expect, it } from 'vitest';
import type { LaceMetrics } from '../../../src/core/types';
import { dayUnlocks, endingUnlocks, goldUnlocks, recordNight, updateRecord, unlockEverything, DAY_UNLOCKS, GOLD_COSMETICS } from '../../../src/campaign/progress';
import { emptySave } from './helpers';

const m = (incroci: number, quiete: number, extra: Partial<LaceMetrics> = {}): LaceMetrics => ({ incroci, minIncroci: 3, quiete, simmetria: false, filoDOro: incroci === 3, ...extra });

describe('record di eleganza', () => {
  it('il primo merletto fa il record senza "miglioramenti"; poi migliora campo per campo', () => {
    const a = updateRecord(null, m(5, 2), 'AAA');
    expect(a.after).toEqual({ minIncroci: 5, maxQuiete: 2, simmetria: false, filoDOro: false, bestSpartito: 'AAA' });
    expect(a.improved).toEqual([]);
    const b = updateRecord(a.after, m(3, 1, { simmetria: true }), 'BBB');
    expect(b.after).toMatchObject({ minIncroci: 3, maxQuiete: 2, simmetria: true, filoDOro: true, bestSpartito: 'BBB' });
    expect(b.improved).toEqual(['incroci', 'simmetria', 'filoDOro']);
    const c = updateRecord(b.after, m(4, 6), 'CCC');
    expect(c.after).toMatchObject({ minIncroci: 3, maxQuiete: 6, simmetria: true, filoDOro: true, bestSpartito: 'BBB' });
    expect(c.improved).toEqual(['quiete']);
  });

  it('recordNight: notti, fili d’oro una volta per livello, fusi a 3, 8, 15, 22', () => {
    const d = emptySave();
    const first = recordNight(d, 'g01', m(3, 0), 'x');
    expect(first.goldThread).toBe(true);
    expect(first.improved).toEqual(['filoDOro']);
    const again = recordNight(d, 'g01', m(3, 4), 'y');
    expect(again.goldThread).toBe(false);
    expect(d.stats).toMatchObject({ nights: 2, goldThreads: 1 });
    recordNight(d, 'g02', m(3, 0), 'x');
    const third = recordNight(d, 'g03', m(3, 0), 'x');
    expect(third.unlocked).toEqual(['cosmetic:stile_1']);
    expect(d.unlocks.cosmetics).toEqual(['stile_1']);
    for (let i = 4; i <= 8; i++) recordNight(d, `g0${i}`, m(3, 0), 'x');
    expect(d.stats.goldThreads).toBe(8);
    expect(d.unlocks.cosmetics).toEqual(['stile_1', 'stile_2']);
    // Un merletto senza filo d'oro non conta.
    recordNight(d, 'g10', m(7, 0), 'x');
    expect(d.stats.goldThreads).toBe(8);
    expect(GOLD_COSMETICS.map((g) => g.at)).toEqual([3, 8, 15, 22]);
    expect(goldUnlocks(d.unlocks, 22)).toEqual(['cosmetic:stile_3', 'cosmetic:stile_4']);
    expect(goldUnlocks(d.unlocks, 22)).toEqual([]);
  });
});

describe('sblocchi (GDD 7)', () => {
  it('g07 → giornaliero, g08 → libero, g16 → gradi; una volta sola', () => {
    const d = emptySave();
    expect(DAY_UNLOCKS).toEqual({ g07: 'daily', g08: 'libero', g16: 'gradi' });
    expect(dayUnlocks(d.unlocks, 'g06')).toEqual([]);
    expect(dayUnlocks(d.unlocks, 'g07')).toEqual(['daily']);
    expect(dayUnlocks(d.unlocks, 'g07')).toEqual([]);
    expect(dayUnlocks(d.unlocks, 'g08')).toEqual(['libero']);
    expect(dayUnlocks(d.unlocks, 'g16')).toEqual(['gradi']);
    expect(d.unlocks).toMatchObject({ daily: true, libero: true, gradi: true, tovaglia: false });
  });

  it('il ritorno a g23 (chiuso) non sblocca; il primo finale dà i fusi; il vero la Tovaglia', () => {
    const d = emptySave();
    expect(endingUnlocks(d.unlocks, 'chiuso', false)).toEqual([]);
    expect(d.unlocks.cosmetics).toEqual([]);
    expect(endingUnlocks(d.unlocks, 'merlettaia', true)).toEqual(GOLD_COSMETICS.map((g) => `cosmetic:${g.id}`));
    expect(d.unlocks.tovaglia).toBe(false);
    expect(endingUnlocks(d.unlocks, 'aperto', true)).toEqual(['tovaglia']);
    expect(d.unlocks.tovaglia).toBe(true);
    const e = emptySave();
    unlockEverything(e.unlocks);
    expect(e.unlocks).toMatchObject({ daily: true, libero: true, gradi: true, tovaglia: true });
    expect(e.unlocks.cosmetics).toHaveLength(4);
  });
});
