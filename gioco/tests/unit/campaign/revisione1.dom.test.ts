// @vitest-environment happy-dom
/**
 * Revisione 1 della campagna nel DOM (happy-dom):
 * - CAM-02: pulsanti fuori dal foglio, foglio che scorre, «Appunta · restano N spilli»,
 *   spilli finiti con il collegamento; scheda Lettere dalla prima lettera;
 * - CAM-03: frase d'arrivo alla porta; consegna dell'oggetto all'alba (`cp-alba-oggetto`)
 *   e voci annunciate alla lettura;
 * - CAM-06: pagina nuova del Libro nella notte, piste sopra le risposte, frase di chiusura
 *   dopo la scelta;
 * - CAM-07: «Si compie se fissi l'ora» con l'anteprima (C07);
 * - CAM-08: biglietto di Clotilde piegato dopo il merletto chiuso;
 * - CAM-11: inchiostro del nome di Lunardi ≥ 4,5:1 sulla carta.
 */
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
import { bigliettiniPanel, taccuinoPanel, visibleTabs } from '../../../src/campaign/taccuino/panel';
import { noteDetailPanel, objectPanel } from '../../../src/campaign/notes';
import { charChip } from '../../../src/campaign/ui';
import { AlbaScene } from '../../../src/campaign/AlbaScene';
import { beginChoice, beginEvening, camp, completeDay, newCampaign, startNight } from '../../../src/campaign/flow';
import { dayIndexOf, pinNote } from '../../../src/campaign/evening';
import type { CampaignStateX } from '../../../src/campaign/types';
import { db, emptySave, playNight } from './helpers';

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
  ui.registerPanel('cp-nota', (container, opts) => noteDetailPanel(s, container, opts));
  ui.registerPanel('cp-oggetto', (container) => objectPanel(s, container));
  return { s, ui, d, go, setScene: (id: string) => (current = id) };
}

/** Una sera presa direttamente. */
function eveningAt(d: SaveData, id: string): CampaignStateX {
  newCampaign(d, db());
  camp(d).dayIndex = dayIndexOf(db(), id);
  beginEvening(d, db());
  return camp(d);
}

afterEach(() => setActiveNight(null));

describe('CAM-02: il foglio giusto', () => {
  it('pulsanti fuori dal foglio, foglio che scorre, «Appunta · restano 2 spilli»', () => {
    const { s, d } = setup();
    eveningAt(d, 'g04');
    const box = document.createElement('div');
    document.body.appendChild(box);
    const h = noteDetailPanel(s, box, { noteId: 'g04.bepi' });
    const paper = box.querySelector('[data-test="cp-nota-carta-g04.bepi"]');
    expect(paper?.classList.contains('core-carta--scorre')).toBe(true);
    expect(box.querySelectorAll('.core-carta button').length).toBe(0);
    const appunta = box.querySelector<HTMLButtonElement>('[data-test="cp-appunta"]');
    expect(appunta?.textContent).toContain('Appunta · restano 2 spilli');
    expect(appunta?.closest('.core-carta')).toBeNull();
    expect(box.querySelector('[data-test="cp-lascia"]')?.closest('.core-carta')).toBeNull();
    h.destroy();
  });

  it('spilli finiti: lo spillo di un altro bigliettino si sposta qui in un passo (Q007)', () => {
    const { s, d } = setup();
    const c = eveningAt(d, 'g04');
    const [a, b, third] = c.evening?.noteIds ?? [];
    expect(pinNote(c, db(), a!)).toBeNull();
    expect(pinNote(c, db(), b!)).toBeNull();
    const box = document.createElement('div');
    document.body.appendChild(box);
    const h = noteDetailPanel(s, box, { noteId: third });
    expect(box.querySelector<HTMLButtonElement>('[data-test="cp-appunta"]')?.disabled).toBe(true);
    expect(box.querySelector('[data-test="cp-appunta"]')?.textContent).toContain('nessuno spillo');
    expect(box.querySelector('[data-test="cp-spilli-finiti"]')).not.toBeNull();
    const link = box.querySelector<HTMLButtonElement>(`[data-test="cp-vai-${a}"]`);
    expect(link?.textContent).not.toContain('[[');
    expect(link?.textContent).toContain('Sposta qui lo spillo di');
    link?.click();
    const after = (d.campaign as typeof c).evening?.accepted.map((x) => x.noteId) ?? [];
    expect(after).toContain(third);
    expect(after).toContain(b);
    expect(after).not.toContain(a);
    h.destroy();
  });

  it('la scheda Lettere c’è dalla prima lettera ricevuta', () => {
    const { s, d } = setup();
    const c = eveningAt(d, 'g02');
    expect(visibleTabs(s, c, d.knowledge, {})).not.toContain('lettere');
    d.knowledge.letters.push('lettera_L1');
    expect(visibleTabs(s, c, d.knowledge, {})).toContain('lettere');
  });
});

describe('CAM-03: la porta e l’alba', () => {
  it('la porta dice da dove arriva l’oggetto; alla lettura le voci nuove si annunciano lì', () => {
    const { s, d } = setup();
    eveningAt(d, 'g01');
    const box = document.createElement('div');
    document.body.appendChild(box);
    objectPanel(s, box);
    expect(box.querySelector('[data-test="cp-oggetto-arrivo"]')?.textContent).toBe('Sul tombolo ti aspetta ancora qualcosa della nonna.');
    (box.querySelector('[data-test="cp-oggetto-continua"]') as HTMLButtonElement).click();
    expect(camp(d).evening?.objectSeen).toBe(true);
    expect(d.knowledge.objects).toContain('merletto_avorio');
    const voci = box.querySelectorAll('[data-test^="cp-lettura-voce-"]').length;
    expect(voci).toBe((camp(d).diaryAnnounced ?? []).length);
  });

  it('g14: dopo le vignette la consegna di Zeno, la lettera, poi il bilancio', async () => {
    const { s, d, go, setScene } = setup();
    eveningAt(d, 'g14');
    camp(d).evening!.accepted = [{ noteId: 'g14.zeno' }];
    startNight(d, db());
    completeDay(d, db(), playNight(d));
    setScene('alba');
    const scene = new AlbaScene(s);
    scene.enter();
    expect(document.querySelector('[data-test="cp-alba-oggetto"]')).toBeNull();
    scene.skip();
    const sheet = document.querySelector('[data-test="cp-alba-oggetto"]');
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toContain('Prima di andare via');
    expect(sheet?.querySelector('[data-test="cp-lettera-lettera_clotilde"]')).not.toBeNull();
    expect(d.knowledge.letters).not.toContain('lettera_clotilde');
    (document.querySelector('[data-test="cp-alba-oggetto-continua"]') as HTMLButtonElement).click();
    expect(d.knowledge.letters).toContain('lettera_clotilde');
    if (document.querySelector('[data-test="cp-lettura-voci"]')) (document.querySelector('[data-test="cp-alba-oggetto-continua"]') as HTMLButtonElement).click();
    expect(camp(d).phase).toBe('bilancio');
    expect(go).toHaveBeenCalledWith('bilancio', undefined);
    scene.exit();
  });
});

describe('CAM-06: Taccuino', () => {
  it('nella notte di g09 il Libro si apre su «La febbre», segnata Nuova', () => {
    const { s, d } = setup();
    eveningAt(d, 'g09');
    d.knowledge.objects.push('libro_punti');
    const p = startNight(d, db());
    setActiveNight({ params: p, session: { requestStatus: () => [], dropped: [], goalStatus: () => [] }, completed: null } as never);
    const box = document.createElement('div');
    const h = taccuinoPanel(s, box, { from: 'tombolo', origin: 'campagna', levelId: 'g09' });
    expect(box.querySelector('[data-test="cp-taccuino-libro"]')).not.toBeNull();
    expect(box.querySelector('[data-test="cp-pagina-febbre"] [data-test="cp-taccuino-libro-nuova"]')).not.toBeNull();
    expect(box.querySelector('[data-test="cp-pagina-febbre"].cp-pagina--evidenziata')).not.toBeNull();
    h.destroy();
    expect(d.knowledge.bookSeen).toContain('febbre');
    // La seconda apertura nella stessa notte non torna sul Libro.
    const box2 = document.createElement('div');
    const h2 = taccuinoPanel(s, box2, { from: 'tombolo', origin: 'campagna', levelId: 'g09', tab: 'persone' });
    expect(box2.querySelector('[data-test="cp-taccuino-libro-nuova"]')).toBeNull();
    h2.destroy();
  });

  it('le piste stanno sopra la risposta e spariscono a domanda risolta; dopo la scelta una frase di chiusura', () => {
    const { s, d } = setup();
    newCampaign(d, db());
    const pista = [...db().diary.values()].find((e) => e.pista && e.section === 'domande' && (e.opens?.length ?? 0) > 0);
    if (!pista) throw new Error('pista');
    const q = pista.opens![0]!;
    const answer = [...db().diary.values()].find((e) => e.section === 'domande' && !e.pista && (e.closes ?? []).includes(q));
    d.knowledge.diary.push(pista.id);
    d.knowledge.questions[q] = 'aperta';
    if (answer) d.knowledge.diary.push(answer.id);
    const box = document.createElement('div');
    const h = taccuinoPanel(s, box, { tab: 'domande' });
    const sec = box.querySelector(`[data-test="cp-domanda-${q}"]`);
    const voci = [...(sec?.querySelectorAll('[data-test^="cp-voce-"]') ?? [])].map((x) => x.getAttribute('data-test'));
    expect(voci[0]).toBe(`cp-voce-${pista.id}`);
    h.destroy();
    d.knowledge.questions[q] = 'risolta';
    const box2 = document.createElement('div');
    const h2 = taccuinoPanel(s, box2, { tab: 'domande' });
    expect(box2.querySelector(`[data-test="cp-voce-${pista.id}"]`)).toBeNull();
    h2.destroy();
    camp(d).phase = 'fine';
    const box3 = document.createElement('div');
    const h3 = taccuinoPanel(s, box3, { tab: 'domande' });
    expect(box3.querySelector('[data-test="cp-pista"]')).toBeNull();
    expect(box3.querySelector('[data-test="cp-pista-finita"]')?.textContent).toContain('Non resta niente da cercare');
    h3.destroy();
  });
});

describe('CAM-07: pannello dei bigliettini durante la notte', () => {
  it('«Si compie se fissi l’ora» quando la sola bozza la compirebbe (C07)', () => {
    const { s, d } = setup('largo');
    const c = eveningAt(d, 'g01');
    expect(pinNote(c, db(), 'g01.marta')).toBeNull();
    const p = startNight(d, db());
    setActiveNight({
      params: p,
      completed: null,
      drop: vi.fn(),
      session: {
        dropped: [],
        goalStatus: () => [],
        requestStatus: () => [{ noteId: 'g01.marta', report: { status: 'in_corso' } }],
        requestStatusFull: () => [{ noteId: 'g01.marta', report: { status: 'in_corso' }, anteprima: 'soddisfatta', dropped: false }],
      },
    } as never);
    s.scenes.current = () => 'tombolo';
    const box = document.createElement('div');
    const h = bigliettiniPanel(s, box, { from: 'tombolo', origin: 'campagna', levelId: 'g01' });
    const st = box.querySelector('[data-test="cp-richiesta-g01.marta"] [data-stato]');
    expect(st?.getAttribute('data-stato')).toBe('inArrivo');
    expect(st?.textContent).toContain("Si compie se fissi l'ora");
    h.destroy();
  });
});

describe('CAM-08: il biglietto di Clotilde piegato', () => {
  it('dopo il merletto chiuso non si riappunta e rimanda al punto di Clotilde', () => {
    const { s, d } = setup();
    newCampaign(d, db());
    const c = camp(d);
    c.dayIndex = dayIndexOf(db(), 'g23');
    beginChoice(d, db(), true);
    c.history['fin_chiuso'] = { levelId: 'fin_chiuso', rows: [], requests: [], metrics: { incroci: 0, minIncroci: null, quiete: 0, simmetria: false, filoDOro: false }, spartito: '', at: '' };
    d.knowledge.diary.push('domande.chiuso.punto');
    const note = [...db().notes.values()].find((n) => n.ending === 'chiuso');
    if (!note) throw new Error('chiuso');
    const box = document.createElement('div');
    const h = noteDetailPanel(s, box, { noteId: note.id });
    expect(box.querySelector('[data-test="cp-nota-piegata"]')).not.toBeNull();
    expect(box.querySelector<HTMLButtonElement>('[data-test="cp-scegli"]')?.disabled).toBe(true);
    expect(box.querySelector('[data-test="cp-nota-punto"]')).not.toBeNull();
    h.destroy();
  });
});

describe('CAM-11: inchiostro dei nomi', () => {
  it('il nome di Lunardi sulla carta ha contrasto ≥ 4,5:1', () => {
    const { s } = setup();
    const chip = charChip(s, 'lunardi');
    const ink = chip.style.getPropertyValue('--pers-ink');
    expect(ink).toMatch(/^#[0-9A-F]{6}$/i);
    expect(contrastRatio(ink, '#EDE4D3')).toBeGreaterThanOrEqual(4.5);
    // Il colore pieno resta nella sottolineatura e nell'icona.
    expect(chip.style.getPropertyValue('--pers-color').toUpperCase()).toBe(db().characters.get('lunardi')?.color.toUpperCase());
  });
});
