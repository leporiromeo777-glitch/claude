/**
 * Esecutore dei dialoghi di content/dialoghi.json, pensato per una UI:
 *
 *   dialoghi.avvia('ottavio_fienile');
 *   while (!dialoghi.isFinished()) {
 *     const nodo = dialoghi.getNode()!;   // testo e risposte già filtrate
 *     mostra(nodo);
 *     dialoghi.choose(sceltaDelGiocatore); // indice fra nodo.risposte
 *   }
 *
 * Un nodo senza risposte visibili è «finale»: `choose(0)` (il «continua»
 * della UI) segue il suo `vaiA` automatico, se c'è, altrimenti chiude il
 * dialogo. Un dialogo chiuso normalmente viene registrato fra i finiti;
 * `interrompi()` lo chiude senza registrarlo.
 */
import type { CondizioneGrezza } from './condizioni';
import type { DialogoDef, NodoDef, RispostaDef } from './contenuti';
import { Emettitore } from './eventi';

export interface RispostaVisibile {
  /** Indice da passare a `choose`. */
  indice: number;
  testo: string;
}

export interface VistaNodo {
  dialogo: string;
  personaggio: string;
  nodo: string;
  /** Chi parla in questo nodo (di solito il personaggio del dialogo). */
  chi: string;
  testo: string;
  risposte: RispostaVisibile[];
  /** Nessuna risposta visibile: `choose(0)` continua o chiude. */
  finale: boolean;
}

export interface EventiDialoghi {
  dialogoAvviato: { dialogo: string; personaggio: string };
  nodoDialogo: VistaNodo;
  rispostaScelta: { dialogo: string; nodo: string; indice: number; testo: string };
  dialogoFinito: { dialogo: string; personaggio: string };
  dialogoInterrotto: { dialogo: string; personaggio: string };
  erroreDialogo: { dialogo: string; messaggio: string };
}

export interface DipendenzeDialoghi {
  valuta(c: CondizioneGrezza): boolean;
  applicaEffetti(effetti: readonly string[], origine: string): void;
}

export interface StatoDialoghi {
  finiti: string[];
  iniziati: string[];
  corrente: { dialogo: string; nodo: string } | null;
}

export class ErroreDialogo extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = 'ErroreDialogo';
  }
}

export class Dialoghi {
  readonly eventi = new Emettitore<EventiDialoghi>();
  private readonly defs: Record<string, DialogoDef>;
  private readonly finitiSet = new Set<string>();
  private readonly iniziatiSet = new Set<string>();
  private corrente: { def: DialogoDef; nodo: NodoDef } | null = null;

  constructor(
    defs: Record<string, DialogoDef>,
    private readonly deps: DipendenzeDialoghi,
  ) {
    this.defs = defs;
  }

  definizione(id: string): DialogoDef | undefined {
    return this.defs[id];
  }

  /**
   * Apre un dialogo (dal suo primo nodo o da `nodo`). Se un altro dialogo è
   * aperto viene interrotto. Restituisce il primo nodo, o null se il dialogo
   * si è chiuso subito.
   */
  avvia(id: string, nodo?: string): VistaNodo | null {
    const def = this.defs[id];
    if (!def) throw new ErroreDialogo(`Dialogo sconosciuto «${id}»`);
    const idNodo = nodo ?? def.inizio;
    const primo = def.nodi.find((n) => n.id === idNodo);
    if (!primo) throw new ErroreDialogo(`Il dialogo «${id}» non ha il nodo «${idNodo}»`);
    if (this.corrente) this.interrompi();
    this.iniziatiSet.add(id);
    this.eventi.emit('dialogoAvviato', { dialogo: id, personaggio: def.personaggio });
    this.entra(def, primo);
    return this.getNode();
  }

  /** Il nodo corrente con le risposte filtrate per condizione (null se nessun dialogo è aperto). */
  getNode(): VistaNodo | null {
    if (!this.corrente) return null;
    const { def, nodo } = this.corrente;
    const risposte = this.risposteVisibili(nodo).map((r, indice) => ({ indice, testo: r.testo }));
    return {
      dialogo: def.id,
      personaggio: def.personaggio,
      nodo: nodo.id,
      chi: nodo.chi ?? def.personaggio,
      testo: nodo.testo,
      risposte,
      finale: risposte.length === 0,
    };
  }

  /**
   * Sceglie la risposta `index` (fra quelle visibili): applica i suoi effetti
   * e passa al nodo seguente. Restituisce il nuovo nodo, o null se il dialogo
   * è finito.
   */
  choose(index: number): VistaNodo | null {
    if (!this.corrente) throw new ErroreDialogo('Nessun dialogo aperto');
    const { def, nodo } = this.corrente;
    const visibili = this.risposteVisibili(nodo);
    if (visibili.length === 0) {
      // Nodo finale: «continua».
      if (index !== 0) throw new ErroreDialogo(`Il nodo «${nodo.id}» non ha risposte: usa choose(0)`);
      if (nodo.vaiA) this.vaiA(def, nodo.vaiA);
      else this.finisci();
      return this.getNode();
    }
    const r = visibili[index];
    if (!r) throw new ErroreDialogo(`Risposta ${index} inesistente nel nodo «${nodo.id}» (ce ne sono ${visibili.length})`);
    this.eventi.emit('rispostaScelta', { dialogo: def.id, nodo: nodo.id, indice: index, testo: r.testo });
    if (r.effetti.length) this.deps.applicaEffetti(r.effetti, `dialogo ${def.id}, nodo ${nodo.id}`);
    // Un effetto può aver chiuso o cambiato dialogo.
    if (this.corrente?.def !== def || this.corrente.nodo !== nodo) return this.getNode();
    if (r.vaiA === null) this.finisci();
    else this.vaiA(def, r.vaiA);
    return this.getNode();
  }

  /** true quando nessun dialogo è aperto (finito, interrotto o mai avviato). */
  isFinished(): boolean {
    return this.corrente === null;
  }

  /** Id del dialogo aperto, o null. */
  aperto(): string | null {
    return this.corrente?.def.id ?? null;
  }

  /** Chiude il dialogo aperto senza registrarlo fra i finiti. */
  interrompi(): void {
    if (!this.corrente) return;
    const { def } = this.corrente;
    this.corrente = null;
    this.eventi.emit('dialogoInterrotto', { dialogo: def.id, personaggio: def.personaggio });
  }

  finito(id: string): boolean {
    return this.finitiSet.has(id);
  }

  iniziato(id: string): boolean {
    return this.iniziatiSet.has(id);
  }

  finiti(): string[] {
    return [...this.finitiSet];
  }

  /** Segna un dialogo come finito senza giocarlo (per script e prove). */
  segnaFinito(id: string): void {
    this.iniziatiSet.add(id);
    this.finitiSet.add(id);
  }

  /**
   * Dialoghi disponibili (condizione vera e non finiti, o ripetibili),
   * eventualmente di un solo personaggio, ordinati per priorità e poi
   * nell'ordine del file.
   */
  disponibili(personaggio?: string): string[] {
    return Object.values(this.defs)
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => personaggio === undefined || d.personaggio === personaggio)
      .filter(({ d }) => d.ripetibile || !this.finitiSet.has(d.id))
      .filter(({ d }) => d.condizione === undefined || this.deps.valuta(d.condizione))
      .sort((a, b) => b.d.priorita - a.d.priorita || a.i - b.i)
      .map(({ d }) => d.id);
  }

  /** Il dialogo da aprire parlando con un personaggio (o null). */
  perPersonaggio(personaggio: string): string | null {
    return this.disponibili(personaggio)[0] ?? null;
  }

  // --- interni ---------------------------------------------------------------

  private risposteVisibili(nodo: NodoDef): RispostaDef[] {
    return nodo.risposte.filter((r) => r.condizione === undefined || this.deps.valuta(r.condizione));
  }

  private entra(def: DialogoDef, nodo: NodoDef): void {
    this.corrente = { def, nodo };
    if (nodo.effetti.length) {
      this.deps.applicaEffetti(nodo.effetti, `dialogo ${def.id}, nodo ${nodo.id}`);
      if (this.corrente?.nodo !== nodo) return; // un effetto ha cambiato dialogo
    }
    this.eventi.emit('nodoDialogo', this.getNode()!);
  }

  private vaiA(def: DialogoDef, idNodo: string): void {
    const nodo = def.nodi.find((n) => n.id === idNodo);
    if (!nodo) {
      const messaggio = `Il dialogo «${def.id}» punta al nodo inesistente «${idNodo}»: lo chiudo`;
      this.eventi.emit('erroreDialogo', { dialogo: def.id, messaggio });
      this.finisci();
      return;
    }
    this.entra(def, nodo);
  }

  private finisci(): void {
    if (!this.corrente) return;
    const { def } = this.corrente;
    this.corrente = null;
    this.finitiSet.add(def.id);
    this.eventi.emit('dialogoFinito', { dialogo: def.id, personaggio: def.personaggio });
  }

  // --- Salvataggio ------------------------------------------------------------

  esporta(): StatoDialoghi {
    return {
      finiti: [...this.finitiSet],
      iniziati: [...this.iniziatiSet],
      corrente: this.corrente ? { dialogo: this.corrente.def.id, nodo: this.corrente.nodo.id } : null,
    };
  }

  /** Ripristina lo stato (senza riapplicare gli effetti del nodo corrente). */
  importa(dati: StatoDialoghi): void {
    this.finitiSet.clear();
    this.iniziatiSet.clear();
    for (const id of dati.finiti ?? []) this.finitiSet.add(id);
    for (const id of dati.iniziati ?? []) this.iniziatiSet.add(id);
    this.corrente = null;
    if (dati.corrente) {
      const def = this.defs[dati.corrente.dialogo];
      const nodo = def?.nodi.find((n) => n.id === dati.corrente!.nodo);
      if (def && nodo) this.corrente = { def, nodo };
    }
  }
}
