/**
 * Testi delle schermate: ui.json completo in italiano e in inglese (stesse
 * chiavi, nessun testo vuoto), ogni chiave usata nel codice esiste, nessun
 * testo visibile scritto nel codice.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flatten } from '../../../src/core/i18n';
import { GRADI_ORDER, DIMENSIONI_ORDER, LIBERO_RULES } from '../../../src/screens/libero';
import { TOOLS } from '../../../src/screens/CreditiScene';
import { ROOT, makeServices } from './helpers';

function table(locale: string): Map<string, string> {
  const out = new Map<string, string>();
  flatten(JSON.parse(readFileSync(resolve(ROOT, `src/i18n/${locale}/ui.json`), 'utf8')), 'ui', out);
  return out;
}

const SRC = resolve(ROOT, 'src/screens');
const files = readdirSync(SRC).filter((f) => f.endsWith('.ts'));
const sources = files.map((f) => ({ f, text: readFileSync(resolve(SRC, f), 'utf8') }));

/** Valori dei segnaposto `${…}` delle chiavi costruite nel codice, per modello di chiave. */
const VOLUMES = ['master', 'music', 'sfx', 'voice'];
const SWITCHES = ['haptics', 'captions', 'autoAdvance'];
const EXPANSIONS: Record<string, readonly string[]> = {
  'ui.impostazioni.volume.${k}': VOLUMES,
  'ui.impostazioni.${k}': SWITCHES,
  'ui.impostazioni.${k}Desc': SWITCHES,
  'ui.impostazioni.lingue.${l}': ['it', 'en'],
  'ui.libero.dimensioni.${d}': DIMENSIONI_ORDER,
  'ui.libero.grado.${g}.nome': GRADI_ORDER,
  'ui.libero.grado.${g}.desc': GRADI_ORDER,
  'ui.regola.${rule}.titolo': LIBERO_RULES,
  'ui.regola.${rule}.testo': LIBERO_RULES,
  'ui.crediti.strumento.${t}': TOOLS,
};

function usedKeys(): string[] {
  const keys = new Set<string>();
  for (const { text } of sources) {
    for (const m of text.matchAll(/['`](ui\.[A-Za-z0-9_.${}]+)['`]/g)) {
      const raw = m[1] as string;
      if (!raw.includes('${')) {
        keys.add(raw);
        continue;
      }
      const vals = EXPANSIONS[raw];
      if (!vals) throw new Error(`no expansion for ${raw}`);
      const v = /\$\{(\w+)\}/.exec(raw)?.[1] as string;
      for (const x of vals) keys.add(raw.replace(`\${${v}}`, x));
    }
  }
  return [...keys].sort();
}

describe('ui.json', () => {
  const it_ = table('it');
  const en = table('en');

  it('italiano e inglese hanno le stesse chiavi e nessun testo vuoto', () => {
    expect([...en.keys()].sort()).toEqual([...it_.keys()].sort());
    for (const [k, v] of [...it_, ...en]) expect(v.trim().length, k).toBeGreaterThan(0);
    expect(it_.size).toBeGreaterThan(200);
  });

  it('ogni chiave usata dalle schermate esiste in italiano e in inglese', () => {
    const used = usedKeys();
    expect(used.length).toBeGreaterThan(150);
    expect(used.filter((k) => !it_.has(k) || !en.has(k))).toEqual([]);
  });

  it('le chiavi di altri namespace usate esistono (core, comune)', () => {
    const { s } = makeServices();
    for (const k of ['core.save.import.ok', 'core.save.import.formato', 'core.save.import.checksum', 'core.save.import.versione']) expect(s.i18n.has(k), k).toBe(true);
    for (const p of s.content.book) {
      expect(s.i18n.has(p.titleKey), p.titleKey).toBe(true);
      expect(s.i18n.has(p.textKey), p.textKey).toBe(true);
    }
    expect(s.i18n.has(s.content.credits.authorKey)).toBe(true);
    for (const l of s.content.credits.lines) expect(s.i18n.has(l.key), l.key).toBe(true);
  });

  it('nessun testo visibile scritto nel codice delle schermate', () => {
    const offenders: string[] = [];
    for (const { f, text } of sources) {
      for (const m of text.matchAll(/\b(text|label|title|placeholder|alt):\s*'([^']*)'/g)) {
        const v = m[2] as string;
        if (/[A-Za-zÀ-ú]{2,}\s+[A-Za-zÀ-ú]{2,}/.test(v)) offenders.push(`${f}: ${m[0]}`);
      }
      for (const m of text.matchAll(/\.textContent\s*=\s*'([^']+)'/g)) offenders.push(`${f}: ${m[0]}`);
    }
    expect(offenders).toEqual([]);
  });

  it('la riga da condividere e le frasi con i plurali funzionano nelle due lingue', () => {
    for (const loc of ['it', 'en'] as const) {
      const { s } = makeServices({ locale: loc });
      for (const n of [0, 1, 2, 7]) {
        expect(s.i18n.t('ui.giornaliero.serieValore', { n })).not.toMatch(/[{}]/);
        expect(s.i18n.t('ui.libero.puntiValore', { n })).not.toMatch(/[{}]/);
        expect(s.i18n.t('ui.risultato.incrociSolo', { n })).not.toMatch(/[{}]/);
        expect(s.i18n.t('ui.comune.filiOre', { fili: n, ore: n + 1 })).not.toMatch(/[{}]/);
      }
    }
  });
});
