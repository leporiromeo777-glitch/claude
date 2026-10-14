/**
 * Registrazione del pacchetto tombolo (ARCHITETTURA 3.1, 5.3): la scena
 * 'tombolo', il debug `__GAME__.night`, il CSS.
 */
import type { Services } from '../core/types';
import './tombolo.css';
import { TomboloScene } from './TomboloScene';
import { registerNightDebug } from './debug';

export function register(s: Services): void {
  s.scenes.register('tombolo', () => new TomboloScene(s));
  registerNightDebug(s);
}
