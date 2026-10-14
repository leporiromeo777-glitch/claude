/**
 * Spilli (GDD 3.7, 12.3): testa sferica (ottone, rosso, verde) con riflesso,
 * gambo corto, nella cella (colonna, ora); icona del personaggio sulla testa.
 * Spillo rispettato: brilla. Irraggiungibile: barrato in `--errore` con un "!"
 * e l'ora (mai solo colore). Le teste sono disegnate una volta in piccoli
 * canvas fuori schermo (niente gradienti a ogni fotogramma).
 */
import { drawGlyph } from '../../core/ui/glyphs';

export type PinKind = 'ottone' | 'rosso' | 'verde';
export type PinState = 'normale' | 'acceso' | 'irraggiungibile' | 'fatto' | 'fallito' | 'ombra';

export const PIN_COLORS: Readonly<Record<PinKind, { base: string; light: string; dark: string }>> = {
  ottone: { base: '#C9A24A', light: '#F4DE9A', dark: '#7A5E1E' },
  rosso: { base: '#C8372D', light: '#F49A8E', dark: '#6E1712' },
  verde: { base: '#4E9A5B', light: '#A6DDB0', dark: '#21492A' },
};
export const ERRORE = '#E0604F';

/** Raggio della testa dello spillo (px CSS). */
export const PIN_R = 8;
const SPRITE_SCALE = 2;

export type CanvasMaker = (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas;

export function defaultCanvasMaker(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  return new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
}

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export class PinSprites {
  private readonly heads = new Map<PinKind, HTMLCanvasElement | OffscreenCanvas>();

  constructor(make: CanvasMaker = defaultCanvasMaker) {
    for (const k of ['ottone', 'rosso', 'verde'] as PinKind[]) {
      const size = (PIN_R * 2 + 4) * SPRITE_SCALE;
      const cv = make(size, size);
      const ctx = cv.getContext('2d') as Ctx2D | null;
      if (ctx) {
        const c = PIN_COLORS[k];
        const r = PIN_R * SPRITE_SCALE;
        const cx = size / 2;
        const g = ctx.createRadialGradient(cx - r * 0.35, cx - r * 0.35, r * 0.1, cx, cx, r);
        g.addColorStop(0, c.light);
        g.addColorStop(0.45, c.base);
        g.addColorStop(1, c.dark);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cx, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.38, cx - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      this.heads.set(k, cv);
    }
  }

  /**
   * Spillo nella cella: (x, y) è il punto dove il filo deve passare; la testa sta
   * appena sopra a destra, il gambo scende al punto.
   */
  draw(ctx: CanvasRenderingContext2D, kind: PinKind, state: PinState, x: number, y: number, icon: string | null, hourLabel: string | null): void {
    const hx = x + 9;
    const hy = y - 11;
    const c = PIN_COLORS[kind];
    if (state === 'ombra') {
      ctx.strokeStyle = 'rgba(78,154,91,0.75)';
      ctx.setLineDash(DASH);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, PIN_R + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      if (icon) drawGlyph(ctx, icon, x, y, 11, 'rgba(166,221,176,0.9)', 1.4);
      return;
    }
    if (state === 'acceso' || state === 'fatto') {
      ctx.fillStyle = kind === 'ottone' ? 'rgba(244,222,154,0.35)' : kind === 'verde' ? 'rgba(166,221,176,0.35)' : 'rgba(244,154,142,0.35)';
      ctx.beginPath();
      ctx.arc(hx, hy, PIN_R + 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Gambo.
    ctx.strokeStyle = '#D9D2C2';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(x + 1, y);
    ctx.stroke();
    const head = this.heads.get(kind);
    const size = PIN_R * 2 + 4;
    if (head) ctx.drawImage(head, hx - size / 2, hy - size / 2, size, size);
    else {
      ctx.fillStyle = c.base;
      ctx.beginPath();
      ctx.arc(hx, hy, PIN_R, 0, Math.PI * 2);
      ctx.fill();
    }
    if (icon) drawGlyph(ctx, icon, hx, hy, 10, '#1A1610', 1.7);
    if (state === 'fatto') {
      drawGlyph(ctx, 'spunta', hx + 10, hy - 6, 10, '#A6DDB0', 2.2);
    }
    if (state === 'irraggiungibile' || state === 'fallito') {
      ctx.strokeStyle = ERRORE;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(hx - PIN_R - 2, hy + PIN_R + 2);
      ctx.lineTo(hx + PIN_R + 2, hy - PIN_R - 2);
      ctx.stroke();
      // "!" disegnato (niente testo).
      const bx = hx + PIN_R + 6;
      ctx.fillStyle = ERRORE;
      ctx.fillRect(bx - 1.2, hy - 8, 2.4, 7);
      ctx.beginPath();
      ctx.arc(bx, hy + 2.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (hourLabel) {
        ctx.font = HOUR_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(hourLabel, bx + 4, hy - 2);
      }
    }
  }
}

/**
 * Slot di un'occasione (TOM-15): al centro della cella, su un fondo pieno così il
 * filo non copre l'icona del tipo; `ombra` = da piantare (bordo tratteggiato),
 * altrimenti piantata (spillo verde pieno).
 */
export function drawSlot(ctx: CanvasRenderingContext2D, state: PinState, x: number, y: number, r: number, icon: string | null): void {
  const planted = state !== 'ombra';
  ctx.fillStyle = planted ? '#2F6B3B' : 'rgba(18,22,34,0.92)';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = planted ? 2.5 : 2;
  ctx.strokeStyle = planted ? '#A6DDB0' : 'rgba(166,221,176,0.95)';
  if (!planted) ctx.setLineDash(DASH);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  if (icon) drawGlyph(ctx, icon, x, y, Math.round(r * 1.15), planted ? '#F3EEE4' : '#A6DDB0', 1.8);
}

const DASH: number[] = [3, 3];
const NO_DASH: number[] = [];
const HOUR_FONT = "bold 11px 'Atkinson Hyperlegible', system-ui, sans-serif";
