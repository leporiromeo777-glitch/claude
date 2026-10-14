/**
 * Solver a strati (ARCHITETTURA 5.2): programmazione dinamica con uno strato
 * per ora. Per ogni stato raggiunto si tiene il costo migliore (incroci del
 * giocatore), le ore di quiete, il numero di percorsi ottimi e il predecessore;
 * alla fine si ricostruisce la soluzione.
 *
 * - Stato compatto: posizioni (codice di Lehmer della permutazione quando i
 *   fili sulla tela non cambiano, altrimenti cifre in base T) più i soli bit
 *   rilevanti: le perline nominate dalle condizioni (e quelle da cui dipendono:
 *   la lettera di una 'letta:…', tutti i segreti con il trabocco del pozzo, le
 *   lettere quando ci sono fili autonomi), gli stati delle condizioni, i nodi, il pozzo,
 *   le agende. Chiave numerica esatta se sta in 52 bit, altrimenti hash
 *   numerico con verifica dell'uguaglianza.
 * - Mosse: accoppiamenti della riga che rispettano blocchi e incroci forzati;
 *   il verso si enumera solo quando conta (uno dei due ha perline trasferibili
 *   tracciate, Lunardi con un malato, il pozzo che trabocca, una condizione
 *   `sopra` sulla coppia), altrimenti si usa il verso sinistro (o l'unico ammesso).
 * - Potature: costo + limite inferiore (spostamenti richiesti dagli spilli
 *   futuri) > matassa; spilli futuri irraggiungibili; condizioni che non si
 *   possono più soddisfare (`programCanOk`).
 * - Obiettivi: `minIncroci` (a parità, più ore di quiete) e `maxQuiete` (a
 *   parità, meno incroci). `countOptimal` conta i percorsi ottimi distinti (fino a 50).
 */
import type { Condition, LevelDef, RowMoves, RuleId, RunContext, SolveRequest, SolveResult } from '../core/types';
import type { Model } from './model';
import { buildModel } from './model';
import type { RowInfo, RowSpec } from './core';
import { blockedMask as blockedMask_, ginoFailed as ginoFailed_, initialCompact, newRow, newRowInfo, nonPlayerMask, rowPush, stepRow as stepRow_ } from './core';
import { planAutoCore } from './autoweave';
import type { Program } from './conditions';
import { compileProgram, conditionBeads, finalizeAtoms, programCanOk as programCanOk_, programOk, updateAtoms as updateAtoms_ } from './conditions';
import { decodeRow, encodeRow as encodeRow_, genPool, generateRows as generateRows_, pinBound as pinBound_, pinPlan, pinsOk as pinsOk_ } from './moves';

// Copie locali dei binding importati: in Node (tsx) ogni lettura di un import passa da un
// getter, e queste funzioni girano milioni di volte nel solver. Così si leggono una volta sola.
const encodeRow = encodeRow_;
const generateRows = generateRows_;
const pinBound = pinBound_;
const pinsOk = pinsOk_;
const programCanOk = programCanOk_;
const updateAtoms = updateAtoms_;
const blockedMask = blockedMask_;
const ginoFailed = ginoFailed_;
const stepRow = stepRow_;

/** Versione del solver: cambia quando cambiano le regole o i numeri che il solver produce. */
export const SOLVER_VERSION = 2;

const COUNT_CAP = 50;

function nowMs(): number {
  const p = (globalThis as { performance?: { now(): number } }).performance;
  return p ? p.now() : 0;
}

function isNode(): boolean {
  const proc = (globalThis as { process?: { versions?: { node?: string } } }).process;
  return typeof proc?.versions?.node === 'string';
}

/** Limite di stati predefinito: 400000 in Node, 60000 nel browser. */
export function defaultMaxStates(): number {
  return isNode() ? 400_000 : 60_000;
}

export interface SolveInternalOptions {
  /** Regole spente (generatore). */
  disable?: readonly RuleId[];
}

// ───────────── Chiavi ─────────────

interface Field {
  off: number;
  bias: number;
  range: number;
}

interface KeyPlan {
  exact: boolean;
  lehmer: boolean;
  /** Rango (0..W-1) di ogni filo fra quelli iniziali, per il codice di Lehmer. */
  rank: Int8Array;
  fields: Field[];
  W: number;
  T: number;
  stride: number;
}

function bitsFor(range: number): number {
  return Math.log2(Math.max(1, range));
}

function makeKeyPlan(m: Model, p: Program, withCost: boolean): KeyPlan {
  const W = m.W;
  const lehmer = !m.hasEdges;
  const rank = new Int8Array(32).fill(-1);
  if (lehmer) {
    const sorted = [...m.initial].sort((a, b) => a - b);
    sorted.forEach((t, i) => (rank[t] = i));
  }
  let fact = 1;
  for (let i = 2; i <= W; i++) fact *= i;
  let total = lehmer ? bitsFor(fact) : bitsFor(Math.pow(m.T, W));
  const fields: Field[] = [];
  const add = (off: number, bias: number, range: number): void => {
    if (range <= 1) return;
    fields.push({ off, bias, range });
    total += bitsFor(range);
  };
  let rancorAny = false;
  for (let t = 0; t < m.T; t++) if (m.rancor[t]) rancorAny = true;
  if (rancorAny) {
    add(m.OFF_KNOT, 0, 2 ** m.T);
    for (let j = 1; j < m.knotRows; j++) add(m.OFF_KNOTX + j - 1, 0, 2 ** m.T);
  }
  if (m.trackedLetters.length > 0) add(m.OFF_DELIV, 0, 2 ** (maxLetterOrd(m) + 1));
  if (m.qGino >= 0 && !m.hasAuto) add(m.OFF_GF, 0, 2);
  if (m.trabocca) {
    add(m.OFF_PN, 0, m.B + 2);
    add(m.OFF_PO, 0, 2);
  }
  for (const li of m.trackedLetters) add(m.slot[li] as number, 1, m.T + 1);
  for (const bi of m.trackedMulti) add(m.slot[bi] as number, 0, 2 ** m.T);
  for (const ag of m.agents) add(ag.slot, 0, ag.agenda.length + 1);
  for (const a of p.atoms) {
    add(a.slot, 0, 3);
    if (a.aux >= 0) add(a.aux, 0, a.t === 'parte' ? 2 : 2 ** m.T);
  }
  if (withCost) add(p.end, 0, 64);
  return { exact: total <= 52, lehmer, rank, fields, W, T: m.T, stride: p.end + (withCost ? 1 : 0) };
}

function maxLetterOrd(m: Model): number {
  let mx = -1;
  for (const li of m.trackedLetters) mx = Math.max(mx, m.letterOrd[li] as number);
  return mx;
}

/** Chiave esatta (numero fino a 52 bit) o hash (da verificare). */
function keyOf(k: KeyPlan, S: Int32Array): number {
  const W = k.W;
  let key = 0;
  if (k.lehmer) {
    for (let i = 0; i < W; i++) {
      const ri = k.rank[S[i] as number] as number;
      let smaller = 0;
      for (let j = i + 1; j < W; j++) if ((k.rank[S[j] as number] as number) < ri) smaller++;
      key = key * (W - i) + smaller;
    }
  } else {
    for (let i = 0; i < W; i++) key = key * k.T + (S[i] as number);
  }
  if (k.exact) {
    for (const f of k.fields) key = key * f.range + ((S[f.off] as number) + f.bias);
    return key;
  }
  // Hash a 52 bit (due mescolamenti a 32 bit) di tutto lo stato.
  let h1 = 0x811c9dc5 ^ key;
  let h2 = 0x27d4eb2d ^ Math.imul(key, 0x9e3779b1);
  for (let i = W; i < k.stride; i++) {
    const v = S[i] as number;
    h1 = Math.imul(h1 ^ v, 0x01000193);
    h2 = Math.imul((h2 ^ v) + 0x7f4a7c15, 0x85ebca6b);
    h2 ^= h2 >>> 13;
  }
  return (h1 >>> 0) * 0x100000 + ((h2 >>> 0) & 0xfffff);
}

// ───────────── Strati ─────────────

class Layer {
  n = 0;
  states: Int32Array;
  cost: Int32Array;
  quiete: Int32Array;
  count: Float64Array;
  pred: Int32Array;
  move: Int32Array;
  next: Int32Array;
  table = new Map<number, number>();
  constructor(
    readonly stride: number,
    cap: number,
  ) {
    this.states = new Int32Array(cap * stride);
    this.cost = new Int32Array(cap);
    this.quiete = new Int32Array(cap);
    this.count = new Float64Array(cap);
    this.pred = new Int32Array(cap);
    this.move = new Int32Array(cap);
    this.next = new Int32Array(cap);
  }
  grow(): void {
    const cap = this.cost.length * 2;
    const g = <T extends Int32Array | Float64Array>(a: T, size: number): T => {
      const b = new (a.constructor as new (n: number) => T)(size);
      b.set(a);
      return b;
    };
    this.states = g(this.states, cap * this.stride);
    this.cost = g(this.cost, cap);
    this.quiete = g(this.quiete, cap);
    this.count = g(this.count, cap);
    this.pred = g(this.pred, cap);
    this.move = g(this.move, cap);
    this.next = g(this.next, cap);
  }
  view(i: number): Int32Array {
    return this.states.subarray(i * this.stride, (i + 1) * this.stride);
  }
  /** Indice dello stato uguale a S, o -1. */
  find(key: number, S: Int32Array, exact: boolean): number {
    let i = this.table.get(key);
    if (i === undefined) return -1;
    if (exact) return i;
    const st = this.stride;
    while (i >= 0) {
      const base = i * st;
      let eq = true;
      for (let j = 0; j < st; j++) {
        if (this.states[base + j] !== S[j]) {
          eq = false;
          break;
        }
      }
      if (eq) return i;
      i = this.next[i] as number;
    }
    return -1;
  }
  add(key: number, S: Int32Array): number {
    if (this.n >= this.cost.length) this.grow();
    const i = this.n++;
    this.states.set(S, i * this.stride);
    const prev = this.table.get(key);
    this.next[i] = prev ?? -1;
    this.table.set(key, i);
    return i;
  }
}

// ───────────── Solver ─────────────

/**
 * Perline da tracciare: quelle nominate dalle condizioni; le lettere se ci sono
 * fili autonomi (decidono chi sta sopra); con il trabocco del pozzo tutti i
 * segreti (si contano) e, se Teresa legge, le lettere e i loro segreti di lettura
 * (nascono segreti che il pozzo può ricevere); con Gino la febbre (con la febbre
 * resta a letto, C01). Le altre perline non cambiano né la validità delle righe
 * né le condizioni.
 */
export function trackedBeads(level: LevelDef, ctx: RunContext, goals: readonly Condition[]): string[] {
  const ids = new Set(conditionBeads(level, goals));
  if (ctx.quirks.includes('ginoCorre')) for (const b of level.beads) if (b.type === 'febbre') ids.add(b.id);
  if (level.nero || level.autoweave) for (const b of level.beads) if (b.type === 'lettera') ids.add(b.id);
  if (ctx.quirks.includes('pieroTrabocca')) {
    const legge = ctx.quirks.includes('teresaLegge');
    for (const b of level.beads) {
      if (b.type === 'segreto') ids.add(b.id);
      else if (b.type === 'lettera' && legge) {
        ids.add(b.id);
        ids.add(`letta:${b.id}`);
      }
    }
  }
  return [...ids];
}

/**
 * Riapplica le righe già fissate (ripartenza da metà notte). Gli incroci
 * forzati si ricalcolano sempre, come fa `applyRow`: delle righe date contano
 * solo gli incroci del giocatore (in autotessitura, quello del filo controllato).
 */
function replayFrom(m: Model, p: Program, rowsDone: readonly RowMoves[], stride: number): { S: Int32Array; cost: number; quiete: number; moves: number[] } {
  const S = new Int32Array(stride);
  S.set(initialCompact(m));
  updateAtoms(p, m, S, m.startHour, null);
  const tmp = new Int32Array(stride);
  const info = newRowInfo();
  const row = newRow();
  let cost = 0;
  let quiete = 0;
  const moves: number[] = [];
  for (let i = 0; i < rowsDone.length; i++) {
    const h = m.startHour + 1 + i;
    const mine = (rowsDone[i] as RowMoves).crossings.filter((c) => !c.forced);
    if (m.hasAuto) {
      const ctrl = mine.find((c) => S[c.pair] === m.controlled || S[c.pair + 1] === m.controlled) ?? null;
      planAutoCore(m, S, h, ctrl ? ctrl.pair : -1, ctrl && ctrl.over === 'R' ? 1 : 0, row);
    } else {
      row.n = 0;
      if (m.agents.length > 0) planAutoCore(m, S, h, -1, 0, row);
      for (const c of mine) rowPush(row, c.pair, c.over === 'R' ? 1 : 0, 0);
    }
    let player = 0;
    for (let k = 0; k < row.n; k++) if (!row.forced[k]) player++;
    stepRow(m, S, tmp, row, h, info, null);
    updateAtoms(p, m, tmp, h, info);
    S.set(tmp);
    cost += player;
    if (player === 0) quiete++;
    moves.push(encodeRow(row));
  }
  return { S, cost, quiete, moves };
}

export function solveInternal(req: SolveRequest, opts: SolveInternalOptions = {}): SolveResult {
  const t0 = nowMs();
  const { level, ctx } = req;
  const goals = req.goals;
  const objective = req.objective ?? 'minIncroci';
  const matassa = req.matassa ?? level.matassa;
  const maxStates = req.maxStates ?? defaultMaxStates();
  const m = buildModel(level, ctx, { track: trackedBeads(level, ctx, goals), disable: opts.disable });
  const prog = compileProgram(m, goals, m.LEN);
  const withCost = objective === 'maxQuiete';
  const kp = makeKeyPlan(m, prog, withCost);
  const stride = kp.stride;
  const pp = pinPlan(m);
  const np = nonPlayerMask(m);
  const done = req.from?.rowsDone ?? [];
  const start = replayFrom(m, prog, done, stride);
  // Matassa già usata: quella dello stato di partenza (di solito la somma delle righe fatte;
  // nel rammendo d'Archivio il tombolo la riparte da zero all'inizio dello strappo).
  if (req.from) start.cost = Math.max(0, req.from.state.usedMatassa | 0);
  const startHour = m.startHour + done.length;
  const prefix = start.moves;

  let states = 1;
  const result = (status: SolveResult['status'], extra: Partial<SolveResult> = {}): SolveResult => ({ status, states, ms: Math.round((nowMs() - t0) * 10) / 10, ...extra });

  if (start.cost > matassa) return result('impossibile');
  if (!programCanOk(prog, m, start.S, startHour) || pinBound(m, pp, start.S, startHour) < 0) return result('impossibile');

  let cur = new Layer(stride, 1024);
  if (withCost) start.S[prog.end] = start.cost;
  const i0 = cur.add(keyOf(kp, start.S), start.S);
  cur.cost[i0] = start.cost;
  cur.quiete[i0] = start.quiete;
  cur.count[i0] = 1;
  cur.pred[i0] = -1;
  const preds: Int32Array[] = [];
  const movesL: Int32Array[] = [];
  const tmp = new Int32Array(stride);
  const info: RowInfo = newRowInfo();
  const gen = genPool();

  const gino = m.qGino >= 0 && !m.hasAuto;
  for (let h = startHour + 1; h <= m.endHour; h++) {
    const next = new Layer(stride, Math.max(1024, cur.n * 2));
    for (let i = 0; i < cur.n; i++) {
      const S = cur.view(i);
      const cost = cur.cost[i] as number;
      const left = matassa - cost;
      const blocked = blockedMask(m, S, h);
      generateRows(m, prog, S, h, blocked, np, left, gen);
      for (let r = 0; r < gen.n; r++) {
        const row = gen.rows[r] as RowSpec;
        let k = 0;
        for (let j = 0; j < row.n; j++) if (!row.forced[j]) k++;
        if (k > left) continue;
        // Gino (dipende solo dallo stato a inizio riga): prima di applicare la riga.
        if (gino && ginoFailed(m, S, row, blocked)) continue;
        stepRow(m, S, tmp, row, h, info, null);
        // Spilli d'ottone di quest'ora.
        if (!pinsOk(m, tmp, h)) continue;
        updateAtoms(prog, m, tmp, h, info);
        if (!programCanOk(prog, m, tmp, h)) continue;
        const lb = pinBound(m, pp, tmp, h);
        if (lb < 0) continue;
        const nc = cost + k;
        if (nc + lb > matassa) continue;
        if (withCost) tmp[prog.end] = nc;
        const nq = (cur.quiete[i] as number) + (k === 0 ? 1 : 0);
        const key = keyOf(kp, tmp);
        const j = next.find(key, tmp, kp.exact);
        const cnt = cur.count[i] as number;
        const code = encodeRow(row);
        if (j < 0) {
          const nj = next.add(key, tmp);
          next.cost[nj] = nc;
          next.quiete[nj] = nq;
          next.count[nj] = cnt;
          next.pred[nj] = i;
          next.move[nj] = code;
          states++;
          if (states > maxStates) return result('limite');
          continue;
        }
        const jc = next.cost[j] as number;
        const jq = next.quiete[j] as number;
        if (objective === 'minIncroci') {
          if (nc < jc) {
            next.cost[j] = nc;
            next.quiete[j] = nq;
            next.count[j] = cnt;
            next.pred[j] = i;
            next.move[j] = code;
          } else if (nc === jc) {
            next.count[j] = Math.min(COUNT_CAP + 1, (next.count[j] as number) + cnt);
            if (nq > jq) {
              next.quiete[j] = nq;
              next.pred[j] = i;
              next.move[j] = code;
            }
          }
        } else {
          if (nq > jq) {
            next.quiete[j] = nq;
            next.count[j] = cnt;
            next.pred[j] = i;
            next.move[j] = code;
          } else if (nq === jq) next.count[j] = Math.min(COUNT_CAP + 1, (next.count[j] as number) + cnt);
        }
      }
    }
    preds.push(next.pred.subarray(0, next.n));
    movesL.push(next.move.subarray(0, next.n));
    cur = next;
    if (cur.n === 0) return result('impossibile');
  }

  // Fine giornata: condizioni finali.
  let best = -1;
  let bestCost = Number.POSITIVE_INFINITY;
  let bestQ = -1;
  const fin = new Int32Array(stride);
  const okFinal = new Uint8Array(cur.n);
  for (let i = 0; i < cur.n; i++) {
    fin.set(cur.view(i));
    finalizeAtoms(prog, m, fin);
    if (!programOk(prog, fin)) continue;
    okFinal[i] = 1;
    const c = cur.cost[i] as number;
    const q = cur.quiete[i] as number;
    const better = objective === 'minIncroci' ? c < bestCost || (c === bestCost && q > bestQ) : q > bestQ || (q === bestQ && c < bestCost);
    if (better) {
      best = i;
      bestCost = c;
      bestQ = q;
    }
  }
  if (best < 0) return result('impossibile');
  let count = 0;
  if (req.countOptimal) {
    for (let i = 0; i < cur.n; i++) {
      if (!okFinal[i]) continue;
      const same = objective === 'minIncroci' ? cur.cost[i] === bestCost : cur.quiete[i] === bestQ;
      if (same) count += cur.count[i] as number;
    }
  }
  // Ricostruzione.
  const codes: number[] = [];
  let idx = best;
  for (let L = preds.length - 1; L >= 0; L--) {
    codes.push((movesL[L] as Int32Array)[idx] as number);
    idx = (preds[L] as Int32Array)[idx] as number;
  }
  codes.reverse();
  const rows: RowMoves[] = [];
  prefix.forEach((c, i) => rows.push(decodeRow(c, m.startHour + 1 + i)));
  codes.forEach((c, i) => rows.push(decodeRow(c, startHour + 1 + i)));
  const out: Partial<SolveResult> = { rows, incroci: bestCost, quiete: bestQ };
  if (req.countOptimal) out.optimalCount = Math.min(COUNT_CAP, count);
  return result('ok', out);
}

/** Solver sincrono (Node, worker). */
export function solve(req: SolveRequest): SolveResult {
  return solveInternal(req);
}

