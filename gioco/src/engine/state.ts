/**
 * Stato pubblico del merletto (`LaceState`): stato iniziale, conversioni da e
 * verso lo stato compatto del motore, copia e chiavi di confronto.
 *
 * Oltre ai campi di `LaceState`, il motore conserva in `agenda` (campo in più,
 * facoltativo, serializzabile) il punto dell'agenda di ogni filo autonomo
 * (filo nero, autotessitura): serve a sapere quale filo il nero sta seguendo.
 */
import type { LaceState, LevelDef, RunContext, ThreadId } from '../core/types';
import type { Model } from './model';
import { B_LETTERA, fullModel } from './model';
import type { RowInfo } from './core';
import { initialAgendaPointer, initialCompact } from './core';

/** LaceState con il punto delle agende dei fili autonomi. */
export type EngineLaceState = LaceState & { agenda?: Record<ThreadId, number> };

function metKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Stato compatto da uno stato pubblico (modello con tutte le perline tracciate o un sottoinsieme). */
export function toCompact(m: Model, s: LaceState): Int32Array {
  const st = new Int32Array(m.LEN);
  for (let c = 0; c < m.W; c++) {
    const id = s.pos[c];
    const t = id !== undefined ? m.idx.get(id) : undefined;
    if (t === undefined) throw new Error(`engine: unknown thread "${String(id)}" at column ${c}`);
    st[c] = t;
  }
  let knot = 0;
  for (const id of s.knotted) {
    const t = m.idx.get(id);
    if (t !== undefined) knot |= 1 << t;
  }
  st[m.OFF_KNOT] = knot;
  let deliv = 0;
  for (const id of s.delivered) {
    const bi = m.beadIdx.get(id);
    if (bi !== undefined && (m.letterOrd[bi] as number) >= 0) deliv |= 1 << (m.letterOrd[bi] as number);
  }
  st[m.OFF_DELIV] = deliv;
  st[m.OFF_PN] = s.pozzo.secrets;
  st[m.OFF_PO] = s.pozzo.overflowing ? 1 : 0;
  for (let bi = 0; bi < m.B; bi++) {
    const sl = m.slot[bi] as number;
    if (sl < 0) continue;
    const list = s.holders[m.beadIds[bi] as string] ?? [];
    if (m.beadType[bi] === B_LETTERA) {
      const h = list[0] !== undefined ? m.idx.get(list[0]) : undefined;
      st[sl] = h ?? -1;
    } else {
      let mask = 0;
      for (const id of list) {
        const t = m.idx.get(id);
        if (t !== undefined) mask |= 1 << t;
      }
      st[sl] = mask;
    }
  }
  const agenda = (s as EngineLaceState).agenda;
  for (const ag of m.agents) {
    const id = m.ids[ag.thread] as string;
    const v = agenda?.[id];
    st[ag.slot] = typeof v === 'number' ? v : initialAgendaPointer(m, ag.agenda, s.hour);
  }
  return st;
}

/**
 * Stato pubblico dallo stato compatto. `prev` è lo stato prima della riga (null
 * per l'apertura); `info` dice chi si è incrociato ed è uscito nella riga.
 */
export function fromCompact(m: Model, st: Int32Array, prev: LaceState | null, hour: number, info: RowInfo | null, playerCrossings: number): EngineLaceState {
  const ids = m.ids;
  const pos: ThreadId[] = [];
  for (let c = 0; c < m.W; c++) pos.push(ids[st[c] as number] as string);
  const onBoard = new Set(pos);

  const offboard = (prev?.offboard ?? []).filter((o) => !onBoard.has(o.thread)).map((o) => ({ ...o }));
  if (info) {
    for (let k = 0; k < info.nExit; k++) {
      const t = ids[info.exits[k] as number] as string;
      const step = info.exitStep[k];
      if (!step || onBoard.has(t)) continue;
      const i = offboard.findIndex((o) => o.thread === t);
      if (i >= 0) offboard.splice(i, 1);
      offboard.push({ thread: t, hour, side: step.side });
    }
  }

  const holders: Record<string, ThreadId[]> = {};
  const delivered: string[] = [];
  const deliv = st[m.OFF_DELIV] as number;
  for (let bi = 0; bi < m.B; bi++) {
    const sl = m.slot[bi] as number;
    const id = m.beadIds[bi] as string;
    let list: ThreadId[] = [];
    if (sl >= 0) {
      if (m.beadType[bi] === B_LETTERA) {
        const h = st[sl] as number;
        if (h >= 0) list = [ids[h] as string];
        if (deliv & (1 << (m.letterOrd[bi] as number))) delivered.push(id);
      } else {
        const mask = st[sl] as number;
        for (let t = 0; t < m.T; t++) if (mask & (1 << t)) list.push(ids[t] as string);
      }
    }
    if (m.defined[bi] || list.length > 0) holders[id] = list;
  }

  const knotted: ThreadId[] = [];
  const knot = st[m.OFF_KNOT] as number;
  for (let t = 0; t < m.T; t++) if (knot & (1 << t)) knotted.push(ids[t] as string);

  const met = prev ? [...prev.met] : [];
  const metOver = prev ? [...prev.metOver] : [];
  if (info) {
    const metSet = new Set(met);
    const overSet = new Set(metOver);
    for (let k = 0; k < info.nMeet; k++) {
      const a = ids[info.over[k] as number] as string;
      const b = ids[info.under[k] as number] as string;
      const mk = metKey(a, b);
      if (!metSet.has(mk)) {
        metSet.add(mk);
        met.push(mk);
      }
      const ok = `${a}>${b}`;
      if (!overSet.has(ok)) {
        overSet.add(ok);
        metOver.push(ok);
      }
    }
  }

  const out: EngineLaceState = {
    hour,
    pos,
    offboard,
    holders,
    delivered,
    knotted,
    pozzo: { secrets: st[m.OFF_PN] as number, overflowing: st[m.OFF_PO] === 1 },
    usedMatassa: (prev?.usedMatassa ?? 0) + playerCrossings,
    met,
    metOver,
  };
  if (m.agents.length > 0) {
    const agenda: Record<ThreadId, number> = {};
    for (const ag of m.agents) agenda[ids[ag.thread] as string] = st[ag.slot] as number;
    out.agenda = agenda;
  }
  return out;
}

/** Stato all'ora di apertura (GDD 3.1): `initial`, perline dei dati, nome di Ada su `ctx.nomeOn`. */
export function initialState(level: LevelDef, ctx: RunContext): LaceState {
  const m = fullModel(level, ctx);
  return fromCompact(m, initialCompact(m), null, m.startHour, null, 0);
}

/** Copia profonda di uno stato (anche del campo `agenda`). */
export function cloneState<S extends LaceState>(s: S): S {
  return JSON.parse(JSON.stringify(s)) as S;
}

function sortedHolders(s: LaceState): string {
  const keys = Object.keys(s.holders).sort();
  const parts: string[] = [];
  for (const k of keys) {
    const list = s.holders[k] ?? [];
    if (list.length === 0) continue;
    parts.push(`${k}=${[...list].sort().join(',')}`);
  }
  return parts.join(';');
}

/**
 * Chiave del merletto "come si vede": posizioni, perline, lettere consegnate,
 * nodi, pozzo e fili fuori dalla tela. Non contiene la storia (matassa usata,
 * incontri): due stati con la stessa chiave hanno lo stesso futuro.
 */
export function stateKey(s: LaceState): string {
  const agenda = (s as EngineLaceState).agenda;
  const ag = agenda ? Object.keys(agenda).sort().map((k) => `${k}:${String(agenda[k])}`).join(',') : '';
  return [
    s.hour,
    s.pos.join(','),
    sortedHolders(s),
    [...s.delivered].sort().join(','),
    [...s.knotted].sort().join(','),
    `${s.pozzo.secrets}${s.pozzo.overflowing ? '!' : ''}`,
    s.offboard.map((o) => o.thread).sort().join(','),
    ag,
  ].join('/');
}

/** Stessi fili negli stessi posti e stesse perline (confronto del rammendo d'Archivio, GDD 5.3). */
export function sameLace(a: LaceState, b: LaceState): boolean {
  return a.pos.join(',') === b.pos.join(',') && sortedHolders(a) === sortedHolders(b) && [...a.delivered].sort().join(',') === [...b.delivered].sort().join(',');
}
