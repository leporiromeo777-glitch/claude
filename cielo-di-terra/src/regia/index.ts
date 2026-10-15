/**
 * La regia di «Cielo di Terra» (Fase 1): API pubblica.
 *
 *   const ui = new InterfacciaGioco(app, { datiTaccuino: () => regia.ponte.datiTaccuino(), … });
 *   const game = new Game(app, …); await game.init();
 *   const regia = new Regia(game, ui);
 *   await regia.mostraTitolo();          // oppure regia.nuovaPartita()
 */
export { Regia, type Controllo, type MondoSalvato, calcolaFaseMeta, distanzaDallAsse, PERIODO_META } from './regia';
export { OrologioStoria, attraversa, eNotte, assolutoDi, type Intervallo, type StatoOrologio } from './orologio';
export { Luoghi, quotaLuogo, dentroLuogo, posizioneLuogo } from './luoghi';
export { Interazioni, punteggio, type Bersaglio, type StatoInterazione } from './interazioni';
export { Sguardi, guardaPunto, elevazione, type ControlloSguardo } from './sguardo';
export { Corpo, SOGLIA_FIATO, type EventoCorpo, type PassoCorpo } from './corpo';
export { RilievoProvvisorio, notteDi } from './provvisori/rilievo';
export type { PortaRilievo, PortaPopolamento, EsitoCollimazione, Resoconto, SegnaleNotte, StatoCella, CambioCelle, CambioVariante } from './porte';
export { installaDebugRegia, type DebugRegia } from './debug';
