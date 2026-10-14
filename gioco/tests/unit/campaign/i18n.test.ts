/**
 * Testi della campagna (ARCHITETTURA 10): `campaign.json` completo in italiano e in
 * inglese, ogni chiave usata nel codice esiste, nessuna stringa visibile nel codice,
 * e i testi dei contenuti che la campagna chiede (oggetti, atti, domande) ci sono.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flatten } from '../../../src/core/i18n';
import { QUIRK_IDS, THREAD_PATTERNS, ENDING_IDS } from '../../../src/core/ids';
import { DESTINY_FLAGS } from '../../../src/campaign/flow';
import { TAB_IDS } from '../../../src/campaign/taccuino/panel';
import { CREDIT_KEYS } from '../../../src/campaign/FinaleScene';
import { buildCatalogs, loadI18nSources } from '../../../src/core/i18n';
import { db } from './helpers';

const ROOT = resolve(__dirname, '../../..');

function table(locale: 'it' | 'en'): Map<string, string> {
  const out = new Map<string, string>();
  flatten(JSON.parse(readFileSync(join(ROOT, `src/i18n/${locale}/campaign.json`), 'utf8')), 'campaign', out);
  return out;
}

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...sources(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

const IT = table('it');
const EN = table('en');
const CODE = sources(join(ROOT, 'src/campaign')).map((p) => ({ p, text: readFileSync(p, 'utf8') }));

/** Famiglie di chiavi composte a runtime. */
const DYNAMIC: string[] = [
  ...['nuovo', 'nominato', 'rammendato'].map((x) => `campaign.archivio.stato.${x}`),
  ...['ok', 'fallita', 'lasciato', 'desiderio', 'autoreSbagliato'].map((x) => `campaign.bilancio.conseguenza.${x}`),
  ...['incroci', 'quiete', 'simmetria', 'filoDOro'].map((x) => `campaign.bilancio.nuovoRecord.${x}`),
  ...ENDING_IDS.map((x) => `campaign.finale.${x}`),
  ...THREAD_PATTERNS.map((x) => `campaign.motivi.${x}`),
  ...['daily', 'libero', 'gradi', 'tovaglia', 'archivio', 'fuso'].map((x) => `campaign.sblocchi.${x}`),
  ...ENDING_IDS.map((x) => `campaign.scelta.conferma.${x}`),
  ...['nessunaSera', 'sconosciuto', 'spilli', 'chi', 'senzaRichiesta', 'giaRisposto', 'senzaRisposte'].map((x) => `campaign.sera.errore.${x}`),
  ...QUIRK_IDS.map((x) => `campaign.stranezze.${x}`),
  ...['visto', 'libro', 'sentito', 'archivio'].map((x) => `campaign.taccuino.fonte.${x}`),
  ...TAB_IDS.map((x) => `campaign.taccuino.schede.${x}`),
  ...['soddisfatta', 'in_corso', 'a_rischio', 'fallita', 'lasciata'].map((x) => `campaign.taccuino.stato.${x}`),
  ...Object.entries(DESTINY_FLAGS).flatMap(([f, vs]) => vs.map((v) => `campaign.destini.${f}.${v}`)),
  ...CREDIT_KEYS,
];

describe('campaign.json', () => {
  it('italiano e inglese hanno le stesse chiavi, tutte non vuote', () => {
    expect([...EN.keys()].sort()).toEqual([...IT.keys()].sort());
    for (const [k, v] of IT) expect(v.trim(), k).not.toBe('');
    for (const [k, v] of EN) expect(v.trim(), k).not.toBe('');
  });

  it('ogni chiave scritta nel codice esiste in italiano e in inglese', () => {
    const used = new Set<string>();
    for (const { text } of CODE) for (const m of text.matchAll(/['`](campaign\.[A-Za-z0-9_.]+)['`]/g)) if (m[1] && !m[1].endsWith('.')) used.add(m[1]);
    expect(used.size).toBeGreaterThan(100);
    for (const k of used) {
      expect(IT.has(k), `${k} (it)`).toBe(true);
      expect(EN.has(k), `${k} (en)`).toBe(true);
    }
  });

  it('le chiavi composte a runtime esistono', () => {
    for (const k of DYNAMIC) {
      expect(IT.has(k), `${k} (it)`).toBe(true);
      expect(EN.has(k), `${k} (en)`).toBe(true);
    }
  });

  it('i plurali e i parametri sono gli stessi nelle due lingue', () => {
    const params = (s: string): string[] => [...s.matchAll(/\{(\w+)\s*[},]/g)].map((m) => m[1] ?? '').sort();
    for (const [k, v] of IT) expect(params(EN.get(k) ?? ''), k).toEqual(params(v));
  });

  it('nessun testo italiano visibile scritto nel codice', () => {
    // Le stringhe con lettere accentate o con parole comuni dell'interfaccia vanno nei JSON.
    for (const { p, text } of CODE) {
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const m of code.matchAll(/(['"`])([^'"`\n]*[àèéìòù][^'"`\n]*)\1/g)) {
        throw new Error(`${p}: testo nel codice «${m[2]}»`);
      }
      expect(/textContent\s*=\s*['"`][A-Za-zÀ-ú]/.test(code), p).toBe(false);
      expect(/innerHTML/.test(code), p).toBe(false);
    }
  });
});

describe('testi dei contenuti usati dalla campagna', () => {
  const content = db();
  const cat = buildCatalogs(loadI18nSources());
  const it_ = cat.tables.it;

  it('oggetti della laguna, atti, domande e giornate', () => {
    const letters = new Set(content.letters.map((l) => l.id));
    const objects = new Set<string>(['libro_punti']);
    for (const d of content.campaign.days) if (d.objectAfter && !letters.has(d.objectAfter)) objects.add(d.objectAfter);
    for (const o of objects) {
      expect(it_.has(`comune.oggetti.${o}.nome`), o).toBe(true);
      expect(it_.has(`comune.oggetti.${o}.descrizione`), o).toBe(true);
    }
    for (const a of [0, 1, 2, 3]) expect(it_.has(`comune.atti.${a}.titolo`)).toBe(true);
    expect(it_.has('comune.atti.0.sottotitolo')).toBe(true);
    const questions = new Set<string>();
    for (const d of content.diary.values()) for (const q of [...(d.opens ?? []), ...(d.closes ?? [])]) questions.add(q);
    for (const q of questions) expect(it_.has(`comune.domande.${q}.titolo`), q).toBe(true);
    for (const d of content.campaign.days) expect(it_.has(content.levels.get(d.id)?.titleKey ?? ''), d.id).toBe(true);
    for (const e of content.endings.values()) for (const m of e.missing) expect(it_.has(m.textKey), m.textKey).toBe(true);
  });
});
