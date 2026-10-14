/**
 * Generatore e Merletto del giorno (GDD 8.3-8.4): determinismo, filtro di
 * qualità, regola del giorno, gradi, tempi, semi di riserva.
 */
import { describe, expect, it } from 'vitest';
import type { GradoId, RuleId } from '../../../src/core/types';
import { createContext, dailySpec, dayOfYear, generate, greedyPlay, minRange, nextDate, simulateAndEvaluate, solve, weekday } from '../../../src/engine/index';
import type { GenSpec } from '../../../src/engine/index';
import { buildCandidate, effectiveRows, qualityCheck } from '../../../src/engine/generator';
import { solveInternal } from '../../../src/engine/solver';
import fallback from '../../../src/engine/data/daily-fallback.json';

const RULES: RuleId[] = ['voce', 'segreto', 'molo', 'febbre', 'rancore', 'marea', 'nero'];

describe('calendario', () => {
  it('giorno della settimana e regola del giorno', () => {
    expect(weekday('2026-10-14')).toBe(3); // mercoledì
    expect(weekday('2026-10-18')).toBe(0); // domenica
    expect(weekday('2000-02-29')).toBe(2);
    const rules = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d) => dailySpec(d).rule);
    expect(rules).toEqual(['voce', 'segreto', 'molo', 'febbre', 'rancore', 'marea', 'nero']);
  });

  it('dimensioni: lunedì-giovedì 5×7, venerdì-domenica 6×8', () => {
    expect(dailySpec('2026-10-19')).toMatchObject({ columns: 5, rows: 7, seed: '2026-10-19' });
    expect(dailySpec('2026-10-23')).toMatchObject({ columns: 6, rows: 8 });
  });

  it('giorno dell\'anno e data successiva', () => {
    expect(dayOfYear('2026-01-01')).toBe(1);
    expect(dayOfYear('2026-10-14')).toBe(287);
    expect(dayOfYear('2024-12-31')).toBe(366);
    expect(nextDate('2026-12-31')).toBe('2027-01-01');
    expect(nextDate('2028-02-28')).toBe('2028-02-29');
  });
});

describe('generate', () => {
  it('è deterministico (20 semi)', () => {
    for (let i = 0; i < 20; i++) {
      const spec: GenSpec = { seed: `seme-${i}`, columns: i % 2 ? 5 : 6, rows: i % 2 ? 7 : 8, rule: RULES[i % RULES.length] as RuleId, gradi: [], difficulty: 'medio' };
      expect(generate(spec)).toEqual(generate(spec));
    }
  }, 90_000);

  it('semi diversi danno livelli diversi', () => {
    const a = generate(dailySpec('2026-10-19')).level;
    const b = generate(dailySpec('2026-10-26')).level;
    expect(JSON.stringify(a.initial) + JSON.stringify(a.goals)).not.toBe(JSON.stringify(b.initial) + JSON.stringify(b.goals));
  });

  it('30 giorni dal 2026-10-14: ognuno in meno di 1,5 s, con il filtro superato (o la riserva segnalata)', () => {
    let d = '2026-10-14';
    for (let i = 0; i < 30; i++) {
      const spec = dailySpec(d);
      const t0 = performance.now();
      const r = generate(spec);
      const ms = performance.now() - t0;
      expect(ms, d).toBeLessThan(1500);
      const level = r.level;
      expect(level.id).toBe(`day-${d}`);
      expect(level.kind).toBe('giornaliero');
      expect(level.columns).toHaveLength(spec.columns);
      expect(level.endHour - level.startHour).toBe(spec.rows);
      expect(level.rules).toContain(spec.rule);
      if (!r.fromFallback) {
        const [lo, hi] = minRange(spec.columns, spec.rows);
        expect(r.min).toBeGreaterThanOrEqual(lo);
        expect(r.min).toBeLessThanOrEqual(hi);
        expect(r.optimalCount).toBeLessThanOrEqual(12);
        expect(level.matassa).toBe(r.min + 1);
        const ctx = createContext(level, {});
        const goals = level.goals ?? [];
        // risolvibile con la matassa della giornata, e il minimo è quello
        const s = solve({ level, ctx, goals });
        expect(s.status).toBe('ok');
        expect(s.incroci).toBe(r.min);
        // il giocatore avido non ce la fa
        expect(greedyPlay(level, ctx, goals).solved).toBe(false);
        // la regola serve davvero
        const w = solveInternal({ level, ctx, goals, matassa: hi }, { disable: [spec.rule] });
        if (w.status === 'ok') expect(simulateAndEvaluate({ ...level, matassa: hi }, ctx, w.rows ?? [], goals).allOk).toBe(false);
      }
      d = nextDate(d);
    }
  }, 60_000);

  it('obiettivi del giorno: lettere da consegnare, un vincolo e spilli d\'ottone', () => {
    const { level } = generate(dailySpec('2026-10-16'));
    const goals = level.goals ?? [];
    expect(goals.some((g) => g.t === 'consegnata')).toBe(true);
    expect(goals.some((g) => g.t === 'nonHa' || g.t === 'nonIncontra')).toBe(true);
    expect(level.pins.length).toBeGreaterThanOrEqual(1);
    expect(level.pins.length).toBeLessThanOrEqual(2);
  });

  it('ogni combinazione di gradi genera un livello valido', () => {
    const gradi: GradoId[] = ['matassaEsatta', 'senzaDisfa', 'spilliVelati', 'nodoInPiu', 'neroInPiu', 'notteCorta'];
    const combos: GradoId[][] = [[], ...gradi.map((g) => [g]), ['matassaEsatta', 'nodoInPiu'], ['neroInPiu', 'notteCorta'], gradi];
    for (const [i, g] of combos.entries()) {
      const spec: GenSpec = { seed: `gradi-${i}`, columns: 5, rows: 7, rule: RULES[i % RULES.length] as RuleId, gradi: g, difficulty: 'medio' };
      const r = generate(spec);
      const level = r.level;
      expect(level.endHour - level.startHour).toBe(effectiveRows(spec));
      const ctx = createContext(level, {});
      const s = solve({ level, ctx, goals: level.goals ?? [] });
      expect(s.status, g.join('+')).toBe('ok');
      expect(level.matassa).toBe(r.min + (g.includes('matassaEsatta') ? 0 : 1));
      if (g.includes('nodoInPiu')) expect((level.rancor ?? []).length).toBeGreaterThanOrEqual(1);
      if (g.includes('neroInPiu')) expect(level.nero).toBeDefined();
    }
  }, 60_000);

  it('libero: id e tipo', () => {
    const r = generate({ seed: 'abc', columns: 4, rows: 6, rule: 'voce', gradi: ['notteCorta'], difficulty: 'piccolo' });
    expect(r.level.kind).toBe('libero');
    expect(r.level.id).toBe('lib-abc~notteCorta');
  });
});

describe('semi di riserva', () => {
  const entries = (fallback as { entries: { rule: RuleId; columns: number; rows: number; seed: string }[] }).entries;
  it('60 semi, per tutte e sette le regole', () => {
    expect(entries).toHaveLength(60);
    for (const r of RULES) expect(entries.filter((e) => e.rule === r).length).toBeGreaterThanOrEqual(8);
  });

  it('ogni seme di riserva passa il filtro di qualità', () => {
    for (const e of entries.slice(0, 14)) {
      const spec: GenSpec = { seed: e.seed.split('#')[0] ?? e.seed, columns: e.columns as 5 | 6, rows: e.rows, rule: e.rule, gradi: [], difficulty: 'medio' };
      expect(qualityCheck(spec, buildCandidate(spec, e.seed)).ok, e.seed).toBe(true);
    }
  }, 30_000);
});
