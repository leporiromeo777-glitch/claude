/**
 * Il nome di Ada e la memoria (GDD 3.11).
 *
 * - All'inizio di g12 (la prima giornata con la regola `nome`) la memoria è 3 per tutti
 *   gli otto del cast, tranne Lunardi (1, è appena arrivato): valori da balance.json.
 * - A fine giornata, solo nelle giornate con la regola `nome`: chi era nel merletto e ha
 *   il nome sale di 1 (massimo 3), chi era nel merletto senza il nome scende di 1
 *   (minimo 0); chi oggi non era nel merletto non cambia. g23 e i finali non hanno la
 *   regola: il finale vero guarda la memoria di fine g22.
 * - Memoria 0 = ha dimenticato Ada: bigliettini senza firma, Ada di legno grezzo nelle
 *   vignette con lui, battute con la variante `dimentica`.
 */
import type { BalanceDef, CampaignState, CharacterId, LaceState, LevelDef } from '../core/types';
import { CAST_IDS } from '../core/ids';
import { memoriaAfterDay } from '../engine/index';
import { MEMORIA_DEFAULTS, memoriaOf } from './story';
import type { MemoriaChange } from './types';

export type MemoriaMap = Partial<Record<CharacterId, number>>;

/** La giornata usa il nome di Ada (si chiede dove appuntarlo e la memoria cambia). */
export function usesNome(level: Pick<LevelDef, 'rules'>): boolean {
  return level.rules.includes('nome');
}

/** Memoria iniziale (inizio di g12): tutti a `start`, Lunardi a `startLunardi`. */
export function initialMemoria(m: BalanceDef['memoria'] = MEMORIA_DEFAULTS): MemoriaMap {
  const out: MemoriaMap = {};
  for (const c of CAST_IDS) out[c] = c === 'lunardi' ? m.startLunardi : m.start;
  return out;
}

/** La memoria è in gioco (dalla prima giornata col nome in poi). */
export function memoriaInPlay(s: Pick<CampaignState, 'memoria'>): boolean {
  return Object.keys(s.memoria ?? {}).length > 0;
}

/** Inizializza la memoria se la giornata usa il nome e non è ancora in gioco. true se l'ha fatto. */
export function ensureMemoria(s: Pick<CampaignState, 'memoria'>, level: Pick<LevelDef, 'rules'>, m: BalanceDef['memoria'] = MEMORIA_DEFAULTS): boolean {
  if (!usesNome(level) || memoriaInPlay(s)) return false;
  s.memoria = initialMemoria(m);
  return true;
}

/**
 * Memoria dopo la giornata (GDD 3.11). Nelle giornate senza la regola `nome` non cambia.
 * Restituisce la nuova memoria e i cambiamenti, nell'ordine del cast.
 */
export function memoriaAfterNight(
  level: LevelDef,
  timeline: readonly LaceState[],
  memoria: MemoriaMap,
  m: BalanceDef['memoria'] = MEMORIA_DEFAULTS,
): { memoria: MemoriaMap; changes: MemoriaChange[] } {
  if (!usesNome(level)) return { memoria: { ...memoria }, changes: [] };
  const next = memoriaAfterDay(level, timeline, memoria, { min: m.min, max: m.max });
  const changes: MemoriaChange[] = [];
  for (const c of CAST_IDS) {
    const before = memoria[c];
    const after = next[c];
    if (typeof before === 'number' && typeof after === 'number' && before !== after) changes.push({ character: c, before, after });
  }
  return { memoria: next, changes };
}

/** Il personaggio ha dimenticato Ada (memoria in gioco e a zero). */
export function hasForgotten(s: Pick<CampaignState, 'memoria'>, c: CharacterId, m: BalanceDef['memoria'] = MEMORIA_DEFAULTS): boolean {
  if (typeof s.memoria?.[c] !== 'number') return false;
  return memoriaOf(s, c, m) <= m.min;
}

/** Quanti personaggi del cast ricordano Ada (memoria ≥ 1): requisito del finale vero. */
export function rememberCount(s: Pick<CampaignState, 'memoria'>, m: BalanceDef['memoria'] = MEMORIA_DEFAULTS): number {
  return CAST_IDS.filter((c) => memoriaOf(s, c, m) >= 1).length;
}
