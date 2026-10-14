/**
 * Cache delle righe fissate (GDD 12.3, ARCHITETTURA 16): strisce fuori schermo
 * da 8 righe. Una striscia si ridisegna solo quando cambiano le sue righe
 * (firma per riga); se si aggiungono righe in fondo si disegnano solo quelle.
 * A ogni fotogramma si copiano al più 3 strisce con drawImage.
 */
import { rowBottom, rowTop } from '../layout';
import { type CanvasMaker, defaultCanvasMaker } from './pins';

export const STRIP_ROWS = 8;

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

interface Strip {
  canvas: AnyCanvas | null;
  /** Firme delle righe disegnate (indice di riga globale → firma). */
  sigs: string[];
  y0: number;
  h: number;
  /** Il contenuto non vale più: si ricomincia da una striscia vuota. */
  stale: boolean;
}

/** Disegna le righe [from, to) nella striscia; y = 0 è il bordo alto della riga `from`. */
export type RowPainter = (ctx: CanvasRenderingContext2D, from: number, to: number, originY: number) => void;

export class StripCache {
  private strips: Strip[] = [];
  private w = 0;
  private dpr = 1;
  private key = '';
  /** Quante volte una striscia è stata ridisegnata (per i test). */
  redraws = 0;

  constructor(private readonly make: CanvasMaker = defaultCanvasMaker) {}

  /** Nuove dimensioni: le strisce si ricreano solo se cambia qualcosa. */
  configure(width: number, dpr: number, rowH: number, openH: number, rows: number): void {
    const key = `${width}|${dpr}|${rowH}|${openH}|${rows}`;
    if (key === this.key) return;
    this.key = key;
    this.w = width;
    this.dpr = dpr;
    const n = Math.ceil((rows + 1) / STRIP_ROWS);
    this.strips = [];
    for (let s = 0; s < n; s++) {
      const first = s * STRIP_ROWS;
      const last = Math.min(rows, first + STRIP_ROWS - 1);
      const dims = { rowH, openH };
      const y0 = rowTop(dims, first);
      const h = rowBottom(dims, last) - y0;
      this.strips.push({ canvas: null, sigs: [], y0, h, stale: true });
    }
  }

  invalidateAll(): void {
    for (const s of this.strips) {
      s.sigs = [];
      s.stale = true;
    }
  }

  /**
   * Copia le strisce visibili. `sigs[i]` è la firma della riga i (0 = apertura)
   * per le righe fissate; le righe senza firma non si disegnano.
   * `offsetY` è la y sullo schermo del bordo alto del contenuto.
   */
  draw(ctx: CanvasRenderingContext2D, x: number, offsetY: number, clipTop: number, clipBottom: number, sigs: readonly string[], paint: RowPainter): void {
    for (let si = 0; si < this.strips.length; si++) {
      const st = this.strips[si] as Strip;
      const y = offsetY + st.y0;
      if (y + st.h < clipTop || y > clipBottom) continue;
      const first = si * STRIP_ROWS;
      const last = first + STRIP_ROWS;
      this.ensure(st, first, last, sigs, paint);
      if (st.canvas && st.sigs.length > 0) ctx.drawImage(st.canvas, x, y, this.w, st.h);
    }
  }

  private ensure(st: Strip, first: number, last: number, sigs: readonly string[], paint: RowPainter): void {
    // Righe fissate che stanno in questa striscia.
    let n = 0;
    for (let i = first; i < last && i < sigs.length; i++) n++;
    let same = !st.stale && st.sigs.length <= n;
    if (same) for (let k = 0; k < st.sigs.length; k++) if (st.sigs[k] !== sigs[first + k]) same = false;
    if (same && st.sigs.length === n) return;
    st.stale = false;
    if (!st.canvas) st.canvas = this.make(Math.max(1, Math.round(this.w * this.dpr)), Math.max(1, Math.round(st.h * this.dpr)));
    const ctx = st.canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (!ctx) return;
    let from = first + st.sigs.length;
    if (!same) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
      st.sigs = [];
      from = first;
    }
    const to = first + n;
    if (to > from) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      paint(ctx, from, to, -st.y0);
      this.redraws++;
    }
    st.sigs = sigs.slice(first, to) as string[];
  }
}
