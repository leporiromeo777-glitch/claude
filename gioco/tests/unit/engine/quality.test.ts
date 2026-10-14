/**
 * Criteri di qualità dei livelli (revisione 1, C14): il giudizio puro K1-K7 con
 * esenzioni e facili, e `levels:check` su contenuti in miniatura con i valori
 * attesi di ogni criterio (minimo, minimo senza Gino, costo, righe vuote,
 * soluzioni ottime, designata, violazioni), --facile, --qualita, --max-states.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CampaignDef, Condition, LevelComputed, LevelDef, NoteDef, RowMoves } from '../../../src/core/types';
import type { QualityInput, QualityItem } from '../../../src/engine/quality';
import { QUALITY, designata, dilemmaRequired, emptyRows, judgeQuality, qualityExemption } from '../../../src/engine/quality';
import { CHECK_MAX_STATES, gddMinRanges, runCheck } from '../../../tools/levels/check';
import { formatReport } from '../../../tools/levels/report';
import { FIXTURES, fixture, mk } from './helpers';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
const quiet = { log: () => undefined };

function contentDir(levels: LevelDef[], notes: NoteDef[], days: CampaignDef['days']): string {
  const base = mkdtempSync(join(tmpdir(), 'trama-quality-'));
  dirs.push(base);
  const lv = join(base, 'levels');
  mkdirSync(lv);
  for (const l of levels) writeFileSync(join(lv, `${l.id}.json`), JSON.stringify(l));
  writeFileSync(join(base, 'notes.test.json'), JSON.stringify(notes));
  const campaign: CampaignDef = { choiceDay: 'g23', finals: { merlettaia: 'fin_merlettaia', seppia: 'fin_seppia', chiuso: 'fin_chiuso', aperto: 'fin_aperto' }, days };
  writeFileSync(join(base, 'campaign.json'), JSON.stringify(campaign));
  return lv;
}
const note = (id: string, day: string, request: Condition): NoteDef => ({ id, day, author: 'nina', textKey: `test.${id}`, request });
const readComputed = (dir: string, id: string): LevelComputed => JSON.parse(readFileSync(join(dir, `${id}.computed.json`), 'utf8')) as LevelComputed;

// ───────────── Giudizio puro ─────────────

const cfg = (kind: QualityItem['kind'], notes: string[], min: number | null, extra: Partial<QualityItem> = {}): QualityItem => ({
  kind,
  notes,
  config: kind === 'base' ? 'base' : notes.join('+'),
  min,
  minSenzaGino: null,
  vuoteMax: 0,
  vuoteTot: 0,
  soluzioniOttime: 1,
  ...extra,
});

function input(items: QualityItem[], extra: Partial<QualityInput> = {}): QualityInput {
  return { levelId: 'g10', act: 2, rows: 10, gino: false, exemption: null, items, volute: [['a', 'b']], facili: [], ...extra };
}
const codes = (j: ReturnType<typeof judgeQuality>): string[] => j.report.violazioni.map((v) => v.split(' ').slice(0, 2).join(' '));

describe('criteri di qualità: giudizio (C14)', () => {
  it('righe vuote: di fila e in tutto (gli incroci forzati non contano)', () => {
    const r = (n: number, forced = false): RowMoves => ({ hour: 0, crossings: Array.from({ length: n }, (_, i) => ({ pair: i * 2, over: 'L' as const, ...(forced ? { forced: true } : {}) })) });
    expect(emptyRows([r(1), r(0), r(0), r(1, true), r(2), r(0)])).toEqual({ vuoteMax: 3, vuoteTot: 4 });
    expect(emptyRows([])).toEqual({ vuoteMax: 0, vuoteTot: 0 });
  });

  it('designata: la più cara, a parità quella con più bigliettini', () => {
    const items = [cfg('base', [], 4), cfg('note', ['a'], 7), cfg('note', ['b'], 5), cfg('combo', ['a', 'b'], 7), cfg('note', ['c'], null)];
    expect(designata(items)?.config).toBe('a+b');
    expect(designata([cfg('base', [], 2)])?.config).toBe('base');
  });

  it('tutto in regola: nessuna violazione', () => {
    const j = judgeQuality(input([cfg('base', [], 5), cfg('note', ['a'], 8, { costo: 3 }), cfg('note', ['b'], 9, { costo: 4 }), cfg('combo', ['a', 'c'], 10)]));
    expect(j.report.violazioni).toEqual([]);
    expect(j.report.designata).toBe('a+c');
    expect(j.byCriterion).toEqual({ K1: 0, K2: 0, K3: null, K4: 0, K5: 0, K6: 0 });
    expect(j.report.configs[0]).toEqual({ config: 'base', min: 5, minSenzaGino: null, vuoteMax: 0, vuoteTot: 0, soluzioniOttime: 1 });
  });

  it('K1 densità: designata e bigliettini sotto ⌈righe/2⌉', () => {
    const j = judgeQuality(input([cfg('base', [], 2), cfg('note', ['a'], 4, { costo: 2 }), cfg('note', ['b'], 5, { costo: 3 })], { rows: 9, act: 1 }));
    expect(codes(j)).toEqual(['K1 a:']);
    expect(j.report.violazioni[0]).toContain('needs at least 5');
  });

  it('K2 costo: 2 nell\'Atto I, 3 negli Atti II-III; g01 esente', () => {
    const items = [cfg('base', [], 6), cfg('note', ['a'], 8, { costo: 2 }), cfg('note', ['b'], 6, { costo: 0 })];
    expect(codes(judgeQuality(input(items, { act: 1, rows: 8 })))).toEqual(['K2 b:']);
    expect(codes(judgeQuality(input(items, { act: 2, rows: 8 })))).toEqual(['K2 a:', 'K2 b:']);
    const g01 = judgeQuality(input(items, { act: 1, rows: 8, levelId: 'g01', exemption: 'K2' }));
    expect(g01.report.violazioni).toEqual([]);
    expect(g01.byCriterion.K2).toBeNull();
  });

  it('facile: esente da K1 e K2, solo in un conflitto voluto, al massimo uno per sera', () => {
    const items = [cfg('base', [], 6), cfg('note', ['a'], 9, { costo: 3 }), cfg('note', ['b'], 6, { costo: 0 }), cfg('note', ['c'], 6, { costo: 0 })];
    const ok = judgeQuality(input(items, { rows: 12, facili: ['b'], volute: [['a', 'b']] }));
    expect(codes(ok)).toEqual(['K2 c:']);
    expect(ok.report.facili).toEqual(['b']);
    const loose = judgeQuality(input(items, { rows: 12, facili: ['c'], volute: [['a', 'b']] }));
    expect(loose.report.violazioni.some((v) => v.startsWith('K2 c: marked facile but it is not in an intended conflict'))).toBe(true);
    const single = judgeQuality(input(items, { rows: 12, facili: ['b'], volute: [['b']] }));
    expect(single.report.violazioni.some((v) => v.includes('not in an intended conflict'))).toBe(true);
    const two = judgeQuality(input(items, { rows: 12, facili: ['b', 'c'], volute: [['b', 'c']] }));
    expect(two.report.violazioni.some((v) => v.startsWith('K2 2 notes marked facile'))).toBe(true);
  });

  it('K3 Gino: al massimo il 40% del minimo, solo con Gino', () => {
    const items = [cfg('base', [], 10, { minSenzaGino: 6 }), cfg('note', ['a'], 13, { costo: 3, minSenzaGino: 7 })];
    const j = judgeQuality(input(items, { gino: true }));
    expect(codes(j)).toEqual(['K3 a:']);
    expect(j.byCriterion.K3).toBe(1);
    expect(judgeQuality(input(items, { gino: false })).report.violazioni).toEqual([]);
    const unknown = judgeQuality(input([cfg('base', [], 10, { minSenzaGino: null })], { gino: true }));
    expect(unknown.warnings[0]).toContain('not verified');
  });

  it('K4 ritmo: 2 vuote di fila e il 40% in tutto, su designata e bigliettini', () => {
    const items = [cfg('base', [], 6), cfg('note', ['a'], 9, { costo: 3, vuoteMax: 3, vuoteTot: 3 }), cfg('note', ['b'], 9, { costo: 3, vuoteMax: 2, vuoteTot: 5 })];
    expect(codes(judgeQuality(input(items)))).toEqual(['K4 a:', 'K4 b:']);
    expect(codes(judgeQuality(input([cfg('base', [], 6, { vuoteMax: 3, vuoteTot: 5 })])))).toEqual(['K4 base:', 'K4 base:']);
  });

  it('K5 ambiguità: al massimo 20 soluzioni ottime per la designata', () => {
    const items = [cfg('base', [], 6, { soluzioniOttime: 50 }), cfg('note', ['a'], 9, { costo: 3, soluzioniOttime: 21 })];
    const j = judgeQuality(input(items));
    expect(codes(j)).toEqual(['K5 a:']);
    expect(judgeQuality(input([cfg('base', [], 6, { soluzioniOttime: 50 })])).report.violazioni[0]).toContain('at least 50');
  });

  it('K6 dilemma: almeno un conflitto voluto da g03 a g22', () => {
    const items = [cfg('base', [], 6)];
    expect(codes(judgeQuality(input(items, { volute: [] })))).toEqual(['K6 no']);
    expect(judgeQuality(input(items, { volute: [], levelId: 'g23' })).report.violazioni).toEqual([]);
    expect(judgeQuality(input(items, { volute: [], levelId: 'test-x' })).byCriterion.K6).toBeNull();
    expect([2, 3, 22, 23].map((n) => dilemmaRequired(`g${String(n).padStart(2, '0')}`))).toEqual([false, true, true, false]);
  });

  it('K7 intervallo: solo avviso, con tolleranza 1', () => {
    const j = judgeQuality(input([cfg('base', [], 12)], { minRange: [8, 10] }));
    expect(j.report.violazioni).toEqual([]);
    expect(j.warnings[0]).toMatch(/^K7 base: designated minimum 12 outside the GDD 5.2 range 8-10/);
    expect(judgeQuality(input([cfg('base', [], 11)], { minRange: [8, 10] })).warnings).toEqual([]);
  });

  it('esenzioni: g00, Archivi, fin_chiuso, autotessitura; fin_merlettaia con base ≥ 8, K3 e K4', () => {
    expect(qualityExemption(fixture('g00'))).toBe('tutti');
    expect(qualityExemption(fixture('test-archivio'))).toBe('tutti');
    expect(qualityExemption(fixture('test-seppia'))).toBe('tutti');
    expect(qualityExemption(mk({ id: 'fin_chiuso', initial: ['nina'] }))).toBe('tutti');
    expect(qualityExemption(mk({ id: 'g01', initial: ['nina'] }))).toBe('K2');
    expect(qualityExemption(mk({ id: 'fin_merlettaia', initial: ['nina'] }))).toBe('merlettaia');
    const bad = [cfg('base', [], 2, { vuoteMax: 5, vuoteTot: 7, soluzioniOttime: 50, minSenzaGino: 0 })];
    const none = judgeQuality(input(bad, { exemption: 'tutti', gino: true, volute: [] }));
    expect(none.report.violazioni).toEqual([]);
    expect(Object.values(none.byCriterion).every((v) => v === null)).toBe(true);
    const merl = judgeQuality(input(bad, { levelId: 'fin_merlettaia', exemption: 'merlettaia', gino: true, rows: 12, volute: [] }));
    expect(codes(merl)).toEqual(['K1 base:', 'K3 base:', 'K4 base:', 'K4 base:']);
    expect(merl.report.violazioni[0]).toContain(`at least ${QUALITY.merlettaiaMin}`);
  });
});

// ───────────── levels:check ─────────────

/**
 * g05 in miniatura (4 colonne, 6→10): A incontra(nina, bepi) costa 3; B presso(marta, molo, 7)
 * costa 1; C nonIncontra(nina, marta) costa 0; B + C è impossibile (Marta al Molo alle 7 deve
 * incrociare Nina).
 */
const MQ = mk({ id: 'g05', kind: 'storia', act: 1, initial: ['nina', 'marta', 'piero', 'bepi'], matassa: 6, notes: ['mq.a', 'mq.b', 'mq.c'] });
const MQ_NOTES = [
  note('mq.a', 'g05', { t: 'incontra', a: 'nina', b: 'bepi' }),
  note('mq.b', 'g05', { t: 'presso', who: 'marta', place: 'molo', hour: 7 }),
  note('mq.c', 'g05', { t: 'nonIncontra', a: 'nina', b: 'marta' }),
];

describe('levels:check: criteri di qualità', () => {
  it('fixture test-gino: minimo 3, senza Gino 0, righe vuote, soluzioni ottime; K3 e K4', () => {
    const res = runCheck({ dir: FIXTURES, only: ['test-gino'], write: false, ...quiet });
    const q = res.levels[0]?.computed?.quality;
    expect(q).toEqual({
      configs: [{ config: 'base', min: 3, minSenzaGino: 0, vuoteMax: 1, vuoteTot: 3, soluzioniOttime: 16 }],
      designata: 'base',
      facili: [],
      violazioni: [expect.stringMatching(/^K3 base: Gino makes 3 of 3 crossings/), expect.stringMatching(/^K4 base: 3 empty rows of 6/)],
    });
    expect(res.levels[0]?.row.quality).toEqual({ K1: 0, K2: 0, K3: 1, K4: 1, K5: 0, K6: null });
    expect(res.errors).toBe(0);
  }, 30_000);

  it('g05 in miniatura: valori di ogni configurazione, designata, violazioni K1 K2 K4; K6 col conflitto voluto', () => {
    const dir = contentDir([MQ], MQ_NOTES, [{ id: 'g05', act: 1, pins: 2, stonatura: 1 }]);
    const first = runCheck({ dir, ...quiet });
    // B + C impossibile e non marcata: errore, e senza conflitto voluto anche K6.
    expect(first.errors).toBe(1);
    expect(first.levels[0]?.computed?.quality?.violazioni).toContain('K6 no intended conflict in the evening (no combination marked voluta)');
    const res = runCheck({ dir, voluta: ['g05:mq.b+mq.c'], ...quiet });
    expect(res.errors).toBe(0);
    const q = readComputed(dir, 'g05').quality;
    expect(q?.designata).toBe('mq.a+mq.b');
    expect(q?.configs).toEqual([
      { config: 'base', min: 0, minSenzaGino: null, vuoteMax: 4, vuoteTot: 4, soluzioniOttime: 1 },
      { config: 'mq.a', min: 3, minSenzaGino: null, costo: 3, vuoteMax: 2, vuoteTot: 2, soluzioniOttime: 22 },
      { config: 'mq.b', min: 1, minSenzaGino: null, costo: 1, vuoteMax: 3, vuoteTot: 3, soluzioniOttime: 1 },
      { config: 'mq.c', min: 0, minSenzaGino: null, costo: 0, vuoteMax: 4, vuoteTot: 4, soluzioniOttime: 1 },
      { config: 'mq.a+mq.b', min: 3, minSenzaGino: null, vuoteMax: 2, vuoteTot: 2, soluzioniOttime: 9 },
      { config: 'mq.a+mq.c', min: 3, minSenzaGino: null, vuoteMax: 1, vuoteTot: 1, soluzioniOttime: 4 },
    ]);
    expect(q?.violazioni.map((v) => v.split(':')[0])).toEqual([
      'K1 mq.b', 'K1 mq.c', 'K2 mq.b', 'K2 mq.c',
      'K4 mq.a+mq.b', 'K4 mq.a', 'K4 mq.b', 'K4 mq.b', 'K4 mq.c', 'K4 mq.c',
    ]);
    expect(res.levels[0]?.row.quality).toEqual({ K1: 2, K2: 2, K3: null, K4: 6, K5: 0, K6: 0 });
    // Le violazioni sono avvisi; con --qualita diventano errori.
    const qw = res.levels[0]?.warnings.filter((w) => w.includes('[quality]')) ?? [];
    expect(qw).toHaveLength(11);
    // K7 (solo avviso): g05 in GDD 5.2 ha "Min" 5-8, la designata 3.
    expect(qw.filter((w) => w.includes('[quality] K7'))).toEqual(['levels/g05: [quality] K7 mq.a+mq.b: designated minimum 3 outside the GDD 5.2 range 5-8 (±1)']);
    const strict = runCheck({ dir, qualita: true, write: false, ...quiet });
    expect(strict.errors).toBe(10);
  }, 30_000);

  it('--facile: il segno resta nel computed, toglie K1 e K2 al bigliettino, e si toglie con -nota', () => {
    const dir = contentDir([MQ], MQ_NOTES, [{ id: 'g05', act: 1, pins: 2, stonatura: 1 }]);
    runCheck({ dir, voluta: ['g05:mq.b+mq.c'], facile: ['g05:mq.c'], ...quiet });
    let q = readComputed(dir, 'g05').quality;
    expect(q?.facili).toEqual(['mq.c']);
    expect(q?.violazioni.filter((v) => v.startsWith('K1') || v.startsWith('K2')).map((v) => v.split(':')[0])).toEqual(['K1 mq.b', 'K2 mq.b']);
    runCheck({ dir, ...quiet });
    q = readComputed(dir, 'g05').quality;
    expect(q?.facili).toEqual(['mq.c']);
    // Un secondo facile: al massimo uno per sera.
    runCheck({ dir, facile: ['g05:mq.b'], ...quiet });
    q = readComputed(dir, 'g05').quality;
    expect(q?.violazioni.some((v) => v.startsWith('K2 2 notes marked facile'))).toBe(true);
    // A non è in un conflitto voluto.
    runCheck({ dir, facile: ['g05:-mq.b', 'g05:-mq.c', 'g05:mq.a'], ...quiet });
    q = readComputed(dir, 'g05').quality;
    expect(q?.facili).toEqual(['mq.a']);
    expect(q?.violazioni).toContain('K2 mq.a: marked facile but it is not in an intended conflict (voluta) with another note');
    const bad = runCheck({ dir, facile: ['g05:mq.zz'], write: false, ...quiet });
    expect(bad.levels[0]?.warnings[0]).toContain('--facile g05:mq.zz: no such note');
  }, 30_000);

  it('--max-states: il limite passa al solver (predefinito 1 500 000)', () => {
    expect(CHECK_MAX_STATES).toBe(1_500_000);
    const res = runCheck({ dir: FIXTURES, only: ['test-grande'], write: false, maxStates: 500, ...quiet });
    expect(res.errors).toBe(1);
    expect(res.levels[0]?.errors[0]).toContain('state limit');
  }, 30_000);

  it('--report: colonne K1…K6', () => {
    const res = runCheck({ dir: FIXTURES, only: ['g00', 'test-gino'], write: false, ...quiet });
    const head = res.report.split('\n')[0] ?? '';
    for (const k of ['K1', 'K2', 'K3', 'K4', 'K5', 'K6']) expect(head).toContain(k);
    const gino = res.report.split('\n').find((l) => l.startsWith('test-gino')) ?? '';
    expect(gino).toContain('✗1');
    const row = res.levels[0]?.row;
    if (!row) throw new Error('no row');
    expect(formatReport([{ ...row, quality: null }]).split('\n')[2]).toContain('–');
  }, 30_000);

  it('K7: intervalli "Min" dalle tabelle di GDD 5.2', () => {
    const r = gddMinRanges();
    expect(r.get('g01')).toEqual([3, 5]);
    expect(r.get('g06')).toEqual([5, 5]);
    expect(r.get('g13')).toEqual([10, 12]);
  });

  it('Archivio: esente, con il rammendo come base', () => {
    const res = runCheck({ dir: FIXTURES, only: ['test-archivio'], write: false, ...quiet });
    const q = res.levels[0]?.computed?.quality;
    expect(q?.violazioni).toEqual([]);
    expect(q?.configs[0]).toMatchObject({ config: 'base', min: 3, minSenzaGino: null });
    expect(q?.configs[0]?.soluzioniOttime).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
