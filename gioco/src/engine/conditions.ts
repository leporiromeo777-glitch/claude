/**
 * Condizioni sul merletto (GDD 3.12): richieste dei bigliettini, obiettivi
 * obbligatori, desideri del finale vero.
 *
 * Ogni condizione si compila in un programma: foglie ("atomi") con uno stato a
 * tre valori (in sospeso, soddisfatta, fallita) più qualche bit ausiliario,
 * e un albero di combinatori (tutti, almeno, non). Gli atomi si aggiornano ora
 * per ora con lo stesso codice nel solver (dove i loro valori fanno parte dello
 * stato) e nella valutazione per l'interfaccia (`evaluate`).
 *
 * Quando si decide ogni atomo (ore e righe, estremi inclusi):
 *   presso(chi, luogo, ora)          all'ora indicata
 *   maiPresso(chi, luogo, da, a)     fallisce alla prima ora dell'intervallo in cui c'è; ok passato `a`
 *   incontra / sopra                 ok al primo incrocio nelle righe da…a; fallisce passata `a`
 *   nonIncontra(a, b|'*', da, a)     fallisce al primo incrocio; ok passata `a` ('*' = un filo con nome)
 *   consegnata(lettera, entro)       ok appena consegnata entro l'ora; fallisce passata l'ora
 *   ha(chi, perlina, entro)          ok appena la tiene (anche all'apertura) entro l'ora
 *   nonHa(chi, perlina)              fallisce appena la tiene; ok a fine giornata
 *   parte(chi, ora)                  esce da un bordo proprio a quell'ora
 *   parte(chi)                       a fine giornata è uscito e non è rientrato
 *   resta(chi)                       fallisce alla prima uscita
 *   esceCon(perlina, ora)            a quell'ora esce da un bordo qualcuno che la tiene
 *   sano(chi)                        a fine giornata non ha la febbre
 *   incontriAlmeno(chi, n)           ok quando ha incrociato n fili diversi con nome
 *
 * Stati per l'interfaccia (`CondReport`): soddisfatta e fallita sono definitive;
 * a_rischio = non ancora decisa ma i limiti (distanze, ore rimaste) dicono che
 * non si può più soddisfare; altrimenti in_corso.
 */
import type { CondReport, Condition, LaceEvent, LaceState, LevelDef, RunContext } from '../core/types';
import type { Model } from './model';
import { B_FEBBRE as B_FEBBRE_, B_LETTERA as B_LETTERA_, fullModel, popcount as popcount_ } from './model';
import type { RowInfo } from './core';
import { colOf as colOf_, isDelivered as isDelivered_, newRowInfo } from './core';
import { toCompact } from './state';
import { conditionKey } from './keys';

// Copie locali dei binding importati: in Node (tsx) ogni lettura di un import passa da un
// getter, e queste funzioni girano milioni di volte nel solver. Così si leggono una volta sola.
const colOf = colOf_;
const isDelivered = isDelivered_;
const B_FEBBRE = B_FEBBRE_;
const B_LETTERA = B_LETTERA_;
const popcount = popcount_;

export const S_PENDING = 0;
export const S_OK = 1;
export const S_FAIL = 2;

export interface Atom {
  t: Condition['t'];
  /** Filo principale (chi / a), -1 se non esiste nel livello. */
  a: number;
  /** Secondo filo (b), -1 se non esiste, -2 = '*'. */
  b: number;
  /** Perlina, -1 se non esiste. */
  bead: number;
  /** Colonna del luogo, -1 se il luogo non è fra le colonne. */
  col: number;
  hour: number;
  from: number;
  to: number;
  n: number;
  /** Offset dello stato dell'atomo. */
  slot: number;
  /** Offset ausiliario (compagni incontrati, uscito), -1 se assente. */
  aux: number;
  cond: Condition;
}

export type CondNode =
  | { k: 'atom'; i: number }
  | { k: 'tutti'; of: CondNode[] }
  | { k: 'almeno'; n: number; of: CondNode[] }
  | { k: 'non'; c: CondNode };

export interface Program {
  atoms: Atom[];
  roots: CondNode[];
  /** Primo offset usato e offset successivo all'ultimo. */
  base: number;
  end: number;
  /** Atomi per tipo di aggiornamento (per non scorrere tutto a ogni riga). */
  rowAtoms: number[];
  /** C'è almeno un atomo `sopra`: il verso conta per quelle coppie. */
  sopraPairs: number[];
}

/** Perline che le condizioni nominano (da tracciare nel solver). */
export function conditionBeads(level: LevelDef, conds: readonly Condition[]): string[] {
  const out = new Set<string>();
  const walk = (c: Condition): void => {
    switch (c.t) {
      case 'consegnata':
      case 'ha':
      case 'nonHa':
      case 'esceCon':
        out.add(c.bead);
        break;
      case 'sano':
        for (const b of level.beads) if (b.type === 'febbre') out.add(b.id);
        out.add('febbre');
        break;
      case 'tutti':
      case 'almeno':
        for (const x of c.of) walk(x);
        break;
      case 'non':
        walk(c.c);
        break;
      default:
        break;
    }
  };
  for (const c of conds) walk(c);
  return [...out];
}

/** Compila le condizioni sul modello; gli stati degli atomi partono dall'offset `base`. */
export function compileProgram(m: Model, conds: readonly Condition[], base: number): Program {
  const atoms: Atom[] = [];
  let off = base;
  const th = (id: string | undefined): number => (id === undefined ? -1 : (m.idx.get(id) ?? -1));
  const bd = (id: string): number => m.beadIdx.get(id) ?? -1;
  const pl = (p: string): number => m.columns.indexOf(p as never);
  const first = m.startHour + 1;
  const last = m.endHour;
  const atom = (c: Condition, fields: Partial<Atom>, aux = false): CondNode => {
    const a: Atom = { t: c.t, a: -1, b: -1, bead: -1, col: -1, hour: 0, from: first, to: last, n: 0, slot: off++, aux: -1, cond: c, ...fields };
    if (aux) a.aux = off++;
    atoms.push(a);
    return { k: 'atom', i: atoms.length - 1 };
  };
  const build = (c: Condition): CondNode => {
    switch (c.t) {
      case 'presso':
        return atom(c, { a: th(c.who), col: pl(c.place), hour: c.hour });
      case 'maiPresso':
        return atom(c, { a: th(c.who), col: pl(c.place), from: c.from, to: c.to });
      case 'incontra':
        return atom(c, { a: th(c.a), b: th(c.b), from: c.from ?? first, to: c.to ?? last });
      case 'nonIncontra':
        return atom(c, { a: th(c.a), b: c.b === '*' ? -2 : th(c.b), from: c.from ?? first, to: c.to ?? last });
      case 'sopra':
        return atom(c, { a: th(c.a), b: th(c.b), to: c.to ?? last });
      case 'consegnata':
        return atom(c, { bead: bd(c.bead), hour: c.by ?? last });
      case 'ha':
        return atom(c, { a: th(c.who), bead: bd(c.bead), hour: c.by ?? last });
      case 'nonHa':
        return atom(c, { a: th(c.who), bead: bd(c.bead) });
      case 'parte':
        return atom(c, { a: th(c.who), hour: c.hour ?? -1 }, c.hour === undefined);
      case 'resta':
        return atom(c, { a: th(c.who) });
      case 'esceCon':
        return atom(c, { bead: bd(c.bead), hour: c.hour });
      case 'sano':
        return atom(c, { a: th(c.who) });
      case 'incontriAlmeno':
        return atom(c, { a: th(c.who), n: c.n }, true);
      case 'tutti':
        return { k: 'tutti', of: c.of.map(build) };
      case 'almeno':
        return { k: 'almeno', n: c.n, of: c.of.map(build) };
      case 'non':
        return { k: 'non', c: build(c.c) };
    }
  };
  const roots = conds.map(build);
  const sopraPairs: number[] = [];
  for (const a of atoms) if (a.t === 'sopra' && a.a >= 0 && a.b >= 0) sopraPairs.push(a.a, a.b);
  return { atoms, roots, base, end: off, rowAtoms: atoms.map((_, i) => i), sopraPairs };
}

function sickAny(m: Model, st: Int32Array, t: number): boolean {
  if (t < 0) return false;
  for (let bi = 0; bi < m.B; bi++) {
    if (m.beadType[bi] !== B_FEBBRE) continue;
    const s = m.slot[bi] as number;
    if (s >= 0 && ((st[s] as number) & (1 << t))) return true;
  }
  return false;
}

function holdsBead(m: Model, st: Int32Array, t: number, bi: number): boolean {
  if (t < 0 || bi < 0) return false;
  const s = m.slot[bi] as number;
  if (s < 0) return false;
  if (m.beadType[bi] === B_LETTERA) return st[s] === t;
  return ((st[s] as number) & (1 << t)) !== 0;
}

function met(info: RowInfo | null, a: number, b: number, needOver: boolean, namedMask: number): boolean {
  if (!info) return false;
  for (let k = 0; k < info.nMeet; k++) {
    const o = info.over[k] as number;
    const u = info.under[k] as number;
    if (b === -2) {
      if (o === a && (namedMask & (1 << u))) return true;
      if (u === a && (namedMask & (1 << o))) return true;
      continue;
    }
    if (o === a && u === b) return true;
    if (!needOver && o === b && u === a) return true;
  }
  return false;
}

function exited(info: RowInfo | null, t: number): boolean {
  if (!info || t < 0) return false;
  for (let k = 0; k < info.nExit; k++) if (info.exits[k] === t) return true;
  return false;
}

function entered(info: RowInfo | null, t: number): boolean {
  if (!info || t < 0) return false;
  for (let k = 0; k < info.nEnter; k++) if (info.enters[k] === t) return true;
  return false;
}

/**
 * Aggiorna gli atomi dopo una riga (o all'apertura, con `info` null). `S` è lo
 * stato esteso: le prime posizioni sono lo stato compatto, poi gli atomi.
 */
export function updateAtoms(p: Program, m: Model, S: Int32Array, hour: number, info: RowInfo | null): void {
  const atoms = p.atoms;
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i] as Atom;
    const status = S[a.slot] as number;
    if (status !== S_PENDING && a.t !== 'parte') continue;
    let next = status;
    switch (a.t) {
      case 'presso':
        if (hour >= a.hour) next = hour === a.hour && a.col >= 0 && a.a >= 0 && colOf(S, m.W, a.a) === a.col ? S_OK : S_FAIL;
        break;
      case 'maiPresso':
        if (hour >= a.from && hour <= a.to && a.a >= 0 && a.col >= 0 && colOf(S, m.W, a.a) === a.col) next = S_FAIL;
        else if (hour >= a.to) next = S_OK;
        break;
      case 'incontra':
      case 'sopra': {
        const from = a.t === 'sopra' ? m.startHour + 1 : a.from;
        if (info && hour >= from && hour <= a.to && a.a >= 0 && a.b >= 0 && met(info, a.a, a.b, a.t === 'sopra', m.namedMask)) next = S_OK;
        else if (hour >= a.to) next = S_FAIL;
        break;
      }
      case 'nonIncontra':
        if (info && hour >= a.from && hour <= a.to && a.a >= 0 && a.b !== -1 && met(info, a.a, a.b, false, m.namedMask)) next = S_FAIL;
        else if (hour >= a.to) next = S_OK;
        break;
      case 'consegnata':
        if (a.bead >= 0 && hour <= a.hour && isDelivered(m, S, a.bead)) next = S_OK;
        else if (hour >= a.hour) next = S_FAIL;
        break;
      case 'ha':
        if (hour <= a.hour && holdsBead(m, S, a.a, a.bead)) next = S_OK;
        else if (hour >= a.hour) next = S_FAIL;
        break;
      case 'nonHa':
        if (holdsBead(m, S, a.a, a.bead)) next = S_FAIL;
        break;
      case 'parte':
        if (a.hour >= 0) {
          if (status !== S_PENDING) break;
          if (hour === a.hour) next = exited(info, a.a) ? S_OK : S_FAIL;
          else if (hour > a.hour) next = S_FAIL;
        } else if (a.aux >= 0) {
          // Senza ora: si decide a fine giornata; intanto si ricorda se è fuori.
          if (exited(info, a.a)) S[a.aux] = 1;
          if (entered(info, a.a)) S[a.aux] = 0;
        }
        break;
      case 'resta':
        if (exited(info, a.a)) next = S_FAIL;
        break;
      case 'esceCon':
        if (hour === a.hour) {
          let ok = false;
          if (info && a.bead >= 0) for (let k = 0; k < info.nExit; k++) if (holdsBead(m, S, info.exits[k] as number, a.bead)) ok = true;
          next = ok ? S_OK : S_FAIL;
        } else if (hour > a.hour) next = S_FAIL;
        break;
      case 'sano':
        break;
      case 'incontriAlmeno': {
        if (a.aux < 0 || a.a < 0) break;
        let mask = S[a.aux] as number;
        if (info) {
          for (let k = 0; k < info.nMeet; k++) {
            const o = info.over[k] as number;
            const u = info.under[k] as number;
            if (o === a.a && (m.namedMask & (1 << u))) mask |= 1 << u;
            else if (u === a.a && (m.namedMask & (1 << o))) mask |= 1 << o;
          }
        }
        if (popcount(mask) >= a.n) {
          next = S_OK;
          mask = 0;
        }
        S[a.aux] = mask;
        break;
      }
      default:
        break;
    }
    if (next !== status) S[a.slot] = next;
  }
}

/** Esito finale di un atomo ancora in sospeso a fine giornata. */
function finalOf(a: Atom, m: Model, S: Int32Array): number {
  const s = S[a.slot] as number;
  if (s !== S_PENDING) return s;
  switch (a.t) {
    case 'maiPresso':
    case 'nonIncontra':
    case 'nonHa':
    case 'resta':
      return S_OK;
    case 'sano':
      return sickAny(m, S, a.a) ? S_FAIL : S_OK;
    case 'parte':
      if (a.hour >= 0) return S_FAIL;
      return a.aux >= 0 && S[a.aux] === 1 && a.a >= 0 && colOf(S, m.W, a.a) < 0 ? S_OK : S_FAIL;
    default:
      return S_FAIL;
  }
}

/** Fissa gli atomi in sospeso con il loro esito di fine giornata. */
export function finalizeAtoms(p: Program, m: Model, S: Int32Array): void {
  for (const a of p.atoms) S[a.slot] = finalOf(a, m, S);
}

function entersBy(m: Model, t: number, after: number, by: number): number[] {
  const out: number[] = [];
  for (const h of m.reentryHours.get(t) ?? []) if (h > after && h <= by) out.push(h);
  return out;
}

/** Il filo può essere sulla tela (ora o rientrando) entro l'ora `by`? Restituisce la colonna di partenza migliore o -1. */
function reachFrom(m: Model, S: Int32Array, t: number, cur: number, by: number, target: number): boolean {
  const c = colOf(S, m.W, t);
  if (c >= 0) return Math.abs(c - target) <= by - cur;
  for (const h of entersBy(m, t, cur, by)) {
    for (const s of m.edgesAt[h] ?? []) if (s.enters === t && Math.abs(s.col - target) <= by - h) return true;
  }
  return false;
}

/** Due fili possono incontrarsi entro l'ora `by`? (avvicinamento di 2 colonne per riga). */
function canMeet(m: Model, S: Int32Array, a: number, b: number, cur: number, by: number): boolean {
  if (by <= cur) return false;
  const ca = colOf(S, m.W, a);
  const cb = colOf(S, m.W, b);
  if (ca >= 0 && cb >= 0) return Math.floor(Math.abs(ca - cb) / 2) + 1 <= by - cur;
  // Uno dei due non è sulla tela: possibile solo se entra prima della fine della finestra.
  if (ca < 0 && entersBy(m, a, cur, by - 1).length === 0) return false;
  if (cb < 0 && entersBy(m, b, cur, by - 1).length === 0) return false;
  return true;
}

/**
 * Una perlina 'letta:<lettera>' può ancora nascere? (Teresa legge una lettera in
 * viaggio che tiene a fine riga, GDD 3.6.) Allora Teresa è una portatrice possibile.
 */
function lettaCanAppear(m: Model, S: Int32Array, bead: number): boolean {
  const letter = m.lettaLetter[bead] as number;
  if (letter < 0 || m.qLegge < 0 || m.inert[bead]) return false;
  if ((m.slot[letter] as number) < 0 || isDelivered(m, S, letter)) return false;
  return m.beadTo[letter] !== m.qLegge;
}

/** Un atomo in sospeso si può ancora soddisfare? (limite ottimistico: vero se non si sa). */
export function atomCanOk(a: Atom, m: Model, S: Int32Array, cur: number): boolean {
  const s = S[a.slot] as number;
  if (s === S_OK) return true;
  if (s === S_FAIL) return false;
  switch (a.t) {
    case 'presso':
      if (a.a < 0 || a.col < 0) return false;
      return reachFrom(m, S, a.a, cur, a.hour, a.col);
    case 'incontra':
    case 'sopra':
      if (a.a < 0 || a.b < 0) return false;
      return canMeet(m, S, a.a, a.b, cur, a.to);
    case 'consegnata': {
      if (a.bead < 0) return false;
      const to = m.beadTo[a.bead] as number;
      const h = S[m.slot[a.bead] as number] as number;
      if (to < 0 || h < 0) return false;
      if (h === m.pozzo && !m.trabocca && h !== to) return false;
      return canMeet(m, S, h, to, cur, a.hour);
    }
    case 'ha': {
      if (a.a < 0 || a.bead < 0) return false;
      const sl = m.slot[a.bead] as number;
      if (sl < 0) return false;
      if (m.beadType[a.bead] === B_LETTERA) {
        const h = S[sl] as number;
        if (h < 0) return false;
        if (h === m.pozzo && !m.trabocca) return false;
        if (isDelivered(m, S, a.bead)) return false;
        return canMeet(m, S, h, a.a, cur, a.hour);
      }
      const mask = S[sl] as number;
      for (let t = 0; t < m.T; t++) if ((mask & (1 << t)) && canMeet(m, S, t, a.a, cur, a.hour)) return true;
      // Il segreto di lettura nasce a fine riga in mano a Teresa.
      if (lettaCanAppear(m, S, a.bead) && a.hour > cur) return a.a === m.qLegge || canMeet(m, S, m.qLegge, a.a, cur, a.hour);
      return false;
    }
    case 'parte': {
      if (a.hour < 0) return true;
      if (a.a < 0) return false;
      for (const st of m.edgesAt[a.hour] ?? []) if (reachFrom(m, S, a.a, cur, a.hour, st.col)) return true;
      return false;
    }
    case 'esceCon': {
      if (a.bead < 0) return false;
      const sl = m.slot[a.bead] as number;
      if (sl < 0) return false;
      const steps = m.edgesAt[a.hour] ?? [];
      if (steps.length === 0) return false;
      if (m.beadType[a.bead] === B_LETTERA) {
        const h = S[sl] as number;
        if (h < 0) return false;
        for (const st of steps) if (reachFrom(m, S, h, cur, a.hour, st.col)) return true;
        return false;
      }
      const mask = S[sl] as number;
      for (let t = 0; t < m.T; t++) {
        if (!(mask & (1 << t))) continue;
        for (const st of steps) if (reachFrom(m, S, t, cur, a.hour, st.col)) return true;
      }
      // Il segreto di lettura può ancora nascere in mano a Teresa (e passare ad altri).
      if (lettaCanAppear(m, S, a.bead) && a.hour > cur) return true;
      return false;
    }
    case 'incontriAlmeno': {
      if (a.a < 0) return false;
      const have = a.aux >= 0 ? popcount(S[a.aux] as number) : 0;
      return a.n - have <= m.endHour - cur;
    }
    default:
      return true;
  }
}

export function nodeStatus(n: CondNode, p: Program, S: Int32Array): number {
  switch (n.k) {
    case 'atom':
      return S[(p.atoms[n.i] as Atom).slot] as number;
    case 'tutti': {
      let pending = false;
      for (const c of n.of) {
        const s = nodeStatus(c, p, S);
        if (s === S_FAIL) return S_FAIL;
        if (s === S_PENDING) pending = true;
      }
      return pending ? S_PENDING : S_OK;
    }
    case 'almeno': {
      let ok = 0;
      let notFail = 0;
      for (const c of n.of) {
        const s = nodeStatus(c, p, S);
        if (s === S_OK) ok++;
        if (s !== S_FAIL) notFail++;
      }
      if (ok >= n.n) return S_OK;
      if (notFail < n.n) return S_FAIL;
      return S_PENDING;
    }
    case 'non': {
      const s = nodeStatus(n.c, p, S);
      return s === S_OK ? S_FAIL : s === S_FAIL ? S_OK : S_PENDING;
    }
  }
}

export function nodeCanOk(n: CondNode, p: Program, m: Model, S: Int32Array, cur: number): boolean {
  switch (n.k) {
    case 'atom':
      return atomCanOk(p.atoms[n.i] as Atom, m, S, cur);
    case 'tutti':
      for (const c of n.of) if (!nodeCanOk(c, p, m, S, cur)) return false;
      return true;
    case 'almeno': {
      let k = 0;
      for (const c of n.of) if (nodeCanOk(c, p, m, S, cur)) k++;
      return k >= n.n;
    }
    case 'non':
      return nodeCanFail(n.c, p, m, S, cur);
  }
}

export function nodeCanFail(n: CondNode, p: Program, m: Model, S: Int32Array, cur: number): boolean {
  switch (n.k) {
    case 'atom':
      return (S[(p.atoms[n.i] as Atom).slot] as number) !== S_OK;
    case 'tutti':
      for (const c of n.of) if (nodeCanFail(c, p, m, S, cur)) return true;
      return false;
    case 'almeno': {
      let k = 0;
      for (const c of n.of) if (nodeCanFail(c, p, m, S, cur)) k++;
      return k > n.of.length - n.n;
    }
    case 'non':
      return nodeCanOk(n.c, p, m, S, cur);
  }
}

/** Tutte le radici possono ancora essere soddisfatte? (potatura del solver) */
export function programCanOk(p: Program, m: Model, S: Int32Array, cur: number): boolean {
  for (const r of p.roots) if (!nodeCanOk(r, p, m, S, cur)) return false;
  return true;
}

/** Tutte le radici soddisfatte (dopo finalizeAtoms). */
export function programOk(p: Program, S: Int32Array): boolean {
  for (const r of p.roots) if (nodeStatus(r, p, S) !== S_OK) return false;
  return true;
}

// ───────────── Valutazione per l'interfaccia ─────────────

/** Ricostruisce le informazioni di una riga dagli eventi (incroci, uscite, entrate). */
export function rowInfoFromEvents(m: Model, events: readonly LaceEvent[], info: RowInfo): RowInfo {
  info.nMeet = 0;
  info.nExit = 0;
  info.nEnter = 0;
  for (const e of events) {
    if (e.k === 'incontro') {
      const over = m.idx.get(e.over);
      const other = m.idx.get(e.over === e.a ? e.b : e.a);
      if (over === undefined || other === undefined || info.nMeet >= 8) continue;
      info.over[info.nMeet] = over;
      info.under[info.nMeet] = other;
      info.nMeet++;
    } else if (e.k === 'esce') {
      const t = m.idx.get(e.thread);
      if (t === undefined || info.nExit >= 8) continue;
      info.exits[info.nExit] = t;
      info.exitStep[info.nExit] = null;
      info.nExit++;
    } else if (e.k === 'entra') {
      const t = m.idx.get(e.thread);
      if (t === undefined || info.nEnter >= 8) continue;
      info.enters[info.nEnter++] = t;
    }
  }
  return info;
}

function firstBad(n: CondNode, p: Program, m: Model, S: Int32Array, cur: number, want: 'fail' | 'risk'): Atom | null {
  switch (n.k) {
    case 'atom': {
      const a = p.atoms[n.i] as Atom;
      const s = S[a.slot] as number;
      if (want === 'fail' ? s === S_FAIL : s === S_PENDING && !atomCanOk(a, m, S, cur)) return a;
      return null;
    }
    case 'tutti':
    case 'almeno':
      for (const c of n.of) {
        const r = firstBad(c, p, m, S, cur, want);
        if (r) return r;
      }
      return null;
    case 'non':
      return null;
  }
}

function reasonParams(a: Atom, m: Model): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const c = a.cond;
  if ('who' in c) out.chi = c.who;
  if ('a' in c) out.a = c.a;
  if ('b' in c) out.b = c.b;
  if ('bead' in c) out.perlina = c.bead;
  if ('place' in c) out.luogo = c.place;
  if (c.t === 'presso' || c.t === 'esceCon' || (c.t === 'parte' && c.hour !== undefined)) out.ora = c.hour as number;
  if (c.t === 'consegnata' || c.t === 'ha') out.ora = a.hour;
  if (c.t === 'incontriAlmeno') out.n = c.n;
  void m;
  return out;
}

/**
 * Valuta le condizioni sulla timeline (`timeline[0]` = apertura). `events[i]`
 * sono gli eventi della riga che porta a `timeline[i + 1]` (si accetta anche la
 * forma allineata, con `events.length === timeline.length` ed `events[0]` vuoto).
 * Con `final` la giornata si considera finita all'ultimo stato della timeline.
 */
export function evaluate(level: LevelDef, timeline: LaceState[], events: LaceEvent[][], conds: Condition[], ctx: RunContext, final: boolean): CondReport[] {
  if (timeline.length === 0) return conds.map(() => ({ status: 'in_corso' }));
  const m = fullModel(level, ctx);
  const p = compileProgram(m, conds, m.LEN);
  const S = new Int32Array(p.end);
  const info = newRowInfo();
  const aligned = events.length === timeline.length;
  for (let i = 0; i < timeline.length; i++) {
    const s = timeline[i] as LaceState;
    S.set(toCompact(m, s));
    if (i === 0) updateAtoms(p, m, S, s.hour, null);
    else {
      const ev = (aligned ? events[i] : events[i - 1]) ?? [];
      updateAtoms(p, m, S, s.hour, rowInfoFromEvents(m, ev, info));
    }
  }
  const last = timeline[timeline.length - 1] as LaceState;
  if (final) finalizeAtoms(p, m, S);
  return p.roots.map((r) => {
    const s = nodeStatus(r, p, S);
    if (s === S_OK) return { status: 'soddisfatta' };
    if (s === S_FAIL) {
      const a = firstBad(r, p, m, S, last.hour, 'fail');
      return a ? { status: 'fallita', reasonKey: conditionKey('fallita', a.t), params: reasonParams(a, m) } : { status: 'fallita' };
    }
    if (!nodeCanOk(r, p, m, S, last.hour)) {
      const a = firstBad(r, p, m, S, last.hour, 'risk');
      return a ? { status: 'a_rischio', reasonKey: conditionKey('rischio', a.t), params: reasonParams(a, m) } : { status: 'a_rischio' };
    }
    return { status: 'in_corso' };
  });
}
