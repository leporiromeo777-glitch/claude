// @vitest-environment happy-dom
/**
 * Revisione 2 della campagna nel DOM (happy-dom):
 * - bilancio: un merletto che non conta lo dice e non annuncia record (Q002); «Primo filo
 *   d'oro» una riga sola (Q016, Q054); «Chi ricorda Ada» con parole legate al valore (Q055);
 *   il fuso intagliato con nome e posto, solo se si può scegliere (Q010, Q058);
 * - pannello dei bigliettini: segue lo spillo lasciato cadere dal gettone (Q014), si intitola
 *   «Obiettivi» e non dice «Nessuna richiesta» sopra gli obiettivi (Q066), «Torna alla sera»
 *   prima della prima ora (Q012);
 * - Taccuino: schede tutte in vista su più righe (Q008, Q020, Q037), stranezze sciolte al
 *   passato (Q056);
 * - sera: «Clicca» col mouse (Q067), la freccia quando l'elenco continua sotto il piede
 *   (Q004), niente tocchi fantasma su «Al tombolo» dopo un foglio chiuso (Q006);
 * - lettera di Clotilde nella grafia seppia (Q060); bottiglia vuota col nodo (Q039);
 * - CSS: voci della lettera e «Rifai» leggibili (Q026, Q027, Q003); «Continua» al posto del
 *   pulsante principale (Q031);
 * - Telaio: la Tovaglia (R2-D5) e i pulsanti di una giornata in fondo in vista (Q035);
 * - controller: fine della notte da gustare (R2-D5) e niente avvisi sopra il merletto
 *   (Q069, Q075).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameEventMap, NightOutcome, SaveData, Services, Settings, Viewport } from '../../../src/core/types';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createInput } from '../../../src/core/input';
import { createBus } from '../../../src/core/events';
import { defaultSettings } from '../../../src/core/settings';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { installServices } from '../../../src/core/services';
import { contrastRatio } from '../../../src/core/ui/richtext';
import { setActiveNight } from '../../../src/tombolo/active';
import { bigliettiniPanel, fitStrip, taccuinoPanel } from '../../../src/campaign/taccuino/panel';
import { itemsSheet, noteDetailPanel, objectPanel } from '../../../src/campaign/notes';
import { CLOTILDE_HAND, EMPTY_BOTTLE, handOf, spriteCanvas, tapKey } from '../../../src/campaign/ui';
import { imageOf, itemOf, dayIndexOf, pinNote } from '../../../src/campaign/evening';
import { BilancioScene } from '../../../src/campaign/BilancioScene';
import { SeraScene } from '../../../src/campaign/SeraScene';
import { TelaioScene } from '../../../src/campaign/TelaioScene';
import { CampaignControllerImpl, LACE_HOLD_MS, controller } from '../../../src/campaign/controller';
import { beginEvening, camp, completeDay, newCampaign, startNight } from '../../../src/campaign/flow';
import { refreshDiary } from '../../../src/campaign/diary';
import type { CampaignStateX } from '../../../src/campaign/types';
import { db, emptySave, playNight } from './helpers';

const ROOT = resolve(__dirname, '../../..');

function setup(layout: Viewport['layout'] = 'stretto', opts: { art?: boolean } = {}) {
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
  const audio = { babble: vi.fn(() => ({ stop: vi.fn(), done: Promise.resolve() })), sfx: vi.fn(), carillon: vi.fn(() => ({ stop: vi.fn(), done: new Promise<void>(() => undefined) })), setMusic: vi.fn(), setAmbience: vi.fn(), bell: vi.fn() };
  const frames: string[] = [];
  const assets = {
    frame: (name: string) => {
      frames.push(name);
      return { source: document.createElement('canvas'), sx: 0, sy: 0, sw: 256, sh: 256, ax: 0.5, ay: 0.92, placeholder: true, name };
    },
    image: () => document.createElement('canvas'),
    load: async () => undefined,
    has: (name: string) => !!opts.art && /^fuso\/stile_[12]$/.test(name),
    missing: () => [],
  };
  let current = 'sera';
  const go = vi.fn(async (id: string) => {
    current = id;
  });
  const scenes = { current: () => current, go, has: () => true, register: () => undefined };
  const services = { i18n, bus, ui, input, save: save as unknown as Services['save'], content: db(), settings: store, viewport: { get: () => vp }, audio: audio as unknown as Services['audio'], assets: assets as unknown as Services['assets'], scenes: scenes as unknown as Services['scenes'], platform: { copy: async () => true } };
  installServices(services as never);
  const s = services as unknown as Services;
  ui.registerPanel('taccuino', (container, o) => taccuinoPanel(s, container, o));
  ui.registerPanel('cp-nota', (container, o) => noteDetailPanel(s, container, o));
  ui.registerPanel('cp-oggetto', (container) => objectPanel(s, container));
  return { s, ui, d, go, audio, frames, store, setScene: (id: string) => (current = id) };
}

function eveningAt(d: SaveData, id: string): CampaignStateX {
  newCampaign(d, db());
  camp(d).dayIndex = dayIndexOf(db(), id);
  beginEvening(d, db());
  return camp(d);
}

/** Una giornata giocata fino al bilancio, con le richieste appuntabili (soluzione precalcolata). */
function dayToBilancio(d: SaveData, id: string, edit?: (o: NightOutcome) => NightOutcome): CampaignStateX {
  const c = eveningAt(d, id);
  for (const n of (c.evening?.noteIds ?? []).filter((x) => !!db().notes.get(x)?.request).slice(0, 2)) pinNote(c, db(), n);
  startNight(d, db());
  const o = playNight(d);
  completeDay(d, db(), edit ? edit(o) : o);
  const cc = camp(d);
  cc.phase = 'bilancio';
  return cc;
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  setActiveNight(null);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('bilancio (R2-D2, Q055, Q010, Q058)', () => {
  it('un merletto con una richiesta fallita non annuncia record e dice che non conta (Q002)', () => {
    const { s, d } = setup();
    dayToBilancio(d, 'g02', (o) => ({ ...o, requests: o.requests.map((r, i) => (i === 0 ? { ...r, status: 'fallita' as const } : r)), metrics: { ...o.metrics, incroci: Math.max(0, o.metrics.incroci - 3) } }));
    const scene = new BilancioScene(s);
    scene.enter();
    const el = document.querySelector('[data-test="cp-bilancio-eleganza"]');
    expect(el).not.toBeNull();
    expect(el?.querySelector('[data-test^="cp-bilancio-nuovo-"]')).toBeNull();
    expect(el?.querySelector('[data-test="cp-bilancio-oro"]')).toBeNull();
    expect(el?.querySelector('[data-test="cp-bilancio-record-escluso"]')?.textContent).toContain('non entra nei record');
    scene.exit();
  });

  it('il primo filo d’oro: una riga sola, «Il tuo primo filo d’oro» (Q016, Q054)', () => {
    const { s, d } = setup();
    const c = dayToBilancio(d, 'g02');
    const r = c.report!;
    expect(r.metrics.filoDOro).toBe(true);
    expect(r.record.firstGold).toBe(true);
    const scene = new BilancioScene(s);
    scene.enter();
    const gold = document.querySelectorAll('[data-test="cp-bilancio-oro"]');
    expect(gold.length).toBe(1);
    expect(gold[0]?.textContent).toContain('Il tuo primo filo d’oro'.replace('’', "'"));
    const text = document.querySelector('[data-test="cp-bilancio-eleganza"]')?.textContent ?? '';
    expect(text).not.toContain('il primo di questa giornata');
    expect(text).not.toContain('Primo filo d');
    scene.exit();
    // Il giorno dopo, un altro filo d'oro: la riga della giornata, non «il tuo primo».
    const c2 = dayToBilancio(d, 'g03');
    if (c2.report?.metrics.filoDOro) {
      const scene2 = new BilancioScene(s);
      scene2.enter();
      const t2 = document.querySelector('[data-test="cp-bilancio-oro"]')?.textContent ?? '';
      expect(t2).toContain('il primo di questa giornata');
      expect(document.querySelector('[data-test="cp-bilancio-oro"]')?.getAttribute('data-primo')).toBe('0');
      scene2.exit();
    }
  });

  it('«Chi ricorda Ada»: le parole dicono quanto ricorda, la direzione è a parte (Q055)', () => {
    const { s, d } = setup();
    const c = dayToBilancio(d, 'g02');
    c.report!.memoria = [
      { character: 'nina', before: 0, after: 1 },
      { character: 'lunardi', before: 3, after: 2 },
      { character: 'zeno', before: 1, after: 0 },
    ];
    const scene = new BilancioScene(s);
    scene.enter();
    expect(document.querySelector('[data-test="cp-bilancio-memoria-nina"]')?.textContent).toContain('ricorda appena Ada (1/3)');
    expect(document.querySelector('[data-test="cp-bilancio-memoria-nina"]')?.textContent).toContain('più di ieri');
    expect(document.querySelector('[data-test="cp-bilancio-memoria-lunardi"]')?.textContent).toContain('ricorda Ada (2/3)');
    expect(document.querySelector('[data-test="cp-bilancio-memoria-lunardi"]')?.textContent).toContain('meno di ieri');
    expect(document.querySelector('[data-test="cp-bilancio-memoria-lunardi"]')?.textContent).not.toContain('dimenticare');
    expect(document.querySelector('[data-test="cp-bilancio-memoria-zeno"]')?.textContent).toContain('ha dimenticato Ada');
    scene.exit();
  });

  it('il fuso intagliato si annuncia col nome e dove si sceglie, solo se ha il disegno (Q010, Q058)', () => {
    const { s, d } = setup('stretto', { art: true });
    const c = dayToBilancio(d, 'g02');
    d.unlocks.cosmetics = ['stile_1', 'stile_3'];
    c.report!.unlocked = ['cosmetic:stile_1', 'cosmetic:stile_3'];
    const scene = new BilancioScene(s);
    scene.enter();
    const one = document.querySelector('[data-test="cp-bilancio-sblocco-cosmetic:stile_1"]');
    expect(one?.textContent).toContain('«Liscio»');
    expect(one?.textContent).toContain('Impostazioni');
    expect(one?.textContent).not.toContain('stile');
    expect(document.querySelector('[data-test="cp-bilancio-sblocco-cosmetic:stile_3"]')).toBeNull();
    scene.exit();
    // Senza nessun fuso disegnato la sezione non c'è nemmeno.
    c.report!.unlocked = ['cosmetic:stile_3'];
    const scene2 = new BilancioScene(s);
    scene2.enter();
    expect(document.querySelector('[data-test="cp-bilancio-sblocchi"]')).toBeNull();
    scene2.exit();
  });
});

/** Una notte finta per i pannelli (quel che leggono del tombolo). */
function fakeNight(params: Record<string, unknown>, session: Record<string, unknown> = {}) {
  const night = {
    params: { origin: 'campagna', mode: 'normale', flags: {}, goals: [], needsNome: false, ...params },
    completed: null as unknown,
    session: { dropped: [] as string[], rows: [] as unknown[], requestStatus: () => [], goalStatus: () => [], ...session },
    drop(id: string) {
      (night.session.dropped as string[]).push(id);
    },
  };
  setActiveNight(night as never);
  return night;
}

describe('pannello dei bigliettini (Q014, Q066, Q012)', () => {
  it('lo spillo lasciato cadere dal gettone: il pannello concorda subito (Q014)', async () => {
    vi.useFakeTimers();
    const { s, d, setScene } = setup('largo');
    const c = eveningAt(d, 'g06');
    const id = c.evening!.noteIds.find((x) => !!db().notes.get(x)?.request)!;
    pinNote(c, db(), id);
    const p = startNight(d, db());
    setScene('tombolo');
    const night = fakeNight({ level: p.level, accepted: p.accepted }, { rows: [{ hour: 7, crossings: [] }] });
    const box = document.createElement('div');
    document.body.appendChild(box);
    const h = bigliettiniPanel(s, box, { from: 'tombolo' });
    expect(box.querySelector(`[data-test="cp-lascia-cadere-${id}"]`)).not.toBeNull();
    // Il tombolo lascia cadere lo spillo (gettone) senza eventi sul bus.
    night.drop(id);
    await vi.advanceTimersByTimeAsync(300);
    expect(box.querySelector(`[data-test="cp-lascia-cadere-${id}"]`)).toBeNull();
    expect(box.querySelector(`[data-test="cp-richiesta-${id}"] [data-stato="lasciata"]`)).not.toBeNull();
    h.destroy();
  });

  it('nelle notti senza bigliettini e con obiettivi: «Obiettivi», niente «Nessuna richiesta» (Q066)', () => {
    const { s, d, setScene } = setup('largo');
    newCampaign(d, db());
    const level = db().levels.get('g00')!;
    setScene('tombolo');
    fakeNight({ level, accepted: [], goals: [...(level.goals ?? [])] }, { goalStatus: () => (level.goals ?? []).map(() => ({ status: 'in_corso' })) });
    const box = document.createElement('div');
    document.body.appendChild(box);
    const h = bigliettiniPanel(s, box, { from: 'tombolo' });
    expect(box.querySelector('.cp-taccuino-titolo')?.textContent).toBe('Obiettivi');
    expect(box.textContent).not.toContain('Nessuna richiesta stanotte');
    h.destroy();
  });

  it('prima della prima ora si torna alla sera e gli spilli si cambiano senza conseguenze (Q012)', async () => {
    const { s, d, go, setScene, ui } = setup('stretto');
    controller.install();
    const c = eveningAt(d, 'g06');
    const ids = c.evening!.noteIds.filter((x) => !!db().notes.get(x)?.request);
    pinNote(c, db(), ids[0]!);
    pinNote(c, db(), ids[1]!);
    const p = startNight(d, db());
    setScene('tombolo');
    const night = fakeNight({ level: p.level, accepted: p.accepted });
    d.night = { origin: 'campagna', params: { origin: 'campagna', mode: 'normale', levelId: p.level.id, flags: {}, accepted: [], goals: [], needsNome: false }, resume: { levelId: p.level.id, rows: [], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false } };
    // Nel layout stretto il pulsante sta nei Bigliettini aperti sopra il tombolo: si chiudono.
    ui.registerPanel('bigliettini', (container, o) => bigliettiniPanel(s, container, o));
    void ui.openOverlay('bigliettini', { from: 'tombolo' });
    await tick();
    const back = document.querySelector<HTMLButtonElement>('[data-test="cp-torna-sera"]');
    expect(back).not.toBeNull();
    back?.click();
    expect(ui.overlays()).toEqual([]);
    expect(camp(d).phase).toBe('sera');
    expect(camp(d).evening?.accepted.map((a) => a.noteId)).toEqual([ids[0], ids[1]]);
    expect(d.night).toBeNull();
    expect(go).toHaveBeenCalledWith('sera', undefined);
    // Il tombolo, uscendo, salva ancora la notte: si toglie.
    d.night = { origin: 'campagna', params: { origin: 'campagna', mode: 'normale', levelId: p.level.id, flags: {}, accepted: [], goals: [], needsNome: false }, resume: { levelId: p.level.id, rows: [], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false } };
    s.bus.emit('night:exit', { origin: 'campagna' });
    expect(d.night).toBeNull();
    // Con un'ora già fissata il pulsante non c'è più.
    camp(d).phase = 'notte';
    (night.session as { rows: unknown[] }).rows = [{ hour: 7, crossings: [] }];
    const box2 = document.createElement('div');
    document.body.appendChild(box2);
    const h2 = bigliettiniPanel(s, box2, { from: 'tombolo' });
    expect(box2.querySelector('[data-test="cp-torna-sera"]')).toBeNull();
    h2.destroy();
  });
});

describe('Taccuino (Q008, Q020, Q037, Q056)', () => {
  it('le schede che non stanno in una riga vanno su due righe bilanciate, tutte in vista', () => {
    const strip = document.createElement('div');
    for (let i = 0; i < 6; i++) {
      const t = document.createElement('button');
      t.setAttribute('role', 'tab');
      Object.defineProperty(t, 'scrollWidth', { get: () => 60 });
      Object.defineProperty(t, 'clientWidth', { get: () => (strip.classList.contains('cp-schede--righe') ? 95 : 55) });
      strip.appendChild(t);
    }
    Object.defineProperty(strip, 'clientWidth', { get: () => 293 });
    Object.defineProperty(strip, 'scrollWidth', { get: () => (strip.classList.contains('cp-schede--righe') ? 293 : 379) });
    expect(fitStrip(strip)).toBe(2);
    expect(strip.classList.contains('cp-schede--righe')).toBe(true);
    expect(strip.style.getPropertyValue('--cp-schede-colonne')).toBe('3');
    // Se ci stanno, una riga.
    const wide = document.createElement('div');
    for (let i = 0; i < 6; i++) {
      const t = document.createElement('button');
      t.setAttribute('role', 'tab');
      wide.appendChild(t);
    }
    Object.defineProperty(wide, 'clientWidth', { get: () => 600 });
    Object.defineProperty(wide, 'scrollWidth', { get: () => 560 });
    expect(fitStrip(wide)).toBe(1);
    expect(wide.classList.contains('cp-schede--righe')).toBe(false);
    const css = readFileSync(resolve(ROOT, 'src/campaign/campaign.css'), 'utf8');
    expect(css).toMatch(/\.cp-schede--righe\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--cp-schede-colonne/);
  });

  it('dopo la pace le stranezze di Teresa e di Marta sono barrate, «non più» (Q056)', async () => {
    const { ui, d } = setup();
    const c = eveningAt(d, 'g19');
    d.knowledge.quirks.push('martaNoSotto', 'teresaLegge', 'pieroPozzo');
    c.flags['riconciliate'] = true;
    refreshDiary(c, d.knowledge, db());
    void ui.openOverlay('taccuino', { from: 'sera', tab: 'persone' });
    await tick();
    const marta = document.querySelector('[data-test="cp-stranezza-martaNoSotto"]');
    expect(marta).not.toBeNull();
    expect(marta?.getAttribute('data-sciolta')).toBe('1');
    expect(marta?.querySelector('s')?.textContent).toContain('Non passa mai sotto Teresa');
    expect(marta?.textContent).toContain('non più');
    const piero = document.querySelector('[data-test="cp-stranezza-pieroPozzo"]');
    expect(piero?.getAttribute('data-sciolta')).toBe('0');
  });
});

describe('sera (Q067, Q004, Q006)', () => {
  it('col mouse il gioco dice «Clicca» (Q067)', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('pointer: fine'), media: q, addEventListener() {}, removeEventListener() {} }));
    expect(tapKey('campaign.prologo.tocca')).toBe('campaign.prologo.toccaClic');
    const { s, d } = setup();
    newCampaign(d, db());
    const scene = new SeraScene(s);
    await scene.enter({ cmd: 'continua' });
    expect(document.querySelector('[data-test="cp-prologo-buio"]')?.textContent).toContain('Clicca per continuare');
    scene.exit();
    vi.unstubAllGlobals();
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
    expect(tapKey('campaign.prologo.tocca')).toBe('campaign.prologo.tocca');
  });

  it('la freccia sul piede quando l’elenco continua sotto (Q004)', async () => {
    const { s, d } = setup();
    eveningAt(d, 'g01');
    camp(d).evening!.objectSeen = true;
    camp(d).actCardSeen = camp(d).dayIndex;
    const scene = new SeraScene(s);
    await scene.enter({ cmd: 'continua' });
    const main = document.querySelector<HTMLElement>('.cp-sera-centro')!;
    expect(main.querySelector('[data-test="cp-sera-scorri"]')).not.toBeNull();
    Object.defineProperty(main, 'scrollHeight', { configurable: true, get: () => 886 });
    Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 844 });
    main.dispatchEvent(new Event('scroll'));
    expect(main.classList.contains('cp-sera--altro')).toBe(true);
    Object.defineProperty(main, 'scrollTop', { configurable: true, get: () => 42 });
    main.dispatchEvent(new Event('scroll'));
    expect(main.classList.contains('cp-sera--altro')).toBe(false);
    const css = readFileSync(resolve(ROOT, 'src/campaign/campaign.css'), 'utf8');
    expect(css).toMatch(/\.cp-bigliettino\s*\{[^}]*scroll-margin-bottom:\s*calc\(var\(--cp-piede-h/);
    scene.exit();
  });

  it('dopo un foglio chiuso un secondo tocco non apre «Andare al tombolo?» (Q006)', async () => {
    const { s, d, ui } = setup();
    eveningAt(d, 'g03');
    camp(d).actCardSeen = camp(d).dayIndex;
    const scene = new SeraScene(s);
    await scene.enter({ cmd: 'continua' });
    document.querySelector<HTMLButtonElement>('[data-test="cp-oggetto"]')?.click();
    await tick();
    // «Continua» due volte, toccando: legge, poi chiude.
    const tap = (sel: string): void => {
      const b = document.querySelector<HTMLButtonElement>(sel);
      b?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
      b?.click();
    };
    tap('[data-test="cp-oggetto-continua"]');
    tap('[data-test="cp-oggetto-continua"]');
    await tick();
    expect(ui.overlays()).toEqual([]);
    // Il «clic» fantasma dello stesso tocco arriva ad «Al tombolo», sotto: niente conferma.
    document.querySelector<HTMLButtonElement>('[data-test="cp-al-tombolo"]')?.click();
    await tick();
    expect(document.querySelector('[data-test="confirm"]')).toBeNull();
    // Un tocco vero su «Al tombolo» (comincia sul pulsante) chiede la conferma.
    tap('[data-test="cp-al-tombolo"]');
    await tick();
    expect(document.querySelector('[data-test="confirm"]')).not.toBeNull();
    scene.exit();
  });
});

describe('carta e CSS (Q060, Q039, Q026, Q027, Q031)', () => {
  it('la lettera di Clotilde è nella grafia seppia dei margini (Q060)', () => {
    const { s } = setup();
    expect(handOf(s, 'clotilde')).toBe(CLOTILDE_HAND);
    expect(CLOTILDE_HAND.font).toBe('caveat');
    expect(Math.abs(CLOTILDE_HAND.slantDeg)).toBeLessThanOrEqual(3);
    expect(contrastRatio(CLOTILDE_HAND.ink, CLOTILDE_HAND.paper)).toBeGreaterThanOrEqual(4.5);
    const letter = db().letters.find((l) => l.signed === 'C.');
    expect(letter).toBeDefined();
    const [box] = itemsSheet(s, [itemOf(letter!.id, db())]);
    const sheet = box?.querySelector<HTMLElement>('.cp-lettera');
    expect(sheet?.classList.contains('core-carta--mano')).toBe(true);
    expect(sheet?.style.getPropertyValue('--mano-font')).toMatch(/mano|Caveat/i);
  });

  it('la bottiglia di g16 è vuota, col nodo nero (Q039)', () => {
    const { s, frames } = setup();
    expect(imageOf('bottiglia_nodo_nero')).toBe(EMPTY_BOTTLE);
    expect(imageOf('bottiglia')).toBe('obj/bottiglia');
    const fake = { setTransform: vi.fn(), clearRect: vi.fn(), drawImage: vi.fn() };
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fake as never);
    spriteCanvas(s, EMPTY_BOTTLE, 72);
    spy.mockRestore();
    expect(fake.drawImage).toHaveBeenCalled();
    expect(frames).toContain('obj/bottiglia');
    expect(frames).not.toContain(EMPTY_BOTTLE);
  });

  it('voci della lettera su carta opaca e «Rifai» in inchiostro: almeno 4,5:1 (Q026, Q027, Q003)', () => {
    const css = readFileSync(resolve(ROOT, 'src/campaign/campaign.css'), 'utf8');
    const theme = readFileSync(resolve(ROOT, 'src/core/ui/theme.css'), 'utf8');
    const token = (n: string): string => new RegExp(`--${n}:\\s*(#[0-9A-Fa-f]{6})`).exec(theme)?.[1] ?? '';
    expect(css).toMatch(/\.cp-dettaglio \.cp-voce-nuova\s*\{[^}]*background:\s*var\(--carta\)/);
    expect(css).toMatch(/\.cp-dettaglio \.cp-lettura-voci \.cp-foglio-h[^{]*\{[^}]*color:\s*var\(--testo-tenue\)/);
    expect(css).toMatch(/\.cp-rotolo \.core-btn--testo[^{]*\{[^}]*color:\s*var\(--inchiostro\)/);
    expect(contrastRatio(token('inchiostro'), token('carta'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#B9B3A6', token('velluto-luce'))).toBeGreaterThanOrEqual(4.5);
  });

  it('«Continua» prende il posto del pulsante principale del tombolo, che si nasconde (Q031)', async () => {
    const { placeOverMain } = await import('../../../src/campaign/nightbar');
    const host = document.createElement('div');
    const nav = document.createElement('nav');
    const menu = document.createElement('button');
    const main = document.createElement('button');
    main.dataset.test = 'tb-fissa';
    const notebook = document.createElement('button');
    nav.append(menu, main, notebook);
    host.appendChild(nav);
    document.body.appendChild(host);
    const rect = (x: number, w: number) => ({ left: x, right: x + w, top: 600, bottom: 664, width: w, height: 64, x, y: 600, toJSON: () => ({}) }) as DOMRect;
    host.getBoundingClientRect = () => rect(0, 1180);
    menu.getBoundingClientRect = () => rect(420, 48);
    main.getBoundingClientRect = () => rect(489, 202);
    notebook.getBoundingClientRect = () => rect(663, 64);
    const bar = document.createElement('div');
    host.appendChild(bar);
    expect(placeOverMain(host, bar)).toBe(true);
    expect(host.classList.contains('cp-con-barra')).toBe(true);
    const left = parseFloat(bar.style.left);
    const width = parseFloat(bar.style.width);
    expect(left).toBeGreaterThanOrEqual(489);
    expect(left + width).toBeLessThanOrEqual(663);
    const css = readFileSync(resolve(ROOT, 'src/campaign/campaign.css'), 'utf8');
    expect(css).toMatch(/\.cp-con-barra \[data-test='tb-fissa'\]\s*\{[^}]*visibility:\s*hidden/);
  });
});

describe('Telaio (R2-D5, Q035)', () => {
  it('dopo il finale vero c’è la Tovaglia, nominata e mostrata, che suona la partita', async () => {
    const { s, d, audio } = setup();
    newCampaign(d, db());
    const c = camp(d);
    c.history['g01'] = { levelId: 'g01', rows: [{ hour: 7, crossings: [] }], requests: [], metrics: { incroci: 0, minIncroci: 0, quiete: 1, simmetria: false, filoDOro: false }, spartito: '', at: '' };
    const scene = new TelaioScene(s);
    scene.enter({});
    expect(document.querySelector('[data-test="cp-tovaglia"]')).toBeNull();
    scene.exit();
    d.unlocks.tovaglia = true;
    const scene2 = new TelaioScene(s);
    scene2.enter({});
    const tov = document.querySelector('[data-test="cp-tovaglia"]');
    expect(tov?.textContent).toContain('La Tovaglia');
    expect(tov?.querySelectorAll('.cp-tovaglia-merletto').length).toBe(1);
    tov?.querySelector<HTMLButtonElement>('[data-test="cp-tovaglia-ascolta"]')?.click();
    expect(audio.carillon).toHaveBeenCalled();
    scene2.exit();
  });

  it('aprendo una giornata i suoi pulsanti vengono in vista sopra il piede (Q035)', () => {
    const { s, d } = setup();
    newCampaign(d, db());
    camp(d).dayIndex = dayIndexOf(db(), 'g12');
    const spy = vi.fn();
    const orig = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = spy;
    try {
      const scene = new TelaioScene(s);
      scene.enter({});
      document.querySelector<HTMLButtonElement>('[data-test="cp-nodo-apri-g11"]')?.click();
      const acts = document.querySelector('[data-test="cp-nodo-azioni-g11"]');
      expect(acts).not.toBeNull();
      expect(spy.mock.contexts).toContain(acts);
      scene.exit();
    } finally {
      HTMLElement.prototype.scrollIntoView = orig;
    }
  });
});

describe('controller: fine della notte (R2-D5) e avvisi (Q069, Q075)', () => {
  function setupCtl(o: { autoAdvance?: boolean; scene?: string } = {}) {
    const d = emptySave();
    const bus = createBus<GameEventMap>();
    let current = o.scene ?? 'tombolo';
    const go = vi.fn(async (id: string) => {
      current = id;
    });
    const toast = vi.fn();
    const root = document.createElement('div');
    document.body.appendChild(root);
    const carillon = vi.fn(() => ({ stop: vi.fn(), done: new Promise<void>(() => undefined) }));
    const s = {
      bus,
      content: db(),
      save: { data: () => d, update: (mut: (x: SaveData) => void) => mut(d) },
      scenes: { go, current: () => current, has: () => true },
      audio: { setMusic: vi.fn(), setAmbience: vi.fn(), carillon },
      ui: { toast, root },
      i18n: { t: (k: string) => k },
      settings: { get: () => ({ animSpeed: 1, autoAdvance: !!o.autoAdvance }) },
      viewport: { get: () => ({ layout: 'stretto' }) },
    } as unknown as Services;
    const ctl = new CampaignControllerImpl(() => s);
    ctl.install();
    return { ctl, d, bus, go, toast, root, carillon, setScene: (id: string) => (current = id) };
  }

  function nightOf(d: SaveData, id: string): { o: NightOutcome; p: ReturnType<typeof startNight> } {
    newCampaign(d, db());
    camp(d).dayIndex = dayIndexOf(db(), id);
    beginEvening(d, db());
    const p = startNight(d, db());
    return { o: playNight(d), p };
  }

  it('il merletto finito resta almeno 2,5 s col carillon, poi un tocco porta all’alba', async () => {
    vi.useFakeTimers();
    const { d, bus, go, root, carillon } = setupCtl();
    const { o, p } = nightOf(d, 'g14');
    setActiveNight({ params: p, completed: o, session: { rows: o.rows, dropped: [] } } as never);
    bus.emit('night:complete', { outcome: o });
    await vi.advanceTimersByTimeAsync(1000);
    expect(carillon).toHaveBeenCalledTimes(1);
    expect(go).not.toHaveBeenCalled();
    expect(root.querySelector('[data-test="cp-notte-continua"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(LACE_HOLD_MS);
    expect(go).not.toHaveBeenCalled();
    const cont = root.querySelector<HTMLButtonElement>('[data-test="cp-notte-continua"]');
    expect(cont).not.toBeNull();
    cont?.click();
    expect(go).toHaveBeenCalledWith('alba', undefined);
  });

  it('con l’avanzamento automatico si va all’alba da soli, ma dopo 2,5 s', async () => {
    vi.useFakeTimers();
    const { d, bus, go } = setupCtl({ autoAdvance: true });
    const { o, p } = nightOf(d, 'g05');
    setActiveNight({ params: p, completed: o, session: { rows: o.rows, dropped: [] } } as never);
    bus.emit('night:complete', { outcome: o });
    await vi.advanceTimersByTimeAsync(LACE_HOLD_MS - 100);
    expect(go).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(go).toHaveBeenCalledWith('alba', undefined);
  });

  it('pastLace (debug) va subito all’alba, come il tocco su «Continua»', async () => {
    vi.useFakeTimers();
    const { ctl, d, bus, go, root } = setupCtl();
    const { o, p } = nightOf(d, 'g05');
    setActiveNight({ params: p, completed: o, session: { rows: o.rows, dropped: [] } } as never);
    expect(ctl.pastLace()).toBe(false);
    bus.emit('night:complete', { outcome: o });
    await vi.advanceTimersByTimeAsync(100);
    expect(ctl.pastLace()).toBe(true);
    expect(go).toHaveBeenCalledWith('alba', undefined);
    await vi.advanceTimersByTimeAsync(LACE_HOLD_MS);
    expect(root.querySelector('[data-test="cp-notte-continua"]')).toBeNull();
    expect(go).toHaveBeenCalledTimes(1);
  });

  it('l’alba prende il carillon che suona: non ricomincia da capo', async () => {
    vi.useFakeTimers();
    const { ctl, d, bus, carillon } = setupCtl();
    const { o, p } = nightOf(d, 'g05');
    setActiveNight({ params: p, completed: o, session: { rows: o.rows, dropped: [] } } as never);
    bus.emit('night:complete', { outcome: o });
    await vi.advanceTimersByTimeAsync(1000);
    const playing = carillon.mock.results[0]?.value;
    expect(ctl.adoptLaceCarillon('g05')).toBe(playing);
    expect(ctl.adoptLaceCarillon('g05')).toBeNull();
  });

  it('una stranezza scoperta di notte (anche da un rifiuto) non fa un avviso sopra il merletto (Q069, Q075)', async () => {
    vi.useFakeTimers();
    const { d, bus, toast } = setupCtl();
    const { p } = nightOf(d, 'g01');
    setActiveNight({ params: p, completed: null, session: { rows: [], dropped: [], done: false } } as never);
    bus.emit('quirk:discovered', { quirk: 'ginoCorre', thread: 'gino' });
    await vi.advanceTimersByTimeAsync(10);
    expect(d.knowledge.quirks).toContain('ginoCorre');
    expect(toast).not.toHaveBeenCalled();
  });
});
