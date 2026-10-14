/**
 * Una notte "già decisa" senza il tombolo: si riapplicano righe date (di solito la
 * soluzione precalcolata in `.computed.json`) e si costruisce il `NightOutcome` come
 * lo farebbe il tombolo. Serve al debug (`__GAME__.campaign.finishDay()`) e ai test
 * del flusso della campagna in Node.
 */
import type { LevelComputed, LevelDef, NightOutcome, NightParams, NoteId, RowMoves, ThreadId } from '../core/types';
import { createContext, encodeSpartito, evaluate, metrics, simulate } from '../engine/index';

/** Soluzione precalcolata per le richieste accettate (o la base se non c'è o è impossibile). */
export function precomputedRows(computed: LevelComputed | null | undefined, noteIds: readonly NoteId[]): RowMoves[] | null {
  if (!computed) return null;
  const ids = [...noteIds].sort();
  if (ids.length === 0) return computed.base.rows ?? null;
  if (ids.length === 1) {
    const r = computed.perNote[ids[0] as string];
    if (r?.rows) return r.rows;
  } else {
    const c = computed.combos.find((x) => [...x.notes].sort().join('|') === ids.join('|'));
    if (c?.rows) return c.rows;
  }
  return computed.base.rows ?? null;
}

export function minFor(computed: LevelComputed | null | undefined, noteIds: readonly NoteId[], archive: boolean): number | null {
  if (!computed) return null;
  if (archive) return computed.base.incroci;
  const ids = [...noteIds].sort();
  if (ids.length === 0) return computed.base.incroci;
  if (ids.length === 1) return computed.perNote[ids[0] as string]?.incroci ?? null;
  return computed.combos.find((x) => [...x.notes].sort().join('|') === ids.join('|'))?.incroci ?? null;
}

/** Filo su cui appuntare il nome di Ada quando la notte lo chiede: il primo filo con nome. */
export function defaultNomeThread(level: LevelDef): ThreadId | null {
  const first = level.initial.find((t) => level.threads.find((x) => x.id === t)?.kind === 'persona');
  return first ?? level.initial[0] ?? null;
}

/** Esito di una notte giocata con righe date (null se le righe non sono valide). */
export function simulateNight(params: NightParams, rows: readonly RowMoves[], computed?: LevelComputed | null, balance?: { traboccoSoglia: number; nodoRighe: number } | null): NightOutcome | null {
  const level = params.level;
  const nomeOn = params.needsNome ? defaultNomeThread(level) : null;
  const occasions = params.mode === 'occasioni' ? (computed?.occasionsSolution ?? []) : [];
  const ctx = createContext(level, params.flags, { nomeOn, occasions, balance: balance ?? null });
  const total = level.endHour - level.startHour;
  // Autotessitura: le righe le decide il motore (incroci forzati); si passano righe vuote.
  const input: RowMoves[] =
    params.mode === 'occasioni' ? Array.from({ length: total }, (_, i) => ({ hour: level.startHour + i + 1, crossings: [] })) : rows.map((r) => ({ hour: r.hour, crossings: r.crossings.filter((c) => !c.forced) }));
  const sim = simulate(level, ctx, input);
  if (!sim.ok || sim.timeline.length !== total + 1) return null;
  const goals = evaluate(level, sim.timeline, sim.events, params.goals, ctx, true);
  const reps = params.accepted.length > 0 ? evaluate(level, sim.timeline, sim.events, params.accepted.map((a) => a.request), ctx, true) : [];
  const requests = params.accepted.map((a, i) => ({ noteId: a.noteId, status: reps[i]?.status === 'soddisfatta' ? ('soddisfatta' as const) : ('fallita' as const) }));
  const min = minFor(computed, params.accepted.map((a) => a.noteId), !!level.archive);
  let spartito = '';
  try {
    spartito = encodeSpartito({ mode: 'S', ref: level.id, rows: sim.rows });
  } catch {
    spartito = '';
  }
  const outcome: NightOutcome = {
    origin: params.origin,
    levelId: level.id,
    rows: sim.rows,
    timeline: sim.timeline,
    events: sim.events,
    goals,
    requests,
    dropped: [],
    metrics: metrics(level, sim.rows, min, false),
    spartito,
    hintsUsed: 0,
    fantasmaUsed: false,
    discoveredQuirks: [],
    nomeOn,
  };
  if (level.archive) outcome.archive = { named: true, mended: params.mode === 'occasioni' ? goals.every((g) => g.status === 'soddisfatta') : true };
  if (params.mode === 'occasioni') outcome.occasions = occasions.map((o) => ({ ...o }));
  return outcome;
}
