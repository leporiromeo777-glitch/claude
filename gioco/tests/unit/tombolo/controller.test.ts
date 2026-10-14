// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Services } from '../../../src/core/types';
import { NightController } from '../../../src/tombolo/controller';
import { fixture, fixtureComputed, nightParams } from './helpers';
import { type Harness, harness } from './harness';

let h: Harness;
let c: NightController | null = null;

beforeEach(() => {
  h = harness();
});
afterEach(() => {
  c?.destroy();
  c = null;
  document.body.replaceChildren();
});

describe('regia della notte (DOM, senza canvas)', () => {
  it('monta le fasce e le parti dell\'interfaccia', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00') });
    for (const t of ['tb-hud', 'tb-colonne', 'tb-richieste', 'tb-azioni', 'tb-fissa', 'tb-disfa', 'tb-menu', 'tb-taccuino', 'tb-lampada', 'tb-stato']) {
      expect(document.querySelector(`[data-test="${t}"]`), t).not.toBeNull();
    }
    expect(document.querySelectorAll('.tb-header-cell')).toHaveLength(3);
    expect(c.layout.kind).toBe('stretto');
  });

  it('tastiera: il prologo intero, con autosalvataggio a ogni ora fissata', () => {
    c = new NightController(h.s, nightParams(fixture('g00'), { origin: 'campagna' }), { computed: fixtureComputed('g00') });
    const act = (action: Parameters<NightController['interact']['onAction']>[0]['action'], index?: number): void => {
      const e: Parameters<NightController['interact']['onAction']>[0] = { action, repeat: false, source: 'keyboard' };
      if (index !== undefined) e.index = index;
      c!.interact.onAction(e);
    };
    act('select', 0);
    act('crossR');
    act('confirm');
    expect(h.data.night?.resume.rows).toHaveLength(1);
    expect(h.writes.some((w) => w.immediate)).toBe(true);
    act('right');
    act('crossL');
    act('confirm');
    act('crossR');
    act('confirm');
    act('left');
    act('crossR');
    expect(c.lastViolation?.code).toBe('rifiuto');
    expect(h.haptics).toContain('rifiuto');
    act('crossL');
    act('confirm');
    expect(c.completed?.metrics.incroci).toBe(4);
    expect(h.data.night).toBeNull();
    expect(h.events.filter((e) => e.k === 'night:complete')).toHaveLength(1);
    expect(h.events.filter((e) => e.k === 'night:row')).toHaveLength(4);
    expect(c.status.value).toMatch(/Teresa al Forno/);
  });

  it('pagina nascosta: salvataggio immediato; uscita a metà notte: night:exit', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    c.cross(0, 'R', 'debug');
    h.writes.length = 0;
    h.s.bus.emit('app:pause', {});
    expect(h.writes[0]?.immediate).toBe(true);
    expect(h.data.night?.resume.draft).toEqual([{ pair: 0, over: 'R' }]);
    c.destroy();
    c = null;
    expect(h.events.some((e) => e.k === 'night:exit')).toBe(true);
  });

  it('richiesta lasciata cadere: gettone barrato, salvata nella ripresa', () => {
    const notes = [
      { noteId: 'g06.nina', request: { t: 'nonHa' as const, who: 'teresa', bead: 'letta:L1' }, author: 'nina' as const },
      { noteId: 'g06.marta', request: { t: 'nonIncontra' as const, a: 'marta', b: 'teresa' }, author: 'marta' as const },
    ];
    c = new NightController(h.s, nightParams(fixture('g06'), { accepted: notes }), { computed: null });
    expect(document.querySelectorAll('.tb-token')).toHaveLength(2);
    c.drop('g06.marta');
    expect(document.querySelector('[data-test="tb-richiesta-g06.marta"]')?.getAttribute('data-stato')).toBe('lasciata');
    expect(h.data.night?.resume.dropped).toEqual(['g06.marta']);
  });

  it('lampada: si accende dopo 3 Disfa di fila sulla stessa riga', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00') });
    const lamp = document.querySelector<HTMLElement>('[data-test="tb-lampada"]')!;
    expect(lamp.hidden).toBe(true);
    for (let i = 0; i < 3; i++) {
      c.cross(0, 'R', 'debug');
      c.undo();
    }
    expect(lamp.hidden).toBe(false);
    expect(lamp.classList.contains('tb-lamp--accesa')).toBe(true);
  });

  it('lampada: si accende dopo 60 secondi senza fissare un\'ora', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const lamp = document.querySelector<HTMLElement>('[data-test="tb-lampada"]')!;
    for (let i = 0; i < 59 * 60; i++) c.update(1 / 60);
    expect(lamp.hidden).toBe(true);
    for (let i = 0; i < 2 * 60; i++) c.update(1 / 60);
    expect(lamp.hidden).toBe(false);
  });

  it('barra alta: giornata e titolo (GDD 10.3)', () => {
    c = new NightController(h.s, nightParams(fixture('g06'), { origin: 'campagna' }), { computed: null });
    expect(document.querySelector('.tb-hud-day')?.textContent).toBe('Giornata 6');
    c.destroy();
    c = new NightController(h.s, nightParams(fixture('g00'), { origin: 'campagna' }), { computed: null });
    expect(document.querySelector('.tb-hud-day')?.textContent).toBe('Prologo');
    c.destroy();
    c = new NightController(h.s, nightParams(fixture('test-grande')), { computed: null });
    expect(document.querySelector<HTMLElement>('.tb-hud-day')?.hidden).toBe(true);
  });

  it('vibrazione media al passaggio di una perlina anche con il movimento ridotto', () => {
    h.data.settings.reducedMotion = true;
    h.data.settings.animSpeed = 0;
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    c.autoplay([{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }]);
    h.haptics.length = 0;
    // Alle 7 Teresa sopra Don Piero: la lettera passa.
    expect(c.cross(1, 'L', 'debug')).toBeNull();
    expect(h.haptics).toContain('medio');
  });

  it('scheda del suggerimento: H dà il gradino successivo, Tab resta nella scheda', async () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: fixtureComputed('g00') });
    const first = await c.nextHint();
    expect(first?.tier).toBe('spinta');
    expect(document.querySelector('[data-test="tb-popup-hint"]')).not.toBeNull();
    h.s.input.simulate.action('notebook');
    expect(document.activeElement?.closest('.tb-popup')).not.toBeNull();
    h.s.input.simulate.action('hint');
    for (let i = 0; i < 20 && c.lastHint?.tier !== 'indizio'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(c.lastHint?.tier).toBe('indizio');
  });

  it('Ricomincia la notte chiude la Pausa aperta sopra il tombolo', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    void h.s.ui.openOverlay('pausa', { from: 'tombolo' });
    const ui = h.s.ui as Services['ui'] & { overlays(): string[] };
    expect(ui.overlays()).toEqual(['pausa']);
    c.restart();
    expect(ui.overlays()).toEqual([]);
    expect(h.data.night?.resume.rows ?? []).toEqual([]);
  });

  it('All\'ultima riga "Fissa l\'ora" diventa "Chiudi il merletto"', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const label = (): string | undefined => document.querySelector<HTMLElement>('[data-test="tb-fissa"] .core-btn-label')?.dataset.i18n;
    expect(label()).toBe('tombolo.azioni.fissa');
    c.autoplay([{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }, { hour: 7, crossings: [{ pair: 1, over: 'L' }] }, { hour: 8, crossings: [{ pair: 1, over: 'L' }] }]);
    expect(c.session.hour).toBe(9);
    expect(label()).toBe('tombolo.azioni.chiudi');
  });
});
