/**
 * Disposizione del tombolo (GDD 10.2-10.3, ARCHITETTURA 8). Puro: dal viewport
 * e dalle dimensioni del merletto ai rettangoli in px CSS.
 *
 * Telefono (stretto), dall'alto in basso dentro la safe area:
 *   barra alta 52 · intestazione 40 · merletto (il resto) · richieste 36 ·
 *   fusi 128 · azioni 72.
 * Largo (≥ 900 px e rapporto ≥ 1,15): Bigliettini a sinistra (300), tombolo al
 * centro (massimo 640), Taccuino a destra (320); se al centro restano meno di
 * 480 px il pannello di destra si chiude (si apre come sovrapposizione).
 * Stretto: centrato con larghezza massima 720 (verticale) o 520 (orizzontale).
 *
 * Colonne larghe almeno 52 px (a 360 px con 6 colonne: 54); righe alte 40-56 px.
 */
import type { Viewport } from '../core/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const BAND = { hud: 52, header: 40, requests: 36, spindles: 128, actions: 72 } as const;
export const PANEL_LEFT = 300;
export const PANEL_RIGHT = 320;
export const CENTER_MAX = 640;
export const CENTER_MIN_WITH_RIGHT = 480;
export const NARROW_MAX_PORTRAIT = 720;
export const NARROW_MAX_LANDSCAPE = 520;
/**
 * Colonna delle etichette delle ore, a sinistra: il numero dell'ora e, accanto,
 * l'icona di un evento sul bordo del Molo (D06: l'icona non sostituisce il numero).
 */
export const GUTTER = 34;
/** A destra, l'icona di un evento sul bordo del Faro. */
export const RIGHT_PAD = 14;
export const COL_MIN = 52;
export const COL_MAX = 112;
export const ROW_MIN = 40;
export const ROW_MAX = 56;
/** Altezza della riga d'apertura rispetto a una riga normale. */
export const OPEN_ROW = 0.6;
/** Margine fra il merletto e i bordi della sua area. */
export const LACE_PAD = 8;
/** Righe future visibili sotto la riga corrente. */
export const FUTURE_VISIBLE = 2;
/** Altezza minima della fascia dei fusi sugli schermi molto bassi. */
export const SPINDLES_MIN = 80;

export interface TomboloLayout {
  cssW: number;
  cssH: number;
  kind: 'stretto' | 'largo';
  center: Rect;
  left: Rect | null;
  right: Rect | null;
  /** Largo, ma senza spazio per il Taccuino: si apre come sovrapposizione. */
  rightCollapsed: boolean;
  hud: Rect;
  header: Rect;
  lace: Rect;
  requests: Rect;
  spindles: Rect;
  actions: Rect;
  /** Lampada dei suggerimenti: in fondo a destra della striscia delle richieste. */
  lamp: Rect;
  cols: number;
  colW: number;
  /** Bordo sinistro di ogni colonna. */
  colX: number[];
  /** Centro di ogni colonna. */
  colCx: number[];
  /** Centro delle etichette delle ore. */
  gutterCx: number;
  rows: number;
  rowH: number;
  openH: number;
  contentH: number;
  /** Altezza del fuso disegnato (il fotogramma 96×320 è scalato). */
  spindleH: number;
  spindleW: number;
  /** Fascia della nota a margine sopra il merletto (0 se non c'è). */
  noteBand: number;
}

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x: Math.round(x), y: Math.round(y), w: Math.max(0, Math.round(w)), h: Math.max(0, Math.round(h)) };
}

export interface LayoutOptions {
  /**
   * Fascia per la nota a margine fra l'intestazione delle colonne e il merletto
   * (D04): il merletto scende di tanto per farle posto. 0 = nessuna.
   */
  noteBand?: number;
  /** Altezza della barra alta quando le scritte vanno a capo (D16; minimo 52). */
  hud?: number;
}

export function computeTomboloLayout(vp: Pick<Viewport, 'cssW' | 'cssH' | 'safe' | 'layout' | 'orientation'>, cols: number, rows: number, opts: LayoutOptions = {}): TomboloLayout {
  const W = Math.max(1, vp.cssW);
  const H = Math.max(1, vp.cssH);
  const safe = vp.safe;
  const top = safe.top;
  const bottom = H - safe.bottom;
  const innerX = safe.left;
  const innerW = Math.max(1, W - safe.left - safe.right);
  const n = Math.max(1, cols);

  let center: Rect;
  let left: Rect | null = null;
  let right: Rect | null = null;
  let rightCollapsed = false;
  const kind: 'stretto' | 'largo' = vp.layout;
  if (kind === 'largo') {
    const leftW = PANEL_LEFT;
    let rightW = PANEL_RIGHT;
    let mid = innerW - leftW - rightW;
    if (mid < CENTER_MIN_WITH_RIGHT) {
      rightCollapsed = true;
      rightW = 0;
      mid = innerW - leftW;
    }
    const cw = Math.min(CENTER_MAX, mid);
    // Il tombolo sta al centro dello spazio fra i pannelli.
    const cx = innerX + leftW + (mid - cw) / 2;
    left = rect(innerX, top, leftW, bottom - top);
    if (!rightCollapsed) right = rect(innerX + innerW - rightW, top, rightW, bottom - top);
    center = rect(cx, top, cw, bottom - top);
  } else {
    const maxW = vp.orientation === 'landscape' ? NARROW_MAX_LANDSCAPE : NARROW_MAX_PORTRAIT;
    const cw = Math.min(innerW, maxW);
    center = rect(innerX + (innerW - cw) / 2, top, cw, bottom - top);
  }

  // Schermi molto bassi (telefono in orizzontale nel browser): la fascia dei fusi
  // si accorcia (fino a 80 px) perché il merletto mostri almeno due righe.
  const hudH = Math.max(BAND.hud, Math.round(opts.hud ?? 0));
  const fixedBands = hudH + BAND.header + BAND.requests + BAND.actions;
  const lace0 = bottom - top - fixedBands - BAND.spindles;
  const laceMin = Math.round(ROW_MIN * (2 + OPEN_ROW) + LACE_PAD * 2);
  const spindleBand = lace0 >= laceMin ? BAND.spindles : Math.max(SPINDLES_MIN, BAND.spindles - (laceMin - lace0));
  const hud = rect(center.x, center.y, center.w, hudH);
  const header = rect(center.x, hud.y + hud.h, center.w, BAND.header);
  const actions = rect(center.x, bottom - BAND.actions, center.w, BAND.actions);
  const spindles = rect(center.x, actions.y - spindleBand, center.w, spindleBand);
  const requests = rect(center.x, spindles.y - BAND.requests, center.w, BAND.requests);
  const noteBand = Math.max(0, Math.round(opts.noteBand ?? 0));
  const laceTop = header.y + header.h + noteBand;
  const lace = rect(center.x, laceTop, center.w, Math.max(0, requests.y - laceTop));
  const lamp = rect(center.x + center.w - 52, requests.y + (requests.h - 48) / 2, 48, 48);

  const avail = Math.max(1, center.w - GUTTER - RIGHT_PAD);
  const colW = Math.max(1, Math.min(COL_MAX, Math.floor((avail / n) * 100) / 100));
  const x0 = center.x + GUTTER + (avail - colW * n) / 2;
  const colX: number[] = [];
  const colCx: number[] = [];
  for (let i = 0; i < n; i++) {
    colX.push(x0 + colW * i);
    colCx.push(x0 + colW * (i + 0.5));
  }
  const r = Math.max(1, rows);
  const fit = (lace.h - LACE_PAD * 2) / (r + OPEN_ROW);
  const rowH = Math.round(Math.max(ROW_MIN, Math.min(ROW_MAX, fit)));
  const openH = Math.round(rowH * OPEN_ROW);
  const spindleH = spindleBand - 10;
  const spindleW = Math.round((spindleH * 96) / 320);
  return {
    cssW: W,
    cssH: H,
    kind,
    center,
    left,
    right,
    rightCollapsed,
    hud,
    header,
    lace,
    requests,
    spindles,
    actions,
    lamp,
    cols: n,
    colW,
    colX,
    colCx,
    gutterCx: center.x + 10,
    rows: r,
    rowH,
    openH,
    contentH: openH + r * rowH,
    spindleH,
    spindleW,
    noteBand,
  };
}

/** Y (nel contenuto del merletto) del bordo alto della riga `i` (0 = apertura, i = ora startHour + i). */
export function rowTop(l: Pick<TomboloLayout, 'rowH' | 'openH'>, i: number): number {
  return i <= 0 ? 0 : l.openH + (i - 1) * l.rowH;
}

/** Y (nel contenuto) del bordo basso della riga `i`: lì i fili sono nelle posizioni di quell'ora. */
export function rowBottom(l: Pick<TomboloLayout, 'rowH' | 'openH'>, i: number): number {
  return i <= 0 ? l.openH : l.openH + i * l.rowH;
}

/**
 * Scorrimento automatico: il merletto parte dall'alto e, quando non ci sta più,
 * le righe passate salgono così che sotto la riga corrente restino visibili
 * almeno due righe future (con i loro spilli). A merletto corto si vede tutto.
 */
export function autoScroll(l: Pick<TomboloLayout, 'rowH' | 'openH' | 'rows' | 'lace' | 'contentH'>, cur: number): number {
  const i = Math.max(1, Math.min(l.rows, cur));
  // Le righe future contano solo se c'è posto: la riga corrente resta sempre visibile.
  const future = Math.min(FUTURE_VISIBLE, Math.max(0, Math.floor((l.lace.h - LACE_PAD * 2) / Math.max(1, l.rowH)) - 1));
  let want = rowBottom(l, i) + future * l.rowH - (l.lace.h - LACE_PAD);
  want = Math.min(want, rowTop(l, i) - LACE_PAD);
  const max = l.contentH - l.lace.h + LACE_PAD;
  return Math.max(-LACE_PAD, Math.min(want, max));
}

/** Limiti dello scorrimento manuale: dall'apertura in alto fino all'ultima riga. */
export function scrollLimits(l: Pick<TomboloLayout, 'rowH' | 'openH' | 'rows' | 'lace' | 'contentH'>, cur: number): { min: number; max: number } {
  const a = autoScroll(l, cur);
  return { min: Math.min(a, -LACE_PAD), max: Math.max(a, l.contentH - l.lace.h + LACE_PAD) };
}

/** Colonna sotto una x (−1 se fuori). */
export function columnAt(l: Pick<TomboloLayout, 'colX' | 'colW' | 'cols'>, x: number): number {
  const x0 = l.colX[0] ?? 0;
  const i = Math.floor((x - x0) / l.colW);
  return i >= 0 && i < l.cols ? i : -1;
}

/** Coppia di colonne più vicina a una x nella riga (−1 se fuori). */
export function pairAt(l: Pick<TomboloLayout, 'colX' | 'colW' | 'cols'>, x: number): number {
  const x0 = l.colX[0] ?? 0;
  const p = Math.floor((x - x0) / l.colW - 0.5);
  return p >= 0 && p < l.cols - 1 ? p : -1;
}

export function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export interface NotePlacement {
  /** pannello: in cima al pannello di sinistra (largo); righe: sopra le righe fissate; fascia: fra intestazione e merletto. */
  mode: 'pannello' | 'righe' | 'fascia';
  rect: Rect;
  /** Altezza della fascia da aprire sopra il merletto (solo in modo `fascia`). */
  band: number;
}

/** Margine fra la nota e quello che non deve coprire. */
export const NOTE_GAP = 6;

/**
 * Posto della nota a margine (D04). `base` è la disposizione SENZA fascia della
 * nota; `current` la riga corrente; `obstacles` le righe fissate con uno spillo o
 * uno slot (indici). Nel layout largo la nota va in cima al pannello di sinistra.
 * Nello stretto va sopra le righe già fissate se lì c'è posto senza toccare spilli
 * e slot; altrimenti in una fascia fra l'intestazione e il merletto, che scende.
 * Mai sulla riga corrente, sulle righe future, sui fusi, sulle richieste o sulle azioni.
 */
export function placeMarginNote(base: TomboloLayout, current: number, obstacles: readonly number[], noteW: number, noteH: number): NotePlacement {
  const h = Math.max(1, Math.round(noteH));
  if (base.kind === 'largo' && base.left) {
    const r = base.left;
    return { mode: 'pannello', rect: rect(r.x + 8, r.y + 8, r.w - 16, h), band: 0 };
  }
  const w = Math.max(1, Math.min(Math.round(noteW), base.center.w - 16));
  const x = base.center.x + (base.center.w - w) / 2;
  const scroll = autoScroll(base, current);
  const top = base.lace.y + NOTE_GAP;
  const bottom = base.lace.y - scroll + rowTop(base, Math.max(1, current)) - NOTE_GAP;
  // Spilli e slot delle righe fissate: la testa sta ~11 px sopra il fondo della riga.
  const blocked = obstacles
    .filter((i) => i >= 0 && i < current)
    .map((i) => {
      const y = base.lace.y - scroll + rowBottom(base, i);
      return { y0: y - 22, y1: y + 4 };
    });
  for (let y = top; y + h <= bottom; y += 4) {
    if (blocked.every((b) => y + h <= b.y0 || y >= b.y1)) return { mode: 'righe', rect: rect(x, y, w, h), band: 0 };
  }
  const band = h + NOTE_GAP * 2;
  return { mode: 'fascia', rect: rect(x, base.header.y + base.header.h + NOTE_GAP, w, h), band };
}
