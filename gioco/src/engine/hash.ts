/**
 * Hash e serializzazione stabile (puri, senza dipendenze di piattaforma).
 *
 * - `fnv1a32`: FNV-1a a 32 bit sui codici UTF-16 (spartito, chiavi).
 * - `stableStringify`: JSON con le chiavi degli oggetti in ordine alfabetico.
 * - `levelSourceHash`: impronta del livello per i `.computed.json` (ARCHITETTURA
 *   14.1): JSON normalizzato del livello più le richieste dei suoi bigliettini e
 *   il numero di spilli rossi, perché anche quelli cambiano i numeri calcolati.
 */
import type { BalanceDef, Condition, ContentDB, LevelDef, LevelId, NoteId } from '../core/types';
import { NODO_RIGHE, TRABOCCO_SOGLIA } from './model';

export function fnv1a32(s: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : stableStringify(x))).join(',')}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}

/** Impronta esadecimale a 64 bit (due FNV-1a con semi diversi). */
export function hash64(s: string): string {
  const a = fnv1a32(s);
  const b = fnv1a32(s, 0x9747b28c);
  return a.toString(16).padStart(8, '0') + b.toString(16).padStart(8, '0');
}

export interface SourceExtra {
  /** Richiesta di ogni bigliettino del livello (null se non ne ha). */
  requests?: Record<NoteId, Condition | null>;
  /** Spilli rossi della sera (combinazioni calcolate). */
  pins?: number;
  /** Parametri bilanciabili del motore (balance.json): entrano nell'impronta solo se diversi dai valori del GDD. */
  balance?: Partial<Pick<BalanceDef, 'traboccoSoglia' | 'nodoRighe'>> | null;
}

export function levelSourceHash(level: LevelDef, extra: SourceExtra = {}): string {
  const requests: [NoteId, Condition | null][] = (level.notes ?? []).map((id) => [id, extra.requests?.[id] ?? null]);
  const src: Record<string, unknown> = { level, requests, pins: extra.pins ?? null };
  const b = extra.balance;
  // Con i valori del GDD (3 segreti, 1 riga) l'impronta resta quella di sempre.
  if (b && ((b.traboccoSoglia ?? TRABOCCO_SOGLIA) !== TRABOCCO_SOGLIA || (b.nodoRighe ?? NODO_RIGHE) !== NODO_RIGHE)) {
    src.balance = { traboccoSoglia: b.traboccoSoglia ?? TRABOCCO_SOGLIA, nodoRighe: b.nodoRighe ?? NODO_RIGHE };
  }
  return hash64(stableStringify(src));
}

/** Spilli rossi di una giornata: campagna, poi bilanciamento dell'atto, poi 2. */
export function pinsForLevel(db: Pick<ContentDB, 'campaign' | 'balance'> | null, level: LevelDef): number {
  const day = db?.campaign.days.find((d) => d.id === level.id);
  if (day) return day.pins;
  if (level.act === 1 || level.act === 2 || level.act === 3) {
    const a = db?.balance.acts[String(level.act) as '1' | '2' | '3'];
    if (a) return a.pins;
  }
  return 2;
}

/** Impronta di un livello del database dei contenuti (la stessa che scrive `levels:check`). */
export function levelSourceHashFromDB(db: ContentDB, levelId: LevelId): string | null {
  const level = db.levels.get(levelId);
  if (!level) return null;
  const requests: Record<NoteId, Condition | null> = {};
  for (const id of level.notes ?? []) requests[id] = db.notes.get(id)?.request ?? null;
  return levelSourceHash(level, { requests, pins: (level.notes ?? []).length > 0 ? pinsForLevel(db, level) : undefined, balance: db.balance });
}
