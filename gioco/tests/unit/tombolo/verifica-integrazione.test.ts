// @vitest-environment happy-dom
/**
 * Verifica dell'integrazione (docs/stato/RICHIESTE.md, «Per: tombolo (facoltative)»):
 * pannelli del layout largo montati a notte attiva, Taccuino fisso, avvisi brevi
 * del core che durante la notte non rubano il trascinamento dei fusi.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Services } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { NightController } from '../../../src/tombolo/controller';
import { TomboloScene } from '../../../src/tombolo/TomboloScene';
import { activeNight } from '../../../src/tombolo/active';
import { fixture, fixtureComputed, nightParams } from './helpers';
import { type Harness, harness } from './harness';

let h: Harness;
const live: { destroy(): void }[] = [];

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  for (const c of live.splice(0)) c.destroy();
  document.body.replaceChildren();
});

function wide(s: Services): void {
  const vp = computeViewport(1280, 720, 1, { top: 0, right: 0, bottom: 0, left: 0 }, 1);
  (s as unknown as { viewport: { get: () => typeof vp } }).viewport = { get: () => vp };
}

describe('pannelli del layout largo', () => {
  it('Bigliettini e Taccuino si montano a notte già attiva; il Taccuino è fisso', async () => {
    wide(h.s);
    const mounted: { id: string; active: boolean; opts: Record<string, unknown> }[] = [];
    for (const id of ['bigliettini', 'taccuino']) {
      h.s.ui.registerPanel(id, (_c, opts) => {
        mounted.push({ id, active: activeNight() !== null, opts: (opts ?? {}) as Record<string, unknown> });
        return { destroy() {} };
      });
    }
    const scene = new TomboloScene(h.s);
    await scene.enter(nightParams(fixture('g06'), { origin: 'campagna' }));
    live.push({ destroy: () => scene.exit() });
    expect(mounted.map((m) => m.id).sort()).toEqual(['bigliettini', 'taccuino']);
    expect(mounted.every((m) => m.active)).toBe(true);
    expect(mounted.find((m) => m.id === 'taccuino')?.opts.fixed).toBe(true);
    expect(mounted.find((m) => m.id === 'bigliettini')?.opts.fixed).toBeUndefined();
  });

  it('senza startPanels la regia non monta i pannelli (prima di setActiveNight)', () => {
    wide(h.s);
    let n = 0;
    h.s.ui.registerPanel('taccuino', () => {
      n++;
      return { destroy() {} };
    });
    const c = new NightController(h.s, nightParams(fixture('g06')), { computed: null });
    live.push(c);
    expect(n).toBe(0);
    c.startPanels();
    c.startPanels();
    expect(n).toBe(1);
  });
});

describe('avvisi brevi durante la notte', () => {
  it('la radice dell\'interfaccia porta la classe della notte e la distanza degli avvisi, tolte a notte chiusa', () => {
    const root = h.s.ui.root;
    const c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00') });
    expect(root.classList.contains('tb-notte')).toBe(true);
    const px = Number.parseInt(root.style.getPropertyValue('--tb-avvisi-basso'), 10);
    // Sopra la striscia delle richieste, quindi sopra i fusi e la barra delle azioni.
    expect(px).toBeGreaterThanOrEqual(c.layout.cssH - c.layout.requests.y);
    expect(px).toBeGreaterThan(c.layout.cssH - c.layout.spindles.y);
    c.destroy();
    expect(root.classList.contains('tb-notte')).toBe(false);
    expect(root.style.getPropertyValue('--tb-avvisi-basso')).toBe('');
  });

  it('due notti di fila (Ricomincia): la classe resta finché ce n\'è una', () => {
    const root = h.s.ui.root;
    const a = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const b = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    live.push(b);
    a.destroy();
    expect(root.classList.contains('tb-notte')).toBe(true);
    b.destroy();
    expect(root.classList.contains('tb-notte')).toBe(false);
  });
});
