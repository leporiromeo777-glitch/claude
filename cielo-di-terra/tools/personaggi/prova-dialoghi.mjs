#!/usr/bin/env node
/**
 * Prova dei dialoghi come li gioca chi gioca (traccia «parlare», seconda tornata: docs/migliorie/parlare.md).
 * Elvira si avvicina camminando a chi parla (da un angolo scelto, anche da dietro), apre il dialogo col tasto
 * E (o dalla coda, per quelli automatici), legge le battute e va avanti con Invio o 1, poi resta lì per un
 * po' e infine se ne va. A passi fissi di 1/60 s salva:
 *  - fotogrammi dagli occhi di Elvira (a_NNN.jpg) e di lato, con una camera fissa a campo stretto (b_NNN.jpg);
 *  - misure a 60 Hz della figura (misure.json): giro del corpo, velocità di ogni osso nello spazio della
 *    figura, piedi (quota e velocità), bacino, visibilità; gli eventi (battute, chiusura, «se ne va").
 * Vite in modo e2e, Chromium SwiftShader (lento: una scena 10-20 minuti).
 *
 *   node tools/personaggi/prova-dialoghi.mjs --root=<cielo-di-terra> --out=<cartella> [--solo=a,b]
 *        [--qualita=bassa] [--size=640x360] [--fps=5]
 * I fogli prima | dopo e i grafici: tools/personaggi/prova_fogli.py.
 */
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    return [k, v.join('=') || '1'];
  }),
);
const radice = resolve(args.root);
const out = resolve(args.out);
mkdirSync(out, { recursive: true });
const [W, H] = (args.size ?? '640x360').split('x').map(Number);
const FPS = Number(args.fps ?? 5);
const FPS_CAMMINA = Number(args.fpscammina ?? 2);
const QUALITA = args.qualita ?? 'bassa';
const porta = Number(args.porta ?? 5400 + Math.floor(Math.random() * 300));
const nm = realpathSync(join(radice, 'node_modules'));
const { chromium } = await import(join(nm, '@playwright/test/index.mjs'));
const { createServer } = await import(join(nm, 'vite/dist/node/index.js'));

/**
 * Scene: ora [giorno, ore], vai luogo, chi figura, giro (gradi fra avanti della figura e dove arriva Elvira),
 * d distanza finale, dialogo (se null: parla col tasto E), auto (dialogo automatico dalla coda), prima (codice),
 * dopo: secondi da guardare dopo la chiusura (Elvira ferma), poi via: Elvira si allontana e si guarda ancora.
 */
const SCENE = [
  { nome: 'bortolo-dietro', chi: 'bortolo', ora: [1, 10.0], vai: 'sagrato', giro: 165, d: 1.8, dopo: 16, via: 6 },
  { nome: 'bortolo-lato', chi: 'bortolo', ora: [1, 10.0], vai: 'sagrato', giro: 70, d: 2.2, dopo: 4, via: 0 },
  { nome: 'nando-poco', chi: 'nando', ora: [1, 11.0], vai: 'casa_nando', giro: 32, d: 2.0, dopo: 4, via: 0 },
  { nome: 'togna', chi: 'togna', ora: [1, 9.5], vai: 'lavatoio', giro: 50, d: 1.9, dopo: 4, via: 0 },
  { nome: 'togna2', chi: 'togna', ora: [1, 9.5], vai: 'lavatoio', giro: 20, d: 1.8, avvicina: true, dopo: 3, via: 0 },
  { nome: 'annunciata', chi: 'annunciata', ora: [1, 10.0], vai: 'san_vigilio', giro: 60, d: 1.9, dopo: 4, via: 0 },
  { nome: 'annunciata2', chi: 'annunciata', ora: [1, 10.0], vai: 'san_vigilio', giro: 40, d: 1.8, avvicina: true, dopo: 3, via: 0 },
  { nome: 'pina', chi: 'pina', ora: [1, 11.0], vai: 'soglia_pina', giro: 40, d: 1.9, dopo: 3, via: 0 },
  { nome: 'bambini', chi: 'lisa', altri: ['gioanin'], ora: [1, 10.5], vai: 'piazza_ore', giro: 60, d: 2.2, dopo: 4, via: 0 },
  { nome: 'bambini-dietro', chi: 'lisa', altri: ['gioanin'], ora: [1, 10.5], vai: 'piazza_ore', giro: 165, d: 2.2, dopo: 4, via: 0 },
  {
    nome: 'ottavio-prato',
    chi: 'ottavio',
    ora: [2, 15.0],
    vai: 'prato_ronco',
    giro: 110,
    d: 2.2,
    dialogo: 'd_ottavio_incontro',
    prima: "G.regia.regia.abitanti.ottavioSegueOrario(); X.corbella.npc('ottavio').manuale = false",
    dopo: 11,
    via: 5,
  },
  { nome: 'clelia', chi: 'clelia', ora: [2, 10.0], vai: 'bacheca_ore', giro: 40, d: 4.5, dialogo: 'd_clelia_dono', auto: true, dopo: 4, via: 0 },
];

const server = await createServer({
  root: radice,
  mode: 'e2e',
  logLevel: 'error',
  server: { port: porta, host: '127.0.0.1', hmr: false, fs: { allow: [radice, nm] } },
  optimizeDeps: { include: ['three', 'three/addons/loaders/GLTFLoader.js', 'three/addons/utils/SkeletonUtils.js'] },
});
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.setDefaultTimeout(1800000);
const errori = [];
page.on('pageerror', (e) => {
  errori.push(e.message);
  console.error('errore pagina:', e.message);
});
page.on('console', (m) => {
  if (m.type() === 'error') {
    errori.push(m.text());
    console.error('console:', m.text());
  }
});
const S = (fn, arg) => page.evaluate(fn, arg);

async function installa() {
  const G = window.__GAME__;
  const game = G.game;
  const r = G.regia.regia;
  const C = await import('/src/world/cylinder.ts');
  const corbella = r.abitanti.corbella;
  G.stopLoop();
  const V3 = game.camera.position.constructor;
  const Q = game.camera.quaternion.constructor;
  const M4 = game.camera.matrixWorld.constructor;
  const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
  const OSSA = ['bacino', 'schiena', 'petto', 'collo', 'testa', 'braccioS', 'avambraccioS', 'manoS', 'braccioD', 'avambraccioD', 'manoD', 'cosciaS', 'stincoS', 'piedeS', 'cosciaD', 'stincoD', 'piedeD'];
  const DEG = 180 / Math.PI;
  const cache = new Map();
  const ossaDi = (f) => {
    let m = cache.get(f);
    if (!m) {
      m = new Map();
      f.traverse((o) => {
        if (o.isBone && OSSA.includes(o.name) && !m.has(o.name)) m.set(o.name, o);
      });
      cache.set(f, m);
    }
    return m;
  };
  const prec = new Map();
  const _q = new Q();
  const X = {
    C,
    corbella,
    ora(giorno, h) {
      r.orologio.fermo = null;
      r.orologio.limite = null;
      G.regia.impostaOra(giorno, h);
      G.setTime(h);
      corbella.applicaOrario(giorno, h);
      game.loop.stepUpdates(2);
    },
    figura: (id) => corbella.npc(id)?.figura ?? null,
    terna(id) {
      const f = X.figura(id);
      f.updateMatrixWorld(true);
      const piedi = f.getWorldPosition(v());
      const q = f.getWorldQuaternion(new Q());
      return { piedi, su: v(0, 1, 0).applyQuaternion(q), avanti: v(0, 0, 1).applyQuaternion(q), lato: v(1, 0, 0).applyQuaternion(q) };
    },
    /** punto a distanza d nella direzione giro dall'avanti della figura (in coordinate del cilindro) */
    puntoA(id, d, giro) {
      const t = X.terna(id);
      const a = (giro * Math.PI) / 180;
      const dir = t.avanti.clone().projectOnPlane(t.su).normalize().multiplyScalar(Math.cos(a)).addScaledVector(t.lato.clone().projectOnPlane(t.su).normalize(), Math.sin(a));
      return C.worldToCyl(t.piedi.clone().addScaledVector(dir, d));
    },
    testa(id) {
      const t = X.terna(id);
      return t.piedi.clone().addScaledVector(t.su, 1.3);
    },
    /** Elvira in (z, θ) a terra, guarda la testa di id */
    metti(z, th, id) {
      game.player.teleport(z, th, 0, true);
      game.syncEyeNow();
      r.guarda(X.testa(id));
    },
    distanza(id) {
      const pc = game.player.cyl;
      const e = C.cylToWorld(pc.z, pc.theta, pc.h);
      return e.distanceTo(X.terna(id).piedi);
    },
    passo(ids) {
      game.loop.stepUpdates(1);
      const riga = {};
      for (const id of ids) {
        const f = X.figura(id);
        if (!f) continue;
        f.updateMatrixWorld(true);
        const qf = f.getWorldQuaternion(new Q());
        const su = v(0, 1, 0).applyQuaternion(qf);
        const av = v(0, 0, 1).applyQuaternion(qf);
        const p = prec.get(id) ?? { q: new Map(), w: new Map(), yaw: 0, av: null, piedi: new Map(), radice: null };
        let dy = 0;
        if (p.av) {
          const a = p.av.clone().projectOnPlane(su).normalize();
          const b = av.clone().projectOnPlane(su).normalize();
          dy = Math.atan2(a.clone().cross(b).dot(su), a.dot(b)) * DEG;
        }
        p.yaw += dy;
        p.av = av;
        const radice = f.getWorldPosition(v());
        const dRad = p.radice ? radice.distanceTo(p.radice) * 60 : 0;
        p.radice = radice;
        const ossa = ossaDi(f);
        const vel = {};
        for (const [nome, o] of ossa) {
          _q.identity();
          for (let x = o; x && x !== f; x = x.parent) _q.premultiply(x.quaternion);
          _q.normalize();
          const q0 = p.q.get(nome);
          if (q0) {
            vel[nome] = Math.round(2 * Math.acos(Math.min(1, Math.abs(q0.dot(_q)))) * DEG * 60);
            q0.copy(_q);
          } else p.q.set(nome, _q.clone());
        }
        // piedi nel mondo: quota sopra la radice e velocità orizzontale
        const piedi = {};
        for (const L of ['S', 'D']) {
          const o = ossa.get(`piede${L}`);
          if (!o) continue;
          const w = o.getWorldPosition(v());
          const alt = w.clone().sub(radice).dot(su);
          const pr = p.piedi.get(L);
          let vel = 0;
          if (pr) vel = w.clone().sub(pr).projectOnPlane(su).length() * 60;
          p.piedi.set(L, w);
          piedi[L] = [Math.round(alt * 1000) / 1000, Math.round(vel * 1000) / 1000];
        }
        const bac = ossa.get('bacino');
        const by = bac ? bac.getWorldPosition(v()).sub(radice).dot(su) : null;
        riga[id] = { yaw: Math.round(p.yaw * 10) / 10, dy: Math.round(dy * 60 * 10) / 10, dRad: Math.round(dRad * 100) / 100, vel, piedi, bac: by === null ? null : Math.round(by * 1000) / 1000, vis: f.visible && (f.parent ? true : false) };
        prec.set(id, p);
      }
      const n = r.dialoghi.nodo;
      riga.nodo = n ? `${n.dialogo}:${n.nodo}:${n.chi}` : null;
      return riga;
    },
    scatta(larg) {
      game.loop.stepFrames(0);
      const src = game.renderer.domElement;
      const c = document.createElement('canvas');
      c.width = larg;
      c.height = Math.round((larg * src.height) / src.width);
      c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.85);
    },
    lato: null,
    azzera() {
      prec.clear();
    },
    fissaLato(id, gradi, dist) {
      const t = X.terna(id);
      const pc = game.player.cyl;
      const elv = C.cylToWorld(pc.z, pc.theta, pc.h);
      const dir = elv.clone().sub(t.piedi).projectOnPlane(t.su).normalize();
      const perp = t.su.clone().cross(dir).normalize();
      const a = (gradi * Math.PI) / 180;
      const d2 = dir.clone().multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
      X.lato = { occhio: t.piedi.clone().addScaledVector(d2, dist).addScaledVector(t.su, 1.5), mira: t.piedi.clone().addScaledVector(t.su, 0.9), su: t.su.clone() };
    },
    scattaLato(larg) {
      const L = X.lato;
      const salva = { cur: game.currEye.clone(), prev: game.prevEye.clone(), q: game.rig.quaternion.clone(), free: game.freeCamera };
      game.currEye.copy(L.occhio);
      game.prevEye.copy(L.occhio);
      const m = new M4().lookAt(L.occhio, L.mira, L.su);
      game.rig.quaternion.setFromRotationMatrix(m);
      game.freeCamera = true;
      const cam = game.camera;
      const fov0 = cam.fov;
      cam.fov = fov0 * 0.6;
      cam.updateProjectionMatrix();
      try {
        return X.scatta(larg);
      } finally {
        cam.fov = fov0;
        cam.updateProjectionMatrix();
        game.freeCamera = salva.free;
        game.currEye.copy(salva.cur);
        game.prevEye.copy(salva.prev);
        game.rig.quaternion.copy(salva.q);
        game.syncEyeNow();
      }
    },
  };
  window.__PV__ = X;
  return true;
}

async function scena(q) {
  const dir = join(out, q.nome);
  mkdirSync(dir, { recursive: true });
  const prep = await S((q) => {
    const X = window.__PV__;
    const G = window.__GAME__;
    const r = G.regia.regia;
    r.dialoghi.svuota();
    G.regia.vai(q.vai);
    X.ora(q.ora[0], q.ora[1]);
    if (q.prima) new Function('X', 'G', q.prima)(X, G);
    X.ora(q.ora[0], q.ora[1]);
    G.regia.avanza(2);
    if (!X.figura(q.chi) || !X.corbella.npc(q.chi)?.presente) return { errore: `${q.chi} non c'è` };
    // il gioco gira da un po' (t interno grande)
    G.regia.avanza(1);
    let lontano = X.puntoA(q.chi, Math.max(q.d + 6, 8), q.giro);
    let vicino = X.puntoA(q.chi, q.d, q.giro);
    if (q.avvicina) {
      // come la prova e2e: la regia trova un punto libero a q.d m dal bersaglio, dalla parte di `lontano`
      X.metti(lontano.z, lontano.theta, q.chi);
      G.regia.avvicina(`png_${q.chi}`, q.d);
      const pc = G.game.player.cyl;
      vicino = { z: pc.z, theta: pc.theta };
      const f = X.terna(q.chi);
      const e = X.C.cylToWorld(pc.z, pc.theta, pc.h);
      const dir = e.clone().sub(f.piedi).projectOnPlane(f.su).normalize();
      lontano = X.C.worldToCyl(f.piedi.clone().addScaledVector(dir, Math.max(q.d + 6, 8)));
    }
    X.metti(lontano.z, lontano.theta, q.chi);
    G.regia.avanza(1.5);
    G.ensureLoaded();
    X.azzera();
    return { lontano, vicino, luogo: X.corbella.npc(q.chi).luogo, posa: X.corbella.npc(q.chi).posaAttuale ?? null };
  }, q);
  console.log(q.nome, JSON.stringify(prep));
  if (prep.errore) return;
  const ids = [q.chi, ...(q.altri ?? [])];
  const misure = [];
  const eventi = [];
  let foto = 0;
  const fotoT = [];
  let t = 0;
  const passiFoto = Math.round(60 / FPS);
  let lato = false;
  let passiOra = passiFoto;
  const passo = async (azione) => {
    const scatta = Math.round(t * 60) % passiOra === 0;
    const r = await S(
      ([ids, azione, scatta, lato]) => {
        const X = window.__PV__;
        const G = window.__GAME__;
        const ev = [];
        if (azione?.tipo === 'cammina') {
          const { da, a, u, chi } = azione;
          X.metti(da.z + (a.z - da.z) * u, da.theta + (a.theta - da.theta) * u, chi);
        }
        if (azione?.tipo === 'guarda') G.regia.regia.guarda(X.testa(azione.chi));
        const riga = X.passo(ids);
        let a = null;
        let b = null;
        if (scatta) {
          a = X.scatta(560);
          if (lato) b = X.scattaLato(360);
        }
        return { riga, ev, a, b };
      },
      [ids, azione, scatta, lato],
    );
    r.riga.t = Math.round(t * 1000) / 1000;
    misure.push(r.riga);
    if (scatta) {
      fotoT.push({ n: foto, t: Math.round(t * 100) / 100, lato: !!r.b, nodo: r.riga.nodo });
      const n = String(foto++).padStart(3, '0');
      writeFileSync(join(dir, `a_${n}.jpg`), Buffer.from(r.a.split(',')[1], 'base64'));
      if (r.b) writeFileSync(join(dir, `b_${n}.jpg`), Buffer.from(r.b.split(',')[1], 'base64'));
      if (foto % 20 === 0) console.log(`  ${q.nome} t=${t.toFixed(2)}`);
    }
    t += 1 / 60;
  };
  const ev = (x) => {
    eventi.push({ t: Math.round(t * 100) / 100, ev: x });
    console.log(`  t=${t.toFixed(2)} ${x}`);
  };
  // 1. si avvicina camminando (1,1 m/s)
  const dist = Math.hypot(prep.lontano.z - prep.vicino.z, (prep.lontano.theta - prep.vicino.theta) * 646 * Math.PI / 180);
  const T = Math.max(1, dist / 1.1);
  const nT = Math.round(T * 60);
  ev(`cammina ${dist.toFixed(1)} m`);
  passiOra = Math.round(60 / FPS_CAMMINA);
  for (let i = 1; i <= nT; i++) await passo({ tipo: 'cammina', da: prep.lontano, a: prep.vicino, u: i / nT, chi: q.chi });
  for (let i = 0; i < 30; i++) await passo({ tipo: 'guarda', chi: q.chi });
  passiOra = passiFoto;
  const d = await S((id) => window.__PV__.distanza(id), q.chi);
  ev(`arrivata a ${d.toFixed(2)} m`);
  // camera di lato fissata ora
  await S(([id]) => window.__PV__.fissaLato(id, 75, 3.6), [q.chi]);
  lato = true;
  // 2. apre il dialogo: tasto E (o la coda per l'automatico)
  if (q.auto) {
    await S((dlg) => window.__GAME__.regia.regia.dialoghi.richiedi(dlg, true, true), q.dialogo);
    ev('richiesto automatico');
  } else {
    const st = await S(() => window.__GAME__.regia.stato());
    if (q.dialogo) {
      const ok = await S((dlg) => window.__GAME__.regia.regia.dialoghi.mostra(window.__GAME__.regia.regia.narrativa.dialoghi.avvia(dlg)), q.dialogo);
      ev(`apri ${q.dialogo}: ${ok}`);
    } else if (st.bersaglio === `png_${q.chi}`) {
      await page.keyboard.down('KeyE');
      await passo();
      await page.keyboard.up('KeyE');
      ev('tasto E');
    } else {
      const ok = await S((id) => window.__GAME__.regia.regia.dialoghi.parla(id), q.chi === 'lisa' ? 'bambini' : q.chi);
      ev(`parla (bersaglio era ${st.bersaglio}): ${ok}`);
    }
  }
  // 3. legge e va avanti
  let aperto = false;
  for (let k = 0; k < 400; k++) {
    await passo();
    const s = await S(() => {
      const st = window.__GAME__.regia.stato();
      return { d: st.dialogo, lettura: st.lettura };
    });
    if (s.d) {
      aperto = true;
      break;
    }
  }
  let battute = 0;
  while (aperto && battute < 20) {
    const s = await S(() => window.__GAME__.regia.stato());
    if (!s.dialogo) break;
    const testo = s.dialogo.testo.replace(/<[^>]*>/g, '');
    const lettura = Math.min(5.5, 1.4 + testo.length / 30);
    ev(`battuta ${s.dialogo.chi}: «${testo.slice(0, 50)}» (${lettura.toFixed(1)} s)`);
    for (let i = 0; i < Math.round(lettura * 60); i++) await passo();
    battute++;
    const prima = `${s.dialogo.nodo}`;
    await S(() => window.__GAME__.regia.regia.ui.dialogo.completa?.());
    if (s.dialogo.risposte.length) await page.keyboard.press('1');
    else await page.keyboard.press('Enter');
    await passo();
    const s2 = await S(() => window.__GAME__.regia.stato());
    if (s2.dialogo && s2.dialogo.nodo === prima) {
      await page.keyboard.press('Enter');
      await passo();
    }
    const s3 = await S(() => window.__GAME__.regia.stato());
    if (s3.lettura) {
      ev(`carta aperta ${s3.lettura}`);
      for (let i = 0; i < 60; i++) await passo();
      await page.keyboard.press('Escape');
      await passo();
    }
  }
  ev(`dialogo chiuso dopo ${battute} battute`);
  for (let i = 0; i < Math.round(q.dopo * 60); i++) await passo();
  if (q.via) {
    const via = await S(([id, giro]) => window.__PV__.puntoA(id, 7, giro + 40), [q.chi, q.giro]);
    const da = await S(() => {
      const p = window.__GAME__.game.player.cyl;
      return { z: p.z, theta: p.theta };
    });
    ev('se ne va');
    const n = Math.round(5 * 60);
    for (let i = 1; i <= n; i++) await passo({ tipo: 'cammina', da, a: via, u: Math.min(1, i / (n * 0.7)), chi: q.chi });
    for (let i = 0; i < Math.round(q.via * 60); i++) await passo();
  }
  const stats = await S(() => window.__GAME__.getStats());
  writeFileSync(join(dir, 'misure.json'), JSON.stringify({ scena: q, prep, fps: FPS, eventi, fotoT, misure, stats }));
  console.log(`  ${q.nome}: ${foto} foto, ${misure.length} passi`);
}

async function carica() {
  await page.goto(`http://127.0.0.1:${porta}/?nuova`);
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 1800000 });
  await S(() => window.__GAME__.regia.vai('piazza_ore'));
  await S((qq) => window.__GAME__.setSetting('qualita', qq), QUALITA);
  await page.evaluate(`(${installa.toString()})()`);
}

try {
  await carica();
  const solo = args.solo ? args.solo.split(',') : null;
  let fatte = 0;
  for (const q of SCENE) {
    if (solo && !solo.includes(q.nome)) continue;
    if (fatte++ > 0 && q.nuova) await carica();
    const t1 = Date.now();
    await scena(q);
    console.log(`  (${Math.round((Date.now() - t1) / 1000)} s)`);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  writeFileSync(join(out, 'errori.json'), JSON.stringify(errori));
  await browser.close();
  await server.close();
}
