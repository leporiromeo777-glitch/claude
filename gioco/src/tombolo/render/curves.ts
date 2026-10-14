/**
 * Curve dei fili: Bézier cubiche campionate in polilinee preallocate.
 * Nessuna allocazione dopo la creazione: le polilinee si riusano a ogni
 * fotogramma (ARCHITETTURA 16).
 */

export const POLY_MAX = 48;

/** Polilinea con lunghezze cumulate (per i motivi lungo il filo). */
export class Poly {
  readonly xs = new Float32Array(POLY_MAX);
  readonly ys = new Float32Array(POLY_MAX);
  readonly len = new Float32Array(POLY_MAX);
  n = 0;
  /** Curva di origine (per i tratti lisci con bezierCurveTo). */
  x0 = 0;
  y0 = 0;
  c1x = 0;
  c1y = 0;
  c2x = 0;
  c2y = 0;
  x1 = 0;
  y1 = 0;

  total(): number {
    return this.n > 0 ? (this.len[this.n - 1] as number) : 0;
  }
}

/** Punto e tangente unitaria su una polilinea (riusato). */
export interface PolyPoint {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export function newPoint(): PolyPoint {
  return { x: 0, y: 0, tx: 0, ty: 1 };
}

/** Campiona la cubica (x0,y0)-(c1)-(c2)-(x1,y1) in `n` punti dentro `p`. */
export function sampleCubic(p: Poly, x0: number, y0: number, c1x: number, c1y: number, c2x: number, c2y: number, x1: number, y1: number, n = 16): Poly {
  const m = Math.max(2, Math.min(POLY_MAX, n | 0));
  p.x0 = x0;
  p.y0 = y0;
  p.c1x = c1x;
  p.c1y = c1y;
  p.c2x = c2x;
  p.c2y = c2y;
  p.x1 = x1;
  p.y1 = y1;
  let acc = 0;
  let px = x0;
  let py = y0;
  for (let i = 0; i < m; i++) {
    const t = i / (m - 1);
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    const x = a * x0 + b * c1x + c * c2x + d * x1;
    const y = a * y0 + b * c1y + c * c2y + d * y1;
    if (i > 0) acc += Math.hypot(x - px, y - py);
    p.xs[i] = x;
    p.ys[i] = y;
    p.len[i] = acc;
    px = x;
    py = y;
  }
  p.n = m;
  return p;
}

/** Curva del filo fra due punti: verticale con le tangenti verticali (S fra due colonne). */
export function sampleThread(p: Poly, x0: number, y0: number, x1: number, y1: number, n = 16, bend = 0.5): Poly {
  const k = (y1 - y0) * bend;
  return sampleCubic(p, x0, y0, x0, y0 + k, x1, y1 - k, x1, y1, n);
}

/** Punto alla distanza `s` lungo la polilinea. */
export function pointAt(p: Poly, s: number, out: PolyPoint): PolyPoint {
  const n = p.n;
  if (n < 2) {
    out.x = p.xs[0] ?? 0;
    out.y = p.ys[0] ?? 0;
    out.tx = 0;
    out.ty = 1;
    return out;
  }
  const total = p.len[n - 1] as number;
  const d = s <= 0 ? 0 : s >= total ? total : s;
  let i = 1;
  while (i < n - 1 && (p.len[i] as number) < d) i++;
  const l0 = p.len[i - 1] as number;
  const l1 = p.len[i] as number;
  const f = l1 > l0 ? (d - l0) / (l1 - l0) : 0;
  const ax = p.xs[i - 1] as number;
  const ay = p.ys[i - 1] as number;
  const bx = p.xs[i] as number;
  const by = p.ys[i] as number;
  out.x = ax + (bx - ax) * f;
  out.y = ay + (by - ay) * f;
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy) || 1;
  out.tx = dx / L;
  out.ty = dy / L;
  return out;
}

/** Traccia la curva d'origine (liscia) nel percorso corrente, spostata di (ox, oy). */
export function traceCurve(ctx: CanvasRenderingContext2D, p: Poly, ox = 0, oy = 0): void {
  ctx.moveTo(p.x0 + ox, p.y0 + oy);
  ctx.bezierCurveTo(p.c1x + ox, p.c1y + oy, p.c2x + ox, p.c2y + oy, p.x1 + ox, p.y1 + oy);
}

/** Traccia la polilinea, spostata di `off` lungo la normale (sinistra della direzione). */
export function tracePoly(ctx: CanvasRenderingContext2D, p: Poly, off = 0): void {
  if (p.n < 2) return;
  for (let i = 0; i < p.n; i++) {
    const j = i === 0 ? 1 : i;
    const dx = (p.xs[j] as number) - (p.xs[j - 1] as number);
    const dy = (p.ys[j] as number) - (p.ys[j - 1] as number);
    const L = Math.hypot(dx, dy) || 1;
    const nx = dy / L;
    const ny = -dx / L;
    const x = (p.xs[i] as number) + nx * off;
    const y = (p.ys[i] as number) + ny * off;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

/** Interpolazione con uscita morbida. */
export function easeOut(t: number): number {
  const u = 1 - (t < 0 ? 0 : t > 1 ? 1 : t);
  return 1 - u * u * u;
}

export function easeInOut(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
