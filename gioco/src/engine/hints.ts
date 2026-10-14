/**
 * Suggerimenti a tre gradini (GDD 14), derivati dalla soluzione:
 * - spinta: evidenzia l'obiettivo più urgente (spillo d'ottone o richiesta) con
 *   la frase della nonna del livello (`hintKeys.spinta`) o una generica;
 * - indizio: «Alle {ora} {sopra} deve passare sopra {sotto}», dal primo incrocio
 *   della soluzione a partire dalla riga corrente;
 * - fantasma: l'incrocio giusto della riga corrente (`ghost`).
 *
 * `solution` sono le righe di una soluzione completa (dalla prima ora). Se non
 * c'è, o se non comincia con le righe già fissate, si risolve dallo stato
 * corrente con il solver sincrono e un limite di stati da browser; se da qui
 * non si arriva il suggerimento lo dice, se il solver si ferma al limite di
 * stati si dà il suggerimento generico.
 */
import type { Condition, Crossing, Hint, HintTier, LaceState, LevelDef, RowMoves, RunContext } from '../core/types';
import { solve } from './solver';
import { evaluate } from './conditions';
import { HINT_KEYS } from './keys';
import { applyRow } from './rules';
import { simulate } from './simulate';

export interface HintArgs {
  level: LevelDef;
  ctx: RunContext;
  timeline: LaceState[];
  rows: RowMoves[];
  goals: Condition[];
  tier: HintTier;
  solution?: RowMoves[];
}

const HINT_MAX_STATES = 60_000;

function samePlayerRow(a: RowMoves | undefined, b: RowMoves | undefined): boolean {
  if (!a || !b) return false;
  const k = (r: RowMoves): string =>
    r.crossings
      .filter((c) => !c.forced)
      .map((c) => `${c.pair}${c.over}`)
      .sort()
      .join(',');
  return k(a) === k(b);
}

/**
 * Una soluzione valida dallo stato corrente (righe complete dalla prima ora), o
 * null. Con `why` si sa se manca perché da qui non si arriva ('impossibile') o
 * perché il solver si è fermato al limite di stati ('limite').
 */
export function solutionFrom(args: Omit<HintArgs, 'tier'>, why?: { status: 'impossibile' | 'limite' }): RowMoves[] | null {
  const { level, rows, solution } = args;
  if (solution && solution.length === level.endHour - level.startHour && rows.every((r, i) => samePlayerRow(r, solution[i]))) return solution;
  const state = args.timeline[args.timeline.length - 1];
  if (!state) return null;
  const res = solve({ level, ctx: args.ctx, goals: args.goals, from: { state, rowsDone: rows }, maxStates: HINT_MAX_STATES });
  if (res.status === 'ok' && res.rows) return res.rows;
  if (why) why.status = res.status === 'limite' ? 'limite' : 'impossibile';
  return null;
}

function threadsOf(state: LaceState, c: Crossing): { sopra: string; sotto: string } {
  const L = state.pos[c.pair] ?? '';
  const R = state.pos[c.pair + 1] ?? '';
  return c.over === 'R' ? { sopra: R, sotto: L } : { sopra: L, sotto: R };
}

function spinta(args: HintArgs, state: LaceState): Hint {
  const { level } = args;
  const row = state.hour + 1;
  const custom = level.hintKeys?.spinta;
  // Spillo d'ottone più vicino nel tempo che non è ancora al suo posto.
  const pins = [...level.pins].filter((p) => p.hour >= row).sort((a, b) => a.hour - b.hour);
  for (const p of pins) {
    const col = level.columns.indexOf(p.place);
    if (state.pos[col] === p.thread) continue;
    return { tier: 'spinta', textKey: custom ?? HINT_KEYS.spintaSpillo, params: { chi: p.thread, luogo: p.place, ora: p.hour }, highlight: { hour: p.hour, column: col, pin: { ...p } } };
  }
  // Richiesta a rischio o ancora da fare, con l'ora più vicina.
  if (args.goals.length > 0) {
    const sim = simulate(level, args.ctx, args.rows);
    const timeline = sim.ok ? sim.timeline : args.timeline;
    const reports = evaluate(level, timeline, sim.ok ? sim.events : [], args.goals, args.ctx, false);
    let bestHour = Number.POSITIVE_INFINITY;
    reports.forEach((r, i) => {
      if (r.status === 'soddisfatta' || r.status === 'fallita') return;
      const h = deadline(args.goals[i] as Condition, level);
      if (r.status === 'a_rischio') bestHour = Math.min(bestHour, row);
      else bestHour = Math.min(bestHour, h);
    });
    if (Number.isFinite(bestHour)) return { tier: 'spinta', textKey: custom ?? HINT_KEYS.spintaRichiesta, params: { ora: bestHour }, highlight: { hour: bestHour } };
  }
  return { tier: 'spinta', textKey: custom ?? HINT_KEYS.spintaGenerico, highlight: { hour: row } };
}

/** Ora entro cui una condizione si decide (per la spinta). */
function deadline(c: Condition, level: LevelDef): number {
  switch (c.t) {
    case 'presso':
    case 'esceCon':
      return c.hour;
    case 'maiPresso':
      return c.from;
    case 'incontra':
    case 'nonIncontra':
    case 'sopra':
      return c.to ?? level.endHour;
    case 'consegnata':
    case 'ha':
      return c.by ?? level.endHour;
    case 'parte':
      return c.hour ?? level.endHour;
    case 'tutti':
    case 'almeno':
      return Math.min(...c.of.map((x) => deadline(x, level)));
    case 'non':
      return deadline(c.c, level);
    default:
      return level.endHour;
  }
}

export function hintFor(args: HintArgs): Hint {
  const state = args.timeline[args.timeline.length - 1];
  const row = (state?.hour ?? args.level.startHour) + 1;
  if (!state || row > args.level.endHour) return { tier: args.tier, textKey: HINT_KEYS.spintaGenerico };
  if (args.tier === 'spinta') return spinta(args, state);
  const why: { status: 'impossibile' | 'limite' } = { status: 'impossibile' };
  const sol = solutionFrom(args, why);
  if (!sol) {
    if (args.tier === 'indizio' && args.level.hintKeys?.indizio) return { tier: args.tier, textKey: args.level.hintKeys.indizio };
    // Limite di stati: non si sa se da qui si arriva, quindi il suggerimento generico (ARCHITETTURA 5.2).
    if (why.status === 'limite') return { tier: args.tier, textKey: args.level.hintKeys?.spinta ?? HINT_KEYS.spintaGenerico, highlight: { hour: row } };
    return { tier: args.tier, textKey: HINT_KEYS.impossibile };
  }
  const idx = row - args.level.startHour - 1;
  if (args.tier === 'fantasma') {
    const cur = sol[idx];
    const c = cur?.crossings.find((x) => !x.forced);
    if (!c) return { tier: 'fantasma', textKey: HINT_KEYS.fantasmaQuiete, params: { ora: row }, highlight: { hour: row } };
    const t = threadsOf(state, c);
    return { tier: 'fantasma', textKey: HINT_KEYS.fantasma, params: { ora: row, sopra: t.sopra, sotto: t.sotto }, highlight: { hour: row, column: c.pair }, ghost: { pair: c.pair, over: c.over } };
  }
  // Indizio: primo incrocio della soluzione a partire da questa riga (sullo stato di allora).
  let s: LaceState = state;
  const sim = simulateRows(args, sol, idx);
  for (let i = idx; i < sol.length; i++) {
    const r = sol[i] as RowMoves;
    const c = r.crossings.find((x) => !x.forced);
    if (c) {
      s = sim[i - idx] ?? s;
      const t = threadsOf(s, c);
      return { tier: 'indizio', textKey: HINT_KEYS.indizioSopra, params: { ora: r.hour, sopra: t.sopra, sotto: t.sotto }, highlight: { hour: r.hour, column: c.pair } };
    }
  }
  return { tier: 'indizio', textKey: HINT_KEYS.indizioQuiete, params: { ora: row }, highlight: { hour: row } };
}

/** Stati prima di ogni riga della soluzione a partire da `idx` (per sapere chi c'è nelle coppie). */
function simulateRows(args: HintArgs, sol: RowMoves[], idx: number): LaceState[] {
  const out: LaceState[] = [];
  let s = args.timeline[args.timeline.length - 1] as LaceState;
  out.push(s);
  for (let i = idx; i < sol.length - 1; i++) {
    const r = sol[i] as RowMoves;
    const res = applyForHint(args, s, r);
    if (!res) break;
    s = res;
    out.push(s);
  }
  return out;
}

function applyForHint(args: HintArgs, s: LaceState, r: RowMoves): LaceState | null {
  const res = applyRow(args.level, s, r.crossings.filter((c) => !c.forced), args.ctx);
  return res.ok ? res.state : null;
}
