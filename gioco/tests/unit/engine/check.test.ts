/**
 * `npm run levels:check`: sulle fixture produce i file calcolati ed esce con 0;
 * un livello irrisolvibile fa uscire con 1; combinazioni impossibili da
 * marcare `voluta`; occasioni; Archivio; impronta del sorgente.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CampaignDef, Condition, LevelComputed, LevelDef, NoteDef } from '../../../src/core/types';
import { SOLVER_VERSION, createContext, initialState, levelSourceHash, mentionsNome, simulateAndEvaluate, solve } from '../../../src/engine/index';
import { runCheck } from '../../../tools/levels/check';
import { FIXTURES, ROOT, fixture, fixtureNotes, mk } from './helpers';

const dirs: string[] = [];
function copyFixtures(withComputed: boolean): string {
  const d = mkdtempSync(join(tmpdir(), 'trama-levels-'));
  dirs.push(d);
  cpSync(FIXTURES, d, { recursive: true });
  if (!withComputed) for (const f of readdirSync(d)) if (f.endsWith('.computed.json')) rmSync(join(d, f));
  return d;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const quiet = { log: () => undefined };

/** Cartella di contenuti in miniatura: `levels/` con i livelli, bigliettini e campagna accanto (come src/content). */
function contentDir(levels: LevelDef[], notes: NoteDef[], days: CampaignDef['days']): string {
  const base = mkdtempSync(join(tmpdir(), 'trama-content-'));
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

function cli(args: string[]): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'tools/levels/check.ts'), ...args], { cwd: ROOT, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('levels:check', () => {
  it('fixture: produce i .computed.json ed esce con 0 (riga di comando, --report)', () => {
    const d = copyFixtures(true);
    for (const f of readdirSync(d)) if (f.endsWith('.computed.json') && f !== 'g06.computed.json') rmSync(join(d, f));
    const r = cli(['--dir', d, '--report']);
    expect(r.out).toContain('levels:check: 14 levels OK');
    expect(r.out).toContain('states');
    expect(r.status).toBe(0);
    const files = readdirSync(d).filter((f) => f.endsWith('.computed.json'));
    expect(files).toHaveLength(14);
    const g00 = JSON.parse(readFileSync(join(d, 'g00.computed.json'), 'utf8')) as LevelComputed;
    expect(g00).toMatchObject({ levelId: 'g00', solverVersion: SOLVER_VERSION, base: { incroci: 4 }, quieteMax: 0, matassaSuggerita: 6 });
    expect(g00.sourceHash).toMatch(/^[0-9a-f]{16}$/);
  }, 30_000);

  it('i .computed.json delle fixture sono aggiornati (sourceHash e versione del solver)', () => {
    const res = runCheck({ dir: FIXTURES, write: false, ...quiet });
    expect(res.errors).toBe(0);
    for (const l of res.levels) {
      const saved = JSON.parse(readFileSync(join(FIXTURES, `${l.id}.computed.json`), 'utf8')) as LevelComputed;
      expect(saved, l.id).toEqual(l.computed);
    }
  }, 30_000);

  it('g06: N1 5, N1+N2 5, N1+N3 impossibile e voluta, matassa suggerita 8', () => {
    const c = JSON.parse(readFileSync(join(FIXTURES, 'g06.computed.json'), 'utf8')) as LevelComputed;
    expect(c.base.incroci).toBe(0);
    expect(c.perNote['g06.nina']?.incroci).toBe(5);
    const combo = (a: string, b: string) => c.combos.find((x) => x.notes.includes(a) && x.notes.includes(b));
    expect(combo('g06.nina', 'g06.marta')?.incroci).toBe(5);
    expect(combo('g06.marta', 'g06.zeno')?.incroci).toBe(0);
    expect(combo('g06.nina', 'g06.zeno')).toMatchObject({ incroci: null, voluta: true });
    expect(c.matassaSuggerita).toBe(8);
  });

  it('una combinazione impossibile non marcata è un errore; --voluta la marca e il segno resta', () => {
    const d = copyFixtures(false);
    const first = runCheck({ dir: d, only: ['g06'], ...quiet });
    expect(first.errors).toBe(1);
    const marked = runCheck({ dir: d, only: ['g06'], voluta: ['g06:g06.zeno+g06.nina'], ...quiet });
    expect(marked.errors).toBe(0);
    const again = runCheck({ dir: d, only: ['g06'], ...quiet });
    expect(again.errors).toBe(0);
  }, 30_000);

  it('un livello irrisolvibile fa uscire con 1', () => {
    const d = copyFixtures(true);
    const bad: LevelDef = { ...fixture('g00'), id: 'rotto', goals: [{ t: 'consegnata', bead: 'L1', by: 6 }] };
    writeFileSync(join(d, 'rotto.json'), JSON.stringify(bad));
    const r = cli(['--dir', d]);
    expect(r.status).toBe(1);
    expect(r.out).toContain('levels/rotto: [base]');
  }, 30_000);

  it('matassa sotto il minimo designato: errore con la matassa suggerita nel calcolo', () => {
    const d = copyFixtures(true);
    const tight: LevelDef = { ...fixture('g00'), id: 'stretto', matassa: 3 };
    writeFileSync(join(d, 'stretto.json'), JSON.stringify(tight));
    const res = runCheck({ dir: d, only: ['stretto'], write: false, ...quiet });
    expect(res.errors).toBeGreaterThan(0);
    expect(res.levels[0]?.errors[0]).toContain('needs 4 crossings but matassa is 3');
  });

  it('Archivio: il merletto registrato e i rammendi; occasioni fra 1 e 20', () => {
    const res = runCheck({ dir: FIXTURES, only: ['test-archivio', 'test-occasioni'], write: false, ...quiet });
    expect(res.errors).toBe(0);
    const occ = res.levels.find((l) => l.id === 'test-occasioni')?.computed;
    expect(occ?.occasionsSolution?.length).toBeGreaterThan(0);
    expect(occ?.occasionsSolutions).toBeGreaterThanOrEqual(1);
    const d = copyFixtures(true);
    const broken = JSON.parse(readFileSync(join(d, 'test-archivio.json'), 'utf8')) as LevelDef;
    if (!broken.archive) throw new Error('no archive');
    broken.archive.recorded[0] = { hour: 7, crossings: [{ pair: 0, over: 'R' }] }; // Teresa sopra Marta: rifiutato
    writeFileSync(join(d, 'test-archivio.json'), JSON.stringify(broken));
    const res2 = runCheck({ dir: d, only: ['test-archivio'], write: false, ...quiet });
    expect(res2.levels[0]?.errors.join('\n')).toContain('recorded lace refused');
  });

  it('impronta del sorgente: stabile all\'ordine delle chiavi, cambia con le richieste', () => {
    const level = fixture('g06');
    const notes = Object.fromEntries(fixtureNotes().map((n) => [n.id, n.request ?? null]));
    const reverseKeys = (v: unknown): unknown =>
      Array.isArray(v) ? v.map(reverseKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;
    const shuffled = reverseKeys(level) as LevelDef;
    expect(Object.keys(shuffled)[0]).not.toBe(Object.keys(level)[0]);
    expect(levelSourceHash(shuffled, { requests: notes, pins: 2 })).toBe(levelSourceHash(level, { requests: notes, pins: 2 }));
    expect(levelSourceHash(level, { requests: { ...notes, 'g06.zeno': null }, pins: 2 })).not.toBe(levelSourceHash(level, { requests: notes, pins: 2 }));
    expect(levelSourceHash(mk({ initial: ['nina', 'marta'] }))).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('levels:check: nome di Ada (GDD 3.11)', () => {
  // Molo, Forno, Piazza, Chiesa; nessuno ha il nome all'apertura: lo appunta Ada.
  const level = mk({ id: 'nomi', act: 2, initial: ['nina', 'marta', 'piero', 'gino'], rules: ['incrocio', 'nome'], matassa: 6, notes: ['nomi.gino', 'nomi.ninaNo', 'nomi.due', 'nomi.incontro'] });
  const notes = [
    note('nomi.gino', 'nomi', { t: 'ha', who: 'gino', bead: 'nome' }),
    note('nomi.ninaNo', 'nomi', { t: 'nonHa', who: 'nina', bead: 'nome' }),
    note('nomi.due', 'nomi', { t: 'tutti', of: [{ t: 'ha', who: 'gino', bead: 'nome' }, { t: 'ha', who: 'nina', bead: 'nome' }] }),
    note('nomi.incontro', 'nomi', { t: 'incontra', a: 'nina', b: 'marta' }),
  ];
  const days: CampaignDef['days'] = [{ id: 'nomi', act: 2, pins: 2, stonatura: 0.6 }];

  /** Minimo vero: ogni filo presente all'apertura come filo del nome. */
  function bestOverChoices(conds: Condition[]): { incroci: number | null; nomeOn: string | null } {
    const ctx0 = createContext(level, {});
    let best: { incroci: number | null; nomeOn: string | null } = { incroci: null, nomeOn: null };
    for (const t of initialState(level, ctx0).pos) {
      const r = solve({ level, ctx: createContext(level, {}, { nomeOn: t }), goals: conds });
      if (r.status === 'ok' && r.incroci !== undefined && (best.incroci === null || r.incroci < best.incroci)) best = { incroci: r.incroci, nomeOn: t };
    }
    return best;
  }

  it('mentionsNome riconosce la perlina del nome anche dentro i combinatori', () => {
    expect(mentionsNome({ t: 'ha', who: 'gino', bead: 'nome' })).toBe(true);
    expect(mentionsNome({ t: 'non', c: { t: 'almeno', n: 1, of: [{ t: 'nonHa', who: 'nina', bead: 'nome' }] } })).toBe(true);
    expect(mentionsNome({ t: 'esceCon', bead: 'nome', hour: 8 })).toBe(true);
    expect(mentionsNome({ t: 'ha', who: 'gino', bead: 'voce:x' })).toBe(false);
    expect(mentionsNome({ t: 'incontra', a: 'nina', b: 'gino' })).toBe(false);
  });

  it('prova ogni filo presente come filo del nome: minimo, nomeOn e niente righe', () => {
    const dir = contentDir([level], notes, days);
    // ha(nina, nome) con nonHa(nina, nome) è impossibile con qualsiasi filo: senza segno è un errore.
    const unmarked = runCheck({ dir, write: false, ...quiet });
    expect(unmarked.levels[0]?.errors).toEqual(['levels/nomi: [combos] nomi.ninaNo + nomi.due is impossible (mark it voluta if intended)']);
    const res = runCheck({ dir, voluta: ['nomi:nomi.due+nomi.ninaNo'], ...quiet });
    expect(res.errors, res.levels[0]?.errors.join('\n')).toBe(0);
    const c = readComputed(dir, 'nomi');
    for (const n of notes) {
      const want = bestOverChoices([n.request as Condition]);
      const got = c.perNote[n.id];
      expect(got?.incroci, n.id).toBe(want.incroci);
      if (n.id === 'nomi.incontro') {
        // Senza il nome nelle condizioni: righe salvate, nessun nomeOn.
        expect(got?.nomeOn, n.id).toBeUndefined();
        expect(simulateAndEvaluate(level, createContext(level, {}), got?.rows ?? [], [n.request as Condition]).allOk).toBe(true);
      } else {
        expect(got?.nomeOn, n.id).toBe(want.nomeOn);
        expect(got?.rows, n.id).toBeUndefined();
        // Con il filo indicato il minimo si raggiunge davvero.
        const r = solve({ level, ctx: createContext(level, {}, { nomeOn: got?.nomeOn ?? null }), goals: [n.request as Condition] });
        expect(r.incroci, n.id).toBe(got?.incroci);
      }
    }
    // Il nome non resta mai senza filo: nonHa(nina, nome) è gratis appuntandolo su un altro.
    expect(c.perNote['nomi.ninaNo']).toEqual({ incroci: 0, nomeOn: 'marta' });
    expect(c.perNote['nomi.gino']).toEqual({ incroci: 0, nomeOn: 'gino' });
    // Combinazioni: stesso criterio.
    for (const x of c.combos) {
      const conds = x.notes.map((id) => notes.find((n) => n.id === id)?.request as Condition);
      expect(x.incroci, x.notes.join('+')).toBe(bestOverChoices(conds).incroci);
      expect(x.rows === undefined, x.notes.join('+')).toBe(conds.some(mentionsNome) || x.incroci === null);
    }
    // ha(gino, nome) e nonHa(nina, nome) insieme: nome su Gino, nessun incrocio.
    expect(c.combos.find((x) => x.notes.includes('nomi.gino') && x.notes.includes('nomi.ninaNo'))).toMatchObject({ incroci: 0, nomeOn: 'gino' });
    expect(c.combos.find((x) => x.notes.includes('nomi.due') && x.notes.includes('nomi.ninaNo'))).toMatchObject({ incroci: null, voluta: true });
  });

  it('un segno voluta diventato inutile si toglie (con un avviso) e il bigliettino conta per la matassa', () => {
    const dir = contentDir([level], notes, days);
    const first = runCheck({ dir, voluta: ['nomi:nomi.gino', 'nomi:nomi.due+nomi.ninaNo'], ...quiet });
    expect(first.errors).toBe(0);
    expect(first.levels[0]?.warnings.join('\n')).toContain('mark on request of "nomi.gino" removed');
    const c = readComputed(dir, 'nomi');
    expect(c.combos.some((x) => x.notes.length === 1)).toBe(false);
    expect(c.combos.filter((x) => x.voluta).map((x) => x.notes)).toEqual([['nomi.ninaNo', 'nomi.due']]);
    const again = runCheck({ dir, ...quiet });
    expect(again.errors).toBe(0);
    expect(again.levels[0]?.warnings).toEqual([]);
    expect(readComputed(dir, 'nomi')).toEqual(c);
  });
});

describe('levels:check: combinazioni con meno bigliettini degli spilli', () => {
  // Molo, Forno, Piazza, Chiesa; ore 6→10; 3 spilli rossi.
  const base = mk({ id: 'terne', act: 3, initial: ['nina', 'marta', 'piero', 'gino'], matassa: 4, notes: ['terne.forno', 'terne.molo', 'terne.incontro'] });
  const notes = [
    note('terne.forno', 'terne', { t: 'presso', who: 'nina', place: 'forno', hour: 7 }),
    note('terne.molo', 'terne', { t: 'presso', who: 'nina', place: 'molo', hour: 7 }),
    note('terne.incontro', 'terne', { t: 'incontra', a: 'piero', b: 'gino' }),
  ];
  const days: CampaignDef['days'] = [{ id: 'terne', act: 3, pins: 3, stonatura: 0.25 }];
  const key = (ids: readonly string[]): string => [...ids].sort().join('+');

  it('calcola coppie e terne; la coppia impossibile va marcata, e la terna che la contiene è voluta anch\'essa', () => {
    const dir = contentDir([base], notes, days);
    const first = runCheck({ dir, write: false, ...quiet });
    const errs = first.levels[0]?.errors ?? [];
    expect(errs.some((e) => e.includes('[combos] terne.forno + terne.molo is impossible'))).toBe(true);
    expect(errs.some((e) => e.includes('terne.forno + terne.molo + terne.incontro is impossible (it contains terne.forno + terne.molo'))).toBe(true);
    const marked = runCheck({ dir, voluta: ['terne:terne.forno+terne.molo'], ...quiet });
    expect(marked.errors, marked.levels[0]?.errors.join('\n')).toBe(0);
    const c = readComputed(dir, 'terne');
    const byKey = new Map(c.combos.map((x) => [key(x.notes), x]));
    expect([...byKey.keys()].sort()).toEqual([key(['terne.forno', 'terne.molo']), key(['terne.forno', 'terne.incontro']), key(['terne.molo', 'terne.incontro']), key(['terne.forno', 'terne.molo', 'terne.incontro'])].sort());
    expect(byKey.get(key(['terne.forno', 'terne.molo']))).toMatchObject({ incroci: null, voluta: true });
    expect(byKey.get(key(['terne.forno', 'terne.molo', 'terne.incontro']))).toMatchObject({ incroci: null, voluta: true });
    expect(byKey.get(key(['terne.forno', 'terne.incontro']))?.incroci).toBe(2);
    expect(byKey.get(key(['terne.molo', 'terne.incontro']))?.incroci).toBe(1);
    // Ogni coppia possibile ha la sua soluzione, che rispetta davvero le richieste (il tombolo la usa per il filo d'oro).
    for (const x of c.combos.filter((y) => y.incroci !== null)) {
      const conds = x.notes.map((id) => notes.find((n) => n.id === id)?.request as Condition);
      expect(simulateAndEvaluate(base, createContext(base, {}), x.rows ?? [], conds).allOk, x.notes.join('+')).toBe(true);
    }
    // Designata: la coppia più cara (2) + margine dell'Atto III.
    expect(c.matassaSuggerita).toBe(2 + 1);
  });

  it('una coppia oltre la matassa è un errore anche se la terna è voluta (il caso di g18)', () => {
    const tight: LevelDef = { ...base, matassa: 1 };
    const dir = contentDir([tight], notes, days);
    const res = runCheck({ dir, voluta: ['terne:terne.forno+terne.molo'], write: false, ...quiet });
    const errs = res.levels[0]?.errors ?? [];
    expect(errs).toContain('levels/terne: [combos] terne.forno + terne.incontro needs 2 crossings, matassa is 1 (not marked voluta)');
    expect(errs.some((e) => e.includes('[matassa] matassa 1 is below the designated minimum 2'))).toBe(true);
    expect(res.levels[0]?.computed?.matassaSuggerita).toBe(3);
  });

  it('un --voluta che non corrisponde a nessuna combinazione calcolata dà un avviso', () => {
    const dir = contentDir([base], notes, days);
    const res = runCheck({ dir, voluta: ['terne:terne.forno+terne.molo', 'terne:terne.forno+terne.nessuna'], write: false, ...quiet });
    expect(res.errors).toBe(0);
    expect(res.levels[0]?.warnings).toEqual(['levels/terne: [voluta] --voluta terne:terne.forno+terne.nessuna: no such combination (notes with a request, at most 3 of them)']);
  });
});
