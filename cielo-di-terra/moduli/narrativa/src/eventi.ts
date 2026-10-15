/**
 * Emettitore di eventi tipizzato, minimo e senza dipendenze.
 *
 * `M` è la mappa nome-evento → tipo del dato. Ogni `on` restituisce la
 * funzione per staccare l'ascoltatore. Se un ascoltatore lancia un'eccezione,
 * gli altri vengono comunque chiamati e la prima eccezione viene rilanciata
 * alla fine: così lo stato narrativo non resta a metà.
 */
export type Ascoltatore<T> = (dato: T) => void;

export type AscoltatoreQualsiasi<M> = <K extends keyof M>(tipo: K, dato: M[K]) => void;

export class Emettitore<M extends object> {
  private readonly ascoltatori = new Map<keyof M, Set<Ascoltatore<never>>>();
  private readonly universali = new Set<AscoltatoreQualsiasi<M>>();

  /** Registra un ascoltatore; restituisce la funzione che lo rimuove. */
  on<K extends keyof M>(tipo: K, fn: Ascoltatore<M[K]>): () => void {
    let insieme = this.ascoltatori.get(tipo);
    if (!insieme) {
      insieme = new Set();
      this.ascoltatori.set(tipo, insieme);
    }
    insieme.add(fn as Ascoltatore<never>);
    return () => this.off(tipo, fn);
  }

  /** Come `on`, ma l'ascoltatore viene chiamato una volta sola. */
  once<K extends keyof M>(tipo: K, fn: Ascoltatore<M[K]>): () => void {
    const stacca = this.on(tipo, (dato) => {
      stacca();
      fn(dato);
    });
    return stacca;
  }

  off<K extends keyof M>(tipo: K, fn: Ascoltatore<M[K]>): void {
    this.ascoltatori.get(tipo)?.delete(fn as Ascoltatore<never>);
  }

  /** Ascolta tutti gli eventi (utile per registri e debug). */
  onQualsiasi(fn: AscoltatoreQualsiasi<M>): () => void {
    this.universali.add(fn);
    return () => {
      this.universali.delete(fn);
    };
  }

  emit<K extends keyof M>(tipo: K, dato: M[K]): void {
    let primoErrore: unknown = undefined;
    let errore = false;
    const insieme = this.ascoltatori.get(tipo);
    if (insieme) {
      for (const fn of [...insieme]) {
        try {
          (fn as Ascoltatore<M[K]>)(dato);
        } catch (e) {
          if (!errore) {
            errore = true;
            primoErrore = e;
          }
        }
      }
    }
    for (const fn of [...this.universali]) {
      try {
        fn(tipo, dato);
      } catch (e) {
        if (!errore) {
          errore = true;
          primoErrore = e;
        }
      }
    }
    if (errore) throw primoErrore;
  }

  /** Rimuove tutti gli ascoltatori. */
  svuota(): void {
    this.ascoltatori.clear();
    this.universali.clear();
  }
}
