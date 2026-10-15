/**
 * Tipi del catasto: le regole (dati di partenza, immutabili, compilati dai contenuti)
 * e lo stato (che cambia di giorno con il rilievo e di notte con le Fade).
 *
 * Lo stato è un oggetto JSON puro (niente Map, niente classi): si clona, si confronta e
 * si salva così com'è. Le regole invece usano le Map per comodità e non si salvano.
 */
import type { ParametriCatasto } from './costanti';
import type { PuntoFoglio } from './griglia';
import type { FaseDelGiorno, Intervallo } from './tempo';

// ───────────────────────────── valori di base ─────────────────────────────

/** I tre stati della mappa (GDD §3.3), con i nomi di fade_fase1.json. */
export type StatoParticella = 'bianco' | 'matita' | 'colore';
/** Inchiostro di una particella a colore: china (Elvira) o seppia (un rilievo antico, il G4 del 2291). */
export type Inchiostro = 'china' | 'seppia';
/** Le direzioni del mondo come le dice la gente (GDD §2.2). */
export type Direzione = 'Mane' | 'Sera' | 'Mont' | 'Lag';
export type Atto = 'I' | 'II' | 'III';

// ───────────────────────────── regole ─────────────────────────────

/** Un rilievo antico già scritto nel Catasto all'inizio del gioco. */
export interface RilievoStorico {
  firma: string;
  anno: number | null;
  lato: string | null;
  inchiostro: Inchiostro;
}

export interface DefParticella {
  id: number;
  catasto: string;
  tipo: string | null;
  nomi: string[];
  hub: boolean;
  rifugio: boolean;
  /** Via di trama: le Fade non la toccano mai (regola 4). Nella Fase 1 nessuna particella lo è. */
  viaTrama: boolean;
  elemento: string | null;
  inventario: boolean;
  statoIniziale: StatoParticella;
  rilevataDa: RilievoStorico | null;
}

export interface DefLume {
  /** permanente (faro, lanterna, lumino); ottavio (solo con il lume di mira); nessuno. */
  tipo: 'permanente' | 'ottavio' | 'nessuno';
  descrizione: string;
  /** Ore in cui il lume è acceso (null = mai). */
  ore: Intervallo | null;
  /** Ore in cui il Collare lo copre. */
  collare: Intervallo[];
}

export type TipoCaposaldo = 'pilastro' | 'chiodo' | 'zero' | 'chiodo_nuovo';

export interface DefCaposaldo {
  id: string;
  numero: number | null;
  /** Come si scrive nel libretto: «1», «37», «E1». */
  etichetta: string;
  tipo: TipoCaposaldo;
  nome: string;
  z: number;
  theta: number;
  altezza: number;
  /** Altezza del segnale (palina, disco) sopra il caposaldo: il bersaglio della collimazione. */
  altezzaSegnale: number;
  cella: number;
  /** Striscia del cilindro (valle-1, finestra-ponti…). */
  valle: string;
  /** Capisaldi da cui questo si può collimare (capisaldi.json → visibile_da). */
  visibileDa: string[];
  nonVisibileDa: { id: string; motivo: string }[];
  lume: DefLume | null;
  /** Pilastro lontano visto di notte (capisaldi.json → lontani_di_notte). */
  lontano: boolean;
  /** Si può usare per rilevare in questa fase. */
  rilevabile: boolean;
  motivoNonRilevabile: string | null;
  /** Si appunta ma resta bianco sulla Pianta (il Caposaldo Zero). */
  sempreBianco: boolean;
  /** Chi l'aveva già usato all'inizio del gioco (G4 per i capisaldi 1 e 11). */
  rilevatoDa: string | null;
  monografia: string | null;
  luogo: string | null;
  fonte: 'contenuti' | 'GDD' | 'stazione_libera';
}

export interface DefLato {
  id: string;
  a: string;
  b: string;
  /** Distanza 3D fra i capisaldi (m). */
  lunghezza: number;
  chiudibile: boolean;
  quando: FaseDelGiorno[];
  /** Il ventaglio precalcolato (vuoto se il lato non si chiude). */
  particelle: number[];
  particelleSeChiudibile: number[];
  nota: string;
}

export interface DefVariante {
  id: string;
  descrizione: string;
  /** Pezzi 3D (decal, sagome) da mostrare quando l'elemento ha questa variante. */
  pezzi: string[];
}

/** Un cambiamento fatto di giorno dagli abitanti (Bortolo rimette i gradini alle 07:00…). */
export interface DefCiclo {
  ora: number;
  chi: string;
  da: string;
  a: string;
  testo: string;
}

export interface DefElemento {
  id: string;
  nome: string;
  particelle: number[];
  trama: boolean;
  varianti: DefVariante[];
  varianteIniziale: string;
  /** Ora fissa del passaggio delle Fade (minuti dalla mezzanotte); null = le Fade non passano. */
  oraFade: number | null;
  /** Stadi ordinati dall'abitato alla Carta (la casa di Nando perde un muro per notte). */
  stadi: string[] | null;
  cicli: DefCiclo[];
  viaNecessaria: boolean;
  /** Il luogo che fa da alternativa visibile (il guado del Sass per la passerella). */
  alternativa: string | null;
  legatoA: string | null;
  /** Elemento del Protocollo Rientro: dopo la svolta, se non rilevato, passa a Mietuta. */
  protocollo: boolean;
  /** Motivo per transizione, «Abitata>Carta» → «Non misurata: tornata alla Carta.» */
  motivi: Record<string, string>;
  /** Che cosa fanno le Fade al passaggio (giro_corbella). */
  cheCosa: string | null;
  dove: string | null;
  note: string;
}

export interface DefTriangolo {
  id: string;
  nome: string;
  missione: string;
  /** cielo: tre pilastri si vedono a vicenda; stazione_libera: tre lumi collimati da un punto libero. */
  tipo: 'cielo' | 'stazione_libera';
  /** I tre pilastri (vertici del triangolo o lumi della stazione libera). */
  vertici: string[];
  /** Per T6: il caposaldo su cui sta la stazione (il Caposaldo Zero). */
  stazione: string | null;
  particelleTrama: number[];
  cheCosaRileva: string;
}

export type EffettoMossa =
  | { tipo: 'sposta'; capisaldi: { id: string; metri: number; direzione: Direzione }[] }
  | { tipo: 'sposta_scelti'; quanti: number; metri: number; direzione: Direzione }
  | { tipo: 'contatore'; nome: string; delta: number; max?: number }
  | { tipo: 'cancella_scrittura'; ancora: string }
  | { tipo: 'evento'; nome: string; testo: string };

/** Una delle dodici mosse della Madre (GDD §3.4.5). */
export interface DefMossa {
  id: string;
  atto: Atto;
  nome: string;
  /** Condizione nel linguaggio di `condizioniMossa` (sempre, flag:x, lato_con:cs_4, …). */
  condizione: string;
  effetti: EffettoMossa[];
  /** La frase dell'Ombrista la sera prima. */
  annuncio: string;
  /** Con il velo della Madre colpisce le case degli Smascherati invece dei capisaldi di Elvira. */
  deviataDalVelo: boolean;
  descrizione: string;
}

/** Un'ancora della Penna di catasto (GDD §3.4.7). */
export interface DefAncora {
  id: string;
  elemento: string;
  descrizione: string;
}

/** Ciò che una notte particolare aggiunge alla regola generale (fade_fase1.json → notti). */
export interface DefNotte {
  numero: number;
  /** Flag della Pesarina (solo la prima notte: «taccuino_spostato»). */
  pesarinaFlag: string | null;
  pesarinaOra: number | null;
  eventi: { ora: number; testo: string }[];
}

export interface TestiResoconto {
  titolo: string;
  /** Riga per variante d'arrivo con {nome}: «{nome}: non misurata, tornata alla Carta.» */
  perVariante: Record<string, string>;
  nessunCambiamento: string;
  rilevataRimasta: string;
  vegliata: string;
  protetta: string;
  caposaldoSpostato: string;
  scritturaCancellata: string;
  scritturaCostruita: string;
  /** Riga in fondo con le prossime finestre utili: «Alle {ora}: {testo}». */
  prossimaFinestra: string;
}

export interface RegoleAttive {
  /** Regola 1: le mosse della Madre (dalla Fase 5). */
  mosse: boolean;
  /** Regola 2: le correzioni al terminale (dalla Fase 5). */
  terminale: boolean;
  /** Regola 3: il giro delle Fade. */
  giro: boolean;
  /** Regola 4: le eccezioni fisse. */
  eccezioni: boolean;
}

export interface RegoleCatasto {
  fase: number;
  parametri: ParametriCatasto;
  regoleAttive: RegoleAttive;
  particelle: ReadonlyMap<number, DefParticella>;
  /** Area descritta dai contenuti (fade_fase1.json → area_fase1), in indici di cella. */
  area: { izMin: number; izMax: number; itMin: number; itMax: number } | null;
  capisaldi: ReadonlyMap<string, DefCaposaldo>;
  lati: ReadonlyMap<string, DefLato>;
  elementi: ReadonlyMap<string, DefElemento>;
  elementoDiCella: ReadonlyMap<number, string>;
  inventario: { nome: string; particelle: number[]; flag: string } | null;
  /** Flag da accendere quando una particella è rilevata (2796 → casa_nando_rilevata). */
  flagCelle: ReadonlyMap<number, string>;
  triangoli: ReadonlyMap<string, DefTriangolo>;
  mosse: readonly DefMossa[];
  tettoMossePerAtto: Readonly<Record<Atto, number>>;
  ancore: ReadonlyMap<string, DefAncora>;
  notti: ReadonlyMap<number, DefNotte>;
  /** La notte che fa da modello per quelle non scritte (FASE1 §7.4: la notte 2). */
  notteModello: number | null;
  /** Eventi del giro che non cambiano niente (le Fade escono, il ballo alle Selve alte). */
  giroEventi: { ora: number; dove: string; testo: string }[];
  testi: TestiResoconto;
  leggi: { id: string; articolo: string; proverbio: string; italiano: string }[];
  /** Avvisi raccolti leggendo i contenuti (campi mancanti, id sconosciuti). */
  problemi: string[];
}

// ───────────────────────────── stato ─────────────────────────────

export interface Rilievo {
  firma: string;
  tipo: 'lato' | 'triangolo' | 'stazione_libera' | 'storico';
  /** Id del lato, del triangolo o del chiodo nuovo. */
  rif: string;
  /** Capisaldi da cui il rilievo dipende (seconda legge: vale finché restano al loro posto). */
  capisaldi: string[];
  giorno: number | null;
  anno: number | null;
}

export interface ParticellaStato {
  stato: StatoParticella;
  rilievi: Rilievo[];
  /** Capisaldi spostati che le hanno fatto perdere il rilievo (si rimisura in 5 s). */
  persaPer?: string[];
}

export interface ElementoStato {
  variante: string;
  /** La riga verde «misurata: è rimasta» è già stata scritta dall'ultimo rilievo. */
  rimastaSegnalata: boolean;
}

export interface Spostamento {
  metri: number;
  direzione: Direzione;
  notte: number;
  mossa: string | null;
}

export interface CaposaldoStato {
  visto: boolean;
  rilevato: boolean;
  /** Chi ha chiuso lati su questo caposaldo (G4, G5). */
  firme: string[];
  spostato: Spostamento | null;
}

export interface LatoStato {
  id: string;
  stazione: string;
  mira: string;
  firma: string;
  giorno: number | null;
  anno: number | null;
}

export interface TriangoloStato {
  id: string;
  tipo: 'cielo' | 'rete' | 'stazione_libera';
  vertici: string[];
  giorno: number | null;
}

export interface AncoraStato {
  /** vuota → scritta (di giorno) → costruita (la notte, dalle Fade) → rimisurata (all'alba). */
  stato: 'vuota' | 'scritta' | 'costruita' | 'rimisurata';
  giorno: number | null;
  /** La variante che l'elemento aveva prima della scrittura. */
  variantePrima: string | null;
}

export interface MossaProgrammata {
  id: string;
  /** Numero della notte in cui si applica (la sera dell'annuncio). */
  notte: number;
  annuncio: string;
  deviata: boolean;
}

export type MotivoProtezione = 'rilevato' | 'hub' | 'rifugio' | 'via_trama' | 'elvira' | 'via_necessaria' | 'protetta';

export interface Cambiamento {
  /** Minuti dalla mezzanotte. */
  ora: number;
  regola: 1 | 2 | 3;
  tipo:
    | 'variante'
    | 'caposaldo_spostato'
    | 'particelle_a_matita'
    | 'scrittura_cancellata'
    | 'scrittura_costruita'
    | 'contatore'
    | 'evento';
  elemento?: string;
  caposaldo?: string;
  mossa?: string;
  particelle: number[];
  da?: string;
  a?: string;
  motivo: string;
}

export interface RigaResoconto {
  /** rosso = cambiato; verde = misurato, è rimasto; grigio = salvato da altro (Elvira c'era). */
  colore: 'rosso' | 'verde' | 'grigio';
  testo: string;
  motivo: string;
  regola: 1 | 2 | 3 | 4;
  elemento?: string;
  caposaldo?: string;
  particelle: number[];
}

export interface VoceCronologia {
  ora: string;
  testo: string;
  elemento?: string;
  dove?: string;
}

/** Il resoconto del mattino (GDD §3.4.8), pronto per la Pianta e il Taccuino. */
export interface Resoconto {
  notte: number;
  /** Giorno della sera: la notte N va dalle 21:00 del giorno N alle 05:30 del giorno N + 1. */
  giorno: number;
  titolo: string;
  quieta: boolean;
  righe: RigaResoconto[];
  /** Le prossime finestre utili, in chiaro («Alle 07:00: il campanaro Bortolo rimette i gradini.»). */
  prossimeFinestre: string[];
  /** Tutte le righe in fila, come le scrive il Taccuino (prima quelle rosse). */
  testo: string[];
  particelleCambiate: number[];
  cambiamenti: Cambiamento[];
  cronologia: VoceCronologia[];
  /** Effetti per la narrativa (flag:notte_su_E1, flag:taccuino_spostato, …). */
  effetti: string[];
}

export interface UltimaNotte {
  numero: number;
  giorno: number;
  cambiate: number[];
  /** Particelle che le Fade non hanno toccato, con il motivo. */
  protette: Record<string, MotivoProtezione>;
  /** Particelle dove Elvira era al passaggio delle Fade. */
  vegliate: number[];
  resoconto: Resoconto;
}

/** Lo stato di Elvira durante la notte. */
export interface ElviraNotte {
  /** Particella dove passa la notte (il letto, il rifugio, la passerella). */
  cella?: number | null;
  /** Oppure il percorso: da quell'ora in poi Elvira è su quella particella (null = nel Guscio, altrove). */
  percorso?: { ora: string | number; cella: number | null }[];
  /** È rimasta sveglia tutta la notte (veglia). */
  sveglia?: boolean;
}

export interface InputNotte {
  elvira?: ElviraNotte;
  /** Seme per le scelte (i chiodi della Notte dei Termini): stesso seme, stessa notte. */
  seme?: number;
  /** Dopo la svolta: gli elementi del Protocollo non rilevati passano a Mietuta. */
  dopoSvolta?: boolean;
  /** Con l'Ombra di Meridiana la Madre non vede le firme di Elvira. */
  ombraDiMeridiana?: boolean;
  /** Elvira porta il velo della Madre: le mosse A1-A3 e B2 colpiscono altrove. */
  veloDellaMadre?: boolean;
  /** Particelle protette come se fossero rilevate (Radice di confine, …). */
  particelleProtette?: number[];
  /** Alternative (luoghi) che stanotte non sono disponibili o visibili. */
  alternativeNonDisponibili?: string[];
  /** Righe in più per la prossima finestra utile (Meta, marea, vento…), calcolate dal gioco. */
  prossimeFinestreExtra?: string[];
}

export interface NotteInCorso {
  numero: number;
  giorno: number;
  seme: number;
  /** Minuti dal mezzogiorno già elaborati (esclusi). */
  fatto: number;
  regoleIniziali: boolean;
  input: InputNotte;
  cambiamenti: Cambiamento[];
  protette: Record<string, MotivoProtezione>;
  /** Elementi salvati e perché (per le righe verdi e grigie). */
  salvati: { elemento: string; motivo: MotivoProtezione; ora: number }[];
  vegliate: number[];
  effetti: string[];
  cronologia: VoceCronologia[];
  elementiFatti: string[];
  particelleCambiateGiro: number;
  capisaldiSpostati: number;
}

export interface StatoCatasto {
  versione: 1;
  /** Giorno di gioco corrente (il primo è 1). */
  giorno: number;
  /** Notti già passate. */
  nottiPassate: number;
  /** Solo le particelle non bianche o con rilievi, per id. */
  particelle: Record<string, ParticellaStato>;
  elementi: Record<string, ElementoStato>;
  capisaldi: Record<string, CaposaldoStato>;
  /** Chiodi piantati da Elvira con la stazione libera (E1, E2…). */
  capisaldiNuovi: Record<string, DefCaposaldo>;
  lati: Record<string, LatoStato>;
  triangoli: Record<string, TriangoloStato>;
  ancore: Record<string, AncoraStato>;
  mosse: { programmate: MossaProgrammata[]; usate: string[] };
  /** Contatori globali (smeriglio della Finestra Cieca, gelo degli Alpeggi…) e flag delle mosse. */
  contatori: Record<string, number>;
  /** Rilievi riusciti di Elvira (la mano che ricorda). */
  rilieviFatti: number;
  /** Fogli già rilevati almeno una volta (la griglia a china si traccia solo la prima volta). */
  fogliRilevati: number[];
  /** Lumi lontani già appuntati di notte (contatore:lumi_appuntati). */
  lumiAppuntati: string[];
  ultimaNotte: UltimaNotte | null;
  notteInCorso: NotteInCorso | null;
}

// ───────────────────────────── eventi e risultati ─────────────────────────────

export type CodiceMotivo =
  | 'stazione_sconosciuta'
  | 'mira_sconosciuta'
  | 'stessa_stazione'
  | 'senza_fiato'
  | 'stazione_spostata'
  | 'mira_spostata'
  | 'non_attivo'
  | 'troppo_corto'
  | 'troppo_lungo'
  | 'altra_valle'
  | 'abbaglia'
  | 'fuori_orario'
  | 'coperto'
  | 'collare'
  | 'buio'
  | 'troppo_lontano'
  | 'lumi_insufficienti'
  | 'lumi_allineati'
  | 'tre_valli'
  | 'ancora_sconosciuta'
  | 'ancora_occupata'
  | 'particella_non_rilevata'
  | 'una_per_notte'
  | 'non_notte';

export type EventoCatasto =
  | { tipo: 'particelle_matita'; celle: number[]; origine: PuntoFoglio; causa: 'passaggio' | 'appunto' }
  | {
      tipo: 'particelle_rivelate';
      /** Particelle che passano a colore adesso (erano bianche o a matita). */
      celle: number[];
      /** Particelle che erano a seppia (G4) e ora sono ripassate a china. */
      ripassate: number[];
      /** Tutto il ventaglio, già a colore compreso. */
      ventaglio: number[];
      /** Il punto da cui l'inchiostro si allarga (la stazione). */
      origine: PuntoFoglio;
      verso: PuntoFoglio | null;
      causa: 'lato' | 'triangolo' | 'stazione_libera';
      rif: string;
      /** Primo rilievo del foglio: la griglia a china del foglio intero per 6 s. */
      primoDelFoglio: boolean;
      foglio: number;
      /** Ripresa di un rilievo perso per un caposaldo spostato (si fa in 5 s). */
      rimisura: boolean;
    }
  | { tipo: 'particelle_perse'; celle: number[]; motivo: string; caposaldo?: string }
  | { tipo: 'lato_chiuso'; lato: string; stazione: string; mira: string; particelle: number[]; nuove: number }
  | {
      tipo: 'rilievo_fallito';
      operazione: 'lato' | 'triangolo' | 'stazione_libera' | 'appunto' | 'penna';
      stazione?: string;
      mira?: string;
      motivo: CodiceMotivo;
      messaggio: string;
    }
  | { tipo: 'triangolo_chiuso'; triangolo: string; tipoTriangolo: 'cielo' | 'rete' | 'stazione_libera'; vertici: string[]; particelle: number[] }
  | { tipo: 'caposaldo_nuovo'; caposaldo: DefCaposaldo }
  | { tipo: 'caposaldo_visto'; caposaldo: string }
  | { tipo: 'caposaldo_spostato'; caposaldo: string; spostamento: Spostamento }
  | { tipo: 'caposaldo_rimesso'; caposaldo: string }
  | {
      tipo: 'variante_cambiata';
      elemento: string;
      da: string;
      a: string;
      /** Pezzi 3D da mostrare e da nascondere (le varianti sono già costruite). */
      mostra: string[];
      nascondi: string[];
      causa: 'notte' | 'giorno' | 'gioco';
      ora: number | null;
      chi?: string;
    }
  | { tipo: 'mossa_annunciata'; mossa: string; notte: number; annuncio: string }
  | { tipo: 'scrittura'; ancora: string; stato: AncoraStato['stato'] }
  | { tipo: 'appunto'; cella: number | null; caposaldo?: string; lontano: boolean; messaggio?: string }
  | { tipo: 'resoconto'; resoconto: Resoconto };

export interface RisultatoCatasto {
  stato: StatoCatasto;
  ok: boolean;
  eventi: EventoCatasto[];
  /** Effetti per la narrativa, nel suo linguaggio (flag:tentato_lato:2-1, contatore:lumi_appuntati+1…). */
  effetti: string[];
  motivo?: CodiceMotivo;
  messaggio?: string;
}
