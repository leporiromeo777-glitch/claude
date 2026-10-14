/**
 * Stato condiviso delle schermate (le scene si ricreano a ogni ingresso):
 * livelli generati in cache, ultimo esito di ogni modalità, ultimo testo da
 * condividere, data forzata dal debug, lavori in corso da aspettare nei test.
 */
import type { DailyRecord, FlagId, FlagValue, GradoId, LaceMetrics, LaceRecord, LevelDef, LevelId, NightOutcome, SceneId } from '../core/types';
import type { GenResult } from '../engine/index';
import { dailySpec, generateAsync } from '../engine/index';
import { localDate } from './daily';
import { liberoLevelId, liberoSpec } from './libero';

export type ModeOrigin = 'giornaliero' | 'libero' | 'spartito';

export interface ResultInfo {
  origin: ModeOrigin;
  level: LevelDef;
  outcome: NightOutcome;
  metrics: LaceMetrics;
  min: number | null;
  flags: Record<FlagId, FlagValue>;
  /** Record d'eleganza del livello dopo questo merletto (giornaliero e libero). */
  record?: LaceRecord;
  improved: boolean;
  /** Solo giornaliero. */
  daily?: DailyRecord;
  dailyImproved?: boolean;
  streak?: number;
  /** Testo da condividere (giornaliero: riga di GDD 8.3 + spartito). */
  shareText?: string;
  gradi: GradoId[];
  /** Scena a cui tornare dopo i risultati. */
  returnTo: SceneId;
}

export interface LaunchInfo {
  level: LevelDef;
  min: number | null;
  origin: ModeOrigin;
  gradi: GradoId[];
  flags: Record<FlagId, FlagValue>;
  returnTo: SceneId;
}

const genCache = new Map<LevelId, Promise<GenResult>>();
const genDone = new Map<LevelId, GenResult>();
const launches = new Map<string, LaunchInfo>();
const results: Partial<Record<ModeOrigin, ResultInfo>> = {};
let lastShare: string | null = null;
let todayOverride: string | null = null;
const pending = new Set<Promise<unknown>>();

/** Data di oggi (o quella forzata dal debug). */
export function today(): string {
  return todayOverride ?? localDate();
}

export function setTodayOverride(date: string | null): void {
  todayOverride = date;
}

/** Registra un lavoro asincrono da aspettare (i test lo fanno con `__GAME__.ui.idle()`). */
export function track<T>(p: Promise<T>): Promise<T> {
  pending.add(p);
  const done = (): void => {
    pending.delete(p);
  };
  p.then(done, done);
  return p;
}

export async function idle(): Promise<void> {
  while (pending.size > 0) await Promise.allSettled([...pending]);
}

function cached(id: LevelId, make: () => Promise<GenResult>): Promise<GenResult> {
  let p = genCache.get(id);
  if (!p) {
    p = make().then((r) => {
      genDone.set(id, r);
      return r;
    });
    genCache.set(id, p);
    // Un errore non resta in cache: il prossimo tentativo rigenera.
    p.catch(() => {
      if (genCache.get(id) === p) genCache.delete(id);
    });
  }
  return track(p);
}

/** Merletto del giorno di una data (Worker se possibile; deterministico). */
export function dailyLevel(date: string): Promise<GenResult> {
  return cached(`day-${date}`, () => generateAsync(dailySpec(date)));
}

/** Merletto libero di un seme e dei gradi. */
export function liberoLevel(seed: string, gradi: readonly GradoId[]): Promise<GenResult> {
  return cached(liberoLevelId(seed, gradi), () => generateAsync(liberoSpec(seed, gradi)));
}

/** Risultato del generatore già pronto, senza aspettare. */
export function generatedNow(id: LevelId): GenResult | null {
  return genDone.get(id) ?? null;
}

export function rememberLaunch(info: LaunchInfo): void {
  launches.set(`${info.origin}:${info.level.id}`, info);
}

export function launchOf(origin: ModeOrigin, id: LevelId): LaunchInfo | null {
  return launches.get(`${origin}:${id}`) ?? null;
}

export function setResult(r: ResultInfo): void {
  results[r.origin] = r;
  if (r.shareText) lastShare = r.shareText;
}

export function resultOf(origin: ModeOrigin): ResultInfo | null {
  return results[origin] ?? null;
}

export function setLastShare(text: string): void {
  lastShare = text;
}

export function lastShareText(): string | null {
  return lastShare;
}

/** Solo per i test unitari. */
export function resetScreensState(): void {
  genCache.clear();
  genDone.clear();
  launches.clear();
  for (const k of Object.keys(results) as ModeOrigin[]) delete results[k];
  lastShare = null;
  todayOverride = null;
  pending.clear();
}
