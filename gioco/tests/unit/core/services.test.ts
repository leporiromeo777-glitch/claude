// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { hasService, installServices, onAudioRegistered, registerAudio, services } from '../../../src/core/services';
import { createAudioStub } from '../../../src/core/audio-stub';
import { createDebugRegistry, isDebugEnabled, toSerializable } from '../../../src/core/debug';
import { createHaptics, HAPTIC_PATTERNS } from '../../../src/core/haptics';
import { createEntitlements } from '../../../src/core/entitlements';
import { defaultSettings } from '../../../src/core/settings';

describe('servizi', () => {
  it('un servizio non ancora installato dà un errore leggibile', () => {
    expect(() => services.loop).toThrow(/before the core started/);
    expect(hasService('loop')).toBe(false);
  });

  it('registerAudio sostituisce lo stub e riapplica i volumi', () => {
    const settings = { get: () => defaultSettings('it'), set: () => undefined };
    installServices({ audio: createAudioStub(), settings });
    const real = { ...createAudioStub(), setVolumes: vi.fn() };
    const seen = vi.fn();
    const off = onAudioRegistered(seen);
    registerAudio(real);
    off();
    expect(services.audio).toBe(real);
    expect(real.setVolumes).toHaveBeenCalledWith(defaultSettings('it').volume);
    expect(seen).toHaveBeenCalledWith(real);
  });
});

describe('debug', () => {
  it('attivo in sviluppo, nei test e con ?debug=1 solo sul web', () => {
    expect(isDebugEnabled({ dev: true, e2e: false, search: '', native: true })).toBe(true);
    expect(isDebugEnabled({ dev: false, e2e: true, search: '', native: true })).toBe(true);
    expect(isDebugEnabled({ dev: false, e2e: false, search: '?debug=1', native: false })).toBe(true);
    expect(isDebugEnabled({ dev: false, e2e: false, search: '?debug=1', native: true })).toBe(false);
    expect(isDebugEnabled({ dev: false, e2e: false, search: '', native: false })).toBe(false);
  });

  it('window.__GAME__ con ready, registro dei namespace e valori serializzabili', async () => {
    const win = {} as Window;
    const reg = createDebugRegistry({ enabled: true, win });
    const root = win.__GAME__!;
    expect(root.namespaces()).toEqual([]);
    reg.register('engine', { level: () => new Map([['a', 1]]), later: async () => new Set([1, 2]) });
    reg.registerTree('core', { time: { now: () => 3 } });
    expect(root.namespaces()).toEqual(['core', 'engine']);
    const engine = root.engine as { level(): unknown; later(): Promise<unknown> };
    expect(engine.level()).toEqual({ a: 1 });
    await expect(engine.later()).resolves.toEqual([1, 2]);
    expect((root.core as { time: { now(): number } }).time.now()).toBe(3);
    reg.resolveReady();
    await expect(root.ready).resolves.toBeUndefined();
    expect(() => reg.register('ready', {})).toThrow();
  });

  it('spento: niente __GAME__ e register non fa nulla', () => {
    const win = {} as Window;
    const reg = createDebugRegistry({ enabled: false, win });
    reg.register('x', { a: () => 1 });
    expect(win.__GAME__).toBeUndefined();
    expect(reg.namespaces()).toEqual([]);
  });

  it('toSerializable toglie cicli, funzioni e nodi DOM', () => {
    const a: Record<string, unknown> = { n: 1, f: () => 1, inf: Infinity, el: document.createElement('div') };
    a.self = a;
    expect(toSerializable(a)).toEqual({ n: 1, inf: null, el: null, self: null });
    expect(toSerializable(undefined)).toBeNull();
    expect(toSerializable(new Float32Array([1, 2]))).toEqual([1, 2]);
  });
});

describe('vibrazione ed entitlements', () => {
  it('schemi web e rispetto dell’impostazione', () => {
    expect(HAPTIC_PATTERNS).toEqual({ leggero: [10], medio: [20], successo: [15, 40, 15], rifiuto: [8, 30, 8] });
    let enabled = true;
    const vibrate = vi.fn(() => true);
    const h = createHaptics({ native: false, enabled: () => enabled, vibrate });
    h.play('successo');
    expect(vibrate).toHaveBeenCalledWith([15, 40, 15]);
    enabled = false;
    h.play('rifiuto');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(h.log()).toEqual(['successo']);
  });

  it('sul web tutto è sbloccato', () => {
    expect(createEntitlements(false).isUnlocked('fullGame')).toBe(true);
    const nat = createEntitlements(true);
    expect(nat.isUnlocked('fullGame')).toBe(true);
    nat.setProvider(() => false);
    expect(nat.isUnlocked('fullGame')).toBe(false);
  });
});
