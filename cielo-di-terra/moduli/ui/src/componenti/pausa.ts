import { Componente } from '../core/componente';
import { h, navigazioneFrecce } from '../core/dom';
import './pausa.css';

export interface DatiPausa {
  /** Dove si trova Elvira (es. «Corbella, Piazza delle Ore»). */
  luogo?: string;
  /** Giorno e ora del cilindro (es. «Giorno 3 · le 14.20»). */
  quando?: string;
  /** Riga sul prossimo evento del cielo (la stessa del taccuino). */
  prossimoEvento?: string;
}

export interface EventiPausa {
  riprendi: void;
  taccuino: void;
  pianta: void;
  impostazioni: void;
  /** Emesso dopo la conferma. */
  esciAlTitolo: void;
}

/**
 * Menu di pausa (Esc): Riprendi, Taccuino, Pianta, Impostazioni, Esci al titolo.
 * Il gioco dietro resta fermo, velato di seppia.
 */
export class MenuPausa extends Componente<EventiPausa> {
  private readonly bRiprendi: HTMLButtonElement;
  private readonly bEsci: HTMLButtonElement;
  private readonly menu: HTMLUListElement;
  private readonly conferma: HTMLDivElement;
  private readonly luogo: HTMLParagraphElement;
  private readonly evento: HTMLParagraphElement;

  constructor() {
    super({ classe: 'ui-modale ui-pausa', modale: true, ruolo: 'dialog', etichetta: 'Pausa' });
    const voce = (testo: string, fn: () => void, tasto?: string): HTMLButtonElement =>
      h(
        'button',
        { class: 'ui-voce', type: 'button', onclick: fn },
        h('span', { class: 'ui-voce-segno', 'aria-hidden': 'true' }, '—'),
        h('span', null, testo),
        tasto ? h('span', { class: 'ui-voce-tasto' }, h('span', { class: 'ui-tasto', 'aria-label': `tasto ${tasto}` }, tasto)) : null,
      );
    this.bRiprendi = voce('Riprendi', () => this.emit('riprendi'), 'Esc');
    this.bEsci = voce('Esci al titolo', () => this.chiediUscita());
    this.menu = h(
      'ul',
      { class: 'ui-menu' },
      h('li', null, this.bRiprendi),
      h('li', null, voce('Taccuino', () => this.emit('taccuino'), 'T')),
      h('li', null, voce('Pianta', () => this.emit('pianta'), 'P')),
      h('li', null, voce('Impostazioni', () => this.emit('impostazioni'))),
      h('li', { class: 'ui-pausa-separa' }, this.bEsci),
    );
    this.conferma = h(
      'div',
      { class: 'ui-pausa-conferma', hidden: true, role: 'group', 'aria-labelledby': 'ui-pausa-conferma-d' },
      h('p', { id: 'ui-pausa-conferma-d', class: 'ui-pausa-domanda' }, 'Tornare al titolo? Il viaggio è salvato all’ultima alba o all’ultimo letto.'),
      h(
        'ul',
        { class: 'ui-menu' },
        h('li', null, voce('Sì, esci al titolo', () => this.emit('esciAlTitolo'))),
        h('li', null, voce('No, resta', () => this.annullaUscita())),
      ),
    );
    this.luogo = h('p', { class: 'ui-pausa-luogo' });
    this.evento = h('p', { class: 'ui-pausa-evento' });

    this.el.append(
      h('div', { class: 'ui-velo', 'aria-hidden': 'true', onclick: () => this.emit('riprendi') }),
      h(
        'div',
        { class: 'ui-carta ui-pausa-foglio' },
        h('h2', { class: 'ui-pausa-titolo' }, 'In pausa'),
        this.luogo,
        h('div', { class: 'ui-filetto', 'aria-hidden': 'true' }, h('span')),
        h('nav', { 'aria-label': 'Menu di pausa' }, this.menu, this.conferma),
        this.evento,
      ),
    );
    navigazioneFrecce(this.el, '.ui-voce');
  }

  show(dati: DatiPausa = {}): void {
    const righe = [dati.luogo, dati.quando].filter(Boolean).join(' · ');
    this.luogo.textContent = righe;
    this.luogo.hidden = !righe;
    this.evento.textContent = dati.prossimoEvento ?? '';
    this.evento.hidden = !dati.prossimoEvento;
    this.annullaUscita(false);
    this.apri();
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.bRiprendi;
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      if (!this.conferma.hidden) this.annullaUscita();
      else this.emit('riprendi');
      return true;
    }
    if (!this.conferma.hidden || e.ctrlKey || e.metaKey || e.altKey) return false;
    const k = e.key.toLowerCase();
    if (k === 't') {
      this.emit('taccuino');
      return true;
    }
    if (k === 'p') {
      this.emit('pianta');
      return true;
    }
    return false;
  }

  private chiediUscita(): void {
    this.menu.hidden = true;
    this.conferma.hidden = false;
    this.conferma.querySelectorAll<HTMLButtonElement>('.ui-voce')[1]?.focus();
  }

  private annullaUscita(focus = true): void {
    if (this.conferma.hidden) return;
    this.conferma.hidden = true;
    this.menu.hidden = false;
    if (focus) this.bEsci.focus();
  }
}
