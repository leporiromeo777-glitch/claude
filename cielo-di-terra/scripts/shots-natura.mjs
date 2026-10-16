#!/usr/bin/env node
/**
 * Inquadrature della traccia «natura» (alberi, sottobosco, terreno, muri, acqua): stesse regole di
 * `npm run shots` (build E2E, Chromium con SwiftShader, qualità Alta), ma con viste a livello degli
 * occhi nelle selve, sulle terrazze, al lago e al riale, più i quattro confronti con i bozzetti.
 *
 *   node scripts/shots-natura.mjs [--no-build] [--only=21,23] [--out=cartella] [--qualita=alta]
 *
 * Le schermate vanno in `--out` (predefinito docs/shots/natura: come le altre schermate rigenerate, non si committano).
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
  return f && f.includes('=') ? f.split('=').slice(1).join('=') : def;
};
const only = value('only', '')
  .split(',')
  .filter(Boolean)
  .map(Number);
const [W, H] = value('size', '1280x720').split('x').map(Number);
const qualita = value('qualita', 'alta');
const outDir = resolve(root, value('out', join('docs', 'shots', 'natura')));
mkdirSync(outDir, { recursive: true });

const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** Inquadrature: ogni `setup` gira nel browser con `g = window.__GAME__`. */
const SHOTS = [
  {
    n: 11,
    file: 'confronto-1-alba-castagno.png',
    setup: (g) => {
      g.setTime(7.0);
      g.teleport(1117, 26.6, 0);
      g.lookAt(1046, 37.4, g.game.world.groundAt(1046, 37.4) + 18);
    },
    frames: 6,
  },
  {
    n: 12,
    file: 'confronto-2-terrazze-mezzogiorno.png',
    setup: (g) => {
      g.setTime(12.5);
      g.teleport(965, 25.0, 0);
      g.lookAt(1045, 38, g.game.world.groundAt(1045, 38) - 6);
    },
    frames: 6,
  },
  {
    n: 13,
    file: 'confronto-3-planata-asse.png',
    setup: (g) => {
      g.setTime(11);
      g.teleport(700, 35, 330, true);
      g.look(0, 12);
      g.startGlide(7);
    },
    frames: 40,
  },
  {
    n: 14,
    file: 'confronto-5-notte-paese.png',
    setup: (g) => {
      g.setTime(22.4);
      g.teleport(1085, 31.5, 0);
      g.lookAt(1050, 37.2, g.game.world.groundAt(1050, 37.2) + 6);
    },
    frames: 6,
  },
  {
    n: 21,
    file: 'natura-21-selva-mattino.png',
    // nella selva castanile sul versante a Sera, al mattino, guardando lungo il pendio
    setup: (g) => {
      g.setTime(9.2);
      g.teleport(850, 12, 0);
      g.look(20, 2);
    },
    frames: 6,
  },
  {
    n: 22,
    file: 'natura-22-muri-terrazze.png',
    // sul gradone sotto il Muretto della Terrazza: i muri a secco e la Terrazza Pedrazzini
    setup: (g) => {
      g.setTime(12.5);
      g.teleport(968, 27.2, 0);
      g.lookAt(950, 23.0, g.game.world.groundAt(950, 23.0) + 4);
    },
    frames: 6,
  },
  {
    n: 23,
    file: 'natura-23-castagno-morto.png',
    // il castagno morto della botola, dal sentiero, all'alba
    setup: (g) => {
      g.setTime(7.2);
      g.teleport(1123, 26.9, 0);
      g.lookAt(1114, 27.6, g.game.world.groundAt(1114, 27.6) + 4.5);
    },
    frames: 6,
  },
  {
    n: 24,
    file: 'natura-24-riva-lago.png',
    // sulla riva del Verbanetto, verso l'Isola dei Conigli
    setup: (g) => {
      g.setTime(11.5);
      g.teleport(1120, 139.5, 0);
      g.lookAt(1185, 156, 22);
    },
    frames: 6,
  },
  {
    n: 25,
    file: 'natura-25-riale.png',
    // sul ponte del Mulino, lungo il riale
    setup: (g) => {
      g.setTime(10.5);
      g.teleport(1093, 53.2, 0);
      g.look(2, -14);
    },
    frames: 6,
  },
  {
    n: 26,
    file: 'natura-26-versanti-boschi.png',
    // dal margine del paese verso i boschi del versante a Mane (300-700 m)
    setup: (g) => {
      g.setTime(10);
      g.teleport(1000, 44, 0);
      g.look(70, 8);
    },
    frames: 6,
  },
  {
    n: 27,
    file: 'natura-27-prato-sera.png',
    // nel prato sotto il paese, luce bassa della sera, erba alta vicino
    setup: (g) => {
      g.setTime(17.4);
      g.teleport(1180, 33, 0);
      g.look(175, -4);
    },
    frames: 6,
  },
  {
    n: 29,
    file: 'natura-29-lago-dall-alto.png',
    // il Verbanetto dall'alto (120 m sopra la riva a Mane), verso l'Isola Grande
    setup: (g) => {
      g.setTime(11);
      g.setCamera(1500, 196, 140, -30, -32);
    },
    frames: 4,
  },
  {
    n: 30,
    file: 'natura-30-terrazza-pedrazzini.png',
    // sulla Terrazza Pedrazzini, fra i castagni da frutto, verso il castagno del cartellino
    setup: (g) => {
      g.setTime(10.2);
      g.teleport(939, 22.35, 0);
      g.lookAt(951, 22.2, g.game.world.groundAt(951, 22.2) + 4);
    },
    frames: 6,
  },
  {
    n: 28,
    file: 'natura-28-lavatoio.png',
    // il lavatoio coperto della piazza (la vasca del popolamento è affondata nel suolo della
    // piazza: dell'acqua «lago-lavatoio» si vede solo l'estremità, vedi docs/grafica/natura.md)
    setup: (g) => {
      g.setTime(10.5);
      g.teleport(1035.5, 39.9, 0);
      g.lookAt(1043.4, 39.1, g.game.world.groundAt(1043.4, 39.1) + 0.6);
    },
    frames: 6,
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
  const port = 4380 + Math.floor(Math.random() * 200);
  const server = await serve(dist, port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`));
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__, null, { timeout: 300000 });
  const report = [];
  for (const shot of SHOTS) {
    if (only.length && !only.includes(shot.n)) continue;
    const ts = Date.now();
    await page.evaluate(
      ([src, frames, q]) => {
        const g = window.__GAME__;
        g.stopLoop();
        g.pause();
        g.holdKey('Space', false);
        g.setClockRunning(false);
        g.setSetting('qualita', q);
        const fn = new Function('g', `(${src})(g)`);
        fn(g);
        g.ensureLoaded();
        g.step(frames);
        g.ensureLoaded();
        g.step(1);
      },
      [shot.setup.toString(), shot.frames, qualita],
    );
    await page.evaluate(() => window.__GAME__.timedRender());
    const file = join(outDir, shot.file);
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    const st = await page.evaluate(() => ({ s: window.__GAME__.getStats(), p: window.__GAME__.getPlayerState(), o: window.__LUCE__?.ombre?.stats ?? null }));
    const line = `${shot.file}: ${((Date.now() - ts) / 1000).toFixed(1)} s, draw ${st.s.drawCalls}, tri ${st.s.triangles}, alberi ${st.s.treesByLod.join('/')}, camera z ${st.p.camera.z.toFixed(0)} θ ${st.p.camera.theta.toFixed(1)} h ${st.p.camera.h.toFixed(1)}, ${st.p.mode}${st.o ? `, ombre draw ${st.o.calls} tri ${st.o.triangles}` : ""}`;
    console.log(line);
    report.push({ file: shot.file, stats: st.s, player: st.p });
  }
  writeFileSync(join(outDir, 'shots-natura.json'), JSON.stringify({ date: new Date().toISOString(), qualita, size: [W, H], shots: report }, null, 2));
  const errors = logs.filter((l) => l.includes('error') || l.includes('Error'));
  if (errors.length) console.log('messaggi di errore del browser:\n' + errors.slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
