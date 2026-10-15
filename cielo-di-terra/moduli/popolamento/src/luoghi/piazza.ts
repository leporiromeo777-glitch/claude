/**
 * Piazza delle Ore: selciato tondo a ciottoli bianchi e neri che è una meridiana (le linee delle
 * ore convergono verso il Sordo, una più scura punta a Lag e a Mane), la Bacheca delle Ore sotto
 * la tettoia di piode, il telo dell'Ombrista fra due pali con la lampada a olio, i gradini dove
 * siede il pubblico, le panche e i lampioni.
 */
import { creaLanterna } from '../../../oggetti/src/oggetti/lumi';
import { luogo, RETE } from '../contenuti';
import type { Contesto } from '../contesto';
import { hex, mix, type RGB } from '../cantiere';
import { creaBacheca, creaLavatoio, creaPanca, creaTelo } from '../edifici';
import { discoSulSuolo, hash2, rumore2 } from '../forme';
import { gradinataSulSuolo } from '../sentieri';
import { sposta, spostaYaw, suolo, yawVerso } from '../terreno';
import { posaChiodo } from './sanVigilio';

const CIOTTOLO_CHIARO: RGB = hex(0xd9d0bd);
const CIOTTOLO_GRIGIO: RGB = hex(0xa69f93);
const CIOTTOLO_SCURO: RGB = hex(0x4b4650);
const CORDOLO: RGB = hex(0x8d877f);

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
    if (d < 0.11) return mix(CIOTTOLO_SCURO, c, 0.12 + fine * 0.1);
  }
  // la linea più scura: punta a Lag e a Mane (un punto preciso della parete del Sordo)
  const ang = (12 * Math.PI) / 180;
  const d2 = Math.abs(x * Math.cos(ang) - y * Math.sin(ang));
  if (d2 < 0.17 && y > -raggio + 3 && r < raggio - 2.2) return hex(0x2c2830);
  return c;
}

export function costruisciPiazza(ctx: Contesto): void {
  const p = luogo('piazza_ore');
  const raggio = p.raggio;
  discoSulSuolo(ctx.zona('piazza'), p.z, p.theta, raggio, 0.3, 0.04, (x, y, r) => coloreMeridiana(x, y, r, raggio));
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
  // il davanti (gradino) guarda il campanile: la tettoia copre la cella dal chiodo
  const yawL = yawVerso(lv, campanile);
  const centroL = spostaYaw(lv.z, lv.theta, yawL + 180, 2.75, 35.5);
  const baseL = suolo(cs5.z, cs5.theta) + 0.05;
  const pl = ctx.posa('piazza', creaLavatoio('lavatoio-piazza'), centroL.z, centroL.theta, yawL, { h: baseL, luogo: 'lavatoio' });
  ctx.occupa({ nome: 'lavatoio', z: centroL.z, theta: centroL.theta, yaw: yawL, larghezza: 8, profondita: 7.5 });
  posaChiodo(ctx, 'piazza', cs5.numero, cs5.z, cs5.theta, 'cs_5', 'lavatoio', baseL + 0.08);
  if (pl['vasca']) ctx.punto('esamina:lavatoio', 'esamina', 'La vasca del lavatoio', pl['vasca'], { raggio: 2.2, luogo: 'lavatoio' });
}
