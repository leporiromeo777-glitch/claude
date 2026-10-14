/**
 * Verifica del motore: confronto del solver con una ricerca esaustiva su
 * livelli casuali piccoli (stesse regole pubbliche: applyRow + evaluate), e
 * casi di regressione trovati in verifica (segreto di lettura nelle condizioni,
 * suggerimenti al limite di stati, ripartenza con la matassa dello stato,
 * ripiego del generatore, Archivio in levels:check).
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { AgendaItem, BeadDef, Condition, Crossing, LaceEvent, LaceState, LevelDef, PlaceId, QuirkId, RowMoves, ThreadDef } from '../../../src/core/types';
import { PLACE_ORDER } from '../../../src/core/types';
import { intBetween, pick, rngFromSeed, shuffle } from '../../../src/core/rng';
import {
  HINT_KEYS,
  applyRow,
  createContext,
  evaluate,
  generate,
  hintFor,
  initialState,
  minRange,
  simulate,
  simulateAndEvaluate,
  solve,
} from '../../../src/engine/index';
import { runCheck } from '../../../tools/levels/check';
import { L, fixture, mk } from './helpers';

// ───────────── Solver contro ricerca esaustiva ─────────────

const CHARS = ['teresa', 'marta', 'piero', 'gino', 'nina', 'zeno', 'lunardi', 'bepi'];
const QUIRK_OF: Record<string, QuirkId> = {
  teresa: 'teresaLegge',
  marta: 'martaNoSotto',
  piero: 'pieroPozzo',
  gino: 'ginoCorre',
  nina: 'ninaCuriosa',
  zeno: 'zenoFaro',
  lunardi: 'lunardiCura',
};

function allRows(W: number): Crossing[][] {
  const out: Crossing[][] = [];
  for (let mask = 0; mask < 1 << (W - 1); mask++) {
    if (mask & (mask << 1)) continue;
    const pairs: number[] = [];
    for (let p = 0; p < W - 1; p++) if (mask & (1 << p)) pairs.push(p);
    for (let v = 0; v < 1 << pairs.length; v++) out.push(pairs.map((p, i) => ({ pair: p, over: v & (1 << i) ? 'R' : 'L' })));
  }
  return out;
}

function randomCondition(rng: () => number, lv: LevelDef, depth = 0): Condition {
  const all = lv.threads.map((t) => t.id);
  const named = lv.threads.filter((t) => t.kind !== 'lino').map((t) => t.id);
  const letters = lv.beads.filter((b) => b.type === 'lettera').map((b) => b.id);
  const beads = [...lv.beads.map((b) => b.id), ...letters.map((l) => `letta:${l}`)];
  const hour = (): number => intBetween(rng, lv.startHour, lv.endHour);
  if (depth === 0 && rng() < 0.12) {
    const k = rng();
    const a = randomCondition(rng, lv, 1);
    const b = randomCondition(rng, lv, 1);
    return k < 0.4 ? { t: 'tutti', of: [a, b] } : k < 0.7 ? { t: 'almeno', n: 1, of: [a, b] } : { t: 'non', c: a };
  }
  const who = pick(all, rng);
  const other = pick(all.filter((x) => x !== who), rng);
  const bead = beads.length > 0 ? pick(beads, rng) : 'nessuna';
  switch (pick(['presso', 'maiPresso', 'incontra', 'nonIncontra', 'sopra', 'consegnata', 'ha', 'nonHa', 'parte', 'resta', 'esceCon', 'sano', 'incontriAlmeno'], rng)) {
    case 'presso':
      return { t: 'presso', who, place: pick(lv.columns, rng), hour: hour() };
    case 'maiPresso': {
      const from = hour();
      return { t: 'maiPresso', who, place: pick(lv.columns, rng), from, to: intBetween(rng, from, lv.endHour) };
    }
    case 'incontra':
      return rng() < 0.5 ? { t: 'incontra', a: who, b: other } : { t: 'incontra', a: who, b: other, from: lv.startHour + 1, to: hour() };
    case 'nonIncontra':
      return rng() < 0.3 ? { t: 'nonIncontra', a: who, b: '*' } : { t: 'nonIncontra', a: who, b: other, from: hour(), to: lv.endHour };
    case 'sopra':
      return rng() < 0.5 ? { t: 'sopra', a: who, b: other } : { t: 'sopra', a: who, b: other, to: hour() };
    case 'consegnata':
      return letters.length > 0 ? { t: 'consegnata', bead: pick(letters, rng), by: hour() } : { t: 'incontra', a: who, b: other };
    case 'ha':
      return rng() < 0.5 ? { t: 'ha', who, bead } : { t: 'ha', who, bead, by: hour() };
    case 'nonHa':
      return { t: 'nonHa', who, bead };
    case 'parte':
      return rng() < 0.5 ? { t: 'parte', who } : { t: 'parte', who, hour: hour() };
    case 'resta':
      return { t: 'resta', who };
    case 'esceCon':
      return { t: 'esceCon', bead, hour: hour() };
    case 'sano':
      return { t: 'sano', who };
    default:
      return { t: 'incontriAlmeno', who: pick(named.length > 0 ? named : all, rng), n: intBetween(rng, 1, 3) };
  }
}

/** Livello casuale piccolo (3-4 colonne, 3-5 righe) con stranezze, perline, bordi, marea, rancore, filo nero o autotessitura. */
function randomLevel(seed: string): { level: LevelDef; goals: Condition[] } {
  const rng = rngFromSeed(seed);
  const W = intBetween(rng, 3, 4);
  const rows = W === 3 ? intBetween(rng, 3, 5) : intBetween(rng, 3, 4);
  const picked = shuffle([...PLACE_ORDER], rng).slice(0, W);
  const columns = PLACE_ORDER.filter((p) => picked.includes(p)) as PlaceId[];
  const cast = shuffle(CHARS, rng).slice(0, W - (rng() < 0.5 ? 1 : 0));
  const threads: ThreadDef[] = cast.map((c) => ({ id: c, kind: 'persona', character: c as ThreadDef['character'] }));
  const initial = [...cast];
  if (initial.length < W) {
    threads.push({ id: 'lino1', kind: 'lino' });
    initial.push('lino1');
  }
  const init = shuffle(initial, rng);
  const quirks: QuirkId[] = [];
  for (const c of cast) {
    const q = QUIRK_OF[c];
    if (q && rng() < 0.8) quirks.push(q);
  }
  if (cast.includes('piero') && rng() < 0.4) quirks.push('pieroTrabocca');
  const beads: BeadDef[] = [];
  const nb = intBetween(rng, 0, 3);
  for (let i = 0; i < nb; i++) {
    const k = rng();
    if (k < 0.35) beads.push({ id: `L${i}`, type: 'lettera', holder: pick(init, rng), to: pick(init, rng), labelKey: 'x' });
    else if (k < 0.55) beads.push({ id: `voce:${i}`, type: 'voce', holders: [pick(init, rng)], labelKey: 'x' });
    else if (k < 0.8) beads.push({ id: `segreto:${i}`, type: 'segreto', holders: [pick(init, rng)], labelKey: 'x' });
    else if (!beads.some((b) => b.type === 'febbre')) beads.push({ id: 'febbre', type: 'febbre', holders: [pick(init, rng)], labelKey: 'x' });
  }
  const startHour = 6;
  const endHour = startHour + rows;
  const level: LevelDef = {
    id: 'casuale',
    kind: 'test',
    act: 1,
    titleKey: 'x',
    columns,
    startHour,
    endHour,
    threads,
    initial: init,
    beads,
    rules: ['incrocio', 'lettera', 'voce', 'segreto', 'febbre', 'rancore', 'marea', 'molo'],
    quirks,
    pins: [],
    matassa: intBetween(rng, 2, 8),
  };
  if (rng() < 0.3 && cast.length >= 2) level.rancor = [[cast[0] as string, cast[1] as string]];
  if (rng() < 0.25) level.tide = [{ from: intBetween(rng, 7, endHour), to: endHour, places: [pick(columns, rng)] }];
  if (rng() < 0.3) {
    const ext = rng() < 0.5 ? 'bepi' : 'marinaio';
    if (!threads.some((t) => t.id === ext)) {
      threads.push(ext === 'marinaio' ? { id: 'marinaio', kind: 'lino' } : { id: 'bepi', kind: 'persona', character: 'bepi' });
      level.edges = [{ hour: intBetween(rng, 7, endHour), side: rng() < 0.5 ? 'molo' : 'faro', kind: 'vaporetto', enters: ext }];
      if (rng() < 0.5) beads.push({ id: 'Lm', type: 'lettera', holder: ext, to: pick(init, rng), labelKey: 'x' });
    } else level.edges = [{ hour: intBetween(rng, 7, endHour), side: 'molo', kind: 'barca' }];
  }
  if (rng() < 0.4) level.pins = [{ thread: pick(init, rng), place: pick(columns, rng), hour: intBetween(rng, 7, endHour) }];
  const mode = rng();
  if (mode < 0.25) {
    threads.push({ id: 'livia', kind: 'nero', character: 'livia' });
    const agenda: AgendaItem[] = rng() < 0.6 ? [{ follow: pick(cast, rng) }, { follow: pick(cast, rng) }] : [{ place: pick(columns, rng), hour: intBetween(rng, 7, endHour) }];
    level.nero = { thread: 'livia', enter: { hour: intBetween(rng, 6, endHour - 1), side: rng() < 0.5 ? 'molo' : 'faro' }, agenda };
  } else if (mode < 0.4) {
    const ctrl = pick(init, rng);
    level.autoweave = {
      controlled: ctrl,
      agents: init
        .filter((t) => t !== ctrl && t !== 'lino1' && rng() < 0.7)
        .map((t) => ({ thread: t, agenda: [rng() < 0.5 ? { follow: pick(init, rng) } : { place: pick(columns, rng), hour: intBetween(rng, 7, endHour) }], likes: ['festa'] })),
    };
    if (rng() < 0.5) level.autoweave.presetOccasions = [{ kind: 'festa', place: pick(columns, rng), hour: intBetween(rng, 7, endHour) }];
  }
  const goals: Condition[] = [];
  const ng = intBetween(rng, 0, 3);
  for (let i = 0; i < ng; i++) goals.push(randomCondition(rng, level));
  return { level, goals };
}

/** Minimo di incroci per ricerca esaustiva con le API pubbliche (null = impossibile entro la matassa). */
function exhaustive(level: LevelDef, goals: Condition[]): number | null {
  const ctx = createContext(level, {});
  const rows = allRows(level.columns.length);
  let best: number | null = null;
  const timeline: LaceState[] = [initialState(level, ctx)];
  const events: LaceEvent[][] = [];
  const walk = (): void => {
    const s = timeline[timeline.length - 1] as LaceState;
    if (s.hour === level.endHour) {
      const rep = evaluate(level, timeline, events, goals, ctx, true);
      if (rep.every((r) => r.status === 'soddisfatta') && (best === null || s.usedMatassa < best)) best = s.usedMatassa;
      return;
    }
    for (const r of rows) {
      const res = applyRow(level, s, r, ctx);
      if (!res.ok) continue;
      timeline.push(res.state);
      events.push(res.events);
      walk();
      timeline.pop();
      events.pop();
    }
  };
  walk();
  return best;
}

describe('solver contro ricerca esaustiva', () => {
  it('180 livelli casuali: stesso minimo, e ogni soluzione del solver è accettata dal motore', () => {
    let solvable = 0;
    for (let i = 0; i < 180; i++) {
      const { level, goals } = randomLevel(`verifica-${i}`);
      const want = exhaustive(level, goals);
      const ctx = createContext(level, {});
      const r = solve({ level, ctx, goals });
      const got = r.status === 'ok' ? (r.incroci as number) : null;
      expect(got, `verifica-${i}: ${JSON.stringify({ level, goals })}`).toBe(want);
      if (r.status === 'ok') {
        solvable++;
        expect(simulateAndEvaluate(level, ctx, r.rows ?? [], goals).allOk, `verifica-${i}`).toBe(true);
      }
    }
    expect(solvable).toBeGreaterThan(50);
  }, 60_000);
});

// ───────────── Regressioni ─────────────

describe('condizioni sul segreto di lettura', () => {
  // Teresa al Forno con una lettera per Piero: legge a fine riga; poi il segreto scende a Nina.
  const level = mk({ initial: ['teresa', 'nina', 'piero'], quirks: ['teresaLegge'], beads: [L('L1', 'teresa', 'piero')] });
  const ctx = createContext(level, {});

  it('ha(chi, letta:…) prima che Teresa legga: si può ancora soddisfare (non a rischio, il solver lo trova)', () => {
    const cond: Condition = { t: 'ha', who: 'nina', bead: 'letta:L1', by: 8 };
    const s0 = initialState(level, ctx);
    expect(evaluate(level, [s0], [], [cond], ctx, false)).toEqual([{ status: 'in_corso' }]);
    const r = solve({ level, ctx, goals: [cond] });
    expect(r.status).toBe('ok');
    expect(r.incroci).toBe(1);
    expect(simulateAndEvaluate(level, ctx, r.rows ?? [], [cond]).allOk).toBe(true);
  });

  it('esceCon(letta:…) e lo stesso per Teresa: il segreto nasce in mano sua', () => {
    const r = solve({ level, ctx, goals: [{ t: 'ha', who: 'teresa', bead: 'letta:L1', by: 7 }] });
    expect(r).toMatchObject({ status: 'ok', incroci: 0 });
    const withEdge: LevelDef = { ...level, edges: [{ hour: 9, side: 'faro', kind: 'barca' }] };
    const c2 = createContext(withEdge, {});
    const r2 = solve({ level: withEdge, ctx: c2, goals: [{ t: 'esceCon', bead: 'letta:L1', hour: 9 }] });
    expect(r2.status).toBe('ok');
  });

  it('con la lettera già consegnata il segreto non nasce più: a rischio', () => {
    const lv = mk({ initial: ['teresa', 'piero', 'nina'], quirks: ['teresaLegge'], beads: [L('L1', 'teresa', 'piero')] });
    const c = createContext(lv, {});
    const sim = simulate(lv, c, [{ hour: 7, crossings: [{ pair: 0, over: 'L' }] }]);
    expect(sim.ok).toBe(true);
    const rep = evaluate(lv, sim.timeline, sim.events, [{ t: 'ha', who: 'nina', bead: 'letta:L1', by: 9 }], c, false);
    expect(rep[0]?.status).toBe('a_rischio');
  });
});

describe('suggerimenti al limite di stati', () => {
  it('il solver si ferma al limite: suggerimento generico, non «da qui non si arriva»', () => {
    const g = fixture('test-grande');
    const level: LevelDef = { ...g, matassa: 40, quirks: [...g.quirks, 'pieroTrabocca'], hintKeys: undefined };
    const ctx = createContext(level, {});
    const h = hintFor({ level, ctx, timeline: [initialState(level, ctx)], rows: [], goals: level.goals ?? [], tier: 'fantasma' });
    expect(h.textKey).toBe(HINT_KEYS.spintaGenerico);
    expect(h.ghost).toBeUndefined();
  }, 20_000);
});

describe('ripartenza del solver', () => {
  it('la matassa già usata è quella dello stato di partenza (rammendo d\'Archivio)', () => {
    const g00 = fixture('g00');
    const ctx = createContext(g00, {});
    const done: RowMoves[] = [{ hour: 6, crossings: [{ pair: 0, over: 'R' }] }, { hour: 7, crossings: [{ pair: 1, over: 'L' }] }];
    const sim = simulate(g00, ctx, done);
    const state = sim.timeline[2] as LaceState;
    // Matassa 2: con le 2 righe già fatte contate non basta, ripartendo da zero sì.
    const tight = { ...g00, matassa: 2 };
    expect(solve({ level: tight, ctx, goals: g00.goals ?? [], from: { state, rowsDone: done } }).status).toBe('impossibile');
    const r = solve({ level: tight, ctx, goals: g00.goals ?? [], from: { state: { ...state, usedMatassa: 0 }, rowsDone: done } });
    expect(r).toMatchObject({ status: 'ok', incroci: 2 });
    expect(r.rows?.slice(0, 2)).toEqual(done);
  });
});

describe('generatore: ripiego', () => {
  it('se nessun seme passa, il candidato arrivato più avanti nel filtro (minimo nell\'intervallo)', () => {
    const spec = { seed: 'lib0x', columns: 4 as const, rows: 6, rule: 'rancore' as const, gradi: [], difficulty: 'piccolo' as const };
    const r = generate(spec);
    expect(r.fromFallback).toBe(true);
    const [lo, hi] = minRange(4, 6);
    expect(r.min).toBeGreaterThanOrEqual(lo);
    expect(r.min).toBeLessThanOrEqual(hi);
    expect(r.level.matassa).toBe(r.min + 1);
    expect(generate(spec)).toEqual(r);
  }, 20_000);
});

// ───────────── levels:check sull'Archivio ─────────────

describe('levels:check: Archivio', () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });
  const quiet = { log: () => undefined };

  /** Archivio con spilli: risolvere la giornata da zero costerebbe più della matassa del rammendo. */
  function archive(matassa: number): LevelDef {
    const base = fixture('test-archivio');
    if (!base.archive) throw new Error('fixture senza archivio');
    return {
      ...base,
      id: 'arc-prova',
      pins: [
        { thread: 'f1', place: 'piazza', hour: 7 },
        { thread: 'f4', place: 'piazza', hour: 9 },
      ],
      matassa,
      archive: {
        ...base.archive,
        recorded: [
          { hour: 7, crossings: [{ pair: 0, over: 'L' }] },
          { hour: 8, crossings: [{ pair: 2, over: 'R' }] },
          { hour: 9, crossings: [{ pair: 1, over: 'L' }] },
          { hour: 10, crossings: [{ pair: 2, over: 'L' }] },
        ],
        holes: [{ from: 9, to: 9 }],
      },
    };
  }

  function run(level: LevelDef) {
    const d = mkdtempSync(join(tmpdir(), 'trama-arc-'));
    dirs.push(d);
    writeFileSync(join(d, `${level.id}.json`), JSON.stringify(level));
    return runCheck({ dir: d, ...quiet });
  }

  it('la base è il rammendo: si controlla lo strappo, non la giornata da zero', () => {
    const res = run(archive(1));
    expect(res.errors).toBe(0);
    const c = res.levels[0]?.computed;
    expect(c?.base.incroci).toBe(1);
    expect(c?.matassaSuggerita).toBe(1);
    expect(c?.base.rows.map((r) => r.crossings.length)).toEqual([1, 1, 1, 1]);
    expect(res.levels[0]?.warnings).toEqual([]);
  });

  it('matassa sotto il rammendo più corto: errore', () => {
    const res = run(archive(0));
    expect(res.errors).toBeGreaterThan(0);
    expect(res.levels[0]?.errors.join('\n')).toContain('mending the holes needs 1 crossings, matassa is 0');
  });

  it('un obiettivo che il merletto registrato non rispetta: errore', () => {
    const res = run({ ...archive(1), goals: [{ t: 'presso', who: 'f1', place: 'forno', hour: 10 }] });
    expect(res.levels[0]?.errors.join('\n')).toContain('is not met by the recorded lace');
  });
});
