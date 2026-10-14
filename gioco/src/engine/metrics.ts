/**
 * Eleganza del merletto (GDD 3.14). Contano gli incroci del giocatore: quelli
 * forzati (filo nero, autotessitura) non si scrivono nello spartito e non
 * costano matassa, quindi restano fuori anche da qui.
 *
 * - incroci: incroci del giocatore;
 * - quiete: righe senza incroci del giocatore;
 * - simmetria: almeno un incrocio, e ogni incrocio nella coppia i alla riga r
 *   ha il corrispondente nella coppia W−2−i alla stessa riga (il verso non conta);
 * - filo d'oro: incroci uguali al minimo calcolato e nessun fantasma usato.
 */
import type { Crossing, LaceMetrics, LevelDef, RowMoves } from '../core/types';

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

export function metrics(level: LevelDef, rows: RowMoves[], minIncroci: number | null, fantasmaUsed: boolean): LaceMetrics {
  let incroci = 0;
  let quiete = 0;
  for (const r of rows) {
    const n = playerCrossings(r).length;
    incroci += n;
    if (n === 0) quiete++;
  }
  const simmetria = isSymmetric(level.columns.length, rows);
  const filoDOro = minIncroci !== null && incroci === minIncroci && !fantasmaUsed;
  return { incroci, minIncroci, quiete, simmetria, filoDOro };
}
