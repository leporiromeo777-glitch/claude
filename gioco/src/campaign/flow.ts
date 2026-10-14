/**
 * La macchina a stati della campagna (ARCHITETTURA 5.4, GDD 4.2, 6.6, 8.2), pura:
 * ogni funzione modifica un `SaveData` (dentro `save.update` nel gioco, un oggetto
 * qualsiasi nei test) e non conosce scene né servizi.
 *
 *   sera → notte → alba → bilancio → [archivio] → sera della giornata dopo …
 *   g23: sera → notte → alba → bilancio → scelta → finale → titoli → fine
 *   (il merletto chiuso riporta alla scelta, senza contare come finale)
 *
 * Fine della notte (GDD 3.14): esiti delle richieste (un autore indovinato male fa
 * fallire la richiesta), conseguenze scritte nei bigliettini, memoria (GDD 3.11),
 * stranezze e regole conosciute, Archivio sbloccato, sblocchi di GDD 7, record e fili
 * d'oro, voci nuove del Taccuino, vignette dell'alba. Tutto si calcola subito, così
 * l'alba e il bilancio mostrano lo stesso resoconto anche dopo un ricaricamento.
 */
import type {
  CampaignCore,
  CharacterId,
  ContentDB,
  DiaryEntryId,
  Effect,
  EndingId,
  LevelDef,
  LevelId,
  NightOutcome,
  NightParams,
  NoteDef,
  NoteId,
  OccasionDef,
  RowMoves,
  SaveData,
} from '../core/types';
import { defaultKnowledge } from '../core/save/defaults';
import { applyEffects, emptyLog, setQuestion, addDiary } from './story';
import { ensureMemoria, memoriaAfterNight, usesNome } from './memoria';
import { refreshDiary } from './diary';
import { buildDawn, DAWN_RECENT_DAYS, resolveForgotten, toView } from './dawn';
import {
  campaignNightParams,
  dawnItems,
  dayAt,
  dayIndexOf,
  eveningItems,
  eveningNotes,
  itemOf,
  learnItems,
  nightModeFor,
  objectMeta,
  type EveningMode,
} from './evening';
import { choiceCards, countsAsEnding, endingOfLevel, epilogueOf, finalLevelId } from './endings';
import { dayUnlocks, endingUnlocks, recordNight } from './progress';
import type { CampaignStateX, DayReport, DayResultX, ReportRequest, SolutionEntry, VignetteView } from './types';

export type Db = Pick<ContentDB, 'levels' | 'computed' | 'notes' | 'diary' | 'balance' | 'letters' | 'campaign' | 'lines' | 'characters' | 'endings' | 'book'>;

export const CAMPAIGN_ORIGINS = ['campagna', 'archivio', 'telaio'] as const;

/** Flag dei destini (GDD 5.1) con una frase propria nel bilancio. */
export const DESTINY_FLAGS: Readonly<Record<string, readonly string[]>> = {
  nina: ['parte', 'resta'],
  bepi: ['salvo', 'ferito'],
  lettereLivia: ['liberate', 'sepolte'],
  riconciliate: ['true', 'false'],
  zenoLivia: ['true', 'false'],
};

export class CampaignError extends Error {
  constructor(readonly code: string) {
    super(`campaign: ${code}`);
    this.name = 'CampaignError';
  }
}

export function camp(d: SaveData): CampaignStateX {
  if (!d.campaign) throw new CampaignError('nessunaStoria');
  return d.campaign as CampaignStateX;
}

export function levelOf(db: Pick<ContentDB, 'levels'>, id: LevelId): LevelDef {
  const lv = db.levels.get(id);
  if (!lv) throw new CampaignError(`livello:${id}`);
  return lv;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Stato vuoto di una storia nuova (giornata 0, sera del prologo). */
export function freshCampaign(db: Pick<ContentDB, 'campaign'>): CampaignStateX {
  const first = db.campaign.days[0]?.id ?? 'g00';
  return {
    dayIndex: 0,
    levelId: first,
    phase: 'sera',
    flags: {},
    memoria: {},
    evening: null,
    lastOutcome: null,
    shownLines: [],
    endingsSeen: [],
    history: {},
    snapshots: {},
    solutions: {},
    decided: [],
    left: [],
    report: null,
    choice: null,
    archiveOpen: null,
    diarySeen: 0,
    prologueSeen: false,
    diaryAnnounced: [],
  };
}

/** Copia dello stato all'inizio della sera (per "Riprendi da qui"). */
export function snapshotOf(c: CampaignStateX): CampaignCore {
  return {
    dayIndex: c.dayIndex,
    levelId: c.levelId,
    phase: c.phase,
    flags: { ...c.flags },
    memoria: { ...c.memoria },
    evening: c.evening ? clone(c.evening) : null,
    lastOutcome: null,
    shownLines: c.shownLines.map((x) => ({ ...x })),
    endingsSeen: [...c.endingsSeen],
  };
}

/**
 * Nuova storia: campagna e Taccuino da capo. Record, sblocchi, statistiche e gli
 * epiloghi già visti restano (GDD 7: gli epiloghi nel Telaio sono uno sblocco).
 */
export function newCampaign(d: SaveData, db: Db): CampaignStateX {
  const seen = [...((d.campaign as CampaignStateX | null)?.endingsSeen ?? [])];
  d.campaign = freshCampaign(db);
  d.campaign.endingsSeen = seen;
  d.knowledge = defaultKnowledge();
  if (d.night && (CAMPAIGN_ORIGINS as readonly string[]).includes(d.night.origin)) d.night = null;
  beginEvening(d, db);
  return camp(d);
}

/** Comincia la sera della giornata `dayIndex`: bigliettini, oggetto, istantanea. */
export function beginEvening(d: SaveData, db: Db): void {
  const c = camp(d);
  const day = dayAt(db, c.dayIndex);
  if (!day) throw new CampaignError('giornata');
  const level = levelOf(db, day.id);
  c.levelId = day.id;
  c.phase = 'sera';
  ensureMemoria(c, level, db.balance.memoria);
  const notes = eveningNotes(level, c, d.knowledge, db, 'sera');
  const items = eveningItems(c.dayIndex, 'sera', c, db);
  c.evening = { noteIds: notes.map((n) => n.id), accepted: [], replies: {}, ignored: [], objectSeen: items.length === 0 };
  c.decided = [];
  c.left = [];
  c.report = null;
  c.choice = null;
  c.archiveOpen = null;
  c.diaryAtEvening = d.knowledge.diary.length;
  c.diaryAnnounced = [];
  c.dawnRead = false;
  c.snapshots[day.id] = snapshotOf(c);
  refreshDiary(c, d.knowledge, db);
}

/** La sera della scelta (dopo la notte di g23): i quattro biglietti e uno spillo. */
export function beginChoice(d: SaveData, db: Db, objectSeen = false): void {
  const c = camp(d);
  const idx = dayIndexOf(db, db.campaign.choiceDay);
  c.dayIndex = idx >= 0 ? idx : c.dayIndex;
  c.levelId = db.campaign.choiceDay;
  c.phase = 'scelta';
  const level = levelOf(db, c.levelId);
  const notes = eveningNotes(level, c, d.knowledge, db, 'scelta');
  const items = eveningItems(c.dayIndex, 'scelta', c, db);
  c.evening = { noteIds: notes.map((n) => n.id), accepted: [], replies: {}, ignored: [], objectSeen: objectSeen || items.length === 0 };
  c.decided = [];
  c.left = [];
  c.choice = null;
  c.archiveOpen = null;
  refreshDiary(c, d.knowledge, db);
}

export function eveningMode(c: CampaignStateX): EveningMode {
  return c.phase === 'scelta' ? 'scelta' : 'sera';
}

/**
 * L'oggetto della sera è stato letto (C03): si impara e il Taccuino si aggiorna subito.
 * Restituisce le voci nuove, che si annunciano lì e non tornano nel bilancio.
 */
export function markObjectSeen(d: SaveData, db: Db): DiaryEntryId[] {
  const c = camp(d);
  if (!c.evening) return [];
  const items = eveningItems(c.dayIndex, eveningMode(c), c, db);
  learnItems(items, d.knowledge);
  c.evening.objectSeen = true;
  const fresh = refreshDiary(c, d.knowledge, db);
  announced(c, fresh);
  return fresh;
}

function announced(c: CampaignStateX, ids: readonly DiaryEntryId[]): void {
  const list = (c.diaryAnnounced ??= []);
  for (const id of ids) if (!list.includes(id)) list.push(id);
}

/** L'oggetto dell'alba di oggi (C04) è ancora da leggere. */
export function dawnObjectPending(c: CampaignStateX): boolean {
  return (c.report?.dawnItems?.length ?? 0) > 0 && !c.dawnRead;
}

/**
 * L'oggetto consegnato all'alba è stato letto (C03, C04): si impara, il Taccuino si
 * aggiorna e le voci nuove si annunciano lì (il bilancio della giornata non le ripete).
 */
export function readDawnObject(d: SaveData, db: Db): DiaryEntryId[] {
  const c = camp(d);
  if (!dawnObjectPending(c)) return [];
  learnItems((c.report?.dawnItems ?? []).map((id) => itemOf(id, db)), d.knowledge);
  c.dawnRead = true;
  const fresh = refreshDiary(c, d.knowledge, db);
  announced(c, fresh);
  return fresh;
}

/** Si va al tombolo: i bigliettini non appuntati sono lasciati. Restituisce i parametri della notte. */
export function startNight(d: SaveData, db: Db): NightParams {
  const c = camp(d);
  if (c.phase !== 'sera' && c.phase !== 'notte') throw new CampaignError('fase');
  const level = levelOf(db, c.levelId);
  const ev = c.evening ?? { noteIds: [], accepted: [], replies: {}, ignored: [], objectSeen: true };
  ev.ignored = ev.noteIds.filter((id) => !ev.accepted.some((a) => a.noteId === id));
  if (!ev.objectSeen) learnItems(eveningItems(c.dayIndex, 'sera', c, db), d.knowledge);
  ev.objectSeen = true;
  c.evening = ev;
  c.phase = 'notte';
  for (const r of level.rules) if (!d.knowledge.rules.includes(r)) d.knowledge.rules.push(r);
  refreshDiary(c, d.knowledge, db);
  return campaignNightParams(c, level, db);
}

/** Parametri della notte in corso (per riaprirla senza un salvataggio del tombolo). */
export function currentNightParams(d: SaveData, db: Db): NightParams | null {
  const c = camp(d);
  if (c.phase === 'notte') return campaignNightParams(c, levelOf(db, c.levelId), db);
  if (c.phase === 'finale') return finalParams(d, db);
  return null;
}

// ───────── Fine della notte ─────────

interface Consequence {
  consequenceKey: string;
  consequenceParams?: Record<string, string | number>;
  consequenceDiary?: DiaryEntryId;
}

export interface ConsequenceOpts {
  /** Righe scritte del bigliettino (C05): `esito.<stato>` ha la precedenza su tutto. */
  esito?: NoteDef['esito'];
  /** Desideri scoperti adesso: «Ora so che cosa desidera X» solo la prima volta. */
  newDesires?: readonly CharacterId[];
}

/**
 * La conseguenza di un bigliettino in una riga (C05), in quest'ordine: `esito.<stato>`
 * del bigliettino, destino, desiderio (solo se nuovo), voce del Taccuino, frase generica.
 */
export function consequenceOf(effects: readonly Effect[] | undefined, author: CharacterId, kind: 'ok' | 'fallita' | 'lasciato', db: Pick<ContentDB, 'diary'>, opts: ConsequenceOpts = {}): Consequence {
  const written = opts.esito?.[kind];
  if (written) return { consequenceKey: written };
  const list = effects ?? [];
  for (const e of list) {
    if ('setFlag' in e && DESTINY_FLAGS[e.setFlag]?.includes(String(e.value))) {
      return { consequenceKey: `campaign.destini.${e.setFlag}.${String(e.value)}` };
    }
  }
  for (const e of list) {
    if ('desire' in e && (!opts.newDesires || opts.newDesires.includes(e.desire))) {
      return { consequenceKey: 'campaign.bilancio.conseguenza.desiderio', consequenceParams: { nome: `[[${e.desire}]]` } };
    }
  }
  for (const e of list) {
    if ('diary' in e) {
      const def = db.diary.get(e.diary);
      if (def) return { consequenceKey: def.textKey, consequenceDiary: e.diary };
    }
  }
  return { consequenceKey: `campaign.bilancio.conseguenza.${kind}`, consequenceParams: { nome: `[[${author}]]` } };
}

/** Esito compatto da conservare in `lastOutcome` (eventi sì, timeline solo l'ultimo stato). */
export function compactOutcome(o: NightOutcome): NightOutcome {
  const last = o.timeline[o.timeline.length - 1];
  return { ...clone({ ...o, timeline: [] }), timeline: last ? [clone(last)] : [] };
}

function mergeLog(into: ReturnType<typeof emptyLog>, from: ReturnType<typeof emptyLog>): void {
  into.diary.push(...from.diary);
  into.desires.push(...from.desires);
  into.questions.push(...from.questions);
  into.unlocks.push(...from.unlocks);
  into.objects.push(...from.objects);
  into.memoria.push(...from.memoria);
  into.flags.push(...from.flags);
}

function addSolution(c: CampaignStateX, levelId: LevelId, notes: NoteId[], rows: RowMoves[], nomeOn: string | null): void {
  const all = (c.solutions ??= {});
  const list = (all[levelId] ??= []);
  const key = [...notes].sort().join('|');
  if (list.some((s) => [...s.notes].sort().join('|') === key)) return;
  const entry: SolutionEntry & { nomeOn?: string | null } = { notes: [...notes].sort(), rows: clone(rows) };
  if (nomeOn) entry.nomeOn = nomeOn;
  list.push(entry);
}

/** Soluzione già trovata per le stesse richieste (Ripassa, GDD 8.2). */
export function knownSolution(c: CampaignStateX, levelId: LevelId, notes: readonly NoteId[]): (SolutionEntry & { nomeOn?: string | null }) | null {
  const key = [...notes].sort().join('|');
  return (c.solutions?.[levelId] ?? []).find((s) => [...s.notes].sort().join('|') === key) ?? null;
}

/** Chiude la giornata di campagna con l'esito della notte. */
export function completeDay(d: SaveData, db: Db, outcome: NightOutcome, now: string = new Date().toISOString()): DayReport {
  const c = camp(d);
  const k = d.knowledge;
  if (c.phase !== 'notte' || outcome.levelId !== c.levelId) throw new CampaignError('fase');
  const level = levelOf(db, c.levelId);
  const ev = c.evening ?? { noteIds: [], accepted: [], replies: {}, ignored: [], objectSeen: true };
  const o = { db };
  const log = emptyLog();

  // Stranezze e regole conosciute stanotte.
  const newQuirks = outcome.discoveredQuirks.filter((q) => !k.quirks.includes(q));
  for (const q of newQuirks) k.quirks.push(q);
  for (const r of level.rules) if (!k.rules.includes(r)) k.rules.push(r);

  // Richieste appuntate.
  const requests: ReportRequest[] = [];
  const histReqs: DayResultX['requests'] = [];
  const wrong: { noteId: string; author: CharacterId; guess: CharacterId }[] = [];
  for (const a of ev.accepted) {
    const note = db.notes.get(a.noteId);
    if (!note) continue;
    const res = outcome.requests.find((r) => r.noteId === a.noteId);
    const wrongGuess = !!a.authorGuess && a.authorGuess !== note.author;
    const status = wrongGuess ? 'fallita' : (res?.status ?? 'fallita');
    histReqs.push({ noteId: a.noteId, status });
    const effects = status === 'soddisfatta' ? note.onOk : note.onFail;
    const nlog = applyEffects(effects, c, k, o, emptyLog());
    mergeLog(log, nlog);
    const cons = wrongGuess
      ? { consequenceKey: 'campaign.bilancio.conseguenza.autoreSbagliato', consequenceParams: { autore: `[[${note.author}]]`, indovinato: `[[${a.authorGuess as string}]]` } }
      : consequenceOf(effects, note.author, status === 'soddisfatta' ? 'ok' : 'fallita', db, { esito: note.esito, newDesires: nlog.desires });
    const r: ReportRequest = { noteId: a.noteId, author: note.author, status, dropped: outcome.dropped.includes(a.noteId), wrongGuess, ...cons };
    if (a.authorGuess) r.guess = a.authorGuess;
    requests.push(r);
    if (wrongGuess && a.authorGuess) wrong.push({ noteId: a.noteId, author: note.author, guess: a.authorGuess });
  }
  // Bigliettini lasciati.
  const ignored: DayReport['ignored'] = [];
  for (const id of ev.ignored) {
    const note = db.notes.get(id);
    if (!note) continue;
    const nlog = applyEffects(note.onIgnore, c, k, o, emptyLog());
    mergeLog(log, nlog);
    if (note.onIgnore?.length || note.esito?.lasciato) ignored.push({ noteId: id, author: note.author, ...consequenceOf(note.onIgnore, note.author, 'lasciato', db, { esito: note.esito, newDesires: nlog.desires }) });
  }

  // Storia della giornata.
  const hist: DayResultX = {
    levelId: level.id,
    rows: clone(outcome.rows),
    requests: histReqs,
    metrics: { ...outcome.metrics },
    spartito: outcome.spartito,
    at: now,
    accepted: ev.accepted.map((a) => ({ ...a })),
    ignored: [...ev.ignored],
    replies: { ...ev.replies },
  };
  if (wrong.length) hist.wrongGuess = wrong.map((w) => w.noteId);
  c.history[level.id] = hist;
  c.lastOutcome = compactOutcome(outcome);

  // Memoria (solo nelle giornate col nome).
  const mem = memoriaAfterNight(level, outcome.timeline, c.memoria, db.balance.memoria);
  c.memoria = mem.memoria;

  // Archivio, sblocchi, record.
  const unlocked: string[] = [];
  const day = dayAt(db, c.dayIndex);
  if (day?.archiveAfter && k.archive[day.archiveAfter] === undefined) {
    k.archive[day.archiveAfter] = 'nuovo';
    unlocked.push(`archive:${day.archiveAfter}`);
  }
  unlocked.push(...dayUnlocks(d.unlocks, level.id));
  const rec = recordNight(d, level.id, outcome.metrics, outcome.spartito);
  unlocked.push(...rec.unlocked);
  const allOk = outcome.goals.every((g) => g.status === 'soddisfatta') && histReqs.every((r) => r.status === 'soddisfatta');
  if (allOk) addSolution(c, level.id, ev.accepted.map((a) => a.noteId), outcome.rows, outcome.nomeOn);

  // Taccuino.
  refreshDiary(c, k, db, log);
  c.evening = null;

  // Alba. L'oggetto dell'alba (C04) si legge dopo l'ultima vignetta, prima del bilancio;
  // la vignetta di chi lo consegna chiude l'alba.
  const dawnObj = dawnItems(c.dayIndex, c, db);
  const dawnBy = dawnObj.length > 0 && day?.dawnObject ? (objectMeta(db, day.dawnObject).by ?? null) : null;
  const dawn = buildDawn({ level, outcome, state: c, knowledge: k, db, wrongGuesses: wrong, deliveredBy: dawnBy }, c.dayIndex);
  for (const v of dawn) {
    c.shownLines.push({ id: v.id, day: c.dayIndex });
    if (!k.seenVignettes.includes(v.id)) k.seenVignettes.push(v.id);
  }
  c.shownLines = c.shownLines.filter((x) => c.dayIndex - x.day <= DAWN_RECENT_DAYS);

  // «Nel Taccuino»: le voci nuove della giornata, senza quelle già annunciate alla
  // lettura di un oggetto (C03) e senza quelle usate come conseguenza (D12).
  const mark = c.diaryAtEvening;
  const shown = new Set<string>([...(c.diaryAnnounced ?? [])]);
  for (const r of requests) if (r.consequenceDiary) shown.add(r.consequenceDiary);
  for (const r of ignored) if (r.consequenceDiary) shown.add(r.consequenceDiary);
  const newDiary = (typeof mark === 'number' && mark <= k.diary.length ? k.diary.slice(mark) : [...new Set(log.diary)]).filter((id) => !shown.has(id));
  const report: DayReport = {
    levelId: level.id,
    dayIndex: c.dayIndex,
    requests,
    ignored,
    goals: outcome.goals.map((g) => g.status),
    newDiary,
    newQuirks,
    newDesires: [...log.desires],
    memoria: mem.changes,
    metrics: { ...outcome.metrics },
    record: { before: rec.before, after: rec.after, improved: rec.improved },
    goldThread: rec.goldThread,
    unlocked,
    spartito: outcome.spartito,
    rows: clone(outcome.rows),
    dawn,
  };
  if (dawnObj.length > 0) {
    report.dawnItems = dawnObj.map((it) => it.id);
    report.dawnBy = dawnBy;
  }
  c.report = report;
  c.dawnRead = dawnObj.length === 0;
  c.phase = 'alba';
  c.decided = [];
  c.left = [];
  return report;
}

/**
 * Dall'alba al bilancio. Se l'oggetto dell'alba non è stato letto (debug, salto) lo si
 * impara comunque: la storia non perde la lettera. Restituisce le voci nuove.
 */
export function finishDawn(d: SaveData, db?: Db): DiaryEntryId[] {
  const c = camp(d);
  let fresh: DiaryEntryId[] = [];
  if (c.phase === 'alba' && db && dawnObjectPending(c)) fresh = readDawnObject(d, db);
  if (c.phase === 'alba') c.phase = 'bilancio';
  return fresh;
}

/** Dal bilancio: la scelta (g23), l'Archivio appena sbloccato, o la sera dopo. */
export function finishBilancio(d: SaveData, db: Db): 'scelta' | 'archivio' | 'sera' | 'fine' {
  const c = camp(d);
  if (c.phase !== 'bilancio' && c.phase !== 'alba') return c.phase === 'archivio' ? 'archivio' : 'sera';
  const day = dayAt(db, c.dayIndex);
  if (day && day.id === db.campaign.choiceDay) {
    beginChoice(d, db);
    return 'scelta';
  }
  if (day?.archiveAfter && d.knowledge.archive[day.archiveAfter] !== 'rammendato') {
    c.phase = 'archivio';
    c.archiveOpen = day.archiveAfter;
    return 'archivio';
  }
  return nextDay(d, db);
}

/** Passa alla sera della giornata successiva. */
export function nextDay(d: SaveData, db: Db): 'sera' | 'fine' {
  const c = camp(d);
  if (c.dayIndex + 1 >= db.campaign.days.length) {
    beginChoice(d, db, true);
    return 'fine';
  }
  c.dayIndex += 1;
  beginEvening(d, db);
  return 'sera';
}

/** Chiude la fase d'Archivio (dopo il bilancio) e passa alla sera dopo. */
export function finishArchivePhase(d: SaveData, db: Db): 'sera' | 'fine' {
  const c = camp(d);
  if (c.phase !== 'archivio') return 'sera';
  c.archiveOpen = null;
  return nextDay(d, db);
}

// ───────── Archivio ─────────

/** Parametri della notte d'Archivio (modo 'archivio', o 'occasioni' per A6). */
export function archiveParams(d: SaveData, db: Db, id: LevelId): NightParams {
  const level = levelOf(db, id);
  if (!level.archive) throw new CampaignError(`archivio:${id}`);
  if (d.knowledge.archive[id] === undefined) d.knowledge.archive[id] = 'nuovo';
  return { origin: 'archivio', mode: nightModeFor(level), level, flags: {}, accepted: [], goals: [...(level.goals ?? [])], needsNome: false };
}

/**
 * «Lascia per ora» dalla Pausa di una notte d'Archivio (C10): si toglie la notte salvata
 * di quel merletto; l'Archivio (`knowledge.archive`) non cambia. true se l'ha tolta.
 */
export function leaveArchiveNight(d: SaveData, levelId: LevelId): boolean {
  const n = d.night;
  if (!n || n.origin !== 'archivio' || n.params.levelId !== levelId) return false;
  d.night = null;
  return true;
}

/**
 * «Rileggi» (CAM-01): il merletto rammendato in sola lettura. Si ritesse da solo il
 * merletto registrato (modo 'replay') con i nomi giusti sui fili sbiaditi; non cambia
 * l'Archivio né i record.
 */
export function rereadParams(db: Pick<ContentDB, 'levels'>, id: LevelId): NightParams {
  const level = levelOf(db, id);
  if (!level.archive) throw new CampaignError(`archivio:${id}`);
  const rows = level.archive.recorded.map((r) => ({ hour: r.hour, crossings: r.crossings.filter((c) => !c.forced).map((c) => ({ pair: c.pair, over: c.over })) }));
  return {
    origin: 'archivio',
    mode: 'replay',
    level,
    flags: {},
    accepted: [],
    goals: [],
    needsNome: false,
    replay: rows,
    resume: { levelId: id, rows: [], draft: [], dropped: [], nomeOn: null, hintsUsed: 0, fantasmaUsed: false, archiveNames: { ...level.archive.answer } },
  };
}

const ARCHIVE_RANK = { nuovo: 0, nominato: 1, rammendato: 2 } as const;

export interface ArchiveResult {
  levelId: LevelId;
  named: boolean;
  mended: boolean;
  newDiary: DiaryEntryId[];
  reveal: VignetteView | null;
  unlocked: string[];
}

/** Esito di un merletto d'Archivio: stato, domande chiuse, voci nuove, vignetta di rivelazione. */
export function completeArchive(d: SaveData, db: Db, outcome: NightOutcome): ArchiveResult {
  const k = d.knowledge;
  const level = levelOf(db, outcome.levelId);
  const named = !!outcome.archive?.named;
  const mended = !!outcome.archive?.mended;
  const prev = k.archive[level.id] ?? 'nuovo';
  const next = mended ? 'rammendato' : named ? 'nominato' : 'nuovo';
  k.archive[level.id] = ARCHIVE_RANK[next] > ARCHIVE_RANK[prev] ? next : prev;
  const log = emptyLog();
  const o = { db };
  const before = k.diary.length;
  if (mended && level.archive) {
    for (const q of level.archive.closes) setQuestion(k, q, 'risolta', log);
    for (const id of level.archive.unlocks) addDiary(k, id, o, log);
  }
  const c = d.campaign as CampaignStateX | null;
  if (c) refreshDiary(c, k, db, log);
  const rec = recordNight(d, level.id, outcome.metrics, outcome.spartito);
  let reveal: VignetteView | null = null;
  if (mended && level.archive?.reveal) {
    reveal = c ? resolveForgotten(toView(level.archive.reveal), c, db) : toView(level.archive.reveal);
    if (!k.seenVignettes.includes(reveal.id)) k.seenVignettes.push(reveal.id);
  }
  return { levelId: level.id, named, mended, newDiary: k.diary.slice(before), reveal, unlocked: rec.unlocked };
}

// ───────── Scelta e finali ─────────

export interface ChoiceResult {
  ok: boolean;
  error?: string;
  missing?: string[];
}

/** Sceglie un finale la sera di g23 (uno spillo su una delle carte). */
export function choose(d: SaveData, db: Db, ending: EndingId): ChoiceResult {
  const c = camp(d);
  if (c.phase !== 'scelta') return { ok: false, error: 'fase' };
  const cards = choiceCards(levelOf(db, db.campaign.choiceDay), c, d.knowledge, db);
  const card = cards.find((x) => x.ending === ending);
  if (!card) return { ok: false, error: 'carta' };
  if (!card.available) return { ok: false, error: 'requisiti', missing: card.missing };
  const ev = c.evening ?? { noteIds: [], accepted: [], replies: {}, ignored: [], objectSeen: true };
  if (!ev.objectSeen) learnItems(eveningItems(c.dayIndex, 'scelta', c, db), d.knowledge);
  ev.accepted = [{ noteId: card.note.id }];
  ev.objectSeen = true;
  c.evening = ev;
  c.choice = ending;
  c.phase = 'finale';
  c.levelId = finalLevelId(ending, db);
  return { ok: true };
}

/** Parametri della notte del finale scelto. */
export function finalParams(d: SaveData, db: Db): NightParams {
  const c = camp(d);
  const level = levelOf(db, c.levelId);
  return { origin: 'campagna', mode: nightModeFor(level), level, flags: { ...c.flags }, accepted: [], goals: [...(level.goals ?? [])], needsNome: usesNome(level) };
}

export interface FinalResult {
  kind: 'chiuso' | 'riprova' | 'epilogo';
  ending: EndingId | null;
  epilogue: VignetteView[];
  newDiary: DiaryEntryId[];
  unlocked: string[];
  /** Occasioni piantate nella notte del finale (per `{occasioni}` negli epiloghi, C04). */
  occasions: OccasionDef[];
}

/** Esito della notte di un finale. */
export function completeFinal(d: SaveData, db: Db, outcome: NightOutcome, now: string = new Date().toISOString()): FinalResult {
  const c = camp(d);
  const k = d.knowledge;
  if (c.phase !== 'finale' || outcome.levelId !== c.levelId) throw new CampaignError('fase');
  const ending = endingOfLevel(outcome.levelId, db);
  const before = k.diary.length;
  if (!ending || !countsAsEnding(ending, db)) {
    // Il merletto chiuso: si annoda, si riavvolge e non si salva; resta solo il ricordo.
    c.history[outcome.levelId] = { levelId: outcome.levelId, rows: [], requests: [], metrics: { ...outcome.metrics }, spartito: '', at: now };
    c.lastOutcome = null;
    refreshDiary(c, k, db);
    const epilogue = ending ? epilogueOf(ending, c, k, db) : [];
    for (const v of epilogue) if (!k.seenVignettes.includes(v.id)) k.seenVignettes.push(v.id);
    beginChoice(d, db, true);
    return { kind: 'chiuso', ending, epilogue, newDiary: k.diary.slice(before), unlocked: [], occasions: [] };
  }
  if (!outcome.goals.every((g) => g.status === 'soddisfatta')) {
    return { kind: 'riprova', ending, epilogue: [], newDiary: [], unlocked: [], occasions: [] };
  }
  const occasions = clone(outcome.occasions ?? []);
  const hist: DayResultX = { levelId: outcome.levelId, rows: clone(outcome.rows), requests: [], metrics: { ...outcome.metrics }, spartito: outcome.spartito, at: now };
  if (occasions.length > 0) hist.occasions = occasions;
  c.history[outcome.levelId] = hist;
  c.lastOutcome = compactOutcome(outcome);
  if (!c.endingsSeen.includes(ending)) c.endingsSeen.push(ending);
  const unlocked = endingUnlocks(d.unlocks, ending, true);
  const rec = recordNight(d, outcome.levelId, outcome.metrics, outcome.spartito);
  unlocked.push(...rec.unlocked);
  refreshDiary(c, k, db);
  c.phase = 'titoli';
  const epilogue = epilogueOf(ending, c, k, db);
  for (const v of epilogue) if (!k.seenVignettes.includes(v.id)) k.seenVignettes.push(v.id);
  return { kind: 'epilogo', ending, epilogue, newDiary: k.diary.slice(before), unlocked, occasions };
}

/** Titoli di coda finiti. */
export function finishTitles(d: SaveData): void {
  const c = camp(d);
  if (c.phase === 'titoli') c.phase = 'fine';
}

// ───────── Telaio ─────────

/**
 * Riprendi da qui (GDD 8.2): la storia torna alla sera di quella giornata. Flag, memoria
 * e storia tornano come erano; il Taccuino (Knowledge), gli epiloghi visti e le soluzioni
 * trovate restano. I bigliettini della sera si ricalcolano con quello che si sa ora.
 */
export function rewindTo(d: SaveData, db: Db, levelId: LevelId): boolean {
  const c = camp(d);
  const snap = c.snapshots[levelId];
  const idx = dayIndexOf(db, levelId);
  if (!snap || idx < 0) return false;
  const history: CampaignStateX['history'] = {};
  for (const [id, h] of Object.entries(c.history)) {
    const i = dayIndexOf(db, id);
    if (i >= 0 && i < idx) history[id] = h;
  }
  const snapshots: CampaignStateX['snapshots'] = {};
  for (const [id, s] of Object.entries(c.snapshots)) {
    const i = dayIndexOf(db, id);
    if (i >= 0 && i <= idx) snapshots[id] = s;
  }
  const endings = [...new Set([...c.endingsSeen, ...snap.endingsSeen])];
  const next: CampaignStateX = {
    ...clone(snap),
    dayIndex: idx,
    levelId,
    phase: 'sera',
    lastOutcome: null,
    endingsSeen: endings,
    history,
    snapshots,
    solutions: c.solutions ?? {},
    decided: [],
    left: [],
    report: null,
    choice: null,
    archiveOpen: null,
    diarySeen: c.diarySeen ?? 0,
    prologueSeen: true,
  };
  d.campaign = next;
  if (d.night && (CAMPAIGN_ORIGINS as readonly string[]).includes(d.night.origin)) d.night = null;
  beginEvening(d, db);
  return true;
}

/** Rigioca (GDD 8.2): la notte di una giornata già giocata, per i record; la storia non cambia. */
export function replayParams(d: SaveData, db: Db, levelId: LevelId): NightParams {
  const c = d.campaign as CampaignStateX | null;
  const level = levelOf(db, levelId);
  const snap = c?.snapshots[levelId];
  const hist = c?.history[levelId] as DayResultX | undefined;
  const accepted: NightParams['accepted'] = [];
  for (const a of hist?.accepted ?? []) {
    const n = db.notes.get(a.noteId);
    if (n?.request) accepted.push({ noteId: n.id, request: n.request, author: n.author });
  }
  return {
    origin: 'telaio',
    mode: nightModeFor(level),
    level,
    flags: { ...(snap?.flags ?? {}) },
    accepted,
    goals: [...(level.goals ?? [])],
    needsNome: usesNome(level),
  };
}

/** Ripassa dal Telaio: la soluzione già trovata per le richieste di quella giornata (GDD 8.2). */
export function replayRipassaParams(d: SaveData, db: Db, levelId: LevelId): NightParams | null {
  const c = d.campaign as CampaignStateX | null;
  if (!c || !d.unlocks.libero) return null;
  const hist = c.history[levelId] as DayResultX | undefined;
  const notes = (hist?.accepted ?? []).map((a) => a.noteId);
  const sol = knownSolution(c, levelId, notes);
  if (!sol) return null;
  const p = replayParams(d, db, levelId);
  p.mode = 'replay';
  p.replay = clone(sol.rows);
  p.resume = { levelId, rows: [], draft: [], dropped: [], nomeOn: sol.nomeOn ?? null, hintsUsed: 0, fantasmaUsed: false };
  return p;
}

/** Esito di una notte del Telaio: solo record e statistiche. */
export function completeReplay(d: SaveData, outcome: NightOutcome): ReturnType<typeof recordNight> {
  return recordNight(d, outcome.levelId, outcome.metrics, outcome.spartito);
}

/** Ripassa è possibile stasera: Merletto libero sbloccato e le stesse richieste di una soluzione trovata. */
export function ripassaAvailable(d: SaveData): boolean {
  const c = d.campaign as CampaignStateX | null;
  if (!c || c.phase !== 'sera' || !d.unlocks.libero) return false;
  return !!knownSolution(c, c.levelId, (c.evening?.accepted ?? []).map((a) => a.noteId));
}

/** Ripassa: la notte in modo 'replay' con le righe di una soluzione già trovata. */
export function ripassaParams(d: SaveData, db: Db): NightParams | null {
  const c = camp(d);
  if (c.phase !== 'sera' && c.phase !== 'notte') return null;
  if (!d.unlocks.libero) return null;
  const sol = knownSolution(c, c.levelId, (c.evening?.accepted ?? []).map((a) => a.noteId));
  if (!sol) return null;
  const p = startNight(d, db);
  p.mode = 'replay';
  p.replay = clone(sol.rows);
  p.resume = { levelId: p.level.id, rows: [], draft: [], dropped: [], nomeOn: sol.nomeOn ?? null, hintsUsed: 0, fantasmaUsed: false };
  return p;
}
