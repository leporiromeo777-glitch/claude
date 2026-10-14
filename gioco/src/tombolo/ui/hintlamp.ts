/**
 * Lampada dei suggerimenti (GDD 3.13, 14): si accende dopo 60 secondi senza
 * fissare un'ora, o dopo 3 Disfa di fila sulla stessa riga. Tre gradini sempre
 * gratuiti: Spinta (l'obiettivo più urgente con una frase della nonna), Indizio
 * («Alle 10 Teresa deve passare sopra Nina»), Fantasma (l'incrocio giusto della
 * riga corrente, tratteggiato: toglie il filo d'oro della giornata).
 */
import type { HintTier } from '../../core/types';
import { el } from '../../core/ui/dom';
import { button, iconButton, textOf } from '../../core/ui/components';
import type { TomboloLayout } from '../layout';
import { place, type Params } from './popup';

export const TIERS: readonly HintTier[] = ['spinta', 'indizio', 'fantasma'];

export class HintLamp {
  readonly el: HTMLButtonElement;
  lit = false;

  constructor(onTap: () => void) {
    this.el = iconButton({ icon: 'lampada', labelKey: 'tombolo.hint.lampada', size: 48, onClick: (e) => {
      if (e.detail > 0) this.el.blur();
      onTap();
    }, test: 'tb-lampada', className: 'tb-lamp' });
    this.el.hidden = true;
  }

  setLit(on: boolean, visible: boolean): void {
    this.lit = on;
    this.el.hidden = !visible;
    this.el.classList.toggle('tb-lamp--accesa', on);
  }

  layout(l: TomboloLayout): void {
    place(this.el, l.lamp);
  }
}

export interface HintCardData {
  tier: HintTier;
  textKey: string;
  params: Params;
  /** Gradino successivo disponibile (null all'ultimo). */
  next: HintTier | null;
}

/** Contenuto della scheda del suggerimento. */
export function hintCard(d: HintCardData, onNext: (t: HintTier) => void): HTMLElement {
  const body = el('div', { class: 'tb-hint', test: 'tb-suggerimento', data: { gradino: d.tier } });
  body.appendChild(textOf(`tombolo.hint.gradino.${d.tier}`, undefined, 'h2', { className: 'tb-hint-tier' }));
  body.appendChild(textOf(d.textKey, d.params, 'p', { className: 'tb-hint-text', rich: true }));
  if (d.next) {
    const next = d.next;
    if (next === 'fantasma') body.appendChild(textOf('tombolo.hint.fantasmaAvviso', undefined, 'p', { className: 'tb-hint-warn' }));
    body.appendChild(button({ labelKey: `tombolo.hint.ancora.${next}`, kind: 'secondario', icon: 'lampada', onClick: () => onNext(next), test: 'tb-suggerimento-ancora' }));
  }
  return body;
}
