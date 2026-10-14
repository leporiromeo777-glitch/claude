/**
 * Spartito e Ripassa (GDD 8.2 e 8.5, ARCHITETTURA 5.3): un merletto già deciso
 * che si ritesse da solo, riga per riga, mentre il carillon lo suona.
 *
 * - Spartito importato: `decodeSpartito` → righe con le ore vere del livello
 *   (`spartitoRows`) → NightParams in modo 'replay' (origine 'spartito').
 * - Ripassa: le righe di una soluzione già trovata, ritessute in 5 secondi.
 *
 * Il passo è `Session.stepAuto()`; il ritmo lo dà `AutoRunner` (modes/autoweave.ts).
 */
import type { FlagId, FlagValue, LevelDef, NightOrigin, NightParams, RowMoves } from '../../core/types';
import { decodeSpartito, spartitoRows } from '../../engine/index';

/** Ripassa ritesse tutto il merletto in 5 secondi (GDD 8.2). */
export const RIPASSA_TOTAL_MS = 5000;
/** Passo minimo e massimo di una riga dello spartito. */
export const REPLAY_MIN_MS = 120;
export const REPLAY_MAX_MS = 900;

/** Millisecondi per riga: quelli chiesti, o 5 secondi divisi per le righe. */
export function replayStepMs(rows: number, requested?: number): number {
  if (typeof requested === 'number' && Number.isFinite(requested) && requested >= 0) return requested;
  const n = Math.max(1, rows);
  return Math.min(REPLAY_MAX_MS, Math.max(REPLAY_MIN_MS, Math.round(RIPASSA_TOTAL_MS / n)));
}

export interface ReplayOptions {
  origin?: NightOrigin;
  flags?: Record<FlagId, FlagValue>;
  speedMs?: number;
}

/** NightParams per ritessere righe date (Ripassa). */
export function replayParams(level: LevelDef, rows: readonly RowMoves[], o: ReplayOptions = {}): NightParams {
  const p: NightParams = {
    origin: o.origin ?? 'spartito',
    mode: 'replay',
    level,
    flags: { ...(o.flags ?? {}) },
    accepted: [],
    goals: [...(level.goals ?? [])],
    needsNome: false,
    replay: rows.map((r) => ({ hour: r.hour, crossings: r.crossings.filter((c) => !c.forced).map((c) => ({ pair: c.pair, over: c.over })) })),
  };
  if (o.speedMs !== undefined) p.replaySpeedMs = o.speedMs;
  return p;
}

/** NightParams da uno spartito, se è valido e ha il numero di righe del livello. */
export function spartitoParams(str: string, level: LevelDef, o: ReplayOptions = {}): NightParams | null {
  const s = decodeSpartito(str);
  if (!s) return null;
  if (s.rows.length !== level.endHour - level.startHour) return null;
  const p = replayParams(level, spartitoRows(level, s), o);
  if (s.gradi && s.gradi.length > 0) p.gradi = [...s.gradi];
  return p;
}
