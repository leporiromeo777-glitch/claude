/**
 * Regole di una riga (GDD 3.4-3.11), API pubblica del motore.
 *
 * - `blocked`: fili bloccati nella riga successiva (nodo del rancore, marea);
 * - `forcedCrossings`: incroci già decisi della riga successiva (filo nero, autotessitura);
 * - `checkCrossing`: controllo immediato di un incrocio durante il trascinamento;
 * - `previewRow`: applica la bozza senza controllare spilli e Gino (anteprima);
 * - `applyRow`: applica la riga con tutti i controlli, nell'ordine normativo;
 * - `unreachablePins`: spilli d'ottone ormai irraggiungibili.
 *
 * La bozza (`draft`) contiene gli incroci del giocatore. Gli incroci forzati li
 * ricalcola sempre il motore: quelli presenti nella bozza con `forced: true`
 * si ignorano. Una riga rifiutata (`ok: false`) lascia lo stato com'era.
 */
import type { Crossing, LaceEvent, LaceState, LevelDef, PinDef, RowResult, RunContext, ThreadId, Violation } from '../core/types';
import type { Model } from './model';
import { fullModel } from './model';
import type { RowSpec } from './core';
import { Q_FARO, Q_RIFIUTO, blockedMask, colOf, ginoVicino, newRow, newRowInfo, nonPlayerMask, quirkCheck, rowPush, stepRow } from './core';
import { planAutoCore, rowToCrossings } from './autoweave';
import { fromCompact, toCompact } from './state';
import { violationKey } from './keys';

type Code = Violation['code'];

function viol(code: Code, extra: Partial<Violation> = {}, keySuffix?: string): Violation {
  return { code, messageKey: violationKey(keySuffix ?? code), ...extra };
}

function pairThreads(m: Model, st: Int32Array, p: number): ThreadId[] {
  return [m.ids[st[p] as number] as string, m.ids[st[p + 1] as number] as string];
}

/** Incroci forzati della riga dell'ora `hour` (filo nero, autotessitura con il controllato fermo). */
export function computeForced(m: Model, st: Int32Array, hour: number, out: RowSpec): void {
  out.n = 0;
  if (hour > m.endHour || m.agents.length === 0) return;
  planAutoCore(m, st, hour, -1, 0, out);
}

/** Controllo di un incrocio del giocatore contro la riga già composta (forzati e altri incroci). */
function checkOne(m: Model, st: Int32Array, hour: number, row: RowSpec, c: Crossing, np: number, blocked: number): Violation | null | 'eco' {
  const p = c.pair;
  if (!Number.isInteger(p) || p < 0 || p > m.W - 2) return viol('disgiunto', { params: { coppia: String(p) } });
  const overR = c.over === 'R' ? 1 : 0;
  const cols = (1 << p) | (1 << (p + 1));
  const threads = pairThreads(m, st, p);
  for (let k = 0; k < row.n; k++) {
    const q = row.pair[k] as number;
    const qc = (1 << q) | (1 << (q + 1));
    if (!(qc & cols)) continue;
    if (row.forced[k]) {
      if (q === p) return (row.overR[k] as number) === overR ? 'eco' : viol('forzato', { threads });
      return viol('occupato', { threads: pairThreads(m, st, q) });
    }
    return viol('disgiunto', { threads, params: { coppia: p } });
  }
  const L = st[p] as number;
  const R = st[p + 1] as number;
  if (m.hasAuto) {
    if (m.controlled < 0 || (L !== m.controlled && R !== m.controlled)) return viol('forzato', { threads });
  } else if (np & ((1 << L) | (1 << R))) return viol('forzato', { threads });
  if (blocked & ((1 << L) | (1 << R))) {
    const who: ThreadId[] = [];
    if (blocked & (1 << L)) who.push(m.ids[L] as string);
    if (blocked & (1 << R)) who.push(m.ids[R] as string);
    return viol('bloccato', { threads: who, params: { chi: who[0] ?? '' } });
  }
  const q = quirkCheck(m, st, p, overR);
  if (q === Q_RIFIUTO) {
    return viol('rifiuto', { threads: [m.ids[m.qTeresaSopra] as string, m.ids[m.qMarta] as string], quirk: 'martaNoSotto' });
  }
  if (q === Q_FARO) return viol('faro', { threads: [m.ids[m.qZeno] as string], quirk: 'zenoFaro' });
  void hour;
  return null;
}

interface Assembled {
  row: RowSpec;
  violations: Violation[];
  player: number;
}

/** Compone la riga: forzati + incroci validi della bozza; raccoglie le violazioni (senza spilli e Gino). */
function assemble(m: Model, st: Int32Array, state: LaceState, hour: number, draft: readonly Crossing[], matassa: number): Assembled {
  const violations: Violation[] = [];
  const row = newRow();
  const np = nonPlayerMask(m);
  const blocked = blockedMask(m, st, hour);
  const player = draft.filter((c) => !c.forced);
  if (m.hasAuto) {
    // Autotessitura: il giocatore muove solo il filo controllato, il resto lo decide planAutoRow.
    const tmp = newRow();
    let ctrl: Crossing | null = null;
    for (const c of player) {
      const v = checkOne(m, st, hour, tmp, c, np, blocked);
      if (v === 'eco') continue;
      if (v) {
        violations.push(v);
        continue;
      }
      ctrl = c;
      rowPush(tmp, c.pair, c.over === 'R' ? 1 : 0, 0);
    }
    planAutoCore(m, st, hour, ctrl ? ctrl.pair : -1, ctrl && ctrl.over === 'R' ? 1 : 0, row);
  } else {
    computeForced(m, st, hour, row);
    for (const c of player) {
      const v = checkOne(m, st, hour, row, c, np, blocked);
      if (v === 'eco') continue;
      if (v) {
        violations.push(v);
        continue;
      }
      rowPush(row, c.pair, c.over === 'R' ? 1 : 0, 0);
    }
  }
  sortRow(row);
  let n = 0;
  for (let k = 0; k < row.n; k++) if (!row.forced[k]) n++;
  if (state.usedMatassa + n > matassa) violations.push(viol('matassa', { params: { matassa, usata: state.usedMatassa + n } }));
  return { row, violations, player: n };
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

function finished(state: LaceState, m: Model): Violation | null {
  return state.hour >= m.endHour ? viol('bloccato', {}, 'finita') : null;
}

/** Fili bloccati nella riga successiva (annodati dalla riga prima, o in colonne allagate). */
export function blocked(level: LevelDef, state: LaceState, ctx: RunContext): ThreadId[] {
  const m = fullModel(level, ctx);
  const st = toCompact(m, state);
  const mask = blockedMask(m, st, state.hour + 1);
  const out: ThreadId[] = [];
  for (let c = 0; c < m.W; c++) if (mask & (1 << (st[c] as number))) out.push(m.ids[st[c] as number] as string);
  return out;
}

/** Incroci già decisi della riga successiva: filo nero, autotessitura (GDD 3.4 passo 2). */
export function forcedCrossings(level: LevelDef, state: LaceState, ctx: RunContext): Crossing[] {
  const m = fullModel(level, ctx);
  const st = toCompact(m, state);
  const out = newRow();
  computeForced(m, st, state.hour + 1, out);
  return rowToCrossings(out);
}

/** Controllo immediato: null se `c` è ammesso insieme alla bozza (un incrocio sulla stessa coppia lo sostituisce). */
export function checkCrossing(level: LevelDef, state: LaceState, draft: Crossing[], c: Crossing, ctx: RunContext): Violation | null {
  const m = fullModel(level, ctx);
  const end = finished(state, m);
  if (end) return end;
  const st = toCompact(m, state);
  const hour = state.hour + 1;
  const others = draft.filter((d) => !d.forced && d.pair !== c.pair);
  // In autotessitura le coppie del filo controllato sono escluse dal piano: si controlla da solo.
  const asm = assemble(m, st, state, hour, m.hasAuto ? [] : others, Number.POSITIVE_INFINITY);
  const np = nonPlayerMask(m);
  const v = checkOne(m, st, hour, m.hasAuto ? newRow() : asm.row, c, np, blockedMask(m, st, hour));
  if (v === 'eco') return null;
  if (v) return v;
  const player = m.hasAuto ? 0 : asm.player;
  if (state.usedMatassa + player + 1 > level.matassa) return viol('matassa', { params: { matassa: level.matassa, usata: state.usedMatassa + player + 1 } });
  return null;
}

function runRow(level: LevelDef, state: LaceState, draft: Crossing[], ctx: RunContext, full: boolean): RowResult {
  const m = fullModel(level, ctx);
  const end = finished(state, m);
  if (end) return { ok: false, state, events: [], violations: [end] };
  const st = toCompact(m, state);
  const hour = state.hour + 1;
  const asm = assemble(m, st, state, hour, draft, level.matassa);
  if (full && asm.violations.length > 0) return { ok: false, state, events: [], violations: asm.violations };
  const out = new Int32Array(m.LEN);
  const info = newRowInfo();
  const events: LaceEvent[] = [];
  stepRow(m, st, out, asm.row, hour, info, (e) => events.push(e));
  const violations = asm.violations;
  if (full) {
    // 7. Fine riga: spilli d'ottone di quest'ora, poi Gino.
    for (const p of m.pinsAt[hour] ?? []) {
      if (colOf(out, m.W, p.thread) !== p.col || p.col < 0) {
        violations.push(viol('spillo', { pin: { ...p.def }, threads: [p.def.thread], params: { chi: p.def.thread, luogo: p.def.place, ora: p.def.hour } }));
      }
    }
    const vicino = ginoVicino(m, st, asm.row, blockedMask(m, st, hour));
    if (vicino >= 0) {
      const chi = m.ids[m.qGino] as string;
      violations.push(viol('corre', { threads: [chi], quirk: 'ginoCorre', params: { chi, vicino: m.ids[vicino] as string } }));
    }
    if (violations.length > 0) return { ok: false, state, events: [], violations };
  }
  const next = fromCompact(m, out, state, hour, info, asm.player);
  // 8. Annuncio: l'incrocio del filo nero della riga dopo, calcolato da questo stato.
  if (m.neroThread >= 0 && hour < m.endHour) {
    const nx = newRow();
    computeForced(m, out, hour + 1, nx);
    for (let k = 0; k < nx.n; k++) {
      const p = nx.pair[k] as number;
      if (out[p] === m.neroThread || out[p + 1] === m.neroThread) events.push({ k: 'nero', thread: m.ids[m.neroThread] as string, pair: p });
    }
  }
  return { ok: violations.length === 0, state: next, events, violations };
}

/** Applica la bozza senza controllare spilli e Gino (anteprima). Gli incroci non validi si saltano e compaiono in `violations`. */
export function previewRow(level: LevelDef, state: LaceState, draft: Crossing[], ctx: RunContext): RowResult {
  return runRow(level, state, draft, ctx, false);
}

/** Applica la riga con tutti i controlli (GDD 3.4). `ok: false` → lo stato resta quello di partenza. */
export function applyRow(level: LevelDef, state: LaceState, draft: Crossing[], ctx: RunContext): RowResult {
  return runRow(level, state, draft, ctx, true);
}

/** Spilli d'ottone delle ore future che non si possono più rispettare (distanza > righe rimaste). */
export function unreachablePins(level: LevelDef, state: LaceState, ctx: RunContext): PinDef[] {
  const m = fullModel(level, ctx);
  const st = toCompact(m, state);
  const out: PinDef[] = [];
  for (const p of m.pins) {
    if (p.hour <= state.hour) continue;
    if (p.col < 0) {
      out.push({ ...p.def });
      continue;
    }
    const c = colOf(st, m.W, p.thread);
    if (c >= 0) {
      if (Math.abs(c - p.col) > p.hour - state.hour) out.push({ ...p.def });
      continue;
    }
    // Fuori dalla tela: raggiungibile solo se rientra da un bordo in tempo.
    let ok = false;
    for (const h of m.reentryHours.get(p.thread) ?? []) {
      if (h <= state.hour || h > p.hour) continue;
      for (const s of m.edgesAt[h] ?? []) {
        if (s.enters === p.thread && Math.abs(s.col - p.col) <= p.hour - h) ok = true;
      }
    }
    if (!ok) out.push({ ...p.def });
  }
  return out;
}

