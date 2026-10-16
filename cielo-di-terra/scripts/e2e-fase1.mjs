#!/usr/bin/env node
/**
 * Prova da capo a fondo della Fase 1 (npm run e2e:fase1): il prologo «Due secoli» e la
 * missione 1 «Il castagno vuoto», giocati nel Chromium headless con la build E2E.
 *
 * Ci si sposta con il teletrasporto della regia (`__GAME__.regia.vai/avvicina`), ma ogni passo
 * si compie con i sistemi veri: il tasto E sui bersagli, i gesti tenuti, la lente, lo sguardo,
 * i dialoghi con le risposte (tasti 1-9 nella finestra di dialogo), le carte lette fino in
 * fondo, il Velo, il sedersi e «aspetta fino a» (X anche in piedi, il time-lapse di pochi
 * secondi, il secondo X che salta alla fine, il salvataggio e «Continua» a metà attesa), il sonno
 * e la notte del catasto, il resoconto del mattino, lo squadro piantato, livellato e collimato.
 * L'orologio a schermo si vede in tutte le foto (in alto a destra).
 *
 * Opzioni: --no-build, --size=1280x720, --senza-foto. Le schermate vanno in docs/shots/fase1/.
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
const conFoto = !flag('senza-foto');
const cartellaFoto = join(root, 'docs', 'shots', 'fase1');
mkdirSync(cartellaFoto, { recursive: true });
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function serve(dir, port) {
  const tipi = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
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
const diarioProva = [];
const log = (t) => {
  diarioProva.push(t);
  console.log(t);
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
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * I tempi delle attese (secondi di gioco simulati a 60 passi al secondo, cioè i secondi reali di
 * chi gioca): si scrivono nel diario («⏱») e in e2e.json, per la tabella prima/dopo di
 * docs/migliorie/tempo.md.
 */
const tempiAttese = [];
function annotaTempo(cosa, secondi, nota = '') {
  tempiAttese.push({ cosa, secondi: Math.round(secondi * 100) / 100, ...(nota ? { nota } : {}) });
  log(`  ⏱ ${cosa}: ${secondi.toFixed(2)} s${nota ? ` (${nota})` : ''}`);
}
/** Avanza a passi di `passo` s finché la condizione della storia vale; restituisce i secondi passati. */
const misuraFinche = (cond, max = 120, passo = 0.1) =>
  R(([c, m, p]) => {
    const G = window.__GAME__.regia;
    let t = 0;
    while (t < m && !G.regia.narrativa.valuta(c)) {
      G.avanza(p);
      t += p;
    }
    return t;
  }, [cond, max, passo]);
/** Come misuraFinche, con un controllo scritto in JS sulla regia (`r`). */
const misuraFincheJs = (corpo, max = 120, passo = 0.1) =>
  R(([src, m, p]) => {
    const G = window.__GAME__.regia;
    // eslint-disable-next-line no-new-func
    const ok = new Function('r', `return (${src});`);
    let t = 0;
    while (t < m && !ok(G.regia)) {
      G.avanza(p);
      t += p;
    }
    return t;
  }, [corpo, max, passo]);

async function verifica(cond, messaggio) {
  if (await vale(cond)) {
    log(`  ✓ ${messaggio} (${cond})`);
    return;
  }
  const s = await stato();
  const d = await R(() => window.__GAME__.regia.diario().slice(-25));
  throw new Error(`✗ ${messaggio}: la condizione «${cond}» non è vera.\nstato: ${JSON.stringify(s)}\ndiario:\n${d.join('\n')}`);
}

/**
 * Inquadra una persona per la foto: a `d` m, lo sguardo sul petto, così la testa resta sopra la
 * finestra del dialogo (che copre la metà bassa dello schermo).
 */
async function inquadra(chi, d = 3.2) {
  await avvicina(`png_${chi}`, d);
  await R((c) => {
    const G = window.__GAME__.regia;
    const p = G.regia.abitanti.posizione(c);
    if (p) G.mira([p.z, p.theta, p.h + 0.35]);
  }, chi);
}

/** Interagisce con un bersaglio: lo avvicina, controlla che sia quello scelto, preme (o tiene) E. */
async function usa(id, { distanza = 1.3, tenere = 0, avvicinare = true } = {}) {
  if (avvicinare) await avvicina(id, distanza);
  else await mira(id);
  await avanza(0.1);
  const s = await stato();
  if (s.bersaglio !== id) {
    const b = await R(() => window.__GAME__.regia.bersagli().slice(0, 6));
    throw new Error(`bersaglio atteso «${id}», scelto «${s.bersaglio}»; vicini: ${JSON.stringify(b)}`);
  }
  if (tenere) await tieni('KeyE', tenere);
  else await premi('KeyE');
}

/** Gioca il dialogo aperto con i tasti della finestra: Invio completa il testo, 1-9 risponde. */
async function dialogo(scelte = [], max = 40) {
  const fatte = [];
  for (let i = 0; i < max; i++) {
    const s = await stato();
    if (!s.dialogo) break;
    if (s.lettura) {
      // una carta aperta da un effetto del dialogo (la lettera di Rosa): prima si legge
      await foto(`carta-${s.lettura}`);
      await leggi();
      continue;
    }
    await page.keyboard.press('Enter'); // completa il testo che si scrive
    await attendi(30);
    const s2 = await stato();
    if (!s2.dialogo) break;
    if (s2.dialogo.risposte.length) {
      const k = Math.min(scelte.length ? scelte.shift() : 0, s2.dialogo.risposte.length - 1);
      fatte.push(s2.dialogo.risposte[k]);
      await page.keyboard.press(String(k + 1));
    } else await page.keyboard.press('Enter');
    await attendi(30);
    await avanza(0.05);
  }
  return fatte;
}

/** Legge la carta aperta fino in fondo (PagGiù) e la mette via (Esc). */
async function leggi(chiudi = true) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('PageDown');
    await attendi(350);
    await avanza(0.3);
  }
  await avanza(1.3);
  if (chiudi) {
    await page.keyboard.press('Escape');
    await attendi(60);
    await avanza(0.1);
  }
}

/**
 * «Aspetta fino a» con la voce che contiene `testo`: X anche in piedi (Elvira si siede da sola e il
 * menu si apre), il numero della voce, poi il time-lapse fino alla fine. Con `salta` (secondi) a
 * quel punto un secondo X salta alla fine; con `foto` un fotogramma a metà (le cifre che corrono).
 * Restituisce i secondi reali dell'attesa.
 */
async function aspetta(testo, { maxS = 30, salta = null, foto: nomeFoto = null, tastiInCoda = false } = {}) {
  if (tastiInCoda) {
    // un Invio in più a dialogo chiuso (nessuno lo legge in gioco): non deve saltare l'attesa dopo
    await page.keyboard.press('Enter');
    await attendi(30);
    await avanza(0.1);
  }
  await premi('KeyX');
  let s = await stato();
  if (s.controllo !== 'seduta') throw new Error(`X non ha fatto sedere Elvira (${s.controllo})`);
  const voci = await page.$$eval('.regia-attesa button', (bs) => bs.map((b) => b.textContent));
  const i = voci.findIndex((v) => v.includes(testo));
  if (i < 0) throw new Error(`«aspetta fino a: ${testo}» non c'è fra ${JSON.stringify(voci)}`);
  if (tastiInCoda) {
    // ...né Spazio e Invio premuti a menu aperto
    await page.keyboard.press('Space');
    await page.keyboard.press('Enter');
    await attendi(30);
    await avanza(1 / 60);
  }
  await page.keyboard.press(String(i + 1));
  await attendi(30);
  const s0 = await stato();
  if (!(await R(() => window.__GAME__.regia.regia.orologio.inAttesa))) throw new Error(`l'attesa «${testo}» non è partita: ${s0.ora}`);
  let secondi = 0;
  if (tastiInCoda) {
    await avanza(0.25);
    secondi += 0.25;
    const at = await R(() => {
      const r = window.__GAME__.regia.regia;
      return { inAttesa: r.orologio.inAttesa, salto: r.orologio.inSalto, diario: r.diario.slice(-4) };
    });
    if (!at.inAttesa || at.salto) throw new Error(`un tasto rimasto in coda ha fatto saltare l'attesa «${testo}»: ${JSON.stringify(at)}`);
    log('  ✓ Invio e Spazio rimasti in coda non saltano l\'attesa (il time-lapse corre)');
  }
  if (nomeFoto) {
    secondi += await misuraFincheJs('!r.orologio.inAttesa', 1.8, 0.05);
    await foto(nomeFoto);
  }
  if (salta !== null) {
    secondi += await misuraFincheJs('!r.orologio.inAttesa', salta, 0.05);
    await premi('KeyX'); // il secondo tocco: salta alla fine
    secondi += 2 / 60;
  }
  secondi += await misuraFincheJs('!r.orologio.inAttesa', maxS, 0.05);
  s = await stato();
  const ore = (s.giorno - s0.giorno) * 24 + s.ore - s0.ore;
  annotaTempo(`aspetta fino a ${testo}${salta !== null ? ' (con il salto)' : ''}`, secondi, `${s0.ora} → ${s.ora}, ${ore.toFixed(2)} h di gioco${s.controllo !== 'seduta' ? ', interrotta' : ''}`);
  if (secondi > 6) throw new Error(`l'attesa «${testo}» è durata ${secondi.toFixed(1)} s (al più 5,5)`);
  return secondi;
}

async function alzati() {
  const s = await stato();
  if (s.controllo === 'seduta') {
    await premi('KeyC');
    await avanza(0.1);
  }
}

/** Squadro: pianta sul chiodo, livella con A/D, collima sul segnale con il cannocchiale. */
async function rileva(stazione, mira_) {
  await usa(`pianta_${stazione}`, { distanza: 1.2, tenere: 1.1 });
  let s = await stato();
  if (s.squadro.stato !== 'piantato') throw new Error(`squadro non piantato su ${stazione}: ${JSON.stringify(s.squadro)}`);
  for (let i = 0; i < 80 && !s.squadro.livellato; i++) {
    const tasto = s.squadro.bolla > 0 ? 'KeyD' : 'KeyA';
    const passo = Math.min(0.35, Math.abs(s.squadro.bolla) / 0.75);
    await tieni(tasto, Math.max(1 / 60, passo * 0.8));
    await avanza(0.15);
    s = await stato();
  }
  if (!s.squadro.livellato) throw new Error('la bolla non si centra');
  log(`  bolla in centro sul ${stazione}`);
  await R(() => window.__GAME__.holdKey('Mouse2', true));
  await avanza(0.1);
  await mira(`segnale_${mira_}`);
  await avanza(1.9);
}

async function staccaSquadro() {
  await R(() => window.__GAME__.holdKey('Mouse2', false));
  await avanza(0.1);
  await premi('KeyW');
  await avanza(0.2);
}

async function foto(nome, prepara) {
  if (!conFoto) return;
  if ((await stato()).dialogo) {
    // il testo del dialogo scritto tutto; lo sguardo finisce di voltarsi verso chi parla
    await R(() => window.__GAME__.regia.regia.ui.dialogo.completa());
    await avanza(0.8);
  }
  // dopo il dialogo: l'inquadratura della foto non la rigira più nessuno (si disegna senza passi)
  if (prepara) await prepara();
  await R(() => {
    const g = window.__GAME__;
    g.ensureLoaded();
    g.render();
  });
  // transizioni dell'interfaccia (carte, dialoghi, lente, velature): si aspetta che finiscano
  await attendi(150);
  await page
    .waitForFunction(
      () =>
        document.getAnimations().every((a) => {
          const it = a.effect?.getTiming().iterations;
          return a.playState !== 'running' || it === Infinity;
        }),
      null,
      { timeout: 3000, polling: 100 },
    )
    .catch(() => log(`  (animazioni ancora in corso per ${nome})`));
  await attendi(200);
  // Le foto documentano, non verificano: con la macchina carica (SwiftShader su CPU) possono
  // metterci molto; se non arrivano si annota e la prova continua.
  try {
    await page.screenshot({ path: join(cartellaFoto, `${nome}.png`), timeout: 120000 });
    log(`  📷 ${nome}.png`);
  } catch (e) {
    log(`  (foto ${nome} non riuscita: ${String(e?.message || e).split('\n')[0]})`);
  }
}

async function main() {
  if (!flag('no-build')) {
    console.log('build E2E (VITE_E2E=1)…');
    execSync('npm run build:e2e', { cwd: root, stdio: 'inherit' });
  }
  const port = 4600 + Math.floor(Math.random() * 300);
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

    // ============================================================== titolo
    log('— Titolo');
    await foto('00-titolo');
    await page.getByRole('button', { name: 'Nuova partita' }).click();
    await avanza(0.5);
    let s = await stato();
    if (s.fase !== 'gioco' || s.controllo !== 'sdraiata') throw new Error(`nuova partita: ${JSON.stringify(s)}`);
    log(`  nella capsula 5, ${s.ora}, giorno ${s.giorno}`);

    // ============================================================== prologo
    log('— P0.1 Il vetro');
    await avanza(2);
    await verifica('!flag:guardato_vetro', 'lo sguardo non è ancora sulla scritta');
    await mira('scritta_vetro');
    const tGuardo = await misuraFinche('passo:pr_vetro completato', 5, 1 / 60);
    // il coperchio si solleva: da quando la scritta è letta a quando si può dire «Alzati»
    annotaTempo('il coperchio della capsula si apre', await misuraFincheJs('r.cripta.coperchioAperto()', 6, 1 / 60));
    await avanza(Math.max(0, 1.7 - tGuardo));
    await verifica('flag:guardato_vetro e passo:pr_vetro completato', 'guardato il vetro');
    await foto('01-capsula-vetro');
    await premi('KeyE'); // Alzati
    await avanza(1.8);
    s = await stato();
    log(`  in piedi: ${s.controllo}, ${s.ora} (orologio fermo: ${s.fermo !== null})`);

    log('— P0.2 La Cripta');
    await usa('capsula_3', { distanza: 1.6 });
    await avanza(0.3);
    if ((await stato()).lettura) await leggi(); // la targa della Santa
    await usa('capsula_6', { distanza: 1.6 });
    await usa('serratura_5', { distanza: 1.0 });
    await usa('busta_5', { distanza: 1.0 });
    await avanza(0.3);
    await verifica('oggetto:lettera_marta', 'la busta «Per la mamma» presa');
    await usa('armadietto_5', { distanza: 1.1 });
    await avanza(0.5);
    await verifica('passo:pr_cripta completato e oggetto:squadro e oggetto:lente', "l'armadietto aperto, la borsa di Aurelio");
    await foto('02-cripta', () => R(() => {
      const r = window.__GAME__.regia;
      r.avvicina('capsula_2', 2.6);
      r.mira('capsula_5');
    }));
    // segreto §8.1: le buste delle capsule 6 e 7 con la lente
    await premi('KeyQ');
    await avvicina('busta_6', 1.2);
    await avanza(1.3);
    await avvicina('busta_7', 1.2);
    await avanza(1.3);
    await premi('KeyQ');
    await verifica('flag:lente:busta_6 e flag:lente:busta_7 e passo:sb_lente completato', 'segreto: le buste con la stessa «g»');

    log('— P0.3 La botola');
    await usa('scala', { distanza: 1.0 });
    await tieni('KeyW', 6.0);
    s = await stato();
    if (s.controllo !== 'scala') throw new Error(`sulla scala? ${s.controllo}`);
    await avanza(0.1);
    await premi('KeyE'); // Spingi la botola
    await avanza(0.5);
    s = await stato();
    log(`  fuori: ${s.luoghi.join(', ')}, ${s.ora}`);
    await verifica('passo:pr_botola_scala completato', 'la botola aperta, la Linea si accende');
    await R(() => window.__GAME__.regia.sguardo(150, 72));
    await avanza(1.8);
    await verifica('flag:guardato_in_su e passo:pr_guarda_su completato', 'guardato in su');
    await foto('03-il-lago-sopra');

    log('— P0.4 Camminare');
    await mira('muretto');
    await R(() => {
      const r = window.__GAME__.regia;
      const s0 = r.stato();
      return s0;
    });
    await tieni('KeyW', 9);
    s = await stato();
    log(`  camminato: fiato ${s.fiato.toFixed(2)}, luoghi ${s.luoghi.join(', ')}`);
    await usa('muretto', { distanza: 1.6 });
    await avanza(0.3);
    await verifica('flag:seduta e passo:pr_camminare completato', 'seduta sul muretto');

    log('— P0.5 La lettera');
    await premi('KeyE'); // Leggi la lettera (da seduta)
    await avanza(0.2);
    await foto('04-lettera-di-marta');
    await leggi();
    await verifica('flag:lettera_letta e passo:pr_lettera completato', 'la lettera letta fino in fondo');
    annotaTempo('dalla lettera chiusa alla voce delle campane', await misuraFinche('dialogo:d_meridiana_1 iniziato', 60, 1 / 60));
    await avanzaFinche('passo:bg_meta completato', 60);
    await verifica('flag:prima_meta_vista e taccuino:i_ombre_meta', 'la prima Meta');

    log('— P0.6 Le campane');
    await avanzaFinche('dialogo:d_meridiana_1 iniziato', 10);
    // Il salvataggio automatico scatta spesso a dialogo aperto: «Continua» deve riaprirlo
    // (prima restava aperto senza finestra e la storia si fermava qui).
    await R(() => window.__GAME__.regia.salva());
    await page.reload();
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 300000 });
    await R(() => window.__GAME__.stopLoop());
    await page.getByRole('button', { name: 'Continua' }).click();
    await avanza(3);
    s = await stato();
    if (!s.modali.dialogo || s.dialogo?.dialogo !== 'd_meridiana_1') throw new Error(`dopo «Continua» il dialogo delle campane non si è riaperto: ${JSON.stringify({ dialogo: s.dialogo, modali: s.modali })}`);
    log('  ✓ salvato a dialogo aperto, «Continua» lo riapre');
    // dopo «Continua» si comanda Elvira, non la camera libera del titolo, e lei sta su un piano
    const pc = await R(() => window.__GAME__.getPlayerState());
    if (pc.freeCamera || !pc.grounded) throw new Error(`dopo «Continua» Elvira non è controllabile: ${JSON.stringify({ freeCamera: pc.freeCamera, grounded: pc.grounded, mode: pc.mode })}`);
    log('  ✓ dopo «Continua» Elvira è a terra e la camera è la sua');
    await foto('05-meridiana', () => mira([1062, 37.2, 60]));
    log(`  risposte: ${(await dialogo()).join(' / ')}`);
    await verifica('missione:prologo completata e missione:m01_castagno_vuoto attiva', 'prologo completato');

    // ============================================================== missione 1, giorno 1
    log('— M1.1 La lente');
    await alzati();
    await premi('KeyQ');
    for (const p of ['lente_ricci', 'lente_amenti', 'lente_corteccia']) {
      await avvicina(p, 1.5);
      await avanza(1.3);
    }
    await foto('06-lente-castagno-morto', async () => {
      await avvicina('lente_ricci', 1.6);
      await avanza(0.1);
    });
    await premi('KeyQ');
    await verifica('passo:m1_lente completato e flag:ramo_vivo_trovato', 'diagnosi del castagno morto');

    log('— M1.2 La marza');
    await usa('ramo_vivo', { distanza: 1.4, tenere: 1.9 });
    await avanza(0.3);
    await verifica('passo:m1_marza completato', 'la marza tagliata');
    s = await stato();
    if (!s.modali.pianta) throw new Error('la Pianta doveva aprirsi da sola');
    await foto('07-pianta-selve');
    await page.keyboard.press('Escape');
    await avanza(0.2);

    log('— M1.3 La terrazza');
    await vai('terrazza_pedrazzini');
    await usa('cartellino', { distanza: 1.1 });
    await avanza(0.2);
    await leggi();
    await verifica('passo:m1_cartellino completato', 'il cartellino letto');

    log("— M1.4 L'innesto");
    await premi('KeyQ');
    await avvicina('lente_innesto_vecchio', 1.2);
    await avanza(1.3);
    await premi('KeyQ');
    for (let k = 0; k < 3; k++) {
      await usa('innesto', { distanza: 1.2, tenere: 1.6 });
      await avanza(0.2);
    }
    await verifica('flag:innesto_fatto e passo:m1_innesto completato', "l'innesto fatto in tre tempi");

    log('— M1.5 Il Velo');
    await vai('ripa_san_vigilio');
    await avanza(0.3);
    await R(() => {
      const g = window.__GAME__;
      const p = g.getPlayerState();
      // il salto dalla Ripa (12 m sopra la piazza): Elvira è già in aria sopra il ciglio
      g.teleport(p.z, p.theta, 13);
      g.lookAt(1046.5, 37.2, 34);
      g.startGlide(10);
    });
    for (let i = 0; i < 4; i++) {
      const p = await R(() => window.__GAME__.getPlayerState());
      log(`  volo: ${p.mode} velo ${p.veloOpen} h ${p.heightAboveGround.toFixed(1)} v ${p.speed.toFixed(1)} z ${p.z.toFixed(1)} θ ${p.theta.toFixed(2)}`);
      await avanza(0.3);
    }
    await foto('08-planata');
    for (let i = 0; i < 40; i++) {
      await avanza(0.5);
      const p = await R(() => window.__GAME__.getPlayerState());
      if (p.grounded) break;
    }
    await R(() => window.__GAME__.holdKey('Space', false));
    await avanza(0.5);
    s = await stato();
    log(`  atterrata: ${s.luoghi.join(', ')}`);
    if (!s.luoghi.includes('piazza_ore')) {
      await vai('piazza_ore');
      await avanza(0.3);
    }
    await verifica('flag:planata_fatta e passo:m1_velo completato', 'la prima planata, in piazza');

    log('— M1.6 I velati');
    // Togna arriva al lavatoio alle 07:00, Annunciata alle 09:00: si aspetta seduti
    await aspetta("fra un'ora");
    // la seconda volta, a metà il secondo X salta alla fine (sotto una dissolvenza)
    await aspetta("fra un'ora", { salta: 0.5 });
    while ((await stato()).ore < 9.1) await aspetta("fra un'ora");
    await alzati();
    for (const chi of ['togna', 'bortolo', 'annunciata']) {
      await usa(`png_${chi}`, { distanza: 1.8 });
      await avanza(0.2);
      if (chi === 'togna') await foto('09-togna-al-lavatoio', () => inquadra('togna', 3.4));
      log(`  ${chi}: ${(await dialogo()).join(' / ')}`);
    }
    await verifica('contatore:velati>=3 e passo:m1_velati completato', 'tre velati');

    log('— M1.7 Il Messo');
    await vai('piazza_ore');
    annotaTempo('Ottavio scende in piazza e parla', await misuraFinche('dialogo:d_ottavio_incontro iniziato', 40));
    await foto('10-ottavio', () => inquadra('ottavio', 3.6));
    log(`  ottavio: ${(await dialogo()).length} risposte`);
    await verifica('passo:m1_ottavio completato e flag:aspetta_brace_sbloccato', 'Ottavio, il Messo');

    log('— M1.8 La brace');
    // Esc nel menu dell'attesa lo chiude e basta (prima apriva anche la pausa)
    await premi('KeyX');
    if (!(await R(() => !!document.querySelector('.regia-attesa')))) throw new Error('X non ha aperto il menu dell\'attesa');
    await page.keyboard.press('Escape');
    await attendi(60);
    await avanza(0.05);
    s = await stato();
    if (s.modali.pausa || (await R(() => !!document.querySelector('.regia-attesa'))) || s.controllo !== 'seduta') throw new Error(`Esc nel menu dell'attesa: ${JSON.stringify({ pausa: s.modali.pausa, controllo: s.controllo })}`);
    log('  ✓ Esc chiude il menu dell\'attesa, senza la pausa');
    // appena chiuso il dialogo con Ottavio, un Invio in più e Spazio a menu aperto
    await aspetta('la brace', { foto: '10b-attesa-della-brace', tastiInCoda: true });
    await verifica('passo:m1_brace completato', 'la brace');

    log("— M1.9 L'Ombrista");
    await alzati();
    await vai('telo_ombrista');
    await avanza(0.2);
    await R(() => window.__GAME__.regia.sguardo(0, 5));
    // dopo la brace: «aspetta fino a: l'Ombrista (19:45)» (prima 25 s in piedi davanti al telo)
    await aspetta("l'Ombrista");
    annotaTempo("dalla brace all'Ombrista, davanti al telo (la scena parte)", await misuraFincheJs('r.ponte.letturaAperta !== null', 30));
    await avanza(0.5);
    s = await stato();
    if (!s.lettura) throw new Error(`la scena dell'Ombrista doveva partire: ${JSON.stringify(s)}`);
    await foto('11-ombrista');
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('ArrowRight');
      await attendi(120);
    }
    await page.keyboard.press('Escape');
    await avanza(0.5);
    await verifica('flag:ombrista_1_vista e passo:m1_ombrista completato', "l'Ombrista vista");

    log('— M1.10 Il fienile');
    await vai('passerella_messo');
    await avanza(1.5);
    await verifica('variante:E1=Abitata', 'Ottavio ha buttato le assi sul riale');
    // al fienile dalla parte della porta (il centro del luogo è dentro il fienile)
    await avvicina('fienile', 1.2);
    await avanza(1);
    await verifica('passo:m1_fienile completato', 'al fienile');

    log('— M1.11 La notte');
    annotaTempo('al fienile: Ottavio comincia a parlare', await misuraFinche('dialogo:d_ottavio_fienile iniziato', 40));
    await foto('12-fienile-notte', () =>
      R(() => {
        // dalla parte opposta al fienile, così i muri non si mettono in mezzo
        const G = window.__GAME__.regia;
        const o = G.regia.abitanti.posizione('ottavio');
        if (!o) return;
        const mpd = (646 * Math.PI) / 180;
        const dz = o.z - 1176;
        const ds = (o.theta - 58.5) * mpd;
        const d = Math.hypot(dz, ds) || 1;
        G.regia.vai(o.z + (dz / d) * 4.2, o.theta + ((ds / d) * 4.2) / mpd);
        G.avanza(0.05);
        G.mira([o.z, o.theta, o.h + 0.35]);
      }),
    );
    log(`  risposte: ${(await dialogo()).join(' / ')}`);
    await avanza(1);
    s = await stato();
    log(`  sveglia: giorno ${s.giorno}, ${s.ora}`);
    await verifica('giorno:2 e passo:m1_notte completato', 'la prima notte passata dormendo');

    // ============================================================== giorno 2
    log('— M1.12 Il mattino');
    await avanza(0.5);
    s = await stato();
    if (!s.modali.pianta) throw new Error('la Pianta doveva aprirsi sul resoconto');
    await foto('13-resoconto-del-mattino');
    await page.keyboard.press('Escape');
    await avanza(0.5);
    annotaTempo('il mattino: Ottavio comincia a parlare', await misuraFinche('dialogo:d_ottavio_mattino iniziato o dialogo:d_ottavio_mattino_salvata iniziato', 40));
    log(`  ottavio: ${(await dialogo()).join(' / ')}`);
    await verifica('passo:m1_mattino completato e flag:taccuino_spostato', 'il mattino: la passerella non c\'è più');

    log('— M1.13 Il ritorno');
    await vai('guado_sass');
    await avanza(0.5);
    await vai('piazza_ore');
    await avanza(0.5);
    await verifica('passo:m1_ritorno completato', 'tornata in piazza dal guado');

    log('— M1.14 Il dono');
    // alla Bacheca prima delle 7: il pannello dice quando arriva la novizia e il menu la nomina
    await vai('bacheca_ore');
    await avanza(0.5);
    if ((await stato()).ore < 7) await aspetta('07:00');
    annotaTempo('alla Bacheca: la novizia comincia a parlare', await misuraFinche('dialogo:d_clelia_dono iniziato', 40));
    log(`  clelia: ${(await dialogo()).join(' / ')}`);
    await avanza(0.3);
    if ((await stato()).lettura) await leggi();
    await verifica('passo:m1_dono completato e oggetto:velo_nero', 'il dono della Madre');
    await alzati();

    log('— M1.15 Il campanile');
    // il campanaro arriva sul sagrato alle 08:00 (prima la prova aspettava in piedi, 55 s)
    if ((await stato()).ore < 8) {
      await aspetta('08:00');
      annotaTempo('alle 08:00 il campanaro è sul sagrato', await misuraFincheJs("r.abitanti.presente('bortolo')", 10, 1 / 60));
      await alzati();
    }
    await avanza(0.5);
    await usa('png_bortolo', { distanza: 1.8 });
    log(`  bortolo: ${(await dialogo()).join(' / ')}`);
    await verifica('flag:campanile_aperto', 'Bortolo apre il campanile');
    await usa('porta_campanile', { distanza: 2.0 });
    await avanza(0.4);
    await usa('targa_p1', { distanza: 1.3 });
    await avanza(0.2);
    await foto('14-targa-pilastro-1');
    await leggi();
    await verifica('passo:m1_campanile completato', 'la targa del Pilastro 1');

    log('— M1.16 Il libretto');
    await premi('KeyL');
    await avanza(2.5);
    await foto('15-libretto-cs1');
    await page.keyboard.press('Escape');
    await avanza(0.3);
    await verifica('flag:libretto_cs1_letto e passo:m1_libretto completato', 'la monografia CS 1');
    await usa('scendi_campanile', { distanza: 1.2 });
    await avanza(0.3);

    log('— M1.17 Il chiodo 2');
    await rileva('cs_2', 'cs_1');
    await foto('16-cannocchiale-tasso');
    await staccaSquadro();
    await verifica('flag:tentato_lato:2-1 e passo:m1_chiodo2 completato', 'il tasso copre il Pilastro 1');

    log('— M1.18 Il primo rilievo');
    await vai('terrazza_pedrazzini');
    await rileva('cs_3', 'cs_1');
    await R(() => window.__GAME__.holdKey('Mouse2', false));
    await avanza(1.0);
    await foto('17-primo-rilievo');
    await staccaSquadro();
    await avanza(2);
    await verifica('cella:2214 rilevata e passo:m1_primo_rilievo completato e flag:primo_rilievo', 'il primo rilievo: lato 1-3');

    log('— M1.19 La strada del Messo');
    await vai('prato_ronco');
    await avanza(0.3);
    await premi('KeyG'); // il fischio
    annotaTempo('il fischio: Ottavio scende dal cielo', await misuraFincheJs("r.abitanti.presente('ottavio') && r.abitanti.modoOttavio === 'fermo'", 20));
    await avanza(0.3);
    await usa('png_ottavio', { distanza: 1.8 });
    log(`  ottavio: ${(await dialogo()).join(' / ')}`);
    await verifica('dialogo:d_ottavio_strada finito e variante:E1=Abitata', 'la passerella rimessa con Ottavio');
    await vai('mulino');
    await rileva('cs_7', 'cs_8');
    await staccaSquadro();
    await avanza(2);
    await verifica('cella:2797 rilevata e cella:2798 rilevata e passo:m1_strada completato', 'il lato 7-8: la passerella misurata');
    await foto('18-passerella-rilevata', () => R(() => {
      const r = window.__GAME__.regia;
      r.vai(1150, 49.5);
      r.mira([1163, 51.9, 2]);
    }));

    log('— M1.20 La seconda notte');
    // davanti alla porta del fienile (il centro del luogo è dentro il fienile), con i piedi per
    // terra: X fa sedere solo lì
    await avvicina('dormi', 2.5);
    await avanza(1);
    // salvataggio e «Continua» a metà attesa: si riparte dall'ora di quel momento, in piedi
    {
      await premi('KeyX');
      if ((await stato()).controllo !== 'seduta') throw new Error(`X in piedi non ha fatto sedere Elvira: ${JSON.stringify(await R(() => window.__GAME__.getPlayerState()))}`);
      const voci = await page.$$eval('.regia-attesa button', (bs) => bs.map((b) => b.textContent));
      log(`  il menu dell'attesa alle ${(await stato()).ora}: ${voci.join(' / ')}`);
      const i = voci.findIndex((v) => v.includes('20:30'));
      if (i < 0) throw new Error(`manca «le 20:30» fra ${JSON.stringify(voci)}`);
      await page.keyboard.press(String(i + 1));
      await attendi(30);
      await avanza(1.5);
      const meta = await stato();
      if (!(await R(() => window.__GAME__.regia.regia.orologio.inAttesa))) throw new Error('l\'attesa delle 20:30 non corre');
      await foto('18b-attesa-fino-alle-20-30');
      await R(() => window.__GAME__.regia.salva());
      log(`  salvato a metà attesa: giorno ${meta.giorno}, ${meta.ora}`);
      await page.reload();
      await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 300000 });
      await R(() => window.__GAME__.stopLoop());
      await page.getByRole('button', { name: 'Continua' }).click();
      await avanza(1);
      const dopo = await stato();
      const inAttesa = await R(() => window.__GAME__.regia.regia.orologio.inAttesa);
      const menu = await page.$$eval('.regia-attesa', (x) => x.length);
      // l'orologio a schermo si aggiorna disegnando
      await R(() => window.__GAME__.render());
      const orologio = await page.$eval('.ui-or-ora', (e) => e.textContent);
      const minuti = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
      if (dopo.giorno !== meta.giorno || Math.abs(dopo.ore - meta.ore) > 0.1 || inAttesa || menu || dopo.controllo !== 'libero') {
        throw new Error(`«Continua» dopo un salvataggio a metà attesa: ${JSON.stringify({ meta: meta.ora, dopo: dopo.ora, inAttesa, menu, controllo: dopo.controllo })}`);
      }
      if (Math.abs(minuti(orologio) - minuti(dopo.ora)) > 1) throw new Error(`l'orologio a schermo dice ${orologio}, la storia ${dopo.ora}`);
      log(`  ✓ «Continua» a metà attesa: ${dopo.ora}, in piedi, l'orologio dice ${orologio}`);
    }
    // di nuovo, fino in fondo
    await aspetta('20:30');
    if ((await stato()).ore < 20.49) throw new Error(`dopo l'attesa sono le ${(await stato()).ora}`);
    // finita l'attesa si salva l'ora d'arrivo
    await avanza(1.5);
    {
      const ultimo = await R(async () => {
        const el = await window.__GAME__.regia.regia.salvataggi.elenco();
        return el.filter((x) => x.stato === 'valido').sort((a, b) => (b.contatore ?? 0) - (a.contatore ?? 0))[0]?.meta?.descrizione ?? '';
      });
      if (!/20:3\d/.test(ultimo)) throw new Error(`il salvataggio dopo l'attesa dice «${ultimo}»`);
      log(`  ✓ salvato dopo l'attesa: ${ultimo}`);
    }
    await alzati();
    await usa('dormi', { distanza: 2.5 });
    await avanza(1);
    await verifica('giorno:3 e passo:m1_seconda_notte completato', 'la seconda notte');

    // ============================================================== giorno 3
    log('— M1.21 La prova');
    await avanza(0.5);
    if ((await stato()).modali.pianta) {
      await foto('19-resoconto-notte-2');
      await page.keyboard.press('Escape');
      await avanza(0.3);
    }
    await verifica('variante:E1=Abitata', 'la passerella è rimasta');
    await vai('passerella_messo');
    annotaTempo('alla passerella: Ottavio comincia a parlare', await misuraFinche('dialogo:d_ottavio_prova iniziato', 40));
    log(`  ottavio: ${(await dialogo()).join(' / ')}`);
    await verifica('passo:m1_prova completato e taccuino:i_legge_1', 'la prima legge');

    log('— M1.22 La lettera di Rosa');
    annotaTempo('Ottavio porta la lettera di Rosa', await misuraFinche('dialogo:d_ottavio_gancio iniziato', 40));
    log(`  ottavio: ${(await dialogo()).join(' / ')}`);
    await avanza(0.5);
    await verifica('missione:m01_castagno_vuoto completata e flag:gioco_libero', 'missione 1 completata');
    await foto('21-gioco-libero', () => R(() => {
      const r = window.__GAME__.regia;
      r.sguardo(160, 55);
    }));

    // salvataggio e «Continua»
    await R(() => window.__GAME__.regia.salva());
    const voci = await R(() => window.__GAME__.regia.regia.narrativa.taccuino.voci().length);
    log(`Taccuino: ${voci} voci. Salvataggio fatto.`);
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
  writeFileSync(join(cartellaFoto, 'e2e.json'), JSON.stringify({ data: new Date().toISOString(), esito, secondi: Math.round((Date.now() - t0) / 1000), tempiAttese, passi: diarioProva, errori: errori.slice(0, 50) }, null, 2));
  console.log(`prova ${esito} in ${Math.round((Date.now() - t0) / 1000)} s`);
  await browser.close();
  server.close();
  if (esito !== 'ok' || errori.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
