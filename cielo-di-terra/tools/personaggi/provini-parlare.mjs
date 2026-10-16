#!/usr/bin/env node
/**
 * Provini dei personaggi CHE PARLANO, nel gioco vero (traccia «parlare», docs/migliorie/parlare.md).
 *
 * Avvia Vite in sviluppo (modalità e2e: window.__GAME__ e window.__GAME__.regia), apre Chromium headless con
 * WebGL2 via SwiftShader (come scripts/shots.mjs), comincia una partita nuova e, per ogni scena, mette
 * l'ora e il luogo, porta Elvira accanto a chi deve parlare (di lato rispetto a dove guarda, come arriva chi
 * gioca), apre il dialogo VERO con il direttore dei dialoghi della regia (lo stesso percorso del tasto E, o
 * della coda per i dialoghi automatici), fa scorrere le battute come chi legge e alla fine lo chiude.
 *
 * Per tutta la scena si avanza a passi fissi di 1/60 s (come il gioco) e a ogni passo si misura la figura:
 * rotazione del corpo, velocità angolare di ogni osso nello spazio del modello, mani dentro il busto,
 * quota del bacino. A 10 fotogrammi al secondo si disegna due volte: dagli occhi di Elvira e di lato
 * (camera di tre quarti, campo stretto). Le immagini sono ritagli del canvas attorno alla figura.
 *
 *   node tools/personaggi/provini-parlare.mjs --out=<cartella> [--solo=ottavio,togna,...] [--procedurale]
 *       [--size=1280x720] [--fps=10]
 *
 * Nella cartella: <scena>/a_###.jpg (occhi di Elvira), <scena>/b_###.jpg (di lato), <scena>/misure.json.
 * I fogli dei provini e i grafici li fa tools/personaggi/provini_fogli.py.
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
const out = resolve(args.out ?? join(tmpdir(), 'provini-parlare'));
mkdirSync(out, { recursive: true });
const [W, H] = (args.size ?? '640x360').split('x').map(Number);
const FPS = Number(args.fps ?? 8);
const QUALITA = args.qualita ?? 'media';
const porta = 5300 + Math.floor(Math.random() * 60);

/**
 * Le scene. `ora` [giorno, ore], `vai` luogo dove mettere Elvira prima (gli orari dipendono da dove sta),
 * `chi` la figura da guardare (id del popolamento), `dialogo` l'id del dialogo vero, `automatico` se si
 * apre dalla coda della regia (con lo sguardo di Elvira che si volta), `d` distanza di Elvira, `giro`
 * gradi fra la direzione in cui guarda la figura e quella da cui arriva Elvira, `prima` codice (X, G),
 * `lato` [gradi dalla linea figura→Elvira, distanza] della camera di lato, `battute` istanti (s) in cui si
 * va avanti, `chiudi` quando si chiude, `fine` quando si smette, `altri` figure misurate in più.
 */
const SCENE = [
  { nome: 'ottavio-in-piedi', chi: 'ottavio', dialogo: 'd_ottavio_incontro', ora: [2, 15.0], vai: 'prato_ronco', prima: "G.regia.regia.abitanti.ottavioSegueOrario(); X.corbella.npc('ottavio').manuale = false", d: 2.4, giro: 70 },
  // (la passerella rimessa, come al giorno 3 nel gioco: senza, Ottavio sedeva nell'acqua del riale)
  { nome: 'ottavio-seduto', chi: 'ottavio', dialogo: 'd_ottavio_prova', ora: [3, 6.2], vai: 'passerella_messo', prima: "G.regia.regia.catasto.impostaVariante('E1', 'Abitata'); G.regia.regia.abitanti.ottavioSegueOrario(); X.corbella.npc('ottavio').manuale = false", d: 2.2, giro: 60 },
  { nome: 'togna-china', chi: 'togna', dialogo: 'd_togna', ora: [1, 9.5], vai: 'lavatoio', d: 2.0, giro: 50 },
  { nome: 'bortolo', chi: 'bortolo', dialogo: 'd_bortolo_1', ora: [1, 10.0], vai: 'sagrato', d: 2.4, giro: 75 },
  { nome: 'annunciata-seduta', chi: 'annunciata', dialogo: 'd_annunciata', ora: [1, 10.0], vai: 'san_vigilio', d: 2.0, giro: 55 },
  { nome: 'pina-seduta', chi: 'pina', dialogo: 'd_pina_soglia', ora: [1, 11.0], vai: 'soglia_pina', d: 2.0, giro: 45 },
  { nome: 'nando-pietra', chi: 'nando', dialogo: 'd_nando_1', ora: [1, 11.0], vai: 'casa_nando', d: 2.4, giro: 80 },
  { nome: 'clelia', chi: 'clelia', dialogo: 'd_clelia_dono', automatico: true, ora: [2, 10.0], vai: 'bacheca_ore', d: 2.6, giro: 65 },
  { nome: 'bambini', chi: 'lisa', altri: ['gioanin'], dialogo: 'd_bambini', ora: [1, 10.5], vai: 'piazza_ore', d: 2.2, giro: 60 },
  // la gente velata all'alba in piazza: non parla, ma si volta verso Elvira che passa e parla con Bortolo
  { nome: 'velati', chi: 'velato_5', altri: ['velato_4', 'velato_6'], dialogo: null, ora: [2, 5.92], vai: 'piazza_ore', d: 2.6, giro: 100, prima: 'G.regia.regia.abitanti.voltatiTutti(30)' },
  // lontano: la novizia apre il dialogo automatico da 16 m (il limite è 25)
  { nome: 'clelia-lontana', chi: 'clelia', dialogo: 'd_clelia_dono', automatico: true, ora: [2, 10.0], vai: 'bacheca_ore', d: 16, giro: 120, lato: [50, 6] },
];

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
page.setDefaultTimeout(900000);
page.on('pageerror', (e) => console.error('errore pagina:', e.message));
if (args.procedurale) await page.route((u) => u.pathname.startsWith('/personaggi/'), (r) => r.abort());
page.on('console', (m) => {
  if (m.type() === 'error') console.error(`console ${m.type()}:`, m.text());
});

/** Gira nel browser: gli attrezzi della scena (window.__PV__). */
async function installa() {
  const G = window.__GAME__;
  const game = G.game;
  const R = G.regia;
  const r = R.regia;
  const C = await import('/src/world/cylinder.ts');
  const corbella = r.abitanti.corbella;
  G.stopLoop();
  G.pause();
  const V3 = game.camera.position.constructor;
  const Q = game.camera.quaternion.constructor;
  const M4 = game.camera.matrixWorld.constructor;
  const v = (x = 0, y = 0, z = 0) => new V3(x, y, z);
  const OSSA = ['bacino', 'schiena', 'petto', 'collo', 'testa', 'braccioS', 'avambraccioS', 'manoS', 'braccioD', 'avambraccioD', 'manoD', 'cosciaS', 'stincoS', 'cosciaD', 'stincoD'];
  const DEG = 180 / Math.PI;

  /** le ossa di una figura (la prima con quel nome), cercate una volta */
  const cacheOssa = new Map();
  const ossaDi = (fig) => {
    let m = cacheOssa.get(fig);
    if (!m) {
      m = new Map();
      fig.traverse((o) => {
        if (o.isBone && OSSA.includes(o.name) && !m.has(o.name)) m.set(o.name, o);
      });
      cacheOssa.set(fig, m);
    }
    return m;
  };
  const animatoreDi = (fig) => {
    let a = null;
    fig.traverse((o) => {
      a ??= o.userData?.animatore ?? null;
    });
    return a;
  };

  // stato delle misure per figura
  const prec = new Map();
  const _qr = new Q();
  const _qb = new Q();
  const _m = new M4();
  const _p = v();

  const X = {
    C,
    corbella,
    ora(giorno, h) {
      r.orologio.fermo = null;
      r.orologio.limite = null;
      R.impostaOra(giorno, h);
      G.setTime(h);
      corbella.applicaOrario(giorno, h);
      game.loop.stepUpdates(2);
      return { giorno: r.orologio.giorno, ore: r.orologio.ore };
    },
    figura(id) {
      return corbella.npc(id)?.figura ?? null;
    },
    /** la terna della figura nel mondo: piedi, su, avanti, lato (sinistra) */
    terna(id) {
      const f = X.figura(id);
      f.updateMatrixWorld(true);
      const piedi = f.getWorldPosition(v());
      const q = f.getWorldQuaternion(new Q());
      return { piedi, su: v(0, 1, 0).applyQuaternion(q), avanti: v(0, 0, 1).applyQuaternion(q), lato: v(1, 0, 0).applyQuaternion(q) };
    },
    /** Elvira a `d` m dalla figura, nella direzione in cui guarda ruotata di `giro` gradi, e lo sguardo su di lei */
    piazzaElvira(id, d, giro) {
      const t = X.terna(id);
      const a = (giro * Math.PI) / 180;
      const dir = t.avanti.clone().multiplyScalar(Math.cos(a)).addScaledVector(t.lato, Math.sin(a));
      const punto = t.piedi.clone().addScaledVector(dir, d);
      const c = C.worldToCyl(punto);
      r.vai(c.z, c.theta);
      game.loop.stepUpdates(2);
      const testa = t.piedi.clone().addScaledVector(t.su, 1.25);
      r.guarda(testa);
      const pc = game.player.cyl;
      const dove = C.cylToWorld(pc.z, pc.theta, pc.h);
      return { voluta: d, vera: Math.round(dove.distanceTo(t.piedi) * 100) / 100 };
    },
    /** apre il dialogo: dal tasto E (parla → mostra) o dalla coda (automatico, la regia volta lo sguardo) */
    apri(dialogo, automatico) {
      if (automatico) {
        r.dialoghi.richiedi(dialogo, true, true);
        return true;
      }
      return r.dialoghi.mostra(r.narrativa.dialoghi.avvia(dialogo));
    },
    avanti() {
      if (r.dialoghi.aperto) r.dialoghi.scegli(0);
      return r.dialoghi.nodo?.nodo ?? null;
    },
    chiudi() {
      r.dialoghi.chiudi();
    },
    nodo() {
      const n = r.dialoghi.nodo;
      return n ? `${n.dialogo}:${n.nodo}:${n.chi}` : null;
    },
    /** azzera le misure (inizio scena) */
    azzera() {
      prec.clear();
    },
    /** un passo fisso e le misure delle figure `ids` */
    passo(ids) {
      game.loop.stepUpdates(1);
      const riga = {};
      for (const id of ids) {
        const f = X.figura(id);
        if (!f) continue;
        f.updateMatrixWorld(true);
        const qRad = f.getWorldQuaternion(new Q());
        const inv = qRad.clone().invert();
        const ossa = ossaDi(f);
        const p = prec.get(id) ?? { q: new Map(), w: new Map(), avanti0: null, yaw: 0, avPrec: null };
        // yaw della radice rispetto all'inizio, attorno al su locale
        const su = v(0, 1, 0).applyQuaternion(qRad);
        const av = v(0, 0, 1).applyQuaternion(qRad);
        if (!p.avanti0) p.avanti0 = av.clone();
        let dyaw = 0;
        if (p.avPrec) {
          const a = p.avPrec.clone().projectOnPlane(su).normalize();
          const b = av.clone().projectOnPlane(su).normalize();
          dyaw = Math.atan2(a.clone().cross(b).dot(su), a.dot(b)) * DEG;
        }
        p.yaw += dyaw;
        p.avPrec = av.clone();
        const vel = {};
        const acc = {};
        // la rotazione di un osso nello spazio della figura: il prodotto dei quaternioni locali lungo la catena
        // (dalla matrice del mondo, nei generici scalati in modo diverso in larghezza e altezza, il quaternione
        // non è unitario e si misurano velocità che non ci sono)
        const nelModello = (o, out) => {
          out.identity();
          for (let x = o; x && x !== f; x = x.parent) out.premultiply(x.quaternion);
          return out.normalize();
        };
        void inv;
        for (const [nome, o] of ossa) {
          nelModello(o, _qr);
          const q0 = p.q.get(nome);
          if (q0) {
            const ang = 2 * Math.acos(Math.min(1, Math.abs(q0.dot(_qr)))) * DEG * 60;
            vel[nome] = Math.round(ang * 10) / 10;
            const w0 = p.w.get(nome);
            if (w0 !== undefined) acc[nome] = Math.round((ang - w0) * 60);
            p.w.set(nome, ang);
            q0.copy(_qr);
          } else p.q.set(nome, _qr.clone());
        }
        // testa: dove guarda rispetto al corpo (yaw, pitch) — la direzione +Z della testa nello spazio della figura
        const testa = ossa.get('testa');
        let testaYaw = null;
        let testaPitch = null;
        if (testa) {
          nelModello(testa, _qr);
          // l'asse avanti della testa nel suo riposo: si usa quello del bacino a riposo (Z del modello)
          const fw = v(0, 0, 1).applyQuaternion(_qr);
          const anim = animatoreDi(f);
          const riposo = anim?.ossa?.get('testa')?.W;
          if (riposo) {
            // con l'orientamento di riposo W: la rotazione del modello è q·W⁻¹
            const rot = _qr.clone().multiply(riposo.clone().invert());
            fw.set(0, 0, 1).applyQuaternion(rot);
          }
          testaYaw = Math.round(Math.atan2(fw.x, fw.z) * DEG * 10) / 10;
          testaPitch = Math.round(Math.asin(Math.max(-1, Math.min(1, -fw.y))) * DEG * 10) / 10;
        }
        // mani e gomiti nello spazio della figura (m) e dentro il busto?
        _m.copy(f.matrixWorld).invert();
        const pos = (n) => {
          const o = ossa.get(n);
          return o ? o.getWorldPosition(_p).applyMatrix4(_m).clone() : null;
        };
        const anim = animatoreDi(f);
        const busto = anim ? { fronte: anim.fronteBusto, retro: anim.retroBusto, H: anim.altezza } : null;
        const mani = {};
        for (const L of ['S', 'D']) {
          const polso = pos(`mano${L}`) ?? pos(`avambraccio${L}`);
          const gomito = pos(`avambraccio${L}`);
          const spalla = pos(`braccio${L}`);
          if (!polso) continue;
          mani[L] = { polso: [polso.x, polso.y, polso.z].map((x) => Math.round(x * 1000) / 1000) };
          if (gomito) mani[L].gomito = [gomito.x, gomito.y, gomito.z].map((x) => Math.round(x * 1000) / 1000);
          if (spalla) mani[L].spalla = [spalla.x, spalla.y, spalla.z].map((x) => Math.round(x * 1000) / 1000);
        }
        const bac = pos('bacino');
        const collo = pos('collo') ?? pos('testa');
        const r3 = (p) => (p ? [p.x, p.y, p.z].map((x) => Math.round(x * 1000) / 1000) : null);
        riga[id] = {
          spina: [r3(bac), r3(collo)],
          yaw: Math.round(p.yaw * 10) / 10,
          vel,
          acc,
          testa: [testaYaw, testaPitch],
          mani,
          bacinoY: bac ? Math.round(bac.y * 1000) / 1000 : null,
          busto,
          seduto: anim ? Math.round((anim.sedutoPeso ?? 0) * 100) / 100 : null,
        };
        prec.set(id, p);
      }
      riga.camYaw = Math.round(r.yawPitch().yaw * 10) / 10;
      riga.nodo = X.nodo();
      return riga;
    },
    /** riquadro (px) attorno alla figura vista da questa camera: piedi e cima proiettati */
    riquadro(id, margine = 0.22) {
      const t = X.terna(id);
      const cam = game.camera;
      cam.updateMatrixWorld();
      const pts = [];
      for (const [h, l] of [[-0.05, 0], [1.9, 0], [0.9, 0.7], [0.9, -0.7]]) pts.push(t.piedi.clone().addScaledVector(t.su, h).addScaledVector(t.lato, l).project(cam));
      const W = game.renderer.domElement.width;
      const H = game.renderer.domElement.height;
      const ys = pts.map((p) => (1 - (p.y + 1) / 2) * H);
      const xs = pts.map((p) => ((p.x + 1) / 2) * W);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const alt = (y1 - y0) * (1 + 2 * margine);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (y0 + y1) / 2;
      const larg = alt * 0.8;
      return { x: cx - larg / 2, y: cy - alt / 2, w: larg, h: alt };
    },
    /** disegna dalla camera di adesso e ritaglia il riquadro, JPEG */
    ritaglia(box, larg = 300) {
      game.loop.stepFrames(0);
      const src = game.renderer.domElement;
      const c = document.createElement('canvas');
      c.width = larg;
      c.height = Math.round((larg * box.h) / box.w);
      const g = c.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(src, box.x, box.y, box.w, box.h, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.88);
    },
    /**
     * Il campo visivo stretto di `k` per `fn` (direttamente sulla camera: setFovScale ridimensiona tutti i
     * bersagli della post a ogni chiamata, lentissimo). La regia chiede la scala 1, già quella: non lo tocca.
     */
    conCampo(k, fn) {
      const cam = game.camera;
      const fov0 = cam.fov;
      cam.fov = fov0 * k;
      cam.updateProjectionMatrix();
      try {
        return fn();
      } finally {
        cam.fov = fov0;
        cam.updateProjectionMatrix();
      }
    },
    /** Gli occhi di Elvira con il campo visivo stretto (scala 0,55: il centro della sua vista, ingrandito). */
    conVistaElvira(fn) {
      return X.conCampo(0.55, fn);
    },
    /** fissa la camera di lato per la scena: sulla bisettrice fra dove guardava la figura e la direzione di Elvira, girata di `gradi` */
    fissaLato(id, gradi, dist) {
      const t = X.terna(id);
      const pc = game.player.cyl;
      const elv = C.cylToWorld(pc.z, pc.theta, pc.h);
      const dir = elv.clone().sub(t.piedi).projectOnPlane(t.su).normalize();
      const bis = dir.clone().add(t.avanti.clone().projectOnPlane(t.su).normalize());
      if (bis.lengthSq() < 1e-4) bis.copy(dir);
      bis.normalize();
      const a = (gradi * Math.PI) / 180;
      const perp = t.su.clone().cross(bis).normalize();
      const d2 = bis.clone().multiplyScalar(Math.cos(a)).addScaledVector(perp, Math.sin(a));
      X.lato = { occhio: t.piedi.clone().addScaledVector(d2, dist).addScaledVector(t.su, 1.45), mira: t.piedi.clone().addScaledVector(t.su, 0.95), su: t.su.clone() };
    },
    lato: null,
    /**
     * La camera di lato (fissaLato), campo visivo stretto; salva e rimette la camera di Elvira.
     */
    conVistaDiLato(fn) {
      const L = X.lato;
      const salva = { cur: game.currEye.clone(), prev: game.prevEye.clone(), q: game.rig.quaternion.clone(), free: game.freeCamera };
      game.currEye.copy(L.occhio);
      game.prevEye.copy(L.occhio);
      // la camera guarda la mira con il su locale (Matrix4.lookAt: +Z della camera verso l'occhio)
      const m = new M4().lookAt(L.occhio, L.mira, L.su);
      game.rig.quaternion.setFromRotationMatrix(m);
      game.freeCamera = true;
      try {
        return X.conCampo(0.45, fn);
      } finally {
        game.freeCamera = salva.free;
        game.currEye.copy(salva.cur);
        game.prevEye.copy(salva.prev);
        game.rig.quaternion.copy(salva.q);
        game.syncEyeNow();
      }
    },
  };
  window.__PV__ = X;
  return { ok: true };
}

const S = (fn, arg) => page.evaluate(fn, arg);

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
    G.regia.avanza(1.5);
    if (!X.figura(q.chi) || !X.corbella.npc(q.chi)?.presente) return { errore: `${q.chi} non c'è` };
    const piazza = X.piazzaElvira(q.chi, q.d, q.giro);
    // un secondo con Elvira lì (gli sguardi si girano già)
    G.regia.avanza(1.0);
    G.ensureLoaded();
    return { piazza, posa: X.corbella.npc(q.chi).posizione(), luogo: X.corbella.npc(q.chi).luogo };
  }, q);
  console.log(q.nome, JSON.stringify(prep));
  if (prep.errore) return;
  const ids = [q.chi, ...(q.altri ?? [])];
  const passiPerFoto = Math.round(60 / FPS);
  const t0 = -0.5;
  const battute = q.battute ?? [2.2, 4.4];
  const chiudi = q.chiudi ?? 6.0;
  const fine = q.fine ?? 7.5;
  const passi = Math.round((fine - t0) * 60);
  // i riquadri sono fissi per la scena (presi all'inizio): se la figura si gira, si vede
  const box = await S(
    ([q]) => {
      const X = window.__PV__;
      const a = X.conVistaElvira(() => {
        window.__GAME__.game.loop.stepFrames(0);
        return X.riquadro(q.chi, 0.1);
      });
      const lato = q.lato ?? [25, 3.4];
      X.fissaLato(q.chi, lato[0], lato[1]);
      const b = X.conVistaDiLato(() => {
        window.__GAME__.game.loop.stepFrames(0);
        return X.riquadro(q.chi, 0.12);
      });
      X.azzera();
      return { a, b };
    },
    [q],
  );
  const misure = [];
  const eventi = [];
  let foto = 0;
  const tScena = Date.now();
  for (let i = 0; i < passi; i++) {
    const t = t0 + i / 60;
    const azione = [];
    if (Math.abs(t) < 1e-6 && q.dialogo) azione.push('apri');
    for (const b of battute) if (Math.abs(t - b) < 1e-6 && q.dialogo) azione.push('avanti');
    if (Math.abs(t - chiudi) < 1e-6 && q.dialogo) azione.push('chiudi');
    const scatta = i % passiPerFoto === 0;
    const r = await S(
      ([q, ids, azione, scatta, box]) => {
        const X = window.__PV__;
        const ev = [];
        for (const a of azione) {
          if (a === 'apri') ev.push(`apri ${X.apri(q.dialogo, q.automatico)}`);
          if (a === 'avanti') ev.push(`avanti → ${X.avanti()}`);
          if (a === 'chiudi') {
            X.chiudi();
            ev.push('chiudi');
          }
        }
        const riga = X.passo(ids);
        let a = null;
        let b = null;
        if (scatta) {
          a = X.conVistaElvira(() => X.ritaglia(box.a, 300));
          b = X.conVistaDiLato(() => X.ritaglia(box.b, 300));
        }
        return { riga, ev, a, b };
      },
      [q, ids, azione, scatta, box],
    );
    r.riga.t = Math.round(t * 1000) / 1000;
    misure.push(r.riga);
    if (r.ev.length) eventi.push({ t: r.riga.t, ev: r.ev });
    if (scatta) {
      if (foto % 16 === 0) console.log(`  ${q.nome} t=${t.toFixed(2)} s, ${Math.round((Date.now() - tScena) / 1000)} s reali`);
      const n = String(foto++).padStart(3, '0');
      writeFileSync(join(dir, `a_${n}.jpg`), Buffer.from(r.a.split(',')[1], 'base64'));
      writeFileSync(join(dir, `b_${n}.jpg`), Buffer.from(r.b.split(',')[1], 'base64'));
    }
  }
  writeFileSync(join(dir, 'misure.json'), JSON.stringify({ scena: q, prep, fps: FPS, t0, eventi, misure }));
  console.log(`  ${q.nome}: ${foto} fotogrammi, eventi ${JSON.stringify(eventi)}`);
}

try {
  const t0 = Date.now();
  let pronto = false;
  for (let tentativo = 1; !pronto; tentativo++) {
    await page.goto(`http://127.0.0.1:${porta}/?nuova`);
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 900000 });
    console.log(`gioco pronto in ${Math.round((Date.now() - t0) / 1000)} s`);
    await S(() => window.__GAME__.regia.vai('piazza_ore'));
    await S((qq) => window.__GAME__.setSetting('qualita', qq), QUALITA);
    try {
      await page.evaluate(`(${installa.toString()})()`);
      pronto = true;
    } catch (e) {
      if (tentativo >= 2) throw e;
      console.error(`nuovo tentativo dopo: ${String(e).split('\n')[0]}`);
    }
  }
  const solo = args.solo ? args.solo.split(',') : null;
  for (const q of SCENE) {
    if (solo && !solo.some((s) => q.nome.startsWith(s))) continue;
    const t1 = Date.now();
    await scena(q);
    console.log(`  (${Math.round((Date.now() - t1) / 1000)} s)`);
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}
