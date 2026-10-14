import { describe, expect, it } from 'vitest';
import { Session, DROPPED_KEY, ARCHIVE_MISMATCH_KEY } from '../../../src/tombolo/session';
import { fixture, fixtureComputed, fixtureNotes, nightParams, recorder } from './helpers';
import type { AcceptedRequest, SolveResult } from '../../../src/core/types';
import { solve } from '../../../src/engine/index';

const syncSolver = async (req: Parameters<typeof solve>[0]): Promise<SolveResult> => solve(req);

describe('NightSession: il prologo (GDD 3.15)', () => {
  it('si completa con 4 incroci e la lettera consegnata', () => {
    const rec = recorder();
    const lv = fixture('g00');
    const s = new Session(nightParams(lv), { emit: rec.emit, computed: fixtureComputed('g00') });
    expect(s.hour).toBe(6);
    expect(s.propose({ pair: 0, over: 'R' })).toBeNull();
    expect(s.fix().ok).toBe(true);
    expect(s.propose({ pair: 1, over: 'L' })).toBeNull();
    expect(s.fix().ok).toBe(true);
    expect(s.propose({ pair: 1, over: 'L' })).toBeNull();
    expect(s.fix().ok).toBe(true);
    // Teresa su Marta: «No.»
    const v = s.propose({ pair: 0, over: 'R' });
    expect(v?.code).toBe('rifiuto');
    expect(rec.of('night:violation')[0]?.v.code).toBe('rifiuto');
    expect(rec.of('quirk:discovered').map((q) => q.quirk)).toEqual(['teresaLegge', 'martaNoSotto']);
    expect(s.propose({ pair: 0, over: 'L' })).toBeNull();
    expect(s.fix().ok).toBe(true);
    expect(s.done).toBe(true);
    const o = s.complete();
    expect(o.metrics.incroci).toBe(4);
    expect(o.metrics.minIncroci).toBe(4);
    expect(o.metrics.filoDOro).toBe(true);
    expect(o.goals[0]?.status).toBe('soddisfatta');
    expect(o.timeline[o.timeline.length - 1]?.pos).toEqual(['teresa', 'marta', 'piero']);
    expect(rec.of('night:complete')).toHaveLength(1);
    expect(rec.of('night:row')).toHaveLength(4);
    expect(o.spartito.startsWith('TRAMA1-Sg00-')).toBe(true);
  });

  it('riconosce il verso sbagliato della lettera alle 7', () => {
    const s = new Session(nightParams(fixture('g00')));
    s.propose({ pair: 0, over: 'R' });
    s.fix();
    // Piero sopra Teresa: la lettera resta a Teresa.
    expect(s.propose({ pair: 1, over: 'R' })).toBeNull();
    expect(s.wrongSide(1)).toBe(true);
    expect(s.flip(1)).toBeNull();
    expect(s.wrongSide(1)).toBe(false);
  });

  it('Fissa l\'ora con uno spillo non rispettato dà la violazione spillo', () => {
    const rec = recorder();
    const s = new Session(nightParams(fixture('g00')), { emit: rec.emit });
    const r = s.fix();
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.code).toBe('spillo');
    expect(rec.of('night:violation')).toHaveLength(1);
  });

  it('Disfa toglie l\'incrocio e poi riapre la riga precedente', () => {
    const rec = recorder();
    const s = new Session(nightParams(fixture('g00')), { emit: rec.emit });
    s.propose({ pair: 0, over: 'R' });
    s.fix();
    s.propose({ pair: 1, over: 'L' });
    s.undo();
    expect(s.draft).toHaveLength(0);
    s.undo();
    expect(s.rows).toHaveLength(0);
    expect(s.draft).toEqual([{ pair: 0, over: 'R' }]);
    expect(rec.of('night:undo').map((u) => u.hour)).toEqual([7, 6]);
  });

  it('riavvolge fino a un\'ora passata', () => {
    const s = new Session(nightParams(fixture('g00')));
    for (const c of [{ pair: 0, over: 'R' as const }, { pair: 1, over: 'L' as const }, { pair: 1, over: 'L' as const }]) {
      s.propose(c);
      s.fix();
    }
    expect(s.hour).toBe(9);
    s.rewindTo(6);
    expect(s.hour).toBe(7);
    expect(s.rows).toHaveLength(1);
    s.rewindTo(5);
    expect(s.rows).toHaveLength(0);
  });

  it('la ripresa riporta righe, bozza e richieste lasciate cadere', () => {
    const lv = fixture('g06');
    const notes = fixtureNotes();
    const accepted: AcceptedRequest[] = notes.slice(0, 2).map((n) => ({ noteId: n.id, request: n.request!, author: n.author }));
    const s = new Session(nightParams(lv, { accepted }));
    s.fix();
    s.fix();
    expect(s.propose({ pair: 3, over: 'L' })).toBeNull();
    s.drop('g06.marta');
    const resume = s.toResume();
    const r = new Session(nightParams(lv, { accepted, resume }));
    expect(r.hour).toBe(s.hour);
    expect(r.draft).toEqual(s.draft);
    expect(r.dropped).toEqual(['g06.marta']);
    expect(r.requestStatus().find((x) => x.noteId === 'g06.marta')?.report.reasonKey).toBe(DROPPED_KEY);
  });

  it('suggerimenti: fantasma della riga corrente e filo d\'oro perso', async () => {
    const s = new Session(nightParams(fixture('g00')), { computed: fixtureComputed('g00'), solveAsync: syncSolver });
    const h = await s.hint('fantasma');
    expect(h.ghost).toEqual({ pair: 0, over: 'R' });
    expect(s.fantasmaUsed).toBe(true);
    const i = await s.hint('indizio');
    expect(i.textKey).toBe('tombolo.hint.indizio.sopra');
  });
});

describe('NightSession: Archivio', () => {
  it('nomi confermati solo con 3 giusti, rammendo solo se coincide', () => {
    const lv = fixture('test-archivio');
    const s = new Session(nightParams(lv, { mode: 'archivio', origin: 'archivio' }));
    const book = s.archive!;
    // Le righe registrate prima dello strappo sono già al loro posto.
    expect(s.hour).toBe(8);
    expect(s.matassa()).toEqual({ used: 0, total: 3 });
    expect(book.name('f1', 'marta').confirmed).toEqual([]);
    expect(book.name('f2', 'clotilde').confirmed).toEqual([]);
    expect(book.name('f3', 'piero').confirmed).toEqual([]);
    expect(book.counter()).toEqual({ correct: 2, needed: 3, remaining: 4 });
    const r = book.name('f2', 'teresa');
    expect(r.confirmed.sort()).toEqual(['f1', 'f2', 'f3']);
    expect(book.allNamed()).toBe(false);
    expect(book.name('f4', 'nina').confirmed).toEqual(['f4']);
    expect(book.allNamed()).toBe(true);
    // Rammendo sbagliato: nessun incrocio alle 8 e 9.
    s.fix();
    const bad = s.fix();
    expect(bad.ok).toBe(false);
    expect(bad.violations[0]?.messageKey).toBe(ARCHIVE_MISMATCH_KEY);
    s.undo();
    expect(s.hour).toBe(8);
    expect(s.propose({ pair: 1, over: 'R' })).toBeNull();
    expect(s.fix().ok).toBe(true);
    s.propose({ pair: 0, over: 'L' });
    s.propose({ pair: 2, over: 'R' });
    expect(s.fix().ok).toBe(true);
    expect(s.done).toBe(true);
    expect(book.allMended()).toBe(true);
    const o = s.complete();
    expect(o.archive).toEqual({ named: true, mended: true });
  });
});

describe('NightSession: occasioni, filo controllato, spartito', () => {
  it('con occasionsSolution gli obiettivi risultano soddisfatti', () => {
    const lv = fixture('test-occasioni');
    const c = fixtureComputed('test-occasioni');
    const s = new Session(nightParams(lv, { mode: 'occasioni', origin: 'campagna' }));
    expect(s.setOccasions(c.occasionsSolution!)).toHaveLength(2);
    while (s.stepAuto()) {
      /* Lascia accadere */
    }
    expect(s.done).toBe(true);
    expect(s.succeeded()).toBe(true);
    const o = s.complete();
    expect(o.goals.every((g) => g.status === 'soddisfatta')).toBe(true);
    expect(o.occasions).toHaveLength(2);
  });

  it('senza occasioni non basta, e si può riprovare', () => {
    const lv = fixture('test-occasioni');
    const s = new Session(nightParams(lv, { mode: 'occasioni' }));
    while (s.stepAuto()) {
      /* niente */
    }
    expect(s.succeeded()).toBe(false);
    s.retry();
    expect(s.rows).toHaveLength(0);
  });

  it('filo controllato: si muove solo Ada, gli altri da soli', () => {
    const lv = fixture('test-seppia');
    const sol = fixtureComputed('test-seppia').base.rows;
    const s = new Session(nightParams(lv, { mode: 'controllato', origin: 'campagna' }));
    for (const r of sol) {
      const mine = r.crossings.filter((x) => !x.forced);
      for (const c of mine) expect(s.propose(c)).toBeNull();
      expect(s.fix().ok).toBe(true);
    }
    expect(s.done).toBe(true);
    expect(s.complete().goals[0]?.status).toBe('soddisfatta');
  });

  it('lo spartito si ritesse identico', () => {
    const lv = fixture('g00');
    const a = new Session(nightParams(lv));
    for (const c of [{ pair: 0, over: 'R' as const }, { pair: 1, over: 'L' as const }, { pair: 1, over: 'R' as const }, { pair: 0, over: 'L' as const }]) {
      a.propose(c);
      a.fix();
    }
    const out = a.complete();
    const b = new Session(nightParams(lv, { mode: 'replay', origin: 'spartito', replay: out.rows }));
    while (b.stepAuto()) {
      /* ritesse */
    }
    expect(b.rows).toEqual(out.rows);
    expect(b.complete().spartito).toBe(out.spartito);
  });
});
