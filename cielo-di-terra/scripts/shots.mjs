#!/usr/bin/env node
/**
 * Screenshot automatici del cilindro (npm run shots).
 *
 * 1. build con VITE_E2E=1 (npm run build:e2e -> dist-e2e/), salvo --no-build;
 * 2. server statico locale;
 * 3. Chromium headless (quello preinstallato in /opt/pw-browsers, Playwright 1.56.1)
 *    con WebGL2 via ANGLE + SwiftShader: flag --use-angle=swiftshader
 *    --enable-unsafe-swiftshader --ignore-gpu-blocklist;
 * 4. per ogni inquadratura usa window.__GAME__ per piazzare camera e ora, poi salva
 *    il PNG in docs/shots/.
 *
 * Opzioni: --no-build, --only=1,3 (numeri delle inquadrature), --size=1280x720
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
const only = value('only', '')
  .split(',')
  .filter(Boolean)
  .map(Number);
const [W, H] = value('size', '1280x720').split('x').map(Number);
const outDir = join(root, 'docs', 'shots');
mkdirSync(outDir, { recursive: true });

export const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** Inquadrature: ogni `setup` gira nel browser con `g = window.__GAME__`. */
const SHOTS = [
  {
    n: 1,
    file: '01-paese-mezzogiorno.png',
    title: 'In paese a mezzogiorno, guardando in su verso le valli lontane',
    setup: (g) => {
      g.setTime(12.2);
      g.teleport(1028, 36.6, 0);
      g.look(62, 30);
    },
    frames: 4,
  },
  {
    n: 2,
    file: '02-asse-verso-il-sordo.png',
    title: "Lungo l'asse verso il Sordo, dagli alpeggi del Tappo Sud",
    setup: (g) => {
      g.setTime(10.5);
      g.teleport(470, 44, 0);
      g.look(0, 9);
    },
    frames: 4,
  },
  {
    n: 3,
    file: '03-planata-alta.png',
    title: "In planata alta, a 50 m dall'asse, verso il lago dall'altra parte del cielo",
    setup: (g) => {
      g.setTime(11);
      g.teleport(1350, 200, 592, true);
      g.look(-8, -24);
      g.startGlide(7);
    },
    frames: 50,
  },
  {
    n: 4,
    file: '04-finestra-stelle.png',
    title: 'A piedi su un costolone della Finestra dei Ponti: le stelle girano sotto il vetro',
    setup: (g) => {
      g.setTime(12);
      g.teleport(1200, 104, 0);
      g.look(6, -15);
      g.setSimTime(31.0);
    },
    frames: 2,
  },
  {
    n: 5,
    file: '05-notte-paese.png',
    title: 'Notte in piazza: la Linea è una brace blu, i lumi dei paesi nel cielo',
    setup: (g) => {
      g.setTime(23.2);
      g.teleport(1033, 37.6, 0);
      g.look(70, 40);
    },
    frames: 4,
  },
  {
    n: 6,
    file: '06-matita-rivelazione.png',
    title: "Rivelazione in corso: l'inchiostro chiude i contorni e il colore entra dal caposaldo",
    setup: (g) => {
      g.setTime(11.2);
      g.setSetting('nearPaint', [6, 14]);
      const origin = { z: 1585, theta: 24 };
      const ground = g.game.world.groundAt(1500, 21);
      g.setCamera(1500, 21, ground + 32, 14, -19);
      const ids = g.cellsInRadius(1590, 25, 125);
      g.revealCells(ids, origin);
    },
    frames: 30,
    after: (g) => g.setSetting('nearPaint', [70, 150]),
  },
];

function serve(dir, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let p = normalize(join(dir, url));
    if (!p.startsWith(dir)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

async function main() {
  if (!flag('no-build')) {
    console.log('build E2E (VITE_E2E=1)…');
    execSync('npm run build:e2e', { cwd: root, stdio: 'inherit' });
  }
  const dist = join(root, 'dist-e2e');
  const port = 4180 + Math.floor(Math.random() * 200);
  const server = await serve(dist, port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  console.log(`gioco pronto in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  const info = await page.evaluate(() => window.__GAME__.getStats());
  console.log('renderer:', info.renderer);
  const report = [];
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.n)) continue;
    const ts = Date.now();
    await page.evaluate(
      ([src, frames]) => {
        const g = window.__GAME__;
        g.stopLoop();
        g.pause();
        g.holdKey('Space', false);
        g.setClockRunning(false);
        // eslint-disable-next-line no-new-func
        const fn = new Function('g', `(${src})(g)`);
        fn(g);
        g.ensureLoaded();
        g.step(frames);
        g.ensureLoaded();
        g.step(1);
      },
      [shot.setup.toString(), shot.frames],
    );
    const ms = await page.evaluate(() => window.__GAME__.timedRender());
    const file = join(outDir, shot.file);
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    const st = await page.evaluate(() => ({ s: window.__GAME__.getStats(), p: window.__GAME__.getPlayerState() }));
    const line = `${shot.file}: ${((Date.now() - ts) / 1000).toFixed(1)} s (un fotogramma ${(ms / 1000).toFixed(1)} s), draw ${st.s.drawCalls}, tri ${st.s.triangles}, terreno LOD ${st.s.terrainByLod.join('/')}, alberi ${st.s.treesByLod.join('/')}, camera z ${st.p.camera.z.toFixed(0)} θ ${st.p.camera.theta.toFixed(1)} h ${st.p.camera.h.toFixed(1)}, g ${st.p.gravityG.toFixed(2)}, ${st.p.mode}`;
    console.log(line);
    if (shot.after) await page.evaluate((src) => new Function('g', `(${src})(g)`)(window.__GAME__), shot.after.toString());
    report.push({ ...shot, setup: undefined, after: undefined, frameMs: Math.round(ms), stats: st.s, player: st.p });
  }
  writeFileSync(join(outDir, 'shots.json'), JSON.stringify({ date: new Date().toISOString(), size: [W, H], chromiumArgs: CHROMIUM_ARGS, renderer: info.renderer, shots: report }, null, 2));
  const errors = logs.filter((l) => l.includes('error') || l.includes('Error'));
  if (errors.length) console.log('messaggi di errore del browser:\n' + errors.slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
