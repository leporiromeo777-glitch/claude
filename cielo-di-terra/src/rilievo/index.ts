/**
 * Il catasto di «Cielo di Terra»: rilievo di giorno, notte delle Fade, resoconto del mattino,
 * dati per la Pianta, salvataggio. TypeScript puro, senza DOM e senza three.js.
 */
export * from './costanti';
export * from './griglia';
export * from './tempo';
export type * from './tipi';
export * from './catalogoGdd';
export { regoleDaContenuti, latoFra, caposaldoDef, defParticella, chiaveCoppia, etichettaDaId, TESTI_PREDEFINITI } from './regole';
export type { ContenutiCatasto, OpzioniRegole } from './regole';
export * from './stato';
export * from './visibilita';
export * from './rilievo';
export * from './notte';
export * from './resoconto';
export * from './pianta';
export * from './salvataggio';
export * from './catasto';
export { generatore, mescola, semeNotte } from './casuale';
