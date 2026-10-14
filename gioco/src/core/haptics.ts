/**
 * Vibrazione (ARCHITETTURA 5.1, GDD 11.1): @capacitor/haptics in nativo,
 * navigator.vibrate sul web. Rispetta l'impostazione "vibrazione".
 *
 * Schemi web: leggero [10], medio [20], successo [15, 40, 15], rifiuto [8, 30, 8].
 * In nativo: impatto leggero, impatto medio, notifica di successo, notifica di avviso.
 */
import type { HapticKind, Haptics } from './types';

export const HAPTIC_PATTERNS: Readonly<Record<HapticKind, readonly number[]>> = {
  leggero: [10],
  medio: [20],
  successo: [15, 40, 15],
  rifiuto: [8, 30, 8],
};

type NativeHaptics = typeof import('@capacitor/haptics');

export interface HapticsDeps {
  native: boolean;
  enabled: () => boolean;
  vibrate?: (pattern: number[]) => boolean;
}

export function createHaptics(deps: HapticsDeps): Haptics & { log(): HapticKind[] } {
  const played: HapticKind[] = [];
  let nativeMod: NativeHaptics | null = null;
  let loading: Promise<void> | null = null;

  const vibrate =
    deps.vibrate ??
    ((pattern: number[]): boolean => {
      try {
        return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate(pattern) : false;
      } catch {
        return false;
      }
    });

  function loadNative(): void {
    if (loading) return;
    loading = import('@capacitor/haptics')
      .then((m) => {
        nativeMod = m;
      })
      .catch((err: unknown) => {
        console.warn('[haptics] native plugin unavailable', err);
      });
  }
  if (deps.native) loadNative();

  function playNative(m: NativeHaptics, k: HapticKind): void {
    const h = m.Haptics;
    const p =
      k === 'leggero'
        ? h.impact({ style: m.ImpactStyle.Light })
        : k === 'medio'
          ? h.impact({ style: m.ImpactStyle.Medium })
          : k === 'successo'
            ? h.notification({ type: m.NotificationType.Success })
            : h.notification({ type: m.NotificationType.Warning });
    p.catch(() => undefined);
  }

  return {
    play(k) {
      if (!deps.enabled()) return;
      played.push(k);
      if (played.length > 100) played.shift();
      if (deps.native && nativeMod) {
        playNative(nativeMod, k);
        return;
      }
      vibrate([...HAPTIC_PATTERNS[k]]);
    },
    log: () => played.slice(),
  };
}
