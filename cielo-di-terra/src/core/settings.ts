/**
 * Impostazioni del giocatore (comfort e fisica). Salvate in localStorage quando
 * disponibile; il gioco funziona anche senza.
 */
import { PLAYER_TUNABLES } from '../player/tunables';

export interface GameSettings {
  /** Campo visivo verticale (gradi). */
  fov: number;
  /** Sensibilità del mouse (radianti per pixel). */
  mouseSensitivity: number;
  invertY: boolean;
  /** Oscillazione della testa camminando: spenta per comfort. */
  headBob: boolean;
  /** "Fisica piena": Coriolis al 100% anche a piedi. */
  fullPhysics: boolean;
  /** Coriolis a piedi quando la fisica piena è spenta (0.4 nel concept). */
  coriolisOnFoot: number;
  /** Velocità di rotazione delle stelle nelle Finestre (1 = vera; comfort: rallentabile). */
  starSpeed: number;
  /** Minuti reali per un giorno di 24 ore. */
  dayLengthMinutes: number;
  /** Raggio entro cui il mondo è sempre dipinto (m): inizio e fine della sfumatura. */
  nearPaint: [number, number];
}

export const DEFAULT_SETTINGS: GameSettings = {
  fov: 70,
  mouseSensitivity: 0.0022,
  invertY: false,
  headBob: false,
  fullPhysics: false,
  coriolisOnFoot: PLAYER_TUNABLES.coriolisOnFoot,
  starSpeed: 1,
  dayLengthMinutes: 40,
  nearPaint: [70, 150],
};

const KEY = 'cielo-di-terra.settings.v1';

export function loadSettings(): GameSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
  } catch {
    // archivio non disponibile: valori predefiniti
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: GameSettings): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignorato
  }
}
