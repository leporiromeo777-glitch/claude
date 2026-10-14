// @vitest-environment happy-dom
/**
 * Scena diagnostica 'boot': la riga «Al loro posto si vedono i segnaposto…»
 * compare solo se manca almeno un asset (richiesta di asset-blender).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootScene } from '../../../src/core/boot.scene';
import { createBus } from '../../../src/core/events';
import { createI18n } from '../../../src/core/i18n';
import { installServices } from '../../../src/core/services';
import { buildContentDB } from '../../../src/content/loader';
import type { GameEventMap, Services, Viewport } from '../../../src/core/types';
import itCore from '../../../src/i18n/it/core.json';

const VP: Viewport = {
  cssW: 390,
  cssH: 844,
  dpr: 2,
  safe: { top: 0, right: 0, bottom: 0, left: 0 },
  orientation: 'portrait',
  layout: 'stretto',
  textScale: 1,
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

function setup(missing: string[]) {
  const i18n = createI18n({ sources: [{ locale: 'it', ns: 'core', path: 'it/core.json', data: itCore }], locale: 'it' });
  const content = buildContentDB({}).db;
  const bus = createBus<GameEventMap>();
  installServices({ i18n, content, bus });
  const root = document.createElement('div');
  document.body.appendChild(root);
  const s = {
    i18n,
    content,
    bus,
    assets: { frame: () => null, image: () => null, missing: () => missing.slice(), has: () => false },
    viewport: { get: () => VP },
    input: { lastDevice: () => 'mouse' },
    settings: { get: () => ({}), set: () => undefined },
  } as unknown as Services;
  const scene = new BootScene(s, { version: 't', packages: () => [], contentErrors: () => 0, sceneRoot: root, registeredScenes: () => ['boot'] });
  return { scene, root };
}

describe('scena boot: asset mancanti', () => {
  it('senza asset mancanti la riga dei segnaposto non compare; con uno mancante sì', () => {
    const missing: string[] = [];
    const { scene, root } = setup(missing);
    scene.enter();
    const note = root.querySelector<HTMLElement>('[data-test="boot-segnaposto"]');
    expect(note).not.toBeNull();
    expect(note!.hidden).toBe(true);
    expect(root.textContent).toContain('Nessun asset mancante');
    // Un asset sparisce: al giro successivo (ogni secondo) la riga compare.
    missing.push('fuso/ada');
    vi.advanceTimersByTime(1000);
    expect(note!.hidden).toBe(false);
    expect(root.querySelector('[data-test="boot-missing"]')?.textContent).toContain('fuso/ada');
    scene.exit();
  });
});
