/**
 * Traduzione inglese della storia (pacchetto traduzione-en, livello L2).
 *
 * Per ognuno dei namespace della storia (atto1, atto2, atto3, finali):
 * - il file inglese esiste ed è caricato da i18n come namespace `en`;
 * - stessa struttura annidata e stesse chiavi del file italiano;
 * - stessi segnaposto `{param}` (anche quelli ICU) e stessi a capo;
 * - nessuna stringa vuota, nessun testo rimasto in italiano (euristica sulle
 *   parole italiane frequenti, frasi latine escluse);
 * - lunghezza inglese ≤ 1,3 × italiano per ogni stringa; i testi lunghi (≥ 80
 *   caratteri, quelli che riempiono davvero l'interfaccia) e ogni namespace nel
 *   suo insieme non crescono più del 20% (specifica del pacchetto);
 * - niente virgolette o accenti italiani rimasti, stessi marcatori di formattazione;
 * - la terminologia di `comune.json` e dell'interfaccia (Pier, lace pillow, Book of
 *   Stitches, Notebook, brass pin, ferry…) e nessuna variante concorrente;
 * - gli stessi limiti dell'interfaccia che valgono per l'italiano: righe di gioco
 *   ≤ 90 caratteri, bigliettini e voci del Taccuino ≤ 220;
 * - le regole di scrittura dei contenuti valgono anche in inglese: bigliettini
 *   anonimi da g13, niente «Ada» nei bigliettini da g12, lettere di L. senza nomi.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, LevelDef, NoteDef } from '../../../src/core/types';
import { loadContent } from '../../../src/content/loader';
import { buildCatalogs, createI18n, loadI18nSources } from '../../../src/core/i18n';

const STORY_NS = ['atto1', 'atto2', 'atto3', 'finali'] as const;
type StoryNs = (typeof STORY_NS)[number];

const files = import.meta.glob('../../../src/content/text/*/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
function file(locale: 'it' | 'en', ns: string): unknown {
  return files[`../../../src/content/text/${locale}/${ns}.json`];
}

const sources = loadI18nSources();
const catalogs = buildCatalogs(sources);
const IT = catalogs.tables.it;
const EN = catalogs.tables.en;
const db = loadContent();

const isStoryKey = (k: string): boolean => STORY_NS.some((ns) => k.startsWith(`${ns}.`));
const storyKeys = [...IT.keys()].filter(isStoryKey).sort();
const en = (k: string): string => EN.get(k) ?? '';
const it_ = (k: string): string => IT.get(k) ?? '';

/** Forma di un valore JSON: stessi tipi e stesse chiavi a ogni livello. */
function shape(v: unknown): unknown {
  if (typeof v === 'string') return 's';
  if (Array.isArray(v)) return v.map(shape);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, shape((v as Record<string, unknown>)[k])]),
    );
  }
  return typeof v;
}

/** Nomi dei segnaposto: `{nome}`, `{n, plural, …}`, `{x, select, …}`. */
function placeholders(s: string): string[] {
  return [...s.matchAll(/\{\s*([A-Za-z_]\w*)\s*[,}]/g)].map((m) => m[1] ?? '').sort();
}

/** Frasi latine dei personaggi (Don Piero, Nina): non sono italiano rimasto. */
const LATIN = [
  'Ego te absolvo', 'Requiem aeternam', 'Deo gratias', 'Domine, non sum dignus', 'Fiat voluntas',
  'Sapere aude', 'Pax tecum', 'Deus videt', 'Silentium est aureum',
];
/**
 * Parole italiane frequenti che in un testo inglese non compaiono mai (articoli,
 * preposizioni articolate, congiunzioni, ausiliari) più le parole del mondo che
 * la traduzione rende sempre in inglese (Molo → Pier, vaporetto → ferry…).
 */
const ITALIAN_WORDS = new Set([
  'il', 'gli', 'una', 'uno', 'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'nel', 'nella',
  'nei', 'nelle', 'al', 'allo', 'alla', 'ai', 'alle', 'dal', 'dalla', 'dai', 'sul', 'sulla', 'col',
  'che', 'non', 'è', 'e', 'ed', 'ma', 'anche', 'perché', 'però', 'più', 'già', 'così', 'poi', 'ancora',
  'sempre', 'niente', 'nessuno', 'tutto', 'tutti', 'molto', 'questo', 'questa', 'quello', 'quella',
  'sono', 'ho', 'hai', 'abbiamo', 'hanno', 'sei', 'mi', 'ti', 'ci', 'vi', 'si', 'gli', 'chi',
  'cosa', 'quando', 'oggi', 'domani', 'stanotte', 'stasera', 'giorno', 'notte', 'sera',
  'cara', 'caro', 'babbo', 'mamma', 'nonna', 'signorina', 'signora', 'figliola', 'figliolo', 'piccola',
  'merlettaia', 'merletto', 'tombolo', 'filo', 'fili', 'fuso', 'spillo', 'matassa', 'bigliettino',
  'vaporetto', 'molo', 'forno', 'piazza', 'chiesa', 'farmacia', 'faro', 'secca', 'pozzo', 'lettera',
  'lettere', 'bottiglia', 'scialle', 'grazie', 'buongiorno', 'ciao', 'va', 'bene',
]);
function italianWords(s: string): string[] {
  let text = s;
  for (const l of LATIN) text = text.split(l).join(' ');
  const words = text.toLowerCase().match(/[a-zàèéìòù]+/g) ?? [];
  return [...new Set(words.filter((w) => ITALIAN_WORDS.has(w)))];
}

function level(id: string): LevelDef {
  const lv = db.levels.get(id);
  if (!lv) throw new Error(`livello ${id} assente`);
  return lv;
}
const STORY_LEVELS = [...db.levels.keys()].filter((id) => /^(g\d\d|arc\d|fin_[a-z]+)$/.test(id)).sort();
const notesOf = (lv: LevelDef): NoteDef[] =>
  (lv.notes ?? []).map((id) => {
    const n = db.notes.get(id);
    if (!n) throw new Error(`bigliettino ${id} assente`);
    return n;
  });
const ALL_NOTES = STORY_LEVELS.flatMap((id) => notesOf(level(id)));

describe('traduzione inglese: file e chiavi', () => {
  it.each(STORY_NS)('%s: il file inglese esiste ed è caricato da i18n', (ns: StoryNs) => {
    expect(file('it', ns), `it/${ns}.json`).toBeDefined();
    expect(file('en', ns), `en/${ns}.json`).toBeDefined();
    expect(catalogs.namespaces.en).toContain(ns);
  });

  it.each(STORY_NS)('%s: stessa struttura annidata e stesse chiavi dell\'italiano', (ns: StoryNs) => {
    expect(shape(file('en', ns))).toEqual(shape(file('it', ns)));
    const itKeys = [...IT.keys()].filter((k) => k.startsWith(`${ns}.`)).sort();
    const enKeys = [...EN.keys()].filter((k) => k.startsWith(`${ns}.`)).sort();
    expect(itKeys.length).toBeGreaterThan(20);
    expect(enKeys).toEqual(itKeys);
  });

  it('i18n in inglese non ha chiavi della storia mancanti e le mostra in inglese', () => {
    const i18n = createI18n({ sources, locale: 'en' });
    expect(i18n.missing('en').filter(isStoryKey)).toEqual([]);
    expect(i18n.t('atto1.g00.titolo')).toBe(en('atto1.g00.titolo'));
    expect(i18n.t('atto1.g00.titolo')).not.toBe(it_('atto1.g00.titolo'));
    i18n.setLocale('it');
    expect(i18n.t('atto1.g00.titolo')).toBe(it_('atto1.g00.titolo'));
  });
});

describe('traduzione inglese: stringhe', () => {
  it('nessuna stringa vuota', () => {
    expect(storyKeys.length).toBeGreaterThan(850);
    expect(storyKeys.filter((k) => en(k).trim() === '')).toEqual([]);
  });

  it('stessi segnaposto e stessi a capo', () => {
    const bad = storyKeys.filter((k) => {
      const a = it_(k);
      const b = en(k);
      return placeholders(a).join() !== placeholders(b).join() || a.split('\n').length !== b.split('\n').length;
    });
    expect(bad).toEqual([]);
  });

  it('nessun testo rimasto in italiano', () => {
    const left = storyKeys
      .map((k) => [k, italianWords(en(k))] as const)
      .filter(([, w]) => w.length > 0)
      .map(([k, w]) => `${k}: ${w.join(', ')}`);
    expect(left).toEqual([]);
    // Uguali all'italiano solo i testi fatti di nomi propri o di latino.
    const same = storyKeys.filter((k) => en(k) === it_(k) && italianWords(it_(k)).length > 0);
    expect(same).toEqual([]);
  });

  it('lunghezza inglese ≤ 1,3 × italiano per ogni stringa', () => {
    const long = storyKeys
      .filter((k) => en(k).length > 1.3 * it_(k).length)
      .map((k) => `${k} (${it_(k).length} → ${en(k).length})`);
    expect(long).toEqual([]);
  });

  it('testi lunghi (≥ 80 caratteri) e namespace interi ≤ 1,2 × italiano', () => {
    const long = storyKeys
      .filter((k) => it_(k).length >= 80 && en(k).length > 1.2 * it_(k).length)
      .map((k) => `${k} (${it_(k).length} → ${en(k).length})`);
    expect(long).toEqual([]);
    for (const ns of STORY_NS) {
      const keys = storyKeys.filter((k) => k.startsWith(`${ns}.`));
      const sum = (f: (k: string) => string): number => keys.reduce((n, k) => n + f(k).length, 0);
      expect(sum(en), ns).toBeLessThanOrEqual(1.2 * sum(it_));
    }
  });

  it('virgolette bilanciate', () => {
    const bad = storyKeys.filter((k) => (en(k).match(/“/g) ?? []).length !== (en(k).match(/”/g) ?? []).length);
    expect(bad).toEqual([]);
  });

  it('niente virgolette basse né vocali accentate all\'italiana', () => {
    // «fiancé» ha l'accento acuto ed è inglese; le gravi (è, à, ò…) sono solo italiane.
    expect(storyKeys.filter((k) => /[«»àèìòùÀÈÌÒÙ]/.test(en(k)))).toEqual([]);
  });

  it('stessi marcatori di formattazione dell\'italiano', () => {
    const marks = (s: string): string => [...s].filter((c) => '*_<>[]|~#`'.includes(c)).sort().join('');
    expect(storyKeys.filter((k) => marks(en(k)) !== marks(it_(k)))).toEqual([]);
  });
});

describe('traduzione inglese: terminologia di comune.json e dell\'interfaccia', () => {
  /** Se l'italiano usa il termine, l'inglese usa quello di comune.json (senza badare alle maiuscole). */
  const GLOSSARY: readonly [RegExp, RegExp][] = [
    [/Libro dei Punti/i, /Book of Stitches/i],
    [/\bTaccuino\b/i, /\bNotebook\b/i],
    [/\bArchivio\b/i, /\bArchive\b/i],
    [/\bspill[oi] d'ottone\b/i, /\bbrass pins?\b/i],
    [/\bfil[oi] d'avorio\b/i, /\bivory (thread|ribbon)\b/i],
    [/\bnero di seppia\b/i, /\bsepia black\b/i],
    [/\bpunto aperto\b/i, /\bopen stitch\b/i],
    [/\btombolo\b/i, /\blace[ -]pillow\b/i],
    [/\bmatassa\b/i, /\bskein\b/i],
    [/\bfus[oi]\b/i, /\bbobbins?\b/i],
    [/\bmerlettai[ae]\b/i, /\blacemakers?\b/i],
    [/\bbigliettin[oi]\b/i, /\bnotes?\b/i],
    [/\bcassapanca\b/i, /\bchest\b/i],
    [/\bvaporett[oi]\b/i, /\bferr(y|ies)\b/i],
    [/\bacqua alta\b/i, /\bhigh water\b/i],
    [/\bfebbre\b/i, /\bfever\b/i],
    [/\bMolo\b/, /\bPier\b/i],
    [/\bForno\b/, /\bBakery\b/i],
    [/\bPiazza\b/, /\bSquare\b/i],
    [/\bChiesa\b/, /\bChurch\b/i],
    [/\bFarmacia\b/, /\bPharmacy\b/i],
    [/\bFaro\b/, /\bLighthouse\b/i],
  ];
  /** Eccezioni volute, con il motivo. */
  const EXCEPTIONS: Record<string, string> = {
    'atto1.g02.gino.testo': 'il Gino scrive «Peer» per Pier: la sua ortografia da bambino',
    'atto3.g22.hint.spinta': 'la secca è il lato del Faro: il suggerimento dice dove arriva Livia, «the Lighthouse»',
  };

  it('i termini del gioco sono quelli di comune.json', () => {
    const bad: string[] = [];
    for (const k of storyKeys) {
      if (EXCEPTIONS[k]) continue;
      for (const [itTerm, enTerm] of GLOSSARY) {
        if (itTerm.test(it_(k)) && !enTerm.test(en(k))) bad.push(`${k}: ${String(itTerm)} → ${String(enTerm)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('nessuna variante concorrente dei termini (spindle, cushion, diary…)', () => {
    const FORBIDDEN = /\b(spindles?|cushions?|Book of Points|diary|journal|wharf|quayside|vaporetto|campanile|Piazza)\b/i;
    expect(storyKeys.filter((k) => FORBIDDEN.test(en(k))).map((k) => `${k}: ${en(k).match(FORBIDDEN)?.[0]}`)).toEqual([]);
  });

  it('il gergo dei biglietti del Gino resta da bambino (minuscole ed errori)', () => {
    const gino = ALL_NOTES.filter((n) => n.author === 'gino' && isStoryKey(n.textKey));
    expect(gino.length).toBeGreaterThan(5);
    const MISTAKES = /\b(chirch|Peer|litehouse|teecher|sez|tonite|cofing|preist|eether|im|dont|cant)\b/;
    expect(gino.filter((n) => !MISTAKES.test(en(n.textKey))).map((n) => n.id)).toEqual([]);
  });
});

describe('traduzione inglese: limiti dell\'interfaccia e regole dei contenuti', () => {
  it('righe di gioco ≤ 90 caratteri (titoli, vignette, echi, margini, risposte, suggerimenti, etichette, epiloghi)', () => {
    const keys = new Set<string>();
    const add = (k: string | undefined): void => {
      if (k && isStoryKey(k)) keys.add(k);
    };
    for (const id of STORY_LEVELS) {
      const lv = level(id);
      add(lv.titleKey);
      for (const v of lv.dawn?.candidates ?? []) for (const l of v.lines) (add(l.textKey), add(l.forgetKey));
      for (const t of lv.tutorial ?? []) if (t.k === 'margine') add(t.textKey);
      add(lv.hintKeys?.spinta);
      add(lv.hintKeys?.indizio);
      for (const b of lv.beads) add(b.labelKey);
      for (const t of lv.threads) add(t.labelKey);
      if (lv.archive) {
        add(lv.archive.marginKey);
        for (const e of lv.archive.echoes) add(e.textKey);
        for (const l of lv.archive.reveal.lines) add(l.textKey);
      }
    }
    for (const n of ALL_NOTES) for (const r of n.replies ?? []) add(r.textKey);
    for (const e of db.endings.values()) {
      for (const v of e.epilogue) for (const l of v.lines) (add(l.textKey), add(l.forgetKey));
      for (const m of e.missing) add(m.textKey);
    }
    expect(keys.size).toBeGreaterThan(500);
    expect([...keys].filter((k) => en(k).length > 90).map((k) => `${k} (${en(k).length})`)).toEqual([]);
  });

  it('bigliettini e voci del Taccuino ≤ 220 caratteri', () => {
    const long: string[] = [];
    for (const n of ALL_NOTES) if (isStoryKey(n.textKey) && en(n.textKey).length > 220) long.push(n.id);
    for (const d of db.diary.values()) if (isStoryKey(d.textKey) && en(d.textKey).length > 220) long.push(d.id);
    expect(long).toEqual([]);
  });

  it('bigliettini da g12 senza «Ada» (tranne la scelta), anonimi da g13 come in italiano', () => {
    const NAMES: Partial<Record<CharacterId, RegExp>> = {
      teresa: /\bTeresa\b/, marta: /\bMarta\b/, piero: /\bPiero\b/, gino: /\bGino\b/,
      bepi: /\bBepi\b/, nina: /\bNina\b/, zeno: /\bZeno\b/, lunardi: /\bLunardi\b/,
    };
    for (const n of ALL_NOTES) {
      const day = Number(n.day.slice(1));
      if (Number.isNaN(day) || n.ending) continue;
      if (day >= 12) expect(/\bAda\b/.test(en(n.textKey)), n.id).toBe(/\bAda\b/.test(it_(n.textKey)));
      if (day < 13) continue;
      const re = NAMES[n.author];
      if (!re) continue;
      expect(re.test(en(n.textKey)), `${n.id} testo`).toBe(false);
      for (const r of n.replies ?? []) expect(re.test(en(r.textKey)), `${n.id} ${r.id}`).toBe(false);
    }
  });

  it('lettere: L. comincia con «My dear» e non fa nomi; Livia scrive «My Ada»; Clotilde firma C.', () => {
    for (const l of db.letters) {
      const it = it_(l.textKey);
      const text = en(l.textKey);
      if (it.startsWith('Cara mia,')) {
        expect(text.startsWith('My dear,'), l.id).toBe(true);
        expect(/Ada|Livia|Clotilde/.test(text), l.id).toBe(false);
        expect(text.endsWith('L.'), l.id).toBe(true);
        expect(text.split(/\s+/).length, l.id).toBeLessThanOrEqual(100);
      }
      if (it.startsWith('Ada mia,')) expect(text.startsWith('My Ada,'), l.id).toBe(true);
    }
    expect(en('atto2.lettere.lettera_clotilde').startsWith('Ada,\n')).toBe(true);
    expect(en('atto2.lettere.lettera_clotilde').endsWith('\nC.')).toBe(true);
  });
});
