/**
 * Le «porte» della regia: le interfacce che i moduli ancora in arrivo devono soddisfare.
 *
 * - `PortaRilievo`: il catasto (stati delle particelle, lati, appunti) e la notte delle Fade
 *   (varianti degli elementi mobili, resoconto del mattino). Oggi la implementa
 *   `provvisori/rilievo.ts`; quando arriva il modulo `rilievo` basta un adattatore.
 * - `PortaPopolamento`: i contenuti veri di Corbella posati nel mondo (punti d'interazione,
 *   abitanti, elementi mobili). Oggi la implementano i segnaposto di `scena/`.
 */
import type { Vector3 } from 'three';
import type { Emettitore } from '../narrativa';
import type { Intervallo } from './orologio';

export type StatoCella = 'bianco' | 'matita' | 'colore';

export interface CambioCelle {
  ids: number[];
  stato: StatoCella;
  /** Da dove si allarga l'inchiostro (la stazione del rilievo), se c'è. */
  origine: { z: number; theta: number } | null;
  motivo: 'iniziale' | 'rilievo' | 'appunto' | 'passaggio' | 'notte' | 'carico';
}

export type EsitoCollimazione =
  | { esito: 'chiuso'; lato: string; particelle: number[]; primoDelFoglio: boolean }
  | { esito: 'gia_chiuso'; lato: string; particelle: number[] }
  | { esito: 'non_visibile'; lato: string | null; motivo: string }
  | { esito: 'nessun_lato'; motivo: string };

export interface CambioVariante {
  elemento: string;
  da: string;
  a: string;
  /** Tempo assoluto (ore dall'inizio del giorno 1). */
  quando: number;
  chi: 'fade' | 'abitante' | 'storia';
  motivo?: string;
}

/** Segnali della notte per la regia (flag del contratto, Pesarina, passaggi delle Fade). */
export type SegnaleNotte =
  | { tipo: 'variante'; cambio: CambioVariante }
  | { tipo: 'flag'; nome: string }
  | { tipo: 'pesarina'; notte: number }
  | { tipo: 'passaggio'; elemento: string; protetto: 'rilevato' | 'elvira' | null; quando: number };

export interface Resoconto {
  titolo: string;
  righe: string[];
  /** Particelle cambiate stanotte (in rosso sulla Pianta fino alle 12:00). */
  cambiate: number[];
  prossimaFinestra?: string;
  /** Notte a cui si riferisce. */
  notte: number;
}

export interface ContestoNotte {
  /** Elvira si trova ora su una di queste particelle? */
  elviraSu(particelle: readonly number[]): boolean;
  /** Elvira dorme (dormi:fino) o è in un rifugio. */
  dorme: boolean;
}

export interface EventiRilievo {
  celle: CambioCelle;
  variante: CambioVariante;
}

export interface PortaRilievo {
  readonly eventi: Emettitore<EventiRilievo>;
  /** Stato di una particella (id del motore: iz·96 + iθ). */
  statoCella(id: number): StatoCella;
  /** Chi l'ha rilevata (G5 = Elvira, G4 = la striscia del 2291), o null. */
  rilevataDa(id: number): string | null;
  /** Tutte le particelle con il loro stato (per inizializzare il motore e la Pianta). */
  tutteLeCelle(): Iterable<[number, StatoCella]>;
  /** Stazione su `stazione`, mira su `mira`: chiude il lato se si può (rilievo di Elvira). */
  collima(stazione: string, mira: string, ore: number): EsitoCollimazione;
  /** Appunto con lo squadro in mano: bianco → matita. */
  appunta(cella: number): boolean;
  /** Elvira passa a (z, θ): le particelle bianche entro 60 m diventano matita. */
  passaggio(z: number, theta: number): void;
  latiChiusi(): string[];
  /** Variante corrente di un elemento mobile (E1…E4). */
  variante(elemento: string): string;
  impostaVariante(elemento: string, variante: string, chi: CambioVariante['chi'], quando: number): void;
  /** Fa scorrere il tempo (giorno e notte): cicli degli abitanti e giro delle Fade. */
  avanzaTempo(intervallo: Intervallo, ctx: ContestoNotte): SegnaleNotte[];
  /** Resoconto dell'ultima notte (null prima della prima). */
  resoconto(): Resoconto | null;
  esporta(): unknown;
  importa(dati: unknown): void;
}

/** Un punto d'interazione posato nel mondo (dal popolamento o dai segnaposto). */
export interface PuntoInterazione {
  id: string;
  posizione: Vector3;
}

export interface PortaPopolamento {
  /** Punti notevoli per id (chiodi, buste, cartellino, porta del campanile…). */
  punto(id: string): Vector3 | null;
  /** Mostra la variante di un elemento mobile (assi della passerella, gradini, casa di Nando). */
  mostraVariante(elemento: string, variante: string): void;
  /** Animazioni (botola, cancelli…). */
  update?(dt: number): void;
}
