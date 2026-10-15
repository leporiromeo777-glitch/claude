/**
 * Fili di una riga (GDD 12.3): tratti verticali con un'ondulazione appena
 * visibile, incroci a S con il filo sotto interrotto dove passa quello sopra e
 * un'ombra morbida (offset 1 px, nero al 35%, niente shadowBlur), nodo del
 * rancore, uscite e ingressi dai bordi, segni delle perline passate.
 *
 * `buildRowShape` traduce una riga (posizioni prima e dopo, incroci, eventi) in
 * tratti; `drawRow` li disegna. Il disegno usa polilinee preallocate.
 */
import type { BeadType, Crossing, LaceEvent, Side, ThreadId } from '../../core/types';
import type { ThreadVisual } from '../visuals';
import { visualOf } from '../visuals';
import { Poly, sampleCubic, sampleThread, traceCurve } from './curves';
import { drawPattern, drawThreadBody } from './patterns';
import { drawBead } from './beads';

export const SEG_STRAIGHT = 0;
export const SEG_OVER = 1;
export const SEG_UNDER = 2;

export interface SegShape {
  thread: ThreadId;
  from: number;
  to: number;
  role: 0 | 1 | 2;
  /** −1 esce a sinistra (Molo), 1 a destra (Faro), 0 resta. */
  exit: -1 | 0 | 1;
  /** −1 entra da sinistra, 1 da destra, 0 c'era già. */
  enter: -1 | 0 | 1;
  /** Annodato dalla riga prima (bloccato): più spesso e scuro. */
  knotted: boolean;
  /** Incrocio forzato annunciato (filo nero): tratteggiato e semitrasparente. */
  ghost: boolean;
}

export interface CrossShape {
  pair: number;
  over: Side;
  forced: boolean;
  knot: boolean;
  ghost: boolean;
}

export interface MarkShape {
  pair: number;
  type: BeadType;
  /** La perlina va verso la colonna di sinistra della coppia. */
  toLeft: boolean;
}

export interface RowShape {
  /** Indice della riga (1 = startHour + 1). */
  index: number;
  hour: number;
  segs: SegShape[];
  crossings: CrossShape[];
  marks: MarkShape[];
}

/** Tipo di una perlina dal suo id (quelle create dal motore comprese). */
export function beadTypeOf(types: ReadonlyMap<string, BeadType>, id: string): BeadType {
  const t = types.get(id);
  if (t) return t;
  if (id.startsWith('letta:')) return 'segreto';
  if (id === 'nome') return 'nome';
  if (id === 'febbre') return 'febbre';
  return 'voce';
}

export function buildRowShape(
  index: number,
  hour: number,
  prev: readonly ThreadId[],
  crossings: readonly Crossing[],
  next: readonly ThreadId[] | null,
  events: readonly LaceEvent[] | null,
  knotted: readonly ThreadId[],
  beadTypes: ReadonlyMap<string, BeadType>,
  ghostForced: boolean,
): RowShape {
  const W = prev.length;
  const mid = prev.slice();
  const byCol = new Array<Crossing | null>(W).fill(null);
  for (const c of crossings) {
    if (c.pair < 0 || c.pair >= W - 1) continue;
    const a = mid[c.pair] as ThreadId;
    mid[c.pair] = mid[c.pair + 1] as ThreadId;
    mid[c.pair + 1] = a;
    byCol[c.pair] = c;
    byCol[c.pair + 1] = c;
  }
  const knots = new Set<string>();
  if (events) for (const e of events) if (e.k === 'nodo') knots.add(e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`);
  const segs: SegShape[] = [];
  for (let i = 0; i < W; i++) {
    const t = prev[i] as ThreadId;
    const c = byCol[i];
    let to = i;
    let role: 0 | 1 | 2 = SEG_STRAIGHT;
    const ghost = !!(c && c.forced && ghostForced);
    if (c) {
      to = i === c.pair ? c.pair + 1 : c.pair;
      const isLeft = i === c.pair;
      role = (c.over === 'L') === isLeft ? SEG_OVER : SEG_UNDER;
    }
    let exit: -1 | 0 | 1 = 0;
    if (next && next[to] !== t) exit = to === 0 ? -1 : 1;
    segs.push({ thread: t, from: i, to, role, exit, enter: 0, knotted: knotted.includes(t), ghost });
  }
  if (next) {
    for (let j = 0; j < W; j++) {
      const t = next[j] as ThreadId;
      if (mid[j] !== t) segs.push({ thread: t, from: j, to: j, role: SEG_STRAIGHT, exit: 0, enter: j === 0 ? -1 : 1, knotted: false, ghost: false });
    }
  }
  const cs: CrossShape[] = crossings
    .filter((c) => c.pair >= 0 && c.pair < W - 1)
    .map((c) => {
      const a = prev[c.pair] as ThreadId;
      const b = prev[c.pair + 1] as ThreadId;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      return { pair: c.pair, over: c.over, forced: !!c.forced, knot: knots.has(key), ghost: !!c.forced && ghostForced };
    });
  const marks: MarkShape[] = [];
  if (events) {
    const pairOf = (x: ThreadId, y: ThreadId): number => {
      for (const c of cs) {
        const a = prev[c.pair];
        const b = prev[c.pair + 1];
        if ((a === x && b === y) || (a === y && b === x)) return c.pair;
      }
      return -1;
    };
    for (const e of events) {
      let from: ThreadId | null = null;
      let to: ThreadId | null = null;
      let type: BeadType | null = null;
      if (e.k === 'passa' || e.k === 'copia') {
        from = e.from;
        to = e.to;
        type = beadTypeOf(beadTypes, e.bead);
      } else if (e.k === 'contagio') {
        from = e.from;
        to = e.to;
        type = 'febbre';
      }
      if (!from || !to || !type) continue;
      const p = pairOf(from, to);
      if (p < 0 || marks.some((m) => m.pair === p && m.type === type)) continue;
      // Chi riceve era nella colonna di destra della coppia se il donatore era a sinistra.
      marks.push({ pair: p, type, toLeft: prev[p] === to });
    }
    for (const e of events) {
      if (e.k !== 'consegna') continue;
      const holder = e.to;
      for (const c of cs) {
        if ((prev[c.pair] === holder || prev[c.pair + 1] === holder) && !marks.some((m) => m.pair === c.pair && m.type === 'lettera')) {
          marks.push({ pair: c.pair, type: 'lettera', toLeft: prev[c.pair] === holder });
        }
      }
    }
  }
  return { index, hour, segs, crossings: cs, marks };
}

export interface RowGeom {
  colCx: readonly number[];
  colW: number;
  /** Bordi del merletto (per le uscite e gli ingressi). */
  left: number;
  right: number;
}

export interface RowStyle {
  /** Colore dell'interruzione sotto l'incrocio (il fondo della riga). */
  gap: string;
  time: number;
  /** Colore del filo fantasma del filo nero. */
  ghostAlpha: number;
  /** Disegna i segni delle perline passate. */
  marks: boolean;
}

const POOL: Poly[] = Array.from({ length: 8 }, () => new Poly());
const GHOST_DASH: number[] = [7, 5];
const NO_DASH: number[] = [];

function segPoly(p: Poly, s: SegShape, g: RowGeom, y0: number, y1: number, hour: number): Poly {
  const x0 = g.colCx[s.from] ?? 0;
  const x1 = g.colCx[s.to] ?? x0;
  const h = y1 - y0;
  if (s.enter !== 0) {
    const ex = s.enter < 0 ? g.left - 4 : g.right + 4;
    return sampleCubic(p, ex, y0 + h * 0.35, (ex + x1) / 2, y0 + h * 0.4, x1, y1 - h * 0.35, x1, y1, 12);
  }
  const yEnd = s.exit !== 0 ? y0 + h * 0.62 : y1;
  if (s.role === SEG_STRAIGHT) {
    // Ondulazione appena visibile (0,8 px), alternata fra ore e colonne.
    const w = ((hour + s.from) & 1 ? 0.8 : -0.8) * 1.6;
    return sampleCubic(p, x0, y0, x0 + w, y0 + (yEnd - y0) * 0.33, x1 - w, y0 + (yEnd - y0) * 0.66, x1, yEnd, 10);
  }
  return sampleThread(p, x0, y0, x1, yEnd, 16, 0.5);
}

function exitPoly(p: Poly, s: SegShape, g: RowGeom, y0: number, y1: number): Poly {
  const x = g.colCx[s.to] ?? 0;
  const h = y1 - y0;
  const ex = s.exit < 0 ? g.left - 4 : g.right + 4;
  return sampleCubic(p, x, y0 + h * 0.62, x, y0 + h * 0.85, (x + ex) / 2, y1 - h * 0.05, ex, y1 - h * 0.1, 12);
}

function strokeSeg(ctx: CanvasRenderingContext2D, p: Poly, v: ThreadVisual, s: SegShape, style: RowStyle, phase: number): void {
  const w = s.knotted ? v.width + 2 : v.width;
  const color = s.knotted ? v.dark : v.color;
  drawThreadBody(ctx, p, v, w, color);
  drawPattern(ctx, p, v, w, phase, style.time);
}

/**
 * Evidenzia il percorso di un filo in una riga (residuo R2, Q028): un alone d'ottone e il
 * filo ripassato nel suo colore sopra gli altri. Serve a dire quale filo sbiadito si sta
 * nominando dal pannello dell'Archivio.
 */
export function traceThreadRow(ctx: CanvasRenderingContext2D, shape: RowShape, g: RowGeom, y0: number, y1: number, thread: ThreadId, v: ThreadVisual, halo: string, alpha: number): void {
  const p = POOL[0] as Poly;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let k = 0; k < shape.segs.length; k++) {
    const s = shape.segs[k] as SegShape;
    if (s.thread !== thread || s.ghost) continue;
    for (let pass = 0; pass < 2; pass++) {
      segPoly(p, s, g, y0, y1, shape.hour);
      strokeTrace(ctx, p, pass === 0 ? halo : v.color, pass === 0 ? v.width + 8 : v.width, pass === 0 ? alpha : 1);
      if (s.exit !== 0) {
        exitPoly(p, s, g, y0, y1);
        strokeTrace(ctx, p, pass === 0 ? halo : v.color, pass === 0 ? v.width + 8 : v.width, pass === 0 ? alpha : 1);
      }
    }
  }
}

function strokeTrace(ctx: CanvasRenderingContext2D, p: Poly, color: string, width: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  traceCurve(ctx, p);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Disegna una riga di fili fra y0 e y1 (coordinate già sullo schermo o nel canvas della striscia). */
export function drawRow(ctx: CanvasRenderingContext2D, shape: RowShape, g: RowGeom, y0: number, y1: number, visuals: Map<ThreadId, ThreadVisual>, style: RowStyle): void {
  const phase = y0 < 0 ? -y0 : y0;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const p = POOL[0] as Poly;
  // 1. Tratti dritti, fili sotto, ingressi (non fantasma).
  for (let k = 0; k < shape.segs.length; k++) {
    const s = shape.segs[k] as SegShape;
    if (s.role === SEG_OVER || s.ghost) continue;
    const v = visualOf(visuals, s.thread);
    segPoly(p, s, g, y0, y1, shape.hour);
    strokeSeg(ctx, p, v, s, style, phase);
    if (s.exit !== 0) {
      ctx.globalAlpha = 0.55;
      exitPoly(p, s, g, y0, y1);
      strokeSeg(ctx, p, v, s, style, phase);
      ctx.globalAlpha = 1;
    }
  }
  // 2. Fili sopra: interruzione del filo sotto, ombra, filo.
  for (let k = 0; k < shape.segs.length; k++) {
    const s = shape.segs[k] as SegShape;
    if (s.role !== SEG_OVER || s.ghost) continue;
    const v = visualOf(visuals, s.thread);
    segPoly(p, s, g, y0, y1, shape.hour);
    const w = s.knotted ? v.width + 2 : v.width;
    ctx.strokeStyle = style.gap;
    ctx.lineWidth = w + 6;
    ctx.beginPath();
    traceCurve(ctx, p);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = w;
    ctx.beginPath();
    traceCurve(ctx, p, 1, 1);
    ctx.stroke();
    strokeSeg(ctx, p, v, s, style, phase);
    if (s.exit !== 0) {
      ctx.globalAlpha = 0.55;
      exitPoly(p, s, g, y0, y1);
      strokeSeg(ctx, p, v, s, style, phase);
      ctx.globalAlpha = 1;
    }
  }
  // 3. Incroci annunciati del filo nero: fantasma tratteggiato.
  let anyGhost = false;
  for (let k = 0; k < shape.segs.length; k++) if ((shape.segs[k] as SegShape).ghost) anyGhost = true;
  if (anyGhost) {
    ctx.globalAlpha = style.ghostAlpha;
    // Estremi piatti: con quelli tondi i tratti si toccano e il tratteggio sparisce.
    ctx.lineCap = 'butt';
    ctx.setLineDash(GHOST_DASH);
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < shape.segs.length; k++) {
        const s = shape.segs[k] as SegShape;
        if (!s.ghost || (pass === 0) !== (s.role === SEG_UNDER)) continue;
        const v = visualOf(visuals, s.thread);
        segPoly(p, s, g, y0, y1, shape.hour);
        ctx.strokeStyle = v.light;
        ctx.lineWidth = v.width;
        ctx.beginPath();
        traceCurve(ctx, p);
        ctx.stroke();
      }
    }
    ctx.setLineDash(NO_DASH);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 1;
  }
  // 4. Nodi del rancore e segni delle perline passate.
  for (let k = 0; k < shape.crossings.length; k++) {
    const c = shape.crossings[k] as CrossShape;
    const cx = ((g.colCx[c.pair] ?? 0) + (g.colCx[c.pair + 1] ?? 0)) / 2;
    const cy = (y0 + y1) / 2;
    if (c.knot) drawKnot(ctx, cx, cy);
  }
  if (style.marks) {
    for (let k = 0; k < shape.marks.length; k++) {
      const m = shape.marks[k] as MarkShape;
      const cx = ((g.colCx[m.pair] ?? 0) + (g.colCx[m.pair + 1] ?? 0)) / 2;
      const dx = (m.toLeft ? -1 : 1) * g.colW * 0.18;
      drawBead(ctx, m.type, cx + dx, y0 + (y1 - y0) * 0.62, 0.75, false);
    }
  }
}

/** Nodo del rancore: un piccolo cappio scuro sull'incrocio. */
export function drawKnot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#2B2622';
  ctx.strokeStyle = '#E8DCC4';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, 6.5, 5, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 2);
  ctx.quadraticCurveTo(x, y + 5, x + 4, y - 2);
  ctx.moveTo(x - 3, y + 3);
  ctx.lineTo(x - 7, y + 8);
  ctx.moveTo(x + 3, y + 3);
  ctx.lineTo(x + 7, y + 8);
  ctx.stroke();
}

/** Filo che pende dalla riga corrente fino al suo fuso. */
export function drawHanging(ctx: CanvasRenderingContext2D, p: Poly, v: ThreadVisual, x0: number, y0: number, x1: number, y1: number, time: number, knotted: boolean): void {
  sampleThread(p, x0, y0, x1, y1, 14, 0.45);
  const w = knotted ? v.width + 2 : v.width;
  drawThreadBody(ctx, p, v, w, knotted ? v.dark : v.color);
  drawPattern(ctx, p, v, w, y0 < 0 ? -y0 : y0, time);
}

export function poolPoly(i: number): Poly {
  return POOL[i % POOL.length] as Poly;
}
