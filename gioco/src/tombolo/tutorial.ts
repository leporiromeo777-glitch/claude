/**
 * Tutorial del livello (ARCHITETTURA 5.3, GDD 9, revisione 1 C02/D03).
 *
 * - mano: una mano fantasma (con un fuso fantasma che la segue) ripete il
 *   trascinamento di quella riga finché il giocatore non fa un incrocio in quella riga;
 * - margine: una nota di Clotilde (o di Ada, a matita) compare quando succede
 *   la cosa giusta. Quando:
 *     primaOra         inizio della prima riga giocabile
 *     ora              inizio della riga `hour`
 *     incrocio         primo incrocio messo in bozza nella riga `hour` (in qualunque riga se manca), qualunque sia il verso
 *     versoSbagliato   un incrocio in cui una lettera passerebbe solo con il verso opposto
 *     rifiuto          riga o incrocio rifiutati per una stranezza (rifiuto, corre, faro); con `codice` solo quel codice
 *     spillo           violazione di uno spillo
 *     evento           prima comparsa dell'evento `evento` (anteprima della riga o riga fissata), con `chi` solo per quel filo
 *     nome             subito dopo che il nome di Ada è stato appuntato
 *     archivioNomi     tutti i fili sbiaditi confermati
 *     archivioRammendo tutti gli strappi rammendati
 *   Ogni testo si mostra una volta per notte (due passi con la stessa chiave contano come uno).
 * - pulsa: un elemento pulsa nella riga `hour` finché il giocatore non ci
 *   interagisce o finché quell'ora non è fissata: fissa, taccuino, nome, disfa,
 *   lampada, obiettivi, matassa, bordo (barca della riga), spillo (di `thread`,
 *   il più vicino a `hour`), fuso (di `thread`), marea (colonne allagate).
 */
import type { Hour, LaceEvent, LaceEventKind, MarginWhen, PulseTarget, ThreadId, TutorialStep, Violation } from '../core/types';

/** Violazioni che il tutorial chiama 'rifiuto' senza `codice` (stranezze dei personaggi). */
const REFUSALS: ReadonlySet<Violation['code']> = new Set<Violation['code']>(['rifiuto', 'corre', 'faro']);
/** Codici ammessi in `codice` (C02). */
const REFUSAL_CODES: ReadonlySet<Violation['code']> = new Set<Violation['code']>(['rifiuto', 'corre', 'faro', 'bloccato', 'occupato']);

export type MarginHand = 'clotilde' | 'ada';

export interface TutorialHooks {
  /** Mostra la nota a margine (una volta per notte). */
  margin(textKey: string, hand: MarginHand): void;
}

export interface ActivePulse {
  target: PulseTarget;
  hour: Hour;
  thread?: ThreadId;
}

type MarginStep = Extract<TutorialStep, { k: 'margine' }>;
type PulseStep = Extract<TutorialStep, { k: 'pulsa' }>;

/** Filo «coinvolto» in un evento, per il filtro `chi` (C02). */
export function eventSubject(e: LaceEvent): ThreadId[] {
  switch (e.k) {
    case 'passa':
    case 'copia':
      return [e.to];
    case 'consegna':
      return [e.to];
    case 'cura':
      return [e.who];
    case 'contagio':
      return [e.to];
    case 'legge':
      return [e.who];
    case 'incontro':
    case 'nodo':
      return [e.a, e.b];
    case 'esce':
    case 'entra':
    case 'stranezza':
    case 'nero':
      return [e.thread];
    case 'trabocca':
      return [e.who];
  }
}

export class Tutorial {
  private readonly handDone = new Set<Hour>();
  /** Chiavi già mostrate stanotte. */
  private readonly shown = new Set<string>();
  /** Pulsazioni spente da un'interazione (indice del passo). */
  private readonly pulseDone = new Set<number>();

  constructor(
    private readonly steps: readonly TutorialStep[],
    private readonly hooks: TutorialHooks,
  ) {}

  /** Passi del tutorial (per i test). */
  get all(): readonly TutorialStep[] {
    return this.steps;
  }

  /** Mano fantasma della riga corrente: da colonna a colonna, o null. */
  hand(hour: Hour, draftEmpty: boolean): { from: number; to: number } | null {
    if (!draftEmpty || this.handDone.has(hour)) return null;
    for (const s of this.steps) {
      if (s.k !== 'mano' || s.hour !== hour) continue;
      // Il fuso trascinato passa sopra: con over 'R' si trascina quello di destra.
      return s.over === 'R' ? { from: s.pair + 1, to: s.pair } : { from: s.pair, to: s.pair + 1 };
    }
    return null;
  }

  /** Mostra la nota del passo se non è già stata mostrata stanotte. */
  private fire(s: MarginStep): void {
    if (this.shown.has(s.textKey)) return;
    this.shown.add(s.textKey);
    this.hooks.margin(s.textKey, s.mano === 'ada' ? 'ada' : 'clotilde');
  }

  private margins(when: MarginWhen): MarginStep[] {
    const out: MarginStep[] = [];
    for (const s of this.steps) if (s.k === 'margine' && s.when === when && !this.shown.has(s.textKey)) out.push(s);
    return out;
  }

  /** Il testo è già stato mostrato stanotte? */
  wasShown(textKey: string): boolean {
    return this.shown.has(textKey);
  }

  /** Segna come già mostrate (ripresa della notte: niente note ripetute). */
  markShown(keys: readonly string[]): void {
    for (const k of keys) this.shown.add(k);
  }

  /** Un incrocio accettato nella riga `hour`; `wrongSide` = la lettera passerebbe solo con l'altro verso. */
  onCross(hour: Hour, wrongSide: boolean): void {
    this.handDone.add(hour);
    for (const s of this.margins('incrocio')) if (s.hour === undefined || s.hour === hour) this.fire(s);
    if (wrongSide) for (const s of this.margins('versoSbagliato')) if (s.hour === undefined || s.hour === hour) this.fire(s);
  }

  /**
   * Una riga o un incrocio rifiutato. Per GDD 3.4 sono «righe rifiutate» tutte le
   * violazioni di una stranezza: Marta che non passa sotto (`rifiuto`), Gino che
   * non sta fermo (`corre`), Zeno che non lascia il Faro (`faro`). Con `codice`
   * il passo parte solo con quel codice (anche `bloccato` e `occupato`).
   * Restituisce true se è partita una nota (allora la riga di motivo non serve, D04).
   */
  onViolation(v: Violation, hour: Hour): boolean {
    let fired = false;
    for (const s of this.margins('rifiuto')) {
      if (s.hour !== undefined && s.hour !== hour) continue;
      if (s.codice ? s.codice !== v.code || !REFUSAL_CODES.has(v.code) : !REFUSALS.has(v.code)) continue;
      this.fire(s);
      fired = true;
    }
    if (v.code === 'spillo') {
      for (const s of this.margins('spillo')) {
        if (s.hour !== undefined && s.hour !== hour) continue;
        this.fire(s);
        fired = true;
      }
    }
    return fired;
  }

  /** Inizio di una riga (prima riga della notte: primaOra; poi `ora` all'ora giusta). */
  onRowStart(hour: Hour, first: boolean): void {
    if (first) for (const s of this.margins('primaOra')) if (s.hour === undefined || s.hour === hour) this.fire(s);
    for (const s of this.margins('ora')) if (s.hour === hour) this.fire(s);
  }

  /** Eventi della riga corrente in anteprima o di una riga appena fissata. */
  onEvents(events: readonly LaceEvent[]): void {
    const steps = this.margins('evento');
    if (steps.length === 0) return;
    for (const s of steps) {
      const kind = s.evento as LaceEventKind | undefined;
      if (!kind) continue;
      const hit = events.some((e) => e.k === kind && (!s.chi || eventSubject(e).includes(s.chi)));
      if (hit) this.fire(s);
    }
  }

  /** Il nome di Ada è appena stato appuntato (g12). */
  onNome(): void {
    for (const s of this.margins('nome')) this.fire(s);
  }

  /** Archivio: tutti i nomi confermati, o tutti gli strappi rammendati. */
  onArchive(what: 'nomi' | 'rammendo'): void {
    for (const s of this.margins(what === 'nomi' ? 'archivioNomi' : 'archivioRammendo')) this.fire(s);
  }

  /** Il giocatore ha toccato l'elemento: la sua pulsazione si spegne. */
  interacted(target: PulseTarget, thread?: ThreadId): void {
    this.steps.forEach((s, i) => {
      if (s.k !== 'pulsa' || s.target !== target) return;
      if (thread !== undefined && s.thread !== undefined && s.thread !== thread) return;
      this.pulseDone.add(i);
    });
  }

  /** Elementi che pulsano adesso (riga corrente `hour`). */
  pulses(hour: Hour, draftEmpty: boolean, needsNome: boolean): ActivePulse[] {
    const out: ActivePulse[] = [];
    this.steps.forEach((s, i) => {
      if (s.k !== 'pulsa' || s.hour !== hour || this.pulseDone.has(i)) return;
      const p = s as PulseStep;
      if (p.target === 'fissa' && draftEmpty) return;
      if (p.target === 'nome' && !needsNome) return;
      const a: ActivePulse = { target: p.target, hour: p.hour };
      if (p.thread !== undefined) a.thread = p.thread;
      out.push(a);
    });
    return out;
  }

  /** Pulsante della barra delle azioni che deve pulsare adesso (compatibilità). */
  pulse(hour: Hour, draftEmpty: boolean, needsNome: boolean): PulseTarget | null {
    const list = this.pulses(hour, draftEmpty, needsNome);
    return list[0]?.target ?? null;
  }

  /** Il passaggio "Appunta il tuo nome" va evidenziato dal tutorial? */
  hasStep(k: TutorialStep['k']): boolean {
    return this.steps.some((s) => s.k === k);
  }
}
