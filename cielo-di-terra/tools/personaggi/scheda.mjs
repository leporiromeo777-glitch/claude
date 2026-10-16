#!/usr/bin/env node
/**
 * La scheda del cast: tutti i personaggi della Fase 1 in fila, di fronte e di tre quarti con la luce
 * calda della pagina di prova (toon a tre campiture, come nel gioco), e sotto, per confronto, gli
 * abitanti procedurali di oggi con lo stesso aspetto.
 *
 *   node tools/personaggi/scheda.mjs [--out=docs/personaggi/scheda-cast.jpg] [--luce=sera] [--senza-vecchi]
 *
 * Avvia Vite e Chromium headless (SwiftShader, come fotografa.mjs), fotografa tre file in una cartella
 * temporanea e li compone con tools/personaggi/componi_scheda.py (Pillow).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
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
const uscita = resolve(radice, args.out ?? 'docs/personaggi/scheda-cast.jpg');
const tmp = mkdtempSync(join(tmpdir(), 'scheda-cast-'));
const indice = JSON.parse(readFileSync(join(radice, 'public', 'personaggi', 'indice.json'), 'utf-8'));
const ids = indice.personaggi.map((p) => p.id);
const W = 3000;
const H = 600;

const porta = 5300 + Math.floor(Math.random() * 400);
const server = await createServer({ root: radice, logLevel: 'error', server: { port: porta, host: '127.0.0.1', strictPort: false } });
await server.listen();
const base = `${server.resolvedUrls.local[0]}tools/personaggi/prova.html`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function foto(file, m, vista, extra = {}) {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.error('errore pagina:', e.message));
  const qs = new URLSearchParams({ m: m.join(','), stile: 'toon', t: '0', modo: 'fermo', vista, passo: '0.86', nomi: '1', indice: '1', ...extra });
  if (args.luce) qs.set('luce', args.luce);
  await page.goto(`${base}?${qs}`);
  await page.evaluate(() => window.__PROVA__.pronto);
  // 1,6 s di respiro: braccia già abbassate dall'animatore, postura di riposo dall'indice
  await page.evaluate(([v]) => window.__PROVA__.fotogramma(1.6, { vista: v }), [vista]);
  const out = join(tmp, file);
  await page.screenshot({ path: out });
  await page.close();
  console.log('scritto', out);
  return out;
}

const file = [];
try {
  file.push(await foto('fronte.png', ids, 'fronte'));
  file.push(await foto('tre-quarti.png', ids, 'tre-quarti'));
  if (!args['senza-vecchi']) file.push(await foto('vecchi.png', ids.map((i) => `vecchio:${i}`), 'tre-quarti'));
} finally {
  await browser.close();
  await server.close();
}
const r = spawnSync('python3', ['-I', join(radice, 'tools', 'personaggi', 'componi_scheda.py'), uscita, ...file], { stdio: 'inherit' });
process.exit(r.status ?? 1);
