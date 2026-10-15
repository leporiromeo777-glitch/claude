/**
 * I nomi dei comandi per i segnaposto dei testi: `{usa}`, `{siedi}`… nei suggerimenti di
 * testi.json e nelle indicazioni dei passi di missioni.json.
 *
 * Una sola tabella, scritta con le graffe dove il comando è un tasto da disegnare come un
 * tastino (`{E}`); i suggerimenti usano la versione in testo semplice (`TASTI`), il pannello
 * dell'obiettivo quella con i tastini (`TASTI_SEGNATI`). Niente DOM né three.js: la usa anche
 * `npm run verifica-contenuti` per controllare che ogni segnaposto esista.
 */

/** Segnaposto → comando, con i tasti fra graffe (il pannello li disegna come tastini). */
export const TASTI_SEGNATI: Readonly<Record<string, string>> = {
  usa: '{E}',
  guarda: 'il mouse',
  muovi: '{W A S D}',
  corri: '{Shift}',
  siedi: '{C}',
  lente: '{Q}',
  pianta: '{P}',
  salta: '{Spazio}',
  velo: 'tieni {Spazio} in aria',
  aspetta: '{X}',
  libretto: '{L}',
  mira: '{tasto destro}',
  squadro: '{R}',
  chiama: '{G}',
  sali: '{W}',
  livella: '{A} e {D}',
  taccuino: '{T}',
  obiettivi: '{O}',
};

/** Segnaposto → comando in testo semplice (i suggerimenti dei comandi). */
export const TASTI: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(TASTI_SEGNATI).map(([k, v]) => [k, v.replace(/[{}]/g, '')]),
);
