/**
 * Immagine PNG del merletto finito (GDD 8.3 "un'immagine PNG del merletto
 * generata sul dispositivo"; ARCHITETTURA 5.5): stesso disegno del tombolo,
 * su velluto, con le icone dei luoghi in alto, le ore a sinistra e gli spilli
 * d'ottone. Con `caption` (revisione 1, TOM-21, D17) in basso c'è un cartiglio
 * di carta con tre righe già tradotte da chi condivide: titolo (TRAMA), data,
 * incroci e minimo.
 */
import type { BeadType, CharacterDef, CharacterId, FlagId, FlagValue, LevelDef, RowMoves, ThreadId } from '../core/types';
import { hasService, services } from '../core/services';
import { drawGlyph } from '../core/ui/glyphs';
import { createContext, simulate } from '../engine/index';
import { buildVisuals } from './visuals';
import { beadTypesOf } from './render/model';
import { buildRowShape, drawRow, type RowGeom, type RowStyle } from './render/threads';
import { PinSprites, defaultCanvasMaker } from './render/pins';
import { Velvet } from './render/velvet';

export const EXPORT_COL_W = 56;
export const EXPORT_ROW_H = 44;
const GUTTER = 30;
const HEADER = 44;
const PAD = 16;
const SCALE = 2;
/** Altezza del cartiglio in basso (px CSS, prima della scala ×2). */
export const CAPTION_H = 76;

/** Cartiglio del PNG condivisibile: tre righe di testo già tradotte. */
export interface LaceCaption {
  titolo: string;
  sottotitolo: string;
  riga: string;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D;

function placeIcon(id: string): string {
  if (hasService('content')) {
    const p = services.content.places.get(id as never);
    if (p) return p.icon;
  }
  return ({ molo: 'bitta', forno: 'pagnotta', piazza: 'pozzo', chiesa: 'campanile', farmacia: 'mortaio', faro: 'faro' } as Record<string, string>)[id] ?? 'info';
}

/** Dimensioni dell'immagine (px CSS, prima della scala ×2). */
export function laceImageSize(level: LevelDef, caption?: LaceCaption | null): { w: number; h: number } {
  const rows = level.endHour - level.startHour;
  // Con il cartiglio l'immagine è larga almeno 300 px, perché le scritte ci stiano.
  const w = GUTTER + level.columns.length * EXPORT_COL_W + PAD * 2;
  const base = HEADER + Math.round(EXPORT_ROW_H * 0.6) + rows * EXPORT_ROW_H + PAD * 2;
  return caption ? { w: Math.max(300, w), h: base + CAPTION_H } : { w, h: base };
}

/** Rettangolo del cartiglio nell'immagine (px CSS), o null senza cartiglio. */
export function captionRect(level: LevelDef, caption?: LaceCaption | null): { x: number; y: number; w: number; h: number } | null {
  if (!caption) return null;
  const { w, h } = laceImageSize(level, caption);
  return { x: PAD, y: h - CAPTION_H - PAD / 2, w: w - PAD * 2, h: CAPTION_H - PAD / 2 };
}

/** Il cartiglio: carta con bordo d'ottone, titolo, sottotitolo e riga delle misure. */
function drawCaption(ctx: Ctx2D, r: { x: number; y: number; w: number; h: number }, c: LaceCaption): void {
  ctx.save();
  ctx.fillStyle = '#EDE4D3';
  ctx.strokeStyle = '#C9A24A';
  ctx.lineWidth = 2;
  const rad = 8;
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = r.x + r.w / 2;
  const maxW = r.w - 16;
  ctx.fillStyle = '#2B2622';
  ctx.font = "bold 20px 'EB Garamond', Georgia, serif";
  ctx.fillText(c.titolo, cx, r.y + 18, maxW);
  ctx.fillStyle = '#5A4632';
  ctx.font = "15px 'Atkinson Hyperlegible', system-ui, sans-serif";
  ctx.fillText(c.sottotitolo, cx, r.y + 38, maxW);
  ctx.fillStyle = '#2B2622';
  ctx.font = "bold 15px 'Atkinson Hyperlegible', system-ui, sans-serif";
  ctx.fillText(c.riga, cx, r.y + 56, maxW);
  ctx.restore();
}

/**
 * Disegna il merletto su un contesto (coordinate CSS, già scalato). `flags` sono
 * quelli della notte (per esempio `riconciliate` toglie il rifiuto di Marta):
 * senza, una riga valida quel giorno potrebbe essere rifiutata e il disegno si
 * fermerebbe lì. I merletti d'Archivio si ritessono sempre con le regole di allora.
 */
export function drawLaceImage(ctx: Ctx2D, level: LevelDef, rows: readonly RowMoves[], make = defaultCanvasMaker, flags: Record<FlagId, FlagValue> = {}, caption?: LaceCaption | null): void {
  const { w, h } = laceImageSize(level, caption);
  const velvet = new Velvet(make);
  const bg = velvet.background(w, h, 1, '#1C2233', '#121622');
  if (bg) ctx.drawImage(bg as CanvasImageSource, 0, 0, w, h);
  else {
    ctx.fillStyle = '#1C2233';
    ctx.fillRect(0, 0, w, h);
  }
  const W = level.columns.length;
  // Con il cartiglio l'immagine può essere più larga del merletto: si centra.
  const x0 = PAD + GUTTER + Math.max(0, (w - (GUTTER + W * EXPORT_COL_W + PAD * 2)) / 2);
  const colCx: number[] = [];
  for (let i = 0; i < W; i++) colCx.push(x0 + EXPORT_COL_W * (i + 0.5));
  // Intestazione: icone dei luoghi.
  level.columns.forEach((p, i) => drawGlyph(ctx, placeIcon(p), colCx[i] ?? 0, PAD + HEADER / 2, 22, '#D8CCB4', 1.8));
  // Le righe sono già state fissate: la matassa non conta più.
  const free: LevelDef = { ...level, matassa: Number.MAX_SAFE_INTEGER };
  const ctxRun = createContext(free, level.archive ? {} : flags);
  const sim = simulate(free, ctxRun, rows);
  const chars: ReadonlyMap<CharacterId, CharacterDef> = hasService('content') ? services.content.characters : new Map();
  const visuals = buildVisuals(level, chars, {});
  const types: Map<string, BeadType> = beadTypesOf(level);
  const g: RowGeom = { colCx, colW: EXPORT_COL_W, left: x0 - 2, right: x0 + W * EXPORT_COL_W + 2 };
  const style: RowStyle = { gap: '#1C2233', time: 0, ghostAlpha: 0.55, marks: true };
  const openH = Math.round(EXPORT_ROW_H * 0.6);
  const top = PAD + HEADER;
  ctx.lineCap = 'round';
  // Apertura.
  const open = sim.timeline[0];
  if (open) {
    open.pos.forEach((t: ThreadId, c) => {
      const v = visuals.get(t);
      ctx.strokeStyle = v?.color ?? '#8E8676';
      ctx.lineWidth = v?.width ?? 3.5;
      ctx.beginPath();
      ctx.moveTo(colCx[c] ?? 0, top + 6);
      ctx.lineTo(colCx[c] ?? 0, top + openH);
      ctx.stroke();
    });
  }
  ctx.font = "13px 'Atkinson Hyperlegible', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#B9B3A6';
  const gx = x0 - GUTTER / 2;
  ctx.fillText(String(level.startHour), gx, top + openH / 2);
  for (let i = 1; i < sim.timeline.length; i++) {
    const before = sim.timeline[i - 1];
    const after = sim.timeline[i];
    const r = sim.rows[i - 1];
    if (!before || !after || !r) continue;
    const y0 = top + openH + (i - 1) * EXPORT_ROW_H;
    const shape = buildRowShape(i, r.hour, before.pos, r.crossings, after.pos, sim.events[i - 1] ?? null, before.knotted, types, false);
    drawRow(ctx, shape, g, y0, y0 + EXPORT_ROW_H, visuals, style);
    ctx.fillStyle = '#B9B3A6';
    ctx.fillText(String(r.hour), gx, y0 + EXPORT_ROW_H - 10);
  }
  // Spilli d'ottone rispettati.
  const pins = new PinSprites(make);
  for (const p of level.pins) {
    const col = level.columns.indexOf(p.place);
    const i = p.hour - level.startHour;
    const st = sim.timeline[i];
    if (col < 0 || i < 1 || !st) continue;
    const y = top + openH + i * EXPORT_ROW_H;
    pins.draw(ctx, 'ottone', st.pos[col] === p.thread ? 'acceso' : 'normale', colCx[col] ?? 0, y, visuals.get(p.thread)?.icon ?? null, null);
  }
  const cr = captionRect(level, caption);
  if (cr && caption) drawCaption(ctx, cr, caption);
}

function toBlob(cv: AnyCanvas): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && cv instanceof OffscreenCanvas) return cv.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => {
    (cv as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/**
 * PNG del merletto (ARCHITETTURA 5.5): `rows` sono le righe fissate (RowMoves);
 * `flags` quelli della notte, se ci sono; `caption` il cartiglio in basso (TOM-21).
 */
export async function renderLacePng(level: LevelDef, rows: RowMoves[], flags: Record<FlagId, FlagValue> = {}, caption?: LaceCaption | null): Promise<Blob> {
  const { w, h } = laceImageSize(level, caption);
  const cv = defaultCanvasMaker(w * SCALE, h * SCALE);
  const ctx = cv.getContext('2d') as Ctx2D | null;
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawLaceImage(ctx, level, rows, defaultCanvasMaker, flags, caption);
  return toBlob(cv);
}
