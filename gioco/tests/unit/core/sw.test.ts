/**
 * Service worker (revisione 1, SCH-08): quando si registra e con che URL; il
 * file public/sw.js gestisce solo la stessa origine e mette in cache la lista
 * di precache.json.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { registerServiceWorker, serviceWorkerUrl, type SwEnv } from '../../../src/core/sw';

const doc = (build: string | null): SwEnv['doc'] => ({
  querySelector: (() => (build === null ? null : { getAttribute: () => build })) as unknown as Document['querySelector'],
});

describe('service worker', () => {
  const base = (): SwEnv => ({ dev: false, native: false, version: '1.0.0', doc: doc('ab12'), nav: { serviceWorker: { register: vi.fn(async () => ({}) as ServiceWorkerRegistration) } }, protocol: 'https:' });

  it('sul web, in build: sw.js con versione e build', () => {
    expect(serviceWorkerUrl(base())).toBe('sw.js?v=1.0.0-ab12');
  });

  it('niente in sviluppo, nell\'app nativa, senza build, senza supporto o fuori da http(s)', () => {
    expect(serviceWorkerUrl({ ...base(), dev: true })).toBeNull();
    expect(serviceWorkerUrl({ ...base(), native: true })).toBeNull();
    expect(serviceWorkerUrl({ ...base(), doc: doc(null) })).toBeNull();
    expect(serviceWorkerUrl({ ...base(), nav: {} })).toBeNull();
    expect(serviceWorkerUrl({ ...base(), protocol: 'capacitor:' })).toBeNull();
  });

  it('registra con scope ./ e non lancia se il browser rifiuta', async () => {
    const env = base();
    expect(await registerServiceWorker(env)).toBe('sw.js?v=1.0.0-ab12');
    expect(env.nav!.serviceWorker!.register).toHaveBeenCalledWith('sw.js?v=1.0.0-ab12', { scope: './' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const bad: SwEnv = { ...env, nav: { serviceWorker: { register: async () => { throw new Error('no'); } } } };
    expect(await registerServiceWorker(bad)).toBeNull();
    expect(warn).toHaveBeenCalled();
  });

  it('public/sw.js: solo stessa origine, precache.json, cache trama-<versione>, rete come ripiego', () => {
    const src = readFileSync(resolve(__dirname, '../../../public/sw.js'), 'utf8');
    expect(src).toMatch(/url\.origin !== self\.location\.origin\) return/);
    expect(src).toContain('precache.json');
    expect(src).toMatch(/`trama-\$\{VERSION\}`/);
    expect(src).toMatch(/caches\.delete/);
    expect(src).not.toMatch(/https?:\/\//);
  });
});

describe('precache.json dalla build (vite.config.ts)', () => {
  it('elenca index, chunk, CSS, woff2 e i file di public/ (non sw.js né i .woff); scrive la build in index.html', async () => {
    const { precachePlugin } = await import('../../../vite.config');
    const plugin = precachePlugin();
    const emitted: { fileName: string; source: string }[] = [];
    const bundle: Record<string, { type: string; source?: string }> = {
      'index.html': { type: 'asset', source: '<!doctype html><html><head><title>T</title></head></html>' },
      'assets/index-abc.js': { type: 'chunk' },
      'assets/index-abc.css': { type: 'asset', source: '' },
      'assets/caveat-latin-400-normal-x.woff2': { type: 'asset', source: '' },
      'assets/caveat-latin-400-normal-x.woff': { type: 'asset', source: '' },
      'assets/solver.worker-y.js': { type: 'asset', source: '' },
    };
    const gen = plugin.generateBundle as unknown as (this: { emitFile(f: { fileName: string; source: string }): void }, o: unknown, b: unknown) => void;
    gen.call({ emitFile: (f) => emitted.push(f) }, {}, bundle);
    const out = JSON.parse(emitted.find((e) => e.fileName === 'precache.json')!.source) as { version: string; build: string; files: string[] };
    expect(out.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(out.build).toMatch(/^[0-9a-f]{12}$/);
    expect(out.files).toEqual(expect.arrayContaining(['./', 'index.html', 'assets/index-abc.js', 'assets/index-abc.css', 'assets/caveat-latin-400-normal-x.woff2', 'assets/solver.worker-y.js', 'assets/manifest.json', 'manifest.webmanifest']));
    expect(out.files).not.toContain('assets/caveat-latin-400-normal-x.woff');
    expect(out.files).not.toContain('sw.js');
    // I file elencati dal manifest degli asset ci sono tutti.
    const manifest = JSON.parse(readFileSync(resolve(__dirname, '../../../public/assets/manifest.json'), 'utf8')) as { atlases: { image: string }[]; images: Record<string, { src: string }> };
    for (const a of manifest.atlases) expect(out.files.some((f) => f.endsWith(a.image))).toBe(true);
    for (const im of Object.values(manifest.images)) expect(out.files.some((f) => f.endsWith(im.src))).toBe(true);
    expect(bundle['index.html']!.source).toContain(`<meta name="trama-build" content="${out.build}" />`);
  });
});
