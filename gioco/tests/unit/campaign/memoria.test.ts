/**
 * Memoria di Ada (GDD 3.11): +1 con il nome, −1 senza, minimo 0, massimo 3, chi è assente
 * non cambia, Lunardi parte da 1; solo nelle giornate con la regola `nome`.
 */
import { describe, expect, it } from 'vitest';
import { ensureMemoria, hasForgotten, initialMemoria, memoriaAfterNight, rememberCount } from '../../../src/campaign/memoria';
import { emptyState, lace, syntheticLevel } from './helpers';

const level = syntheticLevel('t-nome', ['marta', 'teresa', 'zeno', 'lino1']);

describe('memoria', () => {
  it("all'inizio di g12: 3 per tutti, Lunardi 1", () => {
    const m = initialMemoria();
    expect(m.marta).toBe(3);
    expect(m.zeno).toBe(3);
    expect(m.lunardi).toBe(1);
    expect(Object.keys(m).sort()).toEqual(['bepi', 'gino', 'lunardi', 'marta', 'nina', 'piero', 'teresa', 'zeno']);
    const s = emptyState();
    expect(ensureMemoria(s, { rules: ['incrocio'] })).toBe(false);
    expect(s.memoria).toEqual({});
    expect(ensureMemoria(s, { rules: ['incrocio', 'nome'] })).toBe(true);
    expect(s.memoria.lunardi).toBe(1);
    // Già in gioco: non si reimposta.
    s.memoria.marta = 0;
    expect(ensureMemoria(s, { rules: ['nome'] })).toBe(false);
    expect(s.memoria.marta).toBe(0);
  });

  it('+1 con il nome, −1 senza, massimo 3 e minimo 0', () => {
    const before = { marta: 2, teresa: 1, zeno: 3, lunardi: 1 };
    const timeline = [lace(6, ['marta', 'teresa', 'zeno']), lace(8, ['teresa', 'marta', 'zeno'], { nome: ['marta', 'zeno'] })];
    const { memoria, changes } = memoriaAfterNight(level, timeline, before);
    expect(memoria.marta).toBe(3);
    expect(memoria.teresa).toBe(0);
    expect(memoria.zeno).toBe(3);
    expect(changes).toEqual([
      { character: 'teresa', before: 1, after: 0 },
      { character: 'marta', before: 2, after: 3 },
    ]);
    const again = memoriaAfterNight(level, [lace(6, ['marta', 'teresa', 'zeno']), lace(8, ['marta', 'teresa', 'zeno'], { nome: ['marta'] })], memoria);
    expect(again.memoria.teresa).toBe(0);
    expect(again.memoria.marta).toBe(3);
  });

  it('chi non era nel merletto non cambia', () => {
    const before = { marta: 2, teresa: 2, zeno: 2, lunardi: 1 };
    const { memoria } = memoriaAfterNight(level, [lace(6, ['marta', 'teresa', 'lino1']), lace(8, ['marta', 'teresa', 'lino1'], { nome: [] })], before);
    expect(memoria.zeno).toBe(2);
    expect(memoria.lunardi).toBe(1);
    expect(memoria.marta).toBe(1);
  });

  it('senza la regola nome la memoria non cambia', () => {
    const noNome = syntheticLevel('t-senza', ['marta', 'teresa', 'zeno'], ['incrocio']);
    const before = { marta: 2, teresa: 2, zeno: 2 };
    const r = memoriaAfterNight(noNome, [lace(6, ['marta', 'teresa', 'zeno']), lace(8, ['marta', 'teresa', 'zeno'])], before);
    expect(r.memoria).toEqual(before);
    expect(r.changes).toEqual([]);
  });

  it('memoria 0 = ha dimenticato; conteggio per il finale vero', () => {
    const s = emptyState({ memoria: { marta: 0, teresa: 1, zeno: 2, piero: 0, gino: 0, bepi: 0, nina: 0, lunardi: 1 } });
    expect(hasForgotten(s, 'marta')).toBe(true);
    expect(hasForgotten(s, 'teresa')).toBe(false);
    expect(hasForgotten(emptyState(), 'marta')).toBe(false);
    expect(rememberCount(s)).toBe(3);
  });
});
