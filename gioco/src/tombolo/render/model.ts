/**
 * Modello di disegno del merletto: tutto quello che il renderer legge,
 * ricalcolato solo quando la notte cambia (nuova bozza, ora fissata, Disfa,
 * nomi d'Archivio, occasioni), mai a ogni fotogramma.
 */
import type { BeadType, Condition, CondReport, Crossing, GradoId, LaceState, LevelDef, OccasionDef, ThreadId } from '../../core/types';
import { fnv1a32 } from '../../engine/index';
import type { Session } from '../session';
import type { ThreadVisual } from '../visuals';
import { visualOf } from '../visuals';
import { allowedCells, OCCASION_GLYPH, presetOccasions } from '../modes/autoweave';
import { type RowShape, buildRowShape } from './threads';
import type { PinKind, PinState } from './pins';

export interface PinView {
  kind: PinKind;
  state: PinState;
  col: number;
  /** Indice della riga dell'ora dello spillo. */
  index: number;
  icon: string | null;
  label: string | null;
}

export interface StackBead {
  id: string;
  type: BeadType;
  delivered: boolean;
}

export interface StackView {
  col: number;
  thread: ThreadId;
  beads: StackBead[];
}

export interface CellMark {
  col: number;
  index: number;
}

export interface LaceModel {
  version: number;
  level: LevelDef;
  rows: number;
  fixed: number;
  /** Indice della riga corrente (rows + 1 a merletto finito). */
  current: number;
  done: boolean;
  openPos: ThreadId[];
  rowShapes: RowShape[];
  /** Firme delle righe fissate (0 = apertura), a catena: cambiano se cambia una riga prima. */
  rowSigs: string[];
  liveShape: RowShape | null;
  /** Fili in fondo alla riga corrente (dopo la bozza), per colonna. */
  hangPos: ThreadId[];
  hangKnotted: ThreadId[];
  stacks: StackView[];
  pins: PinView[];
  tide: { col: number; from: number; to: number }[];
  edges: { index: number; side: -1 | 1; kind: string }[];
  hourLabels: string[];
  visuals: Map<ThreadId, ThreadVisual>;
  beadTypes: Map<string, BeadType>;
  /** Echi d'Archivio disponibili (coppia, riga). */
  echoes: { index: number; pair: number }[];
}

export const BEAD_ORDER: Readonly<Record<BeadType, number>> = { lettera: 0, voce: 1, segreto: 2, febbre: 3, nome: 4 };

export function beadTypesOf(level: LevelDef): Map<string, BeadType> {
  const m = new Map<string, BeadType>();
  for (const b of level.beads) m.set(b.id, b.type);
  return m;
}

/** Perline tenute da ogni filo in uno stato, nell'ordine delle colonne. */
export function stacksOf(state: LaceState, types: ReadonlyMap<string, BeadType>): StackView[] {
  const out: StackView[] = state.pos.map((thread, col) => ({ col, thread, beads: [] as StackBead[] }));
  const byThread = new Map<ThreadId, StackView>();
  for (const s of out) byThread.set(s.thread, s);
  for (const [id, holders] of Object.entries(state.holders)) {
    let type = types.get(id);
    if (!type) type = id.startsWith('letta:') ? 'segreto' : id === 'nome' ? 'nome' : id === 'febbre' ? 'febbre' : 'voce';
    for (const h of holders) {
      const s = byThread.get(h);
      if (s) s.beads.push({ id, type, delivered: state.delivered.includes(id) });
    }
  }
  for (const s of out) s.beads.sort((a, b) => BEAD_ORDER[a.type] - BEAD_ORDER[b.type] || (a.id < b.id ? -1 : 1));
  return out;
}

/** Condizioni "presso" dentro una richiesta (anche dentro tutti/almeno): spilli rossi nelle celle. */
export function pressoOf(c: Condition, out: { who: ThreadId; place: string; hour: number }[] = []): { who: ThreadId; place: string; hour: number }[] {
  if (c.t === 'presso') out.push({ who: c.who, place: c.place, hour: c.hour });
  else if (c.t === 'tutti' || c.t === 'almeno') for (const x of c.of) pressoOf(x, out);
  return out;
}

export interface ModelInput {
  session: Session;
  visuals: Map<ThreadId, ThreadVisual>;
  visualsVersion: number;
  gradi: readonly GradoId[];
  /** Si stanno piantando occasioni: si mostrano le celle ammesse. */
  placingOccasions: boolean;
  /** Archivio rammendato e nominato: gli echi si possono toccare. */
  echoesOpen: boolean;
}

function rowKey(c: readonly Crossing[]): string {
  return c
    .map((x) => `${x.pair}${x.over}${x.forced ? 'f' : ''}`)
    .sort()
    .join('');
}

export function buildLaceModel(inp: ModelInput, prev: LaceModel | null): LaceModel {
  const s = inp.session;
  const level = s.level;
  const start = level.startHour;
  const rows = level.endHour - start;
  const types = prev && prev.level === level ? prev.beadTypes : beadTypesOf(level);
  const fixed = s.rows.length;
  const done = s.done;
  const current = done ? rows + 1 : fixed + 1;

  // Righe fissate (forme e firme a catena).
  const sigs: string[] = [];
  const open = s.timeline[0] as LaceState;
  let chain = fnv1a32(`open|${open.pos.join(',')}|${inp.visualsVersion}|${s.nomeOn ?? ''}`).toString(36);
  sigs.push(chain);
  const shapes: RowShape[] = [];
  for (let i = 1; i <= fixed; i++) {
    const r = s.rows[i - 1];
    const before = s.timeline[i - 1] as LaceState;
    const after = s.timeline[i] as LaceState;
    if (!r) break;
    chain = fnv1a32(`${chain}|${r.hour}:${rowKey(r.crossings)}:${after.pos.join(',')}`).toString(36);
    sigs.push(chain);
    const reuse = prev && prev.level === level && prev.rowSigs[i] === chain && prev.rowShapes[i - 1];
    shapes.push(reuse || buildRowShape(i, r.hour, before.pos, r.crossings, after.pos, s.events[i - 1] ?? null, before.knotted, types, false));
  }

  // Riga corrente.
  let liveShape: RowShape | null = null;
  let hangState: LaceState = s.state;
  if (!done) {
    const p = s.preview();
    hangState = p.state;
    liveShape = buildRowShape(current, s.hour, s.state.pos, s.rowCrossings(), p.state.pos, p.events, s.state.knotted, types, true);
  }
  const stacks = stacksOf(hangState, types);

  // Spilli.
  const pins: PinView[] = [];
  const unreachable = done ? [] : s.unreachable();
  const curHour = s.hour;
  for (const pin of level.pins) {
    const col = level.columns.indexOf(pin.place);
    const index = pin.hour - start;
    if (col < 0 || index < 1 || index > rows) continue;
    if (inp.gradi.includes('spilliVelati') && pin.hour > curHour + 2 && index > fixed) continue;
    let state: PinState = 'normale';
    if (index <= fixed) state = (s.timeline[index] as LaceState).pos[col] === pin.thread ? 'acceso' : 'normale';
    else if (index === current) state = hangState.pos[col] === pin.thread ? 'acceso' : 'normale';
    if (index > fixed && unreachable.some((u) => u.thread === pin.thread && u.place === pin.place && u.hour === pin.hour)) state = 'irraggiungibile';
    const v = visualOf(inp.visuals, pin.thread);
    pins.push({ kind: 'ottone', state, col, index, icon: v.faded ? null : v.icon, label: state === 'irraggiungibile' ? String(pin.hour) : null });
  }
  const status = s.requestStatusFull();
  s.params.accepted.forEach((a) => {
    const st = status.find((x) => x.noteId === a.noteId);
    if (!st || st.dropped) return;
    for (const c of pressoOf(a.request)) {
      const col = level.columns.indexOf(c.place as never);
      const index = c.hour - start;
      if (col < 0 || index < 1 || index > rows) continue;
      const rep: CondReport = st.report;
      const state: PinState = rep.status === 'soddisfatta' ? 'fatto' : rep.status === 'fallita' ? 'fallito' : 'normale';
      pins.push({ kind: 'rosso', state, col, index, icon: visualOf(inp.visuals, c.who).icon, label: state === 'fallito' ? String(c.hour) : null });
    }
  });
  const greens: OccasionDef[] = [...presetOccasions(level), ...s.occasions];
  for (const o of greens) {
    const col = level.columns.indexOf(o.place);
    const index = o.hour - start;
    if (col < 0 || index < 1 || index > rows) continue;
    pins.push({ kind: 'verde', state: 'normale', col, index, icon: OCCASION_GLYPH[o.kind], label: null });
  }
  if (inp.placingOccasions) {
    for (const o of allowedCells(level)) {
      if (greens.some((g) => g.place === o.place && g.hour === o.hour)) continue;
      const col = level.columns.indexOf(o.place);
      const index = o.hour - start;
      if (col < 0 || index < 1 || index > rows) continue;
      pins.push({ kind: 'verde', state: 'ombra', col, index, icon: OCCASION_GLYPH[o.kind], label: null });
    }
  }

  const tide: LaceModel['tide'] = [];
  for (const t of level.tide ?? []) {
    for (const p of t.places) {
      const col = level.columns.indexOf(p);
      if (col >= 0) tide.push({ col, from: Math.max(1, t.from - start), to: Math.min(rows, t.to - start) });
    }
  }
  const edges: LaceModel['edges'] = (level.edges ?? []).map((e) => ({ index: e.hour - start, side: e.side === 'molo' ? -1 : 1, kind: e.kind }));
  if (level.nero) edges.push({ index: level.nero.enter.hour - start, side: level.nero.enter.side === 'molo' ? -1 : 1, kind: 'nero' });

  const hourLabels = prev && prev.level === level ? prev.hourLabels : Array.from({ length: rows + 1 }, (_, i) => String(start + i));
  const echoes = inp.echoesOpen && s.archive ? s.archive.echoes().map((e) => ({ index: e.hour - start, pair: e.pair })) : [];

  return {
    version: (prev?.version ?? 0) + 1,
    level,
    rows,
    fixed,
    current,
    done,
    openPos: open.pos.slice(),
    rowShapes: shapes,
    rowSigs: sigs,
    liveShape,
    hangPos: hangState.pos.slice(),
    hangKnotted: done ? [] : hangState.knotted.slice(),
    stacks,
    pins,
    tide,
    edges,
    hourLabels,
    visuals: inp.visuals,
    beadTypes: types,
    echoes,
  };
}
