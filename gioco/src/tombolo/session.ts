/**
 * Stato della notte (ARCHITETTURA 5.3): `NightSession`.
 *
 * Usa solo il motore: timeline, bozza della riga corrente, Disfa, riavvolgimento,
 * richieste lasciate cadere, suggerimenti, esito. Niente disegno, niente DOM,
 * niente servizi: gli eventi `night:*` escono da `deps.emit` (il bus nel gioco,
 * un finto nei test).
 *
 * Modalità (NightParams.mode):
 * - normale: il giocatore compone gli incroci di ogni riga;
 * - archivio: le righe registrate si riapplicano da sole, si tessono solo le
 *   righe strappate (matassa azzerata all'inizio dello strappo) e alla fine di
 *   ogni strappo lo stato deve coincidere con quello registrato (`sameLace`);
 *   i nomi dei fili sbiaditi si confermano a gruppi di 3 giusti (modes/archive.ts);
 * - controllato: il giocatore muove solo il filo controllato, gli altri si
 *   muovono con `planAutoRow` (fin_seppia);
 * - occasioni: il giocatore pianta occasioni e la giornata accade da sola
 *   (modes/autoweave.ts);
 * - replay: lo spartito (o Ripassa) si ritesse da solo (modes/replay.ts).
 */
import type {
  BalanceDef,
  Condition,
  CondReport,
  Crossing,
  GameEventMap,
  Hint,
  HintTier,
  Hour,
  LaceEvent,
  LaceState,
  LevelComputed,
  LevelDef,
  NightOutcome,
  NightParams,
  NightResume,
  NoteId,
  OccasionDef,
  QuirkId,
  RowMoves,
  RowResult,
  RunContext,
  SolveRequest,
  SolveResult,
  ThreadId,
  Violation,
} from '../core/types';
import {
  applyRow,
  checkCrossing,
  createContext,
  encodeSpartito,
  evaluate,
  forcedCrossings,
  hintFor,
  HINT_KEYS,
  initialState,
  metrics,
  planAutoRow,
  previewRow,
  sameLace,
  simulate,
  solveAsync as engineSolveAsync,
  spartitoRef,
  unreachablePins,
  violationKey,
} from '../engine/index';
import { crossingsOf } from '../engine/simulate';
import { ARCHIVE_FLAGS, ArchiveBook, archiveActive } from './modes/archive';
import { occasionProblem, OCCASION_KINDS_ORDER } from './modes/autoweave';

/** API della notte usata dalla scena e dal debug (ARCHITETTURA 5.3). */
export interface NightSession {
  readonly params: NightParams;
  readonly ctx: RunContext;
  /** timeline[0] = apertura. */
  readonly timeline: LaceState[];
  /** Righe fissate. */
  readonly rows: RowMoves[];
  /** Riga corrente. */
  readonly draft: Crossing[];
  /** Ora della riga corrente. */
  readonly hour: Hour;
  /** Aggiunge alla bozza se valido. */
  propose(c: Crossing): Violation | null;
  flip(pair: number): Violation | null;
  remove(pair: number): void;
  preview(): RowResult;
  /** ok → nuova riga, autosalvataggio, eventi. */
  fix(): RowResult;
  /** Toglie l'ultimo incrocio della bozza, o riapre la riga precedente. */
  undo(): void;
  rewindTo(hour: Hour): void;
  setNome(thread: ThreadId): void;
  drop(noteId: NoteId): void;
  requestStatus(): { noteId: NoteId; report: CondReport }[];
  hint(tier: HintTier): Promise<Hint>;
  /** Chiamato dopo l'ultima riga. */
  complete(): NightOutcome;
  toResume(): NightResume;
}

type Emit = <K extends keyof GameEventMap>(k: K, p: GameEventMap[K]) => void;

export interface SessionDeps {
  /** Uscita degli eventi `night:*` e `quirk:discovered` (il bus nel gioco). */
  emit?: Emit;
  /** Parametri bilanciabili (soglia del trabocco, durata del nodo, lampada). */
  balance?: Pick<BalanceDef, 'traboccoSoglia' | 'nodoRighe'> | null;
  /** Soluzioni precalcolate del livello (`.computed.json`). */
  computed?: LevelComputed | null;
  /** Solver asincrono (Worker nel browser); iniettabile nei test. */
  solveAsync?: (req: SolveRequest, signal?: AbortSignal) => Promise<SolveResult>;
  /** Tempo massimo per il solver dei suggerimenti (ARCHITETTURA 16: 1,5 s). */
  hintTimeoutMs?: number;
  /** Stranezze già note al giocatore: per queste non si emette `quirk:discovered`. */
  knownQuirks?: readonly QuirkId[];
}

export interface RequestStatus {
  noteId: NoteId;
  report: CondReport;
  dropped: boolean;
}

/** Messaggio di una richiesta lasciata cadere (stato fallita per scelta). */
export const DROPPED_KEY = 'tombolo.richieste.lasciata';
/** Riga d'Archivio che non torna con il merletto registrato. */
export const ARCHIVE_MISMATCH_KEY = 'tombolo.archivio.nonCoincide';
/** Prima di tessere bisogna appuntare il nome (da g12). */
export const NOME_FIRST_KEY = 'tombolo.nome.prima';
/** Modalità senza incroci del giocatore (occasioni, spartito). */
export const NO_CROSS_KEY = 'tombolo.violazione.forzato';
/** Disfa non permesso dal grado "Senza Disfa". */
export const NO_UNDO_KEY = 'tombolo.disfa.vietato';

const QUIRK_OF_CODE: Partial<Record<Violation['code'], QuirkId>> = { rifiuto: 'martaNoSotto', faro: 'zenoFaro', corre: 'ginoCorre' };

function sameCrossings(a: readonly Crossing[], b: readonly Crossing[]): boolean {
  const k = (list: readonly Crossing[]): string =>
    list
      .filter((c) => !c.forced)
      .map((c) => `${c.pair}${c.over}`)
      .sort()
      .join(',');
  return k(a) === k(b);
}

function cloneCrossing(c: Crossing): Crossing {
  const out: Crossing = { pair: c.pair, over: c.over };
  if (c.forced) out.forced = true;
  return out;
}

/** Condizioni attive della notte: obiettivi obbligatori + richieste non lasciate cadere. */
export function activeGoals(params: NightParams, dropped: readonly NoteId[]): Condition[] {
  const out: Condition[] = [...params.goals];
  for (const a of params.accepted) if (!dropped.includes(a.noteId)) out.push(a.request);
  return out;
}

export class Session implements NightSession {
  readonly params: NightParams;
  readonly level: LevelDef;
  /** Copia del livello con matassa senza limite: righe registrate dell'Archivio. */
  private readonly levelFree: LevelDef;
  private _ctx: RunContext;
  private _timeline: LaceState[] = [];
  private _events: LaceEvent[][] = [];
  private _rows: RowMoves[] = [];
  private _draft: Crossing[] = [];
  private _dropped: NoteId[] = [];
  private _nomeOn: ThreadId | null = null;
  private _occasions: OccasionDef[] = [];
  private _discovered: QuirkId[] = [];
  private readonly known: Set<QuirkId>;
  hintsUsed = 0;
  fantasmaUsed = false;
  /** Disfa di fila sulla stessa riga (per la lampada dei suggerimenti). */
  undoStreak = { hour: -1, n: 0 };
  /** Righe che non si possono disfare (merletto registrato dell'Archivio). */
  private lockedRows = 0;
  private silent = false;
  /** Contatore delle modifiche: invalida anteprima e stato delle richieste. */
  version = 0;
  private previewCache: { v: number; r: RowResult } | null = null;
  private statusCache: { v: number; r: RequestStatus[] } | null = null;
  private replayIndex = 0;
  private outcomeCache: NightOutcome | null = null;
  readonly archive: ArchiveBook | null;

  constructor(
    params: NightParams,
    private readonly deps: SessionDeps = {},
  ) {
    this.params = params;
    this.level = params.level;
    this.levelFree = { ...params.level, matassa: Number.MAX_SAFE_INTEGER };
    this.known = new Set(deps.knownQuirks ?? []);
    this.archive = archiveActive(params) ? new ArchiveBook(params.level, deps.balance ?? null) : null;
    this._ctx = this.makeCtx();
    this.reset();
    if (params.resume) this.restore(params.resume);
  }

  // ───────── Lettura ─────────
  get ctx(): RunContext {
    return this._ctx;
  }
  get timeline(): LaceState[] {
    return this._timeline;
  }
  get events(): LaceEvent[][] {
    return this._events;
  }
  get rows(): RowMoves[] {
    return this._rows;
  }
  get draft(): Crossing[] {
    return this._draft;
  }
  get dropped(): NoteId[] {
    return this._dropped;
  }
  get nomeOn(): ThreadId | null {
    return this._nomeOn;
  }
  get occasions(): OccasionDef[] {
    return this._occasions;
  }
  get discoveredQuirks(): QuirkId[] {
    return this._discovered;
  }
  get mode(): NightParams['mode'] {
    return this.params.mode;
  }
  /** Stato all'ora fissata più recente. */
  get state(): LaceState {
    return this._timeline[this._timeline.length - 1] as LaceState;
  }
  /** Ora della riga corrente (endHour + 1 a merletto finito). */
  get hour(): Hour {
    return Math.min(this.state.hour + 1, this.level.endHour + 1);
  }
  /** Tutte le righe sono fissate. */
  get done(): boolean {
    return this.state.hour >= this.level.endHour;
  }
  get locked(): number {
    return this.lockedRows;
  }
  /** Il giocatore deve ancora appuntare il nome prima di tessere. */
  get needsNome(): boolean {
    return this.params.needsNome && this._nomeOn === null && this._rows.length === 0;
  }
  /** Matassa: braccia usate (righe fissate + bozza) e totale. */
  matassa(): { used: number; total: number } {
    return { used: this.state.usedMatassa + (this.isPlayerRow() ? this._draft.length : 0), total: this.level.matassa };
  }
  gradi(): readonly string[] {
    return this.params.gradi ?? [];
  }
  canUndo(): boolean {
    if (this._draft.length > 0) return true;
    if (this.gradi().includes('senzaDisfa')) return false;
    if (this.params.mode === 'replay' || this.params.mode === 'occasioni') return false;
    return this._rows.length > this.lockedRows;
  }
  /** Si può riavvolgere fino all'ora `hour` (stato dopo quella riga)? */
  canRewindTo(hour: Hour): boolean {
    if (this.gradi().includes('senzaDisfa')) return false;
    if (this.params.mode === 'replay' || this.params.mode === 'occasioni') return false;
    const i = hour - this.level.startHour;
    return Number.isInteger(i) && i >= this.lockedRows && i < this._timeline.length;
  }
  /** La riga corrente la compone il giocatore (non è registrata né automatica). */
  isPlayerRow(): boolean {
    if (this.done) return false;
    return this.params.mode === 'normale' || this.params.mode === 'archivio' || this.params.mode === 'controllato';
  }

  /** Livello da usare per una riga (le righe registrate dell'Archivio non consumano matassa). */
  private levelFor(locked: boolean): LevelDef {
    return locked ? this.levelFree : this.level;
  }

  /**
   * Flag con cui si tesse: quelli della notte, tranne per i merletti d'Archivio,
   * che sono storia e si tessono con le regole di allora (ARCHIVE_FLAGS).
   */
  get runFlags(): NightParams['flags'] {
    return this.level.archive ? ARCHIVE_FLAGS : this.params.flags;
  }

  private makeCtx(): RunContext {
    const opts: Parameters<typeof createContext>[2] = { nomeOn: this._nomeOn, occasions: this._occasions };
    if (this.deps.balance) opts.balance = this.deps.balance;
    return createContext(this.level, this.runFlags, opts);
  }

  private emit<K extends keyof GameEventMap>(k: K, p: GameEventMap[K]): void {
    if (this.silent) return;
    this.deps.emit?.(k, p);
  }

  private touch(): void {
    this.version++;
    this.previewCache = null;
    this.statusCache = null;
    this.outcomeCache = null;
  }

  /** Torna all'apertura (stesse scelte di nome e occasioni). */
  private reset(): void {
    this._timeline = [initialState(this.level, this._ctx)];
    this._events = [];
    this._rows = [];
    this._draft = [];
    this.lockedRows = 0;
    this.replayIndex = 0;
    this.archive?.resetProgress();
    this.touch();
    this.autoAdvance();
  }

  private restore(r: NightResume): void {
    this.silent = true;
    try {
      this.hintsUsed = Math.max(0, r.hintsUsed | 0);
      this.fantasmaUsed = !!r.fantasmaUsed;
      for (const id of r.dropped ?? []) if (this.params.accepted.some((a) => a.noteId === id) && !this._dropped.includes(id)) this._dropped.push(id);
      if (r.occasions && r.occasions.length > 0) this.setOccasions(r.occasions);
      if (r.nomeOn) this.setNome(r.nomeOn);
      if (this.archive && r.archiveNames) {
        for (const [thread, ch] of Object.entries(r.archiveNames)) this.archive.name(thread, ch);
      }
      // Righe del giocatore: quelle registrate dell'Archivio si riapplicano da sole.
      for (const row of r.rows ?? []) {
        if (this.done) break;
        if (row.hour !== this.hour) continue;
        if (this.params.mode === 'occasioni' || this.params.mode === 'replay') {
          const res = this.stepAuto();
          if (!res || !res.ok) break;
          continue;
        }
        this._draft = row.crossings.filter((c) => !c.forced).map(cloneCrossing);
        const res = this.fix();
        if (!res.ok) {
          this._draft = [];
          break;
        }
      }
      // Bozza: solo gli incroci ancora ammessi.
      if (this.isPlayerRow()) {
        this._draft = [];
        for (const c of r.draft ?? []) {
          if (c.forced) continue;
          if (this.propose(cloneCrossing(c)) !== null) continue;
        }
      }
      if (this.params.mode === 'replay') this.replayIndex = this._rows.length;
    } finally {
      this.silent = false;
      this.touch();
    }
  }

  // ───────── Righe automatiche ─────────

  /** Archivio: riapplica le righe registrate fino al prossimo strappo (o alla fine). */
  private autoAdvance(): void {
    const book = this.archive;
    if (!book || this.params.mode !== 'archivio') return;
    let changed = false;
    while (!this.done && !book.isHoleRow(this.hour)) {
      const rec = book.recordedRow(this.hour);
      const res = applyRow(this.levelFree, this.state, rec ? rec.crossings.filter((c) => !c.forced) : [], this._ctx);
      if (!res.ok) break;
      this.commit(res, rec ? rec.crossings : [], true);
      changed = true;
      this.lockedRows = this._rows.length;
    }
    if (!this.done && book.isHoleStart(this.hour)) {
      // Matassa azzerata all'inizio dello strappo: contano solo gli incroci dei rammendi.
      const st = { ...this.state, usedMatassa: book.usedInHoles(this._rows) };
      this._timeline[this._timeline.length - 1] = st;
      changed = true;
    }
    if (changed) this.touch();
  }

  private commit(res: RowResult, draft: readonly Crossing[], locked: boolean): void {
    const hour = res.state.hour;
    const row: RowMoves = { hour, crossings: crossingsOf(res.events, draft.filter((c) => !c.forced)) };
    this._rows.push(row);
    this._timeline.push(res.state);
    this._events.push(res.events);
    this._draft = [];
    if (this.undoStreak.hour !== hour + 1) this.undoStreak = { hour: hour + 1, n: 0 };
    for (const e of res.events) if (e.k === 'stranezza') this.discover(e.quirk, e.thread);
    this.touch();
    // Le righe registrate dell'Archivio sono il merletto che c'era già: niente campana.
    if (!locked) this.emit('night:row', { hour, result: res });
  }

  private discover(q: QuirkId, thread: ThreadId): void {
    if (!this._discovered.includes(q)) this._discovered.push(q);
    if (this.known.has(q)) return;
    this.known.add(q);
    this.emit('quirk:discovered', { quirk: q, thread });
  }

  // ───────── Incroci ─────────

  /** Incroci forzati della riga corrente (filo nero; piano dell'autotessitura). */
  forced(): Crossing[] {
    if (this.done) return [];
    if (this.params.mode === 'controllato') return planAutoRow(this.level, this.state, this._ctx, this._draft[0] ?? null).filter((c) => c.forced);
    if (this.level.autoweave && this.params.mode !== 'occasioni') return planAutoRow(this.level, this.state, this._ctx, null).filter((c) => c.forced);
    return forcedCrossings(this.level, this.state, this._ctx);
  }

  /** Bozza + forzati della riga corrente, ordinati per coppia. */
  rowCrossings(): Crossing[] {
    const all = [...this.forced(), ...this._draft.map(cloneCrossing)];
    return all.sort((a, b) => a.pair - b.pair);
  }

  /** Fili sopra e sotto di un incrocio della riga corrente. */
  threadsOf(c: Crossing): { over: ThreadId; under: ThreadId } {
    const L = this.state.pos[c.pair] ?? '';
    const R = this.state.pos[c.pair + 1] ?? '';
    return c.over === 'L' ? { over: L, under: R } : { over: R, under: L };
  }

  private violation(code: Violation['code'], messageKey: string, extra: Partial<Violation> = {}): Violation {
    return { code, messageKey, ...extra };
  }

  private reject(v: Violation): Violation {
    const q = v.quirk ?? QUIRK_OF_CODE[v.code];
    if (q && v.threads && v.threads[0]) this.discover(q, v.code === 'rifiuto' ? (v.threads[1] ?? v.threads[0]) : v.threads[0]);
    this.emit('night:violation', { v });
    return v;
  }

  /** Controllo senza effetti: null se l'incrocio sarebbe ammesso. */
  check(c: Crossing): Violation | null {
    if (this.params.mode === 'replay' || this.params.mode === 'occasioni') return this.violation('forzato', NO_CROSS_KEY);
    if (this.needsNome) return this.violation('bloccato', NOME_FIRST_KEY);
    const others = this.params.mode === 'controllato' ? [] : this._draft.filter((d) => d.pair !== c.pair);
    return checkCrossing(this.level, this.state, others, c, this._ctx);
  }

  propose(c: Crossing): Violation | null {
    const cur = this._draft.find((d) => d.pair === c.pair);
    if (cur && cur.over === c.over) return null;
    const v = this.check(c);
    if (v) return this.reject(v);
    if (this.params.mode === 'controllato') this._draft = [];
    else this._draft = this._draft.filter((d) => d.pair !== c.pair);
    const nc: Crossing = { pair: c.pair, over: c.over };
    this._draft.push(nc);
    this.touch();
    const t = this.threadsOf(nc);
    this.emit('night:cross', { hour: this.hour, crossing: { ...nc }, over: t.over, under: t.under });
    return null;
  }

  flip(pair: number): Violation | null {
    const cur = this._draft.find((d) => d.pair === pair);
    if (!cur) {
      if (this.forced().some((f) => f.pair === pair)) return this.reject(this.violation('forzato', violationKey('forzato')));
      return null;
    }
    const nc: Crossing = { pair, over: cur.over === 'L' ? 'R' : 'L' };
    const others = this.params.mode === 'controllato' ? [] : this._draft.filter((d) => d.pair !== pair);
    const v = checkCrossing(this.level, this.state, others, nc, this._ctx);
    if (v) return this.reject(v);
    cur.over = nc.over;
    this.touch();
    const t = this.threadsOf(nc);
    this.emit('night:cross', { hour: this.hour, crossing: { ...nc }, over: t.over, under: t.under });
    return null;
  }

  remove(pair: number): void {
    const i = this._draft.findIndex((d) => d.pair === pair);
    if (i < 0) return;
    this._draft.splice(i, 1);
    this.touch();
    this.emit('night:undo', { hour: this.hour });
  }

  preview(): RowResult {
    if (this.previewCache && this.previewCache.v === this.version) return this.previewCache.r;
    let r: RowResult;
    if (this.done) r = { ok: true, state: this.state, events: [], violations: [] };
    else {
      const locked = this.params.mode === 'archivio' && !!this.archive && !this.archive.isHoleRow(this.hour);
      r = previewRow(this.levelFor(locked), this.state, this.isPlayerRow() ? this._draft : [], this._ctx);
    }
    this.previewCache = { v: this.version, r };
    return r;
  }

  /** Un incrocio in cui una lettera passerebbe solo con il verso opposto (tutorial «Chi sta sopra, dà»). */
  wrongSide(pair: number): boolean {
    const c = this._draft.find((d) => d.pair === pair);
    if (!c) return false;
    const letters = new Set(this.level.beads.filter((b) => b.type === 'lettera').map((b) => b.id));
    const moves = (draft: Crossing[]): number => {
      const r = previewRow(this.level, this.state, draft, this._ctx);
      let n = 0;
      for (const e of r.events) if ((e.k === 'passa' || e.k === 'consegna') && letters.has(e.bead)) n++;
      return n;
    };
    const here = moves(this._draft);
    const flipped = moves(this._draft.map((d) => (d.pair === pair ? { pair, over: d.over === 'L' ? 'R' : 'L' } : d)));
    return flipped > here;
  }

  fix(): RowResult {
    if (this.done) {
      const v = this.violation('bloccato', violationKey('finita'));
      return { ok: false, state: this.state, events: [], violations: [v] };
    }
    if (this.params.mode === 'occasioni' || this.params.mode === 'replay') {
      const v = this.violation('forzato', NO_CROSS_KEY);
      return { ok: false, state: this.state, events: [], violations: [this.reject(v)] };
    }
    if (this.needsNome) {
      const v = this.violation('bloccato', NOME_FIRST_KEY);
      return { ok: false, state: this.state, events: [], violations: [this.reject(v)] };
    }
    const draft = this._draft.map(cloneCrossing);
    const res = applyRow(this.level, this.state, draft, this._ctx);
    if (!res.ok) {
      const first = res.violations[0];
      if (first) this.reject(first);
      for (const v of res.violations.slice(1)) {
        const q = v.quirk ?? QUIRK_OF_CODE[v.code];
        if (q && v.threads?.[0]) this.discover(q, v.threads[0]);
      }
      return res;
    }
    const book = this.archive;
    if (book && this.params.mode === 'archivio') {
      const expected = book.expectedAt(res.state.hour);
      if (book.isHoleEnd(res.state.hour) && expected && !sameLace(res.state, expected)) {
        const v = this.violation('bloccato', ARCHIVE_MISMATCH_KEY, { params: { ora: res.state.hour } });
        this.reject(v);
        return { ok: false, state: this.state, events: [], violations: [v] };
      }
    }
    this.commit(res, draft, false);
    if (book && this.params.mode === 'archivio' && book.isHoleEnd(res.state.hour)) {
      // Strappo rammendato: le sue righe non si disfano più.
      book.markMended(res.state.hour);
      this.lockedRows = this._rows.length;
    }
    this.autoAdvance();
    return res;
  }

  undo(): void {
    const hour = this.hour;
    if (this._draft.length > 0) {
      this._draft.pop();
      this.countUndo(hour);
      this.touch();
      this.emit('night:undo', { hour });
      return;
    }
    if (!this.canUndo()) return;
    const row = this._rows.pop() as RowMoves;
    this._timeline.pop();
    this._events.pop();
    this._draft = row.crossings.filter((c) => !c.forced).map(cloneCrossing);
    this.archive?.unmend(row.hour);
    this.countUndo(row.hour);
    this.touch();
    this.emit('night:undo', { hour: row.hour });
  }

  private countUndo(hour: Hour): void {
    if (this.undoStreak.hour === hour) this.undoStreak.n++;
    else this.undoStreak = { hour, n: 1 };
  }

  rewindTo(hour: Hour): void {
    if (!this.canRewindTo(hour)) return;
    const i = hour - this.level.startHour;
    const dropped = this._rows.slice(i);
    this._timeline.length = i + 1;
    this._events.length = i;
    this._rows.length = i;
    this._draft = [];
    for (const r of dropped) this.archive?.unmend(r.hour);
    this.touch();
    this.emit('night:undo', { hour: hour + 1 });
  }

  setNome(thread: ThreadId): void {
    if (this._rows.length > 0) return;
    if (!this.state.pos.includes(thread)) return;
    this._nomeOn = thread;
    this._ctx = this.makeCtx();
    this.reset();
  }

  drop(noteId: NoteId): void {
    if (!this.params.accepted.some((a) => a.noteId === noteId) || this._dropped.includes(noteId)) return;
    this._dropped.push(noteId);
    this.touch();
  }

  /** Condizioni attive (obiettivi + richieste non lasciate cadere). */
  goals(): Condition[] {
    return activeGoals(this.params, this._dropped);
  }

  /** Timeline con la riga corrente in anteprima (per lo stato in tempo reale). */
  private liveTimeline(): { timeline: LaceState[]; events: LaceEvent[][] } {
    if (this.done) return { timeline: this._timeline, events: this._events };
    const p = this.preview();
    return { timeline: [...this._timeline, p.state], events: [...this._events, p.events] };
  }

  requestStatus(): { noteId: NoteId; report: CondReport }[] {
    return this.requestStatusFull().map((s) => ({ noteId: s.noteId, report: s.report }));
  }

  requestStatusFull(): RequestStatus[] {
    if (this.statusCache && this.statusCache.v === this.version) return this.statusCache.r;
    const live = this.params.accepted.filter((a) => !this._dropped.includes(a.noteId));
    const { timeline, events } = this.liveTimeline();
    const reports = live.length > 0 ? evaluate(this.level, timeline, events, live.map((a) => a.request), this._ctx, this.done) : [];
    const out: RequestStatus[] = this.params.accepted.map((a) => {
      if (this._dropped.includes(a.noteId)) return { noteId: a.noteId, report: { status: 'fallita', reasonKey: DROPPED_KEY }, dropped: true };
      const i = live.findIndex((x) => x.noteId === a.noteId);
      return { noteId: a.noteId, report: reports[i] ?? { status: 'in_corso' }, dropped: false };
    });
    this.statusCache = { v: this.version, r: out };
    return out;
  }

  /** Stato degli obiettivi obbligatori (in tempo reale). */
  goalStatus(): CondReport[] {
    if (this.params.goals.length === 0) return [];
    const { timeline, events } = this.liveTimeline();
    return evaluate(this.level, timeline, events, this.params.goals, this._ctx, this.done);
  }

  /** Spilli d'ottone ormai irraggiungibili dallo stato corrente. */
  unreachable(): ReturnType<typeof unreachablePins> {
    return unreachablePins(this.level, this.state, this._ctx);
  }

  // ───────── Suggerimenti ─────────

  /** Soluzione precalcolata per l'insieme di richieste attive, se c'è. */
  precomputed(): RowMoves[] | null {
    if (this.archive) return this.level.archive?.recorded ?? null;
    const c = this.deps.computed;
    if (!c) return null;
    const ids = this.params.accepted.filter((a) => !this._dropped.includes(a.noteId)).map((a) => a.noteId).sort();
    if (ids.length === 0) return c.base.rows ?? null;
    if (ids.length === 1) return c.perNote[ids[0] as string]?.rows ?? null;
    const combo = c.combos.find((x) => [...x.notes].sort().join('|') === ids.join('|'));
    return combo?.rows ?? null;
  }

  /** Incroci minimi per le richieste attive (filo d'oro). */
  minIncroci(): number | null {
    const c = this.deps.computed;
    if (!c) return null;
    if (this.archive) return c.base.incroci;
    const ids = this.params.accepted.filter((a) => !this._dropped.includes(a.noteId)).map((a) => a.noteId).sort();
    if (ids.length === 0) return c.base.incroci;
    if (ids.length === 1) return c.perNote[ids[0] as string]?.incroci ?? null;
    const combo = c.combos.find((x) => [...x.notes].sort().join('|') === ids.join('|'));
    return combo ? combo.incroci : null;
  }

  private matchesPrefix(sol: readonly RowMoves[]): boolean {
    if (sol.length !== this.level.endHour - this.level.startHour) return false;
    return this._rows.every((r, i) => {
      const s = sol[i];
      return !!s && sameCrossings(r.crossings, s.crossings);
    });
  }

  private async solveFrom(goals: Condition[]): Promise<{ status: SolveResult['status'] | 'timeout'; rows?: RowMoves[] }> {
    const solver = this.deps.solveAsync ?? engineSolveAsync;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const ms = this.deps.hintTimeoutMs ?? 1500;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<{ status: 'timeout' }>((resolve) => {
      timer = setTimeout(() => {
        ctl?.abort();
        resolve({ status: 'timeout' });
      }, ms);
    });
    const req: SolveRequest = { level: this.level, ctx: this._ctx, goals, from: { state: this.state, rowsDone: this._rows } };
    try {
      const res = await Promise.race([solver(req, ctl?.signal).then((r) => ({ status: r.status, rows: r.rows })), timeout]);
      return res;
    } catch {
      return { status: 'timeout' };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async hint(tier: HintTier): Promise<Hint> {
    this.hintsUsed++;
    if (tier === 'fantasma') this.fantasmaUsed = true;
    this.touch();
    const goals = this.goals();
    const base = { level: this.level, ctx: this._ctx, timeline: this._timeline, rows: this._rows };
    if (this.done) return { tier, textKey: HINT_KEYS.spintaGenerico };
    if (!this.isPlayerRow()) return { tier, textKey: this.level.hintKeys?.spinta ?? HINT_KEYS.spintaGenerico, highlight: { hour: this.hour } };
    if (tier === 'spinta') return hintFor({ ...base, goals, tier });
    let solution: RowMoves[] | null = null;
    const pre = this.precomputed();
    if (pre && this.matchesPrefix(pre)) solution = pre;
    if (!solution) {
      const res = await this.solveFrom(goals);
      if (res.status === 'ok' && res.rows) solution = res.rows;
      else if (res.status === 'impossibile') {
        // Con le richieste non si arriva: almeno la strada per chiudere la notte.
        if (goals.length !== this.params.goals.length) {
          const res2 = await this.solveFrom(this.params.goals);
          if (res2.status === 'ok' && res2.rows) solution = res2.rows;
        }
        if (!solution) {
          if (tier === 'indizio' && this.level.hintKeys?.indizio) return { tier, textKey: this.level.hintKeys.indizio };
          return { tier, textKey: HINT_KEYS.impossibile };
        }
      }
    }
    if (!solution || !this.matchesPrefix(solution)) {
      // Solver al limite o troppo lento, e nessuna soluzione precalcolata che combaci: suggerimento generico.
      return { tier, textKey: this.level.hintKeys?.spinta ?? HINT_KEYS.spintaGenerico, highlight: { hour: this.hour } };
    }
    return hintFor({ ...base, goals, tier, solution });
  }

  // ───────── Modalità automatiche ─────────

  /** Occasioni piantate dal giocatore (finale aperto, Archivio A6). Restituisce quelle accettate. */
  setOccasions(list: readonly OccasionDef[]): OccasionDef[] {
    const accepted: OccasionDef[] = [];
    for (const o of list) {
      if (!OCCASION_KINDS_ORDER.includes(o.kind)) continue;
      const clean: OccasionDef = { kind: o.kind, place: o.place, hour: o.hour };
      if (occasionProblem(this.level, accepted, clean) !== null) continue;
      accepted.push(clean);
    }
    this._occasions = accepted;
    this._ctx = this.makeCtx();
    this.reset();
    return accepted.map((o) => ({ ...o }));
  }

  /** Una riga automatica (occasioni, spartito). null se non c'è più nulla da tessere. */
  stepAuto(): RowResult | null {
    if (this.done) return null;
    if (this.params.mode === 'replay') {
      const rows = this.params.replay ?? [];
      const r = rows[this.replayIndex];
      if (!r) return null;
      const draft = r.crossings.filter((c) => !c.forced).map(cloneCrossing);
      const res = applyRow(this.levelFree, this.state, draft, this._ctx);
      if (!res.ok) {
        const v = res.violations[0];
        if (v) this.reject(v);
        return res;
      }
      for (const c of draft) {
        const t = this.threadsOf(c);
        this.emit('night:cross', { hour: this.hour, crossing: { ...c }, over: t.over, under: t.under });
      }
      this.replayIndex++;
      this.commit(res, draft, false);
      return res;
    }
    const res = applyRow(this.levelFree, this.state, [], this._ctx);
    if (!res.ok) {
      const v = res.violations[0];
      if (v) this.reject(v);
      return res;
    }
    this.commit(res, [], false);
    return res;
  }

  /** Righe dello spartito che restano da ritessere. */
  replayLeft(): number {
    return Math.max(0, (this.params.replay ?? []).length - this.replayIndex);
  }

  /** Riprova (occasioni): si torna all'apertura con le stesse occasioni. */
  retry(): void {
    this.reset();
  }

  /**
   * Obiettivi e richieste soddisfatti a merletto finito (occasioni). Nell'Archivio
   * con le occasioni (A6) gli strappi coprono la giornata e il rammendo è scritto
   * negli obiettivi del livello: il merletto registrato non si ritesse uguale.
   */
  succeeded(): boolean {
    if (!this.done) return false;
    const reports = evaluate(this.level, this._timeline, this._events, this.goals(), this._ctx, true);
    return reports.every((r) => r.status === 'soddisfatta');
  }

  /** Mossa del filo controllato (fin_seppia): -1 sinistra, 0 fermo, +1 destra. */
  controlledMove(dir: -1 | 0 | 1): Crossing | null {
    const id = this.level.autoweave?.controlled;
    if (!id) return null;
    const col = this.state.pos.indexOf(id);
    if (col < 0 || dir === 0) return null;
    const pair = dir < 0 ? col - 1 : col;
    if (pair < 0 || pair > this.level.columns.length - 2) return null;
    return { pair, over: dir < 0 ? 'R' : 'L' };
  }

  // ───────── Esito ─────────

  complete(): NightOutcome {
    if (this.outcomeCache) return this.outcomeCache;
    const level = this.level;
    const goals = evaluate(level, this._timeline, this._events, this.params.goals, this._ctx, this.done);
    const live = this.params.accepted.filter((a) => !this._dropped.includes(a.noteId));
    const reps = live.length > 0 ? evaluate(level, this._timeline, this._events, live.map((a) => a.request), this._ctx, this.done) : [];
    const requests = this.params.accepted.map((a) => {
      if (this._dropped.includes(a.noteId)) return { noteId: a.noteId, status: 'fallita' as const };
      const i = live.findIndex((x) => x.noteId === a.noteId);
      return { noteId: a.noteId, status: reps[i]?.status === 'soddisfatta' ? ('soddisfatta' as const) : ('fallita' as const) };
    });
    const outcome: NightOutcome = {
      origin: this.params.origin,
      levelId: level.id,
      rows: this._rows.map((r) => ({ hour: r.hour, crossings: r.crossings.map(cloneCrossing) })),
      timeline: [...this._timeline],
      events: [...this._events],
      goals,
      requests,
      dropped: [...this._dropped],
      metrics: metrics(level, this._rows, this.minIncroci(), this.fantasmaUsed),
      spartito: this.spartito(),
      hintsUsed: this.hintsUsed,
      fantasmaUsed: this.fantasmaUsed,
      discoveredQuirks: [...this._discovered],
      nomeOn: this._nomeOn,
    };
    if (this.archive) {
      const mended = this.params.mode === 'occasioni' ? this.succeeded() : this.done && this.archive.allMended();
      outcome.archive = { named: this.archive.allNamed(), mended };
    }
    if (this.params.mode === 'occasioni' || this._occasions.length > 0) outcome.occasions = this._occasions.map((o) => ({ ...o }));
    this.outcomeCache = outcome;
    this.emit('night:complete', { outcome });
    return outcome;
  }

  /** Spartito del merletto (vuoto se il riferimento del livello non si può scrivere). */
  spartito(): string {
    const id = this.level.id;
    try {
      let mode: 'S' | 'G' | 'L' = 'S';
      let ref = id;
      let gradi = this.params.gradi;
      const day = /^day-(\d{4}-\d{2}-\d{2})$/.exec(id);
      const lib = /^lib-([0-9a-z]+)(?:~(.*))?$/.exec(id);
      if (day && day[1]) {
        mode = 'G';
        ref = spartitoRef('G', day[1]);
      } else if (lib && lib[1]) {
        mode = 'L';
        ref = spartitoRef('L', lib[1]);
      } else {
        gradi = undefined;
      }
      const s: Parameters<typeof encodeSpartito>[0] = { mode, ref, rows: this._rows };
      if (gradi && gradi.length > 0) s.gradi = [...gradi];
      return encodeSpartito(s);
    } catch {
      return '';
    }
  }

  toResume(): NightResume {
    const r: NightResume = {
      levelId: this.level.id,
      rows: this._rows.map((x) => ({ hour: x.hour, crossings: x.crossings.map(cloneCrossing) })),
      draft: this._draft.map(cloneCrossing),
      dropped: [...this._dropped],
      nomeOn: this._nomeOn,
      hintsUsed: this.hintsUsed,
      fantasmaUsed: this.fantasmaUsed,
    };
    if (this._occasions.length > 0) r.occasions = this._occasions.map((o) => ({ ...o }));
    if (this.archive) {
      const names = this.archive.names();
      if (Object.keys(names).length > 0) r.archiveNames = names;
    }
    return r;
  }

  /** Simulazione di righe date dall'apertura (per l'export e per i controlli). */
  static simulateRows(level: LevelDef, rows: readonly RowMoves[], flags: NightParams['flags'] = {}): ReturnType<typeof simulate> {
    return simulate(level, createContext(level, flags), rows);
  }
}

export function createSession(params: NightParams, deps?: SessionDeps): Session {
  return new Session(params, deps);
}
