/**
 * Autotessitura (GDD 3.10): planAutoRow deterministico, bersagli e margini,
 * coppie candidate e fili che cedono, verso, filo controllato, occasioni,
 * filo nero.
 */
import { describe, expect, it } from 'vitest';
import type { AutoweaveDef, Crossing, LevelDef, OccasionDef } from '../../../src/core/types';
import { applyRow, checkCrossing, createContext, forcedCrossings, initialState, planAutoRow, simulate, simulateAndEvaluate, solve } from '../../../src/engine/index';
import { L, fixture, mk } from './helpers';

function auto(level: LevelDef, aw: AutoweaveDef): LevelDef {
  return { ...level, rules: ['incrocio', 'occasioni'], autoweave: aw };
}

function plan(level: LevelDef, occasions: OccasionDef[] = [], controlled: Crossing | null = null): Crossing[] {
  const ctx = createContext(level, {}, { occasions });
  return planAutoRow(level, initialState(level, ctx), ctx, controlled);
}

describe('planAutoRow', () => {
  // molo forno piazza chiesa
  const base = mk({ initial: ['bepi', 'nina', 'marta', 'gino'] });

  it('è deterministico e non cambia lo stato', () => {
    const level = auto(base, { agents: [{ thread: 'gino', agenda: [{ place: 'molo', hour: 9 }], likes: [] }] });
    const ctx = createContext(level, {});
    const s = initialState(level, ctx);
    const copy = JSON.parse(JSON.stringify(s)) as unknown;
    const a = planAutoRow(level, s, ctx);
    const b = planAutoRow(level, s, ctx);
    expect(a).toEqual(b);
    expect(s).toEqual(copy);
    expect(a).toEqual([{ pair: 2, over: 'R', forced: true }]);
  });

  it('un filo verso il suo bersaglio incrocia chi cede (lino, non autonomi, margine ≥ 2)', () => {
    const level = auto(base, {
      agents: [
        { thread: 'gino', agenda: [{ place: 'molo', hour: 10 }], likes: [] },
        { thread: 'marta', agenda: [], likes: [] },
      ],
    });
    expect(plan(level)).toEqual([{ pair: 2, over: 'R', forced: true }]);
  });

  it('chi deve restare (stay) non cede', () => {
    const level = auto(base, {
      agents: [
        { thread: 'gino', agenda: [{ place: 'molo', hour: 10 }], likes: [] },
        { thread: 'marta', agenda: [{ stay: true }], likes: [] },
      ],
    });
    expect(plan(level)).toEqual([]);
  });

  it('due fili che vanno uno verso l\'altro si incrociano; sopra il più urgente', () => {
    const level = auto(base, {
      agents: [
        { thread: 'nina', agenda: [{ place: 'chiesa', hour: 10 }], likes: [] }, // margine 4-2 = 2
        { thread: 'marta', agenda: [{ place: 'molo', hour: 9 }], likes: [] }, // margine 3-2 = 1
      ],
    });
    expect(plan(level)).toEqual([{ pair: 1, over: 'R', forced: true }]);
  });

  it('a parità di urgenza sta sopra il filo di sinistra', () => {
    const level = auto(base, {
      agents: [
        { thread: 'nina', agenda: [{ place: 'piazza', hour: 9 }], likes: [] },
        { thread: 'marta', agenda: [{ place: 'forno', hour: 9 }], likes: [] },
      ],
    });
    expect(plan(level)).toEqual([{ pair: 1, over: 'L', forced: true }]);
  });

  it('sta sopra chi ha una lettera per l\'altro', () => {
    const level = auto(
      { ...base, beads: [L('L1', 'marta', 'nina')] },
      {
        agents: [
          { thread: 'nina', agenda: [{ place: 'piazza', hour: 8 }], likes: [] },
          { thread: 'marta', agenda: [{ place: 'forno', hour: 9 }], likes: [] },
        ],
      },
    );
    expect(plan(level)).toEqual([{ pair: 1, over: 'R', forced: true }]);
  });

  it('sta sopra chi vuole dare (givesTo)', () => {
    const level = auto(base, {
      agents: [
        { thread: 'nina', agenda: [{ place: 'piazza', hour: 8 }], likes: [] },
        { thread: 'marta', agenda: [{ place: 'forno', hour: 9 }], likes: [], givesTo: ['nina'] },
      ],
    });
    expect(plan(level)).toEqual([{ pair: 1, over: 'R', forced: true }]);
  });

  it('un verso vietato da una stranezza si rovescia (Marta non sta sotto Teresa)', () => {
    const level = auto(mk({ initial: ['teresa', 'marta', 'nina'], quirks: ['martaNoSotto'] }), {
      agents: [{ thread: 'teresa', agenda: [{ place: 'piazza', hour: 8 }], likes: [], givesTo: ['marta'] }],
    });
    expect(plan(level)).toEqual([{ pair: 0, over: 'R', forced: true }]);
  });

  it('ordine per margine crescente, poi da sinistra; si prendono le coppie disgiunte', () => {
    // molo forno piazza chiesa: bepi→destra (margine 2), nina e marta verso sinistra
    const level = auto(base, {
      agents: [
        { thread: 'bepi', agenda: [{ place: 'forno', hour: 9 }], likes: [] },
        { thread: 'marta', agenda: [{ place: 'forno', hour: 7 }], likes: [] },
        { thread: 'nina', agenda: [], likes: [] },
      ],
    });
    // marta (margine 0) vince la coppia 1 su bepi (coppia 0, margine 2): restano disgiunte solo la 1
    expect(plan(level)).toEqual([{ pair: 1, over: 'R', forced: true }]);
  });

  it('occasione: attira chi ha il gusto e vale come bersaglio se l\'ora non è passata', () => {
    const level = auto(base, { agents: [{ thread: 'gino', agenda: [], likes: ['festa'] }] });
    expect(plan(level)).toEqual([]);
    expect(plan(level, [{ kind: 'festa', place: 'piazza', hour: 9 }])).toEqual([{ pair: 2, over: 'R', forced: true }]);
    expect(plan(level, [{ kind: 'pane', place: 'piazza', hour: 9 }])).toEqual([]);
    // irraggiungibile in tempo: ignorata
    expect(plan(level, [{ kind: 'festa', place: 'molo', hour: 8 }])).toEqual([]);
  });

  it('occasione passata: non attira più', () => {
    const level = auto({ ...base, startHour: 9, endHour: 12 }, { agents: [{ thread: 'gino', agenda: [], likes: ['festa'] }] });
    expect(plan(level, [{ kind: 'festa', place: 'piazza', hour: 9 }])).toEqual([]);
  });

  it('filo controllato: la sua mossa per prima, le coppie che lo toccano escluse', () => {
    const level = auto(mk({ initial: ['nina', 'ada', 'marta', 'bepi'] }), {
      agents: [{ thread: 'marta', agenda: [{ place: 'molo', hour: 9 }], likes: [] }],
      controlled: 'ada',
    });
    // fermo: marta vorrebbe passare su ada, ma la coppia tocca il controllato
    expect(plan(level)).toEqual([]);
    // ada va a sinistra con nina: la coppia di marta tocca ancora ada, marta resta ferma
    expect(plan(level, [], { pair: 0, over: 'L' })).toEqual([{ pair: 0, over: 'L' }]);
    // ada va a destra con marta: l'incrocio è quello del giocatore
    expect(plan(level, [], { pair: 1, over: 'R' })).toEqual([{ pair: 1, over: 'R' }]);
  });

  it('il filo nero sta sempre sopra e non aspetta il consenso', () => {
    const level: LevelDef = {
      ...mk({ initial: ['nina', 'marta', 'livia'], kinds: { livia: 'nero' } }),
      rules: ['incrocio', 'nero'],
      nero: { thread: 'livia', enter: { hour: 6, side: 'faro' }, agenda: [{ follow: 'nina' }] },
    };
    const ctx = createContext(level, {});
    expect(forcedCrossings(level, initialState(level, ctx), ctx)).toEqual([{ pair: 1, over: 'R', forced: true }]);
  });
});

describe('autotessitura nel motore', () => {
  it('giornata tutta automatica: la bozza del giocatore è rifiutata, la riga si tesse da sola', () => {
    const level = fixture('test-occasioni');
    const ctx = createContext(level, {});
    const s = initialState(level, ctx);
    expect(checkCrossing(level, s, [], { pair: 0, over: 'L' }, ctx)?.code).toBe('forzato');
    const r = applyRow(level, s, [], ctx);
    expect(r.ok).toBe(true);
  });

  it('occasioni della soluzione calcolata: gli obiettivi risultano soddisfatti', () => {
    const level = fixture('test-occasioni');
    const computed = JSON.parse(JSON.stringify(fixture('test-occasioni.computed'))) as { occasionsSolution?: OccasionDef[]; occasionsSolutions?: number };
    expect(computed.occasionsSolution?.length).toBeGreaterThan(0);
    expect(computed.occasionsSolutions).toBeGreaterThanOrEqual(1);
    expect(computed.occasionsSolutions).toBeLessThanOrEqual(20);
    const ctx = createContext(level, {}, { occasions: computed.occasionsSolution });
    const rows = Array.from({ length: level.endHour - level.startHour }, (_, i) => ({ hour: level.startHour + 1 + i, crossings: [] }));
    expect(simulateAndEvaluate(level, ctx, rows, level.goals ?? []).allOk).toBe(true);
    // Senza occasioni gli obiettivi non si raggiungono.
    expect(simulateAndEvaluate(level, createContext(level, {}), rows, level.goals ?? []).allOk).toBe(false);
  });

  it('filo controllato (fin_seppia): il giocatore muove solo il suo filo, il resto lo decide planAutoRow', () => {
    const level = fixture('test-seppia');
    const ctx = createContext(level, {});
    const s = initialState(level, ctx);
    expect(checkCrossing(level, s, [], { pair: 2, over: 'L' }, ctx)?.code).toBe('forzato');
    expect(checkCrossing(level, s, [], { pair: 0, over: 'L' }, ctx)).toBeNull();
    const r = solve({ level, ctx, goals: level.goals ?? [] });
    expect(r.status).toBe('ok');
    const sim = simulate(level, ctx, r.rows ?? []);
    expect(sim.ok).toBe(true);
    // ogni riga: al massimo un incrocio non forzato, e tocca ada
    sim.rows.forEach((row, i) => {
      const mine = row.crossings.filter((c) => !c.forced);
      expect(mine.length).toBeLessThanOrEqual(1);
      for (const c of mine) {
        const before = sim.timeline[i];
        expect([before?.pos[c.pair], before?.pos[c.pair + 1]]).toContain('ada');
      }
    });
  });

  it('presetOccasions entrano nel contesto', () => {
    const level = fixture('test-seppia');
    expect(createContext(level, {}).occasions).toEqual(level.autoweave?.presetOccasions);
  });
});
