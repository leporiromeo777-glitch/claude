/**
 * Piccolo bus di eventi tipizzato. Gli altri sistemi si iscrivono con `on` e
 * ricevono una funzione per disiscriversi.
 */
import type { CellChange } from '../world/cells';

export interface GameEvents {
  /** Il giocatore ha saltato. */
  'player:jump': Record<string, never>;
  /** Atterraggio, con la velocità d'impatto (m/s). */
  'player:land': { speed: number; hard: boolean };
  /** Il Velo si apre o si chiude. */
  'velo:toggle': { open: boolean };
  /** Tasto E (interazione). */
  'player:interact': { z: number; theta: number; h: number };
  /** Cambio di stato delle particelle (matita/colore). */
  'cells:changed': CellChange;
  /** La Linea completa l'accensione (alba) o diventa brace (notte). */
  'sky:dawn': { hours: number };
  'sky:dusk': { hours: number };
  /** Camera libera attivata/disattivata. */
  'debug:freecam': { on: boolean };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(name: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(name);
    if (!set) this.handlers.set(name, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => this.off(name, fn);
  }

  once<K extends keyof E>(name: K, fn: Handler<E[K]>): () => void {
    const off = this.on(name, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof E>(name: K, fn: Handler<E[K]>): void {
    this.handlers.get(name)?.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) (fn as Handler<E[K]>)(payload);
  }
}
