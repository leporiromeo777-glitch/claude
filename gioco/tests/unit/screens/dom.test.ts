// @vitest-environment happy-dom
/**
 * Schermate nel DOM: voci e lucchetti del titolo, impostazioni applicate e
 * salvate subito, menu Pausa, scelta a segmenti da tastiera, import dello
 * spartito con l'errore spiegato, foglio dei risultati e carillon del merletto.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { LevelDef, NightOutcome, SaveData } from '../../../src/core/types';
import { createContext, dailySpec, generate, metrics, simulate, solve } from '../../../src/engine/index';
import { defaultSaveData } from '../../../src/core/save/defaults';
import { isFirstLaunch, titleItems } from '../../../src/screens/titleMenu';
import { buildSettingsPanel } from '../../../src/screens/settingsPanel';
import { pausePanel } from '../../../src/screens/pausePanel';
import { spartitoPanel } from '../../../src/screens/spartitoPanel';
import { segmented } from '../../../src/screens/widgets';
import { carillonScore, resultsSheet } from '../../../src/screens/results';
import { resetScreensState, type ResultInfo } from '../../../src/screens/state';
import { makeServices } from './helpers';

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, test: string): T | null => root.querySelector<T>(`[data-test="${test}"]`);

function save(p: Partial<SaveData> = {}): SaveData {
  return { ...defaultSaveData('t'), ...p };
}

describe('menu del titolo', () => {
  const ctx = { hasTelaio: false, fullGame: true, dailyDoneToday: false };

  it('primo avvio: una scritta sola per cominciare, modalità con il lucchetto', () => {
    const d = save();
    expect(isFirstLaunch(d)).toBe(true);
    const items = titleItems(d, ctx);
    expect(items.map((i) => i.id)).toEqual(['nuova', 'giornaliero', 'libero', 'impostazioni', 'crediti']);
    expect(items[0]).toMatchObject({ labelKey: 'ui.titolo.inizia', primary: true });
    expect(items.find((i) => i.id === 'giornaliero')).toMatchObject({ locked: true, subKey: 'ui.titolo.lucchetto.giornaliero' });
    expect(items.find((i) => i.id === 'libero')).toMatchObject({ locked: true, subKey: 'ui.titolo.lucchetto.libero' });
  });

  it('con una storia: Continua è la voce principale; Telaio solo se la scena esiste', () => {
    const d = save({ campaign: { history: { g00: {} } } as unknown as SaveData['campaign'], stats: { playMs: 1, nights: 1, goldThreads: 0, dailyStreak: 0 } });
    expect(isFirstLaunch(d)).toBe(false);
    const items = titleItems(d, { ...ctx, hasTelaio: true });
    expect(items.map((i) => i.id)).toEqual(['continua', 'nuova', 'giornaliero', 'libero', 'telaio', 'impostazioni', 'crediti']);
    expect(items[0]).toMatchObject({ primary: true });
    expect(items[1]).toMatchObject({ labelKey: 'ui.titolo.nuova', primary: false });
    expect(items.find((i) => i.id === 'telaio')?.locked).toBe(false);
    expect(titleItems(d, ctx).some((i) => i.id === 'telaio')).toBe(false);
  });

  it('lucchetti secondo save.unlocks e la versione completa', () => {
    const d = save({ unlocks: { daily: true, libero: true, gradi: false, cosmetics: [], tovaglia: false } });
    const items = titleItems(d, { ...ctx, dailyDoneToday: true });
    expect(items.find((i) => i.id === 'giornaliero')).toMatchObject({ locked: false, subKey: 'ui.titolo.giornalieroFatto' });
    expect(items.find((i) => i.id === 'libero')?.locked).toBe(false);
    const trial = titleItems(d, { ...ctx, fullGame: false });
    expect(trial.find((i) => i.id === 'libero')).toMatchObject({ locked: true, subKey: 'ui.titolo.lucchetto.completo' });
    expect(trial.find((i) => i.id === 'giornaliero')?.locked).toBe(false);
  });
});

describe('impostazioni', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute('data-contrast');
  });

  it('ogni impostazione si applica subito e si salva', async () => {
    const h = makeServices();
    const panel = buildSettingsPanel(h.s, { overlay: false });
    document.body.appendChild(panel.el);
    const before = (h.s.save as unknown as { writes(): number }).writes();
    // Alto contrasto (interruttore).
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-contrasto')?.click();
    expect(h.s.settings.get().highContrast).toBe(true);
    // Movimento ridotto, vibrazione, didascalie, avanzamento automatico.
    for (const k of ['movimento', 'haptics', 'captions', 'autoAdvance']) q<HTMLButtonElement>(panel.el, `sc-impostazioni-${k}`)?.click();
    const st = h.s.settings.get();
    expect(st.reducedMotion).toBe(true);
    expect(st.haptics).toBe(false);
    expect(st.captions).toBe(true);
    expect(st.autoAdvance).toBe(true);
    // Velocità delle animazioni (segmenti) e lingua.
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-velocita-0')?.click();
    expect(h.s.settings.get().animSpeed).toBe(0);
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-lingua-en')?.click();
    expect(h.s.settings.get().locale).toBe('en');
    expect(h.s.i18n.locale()).toBe('en');
    // Cursori: volume e dimensione del testo.
    const vol = q<HTMLInputElement>(panel.el, 'sc-impostazioni-volume-music');
    if (!vol) throw new Error('slider missing');
    vol.value = '25';
    vol.dispatchEvent(new Event('input'));
    vol.dispatchEvent(new Event('change'));
    expect(h.s.settings.get().volume.music).toBeCloseTo(0.25);
    const ts = q<HTMLInputElement>(panel.el, 'sc-impostazioni-testo');
    if (!ts) throw new Error('slider missing');
    ts.value = '140';
    ts.dispatchEvent(new Event('input'));
    ts.dispatchEvent(new Event('change'));
    expect(h.s.settings.get().textScale).toBe(1.4);
    await h.s.save.flush();
    await tick(10);
    expect((h.s.save as unknown as { writes(): number }).writes()).toBeGreaterThan(before);
    // I controlli seguono un cambio fatto altrove.
    h.s.settings.set({ highContrast: false });
    expect(q(panel.el, 'sc-impostazioni-contrasto')?.getAttribute('aria-checked')).toBe('false');
    panel.destroy();
  });

  it('esporta e importa (con conferma) un salvataggio identico', async () => {
    const h = makeServices();
    h.s.save.update((d) => {
      d.unlocks.daily = true;
      d.records['day-2026-10-14'] = { minIncroci: 8, maxQuiete: 2, simmetria: true, filoDOro: true };
    });
    await h.s.save.flush();
    const panel = buildSettingsPanel(h.s, { overlay: false });
    document.body.appendChild(panel.el);
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-esporta')?.click();
    await tick(5);
    const exported = q<HTMLTextAreaElement>(panel.el, 'sc-impostazioni-esporta-testo')?.value ?? '';
    expect(exported.startsWith('TRAMA-SAVE-1:')).toBe(true);
    expect(h.calls.copied).toContain(exported);
    const snapshot = JSON.parse(JSON.stringify(h.s.save.data())) as SaveData;
    // Cambia qualcosa, poi importa quello esportato.
    h.s.save.update((d) => {
      d.unlocks.daily = false;
      d.records = {};
    });
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-importa')?.click();
    const field = q<HTMLTextAreaElement>(panel.el, 'sc-impostazioni-importa-testo');
    if (!field) throw new Error('import field missing');
    field.value = exported;
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-importa-ok')?.click();
    await tick(20);
    expect(h.confirmAnswer.asked).toContain('ui.impostazioni.importaDomanda.titolo');
    const after = JSON.parse(JSON.stringify(h.s.save.data())) as SaveData;
    expect({ ...after, writtenAt: '' }).toEqual({ ...snapshot, writtenAt: '' });
    // Testo non valido: errore spiegato, niente cambia.
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-importa')?.click();
    field.value = 'TRAMA-SAVE-1:xxxx';
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-importa-ok')?.click();
    await tick(20);
    expect(q(panel.el, 'sc-impostazioni-messaggio')?.textContent).toBe(h.s.i18n.t('core.save.import.formato'));
    panel.destroy();
  });

  it('cancella tutto chiede due volte', async () => {
    const h = makeServices();
    let wiped = 0;
    h.s.save.update((d) => {
      d.unlocks.daily = true;
    });
    const panel = buildSettingsPanel(h.s, { overlay: false, onWiped: () => wiped++ });
    document.body.appendChild(panel.el);
    h.confirmAnswer.value = false;
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-cancella')?.click();
    await tick(10);
    expect(h.confirmAnswer.asked).toEqual(['ui.impostazioni.cancellaDomanda1.titolo']);
    expect(h.s.save.data().unlocks.daily).toBe(true);
    h.confirmAnswer.value = true;
    h.confirmAnswer.asked.length = 0;
    q<HTMLButtonElement>(panel.el, 'sc-impostazioni-cancella')?.click();
    await tick(20);
    expect(h.confirmAnswer.asked).toEqual(['ui.impostazioni.cancellaDomanda1.titolo', 'ui.impostazioni.cancellaDomanda2.titolo']);
    expect(h.s.save.data().unlocks.daily).toBe(false);
    expect(wiped).toBe(1);
    panel.destroy();
  });

  it('sopra la notte (overlay) niente Importa e Cancella tutto', () => {
    const h = makeServices();
    const panel = buildSettingsPanel(h.s, { overlay: true });
    expect(q(panel.el, 'sc-impostazioni-esporta')).not.toBeNull();
    expect(q(panel.el, 'sc-impostazioni-importa')).toBeNull();
    expect(q(panel.el, 'sc-impostazioni-cancella')).toBeNull();
    panel.destroy();
  });
});

describe('menu Pausa', () => {
  beforeEach(() => document.body.replaceChildren());

  it('dal tombolo: Riprendi, Ricomincia, Impostazioni, Torna al titolo; Taccuino solo se esiste', () => {
    const h = makeServices();
    const box = document.createElement('div');
    document.body.appendChild(box);
    let handle = pausePanel(h.s, box, { from: 'tombolo', origin: 'giornaliero', levelId: 'day-2026-10-14' });
    const ids = [...box.querySelectorAll('[data-test^="sc-pausa-"]')].map((e) => (e as HTMLElement).dataset.test);
    expect(ids).toEqual(expect.arrayContaining(['sc-pausa-riprendi', 'sc-pausa-ricomincia', 'sc-pausa-impostazioni', 'sc-pausa-esci']));
    expect(q(box, 'sc-pausa-taccuino')).toBeNull();
    q<HTMLButtonElement>(box, 'sc-pausa-riprendi')?.click();
    expect(h.calls.closed).toBe(1);
    q<HTMLButtonElement>(box, 'sc-pausa-impostazioni')?.click();
    expect(h.calls.overlays.at(-1)?.id).toBe('impostazioni');
    q<HTMLButtonElement>(box, 'sc-pausa-esci')?.click();
    expect(h.calls.scenes.at(-1)?.id).toBe('titolo');
    handle.destroy();
    expect(box.childElementCount).toBe(0);
    // Con il pannello del Taccuino registrato.
    h.s.ui.registerPanel('taccuino', () => ({ destroy() {} }));
    handle = pausePanel(h.s, box, { from: 'tombolo' });
    q<HTMLButtonElement>(box, 'sc-pausa-taccuino')?.click();
    expect(h.calls.overlays.at(-1)?.id).toBe('taccuino');
    handle.destroy();
  });

  it('fuori dal tombolo non c’è Ricomincia la notte', () => {
    const h = makeServices();
    const box = document.createElement('div');
    const handle = pausePanel(h.s, box, { from: 'sera' });
    expect(q(box, 'sc-pausa-ricomincia')).toBeNull();
    handle.destroy();
  });
});

describe('pezzi d’interfaccia', () => {
  it('scelta a segmenti: clic e frecce', () => {
    makeServices();
    const seen: string[] = [];
    const seg = segmented({
      labelKey: 'ui.libero.dimensione',
      options: [
        { value: 'piccolo', labelKey: 'ui.libero.dimensioni.piccolo' },
        { value: 'medio', labelKey: 'ui.libero.dimensioni.medio' },
        { value: 'grande', labelKey: 'ui.libero.dimensioni.grande' },
      ],
      value: 'medio',
      onChange: (v) => seen.push(v),
      test: 'seg',
    });
    document.body.appendChild(seg.el);
    const group = q(seg.el, 'seg');
    expect(group?.getAttribute('role')).toBe('radiogroup');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(seg.get()).toBe('grande');
    group?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(seg.get()).toBe('piccolo');
    q<HTMLButtonElement>(seg.el, 'seg-medio')?.click();
    expect(seen).toEqual(['grande', 'piccolo', 'medio']);
    expect(q(seg.el, 'seg-medio')?.getAttribute('aria-checked')).toBe('true');
  });

  it('import dello spartito: errore spiegato in una riga', async () => {
    const h = makeServices();
    const box = document.createElement('div');
    document.body.appendChild(box);
    const handle = spartitoPanel(h.s, box, { value: 'TRAMA1-G20261014-b._.ad.c-00' });
    q<HTMLButtonElement>(box, 'sc-spartito-tessi')?.click();
    await tick(30);
    expect(q(box, 'sc-spartito-messaggio')?.textContent).toBe(h.s.i18n.t('ui.spartito.errore.formato'));
    expect(h.calls.scenes).toEqual([]);
    handle.destroy();
  });
});

describe('risultati', () => {
  beforeEach(() => resetScreensState());

  function result(): { info: ResultInfo; level: LevelDef } {
    const gen = generate(dailySpec('2026-10-17'));
    const level = gen.level;
    const ctx = createContext(level, {});
    const rows = solve({ level, ctx, goals: level.goals ?? [] }).rows ?? [];
    const sim = simulate(level, ctx, rows);
    const m = metrics(level, sim.rows, gen.min, false);
    const outcome: NightOutcome = {
      origin: 'giornaliero', levelId: level.id, rows: sim.rows, timeline: sim.timeline, events: sim.events, goals: [], requests: [], dropped: [],
      metrics: m, spartito: 'TRAMA1-x', hintsUsed: 0, fantasmaUsed: false, discoveredQuirks: [], nomeOn: null,
    };
    const info: ResultInfo = {
      origin: 'giornaliero', level, outcome, metrics: m, min: gen.min, flags: {}, improved: true, gradi: [], returnTo: 'giornaliero',
      daily: { date: '2026-10-17', incroci: m.incroci, min: gen.min, quiete: m.quiete, simmetria: m.simmetria, spartito: 'TRAMA1-x' }, dailyImproved: true, streak: 3,
      shareText: 'TRAMA 17/10 · …\nTRAMA1-x',
    };
    return { info, level };
  }

  it('carillon: un battito per riga, un bicordo per incrocio (sopra, sotto)', () => {
    const { info, level } = result();
    const score = carillonScore(level, info.outcome);
    expect(score.rows).toHaveLength(info.outcome.rows.length);
    info.outcome.rows.forEach((r, i) => expect(score.rows[i]).toHaveLength(r.crossings.length));
    for (const row of score.rows) for (const chord of row) expect(chord).toHaveLength(2);
  });

  it('foglio: eleganza, record, serie, Condividi nel piede, Copia spartito', async () => {
    const h = makeServices();
    const { info } = result();
    let again = 0;
    const view = resultsSheet(h.s, info, { onAgain: () => again++, onBack: () => undefined });
    document.body.append(view.el, view.foot);
    expect(q(view.el, 'sc-risultato-incroci')?.textContent).toContain(String(info.metrics.incroci));
    expect(q(view.el, 'sc-risultato-serie')?.textContent).toContain('3');
    expect(q(view.el, 'sc-risultato-nuovo')).not.toBeNull();
    expect(q(view.foot, 'sc-risultato-condividi')).not.toBeNull();
    q<HTMLButtonElement>(view.el, 'sc-risultato-copia')?.click();
    await tick(5);
    expect(h.calls.copied).toContain('TRAMA1-x');
    q<HTMLButtonElement>(view.el, 'sc-risultato-ritessi')?.click();
    expect(again).toBe(1);
    view.destroy();
  });
});

describe('quadro del titolo', () => {
  it('il tombolo è il quadrato più grande del palco; il fuso non copre il titolo', async () => {
    const { titleGeometry } = await import('../../../src/screens/titleArt');
    const stage = { x: 16, y: 160, w: 358, h: 380 };
    const g = titleGeometry(stage, 390, 844, false);
    expect(g.size).toBe(358);
    expect(g.y).toBeCloseTo(160 + 11);
    expect(g.showSpindle).toBe(true);
    // Titolo largo quasi quanto lo schermo: il filo parte da sotto il titolo.
    const title = { x: 30, y: 20, w: 345, h: 120 };
    const g2 = titleGeometry(stage, 390, 844, false, title);
    const half = g2.spindleH * 0.15 + 6;
    const overlaps = g2.pivotX + half > title.x && g2.pivotX - half < title.x + title.w;
    expect(!overlaps || g2.pivotY >= title.y + title.h).toBe(true);
    // Titolo stretto: il fuso resta in alto, a destra del titolo.
    const g3 = titleGeometry(stage, 390, 844, false, { x: 100, y: 20, w: 190, h: 100 });
    expect(g3.pivotY).toBeLessThan(0);
    expect(g3.pivotX - g3.spindleH * 0.15).toBeGreaterThan(290);
    // Palco minuscolo: niente fuso.
    expect(titleGeometry({ x: 0, y: 0, w: 120, h: 100 }, 360, 640, false).showSpindle).toBe(false);
    // Orizzontale con il tombolo a destra: il fuso pende fra menu e tombolo.
    const g4 = titleGeometry({ x: 560, y: 20, w: 700, h: 680 }, 1280, 720, true);
    expect(g4.pivotX).toBeLessThan(g4.x + 1);
    expect(g4.pivotX).toBeGreaterThan(500);
  });
});
