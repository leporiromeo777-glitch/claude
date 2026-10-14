import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createAssetStore, EXPECTED_FRAMES, EXPECTED_IMAGES, parseManifest } from '../../../src/core/assets';
import { drawPlaceholder, placeholderSpec, type PlaceholderCanvas } from '../../../src/core/placeholders';
import type { AssetManifest } from '../../../src/core/types';

/** Canvas finto: registra le chiamate di disegno senza DOM. */
function fakeCanvas(w: number, h: number): PlaceholderCanvas & { calls: string[] } {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
        return (...args: unknown[]) => {
          calls.push(String(prop));
          return args.length ? undefined : undefined;
        };
      },
      set() {
        return true;
      },
    },
  );
  return { width: w, height: h, getContext: () => ctx, calls };
}

describe('AssetStore', () => {
  it("frame('fuso/teresa') restituisce un segnaposto quando il manifest non c'è", async () => {
    const fetchJson = vi.fn();
    const store = createAssetStore({ hasManifest: false, makeCanvas: fakeCanvas, fetchJson });
    await store.init();
    await store.load(['core']);
    expect(fetchJson).not.toHaveBeenCalled();
    const f = store.frame('fuso/teresa');
    expect(f.placeholder).toBe(true);
    expect([f.sw, f.sh]).toEqual([96, 320]);
    expect(f.source).toBeTruthy();
    expect((f.source as unknown as { calls: string[] }).calls.length).toBeGreaterThan(5);
    expect(store.has('fuso/teresa')).toBe(false);
    expect(store.missing()).toEqual(['fuso/teresa']);
    // Stesso nome, stesso segnaposto (in cache).
    expect(store.frame('fuso/teresa').source).toBe(f.source);
  });

  it('manifest assente o rotto al fetch: segnaposto, nessuna eccezione', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createAssetStore({
      hasManifest: true,
      makeCanvas: fakeCanvas,
      fetchJson: () => Promise.reject(new Error('404')),
    });
    await expect(store.init()).resolves.toBeUndefined();
    expect(store.manifest()).toBeNull();
    expect(store.image('dio/forno/alba')).toBeTruthy();
    expect(store.missing()).toEqual(['dio/forno/alba']);
    expect(warn).toHaveBeenCalled();
  });

  it('con il manifest: frame dall’atlas caricato, immagini per gruppo, missing solo per i nomi assenti', async () => {
    const manifest = {
      version: 1,
      atlases: [{ image: 'atlas/atlas_0.png', width: 512, height: 512, frames: { 'fuso/teresa': { x: 2, y: 4, w: 96, h: 320, ax: 0.5, ay: 0.05 } } }],
      images: { 'dio/forno/alba': { src: 'dio/forno/alba.webp', w: 1024, h: 768, group: 'dio' } },
    };
    const loaded: string[] = [];
    const store = createAssetStore({
      hasManifest: true,
      makeCanvas: fakeCanvas,
      fetchJson: async (url) => {
        expect(url).toBe('./assets/manifest.json');
        return manifest;
      },
      loadImage: async (url) => {
        loaded.push(url);
        return { url } as unknown as CanvasImageSource;
      },
    });
    await store.init();
    // Prima del caricamento: segnaposto, ma non "mancante".
    expect(store.frame('fuso/teresa').placeholder).toBe(true);
    await store.load(['core']);
    expect(loaded).toEqual(['./assets/atlas/atlas_0.png']);
    const f = store.frame('fuso/teresa');
    expect(f).toMatchObject({ placeholder: false, sx: 2, sy: 4, sw: 96, sh: 320, ax: 0.5, ay: 0.05 });
    expect(store.has('fuso/teresa')).toBe(true);
    await store.load(['dio']);
    expect(loaded).toContain('./assets/dio/forno/alba.webp');
    expect(store.has('dio/forno/alba')).toBe(true);
    store.frame('fuso/marta');
    expect(store.missing()).toEqual(['fuso/marta']);
    store.unload('dio');
    expect(store.has('dio/forno/alba')).toBe(false);
  });

  it('immagine che non si carica → mancante', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createAssetStore({
      hasManifest: true,
      makeCanvas: fakeCanvas,
      fetchJson: async () => ({ atlases: [], images: { 'tab/secca': { src: 'tab/secca.webp', w: 1, h: 1, group: 'tab' } } }),
      loadImage: () => Promise.reject(new Error('decode')),
    });
    await store.init();
    await store.load(['tab']);
    expect(store.missing()).toEqual(['tab/secca']);
  });

  it('parseManifest scarta le voci malformate', () => {
    const m = parseManifest({ atlases: [{ image: 3 }, { image: 'a.png', frames: { x: { x: 1 }, y: { x: 0, y: 0, w: 1, h: 1 } } }], images: { a: {}, b: { src: 'b.webp' } } });
    expect(m?.atlases).toHaveLength(1);
    expect(Object.keys(m?.atlases[0]?.frames ?? {})).toEqual(['y']);
    expect(Object.keys(m?.images ?? {})).toEqual(['b']);
    expect(parseManifest(null)).toBeNull();
  });

  it('elenco degli asset previsti (GDD 12.5) e dimensioni dei segnaposto', () => {
    expect(EXPECTED_FRAMES).toContain('fuso/lino');
    expect(EXPECTED_FRAMES).toContain('fig/ada/porge_grezza');
    expect(EXPECTED_FRAMES.filter((n) => n.startsWith('fuso/'))).toHaveLength(14);
    expect(EXPECTED_FRAMES.filter((n) => n.startsWith('fig/'))).toHaveLength(36);
    expect(EXPECTED_IMAGES.filter((n) => n.startsWith('dio/'))).toHaveLength(21);
    expect(EXPECTED_IMAGES.filter((n) => n.startsWith('tab/'))).toHaveLength(4);
    expect(placeholderSpec('fig/marta/ferma')).toMatchObject({ w: 256, h: 256, ay: 0.92 });
    expect(placeholderSpec('dio/molo/notte')).toMatchObject({ w: 1024, h: 768 });
  });

  it('fuso segnaposto: ancora in cima alla testa come nei fusi veri (il filo si attacca nello stesso punto)', () => {
    const spec = placeholderSpec('fuso/teresa');
    expect(spec).toMatchObject({ w: 96, h: 320, ax: 0.5, ay: 0.125 });
    // Il disegno: la testa (il primo cerchio) comincia appena sopra l'ancora.
    const arcs: { y: number; r: number }[] = [];
    const noop = (): void => undefined;
    const ctx = new Proxy(
      { arc: (_x: number, y: number, r: number) => arcs.push({ y, r }) } as Record<string, unknown>,
      { get: (t, k) => (k in t ? t[k as string] : noop), set: () => true },
    );
    drawPlaceholder({ width: spec.w, height: spec.h, getContext: () => ctx }, 'fuso/teresa');
    const head = arcs[0]!;
    const anchor = spec.ay * spec.h;
    expect(head.y - head.r).toBeLessThanOrEqual(anchor);
    expect(anchor - (head.y - head.r)).toBeLessThan(8);
    // Il pomolo in fondo resta dentro il fotogramma.
    const knob = arcs.at(-1)!;
    expect(knob.y + knob.r).toBeLessThanOrEqual(spec.h);
    // E coincide con l'ancora dei fusi veri, se gli asset ci sono.
    const path = new URL('../../../public/assets/manifest.json', import.meta.url);
    if (existsSync(path)) {
      const m = JSON.parse(readFileSync(path, 'utf8')) as AssetManifest;
      const real = m.atlases.flatMap((a) => Object.entries(a.frames)).filter(([n]) => n.startsWith('fuso/'));
      expect(real.length).toBeGreaterThan(0);
      for (const [n, f] of real) expect(Math.abs(f.ay - spec.ay), n).toBeLessThan(0.01);
    }
  });
});
