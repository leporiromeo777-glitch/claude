/**
 * Immagine PNG del merletto finito (GDD 8.3 "un'immagine PNG del merletto
 * generata sul dispositivo"; ARCHITETTURA 5.5): stesso disegno del tombolo,
 * su velluto, con le icone dei luoghi in alto, le ore a sinistra e gli spilli
 * d'ottone. Nessun testo dentro l'immagine oltre ai numeri delle ore.
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
export function laceImageSize(level: LevelDef): { w: number; h: number } {
  const rows = level.endHour - level.startHour;
  return { w: GUTTER + level.columns.length * EXPORT_COL_W + PAD * 2, h: HEADER + Math.round(EXPORT_ROW_H * 0.6) + rows * EXPORT_ROW_H + PAD * 2 };
}

/**
 * Disegna il merletto su un contesto (coordinate CSS, già scalato). `flags` sono
 * quelli della notte (per esempio `riconciliate` toglie il rifiuto di Marta):
 * senza, una riga valida quel giorno potrebbe essere rifiutata e il disegno si
 * fermerebbe lì. I merletti d'Archivio si ritessono sempre con le regole di allora.
 */
export function drawLaceImage(ctx: Ctx2D, level: LevelDef, rows: readonly RowMoves[], make = defaultCanvasMaker, flags: Record<FlagId, FlagValue> = {}): void {
  const { w, h } = laceImageSize(level);
  const velvet = new Velvet(make);
  const bg = velvet.background(w, h, 1, '#1C2233', '#121622');
  if (bg) ctx.drawImage(bg as CanvasImageSource, 0, 0, w, h);
  else {
    ctx.fillStyle = '#1C2233';
    ctx.fillRect(0, 0, w, h);
  }
  const W = level.columns.length;
  const x0 = PAD + GUTTER;
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
  ctx.fillText(String(level.startHour), PAD + GUTTER / 2, top + openH / 2);
  for (let i = 1; i < sim.timeline.length; i++) {
    const before = sim.timeline[i - 1];
    const after = sim.timeline[i];
    const r = sim.rows[i - 1];
    if (!before || !after || !r) continue;
    const y0 = top + openH + (i - 1) * EXPORT_ROW_H;
    const shape = buildRowShape(i, r.hour, before.pos, r.crossings, after.pos, sim.events[i - 1] ?? null, before.knotted, types, false);
    drawRow(ctx, shape, g, y0, y0 + EXPORT_ROW_H, visuals, style);
    ctx.fillStyle = '#B9B3A6';
    ctx.fillText(String(r.hour), PAD + GUTTER / 2, y0 + EXPORT_ROW_H - 10);
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
}

function toBlob(cv: AnyCanvas): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined' && cv instanceof OffscreenCanvas) return cv.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => {
    (cv as HTMLCanvasElement).toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

/** PNG del merletto (ARCHITETTURA 5.5): `rows` sono le righe fissate (RowMoves); `flags` quelli della notte, se ci sono. */
export async function renderLacePng(level: LevelDef, rows: RowMoves[], flags: Record<FlagId, FlagValue> = {}): Promise<Blob> {
  const { w, h } = laceImageSize(level);
  const cv = defaultCanvasMaker(w * SCALE, h * SCALE);
  const ctx = cv.getContext('2d') as Ctx2D | null;
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  drawLaceImage(ctx, level, rows, defaultCanvasMaker, flags);
  return toBlob(cv);
}
