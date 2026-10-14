// @vitest-environment happy-dom
/**
 * Interfaccia della campagna nel DOM (happy-dom): Taccuino fisso nel layout largo e
 * overlay chiuso con Indietro nello stretto; schede visibili e pista; vignette che
 * avanzano, saltano e usano Ada grezza; bigliettini anonimi a matita.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameEventMap, SaveData, Services, Settings, Viewport } from '../../../src/core/types';
import { createUiLayer } from '../../../src/core/ui/layer';
import { createInput } from '../../../src/core/input';
import { createBus } from '../../../src/core/events';
import { defaultSettings } from '../../../src/core/settings';
import { createI18n, loadI18nSources } from '../../../src/core/i18n';
import { installServices } from '../../../src/core/services';
import { SideNotebook } from '../../../src/campaign/frame';
import { bigliettiniPanel, taccuinoPanel, visibleTabs } from '../../../src/campaign/taccuino/panel';
import { VignettePlayer, figureFrame, needsTint } from '../../../src/campaign/vignette';
import { notePaper } from '../../../src/campaign/notes';
import { newCampaign, startNight, completeDay, finishDawn, finishBilancio, markObjectSeen } from '../../../src/campaign/flow';
import { pinNote } from '../../../src/campaign/evening';
import { refreshDiary } from '../../../src/campaign/diary';
import type { CampaignStateX, VignetteView } from '../../../src/campaign/types';
import { db, emptySave, playNight } from './helpers';

function setup(layout: Viewport['layout']) {
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
  const save = {
    data: () => d,
    update: (mut: (x: SaveData) => void) => mut(d),
    load: async () => d,
    flush: async () => undefined,
    exportString: () => '',
    importString: () => ({ ok: true }),
    wipe: async () => undefined,
  };
  const vp: Viewport = { cssW: layout === 'largo' ? 1280 : 390, cssH: layout === 'largo' ? 720 : 844, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 }, orientation: layout === 'largo' ? 'landscape' : 'portrait', layout, textScale: 1 };
  const audio = { babble: vi.fn(() => ({ stop: vi.fn(), done: Promise.resolve() })), sfx: vi.fn(), carillon: vi.fn(), setMusic: vi.fn(), setAmbience: vi.fn() };
  const assets = {
    frame: (name: string) => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 256, sh: 256, ax: 0.5, ay: 0.92, placeholder: true, name }),
    image: () => document.createElement('canvas'),
    load: async () => undefined,
    has: () => false,
    missing: () => [],
  };
  installServices({
    i18n,
    bus,
    ui,
    input,
    save: save as unknown as Services['save'],
    content: db(),
    settings: store,
    viewport: { get: () => vp },
    audio: audio as unknown as Services['audio'],
    assets: assets as unknown as Services['assets'],
    scenes: { current: () => 'sera', go: async () => undefined, has: () => true, register: () => undefined } as unknown as Services['scenes'],
  });
  const s = { i18n, bus, ui, input, save, content: db(), settings: store, viewport: { get: () => vp }, audio, assets, scenes: { current: () => 'sera' } } as unknown as Services;
  ui.registerPanel('taccuino', (container, opts) => taccuinoPanel(s, container, opts));
  return { s, ui, input, d, audio, store };
}

/** Una storia arrivata alla sera di g01. */
function toFirstEvening(d: SaveData): void {
  newCampaign(d, db());
  startNight(d, db());
  completeDay(d, db(), playNight(d));
  finishDawn(d);
  finishBilancio(d, db());
}

describe('Taccuino', () => {
  beforeEach(() => vi.useRealTimers());

  it('layout largo: montato fisso, nessun overlay', () => {
    const { s, ui, d } = setup('largo');
    toFirstEvening(d);
    const scene = document.createElement('div');
    document.body.appendChild(scene);
    const side = new SideNotebook(s, { from: 'sera' });
    scene.appendChild(side.column);
    side.sync();
    expect(side.column.hidden).toBe(false);
    expect(side.column.querySelector('[data-test="cp-taccuino"]')).not.toBeNull();
    side.open();
    expect(ui.overlays()).toEqual([]);
  });

  it('layout stretto: overlay che si chiude con Indietro', async () => {
    const { s, ui, input, d } = setup('stretto');
    toFirstEvening(d);
    const scene = document.createElement('div');
    document.body.appendChild(scene);
    const side = new SideNotebook(s, { from: 'sera' });
    scene.appendChild(side.column);
    side.sync();
    expect(side.column.hidden).toBe(true);
    side.open();
    expect(ui.overlays()).toEqual(['taccuino']);
    expect(document.querySelector('[data-overlay="taccuino"] [data-test="cp-taccuino"]')).not.toBeNull();
    input.simulate.action('back');
    await Promise.resolve();
    expect(ui.overlays()).toEqual([]);
  });

  it('schede visibili secondo GDD 7 e pista nelle Domande', () => {
    const { s, d } = setup('stretto');
    newCampaign(d, db());
    const c0 = d.campaign as CampaignStateX;
    expect(visibleTabs(s, c0, d.knowledge, {})).toEqual(['persone', 'libro', 'domande']);
    startNight(d, db());
    completeDay(d, db(), playNight(d));
    finishDawn(d);
    finishBilancio(d, db());
    const c1 = d.campaign as CampaignStateX;
    expect(visibleTabs(s, c1, d.knowledge, {})).toEqual(['bigliettini', 'persone', 'libro', 'domande']);
    // L'ultimo merletto della nonna letto: la domanda sull'avorio e la sua pista (C03).
    markObjectSeen(d, db());
    d.knowledge.archive.arc1 = 'nuovo';
    // La scheda Lettere c'è dalla prima lettera ricevuta (D10).
    d.knowledge.letters.push('lettera_L1');
    expect(visibleTabs(s, c1, d.knowledge, {})).toEqual(['bigliettini', 'persone', 'libro', 'domande', 'lettere', 'archivio']);
    const box = document.createElement('div');
    const h = taccuinoPanel(s, box, { tab: 'domande' });
    expect(box.querySelector('[data-test="cp-pista"]')).not.toBeNull();
    expect(box.querySelector('[data-test="cp-domanda-avorio"]')).not.toBeNull();
    (box.querySelector('[data-test="cp-taccuino-scheda-libro"]') as HTMLElement).click();
    expect(box.querySelector('[data-test="cp-pagina-incrocio"]')).not.toBeNull();
    (box.querySelector('[data-test="cp-taccuino-scheda-bigliettini"]') as HTMLElement).click();
    expect(box.querySelectorAll('[data-note]').length).toBe(3);
    h.destroy();
  });
});

describe('vignette', () => {
  const views: VignetteView[] = [
    { id: 'a', priority: 100, background: 'dio/forno/alba', figures: [{ character: 'marta', pose: 'porge', x: 0.5 }], lines: [{ speaker: 'marta', textKey: 'atto1.g00.alba.marta' }] },
    {
      id: 'b',
      priority: 100,
      background: 'dio/chiesa/alba',
      figures: [{ character: 'teresa', pose: 'porge', x: 0.35 }],
      lines: [
        { speaker: 'teresa', textKey: 'atto1.g00.alba.teresa' },
        { speaker: 'narratore', textKey: 'atto1.g00.alba.piero' },
      ],
    },
  ];

  it('tocco e Invio avanzano, il borbottio accompagna chi parla, alla fine onDone', () => {
    const { s, audio } = setup('stretto');
    const done = vi.fn();
    const p = new VignettePlayer(s, { vignettes: views, onDone: done });
    document.body.appendChild(p.el);
    p.start();
    expect(p.position()).toMatchObject({ vignette: 0, line: 0, id: 'a' });
    expect(audio.babble).toHaveBeenCalledTimes(1);
    expect(p.el.querySelector('[data-test="cp-vignetta-chi"]')?.textContent).toContain('Marta');
    p.el.click();
    expect(p.position()).toMatchObject({ vignette: 1, line: 0 });
    p.onAction({ action: 'confirm', repeat: false, source: 'keyboard' });
    expect(p.position()).toMatchObject({ vignette: 1, line: 1 });
    expect(p.el.querySelector('[data-test="cp-vignetta-chi"]')).toBeNull();
    expect(audio.babble).toHaveBeenCalledTimes(2);
    p.next();
    expect(done).toHaveBeenCalledOnce();
    p.destroy();
  });

  it('S salta tutto; A attiva l’avanzamento automatico', async () => {
    vi.useFakeTimers();
    const { s } = setup('stretto');
    const done = vi.fn();
    const p = new VignettePlayer(s, { vignettes: views, onDone: done });
    p.start();
    expect(p.onAction({ action: 'auto', repeat: false, source: 'keyboard' })).toBe(true);
    await vi.advanceTimersByTimeAsync(4000);
    expect(p.position().vignette).toBe(1);
    expect(done).not.toHaveBeenCalled();
    p.onAction({ action: 'skip', repeat: false, source: 'keyboard' });
    expect(done).toHaveBeenCalledOnce();
    p.destroy();
    vi.useRealTimers();
  });

  it('in automatico aspetta che il borbottio finisca, ma non oltre 8 s per vignetta', async () => {
    vi.useFakeTimers();
    const { s, audio } = setup('stretto');
    let finish: () => void = () => undefined;
    audio.babble.mockImplementation(() => ({ stop: vi.fn(), done: new Promise<void>((r) => (finish = r)) }));
    const done = vi.fn();
    const p = new VignettePlayer(s, { vignettes: views, onDone: done });
    p.start();
    p.toggleAuto();
    vi.advanceTimersByTime(4100);
    expect(p.position()).toMatchObject({ vignette: 0, line: 0 });
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(p.position()).toMatchObject({ vignette: 1, line: 0 });
    // La voce di Teresa non finisce mai: si passa comunque entro la sua parte di 8 s.
    vi.advanceTimersByTime(4000);
    expect(p.position()).toMatchObject({ vignette: 1, line: 1 });
    p.destroy();
    vi.useRealTimers();
  });

  it('figurine: Ada grezza e figura anonima per chi non ne ha una', () => {
    expect(figureFrame('ada', 'ferma', true)).toBe('fig/ada/ferma_grezza');
    expect(figureFrame('ada', 'ferma', false)).toBe('fig/ada/ferma');
    expect(figureFrame('clotilde', 'saluta', false)).toBe('fig/lino/saluta');
    expect(figureFrame('ernesto', 'porge', false)).toBe('fig/lino/porge');
    // La figura anonima si tinge del colore di chi non ha una figurina propria.
    expect(needsTint('clotilde')).toBe(true);
    expect(needsTint('ernesto')).toBe(true);
    expect(needsTint('marta')).toBe(false);
    expect(needsTint('ada')).toBe(false);
  });
});

describe('bigliettini', () => {
  it('anonimo: «Alla merlettaia», a matita, senza il nome dell’autore', () => {
    const { s, d } = setup('stretto');
    newCampaign(d, db());
    const c = d.campaign as CampaignStateX;
    c.memoria = { marta: 0 };
    const note = db().notes.get('g13.marta');
    if (!note) throw new Error('g13.marta');
    const anon = notePaper(s, note, c);
    expect(anon.dataset.anonimo).toBe('1');
    expect(anon.textContent).toContain('Alla merlettaia');
    expect(anon.querySelector('[data-character="marta"]')).toBeNull();
    c.memoria = { marta: 2 };
    const signed = notePaper(s, note, c);
    expect(signed.dataset.anonimo).toBeUndefined();
    expect(signed.querySelector('[data-character="marta"]')).not.toBeNull();
  });
});

describe('verifica: pannelli durante la notte e voci lette', () => {
  it('Bigliettini all’inizio della notte (prima che il tombolo la renda attiva): le richieste appuntate, in corso', () => {
    const { s, d } = setup('largo');
    toFirstEvening(d);
    const c = d.campaign as CampaignStateX;
    expect(pinNote(c, db(), 'g01.marta')).toBeNull();
    expect(pinNote(c, db(), 'g01.piero')).toBeNull();
    startNight(d, db());
    const box = document.createElement('div');
    document.body.appendChild(box);
    const h = bigliettiniPanel(s, box, { from: 'tombolo', origin: 'campagna', levelId: 'g01', accepted: ['g01.marta', 'g01.piero'] });
    expect(box.textContent).not.toContain('Nessuna richiesta stanotte');
    expect(box.querySelector('[data-test="cp-richiesta-g01.marta"]')).not.toBeNull();
    expect(box.querySelector('[data-test="cp-richiesta-g01.piero"] [data-stato="in_corso"]')).not.toBeNull();
    // Quando la scena del tombolo è entrata, il pannello si ridisegna.
    s.bus.emit('scene:enter', { id: 'tombolo' });
    expect(box.querySelectorAll('[data-test^="cp-richiesta-"]').length).toBe(2);
    // Una notte del Telaio non mostra le richieste della sera della campagna.
    const other = document.createElement('div');
    const h2 = bigliettiniPanel(s, other, { from: 'tombolo', origin: 'telaio', levelId: 'g01', accepted: [] });
    expect(other.querySelector('[data-test^="cp-richiesta-"]')).toBeNull();
    h.destroy();
    h2.destroy();
  });

  it('Taccuino fisso (layout largo): le voci nuove diventano lette quando la scena lo smonta; l’overlay quando si apre', () => {
    const { s, d } = setup('largo');
    toFirstEvening(d);
    const c = d.campaign as CampaignStateX;
    c.diarySeen = 0;
    const total = d.knowledge.diary.length;
    expect(total).toBeGreaterThan(3);
    const box = document.createElement('div');
    const h = taccuinoPanel(s, box, { fixed: true, tab: 'persone' });
    expect(c.diarySeen).toBe(0);
    expect(box.querySelectorAll('.cp-voce--nuova').length).toBeGreaterThan(0);
    h.destroy();
    expect((d.campaign as CampaignStateX).diarySeen).toBe(total);
    const again = document.createElement('div');
    const h2 = taccuinoPanel(s, again, { fixed: true, tab: 'persone' });
    expect(again.querySelectorAll('.cp-voce--nuova').length).toBe(0);
    expect(again.querySelectorAll('.cp-voce--letta').length).toBeGreaterThan(0);
    h2.destroy();
    // L'overlay segna lette le voci appena si apre (e le mostra ancora come nuove).
    (d.campaign as CampaignStateX).diarySeen = 0;
    const ov = document.createElement('div');
    const h3 = taccuinoPanel(s, ov, { tab: 'persone' });
    expect(ov.querySelectorAll('.cp-voce--nuova').length).toBeGreaterThan(0);
    expect((d.campaign as CampaignStateX).diarySeen).toBe(total);
    h3.destroy();
  });

  it('Persone: una stranezza si scrive per esteso solo quando i contenuti l’hanno spiegata', () => {
    const { s, d } = setup('stretto');
    newCampaign(d, db());
    const c = d.campaign as CampaignStateX;
    // Prologo: Teresa «si è accesa» (teresaLegge scoperta), ma che legga si capisce dopo g05.
    d.knowledge.quirks.push('teresaLegge', 'martaNoSotto');
    refreshDiary(c, d.knowledge, db());
    expect(d.knowledge.diary).toContain('persone.teresa.luce');
    expect(d.knowledge.diary).not.toContain('persone.teresa.legge');
    const box = document.createElement('div');
    const h = taccuinoPanel(s, box, { tab: 'persone' });
    expect(box.querySelector('[data-test="cp-stranezza-teresaLegge"]')).toBeNull();
    expect(box.querySelector('[data-test="cp-stranezza-martaNoSotto"]')).not.toBeNull();
    h.destroy();
    d.knowledge.diary.push('persone.teresa.legge');
    const box2 = document.createElement('div');
    const h2 = taccuinoPanel(s, box2, { tab: 'persone' });
    expect(box2.querySelector('[data-test="cp-stranezza-teresaLegge"]')).not.toBeNull();
    h2.destroy();
  });
});
