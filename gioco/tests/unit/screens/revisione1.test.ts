// @vitest-environment happy-dom
/**
 * Revisione 1, gruppo schermi: Pausa con «Lascia per ora» e «Comandi» (C10,
 * SCH-03), pagina dei comandi generata dalla mappa dei tasti, Merletto libero
 * che non cancella la notte a metà (SCH-04).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { pausePanel } from '../../../src/screens/pausePanel';
import { comandiPanel, GESTURE_HELP } from '../../../src/screens/comandiPanel';
import { KEY_HELP } from '../../../src/core/keymap';
import { ACTION_IDS } from '../../../src/core/ids';
import { makeServices } from './helpers';
import type { SaveData } from '../../../src/core/types';
import { LiberoScene, setLiberoChoice } from '../../../src/screens/LiberoScene';
import { liberoLevelId, parseLiberoId } from '../../../src/screens/libero';
import { liberoLevel, resetScreensState, setTodayOverride } from '../../../src/screens/state';
import { GiornalieroScene } from '../../../src/screens/GiornalieroScene';
import { registerLevelResolver } from '../../../src/tombolo/index';

const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, test: string): T | null => root.querySelector<T>(`[data-test="${test}"]`);

describe('Pausa: «Lascia per ora» (C10)', () => {
  beforeEach(() => document.body.replaceChildren());

  it('c\'è solo con origine archivio; chiude la Pausa e va alla cassapanca con cmd lascia', () => {
    const h = makeServices();
    const box = document.createElement('div');
    document.body.appendChild(box);
    for (const origin of ['campagna', 'giornaliero', 'libero', 'spartito', 'telaio'] as const) {
      const p = pausePanel(h.s, box, { from: 'tombolo', origin, levelId: 'g03' });
      expect(q(box, 'sc-pausa-lascia')).toBeNull();
      p.destroy();
    }
    const p = pausePanel(h.s, box, { from: 'tombolo', origin: 'archivio', levelId: 'arc1' });
    const b = q<HTMLButtonElement>(box, 'sc-pausa-lascia');
    expect(b).not.toBeNull();
    expect(b?.textContent).toContain('Lascia per ora');
    const closedBefore = h.calls.closed;
    b?.click();
    expect(h.calls.closed).toBe(closedBefore + 1);
    expect(h.calls.scenes.at(-1)).toEqual({ id: 'archivio', params: { cmd: 'lascia', levelId: 'arc1' } });
    p.destroy();
  });

  it('chiude la Pausa PRIMA di cambiare scena', () => {
    const h = makeServices();
    const order: string[] = [];
    const close = h.s.ui.closeOverlay.bind(h.s.ui);
    h.s.ui.closeOverlay = () => {
      order.push('close');
      close();
    };
    const go = h.s.scenes.go.bind(h.s.scenes);
    h.s.scenes.go = async (id, params) => {
      order.push(`go:${id}`);
      await go(id, params);
    };
    const box = document.createElement('div');
    const p = pausePanel(h.s, box, { from: 'tombolo', origin: 'archivio', levelId: 'arc2' });
    q<HTMLButtonElement>(box, 'sc-pausa-lascia')?.click();
    expect(order).toEqual(['close', 'go:archivio']);
    p.destroy();
  });

  it('«Comandi» apre l\'overlay dei comandi, in ogni origine', () => {
    const h = makeServices();
    const box = document.createElement('div');
    for (const raw of [{ from: 'tombolo', origin: 'campagna' }, { from: 'sera' }, {}]) {
      const p = pausePanel(h.s, box, raw);
      const b = q<HTMLButtonElement>(box, 'sc-pausa-comandi');
      expect(b?.textContent).toContain('Comandi');
      b?.click();
      expect(h.calls.overlays.at(-1)?.id).toBe('comandi');
      p.destroy();
    }
  });
});

describe('pagina dei comandi (sc-comandi)', () => {
  beforeEach(() => document.body.replaceChildren());

  it('elenca ogni azione della mappa dei tasti, compresi H, N, Maiusc+Invio', () => {
    const h = makeServices();
    const box = document.createElement('div');
    document.body.appendChild(box);
    const p = comandiPanel(h.s, box);
    const page = q(box, 'sc-comandi');
    expect(page).not.toBeNull();
    const listed = new Set(
      [...box.querySelectorAll<HTMLElement>('[data-test="sc-comandi-tasti"] [data-actions]')].flatMap((r) => (r.dataset.actions ?? '').split(' ')),
    );
    for (const a of ACTION_IDS) {
      if (a === 'fixHour') continue; // azione solo dei pulsanti (nessun tasto la produce)
      expect(listed.has(a), a).toBe(true);
    }
    const text = (id: string): string => q(box, `sc-comandi-${id}`)?.textContent ?? '';
    expect(text('suggerimento')).toMatch(/^H/);
    expect(text('nome')).toMatch(/^N/);
    expect(text('quiete')).toContain('Maiusc+Invio');
    expect(text('quiete')).toContain('Salta le ore quiete');
    expect(text('incrociaDestra')).toContain('Maiusc+Spazio');
    expect(text('filo')).toContain('1–6');
    expect(text('disfa')).toContain('Ctrl+Z');
    // Gesti, compreso il clic destro.
    for (const g of GESTURE_HELP) expect(q(box, `sc-comandi-gesto-${g}`)).not.toBeNull();
    expect(text('gesto-clicDestro')).toContain('Clic destro');
    expect(box.querySelectorAll('[data-test^="sc-comandi-"]').length).toBeGreaterThan(KEY_HELP.length + GESTURE_HELP.length);
    p.destroy();
    expect(box.childElementCount).toBe(0);
  });

  it('in inglese', () => {
    const h = makeServices({ locale: 'en' });
    const box = document.createElement('div');
    const p = comandiPanel(h.s, box);
    expect(q(box, 'sc-comandi-quiete')?.textContent).toContain('Shift+Enter');
    expect(q(box, 'sc-comandi-gesto-clicDestro')?.textContent).toContain('Right-click');
    p.destroy();
  });
});

// ───────────── SCH-04: «Tessi» non cancella la notte libera a metà ─────────────

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));

function halfLibero(seed: string): NonNullable<SaveData['night']> {
  const levelId = liberoLevelId(seed, []);
  return {
    origin: 'libero',
    params: { origin: 'libero', mode: 'normale', flags: {}, accepted: [], goals: [], needsNome: false, levelId },
    resume: { levelId, rows: [{ hour: 7, crossings: [{ pair: 0, over: 'L' }] }, { hour: 8, crossings: [] }], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false },
  };
}
const UNLOCKED = { unlocks: { daily: true, libero: true, gradi: false, cosmetics: [], tovaglia: false } };

describe('Merletto libero con una notte a metà (SCH-04, P036)', () => {
  beforeEach(() => {
    resetScreensState();
    document.body.replaceChildren();
  });

  it('stesso seme: il pulsante fisso riprende, «Tessi da capo» è in cima', async () => {
    registerLevelResolver(async (id) => {
      const p = parseLiberoId(id);
      if (!p) return null;
      const gen = await liberoLevel(p.seed, p.gradi);
      return gen.level.id === id ? gen.level : null;
    });
    const h = makeServices({ save: { ...UNLOCKED, night: halfLibero('gdjm8dc') } });
    setLiberoChoice({ seed: 'gdjm8dc', gradi: [] });
    const scene = new LiberoScene(h.s);
    scene.enter();
    const foot = document.querySelector('.sc-piede') as HTMLElement;
    expect(q(foot, 'sc-libero-riprendi')?.textContent).toContain('Riprendi il merletto');
    expect(q(foot, 'sc-libero-tessi')).toBeNull();
    const top = q(document.body, 'sc-libero-cima') as HTMLElement;
    expect(q(top, 'sc-libero-dacapo')).not.toBeNull();
    // In cima: prima del seme.
    const seedSection = q(document.body, 'sc-libero-sezione-seme') as HTMLElement;
    expect(top.compareDocumentPosition(seedSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    q<HTMLButtonElement>(foot, 'sc-libero-riprendi')?.click();
    for (let i = 0; i < 50 && h.calls.scenes.length === 0; i++) await tick(10);
    const go = h.calls.scenes.at(-1);
    expect(go?.id).toBe('tombolo');
    expect((go?.params as { resume?: { rows: unknown[] } }).resume?.rows).toHaveLength(2);
    // Il salvataggio non è stato toccato.
    expect(h.s.save.data().night?.resume.rows).toHaveLength(2);
    scene.exit();
  });

  it('«Tessi da capo» chiede conferma; annullando, il salvataggio resta intatto', async () => {
    const h = makeServices({ save: { ...UNLOCKED, night: halfLibero('gdjm8dc') } });
    setLiberoChoice({ seed: 'gdjm8dc', gradi: [] });
    const before = JSON.stringify(h.s.save.data().night);
    const scene = new LiberoScene(h.s);
    scene.enter();
    h.confirmAnswer.value = false;
    q<HTMLButtonElement>(document.body, 'sc-libero-dacapo')?.click();
    await tick(30);
    expect(h.confirmAnswer.asked).toEqual(['ui.libero.daCapoDomanda.titolo']);
    expect(h.calls.scenes).toEqual([]);
    expect(JSON.stringify(h.s.save.data().night)).toBe(before);
    // Confermando si tesse da capo.
    h.confirmAnswer.value = true;
    expect(await scene.weaveFromScratch()).toBe(true);
    const go = h.calls.scenes.at(-1);
    expect(go?.id).toBe('tombolo');
    expect((go?.params as { resume?: unknown }).resume).toBeUndefined();
    scene.exit();
  });

  it('un altro seme: «Tessi» resta il pulsante fisso e «Riprendi il merletto <seme>» va in cima', () => {
    const h = makeServices({ save: { ...UNLOCKED, night: halfLibero('gdjm8dc') } });
    setLiberoChoice({ seed: 'mabc123', gradi: [] });
    const scene = new LiberoScene(h.s);
    scene.enter();
    const foot = document.querySelector('.sc-piede') as HTMLElement;
    expect(q(foot, 'sc-libero-tessi')).not.toBeNull();
    const top = q(document.body, 'sc-libero-cima') as HTMLElement;
    expect(q(top, 'sc-libero-riprendi')?.textContent).toContain('gdjm8dc');
    expect(q(document.body, 'sc-libero-dacapo')).toBeNull();
    // Scrivendo il seme della notte a metà il pulsante fisso diventa «Riprendi».
    const field = q<HTMLInputElement>(document.body, 'sc-libero-seme')!;
    field.value = 'gdjm8dc';
    field.dispatchEvent(new Event('input'));
    expect(q(foot, 'sc-libero-riprendi')).not.toBeNull();
    expect(q(document.body, 'sc-libero-dacapo')).not.toBeNull();
    expect(document.querySelectorAll('[data-test="sc-libero-riprendi"]')).toHaveLength(1);
    scene.exit();
  });

  it('senza notte a metà: solo «Tessi», niente in cima', () => {
    const h = makeServices({ save: UNLOCKED });
    setLiberoChoice({ seed: 'mabc123', gradi: [] });
    const scene = new LiberoScene(h.s);
    scene.enter();
    expect(q(document.body, 'sc-libero-tessi')).not.toBeNull();
    expect(q(document.body, 'sc-libero-riprendi')).toBeNull();
    expect((q(document.body, 'sc-libero-cima') as HTMLElement).hidden).toBe(true);
    scene.exit();
  });
});

// ───────────── SCH-07: «Chi c'è stanotte» ─────────────
async function waitFor(fn: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!fn() && Date.now() - t0 < ms) await tick(10);
}

describe("«Chi c'è stanotte» (SCH-07, P041, P045)", () => {
  beforeEach(() => {
    resetScreensState();
    document.body.replaceChildren();
  });

  it('Merletto del giorno del 15/10: Lunardi cura, Gino non sta fermo, Marta senza stranezze che contino, Bepi senza stranezze, un passante', async () => {
    const h = makeServices({ save: UNLOCKED });
    setTodayOverride('2026-10-15');
    const scene = new GiornalieroScene(h.s);
    scene.enter();
    await waitFor(() => !!q(document.body, 'sc-giornaliero-chi-lunardi'));
    const chi = q(document.body, 'sc-giornaliero-chi') as HTMLElement;
    expect(chi.textContent).toContain("Chi c'è stanotte");
    expect(q(chi, 'sc-giornaliero-chi-lunardi')?.dataset.quirks).toBe('lunardiCura');
    expect(q(chi, 'sc-giornaliero-chi-lunardi')?.textContent).toContain(h.s.i18n.t('tombolo.stranezza.lunardiCura'));
    expect(q(chi, 'sc-giornaliero-chi-gino')?.textContent).toContain(h.s.i18n.t('tombolo.stranezza.ginoCorre'));
    // Q022: Marta «non passa mai sotto Teresa», ma Teresa stanotte non c'è.
    expect(q(chi, 'sc-giornaliero-chi-marta')?.textContent).toContain('Nessuna stranezza che conti stanotte.');
    expect(q(chi, 'sc-giornaliero-chi-bepi')?.textContent).toContain('Nessuna stranezza.');
    expect(q(chi, 'sc-giornaliero-chi-bepi')?.textContent).not.toContain('stanotte');
    expect(chi.querySelector('.sc-chi-passanti')?.textContent).toContain('un passante');
    // La regola del giorno con la pagina del Libro, subito sopra.
    expect(q(document.body, 'sc-giornaliero-libro')).not.toBeNull();
    expect(chi.previousElementSibling?.getAttribute('data-test')).toBe('sc-giornaliero-regola');
    scene.exit();
  });

  it('Merletto del giorno del 18/10: Teresa legge, Don Piero è un pozzo, il filo nero di Livia', async () => {
    const h = makeServices({ save: UNLOCKED });
    setTodayOverride('2026-10-18');
    const scene = new GiornalieroScene(h.s);
    scene.enter();
    await waitFor(() => !!q(document.body, 'sc-giornaliero-chi-teresa'));
    const chi = q(document.body, 'sc-giornaliero-chi') as HTMLElement;
    expect(q(chi, 'sc-giornaliero-chi-teresa')?.dataset.quirks).toBe('teresaLegge');
    expect(q(chi, 'sc-giornaliero-chi-piero')?.dataset.quirks).toBe('pieroPozzo');
    expect(q(chi, 'sc-giornaliero-chi-gino')?.dataset.quirks).toBe('ginoCorre');
    const livia = q(chi, 'sc-giornaliero-chi-livia') as HTMLElement;
    expect(livia.classList.contains('sc-chi-persona--nero')).toBe(true);
    expect(livia.textContent).toContain('Filo nero');
    scene.exit();
  });

  it('libero gdjm8dc: la coppia in rancore Teresa e Marta, e le stranezze di chi c\'è', async () => {
    const h = makeServices({ save: UNLOCKED });
    setLiberoChoice({ seed: 'gdjm8dc', gradi: [] });
    const scene = new LiberoScene(h.s);
    scene.enter();
    await waitFor(() => !!q(document.body, 'sc-libero-chi-marta'));
    const chi = q(document.body, 'sc-libero-chi') as HTMLElement;
    const r = q(chi, 'sc-libero-chi-rancore-teresa-marta');
    expect(r?.textContent).toMatch(/Teresa e Marta sono in rancore/);
    expect(q(chi, 'sc-libero-chi-marta')?.dataset.quirks).toBe('martaNoSotto');
    expect(q(chi, 'sc-libero-chi-teresa')?.dataset.quirks).toBe('teresaLegge');
    expect(q(document.body, 'sc-libero-libro')).not.toBeNull();
    // Cambiando seme la sezione si rifà per il merletto nuovo.
    const field = q<HTMLInputElement>(document.body, 'sc-libero-seme')!;
    field.value = 'pm0ozmz';
    field.dispatchEvent(new Event('input'));
    await waitFor(() => !!q(document.body, 'sc-libero-chi-piero'));
    expect(q(document.body, 'sc-libero-chi-rancore-teresa-marta')).toBeNull();
    scene.exit();
  });
});
