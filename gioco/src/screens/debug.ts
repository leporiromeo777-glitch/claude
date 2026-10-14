/**
 * `__GAME__.ui` (ARCHITETTURA 15.1): `open(screen)`, `share()` (ultimo testo di
 * condivisione), `daily()` (dati del giorno). In più, per i test:
 *
 *   state()                    scena, overlay, voci del titolo, ultimi esiti
 *   title()                    voci del menu del titolo (lucchetti compresi)
 *   press(id)                  esegue una voce del titolo ('continua', 'nuova', …) senza aspettarla
 *   setToday(data | null)      fissa la data del Merletto del giorno (AAAA-MM-GG)
 *   startDaily(resume?)        apre il tombolo con il Merletto del giorno
 *   libero(seed?)              specifica e id del Merletto libero (scelta corrente o seme dato)
 *   startLibero({seed?, size?, gradi?})   apre il tombolo con il Merletto libero
 *   importSpartito(str)        ritesse uno spartito ({ ok, errorKey? })
 *   copySpartito()             ultimo spartito di un esito
 *   result(origin?)            ultimo esito di una modalità (metriche, record, testo)
 *   unlock(kind?)              sblocchi: 'daily' | 'libero' | 'gradi' | 'all'
 *   idle()                     aspetta i lavori in corso (generazione, esiti)
 *   checkSpartito(str)         controlla uno spartito senza aprire il tombolo
 *   shareLine(data, incroci, min, quiete, simmetria)   riga di condivisione formattata
 */
import type { GradoId, Services } from '../core/types';
import { dailySpec, levelSourceHash } from '../engine/index';
import { dailyRecordOf, isIsoDate, liveStreak, shareParams } from './daily';
import { launchDaily, launchLibero, launchSpartito, resolveSpartito } from './launch';
import { liberoChoice, setLiberoChoice } from './LiberoScene';
import { liberoLevelId, liberoSpec, type Dimensione } from './libero';
import { dailyLevel, idle, lastShareText, liberoLevel, resultOf, setTodayOverride, today, type ModeOrigin } from './state';
import { currentTitle } from './TitoloScene';
import type { TitleItemId } from './titleMenu';

const SCENES = ['titolo', 'giornaliero', 'libero', 'impostazioni', 'crediti'] as const;
const OVERLAYS = ['pausa', 'spartito', 'impostazioniOverlay'] as const;

export function registerUiDebug(s: Services): void {
  s.debug.register('ui', {
    open: async (screen: string, params?: unknown) => {
      if ((SCENES as readonly string[]).includes(screen)) {
        await s.scenes.go(screen as (typeof SCENES)[number], params);
        return s.scenes.current();
      }
      if ((OVERLAYS as readonly string[]).includes(screen)) {
        void s.ui.openOverlay(screen === 'impostazioniOverlay' ? 'impostazioni' : screen, params ?? { from: 'debug' });
        return screen;
      }
      throw new Error(`ui.open: unknown screen "${screen}"`);
    },
    share: async () => {
      await idle();
      return lastShareText();
    },
    daily: async (date?: string) => {
      const d = date && isIsoDate(date) ? date : today();
      const gen = await dailyLevel(d);
      const save = s.save.data();
      const rec = save.daily[d] ?? null;
      return {
        date: d,
        levelId: gen.level.id,
        hash: levelSourceHash(gen.level),
        rule: dailySpec(d).rule,
        columns: gen.level.columns.length,
        rows: gen.level.endHour - gen.level.startHour,
        min: gen.min,
        matassa: gen.level.matassa,
        fromFallback: gen.fromFallback,
        record: rec,
        shareText: rec ? s.i18n.t('ui.condividi.riga', shareParams(rec)) : null,
        streak: liveStreak(save.stats, d),
        lastDaily: save.stats.lastDaily ?? null,
        days: Object.keys(save.daily).length,
      };
    },
    state: () => {
      const t = currentTitle();
      return {
        scene: s.scenes.current(),
        overlays: (s.ui as { overlays?: () => string[] }).overlays?.() ?? [],
        today: today(),
        title: t ? t.menu() : null,
        titleArt: t ? t.artGeometry() : null,
        results: Object.fromEntries((['giornaliero', 'libero', 'spartito'] as ModeOrigin[]).map((o) => [o, summary(resultOf(o))])),
        share: lastShareText(),
        libero: liberoChoice(),
      };
    },
    title: () => currentTitle()?.menu() ?? null,
    press: (id: TitleItemId) => {
      const t = currentTitle();
      if (!t) throw new Error('ui.press: the title is not open');
      // Non si aspetta: la voce può chiedere una conferma (la si risponde con confirm-ok / confirm-annulla).
      void t.activate(id);
      return true;
    },
    setToday: (date: string | null) => {
      if (date !== null && !isIsoDate(date)) throw new Error(`ui.setToday: invalid date "${date}"`);
      setTodayOverride(date);
      return today();
    },
    startDaily: async (resume?: boolean) => launchDaily(s, today(), { resume: !!resume }),
    libero: async (seed?: string, gradi?: GradoId[]) => {
      const c = liberoChoice();
      const sd = seed ?? c.seed;
      const g = gradi ?? c.gradi;
      const spec = liberoSpec(sd, g);
      const gen = await liberoLevel(sd, g);
      return { spec, levelId: liberoLevelId(sd, g), generatedId: gen.level.id, min: gen.min, matassa: gen.level.matassa, hash: levelSourceHash(gen.level), fromFallback: gen.fromFallback };
    },
    startLibero: async (o?: { seed?: string; size?: Dimensione; gradi?: GradoId[] }) => {
      if (o?.size) setLiberoChoice({ size: o.size });
      if (o?.seed) setLiberoChoice({ seed: o.seed });
      if (o?.gradi) setLiberoChoice({ gradi: o.gradi });
      const c = liberoChoice();
      return launchLibero(s, c.seed, c.gradi);
    },
    importSpartito: async (str: string, returnTo?: 'libero' | 'giornaliero') => launchSpartito(s, str, returnTo ?? 'libero'),
    checkSpartito: async (str: string) => {
      const r = await resolveSpartito(s, str);
      return r.ok ? { ok: true, levelId: r.level.id, rows: r.params.replay?.length ?? 0 } : r;
    },
    copySpartito: () => resultOf('giornaliero')?.outcome.spartito ?? resultOf('libero')?.outcome.spartito ?? null,
    result: async (origin?: ModeOrigin) => {
      await idle();
      return summary(resultOf(origin ?? 'giornaliero'));
    },
    unlock: (kind?: 'daily' | 'libero' | 'gradi' | 'all' | 'tovaglia' | 'nessunaTovaglia') => {
      const k = kind ?? 'all';
      s.save.update(
        (d) => {
          if (k === 'daily' || k === 'all') d.unlocks.daily = true;
          if (k === 'libero' || k === 'all') d.unlocks.libero = true;
          if (k === 'gradi' || k === 'all') d.unlocks.gradi = true;
          // Il finale vero (revisione 1, SCH-15): non fa parte di 'all'.
          if (k === 'tovaglia' || k === 'nessunaTovaglia') d.unlocks.tovaglia = k === 'tovaglia';
        },
        { immediate: true, reason: 'debug:unlock' },
      );
      currentTitle()?.refresh();
      return s.save.data().unlocks;
    },
    idle: async () => {
      await idle();
      return true;
    },
    shareLine: (date: string, incroci: number, min: number, quiete: number, simmetria: boolean) =>
      s.i18n.t('ui.condividi.riga', shareParams(dailyRecordOf(date, { incroci, minIncroci: min, quiete, simmetria, filoDOro: false }, min, ''))),
  });
}

function summary(r: ReturnType<typeof resultOf>): unknown {
  if (!r) return null;
  return {
    origin: r.origin,
    levelId: r.level.id,
    metrics: r.metrics,
    min: r.min,
    record: r.record ?? null,
    improved: r.improved,
    daily: r.daily ?? null,
    dailyImproved: r.dailyImproved ?? null,
    streak: r.streak ?? null,
    shareText: r.shareText ?? null,
    spartito: r.outcome.spartito,
    gradi: r.gradi,
    returnTo: r.returnTo,
  };
}
