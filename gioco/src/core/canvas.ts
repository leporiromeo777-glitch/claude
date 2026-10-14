/**
 * Canvas della scena (ARCHITETTURA 8): dimensione CSS a tutto schermo,
 * risoluzione interna css × dpr (dpr già limitato a 2) e trasformazione
 * `setTransform(dpr, 0, 0, dpr, 0, 0)`, così tutto il codice disegna in px CSS.
 */
import type { CanvasHost, Viewport } from './types';

export interface CoreCanvasHost extends CanvasHost {
  resize(vp: Viewport): void;
  /** Riempie tutto il canvas con un colore (px CSS, trasformazione già applicata). */
  fill(color: string): void;
}

export function createCanvasHost(canvas: HTMLCanvasElement, vp: Viewport): CoreCanvasHost {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D not available');
  const host: CoreCanvasHost = {
    canvas,
    ctx,
    cssW: 0,
    cssH: 0,
    dpr: 1,
    resize(v) {
      const w = Math.max(1, Math.round(v.cssW * v.dpr));
      const h = Math.max(1, Math.round(v.cssH * v.dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      host.cssW = v.cssW;
      host.cssH = v.cssH;
      host.dpr = v.dpr;
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    },
    fill(color) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },
  };
  host.resize(vp);
  return host;
}
