// @vitest-environment happy-dom
/**
 * Revisione 2, gruppo schermi-atto1 (docs/REVISIONE-2.md, playtest-2.json):
 * - Q022: nel Merletto del giorno chi ha stranezze che stanotte non contano non è «senza stranezze»;
 * - Q036: dopo il finale vero il titolo dice a video «la Tovaglia è sul Telaio»;
 * - Q059: la regola del giorno e del libero ha l'icona di un foglio, non una nota musicale;
 * - Q068: la freccia di scorrimento del titolo sta sotto il menu, fuori dall'area che scorre;
 * - Q072: «TRAMA» nei Crediti non va a capo (CSS).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SaveData, Viewport } from '../../../src/core/types';
import { GLYPHS } from '../../../src/core/ui/glyphs';
import { GiornalieroScene } from '../../../src/screens/GiornalieroScene';
import { TitoloScene } from '../../../src/screens/TitoloScene';
import { titleItems } from '../../../src/screens/titleMenu';
import { chiInfo } from '../../../src/screens/chi';
import { dailySpec, generate } from '../../../src/engine/index';
import { resetScreensState, setTodayOverride } from '../../../src/screens/state';
import { makeServices, ROOT } from './helpers';

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));
const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, test: string): T | null => root.querySelector<T>(`[data-test="${test}"]`);
async function waitFor(fn: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await tick(10);
}

const UNLOCKED: Partial<SaveData> = { unlocks: { daily: true, libero: true, gradi: true, cosmetics: [], tovaglia: false } };

describe('Q022: «Chi c’è stanotte» non contraddice il Taccuino', () => {
  beforeEach(() => {
    resetScreensState();
    document.body.replaceChildren();
  });

  it('chiInfo separa le stranezze che contano da quelle che stanotte dormono', () => {
    const content = makeServices().s.content;
    // Il Merletto del giorno del 15/10: Marta c'è, Teresa no.
    const level = generate(dailySpec('2026-10-15')).level;
    expect(level.threads.some((t) => t.id === 'teresa' || t.character === 'teresa')).toBe(false);
    const info = chiInfo({ content }, level);
    const marta = info.people.find((p) => p.character === 'marta');
    // Senza Teresa la stranezza di Marta non conta: è «dormiente», non assente.
    expect(marta?.quirks.length ?? 0).toBe(0);
    expect(marta?.dormant).toEqual(['martaNoSotto']);
    expect(info.people.find((p) => p.character === 'bepi')?.dormant).toEqual([]);
  });

  it('Merletto del giorno del 15/10: «Marta — Nessuna stranezza che conti stanotte.», Bepi «Nessuna stranezza.»', async () => {
    const h = makeServices({ save: UNLOCKED });
    setTodayOverride('2026-10-15');
    const scene = new GiornalieroScene(h.s);
    scene.enter();
    await waitFor(() => !!q(document.body, 'sc-giornaliero-chi-marta'));
    const marta = q(document.body, 'sc-giornaliero-chi-marta') as HTMLElement;
    expect(marta.textContent).toContain('Nessuna stranezza che conti stanotte.');
    expect(marta.textContent).not.toMatch(/Nessuna stranezza\.$/);
    expect(q(document.body, 'sc-giornaliero-chi-bepi')?.textContent).toContain('Nessuna stranezza.');
    scene.exit();
  });

  it('in inglese: «No quirk that matters tonight.»', () => {
    const h = makeServices({ locale: 'en' });
    expect(h.s.i18n.t('ui.chi.nessunaStranezzaStanotte')).toBe('No quirk that matters tonight.');
  });
});

describe('Q059: la regola del giorno ha l’icona di un foglio', () => {
  beforeEach(() => {
    resetScreensState();
    document.body.replaceChildren();
  });

  it('il glifo «foglio» esiste ed è diverso dalla nota musicale', () => {
    expect(GLYPHS.foglio?.d).toBeTruthy();
    expect(GLYPHS.foglio?.d).not.toBe(GLYPHS.nota?.d);
  });

  it('nel Merletto del giorno la sezione «La regola del giorno» usa il foglio', async () => {
    const h = makeServices({ save: UNLOCKED });
    setTodayOverride('2026-10-15');
    const scene = new GiornalieroScene(h.s);
    scene.enter();
    await waitFor(() => !!q(document.body, 'sc-giornaliero-regola'));
    const regola = q(document.body, 'sc-giornaliero-regola') as HTMLElement;
    const d = regola.querySelector('h2 svg path')?.getAttribute('d');
    expect(d).toBe(GLYPHS.foglio?.d);
    expect(d).not.toBe(GLYPHS.nota?.d);
    scene.exit();
  });

  it('nessuna schermata del gruppo usa «nota» per una regola', () => {
    for (const f of ['GiornalieroScene.ts', 'LiberoScene.ts']) {
      const src = readFileSync(resolve(ROOT, 'src/screens', f), 'utf8');
      expect(src).not.toMatch(/regola', 'nota'/);
    }
  });
});

const VP: Viewport = { cssW: 360, cssH: 640, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 }, orientation: 'portrait', layout: 'stretto', textScale: 1.4 };

describe('Q036 e Q068: titolo', () => {
  let scene: TitoloScene | null = null;
  afterEach(() => {
    scene?.exit();
    scene = null;
    document.body.innerHTML = '';
  });

  function enter(tovaglia: boolean): TitoloScene {
    const story: Partial<SaveData> = {
      campaign: { history: { g00: {} } } as unknown as SaveData['campaign'],
      stats: { playMs: 1, nights: 1, goldThreads: 0, dailyStreak: 0 },
      unlocks: { daily: true, libero: true, gradi: false, cosmetics: [], tovaglia },
    };
    const h = makeServices({ save: story, registered: ['titolo', 'giornaliero', 'libero', 'impostazioni', 'crediti', 'tombolo', 'telaio', 'sera'] });
    const s = Object.assign(h.s, {
      viewport: { get: () => VP },
      input: { lastDevice: () => 'touch' },
      assets: { frame: () => ({ source: document.createElement('canvas'), sx: 0, sy: 0, sw: 96, sh: 320, ax: 0.5, ay: 0.125, placeholder: true }), has: () => false },
    });
    scene = new TitoloScene(s);
    scene.enter();
    return scene;
  }

  it('Q036: dopo il finale vero, sotto «Telaio» si legge a video che la Tovaglia è sul Telaio', () => {
    enter(true);
    const telaio = q(document.body, 'sc-titolo-telaio') as HTMLElement;
    expect(telaio.textContent).toContain('Hai visto il finale vero: la Tovaglia è sul Telaio.');
    // La frase non è solo per i lettori di schermo.
    const sub = Array.from(telaio.querySelectorAll('*')).find((e) => e.textContent === 'Hai visto il finale vero: la Tovaglia è sul Telaio.');
    expect(sub?.closest('.core-sr-only')).toBeNull();
    expect(q(document.body, 'sc-titolo-telaio-stella')).not.toBeNull();
  });

  it('Q036: senza il finale vero niente riga; con il Telaio chiuso resta il lucchetto', () => {
    enter(false);
    expect(q(document.body, 'sc-titolo-telaio')?.textContent).not.toContain('Tovaglia');
    const d = {
      campaign: null,
      night: null,
      stats: { playMs: 0, nights: 0, goldThreads: 0, dailyStreak: 0 },
      daily: {},
      records: {},
      unlocks: { daily: false, libero: false, gradi: false, cosmetics: [], tovaglia: true },
    } as unknown as SaveData;
    const tel = titleItems(d, { hasTelaio: true, fullGame: true, dailyDoneToday: false, trueEnding: true }).find((i) => i.id === 'telaio');
    expect(tel?.subKey).toBe('ui.titolo.lucchetto.telaio');
  });

  it('Q068: la freccia di scorrimento è fuori dal menu che scorre e si accende solo se sotto c’è dell’altro', () => {
    enter(true);
    const nav = q(document.body, 'sc-titolo-menu') as HTMLElement;
    const hint = q(document.body, 'sc-titolo-ombra') as HTMLElement;
    expect(hint).not.toBeNull();
    // Non sta dentro l'area che scorre: non può coprire nessuna voce (né «Crediti»).
    expect(nav.contains(hint)).toBe(false);
    expect(nav.nextElementSibling).toBe(hint);
    expect(hint.dataset.stato).toBe('no');
    // Il menu scorre: 500 px di voci in 300 px.
    let top = 0;
    Object.defineProperty(nav, 'scrollHeight', { configurable: true, get: () => 500 });
    Object.defineProperty(nav, 'clientHeight', { configurable: true, get: () => 300 });
    Object.defineProperty(nav, 'scrollTop', { configurable: true, get: () => top });
    nav.dispatchEvent(new Event('scroll'));
    expect(hint.dataset.stato).toBe('giu');
    expect(nav.dataset.scorre).toBe('giu');
    top = 200;
    nav.dispatchEvent(new Event('scroll'));
    expect(hint.dataset.stato).toBe('fine');
    expect(nav.dataset.scorre).toBe('no');
  });

  it('Q068: nel CSS la striscia non è sovrapposta al menu (niente sticky, niente margine negativo che la tiri dentro)', () => {
    const css = readFileSync(resolve(ROOT, 'src/screens/screens.css'), 'utf8');
    const block = css.slice(css.indexOf('.sc-titolo-ombra {'), css.indexOf('}', css.indexOf('.sc-titolo-ombra {')));
    expect(block).not.toMatch(/position:\s*sticky/);
    expect(block).not.toMatch(/margin-top:\s*calc\(-32px/);
  });
});

describe('Q072: «TRAMA» nei Crediti non va a capo', () => {
  it('il nome non si spezza (nowrap) e si misura sulla testata (cqi)', () => {
    const css = readFileSync(resolve(ROOT, 'src/screens/screens.css'), 'utf8');
    const i = css.indexOf('.sc-crediti-nome {');
    const block = css.slice(i, css.indexOf('}', i));
    expect(block).toMatch(/white-space:\s*nowrap/);
    expect(block).not.toMatch(/overflow-wrap:\s*anywhere/);
    expect(block).toMatch(/cqi/);
    expect(css).toMatch(/\.sc-crediti-testa\s*\{\s*container-type:\s*inline-size;/);
  });
});
