/**
 * Overlay "Tocca per continuare" (GDD 10.3 "Sovrapposizioni di sistema", 13.6;
 * ARCHITETTURA 11). Compare quando, dopo una ripresa, il contesto audio non torna
 * 'running' (anche 'interrupted' su iOS dopo una telefonata). Il tocco, dentro il suo
 * gestore e quindi con l'attivazione dell'utente, richiama unlock()/resume(); l'overlay
 * sparisce appena il motore torna in esecuzione.
 *
 * Mentre è visibile apre un livello modale dell'input: anche un tasto qualsiasi riprende.
 */
import type { InputRouter, Unsub } from '../core/types';
import { el } from '../core/ui/dom';
import { textOf } from '../core/ui/components';
import './autoplay.css';

export interface AutoplayDeps {
  /** Radice dell'interfaccia (#ui-root). */
  root: HTMLElement;
  input?: InputRouter | null;
  /** Traduzione per l'etichetta accessibile. */
  t: (key: string) => string;
  /** Chiamato in modo sincrono dentro il gesto. */
  onTap: () => void;
}

export class AutoplayOverlay {
  private node: HTMLElement | null = null;
  /** Chiude il livello modale dell'input e toglie i suoi gestori. */
  private offs: Unsub[] = [];
  private previousFocus: Element | null = null;

  constructor(private readonly deps: AutoplayDeps) {}

  visible(): boolean {
    return this.node !== null;
  }

  show(): void {
    if (this.node) return;
    const tap = (e?: Event): void => {
      e?.preventDefault();
      try {
        this.deps.onTap();
      } catch (err) {
        console.warn('[audio] resume from overlay failed', err);
      }
      this.node?.classList.add('au-tocca--premuto');
    };
    const node = el(
      'div',
      {
        class: 'au-tocca core-solid',
        role: 'button',
        tabIndex: 0,
        test: 'audio-tocca',
        data: { audioSilent: '1' },
        attrs: { 'aria-label': this.deps.t('audio.autoplay.etichetta'), 'data-i18n-label': 'audio.autoplay.etichetta' },
        on: {
          pointerdown: (e) => tap(e),
          click: (e) => tap(e),
          keydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') tap(e);
          },
        },
      },
      el(
        'div',
        { class: 'au-tocca-box' },
        el('div', { class: 'au-tocca-onde', attrs: { 'aria-hidden': 'true' } }, el('span'), el('span'), el('span')),
        textOf('audio.autoplay.tocca', undefined, 'p', { className: 'au-tocca-titolo' }),
        textOf('audio.autoplay.spiegazione', undefined, 'p', { className: 'au-tocca-testo' }),
      ),
    );
    this.node = node;
    this.previousFocus = document.activeElement;
    this.deps.root.appendChild(node);
    const input = this.deps.input;
    if (input) {
      const pop = input.pushLayer('audio:tocca');
      // Qualsiasi azione (Invio, Spazio, Esc…) riprende l'audio.
      const offAction = input.onAction(() => {
        tap();
        return true;
      });
      const offGesture = input.onGesture((g) => {
        if (g.k === 'tap') tap();
        return true;
      });
      this.offs = [offAction, offGesture, pop];
    }
    try {
      node.focus({ preventScroll: true });
    } catch {
      /* fuoco non disponibile */
    }
  }

  hide(): void {
    const node = this.node;
    if (!node) return;
    this.node = null;
    node.remove();
    for (const off of this.offs.splice(0)) {
      try {
        off();
      } catch {
        /* già tolto */
      }
    }
    const prev = this.previousFocus;
    this.previousFocus = null;
    if (prev instanceof HTMLElement && prev.isConnected) {
      try {
        prev.focus({ preventScroll: true });
      } catch {
        /* niente */
      }
    }
  }
}
