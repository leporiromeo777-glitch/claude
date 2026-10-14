/**
 * Salvataggio vuoto e normalizzazione (ARCHITETTURA 4 "Salvataggi").
 * normalizeSave completa con i valori predefiniti tutto quello che manca o non
 * ha il tipo giusto, così il resto del gioco legge sempre un SaveData intero.
 * Le strutture interne di campagna e notte appartengono ai rispettivi pacchetti
 * e sono conservate così come sono.
 */
import type { Knowledge, SaveData, Settings, Unlocks } from '../types';
import { defaultSettings, sanitizeSettings } from '../settings';

export function defaultKnowledge(): Knowledge {
  return {
    quirks: [], rules: [], diary: [], desires: [],
    questions: {}, archive: {},
    letters: [], objects: [], seenVignettes: [],
  };
}

export function defaultUnlocks(): Unlocks {
  return { daily: false, libero: false, gradi: false, cosmetics: [], tovaglia: false };
}

export function defaultSaveData(gameVersion: string, settings: Settings = defaultSettings()): SaveData {
  return {
    schema: 1,
    app: 'trama',
    writtenAt: '',
    gameVersion,
    settings,
    campaign: null,
    knowledge: defaultKnowledge(),
    night: null,
    records: {},
    daily: {},
    unlocks: defaultUnlocks(),
    stats: { playMs: 0, nights: 0, goldThreads: 0, dailyStreak: 0 },
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}
function strArr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}
function strRecord<T extends string>(v: unknown, allowed: readonly T[]): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) {
    const ok = allowed.find((a) => a === x);
    if (ok) out[k] = ok;
  }
  return out;
}
function objRecord<T>(v: unknown): Record<string, T> {
  const out: Record<string, T> = {};
  if (!isObj(v)) return out;
  for (const [k, x] of Object.entries(v)) if (isObj(x)) out[k] = x as T;
  return out;
}

export function normalizeSave(raw: unknown, base: SaveData): SaveData {
  const r = isObj(raw) ? raw : {};
  const k = isObj(r.knowledge) ? r.knowledge : {};
  const u = isObj(r.unlocks) ? r.unlocks : {};
  const s = isObj(r.stats) ? r.stats : {};
  const unlocks: Unlocks = {
    daily: u.daily === true,
    libero: u.libero === true,
    gradi: u.gradi === true,
    cosmetics: strArr(u.cosmetics),
    tovaglia: u.tovaglia === true,
  };
  if (typeof u.selectedCosmetic === 'string') unlocks.selectedCosmetic = u.selectedCosmetic;
  const stats: SaveData['stats'] = {
    playMs: Math.max(0, num(s.playMs, 0)),
    nights: Math.max(0, num(s.nights, 0)),
    goldThreads: Math.max(0, num(s.goldThreads, 0)),
    dailyStreak: Math.max(0, num(s.dailyStreak, 0)),
  };
  if (typeof s.lastDaily === 'string') stats.lastDaily = s.lastDaily;
  return {
    schema: 1,
    app: 'trama',
    writtenAt: typeof r.writtenAt === 'string' ? r.writtenAt : '',
    gameVersion: typeof r.gameVersion === 'string' ? r.gameVersion : base.gameVersion,
    settings: sanitizeSettings(r.settings, base.settings),
    campaign: isObj(r.campaign) ? (r.campaign as unknown as SaveData['campaign']) : null,
    knowledge: {
      quirks: strArr(k.quirks) as Knowledge['quirks'],
      rules: strArr(k.rules) as Knowledge['rules'],
      diary: strArr(k.diary),
      desires: strArr(k.desires) as Knowledge['desires'],
      questions: strRecord(k.questions, ['aperta', 'risolta'] as const),
      archive: strRecord(k.archive, ['nuovo', 'nominato', 'rammendato'] as const),
      letters: strArr(k.letters),
      objects: strArr(k.objects),
      seenVignettes: strArr(k.seenVignettes),
    },
    night: isObj(r.night) ? (r.night as unknown as SaveData['night']) : null,
    records: objRecord(r.records),
    daily: objRecord(r.daily),
    unlocks,
    stats,
  };
}
