/**
 * Le «porte» della regia verso i moduli ancora in arrivo.
 *
 * - `PortaPopolamento`: i contenuti veri di Corbella posati nel mondo (punti d'interazione,
 *   elementi mobili con le loro varianti). Oggi la implementano i segnaposto di `scena/`;
 *   il modulo `popolamento`, quando arriva, la implementa con i suoi oggetti.
 *
 * (Il catasto non ha più una porta: la regia usa direttamente `src/rilievo`, vedi `catasto.ts`.)
 */
import type { Vector3 } from 'three';

export interface PortaPopolamento {
  /** Punti notevoli per id (chiodi, segnali, buste, cartellino, porta del campanile…). */
  punto(id: string): Vector3 | null;
  /**
   * Mostra la variante di un elemento mobile (assi della passerella, gradini, casa di Nando).
   * `pezzi` sono i pezzi di fade_fase1.json da mostrare e da nascondere (evento del catasto).
   */
  mostraVariante(elemento: string, variante: string, pezzi?: { mostra: string[]; nascondi: string[] }): void;
  /** Animazioni (botola, cancelli…). */
  update?(dt: number): void;
}
