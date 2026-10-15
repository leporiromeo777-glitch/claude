/**
 * Archivio dei flag narrativi: booleani, numeri e stringhe, con evento di
 * cambiamento. Un flag assente vale `undefined`.
 */
import { Emettitore } from './eventi';

export type ValoreFlag = boolean | number | string;

export interface CambioFlag {
  nome: string;
  prima: ValoreFlag | undefined;
  dopo: ValoreFlag | undefined;
}

export interface EventiFlag {
  cambio: CambioFlag;
}

/** Vero se il valore conta come «acceso»: definito e diverso da false, 0, "". */
export function valoreVero(v: ValoreFlag | undefined): boolean {
  return v !== undefined && v !== false && v !== 0 && v !== '';
}

function valoreValido(v: unknown): v is ValoreFlag {
  return typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
}

export class ArchivioFlag {
  readonly eventi = new Emettitore<EventiFlag>();
  private readonly valori = new Map<string, ValoreFlag>();

  get(nome: string): ValoreFlag | undefined {
    return this.valori.get(nome);
  }

  /** true se il flag esiste (qualunque valore, anche false). */
  esiste(nome: string): boolean {
    return this.valori.has(nome);
  }

  /** true se il flag è acceso (vedi `valoreVero`). */
  vero(nome: string): boolean {
    return valoreVero(this.valori.get(nome));
  }

  /** Imposta un flag (di default a `true`). Emette `cambio` solo se il valore cambia. */
  set(nome: string, valore: ValoreFlag = true): void {
    if (!nome) throw new Error('Nome di flag vuoto');
    if (!valoreValido(valore)) throw new Error(`Valore non valido per il flag «${nome}»: ${String(valore)}`);
    const prima = this.valori.get(nome);
    if (prima === valore) return;
    this.valori.set(nome, valore);
    this.eventi.emit('cambio', { nome, prima, dopo: valore });
  }

  /** Rimuove un flag. */
  rimuovi(nome: string): void {
    if (!this.valori.has(nome)) return;
    const prima = this.valori.get(nome);
    this.valori.delete(nome);
    this.eventi.emit('cambio', { nome, prima, dopo: undefined });
  }

  /**
   * Somma `delta` al flag numerico. Un flag assente o non numerico parte da 0
   * (`true` vale 1). Restituisce il nuovo valore.
   */
  incrementa(nome: string, delta = 1): number {
    const prima = this.valori.get(nome);
    const base = typeof prima === 'number' ? prima : prima === true ? 1 : 0;
    const dopo = base + delta;
    this.set(nome, dopo);
    return dopo;
  }

  /** Copia di tutti i flag. */
  tutti(): Record<string, ValoreFlag> {
    return Object.fromEntries(this.valori);
  }

  esporta(): Record<string, ValoreFlag> {
    return this.tutti();
  }

  /** Sostituisce tutti i flag (senza emettere eventi: è un ripristino). */
  importa(dati: Record<string, unknown>): void {
    this.valori.clear();
    for (const [nome, valore] of Object.entries(dati)) {
      if (valoreValido(valore)) this.valori.set(nome, valore);
    }
  }
}
