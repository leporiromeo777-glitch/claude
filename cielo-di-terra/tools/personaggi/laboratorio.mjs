#!/usr/bin/env node
/**
 * Schermate del laboratorio delle pose (tools/personaggi/laboratorio.html): i modelli veri con la fabbrica
 * del gioco, Chromium headless con WebGL2 via SwiftShader.
 *
 *   node tools/personaggi/laboratorio.mjs --out=<cartella> [--m=togna,nando] [--size=1600x700]
 *        [--scatti=seduti:fianco:2,terra:tre-quarti:2,cammina:fianco:1.3]
 *
 * Ogni scatto è scena:vista:t (t in secondi di animazione); il file è <scena>-<vista>-<t>.png.
 * Senza --out le schermate vanno nella cartella temporanea del sistema (non nel repository).
 */
import { mkdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || '1'];
  }),
);
const out = resolve(args.out ?? join(tmpdir(), 'personaggi-laboratorio'));
mkdirSync(out, { recursive: true });
const [W, H] = (args.size ?? '1600x700').split('x').map(Number);
const TUTTI = 'ottavio,togna,bortolo,pina,annunciata,nando,clelia,lisa,gioanin,velata_donna,velato_gerla,velato_maschera,velato_cappuccio';
const m = args.m ?? TUTTI;
const scatti = (args.scatti ?? 'in-piedi:fronte:1').split(',').map((s) => s.split(':'));
const porta = 5290 + Math.floor(Math.random() * 40);

const moduli = realpathSync(join(radice, 'node_modules'));
const server = await createServer({
  root: radice,
  logLevel: 'error',
  server: { port: porta, host: '127.0.0.1', hmr: false, fs: { allow: [radice, moduli] } },
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js'] },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  // una pagina per scena (lo stato dell'animazione va solo avanti)
  const perScena = new Map();
  for (const [scena, vista, t] of scatti) {
    if (!perScena.has(scena)) perScena.set(scena, []);
    perScena.get(scena).push([vista ?? 'tre-quarti', Number(t ?? 1)]);
  }
  for (const [scena, lista] of perScena) {
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.setDefaultTimeout(600000);
    page.on('pageerror', (e) => console.error('errore pagina:', e.message));
    page.on('console', (x) => {
      if (x.type() === 'error' || x.type() === 'warning') console.error(`console ${x.type()}:`, x.text());
    });
    const qs = new URLSearchParams({ m, scena, ...(args.passo ? { passo: args.passo } : {}), ...(args.zoom ? { zoom: args.zoom } : {}) });
    await page.goto(`http://127.0.0.1:${porta}/tools/personaggi/laboratorio.html?${qs}`);
    await page.waitForFunction(() => !!window.__LAB__);
    await page.evaluate(() => window.__LAB__.pronto);
    lista.sort((a, b) => a[1] - b[1]);
    for (const [vista, t] of lista) {
      await page.evaluate(([t, v]) => window.__LAB__.fotogramma(t, v), [t, vista]);
      const file = join(out, `${scena}-${vista}-${t}.png`);
      await page.screenshot({ path: file });
      console.log('scritto', file);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
