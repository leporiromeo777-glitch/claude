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
