/**
 * Emettitore di eventi tipizzato, senza dipendenze.
 *
 * `E` è una mappa nome-evento → tipo del dato. Gli eventi senza dato usano `void`:
 *   class X extends Emettitore<{ chiudi: void; scelta: number }> {}
 *   x.on('scelta', (i) => …);   // i: number
 */
export type Ascoltatore<T> = (dato: T) => void;

/** Argomenti di `emit`: nessun argomento per gli eventi `void`. */
export type ArgomentiEvento<T> = [T] extends [void] ? [] : [T];

export class Emettitore<E extends object> {
  private readonly ascoltatori = new Map<keyof E, Set<Ascoltatore<never>>>();

  /** Registra un ascoltatore; restituisce la funzione che lo rimuove. */
  on<K extends keyof E>(evento: K, fn: Ascoltatore<E[K]>): () => void {
    let insieme = this.ascoltatori.get(evento);
    if (!insieme) {
      insieme = new Set();
      this.ascoltatori.set(evento, insieme);
    }
    insieme.add(fn as Ascoltatore<never>);
    return () => this.off(evento, fn);
  }

  /** Come `on`, ma l'ascoltatore si rimuove dopo la prima chiamata. */
  once<K extends keyof E>(evento: K, fn: Ascoltatore<E[K]>): () => void {
    const togli = this.on(evento, (dato) => {
      togli();
      fn(dato);
    });
    return togli;
  }

  off<K extends keyof E>(evento: K, fn: Ascoltatore<E[K]>): void {
    this.ascoltatori.get(evento)?.delete(fn as Ascoltatore<never>);
  }

  /** Rimuove tutti gli ascoltatori (di un evento o di tutti). */
  offAll(evento?: keyof E): void {
    if (evento === undefined) this.ascoltatori.clear();
    else this.ascoltatori.delete(evento);
  }

  protected emit<K extends keyof E>(evento: K, ...args: ArgomentiEvento<E[K]>): void {
    this.emetti(evento, args[0]);
  }

  /** Variante non tipizzata di `emit`, per le classi generiche che non possono risolvere `E[K]`. */
  protected emetti(evento: keyof E, dato?: unknown): void {
    const insieme = this.ascoltatori.get(evento);
    if (!insieme) return;
    for (const fn of [...insieme]) {
      try {
        (fn as Ascoltatore<unknown>)(dato);
      } catch (err) {
        // Un ascoltatore che fallisce non deve bloccare l'interfaccia.
        console.error(`[ui] errore nell'ascoltatore di «${String(evento)}»`, err);
      }
    }
  }
}
