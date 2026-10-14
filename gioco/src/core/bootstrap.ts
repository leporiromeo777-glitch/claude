/**
 * Avvio del core (ARCHITETTURA 3.1): crea e collega i servizi, carica salvataggio,
 * testi, contenuti e manifest, registra i pacchetti e la scena di avvio.
 * main.ts usa questo modulo passo per passo.
 */
import type { GameEventMap, Locale, SceneId, Services } from './types';
import { createBus, type DebugBus } from './events';
import { createLoop, type CoreLoop } from './loop';
import { createInput, type CoreInput } from './input';
import { createViewport, type ViewportService } from './viewport';
import { createCanvasHost, type CoreCanvasHost } from './canvas';
import { createSceneManager, FADE_MS, type CoreSceneManager } from './scenes';
import { createStorageBackend } from './save/backends';
import { createSaveService, type CoreSaveService } from './save/save';
import { defaultSaveData } from './save/defaults';
import {
  applySettingsToDocument,
  createSettingsStore,
  defaultSettings,
  detectLocale,
  prefersReducedMotion,
  type CoreSettingsStore,
} from './settings';
import { createI18n, loadI18nSources, type CoreI18n } from './i18n';
import { createPlatform, type CorePlatform } from './platform';
import { createHaptics } from './haptics';
import { createEntitlements } from './entitlements';
import { createAssetStore, type CoreAssetStore } from './assets';
import { createDebugRegistry, isDebugEnabled, type CoreDebugRegistry } from './debug';
import { createAudioStub } from './audio-stub';
import { createUiLayer, type CoreUiLayer } from './ui/layer';
import { installServices, services } from './services';
import { BootScene } from './boot.scene';
import { el } from './ui/dom';
import { loadContent } from '../content/loader';
import { validateContent } from '../content/validate';

export const GAME_VERSION: string = typeof __GAME_VERSION__ === 'string' ? __GAME_VERSION__ : '0.0.0';
const HAS_MANIFEST: boolean = typeof __ASSET_MANIFEST__ === 'boolean' ? __ASSET_MANIFEST__ : false;

export interface CoreRuntime {
  bus: DebugBus<GameEventMap>;
  loop: CoreLoop;
  input: CoreInput;
  viewport: ViewportService;
  canvas: CoreCanvasHost;
  scenes: CoreSceneManager;
  save: CoreSaveService;
  settings: CoreSettingsStore;
  i18n: CoreI18n;
  platform: CorePlatform;
  assets: CoreAssetStore;
  ui: CoreUiLayer;
  debug: CoreDebugRegistry;
  contentErrors: string[];
  packages: string[];
}

function ensureElement<T extends HTMLElement>(id: string, make: () => T, parent: HTMLElement): T {
  const found = document.getElementById(id);
  if (found) return found as T;
  const e = make();
  e.id = id;
  parent.appendChild(e);
  return e;
}

/** Fase 0, sincrona: registro di debug e `window.__GAME__.ready` subito disponibili. */
export function createDebug(): CoreDebugRegistry {
  let native = false;
  try {
    native = !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  } catch {
    native = false;
  }
  const enabled = isDebugEnabled({
    dev: import.meta.env.DEV,
    e2e: import.meta.env.VITE_E2E === '1',
    search: window.location.search,
    native,
  });
  return createDebugRegistry({ enabled, win: window });
}

/** Fasi 2 e 3: servizi, salvataggio, testi, contenuti, manifest. */
export async function startCore(debug: CoreDebugRegistry): Promise<CoreRuntime> {
  const win = window;
  const doc = document;
  const app = ensureElement('app', () => el('div'), doc.body);
  const canvasEl = ensureElement('scene-canvas', () => el('canvas'), app) as HTMLCanvasElement;
  const uiRoot = ensureElement('ui-root', () => el('div'), app);
  const probe = ensureElement('safe-probe', () => el('div'), app);

  const bus = createBus<GameEventMap>();
  const platform = await createPlatform(win);

  // Avvisi per il giocatore prima che l'interfaccia esista: si mostrano appena c'è.
  const pendingWarnings: string[] = [];
  let ui: CoreUiLayer | null = null;
  const warn = (key: string): void => {
    if (ui) ui.toast(key, undefined, 'warn');
    else pendingWarnings.push(key);
  };

  // Salvataggio (con le impostazioni dentro).
  const backend = await createStorageBackend(platform.native, () => warn('core.save.memoria'));
  let settingsRef: CoreSettingsStore | null = null;
  /** Tempo di gioco non ancora scritto in stats.playMs (si somma a ogni scrittura). */
  let playMs = 0;
  const save = createSaveService({
    backend,
    bus,
    gameVersion: GAME_VERSION,
    defaults: () => defaultSaveData(GAME_VERSION, defaultSettings(detectLocale(), prefersReducedMotion())),
    onWarn: warn,
    onReplaced: () => {
      // Dati sostituiti in blocco (caricamento, import, cancellazione): il tempo giocato
      // prima non appartiene al nuovo salvataggio, così export → import resta identico.
      playMs = 0;
      settingsRef?.reapply();
    },
  });
  await save.load();
  const settings = createSettingsStore({ save, bus, root: doc.documentElement });
  settingsRef = settings;
  if (debug.enabled) {
    const lang = new URLSearchParams(win.location.search).get('lang');
    if ((lang === 'it' || lang === 'en') && lang !== settings.get().locale) {
      save.data().settings.locale = lang as Locale;
    }
  }
  // Impostazioni salvate applicate subito a <html> (testo, contrasto, movimento, lingua).
  applySettingsToDocument(settings.get(), doc.documentElement);

  // Testi. Il cambio di lingua passa prima di tutti gli altri ascoltatori di settings:change.
  const i18n = createI18n({ sources: loadI18nSources(), locale: settings.get().locale, dev: import.meta.env.DEV });
  bus.on('settings:change', (s) => i18n.setLocale(s.locale));

  // Input, dimensioni, canvas, scene.
  const audioStub = createAudioStub();
  installServices({ audio: audioStub, bus, i18n, settings, save, platform, debug });
  const input = createInput({
    canvas: canvasEl,
    win,
    uiRoot,
    audio: () => services.audio,
    onAudioUnlocked: () => bus.emit('audio:unlocked', {}),
  });
  let scenesRef: CoreSceneManager | null = null;
  let canvasRef: CoreCanvasHost | null = null;
  const viewport = createViewport({
    win,
    container: app,
    probe,
    textScale: () => settings.get().textScale,
    onChange: (vp) => {
      canvasRef?.resize(vp);
      scenesRef?.resize(vp);
      bus.emit('viewport:change', vp);
    },
  });
  const canvas = createCanvasHost(canvasEl, viewport.get());
  canvasRef = canvas;

  const haptics = createHaptics({ native: platform.native, enabled: () => settings.get().haptics });
  const entitlements = createEntitlements(platform.native);

  // Contenuti (sincroni) e asset (manifest se esiste, atlas del gruppo core).
  const content = loadContent();
  const contentErrors = validateContent(content, { hasKey: (k) => i18n.exists(k, 'it') });
  if (contentErrors.length > 0 && import.meta.env.DEV) {
    console.warn(`[content] ${contentErrors.length} validation errors`, contentErrors.slice(0, 40));
  }
  const assets = createAssetStore({
    hasManifest: HAS_MANIFEST,
    colorOf: (id) => content.characters.get(id as never)?.color,
  });
  await assets.init();
  await assets.load(['core']);

  installServices({ input, viewport: { get: () => viewport.get() }, canvas, haptics, entitlements, content, assets });

  ui = createUiLayer({ root: uiRoot, input, bus, i18n, settings });
  for (const k of pendingWarnings.splice(0)) ui.toast(k, undefined, 'warn');

  const readVelluto = (): string =>
    getComputedStyle(doc.documentElement).getPropertyValue('--velluto').trim() || '#1C2233';
  let exitConfirmOpen = false;
  const scenes = createSceneManager({
    bus,
    input,
    canvas,
    viewport: () => viewport.get(),
    fadeEl: ui.fadeEl,
    fadeMs: () => {
      const s = settings.get();
      return s.animSpeed === 0 || s.reducedMotion ? 0 : FADE_MS;
    },
    background: readVelluto,
    onUnhandledBack: (id) => {
      // In fondo alla catena di Indietro, nel titolo e solo su nativo: conferma di uscita.
      if (!platform.native || exitConfirmOpen || (id !== 'titolo' && id !== 'boot')) return;
      exitConfirmOpen = true;
      void ui
        ?.confirm({ titleKey: 'core.uscita.titolo', bodyKey: 'core.uscita.corpo', okKey: 'core.uscita.ok', cancelKey: 'core.uscita.annulla' })
        .then((ok) => {
          exitConfirmOpen = false;
          if (ok) {
            void save.flush().finally(() => platform.exitApp());
          }
        });
    },
  });
  scenesRef = scenes;

  // Ciclo a passo fisso, con il tempo di gioco per le statistiche.
  const loop = createLoop(
    (dt) => {
      playMs += dt * 1000;
      scenes.update(dt);
    },
    (alpha) => scenes.render(alpha),
  );
  save.onBeforeWrite((d) => {
    d.stats.playMs = Math.round(d.stats.playMs + playMs);
    playMs = 0;
  });

  installServices({ scenes, ui, loop });

  // Collegamenti fra servizi.
  bus.on('settings:change', (s) => {
    try {
      services.audio.setVolumes(s.volume);
    } catch (err) {
      console.error('[core] setVolumes failed', err);
    }
    scenes.invalidate();
    viewport.refresh();
  });
  // Pausa dell'app (pagina nascosta, pagehide, evento pause di Capacitor): il ciclo si
  // ferma, chi ascolta 'app:pause' aggiorna i dati e poi si salva subito.
  platform.onPause(() => {
    loop.setSystemPaused(true);
    bus.emit('app:pause', {});
    save.request(true);
  });
  platform.onResume(() => {
    if (doc.visibilityState !== 'hidden') loop.setSystemPaused(false);
    bus.emit('app:resume', {});
  });
  platform.onBack(() => {
    bus.emit('app:back', {});
    input.dispatchAction({ action: 'back', repeat: false, source: 'keyboard' });
    return true;
  });

  const packages: string[] = [];
  scenes.register('boot', () =>
    new BootScene(services, {
      version: GAME_VERSION,
      packages: () => packages.slice(),
      contentErrors: () => contentErrors.length,
      sceneRoot: ui?.sceneRoot ?? uiRoot,
      registeredScenes: () => scenes.registered(),
    }),
  );

  const runtime: CoreRuntime = {
    bus,
    loop,
    input,
    viewport,
    canvas,
    scenes,
    save,
    settings,
    i18n,
    platform,
    assets,
    ui,
    debug,
    contentErrors,
    packages,
  };
  registerCoreDebug(runtime);
  return runtime;
}

/** Namespace `core` di __GAME__ (ARCHITETTURA 15.1). */
function registerCoreDebug(rt: CoreRuntime): void {
  const { bus, loop, scenes, save, settings, viewport, assets, i18n, input, ui } = rt;
  rt.debug.registerTree('core', {
    scene: () => scenes.current(),
    goto: async (id: SceneId, params?: unknown) => {
      await scenes.go(id, params);
      return scenes.current();
    },
    save: () => save.data(),
    setSettings: (p: Parameters<Services['settings']['set']>[0]) => {
      settings.set(p);
      return settings.get();
    },
    wipe: () => save.wipe(),
    exportSave: () => save.exportString(),
    importSave: (s: string) => save.importString(s),
    flush: () => save.flush(),
    viewport: () => viewport.refresh(),
    events: (n?: number) => bus.log(n ?? 50),
    emit: (name: string, payload?: unknown) => {
      bus.emit(name as keyof GameEventMap, (payload ?? {}) as never);
      return true;
    },
    perf: () => loop.perf(),
    time: {
      pause: () => loop.pause(),
      resume: () => loop.resume(),
      step: (ms: number) => loop.step(ms),
      setSpeed: (x: number) => loop.setSpeed(x),
      now: () => loop.simTime(),
      ticks: () => loop.ticks(),
      paused: () => loop.paused(),
      speed: () => loop.speed(),
    },
    missingAssets: () => assets.missing(),
    missingKeys: (locale?: Locale) => i18n.missing(locale),
    validate: () => rt.contentErrors.slice(),
    scenes: () => scenes.registered(),
    packages: () => rt.packages.slice(),
    version: () => GAME_VERSION,
    overlays: () => ui.overlays(),
    openOverlay: (id: string, opts?: unknown) => {
      void ui.openOverlay(id, opts);
      return ui.overlays();
    },
    closeOverlay: () => ui.closeOverlay(),
    toast: (textKey: string, params?: Record<string, string | number>) => ui.toast(textKey, params),
    input: {
      tap: (x: number, y: number, pointer?: 'mouse' | 'touch') => input.simulate.tap(x, y, pointer),
      drag: (x0: number, y0: number, x1: number, y1: number, steps?: number, pointer?: 'mouse' | 'touch') =>
        input.simulate.drag(x0, y0, x1, y1, steps, pointer),
      action: (a: Parameters<CoreInput['simulate']['action']>[0], index?: number) => input.simulate.action(a, index),
      layers: () => input.layers(),
      lastDevice: () => input.lastDevice(),
    },
  });
}

/** Carica i pacchetti: ogni `src/<pacchetto>/register.ts` può esportare `register(services)` (o default). */
export async function registerPackages(rt: CoreRuntime, modules: Record<string, () => Promise<unknown>>): Promise<void> {
  const paths = Object.keys(modules).sort();
  for (const path of paths) {
    const name = /\.\/([^/]+)\/register\.ts$/.exec(path)?.[1] ?? path;
    try {
      const load = modules[path];
      if (!load) continue;
      const mod = (await load()) as { register?: unknown; default?: unknown };
      const fn = typeof mod.register === 'function' ? mod.register : typeof mod.default === 'function' ? mod.default : null;
      if (fn) await (fn as (s: Services) => unknown)(services);
      rt.packages.push(name);
    } catch (err) {
      console.error(`[boot] package "${name}" failed to register`, err);
    }
  }
}

/** Errore fatale all'avvio: messaggio tradotto se possibile, pulsante per ricaricare. */
export function showFatal(err: unknown, i18n: CoreI18n | null): void {
  console.error('[boot] startup failed', err);
  const t = (k: string, fallback: string): string => {
    const v = i18n?.t(k);
    return v && v !== k ? v : fallback;
  };
  const root = document.getElementById('ui-root') ?? document.body;
  const box = el(
    'div',
    { class: 'core-modal-host core-solid', role: 'alert' },
    el(
      'div',
      { class: 'core-modal' },
      el('p', { class: 'core-modal-body', text: t('core.errore.avvio', '⚠') }),
      el('button', { class: 'core-btn core-btn--primario', type: 'button', text: t('core.errore.ricarica', '↻'), on: { click: () => window.location.reload() } }),
    ),
  );
  root.appendChild(box);
}
