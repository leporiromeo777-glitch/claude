/**
 * Condizioni (GDD 3.12): valutazione su una timeline, stati intermedi
 * (in corso, a rischio) e finali, combinatori.
 */
import { describe, expect, it } from 'vitest';
import type { Condition, CondReport, Crossing, LevelDef } from '../../../src/core/types';
import { createContext, evaluate, simulate } from '../../../src/engine/index';
import { F, L, V, mk } from './helpers';

const c = (pair: number, over: 'L' | 'R'): Crossing => ({ pair, over });

function statuses(level: LevelDef, rows: Crossing[][], conds: Condition[], final: boolean, upTo?: number): CondReport['status'][] {
  const ctx = createContext(level, {});
  const sim = simulate(
    level,
    ctx,
    rows.map((cr, i) => ({ hour: level.startHour + 1 + i, crossings: cr })),
  );
  expect(sim.ok).toBe(true);
  const n = upTo ?? sim.timeline.length;
  return evaluate(level, sim.timeline.slice(0, n), sim.events.slice(0, n - 1), conds, ctx, final).map((r) => r.status);
}

describe('condizioni sul merletto', () => {
  // molo forno piazza chiesa; righe 7-10
  const A = mk({ initial: ['nina', 'marta', 'piero', 'bepi'], beads: [L('L1', 'nina', 'piero'), V('voce:x', ['bepi'])] });
  const rowsA = [[c(0, 'R')], [c(1, 'L')], [c(2, 'L')], []];
  // 7: marta nina piero bepi · 8: marta piero nina bepi (L1 consegnata) · 9: marta piero bepi nina (voce a nina)

  const table: [string, Condition, CondReport['status']][] = [
    ['presso all\'ora giusta', { t: 'presso', who: 'nina', place: 'piazza', hour: 8 }, 'soddisfatta'],
    ['presso mancato', { t: 'presso', who: 'nina', place: 'molo', hour: 7 }, 'fallita'],
    ['maiPresso violato', { t: 'maiPresso', who: 'marta', place: 'molo', from: 8, to: 10 }, 'fallita'],
    ['maiPresso rispettato', { t: 'maiPresso', who: 'bepi', place: 'molo', from: 6, to: 10 }, 'soddisfatta'],
    ['incontra nell\'intervallo', { t: 'incontra', a: 'nina', b: 'piero', from: 7, to: 8 }, 'soddisfatta'],
    ['incontra fuori intervallo', { t: 'incontra', a: 'nina', b: 'bepi', from: 7, to: 8 }, 'fallita'],
    ['incontra senza intervallo (tutta la giornata)', { t: 'incontra', a: 'bepi', b: 'nina' }, 'soddisfatta'],
    ['nonIncontra con * (un filo con nome)', { t: 'nonIncontra', a: 'marta', b: '*' }, 'fallita'],
    ['nonIncontra con * e intervallo', { t: 'nonIncontra', a: 'piero', b: '*', from: 9, to: 10 }, 'soddisfatta'],
    ['nonIncontra rispettato', { t: 'nonIncontra', a: 'bepi', b: 'marta' }, 'soddisfatta'],
    ['sopra', { t: 'sopra', a: 'nina', b: 'piero' }, 'soddisfatta'],
    ['sopra con il verso sbagliato', { t: 'sopra', a: 'nina', b: 'marta' }, 'fallita'],
    ['sopra entro un\'ora passata', { t: 'sopra', a: 'nina', b: 'bepi', to: 8 }, 'fallita'],
    ['consegnata entro l\'ora', { t: 'consegnata', bead: 'L1', by: 8 }, 'soddisfatta'],
    ['consegnata in ritardo', { t: 'consegnata', bead: 'L1', by: 7 }, 'fallita'],
    ['ha entro l\'ora', { t: 'ha', who: 'nina', bead: 'voce:x', by: 9 }, 'soddisfatta'],
    ['ha mai', { t: 'ha', who: 'marta', bead: 'voce:x' }, 'fallita'],
    ['nonHa rispettato', { t: 'nonHa', who: 'piero', bead: 'voce:x' }, 'soddisfatta'],
    ['nonHa violato', { t: 'nonHa', who: 'nina', bead: 'voce:x' }, 'fallita'],
    ['incontriAlmeno raggiunto', { t: 'incontriAlmeno', who: 'nina', n: 3 }, 'soddisfatta'],
    ['incontriAlmeno mancato', { t: 'incontriAlmeno', who: 'marta', n: 2 }, 'fallita'],
    [
      'tutti',
      { t: 'tutti', of: [{ t: 'presso', who: 'nina', place: 'piazza', hour: 8 }, { t: 'consegnata', bead: 'L1', by: 8 }] },
      'soddisfatta',
    ],
    ['tutti con una parte fallita', { t: 'tutti', of: [{ t: 'consegnata', bead: 'L1', by: 8 }, { t: 'nonHa', who: 'nina', bead: 'voce:x' }] }, 'fallita'],
    ['almeno 1 di 2', { t: 'almeno', n: 1, of: [{ t: 'nonHa', who: 'nina', bead: 'voce:x' }, { t: 'sopra', a: 'nina', b: 'piero' }] }, 'soddisfatta'],
    ['almeno 2 di 2 con una fallita', { t: 'almeno', n: 2, of: [{ t: 'nonHa', who: 'nina', bead: 'voce:x' }, { t: 'sopra', a: 'nina', b: 'piero' }] }, 'fallita'],
    ['non', { t: 'non', c: { t: 'sopra', a: 'nina', b: 'marta' } }, 'soddisfatta'],
    ['non di una soddisfatta', { t: 'non', c: { t: 'incontra', a: 'nina', b: 'piero' } }, 'fallita'],
  ];

  it.each(table)('%s', (_n, cond, want) => {
    expect(statuses(A, rowsA, [cond], true)).toEqual([want]);
  });

  it('a metà giornata: in corso, già impossibili (fallite, Q015), già decise', () => {
    const conds: Condition[] = [
      { t: 'presso', who: 'nina', place: 'piazza', hour: 8 },
      { t: 'presso', who: 'bepi', place: 'molo', hour: 8 },
      { t: 'consegnata', bead: 'L1', by: 8 },
      { t: 'nonHa', who: 'piero', bead: 'voce:x' },
      { t: 'incontra', a: 'nina', b: 'bepi', from: 7, to: 8 },
      { t: 'presso', who: 'nina', place: 'molo', hour: 7 },
      { t: 'tutti', of: [{ t: 'presso', who: 'bepi', place: 'molo', hour: 8 }, { t: 'nonHa', who: 'piero', bead: 'voce:x' }] },
      { t: 'non', c: { t: 'presso', who: 'bepi', place: 'molo', hour: 8 } },
    ];
    // timeline fino alle 7 (apertura + una riga)
    expect(statuses(A, rowsA, conds, false, 2)).toEqual(['in_corso', 'fallita', 'in_corso', 'in_corso', 'fallita', 'fallita', 'fallita', 'in_corso']);
  });

  it('una condizione ormai impossibile è fallita con il motivo «perso» (Q015)', () => {
    const ctx = createContext(A, {});
    const sim = simulate(A, ctx, rowsA.map((cr, i) => ({ hour: 7 + i, crossings: cr })));
    const [r] = evaluate(A, sim.timeline.slice(0, 2), sim.events.slice(0, 1), [{ t: 'presso', who: 'bepi', place: 'molo', hour: 8 }], ctx, false);
    expect(r).toMatchObject({ status: 'fallita', reasonKey: 'tombolo.cond.perso.presso', params: { chi: 'bepi', luogo: 'molo', ora: 8 } });
    const [f] = evaluate(A, sim.timeline, sim.events, [{ t: 'nonHa', who: 'nina', bead: 'voce:x' }], ctx, true);
    expect(f).toMatchObject({ status: 'fallita', reasonKey: 'tombolo.cond.fallita.nonHa' });
  });

  it('eventi allineati alla timeline (events[0] vuoto) danno lo stesso risultato', () => {
    const ctx = createContext(A, {});
    const sim = simulate(A, ctx, rowsA.map((cr, i) => ({ hour: 7 + i, crossings: cr })));
    const conds: Condition[] = [{ t: 'incontra', a: 'nina', b: 'piero', from: 7, to: 8 }, { t: 'sopra', a: 'nina', b: 'marta' }];
    const a = evaluate(A, sim.timeline, sim.events, conds, ctx, true);
    const b = evaluate(A, sim.timeline, [[], ...sim.events], conds, ctx, true);
    expect(b).toEqual(a);
  });

  // molo forno piazza; vaporetto alle 8
  const B = mk({
    initial: ['bepi', 'nina', 'gino'],
    extra: ['lino1'],
    edges: [{ hour: 8, side: 'molo', kind: 'vaporetto' }],
    beads: [L('L2', 'bepi', 'gino'), F(['gino'])],
  });
  const rowsB = [[], [], [], []];
  const tableB: [string, Condition, CondReport['status']][] = [
    ['parte all\'ora', { t: 'parte', who: 'bepi', hour: 8 }, 'soddisfatta'],
    ['parte all\'ora sbagliata', { t: 'parte', who: 'bepi', hour: 7 }, 'fallita'],
    ['parte senza ora', { t: 'parte', who: 'bepi' }, 'soddisfatta'],
    ['parte di chi resta', { t: 'parte', who: 'nina' }, 'fallita'],
    ['resta', { t: 'resta', who: 'nina' }, 'soddisfatta'],
    ['resta di chi parte', { t: 'resta', who: 'bepi' }, 'fallita'],
    ['esceCon: la lettera parte col vaporetto', { t: 'esceCon', bead: 'L2', hour: 8 }, 'soddisfatta'],
    ['esceCon a un\'ora senza barche', { t: 'esceCon', bead: 'L2', hour: 9 }, 'fallita'],
    ['sano', { t: 'sano', who: 'nina' }, 'soddisfatta'],
    ['sano di un malato', { t: 'sano', who: 'gino' }, 'fallita'],
  ];
  it.each(tableB)('%s', (_n, cond, want) => {
    expect(statuses(B, rowsB, [cond], true)).toEqual([want]);
  });

  it('parte senza ora: chi esce e rientra non è partito', () => {
    const level = mk({
      initial: ['bepi', 'nina', 'gino'],
      extra: ['lino1'],
      edges: [
        { hour: 7, side: 'molo', kind: 'barca' },
        { hour: 9, side: 'molo', kind: 'barca', enters: 'bepi' },
      ],
    });
    expect(statuses(level, [[], [], [], []], [{ t: 'parte', who: 'bepi' }, { t: 'resta', who: 'bepi' }, { t: 'parte', who: 'bepi', hour: 7 }], true)).toEqual([
      'fallita',
      'fallita',
      'soddisfatta',
    ]);
  });

  it('sano a metà giornata: in corso, anche da malato (si può guarire)', () => {
    expect(statuses(B, rowsB, [{ t: 'sano', who: 'gino' }], false, 2)).toEqual(['in_corso']);
  });
});

describe('chiavi dei testi del motore', () => {
  it('ogni motivo prodotto dalla valutazione è fra le chiavi dichiarate', async () => {
    const { engineTextKeys } = await import('../../../src/engine/index');
    const keys = new Set(engineTextKeys());
    expect(keys.has('tombolo.violazione.rifiuto')).toBe(true);
    expect(keys.has('tombolo.cond.fallita.nonHa')).toBe(true);
    expect(keys.has('tombolo.cond.rischio.presso')).toBe(true);
    expect(keys.has('tombolo.cond.rischio.nonHa')).toBe(false);
    for (const k of keys) expect(k.startsWith('tombolo.')).toBe(true);
  });
});
