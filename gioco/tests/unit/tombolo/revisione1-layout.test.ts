// @vitest-environment happy-dom
/**
 * Revisione 1, disposizione: righe che stanno tutte (TOM-11), nota a margine che
 * non copre il gioco (TOM-07), ora e icona d'evento affiancate (TOM-12).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LevelDef, Viewport } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { type TomboloLayout, NOTE_GAP, ROW_FIT_MIN, ROW_SCROLL, SPINDLES_MIN_WIDE, BAND, autoScroll, computeTomboloLayout, placeMarginNote, rowBottom, rowTop, rowsBelow } from '../../../src/tombolo/layout';
import { edgeX } from '../../../src/tombolo/render/lace';
import { NightController } from '../../../src/tombolo/controller';
import { popupClock } from '../../../src/tombolo/ui/popup';
import { ROOT, fixture, nightParams } from './helpers';
import { type Harness, harness } from './harness';

const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
const vp = (w: number, h: number): Viewport => computeViewport(w, h, 2, NO_SAFE, 1);
function level(id: string): LevelDef {
  return JSON.parse(readFileSync(resolve(ROOT, `src/content/levels/${id}.json`), 'utf8')) as LevelDef;
}

describe('TOM-11: righe visibili (P087, P105)', () => {
  it('g13 (14 righe) a 390×844 e 1180×820: tutte le righe stanno (fra 30 e 56 px)', () => {
    for (const [w, h] of [[390, 844], [1180, 820]] as const) {
      const l = computeTomboloLayout(vp(w, h), 6, 14);
      expect(l.rowH, `${w}×${h}`).toBeGreaterThanOrEqual(ROW_FIT_MIN);
      expect(l.contentH, `${w}×${h}`).toBeLessThanOrEqual(l.lace.h - 16);
      expect(rowsBelow(l, autoScroll(l, 14))).toBe(0);
    }
  });

  it('largo: la fascia dei fusi scende fino a 104 px perché le righe stiano', () => {
    const l = computeTomboloLayout(vp(1280, 770), 6, 14);
    expect(l.kind).toBe('largo');
    expect(l.spindles.h).toBeGreaterThanOrEqual(SPINDLES_MIN_WIDE);
    expect(l.spindles.h).toBeLessThan(BAND.spindles);
    expect(l.rowH).toBeGreaterThanOrEqual(ROW_FIT_MIN);
  });

  it('sotto i 30 px le righe tornano a 40 e si contano quelle nascoste', () => {
    const l = computeTomboloLayout(vp(360, 640), 6, 14);
    expect(l.rowH).toBe(ROW_SCROLL);
    const n = rowsBelow(l, autoScroll(l, 1));
    expect(n).toBeGreaterThan(0);
    // Dall'alto: le righe sotto il bordo sono esattamente quelle che non si vedono.
    let manual = 0;
    for (let i = 1; i <= 14; i++) if (rowBottom(l, i) - autoScroll(l, 1) > l.lace.h + 1) manual++;
    expect(n).toBe(manual);
  });
});

describe('TOM-07: posto della nota a margine (D04)', () => {
  const noteW = 300;
  const noteH = 70;

  function rects(l: TomboloLayout, current: number): { cur: { y0: number; y1: number }; future: { y0: number; y1: number } } {
    const s = autoScroll(l, current);
    const y = (i: number): number => l.lace.y - s + rowTop(l, i);
    return { cur: { y0: y(current), y1: y(current) + l.rowH }, future: { y0: y(current + 1), y1: y(current + 1) + 2 * l.rowH } };
  }

  it('stretto: mai sulla riga corrente, sulle due future, sui fusi, sulle richieste o sulle azioni', () => {
    for (const [w, h, rows] of [[390, 844, 6], [390, 844, 8], [360, 640, 12], [390, 844, 14]] as const) {
      for (let cur = 1; cur <= rows; cur++) {
        const base = computeTomboloLayout(vp(w, h), 5, rows);
        const pl = placeMarginNote(base, cur, [], noteW, noteH);
        const r = pl.rect;
        if (pl.mode === 'fascia') {
          // Il merletto scende di tanto: la nota sta fra l'intestazione e il merletto.
          const l = computeTomboloLayout(vp(w, h), 5, rows, { noteBand: pl.band });
          expect(r.y).toBeGreaterThanOrEqual(l.header.y + l.header.h);
          expect(r.y + r.h).toBeLessThanOrEqual(l.lace.y);
          continue;
        }
        const g = rects(base, cur);
        const hit = (a: { y0: number; y1: number }): boolean => r.y < a.y1 && r.y + r.h > a.y0;
        expect(hit(g.cur), `${w}×${h} riga ${cur}`).toBe(false);
        expect(hit(g.future), `${w}×${h} riga ${cur}`).toBe(false);
        expect(r.y + r.h).toBeLessThanOrEqual(base.requests.y);
      }
    }
  });

  it('non copre gli spilli delle righe fissate', () => {
    const base = computeTomboloLayout(vp(390, 844), 5, 8);
    const pl = placeMarginNote(base, 6, [2, 3], noteW, noteH);
    if (pl.mode !== 'righe') return;
    const s = autoScroll(base, 6);
    for (const i of [2, 3]) {
      const y = base.lace.y - s + rowBottom(base, i);
      expect(pl.rect.y + pl.rect.h <= y - 22 || pl.rect.y >= y + 4).toBe(true);
    }
  });

  it('largo: in cima al pannello di sinistra', () => {
    const base = computeTomboloLayout(vp(1280, 800), 5, 8);
    const pl = placeMarginNote(base, 3, [], noteW, noteH);
    expect(pl.mode).toBe('pannello');
    expect(pl.rect.x).toBeGreaterThanOrEqual(base.left!.x);
    expect(pl.rect.x + pl.rect.w).toBeLessThanOrEqual(base.left!.x + base.left!.w);
    expect(pl.rect.y).toBe(base.left!.y + 8);
    expect(NOTE_GAP).toBeGreaterThan(0);
  });
});

describe('TOM-07: nella regia (tocco, durata, coda, un solo messaggio)', () => {
  let h: Harness;
  let c: NightController | null = null;
  beforeEach(() => {
    h = harness();
    vi.spyOn(popupClock, 'now').mockImplementation(() => 0);
  });
  afterEach(() => {
    c?.destroy();
    c = null;
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  const lv = (): LevelDef => ({
    ...fixture('g00'),
    tutorial: [
      { k: 'margine', when: 'primaOra', textKey: 'tombolo.test.margine' },
      { k: 'margine', when: 'incrocio', hour: 6, textKey: 'tombolo.test.rivela' },
    ],
  });

  it('un tocco sulla nota la chiude e non passa sotto; la nota seguente era in coda', () => {
    c = new NightController(h.s, nightParams(lv()), { computed: null });
    expect(c.margin.current).toBe('tombolo.test.margine');
    // L'incrocio delle 6 accoda la seconda nota (una alla volta).
    expect(c.cross(0, 'R', 'debug')).toBeNull();
    expect(c.margin.current).toBe('tombolo.test.margine');
    const note = document.querySelector<HTMLElement>('[data-test="tb-margine"]')!;
    const down = new PointerEvent('pointerdown', { bubbles: true });
    let reached = false;
    document.body.addEventListener('pointerdown', () => (reached = true));
    note.dispatchEvent(down);
    expect(reached).toBe(false);
    note.click();
    expect(c.margin.current).toBe('tombolo.test.rivela');
    expect(c.session.draft).toEqual([{ pair: 0, over: 'R' }]);
  });

  it('si chiude alla prima azione valida dopo 4 s, oppure da sola dopo 12 s', () => {
    h.data.settings.autoAdvance = true;
    c = new NightController(h.s, nightParams(lv()), { computed: null });
    for (let i = 0; i < 60; i++) c.update(1 / 60);
    c.cross(0, 'R', 'debug');
    // Dopo 1 s l'azione non la chiude (resta, e la seconda è in coda).
    expect(c.margin.current).toBe('tombolo.test.margine');
    for (let i = 0; i < 4 * 60; i++) c.update(1 / 60);
    c.undo();
    expect(c.margin.current).toBe('tombolo.test.rivela');
    for (let i = 0; i < 12 * 60 + 5; i++) c.update(1 / 60);
    expect(c.margin.visible()).toBe(false);
  });

  it('con l\'avanzamento automatico spento resta finché il giocatore non agisce', () => {
    h.data.settings.autoAdvance = false;
    c = new NightController(h.s, nightParams(lv()), { computed: null });
    for (let i = 0; i < 20 * 60; i++) c.update(1 / 60);
    expect(c.margin.current).toBe('tombolo.test.margine');
    c.cross(0, 'R', 'debug');
    expect(c.margin.current).toBe('tombolo.test.rivela');
  });

  it('una riga rifiutata produce un solo messaggio, mai a banner', () => {
    c = new NightController(h.s, nightParams(fixture('g00')), { computed: null });
    const res = c.fix();
    expect(res.ok).toBe(false);
    const shown = Array.from(document.querySelectorAll<HTMLElement>('[data-test="tb-explain"], [data-test="tb-archivio-chiudi-motivo"], [data-test="tb-margine"]')).filter((e) => !e.hidden);
    expect(shown).toHaveLength(1);
    // La riga di motivo sta sopra la barra delle azioni, non sul merletto.
    const explain = document.querySelector<HTMLElement>('[data-test="tb-explain"]')!;
    expect(explain.style.bottom).not.toBe('');
    expect(explain.style.top).toBe('');
  });
});

describe('TOM-12: l\'icona dell\'evento accanto al numero dell\'ora', () => {
  it('la barca del Molo non copre il numero dell\'ora', () => {
    for (const w of [360, 390, 1280]) {
      const l = computeTomboloLayout(vp(w, 800), 6, 10);
      const boat = edgeX(l, -1);
      // Numero a due cifre (13 px, ~15 px di larghezza) centrato su gutterCx; la barca è larga 16 px.
      expect(boat - 8, `${w}`).toBeGreaterThanOrEqual(l.gutterCx + 8);
      expect(l.colW).toBeGreaterThanOrEqual(52);
    }
  });

  it('g06 (contenuti): c\'è una barca da spiegare', () => {
    const lv = level('g06');
    expect((lv.edges ?? []).length).toBeGreaterThan(0);
  });
});
