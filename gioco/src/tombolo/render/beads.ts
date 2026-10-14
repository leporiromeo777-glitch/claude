/**
 * Perline (GDD 3.5, 12.2): ogni tipo ha colore e forma propri.
 *   lettera  rettangolo 12×9 color carta con sigillo rosso (acceso se consegnata)
 *   voce     perla luminosa con un anello
 *   segreto  rombo nero lucido con riflesso bianco
 *   febbre   goccia verde opaca, irregolare
 *   nome     perla di madreperla con una "A", alone corallo
 * Il volo lungo la curva dell'incrocio dura 350 ms con uscita morbida (GDD 12.4).
 */
import type { BeadType, ThreadId } from '../../core/types';
import { easeOut } from './curves';

export const BEAD_COLORS = {
  lettera: '#F2EBDD',
  sigillo: '#B3261E',
  sigilloAcceso: '#FF5A3C',
  voce: '#FFF4C2',
  voceAnello: '#C9A24A',
  segreto: '#101010',
  febbre: '#7A9A3A',
  nome: '#F5EFE6',
  nomeAlone: '#F07C6C',
  oro: '#E8C66A',
  bordo: '#2B2622',
} as const;

/** Disegna una perlina centrata in (x, y); `scale` 1 = dimensioni del GDD. */
export function drawBead(ctx: CanvasRenderingContext2D, type: BeadType, x: number, y: number, scale: number, delivered: boolean): void {
  const s = scale;
  switch (type) {
    case 'lettera': {
      const w = 12 * s;
      const h = 9 * s;
      if (delivered) {
        ctx.strokeStyle = BEAD_COLORS.oro;
        ctx.lineWidth = 2;
        ctx.strokeRect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
      }
      ctx.fillStyle = BEAD_COLORS.lettera;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.strokeStyle = BEAD_COLORS.bordo;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x - w / 2, y - h / 2, w, h);
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y - h / 2);
      ctx.lineTo(x, y + h * 0.05);
      ctx.lineTo(x + w / 2, y - h / 2);
      ctx.stroke();
      ctx.fillStyle = delivered ? BEAD_COLORS.sigilloAcceso : BEAD_COLORS.sigillo;
      ctx.beginPath();
      ctx.arc(x, y + h * 0.08, 2.2 * s, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    case 'voce': {
      ctx.fillStyle = 'rgba(255,244,194,0.28)';
      ctx.beginPath();
      ctx.arc(x, y, 7 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BEAD_COLORS.voce;
      ctx.beginPath();
      ctx.arc(x, y, 3.6 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = BEAD_COLORS.voceAnello;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, 5.4 * s, 0, Math.PI * 2);
      ctx.stroke();
      return;
    }
    case 'segreto': {
      const r = 5.5 * s;
      ctx.fillStyle = BEAD_COLORS.segreto;
      ctx.strokeStyle = '#D8CCB4';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.72, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.72, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(x - r * 0.2, y - r * 0.55);
      ctx.lineTo(x + r * 0.05, y - r * 0.3);
      ctx.lineTo(x - r * 0.3, y - r * 0.15);
      ctx.closePath();
      ctx.fill();
      return;
    }
    case 'febbre': {
      const r = 4.6 * s;
      ctx.fillStyle = BEAD_COLORS.febbre;
      ctx.strokeStyle = '#3E4F1C';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.5);
      ctx.bezierCurveTo(x + r * 0.5, y - r * 0.7, x + r * 1.15, y - r * 0.1, x + r * 0.85, y + r * 0.55);
      ctx.bezierCurveTo(x + r * 0.55, y + r * 1.1, x - r * 0.75, y + r * 1.05, x - r * 0.95, y + r * 0.35);
      ctx.bezierCurveTo(x - r * 1.05, y - r * 0.2, x - r * 0.35, y - r * 0.8, x, y - r * 1.5);
      ctx.fill();
      ctx.stroke();
      return;
    }
    case 'nome': {
      ctx.fillStyle = 'rgba(240,124,108,0.35)';
      ctx.beginPath();
      ctx.arc(x, y, 7.5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = BEAD_COLORS.nome;
      ctx.beginPath();
      ctx.arc(x, y, 4.8 * s, 0, Math.PI * 2);
      ctx.fill();
      // La "A" di Ada, disegnata a tratti.
      ctx.strokeStyle = BEAD_COLORS.nomeAlone;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 2.4 * s, y + 2.6 * s);
      ctx.lineTo(x, y - 2.8 * s);
      ctx.lineTo(x + 2.4 * s, y + 2.6 * s);
      ctx.moveTo(x - 1.3 * s, y + 0.6 * s);
      ctx.lineTo(x + 1.3 * s, y + 0.6 * s);
      ctx.stroke();
      return;
    }
  }
}

/** Una perlina in volo lungo la curva dell'incrocio (pool preallocato). */
export interface Flight {
  active: boolean;
  t: number;
  dur: number;
  type: BeadType;
  bead: string;
  to: ThreadId;
  delivered: boolean;
  x0: number;
  y0: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x1: number;
  y1: number;
}

export class FlightPool {
  readonly items: Flight[];

  constructor(size = 16) {
    this.items = Array.from({ length: size }, () => ({
      active: false,
      t: 0,
      dur: 0.35,
      type: 'voce' as BeadType,
      bead: '',
      to: '',
      delivered: false,
      x0: 0,
      y0: 0,
      c1x: 0,
      c1y: 0,
      c2x: 0,
      c2y: 0,
      x1: 0,
      y1: 0,
    }));
  }

  /**
   * Lancia una perlina da (x0, y0) a (x1, y1) lungo una S verticale; con `cx`
   * la curva passa per il centro dell'incrocio (chi dà e chi riceve si incontrano lì).
   */
  launch(type: BeadType, bead: string, to: ThreadId, delivered: boolean, x0: number, y0: number, x1: number, y1: number, durS: number, cx?: number): void {
    let f = this.items.find((x) => !x.active);
    if (!f) f = this.items[0] as Flight;
    const k = (y1 - y0) * 0.5;
    f.active = true;
    f.t = 0;
    f.dur = Math.max(0.001, durS);
    f.type = type;
    f.bead = bead;
    f.to = to;
    f.delivered = delivered;
    f.x0 = x0;
    f.y0 = y0;
    f.c1x = cx ?? x0;
    f.c1y = y0 + k;
    f.c2x = cx ?? x1;
    f.c2y = y1 - k;
    f.x1 = x1;
    f.y1 = y1;
  }

  update(dt: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const f = this.items[i] as Flight;
      if (!f.active) continue;
      f.t += dt / f.dur;
      if (f.t >= 1) f.active = false;
    }
  }

  clear(): void {
    for (const f of this.items) f.active = false;
  }

  /** Una perlina di `to` è ancora in volo (non si disegna ancora nella pila). */
  flying(to: ThreadId, bead: string): boolean {
    for (let i = 0; i < this.items.length; i++) {
      const f = this.items[i] as Flight;
      if (f.active && f.to === to && f.bead === bead) return true;
    }
    return false;
  }

  any(): boolean {
    for (let i = 0; i < this.items.length; i++) if ((this.items[i] as Flight).active) return true;
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, dy: number): void {
    for (let i = 0; i < this.items.length; i++) {
      const f = this.items[i] as Flight;
      if (!f.active) continue;
      const t = easeOut(f.t);
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      const x = a * f.x0 + b * f.c1x + c * f.c2x + d * f.x1;
      const y = a * f.y0 + b * f.c1y + c * f.c2y + d * f.y1 + dy;
      drawBead(ctx, f.type, x, y, 1.1, f.delivered && f.t > 0.9);
    }
  }
}
