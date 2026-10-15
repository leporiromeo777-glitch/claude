#!/usr/bin/env node
/**
 * Le schermate dei personaggi NEL GIOCO VERO, con il popolamento collegato (src/popolamento/abitanti.ts
 * usa creaPersonaggio): i personaggi stanno dove li mettono gli orari dei contenuti, nella posa che il
 * popolamento chiede (china, seduta, in volo), con la luce e la foschia del mondo.
 *
 * Avvia Vite in sviluppo (modalità e2e: window.__GAME__ e window.__GAME__.regia), apre Chromium headless
 * con WebGL2 via SwiftShader (come scripts/shots.mjs), comincia una partita nuova, esce dalla capsula e
 * per ogni inquadratura mette l'ora, lascia che gli orari collochino la gente e porta la camera libera
 * davanti a chi va guardato.
 *
 *   node tools/personaggi/gioco.mjs [--out=<cartella>] [--size=1280x720] [--solo=dialogo,togna,ottavio,san-vigilio,bambini,nando,clelia,pina,alba,notte,lod] [--prova=<file.json>]
 *
 * Senza --out le schermate vanno nella cartella temporanea del sistema (non nel repository); per la
 * documentazione: --out=docs/personaggi/gioco. Le schermate sono il canvas (window.__GAME__.capture),
 * tranne «dialogo», che è la pagina intera (la finestra del dialogo è HTML).
 *
 * Con --procedurale le richieste a personaggi/ falliscono: il gioco usa le figure procedurali di prima
 * (le stesse inquadrature, per il confronto; e la prova che il ripiego funziona nel browser).
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
const out = resolve(args.out ?? join(tmpdir(), 'personaggi-gioco'));
mkdirSync(out, { recursive: true });
const [W, H] = (args.size ?? '1280x720').split('x').map(Number);
const TUTTE = ['dialogo', 'togna', 'ottavio', 'san-vigilio', 'bambini', 'nando', 'clelia', 'pina', 'alba', 'notte', 'lod'];
const solo = (args.solo ?? TUTTE.join(',')).split(',');
const porta = 5230 + Math.floor(Math.random() * 40);

const moduli = realpathSync(join(radice, 'node_modules'));
const server = await createServer({
  root: radice,
  mode: 'e2e',
  logLevel: 'error',
  server: { port: porta, host: '127.0.0.1', hmr: false, fs: { allow: [radice, moduli] } },
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js'] },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(600000);
page.on('pageerror', (e) => console.error('errore pagina:', e.message));
// --procedurale: i modelli non si scaricano (come senza file): il gioco deve ripiegare sulla figura di sempre
// (solo la cartella dei modelli: /src/personaggi/ è il codice del modulo e deve caricarsi)
if (args.procedurale) await page.route((u) => u.pathname.startsWith('/personaggi/'), (r) => r.abort());
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.error(`console ${m.type()}:`, m.text());
});

/** Gira nel browser: funzioni per mettere l'ora e la camera. */
async function installa() {
  const G = window.__GAME__;
  const game = G.game;
  const R = G.regia;
  const C = await import('/src/world/cylinder.ts');
  const P = await import('/src/personaggi/index.ts');
  const corbella = R.regia.abitanti.corbella;
  G.stopLoop();
  G.pause();
  const v = (x, y, z) => new game.camera.position.constructor(x, y, z);
  window.__SC__ = {
    /** giorno e ora: orologio della regia, cielo del motore, orari del popolamento */
    ora(giorno, h) {
      R.regia.orologio.fermo = null;
      R.regia.orologio.limite = null;
      R.impostaOra(giorno, h);
      G.setTime(h);
      corbella.applicaOrario(giorno, h);
      G.step(2);
      return { giorno: R.regia.orologio.giorno, ore: R.regia.orologio.ore };
    },
    pos(id) {
      return corbella.npc(id)?.posizione() ?? null;
    },
    presente(id) {
      return !!corbella.npc(id)?.presente;
    },
    /**
     * camera davanti a `id`: a `d` m nella direzione in cui guarda il personaggio ruotata di `giro`
     * gradi, occhi a `h` m sopra i suoi piedi, lo sguardo a `mira` m sopra i piedi (`spostaMira` m di lato)
     */
    davanti(id, d = 3.4, giro = 0, h = 1.55, mira = 1.0, spostaMira = 0) {
      const n = corbella.npc(id);
      if (!n?.figura) throw new Error(`nessuna figura per ${id}`);
      const f = n.figura;
      f.updateMatrixWorld(true);
      const piedi = f.getWorldPosition(v(0, 0, 0));
      const q = f.getWorldQuaternion(new game.camera.quaternion.constructor());
      const su = v(0, 1, 0).applyQuaternion(q);
      const avanti = v(0, 0, 1).applyQuaternion(q);
      const lato = v(1, 0, 0).applyQuaternion(q);
      const a = (giro * Math.PI) / 180;
      const dir = avanti.clone().multiplyScalar(Math.cos(a)).addScaledVector(lato, Math.sin(a));
      const occhio = piedi.clone().addScaledVector(dir, d).addScaledVector(su, h);
      const bersaglio = piedi.clone().addScaledVector(su, mira).addScaledVector(lato, spostaMira);
      const c = C.worldToCyl(occhio);
      const b = C.worldToCyl(bersaglio);
      G.setCamera(c.z, c.theta, c.h, 0, 0);
      G.lookAt(b.z, b.theta, b.h);
      return { occhio: [c.z, c.theta, c.h], bersaglio: [b.z, b.theta, b.h] };
    },
    /** camera in (z, θ, h) che guarda (z, θ, h) */
    camera(da, a) {
      G.setCamera(da[0], da[1], da[2], 0, 0);
      G.lookAt(a[0], a[1], a[2]);
    },
    passi(n) {
      G.step(n);
    },
    /** livello di dettaglio dei personaggi visibili (0, 1 = LOD; 2 lontano; 3 sparito) e distanza */
    livelli() {
      const out = [];
      for (const [id, n] of corbella.personaggi) {
        if (!n.figura || !n.presente || id === 'velati_corbella' || id === 'bambini') continue;
        const g = n.figura.children[0];
        const d = n.figura.getWorldPosition(v(0, 0, 0)).distanceTo(game.camera.position);
        out.push(`${id}:${g?.userData?.personaggio ? `L${g.userData.livello ?? 0}` : 'proc'}@${d.toFixed(0)}m`);
      }
      return out;
    },
    /** per le misure di --prova */
    C,
    corbella,
  };
  return { modelli: [...P.personaggiDisponibili()].sort() };
}

async function scatta(nome, { fotogrammi = 3, pagina = false } = {}) {
  await page.evaluate((n) => {
    const G = window.__GAME__;
    G.ensureLoaded();
    G.step(n);
  }, fotogrammi);
  const file = join(out, `${nome}.png`);
  if (pagina) await page.screenshot({ path: file });
  else {
    const dataUrl = await page.evaluate(() => window.__GAME__.capture());
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  }
  const livelli = await page.evaluate(() => window.__SC__.livelli().join(' '));
  console.log('scritto', file, '\n   ', livelli);
}

const S = (fn, arg) => page.evaluate(fn, arg);

try {
  const t0 = Date.now();
  let info = null;
  for (let tentativo = 1; !info; tentativo++) {
    await page.goto(`http://127.0.0.1:${porta}/?nuova`);
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 600000 });
    console.log(`gioco pronto in ${Math.round((Date.now() - t0) / 1000)} s`);
    await S(() => window.__GAME__.regia.vai('piazza_ore'));
    try {
      info = await page.evaluate(`(${installa.toString()})()`);
    } catch (e) {
      if (tentativo >= 2) throw e;
      console.error(`nuovo tentativo dopo: ${String(e).split('\n')[0]}`);
    }
  }
  console.log('modelli nel gioco:', JSON.stringify(info));

  // --prova=<file.json>: inquadrature libere per le verifiche, [{ nome, ora: [g, h], vai, davanti: [id, d, giro, h, mira, lato], camera: [[z,θ,h],[z,θ,h]], passi }]
  if (args.prova) {
    const { readFileSync } = await import('node:fs');
    for (const p of JSON.parse(readFileSync(resolve(args.prova), 'utf8'))) {
      const r = await S((q) => {
        const X = window.__SC__;
        if (q.vai) window.__GAME__.regia.vai(q.vai);
        if (q.ora) X.ora(q.ora[0], q.ora[1]);
        X.passi(q.passi ?? 60);
        // `js`: codice libero per le misure (X = window.__SC__, G = window.__GAME__)
        if (q.js) return new Function('X', 'G', q.js)(X, window.__GAME__);
        if (q.davanti) return X.davanti(...q.davanti);
        if (q.camera) X.camera(q.camera[0], q.camera[1]);
        return null;
      }, p);
      console.log(p.nome, JSON.stringify(r));
      if (!p.js) await scatta(p.nome);
    }
    solo.length = 0;
  }


  /**
   * Le inquadrature: `ora` [giorno, ore] e `vai` (luogo dove sta Elvira, perché gli orari e gli sguardi
   * dipendono da lei), `prima` (codice nel browser), `davanti` [id, distanza, giro°, quota occhi,
   * quota mira, mira di lato] (vedi davanti() in installa).
   */
  const INQUADRATURE = [
    // un dialogo vero per primo: dopo, gli orari del giorno 2 farebbero partire il dono di Clelia
    { chiave: 'dialogo', nome: 'dialogo-togna', dialogo: 'togna', vai: 'lavatoio', ora: [1, 9.5] },
    { chiave: 'togna', nome: 'togna-lavatoio', vai: 'lavatoio', ora: [1, 9.5], passi: 120, davanti: ['togna', 3.0, 60, 1.75, 0.75] },
    // Ottavio: in volo col Velo verde (06:20 del primo giorno), poi a terra al prato del ronco (giorno 2, 15:00)
    { chiave: 'ottavio', nome: 'ottavio-in-volo', vai: 'piazza_ore', ora: [1, 6.33], prima: 'G.regia.regia.abitanti.ottavioInCielo()', passi: 120, davanti: ['ottavio', 3.4, 25, 1.9, 1.3] },
    { chiave: 'ottavio', nome: 'ottavio-a-terra', vai: 'prato_ronco', ora: [2, 15.0], prima: "G.regia.regia.abitanti.ottavioSegueOrario(); X.corbella.npc('ottavio').manuale = false", passi: 90, davanti: ['ottavio', 3.0, 25, 1.6, 1.1] },
    // San Vigilio, giorno 1 alle 10: Annunciata seduta sulla panca del portale, Bortolo sul sagrato
    { chiave: 'san-vigilio', nome: 'annunciata-san-vigilio', vai: 'san_vigilio', ora: [1, 10.0], passi: 200, davanti: ['annunciata', 1.6, -110, 0.95, 0.6] },
    { chiave: 'san-vigilio', nome: 'annunciata-di-fronte', davanti: ['annunciata', 2.2, 40, 1.3, 0.7] },
    { chiave: 'san-vigilio', nome: 'bortolo-sagrato', davanti: ['bortolo', 3.6, 25, 1.6, 1.1] },
    // i bambini in piazza delle Ore
    { chiave: 'bambini', nome: 'bambini-piazza', vai: 'piazza_ore', ora: [1, 10.5], passi: 90, davanti: ['lisa', 1.9, 20, 1.05, 0.7, -0.4] },
    // Nando: chino sul muro del ronco alle 9, davanti a casa alle 11
    { chiave: 'nando', nome: 'nando-ronchi-muro', vai: 'muro_ronco', ora: [1, 9.0], passi: 150, davanti: ['nando', 3.0, -130, 1.8, 0.8] },
    { chiave: 'nando', nome: 'nando-casa', vai: 'casa_nando', ora: [1, 11.0], passi: 90, davanti: ['nando', 3.2, 15, 1.6, 1.1] },
    // Clelia alla bacheca delle Ore (giorno 2)
    { chiave: 'clelia', nome: 'clelia-bacheca', vai: 'bacheca_ore', ora: [2, 10.0], passi: 90, davanti: ['clelia', 2.4, 0, 1.55, 1.2] },
    // Pina seduta sulla soglia con le forbici e il cartone
    { chiave: 'pina', nome: 'pina-soglia', vai: 'soglia_pina', ora: [1, 11.0], passi: 150, davanti: ['pina', 2.6, 25, 1.3, 0.6] },
    // la gente velata in piazza: prima dell'alba (notte), all'alba, da vicino
    { chiave: 'alba', nome: 'piazza-notte-prima-dell-alba', vai: 'piazza_ore', ora: [2, 5.6], passi: 90, davanti: ['velato_1', 9, 160, 1.7, 1.2, 3] },
    { chiave: 'alba', nome: 'piazza-alba', ora: [2, 5.92], passi: 60, davanti: ['velato_1', 9, 160, 1.7, 1.2, 3] },
    { chiave: 'alba', nome: 'piazza-alba-vicino', davanti: ['velato_5', 3.2, 20, 1.6, 1.1] },
    // la sera tarda dell'Ombrista (20:25, notte 0,6): la gente sui gradini, Togna, Bortolo e i bambini in piazza
    { chiave: 'notte', nome: 'piazza-sera-ombrista', vai: 'piazza_ore', ora: [1, 20.42], passi: 150, davanti: ['togna', 5, 30, 1.7, 1.0] },
    { chiave: 'notte', nome: 'gradini-ombrista', vai: 'telo_ombrista', ora: [1, 20.42], passi: 150, davanti: ['velato_7', 2.4, 10, 0.9, 0.3] },
  ];

  for (const q of INQUADRATURE) {
    if (!solo.includes(q.chiave)) continue;
    if (q.dialogo) {
      // Elvira davanti a chi parla, il tasto E, il testo completo; la camera è quella di Elvira
      const s = await S((q) => {
        const X = window.__SC__;
        const G = window.__GAME__;
        G.regia.vai(q.vai);
        X.ora(q.ora[0], q.ora[1]);
        X.passi(60);
        G.setFreeCamera(false);
        G.regia.avvicina(`png_${q.dialogo}`, 3.0);
        G.regia.premi('KeyE');
        G.regia.avanza(0.5);
        G.regia.regia.ui.dialogo.completa();
        G.regia.avanza(1.2);
        const p = G.regia.regia.abitanti.posizione(q.dialogo);
        // la mira sotto la persona: così sta nella metà alta, sopra la finestra del dialogo
        if (p) G.regia.mira([p.z, p.theta, p.h - 0.5]);
        return G.regia.stato().dialogo;
      }, q);
      console.log('dialogo:', JSON.stringify(s));
      await page.waitForTimeout(400);
      await scatta(q.nome, { fotogrammi: 1, pagina: true });
      // chiude il dialogo (Esc) per le inquadrature dopo
      await page.keyboard.press('Escape');
      await S(() => window.__GAME__.regia.avanza(0.3));
      continue;
    }
    await S((q) => {
      const X = window.__SC__;
      const G = window.__GAME__;
      if (q.vai) G.regia.vai(q.vai);
      if (q.ora) X.ora(q.ora[0], q.ora[1]);
      if (q.prima) new Function('X', 'G', q.prima)(X, G);
      if (q.ora) X.ora(q.ora[0], q.ora[1]);
      X.passi(q.passi ?? 30);
      return X.davanti(...q.davanti);
    }, q);
    await scatta(q.nome);
  }

  if (solo.includes('lod')) {
    // il passaggio LOD0 → LOD1 a 25 m (isteresi 2 m): lo stesso velato a 23,5 e a 27 m, ritagliato e
    // ingrandito tre volte, fianco a fianco
    const ritagli = [];
    for (const d of [23.5, 27]) {
      await S((d) => {
        const X = window.__SC__;
        window.__GAME__.regia.vai('piazza_ore');
        X.ora(2, 5.92);
        X.passi(30);
        X.davanti('velato_1', d, 160, 5, 0.9);
        X.passi(3);
      }, d);
      await scatta(`lod-velato-${String(d).replace('.', ',')}m`);
      ritagli.push(
        await S(async () => {
          const src = window.__GAME__.capture();
          const img = new Image();
          img.src = src;
          await img.decode();
          const c = document.createElement('canvas');
          const w = 120;
          const h = 120;
          c.width = w * 3;
          c.height = h * 3;
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = false;
          g.drawImage(img, img.width / 2 - w / 2, img.height / 2 - h / 2 - 8, w, h, 0, 0, w * 3, h * 3);
          return c.toDataURL('image/png');
        }),
      );
    }
    const unito = await S(async (ritagli) => {
      const imgs = await Promise.all(
        ritagli.map(async (s) => {
          const i = new Image();
          i.src = s;
          await i.decode();
          return i;
        }),
      );
      const c = document.createElement('canvas');
      c.width = imgs[0].width * 2 + 8;
      c.height = imgs[0].height;
      const g = c.getContext('2d');
      g.fillStyle = '#222';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(imgs[0], 0, 0);
      g.drawImage(imgs[1], imgs[0].width + 8, 0);
      g.fillStyle = '#f0e6c8';
      g.font = '16px sans-serif';
      g.fillText('23,5 m: LOD0 (8000 triangoli)', 8, 20);
      g.fillText('27 m: LOD1 (2000 triangoli)', imgs[0].width + 16, 20);
      return c.toDataURL('image/png');
    }, ritagli);
    const file = join(out, 'lod-confronto.png');
    writeFileSync(file, Buffer.from(unito.split(',')[1], 'base64'));
    console.log('scritto', file);
  }
} finally {
  await browser.close();
  await server.close();
}
