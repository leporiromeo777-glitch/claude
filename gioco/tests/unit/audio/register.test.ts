// @vitest-environment happy-dom
/**
 * Registrazione del pacchetto con i servizi veri del core (bus, input, interfaccia,
 * debug): il motore sostituisce lo stub, il primo tasto lo sblocca attraverso l'input
 * del core, `__GAME__.audio` risponde anche prima dello sblocco, gli eventi della
 * notte e dell'app arrivano al motore, le didascalie compaiono nell'interfaccia.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBus } from '../../../src/core/events';
import { createI18n } from '../../../src/core/i18n';
import { createInput } from '../../../src/core/input';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createDebugRegistry } from '../../../src/core/debug';
import { installServices, services } from '../../../src/core/services';
import { createAudioStub } from '../../../src/core/audio-stub';
import { emptyContentDB } from '../../../src/content/loader';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { defaultSettings } from '../../../src/core/settings';
import type { GameEventMap, LevelDef, SaveService, Services, Settings } from '../../../src/core/types';
import { register } from '../../../src/audio/register';
import { WebAudioEngine } from '../../../src/audio/engine';
import itAudio from '../../../src/i18n/it/audio.json';
import { FakeAudioContext } from './fakeAudio';

type AudioDebug = {
  state(): string;
  log(): { id: string; detail?: string }[];
  mute(on?: boolean): boolean;
  stats(): { active: number; peak: number; muted: boolean };
  stress(n?: number): { peak: number };
  bell(h?: number, s?: number): string;
  sfx(id: string): string;
  captions(): { textKey: string }[];
  stonatura(): number;
};

const g = globalThis as unknown as { AudioContext?: unknown };
const previous = g.AudioContext;
const created: FakeAudioContext[] = [];

beforeAll(() => {
  // WebAudio finto: il motore lo crea dentro il gestore del tasto.
  g.AudioContext = class extends FakeAudioContext {
    constructor() {
      super({ state: 'suspended' });
      created.push(this);
    }
  };
});
afterAll(() => {
  g.AudioContext = previous;
});

function boot() {
  document.body.innerHTML = '';
  const root = document.createElement('div');
  document.body.appendChild(root);
  const bus = createBus<GameEventMap>();
  const i18n = createI18n({ sources: [{ locale: 'it', ns: 'audio', path: 'src/i18n/it/audio.json', data: itAudio }], locale: 'it' });
  let settings: Settings = { ...defaultSettings('it'), captions: true };
  const store = {
    get: () => settings,
    set: (p: Partial<Settings>) => {
      settings = { ...settings, ...p };
      bus.emit('settings:change', settings);
    },
  };
  const save = defaultSaveData('test', settings);
  const unlocked: number[] = [];
  bus.on('audio:unlocked', () => unlocked.push(1));
  installServices({ audio: createAudioStub(), bus, i18n, settings: store });
  const input = createInput({ win: window, uiRoot: root, audio: () => services.audio, onAudioUnlocked: () => bus.emit('audio:unlocked', {}) });
  const ui = createUiLayer({ root, input, bus, i18n, settings: store });
  const debug = createDebugRegistry({ enabled: true, win: window });
  const content = emptyContentDB();
  installServices({
    input,
    ui,
    debug,
    content,
    save: { data: () => save } as unknown as SaveService,
  });
  const engine = register(services as Services);
  const api = (window as unknown as { __GAME__: { audio: AudioDebug } }).__GAME__.audio;
  return { bus, engine, api, root, unlocked, input, store };
}

describe('register()', () => {
  it('sostituisce lo stub e registra __GAME__.audio, che risponde anche senza contesto', () => {
    const { engine, api } = boot();
    expect(services.audio).toBe(engine);
    expect(engine).toBeInstanceOf(WebAudioEngine);
    expect(api.state()).toBe('locked');
    api.sfx('vaporetto');
    api.bell(9, 1);
    expect(api.log().map((e) => e.id)).toEqual(['vaporetto', 'campana']);
    expect(api.state()).toBe('locked');
  });

  it('il primo tasto sblocca l\'audio attraverso l\'input del core', () => {
    const { api, unlocked } = boot();
    const before = created.length;
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(created.length).toBe(before + 1);
    expect(api.state()).toBe('running');
    expect(unlocked).toHaveLength(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(created.length).toBe(before + 1);
  });

  it('pausa e ripresa dell\'app dal bus', () => {
    const { api, bus } = boot();
    window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
    expect(api.state()).toBe('running');
    bus.emit('app:pause', {});
    expect(api.state()).toBe('suspended');
    bus.emit('app:resume', {});
    expect(api.state()).toBe('running');
  });

  it('gli eventi della notte suonano da soli', () => {
    const { api, bus } = boot();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    const level = {
      id: 'g00',
      kind: 'storia',
      act: 0,
      titleKey: 'x',
      columns: ['forno', 'piazza', 'chiesa'],
      startHour: 5,
      endHour: 9,
      threads: [
        { id: 'teresa', kind: 'persona', character: 'teresa' },
        { id: 'marta', kind: 'persona', character: 'marta' },
        { id: 'piero', kind: 'persona', character: 'piero' },
      ],
      initial: ['teresa', 'marta', 'piero'],
      beads: [],
      rules: [],
      quirks: [],
      pins: [],
      matassa: 7,
    } as unknown as LevelDef;
    bus.emit('scene:enter', { id: 'tombolo', params: { level, flags: {} } });
    bus.emit('night:cross', { hour: 6, crossing: { pair: 0, over: 'R' }, over: 'marta', under: 'teresa' });
    bus.emit('night:row', {
      hour: 6,
      result: {
        ok: true,
        state: { hour: 6, pos: ['marta', 'teresa', 'piero'], offboard: [], holders: {}, delivered: [], knotted: [], pozzo: { secrets: 0, overflowing: false }, usedMatassa: 1, met: [], metOver: [] },
        events: [],
        violations: [],
      },
    });
    const log = api.log();
    expect(log.map((e) => e.id)).toEqual(['incrocio', 'ora_fissata', 'campana']);
    expect(log[0]!.detail).toBe('marta/teresa');
    expect(log[2]!.detail).toBe('ore 6 s=1');
    expect(api.stonatura()).toBe(1);
  });

  it('didascalie mostrate dall\'interfaccia del core', () => {
    const { api, root } = boot();
    api.bell(9, 1);
    const cap = root.querySelector('[data-test="caption"]');
    expect(cap?.textContent).toBe('[la campana stonata, ore 9]');
    expect(api.captions().map((c) => c.textKey)).toEqual(['audio.didascalie.campanaStonata']);
  });

  it('"Tocca per continuare" nell\'interfaccia: compare dopo un\'interruzione, il tocco riprende; se non basta sparisce', () => {
    vi.useFakeTimers();
    try {
      const { api, root } = boot();
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
      const ctx = created[created.length - 1]!;
      expect(api.state()).toBe('running');
      // Interruzione che si risolve al tocco.
      ctx.interrupt();
      vi.advanceTimersByTime(500);
      const overlay = (): HTMLElement | null => root.querySelector('[data-test="audio-tocca"]');
      expect(overlay()).not.toBeNull();
      overlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(api.state()).toBe('running');
      expect(overlay()).toBeNull();
      // Interruzione che il tocco non risolve (telefonata in corso): il gioco non resta bloccato.
      ctx.interrupt();
      ctx.canResume = false;
      vi.advanceTimersByTime(500);
      expect(overlay()).not.toBeNull();
      overlay()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      vi.advanceTimersByTime(500);
      expect(overlay()).toBeNull();
      expect(api.state()).toBe('suspended');
      // A chiamata finita il primo gesto qualsiasi riprende l'audio.
      ctx.canResume = true;
      window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch' }));
      expect(api.state()).toBe('running');
      // Nessun ui_tap per il tocco sull'overlay.
      expect(api.log().some((e) => e.id === 'ui_tap')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('limitatore, silenzio e statistiche dal debug', () => {
    const { api } = boot();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    expect(api.stress(200).peak).toBeLessThanOrEqual(48);
    expect(api.mute(true)).toBe(true);
    expect(api.stats().muted).toBe(true);
    expect(api.mute(false)).toBe(false);
  });
});
