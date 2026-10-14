/**
 * Autotessitura (GDD 3.10): `planAutoRow`, usato per i finali "Il filo di
 * seppia" e "Il merletto aperto", per l'Archivio A6 e per il filo nero.
 *
 * Algoritmo deterministico, per la riga dell'ora h (stato all'ora h-1):
 * 1. Bersaglio di ogni filo autonomo: il primo elemento della sua agenda non
 *    ancora soddisfatto. Un'occasione (spillo verde) con un gusto del filo,
 *    raggiungibile e non ancora passata, vale come bersaglio {luogo, ora}: vince
 *    sull'agenda se è più vicina nel tempo (sempre su `follow` e `stay`).
 * 2. dir = segno(colonna bersaglio − colonna), margine = (ora bersaglio − (h−1)) − |distanza|.
 *    `follow` usa come ora la chiusura della giornata; `stay` vale dir 0 e margine 0
 *    (non cede); senza bersaglio dir 0 e margine infinito.
 * 3. Coppie candidate: i due fili vanno uno verso l'altro, oppure uno vuole
 *    muoversi e l'altro cede (lino, fili non autonomi, dir 0 con margine ≥ 2).
 *    Il filo nero non aspetta il consenso: incrocia il vicino salvo che sia bloccato.
 * 4. Ordine per margine minimo crescente (il filo nero per primo), a parità per
 *    colonna da sinistra; si prendono avidamente le coppie disgiunte.
 * 5. Verso: sopra chi ha qualcosa da dare all'altro (lettera per lui, o `givesTo`);
 *    altrimenti il più urgente; a parità il filo di sinistra. Il filo nero sta sempre sopra.
 *    Un verso vietato da una stranezza si rovescia; se nessun verso è ammesso la coppia si scarta.
 * 6. Il filo controllato dal giocatore (fin_seppia) muove per primo: le coppie che lo toccano sono escluse.
 */
import type { Crossing, LaceState, LevelDef, RunContext } from '../core/types';
import type { AgentModel, Model } from './model';
import { INF, K_LINO, fullModel } from './model';
import type { RowSpec } from './core';
import { Q_OK, blockedMask, isDelivered, newRow, quirkCheck, rowPush } from './core';
import { toCompact } from './state';

interface Scratch {
  colOf: Int8Array;
  dir: Int8Array;
  slack: Int32Array;
  cede: Uint8Array;
  nero: Uint8Array;
  candP: Int8Array;
  candO: Uint8Array;
  candU: Float64Array;
  order: number[];
}

let shared: Scratch | null = null;
function scratch(): Scratch {
  if (!shared) {
    shared = {
      colOf: new Int8Array(32),
      dir: new Int8Array(8),
      slack: new Int32Array(8),
      cede: new Uint8Array(8),
      nero: new Uint8Array(8),
      candP: new Int8Array(8),
      candO: new Uint8Array(8),
      candU: new Float64Array(8),
      order: [],
    };
  }
  return shared;
}

/** Bersaglio di un filo autonomo per la riga `h`: imposta dir e margine nella colonna `c`. */
function agentWish(m: Model, ag: AgentModel, st: Int32Array, colOf: Int8Array, h: number, c: number, sc: Scratch): void {
  let p = st[ag.slot] as number;
  while (p < ag.agenda.length) {
    const it = ag.agenda[p];
    if (it && it.k === 'place' && it.hour < h) p++;
    else break;
  }
  let has = false;
  let stay = false;
  let follow = false;
  let tcol = -1;
  let thour = INF;
  const it = ag.agenda[p];
  if (it) {
    if (it.k === 'follow') {
      const fc = colOf[it.t] as number;
      if (fc >= 0) {
        has = true;
        follow = true;
        tcol = fc;
        thour = m.endHour;
      }
    } else if (it.k === 'place') {
      if (it.col >= 0) {
        has = true;
        tcol = it.col;
        thour = it.hour;
      }
    } else stay = true;
  }
  if (ag.likes.length > 0) {
    for (const o of m.occasions) {
      if (o.hour < h || !ag.likes.includes(o.kind)) continue;
      const sl = o.hour - (h - 1) - Math.abs(o.col - c);
      if (sl < 0) continue;
      if (has && !follow && thour <= o.hour) break; // l'appuntamento dell'agenda viene prima
      has = true;
      stay = false;
      follow = false;
      tcol = o.col;
      thour = o.hour;
      break;
    }
  }
  if (has) {
    sc.dir[c] = tcol > c ? 1 : tcol < c ? -1 : 0;
    sc.slack[c] = thour - (h - 1) - Math.abs(tcol - c);
  } else if (stay) {
    sc.dir[c] = 0;
    sc.slack[c] = 0;
  } else {
    sc.dir[c] = 0;
    sc.slack[c] = INF;
  }
}

/** X ha qualcosa da dare a Y: una lettera in viaggio per Y, o Y fra i suoi `givesTo`. */
function givesTo(m: Model, st: Int32Array, X: number, Y: number): boolean {
  const a = m.agentOf[X] as number;
  if (a >= 0 && ((m.agents[a] as AgentModel).givesTo & (1 << Y)) !== 0) return true;
  for (const li of m.trackedLetters) {
    if (st[m.slot[li] as number] === X && m.beadTo[li] === Y && !isDelivered(m, st, li)) return true;
  }
  return false;
}

/**
 * Pianifica la riga dell'ora `hour` sullo stato compatto. `controlled` è la
 * mossa del filo controllato (o null: resta fermo). Gli incroci automatici
 * escono con `forced = 1`, quello controllato con `forced = 0`.
 */
export function planAutoCore(m: Model, st: Int32Array, hour: number, controlledPair: number, controlledOverR: number, out: RowSpec): void {
  out.n = 0;
  const W = m.W;
  const sc = scratch();
  const colOf = sc.colOf;
  colOf.fill(-1);
  for (let c = 0; c < W; c++) colOf[st[c] as number] = c;
  const blocked = blockedMask(m, st, hour);
  let excluded = 0;
  if (controlledPair >= 0) {
    rowPush(out, controlledPair, controlledOverR, 0);
    excluded |= (1 << (st[controlledPair] as number)) | (1 << (st[controlledPair + 1] as number));
  }
  if (m.controlled >= 0) excluded |= 1 << m.controlled;
  if (m.agents.length === 0) return;

  for (let c = 0; c < W; c++) {
    const t = st[c] as number;
    const a = m.agentOf[t] as number;
    sc.nero[c] = 0;
    if (a < 0) {
      sc.dir[c] = 0;
      sc.slack[c] = INF;
      sc.cede[c] = 1;
      continue;
    }
    const ag = m.agents[a] as AgentModel;
    agentWish(m, ag, st, colOf, hour, c, sc);
    sc.nero[c] = ag.nero ? 1 : 0;
    sc.cede[c] = !ag.nero && (m.kind[t] === K_LINO || (sc.dir[c] === 0 && (sc.slack[c] as number) >= 2)) ? 1 : 0;
  }

  let nc = 0;
  for (let p = 0; p < W - 1; p++) {
    const L = st[p] as number;
    const R = st[p + 1] as number;
    if ((blocked | excluded) & ((1 << L) | (1 << R))) continue;
    const moveL = sc.dir[p] === 1;
    const moveR = sc.dir[p + 1] === -1;
    const neroL = moveL && sc.nero[p] === 1;
    const neroR = moveR && sc.nero[p + 1] === 1;
    const ok = (moveL && moveR) || (moveL && (sc.cede[p + 1] === 1 || neroL)) || (moveR && (sc.cede[p] === 1 || neroR));
    if (!ok) continue;
    let overR: number;
    const nL = sc.nero[p] === 1;
    const nR = sc.nero[p + 1] === 1;
    if (nL && !nR) overR = 0;
    else if (nR && !nL) overR = 1;
    else {
      const gL = givesTo(m, st, L, R);
      const gR = givesTo(m, st, R, L);
      if (gL && !gR) overR = 0;
      else if (gR && !gL) overR = 1;
      else overR = (sc.slack[p + 1] as number) < (sc.slack[p] as number) ? 1 : 0;
    }
    if (quirkCheck(m, st, p, overR) !== Q_OK) {
      if (nL || nR) continue;
      if (quirkCheck(m, st, p, overR ^ 1) !== Q_OK) continue;
      overR ^= 1;
    }
    sc.candP[nc] = p;
    sc.candO[nc] = overR;
    sc.candU[nc] = neroL || neroR ? -INF : Math.min(moveL ? (sc.slack[p] as number) : INF, moveR ? (sc.slack[p + 1] as number) : INF);
    nc++;
  }
  const order = sc.order;
  order.length = 0;
  for (let i = 0; i < nc; i++) order.push(i);
  order.sort((a, b) => (sc.candU[a] as number) - (sc.candU[b] as number) || (sc.candP[a] as number) - (sc.candP[b] as number));
  let used = 0;
  if (controlledPair >= 0) used |= (1 << controlledPair) | (1 << (controlledPair + 1));
  for (const i of order) {
    const p = sc.candP[i] as number;
    const cols = (1 << p) | (1 << (p + 1));
    if (used & cols) continue;
    used |= cols;
    rowPush(out, p, sc.candO[i] as number, 1);
  }
  // Ordine canonico per coppia (il controllato resta un incrocio come gli altri).
  sortRow(out);
}

function sortRow(r: RowSpec): void {
  for (let i = 1; i < r.n; i++) {
    for (let j = i; j > 0 && (r.pair[j - 1] as number) > (r.pair[j] as number); j--) {
      const p = r.pair[j] as number;
      const o = r.overR[j] as number;
      const f = r.forced[j] as number;
      r.pair[j] = r.pair[j - 1] as number;
      r.overR[j] = r.overR[j - 1] as number;
      r.forced[j] = r.forced[j - 1] as number;
      r.pair[j - 1] = p;
      r.overR[j - 1] = o;
      r.forced[j - 1] = f;
    }
  }
}

export function rowToCrossings(r: RowSpec): Crossing[] {
  const out: Crossing[] = [];
  for (let k = 0; k < r.n; k++) {
    const c: Crossing = { pair: r.pair[k] as number, over: r.overR[k] ? 'R' : 'L' };
    if (r.forced[k]) c.forced = true;
    out.push(c);
  }
  return out;
}

/**
 * Riga automatica per l'ora `state.hour + 1` (GDD 3.10). Con un filo controllato,
 * `controlled` è la sua mossa (null = resta fermo) e compare nel risultato senza
 * `forced`; tutti gli altri incroci hanno `forced: true`. Vuoto dopo l'ultima ora.
 */
export function planAutoRow(level: LevelDef, state: LaceState, ctx: RunContext, controlled?: Crossing | null): Crossing[] {
  const m = fullModel(level, ctx);
  const hour = state.hour + 1;
  if (hour > m.endHour) return [];
  const st = toCompact(m, state);
  const out = newRow();
  const c = controlled ?? null;
  planAutoCore(m, st, hour, c ? c.pair : -1, c && c.over === 'R' ? 1 : 0, out);
  return rowToCrossings(out);
}
