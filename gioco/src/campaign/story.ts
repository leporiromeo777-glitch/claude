/**
 * Condizioni ed effetti di storia (ARCHITETTURA 4 "StoryCond", "Effect"; GDD 5.1, 5.8, 5.9).
 *
 * `evalStory(cond, s, k)` valuta una condizione sullo stato della campagna e sulla
 * conoscenza; `applyEffects(effects, s, k)` applica gli effetti e restituisce che cosa
 * è cambiato (voci nuove, desideri, sblocchi), così chi chiama può mostrarlo.
 *
 * Convenzioni (vedi anche types.ts del pacchetto):
 * - `{flag}`: senza `eq`, `gte`, `lte` il flag deve essere "acceso" (true, 'sì', numero ≠ 0);
 *   con `eq` booleano si confronta l'accensione (un flag assente vale false); con `eq`
 *   stringa o numero l'uguaglianza esatta; `gte`/`lte` valgono sui numeri (assente = 0).
 * - `{ok}`, `{failed}`, `{accepted}`, `{ignored}`, `{reply}`: dalla storia delle giornate
 *   (`history`) e dalla sera in corso.
 * - `{event}`: negli eventi dell'ultima notte giocata (`lastOutcome`); `a` e `b` sono
 *   fili o personaggi coinvolti nell'evento.
 * - `{memoria}`: la memoria di Ada del personaggio; prima di g12 (memoria non ancora
 *   in gioco) vale quella iniziale di balance.json (3, Lunardi 1).
 * - `{knows: 'oggetto', id}` (C03): l'oggetto o la lettera `id` è stato letto
 *   (`knowledge.objects` o `knowledge.letters`).
 * - `{done}`: la giornata (o il finale) è stata chiusa in questa linea del tempo,
 *   oppure il merletto d'Archivio è rammendato.
 */
import type {
  BalanceDef,
  CampaignState,
  CharacterId,
  ContentDB,
  DiaryEntryId,
  Effect,
  FlagValue,
  Knowledge,
  LaceEvent,
  LevelDef,
  NoteId,
  QuestionId,
  StoryCond,
  ThreadId,
} from '../core/types';
import { flagOn } from '../engine/index';
import type { DayResultX } from './types';

export const MEMORIA_DEFAULTS: BalanceDef['memoria'] = { start: 3, startLunardi: 1, min: 0, max: 3, trueEndingCount: 4 };

export interface StoryOptions {
  /** Contenuti: per i fili dei livelli (eventi) e per le voci del Taccuino (domande aperte e chiuse). */
  db?: Pick<ContentDB, 'levels' | 'diary' | 'balance'> | null;
}

function balanceMemoria(o?: StoryOptions): BalanceDef['memoria'] {
  return o?.db?.balance?.memoria ?? MEMORIA_DEFAULTS;
}

/** Memoria di Ada di un personaggio (con i valori iniziali se non è ancora in gioco). */
export function memoriaOf(s: Pick<CampaignState, 'memoria'>, c: CharacterId, m: BalanceDef['memoria'] = MEMORIA_DEFAULTS): number {
  const v = s.memoria[c];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return c === 'lunardi' ? m.startLunardi : m.start;
}

function histories(s: Pick<CampaignState, 'history'>): DayResultX[] {
  return Object.values(s.history ?? {}) as DayResultX[];
}

export function requestStatusOf(s: Pick<CampaignState, 'history'>, id: NoteId): 'soddisfatta' | 'fallita' | null {
  for (const h of histories(s)) {
    const r = h.requests?.find((x) => x.noteId === id);
    if (r) return r.status;
  }
  return null;
}

export function wasAccepted(s: Pick<CampaignState, 'history' | 'evening'>, id: NoteId): boolean {
  if (s.evening?.accepted.some((a) => a.noteId === id)) return true;
  return histories(s).some((h) => h.requests?.some((r) => r.noteId === id) || h.accepted?.some((a) => a.noteId === id));
}

export function wasIgnored(s: Pick<CampaignState, 'history' | 'evening'>, id: NoteId): boolean {
  if (s.evening?.ignored.includes(id)) return true;
  return histories(s).some((h) => h.ignored?.includes(id));
}

export function replyOf(s: Pick<CampaignState, 'history' | 'evening'>, id: NoteId): 'R1' | 'R2' | null {
  const cur = s.evening?.replies[id];
  if (cur) return cur;
  for (const h of histories(s)) {
    const r = h.replies?.[id];
    if (r) return r;
  }
  return null;
}

export function isDone(s: Pick<CampaignState, 'history'>, k: Pick<Knowledge, 'archive'>, id: string): boolean {
  return !!s.history?.[id] || k.archive?.[id] === 'rammendato';
}

function flagMatches(c: { flag: string; eq?: FlagValue; gte?: number; lte?: number }, flags: Record<string, FlagValue>): boolean {
  const v = flags[c.flag];
  let ok = true;
  if (c.eq !== undefined) {
    if (typeof c.eq === 'boolean') ok = flagOn(v) === c.eq;
    else ok = v === c.eq;
  }
  if (c.gte !== undefined || c.lte !== undefined) {
    const n = v === undefined ? 0 : typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : Number.NaN;
    if (!Number.isFinite(n)) return false;
    if (c.gte !== undefined && !(n >= c.gte)) ok = false;
    if (c.lte !== undefined && !(n <= c.lte)) ok = false;
  }
  if (c.eq === undefined && c.gte === undefined && c.lte === undefined) ok = flagOn(v);
  return ok;
}

/** Fili coinvolti in un evento del merletto. */
export function eventThreads(e: LaceEvent): ThreadId[] {
  switch (e.k) {
    case 'incontro':
    case 'nodo':
      return [e.a, e.b];
    case 'passa':
    case 'copia':
    case 'contagio':
      return [e.from, e.to];
    case 'consegna':
      return [e.to];
    case 'legge':
      return [e.who];
    case 'cura':
      return [e.who, e.by];
    case 'esce':
    case 'entra':
    case 'stranezza':
    case 'nero':
      return [e.thread];
    case 'trabocca':
      return [e.who];
  }
  return [];
}

function threadMatches(t: ThreadId, want: string, level: LevelDef | undefined): boolean {
  if (t === want) return true;
  const def = level?.threads.find((x) => x.id === t);
  return !!def?.character && def.character === want;
}

function eventMatches(c: { event: string; a?: ThreadId; b?: ThreadId; quirk?: string }, s: CampaignState, o?: StoryOptions): boolean {
  const out = s.lastOutcome;
  if (!out) return false;
  const level = o?.db?.levels.get(out.levelId);
  for (const row of out.events ?? []) {
    for (const e of row) {
      if (e.k !== c.event) continue;
      if (c.quirk && !(e.k === 'stranezza' && e.quirk === c.quirk)) continue;
      const ts = eventThreads(e);
      const a = c.a;
      const b = c.b;
      if (a && b) {
        // Due fili distinti: uno è `a`, l'altro è `b`.
        const ok = ts.some((ta, i) => threadMatches(ta, a, level) && ts.some((tb, j) => j !== i && threadMatches(tb, b, level)));
        if (!ok) continue;
      } else if (a) {
        if (!ts.some((t) => threadMatches(t, a, level))) continue;
      } else if (b) {
        if (!ts.some((t) => threadMatches(t, b, level))) continue;
      }
      return true;
    }
  }
  return false;
}

/** Valuta una condizione di storia. */
export function evalStory(cond: StoryCond, s: CampaignState, k: Knowledge, o?: StoryOptions): boolean {
  if ('all' in cond) return cond.all.every((c) => evalStory(c, s, k, o));
  if ('any' in cond) return cond.any.some((c) => evalStory(c, s, k, o));
  if ('not' in cond) return !evalStory(cond.not, s, k, o);
  if ('flag' in cond) return flagMatches(cond, s.flags ?? {});
  if ('ok' in cond) return requestStatusOf(s, cond.ok) === 'soddisfatta';
  if ('failed' in cond) return requestStatusOf(s, cond.failed) === 'fallita';
  if ('accepted' in cond) return wasAccepted(s, cond.accepted);
  if ('ignored' in cond) return wasIgnored(s, cond.ignored);
  if ('reply' in cond) return replyOf(s, cond.reply) === cond.is;
  if ('event' in cond) return eventMatches(cond, s, o);
  if ('knows' in cond) {
    switch (cond.knows) {
      case 'quirk':
        return (k.quirks as string[]).includes(cond.id);
      case 'diary':
        return k.diary.includes(cond.id);
      case 'desire':
        return (k.desires as string[]).includes(cond.id);
      case 'rule':
        return (k.rules as string[]).includes(cond.id);
      case 'archive':
        return k.archive[cond.id] !== undefined;
      case 'oggetto':
        // C03: un oggetto (o una lettera) è conosciuto quando Ada l'ha letto.
        return k.objects.includes(cond.id) || k.letters.includes(cond.id);
    }
    return false;
  }
  if ('memoria' in cond) {
    const v = memoriaOf(s, cond.memoria, balanceMemoria(o));
    if (cond.gte !== undefined && !(v >= cond.gte)) return false;
    if (cond.lte !== undefined && !(v <= cond.lte)) return false;
    return true;
  }
  if ('done' in cond) return isDone(s, k, cond.done);
  return false;
}

/** Che cosa hanno cambiato gli effetti (per il bilancio e per i messaggi). */
export interface EffectLog {
  diary: DiaryEntryId[];
  desires: CharacterId[];
  questions: { id: QuestionId; state: 'aperta' | 'risolta' }[];
  unlocks: { kind: 'archive' | 'mode' | 'cosmetic'; id: string }[];
  objects: string[];
  memoria: { character: CharacterId; before: number; after: number }[];
  flags: string[];
}

export function emptyLog(): EffectLog {
  return { diary: [], desires: [], questions: [], unlocks: [], objects: [], memoria: [], flags: [] };
}

/** Imposta lo stato di una domanda: una domanda risolta non si riapre. */
export function setQuestion(k: Knowledge, q: QuestionId, state: 'aperta' | 'risolta', log?: EffectLog): void {
  const cur = k.questions[q];
  if (cur === 'risolta' || cur === state) return;
  k.questions[q] = state;
  log?.questions.push({ id: q, state });
}

/** Aggiunge una voce al Taccuino (con le domande che apre e chiude). true se è nuova. */
export function addDiary(k: Knowledge, id: DiaryEntryId, o?: StoryOptions, log?: EffectLog): boolean {
  if (k.diary.includes(id)) return false;
  k.diary.push(id);
  log?.diary.push(id);
  const def = o?.db?.diary.get(id);
  for (const q of def?.opens ?? []) setQuestion(k, q, 'aperta', log);
  for (const q of def?.closes ?? []) setQuestion(k, q, 'risolta', log);
  return true;
}

function clampMemoria(v: number, m: BalanceDef['memoria']): number {
  return Math.max(m.min, Math.min(m.max, Math.round(v)));
}

/** Applica gli effetti allo stato e alla conoscenza (li modifica) e restituisce il resoconto. */
export function applyEffects(effects: readonly Effect[] | undefined, s: CampaignState, k: Knowledge, o?: StoryOptions, log: EffectLog = emptyLog()): EffectLog {
  const m = balanceMemoria(o);
  for (const e of effects ?? []) {
    if ('setFlag' in e) {
      s.flags[e.setFlag] = e.value;
      log.flags.push(e.setFlag);
    } else if ('addFlag' in e) {
      const cur = s.flags[e.addFlag];
      const n = typeof cur === 'number' ? cur : typeof cur === 'boolean' ? (cur ? 1 : 0) : 0;
      s.flags[e.addFlag] = n + e.by;
      log.flags.push(e.addFlag);
    } else if ('diary' in e) {
      addDiary(k, e.diary, o, log);
    } else if ('desire' in e) {
      if (!k.desires.includes(e.desire)) {
        k.desires.push(e.desire);
        log.desires.push(e.desire);
      }
    } else if ('question' in e) {
      setQuestion(k, e.question, e.state, log);
    } else if ('memoria' in e) {
      const before = memoriaOf(s, e.memoria, m);
      const after = clampMemoria(before + e.by, m);
      s.memoria[e.memoria] = after;
      log.memoria.push({ character: e.memoria, before, after });
    } else if ('unlock' in e) {
      if (e.unlock === 'archive' && k.archive[e.id] === undefined) k.archive[e.id] = 'nuovo';
      log.unlocks.push({ kind: e.unlock, id: e.id });
    } else if ('object' in e) {
      if (!k.objects.includes(e.object)) k.objects.push(e.object);
      log.objects.push(e.object);
    }
  }
  return log;
}
