import { Componente } from '../core/componente';
import { h } from '../core/dom';
import { disegnoCilindro } from '../core/disegni';
import './crediti.css';

/** Una sezione dei crediti: righe semplici o coppie [ruolo, nome]. */
export interface SezioneCrediti {
  titolo: string;
  righe: (string | [string, string])[];
}

export interface DatiCrediti {
  sezioni: SezioneCrediti[];
  /** Riga finale (dedica). */
  dedica?: string;
}

export interface EventiCrediti {
  chiudi: void;
}

/** Crediti di partenza: solo fatti certi (strumenti, caratteri e loro autori); l'integratore aggiunge le persone. */
export const CREDITI_PREDEFINITI: DatiCrediti = {
  sezioni: [
    {
      titolo: 'Il gioco',
      righe: ['Un open world in prima persona dentro il Verbano,', 'un giardino che gira da duecento anni.'],
    },
    {
      titolo: 'Fatto con',
      righe: [
        ['Motore', 'three.js, WebGL2'],
        ['Linguaggio', 'TypeScript, Vite'],
        ['Scrittura e codice', 'con Claude, di Anthropic'],
        ['Terra e Luna', 'texture NASA di pubblico dominio, ridipinte'],
      ],
    },
    {
      titolo: 'Caratteri',
      righe: [
        ['EB Garamond', 'Georg Duffner, Octavio Pardo'],
        ['IM Fell English', 'Igino Marini'],
        ['Caveat', 'Impallari Type'],
        ['Playwrite IT Moderna', 'TypeTogether'],
        ['Architects Daughter', 'Kimberly Geswein'],
        ['Special Elite', 'Astigmatic'],
        ['Atkinson Hyperlegible', 'Braille Institute'],
        'Tutti da Google Fonts, con licenza SIL Open Font License.',
      ],
    },
  ],
  dedica: '«Tienimi la valle, mamma.»',
};

/** Crediti: un foglio lungo che scorre piano (fermo se i movimenti sono ridotti o se lo si scorre a mano). */
export class Crediti extends Componente<EventiCrediti> {
  private readonly rotolo: HTMLDivElement;
  private readonly contenuto: HTMLDivElement;
  private raf = 0;
  private automatico = true;
  private ultimo = 0;
  private posizione = 0;

  constructor() {
    super({ classe: 'ui-modale ui-crediti', modale: true, ruolo: 'dialog', etichetta: 'Crediti' });
    this.contenuto = h('div', { class: 'ui-cr-contenuto' });
    this.rotolo = h('div', { class: 'ui-carta ui-cr-foglio', tabindex: 0, role: 'document', 'aria-label': 'Crediti' }, this.contenuto);
    const bChiudi = h(
      'button',
      { class: 'ui-bottone ui-cr-chiudi', type: 'button', onclick: () => this.emit('chiudi') },
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'Esc'),
      'Indietro',
    );
    this.el.append(h('div', { class: 'ui-velo ui-velo--scuro', 'aria-hidden': 'true' }), h('div', { class: 'ui-cr-cornice' }, this.rotolo, bChiudi));
    const ferma = (): void => {
      this.automatico = false;
    };
    this.rotolo.addEventListener('wheel', ferma, { passive: true });
    this.rotolo.addEventListener('pointerdown', ferma);
    this.rotolo.addEventListener('keydown', (e) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) ferma();
    });
  }

  show(dati: DatiCrediti = CREDITI_PREDEFINITI): void {
    this.contenuto.replaceChildren(
      h('div', { class: 'ui-cr-fregio' }, disegnoCilindro({ larghezza: 260 })),
      h('h2', { class: 'ui-cr-titolo' }, 'Cielo di Terra'),
      h('p', { class: 'ui-cr-sottotitolo' }, 'Chi tiene la valle'),
      ...dati.sezioni.map((sez) =>
        h(
          'section',
          { class: 'ui-cr-sezione' },
          h('h3', { class: 'ui-cr-sezione-titolo' }, sez.titolo),
          h(
            'ul',
            null,
            sez.righe.map((r) =>
              typeof r === 'string'
                ? h('li', { class: 'ui-cr-riga' }, r)
                : h('li', { class: 'ui-cr-coppia' }, h('span', { class: 'ui-cr-ruolo' }, r[0]), h('span', { class: 'ui-cr-nome' }, r[1])),
            ),
          ),
        ),
      ),
      ...(dati.dedica ? [h('p', { class: 'ui-cr-dedica' }, dati.dedica)] : []),
    );
    this.rotolo.scrollTop = 0;
    this.posizione = 0;
    this.automatico = true;
    this.apri();
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.key === 'Escape') {
      this.emit('chiudi');
      return true;
    }
    return false;
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.rotolo;
  }

  protected override quandoMostrato(): void {
    cancelAnimationFrame(this.raf);
    if (this.ridotto()) return;
    this.ultimo = performance.now();
    const passo = (t: number): void => {
      const dt = Math.min(0.1, (t - this.ultimo) / 1000);
      this.ultimo = t;
      if (this.automatico && t > 0) {
        this.posizione += dt * 26;
        this.rotolo.scrollTop = this.posizione;
        if (this.rotolo.scrollTop + this.rotolo.clientHeight >= this.rotolo.scrollHeight - 1) this.automatico = false;
      }
      if (this.visible) this.raf = requestAnimationFrame(passo);
    };
    // Una pausa prima di cominciare a scorrere.
    setTimeout(() => {
      if (this.visible) this.raf = requestAnimationFrame(passo);
    }, 1800);
  }

  protected override quandoNascosto(): void {
    cancelAnimationFrame(this.raf);
  }
}
