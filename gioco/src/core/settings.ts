/**
 * Impostazioni (ARCHITETTURA 5.1, GDD 10.3 "Impostazioni", GDD 14).
 *
 * Le impostazioni vivono dentro il salvataggio (`SaveData.settings`): lo store è
 * un involucro che le valida, le salva e le applica su `<html>`:
 * - `--text-scale` (0,9-1,4): `html { font-size: calc(17px * var(--text-scale)) }`;
 * - `data-contrast="alto" | "normale"`;
 * - `data-motion="ridotto" | "normale"`;
 * - `data-anim-speed` (0, 0.5, 1, 2) e `--anim-speed` per chi anima in CSS;
 * - `lang` del documento.
 */
import type { EventBus, GameEventMap, Locale, SaveService, Settings, SettingsStore } from './types';

export const TEXT_SCALE_MIN = 0.9;
export const TEXT_SCALE_MAX = 1.4;
export const ANIM_SPEEDS: readonly Settings['animSpeed'][] = [0, 0.5, 1, 2];
export const LOCALES: readonly Locale[] = ['it', 'en'];

export function detectLocale(languages?: readonly string[] | null): Locale {
  const list = languages ?? (typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []);
  for (const l of list) {
    const base = (l ?? '').toLowerCase().split('-')[0];
    if (base === 'it') return 'it';
    if (base === 'en') return 'en';
  }
  // Il gioco nasce in italiano: l'inglese copre l'interfaccia, la storia ripiega sull'italiano.
  return list.length > 0 ? 'en' : 'it';
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(locale: Locale = 'it', reducedMotion = false): Settings {
  return {
    volume: { master: 0.8, music: 0.6, sfx: 0.8, voice: 0.7 },
    textScale: 1,
    highContrast: false,
    animSpeed: 1,
    reducedMotion,
    haptics: true,
    captions: false,
    autoAdvance: false,
    locale,
  };
}

function clamp01(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/** Fonde un'impostazione parziale (anche non fidata) su una base valida. */
export function sanitizeSettings(p: unknown, base: Settings): Settings {
  const o = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
  const vol = (o.volume && typeof o.volume === 'object' ? o.volume : {}) as Record<string, unknown>;
  const ts = o.textScale;
  const textScale =
    typeof ts === 'number' && Number.isFinite(ts)
      ? Math.round(Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, ts)) * 100) / 100
      : base.textScale;
  const anim = ANIM_SPEEDS.find((s) => s === o.animSpeed);
  const locale = LOCALES.find((l) => l === o.locale);
  return {
    volume: {
      master: clamp01(vol.master, base.volume.master),
      music: clamp01(vol.music, base.volume.music),
      sfx: clamp01(vol.sfx, base.volume.sfx),
      voice: clamp01(vol.voice, base.volume.voice),
    },
    textScale,
    highContrast: bool(o.highContrast, base.highContrast),
    animSpeed: anim ?? base.animSpeed,
    reducedMotion: bool(o.reducedMotion, base.reducedMotion),
    haptics: bool(o.haptics, base.haptics),
    captions: bool(o.captions, base.captions),
    autoAdvance: bool(o.autoAdvance, base.autoAdvance),
    locale: locale ?? base.locale,
  };
}

/** Applica le impostazioni visive al documento. */
export function applySettingsToDocument(s: Settings, root: HTMLElement | null): void {
  if (!root) return;
  root.style.setProperty('--text-scale', String(s.textScale));
  // Revisione 1 (SCH-05): da 130% in su i controlli a segmenti vanno in colonna.
  root.dataset.textScale = s.textScale >= 1.3 ? 'grande' : 'normale';
  root.style.setProperty('--anim-speed', String(s.animSpeed));
  root.dataset.contrast = s.highContrast ? 'alto' : 'normale';
  root.dataset.motion = s.reducedMotion ? 'ridotto' : 'normale';
  root.dataset.animSpeed = String(s.animSpeed);
  root.lang = s.locale;
}

/**
 * Fattore delle durate delle animazioni: 0 = istantanea; con il movimento
 * ridotto le animazioni restano ma senza dondolii (lo decide chi anima).
 * Durata effettiva = durata a 1× × animDurationFactor(s).
 */
export function animDurationFactor(s: Settings): number {
  return s.animSpeed === 0 ? 0 : 1 / s.animSpeed;
}

export interface SettingsDeps {
  save: SaveService;
  bus?: EventBus<GameEventMap>;
  root?: HTMLElement | null;
}

export interface CoreSettingsStore extends SettingsStore {
  /** Riapplica al documento e notifica (dopo un import o una cancellazione del salvataggio). */
  reapply(): void;
}

export function createSettingsStore(deps: SettingsDeps): CoreSettingsStore {
  const root = deps.root === undefined ? (typeof document !== 'undefined' ? document.documentElement : null) : deps.root;
  const store: CoreSettingsStore = {
    get: () => deps.save.data().settings,
    set(p) {
      const cur = deps.save.data().settings;
      const merged = sanitizeSettings({ ...cur, ...p, volume: { ...cur.volume, ...(p.volume ?? {}) } }, cur);
      deps.save.update(
        (d) => {
          d.settings = merged;
        },
        { reason: 'settings' },
      );
      applySettingsToDocument(merged, root);
      deps.bus?.emit('settings:change', merged);
    },
    reapply() {
      const s = deps.save.data().settings;
      applySettingsToDocument(s, root);
      deps.bus?.emit('settings:change', s);
    },
  };
  return store;
}
