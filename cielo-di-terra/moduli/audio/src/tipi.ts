/**
 * Tipi pubblici del modulo audio di «Cielo di Terra».
 *
 * Il modulo non dipende da three.js: i vettori sono semplici oggetti {x, y, z}
 * (un THREE.Vector3 è compatibile e si può passare direttamente).
 */

/** Vettore 3D in metri, nel sistema del mondo (asse del cilindro = asse Z). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** I bus del mixer. «generale» è il master che raccoglie tutti gli altri. */
export type NomeBus = 'generale' | 'ambiente' | 'effetti' | 'voci' | 'musica';

/** Elenco ordinato dei bus, utile per interfacce e salvataggi. */
export const NOMI_BUS: readonly NomeBus[] = ['generale', 'ambiente', 'effetti', 'voci', 'musica'];

/** Le sei fasce angolari del cilindro (valli e Finestre). */
export type IdZona =
  | 'valle-1' // «Corbella e le Selve», θ 0-90
  | 'finestra-ponti' // θ 90-120
  | 'valle-2' // «Il Verbanetto», θ 120-210, con il lago
  | 'finestra-2' // θ 210-240
  | 'valle-3' // θ 240-330
  | 'finestra-3'; // θ 330-360

/** Tipo di fascia: le valli sono abitate e piene di suoni, le Finestre quasi mute. */
export type TipoZona = 'valle' | 'finestra';

/** Superfici dei passi. */
export type Superficie = 'erba' | 'pietra' | 'legno' | 'ghiaia';

/** Temi musicali che entrano in momenti precisi. */
export type TemaMusicale = 'alba' | 'primo-volo' | 'primo-rilievo' | 'notte-fade';

/** Varianti dei suoni delle Fade di notte. */
export type VarietaFade = 'carillon' | 'ronzio' | 'pietra';

/** Varianti dei suoni dell'interfaccia. */
export type VarietaInterfaccia = 'clic' | 'sopra' | 'conferma' | 'annulla' | 'apri' | 'chiudi';

/**
 * Stato del giocatore e del mondo, passato a `AudioEngine.aggiorna` a ogni fotogramma.
 * Solo `posizione`, `velocita` e `ora` sono obbligatori: il resto, se manca,
 * viene ricavato dalla posizione con le costanti del cilindro.
 */
export interface StatoAudio {
  /** Posizione dell'ascoltatore (la testa del giocatore), metri, sistema del mondo. */
  posizione: Vec3;
  /** Direzione dello sguardo (non serve normalizzarla). Predefinita: verso +Z. */
  avanti?: Vec3;
  /** Direzione «su». Predefinita: dal suolo verso l'asse del cilindro. */
  su?: Vec3;
  /** Velocità scalare in m/s (a piedi, in planata, in caduta). */
  velocita: number;
  /** Ora del giorno di gioco, 0-24 (si accettano anche valori fuori intervallo). */
  ora: number;
  /** Altezza dal suolo in metri. Predefinita: R - distanza dall'asse. */
  altezza?: number;
  /** Angolo θ in gradi (0-360). Predefinito: atan2(y, x). */
  theta?: number;
  /** Zona corrente. Predefinita: ricavata da θ. */
  zona?: IdZona;
  /** True quando il Velo è aperto (planata): attiva il fruscio del volo. */
  inVolo?: boolean;
  /** Distanza in metri dalla riva più vicina del lago. Predefinita: stima grossolana dalla posizione. */
  distanzaLago?: number;
  /** Distanza in metri dal piede del Sordo (Tappo Nord). Predefinita: 3000 - z. */
  distanzaSordo?: number;
  /** Densità delle Fade nei dintorni, 0-1 (solo di notte produce suoni automatici). Predefinita 0. */
  fadeVicine?: number;
}

/** Eventi sonori singoli («one-shot»), passati a `AudioEngine.evento`. */
export type EventoAudio =
  | { tipo: 'passo'; superficie: Superficie; forza?: number; posizione?: Vec3 }
  | { tipo: 'salto'; superficie?: Superficie }
  | { tipo: 'atterraggio'; superficie?: Superficie; velocita?: number }
  | { tipo: 'velo-apri' }
  | { tipo: 'velo-chiudi' }
  | { tipo: 'squadro-pianta'; posizione?: Vec3 }
  | { tipo: 'bolla-livellata' }
  | { tipo: 'inchiostro'; ampiezza?: number; posizione?: Vec3 }
  | { tipo: 'pagina'; verso?: 'avanti' | 'indietro' }
  | { tipo: 'fade'; varieta: VarietaFade; posizione?: Vec3 }
  | { tipo: 'api'; durata?: number; posizione?: Vec3 }
  | { tipo: 'campane'; modo?: 'ore' | 'rintocco' | 'festa'; ore?: number; posizione?: Vec3 }
  | { tipo: 'accensione-linea' }
  | { tipo: 'interfaccia'; varieta: VarietaInterfaccia }
  | { tipo: 'tema'; tema: TemaMusicale };

/** Il nome di ogni tipo di evento. */
export type TipoEvento = EventoAudio['tipo'];

/** Stato del motore audio. */
export type StatoMotore = 'spento' | 'attivo' | 'in-pausa' | 'distrutto';

/** Opzioni di una sorgente posizionale creata dal gioco. */
export interface OpzioniSorgente {
  /** Bus di destinazione (predefinito «effetti»). */
  bus?: Exclude<NomeBus, 'generale'>;
  /** Distanza a cui il volume è pieno (m). Predefinita 5. */
  distanzaRiferimento?: number;
  /** Oltre questa distanza non si attenua più (m). Predefinita 2000. */
  distanzaMassima?: number;
  /** Fattore di attenuazione con la distanza (modello inverso). Predefinito 1. */
  attenuazione?: number;
}

/** Una sorgente sonora posizionata nel mondo (HRTF). */
export interface SorgentePosizionale {
  /** Nodo a cui collegare il proprio suono. */
  readonly ingresso: AudioNode;
  /** Sposta la sorgente (con un breve scivolamento per evitare scatti). */
  posiziona(p: Vec3): void;
  /** Scollega e libera la sorgente. */
  rilascia(): void;
}
