import { Componente } from '../core/componente';
import { h, navigazioneFrecce, voceMenu } from '../core/dom';
import { disegnoCilindro } from '../core/disegni';
import './titolo.css';

export interface DatiTitolo {
  /** C'è un viaggio salvato: abilita «Continua». */
  puoiContinuare: boolean;
  /** Descrizione breve del salvataggio, mostrata sotto «Continua» (es. «Giorno 3 · Corbella, alla brace»). */
  salvataggio?: string;
  /** Versione del gioco, in basso. */
  versione?: string;
}

export interface EventiTitolo {
  continua: void;
  /** Emesso dopo la conferma, se c'era un salvataggio. */
  nuovaPartita: void;
  impostazioni: void;
  crediti: void;
}

/**
 * Schermata del titolo: un cartiglio di carta a sinistra, sfondo trasparente (dietro gira il gioco).
 * Voci: Continua, Nuova partita, Impostazioni, Crediti. Frecce + Invio, oppure mouse.
 */
export class SchermataTitolo extends Componente<EventiTitolo> {
  private readonly menu: HTMLUListElement;
  private readonly conferma: HTMLDivElement;
  private readonly bContinua: HTMLButtonElement;
  private readonly bNuova: HTMLButtonElement;
  private readonly notaSalvataggio: HTMLSpanElement;
  private readonly versione: HTMLParagraphElement;
  private dati: DatiTitolo = { puoiContinuare: false };

  constructor() {
    super({ classe: 'ui-modale ui-titolo', modale: true, ruolo: 'dialog', etichetta: 'Cielo di Terra, schermata del titolo' });

    const voce = voceMenu;

    this.bContinua = voce('Continua', () => this.emit('continua'));
    this.notaSalvataggio = h('span', { class: 'ui-titolo-salvataggio' });
    this.bNuova = voce('Nuova partita', () => this.chiediNuova());
    this.menu = h(
      'ul',
      { class: 'ui-menu ui-titolo-menu' },
      h('li', null, this.bContinua, this.notaSalvataggio),
      h('li', null, this.bNuova),
      h('li', null, voce('Impostazioni', () => this.emit('impostazioni'))),
      h('li', null, voce('Crediti', () => this.emit('crediti'))),
    );

    const bSi = voce('Sì, da capo', () => this.emit('nuovaPartita'));
    const bNo = voce('No, torna indietro', () => this.annullaNuova());
    this.conferma = h(
      'div',
      { class: 'ui-titolo-conferma', hidden: true, role: 'group', 'aria-labelledby': 'ui-titolo-conferma-d' },
      h('p', { id: 'ui-titolo-conferma-d', class: 'ui-titolo-domanda' }, 'Cominciare da capo? Il viaggio salvato andrà perso.'),
      h('ul', { class: 'ui-menu' }, h('li', null, bSi), h('li', null, bNo)),
    );

    this.versione = h('p', { class: 'ui-titolo-piede' });

    const cartiglio = h(
      'div',
      { class: 'ui-carta ui-titolo-cartiglio' },
      h('div', { class: 'ui-titolo-fregio' }, disegnoCilindro({ larghezza: 300 })),
      h('h1', { class: 'ui-titolo-nome' }, 'Cielo di Terra'),
      h('div', { class: 'ui-filetto', 'aria-hidden': 'true' }, h('span')),
      h('p', { class: 'ui-titolo-sottotitolo' }, 'Chi tiene la valle'),
      h('nav', { class: 'ui-titolo-nav', 'aria-label': 'Menu principale' }, this.menu, this.conferma),
      this.versione,
    );

    this.el.append(h('div', { class: 'ui-titolo-ombra', 'aria-hidden': 'true' }), cartiglio);
    navigazioneFrecce(this.el, '.ui-voce');
  }

  /** Mostra il titolo. */
  show(dati: DatiTitolo = this.dati): void {
    this.dati = dati;
    this.bContinua.disabled = !dati.puoiContinuare;
    this.notaSalvataggio.textContent = dati.puoiContinuare && dati.salvataggio ? dati.salvataggio : '';
    this.notaSalvataggio.hidden = !this.notaSalvataggio.textContent;
    this.versione.replaceChildren(
      h('span', null, dati.versione ? `Versione ${dati.versione}` : ''),
      h('span', { class: 'ui-titolo-aiuto' }, h('span', { class: 'ui-tasto' }, '↑'), h('span', { class: 'ui-tasto' }, '↓'), ' scegli  ', h('span', { class: 'ui-tasto' }, 'Invio'), ' conferma'),
    );
    this.annullaNuova(false);
    this.apri();
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.dati.puoiContinuare ? this.bContinua : this.bNuova;
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.key === 'Escape' && !this.conferma.hidden) {
      this.annullaNuova();
      return true;
    }
    // Esc sul titolo non fa nulla (non c'è un «indietro»), ma lo consuma.
    return e.key === 'Escape';
  }

  private chiediNuova(): void {
    if (!this.dati.puoiContinuare) {
      this.emit('nuovaPartita');
      return;
    }
    this.menu.hidden = true;
    this.conferma.hidden = false;
    this.conferma.querySelectorAll<HTMLButtonElement>('.ui-voce')[1]?.focus();
  }

  private annullaNuova(focus = true): void {
    if (this.conferma.hidden) return;
    this.conferma.hidden = true;
    this.menu.hidden = false;
    if (focus) this.bNuova.focus();
  }
}
