import { Emettitore } from './emettitore';
import { focalizzabili, trappolaFocus } from './dom';

/** Eventi comuni a tutti i componenti. */
export interface EventiBase {
  /** Il componente è diventato visibile. */
  mostrato: void;
  /** Il componente è stato nascosto. */
  nascosto: void;
}

export interface OpzioniComponente {
  /** Classe CSS del contenitore (oltre a `ui-componente`). */
  classe: string;
  /**
   * Un componente modale prende tastiera e mouse (menu, taccuino, Pianta…): quando è aperto il gioco
   * deve liberare il puntatore. Il focus resta intrappolato dentro e torna dov'era alla chiusura.
   */
  modale: boolean;
  /** Ruolo ARIA del contenitore (es. 'dialog'). */
  ruolo?: string;
  /** Etichetta accessibile del contenitore. */
  etichetta?: string;
}

/** Durata massima delle transizioni di apertura/chiusura (ms); oltre, il componente si nasconde comunque. */
const DURATA_TRANSIZIONE = 320;

/**
 * Base di tutti i componenti: un contenitore DOM montato su una radice, mostrato e nascosto
 * con una dissolvenza, con eventi tipizzati.
 *
 * Le sottoclassi espongono un loro `show(…)` (con i dati che servono) che alla fine chiama `apri()`.
 */
export abstract class Componente<E extends object = object> extends Emettitore<E & EventiBase> {
  readonly el: HTMLElement;
  readonly modale: boolean;
  protected radice: HTMLElement | null = null;
  private aperto = false;
  private focusPrecedente: HTMLElement | null = null;
  private togliTrappola: (() => void) | null = null;
  private timerChiusura: ReturnType<typeof setTimeout> | null = null;

  constructor(opz: OpzioniComponente) {
    super();
    this.modale = opz.modale;
    this.el = document.createElement('div');
    this.el.className = `ui-componente ${opz.classe}`;
    this.el.hidden = true;
    if (opz.ruolo) this.el.setAttribute('role', opz.ruolo);
    if (opz.etichetta) this.el.setAttribute('aria-label', opz.etichetta);
    if (opz.modale && opz.ruolo === 'dialog') this.el.setAttribute('aria-modal', 'true');
  }

  /** Monta il componente dentro `radice` (di solito il contenitore dell'interfaccia sopra il canvas). */
  mount(radice: HTMLElement): this {
    this.radice = radice;
    radice.append(this.el);
    return this;
  }

  /** Vero se il componente è aperto. */
  get visible(): boolean {
    return this.aperto;
  }

  /** Nasconde il componente (con dissolvenza, se i movimenti non sono ridotti). */
  hide(): void {
    if (!this.aperto) return;
    this.aperto = false;
    this.el.classList.remove('ui-aperto');
    this.togliTrappola?.();
    this.togliTrappola = null;
    this.quandoNascosto();
    const fine = (): void => {
      this.timerChiusura = null;
      if (!this.aperto) this.el.hidden = true;
    };
    if (this.ridotto()) fine();
    else this.timerChiusura = setTimeout(fine, DURATA_TRANSIZIONE);
    if (this.modale) {
      const prec = this.focusPrecedente;
      this.focusPrecedente = null;
      if (prec && prec.isConnected && this.el.contains(document.activeElement)) prec.focus({ preventScroll: true });
      else if (this.el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }
    this.emetti('nascosto');
  }

  /** Mostra o nasconde secondo `vero`. */
  toggle(vero = !this.aperto): void {
    if (vero) this.apri();
    else this.hide();
  }

  /** Smonta il componente e rimuove gli ascoltatori. */
  destroy(): void {
    this.hide();
    if (this.timerChiusura) clearTimeout(this.timerChiusura);
    this.el.remove();
    this.radice = null;
    this.offAll();
  }

  /** Apre il componente. Le sottoclassi lo chiamano alla fine del loro `show(…)`. */
  protected apri(): void {
    if (this.timerChiusura) {
      clearTimeout(this.timerChiusura);
      this.timerChiusura = null;
    }
    const giaAperto = this.aperto;
    this.aperto = true;
    this.el.hidden = false;
    if (this.ridotto()) this.el.classList.add('ui-aperto');
    else {
      // Forza il calcolo dello stile così la transizione parte davvero.
      void this.el.offsetWidth;
      this.el.classList.add('ui-aperto');
    }
    if (giaAperto) return;
    if (this.modale) {
      const attivo = document.activeElement;
      this.focusPrecedente = attivo instanceof HTMLElement && !this.el.contains(attivo) ? attivo : null;
      this.togliTrappola = trappolaFocus(this.el);
      const primo = this.focusIniziale() ?? focalizzabili(this.el)[0] ?? null;
      primo?.focus({ preventScroll: true });
    }
    this.quandoMostrato();
    this.emetti('mostrato');
  }

  /** Elemento che riceve il focus all'apertura (per i modali). */
  protected focusIniziale(): HTMLElement | null {
    return null;
  }

  /** Aggancio per le sottoclassi. */
  protected quandoMostrato(): void {}

  /** Aggancio per le sottoclassi. */
  protected quandoNascosto(): void {}

  /** Vero se l'interfaccia è in modalità «riduci i movimenti». */
  protected ridotto(): boolean {
    return !!this.el.closest('.ui-ridotto');
  }

  /**
   * Gestione dei tasti quando il componente è in cima alla pila dell'interfaccia.
   * Restituisce `true` se il tasto è stato consumato. Esc è gestito qui dalle sottoclassi.
   */
  gestisciTasto(_e: KeyboardEvent): boolean {
    return false;
  }
}
