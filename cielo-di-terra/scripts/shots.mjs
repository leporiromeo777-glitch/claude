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
 *    il PNG in docs/shots/;
 * 5. dopo le verifiche di gioco, le inquadrature con l'interfaccia (15-17): una partita vera
 *    della regia, fotografata con la pagina intera (canvas e interfaccia), per l'orologio a
 *    schermo di giorno, di notte e durante «Aspetta fino a» (le cifre che corrono).
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
      g.teleport(1200, 101.5, 0);
      g.look(38, -20);
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
      g.teleport(1012, 30.5, 0);
      g.look(78, 24);
    },
    frames: 4,
  },
  {
    n: 6,
    file: '06-matita-rivelazione.png',
    title: "Rivelazione in corso: l'inchiostro chiude i contorni e il colore entra dal caposaldo",
    setup: (g) => {
      g.setTime(11.2);
      g.__nearPaintPrima = g.game.settings.nearPaint.slice();
      g.setSetting('nearPaint', [6, 14]);
      const origin = { z: 1585, theta: 24 };
      const ground = g.game.world.groundAt(1500, 21);
      g.setCamera(1500, 21, ground + 32, 14, -19);
      const ids = g.cellsInRadius(1590, 25, 125);
      g.revealCells(ids, origin);
    },
    frames: 30,
    // rimette il raggio dipinto di prima (le inquadrature seguenti usano quello predefinito)
    after: (g) => g.setSetting('nearPaint', g.__nearPaintPrima),
  },
  {
    n: 7,
    file: '07-notte-rilievo.png',
    title: 'Di notte, in planata a 70 m: il cerchio rilevato attorno a Corbella contro la carta del non rilevato',
    setup: (g) => {
      // un cerchio di 200 m rilevato (subito, senza animazione) attorno a Corbella
      const ids = g.cellsInRadius(1040, 36.4, 200);
      g.__celle7 = ids.map((id) => [id, g.game.world.cells.get(id)]);
      for (const id of ids) g.setCellState(id, 2);
      g.setTime(23.5);
      const ground = g.game.world.groundAt(1000, 33);
      g.setCamera(1000, 33, ground + 70, 70, -14);
    },
    frames: 4,
    // le inquadrature seguenti ritrovano le celle com'erano (bianche, a matita o dipinte)
    after: (g) => {
      for (const [id, stato] of g.__celle7) g.setCellState(id, stato);
      g.setFreeCamera(false);
    },
  },
  // Confronti con i bozzetti del concept (idee-gioco/pagina/img/finale-N.jpg): stessa scena, stessa ora.
  {
    n: 11,
    file: 'confronto-1-alba-castagno.png',
    title: 'Bozzetto 1: all\'alba, dalla botola sotto il castagno morto, verso il paese e la valle',
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
    title: 'Bozzetto 2: a mezzogiorno sulle terrazze dei castagni, verso il paese e il lago lontano',
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
    title: 'Bozzetto 3: in planata alta lungo l\'asse, il lago e le valli sopra la testa',
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
    title: 'Bozzetto 5: di notte, seduta nell\'erba al margine del paese',
    setup: (g) => {
      g.setTime(22.4);
      g.teleport(1085, 31.5, 0);
      g.lookAt(1050, 37.2, g.game.world.groundAt(1050, 37.2) + 6);
    },
    frames: 6,
  },
];

/**
 * Inquadrature con l'interfaccia (la regia in gioco, la pagina intera): `setup` gira nel browser
 * con `g = window.__GAME__` dopo `preparaPartita`. Si fanno dopo le verifiche: la regia in gioco
 * comanda l'ora e il corpo, e le inquadrature del motore sopra non la vogliono.
 */
const SHOTS_INTERFACCIA = [
  // (in quest'ordine: l'attesa della brace con il suo pannello, poi la notte, che manda avanti la storia)
  {
    n: 15,
    file: '15-orologio-giorno.png',
    title: "L'orologio a schermo di giorno, in piazza alle 10:20 (missione 1, la brace da aspettare)",
    setup: (g) => {
      const G = g.regia;
      G.regia.orologio.imposta(1, 10 + 20 / 60);
      G.avanza(0.2);
      G.mira([1057, 36.2, 46]);
    },
  },
  {
    n: 17,
    file: '17-orologio-attesa.png',
    title: '«Aspetta fino a: la brace»: dopo un secondo e mezzo le cifre corrono (fino alle 19:30), il sole scivola sul quadrante',
    setup: (g) => {
      const G = g.regia;
      const r = G.regia;
      r.orologio.imposta(1, 10 + 20 / 60);
      G.avanza(0.2);
      G.mira([1057, 36.2, 46]);
      r.siedi();
      r.aspettaFino(19.5);
      G.avanza(1.5);
    },
  },
  {
    n: 17.1,
    file: '17b-orologio-attesa.png',
    title: '…dopo tre secondi e mezzo (sempre la stessa attesa: 5,5 s in tutto)',
    setup: (g) => {
      g.regia.avanza(2);
    },
  },
  {
    n: 17.2,
    file: '17c-orologio-arrivo.png',
    title: '…arrivati: le 19:30, la brace (la storia lo sente subito)',
    setup: (g) => {
      const G = g.regia;
      while (G.regia.orologio.inAttesa) G.avanza(0.25);
      G.avanza(0.2);
    },
  },
  {
    n: 16,
    file: '16-orologio-notte.png',
    title: "L'orologio a schermo di notte: il quadrante blu, la luna e le stelle (alle 23:40)",
    setup: (g) => {
      const G = g.regia;
      G.regia.orologio.imposta(1, 23 + 40 / 60);
      G.avanza(0.2);
      G.mira([1057, 36.2, 46]);
    },
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
  const startup = +((Date.now() - t0) / 1000).toFixed(2);
  console.log(`gioco pronto in ${startup} s`);
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
        // le inquadrature si fanno a qualità Alta (post-produzione piena)
        g.setSetting('qualita', 'alta');
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
  // verifiche di gioco nella build reale (camminata, salto, Velo, costo della simulazione)
  const checks = await page.evaluate(() => {
    const g = window.__GAME__;
    g.stopLoop();
    g.pause();
    g.setClockRunning(false);
    // le verifiche disegnano più di cento fotogrammi: qualità Bassa (le inquadrature sopra sono ad Alta)
    g.setSetting('qualita', 'bassa');
    g.setTime(11);
    const out = {};
    const s0 = g.teleport(1032, 36.4, 0);
    g.look(0, 0);
    g.holdKey('KeyW', true);
    g.step(120);
    g.holdKey('KeyW', false);
    const s1 = g.getPlayerState();
    out.walk2s = { dz: +(s1.z - s0.z).toFixed(2), grounded: s1.grounded, mode: s1.mode };
    g.step(30);
    let maxH = 0;
    g.holdKey('Space', true);
    g.step(1);
    g.holdKey('Space', false);
    for (let i = 0; i < 120; i++) {
      g.step(1);
      maxH = Math.max(maxH, g.getPlayerState().heightAboveGround);
    }
    out.jumpHeight = +maxH.toFixed(2);
    // planata da 80 m sopra il fondovalle verso Lag
    g.teleport(1500, 52, 80);
    g.look(0, 0);
    g.startGlide(13);
    const a = g.getPlayerState();
    g.step(600);
    const b = g.getPlayerState();
    out.glide10s = { drop: +(a.h - b.h).toFixed(1), dz: +(b.z - a.z).toFixed(1), speed: +b.speed.toFixed(1), mode: b.mode, ratio: +((b.z - a.z) / Math.max(0.1, a.h - b.h)).toFixed(1) };
    g.holdKey('Space', false);
    // costo CPU della simulazione: 600 passi senza disegno intermedio
    g.teleport(1032, 36.4, 0);
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) g.game.update(1 / 60);
    out.updateMsPerStep = +((performance.now() - t0) / 600).toFixed(3);
    // costo CPU di un render (preparazione e invio dei comandi, non il tempo GPU)
    const t1 = performance.now();
    for (let i = 0; i < 5; i++) g.render();
    out.renderCpuMs = +((performance.now() - t1) / 5).toFixed(1);
    out.stats = g.getStats();
    return out;
  });
  console.log('verifiche:', JSON.stringify(checks));
  // l'interfaccia: una partita della regia nella missione 1 (la brace da aspettare), a qualità Media
  const interfaccia = SHOTS_INTERFACCIA.filter((s) => !only.length || only.includes(Math.floor(s.n)));
  if (interfaccia.length) {
    await page.evaluate(() => {
      const g = window.__GAME__;
      g.stopLoop();
      g.setSetting('qualita', 'media');
      const G = g.regia;
      const r = G.regia;
      r.nuovaPartita();
      const m = r.narrativa.missioni;
      for (const p of ['pr_vetro', 'pr_cripta', 'pr_botola_scala', 'pr_guarda_su', 'pr_camminare', 'pr_lettera', 'pr_campane']) m.completaPasso('prologo', p);
      for (const p of ['m1_lente', 'm1_marza', 'm1_cartellino', 'm1_innesto', 'm1_velo', 'm1_velati', 'm1_ottavio']) m.completaPasso('m01_castagno_vuoto', p);
      // i dialoghi automatici di quei passi, detti fino in fondo (se no si aprirebbero adesso)
      const d = r.narrativa.dialoghi;
      for (const id of ['d_meridiana_1', 'd_ottavio_incontro']) {
        if (d.finito(id) || !d.avvia(id)) continue;
        for (let k = 0; k < 80 && !d.isFinished(); k++) d.choose(0);
      }
      r.narrativa.tick(0);
      r.dialoghi.svuota();
      r.ui.tornaAlGioco();
      r.orologio.fermo = null;
      r.orologio.limite = null;
      r.velatura.dalNero(0.01);
      r.vai(1044, 37.4);
      G.avanza(0.5);
    });
    // le notifiche del Taccuino dei passi completati se ne vanno (4,2 s)
    await new Promise((ok) => setTimeout(ok, 5200));
    for (const shot of interfaccia) {
      const ts = Date.now();
      await page.evaluate((src) => {
        const g = window.__GAME__;
        // eslint-disable-next-line no-new-func
        new Function('g', `(${src})(g)`)(g);
        g.ensureLoaded();
        g.render();
      }, shot.setup.toString());
      await new Promise((ok) => setTimeout(ok, 350));
      // (la pagina intera: con SwiftShader e la macchina carica, il primo disegno a Media è lento)
      await page.screenshot({ path: join(outDir, shot.file), timeout: 240000 });
      const st = await page.evaluate(() => ({ s: window.__GAME__.getStats(), ora: window.__GAME__.regia.stato().ora, orologio: document.querySelector('.ui-or-ora')?.textContent, sotto: document.querySelector('.ui-or-sotto')?.textContent }));
      console.log(`${shot.file}: ${((Date.now() - ts) / 1000).toFixed(1)} s, ore ${st.ora}, orologio «${st.orologio} · ${st.sotto}», draw ${st.s.drawCalls}, tri ${st.s.triangles}`);
      report.push({ ...shot, setup: undefined, stats: st.s, orologio: `${st.orologio} · ${st.sotto}` });
    }
  }
  writeFileSync(join(outDir, 'shots.json'), JSON.stringify({ date: new Date().toISOString(), size: [W, H], chromiumArgs: CHROMIUM_ARGS, renderer: info.renderer, startupSeconds: startup, shots: report, checks }, null, 2));
  const errors = logs.filter((l) => l.includes('error') || l.includes('Error'));
  if (errors.length) console.log('messaggi di errore del browser:\n' + errors.slice(0, 20).join('\n'));
  await browser.close();
  server.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
