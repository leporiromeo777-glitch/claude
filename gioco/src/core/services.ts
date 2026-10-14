/**
 * Registro dei servizi (ARCHITETTURA 3.1, 4).
 *
 * `services` è popolato all'avvio da `main.ts` (installServices); i pacchetti lo
 * importano e lo usano dalla loro funzione di registrazione in poi. Accedere a
 * un servizio prima dell'avvio dà un errore leggibile invece di un undefined.
 * `registerAudio(a)` sostituisce l'audio vuoto con il motore vero.
 */
import type { AudioEngine, Services } from './types';

const SERVICE_KEYS: ReadonlySet<string> = new Set<keyof Services>([
  'bus', 'scenes', 'input', 'viewport', 'canvas', 'save', 'settings', 'i18n', 'audio', 'haptics',
  'platform', 'assets', 'content', 'ui', 'debug', 'loop', 'entitlements',
]);
const installed = new Set<keyof Services>();
const store: Partial<Services> = {};

export const services: Services = new Proxy(store as Services, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && SERVICE_KEYS.has(prop) && !installed.has(prop as keyof Services)) {
      throw new Error(`services.${prop} used before the core started (call it from register(), not at import time)`);
    }
    return Reflect.get(target, prop, receiver);
  },
});

/** Popola (o sostituisce in parte) i servizi. Usato dal core all'avvio e dai test. */
export function installServices(partial: Partial<Services>): void {
  for (const [k, v] of Object.entries(partial) as [keyof Services, Services[keyof Services]][]) {
    (store as Record<string, unknown>)[k] = v;
    installed.add(k);
  }
}

/** Il servizio è già disponibile? */
export function hasService(k: keyof Services): boolean {
  return installed.has(k);
}

const audioListeners: ((a: AudioEngine) => void)[] = [];

/** Chiamata dal pacchetto audio: sostituisce lo stub e riapplica i volumi correnti. */
export function registerAudio(a: AudioEngine): void {
  installServices({ audio: a });
  if (hasService('settings')) {
    try {
      a.setVolumes(services.settings.get().volume);
    } catch (err) {
      console.error('[services] setVolumes failed', err);
    }
  }
  for (const fn of audioListeners.slice()) fn(a);
}

/** Notifica quando l'audio viene sostituito (per chi tiene un riferimento al motore). */
export function onAudioRegistered(fn: (a: AudioEngine) => void): () => void {
  audioListeners.push(fn);
  return () => {
    const i = audioListeners.indexOf(fn);
    if (i >= 0) audioListeners.splice(i, 1);
  };
}
