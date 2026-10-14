/**
 * Modalità Archivio (GDD 5.3, ARCHITETTURA 5.3): un merletto antico già finito,
 * con i fili sbiaditi e 1-2 righe strappate.
 *
 * - Nominare: si assegna a ogni filo sbiadito un nome fra i candidati. Il
 *   contatore dice quanti nomi provvisori sono giusti; la conferma scatta da
 *   sola quando i giusti sono 3 (o tutti quelli che restano, se sono meno di 3):
 *   quei fili si ricolorano.
 * - Rammendare: le righe strappate si ritessono con i controlli normali; alla
 *   fine di ogni strappo lo stato (posizioni e perline) deve coincidere con
 *   quello registrato (`sameLace`). La matassa conta solo gli incroci dei rammendi.
 * - Eco: a merletto nominato e rammendato, toccando gli incroci si leggono gli echi.
 *
 * Questo modulo non disegna: tiene i nomi, gli strappi e il merletto registrato.
 */
import type { CharacterId, Hour, LaceState, LevelDef, NightParams, RowMoves, ThreadId } from '../../core/types';
import { createContext, sameLace, simulate } from '../../engine/index';

/** L'Archivio è attivo per un livello con `archive` in modo archivio (o con le occasioni, per A6). */
export function archiveActive(params: Pick<NightParams, 'level' | 'mode'>): boolean {
  return !!params.level.archive && (params.mode === 'archivio' || params.mode === 'occasioni');
}

export interface NameResult {
  /** Fili confermati da questo nome (vuoto se la conferma non è scattata). */
  confirmed: ThreadId[];
  /** Nomi provvisori giusti fra i fili non ancora confermati. */
  correct: number;
  /** Quanti giusti servono per confermare. */
  needed: number;
}

export class ArchiveBook {
  private readonly tentative = new Map<ThreadId, CharacterId>();
  private readonly confirmedSet = new Set<ThreadId>();
  private readonly mendedHoles = new Set<number>();
  /** Stati registrati: recordedTimeline[i] = stato all'ora startHour + i. */
  private readonly recordedTimeline: LaceState[];
  private readonly holeRows = new Set<Hour>();

  constructor(private readonly level: LevelDef) {
    const a = level.archive;
    const free: LevelDef = { ...level, matassa: Number.MAX_SAFE_INTEGER };
    const sim = a ? simulate(free, createContext(free, {}), a.recorded) : null;
    this.recordedTimeline = sim ? sim.timeline : [];
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

  /** Assegna (o toglie, con null) un nome provvisorio; la conferma scatta da sola. */
  name(thread: ThreadId, character: CharacterId | string | null): NameResult {
    const a = this.level.archive;
    if (!a || !this.faded().includes(thread) || this.confirmedSet.has(thread)) {
      const c = this.counter();
      return { confirmed: [], correct: c.correct, needed: c.needed };
    }
    if (character === null) this.tentative.delete(thread);
    else if ((a.candidates as string[]).includes(character)) this.tentative.set(thread, character as CharacterId);
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
    const after = this.counter();
    return { confirmed, correct: after.correct, needed: after.needed };
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
}
