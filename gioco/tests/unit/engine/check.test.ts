/**
 * `npm run levels:check`: sulle fixture produce i file calcolati ed esce con 0;
 * un livello irrisolvibile fa uscire con 1; combinazioni impossibili da
 * marcare `voluta`; occasioni; Archivio; impronta del sorgente.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { LevelComputed, LevelDef } from '../../../src/core/types';
import { SOLVER_VERSION, levelSourceHash } from '../../../src/engine/index';
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

function cli(args: string[]): { status: number | null; out: string } {
  const r = spawnSync(process.execPath, ['--import', 'tsx', join(ROOT, 'tools/levels/check.ts'), ...args], { cwd: ROOT, encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

describe('levels:check', () => {
  it('fixture: produce i .computed.json ed esce con 0 (riga di comando, --report)', () => {
    const d = copyFixtures(true);
    for (const f of readdirSync(d)) if (f.endsWith('.computed.json') && f !== 'g06.computed.json') rmSync(join(d, f));
    const r = cli(['--dir', d, '--report']);
    expect(r.out).toContain('levels:check: 13 levels OK');
    expect(r.out).toContain('states');
    expect(r.status).toBe(0);
    const files = readdirSync(d).filter((f) => f.endsWith('.computed.json'));
    expect(files).toHaveLength(13);
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
