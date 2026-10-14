/*
 * TRAMA, service worker (revisione 1, SCH-08; GDD 0 «Offline: sempre»).
 *
 * - Registrato da main.ts solo sul web e non in sviluppo, come `sw.js?v=<versione>-<build>`:
 *   la cache si chiama `trama-<versione>-<build>`, ogni build nuova ne fa una nuova
 *   e cancella le vecchie.
 * - All'installazione mette in cache i file di `precache.json` (index, chunk, CSS,
 *   font, Worker, assets/manifest.json e i file che elenca, icone): dopo il primo
 *   caricamento il gioco funziona senza rete.
 * - Richieste: solo quelle della stessa origine (nessuna richiesta esterna).
 *   Pagine (navigazione): prima la rete, la cache se manca; tutto il resto: prima
 *   la cache, la rete come ripiego (e la risposta va in cache).
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'senza-versione';
const CACHE = `trama-${VERSION}`;
const SCOPE = self.registration.scope;

async function precache() {
  const res = await fetch(new URL(`precache.json?v=${encodeURIComponent(VERSION)}`, SCOPE).href, { cache: 'no-store' });
  if (!res.ok) throw new Error(`precache.json: ${res.status}`);
  const data = await res.json();
  const cache = await caches.open(CACHE);
  const files = Array.isArray(data.files) ? data.files : [];
  await Promise.all(
    files.map(async (f) => {
      const url = new URL(f, SCOPE).href;
      const r = await fetch(url, { cache: 'reload' });
      if (r.ok) await cache.put(url, r);
    }),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith('trama-') && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

// ignoreVary: i moduli si chiedono in CORS (con Origin), la precache senza.
async function fromCache(request) {
  const cache = await caches.open(CACHE);
  return (await cache.match(request, { ignoreVary: true })) || (await cache.match(request, { ignoreVary: true, ignoreSearch: true }));
}

async function cacheFirst(request) {
  const hit = await fromCache(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => undefined);
  }
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(SCOPE, copy)).catch(() => undefined);
    }
    return res;
  } catch (err) {
    const cache = await caches.open(CACHE);
    const page = (await cache.match(SCOPE, { ignoreVary: true })) || (await cache.match(new URL('index.html', SCOPE).href, { ignoreVary: true }));
    if (page) return page;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/precache.json')) return;
  event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request));
});
