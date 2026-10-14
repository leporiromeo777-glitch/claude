/**
 * Pezzi d'interfaccia DOM sopra il canvas del tombolo (prefisso CSS tb-):
 * - Popup: scheda di carta con chiusura (Esc / Indietro / pulsante), apre un
 *   livello modale dell'input così il merletto non riceve gesti mentre è aperta;
 * - ExplainLine: la riga che spiega un rifiuto o una violazione (GDD 10.3);
 * - MarginNote: le note a margine di Clotilde (tutorial), a mano, color seppia;
 * - StatusLine: riga di stato nascosta per gli screen reader (GDD 14);
 * - fitText: riduce il carattere finché il testo sta nel suo contenitore.
 * Tutti i testi da chiavi i18n; i nomi già tradotti arrivano come parametri.
 */
import type { ActionId, InputRouter, Unsub } from '../../core/types';
import { el, clear } from '../../core/ui/dom';
import { iconButton, textOf, setTextParams } from '../../core/ui/components';
import type { Rect } from '../layout';
import { capitalizeFirst } from '../text';

export type Params = Record<string, string | number>;

/** Maiuscola alla prima lettera del primo testo di un nodo (frasi composte che cominciano con un parametro). */
export function capitalizeNode(node: Node, locale = 'it'): void {
  const walker = node.ownerDocument?.createTreeWalker(node, 4 /* NodeFilter.SHOW_TEXT */);
  if (!walker) return;
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const v = t.nodeValue ?? '';
    if (!/\p{L}/u.test(v)) continue;
    t.nodeValue = capitalizeFirst(v, locale);
    return;
  }
}

/** Dimensione minima del testo (D16: 15 px × scala del testo). */
export function minTextPx(): number {
  if (typeof document === 'undefined') return 15;
  const v = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-scale'));
  return 15 * (Number.isFinite(v) && v > 0 ? v : 1);
}

/** Riduce il carattere (fino a `min` px) finché il testo non esce dal contenitore. */
export function fitText(node: HTMLElement, min = 11): void {
  node.style.fontSize = '';
  if (!node.isConnected || node.clientWidth === 0) return;
  let size = Number.parseFloat(getComputedStyle(node).fontSize) || 16;
  for (let guard = 0; guard < 24; guard++) {
    const over = node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1;
    if (!over || size <= min) break;
    size = Math.max(min, size - 1);
    node.style.fontSize = `${size}px`;
  }
}

export function place(node: HTMLElement, r: Rect): void {
  node.style.left = `${r.x}px`;
  node.style.top = `${r.y}px`;
  node.style.width = `${r.w}px`;
  node.style.height = `${r.h}px`;
}

export interface PopupDeps {
  input: InputRouter;
  host: HTMLElement;
  onClose?: () => void;
}

/**
 * Dove si apre una scheda: `y` è la distanza dal fondo dello schermo (scheda
 * appoggiata sopra la barra delle azioni) oppure, con `top`, la distanza dall'alto
 * (scheda in cima al merletto, lontano dai fusi e dal dito che li ha toccati).
 */
export interface PopupAnchor extends Rect {
  top?: boolean;
}

/**
 * Tocchi ignorati subito dopo l'apertura (TOM-01, D05.5): su un telefono il
 * «click di compatibilità» arriva qualche millisecondo dopo il pointerup che ha
 * aperto la scheda e cadrebbe sul pulsante che ora sta sotto il dito.
 */
export const POPUP_GUARD_MS = 350;

/** Orologio delle schede (sostituibile nei test). */
export const popupClock = { now: (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()) };

/** Scheda modale del tombolo (una sola alla volta). */
export class Popup {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private popLayer: Unsub | null = null;
  private closed = false;
  /** Tasti che la scheda gira a chi l'ha aperta (per esempio H sulla scheda del suggerimento). */
  private readonly keys: Partial<Record<ActionId, () => void>>;
  private readonly guardMs: number;
  /** Fino a quando (orologio delle schede) i clic dentro la scheda si ignorano. */
  armedAt = 0;

  constructor(
    private readonly deps: PopupDeps,
    o: { test: string; className?: string; labelKey?: string; keys?: Partial<Record<ActionId, () => void>>; guardMs?: number },
  ) {
    this.keys = o.keys ?? {};
    this.guardMs = o.guardMs ?? POPUP_GUARD_MS;
    this.body = el('div', { class: 'tb-popup-body' });
    const close = iconButton({ icon: 'chiudi', labelKey: 'tombolo.ui.chiudi', onClick: () => this.close(), className: 'tb-popup-close', test: `${o.test}-chiudi` });
    close.dataset.audioSilent = '1';
    this.el = el('div', { class: ['tb-popup', 'core-solid', o.className], role: 'dialog', attrs: { 'aria-modal': 'true' }, test: o.test }, close, this.body);
    if (o.labelKey) {
      this.el.dataset.i18nLabel = o.labelKey;
    }
    // Il clic fantasma del tocco che ha aperto la scheda non arriva ai pulsanti.
    this.el.addEventListener(
      'click',
      (e) => {
        if (popupClock.now() >= this.armedAt) return;
        e.stopPropagation();
        e.preventDefault();
      },
      true,
    );
  }

  /** La scheda accetta già i tocchi (passato il tempo di guardia)? */
  armed(): boolean {
    return popupClock.now() >= this.armedAt;
  }

  open(anchor: PopupAnchor): this {
    this.armedAt = popupClock.now() + this.guardMs;
    this.position(anchor);
    this.deps.host.appendChild(this.el);
    this.popLayer = this.deps.input.pushLayer('tb-popup');
    this.deps.input.onAction((a) => {
      if (a.action === 'back') {
        this.close();
        return true;
      }
      // Tab e Maiusc+Tab spostano il fuoco solo fra i pulsanti della scheda.
      if (a.action === 'notebook' || a.action === 'tab') {
        this.cycleFocus(a.action === 'tab');
        return true;
      }
      const fn = this.keys[a.action];
      if (fn) fn();
      // Le altre azioni non arrivano al merletto finché la scheda è aperta.
      return true;
    });
    const first = this.body.querySelector<HTMLElement>('button:not([disabled])') ?? this.el.querySelector<HTMLElement>('button');
    first?.focus({ preventScroll: true });
    return this;
  }

  private cycleFocus(backwards: boolean): void {
    const list = Array.from(this.el.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((e) => e.getClientRects().length > 0);
    if (list.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const i = active ? list.indexOf(active) : -1;
    const next = backwards ? (i <= 0 ? list.length - 1 : i - 1) : i < 0 || i >= list.length - 1 ? 0 : i + 1;
    list[next]?.focus({ preventScroll: true });
  }

  /** Centrata in orizzontale sull'area del tombolo, sopra la barra delle azioni (o in cima al merletto). */
  position(anchor: PopupAnchor): void {
    const w = Math.min(anchor.w - 16, 440);
    this.el.style.left = `${anchor.x + (anchor.w - w) / 2}px`;
    this.el.style.width = `${w}px`;
    if (anchor.top) {
      this.el.style.top = `${anchor.y}px`;
      this.el.style.bottom = '';
    } else {
      this.el.style.top = '';
      this.el.style.bottom = `${anchor.y}px`;
    }
    this.el.dataset.posto = anchor.top ? 'alto' : 'basso';
    this.el.style.maxHeight = `${Math.max(160, anchor.h)}px`;
  }

  isOpen(): boolean {
    return !this.closed && this.el.isConnected;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.el.remove();
    this.popLayer?.();
    this.popLayer = null;
    this.deps.onClose?.();
  }
}

/** Riga di spiegazione: compare in alto sul merletto e sparisce da sola. */
export class ExplainLine {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  key = '';
  params: Params = {};

  constructor() {
    this.text = el('span', { class: 'tb-explain-text' });
    this.el = el('div', { class: 'tb-explain', role: 'status', attrs: { 'aria-live': 'polite' }, test: 'tb-explain', hidden: true }, this.text);
  }

  show(key: string, params: Params, kind: 'info' | 'warn' | 'ok', ms: number): void {
    this.key = key;
    this.params = params;
    clear(this.text);
    const t = textOf(key, params, 'span', { rich: true });
    capitalizeNode(t);
    this.text.appendChild(t);
    this.el.dataset.kind = kind;
    this.el.hidden = false;
    this.el.classList.remove('tb-visibile');
    void this.el.offsetWidth;
    this.el.classList.add('tb-visibile');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), ms);
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.el.classList.remove('tb-visibile');
    this.el.hidden = true;
    this.key = '';
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}

/**
 * Riga di motivo sotto il merletto, sopra «Fissa l'ora» (D04: un solo messaggio
 * per violazione; TOM-03: perché «Chiudi il merletto» non chiude). Non prende i
 * tocchi e sparisce da sola.
 */
export class ReasonLine {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  private timer: ReturnType<typeof setTimeout> | null = null;
  key = '';
  params: Params = {};

  constructor(test: string) {
    this.text = el('span', { class: 'tb-motivo-text' });
    this.el = el('div', { class: 'tb-motivo', role: 'status', attrs: { 'aria-live': 'assertive' }, test, hidden: true }, this.text);
  }

  show(key: string, params: Params, ms = 5000): void {
    this.key = key;
    this.params = params;
    clear(this.text);
    const t = textOf(key, params, 'span', { rich: true });
    capitalizeNode(t);
    this.text.appendChild(t);
    this.el.hidden = false;
    this.el.classList.remove('tb-visibile');
    void this.el.offsetWidth;
    this.el.classList.add('tb-visibile');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), ms);
  }

  visible(): boolean {
    return !this.el.hidden;
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.el.classList.remove('tb-visibile');
    this.el.hidden = true;
    this.key = '';
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}

/**
 * Nota a margine (GDD 9, D04): di Clotilde (seppia) o di Ada (matita), scritta a
 * mano. Un tocco la chiude e non passa sotto (`pointer-events: auto`); la regia
 * decide dove metterla (mai sulla riga corrente, sugli spilli, sui fusi) e quando
 * chiuderla (prima azione valida dopo 4 s, oppure 12 s; una alla volta).
 */
export class MarginNote {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  shown: string[] = [];
  current = '';
  /** Tocco sulla nota (la regia la chiude). */
  onTap: (() => void) | null = null;

  constructor() {
    this.text = el('p', { class: 'tb-margin-text', test: 'tb-nota-margine' });
    this.el = el('aside', { class: 'tb-margin', role: 'note', test: 'tb-margine', hidden: true }, this.text);
    const stop = (e: Event): void => {
      e.stopPropagation();
    };
    this.el.addEventListener('pointerdown', stop);
    this.el.addEventListener('pointerup', stop);
    this.el.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.onTap?.();
    });
  }

  show(key: string, hand: 'clotilde' | 'ada' = 'clotilde'): void {
    if (!this.shown.includes(key)) this.shown.push(key);
    this.current = key;
    this.el.classList.toggle('tb-margin--ada', hand === 'ada');
    this.el.dataset.mano = hand;
    clear(this.text);
    this.text.appendChild(textOf(key, undefined, 'span', { rich: true }));
    this.el.hidden = false;
    this.el.classList.remove('tb-visibile');
    void this.el.offsetWidth;
    this.el.classList.add('tb-visibile');
  }

  visible(): boolean {
    return !this.el.hidden && this.current !== '';
  }

  /** Altezza della nota alla larghezza data (stima se il browser non misura, come nei test). */
  measure(width: number): number {
    this.el.style.width = `${width}px`;
    const h = this.el.offsetHeight;
    if (h > 0) return h;
    const chars = (this.text.textContent ?? '').length;
    const perLine = Math.max(10, Math.floor(width / 11));
    return Math.max(44, Math.ceil(chars / perLine) * 26 + 18);
  }

  hide(): void {
    this.current = '';
    this.el.classList.remove('tb-visibile');
    this.el.hidden = true;
  }
}

/** Riga di stato per gli screen reader («Ore 9. Teresa al Forno, …»). */
export class StatusLine {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  value = '';

  constructor() {
    this.text = textOf('tombolo.sr.vuoto', undefined, 'span');
    this.el = el('div', { class: 'core-sr-only', role: 'status', attrs: { 'aria-live': 'polite', 'aria-atomic': 'true' }, test: 'tb-stato' }, this.text);
  }

  set(key: string, params: Params): void {
    this.text.dataset.i18n = key;
    setTextParams(this.text, params);
    this.value = this.text.textContent ?? '';
  }
}
