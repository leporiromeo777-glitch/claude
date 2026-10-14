/**
 * Progressione e sblocchi (GDD 3.14, 7): record di eleganza, fili d'oro, fusi intagliati,
 * modalità sbloccate. Si scrive tutto in `SaveData.records`, `stats` e `unlocks`.
 *
 * - g07 chiusa → Merletto del giorno (`unlocks.daily`);
 * - g08 chiusa → Merletto libero e Ripassa (`unlocks.libero`);
 * - g16 chiusa → Gradi del Merletto libero (`unlocks.gradi`);
 * - fili d'oro 3, 8, 15, 22 → fusi intagliati `stile_1` … `stile_4` (gli altri due stili
 *   sono del Merletto del giorno);
 * - primo finale (non il falso) → i quattro fusi dei fili d'oro anche senza fili d'oro
 *   ("fusi intagliati extra"), epiloghi nel Telaio, spartito dell'intera partita;
 * - finale vero → Tovaglia (`unlocks.tovaglia`) e campana intonata nel titolo.
 * Un filo d'oro conta una volta per livello (il primo merletto col minimo).
 */
import type { LaceMetrics, LaceRecord, LevelId, SaveData, Unlocks } from '../core/types';

export const DAY_UNLOCKS: Readonly<Record<string, 'daily' | 'libero' | 'gradi'>> = { g07: 'daily', g08: 'libero', g16: 'gradi' };
export const GOLD_COSMETICS: readonly { at: number; id: string }[] = [
  { at: 3, id: 'stile_1' },
  { at: 8, id: 'stile_2' },
  { at: 15, id: 'stile_3' },
  { at: 22, id: 'stile_4' },
];

export type RecordField = 'incroci' | 'quiete' | 'simmetria' | 'filoDOro';

/** Nuovo record di un livello dopo un merletto finito. */
export function updateRecord(prev: LaceRecord | undefined | null, m: LaceMetrics, spartito: string): { after: LaceRecord; improved: RecordField[] } {
  const improved: RecordField[] = [];
  const after: LaceRecord = prev
    ? { minIncroci: prev.minIncroci, maxQuiete: prev.maxQuiete, simmetria: prev.simmetria, filoDOro: prev.filoDOro }
    : { minIncroci: null, maxQuiete: null, simmetria: false, filoDOro: false };
  if (prev?.bestSpartito) after.bestSpartito = prev.bestSpartito;
  if (after.minIncroci === null || m.incroci < after.minIncroci) {
    if (after.minIncroci !== null) improved.push('incroci');
    after.minIncroci = m.incroci;
    if (spartito) after.bestSpartito = spartito;
  } else if (!after.bestSpartito && spartito) after.bestSpartito = spartito;
  if (after.maxQuiete === null || m.quiete > after.maxQuiete) {
    if (after.maxQuiete !== null) improved.push('quiete');
    after.maxQuiete = m.quiete;
  }
  if (m.simmetria && !after.simmetria) {
    after.simmetria = true;
    improved.push('simmetria');
  }
  if (m.filoDOro && !after.filoDOro) {
    after.filoDOro = true;
    improved.push('filoDOro');
  }
  return { after, improved };
}

export function goldCount(records: Record<LevelId, LaceRecord>): number {
  return Object.values(records).filter((r) => r?.filoDOro).length;
}

function addCosmetic(u: Unlocks, id: string, out: string[]): void {
  if (!u.cosmetics.includes(id)) {
    u.cosmetics.push(id);
    out.push(`cosmetic:${id}`);
  }
}

/** Fusi intagliati raggiunti con i fili d'oro. Restituisce gli sblocchi nuovi. */
export function goldUnlocks(u: Unlocks, gold: number): string[] {
  const out: string[] = [];
  for (const g of GOLD_COSMETICS) if (gold >= g.at) addCosmetic(u, g.id, out);
  return out;
}

/** Sblocchi di fine giornata (GDD 7). */
export function dayUnlocks(u: Unlocks, levelId: LevelId): string[] {
  const k = DAY_UNLOCKS[levelId];
  if (!k || u[k]) return [];
  u[k] = true;
  return [k];
}

/** Sblocchi di un finale visto. */
export function endingUnlocks(u: Unlocks, ending: string, counts: boolean): string[] {
  const out: string[] = [];
  if (!counts) return out;
  for (const g of GOLD_COSMETICS) addCosmetic(u, g.id, out);
  if (ending === 'aperto' && !u.tovaglia) {
    u.tovaglia = true;
    out.push('tovaglia');
  }
  return out;
}

/** Registra un merletto finito: record, notti, fili d'oro e fusi. */
export function recordNight(d: Pick<SaveData, 'records' | 'stats' | 'unlocks'>, levelId: LevelId, m: LaceMetrics, spartito: string): { before: LaceRecord | null; after: LaceRecord; improved: RecordField[]; goldThread: boolean; unlocked: string[] } {
  const before = d.records[levelId] ? { ...d.records[levelId] } : null;
  const { after, improved } = updateRecord(before, m, spartito);
  d.records[levelId] = after;
  d.stats.nights += 1;
  const goldThread = improved.includes('filoDOro') || (!before && after.filoDOro);
  d.stats.goldThreads = goldCount(d.records);
  const unlocked = goldUnlocks(d.unlocks, d.stats.goldThreads);
  return { before, after, improved: before ? improved : improved.filter((x) => x !== 'incroci' && x !== 'quiete'), goldThread, unlocked };
}

/** Tutto sbloccato (debug). */
export function unlockEverything(u: Unlocks): void {
  u.daily = true;
  u.libero = true;
  u.gradi = true;
  u.tovaglia = true;
  for (const g of GOLD_COSMETICS) if (!u.cosmetics.includes(g.id)) u.cosmetics.push(g.id);
}
