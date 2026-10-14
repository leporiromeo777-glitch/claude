/** Aiuti per i test del tombolo: fixture del motore e parametri della notte. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GameEventMap, LevelComputed, LevelDef, NightParams, NoteDef } from '../../../src/core/types';

export const ROOT = resolve(__dirname, '../../..');
export const FIXTURES = resolve(ROOT, 'src/engine/fixtures');

export function fixture(name: string): LevelDef {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${name}.json`), 'utf8')) as LevelDef;
}

export function fixtureComputed(name: string): LevelComputed {
  return JSON.parse(readFileSync(resolve(FIXTURES, `${name}.computed.json`), 'utf8')) as LevelComputed;
}

export function fixtureNotes(): NoteDef[] {
  return JSON.parse(readFileSync(resolve(FIXTURES, 'notes.fixtures.json'), 'utf8')) as NoteDef[];
}

export function nightParams(level: LevelDef, extra: Partial<NightParams> = {}): NightParams {
  return {
    origin: 'libero',
    mode: 'normale',
    level,
    flags: {},
    accepted: [],
    goals: [...(level.goals ?? [])],
    needsNome: false,
    ...extra,
  };
}

export type Logged = { k: keyof GameEventMap; p: unknown };

/** Bus finto che registra gli eventi emessi. */
export function recorder(): { log: Logged[]; emit: <K extends keyof GameEventMap>(k: K, p: GameEventMap[K]) => void; of: <K extends keyof GameEventMap>(k: K) => GameEventMap[K][] } {
  const log: Logged[] = [];
  return {
    log,
    emit: (k, p) => {
      log.push({ k, p });
    },
    of: <K extends keyof GameEventMap>(k: K) => log.filter((x) => x.k === k).map((x) => x.p as GameEventMap[K]),
  };
}
