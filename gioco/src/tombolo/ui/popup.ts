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
import type { InputRouter, Unsub } from '../../core/types';
import { el, clear } from '../../core/ui/dom';
import { iconButton, textOf, setTextParams } from '../../core/ui/components';
import type { Rect } from '../layout';

export type Params = Record<string, string | number>;

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

/** Scheda modale del tombolo (una sola alla volta). */
export class Popup {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  private popLayer: Unsub | null = null;
  private closed = false;

  constructor(
    private readonly deps: PopupDeps,
    o: { test: string; className?: string; labelKey?: string },
  ) {
    this.body = el('div', { class: 'tb-popup-body' });
    const close = iconButton({ icon: 'chiudi', labelKey: 'tombolo.ui.chiudi', onClick: () => this.close(), className: 'tb-popup-close', test: `${o.test}-chiudi` });
    close.dataset.audioSilent = '1';
    this.el = el('div', { class: ['tb-popup', 'core-solid', o.className], role: 'dialog', attrs: { 'aria-modal': 'true' }, test: o.test }, close, this.body);
    if (o.labelKey) {
      this.el.dataset.i18nLabel = o.labelKey;
    }
  }

  open(anchor: Rect): this {
    this.position(anchor);
    this.deps.host.appendChild(this.el);
    this.popLayer = this.deps.input.pushLayer('tb-popup');
    this.deps.input.onAction((a) => {
      if (a.action === 'back') {
        this.close();
        return true;
      }
      // Le altre azioni non arrivano al merletto finché la scheda è aperta.
      return a.action !== 'notebook' && a.action !== 'tab';
    });
    const first = this.body.querySelector<HTMLElement>('button:not([disabled])') ?? this.el.querySelector<HTMLElement>('button');
    first?.focus({ preventScroll: true });
    return this;
  }

  /** Centrata in orizzontale sull'area del tombolo, sopra la barra delle azioni. */
  position(anchor: Rect): void {
    const w = Math.min(anchor.w - 16, 440);
    this.el.style.left = `${anchor.x + (anchor.w - w) / 2}px`;
    this.el.style.width = `${w}px`;
    this.el.style.bottom = `${anchor.y}px`;
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
    this.text.appendChild(textOf(key, params, 'span', { rich: true }));
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

/** Nota a margine di Clotilde (GDD 9): scritta a mano, color seppia, sul bordo del merletto. */
export class MarginNote {
  readonly el: HTMLElement;
  private readonly text: HTMLElement;
  shown: string[] = [];
  current = '';

  constructor() {
    this.text = el('p', { class: 'tb-margin-text' });
    this.el = el('aside', { class: 'tb-margin', role: 'note', test: 'tb-margine', hidden: true }, this.text);
  }

  show(key: string): void {
    if (!this.shown.includes(key)) this.shown.push(key);
    this.current = key;
    clear(this.text);
    this.text.appendChild(textOf(key, undefined, 'span', { rich: true }));
    this.el.hidden = false;
    this.el.classList.remove('tb-visibile');
    void this.el.offsetWidth;
    this.el.classList.add('tb-visibile');
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
