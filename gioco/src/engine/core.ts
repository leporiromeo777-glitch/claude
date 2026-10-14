/**
 * Nucleo delle regole sullo stato compatto (uso interno).
 *
 * Una sola implementazione delle regole di GDD 3.4-3.11, condivisa dalle API
 * pubbliche (`rules.ts`, con tutte le perline tracciate e gli eventi) e dal
 * solver (con le sole perline rilevanti e senza eventi). Ordine normativo di
 * una riga (GDD 3.4): blocchi → incroci forzati → validità → passaggi (tutti
 * calcolati dallo stato all'inizio della riga) → scambio → bordi → fine riga
 * (Teresa legge, trabocco del pozzo; spilli e Gino li controlla chi chiama) →
 * annuncio del filo nero.
 */
import type { EdgeStep, Model } from './model';
import { B_FEBBRE as B_FEBBRE_, B_LETTERA as B_LETTERA_, B_NOME as B_NOME_, B_SEGRETO as B_SEGRETO_, B_VOCE as B_VOCE_, K_LINO as K_LINO_, ZENO_MAX as ZENO_MAX_ } from './model';
import type { LaceEvent } from '../core/types';

// Copie locali dei binding importati: in Node (tsx) ogni lettura di un import passa da un
// getter, e queste funzioni girano milioni di volte nel solver. Così si leggono una volta sola.
const B_FEBBRE = B_FEBBRE_;
const B_LETTERA = B_LETTERA_;
const B_NOME = B_NOME_;
const B_SEGRETO = B_SEGRETO_;
const B_VOCE = B_VOCE_;
const K_LINO = K_LINO_;
const ZENO_MAX = ZENO_MAX_;

/** Riga di incroci in forma compatta (array riusabili, al massimo 8 incroci). */
export interface RowSpec {
  n: number;
  pair: Int8Array;
  /** 1 = sta sopra il filo di destra ('R'). */
  overR: Uint8Array;
  forced: Uint8Array;
}

export function newRow(): RowSpec {
  return { n: 0, pair: new Int8Array(8), overR: new Uint8Array(8), forced: new Uint8Array(8) };
}

export function rowPush(r: RowSpec, pair: number, overR: number, forced: number): void {
  r.pair[r.n] = pair;
  r.overR[r.n] = overR;
  r.forced[r.n] = forced;
  r.n++;
}

export function rowCopy(from: RowSpec, to: RowSpec): void {
  to.n = from.n;
  to.pair.set(from.pair);
  to.overR.set(from.overR);
  to.forced.set(from.forced);
}

/** Quello che è successo in una riga, per le condizioni e per lo stato pubblico. */
export interface RowInfo {
  nMeet: number;
  over: Int32Array;
  under: Int32Array;
  nExit: number;
  exits: Int32Array;
  exitStep: (EdgeStep | null)[];
  nEnter: number;
  enters: Int32Array;
}

export function newRowInfo(): RowInfo {
  return {
    nMeet: 0,
    over: new Int32Array(8),
    under: new Int32Array(8),
    nExit: 0,
    exits: new Int32Array(8),
    exitStep: new Array<EdgeStep | null>(8).fill(null),
    nEnter: 0,
    enters: new Int32Array(8),
  };
}

export type Sink = ((e: LaceEvent) => void) | null;

export const Q_OK = 0;
export const Q_RIFIUTO = 1;
export const Q_FARO = 2;

/** Colonna di un filo, -1 se non è sulla tela. */
export function colOf(st: Int32Array, W: number, t: number): number {
  for (let c = 0; c < W; c++) if (st[c] === t) return c;
  return -1;
}

/** Fili bloccati nella riga dell'ora `hour`: annodati dalla riga prima o in una colonna allagata. */
export function blockedMask(m: Model, st: Int32Array, hour: number): number {
  let mask = st[m.OFF_KNOT] as number;
  const tide = hour >= 0 && hour <= 24 ? (m.tideAt[hour] as number) : 0;
  if (tide !== 0) for (let c = 0; c < m.W; c++) if (tide & (1 << c)) mask |= 1 << (st[c] as number);
  return mask;
}

/** Stranezze di verso e di posizione (GDD 3.6): Marta non sta sotto Teresa, Zeno resta vicino al Faro. */
export function quirkCheck(m: Model, st: Int32Array, p: number, overR: number): number {
  const L = st[p] as number;
  const R = st[p + 1] as number;
  if (m.qMarta >= 0) {
    const A = overR ? R : L;
    const B = overR ? L : R;
    if (A === m.qTeresaSopra && B === m.qMarta) return Q_RIFIUTO;
  }
  if (m.qZeno >= 0 && (L === m.qZeno || R === m.qZeno)) {
    const oldC = L === m.qZeno ? p : p + 1;
    const newC = L === m.qZeno ? p + 1 : p;
    const oldD = Math.abs(oldC - m.faroCol);
    const newD = Math.abs(newC - m.faroCol);
    if (newD > ZENO_MAX && newD > oldD) return Q_FARO;
  }
  return Q_OK;
}

/** Fili che il giocatore non può muovere: il filo nero e gli autonomi; in autotessitura tutti tranne il controllato. */
export function nonPlayerMask(m: Model): number {
  let mask = 0;
  if (m.hasAuto) {
    for (let t = 0; t < m.T; t++) if (t !== m.controlled) mask |= 1 << t;
    return mask;
  }
  for (const a of m.agents) mask |= 1 << a.thread;
  return mask;
}

/**
 * Gino non sta fermo (GDD 3.6): vero se Gino aveva almeno un incrocio possibile
 * (non è bloccato e almeno un vicino è libero: non bloccato, non in un incrocio
 * forzato, e con almeno un verso ammesso dalle stranezze) e la riga non lo fa
 * incrociare. La matassa non conta: a matassa finita la riga di Gino non si
 * fissa e si disfa (GDD 3.7), così più matassa non obbliga mai a più incroci.
 */
export function ginoFailed(m: Model, st: Int32Array, row: RowSpec, blocked: number): boolean {
  const g = m.qGino;
  if (g < 0 || m.hasAuto) return false;
  const c = colOf(st, m.W, g);
  if (c < 0) return false;
  let forcedMask = 0;
  for (let k = 0; k < row.n; k++) {
    const p = row.pair[k] as number;
    if (p === c || p === c - 1) return false; // Gino incrocia (anche un incrocio forzato vale)
    if (row.forced[k]) forcedMask |= (1 << (st[p] as number)) | (1 << (st[p + 1] as number));
  }
  if (blocked & (1 << g)) return false;
  const np = nonPlayerMask(m);
  for (let p = c - 1; p <= c; p++) {
    if (p < 0 || p > m.W - 2) continue;
    const other = st[p === c ? c + 1 : c - 1] as number;
    if ((blocked | forcedMask | np) & (1 << other)) continue;
    if (quirkCheck(m, st, p, 0) === Q_OK || quirkCheck(m, st, p, 1) === Q_OK) return true;
  }
  return false;
}

/** Passaggi di un incrocio (GDD 3.5): A sopra, B sotto. Legge da `st` (inizio riga), scrive in `out`. */
function transfer(m: Model, st: Int32Array, out: Int32Array, A: number, B: number, sink: Sink): void {
  const pz = m.pozzo;
  const poOver = (st[m.OFF_PO] as number) !== 0;
  const aIsPozzo = A === pz;
  const bIsPozzo = B === pz;
  const aGives = !aIsPozzo || poOver; // da sopra dà, salvo il pozzo che non trabocca
  const bGives = !bIsPozzo; // da sotto il pozzo non dà mai
  const bLino = m.kind[B] === K_LINO;
  const bitA = 1 << A;
  const bitB = 1 << B;
  let pozzoHeld = false;
  let ninaSeen = false;
  let lunardiSeen = false;
  const ids = m.ids;

  const letters = m.trackedLetters;
  for (let i = 0; i < letters.length; i++) {
    const li = letters[i] as number;
    const s = m.slot[li] as number;
    if (st[s] !== A || m.inert[li]) continue;
    const ob = 1 << (m.letterOrd[li] as number);
    if ((st[m.OFF_DELIV] as number) & ob) continue; // consegnata: resta per sempre al destinatario
    if (bLino) continue; // il lino non prende lettere
    if (!aGives) {
      pozzoHeld = true;
      continue;
    }
    out[s] = B;
    if (sink) sink({ k: 'passa', bead: m.beadIds[li] as string, from: ids[A] as string, to: ids[B] as string });
    if (m.beadTo[li] === B) {
      out[m.OFF_DELIV] = (out[m.OFF_DELIV] as number) | ob;
      if (sink) sink({ k: 'consegna', bead: m.beadIds[li] as string, to: ids[B] as string });
    }
  }

  const multi = m.trackedMulti;
  for (let i = 0; i < multi.length; i++) {
    const bi = multi[i] as number;
    if (m.inert[bi]) continue;
    const s = m.slot[bi] as number;
    const mask = st[s] as number;
    const hasA = (mask & bitA) !== 0;
    const hasB = (mask & bitB) !== 0;
    const ty = m.beadType[bi];
    if (ty === B_VOCE || ty === B_NOME) {
      // Voce e nome: in tutti e due i versi (il pozzo non dà).
      if (hasA && !hasB) {
        if (aGives) {
          out[s] = (out[s] as number) | bitB;
          if (sink) sink({ k: 'copia', bead: m.beadIds[bi] as string, from: ids[A] as string, to: ids[B] as string });
        } else pozzoHeld = true;
      } else if (hasB && !hasA) {
        if (bGives) {
          out[s] = (out[s] as number) | bitA;
          if (sink) sink({ k: 'copia', bead: m.beadIds[bi] as string, from: ids[B] as string, to: ids[A] as string });
        } else pozzoHeld = true;
      }
    } else if (ty === B_SEGRETO) {
      // Il segreto scende soltanto; il lino non lo prende; Nina curiosa lo prende anche da sotto.
      if (hasA && !hasB) {
        if (!aGives) pozzoHeld = true;
        else if (!bLino) {
          out[s] = (out[s] as number) | bitB;
          if (bIsPozzo && m.trabocca) out[m.OFF_PN] = (out[m.OFF_PN] as number) + 1;
          if (sink) sink({ k: 'copia', bead: m.beadIds[bi] as string, from: ids[A] as string, to: ids[B] as string });
        }
      } else if (hasB && !hasA && A === m.qNina && !bIsPozzo) {
        out[s] = (out[s] as number) | bitA;
        ninaSeen = true;
        if (sink) sink({ k: 'copia', bead: m.beadIds[bi] as string, from: ids[B] as string, to: ids[A] as string });
      }
    } else if (ty === B_FEBBRE) {
      const lu = m.qLunardi;
      if (lu >= 0 && (A === lu || B === lu)) {
        // Lunardi non si ammala mai; da sopra cura (la cura vince sul contagio).
        if (A === lu && hasB) {
          out[s] = (out[s] as number) & ~bitB;
          lunardiSeen = true;
          if (sink) sink({ k: 'cura', who: ids[B] as string, by: ids[A] as string });
        } else if (B === lu && hasA) lunardiSeen = true;
        out[s] = (out[s] as number) & ~(1 << lu);
      } else if (hasA !== hasB) {
        out[s] = (out[s] as number) | bitA | bitB;
        if (sink) sink({ k: 'contagio', from: ids[hasA ? A : B] as string, to: ids[hasA ? B : A] as string });
      }
    }
  }
  if (aIsPozzo && poOver) {
    // Il pozzo ha dato tutto: il conteggio dei segreti torna a zero.
    out[m.OFF_PO] = 0;
    out[m.OFF_PN] = 0;
  }
  if (sink) {
    if (pozzoHeld) sink({ k: 'stranezza', quirk: 'pieroPozzo', thread: ids[pz] as string });
    if (ninaSeen) sink({ k: 'stranezza', quirk: 'ninaCuriosa', thread: ids[A] as string });
    if (lunardiSeen) sink({ k: 'stranezza', quirk: 'lunardiCura', thread: ids[m.qLunardi] as string });
  }
}

/**
 * Applica una riga già validata: passaggi, scambio, bordi, fine riga (Teresa
 * legge, trabocco), agende dei fili autonomi. `out` deve avere la stessa
 * lunghezza di `st` (il solver aggiunge in coda i suoi bit).
 */
export function stepRow(m: Model, st: Int32Array, out: Int32Array, row: RowSpec, hour: number, info: RowInfo, sink: Sink): void {
  out.set(st);
  info.nMeet = 0;
  info.nExit = 0;
  info.nEnter = 0;
  const W = m.W;
  const ids = m.ids;
  let knot = 0;

  // 4. Passaggi (dallo stato a inizio riga) e 5. scambio
  for (let k = 0; k < row.n; k++) {
    const p = row.pair[k] as number;
    const L = st[p] as number;
    const R = st[p + 1] as number;
    const A = row.overR[k] ? R : L;
    const B = row.overR[k] ? L : R;
    info.over[info.nMeet] = A;
    info.under[info.nMeet] = B;
    info.nMeet++;
    if (sink) sink({ k: 'incontro', a: ids[L] as string, b: ids[R] as string, over: ids[A] as string, pair: p });
    if ((m.rancor[A] as number) & (1 << B)) {
      // Rancore: nessun passaggio, nodo, bloccati nella riga dopo.
      knot |= (1 << A) | (1 << B);
      if (sink) sink({ k: 'nodo', a: ids[A] as string, b: ids[B] as string });
    } else transfer(m, st, out, A, B, sink);
    out[p] = R;
    out[p + 1] = L;
  }
  // Nodi: quelli nuovi bloccano le prossime `knotRows` righe, i vecchi scalano di una.
  const KR = m.knotRows;
  if (KR > 1) {
    const X = m.OFF_KNOTX;
    out[m.OFF_KNOT] = (st[X] as number) | knot;
    for (let j = 1; j < KR; j++) out[X + j - 1] = (j + 1 < KR ? (st[X + j] as number) : 0) | knot;
  } else out[m.OFF_KNOT] = knot;

  // 6. Bordi
  const steps = hour >= 0 && hour <= 24 ? m.edgesAt[hour] : null;
  if (steps) {
    const tide = m.tideAt[hour] as number;
    for (const s of steps) {
      if (tide & (1 << s.col)) continue; // acqua alta: nessuno entra né esce
      let onBoard = false;
      for (let c = 0; c < W; c++) if (out[c] === s.enters) onBoard = true;
      if (onBoard) continue;
      const x = out[s.col] as number;
      out[s.col] = s.enters;
      out[m.OFF_KNOT] = (out[m.OFF_KNOT] as number) & ~(1 << x);
      for (let j = 1; j < m.knotRows; j++) out[m.OFF_KNOTX + j - 1] = (out[m.OFF_KNOTX + j - 1] as number) & ~(1 << x);
      info.exits[info.nExit] = x;
      info.exitStep[info.nExit] = s;
      info.nExit++;
      info.enters[info.nEnter++] = s.enters;
      if (sink) {
        sink({ k: 'esce', thread: ids[x] as string, side: s.side, kind: s.kind });
        sink({ k: 'entra', thread: ids[s.enters] as string, side: s.side, kind: s.kind });
      }
    }
  }

  // 7. Fine riga: Teresa legge
  const te = m.qLegge;
  if (te >= 0) {
    let teOn = false;
    for (let c = 0; c < W; c++) if (out[c] === te) teOn = true;
    if (teOn) {
      const letters = m.trackedLetters;
      for (let i = 0; i < letters.length; i++) {
        const li = letters[i] as number;
        if (out[m.slot[li] as number] !== te || m.beadTo[li] === te) continue;
        if ((out[m.OFF_DELIV] as number) & (1 << (m.letterOrd[li] as number))) continue;
        const lb = m.lettaOf[li] as number;
        if (lb < 0 || m.inert[lb]) continue;
        const ls = m.slot[lb] as number;
        if (ls < 0) continue;
        if ((out[ls] as number) & (1 << te)) continue;
        out[ls] = (out[ls] as number) | (1 << te);
        if (sink) {
          sink({ k: 'legge', letter: m.beadIds[li] as string, secret: m.beadIds[lb] as string, who: ids[te] as string });
          sink({ k: 'stranezza', quirk: 'teresaLegge', thread: ids[te] as string });
        }
      }
    }
  }
  // Fine riga: trabocco del pozzo
  if (m.trabocca && out[m.OFF_PO] === 0 && (out[m.OFF_PN] as number) >= m.traboccoSoglia) {
    out[m.OFF_PO] = 1;
    if (sink) {
      sink({ k: 'trabocca', who: ids[m.pozzo] as string });
      sink({ k: 'stranezza', quirk: 'pieroTrabocca', thread: ids[m.pozzo] as string });
    }
  }

  // Agende dei fili autonomi: un filo seguito e incrociato, o un appuntamento passato, si spunta.
  for (const ag of m.agents) {
    let p = out[ag.slot] as number;
    let followed = false;
    for (;;) {
      const it = ag.agenda[p];
      if (!it) break;
      if (it.k === 'follow') {
        if (followed) break;
        let crossed = false;
        for (let k = 0; k < info.nMeet; k++) {
          const a = info.over[k];
          const b = info.under[k];
          if ((a === ag.thread && b === it.t) || (b === ag.thread && a === it.t)) crossed = true;
        }
        if (!crossed) break;
        followed = true;
        p++;
      } else if (it.k === 'place') {
        if (it.hour <= hour) p++;
        else break;
      } else break;
    }
    out[ag.slot] = p;
  }
}

/** Stato compatto iniziale (GDD 3.1): posizioni, perline, lettere già consegnate, nome di Ada. */
export function initialCompact(m: Model): Int32Array {
  const st = new Int32Array(m.LEN);
  for (let c = 0; c < m.W; c++) st[c] = m.initial[c] ?? 0;
  for (const li of m.trackedLetters) st[m.slot[li] as number] = -1;
  const idx = m.idx;
  for (const b of m.level.beads) {
    const bi = m.beadIdx.get(b.id);
    if (bi === undefined) continue;
    const s = m.slot[bi] as number;
    if (s < 0) continue;
    if (m.beadType[bi] === B_LETTERA) {
      const h = b.holder !== undefined ? (idx.get(b.holder) ?? -1) : (b.holders?.[0] !== undefined ? (idx.get(b.holders[0]) ?? -1) : -1);
      st[s] = h;
      if (h >= 0 && h === m.beadTo[bi]) st[m.OFF_DELIV] = (st[m.OFF_DELIV] as number) | (1 << (m.letterOrd[bi] as number));
    } else {
      let mask = st[s] as number;
      const list = b.holders ?? (b.holder !== undefined ? [b.holder] : []);
      for (const h of list) {
        const t = idx.get(h);
        if (t !== undefined) mask |= 1 << t;
      }
      st[s] = mask;
    }
  }
  const nomeOn = m.ctx.nomeOn;
  if (nomeOn !== null) {
    const nb = m.beadIdx.get('nome');
    const t = m.idx.get(nomeOn);
    if (nb !== undefined && t !== undefined && (m.slot[nb] as number) >= 0) {
      const s = m.slot[nb] as number;
      st[s] = (st[s] as number) | (1 << t);
    }
  }
  if (m.qLunardi >= 0) {
    for (let bi = 0; bi < m.B; bi++) {
      const s = m.slot[bi] as number;
      if (s >= 0 && m.beadType[bi] === B_FEBBRE) st[s] = (st[s] as number) & ~(1 << m.qLunardi);
    }
  }
  if (m.trabocca) {
    let n = 0;
    for (let bi = 0; bi < m.B; bi++) {
      const s = m.slot[bi] as number;
      if (s >= 0 && m.beadType[bi] === B_SEGRETO && ((st[s] as number) & (1 << m.pozzo))) n++;
    }
    st[m.OFF_PN] = n;
  }
  for (const ag of m.agents) st[ag.slot] = initialAgendaPointer(m, ag.agenda, m.startHour);
  return st;
}

/** Primo elemento dell'agenda non ancora passato all'ora `hour`. */
export function initialAgendaPointer(m: Model, agenda: Model['agents'][number]['agenda'], hour: number): number {
  void m;
  let p = 0;
  while (p < agenda.length) {
    const it = agenda[p];
    if (it && it.k === 'place' && it.hour <= hour) p++;
    else break;
  }
  return p;
}

/** Il filo `t` tiene la perlina `bi`? (sullo stato compatto; perline non tracciate: no). */
export function holds(m: Model, st: Int32Array, t: number, bi: number): boolean {
  const s = m.slot[bi] as number;
  if (s < 0 || t < 0) return false;
  if (m.beadType[bi] === B_LETTERA) return st[s] === t;
  return ((st[s] as number) & (1 << t)) !== 0;
}

/** Lettera consegnata? */
export function isDelivered(m: Model, st: Int32Array, bi: number): boolean {
  const o = m.letterOrd[bi] as number;
  return o >= 0 && ((st[m.OFF_DELIV] as number) & (1 << o)) !== 0;
}

