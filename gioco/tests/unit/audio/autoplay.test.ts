// @vitest-environment happy-dom
/**
 * Overlay "Tocca per continuare" (GDD 13.6): compare quando il motore lo chiede, il
 * tocco o un tasto richiamano la ripresa dentro il gesto, sparisce quando l'audio riparte.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { AutoplayOverlay } from '../../../src/audio/autoplay';
import { createInput, type CoreInput } from '../../../src/core/input';
import { createI18n } from '../../../src/core/i18n';
import { installServices } from '../../../src/core/services';
import { WebAudioEngine } from '../../../src/audio/engine';
import { BLOCKED_CHECK_MS } from '../../../src/audio/engine';
import itAudio from '../../../src/i18n/it/audio.json';
import enAudio from '../../../src/i18n/en/audio.json';
import { FakeAudioContext, FakeTimers } from './fakeAudio';

const i18n = createI18n({
  sources: [
    { locale: 'it', ns: 'audio', path: 'src/i18n/it/audio.json', data: itAudio },
    { locale: 'en', ns: 'audio', path: 'src/i18n/en/audio.json', data: enAudio },
  ],
  locale: 'it',
});
installServices({ i18n });

let input: CoreInput | null = null;
afterEach(() => {
  input?.destroy();
  input = null;
  document.body.innerHTML = '';
});

function setup(onTap: () => void = () => undefined) {
  const root = document.createElement('div');
  document.body.appendChild(root);
  input = createInput({});
  const overlay = new AutoplayOverlay({ root, input, t: (k) => i18n.t(k), onTap });
  return { root, overlay, input };
}

describe('overlay "Tocca per continuare"', () => {
  it('si mostra una volta sola, tradotto e accessibile', () => {
    const { root, overlay } = setup();
    overlay.show();
    overlay.show();
    const nodes = root.querySelectorAll('[data-test="audio-tocca"]');
    expect(nodes).toHaveLength(1);
    const n = nodes[0] as HTMLElement;
    expect(n.getAttribute('role')).toBe('button');
    expect(n.getAttribute('aria-label')).toBe('Riprendi l\'audio');
    expect(n.textContent).toContain('Tocca per continuare');
    expect(n.classList.contains('core-solid')).toBe(true);
    expect(overlay.visible()).toBe(true);
  });

  it('il tocco chiama la ripresa in modo sincrono', () => {
    let taps = 0;
    const { root, overlay } = setup(() => taps++);
    overlay.show();
    const n = root.querySelector('[data-test="audio-tocca"]') as HTMLElement;
    n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(taps).toBe(1);
    n.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(taps).toBe(2);
  });

  it('livello modale dell\'input: un tasto qualsiasi riprende, la scena sotto non riceve', () => {
    let taps = 0;
    const { overlay, input: inp } = setup(() => taps++);
    let scene = 0;
    inp.onAction(() => {
      scene++;
      return true;
    });
    overlay.show();
    expect(inp.layers()).toEqual(['base', 'audio:tocca']);
    inp.simulate.action('confirm');
    expect(taps).toBe(1);
    expect(scene).toBe(0);
    overlay.hide();
    expect(inp.layers()).toEqual(['base']);
    inp.simulate.action('confirm');
    expect(scene).toBe(1);
  });

  it('hide() toglie il nodo', () => {
    const { root, overlay } = setup();
    overlay.show();
    overlay.hide();
    overlay.hide();
    expect(root.querySelector('[data-test="audio-tocca"]')).toBeNull();
    expect(overlay.visible()).toBe(false);
  });

  it('collegato al motore: interruzione → overlay; tocco → audio ripreso, overlay via', () => {
    const ctx = new FakeAudioContext();
    const timers = new FakeTimers();
    let overlay: AutoplayOverlay | null = null;
    const engine = new WebAudioEngine({
      createContext: () => ctx.asAudioContext(),
      timers,
      idle: () => undefined,
      visible: () => true,
      onBlocked: (b) => (b ? overlay?.show() : overlay?.hide()),
    });
    const s = setup(() => engine.unlock());
    overlay = s.overlay;
    engine.unlock();
    ctx.interrupt();
    timers.run(BLOCKED_CHECK_MS + 5);
    const n = s.root.querySelector('[data-test="audio-tocca"]') as HTMLElement;
    expect(n).not.toBeNull();
    n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(engine.state()).toBe('running');
    expect(s.root.querySelector('[data-test="audio-tocca"]')).toBeNull();
  });
});
