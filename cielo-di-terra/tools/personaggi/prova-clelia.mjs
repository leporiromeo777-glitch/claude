#!/usr/bin/env node
/**
 * Che cosa vede chi gioca, con l'interfaccia, quando Clelia dà il dono alla Bacheca (giorno 2, ore 10,
 * qualità Media, 1280×720): il dialogo automatico, la lettera della Madre, e poi la novizia che se ne va a
 * piedi alla Casa del Velo (traccia «parlare», seconda tornata: docs/migliorie/parlare.md). Elvira sta a 3 m
 * da lei dalla parte della piazza, risponde 1 alle due battute, chiude la lettera con Esc e la segue con lo
 * sguardo. Salva le schermate della pagina (page.screenshot) e log.json (presente, visibile, cammina,
 * distanza).
 *
 *   node tools/personaggi/prova-clelia.mjs --root=<cielo-di-terra> --out=<cartella>
 */
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=') || '1']; }));
const radice = resolve(args.root);
const out = resolve(args.out);
mkdirSync(out, { recursive: true });
const nm = realpathSync(join(radice, 'node_modules'));
const { chromium } = await import(join(nm, '@playwright/test/index.mjs'));
const { createServer } = await import(join(nm, 'vite/dist/node/index.js'));
const porta = 5950 + Math.floor(Math.random() * 40);
const server = await createServer({ root: radice, mode: 'e2e', logLevel: 'error', server: { port: porta, host: '127.0.0.1', hmr: false, fs: { allow: [radice, nm] } }, optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js'] } });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.setDefaultTimeout(1800000);
const S = (fn, a) => page.evaluate(fn, a);
const log = [];
try {
  await page.goto(`http://127.0.0.1:${porta}/?nuova`);
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 1800000 });
  await S(() => window.__GAME__.setSetting('qualita', 'media'));
  await S(() => {
    const G = window.__GAME__;
    G.stopLoop();
    const r = G.regia.regia;
    r.orologio.fermo = null;
    r.orologio.limite = null;
    G.regia.vai('bacheca_ore');
    G.regia.impostaOra(2, 10);
    G.setTime(10);
    r.abitanti.corbella.applicaOrario(2, 10);
    G.regia.avanza(2);
    // Elvira a 3 m da Clelia, dalla parte della piazza (la bacheca non le copre la vista), e la guarda
    const n = r.abitanti.corbella.npc('clelia');
    const c = n.posizione();
    const dz = 1046 - c.z, de = (37.0 - c.theta) * 11.27;
    const l = Math.hypot(dz, de);
    const e = { z: c.z + (dz / l) * 3, theta: c.theta + ((de / l) * 3) / 11.27 };
    G.game.player.teleport(e.z, e.theta, 0, true);
    G.game.syncEyeNow();
    const V3 = G.game.camera.position.constructor;
    const Q = G.game.camera.quaternion.constructor;
    const testa = () => { const f = n.figura; f.updateMatrixWorld(true); const p = f.getWorldPosition(new V3()); const su = new V3(0, 1, 0).applyQuaternion(f.getWorldQuaternion(new Q())); return p.addScaledVector(su, 1.3); };
    r.guarda(testa());
    G.regia.avanza(1);
    r.guarda(testa());
    G.ensureLoaded();
  });
  // come nel gioco: la coda dei dialoghi lo apre da sola (luogo raggiunto)
  for (let i = 0; i < 40; i++) {
    const s = await S(() => { window.__GAME__.regia.avanza(0.25); return window.__GAME__.regia.stato(); });
    if (s.dialogo) break;
  }
  let n = 0;
  const foto = async (nome) => {
    await S(() => window.__GAME__.render());
    await page.screenshot({ path: join(out, `${String(n++).padStart(2, '0')}-${nome}.png`) });
    const v = await S(() => { const G = window.__GAME__; const f = G.regia.regia.abitanti.corbella.npc('clelia'); const p = f?.posizione(); const pc = G.game.player.cyl; return { presente: f?.presente, visibile: f?.figura?.visible, cammina: f?.inCammino, lettura: G.regia.stato().lettura, dialogo: G.regia.stato().dialogo?.nodo ?? null, distanza: p ? Math.round(Math.hypot(p.z - pc.z, (p.theta - pc.theta) * 11.27) * 10) / 10 : null }; });
    log.push({ nome, ...v });
    console.log(nome, JSON.stringify(v));
  };
  await S(() => window.__GAME__.regia.avanza(1.5));
  await foto('n1');
  await page.keyboard.press('Enter');
  await S(() => window.__GAME__.regia.avanza(0.1));
  await page.keyboard.press('1');
  await S(() => window.__GAME__.regia.avanza(2.5));
  await foto('n2');
  await page.keyboard.press('Enter');
  await S(() => window.__GAME__.regia.avanza(0.05));
  await page.keyboard.press('1');
  for (const dt of [0.02, 0.1, 0.3, 0.8]) {
    await S((x) => window.__GAME__.regia.avanza(x), dt);
    await foto(`dopo-${dt}`);
  }
  await page.keyboard.press('Escape');
  await S(() => window.__GAME__.regia.avanza(0.5));
  await foto('lettera-chiusa');
  // poi la si guarda andare via: Elvira la segue con lo sguardo
  for (const [i, dt] of [0.5, 0.5, 0.5, 0.5, 1, 1, 1.5, 2, 3, 4, 5, 6, 8].entries()) {
    await S((x) => {
      const G = window.__GAME__;
      const r = G.regia.regia;
      const V3 = G.game.camera.position.constructor;
      const Q = G.game.camera.quaternion.constructor;
      const n = r.abitanti.corbella.npc('clelia');
      for (let k = 0; k < Math.round(x * 30); k++) {
        G.regia.avanza(1 / 30);
        if (n?.presente) {
          const f = n.figura;
          f.updateMatrixWorld(true);
          const p = f.getWorldPosition(new V3());
          const su = new V3(0, 1, 0).applyQuaternion(f.getWorldQuaternion(new Q()));
          r.guarda(p.addScaledVector(su, 1.0));
        }
      }
    }, dt);
    await foto(`via-${i}`);
  }
} catch (e) {
  console.error(e);
} finally {
  writeFileSync(join(out, 'log.json'), JSON.stringify(log, null, 1));
  await browser.close();
  await server.close();
}
