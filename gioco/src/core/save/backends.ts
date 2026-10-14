/**
 * Backend dei salvataggi (ARCHITETTURA 9).
 *
 * - LocalStorageBackend (web): ogni accesso dentro try/catch. Se lo storage non
 *   c'è o lancia (navigazione privata, spazio pieno) si continua in memoria e si
 *   avvisa una volta sola (callback onWarn).
 * - PreferencesBackend (nativo): @capacitor/preferences, importato dinamicamente
 *   solo se Capacitor.isNativePlatform(). UserDefaults su iOS, SharedPreferences
 *   su Android: non vengono svuotati come lo storage della WebView.
 * - MemoryBackend: per i test e come riserva.
 */
import type { StorageBackend } from '../types';

export class MemoryBackend implements StorageBackend {
  readonly map = new Map<string, string>();
  async get(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }
  async set(key: string, v: string): Promise<void> {
    this.map.set(key, v);
  }
  async remove(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/** Il sottoinsieme di Storage che ci serve (iniettabile nei test). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageBackend implements StorageBackend {
  private readonly memory = new Map<string, string>();
  private warned = false;
  private degraded = false;

  constructor(
    private readonly storage: StorageLike | null,
    private readonly onWarn?: (reason: 'unavailable' | 'write' | 'read') => void,
  ) {
    if (!storage) this.degrade('unavailable');
  }

  /** true se stiamo lavorando solo in memoria. */
  inMemory(): boolean {
    return this.degraded;
  }

  private degrade(reason: 'unavailable' | 'write' | 'read'): void {
    this.degraded = true;
    if (!this.warned) {
      this.warned = true;
      this.onWarn?.(reason);
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.memory.has(key)) return this.memory.get(key) ?? null;
    if (!this.storage) return null;
    try {
      return this.storage.getItem(key);
    } catch {
      this.degrade('read');
      return null;
    }
  }

  async set(key: string, v: string): Promise<void> {
    if (this.storage && !this.degraded) {
      try {
        this.storage.setItem(key, v);
        return;
      } catch {
        this.degrade('write');
      }
    } else if (this.storage) {
      // Riprova: lo spazio potrebbe essersi liberato.
      try {
        this.storage.setItem(key, v);
        this.memory.delete(key);
        return;
      } catch {
        /* resta in memoria */
      }
    }
    this.memory.set(key, v);
  }

  async remove(key: string): Promise<void> {
    this.memory.delete(key);
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch {
      this.degrade('write');
    }
  }
}

/** localStorage della finestra, se accessibile (l'accesso stesso può lanciare). */
export function safeLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__trama_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export class PreferencesBackend implements StorageBackend {
  private constructor(
    private readonly prefs: {
      get(o: { key: string }): Promise<{ value: string | null }>;
      set(o: { key: string; value: string }): Promise<void>;
      remove(o: { key: string }): Promise<void>;
    },
  ) {}

  static async create(): Promise<PreferencesBackend> {
    const mod = await import('@capacitor/preferences');
    return new PreferencesBackend(mod.Preferences);
  }

  async get(key: string): Promise<string | null> {
    const r = await this.prefs.get({ key });
    return r.value ?? null;
  }
  async set(key: string, v: string): Promise<void> {
    await this.prefs.set({ key, value: v });
  }
  async remove(key: string): Promise<void> {
    await this.prefs.remove({ key });
  }
}

/** Sceglie il backend: Preferences in nativo (con riserva su localStorage), localStorage sul web. */
export async function createStorageBackend(
  native: boolean,
  onWarn?: (reason: 'unavailable' | 'write' | 'read') => void,
): Promise<StorageBackend> {
  if (native) {
    try {
      return await PreferencesBackend.create();
    } catch (err) {
      console.warn('[save] Preferences unavailable, falling back to localStorage', err);
    }
  }
  return new LocalStorageBackend(safeLocalStorage(), onWarn);
}
