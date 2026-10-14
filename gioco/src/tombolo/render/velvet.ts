/**
 * Velluto procedurale (GDD 12.3): rumore a due ottave in una tessera 256×256
 * ripetuta sul colore `--velluto`, vignettatura radiale. Generato una volta
 * (la tessera) e a ogni cambio di dimensioni (il fondo intero): a ogni
 * fotogramma si copia con un solo drawImage.
 */
import { rngFromSeed } from '../../core/rng';
import { type CanvasMaker, defaultCanvasMaker } from './pins';

export const TILE = 256;

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/** Rumore di valore su una griglia periodica (si ripete senza giunture). */
function valueNoise(size: number, cells: number, rnd: () => number): Float32Array {
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rnd();
  const out = new Float32Array(size * size);
  const step = size / cells;
  for (let y = 0; y < size; y++) {
    const gy = y / step;
    const y0 = Math.floor(gy) % cells;
    const y1 = (y0 + 1) % cells;
    const fy = gy - Math.floor(gy);
    const sy = fy * fy * (3 - 2 * fy);
    for (let x = 0; x < size; x++) {
      const gx = x / step;
      const x0 = Math.floor(gx) % cells;
      const x1 = (x0 + 1) % cells;
      const fx = gx - Math.floor(gx);
      const sx = fx * fx * (3 - 2 * fx);
      const a = grid[y0 * cells + x0] as number;
      const b = grid[y0 * cells + x1] as number;
      const c = grid[y1 * cells + x0] as number;
      const d = grid[y1 * cells + x1] as number;
      out[y * size + x] = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
    }
  }
  return out;
}

/** Valori del rumore (0-1) della tessera: due ottave (32 e 64 celle) più un filo di grana. */
export function velvetNoise(seed = 'velluto'): Float32Array {
  const rnd = rngFromSeed(seed);
  const a = valueNoise(TILE, 32, rnd);
  const b = valueNoise(TILE, 64, rnd);
  const out = new Float32Array(TILE * TILE);
  for (let i = 0; i < out.length; i++) out[i] = (a[i] as number) * 0.62 + (b[i] as number) * 0.38;
  return out;
}

function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m && m[1] ? Number.parseInt(m[1], 16) : 0x1c2233;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Tessera del velluto: il colore base modulato dal rumore. */
export function makeVelvetTile(base: string, make: CanvasMaker = defaultCanvasMaker, noise = velvetNoise()): AnyCanvas {
  const cv = make(TILE, TILE);
  const ctx = cv.getContext('2d') as Ctx2D | null;
  if (!ctx) return cv;
  const [r, g, b] = parseHex(base);
  const img = ctx.createImageData(TILE, TILE);
  const d = img.data;
  for (let i = 0; i < TILE * TILE; i++) {
    const n = (noise[i] as number) - 0.5;
    const k = 1 + n * 0.32;
    d[i * 4] = Math.max(0, Math.min(255, r * k + n * 6));
    d[i * 4 + 1] = Math.max(0, Math.min(255, g * k + n * 6));
    d[i * 4 + 2] = Math.max(0, Math.min(255, b * k + n * 8));
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export class Velvet {
  private tile: AnyCanvas | null = null;
  private tileColor = '';
  private bg: AnyCanvas | null = null;
  private kw = -1;
  private kh = -1;
  private kdpr = -1;
  private kbase = '';
  private kshadow = '';
  private readonly noise: Float32Array;

  constructor(private readonly make: CanvasMaker = defaultCanvasMaker) {
    this.noise = velvetNoise();
  }

  /** Fondo intero (w×h px CSS a risoluzione dpr). Ricreato solo se cambia qualcosa. */
  background(w: number, h: number, dpr: number, base: string, shadow: string): AnyCanvas | null {
    // Confronto campo per campo: nessuna stringa costruita a ogni fotogramma.
    if (this.bg && w === this.kw && h === this.kh && dpr === this.kdpr && base === this.kbase && shadow === this.kshadow) return this.bg;
    if (!this.tile || this.tileColor !== base) {
      this.tile = makeVelvetTile(base, this.make, this.noise);
      this.tileColor = base;
    }
    const W = Math.max(1, Math.round(w * dpr));
    const H = Math.max(1, Math.round(h * dpr));
    const cv = this.make(W, H);
    const ctx = cv.getContext('2d') as Ctx2D | null;
    if (!ctx) return null;
    const pat = ctx.createPattern(this.tile as CanvasImageSource, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);
    }
    // Vignettatura radiale verso il velluto in ombra.
    const g = ctx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.25, W / 2, H * 0.5, Math.hypot(W, H) * 0.62);
    const [r, gg, b] = parseHex(shadow);
    g.addColorStop(0, `rgba(${r},${gg},${b},0)`);
    g.addColorStop(1, `rgba(${r},${gg},${b},0.85)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    this.bg = cv;
    this.kw = w;
    this.kh = h;
    this.kdpr = dpr;
    this.kbase = base;
    this.kshadow = shadow;
    return cv;
  }
}
