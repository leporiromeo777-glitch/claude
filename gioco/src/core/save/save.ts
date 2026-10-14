/**
 * Servizio dei salvataggi (ARCHITETTURA 9).
 *
 * - Involucro `{ "v": 1, "sum": "<fnv1a32 esadecimale>", "data": {…} }`; il
 *   checksum è calcolato su `JSON.stringify(data)`.
 * - Due slot alternati, `trama.v1.a` e `trama.v1.b`, più `trama.v1.ultimo` con il
 *   nome dell'ultimo slot scritto. In lettura si prende lo slot valido più
 *   recente (writtenAt, a parità quello indicato da `ultimo`); se è corrotto, l'altro.
 * - Scritture normali raggruppate (al massimo una ogni 2 s); quelle con
 *   `immediate: true` partono subito. Le scritture sono in fila: mai due insieme.
 * - Esporta / Importa: `TRAMA-SAVE-1:` + base64url dell'involucro JSON. L'interfaccia
 *   è sincrona (SaveService), quindi la stringa non è compressa:
 *   CompressionStream è solo asincrono. L'import verifica prefisso, checksum e
 *   schema prima di sostituire i dati (la conferma la chiede l'interfaccia).
 */
import type { EventBus, GameEventMap, SaveData, SaveService, StorageBackend, Unsub } from '../types';
import { fnv1a32Hex } from './checksum';
import { migrate, type Migration, migrations as defaultMigrations } from './migrate';
import { normalizeSave } from './defaults';

export const SAVE_KEYS = { a: 'trama.v1.a', b: 'trama.v1.b', ultimo: 'trama.v1.ultimo' } as const;
export const EXPORT_PREFIX = 'TRAMA-SAVE-1:';
export const WRITE_THROTTLE_MS = 2000;

export type Slot = 'a' | 'b';
export type ReplaceReason = 'load' | 'import' | 'wipe';

export interface Envelope {
  v: 1;
  sum: string;
  data: unknown;
}

export function wrapSave(data: unknown): string {
  const json = JSON.stringify(data);
  return `{"v":1,"sum":"${fnv1a32Hex(json)}","data":${json}}`;
}

export type UnwrapResult = { ok: true; data: unknown } | { ok: false; reason: 'json' | 'formato' | 'checksum' };

export function unwrapSave(text: string | null | undefined): UnwrapResult {
  if (!text) return { ok: false, reason: 'formato' };
  let env: unknown;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json' };
  }
  if (!env || typeof env !== 'object') return { ok: false, reason: 'formato' };
  const e = env as Partial<Envelope>;
  if (e.v !== 1 || typeof e.sum !== 'string' || e.data === undefined || e.data === null || typeof e.data !== 'object') {
    return { ok: false, reason: 'formato' };
  }
  if (fnv1a32Hex(JSON.stringify(e.data)) !== e.sum.toLowerCase()) return { ok: false, reason: 'checksum' };
  return { ok: true, data: e.data };
}

// ───────── base64url su UTF-8 ─────────
function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function toBase64Url(s: string): string {
  const bytes = utf8Encode(s);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): string | null {
  const clean = s.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9_-]*$/.test(clean)) return null;
  const b64 = clean.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((clean.length + 3) % 4);
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export interface SaveServiceDeps {
  backend: StorageBackend;
  /** Un salvataggio vuoto nuovo (impostazioni predefinite comprese). */
  defaults: () => SaveData;
  gameVersion: string;
  bus?: EventBus<GameEventMap>;
  migrations?: Record<number, Migration>;
  /** Orologio per la limitazione delle scritture (ms). */
  now?: () => number;
  /** Data per writtenAt. */
  clock?: () => Date;
  throttleMs?: number;
  /** Chiamata quando i dati sono sostituiti in blocco (caricamento, import, cancellazione). */
  onReplaced?: (d: SaveData, reason: ReplaceReason) => void;
  /** Avvisi per il giocatore: chiave i18n del namespace core. */
  onWarn?: (textKey: string) => void;
}

export interface CoreSaveService extends SaveService {
  /** Registra una funzione chiamata subito prima di ogni scrittura (per esempio il tempo di gioco). */
  onBeforeWrite(fn: (d: SaveData) => void): Unsub;
  /** Segna i dati come modificati e programma una scrittura (raggruppata o immediata). */
  request(immediate?: boolean): void;
  lastSlot(): Slot | null;
  nextSlot(): Slot;
  loadedFrom(): Slot | null;
  writes(): number;
  isDirty(): boolean;
  loaded(): boolean;
}

export function createSaveService(deps: SaveServiceDeps): CoreSaveService {
  const now = deps.now ?? (() => Date.now());
  const clock = deps.clock ?? (() => new Date());
  const throttle = deps.throttleMs ?? WRITE_THROTTLE_MS;
  const table = deps.migrations ?? defaultMigrations;
  const backend = deps.backend;

  let data: SaveData = deps.defaults();
  let isLoaded = false;
  let dirty = false;
  let last: Slot | null = null;
  let next: Slot = 'a';
  let from: Slot | null = null;
  let lastWriteAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let chain: Promise<void> = Promise.resolve();
  let writeCount = 0;
  const before: ((d: SaveData) => void)[] = [];

  /** Porta un oggetto grezzo (già estratto dall'involucro) allo schema corrente. */
  function decode(raw: unknown): { ok: true; data: SaveData } | { ok: false; error: 'futuro' | 'nonValido' } {
    const m = migrate(raw, table);
    if (!m.ok) return { ok: false, error: m.error === 'futuro' ? 'futuro' : 'nonValido' };
    const d = m.data as Record<string, unknown>;
    if (d.app !== undefined && d.app !== 'trama') return { ok: false, error: 'nonValido' };
    return { ok: true, data: normalizeSave(m.data, deps.defaults()) };
  }

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  async function writeNow(): Promise<void> {
    if (!dirty) return;
    dirty = false;
    for (const fn of before.slice()) {
      try {
        fn(data);
      } catch (err) {
        console.error('[save] beforeWrite error', err);
      }
    }
    data.writtenAt = clock().toISOString();
    data.gameVersion = deps.gameVersion;
    const text = wrapSave(data);
    const slot = next;
    try {
      await backend.set(SAVE_KEYS[slot], text);
      await backend.set(SAVE_KEYS.ultimo, slot);
    } catch (err) {
      console.warn('[save] write failed', err);
      dirty = true;
      return;
    }
    last = slot;
    next = slot === 'a' ? 'b' : 'a';
    lastWriteAt = now();
    writeCount++;
    let bytes = text.length;
    try {
      bytes = utf8Encode(text).length;
    } catch {
      /* lunghezza approssimata */
    }
    deps.bus?.emit('save:written', { slot, bytes });
  }

  function flush(): Promise<void> {
    clearTimer();
    chain = chain.then(writeNow, writeNow);
    return chain;
  }

  function schedule(): void {
    if (timer !== null) return;
    const delay = Math.max(0, lastWriteAt + throttle - now());
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, Number.isFinite(delay) ? delay : 0);
  }

  function request(immediate = false): void {
    dirty = true;
    if (immediate) void flush();
    else schedule();
  }

  deps.bus?.on('save:request', (p) => request(!!p.immediate));

  const service: CoreSaveService = {
    async load() {
      await chain;
      // Un backend che lancia in lettura (plugin nativo assente o rotto) non deve
      // impedire l'avvio: quella chiave vale come assente.
      const read = async (key: string): Promise<string | null> => {
        try {
          return await backend.get(key);
        } catch (err) {
          console.warn('[save] read failed', key, err);
          return null;
        }
      };
      const [ra, rb, ru] = await Promise.all([read(SAVE_KEYS.a), read(SAVE_KEYS.b), read(SAVE_KEYS.ultimo)]);
      const ultimo: Slot | null = ru === 'a' || ru === 'b' ? ru : null;
      const found: { slot: Slot; data: SaveData }[] = [];
      let corrupted = 0;
      for (const [slot, raw] of [['a', ra], ['b', rb]] as const) {
        if (raw === null || raw === undefined) continue;
        const u = unwrapSave(raw);
        const d = u.ok ? decode(u.data) : null;
        if (d && d.ok) found.push({ slot, data: d.data });
        else corrupted++;
      }
      found.sort((x, y) => {
        if (x.data.writtenAt !== y.data.writtenAt) return x.data.writtenAt < y.data.writtenAt ? 1 : -1;
        return x.slot === ultimo ? -1 : y.slot === ultimo ? 1 : 0;
      });
      const best = found[0];
      if (best) {
        data = best.data;
        from = best.slot;
        last = best.slot;
        next = best.slot === 'a' ? 'b' : 'a';
        if (corrupted > 0) deps.onWarn?.('core.save.corrotto');
      } else {
        data = deps.defaults();
        from = null;
        last = null;
        next = 'a';
        if (corrupted > 0) deps.onWarn?.('core.save.perso');
      }
      dirty = false;
      isLoaded = true;
      deps.onReplaced?.(data, 'load');
      return data;
    },
    data: () => data,
    update(mut, opts) {
      mut(data);
      request(!!opts?.immediate);
    },
    flush,
    exportString() {
      return EXPORT_PREFIX + toBase64Url(wrapSave(data));
    },
    importString(s) {
      const t = (s ?? '').trim();
      if (!t.startsWith(EXPORT_PREFIX)) return { ok: false, errorKey: 'core.save.import.formato' };
      const text = fromBase64Url(t.slice(EXPORT_PREFIX.length));
      if (text === null) return { ok: false, errorKey: 'core.save.import.formato' };
      const u = unwrapSave(text);
      if (!u.ok) {
        return { ok: false, errorKey: u.reason === 'checksum' ? 'core.save.import.checksum' : 'core.save.import.formato' };
      }
      const d = decode(u.data);
      if (!d.ok) {
        return { ok: false, errorKey: d.error === 'futuro' ? 'core.save.import.versione' : 'core.save.import.formato' };
      }
      clearTimer();
      data = d.data;
      deps.onReplaced?.(data, 'import');
      request(true);
      return { ok: true };
    },
    async wipe() {
      clearTimer();
      dirty = false;
      await chain;
      await backend.remove(SAVE_KEYS.a);
      await backend.remove(SAVE_KEYS.b);
      await backend.remove(SAVE_KEYS.ultimo);
      data = deps.defaults();
      last = null;
      from = null;
      next = 'a';
      deps.onReplaced?.(data, 'wipe');
    },
    onBeforeWrite(fn) {
      before.push(fn);
      return () => {
        const i = before.indexOf(fn);
        if (i >= 0) before.splice(i, 1);
      };
    },
    request,
    lastSlot: () => last,
    nextSlot: () => next,
    loadedFrom: () => from,
    writes: () => writeCount,
    isDirty: () => dirty,
    loaded: () => isLoaded,
  };
  return service;
}
