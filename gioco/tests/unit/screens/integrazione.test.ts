// @vitest-environment happy-dom
/**
 * Integrazione: il titolo chiede all'audio la musica del titolo e l'ambiente
 * «laguna e orologio che ticchetta» (GDD 9), con la campana intonata dopo il
 * finale vero (GDD 7).
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AmbienceId, AudioEngine, MusicState, Viewport } from '../../../src/core/types';
import { createAudioStub } from '../../../src/core/audio-stub';
import { TitoloScene } from '../../../src/screens/TitoloScene';
import { makeServices } from './helpers';

interface AudioCall {
  f: 'setMusic' | 'setAmbience';
  args: unknown[];
}

function spyAudio(): { audio: AudioEngine; calls: AudioCall[] } {
  const calls: AudioCall[] = [];
  const base = createAudioStub();
  const audio: AudioEngine = {
    ...base,
    setMusic: (s: MusicState, o?: Parameters<AudioEngine['setMusic']>[1]) => {
      calls.push({ f: 'setMusic', args: [s, o] });
    },
    setAmbience: (a: AmbienceId, fadeMs?: number, o?: { clock?: boolean }) => {
      calls.push({ f: 'setAmbience', args: [a, fadeMs, o] });
    },
  };
  return { audio, calls };
}

const VP: Viewport = {
  cssW: 390,
  cssH: 844,
  dpr: 2,
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
  orientation: 'portrait',
  layout: 'stretto',
  textScale: 1,
};

let scene: TitoloScene | null = null;
afterEach(() => {
  scene?.exit();
  scene = null;
  document.body.innerHTML = '';
});

function enterTitle(tovaglia: boolean): AudioCall[] {
  const h = makeServices({ save: { unlocks: { daily: false, libero: false, gradi: false, cosmetics: [], tovaglia } } });
  const { audio, calls } = spyAudio();
  const s = Object.assign(h.s, {
    audio,
    viewport: { get: () => VP },
    assets: { frame: () => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 96, sh: 320, ax: 0.5, ay: 0.125, placeholder: true }), has: () => false },
  });
  scene = new TitoloScene(s);
  scene.enter();
  return calls;
}

describe('titolo e audio', () => {
  it('laguna e orologio che ticchetta (GDD 9), musica del titolo con la campana stonata', () => {
    const calls = enterTitle(false);
    expect(calls).toContainEqual({ f: 'setAmbience', args: ['laguna', undefined, { clock: true }] });
    expect(calls).toContainEqual({ f: 'setMusic', args: ['titolo', {}] });
  });

  it('dopo il finale vero la campana del titolo è intonata (GDD 7)', () => {
    const calls = enterTitle(true);
    expect(calls).toContainEqual({ f: 'setMusic', args: ['titolo', { stonatura: 0 }] });
    expect(calls).toContainEqual({ f: 'setAmbience', args: ['laguna', undefined, { clock: true }] });
  });
});
