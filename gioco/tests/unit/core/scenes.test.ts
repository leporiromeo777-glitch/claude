import { describe, expect, it, vi } from 'vitest';
import type { CanvasHost, GameEventMap, Scene, SceneId, Viewport } from '../../../src/core/types';
import { createSceneManager } from '../../../src/core/scenes';
import { createInput } from '../../../src/core/input';
import { createBus } from '../../../src/core/events';
import { computeViewport } from '../../../src/core/viewport';

const vp: Viewport = computeViewport(390, 844, 3, { top: 0, right: 0, bottom: 0, left: 0 }, 1);

function setup(onUnhandledBack = vi.fn()) {
  const bus = createBus<GameEventMap>();
  const input = createInput();
  const fills: string[] = [];
  const canvas = { canvas: null, ctx: null, cssW: 390, cssH: 844, dpr: 2, fill: (c: string) => fills.push(c) } as unknown as CanvasHost & {
    fill(c: string): void;
  };
  const scenes = createSceneManager({ bus, input, canvas, viewport: () => vp, onUnhandledBack, wait: async () => undefined });
  return { bus, input, scenes, fills, onUnhandledBack };
}

function recScene(id: SceneId, log: string[], extra: Partial<Scene> = {}): Scene {
  return {
    id,
    enter: (p) => {
      log.push(`enter:${id}:${JSON.stringify(p ?? null)}`);
    },
    exit: () => log.push(`exit:${id}`),
    resize: () => log.push(`resize:${id}`),
    ...extra,
  };
}

describe('SceneManager', () => {
  it('go: exit della vecchia, enter e resize della nuova, eventi sul bus', async () => {
    const { scenes, bus } = setup();
    const log: string[] = [];
    const events: string[] = [];
    bus.on('scene:enter', (p) => events.push(`enter:${p.id}`));
    bus.on('scene:exit', (p) => events.push(`exit:${p.id}`));
    scenes.register('boot', () => recScene('boot', log));
    scenes.register('titolo', () => recScene('titolo', log));
    expect(scenes.has('titolo')).toBe(true);
    expect(scenes.has('sera')).toBe(false);
    await scenes.go('boot', undefined, { transition: 'none' });
    await scenes.go('titolo', { a: 1 });
    expect(log).toEqual(['enter:boot:null', 'resize:boot', 'exit:boot', 'enter:titolo:{"a":1}', 'resize:titolo']);
    expect(events).toEqual(['enter:boot', 'exit:boot', 'enter:titolo']);
    expect(scenes.current()).toBe('titolo');
  });

  it('una scena non registrata dà errore e non rompe la fila', async () => {
    const { scenes } = setup();
    scenes.register('boot', () => recScene('boot', []));
    await expect(scenes.go('sera')).rejects.toThrow();
    await scenes.go('boot');
    expect(scenes.current()).toBe('boot');
  });

  it('inoltra update, render, azioni e gesti; gli overlay li bloccano', async () => {
    const { scenes, input, fills } = setup();
    const got: string[] = [];
    scenes.register('tombolo', () =>
      recScene('tombolo', [], {
        update: (dt) => got.push(`update:${dt.toFixed(3)}`),
        render: () => got.push('render'),
        onAction: (a) => (got.push(`action:${a.action}`), true),
        onGesture: (g) => (got.push(`gesture:${g.k}`), true),
      }),
    );
    scenes.register('titolo', () => recScene('titolo', []));
    await scenes.go('tombolo');
    scenes.update(1 / 60);
    scenes.render(0);
    input.simulate.action('undo');
    input.simulate.tap(1, 2);
    const pop = input.pushLayer('pausa');
    input.simulate.action('undo');
    input.simulate.tap(1, 2);
    pop();
    expect(got).toEqual(['update:0.017', 'render', 'action:undo', 'gesture:tap']);
    // Una scena senza render: il canvas resta di velluto (ridipinto una volta).
    await scenes.go('titolo');
    scenes.render(0);
    scenes.render(0);
    expect(fills).toEqual(['#1C2233']);
  });

  it('catena di Indietro: onBack della scena, poi onAction, poi la riserva', async () => {
    const { scenes, input, onUnhandledBack } = setup();
    let handled = true;
    const seen: string[] = [];
    scenes.register('tombolo', () =>
      recScene('tombolo', [], {
        onBack: () => (seen.push('onBack'), handled),
        onAction: (a) => (seen.push(`onAction:${a.action}`), false),
      }),
    );
    await scenes.go('tombolo');
    input.simulate.action('back');
    expect(seen).toEqual(['onBack']);
    handled = false;
    input.simulate.action('back');
    expect(seen).toEqual(['onBack', 'onBack', 'onAction:back']);
    expect(onUnhandledBack).toHaveBeenCalledWith('tombolo');
    // Con un overlay aperto la scena non riceve Indietro.
    seen.length = 0;
    const pop = input.pushLayer('overlay');
    input.onAction((a) => a.action === 'back');
    input.simulate.action('back');
    expect(seen).toEqual([]);
    pop();
  });

  it('i cambi di scena sono in fila', async () => {
    const { scenes } = setup();
    const log: string[] = [];
    scenes.register('boot', () => recScene('boot', log));
    scenes.register('titolo', () => ({ ...recScene('titolo', log), enter: async () => void log.push('enter:titolo') }));
    const a = scenes.go('titolo');
    const b = scenes.go('boot');
    await Promise.all([a, b]);
    expect(log.filter((l) => l.startsWith('enter') || l.startsWith('exit'))).toEqual(['enter:titolo', 'exit:titolo', 'enter:boot:null']);
  });
});
