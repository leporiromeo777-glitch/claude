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
    titolo: 'Piazza delle Ore con il campanile bianco di San Vigilio e il Pilastro 1, a metà mattina',
    setup: (g, c) => {
      g.setTime(10.2);
      c.applicaOrario(1, 10.2);
      g.setCamera(1030.5, 36.7, g.game.world.groundAt(1030.5, 36.7) + 1.7, 8, 11);
    },
    frames: 3,
  },
  {
    nome: 'cripta',
    file: 'castagno-morto-botola.png',
    titolo: 'Il castagno morto e la botola della Cripta fra le radici, la mattina',
    setup: (g, c) => {
      g.setTime(7.2);
      c.applicaOrario(1, 7.2);
      c.apriBotola(true);
      g.setCamera(1105, 25.9, g.game.world.groundAt(1105, 25.9) + 1.8, 63, -8);
    },
    frames: 90,
    after: (g, c) => c.apriBotola(false),
  },
  {
    nome: 'terrazza',
    file: 'terrazza-pedrazzini.png',
    titolo: 'La Terrazza Pedrazzini: castagni da frutto, erba alta, il castagno del cartellino',
    setup: (g, c) => {
      g.setTime(15.0);
      c.applicaOrario(1, 15.0);
      const t = c.punto('chiodo:3').cil; g.setCamera(934.5, 23.15, t.h + 1.5, 4, 1);
    },
    frames: 3,
  },
  {
    nome: 'fienile',
    file: 'fienile-ottavio.png',
    titolo: 'Il fienile di Ottavio oltre il riale, il Sass dal Messo e la passerella',
    setup: (g, c) => {
      g.setTime(16.5);
      c.applicaOrario(1, 10.5);
      c.setVariante('E1', 'Abitata');
      g.setCamera(1171.2, 56.3, g.game.world.groundAt(1171.2, 56.3) + 1.7, 70, 6);
    },
    frames: 3,
  },
  {
    nome: 'chiodo',
    file: 'chiodo-3-squadro.png',
    titolo: 'Il chiodo 3 sulla copertina del muro della Terrazza: dove si pianta lo squadro per collimare il Pilastro 1',
    setup: (g, c) => {
      g.setTime(11.0);
      const p = c.punto('chiodo:3').cil;
      g.setCamera(p.z - 0.55, p.theta - 0.085, p.h + 1.05, 46, -42);
    },
    frames: 3,
  },
  {
    nome: 'abitanti',
    file: 'abitanti-piazza.png',
    titolo: 'Gli abitanti velati in piazza: Ottavio, i bambini, Pina sulla soglia, i velati',
    setup: (g, c) => {
      g.setTime(13.2);
      c.applicaOrario(1, 13.2);
      // qualche velato in piazza per l'inquadratura, Ottavio saluta
      const vel = [[1048.5, 35.9], [1050.2, 36.3], [1044.2, 35.4], [1052.5, 37.9]];
      vel.forEach(([z, th], i) => {
        const n = c.npc('velato_' + (i + 1));
        n.manuale = true;
        n.mostra(true);
        n.vaiA(z, th);
        n.orientaVerso({ z: 1047, theta: 38.6 });
      });
      g.setCamera(1043.0, 38.25, g.game.world.groundAt(1043.0, 38.25) + 1.65, -72, 2);
      c.npc('ottavio').gesto('saluta', 0);
      c.npc('lisa').gesto('indica', 0, { z: 1062, theta: 37.2, h: 70 });
    },
    frames: 40,
  },
  {
    nome: 'notte',
    file: 'notte-paese.png',
    titolo: 'Corbella di notte: finestre accese, lampioni, le Fade sui Ronchi, la casa di Nando',
    setup: (g, c) => {
      g.setTime(0.6);
      c.applicaOrario(2, 0.6);
      c.setVariante('E2', 'Smontata');
      g.setCamera(1204, 49.2, g.game.world.groundAt(1204, 49.2) + 7.5, 232, -9);
    },
    frames: 60,
  },
  {
    nome: 'fade',
    file: 'fade-ronchi.png',
    titolo: 'Le Fade alle 00:40 sui Ronchi: lumi caldi in cerchio sopra la casa di Nando',
    setup: (g, c) => {
      g.setTime(0.66);
      c.applicaOrario(2, 0.66);
      c.setVariante('E2', 'Smontata');
      g.setCamera(1186, 44.2, g.game.world.groundAt(1186, 44.2) + 3.0, 150, -4);
    },
    frames: 90,
  },
  {
    nome: 'cripta-interno',
    file: 'cripta-interno.png',
    titolo: 'La Cripta dei Giardinieri sotto la botola: sette capsule, luci color miele',
    setup: (g, c) => {
      g.setTime(5.6);
      c.cripta.interno.visible = true;
      const s = c.cripta.sala;
      const b = c.cripta.botola;
      g.setCamera(b.z + (s.z - b.z) * 0.45, b.theta + (s.theta - b.theta) * 0.45, s.h + 1.6, Math.atan2((s.theta - b.theta) * 10.6, s.z - b.z) * 57.3, -6);
    },
    after: (g, c) => (c.cripta.interno.visible = false),
    frames: 2,
  },
  {
    nome: 'mobili',
    file: 'mobili-varianti.png',
    titolo: 'Elementi mobili: la passerella del Messo (Abitata), la casa di Nando (Smontata), il muro di Ronco con la breccia',
    setup: (g, c) => {
      g.setTime(9.0);
      c.applicaOrario(2, 9.0);
      c.setVariante('E1', 'Abitata');
      c.setVariante('E2', 'Smontata');
      c.setVariante('E3', 'Abitata');
      g.setCamera(1176, 42.6, g.game.world.groundAt(1176, 42.6) + 14, 90, -22);
    },
    frames: 3,
  },
  {
    nome: 'velo',
    file: 'muri-del-velo.png',
    titolo: 'I tre muri del Velo dalla Terrazza: il Muretto, il Muraglione della Grà, la Ripa sopra la piazza',
    setup: (g, c) => {
      g.setTime(11.5);
      c.applicaOrario(1, 11.5);
      g.setCamera(958, 24.0, g.game.world.groundAt(958, 24.0) + 8, 45, -10);
    },
    frames: 3,
  },
  {
    nome: 'panorama',
    file: 'panorama-paese.png',
    titolo: "Corbella dall'alto delle terrazze, a Mont e a Sera del paese",
    setup: (g, c) => {
      g.setTime(10.8);
      c.applicaOrario(1, 10.8);
      g.setCamera(985, 24, g.game.world.groundAt(985, 24) + 26, 50, -14);
    },
    frames: 3,
  },
  {
    nome: 'chiesa',
    file: 'chiesa-sagrato.png',
    titolo: 'San Vigilio, il sagrato a gradini e il tasso',
    setup: (g, c) => {
      g.setTime(15.5);
      c.applicaOrario(1, 15.5);
      g.setCamera(1052, 41.2, g.game.world.groundAt(1052, 41.2) + 1.8, -63, 7);
    },
    frames: 3,
  },
  {
    nome: 'pianta',
    file: 'debug-pianta.png',
    titolo: "Pianta di Corbella vista dall'alto (controllo del piazzamento)",
    setup: (g) => {
      g.setTime(12);
      g.setSetting('nearPaint', [400, 600]);
      g.setCamera(1080, 37, 330, 0, -89.5);
    },
    after: (g) => g.setSetting('nearPaint', [70, 150]),
    frames: 2,
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
    if (shot.after) await page.evaluate((src) => new Function('g', 'c', `(${src})(g, c)`)(window.__GAME__, window.__CORBELLA__), shot.after.toString());
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
