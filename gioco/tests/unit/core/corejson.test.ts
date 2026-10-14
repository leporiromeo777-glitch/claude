import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import itCore from '../../../src/i18n/it/core.json';
import enCore from '../../../src/i18n/en/core.json';
import { flatten } from '../../../src/core/i18n';
import { ACTION_IDS } from '../../../src/core/ids';

const ROOT = join(__dirname, '../../..');

function keysOf(data: unknown): Set<string> {
  const m = new Map<string, string>();
  flatten(data, 'core', m);
  return new Set(m.keys());
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Codice senza commenti (per cercare le stringhe vere). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const coreFiles = [...sources(join(ROOT, 'src/core')), join(ROOT, 'src/main.ts'), join(ROOT, 'src/content/loader.ts'), join(ROOT, 'src/content/validate.ts')];

describe('core.json', () => {
  const it_ = keysOf(itCore);
  const en = keysOf(enCore);

  it('italiano e inglese hanno le stesse chiavi', () => {
    expect([...it_].filter((k) => !en.has(k))).toEqual([]);
    expect([...en].filter((k) => !it_.has(k))).toEqual([]);
  });

  it('ogni chiave core.* scritta nel codice esiste in italiano e in inglese', () => {
    const used = new Set<string>();
    for (const f of coreFiles) {
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const m of src.matchAll(/['"`](core\.[a-zA-Z0-9_.]+)['"`]/g)) if (m[1]) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(20);
    const missing = [...used].filter((k) => !it_.has(k) || !en.has(k));
    expect(missing).toEqual([]);
  });

  it('le famiglie di chiavi costruite a runtime sono complete', () => {
    const families: Record<string, readonly string[]> = {
      'core.azione': ACTION_IDS,
      'core.gesto': ['tap', 'longpress', 'dragstart', 'drag', 'dragend', 'dragcancel', 'wheel'],
      'core.dispositivo': ['mouse', 'touch', 'keyboard'],
      'core.layout': ['stretto', 'largo'],
      'core.orientamento': ['portrait', 'landscape'],
      'core.lingua': ['it', 'en'],
    };
    for (const [prefix, ids] of Object.entries(families)) {
      for (const id of ids) {
        expect(it_.has(`${prefix}.${id}`), `${prefix}.${id}`).toBe(true);
        expect(en.has(`${prefix}.${id}`), `${prefix}.${id}`).toBe(true);
      }
    }
  });

  it('nessuna frase italiana nelle stringhe del codice del core (tutto passa da core.json)', () => {
    // Parole italiane che non compaiono nei messaggi tecnici in inglese.
    const italian = /(^|[^\w-])(il|gli|di|del|della|delle|dei|degli|che|una|sono|questo|questa|ancora|anche|tocca|salvataggio|merletto|ricarica|nessun|nessuna|cosa|perché|più|già|è)(?=$|[^\w-])/i;
    expect(italian.test('Il gioco è salvato')).toBe(true);
    expect(italian.test('matassa must be a non-negative integer')).toBe(false);
    const offenders: string[] = [];
    for (const f of coreFiles) {
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const m of src.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)) {
        const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\$\{[^}]*\}/g, '');
        if (!/\s/.test(s) || /^[\w.:/-]*$/.test(s)) continue; // identificatori, chiavi, percorsi
        if (/^(core|tb|cp|sc)-/.test(s)) continue; // classi CSS
        if (italian.test(s)) offenders.push(`${f.slice(ROOT.length)}: ${s.slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
