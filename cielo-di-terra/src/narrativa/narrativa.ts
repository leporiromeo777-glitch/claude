/**
 * Facciata del modulo: crea flag, missioni, dialoghi, taccuino e inventario
 * da un oggetto contenuti e da un `WorldFacts`, li collega fra loro e
 * raccoglie tutti gli eventi in un solo emettitore.
 *
 *   const narrativa = new Narrativa({ missioni, dialoghi, taccuino }, fatti);
 *   narrativa.eventi.on('passoAttivato', …);
 *   narrativa.eventi.on('evento', ({ nome }) => …);   // «evento:nome» dei contenuti
 *   narrativa.eventi.on('tempo', ({ azione, ore }) => …);
 *   // ogni tanto (per esempio ogni mezzo secondo, e dopo che il giocatore
 *   // raggiunge un luogo o rileva una cella):
 *   narrativa.tick();
 */
import {
  ErroreCondizione,
  ParserCondizioni,
  atomiDi,
  valutaNodo,
  type NodoCondizione,
  type CondizioneGrezza,
  type ContestoCondizioni,
  type OpzioniParser,
} from './condizioni';
import {
  normalizzaContenuti,
  type ContenutiNarrativa,
  type ContenutiNormalizzati,
} from './contenuti';
import { Dialoghi, type EventiDialoghi, type StatoDialoghi, type VistaNodo } from './dialoghi';
import { ErroreEffetto, analizzaEffetto, type Effetto } from './effetti';
import { Emettitore } from './eventi';
import { ArchivioFlag, type CambioFlag, type ValoreFlag } from './flag';
import { Inventario, type CambioOggetto } from './inventario';
import { Missioni, type AmbitoPasso, type EventiMissioni, type StatoMissioni } from './missioni';
import type { GestoreSalvataggi, InfoSlot, RisultatoCaricamento } from './salvataggio';
import { Taccuino, type EventiTaccuino, type Obiettivo, type StatoTaccuino } from './taccuino';

/**
 * I fatti del mondo che il gioco mette a disposizione della narrativa.
 * Tutte le funzioni devono essere veloci: vengono chiamate a ogni `tick()`.
 */
export interface WorldFacts {
  /** Ora del giorno di gioco, 0 ≤ ora < 24, anche frazionaria. */
  ora(): number;
  /** Numero del giorno di gioco (il primo giorno è 1). */
  giorno(): number;
  /** true di notte. Se manca: notte fra `opzioni.notte.inizio` e `opzioni.notte.fine`. */
  notte?(): boolean;
  /**
   * true se Elvira è ora entro il raggio del luogo (id di content/luoghi.json).
   * Dentro un passo di missione il luogo resta «raggiunto» per tutto il passo
   * (FASE1 §2.3): la narrativa se lo ricorda da sola. Per le visite brevi fra
   * due tick il gioco può chiamare `Narrativa.segnalaLuogo(id)`.
   */
  luogoRaggiunto(id: string): boolean;
  /** true se la cella/particella è rilevata (inchiostro e colore sulla Pianta). */
  cellaRilevata(id: string): boolean;
  /** true se la cella è almeno vista con lo squadro (matita). Se manca vale come `cellaRilevata`. */
  cellaVista?(id: string): boolean;
  /** Variante corrente di un elemento mobile o particella («Carta», «Abitata», «Smontata»…; maiuscole indifferenti). */
  varianteParticella?(id: string): string | undefined;
  /** Oggetti che il gioco tiene fuori dall'inventario narrativo (si sommano a quelli dell'inventario). */
  quantitaOggetto?(id: string): number;
  /** Prefissi aggiuntivi registrati in `opzioni.parser.prefissiExtra`. */
  predicato?(prefisso: string, argomento: string, qualificatore?: string): boolean;
  /**
   * Il prossimo evento del cielo per la riga fissa del taccuino («Brace della
   * Linea fra due ore»). Letto a ogni `tick()`; la riga scritta dai contenuti
   * con l'effetto «cielo:» ha la precedenza.
   */
  prossimoEventoCielo?(): string | null;
}

/** Il gioco fornisce lo stato del mondo da salvare insieme alla narrativa (blob opaco). */
export interface FornitoreMondo {
  esporta(): unknown;
  importa(blob: unknown): void;
}

export interface OpzioniNarrativa {
  parser?: OpzioniParser;
  /**
   * Missioni avviate al primo `tick()` di una partita nuova. Predefinite: le
   * missioni senza `avvia_quando` che nessun effetto dei contenuti avvia.
   */
  missioniIniziali?: string[];
  /** Ore della notte se `WorldFacts.notte` manca (predefinite: dalle 21 alle 5:30, come nel GDD §2.3). */
  notte?: { inizio: number; fine: number };
  /** Se vero, un errore nei contenuti lancia subito un'eccezione invece di finire in `problemi`. */
  rigoroso?: boolean;
}

export interface EventiNarrativa extends EventiMissioni, EventiDialoghi {
  flag: CambioFlag;
  oggetto: CambioOggetto;
  taccuino: EventiTaccuino['voce'];
  rigaCielo: { testo: string | null };
  obiettivi: { obiettivi: Obiettivo[] };
  /** «evento:nome arg…» dei contenuti: il gioco lo intercetta (scene, suoni, dissolvenze). */
  evento: { nome: string; argomenti: string[]; origine?: string };
  /** «tempo:salta-a 6» / «tempo:avanza 2»: il gioco sposta l'orologio. */
  tempo: { azione: 'salta-a' | 'avanza'; ore: number; origine?: string };
  /**
   * Il gioco apre il dialogo quando può (di solito con `dialoghi.avvia`): viene
   * dall'effetto «dialogo:id avvia» oppure (`automatico: true`) da un dialogo
   * «si_apre: automatico» la cui condizione è diventata vera. Un dialogo
   * automatico si annuncia una volta sola; se viene interrotto si riannuncia.
   */
  apriDialogo: { dialogo: string; origine?: string; automatico?: boolean };
  /** Problemi dei contenuti scoperti durante il gioco (condizioni o effetti malformati, id inesistenti). */
  errore: { messaggio: string; origine?: string };
  /** Una scena di testi.json è stata conclusa (dopo i suoi effetti finali). */
  scenaConclusa: { scena: string; gruppo: string };
}

export interface StatoNarrativo {
  flag: Record<string, ValoreFlag>;
  missioni: StatoMissioni;
  dialoghi: StatoDialoghi;
  taccuino: StatoTaccuino;
  inventario: Record<string, number>;
  /** Luoghi raggiunti durante ciascun passo attivo («missione/passo» → id). */
  luoghiPasso?: Record<string, string[]>;
  /** Scene di testi.json già concluse. */
  scene?: string[];
}

/** La notte del GDD (§2.3): dalle 21:00 alle 05:30. */
export const NOTTE_PREDEFINITA = { inizio: 21, fine: 5.5 } as const;

function eNormalizzati(c: ContenutiNarrativa | ContenutiNormalizzati): c is ContenutiNormalizzati {
  return Array.isArray((c as ContenutiNormalizzati).avvisi) && Array.isArray(c.missioni);
}

/** Missioni senza `avviaQuando` che nessun effetto dei contenuti avvia. */
export function missioniOrfane(c: ContenutiNormalizzati): string[] {
  const avviate = new Set<string>();
  const guarda = (effetti: readonly string[]): void => {
    for (const s of effetti) {
      try {
        const e = analizzaEffetto(s);
        if (e.tipo === 'missione' && e.azione === 'avvia') avviate.add(e.id);
      } catch {
        // gli effetti malformati sono segnalati altrove
      }
    }
  };
  for (const m of c.missioni) {
    guarda(m.effetti);
    for (const p of m.passi) {
      guarda(p.effetti);
      guarda(p.effettiAttivazione);
      for (const e of p.eventi) guarda(e.effetti);
      for (const a of p.aiuti) guarda(a.effetti);
    }
  }
  for (const s of c.scene) guarda(s.effettiFine);
  for (const d of Object.values(c.dialoghi)) {
    guarda(d.effettiFine);
    for (const n of d.nodi) {
      guarda(n.effetti);
      for (const r of n.risposte) guarda(r.effetti);
    }
  }
  return c.missioni.filter((m) => m.avviaQuando === undefined && !avviate.has(m.id)).map((m) => m.id);
}

export class Narrativa {
  readonly eventi = new Emettitore<EventiNarrativa>();
  readonly flag = new ArchivioFlag();
  readonly inventario = new Inventario();
  readonly taccuino: Taccuino;
  readonly missioni: Missioni;
  readonly dialoghi: Dialoghi;
  readonly parser: ParserCondizioni;
  readonly contenuti: ContenutiNormalizzati;
  readonly contesto: ContestoCondizioni;
  /** Problemi dei contenuti: forme inattese, condizioni ed effetti malformati, id inesistenti. */
  readonly problemi: string[] = [];

  private readonly rigoroso: boolean;
  private readonly segnalati = new Set<string>();
  private inTick = false;
  private tickRichiesto = false;
  /** Dialoghi automatici già annunciati (si riannunciano se interrotti). */
  private readonly automaticiAnnunciati = new Set<string>();
  /** Luoghi raggiunti durante ciascun passo attivo («missione/passo»). */
  private readonly luoghiPasso = new Map<string, Set<string>>();
  /** Luoghi citati dalle condizioni di ciascun passo (cache). */
  private readonly luoghiDelPasso = new Map<string, string[]>();
  /** Il passo nel cui ambito si sta valutando una condizione. */
  private ambito: string | null = null;
  /** Scene di testi.json già concluse. */
  private readonly sceneConcluse = new Set<string>();

  constructor(
    contenuti: ContenutiNarrativa | ContenutiNormalizzati,
    readonly fatti: WorldFacts,
    opzioni: OpzioniNarrativa = {},
  ) {
    this.rigoroso = opzioni.rigoroso ?? false;
    this.parser = new ParserCondizioni(opzioni.parser);
    this.contenuti = eNormalizzati(contenuti) ? contenuti : normalizzaContenuti(contenuti);
    for (const a of this.contenuti.avvisi) this.segnala(a, 'contenuti');

    const notte = opzioni.notte ?? NOTTE_PREDEFINITA;
    this.contesto = this.creaContesto(notte);

    const deps = {
      valuta: (c: CondizioneGrezza, ambito?: AmbitoPasso) => this.valuta(c, undefined, ambito),
      applicaEffetti: (effetti: readonly string[], origine: string) => this.applicaEffetti(effetti, origine),
    };
    this.taccuino = new Taccuino(this.contenuti.taccuino, () => ({ giorno: fatti.giorno(), ora: fatti.ora() }));
    this.missioni = new Missioni(this.contenuti.missioni, deps, opzioni.missioniIniziali ?? missioniOrfane(this.contenuti));
    this.dialoghi = new Dialoghi(this.contenuti.dialoghi, deps);

    this.collegaEventi();
    this.controllaSintassi();
  }

  // --- Condizioni ed effetti ------------------------------------------------

  /**
   * Valuta una condizione dei contenuti. Una condizione malformata vale false
   * (e viene segnalata). Con `ambito` i luoghi raggiunti durante quel passo
   * restano veri anche se Elvira se n'è andata.
   */
  valuta(c: CondizioneGrezza, origine?: string, ambito?: AmbitoPasso): boolean {
    const prima = this.ambito;
    this.ambito = ambito ? `${ambito.missione}/${ambito.passo}` : null;
    try {
      return this.parser.valuta(c, this.contesto);
    } catch (e) {
      // Solo gli errori dei contenuti; un errore del gioco (in WorldFacts) deve vedersi.
      if (this.rigoroso || !(e instanceof ErroreCondizione)) throw e;
      this.segnala(e.message, origine);
      return false;
    } finally {
      this.ambito = prima;
    }
  }

  /** Valuta una condizione già compilata (per strumenti come il simulatore della verifica). */
  valutaCompilata(n: NodoCondizione, ambito?: AmbitoPasso): boolean {
    const prima = this.ambito;
    this.ambito = ambito ? `${ambito.missione}/${ambito.passo}` : null;
    try {
      return valutaNodo(n, this.contesto);
    } finally {
      this.ambito = prima;
    }
  }

  /**
   * Il gioco segnala che Elvira ha raggiunto un luogo (utile per le visite più
   * brevi dell'intervallo fra due tick): vale per tutti i passi attivi. Poi tick().
   */
  segnalaLuogo(id: string): void {
    for (const p of this.missioni.passiAttivi()) {
      const k = `${p.missione}/${p.passo}`;
      if (!this.luoghiPasso.has(k)) this.luoghiPasso.set(k, new Set());
      this.luoghiPasso.get(k)!.add(id);
    }
    this.tick();
  }

  /**
   * Ricorda i luoghi dei passi attivi in cui Elvira si trova adesso: quelli delle condizioni, il
   * luogo del passo e quelli delle sue tappe (la guida delle indicazioni sa così, anche dopo un
   * caricamento, che il guado è già alle spalle).
   */
  private registraLuoghi(): void {
    for (const p of this.missioni.passiAttivi()) {
      const k = `${p.missione}/${p.passo}`;
      let luoghi = this.luoghiDelPasso.get(k);
      if (!luoghi) {
        const def = this.missioni.definizione(p.missione)?.passi.find((x) => x.id === p.passo);
        const condizioni = [def?.completaQuando, ...(def?.eventi.map((e) => e.quando) ?? [])];
        const ids = new Set<string>();
        if (def?.luogo) ids.add(def.luogo);
        for (const t of def?.tappe ?? []) if (t.luogo) ids.add(t.luogo);
        for (const c of condizioni) {
          if (c === undefined) continue;
          try {
            for (const a of atomiDi(this.parser.compila(c))) if (a.k === 'luogo') ids.add(a.id);
          } catch {
            // segnalato altrove
          }
        }
        luoghi = [...ids];
        this.luoghiDelPasso.set(k, luoghi);
      }
      for (const id of luoghi) {
        if (!this.fatti.luogoRaggiunto(id)) continue;
        if (!this.luoghiPasso.has(k)) this.luoghiPasso.set(k, new Set());
        this.luoghiPasso.get(k)!.add(id);
      }
    }
  }

  /** Applica una lista di effetti, poi aggiorna missioni e taccuino. */
  applicaEffetti(effetti: readonly (string | Effetto)[], origine?: string): void {
    for (const e of effetti) this.applicaEffetto(e, origine);
    this.tick();
  }

  /** Applica un solo effetto (senza aggiornare le missioni). */
  applicaEffetto(effetto: string | Effetto, origine?: string): void {
    let e: Effetto;
    try {
      e = typeof effetto === 'string' ? analizzaEffetto(effetto) : effetto;
    } catch (err) {
      if (this.rigoroso || !(err instanceof ErroreEffetto)) throw err;
      this.segnala(err.message, origine);
      return;
    }
    const conOrigine = origine !== undefined ? { origine } : {};
    switch (e.tipo) {
      case 'flag':
        this.flag.set(e.nome, e.valore);
        break;
      case 'flag-somma':
        this.flag.incrementa(e.nome, e.delta);
        break;
      case 'flag-rimuovi':
        this.flag.rimuovi(e.nome);
        break;
      case 'taccuino':
        if (!this.taccuino.definizione(e.id) && e.azione !== 'rimuovi') {
          this.segnala(`Voce del taccuino inesistente «${e.id}»`, origine);
        }
        switch (e.azione) {
          case 'aggiungi':
            this.taccuino.aggiungi(e.id);
            break;
          case 'chiudi':
            this.taccuino.chiudi(e.id);
            break;
          case 'riapri':
            this.taccuino.riapri(e.id);
            break;
          case 'barra':
            this.taccuino.barra(e.id);
            break;
          case 'rimuovi':
            this.taccuino.rimuovi(e.id);
            break;
        }
        break;
      case 'cielo':
        this.taccuino.impostaRigaCielo(e.testo || null);
        break;
      case 'missione': {
        if (!this.missioni.definizione(e.id)) {
          this.segnala(`Missione inesistente «${e.id}»`, origine);
          break;
        }
        if (e.azione === 'avvia') this.missioni.avvia(e.id);
        else if (e.azione === 'completa') this.missioni.completa(e.id);
        else this.missioni.fallisci(e.id);
        break;
      }
      case 'oggetto':
        if (e.delta > 0) this.inventario.aggiungi(e.id, e.delta);
        else if (!this.inventario.rimuovi(e.id, -e.delta)) {
          this.segnala(`Non ci sono ${-e.delta} «${e.id}» da togliere dall'inventario`, origine);
        }
        break;
      case 'evento':
        this.eventi.emit('evento', { nome: e.nome, argomenti: e.argomenti, ...conOrigine });
        break;
      case 'tempo':
        this.eventi.emit('tempo', { azione: e.azione, ore: e.ore, ...conOrigine });
        break;
      case 'dialogo':
        if (!this.dialoghi.definizione(e.id)) {
          this.segnala(`Dialogo inesistente «${e.id}»`, origine);
          break;
        }
        this.eventi.emit('apriDialogo', { dialogo: e.id, ...conOrigine });
        break;
    }
  }

  /**
   * Valuta le missioni (avvio, attivazione e completamento dei passi, eventi
   * dei passi) e le voci automatiche del taccuino, a cascata finché nulla
   * cambia; aggiorna la riga del cielo e annuncia i dialoghi automatici.
   * Il gioco lo chiama ogni tanto; `secondi` (facoltativo) sono i secondi
   * reali passati dall'ultima chiamata, per gli aiuti a tempo dei passi.
   * Restituisce true se qualcosa è cambiato.
   */
  tick(secondi = 0): boolean {
    if (this.inTick) {
      this.tickRichiesto = true;
      return false;
    }
    this.inTick = true;
    let cambiato = false;
    try {
      if (this.missioni.avanzaTempo(secondi)) cambiato = true;
      this.registraLuoghi();
      for (let giro = 0; giro < 1000; giro++) {
        this.tickRichiesto = false;
        const m = this.missioni.aggiorna();
        const t = this.taccuino.aggiorna((c) => this.valuta(c, 'taccuino'));
        if (m || t) cambiato = true;
        if (!m && !t && !this.tickRichiesto) break;
      }
    } finally {
      this.inTick = false;
    }
    this.aggiornaRigaCielo();
    this.annunciaAutomatici();
    return cambiato;
  }

  /** Sceglie la riga del cielo fra le candidate di taccuino.json e quella del gioco. */
  private aggiornaRigaCielo(): void {
    if (this.fatti.prossimoEventoCielo) this.taccuino.impostaRigaCieloGioco(this.fatti.prossimoEventoCielo());
    let migliore: { id: string; testo: string; priorita: number } | null = null;
    for (const r of this.contenuti.rigaCielo) {
      if (migliore && r.priorita <= migliore.priorita) continue;
      if (r.quando === undefined || this.valuta(r.quando, `riga del cielo ${r.id}`)) migliore = r;
    }
    this.taccuino.impostaRigaCieloCandidata(migliore ? { id: migliore.id, testo: migliore.testo } : null);
  }

  /** Annuncia (evento `apriDialogo`) i dialoghi automatici pronti, se nessun dialogo è aperto. */
  private annunciaAutomatici(): void {
    if (!this.dialoghi.isFinished()) return;
    for (const id of this.dialoghi.automaticiPronti()) {
      if (this.automaticiAnnunciati.has(id)) continue;
      this.automaticiAnnunciati.add(id);
      this.eventi.emit('apriDialogo', { dialogo: id, automatico: true });
      if (!this.dialoghi.isFinished()) return; // il gioco l'ha aperto subito: gli altri aspettano
    }
  }

  /** Apre il dialogo disponibile di un personaggio (null se non ne ha). */
  parla(personaggio: string): VistaNodo | null {
    const id = this.dialoghi.perPersonaggio(personaggio);
    return id ? this.dialoghi.avvia(id) : null;
  }

  // --- Scene (testi.json) ---------------------------------------------------

  /**
   * La prima scena del gruppo (per esempio «leggende», le sere dell'Ombrista)
   * con la condizione vera e non ancora conclusa, nell'ordine del file; null
   * se non ce n'è. Il gioco la recita e poi chiama `concludiScena`.
   */
  scenaDisponibile(gruppo = 'leggende'): string | null {
    for (const s of this.contenuti.scene) {
      if (s.gruppo !== gruppo || this.sceneConcluse.has(s.id)) continue;
      if (s.condizione === undefined || this.valuta(s.condizione, `scena ${s.id}`)) return s.id;
    }
    return null;
  }

  /** Dichiara conclusa una scena: applica i suoi effetti `alla_fine` (una volta sola). */
  concludiScena(id: string): boolean {
    const s = this.contenuti.scene.find((x) => x.id === id);
    if (!s) {
      this.segnala(`Scena inesistente «${id}»`);
      return false;
    }
    if (this.sceneConcluse.has(id)) return false;
    this.sceneConcluse.add(id);
    this.eventi.emit('scenaConclusa', { scena: id, gruppo: s.gruppo });
    this.applicaEffetti(s.effettiFine, `scena ${id}`);
    return true;
  }

  scenaConclusa(id: string): boolean {
    return this.sceneConcluse.has(id);
  }

  /** Apre il dialogo legato a un oggetto del mondo («si_apre: interagendo con …»), o null. */
  interagisci(oggetto: string): VistaNodo | null {
    const id = this.dialoghi.perInterazione(oggetto);
    return id ? this.dialoghi.avvia(id) : null;
  }

  // --- Stato e salvataggio ------------------------------------------------

  esporta(): StatoNarrativo {
    return {
      flag: this.flag.esporta(),
      missioni: this.missioni.esporta(),
      dialoghi: this.dialoghi.esporta(),
      taccuino: this.taccuino.esporta(),
      inventario: this.inventario.esporta(),
      luoghiPasso: Object.fromEntries([...this.luoghiPasso].map(([k, v]) => [k, [...v]])),
      scene: [...this.sceneConcluse],
    };
  }

  /** Ripristina uno stato esportato (senza emettere eventi né applicare effetti). */
  importa(stato: StatoNarrativo): void {
    this.automaticiAnnunciati.clear();
    this.flag.importa(stato.flag ?? {});
    this.missioni.importa(stato.missioni ?? { inizializzate: false, missioni: {} });
    this.dialoghi.importa(stato.dialoghi ?? { finiti: [], iniziati: [], corrente: null });
    this.taccuino.importa(stato.taccuino ?? { voci: [], rigaCielo: null, obiettivi: [] });
    this.inventario.importa(stato.inventario ?? {});
    this.sceneConcluse.clear();
    for (const id of stato.scene ?? []) if (typeof id === 'string') this.sceneConcluse.add(id);
    this.luoghiPasso.clear();
    for (const [k, v] of Object.entries(stato.luoghiPasso ?? {})) {
      if (Array.isArray(v)) this.luoghiPasso.set(k, new Set(v.filter((x): x is string => typeof x === 'string')));
    }
  }

  /** Salva narrativa e mondo nel prossimo slot del gestore. */
  salva(gestore: GestoreSalvataggi, mondo: FornitoreMondo, meta?: Record<string, unknown>): Promise<InfoSlot> {
    return gestore.salva({ narrativa: this.esporta(), mondo: mondo.esporta(), ...(meta ? { meta } : {}) });
  }

  /** Carica il salvataggio più recente in narrativa e mondo. Restituisce null se non ce n'è nessuno. */
  async carica(gestore: GestoreSalvataggi, mondo: FornitoreMondo): Promise<RisultatoCaricamento<StatoNarrativo> | null> {
    const r = await gestore.carica<StatoNarrativo>();
    if (!r) return null;
    this.importa(r.documento.dati.narrativa);
    mondo.importa(r.documento.dati.mondo);
    return r;
  }

  // --- interni --------------------------------------------------------------

  private segnala(messaggio: string, origine?: string): void {
    // Ogni problema si segnala una volta sola (le condizioni si rivalutano a ogni tick).
    if (this.segnalati.has(messaggio)) return;
    this.segnalati.add(messaggio);
    const testo = origine ? `${origine}: ${messaggio}` : messaggio;
    this.problemi.push(testo);
    this.eventi.emit('errore', { messaggio, ...(origine !== undefined ? { origine } : {}) });
  }

  private creaContesto(notte: { inizio: number; fine: number }): ContestoCondizioni {
    const f = this.fatti;
    const ctx: ContestoCondizioni = {
      flag: (n) => this.flag.get(n),
      ora: () => f.ora(),
      giorno: () => f.giorno(),
      notte: () => {
        if (f.notte) return f.notte();
        const h = f.ora();
        return notte.inizio > notte.fine ? h >= notte.inizio || h < notte.fine : h >= notte.inizio && h < notte.fine;
      },
      luogoRaggiunto: (id) => f.luogoRaggiunto(id) || (this.ambito !== null && !!this.luoghiPasso.get(this.ambito)?.has(id)),
      cella: (id, stato) => {
        switch (stato) {
          case 'rilevata':
            return f.cellaRilevata(id);
          case 'vista':
            return f.cellaRilevata(id) || (f.cellaVista?.(id) ?? false);
          case 'bianca':
            return !f.cellaRilevata(id) && !(f.cellaVista?.(id) ?? false);
          default:
            return f.varianteParticella?.(id)?.toLowerCase() === stato;
        }
      },
      dialogo: (id, stato) => (stato === 'finito' ? this.dialoghi.finito(id) : this.dialoghi.iniziato(id)),
      missione: (id, stato) => {
        const s = this.missioni.stato(id);
        switch (stato) {
          case 'completata':
            return s === 'completata';
          case 'attiva':
            return s === 'attiva';
          case 'avviata':
            return s !== 'inattiva';
          case 'inattiva':
            return s === 'inattiva';
        }
      },
      passo: (m, p, stato) => this.missioni.statoPasso(m, p) === (stato === 'attivo' ? 'attivo' : 'completato'),
      quantitaOggetto: (id) => this.inventario.quantita(id) + (f.quantitaOggetto?.(id) ?? 0),
      taccuino: (id, stato) => {
        const s = this.taccuino.stato(id);
        switch (stato) {
          case 'presente':
            return !!s;
          case 'aperta':
            return !!s && !s.chiusa;
          case 'chiusa':
            return !!s?.chiusa;
          case 'barrata':
            return !!s?.barrata;
        }
      },
    };
    if (f.predicato) ctx.predicato = (p, a, q) => f.predicato!(p, a, q);
    return ctx;
  }

  private collegaEventi(): void {
    const inoltra = <M extends object>(sorgente: Emettitore<M>): void => {
      sorgente.onQualsiasi((tipo, dato) => {
        (this.eventi.emit as (t: string, d: unknown) => void).call(this.eventi, tipo as string, dato);
      });
    };
    inoltra(this.missioni.eventi);
    inoltra(this.dialoghi.eventi);
    this.flag.eventi.on('cambio', (c) => this.eventi.emit('flag', c));
    this.inventario.eventi.on('cambio', (c) => this.eventi.emit('oggetto', c));
    this.taccuino.eventi.on('voce', (v) => this.eventi.emit('taccuino', v));
    this.taccuino.eventi.on('rigaCielo', (r) => this.eventi.emit('rigaCielo', r));
    this.taccuino.eventi.on('obiettivi', (o) => this.eventi.emit('obiettivi', o));

    // Obiettivi del taccuino seguono i passi delle missioni.
    this.missioni.eventi.on('passoAttivato', ({ missione, passo, obiettivo }) => {
      if (obiettivo === undefined || obiettivo === '') return;
      const voce = this.taccuino.definizione(obiettivo);
      if (voce) this.taccuino.aggiungi(obiettivo);
      this.taccuino.segnaObiettivo({ missione, passo, testo: voce ? voce.testo : obiettivo });
    });
    const dimenticaLuoghi = (missione: string, passo?: string): void => {
      for (const k of [...this.luoghiPasso.keys()]) {
        if (passo !== undefined ? k === `${missione}/${passo}` : k.startsWith(`${missione}/`)) this.luoghiPasso.delete(k);
      }
    };
    this.missioni.eventi.on('passoCompletato', ({ missione, passo }) => {
      this.taccuino.togliObiettivo(missione, passo);
      dimenticaLuoghi(missione, passo);
    });
    this.missioni.eventi.on('missioneCompletata', ({ missione }) => {
      this.taccuino.togliObiettivo(missione);
      dimenticaLuoghi(missione);
    });
    this.missioni.eventi.on('missioneFallita', ({ missione }) => {
      this.taccuino.togliObiettivo(missione);
      dimenticaLuoghi(missione);
    });

    // Finito un dialogo, le missioni possono andare avanti subito.
    this.dialoghi.eventi.on('dialogoFinito', () => this.tick());
    this.dialoghi.eventi.on('dialogoInterrotto', ({ dialogo }) => this.automaticiAnnunciati.delete(dialogo));
    this.dialoghi.eventi.on('erroreDialogo', ({ dialogo, messaggio }) => this.segnala(messaggio, `dialogo ${dialogo}`));
  }

  /** Analizza in anticipo tutte le condizioni e gli effetti, per trovare subito gli errori di sintassi. */
  private controllaSintassi(): void {
    const cond = (c: CondizioneGrezza | undefined, origine: string): void => {
      if (c === undefined) return;
      for (const e of this.parser.errori(c)) {
        if (this.rigoroso) throw new Error(`${origine}: ${e}`);
        this.segnala(e, origine);
      }
    };
    const eff = (lista: readonly string[], origine: string): void => {
      for (const s of lista) {
        try {
          analizzaEffetto(s);
        } catch (e) {
          if (this.rigoroso) throw e;
          this.segnala(e instanceof Error ? e.message : String(e), origine);
        }
      }
    };
    for (const m of this.contenuti.missioni) {
      cond(m.avviaQuando, `missione ${m.id}`);
      eff(m.effetti, `missione ${m.id}`);
      for (const p of m.passi) {
        cond(p.attivaQuando, `missione ${m.id}, passo ${p.id}`);
        cond(p.completaQuando, `missione ${m.id}, passo ${p.id}`);
        eff(p.effetti, `missione ${m.id}, passo ${p.id}`);
        eff(p.effettiAttivazione, `missione ${m.id}, passo ${p.id}`);
      }
    }
    for (const d of Object.values(this.contenuti.dialoghi)) {
      cond(d.condizione, `dialogo ${d.id}`);
      eff(d.effettiFine, `dialogo ${d.id}, alla fine`);
      for (const n of d.nodi) {
        eff(n.effetti, `dialogo ${d.id}, nodo ${n.id}`);
        for (const r of n.risposte) {
          cond(r.condizione, `dialogo ${d.id}, nodo ${n.id}`);
          eff(r.effetti, `dialogo ${d.id}, nodo ${n.id}`);
        }
      }
    }
    for (const v of this.contenuti.taccuino) {
      cond(v.sbloccaQuando, `taccuino ${v.id}`);
      cond(v.chiudiQuando, `taccuino ${v.id}`);
    }
    for (const r of this.contenuti.rigaCielo) cond(r.quando, `riga del cielo ${r.id}`);
    for (const s of this.contenuti.scene) {
      cond(s.condizione, `scena ${s.id}`);
      eff(s.effettiFine, `scena ${s.id}`);
    }
    for (const m of this.contenuti.missioni) {
      for (const p of m.passi) {
        p.eventi.forEach((e, k) => {
          cond(e.quando, `missione ${m.id}, passo ${p.id}, evento ${k + 1}`);
          eff(e.effetti, `missione ${m.id}, passo ${p.id}, evento ${k + 1}`);
        });
        p.aiuti.forEach((a, k) => eff(a.effetti, `missione ${m.id}, passo ${p.id}, aiuto ${k + 1}`));
      }
    }
  }
}
