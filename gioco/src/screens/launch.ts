/**
 * Avvio delle notti delle modalità (ARCHITETTURA 5.3-5.5): Merletto del giorno,
 * Merletto libero, spartito importato. Si naviga con `scenes.go('tombolo',
 * NightParams)`; la notte salvata a metà si riprende con `resumeNight` del tombolo.
 */
import type { FlagId, FlagValue, GradoId, LevelDef, NightParams, SceneId, Services } from '../core/types';
import { createContext, decodeSpartito, simulate, spartitoRows } from '../engine/index';
import { resumeNight, spartitoParams } from '../tombolo/index';
import { dateFromRef } from './daily';
import { isSeed, liberoLevelId, normalizeGradi } from './libero';
import { dailyLevel, liberoLevel, rememberLaunch, today, track } from './state';

export type LaunchResult = { ok: true } | { ok: false; errorKey: string };

/** C'è una notte salvata a metà di un altro livello? Allora si chiede prima di sostituirla. */
export async function confirmNightOverwrite(s: Services, levelId: string): Promise<boolean> {
  const n = s.save.data().night;
  if (!n || n.params.levelId === levelId) return true;
  return s.ui.confirm({
    titleKey: 'ui.notteInCorso.titolo',
    bodyKey: 'ui.notteInCorso.corpo',
    okKey: 'ui.notteInCorso.ok',
    cancelKey: 'ui.notteInCorso.annulla',
    danger: true,
  });
}

/** La notte salvata è di questo livello? */
export function savedNightOf(s: Services, levelId: string): boolean {
  return s.save.data().night?.params.levelId === levelId;
}

function freshParams(origin: NightParams['origin'], level: LevelDef, gradi: GradoId[] = []): NightParams {
  const p: NightParams = {
    origin,
    mode: 'normale',
    level,
    flags: {},
    accepted: [],
    goals: [...(level.goals ?? [])],
    needsNome: false,
  };
  if (gradi.length > 0) p.gradi = [...gradi];
  return p;
}

/** Riprende la notte salvata (se è di questo livello). */
export async function resumeSaved(s: Services, levelId: string): Promise<boolean> {
  if (!savedNightOf(s, levelId)) return false;
  return track(resumeNight(s));
}

/** Merletto del giorno: genera (Worker), poi apre il tombolo con origine 'giornaliero'. */
export async function launchDaily(s: Services, date: string = today(), o: { resume?: boolean } = {}): Promise<LaunchResult> {
  let gen;
  try {
    gen = await dailyLevel(date);
  } catch (err) {
    console.error('[screens] daily generation failed', err);
    return { ok: false, errorKey: 'ui.giornaliero.errore' };
  }
  const level = gen.level;
  if (o.resume && (await resumeSaved(s, level.id))) return { ok: true };
  if (!(await confirmNightOverwrite(s, level.id))) return { ok: false, errorKey: 'ui.notteInCorso.rinuncia' };
  rememberLaunch({ level, min: gen.min, origin: 'giornaliero', gradi: [], flags: {}, returnTo: 'giornaliero' });
  void s.scenes.go('tombolo', freshParams('giornaliero', level));
  return { ok: true };
}

/** Merletto libero: seme e gradi (tutti, anche quelli d'interfaccia, vanno al tombolo). */
export async function launchLibero(s: Services, seed: string, gradi: readonly GradoId[], o: { resume?: boolean } = {}): Promise<LaunchResult> {
  if (!isSeed(seed)) return { ok: false, errorKey: 'ui.libero.semeNonValido' };
  const g = normalizeGradi(gradi);
  if (o.resume && (await resumeSaved(s, liberoLevelId(seed, g)))) return { ok: true };
  let gen;
  try {
    gen = await liberoLevel(seed, g);
  } catch (err) {
    console.error('[screens] free lace generation failed', err);
    return { ok: false, errorKey: 'ui.libero.errore' };
  }
  const level = gen.level;
  if (!(await confirmNightOverwrite(s, level.id))) return { ok: false, errorKey: 'ui.notteInCorso.rinuncia' };
  rememberLaunch({ level, min: gen.min, origin: 'libero', gradi: g, flags: {}, returnTo: 'libero' });
  void s.scenes.go('tombolo', freshParams('libero', level, g));
  return { ok: true };
}

export type SpartitoResolution =
  | { ok: true; params: NightParams; level: LevelDef; min: number | null; flags: Record<FlagId, FlagValue> }
  | { ok: false; errorKey: string };

/**
 * Dallo spartito (ARCHITETTURA 14.6) ai parametri della notte in modo 'replay'
 * (origine 'spartito'). Modo G: il Merletto del giorno della data; modo L: il
 * Merletto libero del seme con i suoi gradi; modo S: una giornata di storia già tessuta.
 */
export async function resolveSpartito(s: Services, raw: string): Promise<SpartitoResolution> {
  const str = raw.replace(/\s+/g, '');
  if (str.length === 0) return { ok: false, errorKey: 'ui.spartito.errore.vuoto' };
  const sp = decodeSpartito(str);
  if (!sp) return { ok: false, errorKey: 'ui.spartito.errore.formato' };
  let level: LevelDef | null = null;
  let min: number | null = null;
  let flags: Record<FlagId, FlagValue> = {};
  if (sp.mode === 'G') {
    const date = dateFromRef(sp.ref);
    if (!date) return { ok: false, errorKey: 'ui.spartito.errore.formato' };
    try {
      const gen = await dailyLevel(date);
      level = gen.level;
      min = gen.min;
    } catch {
      return { ok: false, errorKey: 'ui.spartito.errore.livello' };
    }
  } else if (sp.mode === 'L') {
    if (!isSeed(sp.ref)) return { ok: false, errorKey: 'ui.spartito.errore.seme' };
    try {
      const gen = await liberoLevel(sp.ref, sp.gradi ?? []);
      level = gen.level;
      min = gen.min;
    } catch {
      return { ok: false, errorKey: 'ui.spartito.errore.livello' };
    }
  } else {
    const lv = s.content.levels.get(sp.ref);
    if (!lv) return { ok: false, errorKey: 'ui.spartito.errore.livello' };
    const d = s.save.data();
    const played = !!d.records[sp.ref] || !!d.campaign?.history?.[sp.ref];
    if (!played) return { ok: false, errorKey: 'ui.spartito.errore.nonTessuto' };
    level = lv;
    flags = lv.archive ? {} : { ...(d.campaign?.flags ?? {}) };
    min = s.content.computed.get(lv.id)?.base.incroci ?? null;
  }
  if (sp.rows.length !== level.endHour - level.startHour) return { ok: false, errorKey: 'ui.spartito.errore.righe' };
  // Le righe devono reggere davvero (la matassa non conta: il merletto è già deciso).
  const free: LevelDef = { ...level, matassa: Number.MAX_SAFE_INTEGER };
  const sim = simulate(free, createContext(free, flags), spartitoRows(level, sp));
  if (!sim.ok) return { ok: false, errorKey: 'ui.spartito.errore.nonValido' };
  const params = spartitoParams(str, level, { origin: 'spartito', flags });
  if (!params) return { ok: false, errorKey: 'ui.spartito.errore.righe' };
  return { ok: true, params, level, min, flags };
}

/** Importa lo spartito e apre il tombolo che lo ritesse. */
export async function launchSpartito(s: Services, raw: string, returnTo: SceneId = 'libero'): Promise<LaunchResult> {
  const r = await track(resolveSpartito(s, raw));
  if (!r.ok) return r;
  rememberLaunch({ level: r.level, min: r.min, origin: 'spartito', gradi: r.params.gradi ?? [], flags: r.flags, returnTo });
  void s.scenes.go('tombolo', r.params);
  return { ok: true };
}
