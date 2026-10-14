/**
 * Tutorial del livello (ARCHITETTURA 5.3, GDD 9): guida senza testo.
 * - mano: una mano fantasma ripete il trascinamento di quella riga finché il
 *   giocatore non fa un incrocio in quella riga;
 * - margine: una nota di Clotilde compare a mano sul bordo del merletto quando
 *   succede l'evento (versoSbagliato = un incrocio in cui una lettera passerebbe
 *   solo con il verso opposto; rifiuto; primaOra; spillo);
 * - pulsa: un pulsante pulsa ("Fissa l'ora" quando c'è qualcosa da fissare).
 */
import type { Hour, TutorialStep, Violation } from '../core/types';
import type { PulseTarget } from './ui/actionbar';

/** Violazioni che il tutorial chiama 'rifiuto' (stranezze dei personaggi). */
const REFUSALS: ReadonlySet<Violation['code']> = new Set<Violation['code']>(['rifiuto', 'corre', 'faro']);

export interface TutorialHooks {
  /** Mostra la nota a margine (una volta per notte). */
  margin(textKey: string): void;
}

export class Tutorial {
  private readonly handDone = new Set<Hour>();
  private readonly marginDone = new Set<number>();

  constructor(
    private readonly steps: readonly TutorialStep[],
    private readonly hooks: TutorialHooks,
  ) {}

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

  private marginFor(when: 'versoSbagliato' | 'rifiuto' | 'primaOra' | 'spillo', hour: Hour): void {
    this.steps.forEach((s, i) => {
      if (s.k !== 'margine' || s.when !== when || this.marginDone.has(i)) return;
      if (s.hour !== undefined && s.hour !== hour) return;
      this.marginDone.add(i);
      this.hooks.margin(s.textKey);
    });
  }

  /** Un incrocio accettato nella riga `hour`; `wrongSide` = la lettera passerebbe solo con l'altro verso. */
  onCross(hour: Hour, wrongSide: boolean): void {
    this.handDone.add(hour);
    if (wrongSide) this.marginFor('versoSbagliato', hour);
  }

  /**
   * Una riga o un incrocio rifiutato. Per GDD 3.4 sono «righe rifiutate» tutte le
   * violazioni di una stranezza: Marta che non passa sotto (`rifiuto`), Gino che
   * non sta fermo (`corre`), Zeno che non lascia il Faro (`faro`). La nota di g01
   * («c'è chi non passa sotto, e chi non sta fermo») parte con ognuna.
   */
  onViolation(v: Violation, hour: Hour): void {
    if (REFUSALS.has(v.code)) this.marginFor('rifiuto', hour);
    if (v.code === 'spillo') this.marginFor('spillo', hour);
  }

  /** Inizio di una riga (prima riga della notte: primaOra). */
  onRowStart(hour: Hour, first: boolean): void {
    if (first) this.marginFor('primaOra', hour);
  }

  /** Pulsante che deve pulsare adesso. */
  pulse(hour: Hour, draftEmpty: boolean, needsNome: boolean): PulseTarget {
    for (const s of this.steps) {
      if (s.k !== 'pulsa' || s.hour !== hour) continue;
      if (s.target === 'fissa') {
        if (!draftEmpty) return 'fissa';
        continue;
      }
      if (s.target === 'nome') {
        if (needsNome) return 'nome';
        continue;
      }
      return s.target;
    }
    return null;
  }

  /** Il passaggio "Appunta il tuo nome" va evidenziato dal tutorial? */
  hasStep(k: TutorialStep['k']): boolean {
    return this.steps.some((s) => s.k === k);
  }
}
