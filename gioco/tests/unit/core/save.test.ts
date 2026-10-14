import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../../src/core/types';
import { fnv1a32, fnv1a32Hex } from '../../../src/core/save/checksum';
import { LocalStorageBackend, MemoryBackend, type StorageLike } from '../../../src/core/save/backends';
import { CURRENT_SCHEMA, migrate, migrations, schemaOf, type Migration } from '../../../src/core/save/migrate';
import { defaultSaveData, normalizeSave } from '../../../src/core/save/defaults';
import {
  createSaveService,
  EXPORT_PREFIX,
  fromBase64Url,
  SAVE_KEYS,
  toBase64Url,
  unwrapSave,
  wrapSave,
  WRITE_THROTTLE_MS,
} from '../../../src/core/save/save';
import { createBus } from '../../../src/core/events';
import type { GameEventMap } from '../../../src/core/types';

const defaults = (): SaveData => defaultSaveData('1.0.0');

function makeService(backend = new MemoryBackend(), extra: Partial<Parameters<typeof createSaveService>[0]> = {}) {
  let clockMs = Date.UTC(2026, 9, 14, 10, 0, 0);
  const bus = createBus<GameEventMap>();
  const svc = createSaveService({
    backend,
    defaults,
    gameVersion: '1.0.0',
    bus,
    clock: () => new Date((clockMs += 1000)),
    ...extra,
  });
  return { svc, backend, bus };
}

describe('checksum FNV-1a', () => {
  it('vettori di riferimento', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5');
    expect(fnv1a32Hex('a')).toBe('e40c292c');
    expect(fnv1a32Hex('foobar')).toBe('bf9cf968');
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });
});

describe('involucro', () => {
  it('wrap/unwrap e rilevamento della corruzione', () => {
    const d = defaults();
    const text = wrapSave(d);
    const u = unwrapSave(text);
    expect(u.ok && u.data).toEqual(d);
    const env = JSON.parse(text) as { data: SaveData };
    env.data.stats.nights = 99;
    expect(unwrapSave(JSON.stringify(env))).toEqual({ ok: false, reason: 'checksum' });
    expect(unwrapSave(text.slice(0, 40))).toEqual({ ok: false, reason: 'json' });
    expect(unwrapSave('{"v":2}')).toEqual({ ok: false, reason: 'formato' });
    expect(unwrapSave(null)).toEqual({ ok: false, reason: 'formato' });
  });

  it('base64url andata e ritorno, anche con lettere accentate', () => {
    const s = 'Città, perché, “virgolette” ✦';
    expect(fromBase64Url(toBase64Url(s))).toBe(s);
    expect(toBase64Url(s)).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(fromBase64Url('***')).toBeNull();
  });
});

describe('slot alternati', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('le scritture si alternano a, b, a e "ultimo" indica lo slot più recente', async () => {
    const { svc, backend, bus } = makeService();
    const written: string[] = [];
    bus.on('save:written', (p) => written.push(p.slot));
    await svc.load();
    svc.update((d) => (d.stats.nights = 1), { immediate: true });
    await svc.flush();
    svc.update((d) => (d.stats.nights = 2), { immediate: true });
    await svc.flush();
    svc.update((d) => (d.stats.nights = 3), { immediate: true });
    await svc.flush();
    expect(written).toEqual(['a', 'b', 'a']);
    expect(backend.map.get(SAVE_KEYS.ultimo)).toBe('a');
    const a = unwrapSave(backend.map.get(SAVE_KEYS.a));
    const b = unwrapSave(backend.map.get(SAVE_KEYS.b));
    expect(a.ok && (a.data as SaveData).stats.nights).toBe(3);
    expect(b.ok && (b.data as SaveData).stats.nights).toBe(2);
  });

  it('al caricamento prende lo slot più recente; se è corrotto, l’altro', async () => {
    const { svc, backend } = makeService();
    await svc.load();
    svc.update((d) => (d.stats.nights = 1), { immediate: true });
    await svc.flush();
    svc.update((d) => (d.stats.nights = 2), { immediate: true });
    await svc.flush(); // b è il più recente

    const fresh = makeService(backend).svc;
    expect((await fresh.load()).stats.nights).toBe(2);
    expect(fresh.loadedFrom()).toBe('b');
    expect(fresh.nextSlot()).toBe('a');

    // Si rovina lo slot b (il più recente): si riprende a.
    backend.map.set(SAVE_KEYS.b, backend.map.get(SAVE_KEYS.b)!.replace('"nights":2', '"nights":7'));
    const warn = vi.fn();
    const again = makeService(backend, { onWarn: warn }).svc;
    expect((await again.load()).stats.nights).toBe(1);
    expect(again.loadedFrom()).toBe('a');
    expect(warn).toHaveBeenCalledWith('core.save.corrotto');
    // La prossima scrittura va sullo slot rovinato, non su quello buono.
    expect(again.nextSlot()).toBe('b');
  });

  it('entrambi gli slot rovinati → salvataggio nuovo e avviso', async () => {
    const backend = new MemoryBackend();
    backend.map.set(SAVE_KEYS.a, '{"v":1,"sum":"00000000","data":{}}');
    backend.map.set(SAVE_KEYS.b, 'non è json');
    const warn = vi.fn();
    const { svc } = makeService(backend, { onWarn: warn });
    const d = await svc.load();
    expect(d).toEqual(defaults());
    expect(warn).toHaveBeenCalledWith('core.save.perso');
  });

  it('un backend che lancia in lettura non blocca l’avvio: la chiave vale come assente', async () => {
    const good = makeService();
    await good.svc.load();
    good.svc.update((d) => (d.stats.nights = 4), { immediate: true });
    await good.svc.flush(); // slot a
    const flaky = new MemoryBackend();
    for (const [k, v] of good.backend.map) flaky.map.set(k, v);
    const origGet = flaky.get.bind(flaky);
    flaky.get = async (key: string) => {
      if (key === SAVE_KEYS.b || key === SAVE_KEYS.ultimo) throw new Error('plugin non disponibile');
      return origGet(key);
    };
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { svc } = makeService(flaky);
    expect((await svc.load()).stats.nights).toBe(4);
    expect(svc.loadedFrom()).toBe('a');
  });

  it('le scritture normali sono raggruppate: al massimo una ogni 2 s', async () => {
    const { svc, bus } = makeService(new MemoryBackend(), { now: () => Date.now() });
    let writes = 0;
    bus.on('save:written', () => writes++);
    await svc.load();
    svc.update((d) => (d.stats.nights = 1));
    svc.update((d) => (d.stats.nights = 2));
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toBe(1);
    svc.update((d) => (d.stats.nights = 3));
    svc.update((d) => (d.stats.nights = 4));
    await vi.advanceTimersByTimeAsync(WRITE_THROTTLE_MS - 100);
    expect(writes).toBe(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(writes).toBe(2);
    // immediate: subito, senza aspettare
    svc.update((d) => (d.stats.nights = 5), { immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toBe(3);
  });

  it('save:request dal bus programma una scrittura', async () => {
    const { svc, bus } = makeService();
    let writes = 0;
    bus.on('save:written', () => writes++);
    await svc.load();
    bus.emit('save:request', { reason: 'test', immediate: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toBe(1);
  });

  it('onBeforeWrite può aggiornare i dati prima di ogni scrittura', async () => {
    const { svc, backend } = makeService();
    await svc.load();
    svc.onBeforeWrite((d) => (d.stats.playMs += 500));
    svc.request(true);
    await svc.flush();
    const a = unwrapSave(backend.map.get(SAVE_KEYS.a));
    expect(a.ok && (a.data as SaveData).stats.playMs).toBe(500);
  });
});

describe('migrazioni', () => {
  it('schemaOf', () => {
    expect(schemaOf({})).toBe(0);
    expect(schemaOf({ schema: 1 })).toBe(1);
    expect(schemaOf({ schema: 'x' })).toBe(-1);
    expect(schemaOf(null)).toBe(-1);
    expect(CURRENT_SCHEMA).toBe(1);
  });

  it('migrazione v0 → v1 della tabella reale', () => {
    const v0 = { version: 0, settings: { textScale: 1.2, locale: 'en' }, stats: { nights: 4 } };
    const m = migrate(v0, migrations);
    expect(m.ok).toBe(true);
    const d = normalizeSave(m.ok ? m.data : null, defaults());
    expect(d.schema).toBe(1);
    expect(d.settings.textScale).toBe(1.2);
    expect(d.settings.locale).toBe('en');
    expect(d.stats.nights).toBe(4);
    expect(d.knowledge.quirks).toEqual([]);
  });

  it('migrazione fittizia v0 → v1 applicata al caricamento', async () => {
    const fake: Record<number, Migration> = {
      0: (old) => {
        const o = old as { notti: number };
        return { schema: 1, app: 'trama', stats: { nights: o.notti } };
      },
    };
    const backend = new MemoryBackend();
    backend.map.set(SAVE_KEYS.a, wrapSave({ notti: 12 }));
    const { svc } = makeService(backend, { migrations: fake });
    const d = await svc.load();
    expect(d.stats.nights).toBe(12);
    expect(d.schema).toBe(1);
  });

  it('uno schema futuro o una migrazione mancante sono rifiutati', () => {
    expect(migrate({ schema: 5 })).toEqual({ ok: false, error: 'futuro', from: 5 });
    expect(migrate({}, {}, 1)).toEqual({ ok: false, error: 'mancante', from: 0 });
    expect(migrate({}, { 0: () => ({ schema: 3 }) }, 1)).toEqual({ ok: false, error: 'nonValido', from: 0 });
  });
});

describe('esporta e importa', () => {
  it('andata e ritorno: dati identici', async () => {
    const { svc } = makeService();
    await svc.load();
    svc.update((d) => {
      d.stats.nights = 7;
      d.knowledge.quirks.push('martaNoSotto');
      d.settings.textScale = 1.3;
      d.records.g00 = { minIncroci: 4, maxQuiete: 0, simmetria: true, filoDOro: true, bestSpartito: 'TRAMA1-Sg00-x' };
    });
    const s = svc.exportString();
    expect(s.startsWith(EXPORT_PREFIX)).toBe(true);
    const before = structuredClone(svc.data());

    const other = makeService().svc;
    await other.load();
    expect(other.importString(s)).toEqual({ ok: true });
    expect(other.data()).toEqual(before);
    await other.flush();
  });

  it('import rifiutato: prefisso, base64, checksum, schema futuro', async () => {
    const { svc } = makeService();
    await svc.load();
    expect(svc.importString('ciao')).toEqual({ ok: false, errorKey: 'core.save.import.formato' });
    expect(svc.importString(`${EXPORT_PREFIX}@@@`)).toEqual({ ok: false, errorKey: 'core.save.import.formato' });
    const good = svc.exportString();
    const env = JSON.parse(fromBase64Url(good.slice(EXPORT_PREFIX.length))!) as { sum: string };
    env.sum = '12345678';
    expect(svc.importString(EXPORT_PREFIX + toBase64Url(JSON.stringify(env)))).toEqual({
      ok: false,
      errorKey: 'core.save.import.checksum',
    });
    const future = EXPORT_PREFIX + toBase64Url(wrapSave({ ...defaults(), schema: 9 }));
    expect(svc.importString(future)).toEqual({ ok: false, errorKey: 'core.save.import.versione' });
    // Il salvataggio corrente non è cambiato.
    expect(svc.data()).toEqual(defaults());
  });

  it('wipe cancella gli slot e torna ai valori predefiniti', async () => {
    const { svc, backend } = makeService();
    await svc.load();
    svc.update((d) => (d.stats.nights = 3), { immediate: true });
    await svc.flush();
    await svc.wipe();
    expect(backend.map.size).toBe(0);
    expect(svc.data()).toEqual(defaults());
  });
});

describe('localStorage che lancia eccezioni', () => {
  function throwingStorage(mode: 'all' | 'write'): StorageLike & { calls: number } {
    const store = new Map<string, string>();
    return {
      calls: 0,
      getItem(k) {
        this.calls++;
        if (mode === 'all') throw new Error('SecurityError');
        return store.get(k) ?? null;
      },
      setItem(k, v) {
        this.calls++;
        if (v.length > 0) throw new Error('QuotaExceededError');
        store.set(k, v);
      },
      removeItem() {
        this.calls++;
        if (mode === 'all') throw new Error('SecurityError');
      },
    };
  }

  it('spazio pieno: si continua in memoria e si avvisa una volta sola', async () => {
    const onWarn = vi.fn();
    const backend = new LocalStorageBackend(throwingStorage('write'), onWarn);
    const { svc } = makeService(backend as unknown as MemoryBackend);
    await svc.load();
    svc.update((d) => (d.stats.nights = 1), { immediate: true });
    await svc.flush();
    svc.update((d) => (d.stats.nights = 2), { immediate: true });
    await svc.flush();
    expect(onWarn).toHaveBeenCalledTimes(1);
    expect(backend.inMemory()).toBe(true);
    // I dati restano leggibili dalla memoria.
    const reread = makeService(backend as unknown as MemoryBackend).svc;
    expect((await reread.load()).stats.nights).toBe(2);
  });

  it('storage inaccessibile (navigazione privata): nessuna eccezione', async () => {
    const onWarn = vi.fn();
    const backend = new LocalStorageBackend(throwingStorage('all'), onWarn);
    const { svc } = makeService(backend as unknown as MemoryBackend);
    await expect(svc.load()).resolves.toEqual(defaults());
    svc.update((d) => (d.stats.nights = 4), { immediate: true });
    await expect(svc.flush()).resolves.toBeUndefined();
    await expect(svc.wipe()).resolves.toBeUndefined();
    expect(onWarn).toHaveBeenCalledTimes(1);
  });

  it('storage assente', async () => {
    const onWarn = vi.fn();
    const backend = new LocalStorageBackend(null, onWarn);
    expect(onWarn).toHaveBeenCalledWith('unavailable');
    await backend.set('k', 'v');
    expect(await backend.get('k')).toBe('v');
  });
});

describe('normalizeSave', () => {
  it('completa i campi mancanti e scarta quelli sbagliati', () => {
    const d = normalizeSave(
      { settings: { textScale: 9, animSpeed: 3, volume: { master: 2 } }, knowledge: { quirks: ['a', 3] }, unlocks: { daily: 'sì' } },
      defaults(),
    );
    expect(d.settings.textScale).toBe(1.4);
    expect(d.settings.animSpeed).toBe(1);
    expect(d.settings.volume.master).toBe(1);
    expect(d.knowledge.quirks).toEqual(['a']);
    expect(d.unlocks.daily).toBe(false);
    expect(d.campaign).toBeNull();
  });
});
