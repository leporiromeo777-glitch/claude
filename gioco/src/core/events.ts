/**
 * Bus di eventi tipizzato (ARCHITETTURA 5.1).
 *
 * - I listener sono chiamati nell'ordine di registrazione, su una copia della
 *   lista: chi si iscrive o si disiscrive durante un emit non cambia l'emit in corso.
 * - Un listener che lancia un'eccezione non blocca gli altri: l'errore va in console.
 * - Il bus tiene il registro degli ultimi eventi (500 per default) per il debug
 *   (`__GAME__.core.events(n)`).
 */
import type { EventBus, Unsub } from './types';

export interface BusLogEntry {
  /** Millisecondi da `performance.now()` (o dall'orologio iniettato). */
  t: number;
  k: string;
  p: unknown;
}

export interface DebugBus<M> extends EventBus<M> {
  /** Ultimi `n` eventi (tutti se omesso), dal più vecchio al più recente. */
  log(n?: number): BusLogEntry[];
  clearLog(): void;
  /** Numero di listener attivi (per un evento o in totale). */
  listenerCount(k?: keyof M): number;
}

export interface BusOptions {
  logSize?: number;
  now?: () => number;
  onError?: (err: unknown, event: string) => void;
}

export const BUS_LOG_SIZE = 500;

type AnyListener = (p: unknown) => void;

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function createBus<M>(opts: BusOptions = {}): DebugBus<M> {
  const logSize = Math.max(0, opts.logSize ?? BUS_LOG_SIZE);
  const now = opts.now ?? defaultNow;
  const onError =
    opts.onError ??
    ((err: unknown, event: string) => {
      console.error(`[bus] listener error on "${event}"`, err);
    });
  const listeners = new Map<keyof M, AnyListener[]>();
  // Registro circolare: niente riallocazioni a ogni evento.
  const ring: (BusLogEntry | undefined)[] = new Array<BusLogEntry | undefined>(logSize);
  let head = 0;
  let count = 0;

  function add<K extends keyof M>(k: K, fn: AnyListener): Unsub {
    const list = listeners.get(k);
    if (list) list.push(fn);
    else listeners.set(k, [fn]);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const cur = listeners.get(k);
      if (!cur) return;
      const i = cur.indexOf(fn);
      if (i >= 0) cur.splice(i, 1);
      if (cur.length === 0) listeners.delete(k);
    };
  }

  return {
    on(k, fn) {
      return add(k, fn as AnyListener);
    },
    once(k, fn) {
      const off = add(k, (p: unknown) => {
        off();
        (fn as AnyListener)(p);
      });
      return off;
    },
    emit(k, p) {
      if (logSize > 0) {
        ring[head] = { t: now(), k: String(k), p };
        head = (head + 1) % logSize;
        if (count < logSize) count++;
      }
      const list = listeners.get(k);
      if (!list || list.length === 0) return;
      for (const fn of list.slice()) {
        try {
          fn(p);
        } catch (err) {
          onError(err, String(k));
        }
      }
    },
    log(n) {
      const take = Math.max(0, Math.min(count, n ?? count));
      const out: BusLogEntry[] = [];
      for (let i = count - take; i < count; i++) {
        const idx = (head - count + i + logSize) % logSize;
        const e = ring[idx];
        if (e) out.push(e);
      }
      return out;
    },
    clearLog() {
      ring.fill(undefined);
      head = 0;
      count = 0;
    },
    listenerCount(k) {
      if (k !== undefined) return listeners.get(k)?.length ?? 0;
      let total = 0;
      for (const l of listeners.values()) total += l.length;
      return total;
    },
  };
}
