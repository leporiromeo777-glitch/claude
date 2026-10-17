// Schermate della traccia «suolo» (migliorie dopo la prova del 16 ottobre). Dalla cartella del gioco,
// dopo `npm run build:e2e`:
//   node docs/migliorie/suolo/inquadrature.mjs <cartella> [--dist=<dist-e2e>] [--only=s01,s02] [--q=media]
// Ogni inquadratura ha la sua qualità (Media salvo dove scritto: il gioco gira in «Automatica», che sui
// portatili diventa Media o Bassa). `--q=` forza la qualità per tutte.
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
const only = arg('only', '') ? arg('only', '').split(',') : null;
const qForzata = arg('q', '');
const [W, H] = arg('size', '1280x720').split('x').map(Number);
mkdirSync(outDir, { recursive: true });
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// la strada della Cripta sotto il belvedere, verso il paese e il campanile (la vista della segnalazione:
// la segnalazione è un poco più vicina al paese e più larga, 1700×730)
const strada = (g) => { g.setTime(6.5); g.teleport(1083, 31.3, 0); const gr = g.game.world.groundAt(1058, 33.9); g.lookAt(1058, 33.9, gr + 5); };
const A = [
  { id: 's01-strada-campanile', setup: strada },
  { id: 's01b-strada-campanile-bassa', q: 'bassa', setup: strada },
  { id: 's01a-strada-campanile-alta', q: 'alta', setup: strada },
  // il belvedere del prologo all'alba: dal muretto verso il paese
  { id: 's02-belvedere-alba', setup: (g) => { g.setTime(6.0); g.teleport(1095.5, 29.5, 0); const gr = g.game.world.groundAt(1046, 37.4); g.lookAt(1046, 37.4, gr + 2); } },
  // le terrazze a mezzogiorno (come il confronto 2, un poco più in giù: il prato ai piedi)
  { id: 's03-terrazze-mezzogiorno', setup: (g) => { g.setTime(12.5); g.teleport(965, 25.0, 0); const gr = g.game.world.groundAt(990, 30); g.lookAt(990, 30, gr - 3); } },
  // un prato in pendio verso le 17 (a Mane sopra il riale, 20-25°, senza bosco; il paese in fondo)
  { id: 's04-prato-pendio-17', setup: (g) => { g.setTime(17.0); g.teleport(1268, 57, 0); const gr = g.game.world.groundAt(1225, 52); g.lookAt(1225, 52, gr); } },
  // le terrazze sopra la botola, dall'alto (gradoni, muri e riempimenti d'erba)
  { id: 's06-gradoni-17', setup: (g) => { g.setTime(17.0); g.teleport(1120, 25.0, 0); const gr = g.game.world.groundAt(1100, 30); g.lookAt(1100, 30, gr - 2); } },
  // un sentiero di notte (la strada dei Ronchi)
  { id: 's05-sentiero-notte', setup: (g) => { g.setTime(22.6); g.teleport(1086, 42.1, 0); const gr = g.game.world.groundAt(1126, 44.2); g.lookAt(1126, 44.2, gr); } },
  // (correzione, dopo la verifica indipendente: le sue inquadrature)
  // la strada un poco più vicina al paese, e lo sguardo ai piedi: la strada e il prato a 4-5 m
  { id: 's07-strada-vicina', setup: (g) => { g.setTime(6.5); g.teleport(1076, 32.1, 0); const gr = g.game.world.groundAt(1058, 33.9); g.lookAt(1058, 33.9, gr + 4); } },
  { id: 's08-piedi-strada-7', setup: (g) => { g.setTime(7.0); g.teleport(1079, 31.7, 0); const gr = g.game.world.groundAt(1074, 32.2); g.lookAt(1074, 32.2, gr); } },
  { id: 's08b-piedi-prato-7', setup: (g) => { g.setTime(7.0); g.teleport(1088, 31.0, 0); const gr = g.game.world.groundAt(1092, 31.6); g.lookAt(1092, 31.6, gr); } },
  // il prato del Ronco a metà mattina (era giallo limone a mimetico), a Media e a Bassa
  { id: 's09-ronco-9', setup: (g) => { g.setTime(9.0); g.teleport(1163, 54.0, 0); const gr = g.game.world.groundAt(1176, 58.5); g.lookAt(1176, 58.5, gr + 1); } },
  { id: 's09b-ronco-9-bassa', q: 'bassa', setup: (g) => { g.setTime(9.0); g.teleport(1163, 54.0, 0); const gr = g.game.world.groundAt(1176, 58.5); g.lookAt(1176, 58.5, gr + 1); } },
  // il piede del muraglione della Terrazza Pedrazzini (missione 1): era una campitura khaki
  { id: 's10-pedrazzini-16', setup: (g) => { g.setTime(16.0); g.teleport(955, 23.8, 0); const gr = g.game.world.groundAt(948, 23.0); g.lookAt(948, 23.0, gr + 1); } },
  // Gra di Pian alle 10 e il tramonto dal belvedere
  { id: 's11-gra-pian-10', setup: (g) => { g.setTime(10.0); g.teleport(896, 18.3, 0); const gr = g.game.world.groundAt(890, 17.5); g.lookAt(890, 17.5, gr); } },
  { id: 's12-tramonto-1918', setup: (g) => { g.setTime(19.3); g.teleport(1094, 29.8, 0); const gr = g.game.world.groundAt(1030, 26.5); g.lookAt(1030, 26.5, gr); } },
];

function serve(dir, port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
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
  const port = 5900 + Math.floor(Math.random() * 400);
  const server = await serve(dist, port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  for (const s of A) {
    if (only && !only.some((o) => s.id.startsWith(o))) continue;
    await page.evaluate(([src, frames, q]) => {
      const g = window.__GAME__;
      g.stopLoop(); g.pause(); g.holdKey('Space', false); g.setClockRunning(false);
      g.setSetting('qualita', q);
      new Function('g', `(${src})(g)`)(g);
      g.ensureLoaded(); g.step(frames); g.ensureLoaded(); g.step(1);
    }, [s.setup.toString(), s.frames || 6, qForzata || s.q || 'media']);
    const ms = await page.evaluate(() => window.__GAME__.timedRender());
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(join(outDir, s.id + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const st = await page.evaluate(() => { const s = window.__GAME__.getStats(); return `draw ${s.drawCalls} tri ${s.triangles}`; });
    console.log(s.id, st, `ms ${Math.round(ms)}`);
    await page.evaluate(() => { const g = window.__GAME__; g.holdKey('Space', false); g.setFreeCamera(false); });
  }
  const errors = logs.filter((l) => /error/i.test(l));
  if (errors.length) console.log(errors.slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
