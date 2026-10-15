/**
 * Inventario semplice: id oggetto → quantità intera positiva.
 */
import { Emettitore } from './eventi';

export interface CambioOggetto {
  id: string;
  prima: number;
  dopo: number;
}

export interface EventiInventario {
  cambio: CambioOggetto;
}

export class Inventario {
  readonly eventi = new Emettitore<EventiInventario>();
  private readonly oggetti = new Map<string, number>();

  quantita(id: string): number {
    return this.oggetti.get(id) ?? 0;
  }

  ha(id: string, n = 1): boolean {
    return this.quantita(id) >= n;
  }

  aggiungi(id: string, n = 1): void {
    if (!id) throw new Error('Id di oggetto vuoto');
    if (!Number.isInteger(n) || n <= 0) throw new Error(`Quantità non valida: ${n}`);
    const prima = this.quantita(id);
    this.oggetti.set(id, prima + n);
    this.eventi.emit('cambio', { id, prima, dopo: prima + n });
  }

  /** Toglie `n` pezzi; restituisce false (senza cambiare nulla) se non bastano. */
  rimuovi(id: string, n = 1): boolean {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`Quantità non valida: ${n}`);
    const prima = this.quantita(id);
    if (prima < n) return false;
    const dopo = prima - n;
    if (dopo === 0) this.oggetti.delete(id);
    else this.oggetti.set(id, dopo);
    this.eventi.emit('cambio', { id, prima, dopo });
    return true;
  }

  /** Oggetti posseduti, nell'ordine in cui sono arrivati. */
  elenco(): { id: string; quantita: number }[] {
    return [...this.oggetti].map(([id, quantita]) => ({ id, quantita }));
  }

  esporta(): Record<string, number> {
    return Object.fromEntries(this.oggetti);
  }

  importa(dati: Record<string, unknown>): void {
    this.oggetti.clear();
    for (const [id, n] of Object.entries(dati)) {
      if (typeof n === 'number' && Number.isInteger(n) && n > 0) this.oggetti.set(id, n);
    }
  }
}
