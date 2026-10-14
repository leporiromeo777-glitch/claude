/**
 * Asset (ARCHITETTURA 5.1, 12).
 *
 * - Il manifest (`public/assets/manifest.json`, formato AssetManifest) lo scrive la
 *   pipeline Blender. I percorsi al suo interno sono relativi a `public/assets/`.
 * - Gruppi di caricamento: `core` (tutti gli atlas), `dio` (diorami), `tab` (quadri);
 *   le immagini hanno il loro `group` nel manifest.
 * - `frame(nome)` e `image(nome)` non restituiscono mai undefined: se l'asset manca
 *   (o non è ancora caricato) restituiscono un segnaposto disegnato in codice.
 * - `missing()` elenca i nomi chiesti che il manifest non contiene (o che non si
 *   sono potuti caricare): con la pipeline completa è vuoto.
 */
import type { AssetManifest, AssetStore, SpriteFrame } from './types';
import { drawPlaceholder, placeholderSpec, type CanvasFactory, type PlaceholderCanvas } from './placeholders';

export const ASSET_BASE = './assets/';
export const MANIFEST_URL = `${ASSET_BASE}manifest.json`;

const CHARACTERS_WITH_FUSO = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi', 'livia', 'ada', 'clotilde', 'lino'];
const CHARACTERS_WITH_FIG = ['teresa', 'marta', 'piero', 'gino', 'bepi', 'nina', 'zeno', 'lunardi', 'livia', 'ada', 'lino'];
const POSES = ['ferma', 'porge', 'saluta'];
const DIO_PLACES = ['molo', 'forno', 'piazza', 'chiesa', 'farmacia', 'faro', 'stanza'];
const LIGHTS = ['alba', 'giorno', 'notte'];

/** Asset previsti dal livello L1 (GDD 12.5, ARCHITETTURA 12): la scena di avvio li chiede tutti. */
export const EXPECTED_FRAMES: readonly string[] = [
  ...CHARACTERS_WITH_FUSO.map((c) => `fuso/${c}`),
  'fuso/stile_1',
  'fuso/stile_2',
  ...CHARACTERS_WITH_FIG.flatMap((c) => POSES.map((p) => `fig/${c}/${p}`)),
  ...POSES.map((p) => `fig/ada/${p}_grezza`),
  ...['tombolo', 'bottiglia', 'forbici', 'libro', 'fuso_faro', 'fascio_lettere'].map((o) => `obj/${o}`),
];
export const EXPECTED_IMAGES: readonly string[] = [
  ...DIO_PLACES.flatMap((p) => LIGHTS.map((l) => `dio/${p}/${l}`)),
  ...['sedia_vuota', 'tempesta', 'secca', 'sacrestia_lettere'].map((t) => `tab/${t}`),
];

export interface AssetStoreDeps {
  /** Il manifest esiste? (costante di build: se è false non lo si chiede nemmeno). */
  hasManifest: boolean;
  baseUrl?: string;
  fetchJson?: (url: string) => Promise<unknown>;
  loadImage?: (url: string) => Promise<CanvasImageSource>;
  makeCanvas?: CanvasFactory;
  /** Colore di un personaggio (dai contenuti), per i segnaposto. */
  colorOf?: (id: string) => string | undefined;
}

export interface CoreAssetStore extends AssetStore {
  /** Scarica il manifest (se c'è). Non lancia mai: senza manifest si usano i segnaposto. */
  init(): Promise<void>;
  manifest(): AssetManifest | null;
  loadedGroups(): string[];
  /** Carica solo alcune immagini (per esempio i diorami di una vignetta). */
  loadNames(names: string[]): Promise<void>;
  /** Libera le immagini di un gruppo (al massimo 4 diorami decodificati alla volta). */
  unload(group: string): void;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Controllo di forma del manifest: scarta le voci malformate. */
export function parseManifest(raw: unknown): AssetManifest | null {
  if (!isObj(raw)) return null;
  const atlases: AssetManifest['atlases'] = [];
  if (Array.isArray(raw.atlases)) {
    for (const a of raw.atlases) {
      if (!isObj(a) || typeof a.image !== 'string' || !isObj(a.frames)) continue;
      const frames: AssetManifest['atlases'][number]['frames'] = {};
      for (const [name, f] of Object.entries(a.frames)) {
        if (!isObj(f)) continue;
        const { x, y, w, h, ax, ay } = f;
        if ([x, y, w, h].every((v) => typeof v === 'number')) {
          frames[name] = {
            x: x as number,
            y: y as number,
            w: w as number,
            h: h as number,
            ax: typeof ax === 'number' ? ax : 0.5,
            ay: typeof ay === 'number' ? ay : 0.5,
          };
        }
      }
      atlases.push({
        image: a.image,
        width: typeof a.width === 'number' ? a.width : 0,
        height: typeof a.height === 'number' ? a.height : 0,
        frames,
      });
    }
  }
  const images: AssetManifest['images'] = {};
  if (isObj(raw.images)) {
    for (const [name, i] of Object.entries(raw.images)) {
      if (!isObj(i) || typeof i.src !== 'string') continue;
      images[name] = {
        src: i.src,
        w: typeof i.w === 'number' ? i.w : 0,
        h: typeof i.h === 'number' ? i.h : 0,
        group: typeof i.group === 'string' ? i.group : 'dio',
      };
    }
  }
  return { version: typeof raw.version === 'number' ? raw.version : 0, atlases, images };
}

function defaultCanvas(w: number, h: number): PlaceholderCanvas {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return { width: w, height: h, getContext: () => null };
}

async function defaultLoadImage(url: string): Promise<CanvasImageSource> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export function createAssetStore(deps: AssetStoreDeps): CoreAssetStore {
  const base = deps.baseUrl ?? ASSET_BASE;
  const makeCanvas = deps.makeCanvas ?? defaultCanvas;
  const loadImage = deps.loadImage ?? defaultLoadImage;
  const fetchJson = deps.fetchJson ?? defaultFetchJson;

  let manifest: AssetManifest | null = null;
  /** frame → atlas di appartenenza */
  const frameIndex = new Map<string, { atlas: number; f: AssetManifest['atlases'][number]['frames'][string] }>();
  const atlasImages = new Map<number, CanvasImageSource>();
  const images = new Map<string, CanvasImageSource>();
  const placeholders = new Map<string, { canvas: PlaceholderCanvas; spec: ReturnType<typeof placeholderSpec> }>();
  const missingSet = new Set<string>();
  const failed = new Set<string>();
  const groups = new Set<string>();

  const url = (src: string): string => (/^(\.\/|\/|[a-z]+:)/i.test(src) ? src : base + src);

  function placeholder(name: string): { canvas: PlaceholderCanvas; spec: ReturnType<typeof placeholderSpec> } {
    let p = placeholders.get(name);
    if (!p) {
      const spec = placeholderSpec(name);
      const canvas = makeCanvas(spec.w, spec.h);
      try {
        drawPlaceholder(canvas, name, deps.colorOf);
      } catch (err) {
        console.warn('[assets] placeholder drawing failed', name, err);
      }
      p = { canvas, spec };
      placeholders.set(name, p);
    }
    return p;
  }

  function knows(name: string): boolean {
    return frameIndex.has(name) || !!manifest?.images[name];
  }

  function noteRequest(name: string): void {
    if (!knows(name)) missingSet.add(name);
  }

  async function loadAtlas(i: number): Promise<void> {
    const a = manifest?.atlases[i];
    if (!a || atlasImages.has(i)) return;
    try {
      atlasImages.set(i, await loadImage(url(a.image)));
    } catch (err) {
      console.warn('[assets] atlas load failed', a.image, err);
      for (const name of Object.keys(a.frames)) failed.add(name);
    }
  }

  async function loadImageNamed(name: string): Promise<void> {
    const info = manifest?.images[name];
    if (!info || images.has(name)) return;
    try {
      images.set(name, await loadImage(url(info.src)));
    } catch (err) {
      console.warn('[assets] image load failed', info.src, err);
      failed.add(name);
    }
  }

  const store: CoreAssetStore = {
    async init() {
      if (!deps.hasManifest) return;
      try {
        manifest = parseManifest(await fetchJson(url('manifest.json')));
      } catch (err) {
        console.warn('[assets] manifest unavailable, using placeholders', err);
        manifest = null;
      }
      frameIndex.clear();
      manifest?.atlases.forEach((a, i) => {
        for (const [name, f] of Object.entries(a.frames)) frameIndex.set(name, { atlas: i, f });
      });
    },
    async load(gs) {
      if (!manifest) {
        for (const g of gs) groups.add(g);
        return;
      }
      const jobs: Promise<void>[] = [];
      for (const g of gs) {
        groups.add(g);
        if (g === 'core') manifest.atlases.forEach((_a, i) => jobs.push(loadAtlas(i)));
        for (const [name, info] of Object.entries(manifest.images)) if (info.group === g) jobs.push(loadImageNamed(name));
      }
      await Promise.all(jobs);
    },
    async loadNames(names) {
      const jobs: Promise<void>[] = [];
      for (const n of names) {
        const fi = frameIndex.get(n);
        if (fi) jobs.push(loadAtlas(fi.atlas));
        else if (manifest?.images[n]) jobs.push(loadImageNamed(n));
      }
      await Promise.all(jobs);
    },
    unload(group) {
      groups.delete(group);
      if (!manifest) return;
      for (const [name, info] of Object.entries(manifest.images)) if (info.group === group) images.delete(name);
      if (group === 'core') atlasImages.clear();
    },
    frame(name) {
      noteRequest(name);
      const fi = frameIndex.get(name);
      const img = fi ? atlasImages.get(fi.atlas) : undefined;
      if (fi && img) {
        return { source: img, sx: fi.f.x, sy: fi.f.y, sw: fi.f.w, sh: fi.f.h, ax: fi.f.ax, ay: fi.f.ay, placeholder: false };
      }
      const single = images.get(name);
      if (single) {
        const info = manifest?.images[name];
        return { source: single, sx: 0, sy: 0, sw: info?.w ?? 0, sh: info?.h ?? 0, ax: 0.5, ay: 0.5, placeholder: false };
      }
      const p = placeholder(name);
      const frame: SpriteFrame = {
        source: p.canvas as unknown as CanvasImageSource,
        sx: 0,
        sy: 0,
        sw: p.spec.w,
        sh: p.spec.h,
        ax: p.spec.ax,
        ay: p.spec.ay,
        placeholder: true,
      };
      return frame;
    },
    image(name) {
      noteRequest(name);
      const img = images.get(name);
      if (img) return img;
      return placeholder(name).canvas as unknown as CanvasImageSource;
    },
    has(name) {
      const fi = frameIndex.get(name);
      if (fi) return atlasImages.has(fi.atlas) && !failed.has(name);
      return images.has(name);
    },
    missing() {
      return [...new Set([...missingSet, ...failed])].sort();
    },
    manifest: () => manifest,
    loadedGroups: () => [...groups],
  };
  return store;
}
