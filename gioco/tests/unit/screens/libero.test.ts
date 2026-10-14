/**
 * Merletto libero: semi, dimensioni, regola dal seme, id dei livelli e gradi.
 * «Gradi: ogni combinazione genera un livello valido» (con il motore vero):
 * per ogni dimensione, tutte le 16 combinazioni dei gradi che cambiano il
 * livello (le altre 48 differiscono solo per Senza Disfa e Spilli velati, che
 * non toccano il livello: si prova anche questo).
 */
import { describe, expect, it } from 'vitest';
import type { GradoId, LevelDef } from '../../../src/core/types';
import { createContext, generate, simulateAndEvaluate, solve } from '../../../src/engine/index';
import {
  DIMENSIONI,
  DIMENSIONI_ORDER,
  GRADI_LIVELLO,
  GRADI_ORDER,
  LIBERO_RULES,
  allGradiCombos,
  dimensioneOf,
  gradiPoints,
  isSeed,
  levelMatchesSpec,
  liberoLevelId,
  liberoSpec,
  normalizeGradi,
  normalizeSeed,
  parseLiberoId,
  randomSeed,
  ruleOfSeed,
  withDimensione,
} from '../../../src/screens/libero';
import { spartitoRef, encodeSpartito, decodeSpartito } from '../../../src/engine/index';

describe('semi del Merletto libero', () => {
  it('la prima lettera dice la dimensione', () => {
    expect(dimensioneOf('p123')).toBe('piccolo');
    expect(dimensioneOf('m123')).toBe('medio');
    expect(dimensioneOf('g123')).toBe('grande');
    expect(dimensioneOf('x123')).toBeNull();
    expect(DIMENSIONI.piccolo).toMatchObject({ columns: 4, rows: 6 });
    expect(DIMENSIONI.medio).toMatchObject({ columns: 5, rows: 7 });
    expect(DIMENSIONI.grande).toMatchObject({ columns: 6, rows: 8 });
  });

  it('normalizza il testo scritto dal giocatore (base 36)', () => {
    expect(normalizeSeed('G 12-ab', 'medio')).toBe('g12ab');
    expect(normalizeSeed('ciao', 'piccolo')).toBe('pciao');
    expect(normalizeSeed('12345', 'grande')).toBe('g12345');
    expect(normalizeSeed('mare', 'grande')).toBe('mare');
    expect(normalizeSeed('', 'medio')).toBeNull();
    expect(normalizeSeed('città', 'medio')).toBeNull();
    expect(normalizeSeed('a'.repeat(12), 'medio')).toBeNull();
    expect(isSeed('m')).toBe(false);
    expect(isSeed('m0')).toBe(true);
  });

  it('cambiare dimensione cambia solo la prima lettera', () => {
    expect(withDimensione('m7k2xq', 'grande')).toBe('g7k2xq');
    expect(withDimensione('p1', 'medio')).toBe('m1');
  });

  it('i semi casuali sono validi, della dimensione chiesta, e lo spartito L li porta', () => {
    let x = 0.123;
    const rnd = (): number => {
      x = (x * 9301 + 0.49297) % 1;
      return x;
    };
    for (const d of DIMENSIONI_ORDER) {
      for (let i = 0; i < 50; i++) {
        const seed = randomSeed(d, rnd);
        expect(isSeed(seed)).toBe(true);
        expect(dimensioneOf(seed)).toBe(d);
        expect(spartitoRef('L', seed)).toBe(seed);
      }
    }
  });

  it('la regola dipende solo dal seme e copre tutte le regole del giorno', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const seed = `m${i.toString(36)}`;
      const r = ruleOfSeed(seed);
      expect(r).toBe(ruleOfSeed(seed));
      expect(LIBERO_RULES).toContain(r);
      seen.add(r);
    }
    expect(seen.size).toBe(LIBERO_RULES.length);
  });

  it('id del livello: andata e ritorno, uguale a quello del generatore', () => {
    for (const g of allGradiCombos()) {
      const id = liberoLevelId('m7tr4m', g);
      expect(parseLiberoId(id)).toEqual({ seed: 'm7tr4m', gradi: normalizeGradi(g) });
    }
    expect(parseLiberoId('lib-m7tr4m~nonEsiste')).toBeNull();
    expect(parseLiberoId('day-2026-10-14')).toBeNull();
    expect(parseLiberoId('lib-x123')).toBeNull();
    const spec = liberoSpec('p9z', ['notteCorta', 'senzaDisfa']);
    expect(generate(spec).level.id).toBe(liberoLevelId('p9z', ['notteCorta', 'senzaDisfa']));
  });

  it('specifica: dimensione, regola, gradi in ordine', () => {
    const spec = liberoSpec('g42', ['notteCorta', 'matassaEsatta', 'notteCorta']);
    expect(spec).toEqual({ seed: 'g42', columns: 6, rows: 8, rule: ruleOfSeed('g42'), gradi: ['matassaEsatta', 'notteCorta'], difficulty: 'grande' });
    expect(gradiPoints(GRADI_ORDER)).toBe(6);
    expect(allGradiCombos()).toHaveLength(64);
  });
});

function checkLevel(level: LevelDef, seed: string, gradi: GradoId[], min: number): void {
  const spec = liberoSpec(seed, gradi);
  expect(levelMatchesSpec(level, spec)).toBe(true);
  expect(level.id).toBe(liberoLevelId(seed, gradi));
  expect(level.kind).toBe('libero');
  expect(level.rules).toContain(spec.rule === 'rancore' ? 'rancore' : spec.rule);
  expect(new Set(level.initial).size).toBe(level.columns.length);
  for (const t of level.initial) expect(level.threads.some((x) => x.id === t)).toBe(true);
  // Matassa: minimo + 1, o il minimo esatto con il grado.
  expect(level.matassa).toBe(min + (gradi.includes('matassaEsatta') ? 0 : 1));
  if (gradi.includes('nodoInPiu')) {
    expect(level.rules).toContain('rancore');
    expect((level.rancor ?? []).length).toBeGreaterThan(0);
  }
  if (gradi.includes('neroInPiu')) expect(level.nero ?? level.threads.find((t) => t.kind === 'nero')).toBeTruthy();
  // Risolvibile entro la matassa, con il minimo dichiarato, e la soluzione regge in simulazione.
  const ctx = createContext(level, {});
  const goals = level.goals ?? [];
  const res = solve({ level, ctx, goals });
  expect(res.status).toBe('ok');
  expect(res.incroci).toBe(min);
  expect(min).toBeLessThanOrEqual(level.matassa);
  const check = simulateAndEvaluate(level, ctx, res.rows ?? [], goals);
  expect(check.allOk).toBe(true);
  // Lo spartito della soluzione torna indietro identico.
  const sp = encodeSpartito({ mode: 'L', ref: seed, ...(gradi.length ? { gradi } : {}), rows: res.rows ?? [] });
  const back = decodeSpartito(sp);
  expect(back?.ref).toBe(seed);
  expect(normalizeGradi(back?.gradi ?? [])).toEqual(normalizeGradi(gradi));
}

describe('gradi: ogni combinazione genera un livello valido', () => {
  const seeds: Record<string, string> = { piccolo: 'p7tr4m', medio: 'm7tr4m', grande: 'g7tr4m' };
  for (const d of DIMENSIONI_ORDER) {
    it(`${d}: le 16 combinazioni dei gradi che cambiano il livello`, () => {
      const seed = seeds[d] as string;
      for (const g of allGradiCombos(GRADI_LIVELLO)) {
        const r = generate(liberoSpec(seed, g));
        checkLevel(r.level, seed, normalizeGradi(g), r.min);
      }
    }, 60_000);
  }

  it('Senza Disfa e Spilli velati non cambiano il livello (solo il suo id)', () => {
    const seed = 'm3fg9';
    for (const g of allGradiCombos(GRADI_LIVELLO).filter((_x, i) => i % 3 === 0)) {
      const base = generate(liberoSpec(seed, g));
      for (const extra of [['senzaDisfa'], ['spilliVelati'], ['senzaDisfa', 'spilliVelati']] as GradoId[][]) {
        const all = normalizeGradi([...g, ...extra]);
        const r = generate(liberoSpec(seed, all));
        expect({ ...r.level, id: '' }).toEqual({ ...base.level, id: '' });
        expect(r.min).toBe(base.min);
        expect(r.level.id).toBe(liberoLevelId(seed, all));
      }
    }
  }, 60_000);

  it('stesso seme e stessi gradi danno lo stesso livello (deterministico)', () => {
    const a = generate(liberoSpec('g0dd', ['nodoInPiu']));
    const b = generate(liberoSpec('g0dd', ['nodoInPiu']));
    expect(a.level).toEqual(b.level);
    expect(a.min).toBe(b.min);
  });
});
