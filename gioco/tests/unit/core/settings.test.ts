// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { GameEventMap, Settings } from '../../../src/core/types';
import {
  animDurationFactor,
  applySettingsToDocument,
  createSettingsStore,
  defaultSettings,
  detectLocale,
  sanitizeSettings,
} from '../../../src/core/settings';
import { createSaveService } from '../../../src/core/save/save';
import { MemoryBackend } from '../../../src/core/save/backends';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { createBus } from '../../../src/core/events';

describe('impostazioni', () => {
  it('valori predefiniti', () => {
    const s = defaultSettings('it');
    expect(s).toMatchObject({ textScale: 1, highContrast: false, animSpeed: 1, haptics: true, captions: false, autoAdvance: false, locale: 'it' });
    expect(defaultSettings('en', true).reducedMotion).toBe(true);
  });

  it('lingua dal browser', () => {
    expect(detectLocale(['it-IT', 'en'])).toBe('it');
    expect(detectLocale(['de-DE', 'en-GB'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('en');
    expect(detectLocale([])).toBe('it');
  });

  it('sanitizeSettings: limiti e valori ammessi', () => {
    const base = defaultSettings('it');
    const s = sanitizeSettings({ textScale: 0.5, animSpeed: 0.5, locale: 'fr', volume: { music: -1, sfx: 0.3 }, captions: 'sì' }, base);
    expect(s.textScale).toBe(0.9);
    expect(s.animSpeed).toBe(0.5);
    expect(s.locale).toBe('it');
    expect(s.volume).toEqual({ ...base.volume, music: 0, sfx: 0.3 });
    expect(s.captions).toBe(false);
    expect(sanitizeSettings({ textScale: 2 }, base).textScale).toBe(1.4);
  });

  it('applica --text-scale, data-contrast, data-motion e lang a <html>', () => {
    const root = document.documentElement;
    const s: Settings = { ...defaultSettings('en'), textScale: 1.4, highContrast: true, reducedMotion: true, animSpeed: 0 };
    applySettingsToDocument(s, root);
    expect(root.style.getPropertyValue('--text-scale')).toBe('1.4');
    expect(root.dataset.contrast).toBe('alto');
    expect(root.dataset.motion).toBe('ridotto');
    expect(root.dataset.animSpeed).toBe('0');
    expect(root.lang).toBe('en');
    expect(root.dataset.textScale).toBe('grande');
    applySettingsToDocument({ ...s, textScale: 1.2 }, root);
    expect(root.dataset.textScale).toBe('normale');
    expect(animDurationFactor(s)).toBe(0);
    expect(animDurationFactor({ ...s, animSpeed: 2 })).toBe(0.5);
  });

  it('lo store salva, applica e notifica', async () => {
    const bus = createBus<GameEventMap>();
    const save = createSaveService({ backend: new MemoryBackend(), defaults: () => defaultSaveData('1'), gameVersion: '1', bus });
    await save.load();
    const seen: Settings[] = [];
    bus.on('settings:change', (s) => seen.push(s));
    const store = createSettingsStore({ save, bus, root: document.documentElement });
    store.set({ highContrast: true, volume: { master: 0.5, music: 0.6, sfx: 0.8, voice: 0.7 } });
    expect(save.data().settings.highContrast).toBe(true);
    expect(store.get().volume.master).toBe(0.5);
    expect(document.documentElement.dataset.contrast).toBe('alto');
    expect(seen).toHaveLength(1);
    store.set({ textScale: 3 });
    expect(store.get().textScale).toBe(1.4);
    await save.flush();
  });
});
