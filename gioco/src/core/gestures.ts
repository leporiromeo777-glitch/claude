/**
 * Riconoscitore di gesti (ARCHITETTURA 7). Puro: riceve campioni di puntatore
 * con il loro istante e produce `Gesture`. Non tocca il DOM né il tempo reale:
 * l'input reale (input.ts) gli passa gli eventi Pointer e chiama `tick()` per la
 * pressione lunga; i test gli passano sequenze sintetiche.
 *
 * Soglie:
 * - tap: spostamento massimo ≤ 10 px e durata ≤ 300 ms;
 * - longpress: 500 ms fermo entro 10 px (annulla il tap);
 * - drag: oltre 8 px di spostamento → dragstart, drag…, dragend (dragcancel su pointercancel);
 * - un solo puntatore attivo: i tocchi successivi sono ignorati finché il primo non finisce.
 *
 * Nota: lo spostamento oltre 8 px fa partire il trascinamento prima che si
 * superino i 10 px del tap, quindi un tap riuscito si sposta di fatto al massimo 8 px.
 * Il tasto destro (e il centrale) del mouse non trascinano e non fanno pressione
 * lunga: producono solo un tap con il loro `button` (GDD 11.2: tasto destro = scheda).
 */
import type { Gesture } from './types';

export const TAP_MAX_MOVE = 10;
export const TAP_MAX_MS = 300;
export const LONGPRESS_MS = 500;
export const DRAG_THRESHOLD = 8;

export type PointerKind = 'mouse' | 'touch' | 'pen';

export interface PointerSample {
  id: number;
  x: number;
  y: number;
  /** Millisecondi (stesso orologio per tutta la sequenza). */
  t: number;
  pointer: PointerKind;
  button?: number;
}

type State = 'idle' | 'pending' | 'drag' | 'longpressed' | 'secondary';

export class GestureRecognizer {
  private state: State = 'idle';
  private id = -1;
  private pointer: PointerKind = 'mouse';
  private button = 0;
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  private x = 0;
  private y = 0;
  private maxDist = 0;

  constructor(private readonly emit: (g: Gesture) => void) {}

  /** C'è un puntatore attivo? */
  active(): boolean {
    return this.state !== 'idle';
  }

  activeId(): number {
    return this.state === 'idle' ? -1 : this.id;
  }

  /** Istante (ms) in cui scatterà la pressione lunga, o null. */
  longpressDue(): number | null {
    return this.state === 'pending' ? this.t0 + LONGPRESS_MS : null;
  }

  /** Inizio di un puntatore. Restituisce false se è ignorato (ce n'è già uno attivo). */
  down(s: PointerSample): boolean {
    if (this.state !== 'idle') return false;
    this.id = s.id;
    this.pointer = s.pointer;
    this.button = s.button ?? 0;
    this.x0 = this.x = s.x;
    this.y0 = this.y = s.y;
    this.t0 = s.t;
    this.maxDist = 0;
    this.state = this.pointer === 'mouse' && this.button !== 0 ? 'secondary' : 'pending';
    return true;
  }

  move(s: PointerSample): void {
    if (this.state === 'idle' || s.id !== this.id) return;
    this.x = s.x;
    this.y = s.y;
    const d = Math.hypot(s.x - this.x0, s.y - this.y0);
    if (d > this.maxDist) this.maxDist = d;
    // La pressione lunga si controlla anche al movimento (se il timer è in ritardo).
    if (this.state === 'pending' && s.t - this.t0 >= LONGPRESS_MS && this.maxDist <= TAP_MAX_MOVE) {
      this.fireLongpress();
      return;
    }
    if (this.state === 'pending' && this.maxDist > DRAG_THRESHOLD) {
      this.state = 'drag';
      this.emitDrag('dragstart');
      return;
    }
    if (this.state === 'drag') this.emitDrag('drag');
  }

  up(s: PointerSample): void {
    if (this.state === 'idle' || s.id !== this.id) return;
    this.x = s.x;
    this.y = s.y;
    const d = Math.hypot(s.x - this.x0, s.y - this.y0);
    if (d > this.maxDist) this.maxDist = d;
    const dur = s.t - this.t0;
    const st = this.state;
    if (st === 'pending') {
      if (dur >= LONGPRESS_MS && this.maxDist <= TAP_MAX_MOVE) {
        // Il timer non ha fatto in tempo: la pressione lunga vale comunque.
        this.fireLongpress();
      } else if (dur <= TAP_MAX_MS && this.maxDist <= TAP_MAX_MOVE) {
        this.emit({ k: 'tap', x: this.x0, y: this.y0, pointer: this.pointer, button: this.button });
      }
    } else if (st === 'secondary') {
      if (dur <= TAP_MAX_MS && this.maxDist <= TAP_MAX_MOVE) {
        this.emit({ k: 'tap', x: this.x0, y: this.y0, pointer: this.pointer, button: this.button });
      }
    } else if (st === 'drag') {
      this.emitDrag('dragend');
    }
    this.reset();
  }

  cancel(s?: Pick<PointerSample, 'id'>): void {
    if (this.state === 'idle') return;
    if (s && s.id !== this.id) return;
    if (this.state === 'drag') this.emitDrag('dragcancel');
    this.reset();
  }

  /** Da chiamare con l'orario corrente: fa scattare la pressione lunga quando è il momento. */
  tick(t: number): void {
    if (this.state === 'pending' && t - this.t0 >= LONGPRESS_MS && this.maxDist <= TAP_MAX_MOVE) {
      this.fireLongpress();
    }
  }

  wheel(x: number, y: number, dy: number): void {
    this.emit({ k: 'wheel', x, y, dy });
  }

  private fireLongpress(): void {
    this.state = 'longpressed';
    this.emit({ k: 'longpress', x: this.x0, y: this.y0, pointer: this.pointer });
  }

  private emitDrag(k: 'dragstart' | 'drag' | 'dragend' | 'dragcancel'): void {
    this.emit({
      k,
      x: this.x,
      y: this.y,
      startX: this.x0,
      startY: this.y0,
      dx: this.x - this.x0,
      dy: this.y - this.y0,
      pointer: this.pointer,
    });
  }

  private reset(): void {
    this.state = 'idle';
    this.id = -1;
    this.maxDist = 0;
  }
}
