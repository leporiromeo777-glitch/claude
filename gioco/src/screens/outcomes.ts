/**
 * Fine di una notte delle modalità (ascolto di `night:complete` con origine
 * 'giornaliero', 'libero' o 'spartito'):
 *
 * - giornaliero: DailyRecord del giorno (il migliore), serie di giorni, record
 *   d'eleganza del livello, notti giocate; testo da condividere (GDD 8.3);
 * - libero: record d'eleganza del livello (seme + gradi), notti giocate;
 * - spartito: niente record (il merletto è di qualcun altro), solo l'esito.
 *
 * Gli incroci minimi vengono dal generatore (il tombolo non li conosce per i
 * livelli procedurali), quindi l'eleganza si ricalcola qui con `metrics`.
 * Dopo una breve pausa (il giocatore vede il merletto chiuso) si passa ai risultati.
 */
import type { LevelDef, NightOutcome, SceneId, Services } from '../core/types';
import { metrics } from '../engine/index';
import { activeNight, resolveLevel } from '../tombolo/index';
import { dailyRecordOf, dateOfDailyId, isBetterDaily, liveStreak, mergeLaceRecord, nextStreak, shareParams } from './daily';
import { dailyCosmetics } from './cosmetics';
import { parseLiberoId } from './libero';
import { type ModeOrigin, type ResultInfo, dailyLevel, generatedNow, launchOf, liberoLevel, restoreGuardedNight, setResult, today, track } from './state';

export const MODE_ORIGINS: readonly ModeOrigin[] = ['giornaliero', 'libero', 'spartito'];

export function isModeOrigin(o: string): o is ModeOrigin {
  return (MODE_ORIGINS as readonly string[]).includes(o);
}

/** Pausa prima dei risultati (ms), più breve con le animazioni istantanee. */
export function resultsDelayMs(animSpeed: number, reducedMotion: boolean): number {
  if (animSpeed === 0) return 350;
  return reducedMotion ? 900 : Math.round(1700 / Math.max(0.5, animSpeed));
}

/** Testo da condividere: la riga di GDD 8.3 e, sotto, lo spartito. */
export function shareTextOf(s: Pick<Services, 'i18n'>, r: Parameters<typeof shareParams>[0], spartito: string): string {
  const line = s.i18n.t('ui.condividi.riga', shareParams(r));
  return spartito ? `${line}\n${spartito}` : line;
}

async function minFor(level: LevelDef, origin: ModeOrigin): Promise<number | null> {
  const launch = launchOf(origin, level.id);
  if (launch && launch.min !== null) return launch.min;
  const now = generatedNow(level.id);
  if (now) return now.min;
  const date = dateOfDailyId(level.id);
  if (date) return (await dailyLevel(date)).min;
  const lib = parseLiberoId(level.id);
  if (lib) return (await liberoLevel(lib.seed, lib.gradi)).min;
  return null;
}

async function levelFor(s: Services, outcome: NightOutcome, origin: ModeOrigin): Promise<LevelDef | null> {
  const launch = launchOf(origin, outcome.levelId);
  if (launch) return launch.level;
  const now = generatedNow(outcome.levelId);
  if (now) return now.level;
  const date = dateOfDailyId(outcome.levelId);
  try {
    if (date) return (await dailyLevel(date)).level;
    const lib = parseLiberoId(outcome.levelId);
    if (lib) return (await liberoLevel(lib.seed, lib.gradi)).level;
  } catch {
    return null;
  }
  return resolveLevel(s, outcome.levelId);
}

/** Elabora l'esito: salva record e serie, prepara i risultati. */
export async function processOutcome(s: Services, outcome: NightOutcome): Promise<ResultInfo | null> {
  const origin = outcome.origin;
  if (!isModeOrigin(origin)) return null;
  const level = await levelFor(s, outcome, origin);
  if (!level) return null;
  const launch = launchOf(origin, level.id);
  let min: number | null = null;
  try {
    min = await minFor(level, origin);
  } catch {
    min = null;
  }
  const m = metrics(level, outcome.rows, min, outcome.fantasmaUsed);
  const gradi = launch?.gradi ?? parseLiberoId(level.id)?.gradi ?? [];
  const returnTo: SceneId = launch?.returnTo ?? (origin === 'giornaliero' ? 'giornaliero' : 'libero');
  const info: ResultInfo = { origin, level, outcome, metrics: m, min, flags: launch?.flags ?? {}, improved: false, gradi, returnTo };

  if (origin === 'giornaliero') {
    const date = dateOfDailyId(level.id) ?? today();
    const rec = dailyRecordOf(date, m, min ?? m.incroci, outcome.spartito);
    s.save.update(
      (d) => {
        const prev = d.daily[date];
        info.dailyImproved = isBetterDaily(prev, rec);
        if (info.dailyImproved) d.daily[date] = rec;
        info.daily = d.daily[date] ?? rec;
        const st = nextStreak({ dailyStreak: d.stats.dailyStreak, ...(d.stats.lastDaily ? { lastDaily: d.stats.lastDaily } : {}) }, date);
        d.stats.dailyStreak = st.dailyStreak;
        if (st.lastDaily) d.stats.lastDaily = st.lastDaily;
        const lr = mergeLaceRecord(d.records[level.id], m, outcome.spartito);
        d.records[level.id] = lr.record;
        info.record = lr.record;
        info.improved = lr.improved;
        d.stats.nights += 1;
        // Fusi intagliati del Merletto del giorno (GDD 7: 7 giorni di fila, 30 in tutto).
        const fusi = dailyCosmetics(d);
        if (fusi.length > 0) info.cosmetics = fusi;
      },
      { immediate: true, reason: 'giornaliero' },
    );
    info.streak = liveStreak(s.save.data().stats, date);
    info.shareText = shareTextOf(s, rec, outcome.spartito);
  } else if (origin === 'spartito') {
    restoreGuardedNight(s);
  } else if (origin === 'libero') {
    s.save.update(
      (d) => {
        const lr = mergeLaceRecord(d.records[level.id], m, outcome.spartito);
        d.records[level.id] = lr.record;
        info.record = lr.record;
        info.improved = lr.improved;
        d.stats.nights += 1;
      },
      { immediate: true, reason: 'libero' },
    );
  }
  setResult(info);
  return info;
}

function openOverlays(s: Services): number {
  const ui = s.ui as { overlays?: () => string[] };
  return typeof ui.overlays === 'function' ? ui.overlays().length : 0;
}

/**
 * Ascolta `night:complete` e, dopo la pausa, porta ai risultati (se il
 * giocatore è ancora davanti a quel merletto chiuso). Se nel frattempo ha
 * aperto un pannello (la Pausa, il Taccuino) si aspetta che lo chiuda: i
 * risultati non si aprono mai sotto un overlay.
 */
export function installOutcomeListener(s: Services, o: { delay?: (ms: number) => Promise<void>; pollMs?: number } = {}): () => void {
  const delay = o.delay ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pollMs = o.pollMs ?? 200;
  const offs = [
    s.bus.on('night:complete', ({ outcome }) => {
      if (!isModeOrigin(outcome.origin)) return;
      const origin = outcome.origin;
      const still = (): boolean => {
        const night = activeNight();
        return s.scenes.current() === 'tombolo' && !!night?.completed && night.params.level.id === outcome.levelId && night.params.origin === origin;
      };
      const processing = track(processOutcome(s, outcome));
      void processing
        .then(async (info) => {
          if (!info) return;
          const st = s.settings.get();
          await delay(resultsDelayMs(st.animSpeed, st.reducedMotion));
          while (still() && openOverlays(s) > 0) await delay(pollMs);
          if (!still()) return;
          void s.scenes.go(info.returnTo, { risultato: origin });
        })
        .catch((err: unknown) => console.error('[screens] outcome failed', err));
    }),
    // Uno spartito ritessuto non deve portarsi via la notte lasciata a metà (vedi state.ts).
    s.bus.on('scene:enter', ({ id }) => {
      if (id !== 'tombolo') restoreGuardedNight(s);
    }),
  ];
  return () => {
    for (const off of offs) off();
  };
}
