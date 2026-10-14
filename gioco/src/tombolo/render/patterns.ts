/**
 * I 12 motivi dei fili (GDD 12.3, 14): ogni filo si distingue per colore,
 * motivo e icona. Il motivo si disegna lungo la polilinea del filo, a passi di
 * lunghezza d'arco, con il colore `ink` del filo.
 *
 *   righe       tratti obliqui a 45° ogni 6 px, marcati  (Teresa)
 *   puntini     puntini ogni 9 px                        (Marta)
 *   doppio      due linee da 2,5 px                      (Don Piero)
 *   onde        sinusoide lunga (16 px, ampiezza 2,6 px)  (Gino)
 *
 * Righe e onde sono più marcate (D06, P034): Gino e Teresa vicini si distinguono
 * anche in bianco e nero, senza cambiare i colori, che sono del personaggio.
 *   zigzag      zig-zag                                  (Bepi)
 *   tratteggio  tratteggio lungo                         (Nina)
 *   catenella   piccole ellissi                          (Zeno)
 *   croce       piccole x                                (Lunardi)
 *   lucido      riflesso che scorre lentamente           (Livia)
 *   perlato     perline ogni 12 px                       (Ada)
 *   liscio      nessun disegno, filo pieno con la luce   (Clotilde)
 *   nessuno     filo sottile, nessun disegno             (lino)
 *
 * Niente allocazioni: un solo punto di lavoro riusato.
 */
import type { ThreadPattern } from '../../core/types';
import type { ThreadVisual } from '../visuals';
import { type Poly, newPoint, pointAt, traceCurve, tracePoly } from './curves';

const P = newPoint();
const Q = newPoint();

/** Passo di ogni motivo lungo il filo (px). */
export const PATTERN_STEP: Readonly<Record<ThreadPattern, number>> = {
  righe: 6,
  puntini: 9,
  doppio: 0,
  onde: 2,
  zigzag: 5,
  tratteggio: 12,
  catenella: 7,
  croce: 8,
  lucido: 0,
  perlato: 12,
  liscio: 0,
  nessuno: 0,
};

/** Spessore dei tratti obliqui di Teresa e dell'onda di Gino, e ampiezza dell'onda (D06). */
export const RIGHE_W = 2;
export const ONDE_W = 1.8;
export const ONDE_A = 2.6;

const DASH_LONG: number[] = [7, 5];
const NO_DASH: number[] = [];

/** Corpo del filo: bordo (alto contrasto), colore base e linea di luce. */
export function drawThreadBody(ctx: CanvasRenderingContext2D, p: Poly, v: ThreadVisual, width: number, color: string): void {
  if (p.n < 2) return;
  if (v.edge) {
    ctx.strokeStyle = v.edge;
    ctx.lineWidth = width + 2;
    ctx.beginPath();
    traceCurve(ctx, p);
    ctx.stroke();
  }
  if (v.pattern === 'doppio') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    tracePoly(ctx, p, -1.9);
    ctx.stroke();
    ctx.beginPath();
    tracePoly(ctx, p, 1.9);
    ctx.stroke();
    return;
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  traceCurve(ctx, p);
  ctx.stroke();
  if (v.pattern !== 'nessuno' || width >= 3) {
    ctx.strokeStyle = v.light;
    ctx.lineWidth = 1;
    ctx.beginPath();
    traceCurve(ctx, p, -1, 0);
    ctx.stroke();
  }
}

/**
 * Motivo lungo il filo. `phase` sposta l'inizio (continuità fra le righe),
 * `time` (secondi) fa scorrere il riflesso del filo lucido.
 */
export function drawPattern(ctx: CanvasRenderingContext2D, p: Poly, v: ThreadVisual, width: number, phase: number, time: number): void {
  const total = p.total();
  if (total < 1) return;
  const half = width / 2;
  ctx.strokeStyle = v.ink;
  ctx.fillStyle = v.ink;
  switch (v.pattern) {
    case 'righe': {
      ctx.lineWidth = RIGHE_W;
      ctx.beginPath();
      for (let s = (6 - (phase % 6)) % 6; s <= total; s += 6) {
        pointAt(p, s, P);
        const nx = P.ty;
        const ny = -P.tx;
        // Tratto a 45° fra i due bordi del filo.
        ctx.moveTo(P.x + nx * half - P.tx * half, P.y + ny * half - P.ty * half);
        ctx.lineTo(P.x - nx * half + P.tx * half, P.y - ny * half + P.ty * half);
      }
      ctx.stroke();
      return;
    }
    case 'puntini': {
      ctx.beginPath();
      for (let s = (9 - (phase % 9)) % 9; s <= total; s += 9) {
        pointAt(p, s, P);
        ctx.moveTo(P.x + 1.5, P.y);
        ctx.arc(P.x, P.y, 1.5, 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
    case 'onde': {
      ctx.lineWidth = ONDE_W;
      ctx.beginPath();
      let first = true;
      for (let s = 0; s <= total; s += 2) {
        pointAt(p, s, P);
        // Onda morbida e lunga (16 px): non si confonde con lo zig-zag.
        const a = Math.sin(((s + phase) / 16) * Math.PI * 2) * ONDE_A;
        const x = P.x + P.ty * a;
        const y = P.y - P.tx * a;
        if (first) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        first = false;
      }
      ctx.stroke();
      return;
    }
    case 'zigzag': {
      ctx.lineWidth = 1.4;
      ctx.lineJoin = 'miter';
      ctx.beginPath();
      let k = Math.floor(phase / 5);
      let first = true;
      for (let s = 0; s <= total; s += 5) {
        pointAt(p, s, P);
        const a = (k++ & 1 ? 1 : -1) * half * 0.9;
        const x = P.x + P.ty * a;
        const y = P.y - P.tx * a;
        if (first) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        first = false;
      }
      ctx.stroke();
      ctx.lineJoin = 'round';
      return;
    }
    case 'tratteggio': {
      ctx.lineWidth = 2;
      ctx.setLineDash(DASH_LONG);
      ctx.lineDashOffset = -phase;
      ctx.beginPath();
      tracePoly(ctx, p, 0);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      ctx.lineDashOffset = 0;
      return;
    }
    case 'catenella': {
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = (7 - (phase % 7)) % 7; s <= total; s += 7) {
        pointAt(p, s, P);
        const rot = Math.atan2(P.ty, P.tx);
        ctx.moveTo(P.x + Math.cos(rot) * 2.8, P.y + Math.sin(rot) * 2.8);
        ctx.ellipse(P.x, P.y, 2.8, 1.6, rot, 0, Math.PI * 2);
      }
      ctx.stroke();
      return;
    }
    case 'croce': {
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let s = (8 - (phase % 8)) % 8; s <= total; s += 8) {
        pointAt(p, s, P);
        const r = 1.9;
        ctx.moveTo(P.x - r, P.y - r);
        ctx.lineTo(P.x + r, P.y + r);
        ctx.moveTo(P.x + r, P.y - r);
        ctx.lineTo(P.x - r, P.y + r);
      }
      ctx.stroke();
      return;
    }
    case 'lucido': {
      // Riflesso che scorre lentamente lungo il filo nero di seppia.
      const period = 70;
      const run = (time * 18 + phase) % period;
      ctx.lineWidth = 2;
      ctx.strokeStyle = v.light;
      ctx.beginPath();
      for (let s = run - period; s <= total; s += period) {
        const a = s < 0 ? 0 : s;
        const b = s + 16 > total ? total : s + 16;
        if (b <= a) continue;
        pointAt(p, a, P);
        pointAt(p, b, Q);
        ctx.moveTo(P.x - 0.8, P.y);
        ctx.lineTo(Q.x - 0.8, Q.y);
      }
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = v.ink;
      ctx.beginPath();
      traceCurve(ctx, p, 1.2, 0);
      ctx.stroke();
      return;
    }
    case 'perlato': {
      ctx.fillStyle = v.ink;
      ctx.beginPath();
      for (let s = (12 - (phase % 12)) % 12; s <= total; s += 12) {
        pointAt(p, s, P);
        ctx.moveTo(P.x + 2.4, P.y);
        ctx.arc(P.x, P.y, 2.4, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      for (let s = (12 - (phase % 12)) % 12; s <= total; s += 12) {
        pointAt(p, s, P);
        ctx.moveTo(P.x - 0.4, P.y - 0.8);
        ctx.arc(P.x - 0.8, P.y - 0.8, 0.7, 0, Math.PI * 2);
      }
      ctx.fill();
      return;
    }
    case 'doppio':
    case 'liscio':
    case 'nessuno':
      return;
  }
}

/** Filo completo: corpo e motivo. */
export function drawThread(ctx: CanvasRenderingContext2D, p: Poly, v: ThreadVisual, phase: number, time: number, widthOverride?: number, colorOverride?: string): void {
  const w = widthOverride ?? v.width;
  drawThreadBody(ctx, p, v, w, colorOverride ?? v.color);
  drawPattern(ctx, p, v, w, phase, time);
}
