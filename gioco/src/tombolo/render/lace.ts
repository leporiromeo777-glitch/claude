/**
 * Disegno di un fotogramma del tombolo (GDD 10.3, 12.3, ARCHITETTURA 16).
 *
 * Ordine: velluto (un drawImage) → fascia della riga corrente → strisce delle
 * righe fissate (cache) → riga corrente (bozza e fantasma del filo nero) → velo
 * sulle righe future → marea, bordi, spilli, evidenze → fili che pendono fino ai
 * fusi, perline, voli → fusi → mano del tutorial.
 *
 * Niente allocazioni nel ciclo: il modello (render/model.ts) si ricalcola solo
 * quando la notte cambia; qui si leggono campi e si disegna.
 */
import type { AssetStore, Crossing, Side, ThreadId } from '../../core/types';
import type { TomboloLayout } from '../layout';
import { SLOT_R, rowBottom, rowTop, slotCenter } from '../layout';
import { visualOf } from '../visuals';
import type { LaceModel, StackView } from './model';
import { StripCache } from './cache';
import { type CanvasMaker, defaultCanvasMaker, drawSlot, pinHeadOffset, PinSprites } from './pins';
import { Velvet } from './velvet';
import { type RowGeom, type RowStyle, drawHanging, drawKnot, drawRow, poolPoly } from './threads';
import { drawBead, FlightPool } from './beads';
import { type SpindleDrawOptions, SpindleRig } from './spindles';
import { Poly, sampleThread, traceCurve } from './curves';

export interface Palette {
  velluto: string;
  vellutoLuce: string;
  vellutoOmbra: string;
  ottone: string;
  testo: string;
  testoTenue: string;
  errore: string;
  laguna: string;
}

export const DEFAULT_PALETTE: Palette = {
  velluto: '#1C2233',
  vellutoLuce: '#2A3247',
  vellutoOmbra: '#121622',
  ottone: '#C9A24A',
  testo: '#F3EEE4',
  testoTenue: '#B9B3A6',
  errore: '#E0604F',
  laguna: '#7F918C',
};

/** Stato dell'interfaccia sopra il merletto (cambia spesso, ma senza allocazioni). */
export interface Overlay {
  /** Pulsazione 0-1 (tutorial, cursore, passaggio del nome). */
  pulse: number;
  time: number;
  /** Riga e colonna evidenziate da un suggerimento (−1 = nessuna). */
  hintRow: number;
  hintCol: number;
  /** Incrocio fantasma del suggerimento (il primo; −1 = nessuno). */
  ghostPair: number;
  ghostOver: Side;
  /** Tutti gli incroci fantasma della riga (R2-D1: il Fantasma mostra la riga intera). */
  ghosts: Crossing[];
  /** Anteprima di una riga passata (riavvolgimento), −1 = nessuna. */
  previewRow: number;
  previewStacks: StackView[] | null;
  /** Cursore della tastiera (coppia), −1 = nascosto. */
  cursorPair: number;
  /** Cursore della tastiera su un fuso quando si nomina (TOM-19), −1 = nascosto. */
  cursorCol: number;
  /** Mano fantasma del tutorial: da colonna a colonna (−1 = nascosta). */
  handFrom: number;
  handTo: number;
  /** Passaggio "Appunta il tuo nome". */
  nameStep: boolean;
  /** Echi da toccare (Archivio). */
  showEchoes: boolean;
  quirk: (thread: ThreadId) => boolean;
  /** Il filo è in rancore (segno del nodo sulla testa del fuso). */
  rancor: (thread: ThreadId) => boolean;
  label: (thread: ThreadId) => string | null;
  highlight: Set<ThreadId>;
  nomeOn: ThreadId | null;
  /** Tutorial (C02): barca della riga che pulsa (−1 = nessuna). */
  pulseEdge: number;
  /** Tutorial: spillo d'ottone che pulsa (colonna e riga, −1 = nessuno). */
  pulsePinCol: number;
  pulsePinIndex: number;
  /** Tutorial: colonne allagate che pulsano, dalla riga indicata (−1 = no). */
  pulseTideFrom: number;
  /** Chiusura speciale in corso (C11 nodo, C12 apparizione del filo nero), con il suo avanzamento 0-1. */
  ending: { kind: 'nodo' | 'apparizione'; p: number; fade: boolean; hour: string; side: -1 | 1; passi: number } | null;
}

export function emptyOverlay(): Overlay {
  return {
    pulse: 0,
    time: 0,
    hintRow: -1,
    hintCol: -1,
    ghostPair: -1,
    ghostOver: 'L',
    ghosts: [],
    previewRow: -1,
    previewStacks: null,
    cursorPair: -1,
    cursorCol: -1,
    handFrom: -1,
    handTo: -1,
    nameStep: false,
    showEchoes: false,
    quirk: () => false,
    rancor: () => false,
    label: () => null,
    highlight: new Set(),
    nomeOn: null,
    pulseEdge: -1,
    pulsePinCol: -1,
    pulsePinIndex: -1,
    pulseTideFrom: -1,
    ending: null,
  };
}

/** Corpo dei numeri delle ore (13 px, 15 px quello corrente), scalato sul desktop grande (D06). */
export function hourLabelPx(k: number, current: boolean): number {
  return Math.round((current ? 15 : 13) * k);
}
function labelFont(k: number, current: boolean): string {
  return `${current ? 'bold ' : ''}${hourLabelPx(k, current)}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
}
/** Durata a 1× del nodo e del riavvolgimento (s), per le fasi del disegno (C11). */
const ENDING_NODO = 2.3;
const GHOST_DASH: number[] = [8, 6];
const NO_DASH: number[] = [];
const TORN_DASH: number[] = [10, 4];

export class LaceRenderer {
  readonly cache: StripCache;
  readonly velvet: Velvet;
  readonly pins: PinSprites;
  readonly rig = new SpindleRig();
  readonly flights = new FlightPool(16);
  palette: Palette = DEFAULT_PALETTE;
  private readonly geom: { colCx: number[]; colW: number; left: number; right: number } = { colCx: [], colW: 52, left: 0, right: 0 };
  private readonly style: RowStyle = { gap: DEFAULT_PALETTE.velluto, time: 0, ghostAlpha: 0.55, marks: true };
  private readonly fixedStyle: RowStyle = { gap: DEFAULT_PALETTE.velluto, time: 0, ghostAlpha: 0.55, marks: true };
  private readonly handPoly = new Poly();
  private readonly spindleOpts: SpindleDrawOptions = { quirk: () => false, rancor: () => false, label: () => null, highlight: new Set(), pulse: 0, nomeOn: null };
  private paintModel: LaceModel | null = null;
  private paintLayout: TomboloLayout | null = null;
  /** Tempo del fotogramma (per il tremito delle lettere). */
  private frameTime = 0;

  constructor(make: CanvasMaker = defaultCanvasMaker) {
    this.cache = new StripCache(make);
    this.velvet = new Velvet(make);
    this.pins = new PinSprites(make);
  }

  /** Nuove dimensioni o nuovo merletto: geometria e cache. */
  configure(l: TomboloLayout, dpr: number): void {
    this.geom.colCx = l.colCx.slice();
    this.geom.colW = l.colW;
    this.geom.left = (l.colX[0] ?? 0) - 2;
    this.geom.right = (l.colX[l.cols - 1] ?? 0) + l.colW + 2;
    this.cache.configure(l.center.w, dpr, l.rowH, l.openH, l.rows);
  }

  setPalette(p: Palette): void {
    if (p.velluto !== this.palette.velluto) this.cache.invalidateAll();
    this.palette = p;
    this.style.gap = p.vellutoLuce;
    this.fixedStyle.gap = p.velluto;
  }

  /** Righe [from, to) nella striscia (coordinate del contenuto spostate di originY). */
  private readonly paintRows = (ctx: CanvasRenderingContext2D, from: number, to: number, originY: number): void => {
    const m = this.paintModel;
    const l = this.paintLayout;
    if (!m || !l) return;
    const dx = -l.center.x;
    ctx.save();
    ctx.translate(dx, originY);
    const g = this.geom as RowGeom;
    for (let i = from; i < to; i++) {
      const y0 = rowTop(l, i);
      const y1 = rowBottom(l, i);
      if (i === 0) {
        // Apertura: i fili partono dalla cima del tombolo.
        const p = poolPoly(1);
        for (let c = 0; c < m.openPos.length; c++) {
          const t = m.openPos[c] as ThreadId;
          const v = visualOf(m.visuals, t);
          const x = g.colCx[c] ?? 0;
          sampleThread(p, x, y0 + 6, x, y1, 6, 0.5);
          ctx.lineCap = 'round';
          ctx.strokeStyle = v.color;
          ctx.lineWidth = v.width;
          ctx.beginPath();
          traceCurve(ctx, p);
          ctx.stroke();
          ctx.fillStyle = '#D9D2C2';
          ctx.beginPath();
          ctx.arc(x, y0 + 5, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        const shape = m.rowShapes[i - 1];
        if (shape) drawRow(ctx, shape, g, y0, y1, m.visuals, this.fixedStyle);
      }
      this.hourLabel(ctx, l, m, i, y0, y1, false);
    }
    ctx.restore();
  };

  private hourLabel(ctx: CanvasRenderingContext2D, l: TomboloLayout, m: LaceModel, i: number, y0: number, y1: number, current: boolean): void {
    const s = m.hourLabels[i];
    if (!s) return;
    ctx.font = labelFont(l.scale ?? 1, current);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = current ? this.palette.ottone : this.palette.testoTenue;
    ctx.fillText(s, l.gutterCx, i === 0 ? (y0 + y1) / 2 : y1 - Math.min(10, (y1 - y0) * 0.22));
  }

  draw(ctx: CanvasRenderingContext2D, cssW: number, cssH: number, dpr: number, l: TomboloLayout, m: LaceModel, scroll: number, o: Overlay, assets: AssetStore | null): void {
    const P = this.palette;
    const bg = this.velvet.background(cssW, cssH, dpr, P.velluto, P.vellutoOmbra);
    if (bg) ctx.drawImage(bg as CanvasImageSource, 0, 0, cssW, cssH);
    else {
      ctx.fillStyle = P.velluto;
      ctx.fillRect(0, 0, cssW, cssH);
    }
    this.style.time = o.time;
    this.fixedStyle.time = 0;
    this.frameTime = o.time;
    const lace = l.lace;
    const top = lace.y - scroll;
    const g = this.geom as RowGeom;

    ctx.save();
    ctx.beginPath();
    ctx.rect(l.center.x, lace.y, l.center.w, lace.h);
    ctx.clip();

    // Fascia della riga corrente.
    const cur = m.current;
    if (!m.done) {
      ctx.fillStyle = P.vellutoLuce;
      ctx.fillRect(l.center.x, top + rowTop(l, cur), l.center.w, l.rowH);
    }
    // Righe fissate dalla cache.
    this.paintModel = m;
    this.paintLayout = l;
    this.cache.draw(ctx, l.center.x, top, lace.y, lace.y + lace.h, m.rowSigs, this.paintRows);

    // Righe future (velate) ed etichette delle ore non fissate.
    if (!m.done) {
      for (let i = cur; i <= m.rows; i++) {
        const y0 = top + rowTop(l, i);
        if (y0 > lace.y + lace.h) break;
        this.hourLabel(ctx, l, m, i, y0, y0 + l.rowH, i === cur);
      }
    }
    // Marea (acqua alta) e bordi.
    for (let k = 0; k < m.tide.length; k++) {
      const t = m.tide[k] as LaceModel['tide'][number];
      const x = l.colX[t.col] ?? 0;
      const y0 = top + rowTop(l, t.from);
      const y1 = top + rowBottom(l, t.to);
      ctx.fillStyle = 'rgba(127,145,140,0.28)';
      ctx.fillRect(x + 2, y0, l.colW - 4, y1 - y0);
      ctx.strokeStyle = 'rgba(200,220,215,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let yy = y0 + 8; yy < y1; yy += 12) {
        ctx.moveTo(x + 6, yy);
        ctx.quadraticCurveTo(x + l.colW / 4, yy - 3, x + l.colW / 2, yy);
        ctx.quadraticCurveTo(x + (3 * l.colW) / 4, yy + 3, x + l.colW - 6, yy);
      }
      ctx.stroke();
      // Tutorial (C02): le colonne allagate pulsano dalla riga indicata.
      if (o.pulseTideFrom >= 0 && t.to >= o.pulseTideFrom) {
        ctx.strokeStyle = P.ottone;
        ctx.globalAlpha = 0.35 + 0.55 * o.pulse;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 2, y0, l.colW - 4, y1 - y0);
        ctx.globalAlpha = 1;
      }
    }
    for (let k = 0; k < m.edges.length; k++) {
      const e = m.edges[k] as LaceModel['edges'][number];
      const y = top + rowBottom(l, e.index) - l.rowH * 0.25;
      const x = edgeX(l, e.side);
      drawBoat(ctx, x, y, e.kind, e.side, P);
      if (o.pulseEdge >= 0 && e.index === o.pulseEdge) pulseRing(ctx, x, y, 13, o.pulse, P.ottone);
    }
    // Riga corrente: bozza, forzati, fantasma del filo nero.
    if (!m.done && m.liveShape) {
      const y0 = top + rowTop(l, cur);
      drawRow(ctx, m.liveShape, g, y0, y0 + l.rowH, m.visuals, this.style);
    }
    // Archivio: le righe registrate dopo la riga corrente (il merletto antico,
    // sotto il velo) e il segno sfrangiato degli strappi da rammendare.
    for (let k = 0; k < m.recorded.length; k++) {
      const shape = m.recorded[k] as LaceModel['recorded'][number];
      const y0 = top + rowTop(l, shape.index);
      if (y0 > lace.y + lace.h || y0 + l.rowH < lace.y) continue;
      drawRow(ctx, shape, g, y0, y0 + l.rowH, m.visuals, this.fixedStyle);
    }
    for (let k = 0; k < m.torn.length; k++) {
      const t = m.torn[k] as LaceModel['torn'][number];
      this.tornEdge(ctx, l, top + rowTop(l, t.from));
      this.tornEdge(ctx, l, top + rowBottom(l, t.to));
    }
    // Velo sulle righe future (dopo la riga corrente).
    if (!m.done) {
      const vy = top + rowBottom(l, cur);
      if (vy < lace.y + lace.h) {
        ctx.fillStyle = 'rgba(18,22,34,0.42)';
        ctx.fillRect(l.center.x, vy, l.center.w, lace.y + lace.h - vy);
      }
    }
    // Evidenze dei suggerimenti.
    if (o.hintRow >= 1) {
      const y0 = top + rowTop(l, o.hintRow);
      ctx.strokeStyle = P.ottone;
      ctx.globalAlpha = 0.5 + 0.4 * o.pulse;
      ctx.lineWidth = 2;
      ctx.strokeRect(l.center.x + 2, y0 + 1, l.center.w - 4, l.rowH - 2);
      if (o.hintCol >= 0) ctx.strokeRect((l.colX[o.hintCol] ?? 0) + 2, y0 + 3, l.colW * (o.ghostPair >= 0 ? 2 : 1) - 4, l.rowH - 6);
      ctx.globalAlpha = 1;
    }
    if ((o.ghostPair >= 0 || o.ghosts.length > 0) && !m.done) {
      const y0 = top + rowTop(l, cur);
      const list: readonly Crossing[] = o.ghosts.length > 0 ? o.ghosts : [{ pair: o.ghostPair, over: o.ghostOver }];
      const p = poolPoly(2);
      ctx.lineCap = 'butt';
      ctx.setLineDash(GHOST_DASH);
      ctx.strokeStyle = P.ottone;
      ctx.globalAlpha = 0.85;
      for (const gc of list) {
        const xa = g.colCx[gc.pair] ?? 0;
        const xb = g.colCx[gc.pair + 1] ?? 0;
        // Prima il filo sotto, poi quello sopra.
        const overLeft = gc.over === 'L';
        ctx.lineWidth = 4;
        sampleThread(p, overLeft ? xb : xa, y0 + 2, overLeft ? xa : xb, y0 + l.rowH - 2, 12, 0.5);
        ctx.beginPath();
        traceCurve(ctx, p);
        ctx.stroke();
        sampleThread(p, overLeft ? xa : xb, y0 + 2, overLeft ? xb : xa, y0 + l.rowH - 2, 12, 0.5);
        ctx.lineWidth = 6;
        ctx.beginPath();
        traceCurve(ctx, p);
        ctx.stroke();
      }
      ctx.setLineDash(NO_DASH);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 1;
    }
    // Anteprima del riavvolgimento: si spegne tutto quello che viene dopo.
    if (o.previewRow >= 0) {
      const y1 = top + rowBottom(l, o.previewRow);
      const y0 = top + rowTop(l, o.previewRow);
      ctx.fillStyle = 'rgba(12,14,22,0.62)';
      ctx.fillRect(l.center.x, y1, l.center.w, lace.y + lace.h - y1);
      ctx.strokeStyle = P.ottone;
      ctx.lineWidth = 2;
      ctx.strokeRect(l.center.x + 1, y0, l.center.w - 2, y1 - y0);
      if (o.previewStacks) this.drawStacks(ctx, l, o.previewStacks, y1 + 12, null);
    }
    // Spilli (le occasioni al centro della cella, TOM-15).
    const ks = l.scale ?? 1;
    for (let k = 0; k < m.pins.length; k++) {
      const pin = m.pins[k] as LaceModel['pins'][number];
      const x = g.colCx[pin.col] ?? 0;
      const y = top + rowBottom(l, pin.index);
      if (y < lace.y - 20 || y > lace.y + lace.h + 20 + l.rowH) continue;
      if (pin.kind === 'verde') {
        const c = slotCenter(l, scroll, pin.col, pin.index);
        drawSlot(ctx, pin.state, c.x, c.y, SLOT_R * ks, pin.icon);
        continue;
      }
      this.pins.draw(ctx, pin.kind, pin.state, x, y, pin.icon, pin.label, ks);
      if (pin.kind === 'ottone' && pin.col === o.pulsePinCol && pin.index === o.pulsePinIndex) {
        const h = pinHeadOffset(x, y, ks);
        pulseRing(ctx, h.x, h.y, 14 * ks, o.pulse, P.ottone);
      }
    }
    // Echi d'Archivio.
    if (o.showEchoes) {
      for (let k = 0; k < m.echoes.length; k++) {
        const e = m.echoes[k] as LaceModel['echoes'][number];
        const x = ((g.colCx[e.pair] ?? 0) + (g.colCx[e.pair + 1] ?? 0)) / 2;
        const y = top + rowTop(l, e.index) + l.rowH / 2;
        ctx.strokeStyle = P.ottone;
        ctx.globalAlpha = 0.45 + 0.45 * o.pulse;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // Cursore della tastiera sulla coppia.
    if (o.cursorPair >= 0 && !m.done) {
      const y0 = top + rowTop(l, cur);
      const x = l.colX[o.cursorPair] ?? 0;
      ctx.strokeStyle = P.ottone;
      ctx.lineWidth = 2;
      ctx.setLineDash(GHOST_DASH);
      ctx.strokeRect(x + 3, y0 + 2, l.colW * 2 - 6, l.rowH - 4);
      ctx.setLineDash(NO_DASH);
    }
    ctx.restore();

    // Fili che pendono dalla riga corrente fino ai fusi.
    const hangTop = Math.min(Math.max(top + rowBottom(l, m.done ? m.rows : cur), lace.y), lace.y + lace.h);
    const spTop = l.spindles.y + 4;
    const rig = this.rig;
    const p = poolPoly(3);
    ctx.save();
    ctx.beginPath();
    ctx.rect(l.center.x, lace.y, l.center.w, l.spindles.y + l.spindles.h - lace.y);
    ctx.clip();
    for (let c = 0; c < m.hangPos.length; c++) {
      const t = m.hangPos[c] as ThreadId;
      const s = rig.get(t);
      const v = visualOf(m.visuals, t);
      const x0 = g.colCx[c] ?? 0;
      const x1 = s ? rig.xOf(s) : x0;
      drawHanging(ctx, p, v, x0, hangTop, x1, spTop, o.time, m.hangKnotted.includes(t));
    }
    if (o.previewRow < 0) this.drawStacks(ctx, l, m.stacks, hangTop + 14, m);
    this.flights.draw(ctx, top);
    ctx.restore();

    // Fusi.
    const so = this.spindleOpts;
    so.quirk = o.quirk;
    so.rancor = o.rancor;
    so.label = o.label;
    so.highlight = o.highlight;
    so.pulse = o.pulse;
    so.nomeOn = o.nomeOn;
    rig.draw(ctx, spTop, l.spindleW, l.spindleH, m.visuals, so);
    void assets;
    // Cursore della tastiera su un fuso (si nomina: tutte le colonne, TOM-19).
    if (o.cursorCol >= 0) {
      const x = l.colX[o.cursorCol] ?? 0;
      ctx.strokeStyle = P.ottone;
      ctx.lineWidth = 2;
      ctx.setLineDash(GHOST_DASH);
      ctx.strokeRect(x + 3, l.spindles.y + 2, l.colW - 6, l.spindles.h - 4);
      ctx.setLineDash(NO_DASH);
    }

    if (o.ending) this.drawEnding(ctx, l, m, scroll, o);

    // Mano fantasma del tutorial: trascina un fuso fantasma da una colonna all'altra,
    // con una freccia (C02: il verso dell'incrocio si vede).
    if (o.handFrom >= 0 && o.handTo >= 0) {
      const xa = g.colCx[o.handFrom] ?? 0;
      const xb = g.colCx[o.handTo] ?? 0;
      const k = (o.time % 1.8) / 1.8;
      const t = k < 0.15 ? 0 : k > 0.75 ? 1 : (k - 0.15) / 0.6;
      const x = xa + (xb - xa) * (t * t * (3 - 2 * t));
      const y = l.spindles.y + l.spindles.h * 0.42;
      const fade = k > 0.85 ? (1 - k) / 0.15 : 1;
      const ghost = m.hangPos[o.handFrom];
      if (ghost) rig.drawGhost(ctx, ghost, x, spTop, l.spindleW, l.spindleH, m.visuals, 0.5 * fade);
      drawArrow(ctx, xa, xb, l.spindles.y - 6, P.ottone, 0.9 * fade);
      ctx.globalAlpha = 0.85 * fade;
      drawHand(ctx, x, y, this.handPoly);
      ctx.globalAlpha = 1;
    }
  }

  /** Chiusure speciali: il nodo e il merletto che si disfa (C11), il filo nero che appare (C12). */
  private drawEnding(ctx: CanvasRenderingContext2D, l: TomboloLayout, m: LaceModel, scroll: number, o: Overlay): void {
    const e = o.ending;
    if (!e) return;
    const P = this.palette;
    const top = l.lace.y - scroll;
    ctx.save();
    ctx.beginPath();
    ctx.rect(l.center.x, l.lace.y, l.center.w, l.spindles.y + l.spindles.h - l.lace.y);
    ctx.clip();
    if (e.kind === 'nodo') {
      if (e.fade) {
        ctx.globalAlpha = e.p;
        ctx.fillStyle = P.velluto;
        ctx.fillRect(l.center.x, l.lace.y, l.center.w, l.spindles.y + l.spindles.h - l.lace.y);
        ctx.restore();
        return;
      }
      const t = e.p * ENDING_NODO;
      const knot = Math.min(1, t / 0.8);
      const unravel = Math.max(0, Math.min(1, (t - 0.8) / 1.5));
      // 1. Il nodo si chiude su tutti i fili: convergono in un punto sotto l'ultima riga.
      const yTop = top + rowBottom(l, m.rows);
      const cx = ((l.colCx[0] ?? 0) + (l.colCx[l.cols - 1] ?? 0)) / 2;
      const ky = yTop + 34 * knot;
      for (let c = 0; c < m.hangPos.length; c++) {
        const v = visualOf(m.visuals, m.hangPos[c] as ThreadId);
        const x0 = l.colCx[c] ?? 0;
        ctx.strokeStyle = v.color;
        ctx.lineWidth = v.width;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(x0, yTop);
        ctx.quadraticCurveTo(x0, yTop + 20 * knot, x0 + (cx - x0) * knot, ky);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(cx, ky);
      ctx.scale(1 + knot, 1 + knot);
      drawKnot(ctx, 0, 0);
      ctx.restore();
      // 2. Il merletto si disfa dal basso in alto.
      if (unravel > 0) {
        const h = rowBottom(l, m.rows) * unravel;
        ctx.fillStyle = P.velluto;
        ctx.globalAlpha = 0.96;
        ctx.fillRect(l.center.x, yTop - h, l.center.w, h + 8);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      return;
    }
    // Apparizione: nel margine alto, l'ora della notte prima e il filo nero che entra.
    const band = l.rowH;
    const yb = top - band * 0.5;
    const alpha = e.fade ? Math.sin(Math.PI * e.p) : e.p > 0.7 ? Math.max(0, 1 - (e.p - 0.7) / 0.3) : 1;
    ctx.globalAlpha = alpha;
    ctx.font = labelFont(l.scale ?? 1, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = P.testo;
    ctx.fillText(e.hour, l.gutterCx, yb);
    // I fili dell'apertura salgono nel margine.
    for (let c = 0; c < m.openPos.length; c++) {
      const v = visualOf(m.visuals, m.openPos[c] as ThreadId);
      const x = l.colCx[c] ?? 0;
      ctx.strokeStyle = v.color;
      ctx.lineWidth = v.width;
      ctx.beginPath();
      ctx.moveTo(x, yb - band * 0.45);
      ctx.lineTo(x, top + 6);
      ctx.stroke();
    }
    // Il filo nero entra dal bordo e avanza di `passi` colonne, sopra i fili che trova.
    const xEdge = e.side < 0 ? (l.colX[0] ?? 0) - 18 : (l.colX[l.cols - 1] ?? 0) + l.colW + 18;
    const target = e.side < 0 ? Math.min(l.cols - 1, e.passi - 1) : Math.max(0, l.cols - e.passi);
    const xEnd = (l.colCx[target] ?? 0) - e.side * l.colW * 0.35;
    const adv = e.fade ? 1 : Math.min(1, e.p / 0.7);
    const x1 = xEdge + (xEnd - xEdge) * adv;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#E8DCC4';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(xEdge, yb - 8);
    ctx.lineTo(x1, yb + 8 * adv);
    ctx.stroke();
    ctx.strokeStyle = '#15110E';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(xEdge, yb - 8);
    ctx.lineTo(x1, yb + 8 * adv);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /** Bordo sfrangiato di uno strappo d'Archivio, a tutta larghezza del merletto. */
  private tornEdge(ctx: CanvasRenderingContext2D, l: TomboloLayout, y: number): void {
    if (y < l.lace.y - 6 || y > l.lace.y + l.lace.h + 6) return;
    const x0 = (l.colX[0] ?? l.center.x) - 6;
    const x1 = (l.colX[l.cols - 1] ?? l.center.x) + l.colW + 6;
    ctx.strokeStyle = this.palette.testoTenue;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.5;
    ctx.setLineDash(TORN_DASH);
    ctx.beginPath();
    let up = true;
    for (let x = x0; x <= x1; x += 7) {
      if (x === x0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y + (up ? -3 : 3));
      up = !up;
    }
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    ctx.globalAlpha = 1;
  }

  private drawStacks(ctx: CanvasRenderingContext2D, l: TomboloLayout, stacks: readonly StackView[], y0: number, m: LaceModel | null): void {
    const g = this.geom;
    for (let i = 0; i < stacks.length; i++) {
      const st = stacks[i] as StackView;
      const s = this.rig.get(st.thread);
      const x0 = g.colCx[st.col] ?? 0;
      const x1 = s ? this.rig.xOf(s) : x0;
      for (const slot of stackSlots(l, st, x0, x1, y0)) {
        const b = slot.bead;
        if (m && this.flights.flying(st.thread, b.id)) continue;
        // Una lettera col destinatario accanto trema verso di lui (non col movimento ridotto).
        const shake = b.tremble !== 0 && !this.rig.reduced ? b.tremble * (1.6 + 1.6 * Math.sin(this.frameTime * 24)) : 0;
        drawBead(ctx, b.type, slot.x + shake, slot.y, slot.scale, b.delivered);
      }
    }
  }
}

/** Passo verticale fra le perline di una pila (px CSS a scala 1). */
export const BEAD_STEP = 16;
/** Perline disegnate al massimo per pila. */
export const STACK_MAX = 5;
/**
 * Scala minima delle perline sugli schermi stretti (Q052: su telefono si vedono
 * appena): le perline in mano ai fili sono il cuore del puzzle.
 */
export const BEAD_SCALE_NARROW = 1.25;

/** Scala delle perline appese ai fili per un layout. */
export function beadScale(l: Pick<TomboloLayout, 'scale' | 'kind'>): number {
  const k = l.scale ?? 1;
  return l.kind === 'stretto' ? Math.max(k, BEAD_SCALE_NARROW) : k;
}

export interface StackSlot {
  bead: StackView['beads'][number];
  x: number;
  y: number;
  /** Scala con cui si disegna (sempre > 0: Q011, la prima perlina era a scala 0). */
  scale: number;
}

/**
 * Dove si disegnano le perline di una pila (renderer e bersagli dei tocchi): la
 * prima a `y0`, le altre una sotto l'altra con passo `BEAD_STEP × scala`, lungo
 * il filo che pende dalla colonna `x0` verso il fuso in `x1`.
 */
export function stackSlots(l: Pick<TomboloLayout, 'scale' | 'kind' | 'spindles'>, st: Pick<StackView, 'beads'>, x0: number, x1: number, y0: number): StackSlot[] {
  const k = beadScale(l);
  const out: StackSlot[] = [];
  let y = y0;
  for (let j = 0; j < st.beads.length && j < STACK_MAX; j++) {
    const bead = st.beads[j];
    if (!bead) continue;
    // Le perline scendono lungo il filo che pende: x interpolata verso il fuso.
    const f = Math.min(1, (y - y0) / Math.max(1, l.spindles.y - y0));
    out.push({ bead, x: x0 + (x1 - x0) * f * f, y, scale: k });
    y += BEAD_STEP * k;
  }
  return out;
}


/** X dell'icona di un evento di bordo (barca, vaporetto, filo nero). */
export function edgeX(l: Pick<TomboloLayout, 'colX' | 'cols' | 'colW'>, side: number): number {
  return side < 0 ? (l.colX[0] ?? 0) - 9 : (l.colX[l.cols - 1] ?? 0) + l.colW + 5;
}

/** Anello che pulsa intorno a un elemento (tutorial). */
function pulseRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, pulse: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35 + 0.6 * pulse;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r + 3 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Freccia orizzontale da xa a xb (verso del trascinamento del tutorial). */
function drawArrow(ctx: CanvasRenderingContext2D, xa: number, xb: number, y: number, color: string, alpha: number): void {
  const dir = xb >= xa ? 1 : -1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(xa, y);
  ctx.lineTo(xb - dir * 8, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(xb, y);
  ctx.lineTo(xb - dir * 10, y - 6);
  ctx.lineTo(xb - dir * 10, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Barca, vaporetto, secca o arrivo del filo nero sul bordo. */
function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, side: number, P: Palette): void {
  ctx.lineWidth = 1.4;
  if (kind === 'secca') {
    ctx.strokeStyle = 'rgba(217,195,176,0.8)';
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      ctx.moveTo(x - 7, y - 4 + k * 4);
      ctx.lineTo(x + 7, y - 4 + k * 4);
    }
    ctx.stroke();
    return;
  }
  if (kind === 'nero') {
    ctx.fillStyle = '#15110E';
    ctx.strokeStyle = '#6B5A4C';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.fillStyle = kind === 'vaporetto' ? '#D9D2C2' : '#B89B72';
  ctx.strokeStyle = P.vellutoOmbra;
  ctx.beginPath();
  ctx.moveTo(x - 8, y - 2);
  ctx.lineTo(x + 8, y - 2);
  ctx.lineTo(x + 5, y + 4);
  ctx.lineTo(x - 5, y + 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (kind === 'vaporetto') {
    ctx.fillRect(x - 3, y - 7, 6, 5);
    ctx.strokeRect(x - 3, y - 7, 6, 5);
  }
  ctx.strokeStyle = 'rgba(200,220,215,0.6)';
  ctx.beginPath();
  ctx.moveTo(x - 8 * side, y + 7);
  ctx.lineTo(x + 8 * side, y + 7);
  ctx.stroke();
}

/** Mano stilizzata (palmo e indice), disegnata in codice. */
function drawHand(ctx: CanvasRenderingContext2D, x: number, y: number, _p: Poly): void {
  ctx.fillStyle = 'rgba(243,238,228,0.9)';
  ctx.strokeStyle = 'rgba(43,38,34,0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 3, y - 18);
  ctx.quadraticCurveTo(x, y - 22, x + 3, y - 18);
  ctx.lineTo(x + 3, y - 4);
  ctx.quadraticCurveTo(x + 13, y - 6, x + 13, y + 4);
  ctx.quadraticCurveTo(x + 12, y + 16, x + 1, y + 17);
  ctx.quadraticCurveTo(x - 10, y + 16, x - 11, y + 6);
  ctx.lineTo(x - 11, y - 2);
  ctx.quadraticCurveTo(x - 8, y - 5, x - 3, y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
