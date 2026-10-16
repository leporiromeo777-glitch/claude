/**
 * Piazza delle Ore: selciato tondo a ciottoli bianchi e neri che è una meridiana (le linee delle
 * ore convergono verso il Sordo, una più scura punta a Lag e a Mane), la Bacheca delle Ore sotto
 * la tettoia di piode, il telo dell'Ombrista fra due pali con la lampada a olio, i gradini dove
 * siede il pubblico, le panche e i lampioni.
 */
import { creaLanterna } from '../../oggetti/oggetti/lumi';
import { luogo, RETE } from '../contenuti';
import type { Contesto } from '../contesto';
import { hex, mix, type RGB } from '../cantiere';
import { creaBacheca, creaLavatoio, creaPanca, creaTelo } from '../edifici';
import { coronaSulSuolo, discoSulSuolo, hash2, nastroSulSuolo, rumore2 } from '../forme';
import { terrainColor } from '../../render/palette';
import { createMasks, slopeAt, surfaceHeight } from '../../world/terrain';
import { SUPERFICIE } from '../../render/superfici';
import { gradinataSulSuolo } from '../sentieri';
import { sposta, spostaYaw, suolo, yawVerso } from '../terreno';
import { posaChiodo } from './sanVigilio';

// rifinitura 1: il selciato era quasi bianco con le righe nere (di giorno un foglio sovraesposto,
// di notte la cosa più luminosa della scena): ciottoli grigio-beige caldi, linee bruno-bronzo
const CIOTTOLO_CHIARO: RGB = hex(0xa89e8c);
const CIOTTOLO_GRIGIO: RGB = hex(0x857d70);
const CIOTTOLO_SCURO: RGB = hex(0x5a4a3a);
const CORDOLO: RGB = hex(0x7d766c);
/**
 * di quanto il lastricato del lavatoio sta sopra il gradino del chiodo 5 (m). Rifinitura 2: torna a 0.
 * La rifinitura 1 l'aveva alzato di 0,8 m su un basamento con quattro gradini (vasca fuori terra), ma
 * cambiava i collider (basamento calpestabile e gradini), la quota della vasca (`esamina:lavatoio`) e il
 * posto di Togna, e il brief non lo permette senza l'approvazione di chi decide il gioco. Con 0,8 si
 * torna a quella soluzione (`creaLavatoio(seme, 0.8)` e il posto di Togna in `abitanti.ts`); con 0 la
 * vasca sepolta nel pendio si risolve solo nel visivo (`lastricatoSulPendio`).
 */
export const DISLIVELLO_LAVATOIO = 0;
/** la linea di Lag e Mane (prima quasi nera) */
const LINEA_LAG: RGB = hex(0x4a3a2c);
/** mezza larghezza delle linee delle ore e della linea di Lag (m) */
const LINEA_ORE = 0.06;
const LINEA_LAG_MEZZA = 0.09;

/** Colore del selciato a meridiana in (x est, y nord) dal centro. */
export function coloreMeridiana(x: number, y: number, r: number, raggio: number): RGB {
  // ciottoli: macchie chiare e grigie a scala 0.35 m
  const n = rumore2(x / 0.35, y / 0.35, 3) * 0.6 + rumore2(x / 1.4, y / 1.4, 7) * 0.4;
  let c = mix(CIOTTOLO_CHIARO, CIOTTOLO_GRIGIO, Math.min(1, Math.max(0, (n - 0.35) * 1.6)));
  const fine = hash2(Math.floor(x / 0.22), Math.floor(y / 0.22), 1);
  c = mix(c, CIOTTOLO_GRIGIO, fine < 0.18 ? 0.5 : 0);
  // cordolo esterno e anello delle ore
  if (r > raggio - 0.7) return mix(CORDOLO, CIOTTOLO_SCURO, 0.25 + 0.2 * fine);
  if (Math.abs(r - (raggio - 2.2)) < 0.22) return mix(CIOTTOLO_SCURO, c, 0.15);
  if (r < 0.9) return mix(CIOTTOLO_SCURO, c, 0.1);
  // linee delle ore: rette che passano per un punto lontano a Lag (il Sordo, 1750 m a nord)
  const V = { x: 0, y: 1750 };
  for (let k = -5; k <= 5; k++) {
    const sx = k * 2.6;
    const sy = -raggio;
    const dx = V.x - sx;
    const dy = V.y - sy;
    const l = Math.hypot(dx, dy);
    const d = Math.abs((x - sx) * dy - (y - sy) * dx) / l;
    if (y > raggio - 2.2) continue;
    if (d < LINEA_ORE) return mix(CIOTTOLO_SCURO, c, 0.12 + fine * 0.1);
  }
  // la linea più scura: punta a Lag e a Mane (un punto preciso della parete del Sordo)
  const ang = (12 * Math.PI) / 180;
  const d2 = Math.abs(x * Math.cos(ang) - y * Math.sin(ang));
  if (d2 < LINEA_LAG_MEZZA && y > -raggio + 3 && r < raggio - 2.2) return LINEA_LAG;
  return c;
}

/** Fondo del selciato: ciottoli chiari e grigi a chiazze larghe (i ciottoli li dipinge il materiale). */
function coloreFondo(x: number, y: number): RGB {
  const n = rumore2(x / 1.1, y / 1.1, 3) * 0.55 + rumore2(x / 3.2, y / 3.2, 7) * 0.45;
  const c = mix(CIOTTOLO_CHIARO, CIOTTOLO_GRIGIO, Math.min(1, Math.max(0, (n - 0.3) * 1.5)));
  // usura: più chiaro dove si passa (verso il centro e la chiesa), più scuro e caldo ai bordi
  const r = Math.hypot(x, y);
  return mix(c, mix(c, hex(0xb7a58a), 0.5), Math.min(1, Math.max(0, (r - 9) / 8)) * 0.5);
}

/**
 * Il selciato della piazza delle Ore: fondo a ciottoli (superficie SELCIATO, normali morbide: niente
 * tessere), cordolo di lastre, l'anello delle ore, le linee delle ore di ciottoli scuri verso il
 * Sordo, la linea più scura verso Lag e Mane e il cerchio scuro al centro. Le linee sono nastri
 * sottili appena sopra il fondo, così restano nette anche con pochi triangoli.
 */
function selciatoMeridiana(ctx: Contesto, z0: number, th0: number, raggio: number): void {
  const c = ctx.zona('piazza');
  const h = 38.5;
  const SEL = SUPERFICIE.SELCIATO;
  const qui = (x: number, y: number) => sposta(z0, th0, y, x, h);
  discoSulSuolo(c, z0, th0, raggio - 0.6, 0.45, 0.04, (x, y) => coloreFondo(x, y), undefined, false, { superficie: SEL + 0.3 });
  const scuro = (s: number, u: number): RGB => mix(CIOTTOLO_SCURO, CIOTTOLO_GRIGIO, 0.12 + hash2(Math.floor(s / 0.3), Math.floor(u * 2), 4) * 0.2);
  const anello = (r: number, larghezza: number, sopra: number, colore: (s: number, u: number) => RGB, superficie: number) => {
    const n = Math.max(24, Math.round((2 * Math.PI * r) / 0.9));
    const punti = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      punti.push(qui(Math.cos(a) * r, Math.sin(a) * r));
    }
    nastroSulSuolo(c, punti, larghezza, 0.7, sopra, colore, undefined, { superficie });
  };
  // cordolo esterno di lastre di gneiss
  anello(raggio - 0.32, 0.72, 0.05, (s, u) => mix(CORDOLO, CIOTTOLO_SCURO, 0.15 + 0.25 * hash2(Math.floor(s / 0.7), u > 0 ? 1 : 0, 2)), SUPERFICIE.PIETRA + 0.6);
  // anello delle ore
  anello(raggio - 2.2, 0.44, 0.052, scuro, SEL + 0.7);
  // linee delle ore: rette verso un punto lontano a Lag (il Sordo, 1750 m a nord)
  const V = { x: 0, y: 1750 };
  const rMax = raggio - 2.2 - 0.25;
  for (let k = -5; k <= 5; k++) {
    const sx = k * 2.6;
    const sy = -raggio;
    const dx = V.x - sx;
    const dy = V.y - sy;
    const l = Math.hypot(dx, dy);
    // tratto dentro l'anello delle ore
    let t0 = -1;
    let t1 = -1;
    for (let t = 0; t < raggio * 2.2; t += 0.1) {
      const x = sx + (dx / l) * t;
      const y = sy + (dy / l) * t;
      const dentro = Math.hypot(x, y) < rMax && y < raggio - 2.2;
      if (dentro && t0 < 0) t0 = t;
      if (dentro) t1 = t;
    }
    if (t0 < 0 || t1 - t0 < 0.5) continue;
    const a = qui(sx + (dx / l) * t0, sy + (dy / l) * t0);
    const b = qui(sx + (dx / l) * t1, sy + (dy / l) * t1);
    nastroSulSuolo(c, [a, b], LINEA_ORE * 2, 0.7, 0.052, scuro, undefined, { superficie: SEL + 0.5 });
  }
  // la linea più scura: punta a Lag e a Mane (un punto preciso della parete del Sordo)
  const ang = (12 * Math.PI) / 180;
  const ta = (-raggio + 3) / Math.cos(ang);
  const tb = raggio - 2.2;
  nastroSulSuolo(c, [qui(Math.sin(ang) * ta, Math.cos(ang) * ta), qui(Math.sin(ang) * tb, Math.cos(ang) * tb)], LINEA_LAG_MEZZA * 2, 0.7, 0.054, () => LINEA_LAG, undefined, { superficie: SEL + 0.9 });
  // cerchio scuro al centro
  discoSulSuolo(c, z0, th0, 0.9, 0.3, 0.056, () => mix(CIOTTOLO_SCURO, CIOTTOLO_GRIGIO, 0.1), undefined, false, { superficie: SEL + 0.1 });
}

/**
 * Attorno al selciato: il suolo del motore è livellato e chiaro fino a ~32 m (la maschera della
 * piazza), un anello di carta senza motivo. Qui diventa una corona: ciottoli grigi a ridosso del
 * cordolo, poi terra battuta ocra con qualche ciottolo, poi prato calpestato che sfuma nel colore
 * del suolo (al bordo esterno lo stesso del terreno: niente cucitura). I confini sono irregolari.
 */
function coronaPiazza(ctx: Contesto, z0: number, th0: number, raggio: number): void {
  const c = ctx.zona('piazza');
  const r0 = raggio - 0.62;
  const r1 = raggio + 12;
  const masks = createMasks();
  const cTerra = hex(0x9a7f5c);
  const cTerraScura = hex(0x7c6448);
  const cCiottoli = hex(0xa8a092);
  const out = [0, 0, 0];
  const kdeg = (646 - 38.5) * (Math.PI / 180);
  const coloreSuolo = (x: number, y: number): RGB => {
    const z = z0 + y;
    const th = th0 + x / kdeg;
    const h = surfaceHeight(z, th, masks);
    // il colore del suolo senza il chiaro della piazza
    masks.piazza = 0;
    terrainColor(z, th, h, slopeAt(z, th), masks, out);
    return [out[0]!, out[1]!, out[2]!];
  };
  // i bordi irregolari delle tre fasce (selciato, terra battuta, prato) in (x, y)
  const bordi = (x: number, y: number) => {
    const a = Math.atan2(y, x);
    const n1 = rumore2(Math.cos(a) * 3 + 11, Math.sin(a) * 3, 5);
    const n2 = rumore2(x / 2.2, y / 2.2, 9);
    return {
      selciato: raggio + 1.4 + n1 * 2.2 + (n2 - 0.5) * 1.0,
      terra: raggio + 5.5 + rumore2(Math.cos(a) * 4, Math.sin(a) * 4 + 3, 8) * 4.5 + (n2 - 0.5) * 1.6,
    };
  };
  /**
   * Il colore per vertice (rifinitura 2): sfuma fra le fasce su 0,5-0,8 m, così il bordo fra la terra
   * battuta e il prato non è più il dente di sega dei triangoli (a03 del direttore artistico)
   */
  const coloreVertice = (x: number, y: number, r: number): RGB => {
    const b = bordi(x, y);
    const ciottoli = mix(cCiottoli, coloreFondo(x, y), 0.5);
    const terra = mix(cTerra, cTerraScura, rumore2(x / 5.5, y / 5.5, 2) * 0.55);
    const k = Math.min(1, Math.max(0, (r - b.terra) / Math.max(1, r1 - 1.2 - b.terra)));
    const suoloQui = coloreSuolo(x, y);
    const prato = mix(mix(suoloQui, cTerra, 0.3), suoloQui, k);
    const t1 = Math.min(1, Math.max(0, (r - b.selciato) / 0.5 + 0.5));
    const t2 = Math.min(1, Math.max(0, (r - b.terra) / 0.8 + 0.5));
    return mix(mix(ciottoli, terra, t1), prato, t2);
  };
  coronaSulSuolo(
    c,
    z0,
    th0,
    r0,
    r1,
    0.55,
    0.035,
    (x, y, r) => {
      const { selciato: bordoSelciato, terra: bordoTerra } = bordi(x, y);
      if (r < bordoSelciato) return [SUPERFICIE.SELCIATO + 0.6, mix(cCiottoli, coloreFondo(x, y), 0.5)];
      if (r < bordoTerra) {
        // terra battuta: più scura dove l'acqua ristagna. Rifinitura 1: la variante del motivo e il
        // colore cambiavano da un triangolo all'altro (faccette) e i ciottoli sparsi erano toppe
        // isolate; ora la variante è una sola e il colore cambia piano, a chiazze larghe
        return [SUPERFICIE.TERRA + 0.35, mix(cTerra, cTerraScura, rumore2(x / 5.5, y / 5.5, 2) * 0.55)];
      }
      // prato calpestato che torna il prato del suolo
      const k = Math.min(1, Math.max(0, (r - bordoTerra) / Math.max(1, r1 - 1.2 - bordoTerra)));
      const suoloQui = coloreSuolo(x, y);
      return [SUPERFICIE.ERBA + 0.3, mix(mix(suoloQui, cTerra, 0.3), suoloQui, k)];
    },
    (_x, _y, r) => (r < raggio + 0.3 ? 0.25 : 0),
    coloreVertice,
  );
}

export function costruisciPiazza(ctx: Contesto): void {
  const p = luogo('piazza_ore');
  const raggio = p.raggio;
  selciatoMeridiana(ctx, p.z, p.theta, raggio);
  coronaPiazza(ctx, p.z, p.theta, raggio);
  ctx.occupa({ nome: 'piazza_ore', z: p.z, theta: p.theta, raggio: raggio + 1 });

  // Bacheca delle Ore: sul bordo a Sera, guarda il centro
  const bc = luogo('bacheca_ore');
  const yawB = yawVerso(bc, p);
  const pb = ctx.posa('piazza', creaBacheca('bacheca-ore'), bc.z, bc.theta, yawB, { luogo: 'bacheca_ore' });
  ctx.occupa({ nome: 'bacheca_ore', z: bc.z, theta: bc.theta, raggio: 1.6 });
  ctx.punto('leggi:bacheca_ore', 'leggi', 'Leggi la Bacheca delle Ore', pb['leggi'] ?? ctx.qui(bc.z, bc.theta, 1.5), { raggio: 2.2, luogo: 'bacheca_ore', rif: 'bacheca_giorno_1' });

  // telo dell'Ombrista: lato a Lag della piazza, guarda la gradinata del pubblico (a Sera e a Mont)
  const tl = luogo('telo_ombrista');
  const gradinata = sposta(1038.5, 34.9, 0, 0, 39);
  const yawT = yawVerso(tl, gradinata);
  const pt = ctx.posa('piazza', creaTelo('telo-ombrista'), tl.z, tl.theta, yawT, { luogo: 'telo_ombrista' });
  ctx.occupa({ nome: 'telo_ombrista', z: tl.z, theta: tl.theta, raggio: 2.6 });
  ctx.punto('guarda:telo_ombrista', 'guarda', "Il telo dell'Ombrista", pt['pubblico'] ?? ctx.qui(tl.z, tl.theta, 1.5), { raggio: 4, luogo: 'telo_ombrista', rif: 'leggende.partenza_1' });
  // gradinata del pubblico sul pendio a Sera della piazza (tre corsi di gradini in arco)
  const yawG = yawVerso(gradinata, tl);
  for (let k = -3; k <= 3; k++) {
    const a = spostaYaw(gradinata.z, gradinata.theta, yawG + 90, k * 2.3, 39);
    const da = spostaYaw(a.z, a.theta, yawG + 180, 4.5 - Math.abs(k) * 0.4, 39);
    const aa = spostaYaw(a.z, a.theta, yawG, 2.5 + Math.abs(k) * 0.25, 39);
    gradinataSulSuolo(ctx.zona('piazza'), da, aa, 2.35, 0.42, 'pietra', 'gradino', 'telo_ombrista', 700 + k);
  }
  ctx.occupa({ nome: 'gradinata', z: gradinata.z, theta: gradinata.theta, yaw: yawG, larghezza: 17, profondita: 8 });
  ctx.punto('siediti:gradinata', 'siediti', "Siediti sui gradini dell'Ombrista", ctx.qui(gradinata.z, gradinata.theta, 0.5), { raggio: 4, luogo: 'telo_ombrista' });

  // lampioni sul bordo della piazza e panche
  const lampioni: Array<[number, number]> = [
    [205, raggio + 1.2],
    [140, raggio + 1.4],
    [62, raggio + 1.0],
    [-8, raggio + 1.2],
    [-95, raggio + 1.3],
  ];
  lampioni.forEach(([ang, r], i) => {
    const q = spostaYaw(p.z, p.theta, ang, r, 38.5);
    const l = creaLanterna({ tipo: 'palo', seme: `lampione-piazza-${i}`, luce: false, alone: false });
    ctx.posa('piazza', l, q.z, q.theta, ang + 180, { tag: () => 'palo' });
    l.dispose();
  });
  const panche: Array<[number, number]> = [
    [170, raggio + 1.6],
    [100, raggio + 1.8],
    [-35, raggio + 1.6],
  ];
  panche.forEach(([ang, r], i) => {
    const q = spostaYaw(p.z, p.theta, ang, r, 38.5);
    const pp = ctx.posa('piazza', creaPanca(`panca-piazza-${i}`, 2.4, i !== 1), q.z, q.theta, ang + 180, {});
    ctx.punto(`siediti:panca_piazza_${i}`, 'siediti', 'Siediti sulla panca', pp['seduta'] ?? ctx.qui(q.z, q.theta, 0.5), { raggio: 1.5, luogo: 'piazza_ore' });
  });

  // lavatoio coperto: il primo gradino (chiodo 5) sta sul luogo dei contenuti, la vasca dietro
  const lv = luogo('lavatoio');
  const cs5 = RETE.find((c) => c.id === 'cs_5')!;
  const campanile = luogo('campanile');
  // il davanti (gradino) volta le spalle al campanile: dal chiodo, guardando la cella, c'è la tettoia
  const yawL = yawVerso(lv, campanile) + 180;
  const centroL = spostaYaw(lv.z, lv.theta, yawL + 180, 3.4, 35.5);
  const baseL = suolo(cs5.z, cs5.theta) + 0.05;
  // rifinitura 1: il pendio dietro il gradino sale di 2 m e seppelliva la vasca; il lastricato sale
  // di DISLIVELLO_LAVATOIO su un basamento, con una scalinata fino al primo gradino, che col chiodo 5
  // resta dov'era (stessa posizione e stessa quota). La tettoia, più alta, copre ancora il lato 5-1
  const pl = ctx.posa('piazza', creaLavatoio('lavatoio-piazza', DISLIVELLO_LAVATOIO), centroL.z, centroL.theta, yawL, { h: baseL + DISLIVELLO_LAVATOIO, luogo: 'lavatoio' });
  ctx.occupa({ nome: 'lavatoio', z: centroL.z, theta: centroL.theta, yaw: yawL, larghezza: 8, profondita: 7.5 });
  posaChiodo(ctx, 'piazza', cs5.numero, cs5.z, cs5.theta, 'cs_5', 'lavatoio', baseL + 0.08);
  if (pl['vasca']) ctx.punto('esamina:lavatoio', 'esamina', 'La vasca del lavatoio', pl['vasca'], { raggio: 2.2, luogo: 'lavatoio' });
  if (DISLIVELLO_LAVATOIO <= 0) lastricatoSulPendio(ctx, centroL.z, centroL.theta, yawL, baseL);
}

/**
 * Il pendio dentro il lavatoio (rifinitura 2, solo visivo): alla quota di prima il suolo che sale a
 * monte (fino a 2,5 m) copre la parte alta del lastricato e della vasca, e sotto la tettoia c'era un
 * prato in salita con la vasca che spuntava dall'erba. Dove il suolo sta sopra il lastricato si posa
 * un lastricato che segue il suolo (lastre di gneiss a giunti, il pavimento del lavatoio che sale col
 * pendio), e dove sta sopra il bordo della vasca le lastre di copertura più chiare: la vasca si legge
 * come una vasca in parte coperta, scavata nel pendio. Nessun collider: si cammina sul suolo come
 * prima, e il lastricato ci sta appoggiato sopra (3,5 cm).
 */
function lastricatoSulPendio(ctx: Contesto, z0: number, th0: number, yaw: number, base: number): void {
  const c = ctx.zona('piazza');
  const y = (yaw * Math.PI) / 180;
  const kdeg = (646 - 35.5) * (Math.PI / 180);
  const lastra = hex(0x948d82);
  const lastraScura = hex(0x7b746a);
  const copertura = hex(0xaaa399);
  coronaSulSuolo(
    c,
    z0,
    th0,
    0,
    4.6,
    0.32,
    0.035,
    (x, yN) => {
      // coordinate dell'oggetto: avanti (z) e destra (x, verso yaw − 90)
      const zl = yN * Math.cos(y) + x * Math.sin(y);
      const xl = yN * Math.sin(y) - x * Math.cos(y);
      if (Math.abs(xl) > 3.65 || zl < -3.65 || zl > 2.45) return null;
      const h = suolo(z0 + yN, th0 + x / kdeg) - base;
      const vasca = Math.abs(xl) < 2.95 && zl > -2.6 && zl < -0.2;
      if (vasca) {
        if (h < 1.06) return null;
        // lastre di copertura sopra la vasca, a giunti larghi
        const g = Math.abs(((xl + 10) % 0.9) - 0.45) < 0.035 ? 0.78 : 1;
        return [SUPERFICIE.PIETRA + 0.45, mix(copertura, lastraScura, (1 - g) * 2.2 + hash2(Math.floor(xl / 0.9), 3, 7) * 0.12)];
      }
      if (h < 0.42) return null;
      // lastre di gneiss a corsi (0,6 × 0,9 m circa), un po' più scure verso il monte (umido)
      const corso = Math.floor((zl + 10) / 0.62);
      const lx = (xl + 10 + (corso % 2) * 0.45) / 0.9;
      const giunto = Math.abs(((zl + 10) % 0.62) - 0.31) > 0.27 || Math.abs((lx % 1) - 0.5) > 0.46;
      const t = hash2(Math.floor(lx), corso, 5);
      const base0 = mix(lastra, lastraScura, t * 0.5 + Math.max(0, -zl - 1) * 0.1);
      return [SUPERFICIE.PIETRA + 0.75, giunto ? mix(base0, lastraScura, 0.6) : base0];
    },
    (x, yN) => {
      const h = suolo(z0 + yN, th0 + x / kdeg) - base;
      return Math.min(0.3, Math.max(0, (h - 0.4) * 0.12));
    },
  );
}
