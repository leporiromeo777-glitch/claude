#!/usr/bin/env node
/**
 * I personaggi generati NEL GIOCO VERO, senza toccare il popolamento: avvia Vite in sviluppo con la
 * modalità e2e (window.__GAME__ e window.__GAME__.regia), apre Chromium headless con WebGL2 via
 * SwiftShader (come scripts/shots.mjs), comincia una partita nuova, esce in piazza con la regia e
 * mette accanto alla camera i modelli di public/personaggi con il modulo src/personaggi (materiale
 * del mondo, livelli di dettaglio, animazione) e, per confronto, la figura procedurale di oggi.
 *
 *   node tools/personaggi/nel-gioco.mjs --out=<cartella> [--size=1280x720] [--solo=giorno,primo,gesti,pose,seduti,sera,notte,lontano,matita]
 *
 * Senza --out le schermate vanno nella cartella temporanea del sistema (non nel repository).
 * Le schermate sono il solo canvas (window.__GAME__.capture), senza interfaccia.
 */
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const radice = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || '1'];
  }),
);
const out = resolve(args.out ?? join(tmpdir(), 'personaggi-nel-gioco'));
mkdirSync(out, { recursive: true });
const [W, H] = (args.size ?? '1280x720').split('x').map(Number);
const solo = (args.solo ?? 'giorno,primo,gesti,pose,seduti,sera,notte,lontano,matita').split(',');
const porta = 5190 + Math.floor(Math.random() * 9);

// node_modules può essere un collegamento a un'altra copia del repository: va permesso a Vite
const moduli = realpathSync(join(radice, 'node_modules'));
const server = await createServer({
  root: radice,
  mode: 'e2e',
  logLevel: 'error',
  server: { port: porta, host: '127.0.0.1', hmr: false, fs: { allow: [radice, moduli] } },
  // le dipendenze che solo il modulo dei personaggi importa: pronte da subito, altrimenti Vite le
  // scopre all'import dinamico, rifà l'ottimizzazione e la pagina resta con i moduli vecchi (504)
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js'] },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.error('errore pagina:', e.message));
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.error(`console ${m.type()}:`, m.text());
});

/** Gira nel browser: prepara i personaggi e le funzioni per metterli in scena. */
async function installa() {
  const G = window.__GAME__;
  const game = G.game;
  const R = G.regia;
  G.stopLoop();
  G.pause();
  G.setClockRunning(false);
  const P = await import('/src/personaggi/index.ts');
  const C = await import('/src/oggetti/cilindro.ts');
  const L = await import('/src/regia/luoghi.ts');
  const A = await import('/src/oggetti/oggetti/abitante.ts');
  const T = await import('/src/popolamento/terreno.ts');
  P.collegaMotorePersonaggi({ uniforms: game.uniforms, camera: game.camera });
  const esito = await P.precaricaPersonaggi();
  const figure = [];
  game.sistemi.push({
    update: (dt) => {
      for (const f of figure) f.obj.update?.(dt, f.stato);
    },
  });
  const quota = (z, th) => L.quotaAppoggio(game.world.colliders, z, th);
  window.__PERS__ = {
    esito,
    /** mette `chi` (id del popolamento; 'vecchio:<id>' = figura procedurale) a nord/est (m) del punto, con yaw (gradi, 0 = nord) */
    metti(chi, opz, base, nord, est, yaw, stato = { modo: 'fermo' }) {
      const obj = chi.startsWith('vecchio:') ? A.creaAbitante(opz) : P.creaPersonaggio(chi, opz);
      if (!obj) throw new Error(`nessun modello per ${chi}`);
      const q = T.sposta(base.z, base.theta, nord, est, 40);
      C.matriceSuperficie(q.z, q.theta, quota(q.z, q.theta), yaw).decompose(obj.gruppo.position, obj.gruppo.quaternion, obj.gruppo.scale);
      game.scene.add(obj.gruppo);
      obj.gruppo.updateMatrixWorld(true);
      figure.push({ obj, stato, chi, z: q.z, theta: q.theta });
      return figure.length - 1;
    },
    stato(i, s) {
      Object.assign(figure[i].stato, s);
    },
    /** un punto mondo a nord/est (m) e a quota h sopra l'appoggio */
    punto(base, nord, est, h) {
      const q = T.sposta(base.z, base.theta, nord, est, 40);
      return T.mondo(q.z, q.theta, quota(q.z, q.theta) + h);
    },
    svuota() {
      for (const f of figure) {
        f.obj.gruppo.removeFromParent();
        f.obj.dispose();
      }
      figure.length = 0;
    },
    /** camera a nord/est del punto, occhi a h sopra l'appoggio, che guarda verso yaw/pitch */
    camera(base, nord, est, h, yaw, pitch) {
      const q = T.sposta(base.z, base.theta, nord, est, 40);
      G.setCamera(q.z, q.theta, quota(q.z, q.theta) + h, yaw, pitch);
    },
    ora(h) {
      R.regia.orologio.fermo = null;
      R.regia.orologio.limite = null;
      R.impostaOra(1, h);
      G.setTime(h);
    },
    livelli: () => figure.map((f) => `${f.chi}:${P.livelloPersonaggio(f.obj)}`),
    passi(n) {
      G.step(n);
    },
  };
  return esito;
}

async function scatta(nome, fotogrammi = 3) {
  await page.evaluate((n) => {
    const G = window.__GAME__;
    G.ensureLoaded();
    G.step(n);
  }, fotogrammi);
  const dataUrl = await page.evaluate(() => window.__GAME__.capture());
  const file = join(out, `${nome}.png`);
  writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  const livelli = await page.evaluate(() => window.__PERS__.livelli().join(' '));
  console.log('scritto', file, livelli);
}

try {
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${porta}/?nuova`);
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 600000 });
  console.log(`gioco pronto in ${Math.round((Date.now() - t0) / 1000)} s`);
  // fuori dalla capsula, in piazza
  await page.evaluate(() => window.__GAME__.regia.vai('piazza_ore'));
  const esito = await page.evaluate(`(${installa.toString()})()`);
  console.log('modelli:', JSON.stringify(esito));
  // il punto di lavoro: un po' a sud del centro della piazza (spazio libero)
  const BASE = await page.evaluate(() => {
    const p = window.__GAME__.game.player.cyl;
    return { z: p.z, theta: p.theta };
  });
  const TOGNA = { seme: 'togna', copricapo: 'velo', corporatura: 'robusta', postura: 'curva', colore: 0xd9d0bf, coloreVelo: 0x6a4a31 };
  const NANDO = { seme: 'nando', copricapo: 'cappello', corporatura: 'robusta', postura: 'eretta', colore: 0xcfbd97, coloreVelo: 0x8a7a5a, guanti: false };

  /** la scena di confronto: figura procedurale, Togna, Nando, di fronte alla camera */
  const confronto = async (ora, nome, dist = 4.6, h = 1.55, pitch = -3) => {
    await page.evaluate(
      ([B, T, N, ora, dist, h, pitch]) => {
        const X = window.__PERS__;
        X.svuota();
        X.ora(ora);
        const occhi = X.punto(B, -dist, 0, 1.55);
        X.metti('vecchio:togna', T, B, 0, 1.25, 180, { modo: 'fermo' });
        X.metti('togna', T, B, 0, 0, 180, { modo: 'fermo', guarda: occhi });
        X.metti('nando', N, B, 0.2, -1.15, 175, { modo: 'fermo', guarda: occhi });
        X.camera(B, -dist, 0, h, 0, pitch);
        X.passi(120);
      },
      [BASE, TOGNA, NANDO, ora, dist, h, pitch],
    );
    await scatta(nome);
  };

  if (solo.includes('giorno')) await confronto(10.5, 'giorno-confronto');
  if (solo.includes('primo')) {
    await page.evaluate(
      ([B, T, N]) => {
        const X = window.__PERS__;
        X.svuota();
        X.ora(11);
        const occhi = X.punto(B, -2.3, 0.6, 1.6);
        X.metti('togna', T, B, 0, 0.45, 200, { modo: 'fermo', guarda: occhi });
        X.metti('nando', N, B, 0.3, -0.55, 160, { modo: 'fermo', guarda: occhi });
        X.camera(B, -2.4, 0.5, 1.5, -6, -6);
        X.passi(90);
      },
      [BASE, TOGNA, NANDO],
    );
    await scatta('giorno-primo-piano');
  }
  if (solo.includes('gesti')) {
    await page.evaluate(
      ([B, T, N]) => {
        const X = window.__PERS__;
        X.svuota();
        X.ora(10.5);
        const occhi = X.punto(B, -4.4, 0, 1.55);
        X.metti('togna', T, B, 0, 0.7, 180, { modo: 'fermo', guarda: occhi, gesto: 'saluta' });
        X.metti('nando', N, B, 0, -0.8, 180, { modo: 'fermo', gesto: 'indica', indica: X.punto(B, 3, -6, 2), guarda: X.punto(B, 3, -6, 2) });
        X.camera(B, -4.4, 0, 1.55, 0, -3);
        X.passi(90);
      },
      [BASE, TOGNA, NANDO],
    );
    await scatta('giorno-gesti');
  }
  if (solo.includes('pose')) {
    await page.evaluate(
      ([B, T, N]) => {
        const X = window.__PERS__;
        X.svuota();
        X.ora(10.5);
        X.metti('togna', T, B, 0, 1.0, 120, { modo: 'fermo', posa: 'chino' });
        X.metti('nando', N, B, 0.4, -0.6, 200, { modo: 'cammina', velocita: 1.2 });
        X.metti('togna', { ...T, seme: 'togna-2', postura: 'mani-giunte' }, B, 1.6, -2.2, 160, { modo: 'fermo' });
        X.camera(B, -4.6, -0.3, 1.5, 0, -4);
        X.passi(100);
      },
      [BASE, TOGNA, NANDO],
    );
    await scatta('giorno-pose-1');
    await scatta('giorno-pose-2', 17);
  }
  if (solo.includes('seduti')) {
    // seduti (sulla panca che qui non c'è: il bacino a 0,5 m, come vuole il popolamento con `sopra`)
    await page.evaluate(
      ([B, T, N]) => {
        const X = window.__PERS__;
        X.svuota();
        X.ora(10.5);
        const occhi = X.punto(B, -3.6, 1.2, 1.5);
        X.metti('togna', { ...T, postura: 'eretta' }, B, 0, 0.6, 215, { modo: 'fermo', posa: 'seduto', guarda: occhi });
        X.metti('nando', N, B, 0.2, -0.7, 150, { modo: 'fermo', posa: 'seduto' });
        X.camera(B, -3.4, 1.4, 1.3, -18, -8);
        X.passi(120);
      },
      [BASE, TOGNA, NANDO],
    );
    await scatta('giorno-seduti');
  }
  if (solo.includes('sera')) await confronto(18.9, 'sera-confronto');
  if (solo.includes('notte')) await confronto(22.5, 'notte-confronto');
  if (solo.includes('lontano')) {
    for (const [d, nome] of [
      [14, 'giorno-14m'],
      [40, 'giorno-40m-lod1'],
      [130, 'giorno-130m-lontano'],
    ]) {
      await page.evaluate(
        ([B, T, N, d]) => {
          const X = window.__PERS__;
          X.svuota();
          X.ora(10.5);
          X.metti('vecchio:togna', T, B, 0, 1.4, 180, { modo: 'fermo' });
          X.metti('togna', T, B, 0, 0, 180, { modo: 'fermo' });
          X.metti('nando', N, B, 0.2, -1.3, 180, { modo: 'cammina', velocita: 1.1 });
          // da lontano la camera sale un poco (la piazza è più alta del prato che la circonda)
          X.camera(B, -d, 0, d > 30 ? d * 0.12 : 1.6, 0, d > 30 ? -6 : -1.5);
          X.passi(60);
        },
        [BASE, TOGNA, NANDO, d],
      );
      await scatta(nome);
    }
  }
  if (solo.includes('matita')) {
    // il mondo non rilevato a matita: anche i personaggi (oltre i pochi metri «sempre dipinti»).
    // Le celle attorno alla piazza tornano «a matita» (stato 1) solo per questa schermata.
    await page.evaluate((B) => {
      const G = window.__GAME__;
      G.setSetting('nearPaint', [2, 4]);
      for (const id of G.cellsInRadius(B.z, B.theta, 60)) G.setCellState(id, 1);
    }, BASE);
    await confronto(10.5, 'giorno-matita', 9, 1.6, -3);
    await page.evaluate(() => window.__GAME__.setSetting('nearPaint', [70, 150]));
  }
} finally {
  await browser.close();
  await server.close();
}
