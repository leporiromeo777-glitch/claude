/**
 * Costanti del mondo e del catasto.
 *
 * Copiate dal motore (`src/world/layout.json`, `src/world/constants.ts`,
 * `src/world/cells.ts`) e dal GDD (§2.1, §2.3, §3.2, §3.4) per non dipendere dal
 * codice del motore, che è ancora in lavorazione. Se il motore le cambia, vanno
 * cambiate anche qui: `test/griglia.test.ts` le confronta con `layout.json`
 * quando il file è raggiungibile.
 */

/** Raggio interno del cilindro (m): fondo delle valli, quota h = 0. */
export const R = 646;
/** Lunghezza lungo l'asse (m): z = 0 Tappo Sud, z = 3000 Tappo Nord (il Sordo). */
export const L = 3000;
/** Periodo di rotazione (s). */
export const PERIODO_ROTAZIONE = 51;

export const DEG = Math.PI / 180;

/** Griglia delle particelle: 75 righe in z × 96 colonne in θ, id = iz·96 + iθ. */
export const CELLE_NZ = 75;
export const CELLE_NTHETA = 96;
export const CELLE_TOTALI = CELLE_NZ * CELLE_NTHETA;
/** Lato di una cella lungo z (m). */
export const CELLA_DZ = L / CELLE_NZ; // 40
/** Lato di una cella in θ (gradi). */
export const CELLA_DTHETA = 360 / CELLE_NTHETA; // 3,75

/** Il Sordo comincia a questa z (il piede della parete nord). */
export const Z_SORDO = 2640;

/** Strisce del cilindro (layout.json → strips) con il foglio del catasto (GDD §2.2). */
export interface Striscia {
  id: string;
  tipo: 'valle' | 'finestra';
  nome: string;
  thetaDa: number;
  thetaA: number;
  foglio: number;
}

export const STRISCE: readonly Striscia[] = [
  { id: 'valle-1', tipo: 'valle', nome: 'Corbella e le Selve', thetaDa: 0, thetaA: 90, foglio: 1 },
  { id: 'finestra-ponti', tipo: 'finestra', nome: 'Finestra dei Ponti', thetaDa: 90, thetaA: 120, foglio: 5 },
  { id: 'valle-2', tipo: 'valle', nome: 'Il Verbanetto', thetaDa: 120, thetaA: 210, foglio: 2 },
  { id: 'finestra-2', tipo: 'finestra', nome: 'Finestra Cieca', thetaDa: 210, thetaA: 240, foglio: 5 },
  { id: 'valle-3', tipo: 'valle', nome: 'Gli Alpeggi', thetaDa: 240, thetaA: 330, foglio: 3 },
  { id: 'finestra-3', tipo: 'finestra', nome: 'Finestra delle Vedove', thetaDa: 330, thetaA: 360, foglio: 5 },
];

/** Fogli del catasto (GDD §2.2). */
export const FOGLI: Readonly<Record<number, string>> = {
  1: 'Corbella e le Selve',
  2: 'Il Verbanetto',
  3: 'Gli Alpeggi',
  4: 'Il Sordo',
  5: 'Le Finestre',
  6: 'Il Fuso',
  7: 'Il Guscio',
};

/** Orari del giorno di gioco (GDD §2.3), in minuti dalla mezzanotte. */
export const ORARI = {
  alba: 5 * 60 + 30,
  giornoPieno: 6 * 60 + 30,
  brace: 19 * 60 + 30,
  notte: 21 * 60,
  inizioGiro: 22 * 60,
  fineGiro: 4 * 60 + 30,
  /** I segni rossi del resoconto restano sulla Pianta per tutto il mattino. */
  fineMattino: 12 * 60,
} as const;

/** Parametri del rilievo e della notte (GDD §3.2, §3.4; capisaldi.json → regole). */
export interface ParametriCatasto {
  /** Lato minimo (m, distanza 3D fra i capisaldi). */
  latoMin: number;
  /** Lato massimo di giorno (m). */
  latoMaxGiorno: number;
  /** Fascia del ventaglio: distanza massima del centro della particella dal segmento (m, sul foglio). */
  bufferVentaglio: number;
  /** Di giorno un lato che passa a meno di questa distanza dall'asse abbaglia (m). */
  abbagliamentoAsse: number;
  /** Portata del cannocchiale ×4 per appuntare (m). */
  portataAppunto: number;
  /** Oltre questa distanza l'appunto è «lontano» (flag appuntato_lontano). */
  appuntoLontano: number;
  /** Passando a meno di questa distanza una particella bianca diventa matita (m). */
  raggioMatita: number;
  /** Raggio attorno ai vertici di un triangolo attraverso il cielo (m). */
  raggioTriangolo: number;
  /** Raggio del ventaglio di una stazione libera (m). */
  raggioStazioneLibera: number;
  /** Separazione angolare minima fra i tre lumi di una stazione libera (gradi). */
  separazioneLumi: number;
  /** Tetto dei capisaldi spostati in una notte (regola 1). */
  tettoCapisaldiPerNotte: number;
  /** Tetto delle particelle cambiate dal giro in una notte (regola 3); Infinity = nessun tetto. */
  tettoParticellePerNotte: number;
  /** Mosse della Madre annunciate al massimo per sera. */
  mossePerNotte: number;
  /** Dopo questi rilievi «la mano ricorda» (GDD §3.2). */
  rilieviManoCheRicorda: number;
}

export const PARAMETRI_PREDEFINITI: Readonly<ParametriCatasto> = {
  latoMin: 40,
  latoMaxGiorno: 600,
  bufferVentaglio: 60,
  abbagliamentoAsse: 150,
  portataAppunto: 1500,
  appuntoLontano: 600,
  raggioMatita: 60,
  raggioTriangolo: 80,
  raggioStazioneLibera: 40,
  separazioneLumi: 10,
  tettoCapisaldiPerNotte: 8,
  tettoParticellePerNotte: Number.POSITIVE_INFINITY,
  mossePerNotte: 1,
  rilieviManoCheRicorda: 10,
};

/** Firma di Elvira, la Giardiniera n. 5. */
export const FIRMA_ELVIRA = 'G5';
/** Firma della Madre (Ilde Bassi, n. 3): le correzioni al terminale. */
export const FIRMA_MADRE = 'G3';
