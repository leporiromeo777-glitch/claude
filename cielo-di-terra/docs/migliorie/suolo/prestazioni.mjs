// Misure della traccia «suolo»: chiamate di disegno, triangoli, istanze del sottobosco, tempo dei
// passi del disegno (`__GAME__.misuraPassi`, SwiftShader: vale il confronto, non il numero) e tempo
// CPU per generare da zero tutte le celle del sottobosco attorno alla camera. Dalla cartella del
// gioco, dopo `npm run build:e2e`:
//   node docs/migliorie/suolo/prestazioni.mjs [--dist=<dist-e2e>] [--q=media]
import { createRequire } from 'node:module';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(root, 'package.json'));
const { chromium } = require('@playwright/test');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const dist = arg('dist', join(root, 'dist-e2e'));
const q = arg('q', 'media');
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const VISTE = {
  strada: (g) => { g.setTime(6.5); g.teleport(1083, 31.3, 0); const gr = g.game.world.groundAt(1058, 33.9); g.lookAt(1058, 33.9, gr + 5); },
  pendio: (g) => { g.setTime(17.0); g.teleport(1268, 57, 0); const gr = g.game.world.groundAt(1225, 52); g.lookAt(1225, 52, gr); },
  terrazze: (g) => { g.setTime(12.5); g.teleport(965, 25.0, 0); const gr = g.game.world.groundAt(1045, 38); g.lookAt(1045, 38, gr - 6); },
};

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
  const port = 6800 + Math.floor(Math.random() * 400);
  const server = await serve(dist, port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  for (const [nome, setup] of Object.entries(VISTE)) {
    const r = await page.evaluate(([src, q]) => {
      const g = window.__GAME__;
      g.stopLoop(); g.pause(); g.setClockRunning(false);
      g.setSetting('qualita', q);
      new Function('g', `(${src})(g)`)(g);
      g.ensureLoaded(); g.step(4); g.ensureLoaded(); g.step(1);
      const s = g.getStats();
      const S = g.game.vegetation.sottobosco;
      const istanze = S.istanze;
      // generazione da zero delle celle attorno alla camera (tempo CPU, il migliore di 5: la macchina
      // delle prove è condivisa)
      let gen = Infinity;
      for (let k = 0; k < 5; k++) {
        S.celle.clear();
        S.chiaveAttive = '';
        const t0 = performance.now();
        S.update(g.game.camera.position, Infinity);
        gen = Math.min(gen, performance.now() - t0);
      }
      const celle = S.celle.size;
      const passi = g.misuraPassi(4);
      return { draw: s.drawCalls, tri: s.triangles, istanze, celle, genMs: +gen.toFixed(1), msPerCella: +(gen / Math.max(1, celle)).toFixed(2), passi };
    }, [setup.toString(), q]);
    const p = Object.entries(r.passi).map(([k, v]) => `${k} ${Number(v).toFixed(1)}`).join(', ');
    console.log(`${nome} (${q}): draw ${r.draw}, tri ${r.tri}, sottobosco ${r.istanze} istanze in ${r.celle} celle, generazione ${r.genMs} ms (${r.msPerCella} ms/cella); passi: ${p}`);
  }
  await browser.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
