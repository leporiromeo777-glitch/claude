#!/usr/bin/env node
/**
 * Schermate delle porte (migliorie «porte»): una per ogni porta dell'inventario, guardata da davanti
 * all'altezza degli occhi, nella build E2E con Chromium headless (SwiftShader, come `npm run shots`).
 *
 *   npx tsx scripts/verifica-porte.ts --json=test-results/porte/inventario.json
 *   node scripts/porte-schermate.mjs --json=test-results/porte/inventario.json --out=test-results/porte/foto
 *
 * Opzioni: --no-build, --tutte (anche le porte senza difetti), --id=a,b (solo quelle), --ora=9.5,
 * --dist=4.5 (metri davanti alla porta), --size=960x540, --qualita=media, --max=N, --jpeg=0.82
 */
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name, def) => {
  const f = flag(name);
  return f && f.includes('=') ? f.slice(f.indexOf('=') + 1) : def;
};
const json = resolve(value('json', join(root, 'test-results/porte/inventario.json')));
const outDir = resolve(value('out', join(root, 'test-results/porte/foto')));
const soloId = value('id', '').split(',').filter(Boolean);
const ora = Number(value('ora', '9.5'));
const dist = Number(value('dist', '0'));
const [W, H] = value('size', '960x540').split('x').map(Number);
const qualita = value('qualita', 'media');
const max = Number(value('max', '999'));
const jpeg = Number(value('jpeg', '0.82'));
mkdirSync(outDir, { recursive: true });

const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function serve(dir, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let p = normalize(join(dir, url));
    if (!p.startsWith(dir)) return res.writeHead(403).end();
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

/** Inquadratura da (z, θ, h) del centro della soglia e normale: la ricalcola nel browser se si cambia la distanza. */
async function main() {
  const inv = JSON.parse(readFileSync(json, 'utf8'));
  let porte = inv.porte.filter((p) => (soloId.length ? soloId.includes(p.id) : flag('tutte') || p.difetti.length));
  porte = porte.slice(0, max);
  console.log(`${porte.length} porte da fotografare (${inv.porte.length} nell'inventario)`);
  if (!flag('no-build')) execSync('npm run build:e2e', { cwd: root, stdio: 'inherit' });
  const server = await serve(join(root, 'dist-e2e'), 4380 + Math.floor(Math.random() * 300));
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  await page.evaluate(([q, o]) => {
    const g = window.__GAME__;
    g.stopLoop();
    g.pause();
    g.setClockRunning(false);
    g.setSetting('qualita', q);
    g.setTime(o);
  }, [qualita, ora]);
  const righe = [];
  for (const p of porte) {
    const q = p.inquadratura;
    const t0 = Date.now();
    await page.evaluate(([cam, d]) => {
      const g = window.__GAME__;
      if (d > 0) {
        // più lontano lungo la stessa direzione (dalla soglia verso la camera)
        const k = d / 4.5;
        cam = { ...cam, z: cam.sz + (cam.z - cam.sz) * k, theta: cam.sth + (cam.theta - cam.sth) * k };
        cam.h = Math.max(g.game.world.groundAt(cam.z, cam.theta) + 1.62, cam.h);
      }
      g.setCamera(cam.z, cam.theta, cam.h, cam.yaw, cam.pitch);
      g.ensureLoaded();
      g.step(3);
      g.ensureLoaded();
      g.step(1);
    }, [{ ...q, sz: p.soglia.z, sth: p.soglia.theta }, dist]);
    const data = await page.evaluate((qj) => window.__GAME__.game.renderer.domElement.toDataURL('image/jpeg', qj), jpeg);
    const nome = `${p.id.replace(/[:]/g, '-')}.jpg`;
    writeFileSync(join(outDir, nome), Buffer.from(data.split(',')[1], 'base64'));
    righe.push(`${nome}\t${p.difetti.join(',')}\t${p.note.join('; ')}`);
    console.log(`${nome} (${((Date.now() - t0) / 1000).toFixed(1)} s) ${p.difetti.join(', ')}`);
  }
  writeFileSync(join(outDir, 'elenco.tsv'), righe.join('\n') + '\n');
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
