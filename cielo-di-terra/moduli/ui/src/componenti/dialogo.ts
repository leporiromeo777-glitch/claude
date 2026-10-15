import { Componente } from '../core/componente';
import { h, svuota } from '../core/dom';
import { nodiTesto, testoSemplice } from '../core/testo';
import './dialogo.css';

export interface RispostaDialogo {
  testo: string;
  /** Risposta visibile ma non sceglibile (es. manca un oggetto). */
  disabilitata?: boolean;
  /** Nota a matita accanto alla risposta (es. «serve la Mezza Chiave»). */
  nota?: string;
  /** Già scelta in una conversazione precedente: scritta più chiara. */
  giaDetta?: boolean;
}

export interface BattutaDialogo {
  /** Nome di chi parla (es. «Ottavio, detto Ventin»). */
  chi: string;
  /** Come appare, in breve: i personaggi sono velati e non hanno ritratti. */
  aspetto?: string;
  /** Testo della battuta (markup: [[tecnica|locale]], *corsivo*). */
  testo: string;
  /** Risposte di Elvira; se mancano, la battuta si chiude con Invio/clic («avanti»). */
  risposte?: RispostaDialogo[];
}

export interface VoceStorico {
  chi: string;
  testo: string;
  /** Vero per le risposte di Elvira. */
  elvira: boolean;
}

export interface EventiDialogo {
  /** L'utente ha scelto la risposta con questo indice (0-based). */
  scelta: number;
  /** Battuta senza risposte: l'utente va avanti. */
  avanti: void;
  /** Il testo della battuta è comparso tutto. */
  testoCompleto: void;
}

export interface OpzioniDialogo {
  /** Caratteri al secondo (Infinity = tutto subito). Letta a ogni battuta. */
  caratteriAlSecondo?: () => number;
  /** Quante voci tiene lo storico (predefinito 40). */
  maxStorico?: number;
  /** Nome con cui compaiono le risposte nello storico (predefinito «Elvira»). */
  nomeProtagonista?: string;
}

/** Pause in più (in caratteri equivalenti) dopo la punteggiatura, per un ritmo parlato. */
const PAUSA_DOPO: Record<string, number> = { ',': 4, ';': 6, ':': 6, '.': 10, '!': 10, '?': 10, '…': 12, '»': 2 };

/**
 * Finestra di dialogo: nome, aspetto, testo che compare progressivamente (saltabile),
 * risposte numerate (1-9, frecce, mouse) e storico delle ultime battute (H).
 */
export class FinestraDialogo extends Componente<EventiDialogo> {
  private readonly box: HTMLDivElement;
  private readonly nome: HTMLSpanElement;
  private readonly aspetto: HTMLSpanElement;
  private readonly testo: HTMLDivElement;
  private readonly testoSr: HTMLDivElement;
  private readonly risposte: HTMLOListElement;
  private readonly aiuto: HTMLParagraphElement;
  private readonly pannelloStorico: HTMLDivElement;
  private readonly listaStorico: HTMLOListElement;
  private readonly bStorico: HTMLButtonElement;
  private readonly opz: Required<OpzioniDialogo>;
  private battuta: BattutaDialogo | null = null;
  private caratteri: HTMLSpanElement[] = [];
  private pesi: number[] = [];
  private rivelati = 0;
  private avanzamento = 0;
  private ultimoTempo = 0;
  private raf = 0;
  private completo = false;
  private storico: VoceStorico[] = [];

  constructor(opz: OpzioniDialogo = {}) {
    super({ classe: 'ui-modale ui-dialogo', modale: true, ruolo: 'dialog', etichetta: 'Dialogo' });
    this.opz = {
      caratteriAlSecondo: opz.caratteriAlSecondo ?? (() => 50),
      maxStorico: opz.maxStorico ?? 40,
      nomeProtagonista: opz.nomeProtagonista ?? 'Elvira',
    };

    this.nome = h('span', { class: 'ui-dlg-nome' });
    this.aspetto = h('span', { class: 'ui-dlg-aspetto' });
    this.bStorico = h(
      'button',
      { class: 'ui-bottone ui-bottone--leggero ui-dlg-bstorico', type: 'button', 'aria-expanded': 'false', onclick: () => this.toggleStorico() },
      'Storico',
      h('span', { class: 'ui-tasto', 'aria-hidden': 'true' }, 'H'),
    );
    this.testo = h('div', { class: 'ui-dlg-testo', 'aria-hidden': 'true' });
    this.testoSr = h('div', { class: 'ui-sr', 'aria-live': 'polite' });
    this.risposte = h('ol', { class: 'ui-dlg-risposte', 'aria-label': 'Risposte' });
    this.aiuto = h('p', { class: 'ui-dlg-aiuto' });

    this.box = h(
      'div',
      { class: 'ui-carta ui-dlg-box', tabindex: -1 },
      h('header', { class: 'ui-dlg-testa' }, h('div', { class: 'ui-dlg-chi' }, this.nome, this.aspetto), this.bStorico),
      this.testo,
      this.testoSr,
      this.risposte,
      this.aiuto,
    );
    this.box.addEventListener('click', (e) => {
      if ((e.target as Element).closest('button')) return;
      this.avantiOCompleta();
    });

    this.listaStorico = h('ol', { class: 'ui-dlg-storico-lista' });
    this.pannelloStorico = h(
      'div',
      { class: 'ui-carta ui-dlg-storico', hidden: true, id: 'ui-dlg-storico', role: 'log', 'aria-label': 'Storico del dialogo', tabindex: -1 },
      h('h3', { class: 'ui-titoletto ui-dlg-storico-titolo' }, 'Le ultime battute'),
      this.listaStorico,
    );
    this.bStorico.setAttribute('aria-controls', 'ui-dlg-storico');

    this.el.append(h('div', { class: 'ui-dlg-ombra', 'aria-hidden': 'true' }), h('div', { class: 'ui-dlg-colonna' }, this.pannelloStorico, this.box));
  }

  /** Mostra una battuta (apre la finestra se è chiusa). Il testo comincia a comparire subito. */
  show(battuta: BattutaDialogo): void {
    this.battuta = battuta;
    this.aggiungiStorico({ chi: battuta.chi, testo: testoSemplice(battuta.testo), elvira: false });
    this.nome.textContent = battuta.chi;
    this.aspetto.textContent = battuta.aspetto ?? '';
    this.aspetto.hidden = !battuta.aspetto;
    this.el.setAttribute('aria-label', `Dialogo con ${battuta.chi}`);
    this.testoSr.textContent = `${battuta.chi}: ${testoSemplice(battuta.testo)}`;
    this.preparaTesto(battuta.testo);
    svuota(this.risposte);
    this.risposte.hidden = true;
    this.aiuto.textContent = '';
    this.completo = false;
    this.apri();
    this.box.focus({ preventScroll: true });
    this.avvia();
  }

  /** Fa comparire subito tutto il testo della battuta. */
  completa(): void {
    if (this.completo || !this.battuta) return;
    cancelAnimationFrame(this.raf);
    for (let i = this.rivelati; i < this.caratteri.length; i++) this.caratteri[i]!.classList.add('ui-visibile');
    this.rivelati = this.caratteri.length;
    this.fineTesto();
  }

  /** Vero quando il testo è comparso per intero. */
  get testoFinito(): boolean {
    return this.completo;
  }

  /** Copia dello storico (dalla più vecchia alla più recente). */
  get vociStorico(): readonly VoceStorico[] {
    return [...this.storico];
  }

  /** Aggiunge una voce allo storico (es. una battuta detta fuori dalla finestra, come un sottotitolo). */
  aggiungiStorico(v: VoceStorico): void {
    this.storico.push(v);
    if (this.storico.length > this.opz.maxStorico) this.storico.splice(0, this.storico.length - this.opz.maxStorico);
    if (!this.pannelloStorico.hidden) this.disegnaStorico();
  }

  pulisciStorico(): void {
    this.storico = [];
    this.disegnaStorico();
  }

  /** Apre o chiude lo storico. */
  toggleStorico(vero = this.pannelloStorico.hidden): void {
    this.pannelloStorico.hidden = !vero;
    this.bStorico.setAttribute('aria-expanded', String(vero));
    if (vero) {
      this.disegnaStorico();
      this.listaStorico.scrollTop = this.listaStorico.scrollHeight;
    }
  }

  protected override focusIniziale(): HTMLElement | null {
    return this.box;
  }

  override gestisciTasto(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (e.key === 'h' || e.key === 'H') {
      this.toggleStorico();
      return true;
    }
    if (e.key === 'Escape' && !this.pannelloStorico.hidden) {
      this.toggleStorico(false);
      return true;
    }
    if (/^[1-9]$/.test(e.key) && this.completo) {
      const i = Number(e.key) - 1;
      const b = this.bottoniRisposta()[i];
      if (b && !b.disabled) {
        this.scegli(i);
        return true;
      }
      return false;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!this.completo) return true;
      const lista = this.bottoniRisposta().filter((b) => !b.disabled);
      if (!lista.length) return true;
      const i = lista.indexOf(document.activeElement as HTMLButtonElement);
      const j = e.key === 'ArrowDown' ? (i + 1) % lista.length : i <= 0 ? lista.length - 1 : i - 1;
      lista[j]!.focus();
      return true;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      // Invio su una risposta con il focus: lo gestisce il bottone stesso.
      if ((document.activeElement as Element | null)?.closest?.('.ui-dlg-risposta, .ui-dlg-bstorico')) return false;
      this.avantiOCompleta();
      return true;
    }
    return false;
  }

  protected override quandoNascosto(): void {
    cancelAnimationFrame(this.raf);
    this.toggleStorico(false);
  }

  private avantiOCompleta(): void {
    if (!this.completo) {
      this.completa();
      return;
    }
    if (!this.battuta?.risposte?.length) this.emit('avanti');
  }

  private scegli(i: number): void {
    const r = this.battuta?.risposte?.[i];
    if (!r || r.disabilitata) return;
    this.aggiungiStorico({ chi: this.opz.nomeProtagonista, testo: testoSemplice(r.testo), elvira: true });
    this.emit('scelta', i);
  }

  private bottoniRisposta(): HTMLButtonElement[] {
    return [...this.risposte.querySelectorAll<HTMLButtonElement>('.ui-dlg-risposta')];
  }

  /** Scompone il testo in caratteri nascosti, conservando il markup. */
  private preparaTesto(sorgente: string): void {
    svuota(this.testo);
    this.testo.append(nodiTesto(sorgente));
    this.caratteri = [];
    this.pesi = [];
    const camminatore = document.createTreeWalker(this.testo, NodeFilter.SHOW_TEXT);
    const nodi: Text[] = [];
    while (camminatore.nextNode()) nodi.push(camminatore.currentNode as Text);
    for (const nodo of nodi) {
      // Il testo per i lettori di schermo dentro le parole barrate non va animato.
      if (nodo.parentElement?.classList.contains('ui-sr')) continue;
      const frammento = document.createDocumentFragment();
      // Raggruppa per parola, così le righe non vanno a capo a metà parola durante la comparsa.
      for (const parte of nodo.data.split(/(\s+)/)) {
        if (!parte) continue;
        if (/^\s+$/.test(parte)) {
          frammento.append(document.createTextNode(parte));
          continue;
        }
        const parola = document.createElement('span');
        parola.className = 'ui-dlg-parola';
        for (const ch of parte) {
          const span = document.createElement('span');
          span.className = 'ui-dlg-c';
          span.textContent = ch;
          parola.append(span);
          this.caratteri.push(span);
          this.pesi.push(1 + (PAUSA_DOPO[ch] ?? 0));
        }
        frammento.append(parola);
      }
      nodo.replaceWith(frammento);
    }
    this.rivelati = 0;
    this.avanzamento = 0;
  }

  private avvia(): void {
    cancelAnimationFrame(this.raf);
    const cps = this.opz.caratteriAlSecondo();
    if (!Number.isFinite(cps) || cps <= 0 || this.ridotto()) {
      this.completa();
      return;
    }
    this.ultimoTempo = performance.now();
    const passo = (t: number): void => {
      const dt = Math.min(0.1, (t - this.ultimoTempo) / 1000);
      this.ultimoTempo = t;
      this.avanzamento += dt * cps;
      while (this.rivelati < this.caratteri.length && this.avanzamento >= this.pesi[this.rivelati]!) {
        this.avanzamento -= this.pesi[this.rivelati]!;
        this.caratteri[this.rivelati]!.classList.add('ui-visibile');
        this.rivelati++;
      }
      if (this.rivelati >= this.caratteri.length) this.fineTesto();
      else this.raf = requestAnimationFrame(passo);
    };
    this.raf = requestAnimationFrame(passo);
  }

  private fineTesto(): void {
    if (this.completo) return;
    this.completo = true;
    this.mostraRisposte();
    this.emit('testoCompleto');
  }

  private mostraRisposte(): void {
    const b = this.battuta;
    svuota(this.risposte);
    if (!b?.risposte?.length) {
      this.risposte.hidden = true;
      this.aiuto.replaceChildren(h('span', { class: 'ui-tasto' }, 'Invio'), ' oppure un clic per continuare');
      this.aiuto.classList.add('ui-dlg-aiuto--avanti');
      return;
    }
    this.aiuto.classList.remove('ui-dlg-aiuto--avanti');
    b.risposte.forEach((r, i) => {
      const bottone = h(
        'button',
        {
          type: 'button',
          class: `ui-dlg-risposta${r.giaDetta ? ' ui-dlg-risposta--detta' : ''}`,
          disabled: !!r.disabilitata,
          onclick: () => this.scegli(i),
          onmouseenter: (e: Event) => (e.currentTarget as HTMLButtonElement).focus({ preventScroll: true }),
        },
        h('span', { class: 'ui-dlg-numero', 'aria-hidden': 'true' }, i < 9 ? String(i + 1) : '·'),
        h('span', { class: 'ui-dlg-risposta-testo' }, nodiTesto(r.testo)),
        r.nota ? h('span', { class: 'ui-dlg-risposta-nota' }, r.nota) : null,
      );
      this.risposte.append(h('li', null, bottone));
    });
    this.risposte.hidden = false;
    this.aiuto.replaceChildren(
      h('span', { class: 'ui-tasto' }, '1'),
      '–',
      h('span', { class: 'ui-tasto' }, String(Math.min(9, b.risposte.length))),
      ', frecce o mouse per rispondere',
    );
    const primo = this.bottoniRisposta().find((x) => !x.disabled);
    primo?.focus({ preventScroll: true });
  }

  private disegnaStorico(): void {
    svuota(this.listaStorico);
    for (const v of this.storico) {
      this.listaStorico.append(
        h('li', { class: v.elvira ? 'ui-dlg-st-elvira' : '' }, h('span', { class: 'ui-dlg-st-chi' }, v.chi), h('span', { class: 'ui-dlg-st-testo' }, v.testo)),
      );
    }
    if (!this.storico.length) this.listaStorico.append(h('li', { class: 'ui-nota' }, 'Ancora nessuna battuta.'));
  }
}
