/**
 * API delle regole oltre ai casi tabellari: checkCrossing durante il
 * trascinamento, anteprima, blocchi, spilli irraggiungibili, annuncio del filo
 * nero, contesto e stato.
 */
import { describe, expect, it } from 'vitest';
import type { Crossing } from '../../../src/core/types';
import {
  applyRow,
  blocked,
  checkCrossing,
  cloneState,
  createContext,
  forcedCrossings,
  initialState,
  previewRow,
  sameLace,
  simulate,
  solve,
  stateKey,
  unreachablePins,
} from '../../../src/engine/index';
import { L, fixture, mk } from './helpers';

const c = (pair: number, over: 'L' | 'R'): Crossing => ({ pair, over });

describe('checkCrossing', () => {
  const level = mk({ initial: ['teresa', 'marta', 'piero', 'nina'], quirks: ['martaNoSotto'], matassa: 2 });
  const ctx = createContext(level, {});
  const s = initialState(level, ctx);

  it('ammesso: null', () => expect(checkCrossing(level, s, [], c(1, 'L'), ctx)).toBeNull());
  it('stranezza: rifiuto con la chiave del messaggio', () => {
    expect(checkCrossing(level, s, [], c(0, 'L'), ctx)).toMatchObject({ code: 'rifiuto', messageKey: 'tombolo.violazione.rifiuto', quirk: 'martaNoSotto' });
  });
  it('rovesciare un incrocio della bozza non costa matassa', () => {
    const used = { ...s, usedMatassa: 1 };
    expect(checkCrossing(level, used, [c(1, 'L')], c(1, 'R'), ctx)).toBeNull();
    expect(checkCrossing(level, used, [c(1, 'L')], c(2, 'L'), ctx)?.code).toBe('disgiunto');
  });
  it('matassa: il secondo incrocio oltre la matassa è rifiutato', () => {
    const used = { ...s, usedMatassa: 1 };
    expect(checkCrossing(level, used, [c(0, 'R')], c(2, 'L'), ctx)?.code).toBe('matassa');
  });
  it('coppia inesistente', () => expect(checkCrossing(level, s, [], c(3, 'L'), ctx)?.code).toBe('disgiunto'));
  it('notte finita', () => {
    const end = { ...s, hour: level.endHour };
    expect(checkCrossing(level, end, [], c(1, 'L'), ctx)?.messageKey).toBe('tombolo.violazione.finita');
    expect(applyRow(level, end, [], ctx).ok).toBe(false);
  });
});

describe('previewRow', () => {
  it('applica la bozza senza spilli e Gino, segnala gli incroci non validi', () => {
    const level = mk({ initial: ['gino', 'marta', 'piero'], quirks: ['ginoCorre'], pins: [{ thread: 'piero', place: 'molo', hour: 7 }] });
    const ctx = createContext(level, {});
    const s = initialState(level, ctx);
    const p = previewRow(level, s, [c(1, 'L')], ctx);
    expect(p.ok).toBe(true);
    expect(p.state.pos).toEqual(['gino', 'piero', 'marta']);
    const a = applyRow(level, s, [c(1, 'L')], ctx);
    expect(a.violations.map((v) => v.code)).toEqual(['spillo', 'corre']);
    const bad = previewRow(level, s, [c(0, 'L'), c(1, 'L')], ctx);
    expect(bad.ok).toBe(false);
    expect(bad.state.pos).toEqual(['marta', 'gino', 'piero']);
  });
});

describe('blocchi e spilli irraggiungibili', () => {
  it('blocked: annodati e colonne allagate', () => {
    const level = mk({ initial: ['bepi', 'nina', 'marta'], tide: [{ from: 7, to: 7, places: ['piazza'] }] });
    const ctx = createContext(level, {});
    const s = { ...initialState(level, ctx), knotted: ['bepi'] };
    expect(blocked(level, s, ctx)).toEqual(['bepi', 'marta']);
  });

  it('unreachablePins: distanza maggiore delle righe rimaste, o fuori dalla tela', () => {
    const level = mk({
      initial: ['bepi', 'nina', 'marta', 'piero'],
      extra: ['lino1'],
      edges: [{ hour: 7, side: 'molo', kind: 'barca' }],
      pins: [
        { thread: 'piero', place: 'molo', hour: 8 },
        { thread: 'marta', place: 'forno', hour: 7 },
        { thread: 'bepi', place: 'forno', hour: 9 },
      ],
    });
    const ctx = createContext(level, {});
    const s = initialState(level, ctx);
    expect(unreachablePins(level, s, ctx)).toEqual([{ thread: 'piero', place: 'molo', hour: 8 }]);
    const r = applyRow(level, s, [c(1, 'R')], ctx); // marta al forno; bepi esce col vaporetto
    expect(r.ok).toBe(true);
    expect(unreachablePins(level, r.state, ctx).map((p) => p.thread)).toEqual(['piero', 'bepi']);
  });
});

describe('filo nero: annunciato dallo stato dell\'ora prima', () => {
  it('forcedCrossings(h-1) è l\'incrocio forzato della riga h, e l\'evento nero lo annuncia', () => {
    const level = fixture('test-nero');
    const ctx = createContext(level, {});
    const r = solve({ level, ctx, goals: level.goals ?? [] });
    const sim = simulate(level, ctx, r.rows ?? []);
    expect(sim.ok).toBe(true);
    let announced = 0;
    sim.rows.forEach((row, i) => {
      const before = sim.timeline[i];
      if (!before) throw new Error('timeline');
      expect(forcedCrossings(level, before, ctx)).toEqual(row.crossings.filter((x) => x.forced));
      const ann = (sim.events[i - 1] ?? []).find((e) => e.k === 'nero');
      const forced = row.crossings.find((x) => x.forced);
      if (ann && ann.k === 'nero') {
        announced++;
        expect(forced?.pair).toBe(ann.pair);
      }
    });
    expect(announced).toBeGreaterThan(0);
  });
});

describe('contesto e stato', () => {
  it('la riconciliazione toglie martaNoSotto, teresaLegge e il rancore Teresa-Marta, non il trabocco', () => {
    const level = mk({
      initial: ['teresa', 'marta', 'piero', 'gino'],
      quirks: ['martaNoSotto', 'teresaLegge', 'pieroPozzo', 'pieroTrabocca', 'ginoCorre'],
      rancor: [
        ['teresa', 'marta'],
        ['piero', 'gino'],
      ],
    });
    const off = createContext(level, {});
    expect(off.quirks).toEqual(level.quirks);
    const on = createContext(level, { riconciliate: 'sì' });
    expect(on.quirks).toEqual(['pieroPozzo', 'pieroTrabocca', 'ginoCorre']);
    expect(on.rancor).toEqual([['piero', 'gino']]);
    expect(createContext(level, { riconciliate: false }).quirks).toContain('martaNoSotto');
  });

  it('stato iniziale: posizioni, perline, lettere già consegnate', () => {
    const level = mk({ initial: ['nina', 'marta'], beads: [L('L1', 'nina', 'nina'), L('L2', 'marta', 'nina')] });
    const s = initialState(level, createContext(level, {}));
    expect(s).toMatchObject({ hour: 6, pos: ['nina', 'marta'], delivered: ['L1'], holders: { L1: ['nina'], L2: ['marta'] }, usedMatassa: 0, met: [], metOver: [] });
  });

  it('incontri registrati: met e metOver', () => {
    const level = mk({ initial: ['nina', 'marta'] });
    const ctx = createContext(level, {});
    const r = applyRow(level, initialState(level, ctx), [c(0, 'R')], ctx);
    expect(r.state.met).toEqual(['marta|nina']);
    expect(r.state.metOver).toEqual(['marta>nina']);
  });

  it('copia, chiave e confronto', () => {
    const level = fixture('g00');
    const ctx = createContext(level, {});
    const s = initialState(level, ctx);
    const copy = cloneState(s);
    expect(copy).toEqual(s);
    expect(stateKey(copy)).toBe(stateKey(s));
    const r = applyRow(level, s, [c(0, 'R')], ctx);
    expect(stateKey(r.state)).not.toBe(stateKey(s));
    expect(sameLace(r.state, { ...r.state, usedMatassa: 99, met: [] })).toBe(true);
    expect(sameLace(r.state, s)).toBe(false);
  });
});
