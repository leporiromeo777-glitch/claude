/**
 * Autotessitura nel tombolo (GDD 3.10, ARCHITETTURA 5.3):
 * - filo controllato (fin_seppia): il giocatore muove solo quel filo, il resto
 *   lo decide `planAutoRow`; l'anteprima della riga è il piano completo;
 * - occasioni (fin_aperto, Archivio A6): spilli verdi nelle celle ammesse, al
 *   massimo `occasionSlots`; "Lascia accadere" tesse la giornata riga per riga,
 *   con un'animazione, e si può riprovare.
 *
 * Il passo della riga automatica è `Session.stepAuto()`; qui ci sono le regole
 * delle occasioni e il temporizzatore dell'animazione (`AutoRunner`).
 */
import type { LevelDef, OccasionDef, OccasionKind, RowResult } from '../../core/types';

export const OCCASION_KINDS_ORDER: readonly OccasionKind[] = ['pane', 'festa', 'messa', 'lanterna', 'vaporetto'];

/** Glifo di ogni tipo di occasione (spillo verde). */
export const OCCASION_GLYPH: Readonly<Record<OccasionKind, string>> = {
  pane: 'pagnotta',
  festa: 'stella',
  messa: 'campana',
  lanterna: 'lanterna',
  vaporetto: 'bitta',
};

/** Quante occasioni si possono piantare (0 = la modalità non le prevede). */
export function occasionSlots(level: LevelDef): number {
  return Math.max(0, level.autoweave?.occasionSlots ?? 0);
}

/** Occasioni fisse (l'agenda di Livia in fin_seppia): si vedono ma non si toccano. */
export function presetOccasions(level: LevelDef): OccasionDef[] {
  return (level.autoweave?.presetOccasions ?? []).map((o) => ({ ...o }));
}

/** Celle ammesse: quelle elencate, oppure tutte le celle giocabili (con un tipo da scegliere). */
export function allowedCells(level: LevelDef): OccasionDef[] {
  const list = level.autoweave?.allowedOccasions;
  if (list && list.length > 0) return list.map((o) => ({ ...o }));
  return [];
}

function sameCell(a: Pick<OccasionDef, 'place' | 'hour'>, b: Pick<OccasionDef, 'place' | 'hour'>): boolean {
  return a.place === b.place && a.hour === b.hour;
}

/**
 * Perché un'occasione non si può piantare (chiave i18n), o null se va bene.
 * `existing` sono le occasioni già piantate (senza quella nuova).
 */
export function occasionProblem(level: LevelDef, existing: readonly OccasionDef[], o: OccasionDef): string | null {
  if (!level.columns.includes(o.place)) return 'tombolo.occasioni.nonAmmessa';
  if (!Number.isInteger(o.hour) || o.hour <= level.startHour || o.hour > level.endHour) return 'tombolo.occasioni.nonAmmessa';
  if (presetOccasions(level).some((p) => sameCell(p, o))) return 'tombolo.occasioni.occupata';
  if (existing.some((e) => sameCell(e, o))) return 'tombolo.occasioni.occupata';
  if (existing.length >= occasionSlots(level)) return 'tombolo.occasioni.troppe';
  const allowed = allowedCells(level);
  if (allowed.length > 0 && !allowed.some((a) => sameCell(a, o) && a.kind === o.kind)) return 'tombolo.occasioni.nonAmmessa';
  return null;
}

/** Aggiunge o toglie l'occasione di una cella (tocco sul tombolo). */
export function toggleOccasion(level: LevelDef, current: readonly OccasionDef[], cell: OccasionDef): { list: OccasionDef[]; problem: string | null } {
  const i = current.findIndex((c) => sameCell(c, cell));
  if (i >= 0) {
    const list = current.filter((_, k) => k !== i).map((x) => ({ ...x }));
    return { list, problem: null };
  }
  const problem = occasionProblem(level, current, cell);
  if (problem) return { list: current.map((x) => ({ ...x })), problem };
  return { list: [...current.map((x) => ({ ...x })), { ...cell }], problem: null };
}

/** Occasione ammessa in una cella (con il suo tipo), se la cella è fra quelle ammesse. */
export function allowedAt(level: LevelDef, place: OccasionDef['place'], hour: number): OccasionDef | null {
  return allowedCells(level).find((a) => a.place === place && a.hour === hour) ?? null;
}

export interface AutoRunnerDeps {
  /** Una riga automatica; null quando non c'è più nulla da tessere. */
  step(): RowResult | null;
  /** Millisecondi fra una riga e l'altra (0 = tutte subito, una per fotogramma). */
  stepMs(): number;
  onDone(ok: boolean): void;
}

/**
 * Temporizzatore di "Lascia accadere" e degli spartiti: avanza di una riga ogni
 * `stepMs` di tempo di gioco (si muove con `update(dt)`, quindi rispetta la
 * pausa e la velocità del ciclo). Le righe escono una alla volta, al passo
 * dell'animazione, così la campana e gli incroci non si sovrappongono.
 */
export class AutoRunner {
  private acc = 0;
  private active = false;
  private first = true;

  constructor(private readonly deps: AutoRunnerDeps) {}

  start(): void {
    this.active = true;
    this.first = true;
    this.acc = 0;
  }

  stop(): void {
    this.active = false;
  }

  running(): boolean {
    return this.active;
  }

  /** dt in secondi. */
  update(dt: number): void {
    if (!this.active) return;
    const ms = Math.max(0, this.deps.stepMs());
    this.acc += dt * 1000;
    if (!this.first && this.acc < ms) return;
    this.first = false;
    this.acc = 0;
    const r = this.deps.step();
    if (r === null) {
      this.active = false;
      this.deps.onDone(true);
      return;
    }
    if (!r.ok) {
      this.active = false;
      this.deps.onDone(false);
    }
  }

  /** Esegue tutto subito (per Salta e per i test). */
  finish(): boolean {
    this.active = false;
    for (let guard = 0; guard < 64; guard++) {
      const r = this.deps.step();
      if (r === null) {
        this.deps.onDone(true);
        return true;
      }
      if (!r.ok) {
        this.deps.onDone(false);
        return false;
      }
    }
    this.deps.onDone(false);
    return false;
  }
}
