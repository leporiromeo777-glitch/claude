/**
 * Fondo delle schermate su canvas (GDD 12.1-12.2): velluto procedurale con
 * vignettatura e, a scelta, la luce calda di una lampada. Si compone una volta
 * in un canvas fuori schermo (alle dimensioni del dispositivo) e si ridisegna
 * solo quando serve: cambio di dimensioni, di contrasto o di tema.
 */
import type { CanvasHost } from '../core/types';
import { makeVelvetTile } from '../core/boot.scene';

export function cssColor(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m && m[1] ? Number.parseInt(m[1], 16) : 0x1c2233;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const tiles = new Map<string, HTMLCanvasElement>();

/** Tessera del velluto per un colore di base (in cache). */
export function velvetTile(base: string): HTMLCanvasElement {
  let t = tiles.get(base);
  if (!t) {
    t = makeVelvetTile(base);
    tiles.set(base, t);
  }
  return t;
}

export interface BackdropOptions {
  /** Luce calda (in frazioni della larghezza e dell'altezza). */
  glow?: { x: number; y: number; r: number; alpha: number } | null;
  /** Centro della vignettatura (frazioni). */
  center?: { x: number; y: number };
}

/** Disegna velluto e vignettatura su un contesto (px CSS). */
export function paintVelvet(ctx: CanvasRenderingContext2D, w: number, h: number, o: BackdropOptions = {}): void {
  const base = cssColor('--velluto', '#1C2233');
  const shadow = cssColor('--velluto-ombra', '#121622');
  const tile = velvetTile(base);
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.fillStyle = pattern ?? base;
  ctx.fillRect(0, 0, w, h);
  const cx = (o.center?.x ?? 0.5) * w;
  const cy = (o.center?.y ?? 0.42) * h;
  const far = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
  const vg = ctx.createRadialGradient(cx, cy, far * 0.25, cx, cy, far);
  vg.addColorStop(0, rgba(shadow, 0));
  vg.addColorStop(0.7, rgba(shadow, 0.45));
  vg.addColorStop(1, rgba(shadow, 0.9));
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  const g = o.glow;
  if (g) {
    const gx = g.x * w;
    const gy = g.y * h;
    const r = g.r * Math.max(w, h);
    const lg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    lg.addColorStop(0, `rgba(255, 178, 74, ${g.alpha})`);
    lg.addColorStop(0.45, `rgba(255, 178, 74, ${g.alpha * 0.35})`);
    lg.addColorStop(1, 'rgba(255, 178, 74, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
}

export class Backdrop {
  private cache: HTMLCanvasElement | null = null;
  private key = '';
  private dirty = true;

  constructor(private readonly opts: BackdropOptions = {}) {}

  invalidate(): void {
    this.dirty = true;
  }

  /** Ridisegna il fondo se è cambiato qualcosa (o se `force`). */
  draw(host: CanvasHost, force = false): void {
    const key = `${host.canvas.width}x${host.canvas.height}@${host.dpr}|${document.documentElement.dataset.contrast ?? ''}`;
    if (!force && !this.dirty && key === this.key) return;
    if (!this.cache || key !== this.key || this.dirty) {
      const c = this.cache ?? document.createElement('canvas');
      c.width = host.canvas.width;
      c.height = host.canvas.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.setTransform(host.dpr, 0, 0, host.dpr, 0, 0);
        paintVelvet(ctx, host.cssW, host.cssH, this.opts);
      }
      this.cache = c;
      this.key = key;
    }
    this.dirty = false;
    const ctx = host.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.cache, 0, 0);
    ctx.restore();
  }
}
