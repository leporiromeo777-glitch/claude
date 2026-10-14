/**
 * Aiuti per i test delle schermate: servizi veri del core (bus, salvataggio in
 * memoria, impostazioni, testi di tutto il gioco, contenuti) e finti per il
 * resto (scene, interfaccia, piattaforma, audio), con un registro delle chiamate.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import type { AudioEngine, GameEventMap, Locale, PanelHandle, SaveData, SceneId, Services, UiLayer } from '../../../src/core/types';
import { createBus } from '../../../src/core/events';
import { createI18n, sourceFromPath, type I18nSource } from '../../../src/core/i18n';
import { createSaveService } from '../../../src/core/save/save';
import { MemoryBackend } from '../../../src/core/save/backends';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { createSettingsStore, defaultSettings } from '../../../src/core/settings';
import { installServices } from '../../../src/core/services';
import { createAudioStub } from '../../../src/core/audio-stub';
import { loadContent } from '../../../src/content/loader';

export const ROOT = resolve(__dirname, '../../..');

/** Tutti i testi del gioco (interfaccia e narrativi) letti dal disco. */
export function allTexts(): I18nSource[] {
  const out: I18nSource[] = [];
  for (const base of ['src/i18n', 'src/content/text']) {
    for (const loc of ['it', 'en']) {
      const dir = resolve(ROOT, base, loc);
      let files: string[] = [];
      try {
        files = readdirSync(dir).filter((f) => f.endsWith('.json'));
      } catch {
        files = [];
      }
      for (const f of files) {
        const path = join(dir, f);
        const src = sourceFromPath(path, JSON.parse(readFileSync(path, 'utf8')));
        if (src) out.push(src);
      }
    }
  }
  return out;
}

export function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8')) as T;
}

export interface Harness {
  s: Services;
  calls: { scenes: { id: SceneId; params?: unknown }[]; toasts: string[]; overlays: { id: string; opts?: unknown }[]; copied: string[]; shared: string[]; closed: number };
  confirmAnswer: { value: boolean; asked: string[] };
  panels: Map<string, (c: HTMLElement, o?: unknown) => PanelHandle>;
  current: { id: SceneId | null };
  registered: Set<SceneId>;
}

/** Servizi per i test (senza DOM se `dom` è falso). */
export function makeServices(o: { locale?: Locale; save?: Partial<SaveData>; registered?: SceneId[] } = {}): Harness {
  const bus = createBus<GameEventMap>();
  const backend = new MemoryBackend();
  const save = createSaveService({
    backend,
    bus,
    gameVersion: 'test',
    defaults: () => defaultSaveData('test', defaultSettings(o.locale ?? 'it', false)),
    throttleMs: 0,
  });
  if (o.save) Object.assign(save.data(), o.save);
  const settings = createSettingsStore({ save, bus, root: null });
  const i18n = createI18n({ sources: allTexts(), locale: o.locale ?? 'it' });
  bus.on('settings:change', (st) => i18n.setLocale(st.locale));
  const content = loadContent();
  const calls: Harness['calls'] = { scenes: [], toasts: [], overlays: [], copied: [], shared: [], closed: 0 };
  const confirmAnswer = { value: true, asked: [] as string[] };
  const panels = new Map<string, (c: HTMLElement, o?: unknown) => PanelHandle>();
  const current: { id: SceneId | null } = { id: null };
  const registered = new Set<SceneId>(o.registered ?? ['titolo', 'giornaliero', 'libero', 'impostazioni', 'crediti', 'tombolo']);
  const ui: UiLayer & { hasPanel(id: string): boolean; overlays(): string[] } = {
    root: (typeof document !== 'undefined' ? document.body : null) as unknown as HTMLElement,
    registerPanel: (id, f) => {
      panels.set(id, f);
    },
    mountPanel: (id, c, opts) => panels.get(id)?.(c, opts) ?? { destroy() {} },
    openOverlay: async (id, opts) => {
      calls.overlays.push({ id, opts });
    },
    closeOverlay: () => {
      calls.closed++;
    },
    toast: (k) => {
      calls.toasts.push(k);
    },
    confirm: async (c) => {
      confirmAnswer.asked.push(c.titleKey);
      return confirmAnswer.value;
    },
    hasPanel: (id) => panels.has(id),
    overlays: () => [],
  };
  const audio: AudioEngine = createAudioStub();
  const s = {
    bus,
    save,
    settings,
    i18n,
    content,
    ui,
    audio,
    scenes: {
      register: () => undefined,
      go: async (id: SceneId, params?: unknown) => {
        calls.scenes.push(params === undefined ? { id } : { id, params });
        current.id = id;
      },
      current: () => current.id,
      has: (id: SceneId) => registered.has(id),
    },
    platform: {
      native: false,
      os: 'web',
      onPause: () => () => undefined,
      onResume: () => () => undefined,
      onBack: () => () => undefined,
      exitApp: () => undefined,
      keepAwake: () => undefined,
      share: async (x: { text: string }) => {
        calls.shared.push(x.text);
        return true;
      },
      copy: async (t: string) => {
        calls.copied.push(t);
        return true;
      },
      hideSplash: () => undefined,
    },
    haptics: { play: () => undefined },
    entitlements: { isUnlocked: () => true },
    debug: { register: () => undefined },
  } as unknown as Services;
  installServices({ i18n, content, bus, save, settings });
  return { s, calls, confirmAnswer, panels, current, registered };
}
