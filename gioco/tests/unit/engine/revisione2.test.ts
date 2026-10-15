/**
 * Revisione 2 del motore (docs/REVISIONE-2.md):
 * - R2-D1, Q041, Q025: Indizio confrontato con la bozza, Fantasma con tutti gli
 *   incroci della riga; seguirli riga per riga porta sempre a una soluzione;
 * - Q062: con «Spilli velati» la Spinta non nomina spilli ancora nascosti;
 * - Q076: la frase della nonna del livello non parla di un evento passato;
 * - R2-D2, Q024: l'incrocio forzato rifatto a mano (l'«eco») resta forzato.
 */
import { describe, expect, it } from 'vitest';
import type { Condition, Crossing, LaceState, LevelDef, RowMoves, RunContext } from '../../../src/core/types';
import type { GenSpec } from '../../../src/engine/index';
import { HINT_KEYS, applyRow, createContext, evaluate, hintFor, initialState, metrics, rowDiffs, simulate, solve, spintaCustomUntil } from '../../../src/engine/index';
import { buildCandidate } from '../../../src/engine/generator';
import { crossingsOf, forcedPairsOf } from '../../../src/engine/simulate';
import { fixture, mk, noteRequest } from './helpers';

/** Livelli generati (semi della riserva del giornaliero) che hanno una soluzione. */
function generated(n: number): { level: LevelDef; goals: Condition[] }[] {
  const out: { level: LevelDef; goals: Condition[] }[] = [];
  const rules = ['nero', 'voce', 'segreto', 'molo', 'febbre', 'rancore', 'marea'] as const;
  for (let i = 0; out.length < n && i < 60; i++) {
    const rule = rules[i % rules.length] as GenSpec['rule'];
    const spec = { seed: `r2-${i}`, columns: 6, rows: 7, rule, gradi: [], difficulty: 'medio' } as unknown as Parameters<typeof buildCandidate>[0];
    const b = buildCandidate(spec, `r2-${i}#1`);
    const level = { ...b.level, goals: b.goals, matassa: 99 };
    const res = solve({ level, ctx: createContext(level, {}), goals: b.goals, maxStates: 60_000 });
    if (res.status !== 'ok' || !res.rows?.some((r) => r.crossings.filter((c) => !c.forced).length >= 2)) continue;
    out.push({ level, goals: b.goals });
  }
  return out;
}

/** Fissa la riga `draft` dallo stato corrente; fallisce il test se il motore la rifiuta. */
function fixRow(level: LevelDef, ctx: RunContext, timeline: LaceState[], rows: RowMoves[], draft: Crossing[]): void {
  const st = timeline[timeline.length - 1] as LaceState;
  const res = applyRow(level, st, draft, ctx);
  expect(res.ok, `riga delle ${st.hour + 1}: ${JSON.stringify(res.violations)}`).toBe(true);
  rows.push({ hour: res.state.hour, crossings: crossingsOf(res.events, draft, forcedPairsOf(level, st, ctx)) });
  timeline.push(res.state);
}

function allSatisfied(level: LevelDef, ctx: RunContext, rows: RowMoves[], goals: Condition[]): boolean {
  const sim = simulate(level, ctx, rows);
  return sim.ok && evaluate(level, sim.timeline, sim.events, goals, ctx, true).every((r) => r.status === 'soddisfatta');
}

describe('R2-D1: il Fantasma mostra tutta la riga (Q041)', () => {
  const levels = generated(4);

  it('ci sono livelli con righe da due incroci', () => {
    expect(levels.length).toBeGreaterThanOrEqual(2);
  });

  it('applicare il Fantasma riga per riga arriva alla soluzione', () => {
    for (const { level, goals } of levels) {
      const ctx = createContext(level, {});
      const timeline = [initialState(level, ctx)];
      const rows: RowMoves[] = [];
      let many = 0;
      while ((timeline[timeline.length - 1] as LaceState).hour < level.endHour) {
        const h = hintFor({ level, ctx, timeline, rows, goals, tier: 'fantasma', draft: [] });
        expect(h.textKey, level.id).not.toBe(HINT_KEYS.impossibile);
        const ghosts = h.ghosts ?? [];
        if (ghosts.length > 1) {
          many++;
          expect(h.textKey).toBe(ghosts.length === 2 ? HINT_KEYS.fantasmaDue : HINT_KEYS.fantasmaTre);
          expect(h.params?.sopra2).toBeTruthy();
        }
        expect(h.ghost ?? null).toEqual(ghosts[0] ?? null);
        fixRow(level, ctx, timeline, rows, ghosts);
      }
      expect(allSatisfied(level, ctx, rows, goals), level.id).toBe(true);
      expect(many, `${level.id}: almeno una riga con più incroci`).toBeGreaterThan(0);
    }
  });

  it('applicare l\'Indizio finché dice «va bene» arriva alla soluzione', () => {
    for (const { level, goals } of levels.slice(0, 2)) {
      const ctx = createContext(level, {});
      const timeline = [initialState(level, ctx)];
      const rows: RowMoves[] = [];
      while ((timeline[timeline.length - 1] as LaceState).hour < level.endHour) {
        const draft: Crossing[] = [];
        for (let guard = 0; guard < 6; guard++) {
          const h = hintFor({ level, ctx, timeline, rows, goals, tier: 'indizio', draft });
          if (h.textKey === HINT_KEYS.indizioVa || h.textKey === HINT_KEYS.indizioQuiete) break;
          expect([HINT_KEYS.indizioSopra, HINT_KEYS.indizioSopraAltri]).toContain(h.textKey);
          const st = timeline[timeline.length - 1] as LaceState;
          const col = h.highlight?.column as number;
          const over: Crossing['over'] = st.pos[col] === h.params?.sopra ? 'L' : 'R';
          draft.push({ pair: col, over });
        }
        fixRow(level, ctx, timeline, rows, draft);
      }
      expect(allSatisfied(level, ctx, rows, goals), level.id).toBe(true);
    }
  });
});

describe('R2-D1: l\'Indizio confronta la bozza con la riga della soluzione (Q025)', () => {
  const g00 = fixture('g00');
  const ctx = createContext(g00, {});
  const goals = g00.goals ?? [];
  const start = [initialState(g00, ctx)];

  it('bozza giusta: «Quest\'ora va bene: fissala»', () => {
    const h = hintFor({ level: g00, ctx, timeline: start, rows: [], goals, tier: 'indizio', draft: [{ pair: 0, over: 'R' }] });
    expect(h).toMatchObject({ tier: 'indizio', textKey: HINT_KEYS.indizioVa, params: { ora: 6 } });
  });

  it('verso rovesciato: lo dice', () => {
    const h = hintFor({ level: g00, ctx, timeline: start, rows: [], goals, tier: 'indizio', draft: [{ pair: 0, over: 'L' }] });
    expect(h).toMatchObject({ textKey: HINT_KEYS.indizioVerso, params: { ora: 6, sopra: 'marta', sotto: 'teresa', altri: 0 } });
  });

  it('un incrocio di troppo: lo dice per primo, e dice che manca ancora quello giusto', () => {
    const h = hintFor({ level: g00, ctx, timeline: start, rows: [], goals, tier: 'indizio', draft: [{ pair: 1, over: 'L' }] });
    // La coppia 0 manca, la 1 è di troppo: si scioglie prima la 1 (ha un filo in comune con la 0,
    // e finché c'è il motore rifiuterebbe la 0: verifica R2, l'Indizio non porta mai a un rifiuto).
    const pos = start[0]!.pos;
    expect(h).toMatchObject({ textKey: HINT_KEYS.indizioTroppo, params: { ora: 6, a: pos[1], b: pos[2], altri: 1 } });
  });

  it('dopo aver sciolto quello di troppo, l\'Indizio nomina quello che manca', () => {
    const h = hintFor({ level: g00, ctx, timeline: start, rows: [], goals, tier: 'indizio', draft: [] });
    expect(h).toMatchObject({ textKey: HINT_KEYS.indizioSopra, params: { ora: 6, sopra: 'marta', sotto: 'teresa' } });
  });

  it('il Fantasma con un incrocio di troppo nella bozza lo nomina da sciogliere', () => {
    const h = hintFor({ level: g00, ctx, timeline: start, rows: [], goals, tier: 'fantasma', draft: [{ pair: 1, over: 'L' }] });
    expect(h.ghosts).toEqual([{ pair: 0, over: 'R' }]);
    expect(h.extra).toEqual([{ pair: 1, over: 'L' }]);
  });

  it('il Fantasma con la bozza già giusta non mostra niente (e non costa)', () => {
    const h = hintFor({ level: g00, ctx, timeline: start, rows: [], goals, tier: 'fantasma', draft: [{ pair: 0, over: 'R' }] });
    expect(h.textKey).toBe(HINT_KEYS.fantasmaVa);
    expect(h.ghost).toBeUndefined();
  });

  it('rowDiffs: da sinistra, mancante, rovesciato, di troppo', () => {
    expect(rowDiffs([{ pair: 2, over: 'L' }, { pair: 0, over: 'R' }], [{ pair: 0, over: 'L' }, { pair: 3, over: 'R' }])).toEqual([
      { k: 'verso', c: { pair: 0, over: 'L' } },
      { k: 'troppo', c: { pair: 2, over: 'L' } },
      { k: 'manca', c: { pair: 3, over: 'R' } },
    ]);
    expect(rowDiffs([{ pair: 1, over: 'R', forced: true }], [])).toEqual([]);
  });
});

describe('Spinta (Q062, Q076)', () => {
  it('con «Spilli velati» non nomina uno spillo ancora nascosto', () => {
    const lv = mk({ initial: ['a', 'b', 'c'], startHour: 8, endHour: 14, pins: [{ thread: 'a', place: 'piazza', hour: 13 }] });
    const ctx = createContext(lv, {});
    const st = [initialState(lv, ctx)];
    const open = hintFor({ level: lv, ctx, timeline: st, rows: [], goals: [], tier: 'spinta' });
    expect(open.params?.ora).toBe(13);
    const veiled = hintFor({ level: lv, ctx, timeline: st, rows: [], goals: [], tier: 'spinta', gradi: ['spilliVelati'] });
    expect(veiled.textKey).toBe(HINT_KEYS.spintaGenerico);
    expect(JSON.stringify(veiled)).not.toContain('13');
  });

  it('la frase del livello vale fino al primo evento della giornata', () => {
    expect(spintaCustomUntil(fixture('g00'))).toBe(Number.POSITIVE_INFINITY);
    const lv = mk({ initial: ['a', 'b', 'c'], extra: ['lino9'], edges: [{ hour: 8, side: 'molo', kind: 'barca' }], hintKeys: { spinta: 'x.spinta' } });
    expect(spintaCustomUntil(lv)).toBe(8);
    expect(spintaCustomUntil({ ...lv, edges: [], tide: [{ from: 9, to: 10, places: ['molo'] }] })).toBe(10);
    const ctx = createContext(lv, {});
    const sim = simulate(lv, ctx, [
      { hour: 7, crossings: [] },
      { hour: 8, crossings: [] },
    ]);
    expect(sim.ok).toBe(true);
    // Alle 7 e alle 8 la frase del livello; alle 9 (barca passata) le frasi generiche.
    expect(hintFor({ level: lv, ctx, timeline: sim.timeline.slice(0, 1), rows: [], goals: [], tier: 'spinta' }).textKey).toBe('x.spinta');
    expect(hintFor({ level: lv, ctx, timeline: sim.timeline.slice(0, 2), rows: [], goals: [], tier: 'spinta' }).textKey).toBe('x.spinta');
    expect(hintFor({ level: lv, ctx, timeline: sim.timeline.slice(0, 3), rows: [], goals: [], tier: 'spinta' }).textKey).toBe(HINT_KEYS.spintaGenerico);
  });
});

describe('R2-D2: incroci contati solo del giocatore (Q024)', () => {
  it('un incrocio uguale a quello forzato del filo nero resta forzato', () => {
    const lv = fixture('test-nero');
    const ctx = createContext(lv, {});
    // Si cerca una riga con un incrocio forzato e lo si «rifà» a mano.
    const sol = solve({ level: lv, ctx, goals: lv.goals ?? [], maxStates: 60_000 });
    expect(sol.status).toBe('ok');
    let st = initialState(lv, ctx);
    let checked = 0;
    for (const r of sol.rows ?? []) {
      const forced = r.crossings.filter((c) => c.forced).map((c) => ({ pair: c.pair, over: c.over }));
      const mine = r.crossings.filter((c) => !c.forced).map((c) => ({ pair: c.pair, over: c.over }));
      const res = applyRow(lv, st, [...mine, ...forced], ctx);
      expect(res.ok).toBe(true);
      const row = crossingsOf(res.events, [...mine, ...forced], forcedPairsOf(lv, st, ctx));
      expect(row.filter((c) => !c.forced).length).toBe(mine.length);
      if (forced.length > 0) checked++;
      st = res.state;
    }
    expect(checked).toBeGreaterThan(0);
    expect(metrics(lv, sol.rows ?? [], null, false).incroci).toBe((sol.rows ?? []).reduce((n, r) => n + r.crossings.filter((c) => !c.forced).length, 0));
  });

  it('noteRequest resta disponibile per i test dei bigliettini', () => {
    expect(noteRequest('g06.nina')).toBeTruthy();
  });
});
