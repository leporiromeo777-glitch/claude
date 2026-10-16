// Schermate della rifinitura 2 «mondo»: le inquadrature del giudizio (a01-a16, b01-b08), i confronti
// (c1, c2, c3, c5) e qualche vista in più (Media, Bassa, notte). Dalla cartella del gioco, dopo
// `npm run build:e2e`:
//   node docs/grafica/rifinitura-2-mondo/inquadrature.mjs <cartella> [--dist=<dist-e2e>] [--only=a02,c1] [--part=A|B|AB]
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
const part = arg('part', 'A');
mkdirSync(outDir, { recursive: true });
const W = 1280, H = 720;
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const A = [
  { id: 'a01-piazza-mattino', setup: (g) => { g.setTime(10.5); g.teleport(1040, 36.0, 0); const gr = g.game.world.groundAt(1062, 37.2); g.lookAt(1062, 37.2, gr + 10); } },
  { id: 'a02-piazza-controcampo', setup: (g) => { g.setTime(15); g.teleport(1054, 38.6, 0); const gr = g.game.world.groundAt(1036, 35.4); g.lookAt(1036, 35.4, gr + 3); } },
  { id: 'a02b-piazza-controcampo-bassa', q: 'bassa', setup: (g) => { g.setTime(15); g.teleport(1054, 38.6, 0); const gr = g.game.world.groundAt(1036, 35.4); g.lookAt(1036, 35.4, gr + 3); } },
  { id: 'a03-lavatoio', setup: (g) => { g.setTime(11); g.teleport(1035.5, 39.9, 0); const gr = g.game.world.groundAt(1043.4, 39.1); g.lookAt(1043.4, 39.1, gr + 1.0); } },
  { id: 'a04-terrazze-castagni', setup: (g) => { g.setTime(10.2); g.teleport(939, 22.35, 0); const gr = g.game.world.groundAt(951, 22.2); g.lookAt(951, 22.2, gr + 4); } },
  { id: 'a05-terrazze-verso-valle', setup: (g) => { g.setTime(12.5); g.teleport(948, 23.0, 0); const gr = g.game.world.groundAt(985, 27.6); g.lookAt(985, 27.6, gr + 1); } },
  { id: 'a06-selva-mattino', setup: (g) => { g.setTime(9.2); g.teleport(800, 9.0, 0); const gr = g.game.world.groundAt(822, 10.5); g.lookAt(822, 10.5, gr + 3); } },
  { id: 'a07-selva-sentiero', setup: (g) => { g.setTime(14); g.teleport(700, 12.0, 0); const gr = g.game.world.groundAt(740, 12.5); g.lookAt(740, 12.5, gr + 2); } },
  { id: 'a08-tramonto-belvedere', setup: (g) => { g.setTime(18.6); g.teleport(1094, 29.8, 0); const gr = g.game.world.groundAt(1046, 37); g.lookAt(1046, 37, gr + 6); } },
  { id: 'a08m-tramonto-belvedere-media', q: 'media', setup: (g) => { g.setTime(18.6); g.teleport(1094, 29.8, 0); const gr = g.game.world.groundAt(1046, 37); g.lookAt(1046, 37, gr + 6); } },
  { id: 'a09-fase-rosa', setup: (g) => { g.setTime(20.0); g.teleport(1094, 29.8, 0); const gr = g.game.world.groundAt(1000, 30); g.lookAt(1000, 30, gr + 10); } },
  { id: 'a10-notte-piazza', setup: (g) => { g.setTime(22.5); g.teleport(1044, 36.6, 0); const gr = g.game.world.groundAt(1058, 38.4); g.lookAt(1058, 38.4, gr + 3); } },
  { id: 'a11-notte-vicolo', setup: (g) => { g.setTime(23); g.teleport(1050, 34.5, 0); const gr = g.game.world.groundAt(1062, 37.2); g.lookAt(1062, 37.2, gr + 8); } },
  { id: 'a12-planata-velo-paese', setup: (g) => { g.setTime(16); g.teleport(1110, 31, 55); const gr = g.game.world.groundAt(1050, 37); g.lookAt(1050, 37, gr); g.startGlide(10); }, frames: 30 },
  { id: 'a13-planata-tramonto-terrazze', setup: (g) => { g.setTime(18.2); g.teleport(1010, 27, 45); const gr = g.game.world.groundAt(950, 23); g.lookAt(950, 23, gr); g.startGlide(10); }, frames: 30 },
  { id: 'a14-mulino-riale', setup: (g) => { g.setTime(13); g.teleport(1100, 53.9, 0); const gr = g.game.world.groundAt(1130, 51); g.lookAt(1130, 51, gr + 3); } },
  { id: 'a15-ronchi-case', setup: (g) => { g.setTime(16.5); g.teleport(1168, 44.5, 0); const gr = g.game.world.groundAt(1188, 46); g.lookAt(1188, 46, gr + 4); } },
  { id: 'a16-alba-castagno-vicino', setup: (g) => { g.setTime(7.2); g.teleport(1123, 26.9, 0); const gr = g.game.world.groundAt(1114, 27.6); g.lookAt(1114, 27.6, gr + 4.5); } },
  // confronti coi bozzetti (stesse inquadrature di scripts/shots.mjs 11-14)
  { id: 'c1-alba-castagno', setup: (g) => { g.setTime(7.0); g.teleport(1117, 26.6, 0); g.lookAt(1046, 37.4, g.game.world.groundAt(1046, 37.4) + 18); } },
  { id: 'c2-terrazze-mezzogiorno', setup: (g) => { g.setTime(12.5); g.teleport(965, 25.0, 0); g.lookAt(1045, 38, g.game.world.groundAt(1045, 38) - 6); } },
  { id: 'c3-planata-asse', setup: (g) => { g.setTime(11); g.teleport(700, 35, 330, true); g.look(0, 12); g.startGlide(7); }, frames: 40 },
  { id: 'c5-notte-paese', setup: (g) => { g.setTime(22.4); g.teleport(1085, 31.5, 0); g.lookAt(1050, 37.2, g.game.world.groundAt(1050, 37.2) + 6); } },
  // provini del motore e viste in più
  { id: 's05-notte-paese', setup: (g) => { g.setTime(23.2); g.teleport(1012, 30.5, 0); g.look(78, 24); }, frames: 4 },
  { id: 'm17-terrazza-media', q: 'media', setup: (g) => { g.setTime(11.5); g.teleport(948, 23.0, 0); const gr = g.game.world.groundAt(1046, 37.4); g.lookAt(1046, 37.4, gr + 60); } },
  { id: 'm18-altra-meta-media', q: 'media', setup: (g) => { g.setTime(11.5); g.teleport(948, 23.0, 0); const gr = g.game.world.groundAt(1100, 40); g.lookAt(1100, 40, gr + 260); } },
  { id: 'm05-meridiana-media', q: 'media', setup: (g) => { g.setTime(7.6); g.teleport(1046, 37.0, 0); const gr = g.game.world.groundAt(1062, 37.2); g.lookAt(1062, 37.2, gr + 60); } },
  { id: 'n01-notte-terrazze', setup: (g) => { g.setTime(23.0); g.teleport(948, 23.0, 0); const gr = g.game.world.groundAt(1046, 37.4); g.lookAt(1046, 37.4, gr + 25); } },
];

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
  const port = 5500 + Math.floor(Math.random() * 400);
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
  const snap = async (name, ms) => {
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(join(outDir, name + '.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const st = await page.evaluate(() => { const s = window.__GAME__.getStats(); return `draw ${s.drawCalls} tri ${s.triangles}`; });
    console.log(name, st, ms ? `ms ${Math.round(ms)}` : '');
  };
  if (part.includes('A')) {
    for (const s of A) {
      if (only && !only.some((o) => s.id.startsWith(o))) continue;
      await page.evaluate(([src, frames, q]) => {
        const g = window.__GAME__;
        g.stopLoop(); g.pause(); g.holdKey('Space', false); g.setClockRunning(false);
        g.setSetting('qualita', q);
        new Function('g', `(${src})(g)`)(g);
        g.ensureLoaded(); g.step(frames); g.ensureLoaded(); g.step(1);
      }, [s.setup.toString(), s.frames || 6, s.q || 'alta']);
      const ms = await page.evaluate(() => window.__GAME__.timedRender());
      await snap(s.id, ms);
      await page.evaluate(() => { const g = window.__GAME__; g.holdKey('Space', false); g.setFreeCamera(false); });
    }
  }
  if (part.includes('B')) {
    await page.evaluate(() => { const g = window.__GAME__; g.stopLoop(); g.setSetting('qualita', 'alta'); });
    await page.getByRole('button', { name: 'Nuova partita' }).click();
    const R = (fn, a) => page.evaluate(fn, a);
    const avanza = (s) => R((s) => window.__GAME__.regia.avanza(s), s);
    await avanza(2);
    await R(() => window.__GAME__.regia.mira('scritta_vetro'));
    await avanza(1.7);
    await R(() => { window.__GAME__.render(); });
    await snap('b01-capsula');
    await avanza(2.5);
    await R(() => window.__GAME__.regia.premi('KeyE'));
    await avanza(1.8);
    await R(() => { const r = window.__GAME__.regia; r.avvicina('capsula_2', 2.6); r.mira('capsula_5'); });
    await R(() => { const g = window.__GAME__; g.ensureLoaded(); g.render(); });
    await snap('b02-cripta-capsule');
    await R(() => {
      const r = window.__GAME__.regia;
      r.regia.squadro.disponibile = true;
      r.regia.squadro.prendi();
      r.impostaOra(1, 11);
      r.vai('terrazza_pedrazzini');
      r.mira([1046, 37.4, 1]);
    });
    await avanza(1);
    await R(() => { const g = window.__GAME__; g.ensureLoaded(); g.render(); });
    await snap('b05-squadro-in-mano');
    await page.screenshot({ path: join(outDir, 'b05-squadro-in-mano-ui.png') });
    await R(() => { const r = window.__GAME__.regia; try { r.avvicina('pianta_cs_3', 1.2); } catch (e) { /* */ } r.regia.squadro.pianta('cs_3'); r.mira([1046, 37.4, 1]); });
    await avanza(0.5);
    await R(() => { const g = window.__GAME__; g.ensureLoaded(); g.render(); });
    await snap('b06-squadro-piantato');
    await R(() => { const r = window.__GAME__.regia; r.regia.squadro.riponi(); });
    await R(() => { const r = window.__GAME__.regia; r.impostaOra(1, 22.3); r.vai(1047, 36.2); r.mira([1060, 38.8, 0]); });
    await avanza(0.5);
    await R(() => { const g = window.__GAME__; g.ensureLoaded(); g.render(); });
    await snap('b07-notte-piazza-gioco');
    await R(() => { const r = window.__GAME__.regia; r.impostaOra(1, 13); r.vai(1030, 37.5); r.mira([1046, 37.2, 0]); });
    await avanza(0.5);
    await R(() => { const g = window.__GAME__; g.ensureLoaded(); g.render(); });
    await snap('b08-giorno');
    await page.screenshot({ path: join(outDir, 'b08-giorno-ui.png') });
  }
  const errors = logs.filter((l) => /error/i.test(l));
  if (errors.length) console.log(errors.slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
