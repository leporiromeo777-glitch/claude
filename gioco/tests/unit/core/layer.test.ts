// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEventMap, Settings } from '../../../src/core/types';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createInput } from '../../../src/core/input';
import { createBus } from '../../../src/core/events';
import { defaultSettings } from '../../../src/core/settings';
import { installTestServices } from './helpers';

function setup() {
  const { i18n } = installTestServices();
  const root = document.createElement('div');
  document.body.appendChild(root);
  const input = createInput();
  const bus = createBus<GameEventMap>();
  let settings: Settings = defaultSettings('it');
  const store = { get: () => settings, set: (p: Partial<Settings>) => (settings = { ...settings, ...p }) };
  const ui = createUiLayer({ root, input, bus, i18n, settings: store });
  return { ui, input, bus, root, store, i18n };
}

describe('UiLayer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('struttura a strati dentro #ui-root', () => {
    const { root } = setup();
    expect(Array.from(root.children).map((c) => c.className)).toEqual([
      'core-scene',
      'core-overlays',
      'core-modals',
      'core-captions',
      'core-toasts',
      'core-fade',
    ]);
  });

  it('overlay: pannello registrato, livello modale, Indietro chiude e risolve', async () => {
    const { ui, input } = setup();
    const destroy = vi.fn();
    ui.registerPanel('pausa', (c, opts) => {
      c.appendChild(document.createTextNode(`pausa ${JSON.stringify(opts)}`));
      return { destroy };
    });
    const sceneActions: string[] = [];
    input.onAction((a) => (sceneActions.push(a.action), true));
    let closed = false;
    const p = ui.openOverlay('pausa', { x: 1 }).then(() => (closed = true));
    expect(ui.overlays()).toEqual(['pausa']);
    expect(input.layers()).toEqual(['base', 'overlay:pausa']);
    expect(document.querySelector('[data-overlay="pausa"]')?.textContent).toContain('pausa {"x":1}');
    input.simulate.action('undo'); // non arriva alla scena
    expect(sceneActions).toEqual([]);
    input.simulate.action('back');
    await p;
    expect(closed).toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
    expect(ui.overlays()).toEqual([]);
    expect(input.layers()).toEqual(['base']);
    input.simulate.action('undo');
    expect(sceneActions).toEqual(['undo']);
  });

  it('overlay non registrato: segnaposto; overlay annidati si chiudono dall’alto', () => {
    const { ui, input } = setup();
    void ui.openOverlay('taccuino');
    expect(document.querySelector('[data-placeholder-panel="taccuino"]')).not.toBeNull();
    void ui.openOverlay('impostazioni');
    expect(ui.overlays()).toEqual(['taccuino', 'impostazioni']);
    input.simulate.action('back');
    expect(ui.overlays()).toEqual(['taccuino']);
    ui.closeOverlay();
    expect(ui.overlays()).toEqual([]);
  });

  it('mountPanel usa la fabbrica o il segnaposto', () => {
    const { ui } = setup();
    const c = document.createElement('div');
    const h = ui.mountPanel('bigliettini', c);
    expect(c.querySelector('[data-placeholder-panel]')).not.toBeNull();
    h.destroy();
    expect(c.children.length).toBe(0);
  });

  it('confirm: pulsante sicuro a sinistra con il fuoco; Indietro = annulla', async () => {
    const { ui, input } = setup();
    const p1 = ui.confirm({ titleKey: 'core.ui.ok', okKey: 'core.ui.ok', cancelKey: 'core.ui.annulla', danger: true });
    const buttons = Array.from(document.querySelectorAll('.core-modal-actions button')) as HTMLButtonElement[];
    expect(buttons.map((b) => b.dataset.test)).toEqual(['confirm-annulla', 'confirm-ok']);
    expect(buttons[1]?.className).toContain('core-btn--pericolo');
    expect(document.activeElement).toBe(buttons[0]);
    buttons[1]?.click();
    await expect(p1).resolves.toBe(true);
    const p2 = ui.confirm({ titleKey: 'core.ui.ok', okKey: 'core.ui.ok', cancelKey: 'core.ui.annulla' });
    input.simulate.action('back');
    await expect(p2).resolves.toBe(false);
    expect(document.querySelector('.core-modal-host')).toBeNull();
  });

  it('toast dal metodo e dal bus; didascalie solo se attive', () => {
    const { ui, bus, store } = setup();
    ui.toast('core.prova.ciao', undefined, 'ok');
    bus.emit('toast', { textKey: 'core.ui.ok' });
    const toasts = document.querySelectorAll('.core-toast');
    expect(toasts.length).toBe(2);
    expect((toasts[0] as HTMLElement).dataset.kind).toBe('ok');
    vi.advanceTimersByTime(4000);
    expect(document.querySelectorAll('.core-toast').length).toBe(0);
    bus.emit('audio:caption', { textKey: 'core.ui.ok' });
    expect(document.querySelectorAll('.core-caption').length).toBe(0);
    store.set({ captions: true });
    bus.emit('audio:caption', { textKey: 'core.ui.ok' });
    expect(document.querySelector('.core-caption')?.textContent).toBe('Va bene');
  });

  it('al cambio di lingua i testi si riscrivono', () => {
    const { ui, bus, i18n } = setup();
    ui.toast('core.ui.ok');
    i18n.setLocale('en');
    bus.emit('settings:change', { ...defaultSettings('en') });
    expect(document.querySelector('.core-toast')?.textContent).toBe('OK');
  });
});
