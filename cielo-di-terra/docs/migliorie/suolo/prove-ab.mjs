// Prove A/B della traccia «suolo»: la stessa inquadratura con un passaggio alla volta spento
// (post-produzione, filtro, pennellata, luce dorata, pittura del prato, erba). Dalla cartella del
// gioco, dopo `npm run build:e2e`:
//   node docs/migliorie/suolo/prove-ab.mjs <cartella> [--dist=<dist-e2e>] [--vista=strada] [--q=media] [--only=base,albedo]
// Le varianti girano nel browser con `g = window.__GAME__`; `__GAME__.game.post.parametri` e le
// uniform del mondo si rimettono come prima dopo ogni variante.
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
const vista = arg('vista', 'strada');
const only = arg('only', '') ? arg('only', '').split(',') : null;
const [W, H] = arg('size', '1280x720').split('x').map(Number);
// --setup="<corpo js con g>": una vista su misura (nome 'su-misura', o --nome=...)
const setupLibero = arg('setup', '');
mkdirSync(outDir, { recursive: true });
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const VISTE = {
  strada: (g) => { g.setTime(6.5); g.teleport(1091, 30.4, 0); const gr = g.game.world.groundAt(1062, 35.0); g.lookAt(1062, 35.0, gr + 4); },
  piedi: (g) => { g.setTime(6.5); g.teleport(1091, 30.4, 0); const gr = g.game.world.groundAt(1080, 31.6); g.lookAt(1080, 31.6, gr - 3); },
  terrazze: (g) => { g.setTime(12.5); g.teleport(965, 25.0, 0); const gr = g.game.world.groundAt(990, 30); g.lookAt(990, 30, gr - 3); },
};
if (setupLibero) VISTE[vista] = new Function('g', setupLibero);

// ogni variante: prima della vista (pre) o dopo (post); `g.__P0` = parametri della post originali
const VARIANTI = [
  { id: 'base' },
  { id: 'post-neutra', post: (g) => { const P = g.game.post.parametri; P.luciOro = [1, 1, 1]; P.luci = [1, 1, 1]; P.ombre = [1, 1, 1]; P.saturazione = 1; P.vibranza = 0; P.contrasto = 0; P.bloom = 0; } },
  { id: 'senza-kuwahara', post: (g) => { g.game.post.setPreset({ ...g.game.post.preset, filtro: 'nessuno' }); } },
  { id: 'senza-pennellata', post: (g) => { const P = g.game.post.parametri; P.pennellata = 0; P.pennellataColore = 0; P.tremolio = [0, 26]; P.grana = 0; P.macchie = 0; } },
  { id: 'spalla', post: (g) => { g.game.post.parametri.tonemap = 0; } },
  { id: 'senza-ginocchio', post: (g) => { g.game.post.parametri.ginocchioSaturazione = [1, 1]; } },
  { id: 'ginocchio-lieve', post: (g) => { g.game.post.parametri.ginocchioSaturazione = [0.6, 0.6]; } },
  { id: 'albedo', post: (g) => { g.game.uniforms.uDebugView.value = 2; } },
  { id: 'normali', post: (g) => { g.game.uniforms.uDebugView.value = 1; } },
  { id: 'ore10', pre: (g) => { g.__ora = 10; } },
  { id: 'senza-erba', post: (g) => { const s = g.game.vegetation?.sottobosco; if (s) s.group.visible = false; } },
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
  const port = 6300 + Math.floor(Math.random() * 400);
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
  await page.evaluate(() => { const g = window.__GAME__; g.__P0 = JSON.parse(JSON.stringify(g.game.post.parametri)); });
  for (const v of VARIANTI) {
    if (only && !only.includes(v.id)) continue;
    await page.evaluate(([vsrc, pre, post, q]) => {
      const g = window.__GAME__;
      g.stopLoop(); g.pause(); g.holdKey('Space', false); g.setClockRunning(false);
      g.setSetting('qualita', q);
      g.__ora = null;
      if (pre) new Function('g', `(${pre})(g)`)(g);
      new Function('g', `(${vsrc})(g)`)(g);
      if (g.__ora != null) g.setTime(g.__ora);
      if (post) new Function('g', `(${post})(g)`)(g);
      g.ensureLoaded(); g.step(6); g.ensureLoaded(); g.step(1);
    }, [VISTE[vista].toString(), v.pre?.toString() ?? null, v.post?.toString() ?? null, q]);
    await page.evaluate(() => window.__GAME__.timedRender());
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(join(outDir, `${vista}-${q}-${v.id}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    const st = await page.evaluate(() => { const g = window.__GAME__; const s = g.getStats(); const c = g.game.vegetation?.sottobosco?.conteggi; return `draw ${s.drawCalls} tri ${s.triangles} sottobosco ${JSON.stringify(c)} ${window.__dbg ?? ""}`; });
    console.log(vista, q, v.id, st);
    // rimette tutto com'era
    await page.evaluate(() => {
      const g = window.__GAME__;
      Object.assign(g.game.post.parametri, JSON.parse(JSON.stringify(g.__P0)));
      g.game.uniforms.uDebugView.value = 0;
      const s = g.game.vegetation?.sottobosco;
      if (s) s.group.visible = true;
      g.setSetting('qualita', 'bassa');
    });
  }
  const errors = logs.filter((l) => /error/i.test(l));
  if (errors.length) console.log(errors.slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
