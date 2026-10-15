#!/usr/bin/env node
/**
 * Foto delle indicazioni delle missioni (pannello dell'obiettivo e segnalino di direzione):
 * npm run shots:indicazioni. Gioca il prologo e la missione 1 con i sistemi veri, come la prova
 * E2E (scripts/e2e-fase1.mjs), e scatta nei momenti che contano: la Cripta (la busta), la scala,
 * l'uscita dalla botola, il cammino verso il belvedere (davanti, alle spalle, sotto il pannello,
 * sotto le notifiche), il passo nuovo che barra il vecchio, la Ripa da cui planare, i velati
 * all'alba (nessuno con cui parlare: l'ora in cui arriva qualcuno, l'attesa proposta), una
 * persona da cercare e la conversazione, chi è seduto, la notte, la novizia prima delle 7, il
 * campanaro cercato sul sagrato, i tastini del rilievo, il gioco libero, le impostazioni.
 * Controlla anche che il segnalino indichi la meta giusta (la sua posizione sullo schermo contro
 * la proiezione del punto) e che non finisca sotto il pannello o le notifiche.
 *
 * Opzioni: --no-build, --size=1280x720. Le foto vanno in docs/shots/indicazioni/.
 */
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.some((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const valore = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const [W, H] = valore('size', '1280x720').split('x').map(Number);
const cartellaFoto = join(root, 'docs', 'shots', 'indicazioni');
mkdirSync(cartellaFoto, { recursive: true });
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function serve(dir, port) {
  const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
  const server = createServer((req, res) => {
    let p = normalize(join(dir, decodeURIComponent((req.url || '/').split('?')[0])));
    if (!p.startsWith(dir)) return res.writeHead(403).end();
    if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
    if (!existsSync(p)) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': tipi[extname(p)] || 'application/octet-stream' });
    createReadStream(p).pipe(res);
  });
  return new Promise((ok) => server.listen(port, '127.0.0.1', () => ok(server)));
}

let page;
const diario = [];
const problemi = [];
const log = (t) => {
  diario.push(t);
  console.log(t);
};
/** Un controllo che non torna: si annota (e alla fine la prova fallisce). */
const male = (t) => {
  problemi.push(t);
  log(`  ✗ ${t}`);
};
const R = (fn, arg) => page.evaluate(fn, arg);
const stato = () => R(() => window.__GAME__.regia.stato());
const vale = (cond) => R((c) => window.__GAME__.regia.regia.narrativa.valuta(c), cond);
const avanza = (s) => R((x) => window.__GAME__.regia.avanza(x), s);
const avanzaFinche = (cond, max = 120, passo = 0.25) => R(([c, m, p]) => window.__GAME__.regia.avanzaFinche(c, m, p), [cond, max, passo]);
const premi = (codice) => R((c) => window.__GAME__.regia.premi(c), codice);
const tieni = (codice, s) => R(([c, x]) => window.__GAME__.regia.tieni(c, x), [codice, s]);
const vai = (l, theta, alt) => R(([a, b, c]) => window.__GAME__.regia.vai(a, b, c), [l, theta, alt]);
const avvicina = (id, d) => R(([a, b]) => window.__GAME__.regia.avvicina(a, b), [id, d]);
const mira = (id) => R((a) => window.__GAME__.regia.mira(a), id);
const sguardo = (yaw, pitch) => R(([y, p]) => window.__GAME__.regia.sguardo(y, p), [yaw, pitch]);
const impostaOra = (g, o) => R(([a, b]) => window.__GAME__.regia.impostaOra(a, b), [g, o]);
const completaPassi = (missione, passi) =>
  R(([m, ps]) => {
    const n = window.__GAME__.regia.regia.narrativa;
    for (const p of ps) n.missioni.completaPasso(m, p);
    n.tick(0);
  }, [missione, passi]);
const meta = () => R(() => window.__GAME__.regia.regia.guida.metaAttuale);
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const fotoMancanti = [];

/**
 * Una foto. Con la macchina carica (SwiftShader sulla CPU) può metterci molto: si riprova una
 * volta e, se non arriva, si annota e si va avanti (i controlli non dipendono dall'immagine).
 */
async function scatta(nome) {
  for (let prova = 0; prova < 2; prova++) {
    try {
      await page.screenshot({ path: join(cartellaFoto, `${nome}.png`), timeout: 150000 });
      return true;
    } catch (e) {
      log(`  (foto ${nome} non riuscita${prova ? '' : ', riprovo'}: ${String(e?.message || e).split('\n')[0]})`);
    }
  }
  fotoMancanti.push(nome);
  return false;
}

async function verifica(cond, messaggio) {
  if (await vale(cond)) {
    log(`  ✓ ${messaggio}`);
    return;
  }
  const s = await stato();
  throw new Error(`✗ ${messaggio}: «${cond}» non è vera. stato: ${JSON.stringify(s)}`);
}

async function usa(id, { distanza = 1.3, tenere = 0 } = {}) {
  await avvicina(id, distanza);
  await avanza(0.1);
  const s = await stato();
  if (s.bersaglio !== id) throw new Error(`bersaglio atteso «${id}», scelto «${s.bersaglio}»`);
  if (tenere) await tieni('KeyE', tenere);
  else await premi('KeyE');
}

async function dialogo(max = 40) {
  for (let i = 0; i < max; i++) {
    const s = await stato();
    if (!s.dialogo) break;
    if (s.lettura) {
      await leggi();
      continue;
    }
    await page.keyboard.press('Enter');
    await attendi(30);
    const s2 = await stato();
    if (!s2.dialogo) break;
    await page.keyboard.press(s2.dialogo.risposte.length ? '1' : 'Enter');
    await attendi(30);
    await avanza(0.05);
  }
}

async function leggi() {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('PageDown');
    await attendi(300);
    await avanza(0.3);
  }
  await avanza(1.3);
  await page.keyboard.press('Escape');
  await attendi(60);
  await avanza(0.1);
}

/** Chiude ciò che un salto della storia ha aperto (dialoghi automatici, carte, la Pianta). */
async function chiudiTutto() {
  for (let i = 0; i < 6; i++) {
    const s = await stato();
    if (s.dialogo) await dialogo();
    else if (s.lettura) await leggi();
    else if (s.modali.pianta || s.modali.taccuino) {
      await page.keyboard.press('Escape');
      await attendi(60);
      await avanza(0.2);
    } else break;
  }
}

/** Seduta, «aspetta fino a» con la voce che contiene `testo`; restituisce le voci del menu. */
async function aspetta(testo, { foto: nomeFoto } = {}) {
  const s = await stato();
  if (s.controllo !== 'seduta') {
    await tieni('KeyC', 0.5);
    await avanza(0.1);
  }
  await premi('KeyX');
  const voci = await page.$$eval('.regia-attesa button', (bs) => bs.map((b) => b.textContent));
  if (nomeFoto) {
    await attendi(400);
    await scatta(nomeFoto);
    log(`  📷 ${nomeFoto}.png — «Aspetta fino a»: ${voci.join(' | ')}`);
  }
  const i = voci.findIndex((v) => v.includes(testo));
  if (i < 0) throw new Error(`«aspetta fino a: ${testo}» non c'è fra ${JSON.stringify(voci)}`);
  await page.keyboard.press(String(i + 1));
  await attendi(30);
  for (let t = 0; t < 200; t += 2) {
    await avanza(2);
    if (!(await R(() => window.__GAME__.regia.regia.orologio.inAttesa))) break;
  }
  return voci;
}

async function alzati() {
  if ((await stato()).controllo === 'seduta') {
    await premi('KeyC');
    await avanza(0.1);
  }
}

/** Disegna (più volte: il pannello e il segnalino si aggiornano nel disegno). */
async function disegna(volte = 3) {
  for (let i = 0; i < volte; i++) {
    await R(() => {
      const g = window.__GAME__;
      g.ensureLoaded();
      g.render();
    });
    await attendi(40);
  }
}

/** Il segnalino adesso: dove sta sullo schermo, che cosa dice, e dove dovrebbe stare. */
async function segnalino() {
  return R(() => {
    const r = window.__GAME__.regia.regia;
    const el = document.querySelector('.ui-ob-segnalino');
    const pannello = document.querySelector('.ui-ob-pannello');
    const vis = !!el && !el.hidden && getComputedStyle(el).opacity !== '0';
    const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(el?.style.transform ?? '');
    const pr = pannello && !pannello.hidden ? pannello.getBoundingClientRect() : null;
    const notifiche = document.querySelector('.ui-hud-notifiche');
    const nr = notifiche && notifiche.children.length ? notifiche.getBoundingClientRect() : null;
    return {
      visibile: vis,
      x: m ? Number(m[1]) : null,
      y: m ? Number(m[2]) : null,
      bordo: el?.classList.contains('ui-ob-segnalino--bordo') ?? false,
      dietro: el?.classList.contains('ui-ob-segnalino--dietro') ?? false,
      testo: el?.querySelector('.ui-ob-etichetta')?.textContent ?? '',
      tappe: r.guida.tappeAttuali,
      meta: r.guida.metaAttuale,
      passo: r.guida.chiaveSeguita,
      pannello: pannello && !pannello.hidden ? pannello.innerText.replace(/\s+/g, ' ').trim() : null,
      // perché le indicazioni sono sospese, se lo sono
      sospeso: document.querySelector('.ui-obiettivo')?.classList.contains('ui-ob--sospeso')
        ? { input: r.ui.inputCatturato, dorme: r.dormendo, controllo: r.controllo.tipo, coperta: r.velatura.coperta(), interfaccia: r.ui.indicazioni.visible }
        : null,
      areaPannello: pr ? { sinistra: pr.left, destra: pr.right, sotto: pr.bottom, alto: pr.height } : null,
      areaNotifiche: nr ? { sinistra: nr.left, destra: nr.right, sotto: nr.bottom } : null,
    };
  });
}

/** Dove cade adesso sullo schermo il punto della meta (px). */
const proiezioneMeta = () =>
  R(() => {
    const r = window.__GAME__.regia.regia;
    const v = r.guida.meta.clone().project(r.game.camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight, davanti: v.z < 1 };
  });

async function foto(nome, { attendiAnimazioni = true, prepara } = {}) {
  if (prepara) await prepara();
  // una velatura in corso (il nero del risveglio, il bianco della botola) sospende le indicazioni:
  // la foto aspetta che la vista si scopra (va in tempo vero)
  await page.waitForFunction(() => !window.__GAME__.regia.regia.velatura.coperta(), null, { timeout: 10000, polling: 100 }).catch(() => log(`  (vista ancora coperta per ${nome})`));
  await disegna(3);
  if (attendiAnimazioni) {
    await attendi(150);
    await page
      .waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 4000, polling: 100 })
      .catch(() => log(`  (animazioni ancora in corso per ${nome})`));
    await disegna(1);
    await attendi(150);
  }
  await scatta(nome);
  const sg = await segnalino();
  log(`  📷 ${nome}.png — passo ${sg.passo}; meta ${JSON.stringify(sg.meta)}; segnalino ${sg.visibile ? `${sg.dietro ? 'dietro, ' : ''}${sg.bordo ? 'al bordo' : 'sulla meta'} (${sg.x}, ${sg.y}) «${sg.testo}»` : 'spento'}`);
  log(`     pannello: ${sg.pannello ?? '(nascosto)'}${sg.areaPannello ? ` [alto ${Math.round(sg.areaPannello.alto)} px]` : ''}${sg.sospeso ? ` — sospeso ${JSON.stringify(sg.sospeso)}` : ''}`);
  return sg;
}

/**
 * Gira lo sguardo finché la meta cade nel punto (fx, fy) dello schermo (frazioni; fuori da 0-1
 * vuol dire oltre il bordo): per le foto della meta sotto il pannello e sopra le notifiche.
 */
async function inquadraMeta(fx, fy) {
  return R(
    ([fx, fy]) => {
      const G = window.__GAME__;
      const D = G.regia;
      const r = D.regia;
      const m = r.guida.meta;
      const rr = Math.hypot(m.x, m.y);
      D.mira([m.z, (Math.atan2(-m.x, -m.y) * 180) / Math.PI, 646 - rr]);
      const dove = () => {
        G.render();
        const v = r.guida.meta.clone().project(r.game.camera);
        return [(v.x + 1) / 2, (1 - v.y) / 2];
      };
      let { yaw, pitch } = r.yawPitch();
      for (let i = 0; i < 8; i++) {
        D.sguardo(yaw, pitch);
        const [x, y] = dove();
        if (Math.abs(x - fx) < 0.008 && Math.abs(y - fy) < 0.008) break;
        D.sguardo(yaw + 1, pitch);
        const [x1] = dove();
        D.sguardo(yaw, pitch + 1);
        const [, y2] = dove();
        yaw -= (x - fx) / (x1 - x || 1e-3);
        pitch -= (y - fy) / (y2 - y || 1e-3);
      }
      D.sguardo(yaw, pitch);
      return dove();
    },
    [fx, fy],
  );
}

/** Il segnalino deve stare (a 8 px) dove la meta si proietta. */
async function controllaSullaMeta(sg, cosa) {
  if (!sg.visibile) return male(`il segnalino su ${cosa} non si vede`);
  const a = await proiezioneMeta();
  log(`  ${cosa}: proiettato a (${a.x.toFixed(0)}, ${a.y.toFixed(0)}), il segnalino a (${sg.x}, ${sg.y})`);
  if (sg.bordo || Math.abs(a.x - sg.x) > 8 || Math.abs(a.y - sg.y) > 8) male(`il segnalino non sta su ${cosa}`);
}

/** La meta delle persone: la si guarda (la testa) e si controlla il segnalino. */
const miraLaPersona = () =>
  R(() => {
    const G = window.__GAME__.regia;
    const t = G.regia.guida.metaAttuale;
    if (t?.tipo !== 'persona') return null;
    const p = G.regia.abitanti.posizione(t.id);
    if (p) G.mira([p.z, p.theta, p.h + 1.5]);
    return t.id;
  });

async function main() {
  if (!flag('no-build')) {
    console.log('build E2E (VITE_E2E=1)…');
    execSync('npm run build:e2e', { cwd: root, stdio: 'inherit' });
  }
  const port = 4900 + Math.floor(Math.random() * 300);
  const server = await serve(join(root, 'dist-e2e'), port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  page = await browser.newPage({ viewport: { width: W, height: H } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.stack || e}`));
  const t0 = Date.now();
  let esito = 'ok';
  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 300000 });
    await R(() => window.__GAME__.stopLoop());
    log(`pronto in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

    await page.getByRole('button', { name: 'Nuova partita' }).click();
    await avanza(0.5);
    // il nero dell'inizio si apre in 3,2 s (tempo vero): le indicazioni aspettano
    let sg = await segnalino();
    if (sg.pannello && (await R(() => !document.querySelector('.ui-obiettivo').classList.contains('ui-ob--sospeso')))) throw new Error('il pannello doveva aspettare la fine del nero');
    await attendi(3600);
    await avanza(0.3);
    await foto('01-cripta-capsula');

    log('— la Cripta');
    await mira('scritta_vetro');
    await avanza(1.7);
    await avanza(2.5);
    await premi('KeyE'); // Alzati
    await avanza(1.8);
    await attendi(1600); // il respiro dell'alzarsi
    await avanza(0.2);
    // in piedi: il segnalino sulla busta, sul vetro della capsula
    await avvicina('busta_5', 1.9);
    await avanza(0.2);
    sg = await foto('02-cripta-la-busta', { prepara: () => mira('busta_5') });
    if (sg.meta?.id !== 'busta_5') male(`in piedi nella Cripta la meta doveva essere la busta: ${JSON.stringify(sg.meta)}`);
    else await controllaSullaMeta(sg, 'la busta');
    await usa('busta_5', { distanza: 1.0 });
    await avanza(0.3);
    // il passo nuovo barra il vecchio: foto a metà dell'animazione (che va in tempo vero)
    await avvicina('armadietto_5', 1.1);
    await R(() => {
      const G = window.__GAME__;
      G.regia.avanza(0.1);
      G.regia.premi('KeyE');
      G.regia.avanza(0.5);
      G.render();
    });
    // le animazioni del pannello vanno in tempo vero e una foto con SwiftShader può metterci più di
    // un secondo: le si ferma a un istante preciso (la riga vecchia barrata, poi la nuova entrata)
    const fermaAnimazioni = (ms) =>
      R((t) => {
        for (const a of document.getAnimations()) {
          const el = a.effect?.target;
          if (!el || !el.closest?.('.ui-obiettivo')) continue;
          a.pause();
          a.currentTime = t;
        }
      }, ms);
    await attendi(30);
    await fermaAnimazioni(580);
    await scatta('03-nuovo-obiettivo');
    log('  📷 03-nuovo-obiettivo.png (la riga vecchia barrata)');
    await fermaAnimazioni(1400);
    await scatta('03b-nuovo-obiettivo-entrato');
    log('  📷 03b-nuovo-obiettivo-entrato.png');
    await R(() => {
      for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.ui-obiettivo')) a.finish();
    });
    await verifica('passo:pr_cripta completato', "l'armadietto aperto");
    await attendi(1500);
    sg = await foto('04-cripta-verso-la-scala', { prepara: () => sguardo(90, -8) });
    if (!sg.visibile) male('il segnalino verso la scala non si vede');

    log('— la scala e la botola');
    await usa('scala', { distanza: 1.0 });
    await tieni('KeyW', 0.6);
    sg = await foto('05-scala-botola-in-su', { prepara: () => sguardo(0, 25) });
    if (!sg.testo.includes('in su')) male(`sulla scala il segnalino doveva dire «in su»: «${sg.testo}»`);
    await tieni('KeyW', 6.0);
    await premi('KeyE'); // Spingi la botola
    await avanza(0.5);
    await attendi(1900); // il bianco della botola
    await foto('06-uscita-dalla-botola', { prepara: () => sguardo(150, 20) });
    await sguardo(150, 72);
    await avanza(1.8);
    await verifica('passo:pr_guarda_su completato', 'guardato in su');
    await attendi(1500);

    log('— verso il belvedere');
    await mira('muretto');
    await avanza(0.3);
    sg = await foto('07-verso-il-belvedere', {
      prepara: () =>
        R(() => {
          const r = window.__GAME__.regia;
          const p = r.posizione('muretto');
          r.mira([p[0], p[1], p[2] + 1.5]);
        }),
    });
    if (!sg.visibile || sg.bordo) male('il segnalino del muretto doveva essere sullo schermo');
    else {
      const atteso = await R(() => {
        const r = window.__GAME__.regia.regia;
        const v = r.scena.punto('muretto').clone().project(r.game.camera);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
      });
      log(`  il muretto proiettato a (${atteso.x.toFixed(0)}, ${atteso.y.toFixed(0)}), il segnalino a (${sg.x}, ${sg.y})`);
      if (Math.abs(atteso.x - sg.x) > 8 || sg.y > atteso.y + 4) male('il segnalino non sta sul muretto');
    }
    // alle spalle: sul fianco verso cui girarsi, con «dietro»
    await R(() => {
      const r = window.__GAME__.regia;
      r.sguardo((r.regia.yawPitch().yaw + 160) % 360, 4);
    });
    sg = await foto('08-belvedere-alle-spalle');
    if (!sg.bordo || !sg.dietro || !sg.testo.includes('dietro')) male(`alle spalle il segnalino doveva stare al bordo con «dietro»: ${JSON.stringify(sg)}`);
    if (sg.x !== null && Math.abs(sg.x - W / 2) < W * 0.35) male(`alle spalle il segnalino doveva stare su un fianco, non al centro (x ${sg.x})`);
    // la meta che cadrebbe sotto il pannello: una freccia appena sotto la carta, girata verso di lei
    await inquadraMeta(0.1, 0.1);
    sg = await foto('08b-meta-sotto-il-pannello');
    {
      const a = await proiezioneMeta();
      log(`  la meta cade a (${a.x.toFixed(0)}, ${a.y.toFixed(0)}), il pannello finisce a ${sg.areaPannello ? Math.round(sg.areaPannello.sotto) : '?'} px`);
      if (!sg.visibile || !sg.areaPannello || sg.y <= sg.areaPannello.sotto) male('sotto il pannello il segnalino doveva scendere sotto la carta');
    }
    // tre notifiche del Taccuino in alto a destra e la meta sopra lo schermo, a destra
    await R(() => {
      // restano due minuti: la foto, con la macchina carica, può metterci molto
      const n = window.__GAME__.regia.regia.ui.indicazioni;
      n.notifica('Taccuino: il castagno', { durata: 120000 });
      n.notifica('Taccuino: «Non fidarti delle campane.»', { durata: 120000 });
      n.notifica('La Pianta si è aggiornata', { durata: 120000 });
    });
    await inquadraMeta(0.97, -0.04);
    sg = await foto('08c-sotto-le-notifiche', { attendiAnimazioni: false });
    if (!sg.visibile || !sg.areaNotifiche || !sg.bordo) male(`con le notifiche il segnalino doveva stare al bordo: ${JSON.stringify(sg)}`);
    else if (sg.x > sg.areaNotifiche.sinistra - 24 && sg.y <= sg.areaNotifiche.sotto) male('il segnalino è finito sotto le notifiche');
    await mira('muretto');
    await tieni('KeyW', 9);
    await usa('muretto', { distanza: 1.6 });
    await avanza(0.3);
    // da seduta, durante pr_lettera, la lettera si apre da sola; se no la si apre con E
    if (!(await stato()).lettura) {
      await premi('KeyE');
      await avanza(0.2);
    }
    await leggi();
    await avanzaFinche('dialogo:d_meridiana_1 iniziato', 60);
    await dialogo();
    await verifica('missione:m01_castagno_vuoto attiva', 'il prologo è finito');

    log('— la lente, la marza, la terrazza, l\'innesto');
    await alzati();
    await attendi(1200);
    await foto('09-castagno-morto', {
      prepara: () =>
        R(() => {
          const r = window.__GAME__.regia;
          r.vai(1100, 28.6);
          const p = r.posizione('castagno_morto');
          r.mira([p[0], p[1], p[2] + 1]);
        }),
    });
    await vai('botola');
    await premi('KeyQ');
    for (const p of ['lente_ricci', 'lente_amenti', 'lente_corteccia']) {
      await avvicina(p, 1.5);
      await avanza(1.3);
    }
    await premi('KeyQ');
    await usa('ramo_vivo', { distanza: 1.4, tenere: 1.9 });
    await avanza(0.3);
    await page.keyboard.press('Escape'); // la Pianta
    await avanza(0.2);
    await verifica('passo:m1_cartellino attivo', 'verso la terrazza');
    await vai('terrazza_pedrazzini');
    await usa('cartellino', { distanza: 1.1 });
    await avanza(0.2);
    await leggi();
    for (let k = 0; k < 3; k++) {
      await usa('innesto', { distanza: 1.2, tenere: 1.6 });
      await avanza(0.2);
    }
    await verifica('passo:m1_velo attivo', 'il Velo');
    await attendi(1500);

    log('— il Velo: prima la Ripa da cui saltare');
    sg = await foto('10-verso-la-ripa', {
      prepara: () =>
        R(() => {
          const r = window.__GAME__.regia;
          r.vai('muraglione_gra');
          r.mira([1036, 33.2, 40]);
        }),
    });
    if (sg.meta?.id !== 'ripa_san_vigilio') male(`per la planata la meta doveva essere la Ripa: ${JSON.stringify(sg.meta)}`);
    // giù in piazza a piedi, senza planare: il segnalino rimanda alla Ripa (in su)
    await vai('piazza_ore');
    await avanza(0.4);
    sg = await foto('11-in-piazza-senza-planata', { prepara: () => mira([1036, 33.2, 44]) });
    if (sg.meta?.id !== 'ripa_san_vigilio' || !sg.visibile) male(`in piazza senza planata il segnalino doveva tornare alla Ripa: ${JSON.stringify(sg.meta)}`);
    await R(() => window.__GAME__.regia.regia.flag('planata_fatta'));
    await avanza(0.5);
    await verifica('passo:m1_velati attivo', 'i velati');

    log('— i velati all’alba: nessuno con cui parlare');
    await impostaOra(1, 6.3);
    await avanza(1.2);
    await chiudiTutto();
    await attendi(1200);
    sg = await foto('12-velati-alba-attesa', { prepara: () => mira([1040, 39.5, 40]) });
    if (sg.meta?.tipo !== 'luogo' || !sg.pannello?.includes('arriva alle 07:00')) male(`all'alba il pannello doveva dire quando arriva qualcuno: ${sg.pannello}`);
    // il menu dell'attesa propone l'ora di chi arriva
    const voci = await aspetta('le 07:00', { foto: '12b-aspetta-fino-alle-7' });
    if (!voci.some((v) => v.includes('07:00'))) male(`«Aspetta fino a» doveva proporre le 07:00: ${voci.join(' | ')}`);
    log(`  ${(await stato()).ora}: presenti ${await R(() => ['togna', 'bortolo', 'annunciata', 'pina', 'bambini', 'nando'].filter((c) => window.__GAME__.regia.regia.abitanti.presente(c)).join(', '))}`);
    // Annunciata alle 9: si aspetta seduti, come nella prova E2E
    while ((await stato()).ore < 9.1) await aspetta("fra un'ora");
    await alzati();
    await attendi(1200);
    // il segnalino va sulla persona più vicina che ha ancora qualcosa da dire: la si guarda
    await vai(1030, 37.5);
    await avanza(0.3);
    let chi = await miraLaPersona();
    sg = await foto('13-velati-segnalino', { prepara: miraLaPersona });
    await controllaSullaMeta(sg, chi);
    await usa(`png_${chi}`, { distanza: 1.8 });
    await avanza(0.2);
    await foto('14-conversazione', { prepara: () => R(() => window.__GAME__.regia.regia.ui.dialogo.completa()) });
    await dialogo();
    await avanza(0.5); // il passo fisso ricalcola le tappe: chi ha parlato esce dall'elenco
    await attendi(1600);
    const prima = chi;
    // vicino alla soglia di Pina: lei, seduta; il segnalino sopra la sua testa vera
    await vai(1047.5, 35.6);
    await avanza(0.4);
    chi = await miraLaPersona();
    sg = await foto('15-dopo-la-conversazione', { prepara: miraLaPersona });
    if (chi === prima) male(`dopo la conversazione il segnalino resta su ${chi}`);
    await controllaSullaMeta(sg, chi);
    if (chi === 'pina') {
      const sopra = await R(() => {
        const r = window.__GAME__.regia.regia;
        const p = r.abitanti.posizione('pina');
        const m = r.guida.meta;
        return 646 - Math.hypot(m.x, m.y) - p.h;
      });
      log(`  Pina seduta: il segnalino ${sopra.toFixed(2)} m sopra i piedi`);
      if (sopra > 2.0) male('su Pina seduta il segnalino resta troppo alto');
    }

    log('— la notte');
    await R(() => {
      const G = window.__GAME__.regia;
      const r = G.regia;
      // la sera di un giorno 1 qualunque: si salta alla brace finita, all'Ombrista vista
      for (const p of ['m1_velati', 'm1_ottavio', 'm1_brace', 'm1_ombrista']) r.narrativa.missioni.completaPasso('m01_castagno_vuoto', p);
      G.impostaOra(1, 21.3);
    });
    await avanza(1);
    await chiudiTutto();
    await verifica('passo:m1_fienile attivo', 'verso il fienile, di notte');
    await attendi(1500);
    await foto('16-notte-verso-il-fienile', {
      prepara: () =>
        R(() => {
          const r = window.__GAME__.regia;
          r.vai(1120, 47);
          r.mira([1163, 51.9, 6]);
        }),
    });

    log('— il giorno 2: il fienile, la notte dormita, il ritorno');
    await vai('passerella_messo');
    await avanza(1.5);
    await avvicina('fienile', 1.2);
    await avanza(1);
    await avanzaFinche('dialogo:d_ottavio_fienile iniziato', 10);
    await dialogo();
    await avanza(1);
    await avanza(0.5);
    await chiudiTutto();
    await avanzaFinche('dialogo:d_ottavio_mattino iniziato o dialogo:d_ottavio_mattino_salvata iniziato', 10);
    await dialogo();
    await chiudiTutto();
    await verifica('passo:m1_mattino completato', 'il mattino');
    await vai('guado_sass');
    await avanza(0.5);
    await vai('piazza_ore');
    await avanza(0.5);
    await verifica('passo:m1_ritorno completato', 'tornata in piazza dal guado');
    if ((await stato()).ore >= 6.9) await impostaOra(2, 6.4);
    await avanza(0.5);
    await vai('bacheca_ore');
    await avanza(0.6);
    sg = await foto('17-dono-la-novizia-alle-7', { prepara: () => sguardo(200, 2) });
    if (sg.sospeso) male(`alla Bacheca il pannello era sospeso: ${JSON.stringify(sg.sospeso)}`);
    if (!sg.pannello?.includes('arriva alle 07:00')) male(`alla Bacheca prima delle 7 il pannello doveva dire quando arriva la novizia: ${sg.pannello}`);
    await aspetta('le 07:00');
    await alzati();
    await vai('bacheca_ore');
    await avanzaFinche('dialogo:d_clelia_dono iniziato', 20);
    await dialogo();
    await avanza(0.3);
    if ((await stato()).lettura) await leggi();
    await chiudiTutto();
    await verifica('passo:m1_dono completato', 'il dono della Madre');

    log('— il campanaro si cerca sul sagrato');
    if ((await stato()).ore >= 7.6 || (await stato()).ore < 7) await impostaOra(2, 7.1);
    await avanza(1.2);
    await vai('piazza_ore');
    await avanza(0.4);
    sg = await foto('18-campanile-il-campanaro-alle-8', { prepara: () => mira([1052, 39.2, 40]) });
    if (sg.meta?.tipo !== 'luogo' || sg.meta?.id !== 'sagrato' || !sg.pannello?.includes('arriva alle 08:00')) male(`prima delle 8 la meta doveva essere il sagrato, con l'ora: ${JSON.stringify(sg.meta)} ${sg.pannello}`);
    await impostaOra(2, 8.05);
    await avanza(1.2);
    await vai(1047, 38.5);
    await avanza(0.4);
    chi = await miraLaPersona();
    sg = await foto('18b-campanaro-sul-sagrato', { prepara: miraLaPersona });
    if (chi !== 'bortolo') male(`alle 8 la meta doveva essere il campanaro: ${JSON.stringify(sg.meta)}`);
    else await controllaSullaMeta(sg, 'il campanaro');

    log('— il chiodo 2: i tastini a capo');
    await completaPassi('m01_castagno_vuoto', ['m1_campanile', 'm1_libretto']);
    await chiudiTutto();
    await vai('sagrato');
    await avanza(0.5);
    await foto('19-chiodo-2-tastini', { prepara: () => mira('pianta_cs_2') });

    log('— il gioco libero');
    await completaPassi('m01_castagno_vuoto', ['m1_chiodo2', 'm1_primo_rilievo', 'm1_strada', 'm1_seconda_notte', 'm1_prova', 'm1_gancio']);
    await avanza(1);
    await chiudiTutto();
    await verifica('flag:gioco_libero', 'il gioco libero');
    await vai('piazza_ore');
    await avanza(0.5);
    await chiudiTutto();
    sg = await foto('20-gioco-libero', { prepara: () => sguardo(270, 20) });
    if (sg.meta?.id !== 'balcone_messi') male(`nel gioco libero la prima meta doveva essere il Balcone dei Messi: ${JSON.stringify(sg.meta)}`);
    if (sg.areaPannello && sg.areaPannello.alto > 200) male(`nel gioco libero il pannello è alto ${Math.round(sg.areaPannello.alto)} px`);

    log('— quanto costa');
    const costo = await R(() => {
      const r = window.__GAME__.regia.regia;
      const g = r.guida;
      let t = performance.now();
      for (let i = 0; i < 2000; i++) g.render(1 / 60);
      const disegno = ((performance.now() - t) / 2000) * 1000;
      t = performance.now();
      for (let i = 0; i < 300; i++) g.aggiornaSubito();
      const logica = ((performance.now() - t) / 300) * 1000;
      return { disegno, logica };
    });
    log(`  segnalino nel disegno: ${costo.disegno.toFixed(1)} µs a fotogramma; passo seguito, tappe e meta: ${costo.logica.toFixed(0)} µs (5 volte al secondo)`);

    log('— le impostazioni');
    await page.keyboard.press('Escape');
    await attendi(400);
    await page.getByRole('button', { name: 'Impostazioni' }).click();
    await attendi(400);
    await page.getByRole('tab', { name: 'Aiuti' }).click();
    await attendi(300);
    await R(() => {
      const righe = [...document.querySelectorAll('.ui-impostazioni [role="tabpanel"]:not([hidden]) .ui-imp-riga')];
      righe.at(-1)?.scrollIntoView({ block: 'end' });
    });
    await attendi(300);
    await scatta('21-impostazioni');
    log('  📷 21-impostazioni.png');
    if (problemi.length) throw new Error(`${problemi.length} controlli non tornano:\n${problemi.join('\n')}`);
  } catch (e) {
    esito = 'fallita';
    console.error(String(e?.stack || e));
    try {
      await page.screenshot({ path: join(cartellaFoto, 'errore.png') });
    } catch {
      /* niente */
    }
  }
  const errori = logs.filter((l) => /pageerror|\[error\]/i.test(l));
  if (errori.length) console.log(`errori del browser:\n${errori.slice(0, 20).join('\n')}`);
  writeFileSync(join(cartellaFoto, 'shots.json'), JSON.stringify({ data: new Date().toISOString(), esito, secondi: Math.round((Date.now() - t0) / 1000), passi: diario, problemi, fotoMancanti, errori: errori.slice(0, 50) }, null, 2));
  console.log(`foto ${esito} in ${Math.round((Date.now() - t0) / 1000)} s`);
  await browser.close();
  server.close();
  if (esito !== 'ok' || errori.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
