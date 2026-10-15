import { Emettitore } from './core/emettitore';
import type { Componente } from './core/componente';
import { annuncia, applicaImpostazioniVisive, creaRadice } from './radice';
import { StoreImpostazioni, VELOCITA_CARATTERI, type OpzioniStore } from './impostazioni/store';
import { SchermataTitolo } from './componenti/titolo';
import { MenuPausa, type DatiPausa } from './componenti/pausa';
import { PannelloImpostazioni } from './componenti/impostazioni';
import { FinestraDialogo } from './componenti/dialogo';
import { LettoreCarte } from './componenti/lettore';
import { Taccuino, type DatiTaccuino } from './componenti/taccuino';
import { PiantaVerbano } from './componenti/pianta';
import { Indicazioni } from './componenti/indicazioni';
import { Crediti } from './componenti/crediti';
import { SchermataCaricamento } from './componenti/caricamento';
import type { DatiPianta } from './pianta/modello';

export interface OpzioniInterfaccia {
  /** Store delle impostazioni (predefinito: uno nuovo, salvato in localStorage). */
  impostazioni?: StoreImpostazioni;
  /** Opzioni dello store se viene creato qui. */
  opzioniStore?: OpzioniStore;
  /**
   * Scorciatoie da tastiera durante il gioco: Esc = pausa, T = taccuino, P = pianta (predefinito true).
   * Nei menu i tasti sono sempre gestiti dall'interfaccia.
   */
  scorciatoie?: boolean;
  /** Dati da usare quando il taccuino si apre con la scorciatoia o dalla pausa. */
  datiTaccuino?: () => DatiTaccuino | undefined;
  /** Dati da usare quando la Pianta si apre con la scorciatoia o dalla pausa. */
  datiPianta?: () => DatiPianta | undefined;
  /** Dati della pausa (luogo, ora, prossimo evento). */
  datiPausa?: () => DatiPausa | undefined;
}

export interface EventiInterfaccia {
  /**
   * Vero quando un componente modale è aperto (menu, dialogo, carte, taccuino, Pianta):
   * il gioco deve liberare il puntatore e ignorare i comandi di movimento.
   */
  catturaInput: boolean;
  /** Il gioco è in pausa (menu di pausa o un suo sottomenu aperto). */
  pausa: boolean;
}

type ComponenteQualsiasi = Componente<object>;

/**
 * Regia dell'interfaccia: crea la radice sopra il canvas, monta tutti i componenti, gestisce la pila
 * dei modali (Esc torna indietro), la navigazione fra menu e sottomenu, le scorciatoie e le impostazioni visive.
 *
 * Il gioco ascolta gli eventi «di gioco» direttamente sui componenti (es. `ui.titolo.on('continua', …)`,
 * `ui.dialogo.on('scelta', …)`, `ui.pausa.on('esciAlTitolo', …)`) e quelli di regia qui (`catturaInput`, `pausa`).
 */
export class InterfacciaGioco extends Emettitore<EventiInterfaccia> {
  readonly radice: HTMLElement;
  readonly impostazioni: StoreImpostazioni;
  readonly indicazioni: Indicazioni;
  readonly dialogo: FinestraDialogo;
  readonly titolo: SchermataTitolo;
  readonly pausa: MenuPausa;
  readonly taccuino: Taccuino;
  readonly pianta: PiantaVerbano;
  readonly lettore: LettoreCarte;
  readonly pannelloImpostazioni: PannelloImpostazioni;
  readonly crediti: Crediti;
  readonly caricamento: SchermataCaricamento;

  private readonly pila: ComponenteQualsiasi[] = [];
  /** Da dove si è aperto un sottomenu, per tornarci con «Indietro». */
  private readonly ritorni = new Map<ComponenteQualsiasi, ComponenteQualsiasi>();
  private readonly opz: OpzioniInterfaccia;
  private catturato = false;
  private inPausa = false;
  private readonly suTasto: (e: KeyboardEvent) => void;

  constructor(contenitore: HTMLElement, opz: OpzioniInterfaccia = {}) {
    super();
    this.opz = opz;
    this.radice = creaRadice(contenitore);
    this.impostazioni = opz.impostazioni ?? new StoreImpostazioni(opz.opzioniStore);
    const imp = this.impostazioni;

    this.indicazioni = new Indicazioni();
    this.dialogo = new FinestraDialogo({ caratteriAlSecondo: () => VELOCITA_CARATTERI[imp.get('velocitaTesto')] });
    this.titolo = new SchermataTitolo();
    this.pausa = new MenuPausa();
    this.taccuino = new Taccuino();
    this.pianta = new PiantaVerbano({ rosaDeiVenti: () => imp.get('rosaDeiVenti'), posizione: () => imp.get('posizioneSullaPianta') });
    this.lettore = new LettoreCarte();
    this.pannelloImpostazioni = new PannelloImpostazioni(imp);
    this.crediti = new Crediti();
    this.caricamento = new SchermataCaricamento();

    // L'ordine di montaggio è l'ordine di sovrapposizione.
    const tutti: ComponenteQualsiasi[] = [
      this.indicazioni,
      this.dialogo,
      this.titolo,
      this.pausa,
      this.taccuino,
      this.pianta,
      this.lettore,
      this.pannelloImpostazioni,
      this.crediti,
      this.caricamento,
    ] as unknown as ComponenteQualsiasi[];
    for (const c of tutti) {
      c.mount(this.radice);
      if (c.modale) {
        c.on('mostrato', () => this.entra(c));
        c.on('nascosto', () => this.esce(c));
      }
    }

    applicaImpostazioniVisive(this.radice, imp.all());
    imp.on('cambio', (c) => {
      applicaImpostazioniVisive(this.radice, c.tutte);
      if ((c.chiave === 'rosaDeiVenti' || c.chiave === 'posizioneSullaPianta' || c.chiave === 'altoContrasto') && this.pianta.visible) this.pianta.ridisegna();
    });

    this.collegaNavigazione();
    this.suTasto = (e) => this.gestisciTasto(e);
    window.addEventListener('keydown', this.suTasto, true);
  }

  /** Vero se un modale ha il controllo di tastiera e mouse. */
  get inputCatturato(): boolean {
    return this.catturato;
  }

  /** Vero se il menu di pausa (o un suo sottomenu) è aperto. */
  get pausaAttiva(): boolean {
    return this.inPausa;
  }

  /** Apre la pausa (anche da chiamare quando il gioco perde il blocco del puntatore). */
  apriPausa(): void {
    if (this.titolo.visible || this.caricamento.visible) return;
    this.pausa.show(this.opz.datiPausa?.() ?? {});
  }

  /** Apre il taccuino (dai dati passati o da `datiTaccuino`). */
  apriTaccuino(dati?: DatiTaccuino): void {
    this.taccuino.show(dati ?? this.opz.datiTaccuino?.());
  }

  /** Apre la Pianta (dai dati passati o da `datiPianta`). */
  apriPianta(dati?: DatiPianta): void {
    this.pianta.show(dati ?? this.opz.datiPianta?.());
  }

  /** Chiude tutti i modali (non il titolo né il caricamento) e torna al gioco. */
  tornaAlGioco(): void {
    for (const c of [...this.pila].reverse()) {
      if (c === (this.titolo as unknown as ComponenteQualsiasi) || c === (this.caricamento as unknown as ComponenteQualsiasi)) continue;
      c.hide();
    }
    this.ritorni.clear();
  }

  /** Annuncia un testo ai lettori di schermo. */
  annuncia(testo: string): void {
    annuncia(this.radice, testo);
  }

  /** Smonta tutto e toglie gli ascoltatori. */
  destroy(): void {
    window.removeEventListener('keydown', this.suTasto, true);
    for (const c of [this.indicazioni, this.dialogo, this.titolo, this.pausa, this.taccuino, this.pianta, this.lettore, this.pannelloImpostazioni, this.crediti, this.caricamento]) c.destroy();
    this.radice.remove();
    this.offAll();
  }

  // ---------- interni ----------

  /** Apre `figlio` al posto di `padre`, ricordando dove tornare. */
  private apriDa(padre: ComponenteQualsiasi, apri: () => void, figlio: ComponenteQualsiasi): void {
    this.ritorni.set(figlio, padre);
    padre.hide();
    apri();
  }

  /** Chiude `figlio` e riapre il componente da cui era stato aperto (se c'è). */
  private indietro(figlio: ComponenteQualsiasi): void {
    const padre = this.ritorni.get(figlio);
    this.ritorni.delete(figlio);
    figlio.hide();
    if (padre === (this.pausa as unknown as ComponenteQualsiasi)) this.pausa.show(this.opz.datiPausa?.() ?? {});
    else if (padre === (this.titolo as unknown as ComponenteQualsiasi)) this.titolo.show();
  }

  private collegaNavigazione(): void {
    const C = (x: unknown): ComponenteQualsiasi => x as ComponenteQualsiasi;
    this.titolo.on('impostazioni', () => this.apriDa(C(this.titolo), () => this.pannelloImpostazioni.show(), C(this.pannelloImpostazioni)));
    this.titolo.on('crediti', () => this.apriDa(C(this.titolo), () => this.crediti.show(), C(this.crediti)));
    this.pausa.on('riprendi', () => this.pausa.hide());
    this.pausa.on('impostazioni', () => this.apriDa(C(this.pausa), () => this.pannelloImpostazioni.show(), C(this.pannelloImpostazioni)));
    this.pausa.on('taccuino', () => this.apriDa(C(this.pausa), () => this.apriTaccuino(), C(this.taccuino)));
    this.pausa.on('pianta', () => this.apriDa(C(this.pausa), () => this.apriPianta(), C(this.pianta)));
    this.pausa.on('esciAlTitolo', () => {
      this.tornaAlGioco();
      this.pausa.hide();
    });
    this.pannelloImpostazioni.on('indietro', () => this.indietro(C(this.pannelloImpostazioni)));
    this.crediti.on('chiudi', () => this.indietro(C(this.crediti)));
    this.taccuino.on('chiudi', () => this.indietro(C(this.taccuino)));
    this.pianta.on('chiudi', () => this.indietro(C(this.pianta)));
    this.lettore.on('chiudi', () => this.indietro(C(this.lettore)));
  }

  private entra(c: ComponenteQualsiasi): void {
    const i = this.pila.indexOf(c);
    if (i >= 0) this.pila.splice(i, 1);
    this.pila.push(c);
    this.aggiornaStato();
  }

  private esce(c: ComponenteQualsiasi): void {
    const i = this.pila.indexOf(c);
    if (i >= 0) this.pila.splice(i, 1);
    this.aggiornaStato();
  }

  private aggiornaStato(): void {
    const catturato = this.pila.length > 0;
    const sottomenuDiPausa = [...this.ritorni.values()].includes(this.pausa as unknown as ComponenteQualsiasi);
    const inPausa = this.pausa.visible || sottomenuDiPausa;
    this.radice.classList.toggle('ui-con-modale', catturato);
    if (catturato !== this.catturato) {
      this.catturato = catturato;
      this.emit('catturaInput', catturato);
    }
    if (inPausa !== this.inPausa) {
      this.inPausa = inPausa;
      this.emit('pausa', inPausa);
    }
  }

  private gestisciTasto(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const cima = this.pila[this.pila.length - 1];
    if (cima) {
      if (cima.gestisciTasto(e)) {
        e.preventDefault();
        e.stopPropagation();
      }
      return;
    }
    if (this.opz.scorciatoie === false || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const k = e.key;
    if (k === 'Escape') this.apriPausa();
    else if (k === 't' || k === 'T') this.apriTaccuino();
    else if (k === 'p' || k === 'P') this.apriPianta();
    else return;
    e.preventDefault();
    e.stopPropagation();
  }
}
