// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameEventMap, HapticKind, SaveData, Services, Viewport } from '../../../src/core/types';
import { createBus } from '../../../src/core/events';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { createInput } from '../../../src/core/input';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createAudioStub } from '../../../src/core/audio-stub';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { defaultSettings } from '../../../src/core/settings';
import { computeViewport } from '../../../src/core/viewport';
import { installServices } from '../../../src/core/services';
import { loadContent } from '../../../src/content/loader';
import { NightController } from '../../../src/tombolo/controller';
import { fixture, fixtureComputed, nightParams } from './helpers';

interface Harness {
  s: Services;
  data: SaveData;
  writes: { immediate: boolean }[];
  haptics: HapticKind[];
  events: { k: keyof GameEventMap; p: unknown }[];
}

function harness(): Harness {
  const bus = createBus<GameEventMap>();
  const events: Harness['events'] = [];
  const keys: (keyof GameEventMap)[] = ['night:cross', 'night:violation', 'night:row', 'night:undo', 'night:complete', 'night:exit', 'quirk:discovered'];
  for (const k of keys) bus.on(k, (p) => events.push({ k, p }));
  const i18n = createI18n({ sources: loadI18nSources(), locale: 'it' });
  const data = defaultSaveData('test', defaultSettings('it', false));
  const writes: Harness['writes'] = [];
  const save = {
    load: async () => data,
    data: () => data,
    update: (m: (d: SaveData) => void, o?: { immediate?: boolean }) => {
      m(data);
      writes.push({ immediate: !!o?.immediate });
    },
    flush: async () => undefined,
    exportString: () => '',
    importString: () => ({ ok: true }),
    wipe: async () => undefined,
  };
  const settings = { get: () => data.settings, set: (p: Partial<SaveData['settings']>) => Object.assign(data.settings, p) };
  const input = createInput({});
  const root = document.createElement('div');
  document.body.appendChild(root);
  const ui = createUiLayer({ root, input, bus, i18n, settings });
  const vp: Viewport = computeViewport(390, 844, 2, { top: 0, right: 0, bottom: 0, left: 0 }, 1);
  const haptics: HapticKind[] = [];
  const s = {
    bus,
    i18n,
    save,
    settings,
    input,
    ui,
    viewport: { get: () => vp },
    content: loadContent(),
    audio: createAudioStub(),
    haptics: { play: (k: HapticKind) => haptics.push(k) },
    assets: { load: async () => undefined, frame: () => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 0, sh: 0, ax: 0.5, ay: 0.05, placeholder: true }), image: () => document.createElement('canvas'), has: () => false, missing: () => [] },
    scenes: { register: () => undefined, go: async () => undefined, current: () => 'tombolo', has: () => false },
    debug: { register: () => undefined },
  } as unknown as Services;
  installServices(s);
  return { s, data, writes, haptics, events };
}

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

  it('All\'ultima riga "Fissa l\'ora" diventa "Chiudi il merletto"', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const label = (): string | undefined => document.querySelector<HTMLElement>('[data-test="tb-fissa"] .core-btn-label')?.dataset.i18n;
    expect(label()).toBe('tombolo.azioni.fissa');
    c.autoplay([{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }, { hour: 7, crossings: [{ pair: 1, over: 'L' }] }, { hour: 8, crossings: [{ pair: 1, over: 'L' }] }]);
    expect(c.session.hour).toBe(9);
    expect(label()).toBe('tombolo.azioni.chiudi');
  });
});
