/**
 * La facciata del catasto per il gioco: tiene lo stato, chiama le funzioni pure e distribuisce
 * gli eventi agli ascoltatori (motore, oggetti 3D, audio, interfaccia). Chi preferisce lo stile
 * funzionale può usare direttamente `rileva`, `notte`, `datiPianta`…
 */
import { notte, iniziaNotte, avanzaNotte, chiudiNotte, impostaVariante, applicaCicliDelGiorno, annunciaMosse, scriviConPenna, rimisuraScrittura, previsioneNotte, type ContestoMosse, type InputCicli, type RisultatoNotte } from './notte';
import { CELLE_TOTALI } from './costanti';
import { celleMotore, datiPianta, type DatiPiantaCatasto, type OpzioniPianta } from './pianta';
import {
  appunta,
  chiudiTriangolo,
  parametriSquadro,
  passa,
  rileva,
  rimettiCaposaldo,
  segnaCaposaldoVisto,
  stazioneLibera,
  type InputAppunto,
  type InputRilievo,
  type InputStazioneLibera,
  type InputTriangolo,
  type ParametriSquadro,
} from './rilievo';
import { caricaCatasto, salvaCatasto, type BlobCatasto, type OpzioniCaricamento } from './salvataggio';
import {
  cellaAColore,
  cellaRilevataDaElvira,
  infoParticella,
  inventarioCompleto,
  statoDi,
  statoIniziale,
  varianteDi,
  type InfoParticella,
} from './stato';
import type { PuntoFoglio } from './griglia';
import type { Ora } from './tempo';
import type { EventoCatasto, InputNotte, RegoleCatasto, Resoconto, RisultatoCatasto, StatoCatasto, StatoParticella } from './tipi';

type TipoEvento = EventoCatasto['tipo'];
type EventoDi<T extends TipoEvento> = Extract<EventoCatasto, { tipo: T }>;
type Ascoltatore = (e: EventoCatasto) => void;

export class Catasto {
  readonly regole: RegoleCatasto;
  private _stato: StatoCatasto;
  private readonly ascoltatori = new Map<string, Set<Ascoltatore>>();
  /** Gli effetti per la narrativa prodotti dall'ultima operazione. */
  ultimiEffetti: string[] = [];

  constructor(regole: RegoleCatasto, stato?: StatoCatasto) {
    this.regole = regole;
    this._stato = stato ?? statoIniziale(regole);
  }

  get stato(): StatoCatasto {
    return this._stato;
  }

  /** Ascolta un tipo di evento (o tutti con '*'); restituisce la funzione per smettere. */
  on<T extends TipoEvento>(tipo: T, fn: (e: EventoDi<T>) => void): () => void;
  on(tipo: '*', fn: (e: EventoCatasto) => void): () => void;
  on(tipo: string, fn: (e: never) => void): () => void {
    const set = this.ascoltatori.get(tipo) ?? new Set<Ascoltatore>();
    set.add(fn as Ascoltatore);
    this.ascoltatori.set(tipo, set);
    return () => set.delete(fn as Ascoltatore);
  }

  private emetti(eventi: readonly EventoCatasto[]): void {
    for (const e of eventi) {
      for (const fn of this.ascoltatori.get(e.tipo) ?? []) fn(e);
      for (const fn of this.ascoltatori.get('*') ?? []) fn(e);
    }
  }

  private applica(r: RisultatoCatasto): RisultatoCatasto {
    this._stato = r.stato;
    this.ultimiEffetti = r.effetti;
    this.emetti(r.eventi);
    return r;
  }

  // ── di giorno ──
  passa(posizione: PuntoFoglio): RisultatoCatasto {
    return this.applica(passa(this._stato, this.regole, posizione));
  }
  appunta(input: InputAppunto): RisultatoCatasto {
    return this.applica(appunta(this._stato, this.regole, input));
  }
  rileva(input: InputRilievo): RisultatoCatasto {
    return this.applica(rileva(this._stato, this.regole, input));
  }
  chiudiTriangolo(input: InputTriangolo): RisultatoCatasto {
    return this.applica(chiudiTriangolo(this._stato, this.regole, input));
  }
  stazioneLibera(input: InputStazioneLibera): RisultatoCatasto {
    return this.applica(stazioneLibera(this._stato, this.regole, input));
  }
  segnaCaposaldoVisto(id: string): RisultatoCatasto {
    return this.applica(segnaCaposaldoVisto(this._stato, this.regole, id));
  }
  rimettiCaposaldo(id: string): RisultatoCatasto {
    return this.applica(rimettiCaposaldo(this._stato, this.regole, id));
  }
  impostaVariante(elemento: string, variante: string): RisultatoCatasto {
    return this.applica(impostaVariante(this._stato, this.regole, elemento, variante));
  }
  cicliDelGiorno(input: InputCicli): RisultatoCatasto {
    return this.applica(applicaCicliDelGiorno(this._stato, this.regole, input));
  }
  annunciaMosse(ctx: ContestoMosse): RisultatoCatasto {
    return this.applica(annunciaMosse(this._stato, this.regole, ctx));
  }
  scriviConPenna(ancora: string): RisultatoCatasto {
    return this.applica(scriviConPenna(this._stato, this.regole, { ancora }));
  }
  rimisuraScrittura(ancora: string): RisultatoCatasto {
    return this.applica(rimisuraScrittura(this._stato, this.regole, ancora));
  }
  parametriSquadro(): ParametriSquadro {
    return parametriSquadro(this._stato, this.regole);
  }

  // ── di notte ──
  /** La notte intera (Elvira dorme, o il gioco non la segue minuto per minuto). */
  notte(input: InputNotte = {}): RisultatoNotte {
    const r = notte(this._stato, this.regole, input);
    this._stato = r.nuovoStato;
    this.ultimiEffetti = r.effetti;
    this.emetti(r.eventi);
    return r;
  }
  iniziaNotte(input: InputNotte = {}): void {
    this._stato = iniziaNotte(this._stato, this.regole, input);
  }
  /** Durante la veglia: da chiamare ogni minuto di gioco con la particella dove sta Elvira. */
  avanzaNotte(finoA: Ora, elvira?: { cella: number | null }): EventoCatasto[] {
    const r = avanzaNotte(this._stato, this.regole, finoA, elvira);
    this._stato = r.stato;
    this.emetti(r.eventi);
    return r.eventi;
  }
  chiudiNotte(): Resoconto {
    const r = chiudiNotte(this._stato, this.regole);
    this._stato = r.stato;
    this.ultimiEffetti = r.resoconto.effetti;
    this.emetti(r.eventi);
    return r.resoconto;
  }
  /** Che cosa farà la notte (l'avviso della sera), senza farlo. */
  previsione(input: InputNotte = {}): Resoconto {
    return previsioneNotte(this._stato, this.regole, input);
  }

  // ── letture ──
  statoParticella(id: number): StatoParticella {
    return statoDi(this._stato, id);
  }
  /** `cella:id rilevata` della narrativa: a colore per un rilievo di Elvira. */
  cellaRilevata(id: number): boolean {
    return cellaRilevataDaElvira(this._stato, id);
  }
  cellaAColore(id: number): boolean {
    return cellaAColore(this._stato, id);
  }
  variante(elemento: string): string | undefined {
    return varianteDi(this._stato, elemento);
  }
  info(id: number): InfoParticella {
    return infoParticella(this._stato, this.regole, id);
  }
  inventarioCompleto(): boolean {
    return inventarioCompleto(this._stato, this.regole);
  }
  ultimoResoconto(): Resoconto | null {
    return this._stato.ultimaNotte?.resoconto ?? null;
  }
  pianta(opzioni?: OpzioniPianta): DatiPiantaCatasto {
    return datiPianta(this._stato, this.regole, opzioni);
  }

  // ── salvataggio ──
  salva(): BlobCatasto {
    return salvaCatasto(this._stato);
  }
  /** Ripristina da un blob; restituisce gli avvisi della riconciliazione con i contenuti. */
  ripristina(blob: unknown, opzioni?: OpzioniCaricamento): string[] {
    const r = caricaCatasto(blob, this.regole, opzioni);
    this._stato = r.stato;
    return r.avvisi;
  }
  static carica(blob: unknown, regole: RegoleCatasto, opzioni?: OpzioniCaricamento): Catasto {
    return new Catasto(regole, caricaCatasto(blob, regole, opzioni).stato);
  }
}

// ───────────────────────────── collegamento al motore ─────────────────────────────

/** Ciò che il catasto usa del mondo del motore (`World` in src/world/world.ts). */
export interface MondoCelle {
  setCellState(id: number, stato: 0 | 1 | 2): void;
  revealCells(ids: number[], origine: { z: number; theta: number }): void;
}

/** Ciò che il catasto usa degli oggetti 3D: scambiare la variante di un elemento mobile. */
export interface OggettiVarianti {
  mostraVariante(elemento: string, variante: string, pezzi: { mostra: string[]; nascondi: string[] }): void;
}

/** Copia nel mondo lo stato di tutte le particelle (all'avvio e dopo un caricamento). */
export function sincronizzaMondo(stato: StatoCatasto, mondo: MondoCelle): void {
  const codici = celleMotore(stato);
  for (let id = 0; id < CELLE_TOTALI; id++) mondo.setCellState(id, codici[id] as 0 | 1 | 2);
}

/**
 * Collega gli eventi del catasto al motore: matita con `setCellState(id, 1)`, il colore con
 * `revealCells(ids, origine)` (l'inchiostro che si allarga dalla stazione), le particelle
 * perse di notte di nuovo a matita, le varianti agli oggetti 3D. Restituisce lo scollegamento.
 */
export function collegaAlMondo(catasto: Catasto, mondo: MondoCelle, oggetti?: OggettiVarianti): () => void {
  const via: (() => void)[] = [];
  via.push(catasto.on('particelle_matita', (e) => e.celle.forEach((c) => mondo.setCellState(c, 1))));
  via.push(catasto.on('particelle_rivelate', (e) => e.celle.length && mondo.revealCells([...e.celle], e.origine)));
  via.push(catasto.on('particelle_perse', (e) => e.celle.forEach((c) => mondo.setCellState(c, 1))));
  if (oggetti) via.push(catasto.on('variante_cambiata', (e) => oggetti.mostraVariante(e.elemento, e.a, { mostra: e.mostra, nascondi: e.nascondi })));
  return () => via.forEach((f) => f());
}
