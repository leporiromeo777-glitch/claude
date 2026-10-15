#!/usr/bin/env node
/**
 * La build di produzione carica i personaggi con la base './' anche da una sottocartella.
 *
 *   npm run build && node tools/personaggi/verifica-dist.mjs [--dist=dist]
 *
 * Serve `dist/` sotto /una/sottocartella/ (come su un sito con il gioco in un percorso qualsiasi, o in
 * un iframe), apre Chromium headless con WebGL2 via SwiftShader, aspetta che il gioco sia pronto e
 * controlla che indice.json e i 13 GLB siano stati chiesti nella sottocartella e serviti (200), e che
 * nessun personaggio sia rimasto senza modello. Esce con 1 se qualcosa manca.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || '1'];
  }),
);
const dist = resolve(radice, args.dist ?? 'dist');
const PREFISSO = '/una/sottocartella/';
const indice = JSON.parse(readFileSync(join(dist, 'personaggi', 'indice.json'), 'utf8'));
const attesi = ['indice.json', ...indice.personaggi.map((p) => p.file)];

const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (!url.startsWith(PREFISSO)) return res.writeHead(404).end();
  let p = normalize(join(dist, url.slice(PREFISSO.length)));
  if (!p.startsWith(dist)) return res.writeHead(403).end();
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': tipi[extname(p)] || 'application/octet-stream' });
  createReadStream(p).pipe(res);
});
const porta = 4600 + Math.floor(Math.random() * 300);
await new Promise((ok) => server.listen(porta, '127.0.0.1', ok));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const risposte = new Map();
const avvisi = [];
page.on('response', (r) => {
  const u = new URL(r.url());
  if (u.pathname.includes('/personaggi/')) risposte.set(u.pathname, r.status());
});
page.on('console', (m) => {
  if (m.type() === 'warning' || m.type() === 'error') avvisi.push(`${m.type()}: ${m.text()}`);
});
page.on('pageerror', (e) => avvisi.push(`pageerror: ${e.message}`));
let ok = true;
try {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${porta}${PREFISSO}`);
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 600000 });
  console.log(`gioco pronto in ${Math.round((Date.now() - t0) / 1000)} s (build di produzione, ${PREFISSO})`);
  let kb = 0;
  for (const f of attesi) {
    const percorso = `${PREFISSO}personaggi/${f}`;
    const stato = risposte.get(percorso);
    const peso = f.endsWith('.glb') ? statSync(join(dist, 'personaggi', f)).size / 1024 : 0;
    kb += peso;
    console.log(`  ${stato === 200 ? 'ok ' : 'NO '} ${percorso} ${stato ?? '(mai chiesto)'}${peso ? ` ${Math.round(peso)} KB` : ''}`);
    if (stato !== 200) ok = false;
  }
  const fuori = [...risposte.keys()].filter((p) => !p.startsWith(`${PREFISSO}personaggi/`));
  if (fuori.length) {
    ok = false;
    console.log('  richieste fuori dalla sottocartella:', fuori.join(', '));
  }
  const senza = avvisi.filter((a) => a.includes('senza modello'));
  if (senza.length) {
    ok = false;
    console.log(' ', senza.join('\n  '));
  }
  console.log(`  GLB: ${attesi.length - 1} file, ${(kb / 1024).toFixed(2)} MB`);
  if (avvisi.length) console.log('  avvisi della pagina:\n   ', avvisi.slice(0, 12).join('\n    '));
} finally {
  await browser.close();
  server.close();
}
console.log(ok ? 'verifica dist: ok' : 'verifica dist: FALLITA');
process.exit(ok ? 0 : 1);
