// @vitest-environment happy-dom
/**
 * Piattaforma in nativo (Capacitor finto): la condivisione passa il PNG al plugin
 * Share come file nella cache dell'app (scritto con il plugin Filesystem), perché
 * il plugin non accetta Blob. Senza Filesystem si condivide almeno il testo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  shared: [] as Record<string, unknown>[],
  written: [] as { path: string; data: string; directory: string; recursive?: boolean }[],
  removed: [] as string[],
  shareError: null as Error | null,
  /** Errore solo quando la richiesta porta file (il FileProvider di Android che rifiuta il percorso). */
  fileShareError: null as Error | null,
  attempts: 0,
  writeError: null as Error | null,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}));
vi.mock('@capacitor/app', () => ({
  App: { addListener: async () => ({ remove: async () => undefined }), exitApp: () => undefined },
}));
vi.mock('@capacitor/screen-orientation', () => ({ ScreenOrientation: { lock: async () => undefined } }));
vi.mock('@capacitor/share', () => ({
  Share: {
    share: async (o: Record<string, unknown>) => {
      h.attempts++;
      if (h.shareError) throw h.shareError;
      if (h.fileShareError && Array.isArray(o.files) && o.files.length > 0) throw h.fileShareError;
      h.shared.push(o);
      return {};
    },
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    rmdir: async (o: { path: string }) => {
      h.removed.push(o.path);
    },
    writeFile: async (o: { path: string; data: string; directory: string; recursive?: boolean }) => {
      if (h.writeError) throw h.writeError;
      h.written.push(o);
      return { uri: `file:///data/user/0/it.trama.merletto/cache/${o.path}` };
    },
  },
}));

import { blobToBase64, createPlatform, shareFileName } from '../../../src/core/platform';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255, 128]);

beforeEach(() => {
  h.shared.length = 0;
  h.written.length = 0;
  h.removed.length = 0;
  h.shareError = null;
  h.fileShareError = null;
  h.attempts = 0;
  h.writeError = null;
  // La WebView di Android non ha la Web Share API.
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('condivisione in nativo', () => {
  it('il PNG va nella cache e il plugin Share lo riceve come file, con il testo', async () => {
    const p = await createPlatform(window);
    expect(p.native).toBe(true);
    expect(p.os).toBe('android');
    const file = new Blob([PNG], { type: 'image/png' });
    const ok = await p.share({ text: 'TRAMA 14/10 · 9 incroci (min 8)', title: 'Trama', file, fileName: 'trama-day-2026-10-14.png' });
    expect(ok).toBe(true);
    expect(h.removed).toEqual(['condivisi']);
    expect(h.written).toHaveLength(1);
    expect(h.written[0]).toMatchObject({ path: 'condivisi/trama-day-2026-10-14.png', directory: 'CACHE', recursive: true });
    // Dati in base64, senza intestazione data:.
    expect(h.written[0]!.data).toBe(btoa(String.fromCharCode(...PNG)));
    expect(h.shared).toEqual([
      {
        text: 'TRAMA 14/10 · 9 incroci (min 8)',
        title: 'Trama',
        dialogTitle: 'Trama',
        files: ['file:///data/user/0/it.trama.merletto/cache/condivisi/trama-day-2026-10-14.png'],
      },
    ]);
    p.destroy();
  });

  it('senza file: solo testo; se la scrittura non riesce si condivide comunque il testo', async () => {
    const p = await createPlatform(window);
    await expect(p.share({ text: 'solo testo' })).resolves.toBe(true);
    expect(h.shared.at(-1)).toEqual({ text: 'solo testo' });
    expect(h.written).toHaveLength(0);
    h.writeError = new Error('disk full');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(p.share({ text: 'con immagine', file: new Blob([PNG], { type: 'image/png' }) })).resolves.toBe(true);
    expect(h.shared.at(-1)).toEqual({ text: 'con immagine' });
    p.destroy();
  });

  it('annullato dal giocatore → false (il chiamante copia il testo), senza riaprire il foglio', async () => {
    const p = await createPlatform(window);
    h.shareError = new Error('Share canceled');
    await expect(p.share({ text: 'x', file: new Blob([PNG]) })).resolves.toBe(false);
    expect(h.attempts).toBe(1);
    h.shareError = new Error("Can't share while sharing is in progress");
    await expect(p.share({ text: 'x', file: new Blob([PNG]) })).resolves.toBe(false);
    expect(h.attempts).toBe(2);
    p.destroy();
  });

  it('il file non passa (FileProvider) → si riprova con il solo testo', async () => {
    const p = await createPlatform(window);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    h.fileShareError = new Error('Failed to find configured root that contains /data/data/x/cache/condivisi/t.png');
    await expect(p.share({ text: 'TRAMA', title: 'Trama', file: new Blob([PNG], { type: 'image/png' }), fileName: 't.png' })).resolves.toBe(true);
    expect(h.attempts).toBe(2);
    expect(h.shared).toEqual([{ text: 'TRAMA', title: 'Trama', dialogTitle: 'Trama' }]);
    // Anche il secondo tentativo non riesce: false, e basta (niente terzo tentativo).
    h.shareError = new Error('boom');
    h.attempts = 0;
    await expect(p.share({ text: 'TRAMA', file: new Blob([PNG]) })).resolves.toBe(false);
    expect(h.attempts).toBe(2);
    p.destroy();
  });

  it('plugin non registrato nel progetto nativo → si prova la Web Share API della WebView', async () => {
    const p = await createPlatform(window);
    h.shareError = new Error('"Share" plugin is not implemented on android');
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    await expect(p.share({ text: 'y' })).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ text: 'y' });
    // Riconosciuto anche dal codice dell'eccezione di Capacitor, qualunque sia il messaggio.
    h.shareError = Object.assign(new Error('missing'), { code: 'UNIMPLEMENTED' });
    await expect(p.share({ text: 'z' })).resolves.toBe(true);
    expect(share).toHaveBeenLastCalledWith({ text: 'z' });
    // Senza Web Share API nella WebView: false (il chiamante copia il testo).
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    await expect(p.share({ text: 'w' })).resolves.toBe(false);
    p.destroy();
  });
});

describe('aiuti della condivisione', () => {
  it('base64 di un Blob grande (a pezzi) e nomi di file sicuri', async () => {
    const big = new Uint8Array(100_000).map((_, i) => (i * 7) & 255);
    const b64 = await blobToBase64(new Blob([big]));
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(back).toEqual(big);
    expect(shareFileName('trama-g00.png')).toBe('trama-g00.png');
    expect(shareFileName('../x/y z.png')).toBe('x-y-z.png');
    expect(shareFileName(undefined)).toBe('trama.png');
    expect(shareFileName('...')).toBe('trama.png');
  });
});
