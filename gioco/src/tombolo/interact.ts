/**
 * Interazione con il tombolo (GDD 11, ARCHITETTURA 5.3).
 *
 * Tocco e mouse:
 * - trascinare un fuso in orizzontale: oltre la metà della colonna vicina si
 *   propone l'incrocio con il fuso trascinato sopra (`checkCrossing`); un rifiuto
 *   fa rimbalzare il fuso con la riga di spiegazione; tornando indietro oltre la
 *   soglia l'incrocio si toglie; area di presa: tutta la colonna dei fusi;
 * - toccare un incrocio della riga corrente lo rovescia; trascinarlo fuori dalla
 *   riga lo toglie;
 * - trascinare in verticale sul merletto (o la rotella) scorre le ore;
 * - toccare una riga passata: anteprima e riavvolgimento (o eco, nell'Archivio);
 * - pressione lunga (o tasto destro) su un fuso: scheda del personaggio;
 * - passaggio "Appunta il tuo nome": un tocco su un fuso; Archivio: un tocco su
 *   un fuso sbiadito apre la scelta del nome; occasioni: un tocco su una cella.
 * Tastiera (GDD 11.3): ← → coppie, 1-6 filo, Spazio / Maiusc+Spazio incrocio,
 * F rovescia, Invio Fissa l'ora, Backspace/Z Disfa, ↑ ↓ PagSu PagGiù scorrono,
 * Tab Taccuino, H suggerimento, N nome, Esc pausa.
 */
import type { ActionEvent, Gesture, ThreadId } from '../core/types';
import { columnAt, inside, pairAt, rowBottom, rowTop } from './layout';
import type { NightController } from './controller';

export const DRAG_CROSS = 0.5;
/** Isteresi: sotto questa frazione della colonna l'incrocio appena proposto si toglie. */
export const DRAG_UNCROSS = 0.32;

type DragState =
  | { k: 'none' }
  | { k: 'spindle'; thread: ThreadId; col: number; baseX: number; pair: number; dir: number; rejected: boolean }
  | { k: 'crossing'; pair: number; removed: boolean }
  | { k: 'scroll'; start: number };

export class Interaction {
  private drag: DragState = { k: 'none' };
  /** Cursore della tastiera: coppia e filo scelto (per N e per il nome). */
  cursorPair = 0;
  cursorThread = 0;
  /** Cursore delle occasioni (riga). */
  cursorRow = 1;

  constructor(private readonly c: NightController) {}

  reset(): void {
    this.drag = { k: 'none' };
  }

  dragging(): ThreadId | null {
    return this.drag.k === 'spindle' ? this.drag.thread : null;
  }

  /** Riga del merletto (indice) sotto una y sullo schermo, o −1. */
  rowAt(y: number): number {
    const l = this.c.layout;
    if (!inside(l.lace, l.lace.x + 1, y)) return -1;
    const cy = y - l.lace.y + this.c.scroll;
    if (cy < 0) return -1;
    if (cy < l.openH) return 0;
    const i = Math.floor((cy - l.openH) / l.rowH) + 1;
    return i >= 1 && i <= l.rows ? i : -1;
  }

  onGesture(g: Gesture): boolean {
    const c = this.c;
    const l = c.layout;
    // La bolla del tocco si chiude al tocco successivo (che fa anche quello che deve).
    if (g.k !== 'drag' && g.k !== 'wheel') c.hideBubble();
    if (c.isBusy()) return true;
    switch (g.k) {
      case 'wheel':
        c.scrollBy(g.dy);
        return true;
      case 'longpress': {
        if (g.y >= l.spindles.y && g.y < l.spindles.y + l.spindles.h) {
          const col = columnAt(l, g.x);
          const t = col >= 0 ? c.threadAtColumn(col) : null;
          // Un filo sbiadito non ha scheda: la pressione lunga apre la scelta del nome (D05.4).
          if (t && c.isFadedThread(t) && !c.session.archive?.isConfirmed(t)) c.openNamePicker(t, { pointer: g.pointer, y: g.y });
          else if (t) c.openCharCard(t);
          return true;
        }
        return this.longpressLace(g.x, g.y, g.pointer);
      }
      case 'tap':
        return this.tap(g.x, g.y, g.button, g.pointer);
      case 'dragstart':
        return this.dragStart(g.startX, g.startY, g.x, g.y);
      case 'drag':
        return this.dragMove(g.x, g.y, g.dy);
      case 'dragend':
      case 'dragcancel':
        return this.dragEnd();
    }
  }

  /** Metà bassa della riga `i` sotto la y? (per sapere quale filo passa nella cella) */
  private lowerHalf(i: number, y: number): boolean {
    const l = this.c.layout;
    const cy = y - l.lace.y + this.c.scroll;
    return cy >= (rowTop(l, i) + rowBottom(l, i)) / 2;
  }

  /**
   * Archivio: il filo sbiadito che passa nella cella toccata (anche dopo che è
   * uscito dal merletto, D05.4), o null.
   */
  private fadedAt(i: number, x: number, y: number): ThreadId | null {
    const c = this.c;
    if (!c.session.archive) return null;
    const col = columnAt(c.layout, x);
    if (col < 0) return null;
    const t = c.threadInCell(i, col, this.lowerHalf(i, y));
    return t && c.isFadedThread(t) && !c.session.archive.isConfirmed(t) ? t : null;
  }

  private tap(x: number, y: number, button: number, pointer: 'mouse' | 'touch' | 'pen' = 'mouse'): boolean {
    const c = this.c;
    const l = c.layout;
    // Il tocco spiega (TOM-12): spilli, barche, perline, ore, filo nero; fuori dalla fascia dei fusi.
    if (button === 0 && !c.placingOccasions() && (y < l.spindles.y || y >= l.spindles.y + l.spindles.h) && c.showBubbleAt(x, y)) return true;
    if (y >= l.spindles.y && y < l.spindles.y + l.spindles.h) {
      const col = columnAt(l, x);
      const t = col >= 0 ? c.threadAtColumn(col) : null;
      if (!t) return true;
      if (button === 2) {
        if (c.isFadedThread(t) && !c.session.archive?.isConfirmed(t)) c.openNamePicker(t, { pointer, y });
        else c.openCharCard(t);
        return true;
      }
      this.cursorThread = col;
      this.cursorPair = Math.min(col, l.cols - 2);
      c.tapSpindle(t, { pointer, y });
      return true;
    }
    const i = this.rowAt(y);
    if (i < 0) return false;
    const m = c.model;
    const faded = this.fadedAt(i, x, y);
    if (c.placingOccasions()) {
      // TOM-15: il bersaglio è il cerchio disegnato (stessa funzione del disegno).
      const slot = c.occasionSlotAt(x, y);
      if (slot) {
        c.toggleOccasionCell(slot.col, slot.index);
        return true;
      }
      const col = columnAt(l, x);
      // Una cella senza occasione ammessa, ma con un filo sbiadito: si nomina il filo.
      if (faded && col >= 0 && !c.occasionCellAllowed(col, i)) {
        c.openNamePicker(faded, { pointer, y });
        return true;
      }
      if (col >= 0 && i >= 1) c.toggleOccasionCell(col, i);
      return true;
    }
    if (i === m.current && !m.done) {
      const p = pairAt(l, x);
      if (p >= 0 && c.session.draft.some((d) => d.pair === p)) {
        c.tapCurrentPair(p);
        return true;
      }
      if (faded) {
        c.openNamePicker(faded, { pointer, y });
        return true;
      }
      if (p >= 0) c.tapCurrentPair(p);
      return true;
    }
    if (faded) {
      c.openNamePicker(faded, { pointer, y });
      return true;
    }
    if (i < m.current) {
      const p = pairAt(l, x);
      c.tapPastRow(i, p);
      return true;
    }
    return true;
  }

  /** Pressione lunga sul merletto: un filo sbiadito si nomina anche così; su uno slot, la sua etichetta. */
  private longpressLace(x: number, y: number, pointer: 'mouse' | 'touch' | 'pen'): boolean {
    const i = this.rowAt(y);
    if (i < 0) return false;
    if (this.c.showBubbleAt(x, y)) return true;
    const faded = this.fadedAt(i, x, y);
    if (faded) this.c.openNamePicker(faded, { pointer, y });
    return true;
  }

  private dragStart(sx: number, sy: number, x: number, y: number): boolean {
    const c = this.c;
    const l = c.layout;
    void y;
    if (sy >= l.spindles.y && sy < l.spindles.y + l.spindles.h) {
      const col = columnAt(l, sx);
      const t = col >= 0 ? c.threadAtColumn(col) : null;
      if (!t || !c.canDragSpindles()) {
        this.drag = { k: 'none' };
        return true;
      }
      this.drag = { k: 'spindle', thread: t, col, baseX: l.colCx[col] ?? sx, pair: -1, dir: 0, rejected: false };
      c.spindlePicked(t);
      c.spindleMoved(t, this.clampX(col, x));
      return true;
    }
    const i = this.rowAt(sy);
    if (i >= 0) {
      const m = c.model;
      const p = pairAt(l, sx);
      if (i === m.current && !m.done && p >= 0 && c.session.draft.some((d) => d.pair === p) && Math.abs(x - sx) < Math.abs(y - sy) + 4) {
        this.drag = { k: 'crossing', pair: p, removed: false };
        return true;
      }
      this.drag = { k: 'scroll', start: c.scroll };
      c.beginManualScroll();
      return true;
    }
    this.drag = { k: 'none' };
    return false;
  }

  private clampX(col: number, x: number): number {
    const l = this.c.layout;
    const lo = l.colCx[Math.max(0, col - 1)] ?? 0;
    const hi = l.colCx[Math.min(l.cols - 1, col + 1)] ?? 0;
    return Math.max(lo, Math.min(hi, x));
  }

  private dragMove(x: number, y: number, dy: number): boolean {
    const c = this.c;
    const l = c.layout;
    const d = this.drag;
    void y;
    if (d.k === 'scroll') {
      c.setScroll(d.start - dy);
      return true;
    }
    if (d.k === 'crossing') {
      if (!d.removed && Math.abs(dy) > l.rowH * 0.75) {
        d.removed = true;
        c.removeCrossing(d.pair);
      }
      return true;
    }
    if (d.k !== 'spindle' || d.rejected) return true;
    const cx = this.clampX(d.col, x);
    c.spindleMoved(d.thread, cx);
    const dx = cx - d.baseX;
    if (d.pair < 0) {
      if (Math.abs(dx) <= l.colW * DRAG_CROSS) return true;
      const dir = dx > 0 ? 1 : -1;
      const n = d.col + dir;
      if (n < 0 || n >= l.cols) return true;
      const pair = Math.min(d.col, n);
      // Il filo dentro un incrocio della bozza che torna verso il compagno: si scioglie.
      const existing = c.session.draft.find((q) => q.pair === pair);
      if (existing && c.draftPartner(d.col) === n) {
        c.removeCrossing(pair);
        d.pair = pair;
        d.dir = dir;
        return true;
      }
      const v = c.cross(pair, dir > 0 ? 'L' : 'R', 'drag');
      if (v) {
        d.rejected = true;
        c.spindleBounce(d.thread, dir);
        return true;
      }
      d.pair = pair;
      d.dir = dir;
      return true;
    }
    // Ripensamento: tornando indietro oltre la soglia l'incrocio si toglie.
    if (d.dir * dx < l.colW * DRAG_UNCROSS) {
      c.removeCrossing(d.pair);
      d.pair = -1;
      d.dir = 0;
    }
    return true;
  }

  private dragEnd(): boolean {
    const d = this.drag;
    this.drag = { k: 'none' };
    if (d.k === 'spindle') {
      this.c.spindleReleased(d.thread, d.pair >= 0 || d.rejected);
      return true;
    }
    if (d.k === 'scroll') return true;
    return d.k === 'crossing';
  }

  // ───────── Tastiera ─────────

  onAction(a: ActionEvent): boolean {
    const c = this.c;
    const l = c.layout;
    if (c.isBusy() && a.action !== 'back' && a.action !== 'pause') return true;
    const W = l.cols;
    const placing = c.placingOccasions();
    switch (a.action) {
      case 'left':
      case 'right': {
        const d = a.action === 'left' ? -1 : 1;
        if (placing || c.namingByKeyboard()) {
          // Occasioni e nomi (TOM-19): il cursore va su ogni colonna, anche l'ultima.
          this.cursorThread = Math.max(0, Math.min(W - 1, this.cursorThread + d));
          this.cursorPair = Math.max(0, Math.min(W - 2, this.cursorThread));
        } else {
          this.cursorPair = Math.max(0, Math.min(W - 2, this.cursorPair + d));
          this.cursorThread = this.cursorPair;
        }
        c.keyboardCursor();
        if (!placing) c.cursorMoved(this.cursorThread);
        return true;
      }
      case 'select': {
        const n = Math.max(0, Math.min(W - 1, a.index ?? 0));
        this.cursorThread = n;
        this.cursorPair = Math.min(n, W - 2);
        c.keyboardCursor();
        if (!placing) c.cursorMoved(n);
        return true;
      }
      case 'crossL':
      case 'crossR': {
        c.keyboardCursor();
        if (placing) {
          c.toggleOccasionCell(this.cursorThread, this.cursorRow);
          return true;
        }
        if (c.session.needsNome) {
          const t = c.threadAtColumn(this.cursorThread);
          if (t) c.setNome(t);
          return true;
        }
        c.cross(this.cursorPair, a.action === 'crossL' ? 'L' : 'R', 'key');
        return true;
      }
      case 'flip':
        c.keyboardCursor();
        c.flipCrossing(this.cursorPair);
        return true;
      case 'confirm':
        // Maiusc+Invio: «Fissa fino alle N» quando è offerto (D02.3).
        if (c.consumeShiftEnter() && c.quietUntil !== null) {
          c.skipQuiet();
          return true;
        }
        c.mainAction();
        return true;
      case 'skipQuiet':
        // Maiusc+Invio (il core la manda come azione a sé): le ore quiete se sono offerte, altrimenti come Invio.
        if (c.quietUntil !== null) c.skipQuiet();
        else c.mainAction();
        return true;
      case 'fixHour':
        c.mainAction();
        return true;
      case 'undo':
        c.undo();
        return true;
      case 'up':
      case 'down':
        if (placing) {
          const rows = l.rows;
          this.cursorRow = Math.max(1, Math.min(rows, this.cursorRow + (a.action === 'up' ? -1 : 1)));
          c.keyboardCursor();
          c.revealRow(this.cursorRow);
          return true;
        }
        c.scrollBy((a.action === 'up' ? -1 : 1) * l.rowH);
        return true;
      case 'pageUp':
      case 'pageDown':
        c.scrollBy((a.action === 'pageUp' ? -1 : 1) * Math.max(l.rowH, l.lace.h * 0.8));
        return true;
      case 'notebook':
        c.openNotebook();
        return true;
      case 'hint':
        void c.nextHint();
        return true;
      case 'name': {
        const t = c.threadAtColumn(this.cursorThread);
        if (t) c.nameKey(t);
        return true;
      }
      case 'pause':
        c.openMenu();
        return true;
      case 'skip':
        c.skip();
        return true;
      case 'back':
        return c.back();
      default:
        return false;
    }
  }

  /** Y sullo schermo del centro della riga `i` (per i test e per il cursore delle occasioni). */
  rowCenterY(i: number): number {
    const l = this.c.layout;
    return l.lace.y - this.c.scroll + (rowTop(l, i) + rowBottom(l, i)) / 2;
  }
}
