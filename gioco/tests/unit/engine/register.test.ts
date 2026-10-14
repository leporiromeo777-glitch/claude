/**
 * `__GAME__.engine` (ARCHITETTURA 15.1): l'API di debug registrata dal pacchetto.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelComputed, LevelDef, Services, SolveResult } from '../../../src/core/types';
import { buildContentDB } from '../../../src/content/loader';
import { register } from '../../../src/engine/register';
import type { GenResult, Spartito } from '../../../src/engine/index';
import { FIXTURES, mk } from './helpers';

type Api = Record<string, (...args: never[]) => unknown>;

function setup(): Api {
  const read = (f: string): unknown => JSON.parse(readFileSync(join(FIXTURES, f), 'utf8')) as unknown;
  const { db } = buildContentDB({
    './levels/g00.json': read('g00.json'),
    './levels/g06.json': read('g06.json'),
    './levels/g06.computed.json': read('g06.computed.json'),
    './notes.fixtures.json': read('notes.fixtures.json'),
    // Regola del nome (GDD 3.11): Gino deve conoscere il nome di Ada.
    './levels/nomi.json': mk({ id: 'nomi', initial: ['nina', 'marta', 'piero', 'gino'], rules: ['incrocio', 'nome'], notes: ['nomi.gino'] }),
    './notes.nomi.json': [{ id: 'nomi.gino', day: 'nomi', author: 'gino', textKey: 'test.nomi', request: { t: 'ha', who: 'gino', bead: 'nome' } }],
  });
  let api: Api | null = null;
  const services = {
    content: db,
    debug: {
      register(ns: string, a: Api) {
        if (ns === 'engine') api = a;
      },
    },
  } as unknown as Services;
  register(services);
  if (!api) throw new Error('engine debug API not registered');
  return api;
}

describe('__GAME__.engine', () => {
  const api = setup();
  const call = <T>(name: string, ...args: unknown[]): T => (api[name] as unknown as (...a: unknown[]) => T)(...args);

  it('registra le funzioni di ARCHITETTURA 15.1', () => {
    for (const f of ['level', 'solve', 'computed', 'daily', 'generate', 'encode', 'decode']) expect(typeof api[f]).toBe('function');
  });

  it('level e computed', () => {
    expect(call<LevelDef>('level', 'g00').id).toBe('g00');
    expect(call<LevelDef | null>('level', 'nessuno')).toBeNull();
    expect(call<LevelComputed>('computed', 'g06').perNote['g06.nina']?.incroci).toBe(5);
    expect(call<LevelComputed | null>('computed', 'g00')).toBeNull();
  });

  it('solve con i bigliettini', () => {
    expect(call<SolveResult>('solve', 'g00')).toMatchObject({ status: 'ok', incroci: 4, optimalCount: 3 });
    expect(call<SolveResult>('solve', 'g06', ['g06.nina', 'g06.marta'])).toMatchObject({ status: 'ok', incroci: 5 });
    expect(call<SolveResult>('solve', 'g06', ['g06.nina', 'g06.zeno']).status).toBe('impossibile');
    expect(call<SolveResult | null>('solve', 'nessuno')).toBeNull();
  });

  it('solve con la regola del nome: la scelta migliore del filo, o quella indicata', () => {
    expect(call<SolveResult & { nomeOn?: string }>('solve', 'nomi', ['nomi.gino'])).toMatchObject({ status: 'ok', incroci: 0, nomeOn: 'gino' });
    const far = call<SolveResult & { nomeOn?: string }>('solve', 'nomi', ['nomi.gino'], { nomeOn: 'nina' });
    expect(far.status).toBe('ok');
    expect(far.incroci).toBeGreaterThan(0);
    expect(far.nomeOn).toBeUndefined();
    expect(call<SolveResult>('solve', 'nomi', ['nomi.gino'], { nomeOn: null }).status).toBe('impossibile');
    // Senza il nome nelle condizioni non si prova nulla.
    expect(call<SolveResult & { nomeOn?: string }>('solve', 'nomi').nomeOn).toBeUndefined();
  });

  it('daily e generate', () => {
    const d = call<GenResult>('daily', '2026-10-14');
    expect(d.level.id).toBe('day-2026-10-14');
    expect(call<LevelDef>('level', 'day-2026-10-14').id).toBe('day-2026-10-14');
    const g = call<GenResult>('generate', { seed: 'x1', columns: 5, rows: 7, rule: 'voce', gradi: [], difficulty: 'medio' });
    expect(g.level.kind).toBe('libero');
  });

  it('encode e decode', () => {
    const s: Spartito = { mode: 'S', ref: 'g00', rows: [{ hour: 1, crossings: [{ pair: 0, over: 'R' }] }] };
    const str = call<string>('encode', s);
    expect(call<Spartito>('decode', str)).toEqual(s);
    expect(call<Spartito | null>('decode', 'TRAMA1-Sg00-b-00')).toBeNull();
  });

  it('fixture', async () => {
    const lv = await call<Promise<LevelDef | null>>('fixture', 'test-grande');
    expect(lv?.id).toBe('test-grande');
    expect(call<LevelDef>('level', 'test-grande').id).toBe('test-grande');
    expect(await call<Promise<LevelDef | null>>('fixture', 'nessuna')).toBeNull();
  });

  it('i valori restituiti sono serializzabili in JSON', () => {
    const r = call<SolveResult>('solve', 'g00');
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
