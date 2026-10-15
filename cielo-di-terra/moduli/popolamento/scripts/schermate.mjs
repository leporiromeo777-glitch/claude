#!/usr/bin/env node
/**
 * Schermate del popolamento nel motore vero (npm run shots).
 *
 * 1. build del banco di prova (vite build --config vite.config.ts -> dist-demo/), salvo --no-build;
 * 2. server statico locale;
 * 3. Chromium headless di /opt/pw-browsers (Playwright 1.56.1) con WebGL2 via ANGLE + SwiftShader
 *    (--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist);
 * 4. per ogni inquadratura: window.__GAME__ (API di debug del motore) e window.__CORBELLA__
 *    (maniglia del popolamento) piazzano camera, ora e personaggi; il PNG va in shots/.
 *
 * In SwiftShader un fotogramma costa alcuni secondi: il ciclo rAF è fermo e si disegna con step().
 * Opzioni: --no-build, --only=piazza,notte (nomi), --size=1280x720
 */
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name, def) => {
  const f = flag(name);
  return f && f.includes('=') ? f.split('=')[1] : def;
};
const only = value('only', '').split(',').filter(Boolean);
const [W, H] = value('size', '1280x720').split('x').map(Number);
const outDir = join(root, 'shots');
mkdirSync(outDir, { recursive: true });

const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** Inquadrature: `setup(g, c)` gira nel browser con g = __GAME__, c = __CORBELLA__. */
const SHOTS = [
  {
    nome: 'piazza',
    file: 'piazza-campanile.png',
    titolo: 'Piazza delle Ore con il campanile di San Vigilio, a metà mattina',
    setup: (g) => {
      g.setTime(10.2);
      g.setCamera(1028, 34.6, g.game.world.groundAt(1028, 34.6) + 1.7, 25, 14);
    },
    frames: 3,
  },
];

function serve(dir, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
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

async function main() {
  if (!flag('no-build')) {
    console.log('build del banco di prova…');
    execSync('../../node_modules/.bin/vite build --config vite.config.ts --logLevel warn', { cwd: root, stdio: 'inherit' });
  }
  const dist = join(root, 'dist-demo');
  const port = 4380 + Math.floor(Math.random() * 300);
  const server = await serve(dist, port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/?e2e`);
  try {
    await page.waitForFunction(() => window.__CORBELLA_READY__ === true, null, { timeout: 300000 });
  } catch (e) {
    console.log(logs.join('\n'));
    throw e;
  }
  console.log(`gioco + Corbella pronti in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const st = await page.evaluate(() => window.__CORBELLA__.statistiche);
  console.log('statistiche:', JSON.stringify(st));
  const report = [];
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.nome)) continue;
    const ts = Date.now();
    await page.evaluate(
      ([src, frames]) => {
        const g = window.__GAME__;
        const c = window.__CORBELLA__;
        g.stopLoop();
        g.pause();
        g.holdKey('Space', false);
        g.setClockRunning(false);
        const fn = new Function('g', 'c', `(${src})(g, c)`);
        fn(g, c);
        g.ensureLoaded();
        g.step(frames);
        g.ensureLoaded();
        g.step(1);
      },
      [shot.setup.toString(), shot.frames],
    );
    const ms = await page.evaluate(() => window.__GAME__.timedRender());
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(join(outDir, shot.file), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const s = await page.evaluate(() => window.__GAME__.getStats());
    const line = `${shot.file}: ${((Date.now() - ts) / 1000).toFixed(1)} s (fotogramma ${(ms / 1000).toFixed(1)} s), draw ${s.drawCalls}, tri ${s.triangles}`;
    console.log(line);
    report.push({ file: shot.file, titolo: shot.titolo, drawCalls: s.drawCalls, triangoli: s.triangles });
  }
  writeFileSync(join(outDir, 'schermate.json'), JSON.stringify({ statistiche: st, schermate: report }, null, 2));
  const errori = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (errori.length) console.log('errori nella pagina:\n' + errori.join('\n'));
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
