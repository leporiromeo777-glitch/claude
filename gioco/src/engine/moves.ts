/**
 * Mosse di una riga per il solver e per il giocatore automatico (uso interno):
 * accoppiamenti disgiunti, versi da enumerare, incroci forzati, codifica
 * compatta e limiti inferiori dati dagli spilli d'ottone.
 */
import type { RowMoves } from '../core/types';
import type { Model } from './model';
import { B_FEBBRE, B_SEGRETO } from './model';
import type { RowSpec } from './core';
import { Q_OK, colOf, newRow, quirkCheck, rowPush } from './core';
import { planAutoCore } from './autoweave';
import type { Program } from './conditions';

// ───────────── Accoppiamenti ─────────────

const matchingsByW = new Map<number, number[]>();

/** Insiemi di coppie disgiunte (maschere di bit), dal più piccolo. Con 6 colonne sono 13. */
export function matchings(W: number): number[] {
  let list = matchingsByW.get(W);
  if (!list) {
    list = [];
    const P = W - 1;
    for (let mask = 0; mask < 1 << P; mask++) if ((mask & (mask << 1)) === 0) list.push(mask);
    list.sort((a, b) => popc(a) - popc(b) || a - b);
    matchingsByW.set(W, list);
  }
  return list;
}

export function popc(x: number): number {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
}

// ───────────── Codifica delle mosse ─────────────

export function encodeRow(r: RowSpec): number {
  let code = 0;
  for (let k = 0; k < r.n; k++) {
    const p = r.pair[k] as number;
    code |= 1 << p;
    if (r.overR[k]) code |= 1 << (8 + p);
    if (r.forced[k]) code |= 1 << (16 + p);
  }
  return code;
}

export function decodeRow(code: number, hour: number): RowMoves {
  const crossings: RowMoves['crossings'] = [];
  for (let p = 0; p < 8; p++) {
    if (!(code & (1 << p))) continue;
    const c: RowMoves['crossings'][number] = { pair: p, over: code & (1 << (8 + p)) ? 'R' : 'L' };
    if (code & (1 << (16 + p))) c.forced = true;
    crossings.push(c);
  }
  return { hour, crossings };
}

// ───────────── Generazione delle righe ─────────────

export interface Gen {
  rows: RowSpec[];
  n: number;
  tmp: RowSpec;
  pairs: Int8Array;
  opts: Int8Array;
}

export function genPool(): Gen {
  const rows: RowSpec[] = [];
  for (let i = 0; i < 64; i++) rows.push(newRow());
  return { rows, n: 0, tmp: newRow(), pairs: new Int8Array(8), opts: new Int8Array(8) };
}

function slotRow(g: Gen): RowSpec {
  if (g.n >= g.rows.length) g.rows.push(newRow());
  return g.rows[g.n++] as RowSpec;
}

function pushRow(g: Gen, r: RowSpec): void {
  const d = slotRow(g);
  d.n = r.n;
  d.pair.set(r.pair);
  d.overR.set(r.overR);
  d.forced.set(r.forced);
}

/** Dati della riga che decidono quando il verso conta. */
interface Relevance {
  /** Fili con perline trasferibili tracciate (lettere in viaggio, segreti). */
  holders: number;
  /** Fili malati (per la cura di Lunardi). */
  sick: number;
  secrets: boolean;
  anyTransferable: boolean;
  fever: boolean;
}

function relevance(m: Model, S: Int32Array): Relevance {
  let holders = 0;
  let sick = 0;
  let secrets = false;
  let fever = false;
  const deliv = S[m.OFF_DELIV] as number;
  for (const li of m.trackedLetters) {
    const h = S[m.slot[li] as number] as number;
    if (h >= 0 && !(deliv & (1 << (m.letterOrd[li] as number))) && !m.inert[li]) holders |= 1 << h;
  }
  for (const bi of m.trackedMulti) {
    if (m.inert[bi]) continue;
    const ty = m.beadType[bi];
    if (ty === B_SEGRETO) {
      secrets = true;
      holders |= S[m.slot[bi] as number] as number;
    } else if (ty === B_FEBBRE) {
      fever = true;
      sick |= S[m.slot[bi] as number] as number;
    }
  }
  if (m.pozzo >= 0 && S[m.OFF_PO] === 1) holders |= 1 << m.pozzo;
  return { holders, sick, secrets, fever, anyTransferable: m.trackedLetters.length > 0 || secrets };
}

/**
 * Il verso di un incrocio cambia qualcosa? (ARCHITETTURA 5.2) Sì se uno dei due
 * ha perline trasferibili tracciate, se c'è una stranezza di verso (Marta e
 * Teresa, il pozzo, Nina curiosa, Lunardi che cura) o una condizione `sopra`.
 */
export function versoMatters(m: Model, p: Program, rel: Relevance, L: number, R: number): boolean {
  if (rel.holders & ((1 << L) | (1 << R))) return true;
  if (m.qMarta >= 0 && ((L === m.qMarta && R === m.qTeresaSopra) || (R === m.qMarta && L === m.qTeresaSopra))) return true;
  if (m.pozzo >= 0 && (L === m.pozzo || R === m.pozzo) && rel.anyTransferable) return true;
  if (m.qNina >= 0 && (L === m.qNina || R === m.qNina) && rel.secrets) return true;
  const lu = m.qLunardi;
  if (lu >= 0 && rel.fever && (L === lu || R === lu) && (rel.sick & (1 << (L === lu ? R : L)))) return true;
  const sp = p.sopraPairs;
  for (let i = 0; i < sp.length; i += 2) {
    const a = sp[i] as number;
    const b = sp[i + 1] as number;
    if ((a === L && b === R) || (a === R && b === L)) return true;
  }
  return false;
}

/**
 * Tutte le righe candidate dallo stato S per l'ora h: incroci forzati più ogni
 * accoppiamento delle coppie libere, con i versi che contano (gli altri col
 * verso sinistro o con l'unico ammesso dalle stranezze). Spilli e Gino si
 * controllano dopo aver applicato la riga.
 */
export function generateRows(m: Model, p: Program, S: Int32Array, h: number, blocked: number, np: number, left: number, g: Gen): void {
  g.n = 0;
  const W = m.W;
  const rel = relevance(m, S);
  const tmp = g.tmp;

  if (m.hasAuto) {
    planAutoCore(m, S, h, -1, 0, tmp);
    pushRow(g, tmp);
    if (m.controlled < 0 || left <= 0) return;
    // Filo controllato: fermo (sopra), a sinistra o a destra.
    const c = colOf(S, W, m.controlled);
    if (c < 0 || (blocked & (1 << m.controlled))) return;
    for (const pr of [c - 1, c]) {
      if (pr < 0 || pr > W - 2) continue;
      const L = S[pr] as number;
      const R = S[pr + 1] as number;
      if (blocked & ((1 << L) | (1 << R))) continue;
      const both = versoMatters(m, p, rel, L, R);
      for (let o = 0; o < 2; o++) {
        if (quirkCheck(m, S, pr, o) !== Q_OK) continue;
        planAutoCore(m, S, h, pr, o, tmp);
        pushRow(g, tmp);
        if (!both) break;
      }
    }
    return;
  }

  const forced = tmp;
  forced.n = 0;
  if (m.agents.length > 0) planAutoCore(m, S, h, -1, 0, forced);
  let usedCols = 0;
  for (let k = 0; k < forced.n; k++) usedCols |= (1 << (forced.pair[k] as number)) | (1 << ((forced.pair[k] as number) + 1));
  let avail = 0;
  for (let pr = 0; pr < W - 1; pr++) {
    const L = S[pr] as number;
    const R = S[pr + 1] as number;
    if (usedCols & ((1 << pr) | (1 << (pr + 1)))) continue;
    if ((blocked | np) & ((1 << L) | (1 << R))) continue;
    if (quirkCheck(m, S, pr, 0) !== Q_OK && quirkCheck(m, S, pr, 1) !== Q_OK) continue;
    avail |= 1 << pr;
  }
  const list = matchings(W);
  const pairs = g.pairs;
  const opts = g.opts; // 1 = solo L, 2 = solo R, 3 = entrambi
  for (const mask of list) {
    if ((mask & avail) !== mask) continue;
    if (popc(mask) > left) continue;
    let n = 0;
    for (let pr = 0; pr < W - 1; pr++) {
      if (!(mask & (1 << pr))) continue;
      const okL = quirkCheck(m, S, pr, 0) === Q_OK;
      const okR = quirkCheck(m, S, pr, 1) === Q_OK;
      pairs[n] = pr;
      if (okL && okR) opts[n] = versoMatters(m, p, rel, S[pr] as number, S[pr + 1] as number) ? 3 : 1;
      else opts[n] = okL ? 1 : 2;
      n++;
    }
    let combos = 1;
    for (let i = 0; i < n; i++) if (opts[i] === 3) combos *= 2;
    for (let cmb = 0; cmb < combos; cmb++) {
      const r = slotRow(g);
      r.n = 0;
      for (let k = 0; k < forced.n; k++) rowPush(r, forced.pair[k] as number, forced.overR[k] as number, 1);
      let bitIdx = 0;
      for (let i = 0; i < n; i++) {
        let o: number;
        if (opts[i] === 3) {
          o = (cmb >> bitIdx) & 1;
          bitIdx++;
        } else o = opts[i] === 2 ? 1 : 0;
        rowPush(r, pairs[i] as number, o, 0);
      }
    }
  }
}

// ───────────── Limiti inferiori dagli spilli ─────────────

export interface PinPlan {
  /** Per filo: spilli ordinati per ora. */
  byThread: Map<number, { col: number; hour: number }[]>;
  useLB: boolean;
}

export function pinPlan(m: Model): PinPlan {
  const byThread = new Map<number, { col: number; hour: number }[]>();
  for (const p of m.pins) {
    const l = byThread.get(p.thread) ?? [];
    l.push({ col: p.col, hour: p.hour });
    byThread.set(p.thread, l);
  }
  for (const l of byThread.values()) l.sort((a, b) => a.hour - b.hour);
  // Con incroci forzati (gratuiti) gli spostamenti non costano tutti matassa.
  return { byThread, useLB: m.agents.length === 0 };
}

/** Il filo fuori dalla tela può rientrare da un bordo in tempo per lo spillo? */
function canReenter(m: Model, t: number, h: number, col: number, hour: number): boolean {
  for (const eh of m.reentryHours.get(t) ?? []) {
    if (eh <= h || eh > hour) continue;
    for (const s of m.edgesAt[eh] ?? []) if (s.enters === t && Math.abs(s.col - col) <= hour - eh) return true;
  }
  return false;
}

/**
 * -1 se uno spillo futuro è irraggiungibile, altrimenti il limite inferiore di
 * incroci (ogni incrocio sposta due fili di una colonna). I fili che possono
 * rientrare per nome da un bordo contano solo per la raggiungibilità del primo spillo.
 */
export function pinBound(m: Model, pp: PinPlan, S: Int32Array, h: number): number {
  let total = 0;
  for (const [t, list] of pp.byThread) {
    let c = colOf(S, m.W, t);
    let at = h;
    const teleports = m.reentryHours.has(t);
    for (const pin of list) {
      if (pin.hour <= h) continue;
      if (pin.col < 0) return -1;
      if (c < 0) {
        if (!canReenter(m, t, h, pin.col, pin.hour)) return -1;
        break;
      }
      const d = Math.abs(c - pin.col);
      if (d > pin.hour - at) {
        if (!teleports || !canReenter(m, t, h, pin.col, pin.hour)) return -1;
        break;
      }
      if (teleports) break;
      total += d;
      c = pin.col;
      at = pin.hour;
    }
  }
  return pp.useLB ? Math.ceil(total / 2) : 0;
}

/** Spilli d'ottone dell'ora rispettati dopo la riga? */
export function pinsOk(m: Model, S: Int32Array, h: number): boolean {
  const pins = m.pinsAt[h];
  if (!pins) return true;
  for (const pin of pins) if (pin.col < 0 || colOf(S, m.W, pin.thread) !== pin.col) return false;
  return true;
}
