/**
 * Service worker per giocare senza rete dopo il primo caricamento (revisione 1,
 * SCH-08; GDD 0 «Offline: sempre»). `public/sw.js` mette in cache i file di
 * `precache.json` (generato dalla build, vedi vite.config.ts).
 *
 * Si registra solo sul web (nell'app nativa i file sono già nel pacchetto), non
 * in sviluppo e solo se la build ha scritto il suo identificativo in index.html
 * (`<meta name="trama-build">`). L'URL del worker porta versione e build
 * (`sw.js?v=1.0.0-ab12cd34ef56`): una build nuova installa un worker nuovo.
 */
export interface SwEnv {
  dev: boolean;
  native: boolean;
  version: string;
  doc?: Pick<Document, 'querySelector'> | null;
  nav?: { serviceWorker?: Pick<ServiceWorkerContainer, 'register'> } | null;
  protocol?: string;
}

/** L'URL con cui registrare il worker, o null se non si deve registrare. */
export function serviceWorkerUrl(env: SwEnv): string | null {
  if (env.dev || env.native) return null;
  if (!env.nav?.serviceWorker) return null;
  if (env.protocol && env.protocol !== 'https:' && env.protocol !== 'http:') return null;
  const build = env.doc?.querySelector('meta[name="trama-build"]')?.getAttribute('content') ?? '';
  if (!build) return null;
  return `sw.js?v=${encodeURIComponent(`${env.version}-${build}`)}`;
}

/** Registra il worker (senza mai lanciare). Restituisce l'URL usato, o null. */
export async function registerServiceWorker(env: SwEnv): Promise<string | null> {
  const url = serviceWorkerUrl(env);
  if (!url || !env.nav?.serviceWorker) return null;
  try {
    await env.nav.serviceWorker.register(url, { scope: './' });
    return url;
  } catch (err) {
    console.warn('[core] service worker not registered', err);
    return null;
  }
}
