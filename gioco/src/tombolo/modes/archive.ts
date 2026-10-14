/**
 * Modalità Archivio (GDD 5.3, ARCHITETTURA 5.3): un merletto antico già finito,
 * con i fili sbiaditi e 1-2 righe strappate.
 *
 * - Nominare (alla maniera di Obra Dinn, revisione 1 D05.2-3): si assegna a
 *   ogni filo sbiadito un nome fra i candidati. Nessun contatore dei giusti: il
 *   giocatore vede solo quanti nomi ha dato. La conferma scatta da sola quando
 *   fra i nomi provvisori ce ne sono almeno 3 giusti (o tutti quelli che
 *   restano, se sono meno di 3): quei fili si ricolorano. Un nome già dato a un
 *   altro filo si sposta sul filo nuovo (niente doppioni); un nome confermato
 *   non si dà a nessun altro.
 * - Rammendare: le righe strappate si ritessono con i controlli normali; alla
 *   fine di ogni strappo lo stato (posizioni e perline) deve coincidere con
 *   quello registrato (`sameLace`). La matassa conta solo gli incroci dei rammendi.
 * - Eco: a merletto nominato e rammendato, toccando gli incroci si leggono gli echi.
 *
 * Questo modulo non disegna: tiene i nomi, gli strappi e il merletto registrato.
 */
import type { BalanceDef, CharacterId, Hour, LaceEvent, LaceState, LevelDef, NightParams, RowMoves, ThreadId } from '../../core/types';
import { createContext, sameLace, simulate } from '../../engine/index';

/**
 * Un merletto d'Archivio è storia: si tesse con le regole di allora, non con i
 * flag della campagna di oggi (per esempio `riconciliate` toglierebbe le
 * stranezze di Marta e Teresa ad arc1 e il rammendo non coinciderebbe più con
 * il merletto registrato). Stesse regole di `levels:check`: flag vuoti.
 */
export const ARCHIVE_FLAGS: Readonly<Record<string, never>> = Object.freeze({});

/** L'Archivio è attivo per un livello con `archive` in modo archivio (o con le occasioni, per A6). */
export function archiveActive(params: Pick<NightParams, 'level' | 'mode'>): boolean {
  return !!params.level.archive && (params.mode === 'archivio' || params.mode === 'occasioni');
}

export interface NameResult {
  /** Fili confermati da questo nome (vuoto se la conferma non è scattata). */
  confirmed: ThreadId[];
  /** Nomi provvisori giusti fra i fili non ancora confermati (solo per il debug: il giocatore non lo vede). */
  correct: number;
  /** Quanti giusti servono per confermare. */
  needed: number;
  /** Il nome c'era già su un altro filo e si è spostato: quel filo (o null). */
  moved: ThreadId | null;
  /** Tutti i fili aperti hanno un nome provvisorio ma la conferma non è scattata («non ancora»). */
  waiting: boolean;
  /** Nome rifiutato: fuori dai candidati, già confermato su un altro filo, o filo già confermato. */
  refused: boolean;
}

export class ArchiveBook {
  private readonly tentative = new Map<ThreadId, CharacterId>();
  private readonly confirmedSet = new Set<ThreadId>();
  private readonly mendedHoles = new Set<number>();
  /** Stati registrati: recordedTimeline[i] = stato all'ora startHour + i. */
  private readonly recordedTimeline: LaceState[];
  /** Eventi delle righe registrate: recordedEventList[i] = riga dell'ora startHour + i + 1. */
  private readonly recordedEventList: LaceEvent[][];
  /** Righe registrate come le ha ricostruite il motore (con gli incroci forzati). */
  private readonly recordedRowList: RowMoves[];
  private readonly holeRows = new Set<Hour>();

  constructor(
    private readonly level: LevelDef,
    balance?: Pick<BalanceDef, 'traboccoSoglia' | 'nodoRighe'> | null,
  ) {
    const a = level.archive;
    const free: LevelDef = { ...level, matassa: Number.MAX_SAFE_INTEGER };
    const sim = a ? simulate(free, createContext(free, ARCHIVE_FLAGS, { balance: balance ?? null }), a.recorded) : null;
    this.recordedTimeline = sim ? sim.timeline : [];
    this.recordedEventList = sim ? sim.events : [];
    this.recordedRowList = sim ? sim.rows : [];
    for (const h of this.holes()) for (let x = h.from; x <= h.to; x++) this.holeRows.add(x);
  }

  holes(): { from: Hour; to: Hour }[] {
    return [...(this.level.archive?.holes ?? [])].sort((a, b) => a.from - b.from);
  }

  /** Fili da nominare. */
  faded(): ThreadId[] {
    return [...(this.level.archive?.faded ?? [])];
  }

  candidates(): CharacterId[] {
    return [...(this.level.archive?.candidates ?? [])];
  }

  isFaded(thread: ThreadId): boolean {
    return this.faded().includes(thread) && !this.confirmedSet.has(thread);
  }

  isConfirmed(thread: ThreadId): boolean {
    return this.confirmedSet.has(thread);
  }

  /** Il nome confermato (la risposta) di un filo, o null. */
  confirmedAs(thread: ThreadId): CharacterId | null {
    if (!this.confirmedSet.has(thread)) return null;
    return this.level.archive?.answer[thread] ?? null;
  }

  tentativeOf(thread: ThreadId): CharacterId | null {
    return this.tentative.get(thread) ?? null;
  }

  /** Nomi provvisori e confermati (per la ripresa). */
  names(): Record<ThreadId, CharacterId> {
    const out: Record<ThreadId, CharacterId> = {};
    for (const [k, v] of this.tentative) out[k] = v;
    return out;
  }

  confirmedList(): ThreadId[] {
    return this.faded().filter((t) => this.confirmedSet.has(t));
  }

  /** Quanti nomi provvisori sono giusti, e quanti ne servono per confermare. */
  counter(): { correct: number; needed: number; remaining: number } {
    const a = this.level.archive;
    const open = this.faded().filter((t) => !this.confirmedSet.has(t));
    let correct = 0;
    for (const t of open) if (a && this.tentative.get(t) === a.answer[t]) correct++;
    return { correct, needed: Math.min(3, open.length), remaining: open.length };
  }

  /** Nomi dati (provvisori o confermati) su quanti fili sbiaditi (D05.2: «Nomi dati: 2 di 4»). */
  progress(): { given: number; total: number; confirmed: number } {
    const all = this.faded();
    const given = all.filter((t) => this.confirmedSet.has(t) || this.tentative.has(t)).length;
    return { given, total: all.length, confirmed: this.confirmedList().length };
  }

  /** Il filo che porta già questo nome (provvisorio o confermato), o null. */
  holderOf(character: CharacterId | string): ThreadId | null {
    for (const t of this.faded()) if (this.tentative.get(t) === character) return t;
    return null;
  }

  /** Fili sbiaditi ancora senza nome confermato. */
  missing(): ThreadId[] {
    return this.faded().filter((t) => !this.confirmedSet.has(t));
  }

  /**
   * Assegna (o toglie, con null) un nome provvisorio; la conferma scatta da sola.
   * Un nome già provvisorio su un altro filo si sposta qui (`moved`); un nome
   * confermato su un altro filo non si dà (`refused`).
   */
  name(thread: ThreadId, character: CharacterId | string | null): NameResult {
    const a = this.level.archive;
    const result = (confirmed: ThreadId[], moved: ThreadId | null, refused: boolean): NameResult => {
      const c = this.counter();
      const open = this.missing();
      const waiting = !refused && confirmed.length === 0 && open.length > 0 && open.every((t) => this.tentative.has(t));
      return { confirmed, correct: c.correct, needed: c.needed, moved, waiting, refused };
    };
    if (!a || !this.faded().includes(thread) || this.confirmedSet.has(thread)) return result([], null, true);
    let moved: ThreadId | null = null;
    if (character === null) this.tentative.delete(thread);
    else {
      if (!(a.candidates as string[]).includes(character)) return result([], null, true);
      const other = this.holderOf(character);
      if (other && other !== thread) {
        if (this.confirmedSet.has(other)) return result([], null, true);
        this.tentative.delete(other);
        moved = other;
      }
      this.tentative.set(thread, character as CharacterId);
    }
    const c = this.counter();
    const confirmed: ThreadId[] = [];
    if (c.remaining > 0 && c.correct >= c.needed) {
      for (const t of this.faded()) {
        if (this.confirmedSet.has(t)) continue;
        if (this.tentative.get(t) === a.answer[t]) {
          this.confirmedSet.add(t);
          confirmed.push(t);
        }
      }
    }
    return result(confirmed, moved, false);
  }

  /**
   * Rimette i nomi confermati (Ricomincia la notte, ripresa): i fili tornano
   * confermati con la risposta giusta, senza passare dalla conferma a gruppi.
   */
  restoreConfirmed(threads: readonly ThreadId[]): void {
    const a = this.level.archive;
    if (!a) return;
    for (const t of threads) {
      const ans = a.answer[t];
      if (!ans || !this.faded().includes(t)) continue;
      const other = this.holderOf(ans);
      if (other && other !== t) this.tentative.delete(other);
      this.tentative.set(t, ans);
      this.confirmedSet.add(t);
    }
  }

  allNamed(): boolean {
    return this.faded().every((t) => this.confirmedSet.has(t));
  }

  // ───────── Strappi ─────────

  isHoleRow(hour: Hour): boolean {
    return this.holeRows.has(hour);
  }

  isHoleStart(hour: Hour): boolean {
    return this.holes().some((h) => h.from === hour);
  }

  isHoleEnd(hour: Hour): boolean {
    return this.holes().some((h) => h.to === hour);
  }

  /** Riga registrata di un'ora. */
  recordedRow(hour: Hour): RowMoves | null {
    return this.level.archive?.recorded.find((r) => r.hour === hour) ?? null;
  }

  /** Stato registrato dopo la riga dell'ora `hour`. */
  expectedAt(hour: Hour): LaceState | null {
    return this.recordedTimeline[hour - this.level.startHour] ?? null;
  }

  recordedStates(): readonly LaceState[] {
    return this.recordedTimeline;
  }

  /**
   * Riga registrata dell'indice `i` (1 = ora startHour + 1) pronta per il disegno:
   * stato prima e dopo, incroci (con i forzati) ed eventi. null se non c'è.
   */
  recordedRowAt(i: number): { before: LaceState; after: LaceState; row: RowMoves; events: LaceEvent[] } | null {
    const before = this.recordedTimeline[i - 1];
    const after = this.recordedTimeline[i];
    const row = this.recordedRowList[i - 1];
    const events = this.recordedEventList[i - 1];
    if (!before || !after || !row || !events) return null;
    return { before, after, row, events };
  }

  /** Strappi non ancora rammendati (indici nella lista ordinata di `holes()`). */
  openHoles(): { from: Hour; to: Hour }[] {
    return this.holes().filter((_, i) => !this.mendedHoles.has(i));
  }

  /** Incroci del giocatore nelle righe strappate (la matassa dell'Archivio). */
  usedInHoles(rows: readonly RowMoves[]): number {
    let n = 0;
    for (const r of rows) if (this.holeRows.has(r.hour)) n += r.crossings.filter((c) => !c.forced).length;
    return n;
  }

  markMended(hourEnd: Hour): void {
    const i = this.holes().findIndex((h) => h.to === hourEnd);
    if (i >= 0) this.mendedHoles.add(i);
  }

  unmend(hour: Hour): void {
    const i = this.holes().findIndex((h) => hour >= h.from && hour <= h.to);
    if (i >= 0) this.mendedHoles.delete(i);
  }

  isMended(i: number): boolean {
    return this.mendedHoles.has(i);
  }

  allMended(): boolean {
    return this.holes().every((_, i) => this.mendedHoles.has(i));
  }

  resetProgress(): void {
    this.mendedHoles.clear();
  }

  /** Eco dell'incrocio (ora, coppia), se c'è. */
  echoAt(hour: Hour, pair: number): string | null {
    return this.level.archive?.echoes.find((e) => e.hour === hour && e.pair === pair)?.textKey ?? null;
  }

  echoes(): { hour: Hour; pair: number; textKey: string }[] {
    return [...(this.level.archive?.echoes ?? [])];
  }

  /** Fili del crocevia di un eco nel merletto registrato: chi sta sopra e chi sotto. */
  echoThreads(hour: Hour, pair: number): { over: ThreadId; under: ThreadId } | null {
    const r = this.recordedRowAt(hour - this.level.startHour);
    if (!r) return null;
    const L = r.before.pos[pair];
    const R = r.before.pos[pair + 1];
    if (!L || !R) return null;
    const c = r.row.crossings.find((x) => x.pair === pair);
    return c && c.over === 'R' ? { over: R, under: L } : { over: L, under: R };
  }

  /** Filo nella colonna `col` del merletto registrato, all'ora `hour` (stato dopo quella riga). */
  recordedThreadAt(hour: Hour, col: number): ThreadId | null {
    return this.recordedTimeline[hour - this.level.startHour]?.pos[col] ?? null;
  }
}
