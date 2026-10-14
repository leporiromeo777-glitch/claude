/**
 * Web Worker del solver: risolve e genera fuori dal thread principale.
 * Messaggi: { id, kind: 'solve', req } → { id, ok: true, res } | { id, ok: false, error }
 *           { id, kind: 'generate', spec } → idem con GenResult.
 */
import type { SolveRequest } from '../core/types';
import { solve } from './solver';
import type { GenSpec } from './generator';
import { generate } from './generator';

interface WorkerScope {
  onmessage: ((e: { data: unknown }) => void) | null;
  postMessage(m: unknown): void;
}

type Msg = { id: number; kind: 'solve'; req: SolveRequest } | { id: number; kind: 'generate'; spec: GenSpec };

const scope = globalThis as unknown as WorkerScope;

scope.onmessage = (e: { data: unknown }): void => {
  const msg = e.data as Msg;
  try {
    const res = msg.kind === 'solve' ? solve(msg.req) : generate(msg.spec);
    scope.postMessage({ id: msg.id, ok: true, res });
  } catch (err) {
    scope.postMessage({ id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
