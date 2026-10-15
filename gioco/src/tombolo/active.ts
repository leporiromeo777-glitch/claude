/**
 * La notte in corso (una sola scena 'tombolo' alla volta): la imposta la scena,
 * la leggono il debug e le funzioni pubbliche del pacchetto.
 */
import type { NightController } from './controller';

let current: NightController | null = null;

export function setActiveNight(c: NightController | null): void {
  current = c;
}

export function activeNight(): NightController | null {
  return current;
}

/**
 * Azioni della notte che il tombolo offre ma che appartengono a chi l'ha aperta (la
 * campagna, che il tombolo non importa). Q012: quando le richieste non stanno insieme,
 * prima della prima ora la Spinta offre anche «Torna alla sera».
 */
export interface NightHooks {
  backToEvening?: { can(): boolean; go(): void };
}

let hooks: NightHooks = {};

export function setNightHooks(h: NightHooks): void {
  hooks = h;
}

export function nightHooks(): NightHooks {
  return hooks;
}
