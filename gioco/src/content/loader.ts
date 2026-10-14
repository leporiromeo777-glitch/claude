/**
 * Caricamento dei contenuti (ARCHITETTURA 3.1, 5.1).
 *
 * Sincrono: `import.meta.glob` con `eager: true` sui JSON di `src/content/`
 * (`*.json`, `levels/*.json`, `levels/*.computed.json`, `notes.*.json`,
 * `diary.*.json`, `lettere.*.json`). I testi (`text/<lingua>/*.json`) li carica i18n.
 * Un file assente dà una raccolta vuota; i problemi di forma (file che non sono
 * array, id duplicati, nomi di file diversi dall'id) li riporta validateContent.
 */
import type {
  BalanceDef,
  BookPageDef,
  CampaignDef,
  CharacterDef,
  CharacterId,
  ContentDB,
  DiaryEntryDef,
  DiaryEntryId,
  EndingDef,
  EndingId,
  LetterDef,
  LevelComputed,
  LevelDef,
  LevelId,
  LineDef,
  NoteDef,
  NoteId,
  PlaceDef,
  PlaceId,
} from '../core/types';

export const DEFAULT_BALANCE: BalanceDef = {
  acts: {
    '1': { pins: 2, slack: 3, notes: [3, 3] },
    '2': { pins: 2, slack: 2, notes: [3, 4] },
    '3': { pins: 3, slack: 1, notes: [4, 4] },
  },
  memoria: { start: 3, startLunardi: 1, min: 0, max: 3, trueEndingCount: 4 },
  traboccoSoglia: 3,
  nodoRighe: 1,
  hint: { lampSeconds: 60, undoRepeat: 3 },
  anim: { swapMs: 250, beadMs: 350, neroMs: 400, beatMs: 380 },
};

export const DEFAULT_CAMPAIGN: CampaignDef = {
  days: [],
  finals: { merlettaia: 'fin_merlettaia', seppia: 'fin_seppia', chiuso: 'fin_chiuso', aperto: 'fin_aperto' },
  choiceDay: 'g23',
};

export function emptyContentDB(): ContentDB {
  return {
    levels: new Map(),
    computed: new Map(),
    characters: new Map(),
    places: new Map(),
    notes: new Map(),
    diary: new Map(),
    lines: [],
    letters: [],
    book: [],
    campaign: { ...DEFAULT_CAMPAIGN, days: [], finals: { ...DEFAULT_CAMPAIGN.finals } },
    endings: new Map(),
    balance: JSON.parse(JSON.stringify(DEFAULT_BALANCE)) as BalanceDef,
    credits: { authorKey: '', lines: [] },
  };
}

export interface LoadResult {
  db: ContentDB;
  /** Problemi di forma trovati durante il caricamento (inglese, per gli sviluppatori). */
  problems: string[];
}

const problemsByDb = new WeakMap<ContentDB, string[]>();

/** Problemi del caricamento associati a un ContentDB (li include validateContent). */
export function loaderProblems(db: ContentDB): string[] {
  return problemsByDb.get(db) ?? [];
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Nome del file relativo alla cartella dei contenuti: './levels/g00.json' → 'levels/g00.json'. */
function rel(path: string): string {
  const i = path.lastIndexOf('/content/');
  const p = i >= 0 ? path.slice(i + '/content/'.length) : path;
  return p.replace(/^\.\//, '');
}

/** Costruisce il database dai file già letti (percorso → JSON). Puro: usato anche dai test. */
export function buildContentDB(files: Record<string, unknown>): LoadResult {
  const db = emptyContentDB();
  const problems: string[] = [];
  const p = (file: string, code: string, msg: string): void => {
    problems.push(`${file}: [${code}] ${msg}`);
  };

  const asArray = <T>(file: string, data: unknown): T[] => {
    if (Array.isArray(data)) return data as T[];
    p(file, 'forma', 'expected a JSON array');
    return [];
  };

  function intoMap<K extends string, T extends { id: K }>(file: string, list: T[], map: Map<K, T>, what: string): void {
    for (const item of list) {
      if (!isObj(item) || typeof item.id !== 'string') {
        p(file, 'forma', `${what} without a string "id"`);
        continue;
      }
      if (map.has(item.id)) p(file, 'duplicato', `${what} "${item.id}" defined more than once`);
      map.set(item.id, item);
    }
  }

  const entries = Object.entries(files)
    .map(([path, data]) => [rel(path), data] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  for (const [file, data] of entries) {
    const base = file.split('/').pop() ?? file;
    if (file.startsWith('levels/')) {
      const computed = /^(.+)\.computed\.json$/.exec(base);
      if (computed && computed[1]) {
        if (!isObj(data)) {
          p(file, 'forma', 'expected a JSON object (LevelComputed)');
          continue;
        }
        const c = data as unknown as LevelComputed;
        if (c.levelId !== computed[1]) p(file, 'id', `levelId "${String(c.levelId)}" differs from the file name`);
        db.computed.set(typeof c.levelId === 'string' ? c.levelId : computed[1], c);
        continue;
      }
      const m = /^(.+)\.json$/.exec(base);
      if (!m || !m[1]) continue;
      if (!isObj(data)) {
        p(file, 'forma', 'expected a JSON object (LevelDef)');
        continue;
      }
      const lv = data as unknown as LevelDef;
      const id: LevelId = typeof lv.id === 'string' ? lv.id : m[1];
      if (lv.id !== m[1]) p(file, 'id', `level id "${String(lv.id)}" differs from the file name`);
      if (db.levels.has(id)) p(file, 'duplicato', `level "${id}" defined more than once`);
      db.levels.set(id, lv);
      continue;
    }
    if (file.includes('/')) continue; // sottocartelle diverse da levels/ (per esempio text/)
    if (base === 'characters.json') intoMap<CharacterId, CharacterDef>(file, asArray(file, data), db.characters, 'character');
    else if (base === 'places.json') intoMap<PlaceId, PlaceDef>(file, asArray(file, data), db.places, 'place');
    else if (base === 'book.json') db.book.push(...asArray<BookPageDef>(file, data));
    else if (base === 'lines.json') db.lines.push(...asArray<LineDef>(file, data));
    else if (base === 'endings.json') intoMap<EndingId, EndingDef>(file, asArray(file, data), db.endings, 'ending');
    else if (base === 'balance.json') {
      if (isObj(data)) db.balance = data as unknown as BalanceDef;
      else p(file, 'forma', 'expected a JSON object (BalanceDef)');
    } else if (base === 'campaign.json') {
      if (isObj(data)) db.campaign = data as unknown as CampaignDef;
      else p(file, 'forma', 'expected a JSON object (CampaignDef)');
    } else if (base === 'credits.json') {
      if (isObj(data)) db.credits = data as unknown as ContentDB['credits'];
      else p(file, 'forma', 'expected a JSON object (credits)');
    } else if (/^notes\..+\.json$/.test(base)) intoMap<NoteId, NoteDef>(file, asArray(file, data), db.notes, 'note');
    else if (/^diary\..+\.json$/.test(base)) intoMap<DiaryEntryId, DiaryEntryDef>(file, asArray(file, data), db.diary, 'diary entry');
    else if (/^lettere\..+\.json$/.test(base)) db.letters.push(...asArray<LetterDef>(file, data));
  }
  problemsByDb.set(db, problems);
  return { db, problems };
}

/** Tutti i JSON dei contenuti (glob eager di Vite). */
export function contentFiles(): Record<string, unknown> {
  return import.meta.glob(['./*.json', './levels/*.json'], { eager: true, import: 'default' }) as Record<string, unknown>;
}

export function loadContent(files: Record<string, unknown> = contentFiles()): ContentDB {
  return buildContentDB(files).db;
}
