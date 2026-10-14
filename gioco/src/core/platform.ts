/**
 * Piattaforma (ARCHITETTURA 5.1, 13; GDD 11.4).
 *
 * Web o Capacitor: pausa e ripresa (visibilitychange, pagehide/pageshow, eventi
 * pause/resume dell'app), tasto Indietro di Android, condivisione, copia, splash,
 * schermo sempre acceso, blocco verticale sui telefoni Android (lato corto < 600 dp).
 * I plugin nativi si importano dinamicamente solo in nativo: sul web nessuno di
 * quei moduli viene scaricato.
 *
 * Condivisione (GDD 8.3): sul web la Web Share API (testo e, se il browser lo
 * accetta, il PNG); in nativo il plugin Share, che vuole i file su disco: il PNG
 * si scrive nella cache dell'app con il plugin Filesystem e si passa il suo URI.
 */
import { Capacitor } from '@capacitor/core';
import type { Platform, Unsub } from './types';

export interface CorePlatform extends Platform {
  /** L'app è in primo piano? */
  active(): boolean;
  /** Esegue la catena dei gestori di Indietro (dal più recente). true se gestito. */
  triggerBack(): boolean;
  destroy(): void;
}

/** Lato corto sotto il quale un dispositivo Android è un telefono (dp). */
export const PHONE_SHORT_SIDE_DP = 600;
/** Cartella (nella cache dell'app) dei file da condividere in nativo. */
export const SHARE_DIR = 'condivisi';

/** Contenuto di un Blob in base64 (il plugin Filesystem in nativo non accetta Blob). */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

/** Nome di file sicuro per la cache (niente cartelle, niente caratteri strani). */
export function shareFileName(name: string | undefined): string {
  const clean = (name ?? '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '');
  return clean || 'trama.png';
}

/**
 * Scrive il file da condividere nella cache dell'app (solo nativo) e ne dà l'URI
 * file://. I file delle condivisioni precedenti si cancellano prima: nella cache
 * ne resta al massimo uno. null se il plugin manca o la scrittura non riesce
 * (si condivide allora solo il testo).
 */
export async function writeShareFile(blob: Blob, name: string | undefined): Promise<string | null> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const data = await blobToBase64(blob);
    await Filesystem.rmdir({ path: SHARE_DIR, directory: Directory.Cache, recursive: true }).catch(() => undefined);
    const res = await Filesystem.writeFile({ path: `${SHARE_DIR}/${shareFileName(name)}`, data, directory: Directory.Cache, recursive: true });
    return res.uri || null;
  } catch (err) {
    console.warn('[platform] share file unavailable', err);
    return null;
  }
}

type ShareRequest = Parameters<Platform['share']>[0];

/**
 * Foglio di condivisione nativo (plugin Share), con il PNG come file.
 * 'assente' se il plugin non c'è: si prova allora la Web Share API della WebView.
 */
async function shareWithPlugin(o: ShareRequest): Promise<'condiviso' | 'no' | 'assente'> {
  let plugin: typeof import('@capacitor/share');
  try {
    plugin = await import('@capacitor/share');
  } catch {
    return 'assente';
  }
  const opts: import('@capacitor/share').ShareOptions = { text: o.text };
  if (o.title) {
    opts.title = o.title;
    opts.dialogTitle = o.title;
  }
  if (o.file) {
    const uri = await writeShareFile(o.file, o.fileName);
    if (uri) opts.files = [uri];
  }
  const attempt = async (): Promise<'condiviso' | 'annullato' | 'assente' | 'errore'> => {
    try {
      await plugin.Share.share(opts);
      return 'condiviso';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: unknown } | null)?.code;
      if (code === 'UNIMPLEMENTED' || /not implemented|unimplemented/i.test(msg)) return 'assente';
      // Annullato dal giocatore ("Share canceled") o un'altra condivisione già aperta.
      if (/cancel|in progress/i.test(msg)) return 'annullato';
      return 'errore';
    }
  };
  let r = await attempt();
  if (r === 'errore' && opts.files) {
    // Il file non è passato (per esempio il FileProvider di Android lo rifiuta):
    // si condivide almeno il testo, invece di arrendersi.
    console.warn('[platform] share with file failed, retrying with text only');
    delete opts.files;
    r = await attempt();
  }
  if (r === 'condiviso' || r === 'assente') return r;
  // Annullato o non riuscito: il chiamante copia il testo.
  return 'no';
}

function list<T>(): { add(fn: T): Unsub; all(): T[] } {
  const fns: T[] = [];
  return {
    add(fn) {
      fns.push(fn);
      return () => {
        const i = fns.indexOf(fn);
        if (i >= 0) fns.splice(i, 1);
      };
    },
    all: () => fns.slice(),
  };
}

function detectOs(): { native: boolean; os: Platform['os'] } {
  try {
    const native = Capacitor.isNativePlatform();
    const p = Capacitor.getPlatform();
    return { native, os: native && (p === 'ios' || p === 'android') ? p : 'web' };
  } catch {
    return { native: false, os: 'web' };
  }
}

export async function createPlatform(win: Window | null): Promise<CorePlatform> {
  const { native, os } = detectOs();
  const pauseFns = list<() => void>();
  const resumeFns = list<() => void>();
  const backFns = list<() => boolean>();
  const cleanups: (() => void)[] = [];
  let isActive = !win || win.document.visibilityState !== 'hidden';
  let wakeLock: { release(): Promise<void> } | null = null;
  let wantAwake = false;

  function call(fns: (() => void)[]): void {
    for (const fn of fns) {
      try {
        fn();
      } catch (err) {
        console.error('[platform] listener error', err);
      }
    }
  }

  function setActive(on: boolean): void {
    if (on === isActive) return;
    isActive = on;
    call(on ? resumeFns.all() : pauseFns.all());
    if (on && wantAwake) void acquireWebWakeLock();
  }

  async function acquireWebWakeLock(): Promise<void> {
    if (native || !win) return;
    try {
      const nav = win.navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } };
      if (!nav.wakeLock || win.document.visibilityState !== 'visible') return;
      wakeLock = await nav.wakeLock.request('screen');
    } catch {
      wakeLock = null;
    }
  }

  function triggerBack(): boolean {
    for (const fn of backFns.all().reverse()) {
      try {
        if (fn()) return true;
      } catch (err) {
        console.error('[platform] back handler error', err);
      }
    }
    return false;
  }

  if (win) {
    const onVis = (): void => setActive(win.document.visibilityState !== 'hidden');
    const onHide = (): void => setActive(false);
    const onShow = (): void => {
      if (win.document.visibilityState !== 'hidden') setActive(true);
    };
    win.document.addEventListener('visibilitychange', onVis);
    win.addEventListener('pagehide', onHide);
    win.addEventListener('pageshow', onShow);
    cleanups.push(() => {
      win.document.removeEventListener('visibilitychange', onVis);
      win.removeEventListener('pagehide', onHide);
      win.removeEventListener('pageshow', onShow);
    });
  }

  if (native) {
    try {
      const { App } = await import('@capacitor/app');
      const handles = await Promise.all([
        App.addListener('pause', () => setActive(false)),
        App.addListener('resume', () => setActive(true)),
        App.addListener('backButton', () => {
          triggerBack();
        }),
      ]);
      cleanups.push(() => {
        for (const h of handles) void h.remove();
      });
    } catch (err) {
      console.warn('[platform] App plugin unavailable', err);
    }
    if (os === 'android' && win) {
      const shortSide = Math.min(win.screen.width, win.screen.height);
      if (shortSide > 0 && shortSide < PHONE_SHORT_SIDE_DP) {
        try {
          const { ScreenOrientation } = await import('@capacitor/screen-orientation');
          await ScreenOrientation.lock({ orientation: 'portrait' });
        } catch (err) {
          console.warn('[platform] orientation lock failed', err);
        }
      }
    }
  }

  const platform: CorePlatform = {
    native,
    os,
    onPause: (fn) => pauseFns.add(fn),
    onResume: (fn) => resumeFns.add(fn),
    onBack: (fn) => backFns.add(fn),
    exitApp() {
      if (!native) return;
      void import('@capacitor/app').then(({ App }) => App.exitApp()).catch(() => undefined);
    },
    keepAwake(on) {
      wantAwake = on;
      if (native) {
        void import('@capacitor-community/keep-awake')
          .then(({ KeepAwake }) => (on ? KeepAwake.keepAwake() : KeepAwake.allowSleep()))
          .catch(() => undefined);
        return;
      }
      if (on) void acquireWebWakeLock();
      else if (wakeLock) {
        const w = wakeLock;
        wakeLock = null;
        void w.release().catch(() => undefined);
      }
    },
    async share(o) {
      if (native) {
        const r = await shareWithPlugin(o);
        if (r !== 'assente') return r === 'condiviso';
      }
      const nav = win?.navigator;
      if (nav && typeof nav.share === 'function') {
        const data: ShareData = { text: o.text };
        if (o.title) data.title = o.title;
        if (o.file) {
          try {
            const f = new File([o.file], o.fileName ?? 'trama.png', { type: o.file.type || 'image/png' });
            if (typeof nav.canShare === 'function' && nav.canShare({ files: [f] })) data.files = [f];
          } catch {
            /* condivisione senza immagine */
          }
        }
        try {
          await nav.share(data);
          return true;
        } catch {
          // Annullato (AbortError) o rifiutato: il chiamante copia il testo.
          return false;
        }
      }
      return false;
    },
    async copy(text) {
      const nav = win?.navigator;
      try {
        if (nav?.clipboard && typeof nav.clipboard.writeText === 'function') {
          await nav.clipboard.writeText(text);
          return true;
        }
      } catch {
        /* si prova con il metodo vecchio */
      }
      if (!win) return false;
      const doc = win.document;
      const ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      doc.body.appendChild(ta);
      try {
        ta.select();
        // execCommand è deprecato ma è l'unica riserva dove l'API Clipboard manca.
        return doc.execCommand('copy');
      } catch {
        return false;
      } finally {
        ta.remove();
      }
    },
    hideSplash() {
      if (!native) return;
      void import('@capacitor/splash-screen')
        .then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 }))
        .catch(() => undefined);
    },
    active: () => isActive,
    triggerBack,
    destroy() {
      for (const c of cleanups.splice(0)) c();
    },
  };
  return platform;
}
