/**
 * Merletto del giorno: date, serie, record, testo da condividere (formato esatto
 * di GDD 8.3), determinismo del livello, esito di una notte completata
 * (DailyRecord salvato) e spartito che, reimportato, ritesse lo stesso merletto.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { DailyRecord, LevelDef, NightOutcome, RowMoves } from '../../../src/core/types';
import { createContext, dailySpec, encodeSpartito, generate, levelSourceHash, metrics, simulate, solve, spartitoRef } from '../../../src/engine/index';
import {
  dailyRecordOf,
  dateFromRef,
  dateOfDailyId,
  isBetterDaily,
  isIsoDate,
  liveStreak,
  localDate,
  mergeLaceRecord,
  nextStreak,
  previousDate,
  shareParams,
  shortDate,
} from '../../../src/screens/daily';
import { processOutcome, resultsDelayMs, shareTextOf } from '../../../src/screens/outcomes';
import { resetScreensState, resultOf } from '../../../src/screens/state';
import { resolveSpartito } from '../../../src/screens/launch';
import { makeServices } from './helpers';

describe('date', () => {
  it('data locale, giorno prima, formato breve, riferimenti', () => {
    expect(localDate(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
    expect(localDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
    expect(previousDate('2026-10-14')).toBe('2026-10-13');
    expect(previousDate('2026-03-01')).toBe('2026-02-28');
    expect(previousDate('2024-03-01')).toBe('2024-02-29');
    expect(previousDate('2027-01-01')).toBe('2026-12-31');
    expect(shortDate('2026-10-14')).toBe('14/10');
    expect(dateFromRef('20261014')).toBe('2026-10-14');
    expect(dateFromRef('20261341')).toBeNull();
    expect(dateOfDailyId('day-2026-10-14')).toBe('2026-10-14');
    expect(dateOfDailyId('lib-m12')).toBeNull();
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
  });
});

describe('serie e record', () => {
  it('la serie cresce il giorno dopo, riparte se si salta un giorno, non cambia ritessendo', () => {
    let st = nextStreak({ dailyStreak: 0 }, '2026-10-12');
    expect(st).toEqual({ dailyStreak: 1, lastDaily: '2026-10-12' });
    st = nextStreak(st, '2026-10-13');
    expect(st.dailyStreak).toBe(2);
    st = nextStreak(st, '2026-10-13');
    expect(st.dailyStreak).toBe(2);
    st = nextStreak(st, '2026-10-14');
    expect(st.dailyStreak).toBe(3);
    st = nextStreak(st, '2026-10-16');
    expect(st).toEqual({ dailyStreak: 1, lastDaily: '2026-10-16' });
    // Data più vecchia (orologio indietro): niente cambia.
    expect(nextStreak(st, '2026-10-01')).toEqual(st);
    expect(nextStreak({ dailyStreak: 9, lastDaily: '2026-12-31' }, '2027-01-01').dailyStreak).toBe(10);
  });

  it('la serie mostrata è viva solo se l’ultimo giorno è ieri o oggi', () => {
    expect(liveStreak({ dailyStreak: 4, lastDaily: '2026-10-14' }, '2026-10-14')).toBe(4);
    expect(liveStreak({ dailyStreak: 4, lastDaily: '2026-10-13' }, '2026-10-14')).toBe(4);
    expect(liveStreak({ dailyStreak: 4, lastDaily: '2026-10-12' }, '2026-10-14')).toBe(0);
    expect(liveStreak({ dailyStreak: 0 }, '2026-10-14')).toBe(0);
  });

  it('record del giorno: meno incroci, poi più quiete, poi simmetria', () => {
    const a: DailyRecord = { date: 'd', incroci: 9, min: 8, quiete: 2, simmetria: false, spartito: 'x' };
    expect(isBetterDaily(undefined, a)).toBe(true);
    expect(isBetterDaily(a, { ...a, incroci: 8 })).toBe(true);
    expect(isBetterDaily(a, { ...a, incroci: 10 })).toBe(false);
    expect(isBetterDaily(a, { ...a, quiete: 3 })).toBe(true);
    expect(isBetterDaily(a, { ...a, simmetria: true })).toBe(true);
    expect(isBetterDaily(a, { ...a })).toBe(false);
  });

  it('record d’eleganza del livello', () => {
    const m = { incroci: 9, minIncroci: 8, quiete: 1, simmetria: false, filoDOro: false };
    const r1 = mergeLaceRecord(undefined, m, 'S1');
    expect(r1).toEqual({ record: { minIncroci: 9, maxQuiete: 1, simmetria: false, filoDOro: false, bestSpartito: 'S1' }, improved: true });
    const r2 = mergeLaceRecord(r1.record, { ...m, incroci: 10, quiete: 3, simmetria: true }, 'S2');
    expect(r2.record).toEqual({ minIncroci: 9, maxQuiete: 3, simmetria: true, filoDOro: false, bestSpartito: 'S1' });
    expect(r2.improved).toBe(true);
    const r3 = mergeLaceRecord(r2.record, { ...m, incroci: 8, filoDOro: true }, 'S3');
    expect(r3.record.minIncroci).toBe(8);
    expect(r3.record.bestSpartito).toBe('S3');
    expect(mergeLaceRecord(r3.record, { ...m, incroci: 12 }, 'S4').improved).toBe(false);
  });
});

describe('testo da condividere (GDD 8.3)', () => {
  it('formato esatto in italiano', () => {
    const { s } = makeServices();
    const p = shareParams({ date: '2026-10-14', incroci: 9, min: 8, quiete: 2, simmetria: true });
    expect(s.i18n.t('ui.condividi.riga', p)).toBe('TRAMA 14/10 · 9 incroci (min 8) · 2 ore di quiete · simmetria ✦');
    expect(s.i18n.t('ui.condividi.riga', shareParams({ date: '2026-01-05', incroci: 1, min: 1, quiete: 1, simmetria: false }))).toBe(
      'TRAMA 05/01 · 1 incrocio (min 1) · 1 ora di quiete',
    );
    expect(shareTextOf(s, { date: '2026-10-14', incroci: 9, min: 8, quiete: 2, simmetria: true }, 'TRAMA1-G20261014-b._.ad.c-7k')).toBe(
      'TRAMA 14/10 · 9 incroci (min 8) · 2 ore di quiete · simmetria ✦\nTRAMA1-G20261014-b._.ad.c-7k',
    );
  });

  it('in inglese', () => {
    const { s } = makeServices({ locale: 'en' });
    const p = shareParams({ date: '2026-10-14', incroci: 9, min: 8, quiete: 2, simmetria: true });
    expect(s.i18n.t('ui.condividi.riga', p)).toBe('TRAMA 14/10 · 9 crossings (min 8) · 2 quiet hours · symmetry ✦');
  });

  it('pausa prima dei risultati', () => {
    expect(resultsDelayMs(0, false)).toBeLessThan(500);
    expect(resultsDelayMs(1, false)).toBeGreaterThan(resultsDelayMs(2, false));
  });
});

/** Esito come lo produrrebbe il tombolo per righe date. */
function outcomeFor(level: LevelDef, rows: RowMoves[], origin: NightOutcome['origin'], spartito: string): NightOutcome {
  const ctx = createContext(level, {});
  const sim = simulate(level, ctx, rows);
  return {
    origin,
    levelId: level.id,
    rows: sim.rows,
    timeline: sim.timeline,
    events: sim.events,
    goals: [],
    requests: [],
    dropped: [],
    metrics: metrics(level, sim.rows, null, false),
    spartito,
    hintsUsed: 0,
    fantasmaUsed: false,
    discoveredQuirks: [],
    nomeOn: null,
  };
}

describe('Merletto del giorno completato', () => {
  beforeEach(() => resetScreensState());

  it('stessa data → stesso livello (impronta), date diverse → livelli diversi', () => {
    const a = generate(dailySpec('2026-10-14'));
    const b = generate(dailySpec('2026-10-14'));
    expect(levelSourceHash(a.level)).toBe(levelSourceHash(b.level));
    expect(a.level.id).toBe('day-2026-10-14');
    const c = generate(dailySpec('2026-10-15'));
    expect(levelSourceHash(c.level)).not.toBe(levelSourceHash(a.level));
  });

  it('salva il DailyRecord, la serie e il testo da condividere; lo spartito reimportato ritesse lo stesso merletto', async () => {
    const date = '2026-10-14';
    const gen = generate(dailySpec(date));
    const level = gen.level;
    const sol = solve({ level, ctx: createContext(level, {}), goals: level.goals ?? [] });
    expect(sol.status).toBe('ok');
    const rows = sol.rows ?? [];
    const spartito = encodeSpartito({ mode: 'G', ref: spartitoRef('G', date), rows });
    const h = makeServices({ save: { unlocks: { daily: true, libero: true, gradi: true, cosmetics: [], tovaglia: false } } });
    const info = await processOutcome(h.s, outcomeFor(level, rows, 'giornaliero', spartito));
    expect(info).not.toBeNull();
    const d = h.s.save.data();
    const rec = d.daily[date];
    expect(rec).toEqual({ date, incroci: gen.min, min: gen.min, quiete: info?.metrics.quiete, simmetria: info?.metrics.simmetria, spartito });
    expect(d.stats.dailyStreak).toBe(1);
    expect(d.stats.lastDaily).toBe(date);
    expect(d.stats.nights).toBe(1);
    expect(d.records[level.id]?.minIncroci).toBe(gen.min);
    expect(info?.metrics.filoDOro).toBe(true);
    const first = info?.shareText?.split('\n')[0] ?? '';
    expect(first).toMatch(/^TRAMA 14\/10 · \d+ incroc(io|i) \(min \d+\) · \d+ or[ae] di quiete( · simmetria ✦)?$/);
    expect(info?.shareText?.split('\n')[1]).toBe(spartito);
    expect(resultOf('giornaliero')?.daily).toEqual(rec);

    // Un merletto peggiore lo stesso giorno non sostituisce il record e non allunga la serie.
    const worse = encodeSpartito({ mode: 'G', ref: spartitoRef('G', date), rows });
    const info2 = await processOutcome(h.s, { ...outcomeFor(level, rows, 'giornaliero', worse), fantasmaUsed: true });
    expect(info2?.dailyImproved).toBe(false);
    expect(h.s.save.data().stats.dailyStreak).toBe(1);
    expect(h.s.save.data().stats.nights).toBe(2);

    // Lo spartito copiato, reimportato, ritesse lo stesso merletto.
    const r = await resolveSpartito(h.s, `  ${spartito}\n`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.level.id).toBe(level.id);
    expect(r.params.origin).toBe('spartito');
    expect(r.params.mode).toBe('replay');
    const strip = (x: RowMoves[]): string => JSON.stringify(x.map((y) => ({ hour: y.hour, c: y.crossings.filter((c) => !c.forced).map((c) => [c.pair, c.over]) })));
    expect(strip(r.params.replay ?? [])).toBe(strip(rows));
    const replayed = simulate(level, createContext(level, {}), r.params.replay ?? []);
    expect(replayed.ok).toBe(true);
    expect(replayed.timeline[replayed.timeline.length - 1]).toEqual(simulate(level, createContext(level, {}), rows).timeline[rows.length]);
  });

  it('spartiti non validi: formato, carattere alterato, righe, giornata non tessuta', async () => {
    const h = makeServices();
    expect(await resolveSpartito(h.s, '')).toEqual({ ok: false, errorKey: 'ui.spartito.errore.vuoto' });
    expect(await resolveSpartito(h.s, 'ciao')).toEqual({ ok: false, errorKey: 'ui.spartito.errore.formato' });
    const level = generate(dailySpec('2026-10-14')).level;
    const rows = solve({ level, ctx: createContext(level, {}), goals: level.goals ?? [] }).rows ?? [];
    const good = encodeSpartito({ mode: 'G', ref: '20261014', rows });
    const i = good.indexOf('-', 8) + 1;
    const bad = good.slice(0, i) + (good[i] === 'a' ? 'c' : 'a') + good.slice(i + 1);
    expect(await resolveSpartito(h.s, bad)).toEqual({ ok: false, errorKey: 'ui.spartito.errore.formato' });
    const short = encodeSpartito({ mode: 'G', ref: '20261014', rows: rows.slice(0, 2) });
    expect(await resolveSpartito(h.s, short)).toEqual({ ok: false, errorKey: 'ui.spartito.errore.righe' });
    const story = encodeSpartito({ mode: 'S', ref: 'g00', rows: [] });
    const r = await resolveSpartito(h.s, story);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['ui.spartito.errore.nonTessuto', 'ui.spartito.errore.livello']).toContain(r.errorKey);
  });

  it('il Merletto libero completato aggiorna il record del seme', async () => {
    const h = makeServices();
    const { liberoSpec } = await import('../../../src/screens/libero');
    const gen = generate(liberoSpec('p5kq', ['senzaDisfa']));
    const level = gen.level;
    const rows = solve({ level, ctx: createContext(level, {}), goals: level.goals ?? [] }).rows ?? [];
    const sp = encodeSpartito({ mode: 'L', ref: 'p5kq', gradi: ['senzaDisfa'], rows });
    const info = await processOutcome(h.s, outcomeFor(level, rows, 'libero', sp));
    expect(info?.record?.minIncroci).toBe(gen.min);
    expect(h.s.save.data().records[level.id]?.bestSpartito).toBe(sp);
    expect(info?.gradi).toEqual(['senzaDisfa']);
    // Reimportato: stesso livello (seme e gradi dallo spartito).
    const r = await resolveSpartito(h.s, sp);
    expect(r.ok && r.level.id).toBe(level.id);
  });

  it('il record del giorno è del giorno giusto', () => {
    const rec = dailyRecordOf('2026-10-14', { incroci: 9, minIncroci: 8, quiete: 2, simmetria: true, filoDOro: false }, 8, 'S');
    expect(rec).toEqual({ date: '2026-10-14', incroci: 9, min: 8, quiete: 2, simmetria: true, spartito: 'S' });
  });
});
