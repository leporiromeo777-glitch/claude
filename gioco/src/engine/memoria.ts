/**
 * Memoria di Ada (GDD 3.11), calcolo puro a fine giornata.
 *
 * Per ogni personaggio presente nel merletto (sulla tela in almeno un'ora
 * della giornata): se a fine giornata ha il nome di Ada, memoria + 1 (massimo
 * 3), altrimenti memoria − 1 (minimo 0). Chi oggi non era nel merletto non
 * cambia. Il nome si diffonde come una voce (vedi `rules.ts`). Il pacchetto
 * della campagna può usare questa funzione o la propria.
 */
import type { CharacterId, LaceState, LevelDef } from '../core/types';

export const MEMORIA_MIN = 0;
export const MEMORIA_MAX = 3;

export function memoriaAfterDay(
  level: LevelDef,
  timeline: readonly LaceState[],
  memoria: Partial<Record<CharacterId, number>>,
  opts: { min?: number; max?: number } = {},
): Partial<Record<CharacterId, number>> {
  const min = opts.min ?? MEMORIA_MIN;
  const max = opts.max ?? MEMORIA_MAX;
  const out: Partial<Record<CharacterId, number>> = { ...memoria };
  const last = timeline[timeline.length - 1];
  if (!last) return out;
  const present = new Set<string>();
  for (const s of timeline) for (const t of s.pos) present.add(t);
  const remember = new Set(last.holders['nome'] ?? []);
  for (const t of level.threads) {
    if (t.kind === 'lino' || !present.has(t.id)) continue;
    const c = (t.character ?? t.id) as CharacterId;
    const cur = out[c];
    if (cur === undefined) continue;
    out[c] = remember.has(t.id) ? Math.min(max, cur + 1) : Math.max(min, cur - 1);
  }
  return out;
}
