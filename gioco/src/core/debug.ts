/**
 * API di debug `window.__GAME__` (ARCHITETTURA 15.1).
 *
 * Attiva in sviluppo, con `?debug=1` nell'URL (solo sul web) e nelle build di
 * test (`VITE_E2E=1`); spenta nelle build per gli store. Ogni pacchetto registra
 * il proprio namespace con `services.debug.register(ns, api)`. I valori restituiti
 * sono resi serializzabili in JSON (anche quelli dentro le Promise).
 *
 *   window.__GAME__.ready         Promise risolta quando l'avvio è finito
 *   window.__GAME__.namespaces()  elenco dei namespace registrati
 *   window.__GAME__.<ns>.<fn>()   funzioni dei pacchetti
 */
import type { DebugRegistry } from './types';

export type DebugFn = (...args: never[]) => unknown;
export interface DebugTree {
  [k: string]: DebugFn | DebugTree;
}

export interface GameDebugRoot {
  ready: Promise<void>;
  namespaces(): string[];
  [ns: string]: unknown;
}

declare global {
  interface Window {
    __GAME__?: GameDebugRoot;
  }
}

export interface CoreDebugRegistry extends DebugRegistry {
  enabled: boolean;
  /** Registra un albero di funzioni (per esempio `core.time.step`). */
  registerTree(ns: string, tree: DebugTree): void;
  namespaces(): string[];
  /** L'albero già avvolto (per i test). */
  get(ns: string): DebugTree | undefined;
  ready: Promise<void>;
  resolveReady(): void;
  rejectReady(err: unknown): void;
}

export function isDebugEnabled(opts: { dev: boolean; e2e: boolean; search: string; native: boolean }): boolean {
  if (opts.dev || opts.e2e) return true;
  if (opts.native) return false;
  try {
    return new URLSearchParams(opts.search).get('debug') === '1';
  } catch {
    return false;
  }
}

/** Copia serializzabile in JSON (Map → oggetto, Set → array, cicli e funzioni tolti). */
export function toSerializable(v: unknown): unknown {
  const seen = new WeakSet<object>();
  const walk = (x: unknown, depth: number): unknown => {
    if (x === null || x === undefined) return x ?? null;
    const t = typeof x;
    if (t === 'number') return Number.isFinite(x) ? x : null;
    if (t === 'string' || t === 'boolean') return x;
    if (t === 'bigint') return String(x);
    if (t === 'function' || t === 'symbol') return undefined;
    if (depth > 40) return null;
    const o = x as object;
    if (seen.has(o)) return null;
    seen.add(o);
    try {
      if (Array.isArray(o)) return o.map((e) => walk(e, depth + 1) ?? null);
      if (o instanceof Map) {
        const out: Record<string, unknown> = {};
        for (const [k, val] of o) out[String(k)] = walk(val, depth + 1);
        return out;
      }
      if (o instanceof Set) return [...o].map((e) => walk(e, depth + 1) ?? null);
      if (typeof (o as { toJSON?: unknown }).toJSON === 'function') return walk((o as { toJSON(): unknown }).toJSON(), depth + 1);
      if (ArrayBuffer.isView(o)) return Array.from(o as unknown as ArrayLike<number>);
      if (typeof Node !== 'undefined' && o instanceof Node) return null;
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(o)) {
        const w = walk(val, depth + 1);
        if (w !== undefined) out[k] = w;
      }
      return out;
    } finally {
      seen.delete(o);
    }
  };
  return walk(v, 0);
}

function wrapFn(fn: DebugFn): DebugFn {
  return ((...args: never[]) => {
    const r = fn(...args);
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      return (r as Promise<unknown>).then((x) => toSerializable(x));
    }
    return toSerializable(r);
  }) as DebugFn;
}

function wrapTree(tree: DebugTree): DebugTree {
  const out: DebugTree = {};
  for (const [k, v] of Object.entries(tree)) out[k] = typeof v === 'function' ? wrapFn(v) : wrapTree(v);
  return out;
}

export function createDebugRegistry(opts: { enabled: boolean; win?: Window | null }): CoreDebugRegistry {
  const trees = new Map<string, DebugTree>();
  let resolveReady: () => void = () => undefined;
  let rejectReady: (err: unknown) => void = () => undefined;
  const ready = new Promise<void>((res, rej) => {
    resolveReady = res;
    rejectReady = rej;
  });
  // Nessuna "unhandled rejection" se nessuno aspetta ready.
  ready.catch(() => undefined);
  const win = opts.win ?? null;

  let root: GameDebugRoot | null = null;
  if (opts.enabled && win) {
    root = { ready, namespaces: () => [...trees.keys()].sort() };
    win.__GAME__ = root;
  }

  const registry: CoreDebugRegistry = {
    enabled: opts.enabled,
    register(ns, api) {
      registry.registerTree(ns, api as DebugTree);
    },
    registerTree(ns, tree) {
      if (!opts.enabled) return;
      if (ns === 'ready' || ns === 'namespaces') throw new Error(`debug: reserved namespace "${ns}"`);
      const wrapped = wrapTree(tree);
      const prev = trees.get(ns);
      if (prev) console.warn(`[debug] namespace "${ns}" registered again: functions merged`);
      const merged = prev ? { ...prev, ...wrapped } : wrapped;
      trees.set(ns, merged);
      if (root) root[ns] = merged;
    },
    namespaces: () => [...trees.keys()].sort(),
    get: (ns) => trees.get(ns),
    ready,
    resolveReady: () => resolveReady(),
    rejectReady: (err) => rejectReady(err),
  };
  return registry;
}
