/**
 * Validazione dei contenuti (ARCHITETTURA 5.1, 15.2).
 *
 * `validateContent(db, opts)` restituisce un elenco di errori leggibili (in
 * inglese, per chi scrive i dati), ognuno nella forma
 *   `<dove>: [<classe>] <descrizione>`
 * Classi: forma, id, duplicato, ref, colonne, initial, ore, tipo, condizione,
 * storia, effetto, i18n. Controlli principali:
 * - riferimenti: personaggi, fili, perline, luoghi, bigliettini, voci del
 *   Taccuino, livelli citati devono esistere;
 * - colonne: da 3 a 6, senza ripetizioni, nell'ordine di PLACE_ORDER;
 * - `initial` lungo quanto le colonne, con fili esistenti e distinti;
 * - ore dentro la giornata (righe startHour+1 … endHour, al massimo 14);
 * - fili e perline citati nelle condizioni (obiettivi e richieste dei bigliettini);
 * - chiavi i18n: ogni textKey/labelKey/titleKey… esiste in italiano (se si passa `hasKey`).
 * Un database vuoto è valido: i pacchetti di contenuto arrivano dopo.
 */
import type {
  AgendaItem,
  ArchiveDef,
  BeadDef,
  Condition,
  ContentDB,
  Effect,
  LevelDef,
  PlaceId,
  StoryCond,
  ThreadDef,
  VignetteDef,
} from '../core/types';
import { PLACE_ORDER } from '../core/types';
import {
  BEAD_TYPES,
  CHARACTER_IDS,
  ENDING_IDS,
  LACE_EVENT_KINDS,
  OCCASION_KINDS,
  QUIRK_IDS,
  RULE_IDS,
  THREAD_KINDS,
  THREAD_PATTERNS,
  isOneOf,
} from '../core/ids';
import { loaderProblems } from './loader';

export interface ValidateOptions {
  /** La chiave esiste in italiano? Se assente, le chiavi i18n non si controllano. */
  hasKey?: (key: string) => boolean;
  /** Numero massimo di righe per giornata (GDD 3.13: mai più di 14). */
  maxRows?: number;
}

export const ERROR_CLASSES = [
  'forma', 'id', 'duplicato', 'ref', 'colonne', 'initial', 'ore', 'tipo', 'condizione', 'storia', 'effetto', 'i18n',
] as const;
export type ErrorClass = (typeof ERROR_CLASSES)[number];

/** Estrae la classe da un messaggio di errore ('levels/g00: [ref] …' → 'ref'). */
export function errorClass(msg: string): ErrorClass | null {
  const m = /: \[([a-z0-9]+)\]/.exec(msg);
  return m && isOneOf(ERROR_CLASSES, m[1]) ? m[1] : null;
}

const VIGNETTE_POSES = ['ferma', 'porge', 'saluta'] as const;
const DIARY_SECTIONS = ['persone', 'libro', 'domande', 'lettere', 'archivio'] as const;
const DIARY_SOURCES = ['visto', 'libro', 'sentito', 'archivio'] as const;
const LEVEL_KINDS = ['storia', 'archivio', 'finale', 'giornaliero', 'libero', 'esercizio', 'test'] as const;
const KNOWS_KINDS = ['quirk', 'diary', 'desire', 'rule', 'archive'] as const;
const UNLOCK_KINDS = ['archive', 'mode', 'cosmetic'] as const;

interface Scope {
  where: string;
  threads: Set<string>;
  beads: Map<string, BeadDef>;
  columns: readonly PlaceId[];
  start: number;
  end: number;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}
function isHour(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 24;
}

export function validateContent(db: ContentDB, opts: ValidateOptions = {}): string[] {
  const errors: string[] = [...loaderProblems(db)];
  const maxRows = opts.maxRows ?? 14;
  const err = (where: string, cls: ErrorClass, msg: string): void => {
    errors.push(`${where}: [${cls}] ${msg}`);
  };
  const key = (where: string, k: unknown, field: string, optional = false): void => {
    if (k === undefined && optional) return;
    if (typeof k !== 'string' || k.length === 0) {
      err(where, 'forma', `${field} must be a non-empty string`);
      return;
    }
    if (opts.hasKey && !opts.hasKey(k)) err(where, 'i18n', `${field} "${k}" missing in Italian`);
  };
  const charExists = (id: unknown): boolean =>
    typeof id === 'string' && (db.characters.size === 0 ? isOneOf(CHARACTER_IDS, id) : db.characters.has(id as never));
  const levelExists = (id: unknown): boolean => typeof id === 'string' && db.levels.has(id);
  const noteExists = (id: unknown): boolean => typeof id === 'string' && db.notes.has(id);
  const diaryExists = (id: unknown): boolean => typeof id === 'string' && db.diary.has(id);

  // ───────── Condizioni sul merletto ─────────
  function hourIn(s: Scope, h: unknown, field: string, optional = true, from?: number): void {
    if (h === undefined && optional) return;
    if (!isHour(h)) {
      err(s.where, 'ore', `${field} must be an hour between 0 and 24`);
      return;
    }
    const lo = from ?? s.start;
    if (h < lo || h > s.end) err(s.where, 'ore', `${field} ${h} outside the day (${lo}-${s.end})`);
  }
  function threadRef(s: Scope, t: unknown, field: string, allowStar = false): void {
    if (allowStar && t === '*') return;
    if (typeof t !== 'string' || !s.threads.has(t)) err(s.where, 'condizione', `${field} "${String(t)}" is not a thread of the level`);
  }
  function beadRef(s: Scope, b: unknown, field: string, onlyLetter = false): void {
    if (typeof b !== 'string') {
      err(s.where, 'condizione', `${field} must be a bead id`);
      return;
    }
    if (onlyLetter) {
      const def = s.beads.get(b);
      if (!def || def.type !== 'lettera') err(s.where, 'condizione', `${field} "${b}" is not a letter of the level`);
      return;
    }
    if (s.beads.has(b) || b === 'nome' || b === 'febbre') return;
    const m = /^letta:(.+)$/.exec(b);
    if (m && m[1] && s.beads.get(m[1])?.type === 'lettera') return;
    err(s.where, 'condizione', `${field} "${b}" is not a bead of the level`);
  }
  function placeRef(s: Scope, p: unknown, field: string, mustBeColumn: boolean): void {
    if (!isOneOf(PLACE_ORDER, p)) {
      err(s.where, 'ref', `${field} "${String(p)}" is not a place`);
      return;
    }
    if (mustBeColumn && !s.columns.includes(p)) err(s.where, 'condizione', `${field} "${p}" is not a column of the level`);
  }
  function cond(s: Scope, c: unknown, depth = 0): void {
    if (!isObj(c) || typeof c.t !== 'string') {
      err(s.where, 'condizione', 'condition without "t"');
      return;
    }
    if (depth > 12) {
      err(s.where, 'condizione', 'condition nested too deeply');
      return;
    }
    const x = c as unknown as Condition;
    switch (x.t) {
      case 'presso':
        threadRef(s, x.who, 'presso.who');
        placeRef(s, x.place, 'presso.place', true);
        hourIn(s, x.hour, 'presso.hour', false);
        break;
      case 'maiPresso':
        threadRef(s, x.who, 'maiPresso.who');
        placeRef(s, x.place, 'maiPresso.place', false);
        hourIn(s, x.from, 'maiPresso.from', false);
        hourIn(s, x.to, 'maiPresso.to', false);
        if (isHour(x.from) && isHour(x.to) && x.from > x.to) err(s.where, 'ore', 'maiPresso.from after maiPresso.to');
        break;
      case 'incontra':
      case 'nonIncontra':
        threadRef(s, x.a, `${x.t}.a`);
        threadRef(s, x.b, `${x.t}.b`, x.t === 'nonIncontra');
        hourIn(s, x.from, `${x.t}.from`);
        hourIn(s, x.to, `${x.t}.to`);
        if (isHour(x.from) && isHour(x.to) && x.from > x.to) err(s.where, 'ore', `${x.t}.from after ${x.t}.to`);
        if (x.a === x.b) err(s.where, 'condizione', `${x.t} with the same thread twice`);
        break;
      case 'sopra':
        threadRef(s, x.a, 'sopra.a');
        threadRef(s, x.b, 'sopra.b');
        hourIn(s, x.to, 'sopra.to');
        break;
      case 'consegnata':
        beadRef(s, x.bead, 'consegnata.bead', true);
        hourIn(s, x.by, 'consegnata.by');
        break;
      case 'ha':
        threadRef(s, x.who, 'ha.who');
        beadRef(s, x.bead, 'ha.bead');
        hourIn(s, x.by, 'ha.by');
        break;
      case 'nonHa':
        threadRef(s, x.who, 'nonHa.who');
        beadRef(s, x.bead, 'nonHa.bead');
        break;
      case 'parte':
        threadRef(s, x.who, 'parte.who');
        hourIn(s, x.hour, 'parte.hour');
        break;
      case 'resta':
      case 'sano':
        threadRef(s, x.who, `${x.t}.who`);
        break;
      case 'esceCon':
        beadRef(s, x.bead, 'esceCon.bead');
        hourIn(s, x.hour, 'esceCon.hour', false);
        break;
      case 'incontriAlmeno':
        threadRef(s, x.who, 'incontriAlmeno.who');
        if (!isInt(x.n) || x.n < 1) err(s.where, 'condizione', 'incontriAlmeno.n must be a positive integer');
        break;
      case 'tutti':
      case 'almeno':
        if (!Array.isArray(x.of) || x.of.length === 0) {
          err(s.where, 'condizione', `${x.t}.of must be a non-empty array`);
          break;
        }
        if (x.t === 'almeno' && (!isInt(x.n) || x.n < 1 || x.n > x.of.length)) {
          err(s.where, 'condizione', `almeno.n must be between 1 and ${x.of.length}`);
        }
        for (const sub of x.of) cond(s, sub, depth + 1);
        break;
      case 'non':
        cond(s, x.c, depth + 1);
        break;
      default:
        err(s.where, 'condizione', `unknown condition "${String((c as { t: unknown }).t)}"`);
    }
  }

  // ───────── Condizioni ed effetti di storia ─────────
  function story(where: string, c: unknown, depth = 0): void {
    if (!isObj(c)) {
      err(where, 'storia', 'story condition must be an object');
      return;
    }
    if (depth > 12) {
      err(where, 'storia', 'story condition nested too deeply');
      return;
    }
    const x = c as unknown as StoryCond;
    if ('flag' in x) {
      if (typeof x.flag !== 'string' || !x.flag) err(where, 'storia', 'flag must be a non-empty string');
    } else if ('ok' in x || 'failed' in x || 'accepted' in x || 'ignored' in x || 'reply' in x) {
      const id = 'ok' in x ? x.ok : 'failed' in x ? x.failed : 'accepted' in x ? x.accepted : 'ignored' in x ? x.ignored : x.reply;
      if (!noteExists(id)) err(where, 'ref', `story condition cites unknown note "${String(id)}"`);
      if ('reply' in x && x.is !== 'R1' && x.is !== 'R2') err(where, 'storia', 'reply.is must be R1 or R2');
    } else if ('event' in x) {
      if (!isOneOf(LACE_EVENT_KINDS, x.event)) err(where, 'storia', `unknown event "${String(x.event)}"`);
      if (x.quirk !== undefined && !isOneOf(QUIRK_IDS, x.quirk)) err(where, 'storia', `unknown quirk "${String(x.quirk)}"`);
    } else if ('knows' in x) {
      if (!isOneOf(KNOWS_KINDS, x.knows)) err(where, 'storia', `unknown knows kind "${String(x.knows)}"`);
      else if (x.knows === 'quirk' && !isOneOf(QUIRK_IDS, x.id)) err(where, 'ref', `unknown quirk "${x.id}"`);
      else if (x.knows === 'rule' && !isOneOf(RULE_IDS, x.id)) err(where, 'ref', `unknown rule "${x.id}"`);
      else if (x.knows === 'desire' && !charExists(x.id)) err(where, 'ref', `unknown character "${x.id}"`);
      else if (x.knows === 'diary' && db.diary.size > 0 && !diaryExists(x.id)) err(where, 'ref', `unknown diary entry "${x.id}"`);
      else if (x.knows === 'archive' && db.levels.size > 0 && !levelExists(x.id)) err(where, 'ref', `unknown archive level "${x.id}"`);
    } else if ('memoria' in x) {
      if (!charExists(x.memoria)) err(where, 'ref', `unknown character "${String(x.memoria)}"`);
    } else if ('done' in x) {
      if (db.levels.size > 0 && !levelExists(x.done)) err(where, 'ref', `unknown level "${String(x.done)}"`);
    } else if ('all' in x || 'any' in x) {
      const list = 'all' in x ? x.all : x.any;
      if (!Array.isArray(list)) err(where, 'storia', 'all/any must be arrays');
      else for (const sub of list) story(where, sub, depth + 1);
    } else if ('not' in x) {
      story(where, x.not, depth + 1);
    } else {
      err(where, 'storia', `unknown story condition ${JSON.stringify(c).slice(0, 60)}`);
    }
  }

  function effects(where: string, list: unknown): void {
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      err(where, 'effetto', 'effects must be an array');
      return;
    }
    for (const e of list) {
      if (!isObj(e)) {
        err(where, 'effetto', 'effect must be an object');
        continue;
      }
      const x = e as unknown as Effect;
      if ('setFlag' in x) {
        if (typeof x.setFlag !== 'string' || !['string', 'number', 'boolean'].includes(typeof x.value)) err(where, 'effetto', 'setFlag needs a name and a value');
      } else if ('addFlag' in x) {
        if (typeof x.addFlag !== 'string' || typeof x.by !== 'number') err(where, 'effetto', 'addFlag needs a name and a number');
      } else if ('diary' in x) {
        if (db.diary.size > 0 && !diaryExists(x.diary)) err(where, 'ref', `effect cites unknown diary entry "${String(x.diary)}"`);
      } else if ('desire' in x) {
        if (!charExists(x.desire)) err(where, 'ref', `effect cites unknown character "${String(x.desire)}"`);
      } else if ('question' in x) {
        if (x.state !== 'aperta' && x.state !== 'risolta') err(where, 'effetto', 'question.state must be aperta or risolta');
      } else if ('memoria' in x) {
        if (!charExists(x.memoria) || typeof x.by !== 'number') err(where, 'effetto', 'memoria needs a character and a number');
      } else if ('unlock' in x) {
        if (!isOneOf(UNLOCK_KINDS, x.unlock) || typeof x.id !== 'string') err(where, 'effetto', 'unlock needs a kind and an id');
      } else if ('object' in x) {
        if (typeof x.object !== 'string') err(where, 'effetto', 'object must be a string');
      } else {
        err(where, 'effetto', `unknown effect ${JSON.stringify(e).slice(0, 60)}`);
      }
    }
  }

  function vignette(where: string, v: VignetteDef, s: Scope | null): void {
    if (!isObj(v)) {
      err(where, 'forma', 'vignette must be an object');
      return;
    }
    const w = `${where}/${String(v.id)}`;
    if (typeof v.id !== 'string' || !v.id) err(where, 'forma', 'vignette without id');
    if (typeof v.priority !== 'number') err(w, 'forma', 'vignette without numeric priority');
    if (typeof v.background !== 'string' || !v.background) err(w, 'forma', 'vignette without background');
    if (v.when !== undefined) story(w, v.when);
    if (!Array.isArray(v.figures)) err(w, 'forma', 'figures must be an array');
    else {
      if (v.figures.length > 3) err(w, 'forma', 'at most 3 figures per vignette');
      for (const f of v.figures) {
        if (!charExists(f.character)) err(w, 'ref', `figure of unknown character "${String(f.character)}"`);
        if (!isOneOf(VIGNETTE_POSES, f.pose)) err(w, 'tipo', `unknown pose "${String(f.pose)}"`);
        if (typeof f.x !== 'number' || f.x < 0 || f.x > 1) err(w, 'forma', 'figure x must be between 0 and 1');
      }
    }
    if (!Array.isArray(v.lines) || v.lines.length === 0) err(w, 'forma', 'vignette needs at least one line');
    else {
      if (v.lines.length > 2) err(w, 'forma', 'at most 2 lines per vignette');
      for (const l of v.lines) {
        if (l.speaker !== 'narratore' && !charExists(l.speaker)) err(w, 'ref', `line of unknown speaker "${String(l.speaker)}"`);
        key(w, l.textKey, 'textKey');
        key(w, l.forgetKey, 'forgetKey', true);
      }
    }
    void s;
  }

  function agenda(s: Scope, list: unknown, field: string): void {
    if (!Array.isArray(list)) {
      err(s.where, 'forma', `${field} must be an array`);
      return;
    }
    for (const a of list as AgendaItem[]) {
      if (!isObj(a)) {
        err(s.where, 'forma', `${field} item must be an object`);
      } else if ('follow' in a) threadRef(s, a.follow, `${field}.follow`);
      else if ('place' in a) {
        placeRef(s, a.place, `${field}.place`, true);
        hourIn(s, a.hour, `${field}.hour`, false);
      } else if (!('stay' in a)) err(s.where, 'forma', `${field} item must be follow, place/hour or stay`);
    }
  }

  function occasions(s: Scope, list: unknown, field: string): void {
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      err(s.where, 'forma', `${field} must be an array`);
      return;
    }
    for (const o of list) {
      if (!isObj(o) || !isOneOf(OCCASION_KINDS, o.kind)) err(s.where, 'tipo', `${field}: unknown occasion kind`);
      if (isObj(o)) {
        placeRef(s, o.place, `${field}.place`, true);
        hourIn(s, o.hour, `${field}.hour`, false);
      }
    }
  }

  function archive(s: Scope, a: ArchiveDef): void {
    const w = s.where;
    if (!isObj(a)) {
      err(w, 'forma', 'archive must be an object');
      return;
    }
    key(w, a.titleKey, 'archive.titleKey');
    key(w, a.marginKey, 'archive.marginKey');
    if (!Array.isArray(a.faded)) err(w, 'forma', 'archive.faded must be an array');
    else for (const t of a.faded) threadRef(s, t, 'archive.faded');
    if (!Array.isArray(a.candidates)) err(w, 'forma', 'archive.candidates must be an array');
    else for (const c of a.candidates) if (!charExists(c)) err(w, 'ref', `archive candidate "${String(c)}" is not a character`);
    if (!isObj(a.answer)) err(w, 'forma', 'archive.answer must be an object');
    else {
      for (const [t, c] of Object.entries(a.answer)) {
        threadRef(s, t, 'archive.answer key');
        if (!charExists(c)) err(w, 'ref', `archive answer "${String(c)}" is not a character`);
        if (Array.isArray(a.candidates) && !a.candidates.includes(c)) err(w, 'ref', `archive answer "${String(c)}" is not among the candidates`);
      }
      if (Array.isArray(a.faded)) for (const t of a.faded) if (!(t in a.answer)) err(w, 'ref', `faded thread "${t}" has no answer`);
    }
    if (!Array.isArray(a.holes)) err(w, 'forma', 'archive.holes must be an array');
    else
      for (const h of a.holes) {
        hourIn(s, h.from, 'archive.holes.from', false, s.start + 1);
        hourIn(s, h.to, 'archive.holes.to', false, s.start + 1);
      }
    if (!Array.isArray(a.recorded)) err(w, 'forma', 'archive.recorded must be an array');
    else {
      const rows = s.end - s.start;
      if (a.recorded.length !== rows) err(w, 'ore', `archive.recorded has ${a.recorded.length} rows, the day has ${rows}`);
      a.recorded.forEach((r, i) => {
        if (r.hour !== s.start + 1 + i) err(w, 'ore', `archive.recorded[${i}].hour should be ${s.start + 1 + i}`);
        for (const c of r.crossings ?? []) {
          if (!isInt(c.pair) || c.pair < 0 || c.pair > s.columns.length - 2) err(w, 'colonne', `archive.recorded[${i}] pair ${String(c.pair)} out of range`);
        }
      });
    }
    if (!Array.isArray(a.echoes)) err(w, 'forma', 'archive.echoes must be an array');
    else
      for (const e of a.echoes) {
        hourIn(s, e.hour, 'archive.echoes.hour', false, s.start + 1);
        key(w, e.textKey, 'archive.echoes.textKey');
      }
    vignette(`${w}/reveal`, a.reveal, s);
    if (Array.isArray(a.unlocks) && db.diary.size > 0) for (const d of a.unlocks) if (!diaryExists(d)) err(w, 'ref', `archive unlocks unknown diary entry "${d}"`);
  }

  // ───────── Livelli ─────────
  const scopes = new Map<string, Scope>();
  function level(id: string, lv: LevelDef): void {
    const where = `levels/${id}`;
    if (!isObj(lv)) {
      err(where, 'forma', 'level must be an object');
      return;
    }
    if (!isOneOf(LEVEL_KINDS, lv.kind)) err(where, 'tipo', `unknown kind "${String(lv.kind)}"`);
    if (![0, 1, 2, 3].includes(lv.act)) err(where, 'tipo', 'act must be 0, 1, 2 or 3');
    key(where, lv.titleKey, 'titleKey');

    // Colonne
    const columns: PlaceId[] = Array.isArray(lv.columns) ? lv.columns.filter((c) => isOneOf(PLACE_ORDER, c)) : [];
    if (!Array.isArray(lv.columns)) err(where, 'colonne', 'columns must be an array');
    else {
      if (lv.columns.length < 3 || lv.columns.length > 6) err(where, 'colonne', `${lv.columns.length} columns (allowed 3-6)`);
      for (const c of lv.columns) if (!isOneOf(PLACE_ORDER, c)) err(where, 'colonne', `"${String(c)}" is not a place`);
      if (new Set(lv.columns).size !== lv.columns.length) err(where, 'colonne', 'repeated column');
      const idx = columns.map((c) => PLACE_ORDER.indexOf(c));
      if (idx.some((v, i) => i > 0 && v <= (idx[i - 1] ?? -1))) err(where, 'colonne', `columns not in the order ${PLACE_ORDER.join(', ')}`);
    }

    // Ore
    const start = isHour(lv.startHour) ? lv.startHour : 0;
    const end = isHour(lv.endHour) ? lv.endHour : 0;
    if (!isHour(lv.startHour) || !isHour(lv.endHour)) err(where, 'ore', 'startHour and endHour must be hours between 0 and 24');
    else if (end <= start) err(where, 'ore', 'endHour must be after startHour');
    else if (end - start > maxRows) err(where, 'ore', `${end - start} rows (at most ${maxRows})`);

    // Fili
    const threads = new Set<string>();
    if (!Array.isArray(lv.threads)) err(where, 'forma', 'threads must be an array');
    else
      for (const t of lv.threads as ThreadDef[]) {
        if (!isObj(t) || typeof t.id !== 'string') {
          err(where, 'forma', 'thread without id');
          continue;
        }
        if (threads.has(t.id)) err(where, 'duplicato', `thread "${t.id}" defined twice`);
        threads.add(t.id);
        if (!isOneOf(THREAD_KINDS, t.kind)) err(where, 'tipo', `thread "${t.id}" has unknown kind "${String(t.kind)}"`);
        if (t.kind !== 'lino') {
          // Un filo con nome senza personaggio (per esempio "il fornaio" dell'Archivio) deve avere almeno un'etichetta.
          if (t.character === undefined && !isOneOf(CHARACTER_IDS, t.id) && t.labelKey === undefined) {
            err(where, 'ref', `thread "${t.id}" (${t.kind}) needs a character or a labelKey`);
          }
          if (t.character !== undefined && !charExists(t.character)) err(where, 'ref', `thread "${t.id}" cites unknown character "${t.character}"`);
        }
        key(where, t.labelKey, `thread ${t.id} labelKey`, true);
      }

    // Posizioni iniziali
    if (!Array.isArray(lv.initial)) err(where, 'initial', 'initial must be an array');
    else {
      if (Array.isArray(lv.columns) && lv.initial.length !== lv.columns.length) {
        err(where, 'initial', `initial has ${lv.initial.length} threads but there are ${lv.columns.length} columns`);
      }
      for (const t of lv.initial) if (!threads.has(t)) err(where, 'initial', `initial cites unknown thread "${String(t)}"`);
      if (new Set(lv.initial).size !== lv.initial.length) err(where, 'initial', 'the same thread appears twice in initial');
    }

    // Perline
    const beads = new Map<string, BeadDef>();
    if (!Array.isArray(lv.beads)) err(where, 'forma', 'beads must be an array');
    else
      for (const b of lv.beads) {
        if (!isObj(b) || typeof b.id !== 'string') {
          err(where, 'forma', 'bead without id');
          continue;
        }
        if (beads.has(b.id)) err(where, 'duplicato', `bead "${b.id}" defined twice`);
        beads.set(b.id, b);
        if (!isOneOf(BEAD_TYPES, b.type)) err(where, 'tipo', `bead "${b.id}" has unknown type "${String(b.type)}"`);
        if (b.holder !== undefined && !threads.has(b.holder)) err(where, 'ref', `bead "${b.id}" held by unknown thread "${b.holder}"`);
        for (const h of b.holders ?? []) if (!threads.has(h)) err(where, 'ref', `bead "${b.id}" held by unknown thread "${h}"`);
        if (b.type === 'lettera') {
          if (b.to === undefined) err(where, 'ref', `letter "${b.id}" without recipient "to"`);
          else if (!threads.has(b.to)) err(where, 'ref', `letter "${b.id}" addressed to unknown thread "${b.to}"`);
          if (b.holder === undefined) err(where, 'ref', `letter "${b.id}" without holder`);
        } else if (b.to !== undefined) err(where, 'tipo', `only letters have "to" (bead "${b.id}")`);
        key(where, b.labelKey, `bead ${b.id} labelKey`);
      }

    const s: Scope = { where, threads, beads, columns, start, end };
    scopes.set(id, s);

    // Regole e stranezze
    if (!Array.isArray(lv.rules)) err(where, 'forma', 'rules must be an array');
    else for (const r of lv.rules) if (!isOneOf(RULE_IDS, r)) err(where, 'tipo', `unknown rule "${String(r)}"`);
    if (!Array.isArray(lv.quirks)) err(where, 'forma', 'quirks must be an array');
    else for (const q of lv.quirks) if (!isOneOf(QUIRK_IDS, q)) err(where, 'tipo', `unknown quirk "${String(q)}"`);
    for (const pair of lv.rancor ?? []) {
      if (!Array.isArray(pair) || pair.length !== 2) err(where, 'forma', 'rancor entries must be pairs');
      else for (const t of pair) if (!threads.has(t)) err(where, 'ref', `rancor cites unknown thread "${String(t)}"`);
    }

    // Spilli d'ottone
    if (!Array.isArray(lv.pins)) err(where, 'forma', 'pins must be an array');
    else
      for (const p of lv.pins) {
        if (!threads.has(p.thread)) err(where, 'ref', `pin for unknown thread "${String(p.thread)}"`);
        placeRef(s, p.place, 'pin.place', true);
        hourIn(s, p.hour, 'pin.hour', false, start + 1);
      }

    // Bordi, marea, filo nero, autotessitura
    for (const e of lv.edges ?? []) {
      hourIn(s, e.hour, 'edge.hour', false, start + 1);
      if (e.side !== 'molo' && e.side !== 'faro') err(where, 'tipo', `edge side "${String(e.side)}" must be molo or faro`);
      if (!['vaporetto', 'barca', 'secca'].includes(e.kind)) err(where, 'tipo', `unknown edge kind "${String(e.kind)}"`);
      if (e.enters !== undefined && !threads.has(e.enters)) err(where, 'ref', `edge brings unknown thread "${e.enters}"`);
    }
    for (const t of lv.tide ?? []) {
      hourIn(s, t.from, 'tide.from', false, start + 1);
      hourIn(s, t.to, 'tide.to', false, start + 1);
      if (isHour(t.from) && isHour(t.to) && t.from > t.to) err(where, 'ore', 'tide.from after tide.to');
      for (const p of t.places ?? []) placeRef(s, p, 'tide.places', true);
    }
    if (lv.nero) {
      const n = lv.nero;
      if (!threads.has(n.thread)) err(where, 'ref', `nero thread "${String(n.thread)}" is not a thread of the level`);
      else if (Array.isArray(lv.threads) && lv.threads.find((t) => t.id === n.thread)?.kind !== 'nero') err(where, 'tipo', `nero thread "${n.thread}" must have kind "nero"`);
      if (!isObj(n.enter)) err(where, 'forma', 'nero.enter must be an object');
      else {
        hourIn(s, n.enter.hour, 'nero.enter.hour', false);
        if (n.enter.side !== 'molo' && n.enter.side !== 'faro') err(where, 'tipo', 'nero.enter.side must be molo or faro');
      }
      agenda(s, n.agenda, 'nero.agenda');
      if (Array.isArray(lv.rules) && !lv.rules.includes('nero')) err(where, 'ref', 'a level with nero must list the rule "nero"');
    }
    if (lv.autoweave) {
      const a = lv.autoweave;
      if (!Array.isArray(a.agents)) err(where, 'forma', 'autoweave.agents must be an array');
      else
        for (const ag of a.agents) {
          threadRef(s, ag.thread, 'autoweave.agent');
          agenda(s, ag.agenda, `autoweave.${ag.thread}.agenda`);
          for (const l of ag.likes ?? []) if (!isOneOf(OCCASION_KINDS, l)) err(where, 'tipo', `unknown occasion kind "${String(l)}"`);
          for (const g of ag.givesTo ?? []) threadRef(s, g, 'autoweave.givesTo');
        }
      if (a.controlled !== undefined) threadRef(s, a.controlled, 'autoweave.controlled');
      if (a.occasionSlots !== undefined && (!isInt(a.occasionSlots) || a.occasionSlots < 1)) err(where, 'forma', 'autoweave.occasionSlots must be a positive integer');
      occasions(s, a.allowedOccasions, 'autoweave.allowedOccasions');
      occasions(s, a.presetOccasions, 'autoweave.presetOccasions');
    }

    // Obiettivi, bigliettini, matassa
    for (const g of lv.goals ?? []) cond(s, g);
    for (const n of lv.notes ?? []) if (!noteExists(n)) err(where, 'ref', `level cites unknown note "${String(n)}"`);
    if (!isInt(lv.matassa) || lv.matassa < 0) err(where, 'forma', 'matassa must be a non-negative integer');

    // Alba, archivio, suggerimenti, tutorial
    if (lv.dawn) {
      if (!Array.isArray(lv.dawn.candidates)) err(where, 'forma', 'dawn.candidates must be an array');
      else {
        const seen = new Set<string>();
        for (const v of lv.dawn.candidates) {
          if (seen.has(v.id)) err(where, 'duplicato', `vignette "${v.id}" defined twice`);
          seen.add(v.id);
          vignette(`${where}/dawn`, v, s);
        }
      }
    }
    if (lv.archive) archive(s, lv.archive);
    if (lv.hintKeys) {
      key(where, lv.hintKeys.spinta, 'hintKeys.spinta', true);
      key(where, lv.hintKeys.indizio, 'hintKeys.indizio', true);
    }
    for (const t of lv.tutorial ?? []) {
      if (!isObj(t)) {
        err(where, 'forma', 'tutorial step must be an object');
        continue;
      }
      if (t.k === 'mano') {
        hourIn(s, t.hour, 'tutorial.mano.hour', false, start + 1);
        if (!isInt(t.pair) || t.pair < 0 || t.pair > columns.length - 2) err(where, 'colonne', `tutorial pair ${String(t.pair)} out of range`);
        if (t.over !== 'L' && t.over !== 'R') err(where, 'tipo', 'tutorial.mano.over must be L or R');
      } else if (t.k === 'margine') {
        key(where, t.textKey, 'tutorial.margine.textKey');
        hourIn(s, t.hour, 'tutorial.margine.hour', true, start + 1);
      } else if (t.k === 'pulsa') {
        hourIn(s, t.hour, 'tutorial.pulsa.hour', false, start + 1);
      } else err(where, 'tipo', `unknown tutorial step "${String((t as { k: unknown }).k)}"`);
    }
  }

  for (const [id, lv] of db.levels) level(id, lv);

  for (const [id, c] of db.computed) {
    const where = `levels/${id}.computed`;
    if (!db.levels.has(id)) err(where, 'ref', `computed data for unknown level "${id}"`);
    if (!isObj(c.base) || typeof c.sourceHash !== 'string') err(where, 'forma', 'computed file without base or sourceHash');
    for (const n of Object.keys(c.perNote ?? {})) if (db.notes.size > 0 && !noteExists(n)) err(where, 'ref', `computed data for unknown note "${n}"`);
  }

  // ───────── Personaggi e luoghi ─────────
  for (const [id, c] of db.characters) {
    const where = `characters/${id}`;
    if (!isOneOf(CHARACTER_IDS, id)) err(where, 'id', `"${id}" is not a CharacterId`);
    key(where, c.nameKey, 'nameKey');
    key(where, c.roleKey, 'roleKey');
    key(where, c.desireKey, 'desireKey', true);
    if (typeof c.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.color)) err(where, 'forma', 'color must be #RRGGBB');
    if (!isOneOf(THREAD_PATTERNS, c.pattern)) err(where, 'tipo', `unknown pattern "${String(c.pattern)}"`);
    if (typeof c.icon !== 'string') err(where, 'forma', 'icon must be a string');
    for (const q of c.quirks ?? []) if (!isOneOf(QUIRK_IDS, q)) err(where, 'tipo', `unknown quirk "${String(q)}"`);
    for (const l of c.likes ?? []) if (!isOneOf(OCCASION_KINDS, l)) err(where, 'tipo', `unknown occasion kind "${String(l)}"`);
    if (c.hand && !['caveat', 'garamond', 'atkinson'].includes(c.hand.font)) err(where, 'tipo', `unknown font "${String(c.hand.font)}"`);
  }
  for (const [id, p] of db.places) {
    const where = `places/${id}`;
    if (!isOneOf(PLACE_ORDER, id)) err(where, 'id', `"${id}" is not a PlaceId`);
    key(where, p.nameKey, 'nameKey');
    key(where, p.shortKey, 'shortKey');
  }

  // ───────── Bigliettini ─────────
  for (const [id, n] of db.notes) {
    const where = `notes/${id}`;
    if (db.levels.size > 0 && !levelExists(n.day)) err(where, 'ref', `note for unknown day "${String(n.day)}"`);
    if (!charExists(n.author)) err(where, 'ref', `note by unknown character "${String(n.author)}"`);
    key(where, n.textKey, 'textKey');
    const s = scopes.get(n.day);
    if (n.request !== undefined) {
      if (s) cond({ ...s, where }, n.request);
      else if (!isObj(n.request)) err(where, 'condizione', 'request must be a condition');
    }
    for (const r of n.replies ?? []) {
      if (r.id !== 'R1' && r.id !== 'R2') err(where, 'forma', 'reply id must be R1 or R2');
      key(where, r.textKey, `reply ${r.id} textKey`);
      effects(where, r.effects);
    }
    effects(where, n.onOk);
    effects(where, n.onFail);
    effects(where, n.onIgnore);
    if (n.availableIf !== undefined) story(where, n.availableIf);
    if (n.ending !== undefined && !isOneOf(ENDING_IDS, n.ending)) err(where, 'tipo', `unknown ending "${String(n.ending)}"`);
  }

  // ───────── Taccuino, battute, lettere, Libro ─────────
  for (const [id, d] of db.diary) {
    const where = `diary/${id}`;
    if (!isOneOf(DIARY_SECTIONS, d.section)) err(where, 'tipo', `unknown section "${String(d.section)}"`);
    if (d.source !== undefined && !isOneOf(DIARY_SOURCES, d.source)) err(where, 'tipo', `unknown source "${String(d.source)}"`);
    if (d.character !== undefined && !charExists(d.character)) err(where, 'ref', `unknown character "${d.character}"`);
    key(where, d.textKey, 'textKey');
    if (d.unlock === undefined) err(where, 'storia', 'diary entry without unlock condition');
    else story(where, d.unlock);
  }
  const lineIds = new Set<string>();
  db.lines.forEach((l, i) => {
    const where = `lines/${String(l.id ?? i)}`;
    if (typeof l.id !== 'string') err(where, 'forma', 'line without id');
    else if (lineIds.has(l.id)) err(where, 'duplicato', `line "${l.id}" defined twice`);
    else lineIds.add(l.id);
    if (!charExists(l.character)) err(where, 'ref', `unknown character "${String(l.character)}"`);
    if (l.event !== 'riserva' && !isOneOf(LACE_EVENT_KINDS, l.event)) err(where, 'tipo', `unknown event "${String(l.event)}"`);
    if (l.with !== undefined && !charExists(l.with)) err(where, 'ref', `unknown character "${l.with}"`);
    if (l.when !== undefined) story(where, l.when);
    key(where, l.textKey, 'textKey');
    key(where, l.forgetKey, 'forgetKey', true);
  });
  const letterIds = new Set<string>();
  db.letters.forEach((l, i) => {
    const where = `lettere/${String(l.id ?? i)}`;
    if (typeof l.id !== 'string') err(where, 'forma', 'letter without id');
    else if (letterIds.has(l.id)) err(where, 'duplicato', `letter "${l.id}" defined twice`);
    else letterIds.add(l.id);
    if (db.levels.size > 0 && !levelExists(l.arrivesAfter)) err(where, 'ref', `letter arrives after unknown day "${String(l.arrivesAfter)}"`);
    key(where, l.textKey, 'textKey');
  });
  db.book.forEach((b, i) => {
    const where = `book/${String(b.id ?? i)}`;
    if (b.rule !== 'puntoAperto' && !isOneOf(RULE_IDS, b.rule)) err(where, 'tipo', `unknown rule "${String(b.rule)}"`);
    key(where, b.titleKey, 'titleKey');
    key(where, b.textKey, 'textKey');
    key(where, b.marginKey, 'marginKey', true);
    if (b.unlock === undefined) err(where, 'storia', 'book page without unlock condition');
    else story(where, b.unlock);
  });

  // ───────── Campagna e finali ─────────
  const camp = db.campaign;
  const dayIds = new Set<string>();
  if (!Array.isArray(camp.days)) err('campaign', 'forma', 'days must be an array');
  else
    for (const d of camp.days) {
      const where = `campaign/${String(d.id)}`;
      if (dayIds.has(d.id)) err(where, 'duplicato', 'day listed twice');
      dayIds.add(d.id);
      if (db.levels.size > 0 && !levelExists(d.id)) err(where, 'ref', 'day without level');
      if (d.archiveAfter !== undefined && db.levels.size > 0) {
        if (!levelExists(d.archiveAfter)) err(where, 'ref', `archiveAfter cites unknown level "${d.archiveAfter}"`);
        else if (db.levels.get(d.archiveAfter)?.kind !== 'archivio') err(where, 'tipo', `archiveAfter "${d.archiveAfter}" is not an archive level`);
      }
      if (![0, 1, 2, 3].includes(d.act)) err(where, 'tipo', 'act must be 0, 1, 2 or 3');
      if (typeof d.stonatura !== 'number' || d.stonatura < 0 || d.stonatura > 1) err(where, 'forma', 'stonatura must be between 0 and 1');
    }
  if (camp.days.length > 0 && !dayIds.has(camp.choiceDay)) err('campaign', 'ref', `choiceDay "${camp.choiceDay}" is not a campaign day`);
  if (db.levels.size > 0 && camp.days.length > 0) {
    for (const e of ENDING_IDS) {
      const lv = camp.finals?.[e];
      if (!levelExists(lv)) err('campaign', 'ref', `final "${e}" cites unknown level "${String(lv)}"`);
    }
  }
  for (const [id, e] of db.endings) {
    const where = `endings/${id}`;
    if (!isOneOf(ENDING_IDS, id)) err(where, 'id', `"${id}" is not an EndingId`);
    if (db.levels.size > 0 && !levelExists(e.level)) err(where, 'ref', `ending level "${String(e.level)}" does not exist`);
    if (e.requires !== undefined) story(where, e.requires);
    for (const m of e.missing ?? []) {
      story(where, m.cond);
      key(where, m.textKey, 'missing.textKey');
    }
    for (const v of e.epilogue ?? []) vignette(`${where}/epilogue`, v, null);
  }
  if (db.credits.authorKey) key('credits', db.credits.authorKey, 'authorKey');
  for (const l of db.credits.lines ?? []) key('credits', l.key, 'lines.key');

  return errors;
}
