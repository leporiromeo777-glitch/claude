/**
 * Giocatore automatico avido (ARCHITETTURA 5.2, GDD 8.3): a ogni riga sceglie,
 * fra tutte le righe valide, quella che massimizza un punteggio di progresso
 * guardando solo lo stato subito dopo (distanze dagli spilli, lettere più
 * vicine ai destinatari, fili da far incontrare più vicini, condizioni
 * rispettate, poca matassa spesa). Serve al filtro di qualità del generatore:
 * un buon merletto del giorno non si risolve così.
 */
import type { Condition, LevelDef, RowMoves, RunContext } from '../core/types';
import type { Model } from './model';
import { B_LETTERA, buildModel } from './model';
import type { RowSpec } from './core';
import { blockedMask, colOf, ginoFailed, initialCompact, isDelivered, newRowInfo, nonPlayerMask, stepRow } from './core';
import type { Atom, Program } from './conditions';
import { S_FAIL, S_OK, compileProgram, conditionBeads, finalizeAtoms, programCanOk, programOk, updateAtoms } from './conditions';
import { decodeRow, encodeRow, genPool, generateRows, pinBound, pinPlan, pinsOk } from './moves';

export interface BotResult {
  solved: boolean;
  rows: RowMoves[];
  incroci: number;
  /** Ora in cui si è bloccato (nessuna riga valida), se succede. */
  stuckAt?: number;
}

function dist(m: Model, S: Int32Array, a: number, b: number): number {
  const ca = colOf(S, m.W, a);
  const cb = colOf(S, m.W, b);
  if (ca < 0 || cb < 0) return 0;
  return Math.abs(ca - cb);
}

function atomScore(a: Atom, m: Model, S: Int32Array): number {
  const st = S[a.slot] as number;
  if (st === S_OK) return 60;
  if (st === S_FAIL) return -100_000;
  switch (a.t) {
    case 'presso': {
      const c = a.a >= 0 ? colOf(S, m.W, a.a) : -1;
      return c >= 0 && a.col >= 0 ? -4 * Math.abs(c - a.col) : 0;
    }
    case 'incontra':
    case 'sopra':
      return a.a >= 0 && a.b >= 0 ? -3 * dist(m, S, a.a, a.b) : 0;
    case 'consegnata': {
      if (a.bead < 0) return 0;
      const h = S[m.slot[a.bead] as number] as number;
      const to = m.beadTo[a.bead] as number;
      return h >= 0 && to >= 0 ? -4 * dist(m, S, h, to) : 0;
    }
    case 'ha': {
      if (a.bead < 0 || a.a < 0) return 0;
      const sl = m.slot[a.bead] as number;
      if (sl < 0) return 0;
      if (m.beadType[a.bead] === B_LETTERA) {
        const h = S[sl] as number;
        return h >= 0 && !isDelivered(m, S, a.bead) ? -3 * dist(m, S, h, a.a) : 0;
      }
      const mask = S[sl] as number;
      let best = 99;
      for (let t = 0; t < m.T; t++) if (mask & (1 << t)) best = Math.min(best, dist(m, S, t, a.a));
      return best === 99 ? 0 : -3 * best;
    }
    case 'parte': {
      if (a.hour < 0 || a.a < 0) return 0;
      const c = colOf(S, m.W, a.a);
      const steps = m.edgesAt[a.hour] ?? [];
      const s0 = steps[0];
      return c >= 0 && s0 ? -3 * Math.abs(c - s0.col) : 0;
    }
    case 'esceCon': {
      if (a.bead < 0) return 0;
      const sl = m.slot[a.bead] as number;
      const s0 = (m.edgesAt[a.hour] ?? [])[0];
      if (sl < 0 || !s0) return 0;
      if (m.beadType[a.bead] === B_LETTERA) {
        const c = colOf(S, m.W, S[sl] as number);
        return c >= 0 ? -3 * Math.abs(c - s0.col) : 0;
      }
      return 0;
    }
    default:
      return 0;
  }
}

function score(m: Model, p: Program, S: Int32Array, h: number, player: number): number {
  let s = -2 * player;
  for (const a of p.atoms) s += atomScore(a, m, S);
  // Spilli delle prossime tre ore: avvicinarsi.
  for (const pin of m.pins) {
    if (pin.hour <= h || pin.hour > h + 3 || pin.col < 0) continue;
    const c = colOf(S, m.W, pin.thread);
    if (c >= 0) s -= 5 * Math.abs(c - pin.col);
  }
  return s;
}

/** Gioca la notte con la strategia avida; `solved` se arriva in fondo con tutte le condizioni soddisfatte. */
export function greedyPlay(level: LevelDef, ctx: RunContext, goals: readonly Condition[], matassa = level.matassa): BotResult {
  const tracked = new Set(conditionBeads(level, goals));
  for (const b of level.beads) if (b.type === 'lettera') tracked.add(b.id);
  const m = buildModel(level, ctx, { track: ctx.quirks.includes('pieroTrabocca') ? 'all' : tracked });
  const p = compileProgram(m, goals, m.LEN);
  const pp = pinPlan(m);
  const np = nonPlayerMask(m);
  const S = new Int32Array(p.end);
  S.set(initialCompact(m));
  updateAtoms(p, m, S, m.startHour, null);
  const tmp = new Int32Array(p.end);
  const best = new Int32Array(p.end);
  const info = newRowInfo();
  const gen = genPool();
  const rows: RowMoves[] = [];
  let used = 0;
  for (let h = m.startHour + 1; h <= m.endHour; h++) {
    const left = matassa - used;
    const blocked = blockedMask(m, S, h);
    generateRows(m, p, S, h, blocked, np, left, gen);
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCode = -1;
    let bestPlayer = 0;
    for (let r = 0; r < gen.n; r++) {
      const row = gen.rows[r] as RowSpec;
      let k = 0;
      for (let j = 0; j < row.n; j++) if (!row.forced[j]) k++;
      if (k > left) continue;
      stepRow(m, S, tmp, row, h, info, null);
      if (!pinsOk(m, tmp, h)) continue;
      if (ginoFailed(m, S, row, blocked, left)) continue;
      updateAtoms(p, m, tmp, h, info);
      let sc = score(m, p, tmp, h, k);
      if (!programCanOk(p, m, tmp, h)) sc -= 1_000_000;
      const lb = pinBound(m, pp, tmp, h);
      if (lb < 0) sc -= 1_000_000;
      else if (used + k + lb > matassa) sc -= 500_000;
      if (sc > bestScore) {
        bestScore = sc;
        bestCode = encodeRow(row);
        bestPlayer = k;
        best.set(tmp);
      }
    }
    if (bestCode < 0) return { solved: false, rows, incroci: used, stuckAt: h };
    S.set(best);
    used += bestPlayer;
    rows.push(decodeRow(bestCode, h));
  }
  finalizeAtoms(p, m, S);
  return { solved: used <= matassa && programOk(p, S), rows, incroci: used };
}

