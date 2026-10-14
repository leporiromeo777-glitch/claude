/**
 * Correzioni della verifica: merletti d'Archivio con i flag della campagna,
 * righe registrate visibili dopo lo strappo, lettere che tremano verso il
 * destinatario, riga corrente sempre visibile sugli schermi bassi.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LevelDef, Viewport } from '../../../src/core/types';
import { computeViewport } from '../../../src/core/viewport';
import { ARCHIVE_FLAGS, ArchiveBook } from '../../../src/tombolo/modes/archive';
import { Session } from '../../../src/tombolo/session';
import { buildLaceModel, beadTypesOf, letterRecipients, stacksOf } from '../../../src/tombolo/render/model';
import { buildVisuals } from '../../../src/tombolo/visuals';
import { BAND, SPINDLES_MIN, autoScroll, computeTomboloLayout, rowBottom, rowTop } from '../../../src/tombolo/layout';
import { ROOT, fixture, nightParams } from './helpers';

function contentLevel(id: string): LevelDef {
  return JSON.parse(readFileSync(resolve(ROOT, `src/content/levels/${id}.json`), 'utf8')) as LevelDef;
}

/** Tesse gli strappi con le righe registrate e chiude il merletto. */
function mendWithRecorded(s: Session): void {
  const rec = s.level.archive?.recorded ?? [];
  for (let guard = 0; guard < 40 && !s.done; guard++) {
    const r = rec.find((x) => x.hour === s.hour);
    for (const c of r?.crossings ?? []) if (!c.forced) expect(s.propose({ pair: c.pair, over: c.over })).toBeNull();
    const res = s.fix();
    expect(res.ok, JSON.stringify(res.violations)).toBe(true);
  }
}

describe('Archivio: il merletto antico si tesse con le regole di allora', () => {
  it('arc1 con i flag della campagna (riconciliate): il rammendo coincide lo stesso', () => {
    const lv = contentLevel('arc1');
    const s = new Session(nightParams(lv, { mode: 'archivio', origin: 'archivio', flags: { riconciliate: true } }));
    expect(s.runFlags).toBe(ARCHIVE_FLAGS);
    // La stranezza di Teresa resta: è il 1936.
    expect(s.ctx.quirks).toEqual(lv.quirks);
    expect(s.ctx.quirks).toContain('teresaLegge');
    mendWithRecorded(s);
    expect(s.archive?.allMended()).toBe(true);
  });

  it('una notte normale usa i flag della campagna', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv, { flags: { riconciliate: true } }));
    expect(s.ctx.quirks).not.toContain('martaNoSotto');
  });

  it('il libro registra righe ed eventi per il disegno', () => {
    const lv = fixture('test-archivio');
    const b = new ArchiveBook(lv);
    const r = b.recordedRowAt(1);
    expect(r?.row.hour).toBe(lv.startHour + 1);
    expect(r?.before.hour).toBe(lv.startHour);
    expect(b.recordedRowAt(99)).toBeNull();
    expect(b.openHoles()).toHaveLength(b.holes().length);
  });
});

describe('Archivio: righe registrate e strappi nel modello di disegno', () => {
  it('dopo la riga corrente si vedono le righe registrate non strappate; a rammendo fatto spariscono i segni', () => {
    const lv = contentLevel('arc1');
    const s = new Session(nightParams(lv, { mode: 'archivio', origin: 'archivio' }));
    const vis = buildVisuals(lv, new Map());
    const inp = { session: s, visuals: vis, visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false };
    const m = buildLaceModel(inp, null);
    const holes = lv.archive!.holes;
    const holeIdx = new Set<number>();
    for (const h of holes) for (let x = h.from; x <= h.to; x++) holeIdx.add(x - lv.startHour);
    // Le righe dopo la corrente che non sono strappate ci sono tutte.
    const expected: number[] = [];
    for (let i = m.current + 1; i <= m.rows; i++) if (!holeIdx.has(i)) expected.push(i);
    expect(m.recorded.map((r) => r.index)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
    expect(m.torn).toEqual(holes.map((h) => ({ from: h.from - lv.startHour, to: h.to - lv.startHour })));
    mendWithRecorded(s);
    const done = buildLaceModel(inp, m);
    expect(done.recorded).toEqual([]);
    expect(done.torn).toEqual([]);
  });

  it('nessuna riga registrata fuori dall\'Archivio', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv));
    const m = buildLaceModel({ session: s, visuals: buildVisuals(lv, new Map()), visualsVersion: 0, gradi: [], placingOccasions: false, echoesOpen: false }, null);
    expect(m.recorded).toEqual([]);
    expect(m.torn).toEqual([]);
  });
});

describe('la lettera trema verso il destinatario (GDD 9, 3.15)', () => {
  it('alle 7 del prologo la lettera di Teresa trema verso Don Piero, consegnata non trema più', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv));
    s.propose({ pair: 0, over: 'R' });
    s.fix();
    const rec = letterRecipients(lv);
    expect(rec.get('L1')).toBe('piero');
    // Marta, Teresa, Piero: Piero è a destra di Teresa.
    let stacks = stacksOf(s.state, beadTypesOf(lv), rec);
    const letter = stacks.find((x) => x.thread === 'teresa')?.beads.find((b) => b.id === 'L1');
    expect(letter?.tremble).toBe(1);
    // Teresa sopra Piero: consegnata.
    s.propose({ pair: 1, over: 'L' });
    stacks = stacksOf(s.preview().state, beadTypesOf(lv), rec);
    const held = stacks.find((x) => x.thread === 'piero')?.beads.find((b) => b.id === 'L1');
    expect(held?.delivered).toBe(true);
    expect(held?.tremble).toBe(0);
  });

  it('senza destinatario accanto, ferma', () => {
    const lv = fixture('g00');
    const s = new Session(nightParams(lv));
    // All'apertura Teresa è al Forno e Don Piero in Chiesa: non sono vicini.
    const stacks = stacksOf(s.state, beadTypesOf(lv), letterRecipients(lv));
    expect(stacks.find((x) => x.thread === 'teresa')?.beads.find((b) => b.id === 'L1')?.tremble).toBe(0);
  });
});

describe('schermi bassi', () => {
  const NO_SAFE = { top: 0, right: 0, bottom: 0, left: 0 };
  const vp = (w: number, h: number): Viewport => computeViewport(w, h, 2, NO_SAFE, 1);

  it('telefono in orizzontale (844×390): la fascia dei fusi si accorcia e il merletto mostra almeno due righe', () => {
    const l = computeTomboloLayout(vp(844, 390), 6, 14);
    expect(l.spindles.h).toBeLessThan(BAND.spindles);
    expect(l.spindles.h).toBeGreaterThanOrEqual(SPINDLES_MIN);
    expect(l.lace.h).toBeGreaterThanOrEqual(l.rowH * 2);
    expect(l.spindleH).toBe(l.spindles.h - 10);
  });

  it('i telefoni in verticale tengono le fasce del GDD', () => {
    for (const [w, h] of [[360, 640], [390, 844]] as const) {
      const l = computeTomboloLayout(vp(w, h), 6, 14);
      expect(l.spindles.h).toBe(BAND.spindles);
    }
  });

  it('lo scorrimento automatico non nasconde mai la riga corrente', () => {
    for (const [w, h] of [[844, 390], [360, 640], [1280, 720]] as const) {
      const l = computeTomboloLayout(vp(w, h), 6, 14);
      for (let cur = 1; cur <= l.rows; cur++) {
        const sc = autoScroll(l, cur);
        expect(rowTop(l, cur) - sc, `${w}×${h} riga ${cur}`).toBeGreaterThanOrEqual(0);
        expect(rowBottom(l, cur) - sc, `${w}×${h} riga ${cur}`).toBeLessThanOrEqual(l.lace.h);
      }
    }
  });
});
