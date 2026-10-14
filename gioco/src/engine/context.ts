/**
 * Contesto di una notte (`RunContext`): stranezze e rancori attivi dopo i flag
 * di storia, nome di Ada, occasioni.
 *
 * La riconciliazione (flag `riconciliate`, GDD 5.1 e 3.6) toglie `martaNoSotto`,
 * `teresaLegge` e il rancore fra Teresa e Marta. `pieroTrabocca` resta.
 *
 * `opts.balance` porta i parametri bilanciabili del motore (GDD 3.13,
 * `balance.json`): soglia del trabocco del pozzo e durata del nodo di rancore.
 * Senza, valgono i valori del GDD (3 segreti, 1 riga).
 */
import type { BalanceDef, FlagId, FlagValue, LevelDef, OccasionDef, QuirkId, RunContext, ThreadDef, ThreadId } from '../core/types';

/** Un flag "sì": true, 1, o una stringa affermativa ('si', 'sì', 'true', 'yes'). */
export function flagOn(v: FlagValue | undefined): boolean {
  if (v === true) return true;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['si', 'sì', 'true', 'yes', 'y', '1'].includes(v.trim().toLowerCase());
  return false;
}

const RICONCILIATE_TOGLIE: readonly QuirkId[] = ['martaNoSotto', 'teresaLegge'];

function characterOfThread(level: LevelDef, id: ThreadId): string {
  const t: ThreadDef | undefined = level.threads.find((x) => x.id === id);
  if (!t) return id;
  return t.character ?? (t.kind === 'lino' ? '' : t.id);
}

export function createContext(
  level: LevelDef,
  flags: Record<FlagId, FlagValue>,
  opts?: { nomeOn?: ThreadId | null; occasions?: OccasionDef[]; balance?: Partial<Pick<BalanceDef, 'traboccoSoglia' | 'nodoRighe'>> | null },
): RunContext {
  const riconciliate = flagOn(flags['riconciliate']);
  const quirks = level.quirks.filter((q) => !(riconciliate && RICONCILIATE_TOGLIE.includes(q)));
  const rancor = (level.rancor ?? []).filter((pair) => {
    if (!riconciliate) return true;
    const a = characterOfThread(level, pair[0]);
    const b = characterOfThread(level, pair[1]);
    return !((a === 'teresa' && b === 'marta') || (a === 'marta' && b === 'teresa'));
  });
  const occasions: OccasionDef[] = [...(level.autoweave?.presetOccasions ?? []), ...(opts?.occasions ?? [])].map((o) => ({ ...o }));
  const ctx: RunContext = {
    flags: { ...flags },
    quirks: [...quirks],
    rules: [...level.rules],
    rancor: rancor.map((p) => [p[0], p[1]] as [ThreadId, ThreadId]),
    nomeOn: opts?.nomeOn ?? null,
    occasions,
  };
  const b = opts?.balance;
  if (b && typeof b.traboccoSoglia === 'number' && b.traboccoSoglia >= 1) ctx.traboccoSoglia = Math.floor(b.traboccoSoglia);
  if (b && typeof b.nodoRighe === 'number' && b.nodoRighe >= 1) ctx.nodoRighe = Math.floor(b.nodoRighe);
  return ctx;
}
