import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createI18n, flatten, type I18nSource } from '../../../src/core/i18n';
import { engineTextKeys, GEN_KEYS } from '../../../src/engine/index';
import { PLACE_ORDER } from '../../../src/core/types';
import { QUIRK_IDS } from '../../../src/core/ids';
import { ROOT } from './helpers';

function load(locale: 'it' | 'en'): Map<string, string> {
  const data = JSON.parse(readFileSync(resolve(ROOT, `src/i18n/${locale}/tombolo.json`), 'utf8')) as unknown;
  const out = new Map<string, string>();
  flatten(data, 'tombolo', out);
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.ts$/.test(n)) out.push(p);
  }
  return out;
}

const IT = load('it');
const EN = load('en');
const SRC = walk(resolve(ROOT, 'src/tombolo'));

describe('testi del tombolo (tombolo.json)', () => {
  it('italiano e inglese hanno le stesse chiavi', () => {
    expect([...EN.keys()].sort()).toEqual([...IT.keys()].sort());
  });

  it('ci sono tutte le chiavi prodotte dal motore', () => {
    for (const k of [...engineTextKeys(), ...Object.values(GEN_KEYS)]) {
      expect(IT.has(k), k).toBe(true);
      expect(EN.has(k), k).toBe(true);
    }
  });

  it('ci sono le chiavi dei livelli di prova del motore', () => {
    const dir = resolve(ROOT, 'src/engine/fixtures');
    for (const f of readdirSync(dir)) {
      const txt = readFileSync(join(dir, f), 'utf8');
      for (const m of txt.matchAll(/"(tombolo\.[A-Za-z0-9_.]+)"/g)) expect(IT.has(m[1]!), `${f}: ${m[1]}`).toBe(true);
    }
  });

  it('ogni chiave scritta nel codice del tombolo esiste', () => {
    for (const file of SRC) {
      const txt = readFileSync(file, 'utf8');
      for (const m of txt.matchAll(/['`](tombolo\.[A-Za-z0-9_.]+)['`]/g)) {
        const k = m[1]!;
        if (k.endsWith('.')) continue;
        expect(IT.has(k), `${file}: ${k}`).toBe(true);
      }
    }
  });

  it('le famiglie di chiavi composte a runtime sono complete', () => {
    const need: string[] = [];
    for (const s of ['in_corso', 'soddisfatta', 'a_rischio', 'fallita']) need.push(`tombolo.stato.${s}`);
    for (const t of ['spinta', 'indizio', 'fantasma']) need.push(`tombolo.hint.gradino.${t}`);
    for (const t of ['indizio', 'fantasma']) need.push(`tombolo.hint.ancora.${t}`);
    for (const q of QUIRK_IDS) need.push(`tombolo.stranezza.${q}`);
    for (const p of PLACE_ORDER) need.push(`tombolo.sr.luogo.${p}`, `tombolo.presso.${p}`, `tombolo.luogo.${p}`);
    for (const k of ['lino', 'nero', 'avorio', 'sbiadito']) need.push(`tombolo.scheda.tipo.${k}`);
    for (const k of need) {
      expect(IT.has(k), k).toBe(true);
      expect(EN.has(k), k).toBe(true);
    }
  });

  it('nessun testo visibile scritto nel codice', () => {
    for (const file of SRC) {
      const txt = readFileSync(file, 'utf8');
      expect(/\btext:\s*'[A-Za-zÀ-ÿ]/.test(txt), `${file}: text letterale`).toBe(false);
      expect(/textContent\s*=\s*['"`][A-Za-zÀ-ÿ]/.test(txt), `${file}: textContent letterale`).toBe(false);
      expect(/labelKey:\s*'(?!tombolo\.)/.test(txt), `${file}: labelKey fuori dal namespace`).toBe(false);
    }
  });

  it('plurali e parametri si compongono in entrambe le lingue', () => {
    const src = (locale: 'it' | 'en'): I18nSource => ({
      locale,
      ns: 'tombolo',
      path: `src/i18n/${locale}/tombolo.json`,
      data: JSON.parse(readFileSync(resolve(ROOT, `src/i18n/${locale}/tombolo.json`), 'utf8')) as unknown,
    });
    const i18n = createI18n({ sources: [src('it'), src('en')], locale: 'it' });
    expect(i18n.t('tombolo.archivio.confermati', { n: 1 })).toBe('Un filo ritrova il suo colore.');
    expect(i18n.t('tombolo.archivio.confermati', { n: 3 })).toBe('3 fili ritrovano il loro colore.');
    expect(i18n.t('tombolo.violazione.spillo', { chi: 'Marta', presso: 'al Forno', ora: 6 })).toBe('Marta deve essere al Forno alle 6.');
    i18n.setLocale('en');
    expect(i18n.t('tombolo.occasioni.troppe', { posti: 1 })).toBe('You can plant only one occasion.');
    expect(i18n.t('tombolo.hud.ora', { ora: 9 })).toBe("9 o'clock");
  });
});
