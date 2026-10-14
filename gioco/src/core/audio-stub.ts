/**
 * Audio vuoto (ARCHITETTURA 3.1): rispetta l'interfaccia AudioEngine senza
 * suonare nulla. Il pacchetto audio lo sostituisce con registerAudio().
 * Tiene comunque lo stato (bloccato → attivo → sospeso) per coerenza.
 */
import type { AudioEngine, Playing } from './types';

function silent(): Playing {
  return { stop() {}, done: Promise.resolve() };
}

export function createAudioStub(): AudioEngine {
  let state: 'locked' | 'running' | 'suspended' = 'locked';
  return {
    unlock() {
      if (state !== 'running') state = 'running';
    },
    state: () => state,
    suspend() {
      if (state === 'running') state = 'suspended';
    },
    resume() {
      if (state === 'suspended') state = 'running';
    },
    setVolumes() {},
    sfx() {},
    note() {},
    crossing() {},
    bell() {},
    carillon: () => silent(),
    babble: () => silent(),
    setAmbience() {},
    setMusic() {},
    duck() {},
  };
}
