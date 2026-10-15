/**
 * Impostazioni del giocatore (comfort e fisica). Salvate in localStorage quando
 * disponibile; il gioco funziona anche senza.
 *
 * Versioni dell'archivio (campo `versione` e chiave con il numero):
 * - v1 (`cielo-di-terra.settings.v1`): i valori, senza campo versione; `nearPaint` era [70, 150];
 * - v2 (`cielo-di-terra.settings.v2`): `{ versione: 2, ...valori }`. Il raggio sempre dipinto è
 *   cresciuto a [250, 450] (il non rilevato ora è un abbozzo ad acquerello, non carta bianca):
 *   la migrazione da v1 butta il vecchio `nearPaint` e tiene tutto il resto.
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
  nearPaint: [250, 450],
};

/** Versione corrente dell'archivio delle impostazioni. */
export const SETTINGS_VERSION = 2;
export const SETTINGS_KEY = 'cielo-di-terra.settings.v2';
/** Chiavi delle versioni precedenti (lette solo per migrare). */
export const LEGACY_SETTINGS_KEYS: Record<number, string> = { 1: 'cielo-di-terra.settings.v1' };

function valido(np: unknown): np is [number, number] {
  return Array.isArray(np) && np.length === 2 && np.every((x) => typeof x === 'number' && Number.isFinite(x)) && np[0]! >= 0 && np[1]! > np[0]!;
}

/**
 * Porta un oggetto salvato (di qualsiasi versione) alla versione corrente.
 * @param dati il JSON letto dall'archivio
 * @param versione la versione da cui viene (se il JSON non ha il campo `versione`)
 */
export function migraImpostazioni(dati: unknown, versione = 1): Partial<GameSettings> {
  if (!dati || typeof dati !== 'object') return {};
  const o = { ...(dati as Record<string, unknown>) };
  let v = typeof o['versione'] === 'number' ? (o['versione'] as number) : versione;
  delete o['versione'];
  if (v < 2) {
    // v1 -> v2: il vecchio raggio dipinto [70, 150] lasciava il mondo bianco; vale il nuovo predefinito
    delete o['nearPaint'];
    v = 2;
  }
  if ('nearPaint' in o && !valido(o['nearPaint'])) delete o['nearPaint'];
  return o as Partial<GameSettings>;
}

export function loadSettings(): GameSettings {
  try {
    const store = globalThis.localStorage;
    const raw = store?.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...migraImpostazioni(JSON.parse(raw), SETTINGS_VERSION) };
    for (const [v, key] of Object.entries(LEGACY_SETTINGS_KEYS).sort((a, b) => Number(b[0]) - Number(a[0]))) {
      const old = store?.getItem(key);
      if (old) {
        const s = { ...DEFAULT_SETTINGS, ...migraImpostazioni(JSON.parse(old), Number(v)) };
        saveSettings(s);
        return s;
      }
    }
  } catch {
    // archivio non disponibile o illeggibile: valori predefiniti
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: GameSettings): void {
  try {
    globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify({ versione: SETTINGS_VERSION, ...s }));
  } catch {
    // ignorato
  }
}
