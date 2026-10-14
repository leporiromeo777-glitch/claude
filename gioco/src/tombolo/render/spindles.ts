/**
 * Fusi (GDD 10.3, 12.4): pendono sotto la riga corrente, uno per colonna.
 * Sprite dall'atlas (`fuso/<id>`; segnaposto disegnato se manca), icona del
 * personaggio disegnata in codice sopra la testa. Pendolo con molla smorzata
 * (rigidità 40, smorzamento 6) quando si prendono, si lasciano o si incrociano;
 * scambio di colonna animato (250 ms a 1×), rimbalzo sul rifiuto (200 ms).
 * Con il movimento ridotto niente dondolio e niente scorrimenti.
 */
import type { AssetStore, SpriteFrame, ThreadId } from '../../core/types';
import { drawGlyph } from '../../core/ui/glyphs';
import type { ThreadVisual } from '../visuals';
import { visualOf } from '../visuals';
import { easeInOut } from './curves';

export const SPRING_K = 40;
export const SPRING_C = 6;
const MAX_ANGLE = 0.6;
const MAX_VEL = 2.5;

export interface SpindleState {
  thread: ThreadId;
  col: number;
  x: number;
  fromX: number;
  toX: number;
  t: number;
  dur: number;
  angle: number;
  vel: number;
  dragging: boolean;
  /** Rimbalzo: 0 → nessuno; avanza fino a 1. */
  bounceT: number;
  bounceDx: number;
  frame: SpriteFrame | null;
  frameName: string;
}

export interface SpindleDrawOptions {
  /** Il filo ha una stranezza nota (icona sul fuso). */
  quirk(thread: ThreadId): boolean;
  /** Etichetta sotto la testa (Archivio: nome provvisorio). */
  label(thread: ThreadId): string | null;
  /** Fusi evidenziati (cursore della tastiera, passaggio del nome). */
  highlight: ReadonlySet<ThreadId>;
  /** Pulsazione (0-1) per gli evidenziati. */
  pulse: number;
  /** Filo con il nome di Ada (perla sul fuso). */
  nomeOn: ThreadId | null;
}

export class SpindleRig {
  private readonly map = new Map<ThreadId, SpindleState>();
  /** Fusi visibili, nell'ordine delle colonne. */
  readonly order: SpindleState[] = [];
  reduced = false;
  /** Larghezze delle etichette già misurate (nessuna misura a ogni fotogramma). */
  private readonly labelWidth = new Map<string, number>();

  get(thread: ThreadId): SpindleState | undefined {
    return this.map.get(thread);
  }

  /** Assegna i fili alle colonne (posizioni dopo la bozza). Animato se `durS` > 0. */
  assign(threads: readonly ThreadId[], colCx: readonly number[], durS: number, assets: AssetStore | null, visuals: Map<ThreadId, ThreadVisual>): void {
    this.order.length = 0;
    const seen = new Set<ThreadId>();
    threads.forEach((t, col) => {
      seen.add(t);
      const x = colCx[col] ?? 0;
      let s = this.map.get(t);
      const v = visualOf(visuals, t);
      if (!s) {
        s = { thread: t, col, x, fromX: x, toX: x, t: 1, dur: 0, angle: 0, vel: 0, dragging: false, bounceT: 0, bounceDx: 0, frame: null, frameName: '' };
        this.map.set(t, s);
      }
      if (s.frameName !== v.spindle || !s.frame) {
        s.frameName = v.spindle;
        s.frame = assets ? assets.frame(v.spindle) : null;
      }
      const moved = s.col !== col || Math.abs(s.toX - x) > 0.5;
      s.col = col;
      if (moved && !s.dragging) {
        if (durS > 0 && !this.reduced) {
          s.fromX = s.x;
          s.toX = x;
          s.t = 0;
          s.dur = durS;
          s.vel += (x > s.x ? -1 : 1) * 1.4;
        } else {
          s.x = s.toX = s.fromX = x;
          s.t = 1;
        }
      } else if (moved) {
        s.toX = x;
      }
      this.order.push(s);
    });
    for (const k of [...this.map.keys()]) if (!seen.has(k)) this.map.delete(k);
  }

  /** Ricarica gli sprite (per esempio dopo il caricamento dell'atlas). */
  refreshFrames(assets: AssetStore | null): void {
    for (const s of this.map.values()) s.frame = assets ? assets.frame(s.frameName) : null;
  }

  startDrag(thread: ThreadId): void {
    const s = this.map.get(thread);
    if (!s) return;
    s.dragging = true;
    s.vel += 1.2;
  }

  dragTo(thread: ThreadId, x: number): void {
    const s = this.map.get(thread);
    if (!s) return;
    const dx = x - s.x;
    s.x = x;
    if (!this.reduced) s.vel -= dx * 0.02;
  }

  /** Fine del trascinamento: il fuso torna (animato) alla sua colonna. */
  endDrag(thread: ThreadId, durS: number): void {
    const s = this.map.get(thread);
    if (!s) return;
    s.dragging = false;
    s.fromX = s.x;
    s.t = durS > 0 && !this.reduced ? 0 : 1;
    s.dur = durS;
    if (s.t >= 1) s.x = s.toX;
    s.vel -= 1;
  }

  /** Rimbalzo sul rifiuto: il fuso va verso il vicino e torna. */
  bounce(thread: ThreadId, dir: number, colW: number): void {
    const s = this.map.get(thread);
    if (!s) return;
    s.dragging = false;
    s.fromX = s.x;
    s.t = this.reduced ? 1 : 0;
    s.dur = 0.2;
    if (this.reduced) s.x = s.toX;
    s.bounceT = this.reduced ? 0 : 0.0001;
    s.bounceDx = dir * colW * 0.18;
    s.vel += dir * 2.2;
  }

  kick(thread: ThreadId, v: number): void {
    const s = this.map.get(thread);
    if (s) s.vel += v;
  }

  /** dt in secondi; `speed` = velocità delle animazioni (0 = istantanea). */
  update(dt: number, speed: number): boolean {
    let busy = false;
    for (let i = 0; i < this.order.length; i++) {
      const s = this.order[i] as SpindleState;
      if (!s.dragging && s.t < 1) {
        s.t = speed <= 0 || s.dur <= 0 ? 1 : Math.min(1, s.t + (dt * speed) / s.dur);
        s.x = s.fromX + (s.toX - s.fromX) * easeInOut(s.t);
        busy = true;
      }
      if (s.bounceT > 0) {
        s.bounceT = speed <= 0 ? 0 : s.bounceT + (dt * speed) / 0.2;
        if (s.bounceT >= 1) s.bounceT = 0;
        busy = true;
      }
      if (this.reduced) {
        s.angle = 0;
        s.vel = 0;
        continue;
      }
      // Pendolo con molla smorzata: θ'' = −k θ − c θ'.
      const acc = -SPRING_K * s.angle - SPRING_C * s.vel;
      s.vel += acc * dt;
      // Spinte che si sommano (righe automatiche in fila): il dondolio resta misurato.
      if (s.vel > MAX_VEL) s.vel = MAX_VEL;
      else if (s.vel < -MAX_VEL) s.vel = -MAX_VEL;
      s.angle += s.vel * dt;
      if (s.angle > MAX_ANGLE) s.angle = MAX_ANGLE;
      else if (s.angle < -MAX_ANGLE) s.angle = -MAX_ANGLE;
      if (Math.abs(s.angle) > 0.001 || Math.abs(s.vel) > 0.001) busy = true;
    }
    return busy;
  }

  /** Posizione x attuale (con il rimbalzo). */
  xOf(s: SpindleState): number {
    if (s.bounceT > 0) return s.x + s.bounceDx * Math.sin(Math.PI * s.bounceT);
    return s.x;
  }

  draw(ctx: CanvasRenderingContext2D, top: number, w: number, h: number, visuals: Map<ThreadId, ThreadVisual>, o: SpindleDrawOptions): void {
    for (let i = 0; i < this.order.length; i++) {
      const s = this.order[i] as SpindleState;
      const v = visualOf(visuals, s.thread);
      const x = this.xOf(s);
      const f = s.frame;
      const ax = f ? f.ax : 0.5;
      const ay = f ? f.ay : 0.05;
      ctx.save();
      ctx.translate(x, top);
      ctx.rotate(s.angle);
      if (o.highlight.has(s.thread)) {
        ctx.strokeStyle = '#C9A24A';
        ctx.globalAlpha = 0.45 + 0.45 * o.pulse;
        ctx.lineWidth = 3;
        ctx.strokeRect(-w * ax - 5, -h * ay - 3, w + 10, h + 4);
        ctx.globalAlpha = 1;
      }
      if (f && f.sw > 0 && f.sh > 0) ctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, -w * ax, -h * ay, w, h);
      else {
        ctx.fillStyle = '#B89B72';
        ctx.fillRect(-w * 0.2, 0, w * 0.4, h * 0.9);
      }
      // Fascia del colore del filo sul fuso (anche con gli sprite: il filo avvolto è del suo colore).
      ctx.fillStyle = v.color;
      ctx.fillRect(-w * 0.22, h * (0.3 - ay), w * 0.44, 3);
      const headY = h * (0.12 - ay);
      if (v.icon) drawGlyph(ctx, v.icon, 0, headY, 14, '#2B2622', 2);
      if (o.quirk(s.thread)) {
        ctx.fillStyle = '#C9A24A';
        ctx.beginPath();
        ctx.arc(w * 0.42, h * (0.24 - ay), 6.5, 0, Math.PI * 2);
        ctx.fill();
        drawGlyph(ctx, 'info', w * 0.42, h * (0.24 - ay), 11, '#1A1610', 2);
      }
      if (o.nomeOn === s.thread) {
        ctx.fillStyle = 'rgba(240,124,108,0.5)';
        ctx.beginPath();
        ctx.arc(-w * 0.42, h * (0.24 - ay), 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F5EFE6';
        ctx.beginPath();
        ctx.arc(-w * 0.42, h * (0.24 - ay), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      const label = o.label(s.thread);
      if (label) {
        ctx.font = LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(237,228,211,0.92)';
        let mw = this.labelWidth.get(label);
        if (mw === undefined) {
          mw = ctx.measureText(label).width;
          this.labelWidth.set(label, mw);
        }
        const tw = Math.min(w * 1.5, mw + 8);
        ctx.fillRect(x - tw / 2, top + h * 0.62, tw, 16);
        ctx.fillStyle = '#6B4A2F';
        ctx.fillText(label, x, top + h * 0.62 + 8, w * 1.5 - 6);
      }
    }
  }
}

const LABEL_FONT = "italic 12px 'Caveat', 'EB Garamond', cursive";
