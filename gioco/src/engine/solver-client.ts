/**
 * Client asincrono del solver (ARCHITETTURA 5.2).
 *
 * Nel browser ogni richiesta va a un Web Worker
 * (`new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' })`),
 * con il limite di stati da browser (60000) se la richiesta non ne indica uno.
 * Un `AbortSignal` annulla la richiesta: il worker si chiude e la Promise si
 * rifiuta con un errore 'AbortError'. Dove i Worker non esistono (Node, test) o
 * non partono, si ripiega sul percorso sincrono.
 */
import type { SolveRequest, SolveResult } from '../core/types';
import { solve } from './solver';
import type { GenResult, GenSpec } from './generator';
import { generate } from './generator';

const BROWSER_MAX_STATES = 60_000;
const MAX_IDLE = 2;

type Reply = { id: number; ok: true; res: unknown } | { id: number; ok: false; error: string };

interface WorkerLike {
  postMessage(m: unknown): void;
  terminate(): void;
  onmessage: ((e: MessageEvent) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

let nextId = 1;
const idle: WorkerLike[] = [];
let workersBroken = false;

function abortError(signal: AbortSignal): Error {
  const r: unknown = signal.reason;
  if (r instanceof Error) return r;
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}

function createWorker(): WorkerLike | null {
  if (workersBroken || typeof Worker === 'undefined') return null;
  try {
    return new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
  } catch {
    workersBroken = true;
    return null;
  }
}

function release(w: WorkerLike): void {
  w.onmessage = null;
  w.onerror = null;
  if (idle.length < MAX_IDLE) idle.push(w);
  else w.terminate();
}

function runSync<T>(fn: () => T, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    // Un giro del ciclo degli eventi, così il chiamante può ancora annullare.
    setTimeout(() => {
      if (signal?.aborted) {
        reject(abortError(signal));
        return;
      }
      try {
        resolve(fn());
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }, 0);
  });
}

function viaWorker<T>(payload: Record<string, unknown>, fallback: () => T, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  const w = idle.pop() ?? createWorker();
  if (!w) return runSync(fallback, signal);
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      w.terminate();
      reject(abortError(signal as AbortSignal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    w.onmessage = (e: MessageEvent): void => {
      const msg = e.data as Reply;
      if (settled || msg.id !== id) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      release(w);
      if (msg.ok) resolve(msg.res as T);
      else reject(new Error(msg.error));
    };
    w.onerror = (): void => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      w.terminate();
      workersBroken = true;
      // Il worker non parte (per esempio file non servito): percorso sincrono.
      runSync(fallback, signal).then(resolve, reject);
    };
    try {
      w.postMessage({ id, ...payload });
    } catch {
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      w.terminate();
      runSync(fallback, signal).then(resolve, reject);
    }
  });
}

/** Solver asincrono: Worker nel browser, sincrono altrove. Annullabile con `signal`. */
export function solveAsync(req: SolveRequest, signal?: AbortSignal): Promise<SolveResult> {
  const hasWorker = !workersBroken && typeof Worker !== 'undefined';
  const r: SolveRequest = hasWorker && req.maxStates === undefined ? { ...req, maxStates: BROWSER_MAX_STATES } : req;
  return viaWorker<SolveResult>({ kind: 'solve', req: r }, () => solve(r), signal);
}

/** Generatore asincrono (Merletto del giorno e libero): Worker nel browser, sincrono altrove. */
export function generateAsync(spec: GenSpec, signal?: AbortSignal): Promise<GenResult> {
  return viaWorker<GenResult>({ kind: 'generate', spec }, () => generate(spec), signal);
}
