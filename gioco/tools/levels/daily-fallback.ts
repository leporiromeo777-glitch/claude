/**
 * Genera `src/engine/data/daily-fallback.json`: 60 semi di riserva per il
 * Merletto del giorno (GDD 8.3), usati se nessuno dei semi `data#0…#499` passa
 * il filtro di qualità. I semi sono divisi fra le 7 regole del giorno (con le
 * dimensioni del loro giorno della settimana) e ognuno è già verificato.
 *
 *   npx tsx tools/levels/daily-fallback.ts [--check]
 *
 * Con --check non scrive: verifica che ogni seme del file passi ancora il
 * filtro (da rilanciare quando cambia il generatore).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RuleId } from '../../src/core/types';
import { DAILY_RULES } from '../../src/engine/daily';
import type { GenSpec } from '../../src/engine/generator';
import { GENERATOR_VERSION, buildCandidate, generate, qualityCheck } from '../../src/engine/generator';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/engine/data/daily-fallback.json');
const TOTAL = 60;

interface Entry {
  rule: RuleId;
  columns: number;
  rows: number;
  seed: string;
}

function specFor(rule: RuleId, seed: string): GenSpec {
  const wd = DAILY_RULES.indexOf(rule);
  const big = wd === 5 || wd === 6 || wd === 0;
  return { seed, columns: big ? 6 : 5, rows: big ? 8 : 7, rule, gradi: [], difficulty: 'medio' };
}

function build(): Entry[] {
  const entries: Entry[] = [];
  const rules = [...DAILY_RULES];
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i] as RuleId;
    const quota = Math.floor(TOTAL / rules.length) + (i < TOTAL % rules.length ? 1 : 0);
    let n = 0;
    while (entries.filter((e) => e.rule === rule).length < quota) {
      const spec = specFor(rule, `riserva-${rule}-${n++}`);
      const r = generate(spec);
      if (r.fromFallback) continue;
      entries.push({ rule, columns: spec.columns, rows: spec.rows, seed: r.seedUsed });
    }
  }
  return entries;
}

function check(entries: Entry[]): number {
  let bad = 0;
  for (const e of entries) {
    const spec = specFor(e.rule, e.seed.split('#')[0] ?? e.seed);
    const v = qualityCheck(spec, buildCandidate(spec, e.seed));
    if (!v.ok) {
      console.log(`✗ ${e.rule} ${e.seed}: no longer passes the quality filter`);
      bad++;
    }
  }
  return bad;
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const data = JSON.parse(readFileSync(OUT, 'utf8')) as { entries: Entry[] };
  const bad = check(data.entries);
  console.log(bad === 0 ? `daily-fallback: ${data.entries.length} seeds OK` : `daily-fallback: ${bad} seed(s) to regenerate`);
  process.exitCode = bad === 0 ? 0 : 1;
} else {
  const entries = build();
  writeFileSync(OUT, `${JSON.stringify({ version: 1, generatorVersion: GENERATOR_VERSION, entries }, null, 2)}\n`);
  console.log(`daily-fallback: ${entries.length} seeds written to ${OUT}`);
}
