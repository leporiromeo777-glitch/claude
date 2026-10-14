/**
 * Autosalvataggio e ripresa della notte (ARCHITETTURA 9, GDD 4.2).
 *
 * `SaveData.night` contiene i parametri della notte senza il livello (con il suo
 * `levelId`: i livelli procedurali si rigenerano dal seme) e `NightResume`.
 * Si scrive a ogni ora fissata, a ogni cambio della bozza e quando la pagina si
 * nasconde; si toglie a notte finita. Per riprendere si ritrova il livello:
 * contenuti, livelli già visti in questa sessione, fixture del motore, Merletto
 * del giorno (dalla data), e i risolutori registrati da altri pacchetti (per
 * esempio il Merletto libero, che conosce la sua GenSpec).
 */
import type { LevelComputed, LevelDef, LevelId, NightParams, NightResume, SaveData, Services } from '../core/types';
import { dailySpec, generateAsync } from '../engine/index';

export type LevelResolver = (id: LevelId) => LevelDef | null | Promise<LevelDef | null>;

const resolvers: LevelResolver[] = [];
const seen = new Map<LevelId, LevelDef>();
const fixtureLevels = import.meta.glob('../engine/fixtures/*.json', { import: 'default' });

/** Un altro pacchetto sa ricostruire certi livelli dal loro id (Merletto libero). */
export function registerLevelResolver(fn: LevelResolver): () => void {
  resolvers.push(fn);
  return () => {
    const i = resolvers.indexOf(fn);
    if (i >= 0) resolvers.splice(i, 1);
  };
}

/** Ricorda un livello giocato in questa sessione (per "Ricomincia" e per la ripresa). */
export function rememberLevel(level: LevelDef): void {
  seen.set(level.id, level);
}

function isLevel(v: unknown): v is LevelDef {
  return !!v && typeof v === 'object' && Array.isArray((v as LevelDef).columns) && Array.isArray((v as LevelDef).initial) && typeof (v as LevelDef).id === 'string';
}

async function fixture<T>(name: string): Promise<T | null> {
  const load = fixtureLevels[`../engine/fixtures/${name}.json`];
  if (!load) return null;
  try {
    return (await load()) as T;
  } catch {
    return null;
  }
}

export async function resolveLevel(s: Pick<Services, 'content'>, id: LevelId): Promise<LevelDef | null> {
  const c = s.content.levels.get(id);
  if (c) return c;
  const known = seen.get(id);
  if (known) return known;
  if (/^[A-Za-z0-9_-]+$/.test(id)) {
    const f = await fixture<unknown>(id);
    if (isLevel(f)) return f;
  }
  const day = /^day-(\d{4}-\d{2}-\d{2})$/.exec(id);
  if (day && day[1]) {
    try {
      const r = await generateAsync(dailySpec(day[1]));
      if (r.level.id === id) return r.level;
    } catch {
      /* generatore non disponibile */
    }
  }
  for (const fn of resolvers) {
    try {
      const lv = await fn(id);
      if (isLevel(lv)) return lv;
    } catch {
      /* risolutore che fallisce: si prova il prossimo */
    }
  }
  return null;
}

/** Soluzioni precalcolate: dai contenuti o dalle fixture del motore. */
export async function resolveComputed(s: Pick<Services, 'content'>, id: LevelId): Promise<LevelComputed | null> {
  const c = s.content.computed.get(id);
  if (c) return c;
  if (s.content.levels.has(id) || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const f = await fixture<LevelComputed>(`${id}.computed`);
  return f && typeof f === 'object' && f.levelId === id ? f : null;
}

type SavedParams = NonNullable<SaveData['night']>['params'];

/** Parametri della notte senza il livello e senza la ripresa (forma di SaveData.night.params). */
export function paramsForSave(p: NightParams): SavedParams {
  const out: SavedParams = {
    origin: p.origin,
    mode: p.mode,
    flags: { ...p.flags },
    accepted: p.accepted.map((a) => ({ ...a })),
    goals: [...p.goals],
    needsNome: p.needsNome,
    levelId: p.level.id,
  };
  if (p.gradi) out.gradi = [...p.gradi];
  if (p.replay) out.replay = p.replay.map((r) => ({ hour: r.hour, crossings: r.crossings.map((c) => ({ ...c })) }));
  if (p.replaySpeedMs !== undefined) out.replaySpeedMs = p.replaySpeedMs;
  return out;
}

export function saveNight(s: Pick<Services, 'save'>, p: NightParams, resume: NightResume, immediate: boolean): void {
  s.save.update(
    (d) => {
      d.night = { origin: p.origin, params: paramsForSave(p), resume };
    },
    { immediate, reason: 'night' },
  );
}

export function clearNight(s: Pick<Services, 'save'>): void {
  s.save.update(
    (d) => {
      d.night = null;
    },
    { immediate: true, reason: 'night:fine' },
  );
}

/** NightParams per riprendere la notte salvata, con il livello ritrovato; null se non c'è o non si ritrova. */
export async function resumeParams(s: Pick<Services, 'save' | 'content'>): Promise<NightParams | null> {
  const n = s.save.data().night;
  if (!n || !n.params || !n.resume) return null;
  const level = await resolveLevel(s, n.params.levelId);
  if (!level) return null;
  const { levelId: _id, ...rest } = n.params;
  void _id;
  const p: NightParams = { ...rest, level, resume: n.resume };
  return p;
}

/** Riapre il tombolo alla riga salvata. false se non c'è una notte da riprendere. */
export async function resumeNight(s: Pick<Services, 'save' | 'content' | 'scenes'>): Promise<boolean> {
  const p = await resumeParams(s);
  if (!p) return false;
  void s.scenes.go('tombolo', p);
  return true;
}
