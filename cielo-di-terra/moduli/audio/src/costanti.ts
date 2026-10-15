/**
 * Costanti del mondo (identiche a quelle del motore) e costanti di regia del suono.
 */
import type { IdZona, TipoZona } from './tipi';

/** Lunghezza del cilindro lungo l'asse Z: 0 = Tappo Sud, 3000 = Tappo Nord (il Sordo, la Lanterna). */
export const LUNGHEZZA_CILINDRO = 3000;
/** Raggio interno in metri: il suolo è a distanza R dall'asse. */
export const RAGGIO_INTERNO = 646;
/** Periodo di rotazione in secondi. */
export const PERIODO_ROTAZIONE = 51;
/** Un giorno di gioco dura 40 minuti reali. */
export const MINUTI_REALI_PER_GIORNO = 40;
/** Secondi reali per un'ora di gioco (100 s). */
export const SECONDI_REALI_PER_ORA = (MINUTI_REALI_PER_GIORNO * 60) / 24;

/** Descrizione di una fascia angolare. */
export interface DescrizioneZona {
  id: IdZona;
  nome: string;
  tipo: TipoZona;
  /** θ iniziale in gradi (incluso). */
  da: number;
  /** θ finale in gradi (escluso). */
  a: number;
}

/** Le sei fasce, in ordine di θ. */
export const ZONE: readonly DescrizioneZona[] = [
  { id: 'valle-1', nome: 'Corbella e le Selve', tipo: 'valle', da: 0, a: 90 },
  { id: 'finestra-ponti', nome: 'Finestra dei Ponti', tipo: 'finestra', da: 90, a: 120 },
  { id: 'valle-2', nome: 'Il Verbanetto', tipo: 'valle', da: 120, a: 210 },
  { id: 'finestra-2', nome: 'Finestra 2', tipo: 'finestra', da: 210, a: 240 },
  { id: 'valle-3', nome: 'Valle 3', tipo: 'valle', da: 240, a: 330 },
  { id: 'finestra-3', nome: 'Finestra 3', tipo: 'finestra', da: 330, a: 360 },
];

/** Corbella (Valle 1), con il campanile di San Vigilio: intorno a z 900-1200. */
export const CORBELLA = { thetaDa: 0, thetaA: 90, zDa: 900, zA: 1200 } as const;

/**
 * Stima grossolana del lago del Verbanetto (lungo 2 km): serve solo quando il gioco
 * non passa `distanzaLago`. θ e z sono indicativi, da sostituire con i dati veri.
 */
export const LAGO_STIMATO = { thetaDa: 147, thetaA: 183, zDa: 500, zA: 2500 } as const;

/** Ora (0-24) in cui la Linea comincia ad accendersi dal Tappo Sud «come una miccia». */
export const ORA_ACCENSIONE = 5.5;
/** Ora in cui la Linea è pienamente accesa. */
export const ORA_PIENA_LUCE = 7;
/** Ora in cui la Linea comincia a ritirarsi. */
export const ORA_TRAMONTO = 18.5;
/** Ora in cui la Linea è brace. */
export const ORA_BRACE = 20;
/** Ora in cui parte il tema musicale dell'alba (una volta per giorno di gioco). */
export const ORA_TEMA_ALBA = 5.8;

/** Larghezza in gradi della sfumatura sonora fra valle e Finestra. */
export const SFUMATURA_FINESTRA_GRADI = 4;
