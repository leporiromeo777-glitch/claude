// Sequenza di fotogrammi camminando sulla strada della Cripta verso il paese (6:30, Media): per vedere
// che l'erba non «spunta» a scatti, che le zolle e i sassi non sfarfallano e che il bordo della strada
// regge in movimento. Dalla cartella del gioco, dopo `npm run build:e2e`:
//   node docs/migliorie/suolo/cammina.mjs <cartella> [--dist=<dist-e2e>] [--q=media] [--n=8] [--passi=30]
// Con --w (correzione): come chi gioca, W tenuto sempre premuto dalla vista della segnalazione, un
// fotogramma ogni `passi` passi a 60 Hz (--passi=6: uno ogni 0,1 s), a 1280×720:
//   node docs/migliorie/suolo/cammina.mjs <cartella> --w --n=24 --passi=6 [--q=bassa]
import { createRequire } from 'node:module';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const outDir = process.argv[2];
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const dist = arg('dist', join(root, 'dist-e2e'));
const q = arg('q', 'media');
const n = Number(arg('n', '8'));
const passi = Number(arg('passi', '30'));
const tenuto = process.argv.includes('--w');
mkdirSync(outDir, { recursive: true });
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function serve(dir, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let p = normalize(join(dir, url));
    if (!p.startsWith(dir)) { res.writeHead(403).end(); return; }
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

async function main() {
  const port = 7300 + Math.floor(Math.random() * 400);
  const server = await serve(dist, port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: tenuto ? { width: 1280, height: 720 } : { width: 960, height: 540 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  await page.evaluate(([q, tenuto]) => {
    const g = window.__GAME__;
    g.stopLoop(); g.pause(); g.setClockRunning(false);
    g.setSetting('qualita', q);
    g.setTime(6.5);
    if (tenuto) {
      g.teleport(1083, 31.3, 0);
      const gr = g.game.world.groundAt(1058, 33.9);
      g.lookAt(1058, 33.9, gr + 1.2);
      g.ensureLoaded(); g.step(10); g.ensureLoaded();
      g.holdKey('KeyW', true);
      return;
    }
    g.teleport(1090, 30.6, 0);
    const gr = g.game.world.groundAt(1060, 34.4);
    g.lookAt(1060, 34.4, gr + 1.5);
    g.ensureLoaded(); g.step(4);
  }, [q, tenuto]);
  for (let i = 0; i < n; i++) {
    await page.evaluate(([passi, tenuto]) => {
      const g = window.__GAME__;
      if (tenuto) {
        g.step(passi);
        return;
      }
      g.holdKey('KeyW', true);
      g.step(passi);
      g.holdKey('KeyW', false);
      g.step(1);
    }, [passi, tenuto]);
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(join(outDir, `cammina-${String(i).padStart(2, '0')}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const p = await page.evaluate(() => { const s = window.__GAME__.getPlayerState(); return `z ${s.z.toFixed(1)} θ ${s.theta.toFixed(2)}`; });
    console.log(i, p);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
