/**
 * Regia della musica (logica pura): decide se un tema può entrare adesso.
 * - un tema alla volta;
 * - dopo la fine di un tema, un po' di silenzio prima del successivo;
 * - lo stesso tema non si ripete a breve;
 * - un momento più importante può interrompere (con dissolvenza) uno meno importante.
 */
import type { TemaMusicale } from '../tipi';

/** Importanza dei temi: i «primi» momenti battono l'alba. */
export const PRIORITA_TEMI: Readonly<Record<TemaMusicale, number>> = {
  alba: 1,
  'notte-fade': 2,
  'primo-volo': 3,
  'primo-rilievo': 3,
};

export type DecisioneMusica =
  | { esito: 'suona' }
  | { esito: 'interrompi-e-suona'; interrotto: TemaMusicale }
  | { esito: 'rifiuta'; motivo: 'in-corso' | 'troppo-presto' | 'ripetuto' };

export class RegiaMusica {
  private corrente: { tema: TemaMusicale; fine: number } | null = null;
  private fineUltimo = -Infinity;
  private readonly ultimoPerTema = new Map<TemaMusicale, number>();

  constructor(
    /** Silenzio minimo fra due temi (s). */
    readonly pausaMinima = 20,
    /** Intervallo minimo prima di ripetere lo stesso tema (s). */
    readonly ripetizioneMinima = 240,
  ) {}

  /** Il tema in corso all'istante `ora` (tempo audio, s), se c'è. */
  inCorso(ora: number): TemaMusicale | null {
    if (this.corrente && ora < this.corrente.fine) return this.corrente.tema;
    return null;
  }

  /** Valuta una richiesta senza cambiare lo stato. `forza` salta pause e ripetizioni. */
  valuta(tema: TemaMusicale, ora: number, forza = false): DecisioneMusica {
    const attuale = this.inCorso(ora);
    if (attuale) {
      if (forza || PRIORITA_TEMI[tema] > PRIORITA_TEMI[attuale]) return { esito: 'interrompi-e-suona', interrotto: attuale };
      return { esito: 'rifiuta', motivo: 'in-corso' };
    }
    if (forza) return { esito: 'suona' };
    const ultimo = this.ultimoPerTema.get(tema);
    if (ultimo !== undefined && ora - ultimo < this.ripetizioneMinima) return { esito: 'rifiuta', motivo: 'ripetuto' };
    if (ora - this.fineUltimo < this.pausaMinima) return { esito: 'rifiuta', motivo: 'troppo-presto' };
    return { esito: 'suona' };
  }

  /** Registra l'inizio di un tema di durata `durata`. */
  avvia(tema: TemaMusicale, ora: number, durata: number): void {
    this.corrente = { tema, fine: ora + durata };
    this.fineUltimo = ora + durata;
    this.ultimoPerTema.set(tema, ora);
  }

  /** Registra l'interruzione del tema corrente all'istante `ora`. */
  ferma(ora: number): void {
    if (this.corrente && ora < this.corrente.fine) {
      this.corrente = null;
      this.fineUltimo = ora;
    }
  }
}
