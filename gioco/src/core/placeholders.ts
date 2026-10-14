/**
 * Segnaposto disegnati in codice (ARCHITETTURA 5.1): quando un asset manca il
 * gioco resta giocabile e leggibile. Fuso stilizzato del colore del personaggio,
 * figurina di legno con la fascia colorata, diorama a fasce di colore.
 * Tutto deterministico (stesso nome, stesso disegno), nessun testo nelle immagini.
 */
import type { CharacterId } from './types';

/** Colori dei fili (GDD 5.4), usati quando i contenuti non sono ancora caricati. */
export const CHARACTER_COLORS: Readonly<Record<CharacterId | 'lino', string>> = {
  teresa: '#2F5DA8',
  marta: '#C0442C',
  piero: '#6E3D96',
  gino: '#4FB3E0',
  bepi: '#E07B24',
  nina: '#E8C12E',
  zeno: '#1F8A78',
  lunardi: '#D9DEE3',
  livia: '#15110E',
  ada: '#F07C6C',
  clotilde: '#EFE3C8',
  ernesto: '#8E8676',
  anselmo: '#8E8676',
  aldo: '#8E8676',
  bortolo: '#8E8676',
  arianna: '#8E8676',
  lino: '#8E8676',
};

export const PALETTE = {
  velluto: '#1C2233',
  vellutoLuce: '#2A3247',
  vellutoOmbra: '#121622',
  legno: '#B89B72',
  legnoScuro: '#6E5539',
  carta: '#EDE4D3',
  inchiostro: '#2B2622',
  laguna: '#7F918C',
  mattone: '#9A6B5A',
  ocra: '#B59A6A',
  alba: '#D9C3B0',
  ottone: '#C9A24A',
  giorno: '#A9BBD9',
  sole: '#FFB38A',
  luna: '#8FA6D9',
  finestra: '#FFB24A',
} as const;

/** Il minimo di un canvas che ci serve: HTMLCanvasElement, OffscreenCanvas o un finto nei test. */
export interface PlaceholderCanvas {
  width: number;
  height: number;
  getContext(id: '2d'): unknown;
}

export type CanvasFactory = (w: number, h: number) => PlaceholderCanvas;

export interface PlaceholderSpec {
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/** Ancora dei fusi (ARCHITETTURA 12, asset veri): la cima della testa, dove parte il filo. */
export const FUSO_ANCHOR_Y = 0.125;
/**
 * Il disegno del segnaposto occupa la stessa altezza del fuso vero (dalla testa a
 * circa 0,11 fino al pomolo a circa 0,97 del fotogramma): le frazioni del disegno
 * (0…1) si portano in quella fascia, così il filo si attacca nello stesso punto.
 */
const FUSO_TOP = 0.06;
const FUSO_SPAN = 0.925;

/** Dimensioni e ancore dei segnaposto (ARCHITETTURA 12: fusi 96×320, figurine 256 con ay 0,92…). */
export function placeholderSpec(name: string): PlaceholderSpec {
  const [group, id] = name.split('/');
  switch (group) {
    case 'fuso':
      // Come i fusi veri: l'ancora è in cima alla testa, dove parte il filo.
      return { w: 96, h: 320, ax: 0.5, ay: FUSO_ANCHOR_Y };
    case 'fig':
      return { w: 256, h: 256, ax: 0.5, ay: 0.92 };
    case 'obj':
      return id === 'tombolo' ? { w: 1024, h: 1024, ax: 0.5, ay: 0.5 } : { w: 256, h: 256, ax: 0.5, ay: 0.5 };
    case 'dio':
    case 'tab':
      return { w: 1024, h: 768, ax: 0.5, ay: 0.5 };
    default:
      return { w: 64, h: 64, ax: 0.5, ay: 0.5 };
  }
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function shade(hex: string, f: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return hex;
  const n = Number.parseInt(m[1], 16);
  const ch = (v: number): number => Math.max(0, Math.min(255, Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function drawFuso(ctx: CanvasRenderingContext2D, w: number, h: number, color: string): void {
  const cx = w / 2;
  const y = (f: number): number => h * (FUSO_TOP + f * FUSO_SPAN);
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.inchiostro;
  // Testa intagliata
  ctx.fillStyle = PALETTE.legno;
  ctx.beginPath();
  ctx.arc(cx, y(0.12), w * 0.19, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Collo
  ctx.fillRect(cx - w * 0.08, y(0.17), w * 0.16, y(0.25) - y(0.17));
  ctx.strokeRect(cx - w * 0.08, y(0.17), w * 0.16, y(0.25) - y(0.17));
  // Filo avvolto
  const top = y(0.25);
  const bottom = y(0.6);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, top);
  ctx.lineTo(cx + w * 0.2, top);
  ctx.quadraticCurveTo(cx + w * 0.26, (top + bottom) / 2, cx + w * 0.2, bottom);
  ctx.lineTo(cx - w * 0.2, bottom);
  ctx.quadraticCurveTo(cx - w * 0.26, (top + bottom) / 2, cx - w * 0.2, top);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = shade(color, 0.35);
  ctx.lineWidth = 1.5;
  for (let y = top + 10; y < bottom - 4; y += 9) {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.19, y);
    ctx.lineTo(cx + w * 0.19, y - 4);
    ctx.stroke();
  }
  // Manico affusolato
  ctx.strokeStyle = PALETTE.inchiostro;
  ctx.lineWidth = 2;
  ctx.fillStyle = PALETTE.legno;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.15, bottom);
  ctx.lineTo(cx + w * 0.15, bottom);
  ctx.lineTo(cx + w * 0.07, y(0.94));
  ctx.lineTo(cx - w * 0.07, y(0.94));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.legnoScuro;
  ctx.beginPath();
  ctx.arc(cx, y(0.955), w * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawFigura(ctx: CanvasRenderingContext2D, s: number, color: string | null, pose: string): void {
  const cx = s / 2;
  const base = s * 0.92;
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.inchiostro;
  // Basetta
  ctx.fillStyle = PALETTE.legnoScuro;
  ctx.beginPath();
  ctx.ellipse(cx, base, s * 0.2, s * 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Corpo tornito
  ctx.fillStyle = PALETTE.legno;
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.13, base - 4);
  ctx.bezierCurveTo(cx - s * 0.17, s * 0.62, cx - s * 0.06, s * 0.42, cx - s * 0.07, s * 0.36);
  ctx.lineTo(cx + s * 0.07, s * 0.36);
  ctx.bezierCurveTo(cx + s * 0.06, s * 0.42, cx + s * 0.17, s * 0.62, cx + s * 0.13, base - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Fascia del colore del filo (assente nella figura grezza)
  if (color) {
    ctx.fillStyle = color;
    ctx.fillRect(cx - s * 0.135, s * 0.62, s * 0.27, s * 0.07);
    ctx.strokeRect(cx - s * 0.135, s * 0.62, s * 0.27, s * 0.07);
  }
  // Testa
  ctx.fillStyle = shade(PALETTE.legno, 0.15);
  ctx.beginPath();
  ctx.arc(cx, s * 0.27, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Posa
  ctx.fillStyle = PALETTE.legno;
  if (pose === 'porge') {
    ctx.beginPath();
    ctx.arc(cx + s * 0.16, s * 0.5, s * 0.035, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (pose === 'saluta') {
    ctx.lineWidth = s * 0.03;
    ctx.strokeStyle = PALETTE.legno;
    ctx.beginPath();
    ctx.moveTo(cx + s * 0.08, s * 0.45);
    ctx.lineTo(cx + s * 0.19, s * 0.26);
    ctx.stroke();
  }
}

function drawOggetto(ctx: CanvasRenderingContext2D, s: number, name: string): void {
  const cx = s / 2;
  const cy = s / 2;
  ctx.lineWidth = Math.max(2, s / 128);
  ctx.strokeStyle = PALETTE.inchiostro;
  if (name === 'tombolo') {
    ctx.fillStyle = PALETTE.legnoScuro;
    ctx.beginPath();
    ctx.ellipse(cx, cy + s * 0.12, s * 0.42, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.vellutoLuce;
    ctx.beginPath();
    ctx.ellipse(cx, cy, s * 0.4, s * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PALETTE.carta;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * s * 0.08, cy - s * 0.1);
      ctx.lineTo(cx + i * s * 0.08, cy + s * 0.1);
      ctx.stroke();
    }
    return;
  }
  const h = hash(name);
  const tall = 0.25 + ((h % 7) / 7) * 0.15;
  ctx.fillStyle = h % 2 ? PALETTE.legno : PALETTE.carta;
  ctx.beginPath();
  ctx.ellipse(cx, cy, s * (0.32 - tall / 3), s * tall, ((h >> 3) % 5) * 0.2 - 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.ottone;
  ctx.beginPath();
  ctx.arc(cx, cy - s * tall * 0.6, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
}

function drawDiorama(ctx: CanvasRenderingContext2D, w: number, h: number, place: string, light: string): void {
  const sky = light === 'notte' ? PALETTE.vellutoOmbra : light === 'alba' ? PALETTE.alba : PALETTE.giorno;
  const skyLow = light === 'notte' ? PALETTE.velluto : light === 'alba' ? PALETTE.sole : shade(PALETTE.giorno, 0.3);
  const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  g.addColorStop(0, sky);
  g.addColorStop(1, skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h * 0.55);
  // Acqua
  ctx.fillStyle = light === 'notte' ? shade(PALETTE.laguna, -0.55) : PALETTE.laguna;
  ctx.fillRect(0, h * 0.7, w, h * 0.3);
  // Fondamenta e case
  ctx.fillStyle = light === 'notte' ? shade(PALETTE.legnoScuro, -0.4) : PALETTE.legnoScuro;
  ctx.fillRect(0, h * 0.62, w, h * 0.08);
  const hh = hash(place);
  const houses = 5 + (hh % 3);
  for (let i = 0; i < houses; i++) {
    const x = (w / houses) * i + 8;
    const bw = w / houses - 16;
    const top = h * (0.3 + ((hh >> (i * 3)) % 5) * 0.03);
    const col = i % 2 ? PALETTE.mattone : PALETTE.ocra;
    ctx.fillStyle = light === 'notte' ? shade(col, -0.6) : light === 'alba' ? shade(col, -0.1) : col;
    ctx.fillRect(x, top, bw, h * 0.62 - top);
    ctx.fillStyle = light === 'notte' ? PALETTE.finestra : shade(col, -0.35);
    ctx.fillRect(x + bw * 0.4, top + (h * 0.62 - top) * 0.3, bw * 0.2, (h * 0.62 - top) * 0.2);
  }
  // Elemento del luogo
  ctx.fillStyle = light === 'notte' ? shade(PALETTE.carta, -0.5) : PALETTE.carta;
  const cx = w / 2;
  switch (place) {
    case 'faro':
      ctx.fillRect(cx - 30, h * 0.12, 60, h * 0.5);
      ctx.fillStyle = '#9A3B30';
      for (let y = h * 0.18; y < h * 0.6; y += 70) ctx.fillRect(cx - 30, y, 60, 26);
      break;
    case 'chiesa':
      ctx.fillRect(cx - 40, h * 0.08, 80, h * 0.54);
      ctx.beginPath();
      ctx.moveTo(cx - 48, h * 0.08);
      ctx.lineTo(cx, h * 0.01);
      ctx.lineTo(cx + 48, h * 0.08);
      ctx.fill();
      break;
    case 'molo':
      for (let i = 0; i < 7; i++) ctx.fillRect(80 + i * 130, h * 0.55, 14, h * 0.3);
      break;
    case 'forno':
      ctx.fillRect(cx + 120, h * 0.14, 40, h * 0.2);
      break;
    case 'piazza':
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.6, 70, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'farmacia':
      for (let i = 0; i < 5; i++) ctx.fillRect(cx - 160 + i * 70, h * 0.48, 36, 60);
      break;
    case 'stanza':
      ctx.fillStyle = light === 'notte' ? PALETTE.velluto : shade(PALETTE.legnoScuro, -0.2);
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = light === 'notte' ? PALETTE.luna : sky;
      ctx.fillRect(w * 0.62, h * 0.12, w * 0.18, h * 0.24);
      ctx.fillStyle = PALETTE.vellutoLuce;
      ctx.beginPath();
      ctx.ellipse(w * 0.4, h * 0.62, w * 0.18, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    default:
      break;
  }
  if (light === 'notte' && place !== 'stanza') {
    ctx.fillStyle = PALETTE.luna;
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.12, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  // Area sicura centrale 768×576: cornice leggera per chi controlla i ritagli.
  ctx.strokeStyle = 'rgba(43,38,34,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect((w - 768) / 2, (h - 576) / 2, 768, 576);
}

function drawGenerico(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = PALETTE.vellutoLuce;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = PALETTE.legno;
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.beginPath();
  ctx.moveTo(6, 6);
  ctx.lineTo(w - 6, h - 6);
  ctx.moveTo(w - 6, 6);
  ctx.lineTo(6, h - 6);
  ctx.stroke();
}

/**
 * Disegna il segnaposto di un asset. `colorOf` dà il colore di un personaggio
 * (dai contenuti); se manca si usa la tabella del GDD.
 */
export function drawPlaceholder(
  canvas: PlaceholderCanvas,
  name: string,
  colorOf?: (id: string) => string | undefined,
): void {
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return;
  const parts = name.split('/');
  const group = parts[0] ?? '';
  const id = parts[1] ?? '';
  const colorFor = (who: string): string =>
    colorOf?.(who) ?? (CHARACTER_COLORS as Record<string, string>)[who] ?? CHARACTER_COLORS.lino;
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  switch (group) {
    case 'fuso': {
      const styled = id.startsWith('stile_');
      drawFuso(ctx, w, h, styled ? PALETTE.legnoScuro : colorFor(id));
      break;
    }
    case 'fig': {
      const pose = parts[2] ?? 'ferma';
      const grezza = pose.endsWith('_grezza');
      drawFigura(ctx, Math.min(w, h), grezza ? null : colorFor(id), pose.replace('_grezza', ''));
      break;
    }
    case 'obj':
      drawOggetto(ctx, Math.min(w, h), id);
      break;
    case 'dio':
      drawDiorama(ctx, w, h, id, parts[2] ?? 'giorno');
      break;
    case 'tab':
      drawDiorama(ctx, w, h, id, hash(id) % 2 ? 'notte' : 'alba');
      break;
    default:
      drawGenerico(ctx, w, h);
  }
}
