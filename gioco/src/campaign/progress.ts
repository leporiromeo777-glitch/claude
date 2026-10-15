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
 *
 * Revisione 2 (R2-D2): record e fili d'oro solo dai merletti con tutte le richieste
 * accettate e tutti gli obiettivi soddisfatti; i record si confrontano per insieme di
 * richieste; «Primo filo d'oro» una volta sola nella vita del salvataggio.
 */
import type { LaceMetrics, LaceRecord, LevelDef, LevelId, NightOutcome, SaveData, Unlocks } from '../core/types';

export const DAY_UNLOCKS: Readonly<Record<string, 'daily' | 'libero' | 'gradi'>> = { g07: 'daily', g08: 'libero', g16: 'gradi' };
export const GOLD_COSMETICS: readonly { at: number; id: string }[] = [
  { at: 3, id: 'stile_1' },
  { at: 8, id: 'stile_2' },
  { at: 15, id: 'stile_3' },
  { at: 22, id: 'stile_4' },
];

export type RecordField = 'incroci' | 'quiete' | 'simmetria' | 'filoDOro';

/**
 * Record di un insieme di richieste (revisione 2, R2-D2): minimo d'incroci, ore di quiete e
 * simmetria dei merletti riusciti con quelle stesse richieste.
 */
export interface SetRecord {
  minIncroci: number | null;
  maxQuiete: number | null;
  simmetria: boolean;
  bestSpartito?: string;
}

/**
 * Record di un livello nel salvataggio. I campi di `LaceRecord` sono il meglio dei merletti
 * riusciti con qualsiasi insieme di richieste (il Telaio ne legge il filo d'oro e lo
 * spartito); `sets` tiene i record per insieme di richieste (chiave: `requestSetKey`), che
 * sono quelli del bilancio. Il core conserva l'oggetto così com'è.
 */
export interface LaceRecordX extends LaceRecord {
  sets?: Record<string, SetRecord>;
}

/** Chiave dell'insieme di richieste di un merletto: gli id ordinati, «-» se non ce ne sono. */
export function requestSetKey(noteIds: readonly string[]): string {
  const ids = [...new Set(noteIds)].sort();
  return ids.length > 0 ? ids.join('+') : '-';
}

/**
 * Un merletto entra nei record solo se tutte le richieste accettate e tutti gli obiettivi
 * sono soddisfatti (R2-D2): una richiesta lasciata cadere o con l'autore sbagliato conta
 * come fallita. Restituisce anche l'insieme delle richieste.
 */
export function outcomeCounts(o: Pick<NightOutcome, 'goals' | 'requests' | 'dropped'>, extra: { failed?: readonly string[] } = {}): { ok: boolean; set: string[] } {
  const set = o.requests.map((r) => r.noteId);
  for (const id of o.dropped) if (!set.includes(id)) set.push(id);
  const failed = new Set(extra.failed ?? []);
  const ok = o.goals.every((g) => g.status === 'soddisfatta') && o.requests.every((r) => r.status === 'soddisfatta' && !failed.has(r.noteId)) && o.dropped.length === 0;
  return { ok, set };
}

/** Nuovo record di un livello dopo un merletto finito (i campi di `LaceRecord`, senza `sets`). */
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

/** Record di un insieme di richieste dopo un merletto riuscito. */
export function updateSetRecord(prev: SetRecord | null | undefined, m: LaceMetrics, spartito: string): { after: SetRecord; improved: ('incroci' | 'quiete')[] } {
  const improved: ('incroci' | 'quiete')[] = [];
  const after: SetRecord = { minIncroci: prev?.minIncroci ?? null, maxQuiete: prev?.maxQuiete ?? null, simmetria: !!prev?.simmetria };
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
  if (m.simmetria) after.simmetria = true;
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

/** Esito di `recordNight`. */
export interface NightRecord {
  /** Record dell'insieme di richieste prima e dopo il merletto (null se non ce n'è). */
  before: SetRecord | null;
  after: SetRecord | null;
  /** Il merletto è entrato nei record (richieste e obiettivi tutti soddisfatti, R2-D2). */
  counted: boolean;
  /** «Nuovo record»: solo per un merletto contato e un record di quell'insieme che c'era già. */
  improved: RecordField[];
  /** Primo filo d'oro di questo livello. */
  goldThread: boolean;
  /** Primo filo d'oro della vita del salvataggio (R2-D2: «Primo filo d'oro» una volta sola). */
  firstGold: boolean;
  unlocked: string[];
}

export interface RecordOpts {
  /** Richieste e obiettivi tutti soddisfatti (`outcomeCounts`); senza, il merletto conta. */
  ok?: boolean;
  /** Le richieste accettate (l'insieme del record). */
  set?: readonly string[];
}

/**
 * Registra un merletto finito: notti, record, fili d'oro e fusi (R2-D2).
 * - Un merletto con una richiesta o un obiettivo non soddisfatti conta come notte, ma non
 *   tocca record né fili d'oro: non è mai «nuovo record».
 * - I record (incroci, quiete) sono per insieme di richieste: si confrontano solo merletti
 *   con le stesse richieste; il primo merletto di un insieme fa il record senza annunciarlo.
 * - «Prima simmetria» è la prima del livello; il filo d'oro conta una volta per livello.
 */
export function recordNight(d: Pick<SaveData, 'records' | 'stats' | 'unlocks'>, levelId: LevelId, m: LaceMetrics, spartito: string, opts: RecordOpts = {}): NightRecord {
  d.stats.nights += 1;
  const prev = (d.records[levelId] as LaceRecordX | undefined) ?? null;
  const key = requestSetKey(opts.set ?? []);
  const beforeSet = prev?.sets?.[key] ? { ...prev.sets[key] } : null;
  // Sotto il minimo della notte un merletto non può aver soddisfatto tutto: non conta.
  const belowMin = m.minIncroci !== null && m.incroci < m.minIncroci;
  if (opts.ok === false || belowMin) {
    return { before: beforeSet, after: beforeSet, counted: false, improved: [], goldThread: false, firstGold: false, unlocked: [] };
  }
  const goldBefore = goldCount(d.records);
  const level = updateRecord(prev, m, spartito);
  const set = updateSetRecord(beforeSet, m, spartito);
  const next: LaceRecordX = { ...level.after, sets: { ...(prev?.sets ?? {}), [key]: set.after } };
  d.records[levelId] = next;
  const improved: RecordField[] = beforeSet ? [...set.improved] : [];
  if (level.improved.includes('simmetria')) improved.push('simmetria');
  const goldThread = level.improved.includes('filoDOro');
  d.stats.goldThreads = goldCount(d.records);
  const firstGold = goldThread && goldBefore === 0;
  const unlocked = goldUnlocks(d.unlocks, d.stats.goldThreads);
  return { before: beforeSet, after: set.after, counted: true, improved, goldThread, firstGold, unlocked };
}

/** Tutto sbloccato (debug). */
export function unlockEverything(u: Unlocks): void {
  u.daily = true;
  u.libero = true;
  u.gradi = true;
  u.tovaglia = true;
  for (const g of GOLD_COSMETICS) if (!u.cosmetics.includes(g.id)) u.cosmetics.push(g.id);
}

/**
 * L'eleganza (incroci, filo d'oro, quiete, simmetria, record) compare nel bilancio da
 * quando la matassa è visibile (GDD 7: g02, la giornata che introduce la regola
 * `matassa`); prima il prologo e la prima giornata parlano solo della storia.
 */
export function showsElegance(level: Pick<LevelDef, 'rules' | 'kind'> | undefined): boolean {
  if (!level) return true;
  return level.kind !== 'storia' || level.rules.includes('matassa');
}
