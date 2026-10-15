/**
 * Parametri delle violazioni e dei rapporti delle condizioni (revisione 1, C13):
 * bloccato {chi, causa}, occupato {a, b, nero}, corre {chi, vicino}; finestre
 * orarie (dalle, alle) nei motivi di incontra, nonIncontra e sopra; chiavi di
 * dettaglio in engineTextKeys e violationTextKey.
 */
import { describe, expect, it } from 'vitest';
import type { Condition, CondReport, Crossing, LaceState, LevelDef, Violation } from '../../../src/core/types';
import { VIOLATION_DETAIL_KEYS, applyRow, checkCrossing, createContext, engineTextKeys, evaluate, initialState, simulate, violationTextKey } from '../../../src/engine/index';
import { mk } from './helpers';

const c = (pair: number, over: 'L' | 'R'): Crossing => ({ pair, over });

function first(level: LevelDef, draft: Crossing[], tweak?: (s: LaceState) => LaceState, setup: Crossing[][] = []): Violation | undefined {
  const ctx = createContext(level, {});
  let s = initialState(level, ctx);
  for (const r of setup) s = applyRow(level, s, r, ctx).state;
  if (tweak) s = tweak(s);
  return applyRow(level, s, draft, ctx).violations[0];
}

const nero = (follow: string[], hour = 6, side: 'molo' | 'faro' = 'faro'): Partial<LevelDef> => ({
  rules: ['incrocio', 'nero'],
  nero: { thread: 'livia', enter: { hour, side }, agenda: follow.map((f) => ({ follow: f })) },
});

describe('violazioni con i parametri di C13', () => {
  it('bloccato da un nodo: {chi, causa: nodo}', () => {
    const v = first(mk({ initial: ['nina', 'marta', 'piero'] }), [c(0, 'L')], (s) => ({ ...s, knotted: ['marta'] }));
    expect(v).toMatchObject({ code: 'bloccato', messageKey: 'tombolo.violazione.bloccato', threads: ['marta'], params: { chi: 'marta', causa: 'nodo' } });
    expect(violationTextKey(v as Violation)).toBe('tombolo.violazione.bloccato.nodo');
  });

  it('bloccato dall\'acqua alta: {chi, causa: marea}', () => {
    const v = first(mk({ initial: ['bepi', 'nina', 'marta'], tide: [{ from: 7, to: 7, places: ['forno'] }] }), [c(0, 'L')]);
    expect(v).toMatchObject({ code: 'bloccato', params: { chi: 'nina', causa: 'marea' } });
    expect(violationTextKey(v as Violation)).toBe('tombolo.violazione.bloccato.marea');
  });

  it('bloccati tutti e due: chi è il primo da sinistra, con la sua causa', () => {
    const level = mk({ initial: ['bepi', 'nina', 'marta'], tide: [{ from: 7, to: 7, places: ['forno'] }] });
    const v = first(level, [c(0, 'L')], (s) => ({ ...s, knotted: ['bepi'] }));
    expect(v).toMatchObject({ threads: ['bepi', 'nina'], params: { chi: 'bepi', causa: 'nodo' } });
  });

  it('occupato dal filo nero: {a, b, nero}', () => {
    const level = mk({ initial: ['nina', 'marta', 'zeno', 'livia'], kinds: { livia: 'nero' }, ...nero(['zeno']) });
    const v = first(level, [c(1, 'L')]);
    expect(v).toMatchObject({ code: 'occupato', messageKey: 'tombolo.violazione.occupato', threads: ['zeno', 'livia'], params: { a: 'zeno', b: 'livia', nero: 'livia' } });
    expect(violationTextKey(v as Violation)).toBe('tombolo.violazione.occupato.nero');
    // Lo stesso durante il trascinamento.
    const ctx = createContext(level, {});
    expect(checkCrossing(level, initialState(level, ctx), [], c(1, 'L'), ctx)?.params).toEqual({ a: 'zeno', b: 'livia', nero: 'livia' });
  });

  it('occupato da un filo autonomo dell\'autotessitura: nero è quel filo', () => {
    const level = mk({
      initial: ['nina', 'marta', 'zeno', 'bepi'],
      autoweave: { agents: [{ thread: 'zeno', agenda: [{ place: 'molo', hour: 10 }], likes: [] }, { thread: 'marta', agenda: [{ place: 'chiesa', hour: 10 }], likes: [] }], controlled: 'nina' },
    });
    const v = first(level, [c(1, 'L')]);
    expect(v?.code).toBe('forzato');
    expect(v?.params?.nero).toBeDefined();
  });

  it('forzato: il giocatore tocca l\'incrocio annunciato del filo nero (nero)', () => {
    const level = mk({ initial: ['nina', 'marta', 'zeno', 'livia'], kinds: { livia: 'nero' }, ...nero(['zeno']) });
    const v = first(level, [c(2, 'L')]);
    expect(v).toMatchObject({ code: 'forzato', params: { nero: 'livia' } });
    expect(violationTextKey(v as Violation)).toBe('tombolo.violazione.forzato');
  });

  it('corre: {chi, vicino}', () => {
    const v = first(mk({ initial: ['marta', 'gino', 'piero'], quirks: ['ginoCorre'] }), [], undefined, [[]]);
    expect(v).toMatchObject({ code: 'corre', messageKey: 'tombolo.violazione.corre', params: { chi: 'gino', vicino: 'marta' } });
    expect(violationTextKey(v as Violation)).toBe('tombolo.violazione.corre');
  });

  it('senza parametri di dettaglio si resta sulla chiave generica', () => {
    expect(violationTextKey({ code: 'bloccato', messageKey: 'tombolo.violazione.bloccato', params: { chi: 'nina' } })).toBe('tombolo.violazione.bloccato');
    expect(violationTextKey({ code: 'bloccato', messageKey: 'tombolo.violazione.finita' })).toBe('tombolo.violazione.finita');
    expect(violationTextKey({ code: 'occupato', messageKey: 'tombolo.violazione.occupato', params: { a: 'x', b: 'y' } })).toBe('tombolo.violazione.occupato');
  });

  it('engineTextKeys comprende le chiavi di dettaglio', () => {
    const keys = new Set(engineTextKeys());
    for (const k of VIOLATION_DETAIL_KEYS) expect(keys.has(k), k).toBe(true);
    expect(keys.has('tombolo.violazione.corre')).toBe(true);
  });
});

describe('rapporti delle condizioni con la finestra oraria (C13)', () => {
  // molo forno piazza chiesa; righe 7-10: 7 marta nina piero bepi · 8 marta piero nina bepi · 9 marta piero bepi nina
  const A = mk({ initial: ['nina', 'marta', 'piero', 'bepi'] });
  const rowsA = [[c(0, 'R')], [c(1, 'L')], [c(2, 'L')], []];

  function reports(conds: Condition[], final: boolean, upTo?: number): CondReport[] {
    const ctx = createContext(A, {});
    const sim = simulate(A, ctx, rowsA.map((cr, i) => ({ hour: A.startHour + 1 + i, crossings: cr })));
    const n = upTo ?? sim.timeline.length;
    return evaluate(A, sim.timeline.slice(0, n), sim.events.slice(0, n - 1), conds, ctx, final);
  }

  it('incontra con la finestra, fallita: dalle e alle', () => {
    const [r] = reports([{ t: 'incontra', a: 'nina', b: 'bepi', from: 7, to: 8 }], true);
    expect(r).toEqual({ status: 'fallita', reasonKey: 'tombolo.cond.fallita.incontra', params: { a: 'nina', b: 'bepi', dalle: 7, alle: 8 } });
  });

  it('incontra con il solo limite: dalle è la prima riga', () => {
    const [r] = reports([{ t: 'incontra', a: 'marta', b: 'bepi', to: 9 }], true);
    expect(r?.params).toEqual({ a: 'marta', b: 'bepi', dalle: 7, alle: 9 });
  });

  it('incontra ormai impossibile (perso): anche lì dalle e alle', () => {
    const [r] = reports([{ t: 'incontra', a: 'marta', b: 'bepi', from: 7, to: 9 }], false, 3);
    expect(r).toEqual({ status: 'fallita', reasonKey: 'tombolo.cond.perso.incontra', params: { a: 'marta', b: 'bepi', dalle: 7, alle: 9 } });
  });

  it('incontra senza finestra: niente dalle e alle', () => {
    const [r] = reports([{ t: 'incontra', a: 'marta', b: 'bepi' }], true);
    expect(r).toEqual({ status: 'fallita', reasonKey: 'tombolo.cond.fallita.incontra', params: { a: 'marta', b: 'bepi' } });
  });

  it('nonIncontra con la finestra: dalle e alle', () => {
    const [r] = reports([{ t: 'nonIncontra', a: 'nina', b: 'piero', from: 8, to: 9 }], true);
    expect(r).toEqual({ status: 'fallita', reasonKey: 'tombolo.cond.fallita.nonIncontra', params: { a: 'nina', b: 'piero', dalle: 8, alle: 9 } });
  });

  it('sopra entro un\'ora: alle', () => {
    const [r] = reports([{ t: 'sopra', a: 'nina', b: 'bepi', to: 8 }], true);
    expect(r).toEqual({ status: 'fallita', reasonKey: 'tombolo.cond.fallita.sopra', params: { a: 'nina', b: 'bepi', alle: 8 } });
    const [free] = reports([{ t: 'sopra', a: 'nina', b: 'marta' }], true);
    expect(free?.params).toEqual({ a: 'nina', b: 'marta' });
  });
});
