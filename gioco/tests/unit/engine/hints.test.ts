/**
 * Suggerimenti (GDD 14) ed eleganza (GDD 3.14).
 */
import { describe, expect, it } from 'vitest';
import type { LaceState, RowMoves } from '../../../src/core/types';
import { HINT_KEYS, createContext, hintFor, initialState, isSymmetric, metrics, simulate } from '../../../src/engine/index';
import { fixture, mk, noteRequest } from './helpers';

const g00 = fixture('g00');
const ctx = createContext(g00, {});
const goals = g00.goals ?? [];

function at(rows: RowMoves[]): LaceState[] {
  const sim = simulate(g00, ctx, rows);
  expect(sim.ok).toBe(true);
  return sim.timeline;
}

describe('suggerimenti', () => {
  it('fantasma: l\'incrocio giusto della riga corrente', () => {
    const h = hintFor({ level: g00, ctx, timeline: [initialState(g00, ctx)], rows: [], goals, tier: 'fantasma' });
    expect(h).toMatchObject({ tier: 'fantasma', textKey: HINT_KEYS.fantasma, ghost: { pair: 0, over: 'R' }, params: { ora: 6, sopra: 'marta', sotto: 'teresa' } });
  });

  it('indizio: chi deve passare sopra chi', () => {
    const rows: RowMoves[] = [{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }];
    const h = hintFor({ level: g00, ctx, timeline: at(rows), rows, goals, tier: 'indizio' });
    expect(h).toMatchObject({ tier: 'indizio', textKey: HINT_KEYS.indizioSopra, params: { ora: 7, sopra: 'teresa', sotto: 'piero' } });
  });

  it('spinta: lo spillo più urgente, con la frase del livello', () => {
    const h = hintFor({ level: g00, ctx, timeline: [initialState(g00, ctx)], rows: [], goals, tier: 'spinta' });
    expect(h).toMatchObject({ tier: 'spinta', textKey: 'atto1.g00.hint.spinta', highlight: { hour: 6, column: 0, pin: { thread: 'marta', place: 'forno', hour: 6 } } });
  });

  it('spinta senza frase del livello: chiave generica dello spillo', () => {
    const level = { ...g00, hintKeys: undefined };
    const h = hintFor({ level, ctx: createContext(level, {}), timeline: [initialState(level, ctx)], rows: [], goals, tier: 'spinta' });
    expect(h.textKey).toBe(HINT_KEYS.spintaSpillo);
    expect(h.params).toEqual({ chi: 'marta', luogo: 'forno', ora: 6 });
  });

  it('dopo un verso sbagliato la soluzione si ricalcola dallo stato corrente', () => {
    const solution: RowMoves[] = [
      { hour: 6, crossings: [{ pair: 0, over: 'R' }] },
      { hour: 7, crossings: [{ pair: 1, over: 'L' }] },
      { hour: 8, crossings: [{ pair: 1, over: 'L' }] },
      { hour: 9, crossings: [{ pair: 0, over: 'L' }] },
    ];
    const rows: RowMoves[] = [solution[0] as RowMoves, { hour: 7, crossings: [{ pair: 1, over: 'R' }] }];
    const h = hintFor({ level: g00, ctx, timeline: at(rows), rows, goals, tier: 'fantasma', solution });
    // Piero è passato sopra: ora Teresa (a destra) deve passare sopra Piero.
    expect(h.ghost).toEqual({ pair: 1, over: 'R' });
    // Con la soluzione che combacia, si usa quella.
    const h2 = hintFor({ level: g00, ctx, timeline: at([solution[0] as RowMoves]), rows: [solution[0] as RowMoves], goals, tier: 'fantasma', solution });
    expect(h2.ghost).toEqual({ pair: 1, over: 'L' });
  });

  it('da uno stato senza uscita: lo dice', () => {
    const rows: RowMoves[] = [{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }, { hour: 7, crossings: [] }, { hour: 8, crossings: [] }];
    const h = hintFor({ level: g00, ctx, timeline: at(rows), rows, goals, tier: 'fantasma' });
    expect(h.textKey).toBe(HINT_KEYS.impossibile);
    expect(h.ghost).toBeUndefined();
  });

  it('una riga in cui non serve nessun incrocio', () => {
    const g06 = fixture('g06');
    const c6 = createContext(g06, {});
    const h = hintFor({ level: g06, ctx: c6, timeline: [initialState(g06, c6)], rows: [], goals: [noteRequest('g06.nina')], tier: 'fantasma' });
    expect(h.textKey).toBe(HINT_KEYS.fantasmaQuiete);
    expect(h.params).toEqual({ ora: 7 });
  });
});

describe('eleganza', () => {
  const sol: RowMoves[] = [
    { hour: 6, crossings: [{ pair: 0, over: 'R' }] },
    { hour: 7, crossings: [{ pair: 1, over: 'L' }] },
    { hour: 8, crossings: [{ pair: 1, over: 'L' }] },
    { hour: 9, crossings: [{ pair: 0, over: 'L' }] },
  ];

  it('incroci, quiete, simmetria, filo d\'oro', () => {
    expect(metrics(g00, sol, 4, false)).toEqual({ incroci: 4, minIncroci: 4, quiete: 0, simmetria: false, filoDOro: true });
    expect(metrics(g00, sol, 4, true).filoDOro).toBe(false);
    expect(metrics(g00, sol, 3, false).filoDOro).toBe(false);
    expect(metrics(g00, sol, null, false).filoDOro).toBe(false);
  });

  it('quiete: righe senza incroci del giocatore (i forzati non contano)', () => {
    const level = mk({ initial: ['a', 'b', 'c', 'd'] });
    const rows: RowMoves[] = [
      { hour: 7, crossings: [] },
      { hour: 8, crossings: [{ pair: 1, over: 'L', forced: true }] },
      { hour: 9, crossings: [{ pair: 0, over: 'L' }] },
    ];
    expect(metrics(level, rows, null, false)).toMatchObject({ incroci: 1, quiete: 2 });
  });

  it('simmetria rispetto all\'asse verticale', () => {
    expect(isSymmetric(4, [{ hour: 7, crossings: [{ pair: 0, over: 'L' }, { pair: 2, over: 'L' }] }, { hour: 8, crossings: [{ pair: 1, over: 'R' }] }])).toBe(true);
    expect(isSymmetric(4, [{ hour: 7, crossings: [{ pair: 0, over: 'L' }] }])).toBe(false);
    expect(isSymmetric(5, [{ hour: 7, crossings: [{ pair: 1, over: 'L' }] }, { hour: 8, crossings: [] }])).toBe(false);
    expect(isSymmetric(5, [{ hour: 7, crossings: [{ pair: 0, over: 'L' }, { pair: 3, over: 'R' }] }])).toBe(true);
    expect(isSymmetric(3, [{ hour: 7, crossings: [] }])).toBe(false);
  });
});
