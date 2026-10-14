/**
 * Il motore resta puro (ARCHITETTURA 5.2, 17): niente DOM, servizi né tempo.
 * Ricerca nel codice di src/engine: import ammessi solo da core/types, core/rng,
 * moduli del motore e JSON; nessun Math.random, Date.now, new Date, document,
 * window, localStorage. Il client del solver (Worker) e il registro del
 * pacchetto (che riceve i servizi come parametro) sono le uniche eccezioni
 * dichiarate, e nemmeno loro usano DOM o tempo.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './helpers';

const ENGINE = join(ROOT, 'src/engine');

function files(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (f.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Codice senza commenti (per non contare le parole nei commenti). */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

describe('purezza del motore', () => {
  const list = files(ENGINE);

  it('ci sono i file del motore', () => {
    const names = list.map((f) => relative(ENGINE, f));
    for (const n of ['index.ts', 'context.ts', 'state.ts', 'rules.ts', 'conditions.ts', 'solver.ts', 'solver.worker.ts', 'solver-client.ts', 'autoweave.ts', 'hints.ts', 'generator.ts', 'daily.ts', 'bot.ts', 'spartito.ts', 'metrics.ts', 'register.ts']) {
      expect(names).toContain(n);
    }
  });

  it.each(list.map((f) => [relative(ENGINE, f), f]))('%s: import ammessi', (_n, f) => {
    const src = readFileSync(f, 'utf8');
    const imports = [...src.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1] as string);
    for (const spec of imports) {
      const ok = spec === '../core/types' || spec === '../core/rng' || /^\.\/[A-Za-z0-9_./-]+$/.test(spec);
      expect(ok, `${relative(ENGINE, f)} imports ${spec}`).toBe(true);
    }
  });

  it.each(list.map((f) => [relative(ENGINE, f), f]))('%s: niente tempo, caso, DOM o servizi', (_n, f) => {
    const src = code(readFileSync(f, 'utf8'));
    for (const bad of [/Math\.random\s*\(/, /Date\.now\s*\(/, /new\s+Date\s*\(/, /\bdocument\./, /\bwindow\./, /\blocalStorage\b/, /\bsessionStorage\b/, /core\/services/, /requestAnimationFrame/]) {
      expect(bad.test(src), `${relative(ENGINE, f)} uses ${bad}`).toBe(false);
    }
  });
});
