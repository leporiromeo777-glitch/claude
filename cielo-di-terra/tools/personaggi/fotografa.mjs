#!/usr/bin/env node
/**
 * Schermate automatiche della pagina di prova dei personaggi (tools/personaggi/prova.html).
 *
 *   node tools/personaggi/fotografa.mjs --out=<cartella> [--m=vecchio,togna,nando] [--size=1280x720]
 *          [--stile=toon] [--sfondo=<url>] [--lod=1] [--luce=sera] [--primo=1] [--solo=viste,cammina,gesti,primo,sfondo]
 *          [--indice=1] [--passo=0.9] [--nomi=1] [--oggetti=0]   (parametri passati a prova.html)
 *
 * Avvia Vite in modalità sviluppo sulla cartella del gioco, apre Chromium headless con WebGL2 via
 * SwiftShader (come scripts/shots.mjs) e salva:
 *   viste-<vista>.png       fronte, fianco, retro, tre quarti, da fermi
 *   cammina-<n>.png         quattro fotogrammi di un ciclo di camminata (di fianco)
 *   gesti-<gesto>.png       saluta, indica, mano al petto, curvo con lo sguardo di lato
 *   pose-<posa>.png         mani giunte, braccia conserte, mani dietro
 *   primo-<vista>.png       primo piano delle teste;  sfondo.png  sopra un'immagine (--sfondo)
 * Senza --out le schermate vanno nella cartella temporanea del sistema (non nel repository).
 */
import { mkdirSync } from 'node:fs';
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
const out = resolve(args.out ?? join(tmpdir(), 'personaggi-schermate'));
mkdirSync(out, { recursive: true });
const [W, H] = (args.size ?? '1280x720').split('x').map(Number);
const solo = (args.solo ?? 'viste,cammina,gesti').split(',');

const server = await createServer({ root: radice, logLevel: 'error', server: { port: 5199, host: '127.0.0.1' } });
await server.listen();
const base = 'http://127.0.0.1:5199/tools/personaggi/prova.html';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function apri(params) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('pageerror', (e) => console.error('errore pagina:', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error('console:', m.text());
  });
  const qs = new URLSearchParams({ m: args.m ?? 'vecchio,togna,nando', stile: args.stile ?? 'toon', t: '0', ...params });
  if (args.lod) qs.set('lod', args.lod);
  if (args.luce) qs.set('luce', args.luce);
  if (args.primo) qs.set('primo', args.primo);
  if (args.sfondo) qs.set('sfondo', args.sfondo);
  for (const k of ['indice', 'passo', 'nomi', 'oggetti']) if (args[k]) qs.set(k, args[k]);
  await page.goto(`${base}?${qs}`);
  await page.evaluate(() => window.__PROVA__.pronto);
  return page;
}

async function scatta(page, file, t, opz) {
  await page.evaluate(([t, opz]) => window.__PROVA__.fotogramma(t, opz), [t, opz]);
  await page.screenshot({ path: join(out, file) });
  console.log('scritto', join(out, file));
}

try {
  if (solo.includes('viste')) {
    const p = await apri({ modo: 'fermo' });
    for (const vista of ['fronte', 'fianco', 'retro', 'tre-quarti']) await scatta(p, `viste-${vista}.png`, 1.0, { vista });
    await p.close();
  }
  if (solo.includes('cammina')) {
    const p = await apri({ modo: 'cammina' });
    // un ciclo a 1,1 m/s con passo 0,32·H (gonna) dura circa 1 s: quattro fotogrammi a un quarto
    let t = 2.0;
    for (let i = 0; i < 4; i++) {
      await scatta(p, `cammina-${i + 1}.png`, t, { vista: 'fianco', modo: 'cammina' });
      t += 0.24;
    }
    await scatta(p, `cammina-tre-quarti.png`, t + 0.12, { vista: 'tre-quarti', modo: 'cammina' });
    await p.close();
  }
  if (solo.includes('gesti')) {
    for (const gesto of ['saluta', 'indica', 'mano-al-petto']) {
      const p = await apri({ modo: 'fermo', gesto });
      await scatta(p, `gesti-${gesto}.png`, 1.5, { vista: 'tre-quarti', guarda: [3, 1.5, 4] });
      await p.close();
    }
    const p = await apri({ modo: 'fermo', curvo: '1' });
    await scatta(p, `gesti-curvo.png`, 2.0, { vista: 'tre-quarti', guarda: [-4, 1.2, 3] });
    await p.close();
    for (const braccia of ['mani-giunte', 'braccia-conserte', 'mani-dietro']) {
      const p = await apri({ modo: 'fermo', braccia });
      await scatta(p, `pose-${braccia}.png`, 2.0, { vista: braccia === 'mani-dietro' ? 'retro' : 'tre-quarti' });
      await p.close();
    }
  }
  if (solo.includes('primo')) {
    const p = await apri({ modo: 'fermo', primo: '1' });
    for (const vista of ['fronte', 'tre-quarti']) await scatta(p, `primo-${vista}.png`, 1.0, { vista });
    await p.close();
  }
  if (solo.includes('sfondo')) {
    const p = await apri({ modo: 'fermo' });
    await scatta(p, `sfondo.png`, 1.0, { vista: 'tre-quarti' });
    await p.close();
  }
} finally {
  await browser.close();
  await server.close();
}
