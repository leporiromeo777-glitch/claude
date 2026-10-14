/**
 * Eleganza del merletto (GDD 3.14). Contano gli incroci del giocatore: quelli
 * forzati (filo nero, autotessitura) non si scrivono nello spartito e non
 * costano matassa, quindi restano fuori anche da qui.
 *
 * - incroci: incroci del giocatore;
 * - quiete: righe senza incroci del giocatore;
 * - simmetria: almeno un incrocio, e ogni incrocio nella coppia i alla riga r
 *   ha il corrispondente nella coppia W−2−i alla stessa riga (il verso non conta);
 * - filo d'oro (revisione 1, C15): il minimo della notte è almeno
 *   `balance.oro.minIncroci` (3 se manca), gli incroci sono uguali al minimo e
 *   nessun fantasma è stato usato. Una notte che si chiude con 0 incroci non è
 *   un'impresa: niente filo d'oro.
 */
import type { BalanceDef, Crossing, LaceMetrics, LevelDef, RowMoves } from '../core/types';

/** Minimo della notte sotto il quale non c'è filo d'oro (C15, `balance.oro.minIncroci`): valore predefinito. */
export const ORO_MIN_INCROCI = 3;

function playerCrossings(r: RowMoves): Crossing[] {
  return r.crossings.filter((c) => !c.forced);
}

export function isSymmetric(W: number, rows: readonly RowMoves[]): boolean {
  let any = false;
  for (const r of rows) {
    const pairs = new Set(playerCrossings(r).map((c) => c.pair));
    for (const p of pairs) {
      any = true;
      if (!pairs.has(W - 2 - p)) return false;
    }
  }
  return any;
}

/**
 * Eleganza di un merletto. `oro` è `balance.oro` (C15): senza, il minimo
 * richiesto per il filo d'oro è `ORO_MIN_INCROCI`.
 */
export function metrics(level: LevelDef, rows: RowMoves[], minIncroci: number | null, fantasmaUsed: boolean, oro?: BalanceDef['oro'] | null): LaceMetrics {
  let incroci = 0;
  let quiete = 0;
  for (const r of rows) {
    const n = playerCrossings(r).length;
    incroci += n;
    if (n === 0) quiete++;
  }
  const simmetria = isSymmetric(level.columns.length, rows);
  const oroMin = typeof oro?.minIncroci === 'number' && Number.isFinite(oro.minIncroci) ? oro.minIncroci : ORO_MIN_INCROCI;
  const filoDOro = !fantasmaUsed && minIncroci !== null && minIncroci >= oroMin && incroci === minIncroci;
  return { incroci, minIncroci, quiete, simmetria, filoDOro };
}
