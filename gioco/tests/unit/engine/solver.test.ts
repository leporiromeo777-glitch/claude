/**
 * Solver: gli esempi giocati del GDD (3.15 e 3.16) con i numeri esatti, il
 * caso sintetico grande entro 3 s, obiettivi, conteggio delle soluzioni ottime,
 * ripartenza da metà notte, limiti di stati, validità delle soluzioni.
 */
import { describe, expect, it } from 'vitest';
import type { Condition, Crossing, LaceState, LevelDef, RowMoves } from '../../../src/core/types';
import { applyRow, createContext, initialState, simulate, simulateAndEvaluate, solve, solveAsync } from '../../../src/engine/index';
import { solveInternal } from '../../../src/engine/solver';
import { F, fixture, noteRequest } from './helpers';

const g00 = fixture('g00');
const g06 = fixture('g06');

function run(level: LevelDef, extra: Condition[] = [], opts: Partial<Parameters<typeof solve>[0]> = {}) {
  return solve({ level, ctx: createContext(level, {}), goals: [...(level.goals ?? []), ...extra], countOptimal: true, ...opts });
}

function playerCrossings(rows: RowMoves[]): number {
  return rows.reduce((n, r) => n + r.crossings.filter((c) => !c.forced).length, 0);
}

describe('Prologo (GDD 3.15)', () => {
  it('minimo 4 incroci e 3 soluzioni ottime', () => {
    const r = run(g00);
    expect(r.status).toBe('ok');
    expect(r.incroci).toBe(4);
    expect(r.optimalCount).toBe(3);
  });

  it('la soluzione del GDD è valida e ha 4 incroci', () => {
    const rows: RowMoves[] = [
      { hour: 6, crossings: [{ pair: 0, over: 'R' }] }, // Marta / Teresa
      { hour: 7, crossings: [{ pair: 1, over: 'L' }] }, // Teresa / Piero: consegnata
      { hour: 8, crossings: [{ pair: 1, over: 'L' }] }, // Piero / Teresa
      { hour: 9, crossings: [{ pair: 0, over: 'L' }] }, // Marta / Teresa
    ];
    const ctx = createContext(g00, {});
    const res = simulateAndEvaluate(g00, ctx, rows, g00.goals ?? []);
    expect(res.allOk).toBe(true);
    const states = res.sim.timeline.map((s) => s.pos.join(','));
    expect(states).toEqual(['teresa,marta,piero', 'marta,teresa,piero', 'marta,piero,teresa', 'marta,teresa,piero', 'teresa,marta,piero']);
    expect(res.sim.timeline[1]?.holders['letta:L1']).toEqual(['teresa']);
    expect(res.sim.timeline[2]?.delivered).toEqual(['L1']);
  });

  it('il solver trova una soluzione che il motore accetta', () => {
    const r = run(g00);
    const res = simulateAndEvaluate(g00, createContext(g00, {}), r.rows ?? [], g00.goals ?? []);
    expect(res.allOk).toBe(true);
    expect(playerCrossings(r.rows ?? [])).toBe(4);
  });
});

describe('Giornata 6 (GDD 3.16)', () => {
  const N1 = noteRequest('g06.nina');
  const N2 = noteRequest('g06.marta');
  const N3 = noteRequest('g06.zeno');
  const big = { matassa: 30 };

  it('senza richieste: 0 incroci', () => expect(run(g06, [], big).incroci).toBe(0));
  it('N1 da sola: 5', () => expect(run(g06, [N1], big).incroci).toBe(5));
  it('N1 + N2: 5', () => expect(run(g06, [N1, N2], big).incroci).toBe(5));
  it('N2 + N3: 0', () => expect(run(g06, [N2, N3], big).incroci).toBe(0));
  it('N1 + N3: impossibile', () => expect(run(g06, [N1, N3], big).status).toBe('impossibile'));

  it('la soluzione ottima del GDD per N1+N2 è valida con 5 incroci, matassa 5 + 3 = 8', () => {
    const rows: RowMoves[] = [
      { hour: 7, crossings: [] },
      { hour: 8, crossings: [] },
      { hour: 9, crossings: [{ pair: 3, over: 'L' }] }, // Piero / Nina
      { hour: 10, crossings: [{ pair: 0, over: 'R' }, { pair: 2, over: 'L' }] }, // Marta / marinaio; Teresa / Nina
      { hour: 11, crossings: [{ pair: 1, over: 'L' }, { pair: 3, over: 'L' }] }, // marinaio / Nina; Teresa / Piero
      { hour: 12, crossings: [] },
    ];
    const ctx = createContext(g06, {});
    const res = simulateAndEvaluate(g06, ctx, rows, [N1, N2]);
    expect(res.allOk).toBe(true);
    expect(res.sim.timeline.map((s) => s.pos.join(' '))).toEqual([
      'lino1 marta teresa piero nina zeno',
      'lino1 marta teresa piero nina zeno',
      'marinaio marta teresa piero nina zeno',
      'marinaio marta teresa nina piero zeno',
      'marta marinaio nina teresa piero zeno',
      'marta nina marinaio piero teresa zeno',
      'marta nina marinaio piero teresa zeno',
    ]);
    expect(g06.matassa).toBe(8);
    // Con N3 la stessa soluzione fallisce: Teresa dà la voce a Don Piero.
    expect(simulateAndEvaluate(g06, ctx, rows, [N3]).allOk).toBe(false);
  });
});

describe('caso sintetico 6 colonne × 14 righe', () => {
  const grande = fixture('test-grande');
  it(
    '2 lettere, voce, segreto e 2 incontri tracciati, matassa = minimo + 2: risolto in ≤ 3 s',
    () => {
      const free = run(grande, [], { matassa: 40, countOptimal: false });
      expect(free.status).toBe('ok');
      const min = free.incroci as number;
      expect(grande.matassa).toBe(min + 2);
      const t0 = performance.now();
      const r = run(grande, [], { matassa: min + 2 });
      const ms = performance.now() - t0;
      expect(r.status).toBe('ok');
      expect(r.incroci).toBe(min);
      expect(r.states).toBeGreaterThan(1000);
      expect(ms).toBeLessThan(3000);
      const res = simulateAndEvaluate(grande, createContext(grande, {}), r.rows ?? [], grande.goals ?? []);
      expect(res.allOk).toBe(true);
    },
    3500,
  );
});

describe('solver: opzioni', () => {
  it('maxQuiete: più ore di quiete, a pari matassa', () => {
    const grande = fixture('test-grande');
    const a = run(grande);
    const b = run(grande, [], { objective: 'maxQuiete' });
    expect(b.status).toBe('ok');
    expect(b.quiete as number).toBeGreaterThanOrEqual(a.quiete as number);
    expect(b.incroci as number).toBeLessThanOrEqual(grande.matassa);
  });

  it('countOptimal si ferma a 50', () => {
    const r = run(g06, [noteRequest('g06.nina')], { matassa: 30 });
    expect(r.optimalCount).toBeLessThanOrEqual(50);
    expect(r.optimalCount).toBeGreaterThan(3);
  });

  it('senza countOptimal non conta', () => {
    const r = solve({ level: g00, ctx: createContext(g00, {}), goals: g00.goals ?? [] });
    expect(r.optimalCount).toBeUndefined();
  });

  it('ripartenza da metà notte: righe complete, prefisso rispettato', () => {
    const ctx = createContext(g00, {});
    const done: RowMoves[] = [{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }, { hour: 7, crossings: [{ pair: 1, over: 'R' }] }];
    const sim = simulate(g00, ctx, done);
    expect(sim.ok).toBe(true);
    const state = sim.timeline[sim.timeline.length - 1];
    if (!state) throw new Error('no state');
    const r = solve({ level: g00, ctx, goals: g00.goals ?? [], from: { state, rowsDone: done } });
    expect(r.status).toBe('ok');
    expect(r.rows?.slice(0, 2)).toEqual(done);
    expect(r.rows).toHaveLength(4);
    expect(r.incroci).toBe(4);
    expect(r.rows?.[2]?.crossings).toEqual([{ pair: 1, over: 'R' }]); // Teresa ora sta a destra: deve stare sopra
    expect(simulateAndEvaluate(g00, ctx, r.rows ?? [], g00.goals ?? []).allOk).toBe(true);
  });

  it('ripartenza con righe senza incroci forzati (spartito): filo nero e filo controllato', () => {
    for (const id of ['test-nero', 'test-seppia']) {
      const level = fixture(id);
      const ctx = createContext(level, {});
      const full = solve({ level, ctx, goals: level.goals ?? [] });
      expect(full.status, id).toBe('ok');
      const done = (full.rows ?? []).slice(0, 3).map((r) => ({ hour: r.hour, crossings: r.crossings.filter((x) => !x.forced) }));
      const sim = simulate(level, ctx, done);
      const state = sim.timeline[sim.timeline.length - 1];
      if (!state) throw new Error('no state');
      const r = solve({ level, ctx, goals: level.goals ?? [], from: { state, rowsDone: done } });
      expect(r.status, id).toBe('ok');
      expect(r.incroci, id).toBe(full.incroci);
      expect(r.rows?.slice(0, 3), id).toEqual(sim.rows);
    }
  });

  it('da uno stato senza via d\'uscita: impossibile', () => {
    const ctx = createContext(g00, {});
    const done: RowMoves[] = [{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }, { hour: 7, crossings: [] }, { hour: 8, crossings: [] }];
    const sim = simulate(g00, ctx, done);
    const state = sim.timeline[sim.timeline.length - 1];
    if (!state) throw new Error('no state');
    expect(solve({ level: g00, ctx, goals: g00.goals ?? [], from: { state, rowsDone: done } }).status).toBe('impossibile');
  });

  it('limite di stati', () => {
    const grande = fixture('test-grande');
    const r = run(grande, [], { matassa: 40, maxStates: 500 });
    expect(r.status).toBe('limite');
    expect(r.states).toBeGreaterThan(500);
  });

  it('matassa troppo piccola: impossibile', () => {
    expect(run(g00, [], { matassa: 3 }).status).toBe('impossibile');
  });

  it('ogni fixture con obiettivi: la soluzione è accettata dal motore e soddisfa gli obiettivi', () => {
    for (const id of ['test-nero', 'test-marea', 'test-febbre', 'test-rancore', 'test-trabocca', 'test-bordi', 'test-seppia']) {
      const level = fixture(id);
      const ctx = createContext(level, {});
      const r = solve({ level, ctx, goals: level.goals ?? [] });
      expect(r.status, id).toBe('ok');
      const res = simulateAndEvaluate(level, ctx, r.rows ?? [], level.goals ?? []);
      expect(res.allOk, id).toBe(true);
      expect(playerCrossings(res.sim.rows), id).toBe(r.incroci);
    }
  });
});

describe('Gino non sta fermo due ore di fila (C01)', () => {
  const gino = fixture('test-gino');

  it('6 righe con Gino e nessun altro vincolo: minimo 3, 3 ore di quiete', () => {
    const r = run(gino);
    expect(r.status).toBe('ok');
    expect(r.incroci).toBe(3);
    expect(r.quiete).toBe(3);
    const res = simulateAndEvaluate(gino, createContext(gino, {}), r.rows ?? [], []);
    expect(res.allOk).toBe(true);
  });

  it('minimo e soluzioni ottime coincidono con la ricerca esaustiva su applyRow', () => {
    const ctx = createContext(gino, {});
    const options: Crossing[][] = [[], [{ pair: 0, over: 'L' }], [{ pair: 1, over: 'L' }]];
    let best = Number.POSITIVE_INFINITY;
    let count = 0;
    const walk = (s: LaceState, depth: number, cost: number): void => {
      if (depth === 6) {
        if (cost < best) {
          best = cost;
          count = 1;
        } else if (cost === best) count++;
        return;
      }
      for (const o of options) {
        const res = applyRow(gino, s, o, ctx);
        if (res.ok) walk(res.state, depth + 1, cost + o.length);
      }
    };
    walk(initialState(gino, ctx), 0, 0);
    const r = run(gino);
    expect(best).toBe(3);
    expect(r.incroci).toBe(best);
    expect(r.optimalCount).toBe(Math.min(50, count));
  });

  it('con la febbre tutta la notte Gino resta a letto: minimo 0', () => {
    const level: LevelDef = { ...gino, id: 'gino-febbre', rules: ['incrocio', 'febbre'], beads: [F(['gino'])] };
    expect(run(level).incroci).toBe(0);
    // Con la regola della febbre spenta (generatore) la febbre non lo ferma.
    const off = solveInternal({ level, ctx: createContext(level, {}), goals: [] }, { disable: ['febbre'] });
    expect(off.incroci).toBe(3);
  });

  it('ripartenza da metà notte: lo stato di Gino fermo conta', () => {
    const ctx = createContext(gino, {});
    const first = applyRow(gino, initialState(gino, ctx), [], ctx);
    expect(first.ok).toBe(true);
    const r = solve({ level: gino, ctx, goals: [], from: { state: first.state, rowsDone: [{ hour: 7, crossings: [] }] } });
    expect(r.status).toBe('ok');
    expect(r.incroci).toBe(3);
    expect(r.rows?.[1]?.crossings.length).toBe(1);
  });
});

describe('solveAsync', () => {
  it('in Node ripiega sul percorso sincrono', async () => {
    const r = await solveAsync({ level: g00, ctx: createContext(g00, {}), goals: g00.goals ?? [], countOptimal: true });
    expect(r.status).toBe('ok');
    expect(r.incroci).toBe(4);
    expect(r.optimalCount).toBe(3);
  });

  it('annullabile con AbortSignal', async () => {
    const ac = new AbortController();
    const p = solveAsync({ level: g00, ctx: createContext(g00, {}), goals: g00.goals ?? [] }, ac.signal);
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    const ac2 = new AbortController();
    ac2.abort();
    await expect(solveAsync({ level: g00, ctx: createContext(g00, {}), goals: [] }, ac2.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
