// @vitest-environment happy-dom
/**
 * Verifica della revisione 1 della campagna nel DOM (happy-dom), per i punti che la prova
 * nel browser ha trovato scoperti:
 * - CAM-11 (C17): nessuna regola del CSS della campagna colora i nomi sulla carta senza
 *   l'inchiostro `--pers-ink` (il miscuglio al 40% dava 3,9:1 a Lunardi nel bilancio e nel
 *   Taccuino); nei bigliettini e nelle lettere l'inchiostro si calcola sulla carta della
 *   calligrafia, per tutti i bigliettini del gioco;
 * - CAM-06: il Taccuino aperto su una scheda resta su quella anche quando il corpo non ha
 *   pulsanti (l'overlay mette il fuoco sul primo pulsante, cioè sulla prima scheda);
 * - CAM-09: Esc o Indietro nella sera senza pannelli chiede conferma (`cp-sera-esci-conferma`);
 *   gli spilli si contano nel pulsante solo con bigliettini da appuntare;
 * - CAM-10: niente Taccuino sul buio del prologo.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEventMap, SaveData, Services, Settings, Viewport } from '../../../src/core/types';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createInput } from '../../../src/core/input';
import { createBus } from '../../../src/core/events';
import { defaultSettings } from '../../../src/core/settings';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { installServices } from '../../../src/core/services';
import { contrastRatio } from '../../../src/core/ui/richtext';
import { setActiveNight } from '../../../src/tombolo/active';
import { taccuinoPanel } from '../../../src/campaign/taccuino/panel';
import { itemsSheet, notePaper } from '../../../src/campaign/notes';
import { handOf } from '../../../src/campaign/ui';
import { itemOf } from '../../../src/campaign/evening';
import { SeraScene } from '../../../src/campaign/SeraScene';
import { beginEvening, camp, newCampaign } from '../../../src/campaign/flow';
import { dayIndexOf } from '../../../src/campaign/evening';
import { db, emptySave } from './helpers';

function setup(layout: Viewport['layout'] = 'stretto') {
  document.body.innerHTML = '';
  const i18n = createI18n({ sources: loadI18nSources(), locale: 'it' });
  const root = document.createElement('div');
  document.body.appendChild(root);
  const input = createInput();
  const bus = createBus<GameEventMap>();
  let settings: Settings = defaultSettings('it');
  const store = { get: () => settings, set: (p: Partial<Settings>) => (settings = { ...settings, ...p }) };
  const ui = createUiLayer({ root, input, bus, i18n, settings: store });
  const d: SaveData = emptySave();
  const save = { data: () => d, update: (mut: (x: SaveData) => void) => mut(d), load: async () => d, flush: async () => undefined, exportString: () => '', importString: () => ({ ok: true }), wipe: async () => undefined };
  const vp: Viewport = { cssW: layout === 'largo' ? 1280 : 390, cssH: layout === 'largo' ? 720 : 844, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 }, orientation: layout === 'largo' ? 'landscape' : 'portrait', layout, textScale: 1 };
  const audio = { babble: vi.fn(() => ({ stop: vi.fn(), done: Promise.resolve() })), sfx: vi.fn(), carillon: vi.fn(() => ({ stop: vi.fn(), done: Promise.resolve() })), setMusic: vi.fn(), setAmbience: vi.fn(), bell: vi.fn() };
  const assets = {
    frame: (name: string) => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 256, sh: 256, ax: 0.5, ay: 0.92, placeholder: true, name }),
    image: () => document.createElement('canvas'),
    load: async () => undefined,
    has: () => false,
    missing: () => [],
  };
  let current = 'sera';
  const go = vi.fn(async (id: string) => {
    current = id;
  });
  const scenes = { current: () => current, go, has: () => true, register: () => undefined };
  const services = { i18n, bus, ui, input, save: save as unknown as Services['save'], content: db(), settings: store, viewport: { get: () => vp }, audio: audio as unknown as Services['audio'], assets: assets as unknown as Services['assets'], scenes: scenes as unknown as Services['scenes'] };
  installServices(services);
  const s = services as unknown as Services;
  ui.registerPanel('taccuino', (container, opts) => taccuinoPanel(s, container, opts));
  return { s, ui, d, go };
}

function eveningAt(d: SaveData, id: string): void {
  newCampaign(d, db());
  camp(d).dayIndex = dayIndexOf(db(), id);
  beginEvening(d, db());
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

afterEach(() => setActiveNight(null));

describe('CAM-11: inchiostro dei nomi sulla carta (C17)', () => {
  it('ogni regola del CSS della campagna che colora un nome usa --pers-ink', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/campaign/campaign.css'), 'utf8');
    const bad: string[] = [];
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = (m[1] ?? '').trim();
      const body = m[2] ?? '';
      if (!/\.core-pers\b|\.cp-pers\b/.test(sel) || /-icon\b/.test(sel)) continue;
      // L'ultima dichiarazione di `color` vince: deve passare per l'inchiostro della carta
      // (o per la regola chiara del velluto, che non usa il colore del personaggio).
      const colors = [...body.matchAll(/(?:^|[;\s])color:\s*([^;]+);/g)].map((x) => (x[1] ?? '').trim());
      const last = colors[colors.length - 1];
      if (last && last.includes('--pers-color') && !last.startsWith('var(--pers-ink')) bad.push(`${sel.replace(/\s+/g, ' ')} → ${last}`);
    }
    expect(bad).toEqual([]);
  });

  it('nei bigliettini di tutto il gioco i nomi stanno a 4,5:1 sulla carta della calligrafia', () => {
    const { s, d } = setup();
    eveningAt(d, 'g10');
    const low: string[] = [];
    for (const note of db().notes.values()) {
      const card = notePaper(s, note, camp(d), { full: true });
      const paper = handOf(s, note.author)?.paper;
      if (!paper) continue;
      for (const n of card.querySelectorAll<HTMLElement>('.core-pers')) {
        const ink = n.style.getPropertyValue('--pers-ink');
        if (!ink || contrastRatio(ink, paper) < 4.5) low.push(`${note.id} ${n.textContent?.trim()}: ${ink} su ${paper}`);
      }
    }
    expect(low).toEqual([]);
  });

  it('nelle lettere i nomi stanno a 4,5:1 sulla carta di chi firma', () => {
    const { s } = setup();
    const low: string[] = [];
    for (const l of db().letters) {
      const [box] = itemsSheet(s, [itemOf(l.id, db())]);
      const paper = handOf(s, l.signed === 'C.' ? 'clotilde' : 'livia')?.paper ?? '#EDE4D3';
      for (const n of box?.querySelectorAll<HTMLElement>('.core-pers') ?? []) {
        const ink = n.style.getPropertyValue('--pers-ink');
        if (!ink || contrastRatio(ink, paper) < 4.5) low.push(`${l.id} ${n.textContent?.trim()}: ${ink} su ${paper}`);
      }
    }
    expect(low).toEqual([]);
  });
});

describe('CAM-06: il Taccuino resta sulla scheda chiesta', () => {
  it('aperto su Domande senza voci, il fuoco dell’overlay non lo sposta sulla prima scheda', async () => {
    const { ui, d } = setup();
    eveningAt(d, 'g02');
    d.knowledge.diary = [];
    d.knowledge.questions = {};
    void ui.openOverlay('taccuino', { from: 'sera', tab: 'domande' });
    await tick();
    const sel = document.querySelector('[data-test^="cp-taccuino-scheda-"][aria-selected="true"]')?.getAttribute('data-test');
    expect(sel).toBe('cp-taccuino-scheda-domande');
    expect(document.querySelector('[data-test="cp-taccuino-domande"]')).not.toBeNull();
  });

  it('dopo l’apertura le frecce e il fuoco cambiano ancora scheda', async () => {
    const { ui, d } = setup();
    eveningAt(d, 'g02');
    void ui.openOverlay('taccuino', { from: 'sera', tab: 'domande' });
    await tick();
    document.querySelector<HTMLElement>('[data-test="cp-taccuino-scheda-persone"]')?.focus();
    expect(document.querySelector('[data-test^="cp-taccuino-scheda-"][aria-selected="true"]')?.getAttribute('data-test')).toBe('cp-taccuino-scheda-persone');
  });
});

describe('CAM-09 e CAM-10: la sera', () => {
  it('Esc o Indietro senza pannelli chiede «Tornare al titolo? È tutto salvato.»', async () => {
    const { s, d, go } = setup();
    eveningAt(d, 'g02');
    const scene = new SeraScene(s);
    await scene.enter({ cmd: 'continua' });
    expect(scene.onBack()).toBe(true);
    const host = document.querySelector('[data-test="cp-sera-esci-conferma"]');
    expect(host?.textContent).toContain('Tornare al titolo?');
    expect(host?.textContent).toContain('È tutto salvato.');
    expect(go).not.toHaveBeenCalledWith('titolo');
    // Un secondo Indietro mentre si chiede non apre un'altra conferma.
    expect(scene.onBack()).toBe(true);
    expect(document.querySelectorAll('[data-test="cp-sera-esci-conferma"]').length).toBe(1);
    host?.querySelector<HTMLButtonElement>('[data-test="confirm-ok"]')?.click();
    await tick();
    expect(go).toHaveBeenCalledWith('titolo');
    scene.exit();
  });

  it('gli spilli nel pulsante solo con bigliettini da appuntare', async () => {
    const { s, d } = setup();
    eveningAt(d, 'g02');
    camp(d).evening!.objectSeen = true;
    const scene = new SeraScene(s);
    await scene.enter({ cmd: 'continua' });
    expect(document.querySelector('[data-test="cp-al-tombolo"]')?.textContent).toContain('spilli 0/2');
    camp(d).evening!.noteIds = [];
    scene.refresh();
    expect(document.querySelector('[data-test="cp-al-tombolo"]')?.textContent).not.toContain('spilli');
    scene.exit();
  });

  it('prologo: niente Taccuino sul buio', async () => {
    const { s, d } = setup('largo');
    newCampaign(d, db());
    const scene = new SeraScene(s);
    await scene.enter({ cmd: 'continua' });
    expect(document.querySelector('[data-test="cp-prologo-buio"]')).not.toBeNull();
    const side = document.querySelector<HTMLElement>('[data-test="cp-taccuino-fisso"]');
    expect(side === null || side.hidden || side.classList.contains('cp-lato--nascosto')).toBe(true);
    scene.exit();
  });
});
