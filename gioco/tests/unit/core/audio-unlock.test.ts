// @vitest-environment happy-dom
/**
 * Sblocco audio (ARCHITETTURA 7, GDD 13.6): unlock() dentro il gestore del primo
 * gesto, in modo sincrono; 'audio:unlocked' una volta per motore, anche quando lo
 * stub viene sostituito dal motore vero dopo il primo tocco.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createInput, type CoreInput } from '../../../src/core/input';
import { createAudioStub } from '../../../src/core/audio-stub';
import type { AudioEngine } from '../../../src/core/types';

function fakeEngine(): AudioEngine & { unlocks: number } {
  const stub = createAudioStub();
  const e = {
    ...stub,
    unlocks: 0,
    unlock() {
      e.unlocks++;
      stub.unlock();
    },
  };
  return e;
}

describe('sblocco audio al primo gesto', () => {
  let input: CoreInput | null = null;
  afterEach(() => {
    input?.destroy();
    input = null;
  });

  it('keydown e pointerdown chiamano unlock() in modo sincrono; l’evento parte una volta per motore', () => {
    let audio: AudioEngine = createAudioStub();
    const notified: AudioEngine[] = [];
    input = createInput({ win: window, audio: () => audio, onAudioUnlocked: () => notified.push(audio) });

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    // Sincrono: subito dopo il dispatch lo stub è già sbloccato.
    expect(audio.state()).toBe('running');
    expect(notified.length).toBe(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(notified.length).toBe(1);

    // Il pacchetto audio registra il motore vero dopo il primo tocco.
    const real = fakeEngine();
    audio = real;
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    expect(real.unlocks).toBe(1);
    expect(real.state()).toBe('running');
    expect(notified).toEqual([notified[0], real]);

    // Già attivo: niente altre chiamate né eventi.
    window.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }));
    expect(real.unlocks).toBe(1);
    expect(notified.length).toBe(2);

    // Sospeso (per esempio da un'interruzione): il gesto successivo riprova, senza nuovo evento.
    real.suspend();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(real.unlocks).toBe(2);
    expect(notified.length).toBe(2);
  });
});
