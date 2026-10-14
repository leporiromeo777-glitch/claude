/**
 * Servizi finti per provare la regia della notte nel DOM (happy-dom, senza
 * canvas): bus vero, i18n vero, contenuti veri, salvataggio in memoria che
 * registra le scritture, vibrazioni registrate.
 */
import type { GameEventMap, HapticKind, SaveData, Services, Viewport } from '../../../src/core/types';
import { createBus } from '../../../src/core/events';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { createInput } from '../../../src/core/input';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createAudioStub } from '../../../src/core/audio-stub';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { defaultSettings } from '../../../src/core/settings';
import { computeViewport } from '../../../src/core/viewport';
import { installServices } from '../../../src/core/services';
import { loadContent } from '../../../src/content/loader';

export interface Harness {
  s: Services;
  data: SaveData;
  writes: { immediate: boolean }[];
  haptics: HapticKind[];
  events: { k: keyof GameEventMap; p: unknown }[];
}

export function harness(): Harness {
  const bus = createBus<GameEventMap>();
  const events: Harness['events'] = [];
  const keys: (keyof GameEventMap)[] = ['night:cross', 'night:violation', 'night:row', 'night:undo', 'night:complete', 'night:exit', 'quirk:discovered'];
  for (const k of keys) bus.on(k, (p) => events.push({ k, p }));
  const i18n = createI18n({ sources: loadI18nSources(), locale: 'it' });
  const data = defaultSaveData('test', defaultSettings('it', false));
  const writes: Harness['writes'] = [];
  const save = {
    load: async () => data,
    data: () => data,
    update: (m: (d: SaveData) => void, o?: { immediate?: boolean }) => {
      m(data);
      writes.push({ immediate: !!o?.immediate });
    },
    flush: async () => undefined,
    exportString: () => '',
    importString: () => ({ ok: true }),
    wipe: async () => undefined,
  };
  const settings = { get: () => data.settings, set: (p: Partial<SaveData['settings']>) => Object.assign(data.settings, p) };
  const input = createInput({});
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ui = createUiLayer({ root, input, bus, i18n, settings });
  const vp: Viewport = computeViewport(390, 844, 2, { top: 0, right: 0, bottom: 0, left: 0 }, 1);
  const haptics: HapticKind[] = [];
  const s = {
    bus,
    i18n,
    save,
    settings,
    input,
    ui,
    viewport: { get: () => vp },
    content: loadContent(),
    audio: createAudioStub(),
    haptics: { play: (k: HapticKind) => haptics.push(k) },
    assets: { load: async () => undefined, frame: () => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 0, sh: 0, ax: 0.5, ay: 0.05, placeholder: true }), image: () => document.createElement('canvas'), has: () => false, missing: () => [] },
    scenes: { register: () => undefined, go: async () => undefined, current: () => 'tombolo', has: () => false },
    debug: { register: () => undefined },
  } as unknown as Services;
  installServices(s);
  return { s, data, writes, haptics, events };
}
