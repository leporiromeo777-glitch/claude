#!/usr/bin/env node
/**
 * Le porte della Fase 1 a piedi (migliorie «porte»), nel browser con la build E2E: la partita vera
 * dall'inizio, la Cripta lasciata salendo la scala e spingendo la botola (W, E), poi per ogni porta
 * della Fase 1 (campanile, San Vigilio, fienile di Ottavio, Casa del Velo, mulino, capanno dei Messi,
 * casa di Nando) si parte a 7 m davanti (3 m per il capanno, che sta su un ripiano), e poi a 4 m di
 * sbieco (±40°), si cammina con W guardando il battente fino alla soglia e si torna indietro: la porta
 * si vede, si raggiunge, non si resta incastrati. Se la porta ha una scaletta e dritti non si arriva,
 * si prova come farebbe chi gioca: prima al piede della scaletta, poi su. Dalla botola si va a piedi
 * al muretto del belvedere, e alla botola si torna da cinque metri da otto parti. Le stesse porte si
 * fotografano di giorno e di notte (il giro di tutte le porte: `scripts/porte-schermate.mjs`).
 *
 *   node scripts/porte-a-piedi.mjs [--no-build] [--out=test-results/porte/a-piedi] [--tutte]
 *
 * L'inventario delle porte lo fa la verifica nel browser (`regia.verificaPorte()`: il paese del
 * browser non è identico a quello di Node), e se una porta è difettosa lo script esce con 1; con
 * `--json=…` si usa invece un inventario di `scripts/verifica-porte.ts`. Con `--tutte` si cammina
 * fino a tutte le porte a terra (da 7 m dritti e da 4 m a ±40°), non solo a quelle della Fase 1;
 * con `--tutte --solo-scalette` solo a quelle con la scaletta.
 *
 * Esce con codice 1 se una porta non si raggiunge o ci si incastra.
 */
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.some((a) => a === `--${n}` || a.startsWith(`--${n}=`));
const valore = (n, d) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1] ?? d;
const json = resolve(valore('json', join(root, 'test-results/porte/inventario.json')));
const out = resolve(valore('out', join(root, 'test-results/porte/a-piedi')));
const [W, H] = valore('size', '960x540').split('x').map(Number);
mkdirSync(out, { recursive: true });
const CHROMIUM_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

/** le porte della Fase 1 e da quanti metri si parte */
const PORTE = [
  ['campanile:porta', 7],
  ['san_vigilio:portale', 7],
  ['fienile_ottavio:porta', 7],
  ['casa_del_velo:porta', 7],
  ['mulino:porta', 7],
  ['balcone_messi:porta', 3],
  ['casa_nando:porta', 7],
];

/** il bersaglio che la porta deve offrire dalla soglia */
const BERSAGLI = { 'campanile:porta': 'porta_campanile' };

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
const log = (t) => {
  diario.push(t);
  console.log(t);
};
const R = (fn, arg) => page.evaluate(fn, arg);
const stato = () => R(() => window.__GAME__.regia.stato());
const vale = (c) => R((x) => window.__GAME__.regia.regia.narrativa.valuta(x), c);
const avanza = (s) => R((x) => window.__GAME__.regia.avanza(x), s);
const premi = (c) => R((x) => window.__GAME__.regia.premi(x), c);
const tieni = (c, s) => R(([a, b]) => window.__GAME__.regia.tieni(a, b), [c, s]);
const avvicina = (id, d) => R(([a, b]) => window.__GAME__.regia.avvicina(a, b), [id, d]);
const mira = (id) => R((a) => window.__GAME__.regia.mira(a), id);
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

/** distanza orizzontale (m) fra due punti (z, θ) alla quota h */
const dist = (a, b, h = 40) => Math.hypot(a.z - b.z, ((((a.theta - b.theta + 540) % 360) - 180) * Math.PI * (646 - h)) / 180);

/** Foto della vista del giocatore (il canvas, senza interfaccia). */
async function foto(nome) {
  const data = await R(() => {
    const g = window.__GAME__;
    g.ensureLoaded();
    g.render();
    return g.game.renderer.domElement.toDataURL('image/jpeg', 0.82);
  });
  writeFileSync(join(out, `${nome}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
}

async function usa(id, distanza = 1.3, tenere = 0) {
  await avvicina(id, distanza);
  await avanza(0.1);
  const s = await stato();
  if (s.bersaglio !== id) throw new Error(`bersaglio atteso «${id}», scelto «${s.bersaglio}»`);
  if (tenere) await tieni('KeyE', tenere);
  else await premi('KeyE');
}

async function leggi() {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('PageDown');
    await attendi(200);
    await avanza(0.3);
  }
  await avanza(1.3);
  await page.keyboard.press('Escape');
  await attendi(60);
  await avanza(0.3);
}

/**
 * Cammina con W verso `meta` (z, θ) guardando `occhio` (z, θ, h) finché si arriva a `raggio` m o ci
 * si ferma (meno di 5 cm in un secondo). Restituisce la distanza finale e i secondi.
 */
async function cammina(meta, occhio, raggio, max = 12) {
  let t = 0;
  let ultimo = Infinity;
  let fermo = 0;
  let d = Infinity;
  while (t < max) {
    await mira([occhio.z, occhio.theta, occhio.h]);
    await tieni('KeyW', 0.2);
    t += 0.2;
    const s = await stato();
    d = dist(s.posizione, meta, s.posizione.h);
    if (d < raggio) break;
    if (ultimo - d < 0.01) fermo += 0.2;
    else fermo = 0;
    if (fermo >= 1) break;
    ultimo = d;
  }
  return { d, t };
}

/** (z, θ) a `d` m davanti alla soglia della porta `p` dell'inventario e `l` m di lato. */
function davantiA(p, d, l = 0) {
  const s0 = p.davanti.soglia;
  const a3 = p.davanti.a3;
  const mpd = (Math.PI * (646 - s0.h)) / 180;
  let nz = a3.z - s0.z;
  let ne = (a3.theta - s0.theta) * mpd;
  const L = Math.hypot(nz, ne);
  nz /= L;
  ne /= L;
  // (la soglia di `davanti.soglia` sta a 0,6 m dal muro)
  return { z: s0.z + nz * (d - 0.6) - ne * l, theta: s0.theta + (ne * (d - 0.6) + nz * l) / mpd, h: s0.h };
}

async function main() {
  const daJson = flag('json');
  if (daJson && !existsSync(json)) throw new Error(`manca l'inventario ${json}: npx tsx scripts/verifica-porte.ts --json=${json}`);
  let inv = daJson ? JSON.parse(readFileSync(json, 'utf8')) : null;
  let perId = new Map((inv?.porte ?? []).map((p) => [p.id, p]));
  if (!flag('no-build')) execSync('npm run build:e2e', { cwd: root, stdio: 'inherit' });
  const port = 4900 + Math.floor(Math.random() * 300);
  const server = await serve(join(root, 'dist-e2e'), port);
  const browser = await chromium.launch({ headless: true, args: CHROMIUM_ARGS });
  page = await browser.newPage({ viewport: { width: W, height: H } });
  const errori = [];
  page.on('pageerror', (e) => errori.push(String(e)));
  let esito = 0;
  try {
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 300000 });
    await R(() => {
      window.__GAME__.stopLoop();
      window.__GAME__.setSetting('qualita', 'media');
    });
    // l'inventario e la verifica delle porte nel mondo del browser
    if (!inv) {
      inv = await R(() => window.__GAME__.regia.verificaPorte());
      perId = new Map(inv.porte.map((p) => [p.id, p]));
      writeFileSync(join(out, 'inventario-browser.json'), JSON.stringify(inv, null, 1));
      const difettose = inv.porte.filter((p) => p.difetti.length);
      log(`— Verifica delle porte nel browser: ${inv.porte.length} porte, difettose ${difettose.length}`);
      for (const p of difettose) log(`  ✗ ${p.id}: ${p.difetti.join(', ')} ${p.ostacolo ?? ''} ${p.note.join('; ')}`);
      if (difettose.length) esito = 1;
    }
    await page.getByRole('button', { name: 'Nuova partita' }).click();
    await avanza(0.5);

    // ------------------------------------------------ la Cripta: fuori dalla botola a piedi
    log('— La Cripta e la botola (da dentro)');
    await mira('scritta_vetro');
    await avanza(4.2);
    await premi('KeyE');
    await avanza(1.8);
    await usa('capsula_3', 1.6);
    await avanza(0.3);
    if ((await stato()).lettura) await leggi();
    await usa('capsula_6', 1.6);
    await usa('serratura_5', 1.0);
    await usa('busta_5', 1.0);
    await avanza(0.3);
    await usa('armadietto_5', 1.1);
    await avanza(0.5);
    if (!(await vale('passo:pr_cripta completato'))) throw new Error('la Cripta: armadietto non aperto');
    await usa('scala', 1.0);
    await tieni('KeyW', 6.0);
    let s = await stato();
    log(`  sulla scala con W: controllo «${s.controllo}», bersaglio «${s.bersaglio}»`);
    await foto('cripta-botola-da-dentro');
    await avanza(0.1);
    await premi('KeyE');
    await avanza(0.5);
    s = await stato();
    const fuori = await vale('passo:pr_botola_scala completato');
    log(`  ${fuori ? '✓' : '✗'} spinta la botola con E: fuori (${s.luoghi.join(', ')})`);
    if (!fuori) esito = 1;
    await R(() => window.__GAME__.regia.sguardo(150, 72));
    await avanza(1.8);
    await R(() => window.__GAME__.regia.impostaOra(1, 10));
    await avanza(0.2);

    // ------------------------------------------------ la botola da fuori: al muretto e ritorno
    // (come nella Fase 1: dalla botola si va al muretto del belvedere; poi si torna alla botola)
    log('— La botola da fuori: dalla botola al muretto del belvedere e ritorno, a piedi');
    const botola = await R(() => window.__GAME__.regia.posizione('botola'));
    const muretto = await R(() => window.__GAME__.regia.posizione('muretto'));
    if (botola && muretto) {
      const b = { z: botola[0], theta: botola[1], h: botola[2] };
      const m = { z: muretto[0], theta: muretto[1], h: muretto[2] };
      s = await stato();
      const d0 = dist(s.posizione, m, s.posizione.h);
      const andata = await cammina(m, { ...m, h: m.h + 0.4 }, 1.4, 25);
      s = await stato();
      const okA = andata.d < 2.6 && s.bersaglio === 'muretto';
      log(`  ${okA ? '✓' : '✗'} dalla botola al muretto (${d0.toFixed(1)} m): resta ${andata.d.toFixed(2)} m in ${andata.t.toFixed(1)} s, bersaglio «${s.bersaglio}»`);
      await foto('botola-dal-muretto');
      // ritorno: dal muretto in su ci sono i gradoni del versante (la strada è quella della Cripta,
      // provata nei test in Node); qui si torna alla botola da 5 m, da otto parti
      const mpd = (Math.PI * (646 - b.h)) / 180;
      let fatte = 0;
      for (let a = 0; a < 360; a += 45) {
        const y = (a * Math.PI) / 180;
        await R(([z, t]) => window.__GAME__.regia.vai(z, t), [b.z + Math.cos(y) * 5, b.theta + (Math.sin(y) * 5) / mpd]);
        await avanza(0.2);
        const r = await cammina(b, { ...b, h: b.h + 0.2 }, 1.6, 10);
        s = await stato();
        if (r.d < 2.6 && s.bersaglio === 'botola') fatte++;
        if (a === 0) await foto('botola-vicina');
      }
      const okR = fatte >= 4;
      log(`  ${okR ? '✓' : '✗'} alla botola da 5 m: arrivati da ${fatte} parti su 8 (bersaglio «Scendi nella Cripta»)`);
      if (!okA || !okR) esito = 1;
    } else log(`  ✗ botola o muretto non trovati (${JSON.stringify({ botola, muretto })})`);

    // ------------------------------------------------ le porte della Fase 1
    /**
     * Da `partenza` alla soglia della porta `p` con W (guardando il battente); se non si arriva e la
     * porta ha una scaletta, prima al piede della scaletta e poi su. Poi indietro verso `partenza`.
     */
    const allaPorta = async (p, partenza, etichetta, foto0) => {
      await R(([z, t]) => window.__GAME__.regia.vai(z, t), [partenza.z, partenza.theta]);
      await avanza(0.3);
      await mira([p.battente.z, p.battente.theta, p.battente.h]);
      await avanza(0.05);
      if (foto0) await foto(foto0);
      let r = await cammina(p.davanti.soglia, p.battente, 0.45);
      let via = '';
      if (r.d >= 0.45 && p.scaletta) {
        const u = p.scaletta.uscita;
        await cammina(u, { ...u, h: u.h + 1.2 }, 0.6, 10);
        r = await cammina(p.davanti.soglia, p.battente, 0.45);
        via = ' (dal piede della scaletta)';
      }
      s = await stato();
      const dh = s.posizione.h - p.soglia.h;
      const arrivata = r.d < 0.45 && Math.abs(dh) < 0.35;
      return { arrivata, r, dh, via, etichetta };
    };
    const tutte = async (ora, aPiedi) => {
      for (const [id, da] of PORTE) {
        const p = perId.get(id);
        if (!p) {
          log(`  ✗ ${id}: non è nell'inventario`);
          esito = 1;
          continue;
        }
        const nome = id.replace(':', '-');
        const partenza = da === 3 ? p.davanti.a3 : p.davanti.a7;
        // la casa di Nando: Abitata (E2), quella con la porta al muro
        if (id === 'casa_nando:porta') await R(() => window.__GAME__.regia.regia.corbella.setVariante('E2', 'Abitata'));
        if (!aPiedi) {
          await R(([z, t]) => window.__GAME__.regia.vai(z, t), [partenza.z, partenza.theta]);
          await avanza(0.3);
          await mira([p.battente.z, p.battente.theta, p.battente.h]);
          await avanza(0.05);
          await foto(`${nome}-${ora}-da-${da}m`);
          continue;
        }
        const r0 = await allaPorta(p, partenza, `da ${da} m`, `${nome}-${ora}-da-${da}m`);
        await foto(`${nome}-${ora}-soglia`);
        // il bersaglio della porta, se ne ha uno (la porta del campanile: «chiusa» o «Sali»)
        let bersaglio = '';
        if (BERSAGLI[id]) {
          await mira(BERSAGLI[id]);
          await avanza(0.1);
          bersaglio = (await stato()).bersaglio ?? '—';
          await foto(`${nome}-${ora}-bersaglio`);
        }
        // e indietro: si guarda il punto di partenza e si cammina
        const indietro = await cammina(partenza, { ...partenza, h: partenza.h + 1.6 }, 0.6, 8);
        const s2 = await stato();
        const allontanata = dist(s2.posizione, p.davanti.soglia, s2.posizione.h);
        const ok = r0.arrivata && allontanata > da - 0.6 - 1 && (!BERSAGLI[id] || bersaglio === BERSAGLI[id]);
        log(
          `  ${ok ? '✓' : '✗'} ${id}: da ${da} m alla soglia in ${r0.r.t.toFixed(1)} s${r0.via} (resta ${r0.r.d.toFixed(2)} m, quota ${r0.dh >= 0 ? '+' : ''}${r0.dh.toFixed(2)} m)${bersaglio ? `, bersaglio «${bersaglio}»` : ''}; indietro ${allontanata.toFixed(1)} m in ${indietro.t.toFixed(1)} s`,
        );
        if (!ok) esito = 1;
        // di sbieco, da 4 m a ±40° (come chi arriva da un vicolo di lato)
        if (da > 3) {
          for (const a of [40, -40]) {
            const y = (a * Math.PI) / 180;
            const r = await allaPorta(p, davantiA(p, 4 * Math.cos(y), 4 * Math.sin(y)), `da 4 m a ${a}°`);
            log(`    ${r.arrivata ? '✓' : '✗'} ${id} ${r.etichetta}: resta ${r.r.d.toFixed(2)} m, quota ${r.dh >= 0 ? '+' : ''}${r.dh.toFixed(2)} m${r.via}`);
            if (!r.arrivata) esito = 1;
          }
        }
      }
    };
    log('— Le porte della Fase 1 a piedi (giorno, ore 10)');
    await tutte('giorno', true);
    log('— Le stesse porte di notte (ore 22)');
    await R(() => window.__GAME__.regia.impostaOra(1, 22));
    await avanza(0.2);
    await tutte('notte', false);
    if (flag('tutte')) {
      // tutte le porte a terra, di giorno: da 7 m dritti e da 4 m a ±40° (con la scaletta, se serve)
      await R(() => window.__GAME__.regia.impostaOra(1, 10));
      await avanza(0.2);
      const aTerra = inv.porte.filter((p) => p.appoggio === 'suolo' && !p.variante && (!flag('solo-scalette') || p.scaletta));
      log(`— Tutte le porte a terra a piedi (${aTerra.length})`);
      let fatte = 0;
      const mancate = [];
      for (const p of aTerra) {
        const prove = [];
        for (const [d, a] of [[7, 0], [4, 40], [4, -40]]) {
          const y = (a * Math.PI) / 180;
          const r = await allaPorta(p, davantiA(p, d * Math.cos(y), d * Math.sin(y)), `${d} m ${a}°`);
          prove.push(r);
        }
        const ok = prove.filter((r) => r.arrivata).length;
        if (ok === prove.length) fatte++;
        else mancate.push(`${p.id} (${prove.filter((r) => !r.arrivata).map((r) => `${r.etichetta}: resta ${r.r.d.toFixed(2)} m, quota ${r.dh.toFixed(2)}`).join('; ')})`);
      }
      log(`  porte raggiunte da tutte e tre le partenze: ${fatte} su ${aTerra.length}`);
      for (const m of mancate) log(`  · ${m}`);
    }

    log(`foto in ${out}`);
  } catch (e) {
    esito = 1;
    log(`✗ ${e?.stack || e}`);
  } finally {
    if (errori.length) log(`errori della pagina: ${errori.slice(0, 5).join(' | ')}`);
    writeFileSync(join(out, 'diario.txt'), diario.join('\n') + '\n');
    await browser.close();
    server.close();
  }
  log(esito ? 'porte a piedi: qualcosa non va' : 'porte a piedi: ok');
  process.exit(esito);
}

main();
