/**
 * Il quadro del titolo (GDD 9 "Il tombolo alla luce di una lampada a olio, un
 * fuso che dondola"; GDD 10.3 "render del tombolo sul cavalletto"):
 *
 * - velluto con vignettatura e l'ombra del cavalletto sul pavimento;
 * - il tombolo (`obj/tombolo`, 1024², o il segnaposto del core);
 * - la luce calda di una lampada fuori campo, in alto a sinistra, che tremola;
 * - granelli di polvere che salgono piano nella luce;
 * - il fuso di Ada (o il fuso intagliato scelto) appeso al suo filo corallo che
 *   dondola come un pendolo.
 *
 * Le parti fisse si compongono una volta in canvas fuori schermo (alla
 * risoluzione del dispositivo); a ogni fotogramma si copiano e si disegnano
 * solo luce, polvere e fuso. Con il movimento ridotto il quadro è fermo.
 */
import type { CanvasHost, Services, SpriteFrame } from '../core/types';
import { rngFromSeed } from '../core/rng';
import { cssColor, paintVelvet, rgba } from './backdrop';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MOTES = 26;
const LAMP = '#FFB24A';

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export interface TitleGeometry {
  /** Lato del tombolo (px CSS) e suo angolo in alto a sinistra. */
  size: number;
  x: number;
  y: number;
  /** Lampada (centro della luce) e raggio. */
  lampX: number;
  lampY: number;
  lampR: number;
  /** Perno del fuso, lunghezza del filo e altezza del fuso. */
  pivotX: number;
  pivotY: number;
  thread: number;
  spindleH: number;
  /** Il fuso si disegna (non con un palco troppo piccolo). */
  showSpindle: boolean;
}

/**
 * Geometria del quadro: il tombolo è il quadrato più grande che sta nel palco;
 * il fuso pende dall'alto dello schermo sul lato destro del palco (o fra palco
 * e colonna dei menu nel layout orizzontale), senza coprire il titolo (`avoid`):
 * se accanto al titolo non c'è posto, il filo parte da sotto il titolo. Con un
 * palco piccolo (testo grande su un telefono basso) il fuso non c'è.
 */
export function titleGeometry(stage: Rect, viewW: number, viewH: number, landscape: boolean, avoid: Rect | null = null): TitleGeometry {
  const size = Math.max(40, Math.min(stage.w, stage.h));
  const x = stage.x + (stage.w - size) / 2;
  const y = stage.y + (stage.h - size) / 2;
  const spindleH = Math.max(70, Math.min(size * 0.34, viewH * 0.24, 210));
  const half = spindleH * 0.15 + 6;
  let pivotX: number;
  let pivotY = -8;
  if (landscape) {
    // Fra il menu e il tombolo: dal lato del tombolo rivolto verso il centro dello schermo.
    const stageOnRight = stage.x + stage.w / 2 > viewW / 2;
    pivotX = stageOnRight ? Math.max(spindleH * 0.2, x - size * 0.01) : Math.min(viewW - spindleH * 0.2, x + size * 1.01);
  } else {
    pivotX = Math.min(viewW - Math.max(14, half), Math.max(x + size * 0.93, viewW * 0.86));
    if (avoid && pivotX + half > avoid.x && pivotX - half < avoid.x + avoid.w) {
      const right = avoid.x + avoid.w;
      if (viewW - right >= half * 2 + 8) pivotX = Math.min(viewW - half, right + (viewW - right) / 2);
      else pivotY = avoid.y + avoid.h + 4;
    }
  }
  // Il fuso arriva poco sotto il bordo alto del tombolo, accanto al tamburo.
  const bottom = Math.max(y + size * 0.42, pivotY + spindleH + 24);
  const thread = Math.max(16, bottom - spindleH - pivotY);
  return {
    size,
    x,
    y,
    lampX: x + size * 0.1,
    lampY: y + size * 0.04,
    lampR: size * 0.95,
    pivotX,
    pivotY,
    thread,
    spindleH,
    showSpindle: size >= 170,
  };
}

export class TitleArt {
  private stage: Rect = { x: 0, y: 0, w: 1, h: 1 };
  private avoid: Rect | null = null;
  private landscape = false;
  private geo: TitleGeometry | null = null;
  private bg: HTMLCanvasElement | null = null;
  private sprite: HTMLCanvasElement | null = null;
  private glow: HTMLCanvasElement | null = null;
  private spindle: HTMLCanvasElement | null = null;
  private spindleAnchor = { x: 0, y: 0 };
  private key = '';
  private dirty = true;
  private time = 0;
  private fade = 0;
  private readonly fadeSeconds: number;
  private readonly mx = new Float32Array(MOTES);
  private readonly my = new Float32Array(MOTES);
  private readonly mv = new Float32Array(MOTES);
  private readonly mp = new Float32Array(MOTES);
  private readonly ms = new Float32Array(MOTES);
  private readonly rnd = rngFromSeed('trama:polvere');
  private threadColor = '#F07C6C';
  private still = false;
  private drawnStill = false;

  constructor(
    private readonly s: Services,
    o: { fadeSeconds: number },
  ) {
    this.fadeSeconds = o.fadeSeconds;
    for (let i = 0; i < MOTES; i++) this.spawn(i, true);
  }

  /** Frame del fuso: quello intagliato scelto, se c'è, o quello di Ada. */
  private spindleFrame(): SpriteFrame {
    const sel = this.s.save.data().unlocks.selectedCosmetic;
    if (sel && /^stile_\d+$/.test(sel) && this.s.assets.has(`fuso/${sel}`)) return this.s.assets.frame(`fuso/${sel}`);
    return this.s.assets.frame('fuso/ada');
  }

  /** Palco del tombolo e (facoltativo) rettangolo del titolo da non coprire, in px CSS. */
  setStage(stage: Rect, landscape: boolean, avoid: Rect | null = null): void {
    const near = (a: Rect | null, b: Rect | null): boolean =>
      a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5);
    if (near(stage, this.stage) && near(avoid, this.avoid) && landscape === this.landscape) return;
    this.stage = { ...stage };
    this.avoid = avoid ? { ...avoid } : null;
    this.landscape = landscape;
    this.dirty = true;
  }

  invalidate(): void {
    this.dirty = true;
  }

  /** Movimento fermo (movimento ridotto o velocità istantanea). */
  setStill(on: boolean): void {
    if (on !== this.still) {
      this.still = on;
      this.drawnStill = false;
      if (on) this.fade = 1;
    }
  }

  /** Il quadro è comparso del tutto? */
  shown(): boolean {
    return this.fade >= 1;
  }

  geometry(): TitleGeometry | null {
    return this.geo;
  }

  /** Angolo del fuso (radianti): un pendolo con l'ampiezza che respira piano. */
  swing(t: number): number {
    if (this.still) return 0;
    const amp = (4.2 + 1.8 * Math.sin((t * Math.PI * 2) / 23)) * (Math.PI / 180);
    return amp * Math.sin((t * Math.PI * 2) / 3.4);
  }

  /** Luce della lampada (fattore 0-1) con un tremolio irregolare. */
  flicker(t: number): number {
    if (this.still) return 0.92;
    return 0.88 + 0.05 * Math.sin(t * 7.3) + 0.035 * Math.sin(t * 13.1 + 1.3) + 0.025 * Math.sin(t * 2.9 + 0.4);
  }

  private spawn(i: number, anywhere: boolean): void {
    const r = this.rnd;
    this.mx[i] = r() * 2 - 1;
    this.my[i] = anywhere ? r() * 2 - 1 : 0.85 + r() * 0.15;
    this.mv[i] = 0.012 + r() * 0.03;
    this.mp[i] = r() * Math.PI * 2;
    this.ms[i] = 0.6 + r() * 1.3;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.fade < 1) this.fade = this.fadeSeconds <= 0 ? 1 : Math.min(1, this.fade + dt / this.fadeSeconds);
    if (this.still) return;
    for (let i = 0; i < MOTES; i++) {
      this.my[i] = (this.my[i] as number) - (this.mv[i] as number) * dt;
      this.mx[i] = (this.mx[i] as number) + Math.sin(this.time * 0.6 + (this.mp[i] as number)) * 0.004 * dt;
      const x = this.mx[i] as number;
      const y = this.my[i] as number;
      if (y < -1 || x * x + y * y > 1.05) this.spawn(i, false);
    }
  }

  private rebuild(host: CanvasHost): void {
    const dpr = host.dpr;
    const W = host.cssW;
    const H = host.cssH;
    const g = titleGeometry(this.stage, W, H, this.landscape, this.avoid);
    this.geo = g;
    this.threadColor = this.s.content.characters.get('ada')?.color ?? '#F07C6C';
    const contrast = document.documentElement.dataset.contrast === 'alto';

    // Fondo: velluto, vignettatura centrata sul tombolo, ombra del cavalletto.
    const bg = this.bg ?? makeCanvas(1, 1);
    bg.width = host.canvas.width;
    bg.height = host.canvas.height;
    const bctx = bg.getContext('2d');
    if (bctx) {
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintVelvet(bctx, W, H, { center: { x: (g.x + g.size / 2) / W, y: (g.y + g.size * 0.45) / H } });
      // Pozza di luce sul velluto dietro il tombolo.
      const pool = bctx.createRadialGradient(g.lampX, g.lampY + g.size * 0.35, 0, g.lampX, g.lampY + g.size * 0.35, g.size * 0.9);
      pool.addColorStop(0, rgba(LAMP, contrast ? 0.05 : 0.11));
      pool.addColorStop(1, rgba(LAMP, 0));
      bctx.fillStyle = pool;
      bctx.fillRect(0, 0, W, H);
      // Ombra del cavalletto sul pavimento.
      const fy = g.y + g.size * 0.9;
      bctx.save();
      bctx.translate(g.x + g.size * 0.52, fy);
      bctx.scale(1, 0.16);
      const sh = bctx.createRadialGradient(0, 0, 0, 0, 0, g.size * 0.5);
      sh.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
      sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
      bctx.fillStyle = sh;
      bctx.beginPath();
      bctx.arc(0, 0, g.size * 0.5, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }
    this.bg = bg;

    // Tombolo già scalato (un drawImage 1:1 a ogni fotogramma).
    const f = this.s.assets.frame('obj/tombolo');
    const side = Math.max(1, Math.round(g.size * dpr));
    const sp = this.sprite ?? makeCanvas(1, 1);
    sp.width = side;
    sp.height = side;
    const sctx = sp.getContext('2d');
    if (sctx) {
      sctx.clearRect(0, 0, side, side);
      sctx.imageSmoothingEnabled = true;
      sctx.imageSmoothingQuality = 'high';
      const k = Math.min(side / Math.max(1, f.sw), side / Math.max(1, f.sh));
      const w = f.sw * k;
      const h = f.sh * k;
      sctx.drawImage(f.source, f.sx, f.sy, f.sw, f.sh, (side - w) / 2, (side - h) / 2, w, h);
      // Un velo d'ombra dal lato lontano dalla lampada (luce di teatro).
      const shade = sctx.createLinearGradient(0, 0, side, side * 0.6);
      shade.addColorStop(0, 'rgba(18, 22, 34, 0)');
      shade.addColorStop(1, `rgba(18, 22, 34, ${contrast ? 0.1 : 0.32})`);
      sctx.globalCompositeOperation = 'source-atop';
      sctx.fillStyle = shade;
      sctx.fillRect(0, 0, side, side);
      sctx.globalCompositeOperation = 'source-over';
    }
    this.sprite = sp;

    // Luce della lampada: gradiente radiale in un canvas quadrato (si somma con 'lighter').
    const gr = Math.max(1, Math.round(g.lampR * dpr));
    const gl = this.glow ?? makeCanvas(1, 1);
    gl.width = gr * 2;
    gl.height = gr * 2;
    const gctx = gl.getContext('2d');
    if (gctx) {
      gctx.clearRect(0, 0, gr * 2, gr * 2);
      const lg = gctx.createRadialGradient(gr, gr, 0, gr, gr, gr);
      const a = contrast ? 0.12 : 0.3;
      lg.addColorStop(0, rgba(LAMP, a));
      lg.addColorStop(0.35, rgba(LAMP, a * 0.42));
      lg.addColorStop(0.7, rgba(LAMP, a * 0.1));
      lg.addColorStop(1, rgba(LAMP, 0));
      gctx.fillStyle = lg;
      gctx.fillRect(0, 0, gr * 2, gr * 2);
    }
    this.glow = gl;

    // Fuso già scalato, con il punto d'attacco del filo.
    const sf = this.spindleFrame();
    const sh = Math.max(1, Math.round(g.spindleH * dpr));
    const sw = Math.max(1, Math.round((sf.sw / Math.max(1, sf.sh)) * sh));
    const spc = this.spindle ?? makeCanvas(1, 1);
    spc.width = sw;
    spc.height = sh;
    const fctx = spc.getContext('2d');
    if (fctx) {
      fctx.clearRect(0, 0, sw, sh);
      fctx.imageSmoothingEnabled = true;
      fctx.imageSmoothingQuality = 'high';
      fctx.drawImage(sf.source, sf.sx, sf.sy, sf.sw, sf.sh, 0, 0, sw, sh);
    }
    this.spindle = spc;
    this.spindleAnchor = { x: sf.ax * (sw / dpr), y: sf.ay * (sh / dpr) };
    this.key = `${host.canvas.width}x${host.canvas.height}`;
    this.dirty = false;
  }

  render(host: CanvasHost): void {
    const key = `${host.canvas.width}x${host.canvas.height}`;
    if (this.dirty || key !== this.key || !this.bg) {
      this.rebuild(host);
      this.drawnStill = false;
    }
    // Quadro fermo e già disegnato: niente da rifare.
    if (this.still && this.drawnStill) return;
    const g = this.geo;
    const ctx = host.ctx;
    const dpr = host.dpr;
    if (!g || !this.bg || !this.sprite || !this.glow || !this.spindle) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.restore();
    const ease = this.fade * this.fade * (3 - 2 * this.fade);
    ctx.save();
    ctx.globalAlpha = ease;
    // Tombolo.
    ctx.drawImage(this.sprite, g.x, g.y, g.size, g.size);
    // Luce della lampada.
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = ease * this.flicker(this.time);
    ctx.drawImage(this.glow, g.lampX - g.lampR, g.lampY - g.lampR, g.lampR * 2, g.lampR * 2);
    // Polvere nella luce.
    if (!this.still) {
      ctx.fillStyle = '#FFE2B8';
      const R = g.lampR * 0.55;
      for (let i = 0; i < MOTES; i++) {
        const tw = 0.5 + 0.5 * Math.sin(this.time * 1.7 + (this.mp[i] as number) * 3);
        ctx.globalAlpha = ease * (0.12 + 0.45 * tw) * this.flicker(this.time);
        const s = this.ms[i] as number;
        const px = g.lampX + (this.mx[i] as number) * R + g.size * 0.18;
        const py = g.lampY + (this.my[i] as number) * R + g.size * 0.3;
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ease;
    // Fuso che dondola.
    if (!g.showSpindle) {
      ctx.restore();
      if (this.still && this.fade >= 1) this.drawnStill = true;
      return;
    }
    const a = this.swing(this.time);
    ctx.translate(g.pivotX, g.pivotY);
    ctx.rotate(a);
    ctx.strokeStyle = this.threadColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, g.thread);
    ctx.stroke();
    // Riflesso sul filo.
    ctx.strokeStyle = 'rgba(255, 236, 220, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-0.6, 0);
    ctx.lineTo(-0.6, g.thread);
    ctx.stroke();
    const sw = this.spindle.width / dpr;
    const sh = this.spindle.height / dpr;
    ctx.drawImage(this.spindle, -this.spindleAnchor.x, g.thread - this.spindleAnchor.y, sw, sh);
    ctx.restore();
    if (this.still && this.fade >= 1) this.drawnStill = true;
  }

  /** Colori letti dal tema (per il debug). */
  palette(): { velluto: string; ottone: string } {
    return { velluto: cssColor('--velluto', '#1C2233'), ottone: cssColor('--ottone', '#C9A24A') };
  }
}
