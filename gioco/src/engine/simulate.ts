/**
 * Simulazione di una notte già decisa: riapplica le righe (`RowMoves`) dallo
 * stato iniziale con `applyRow` e restituisce timeline, eventi ed eventuale
 * prima riga rifiutata. Serve al tombolo (Disfa, ripresa, Ripassa, spartito),
 * ai suggerimenti, a `levels:check` e ai test.
 */
import type { Condition, CondReport, LaceEvent, LaceState, LevelDef, RowMoves, RunContext, Violation } from '../core/types';
import { applyRow } from './rules';
import { initialState } from './state';
import { evaluate } from './conditions';

export interface Simulation {
  ok: boolean;
  timeline: LaceState[];
  /** events[i] = eventi della riga che porta a timeline[i + 1]. */
  events: LaceEvent[][];
  /** Righe effettivamente applicate (con gli incroci forzati ricalcolati). */
  rows: RowMoves[];
  failedAt?: { hour: number; violations: Violation[] };
}

/** Riapplica le righe; gli incroci forzati presenti nelle righe si ignorano e si ricalcolano. */
export function simulate(level: LevelDef, ctx: RunContext, rows: readonly RowMoves[], from?: LaceState): Simulation {
  const timeline: LaceState[] = [from ?? initialState(level, ctx)];
  const events: LaceEvent[][] = [];
  const applied: RowMoves[] = [];
  for (const r of rows) {
    const s = timeline[timeline.length - 1] as LaceState;
    const res = applyRow(level, s, r.crossings.filter((c) => !c.forced), ctx);
    if (!res.ok) return { ok: false, timeline, events, rows: applied, failedAt: { hour: s.hour + 1, violations: res.violations } };
    timeline.push(res.state);
    events.push(res.events);
    applied.push({ hour: res.state.hour, crossings: crossingsOf(res.events, r.crossings) });
  }
  return { ok: true, timeline, events, rows: applied };
}

/** Incroci della riga ricostruiti dagli eventi 'incontro'; quelli che il giocatore non ha chiesto sono forzati. */
export function crossingsOf(events: readonly LaceEvent[], draft: readonly RowMoves['crossings'][number][]): RowMoves['crossings'] {
  const mine = new Set(draft.filter((c) => !c.forced).map((c) => c.pair));
  const out: RowMoves['crossings'] = [];
  for (const e of events) {
    if (e.k !== 'incontro') continue;
    const c: RowMoves['crossings'][number] = { pair: e.pair, over: e.over === e.a ? 'L' : 'R' };
    if (!mine.has(e.pair)) c.forced = true;
    out.push(c);
  }
  return out;
}

/** Simula e valuta le condizioni a fine giornata. */
export function simulateAndEvaluate(level: LevelDef, ctx: RunContext, rows: readonly RowMoves[], conds: Condition[]): { sim: Simulation; reports: CondReport[]; allOk: boolean } {
  const sim = simulate(level, ctx, rows);
  const complete = sim.ok && sim.timeline.length === level.endHour - level.startHour + 1;
  const reports = evaluate(level, sim.timeline, sim.events, conds, ctx, complete);
  return { sim, reports, allOk: complete && reports.every((r) => r.status === 'soddisfatta') };
}
