// Prova temporanea: i casi peggiori del percorso (NON committare).
import { avvia } from './_prova-base.mjs';

const casi = process.argv.slice(2);
const vuoi = (c) => !casi.length || casi.includes(c);
let fallite = 0;
const ok = (cond, msg, extra) => {
  if (!cond) fallite++;
  console.log(`${cond ? '  ✓' : '  ✗'} ${msg}${extra !== undefined ? ` ${JSON.stringify(extra)}` : ''}`);
};

async function nuova() {
  const ctx = await avvia();
  await ctx.page.getByRole('button', { name: 'Nuova partita' }).click();
  await ctx.R(() => window.__GAME__.regia.avanza(0.5));
  // aiuti per le prove: salta la storia fino a un passo (completandola a forza), chiude i modali
  await ctx.R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.chiudiTutto = () => {
      r.dialoghi.svuota();
      for (const k of ['lettore', 'pianta', 'taccuino']) if (r.ui[k].visible) r.ui[k].hide();
      r.ponte.chiudiAttesa();
    };
    G.segnaFiniti = (...ids) => {
      const st = r.narrativa.dialoghi.esporta();
      st.finiti = [...new Set([...st.finiti, ...ids])];
      r.narrativa.dialoghi.importa(st);
    };
    G.saltaA = (passo) => {
      const n = r.narrativa;
      for (let i = 0; i < 80; i++) {
        const attivi = n.missioni.passiAttivi().filter((a) => a.missione === 'prologo' || a.missione === 'm01_castagno_vuoto');
        if (attivi.some((a) => a.passo === passo)) break;
        const a = attivi[0];
        if (!a) break;
        n.missioni.completaPasso(a.missione, a.passo);
        n.tick(0);
        G.chiudiTutto();
      }
      if (r.controllo.tipo === 'sdraiata') {
        r.controllo = { tipo: 'libero' };
      }
      G.avanza(0.2);
      G.chiudiTutto();
      return n.missioni.passiAttivi().map((a) => a.passo);
    };
  });
  return ctx;
}

// ------------------------------------------------------------------ prologo
if (vuoi('vetro')) {
  console.log('— lo sguardo nella capsula: senza toccare il mouse');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    let t = 0;
    while (t < 40 && !G.regia.narrativa.flag.vero('guardato_vetro')) {
      G.avanza(0.5);
      t += 0.5;
    }
    return { t, flag: G.regia.narrativa.flag.vero('guardato_vetro') };
  });
  ok(s.flag && s.t <= 16, 'lo sguardo scivola sulla scritta da solo entro 16 s', s);
  await fine();
}

if (vuoi('botola')) {
  console.log('— la botola prima della busta e dell\'armadietto');
  const { R, fine } = await nuova();
  await R(() => window.__GAME__.regia.mira('scritta_vetro'));
  await R(() => window.__GAME__.regia.avanza(4.5));
  await R(() => window.__GAME__.regia.premi('KeyE'));
  await R(() => window.__GAME__.regia.avanza(2));
  await R(() => window.__GAME__.regia.avvicina('scala', 1.0));
  await R(() => window.__GAME__.regia.avanza(0.1));
  await R(() => window.__GAME__.regia.premi('KeyE'));
  const sc = await R(() => {
    const G = window.__GAME__.regia;
    G.avanza(0.1);
    const ind = G.regia.percorso.indicazione;
    G.tieni('KeyW', 6.5);
    G.avanza(0.1);
    return { ind, controllo: G.stato().controllo, bersaglio: G.stato().bersaglio };
  });
  ok(sc.ind?.tasto === 'W', 'sulla scala: «W — Sali la scala»', sc.ind);
  await R(() => window.__GAME__.regia.premi('KeyE'));
  const s = await R(() => {
    const G = window.__GAME__.regia;
    G.avanza(0.5);
    return { interno: G.stato().interno, controllo: G.stato().controllo };
  });
  ok(s.interno === 'cripta', 'la botola non si apre: si resta nella Cripta', s);
  await fine();
}

if (vuoi('muretto')) {
  console.log('— fuori dalla botola, contro il parapetto verso il paese');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    const g = r.game;
    G.mira('scritta_vetro');
    G.avanza(4.5);
    G.premi('KeyE');
    G.avanza(2);
    for (const [id, d] of [['busta_5', 1], ['armadietto_5', 1.1], ['scala', 1]]) {
      G.avvicina(id, d);
      G.avanza(0.1);
      G.premi('KeyE');
      G.avanza(0.3);
    }
    G.tieni('KeyW', 6.5);
    G.avanza(0.1);
    G.premi('KeyE');
    G.avanza(1);
    G.sguardo(120, 0);
    g.input.simulate('KeyW', true);
    g.loop.stepUpdates(60 * 2.5);
    const ind = r.percorso.indicazione;
    const prima = { ...g.player.cyl };
    g.input.simulate('Space', true);
    g.loop.stepUpdates(2);
    g.input.simulate('Space', false);
    g.loop.stepUpdates(60 * 2);
    g.input.simulate('KeyW', false);
    const dopo = g.player.cyl;
    return { ind, passati: Math.hypot(dopo.z - prima.z, (dopo.theta - prima.theta) * 11.27) };
  });
  ok(s.ind?.tasto === 'Spazio', 'contro il muretto: «Spazio — scavalca il muretto»', s.ind);
  ok(s.passati > 1.5, 'con il salto si passa', s.passati);
  await fine();
}

if (vuoi('cartellino')) {
  console.log('— il cartellino da 4 m');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    G.saltaA('m1_cartellino');
    G.vai('terrazza_pedrazzini');
    G.avvicina('cartellino', 4.0);
    G.avanza(0.2);
    const st = G.stato();
    G.premi('KeyE');
    G.avanza(3.5);
    G.chiudiTutto();
    G.avanza(0.3);
    return { bersaglio: st.bersaglio, luoghi: st.luoghi, passi: G.stato().passiAttivi.filter((p) => p.startsWith('m1')), letto: G.regia.narrativa.flag.vero('cartellino_letto') };
  });
  ok(s.bersaglio === 'cartellino', 'a 4 m si legge il cartellino', s.bersaglio);
  ok(s.luoghi.includes('castagno_cartellino'), 'a 4 m si è al castagno del cartellino', s.luoghi);
  ok(s.passi.includes('m1_innesto'), 'il passo del cartellino è fatto', s.passi);
  await fine();
}

if (vuoi('planata')) {
  console.log('— la planata corta dal muretto della Terrazza (3,5 m)');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    const g = r.game;
    G.saltaA('m1_velo');
    const L = r.luoghi.get('muretto_terrazza');
    G.vai(L.z, L.theta);
    G.avanza(0.05);
    g.player.teleport(g.player.cyl.z, g.player.cyl.theta, 3.5);
    // in piedi sulla copertina del muro (3,5 m), un attimo prima di saltare giù
    const pc = g.player.cyl;
    r.corpo.aggiorna(1 / 60, { grounded: true, veloOpen: false, velocita: 0, corre: false, z: pc.z, theta: pc.theta, h: pc.h });
    G.sguardo(90, -8);
    const f = g.rig.forward(g.player.vel.clone());
    g.player.vel.copy(f).multiplyScalar(4.2);
    g.input.simulate('KeyW', true);
    let indAria = null;
    for (let i = 0; i < 60 * 6; i++) {
      if (i === 6) indAria = r.percorso.indicazione;
      if (i === 21) g.input.simulate('Space', true);
      g.loop.stepUpdates(1);
      if (g.player.grounded && i > 12) break;
    }
    g.input.simulate('KeyW', false);
    g.input.simulate('Space', false);
    g.loop.stepUpdates(2);
    return { indAria, planata: r.narrativa.flag.vero('planata_fatta') };
  });
  ok(s.indAria?.tasto === 'Spazio', 'in aria: «Spazio — apri il Velo»', s.indAria);
  ok(s.planata, 'una planata da 3,5 m conta', s);
  await fine();
}

if (vuoi('cella')) {
  console.log('— giù dal campanile con il Velo');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    const g = r.game;
    G.vai('piazza_ore');
    r.saliCampanile();
    G.avanza(0.2);
    G.sguardo(180, 0);
    g.input.simulate('KeyW', true);
    g.input.simulate('Space', true);
    g.loop.stepUpdates(60 * 4);
    g.input.simulate('Space', false);
    g.loop.stepUpdates(60 * 6);
    g.input.simulate('KeyW', false);
    g.loop.stepUpdates(5);
    return { interno: r.interno, h: g.player.cyl.h };
  });
  ok(s.interno === null, 'a terra Elvira è fuori dalla cella', s);
  await fine();
}

// ------------------------------------------------------------------ giorno 1
if (vuoi('velati')) {
  console.log('— i velati prima delle 08:00');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_velati');
    G.impostaOra(1, 7.2);
    G.vai('piazza_ore');
    const prima = r.ui.indicazioni.el?.textContent ?? '';
    G.avanza(1);
    return { passi: G.stato().passiAttivi, diario: r.diario.slice(-5) };
  });
  const testo = await R(() => document.body.innerText);
  ok(/non c'è nessuno con cui parlare/.test(testo), 'nota: alle 08:00 arriva il paese', s.passi.slice(0, 2));
  await fine();
}

if (vuoi('ottavio')) {
  console.log('— il terzo velato ai Ronchi: Ottavio va da Elvira');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_velati');
    G.impostaOra(1, 11);
    G.vai('casa_nando');
    r.narrativa.applicaEffetti(['contatore:velati+1', 'contatore:velati+1', 'contatore:velati+1'], 'prova');
    let t = 0;
    while (t < 60 && !r.dialoghi.aperto) {
      G.avanza(1);
      t += 1;
    }
    return { t, dialogo: r.dialoghi.nodo?.dialogo ?? null, dist: G.stato().ottavioDistanza };
  });
  ok(s.dialogo === 'd_ottavio_incontro', 'fuori dalla piazza il dialogo del Messo parte lo stesso', s);
  await fine();
}

if (vuoi('notte')) {
  console.log('— la prima notte: Elvira gira e non va al fienile');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_fienile');
    G.segnaFiniti('d_meridiana_1', 'd_ottavio_incontro');
    G.chiudiTutto();
    G.impostaOra(1, 20.6);
    r.orologio.limite = null;
    r.orologio.fermo = null;
    G.vai('piazza_ore');
    r.orologio.scalaDebug = 60;
    G.avanza(20);
    r.orologio.scalaDebug = 1;
    const ferma = { giorno: r.orologio.giorno, ore: r.orologio.ore, limite: r.orologio.limite };
    // al fienile
    G.vai('fienile_ottavio');
    G.avvicina('fienile', 3);
    let t = 0;
    while (t < 40 && !(r.dialoghi.nodo?.dialogo === 'd_ottavio_fienile')) {
      G.avanza(0.5);
      t += 0.5;
    }
    const dialogo = r.dialoghi.nodo?.dialogo ?? null;
    return { ferma, dialogo, passi: G.stato().passiAttivi.filter((p) => p.startsWith('m1')) };
  });
  ok(s.ferma.giorno === 2 && Math.abs(s.ferma.ore - 5) < 0.02, "l'orologio aspetta Elvira alle 05:00 del giorno 2", s.ferma);
  ok(s.dialogo === 'd_ottavio_fienile', 'al fienile Ottavio chiede «Dormi o guardi?»', s);
  await fine();
}

// ------------------------------------------------------------------ giorno 2
if (vuoi('clelia')) {
  console.log('— la novizia cercata alle 20 e alle 22');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_campanile');
    G.segnaFiniti('d_meridiana_1', 'd_ottavio_incontro', 'd_ottavio_fienile', 'd_ottavio_mattino');
    G.chiudiTutto();
    G.impostaOra(2, 20);
    r.orologio.limite = null;
    G.vai('piazza_ore');
    G.avanza(1);
    const cl = r.abitanti.posizione('clelia');
    G.vai('bacheca_ore');
    G.avvicina('bacheca', 5);
    let t = 0;
    while (t < 10 && !r.dialoghi.aperto) {
      G.avanza(0.5);
      // l'Ombrista delle 19:45 (la scena si chiude con Esc): il dialogo aspetta che finisca
      if (r.ui.lettore.visible) r.ui.lettore.hide();
      t += 0.5;
    }
    return { clelia: cl, dialogo: r.dialoghi.nodo?.dialogo ?? null, luoghi: G.stato().luoghi, passi: G.stato().passiAttivi, cond: r.narrativa.valuta('giorno:>=2 e luogo:bacheca_ore raggiunto e !dialogo:d_ottavio_pacco finito'), coda: r.dialoghi.inCoda('d_clelia_dono'), presente: r.abitanti.presente('clelia'), diario: r.diario.slice(-8) };
  });
  ok(s.dialogo === 'd_clelia_dono', 'alle 20:00 la novizia è ancora alla Bacheca e dà il pacco', s);
  await fine();
  const b = await nuova();
  const s2 = await b.R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_campanile');
    G.segnaFiniti('d_meridiana_1', 'd_ottavio_incontro', 'd_ottavio_fienile', 'd_ottavio_mattino');
    G.chiudiTutto();
    G.impostaOra(2, 22);
    r.orologio.limite = null;
    G.vai('bacheca_ore');
    G.avanza(3);
    const allaBacheca = r.dialoghi.aperto;
    // altrove la mattina dopo: non le parla da lontano
    G.vai('mulino');
    G.impostaOra(3, 6.9);
    G.avanza(1);
    r.orologio.ore = 7.2;
    G.avanza(3);
    const lontano = r.dialoghi.nodo?.dialogo ?? null;
    G.vai('bacheca_ore');
    G.avanza(3);
    return { allaBacheca, lontano, poi: r.dialoghi.nodo?.dialogo ?? null };
  });
  ok(!s2.allaBacheca, 'alle 22:00 alla Bacheca non c\'è nessuno (e niente dialogo da lontano)', s2);
  ok(s2.lontano !== 'd_clelia_dono', 'il mattino dopo, lontano, la novizia non parla', s2);
  ok(s2.poi === 'd_clelia_dono', 'il mattino dopo, alla Bacheca, la novizia c\'è e dà il pacco', s2);
  await b.fine();
}

if (vuoi('strada')) {
  console.log('— la strada del Messo: al prato alle 12, Ottavio in volo');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_strada');
    G.segnaFiniti('d_meridiana_1', 'd_ottavio_incontro', 'd_ottavio_fienile', 'd_ottavio_mattino', 'd_clelia_dono');
    G.chiudiTutto();
    r.flag('ottavio_conosciuto');
    r.abitanti.ottavioSegueOrario();
    G.impostaOra(2, 12);
    r.orologio.limite = null;
    G.vai('prato_ronco');
    G.avanza(1);
    const ind = r.percorso.indicazione;
    G.premi('KeyG');
    G.avanza(8);
    G.avvicina('png_ottavio', 2);
    G.avanza(0.1);
    return { ind, presente: r.abitanti.presente('ottavio'), bersaglio: G.stato().bersaglio };
  });
  ok(s.ind?.tasto === 'G', 'al prato: «G — Chiama Ottavio con un fischio»', s.ind);
  ok(s.presente && s.bersaglio === 'png_ottavio', 'il fischio lo fa scendere e gli si parla', s);
  await fine();
}

if (vuoi('squadro')) {
  console.log('— lo squadro piantato: che cosa premere');
  const { R, fine } = await nuova();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_chiodo2');
    G.segnaFiniti('d_meridiana_1', 'd_ottavio_incontro', 'd_ottavio_fienile', 'd_ottavio_mattino', 'd_clelia_dono');
    G.chiudiTutto();
    G.impostaOra(2, 10);
    G.vai('sagrato');
    G.avvicina('pianta_cs_2', 2.2);
    G.avanza(0.1);
    const scelto = G.stato().bersaglio;
    G.tieni('KeyE', 1.1);
    G.avanza(0.1);
    const piantato = G.stato().controllo;
    const bolla = r.percorso.indicazione;
    return { scelto, piantato, bolla };
  });
  ok(s.scelto === 'pianta_cs_2', 'il chiodo 2 si sceglie da 2,2 m', s.scelto);
  ok(s.piantato === 'piantato' && s.bolla?.tasto === 'A / D', 'piantato: «A / D — centra la bolla»', s);
  await fine();
}

if (vuoi('continua')) {
  console.log('— «Continua» nella notte del fienile (dopo «Guardo.»)');
  const { page, R, fine } = await nuova();
  await R(async () => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    G.saltaA('m1_notte');
    G.segnaFiniti('d_meridiana_1', 'd_ottavio_incontro');
    G.chiudiTutto();
    G.impostaOra(1, 23);
    r.orologio.limite = null;
    G.vai('fienile_ottavio');
    G.avanza(0.5);
    await G.salva();
  });
  await page.reload();
  await page.waitForFunction(() => window.__GAME_READY__ === true && !!window.__GAME__?.regia, null, { timeout: 300000 });
  await R(() => window.__GAME__.stopLoop());
  await page.getByRole('button', { name: 'Continua' }).click();
  const s = await R(() => {
    const G = window.__GAME__.regia;
    const r = G.regia;
    let t = 0;
    while (t < 20 && r.dialoghi.nodo?.dialogo !== 'd_ottavio_fienile') {
      G.avanza(0.5);
      t += 0.5;
    }
    return { t, dialogo: r.dialoghi.nodo?.dialogo ?? null, controllo: r.controllo.tipo, fase: r.fase };
  });
  ok(s.dialogo === 'd_ottavio_fienile', 'dopo «Continua» Ottavio richiede «Dormi o guardi?»', s);
  await fine();
}

console.log(fallite ? `\n${fallite} prove fallite` : '\ntutte le prove riuscite');
process.exit(fallite ? 1 : 0);
