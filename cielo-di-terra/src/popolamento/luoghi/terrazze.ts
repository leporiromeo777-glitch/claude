/**
 * Le terrazze sopra il paese: la Terrazza Pedrazzini (la più alta, larga, di castagni da frutto,
 * erba alta, ricci vuoti, il castagno del cartellino di zinco, il muro con il chiodo 3) e i tre muri
 * dove si impara il Velo, in fila fra la terrazza e la piazza:
 *   1. il Muretto della Terrazza (962, 25,4), 3,5 m: il primo salto;
 *   2. il Muraglione della Grà (985, 27,6), ~8 m, con la vecchia grà sul ciglio;
 *   3. la Ripa di San Vigilio (1036, 33,2), il bastione alto 12 m sopra la piazza.
 *
 * Il terreno del motore ha gradoni di 3,5 m: la Terrazza e il Muraglione sono ripiani riempiti e
 * sostenuti da muri; la Ripa è un bastione di pietra sul gradone a 42 m con la scala sul fianco a
 * Lag (la sua faccia è alta 8,5 m sul gradone e 12 m sopra il selciato della piazza).
 */
import * as THREE from 'three';
import { Costruttore, mat } from '../../oggetti/costruttore';
import { matriceSuperficie } from '../../oggetti/cilindro';
import { creaCastagno } from '../../oggetti/oggetti/castagno';
import { creaMuroSecco } from '../../oggetti/oggetti/muri';
import { geoBoxC, geoCilindro } from '../../oggetti/forme';
import { RETE, luogo } from '../contenuti';
import type { Contesto } from '../contesto';
import { creaErbaRicci, creaGra } from '../edifici';
import { costruisciRipiano, localeDa } from '../ripiano';
import { scalinata } from '../sentieri';
import { metriPerGrado, mondo, sposta, spostaYaw, suolo, yawValle } from '../terreno';
import { posaChiodo } from './sanVigilio';
import { gradiniLuogo, oggettoSullaSoglia } from '../soglie';

export function costruisciTerrazzaPedrazzini(ctx: Contesto): void {
  const t = luogo('terrazza_pedrazzini');
  const cs3 = RETE.find((c) => c.id === 'cs_3')!;
  // ripiano: il fronte guarda a Mane (verso il paese); larghezza lungo z, profondità lungo theta
  const yaw = 90;
  const H = Math.round(suolo(t.z, t.theta) * 2) / 2;
  const kd = metriPerGrado(H);
  // il fronte passa per il chiodo 3
  const dFronte = (cs3.theta - t.theta) * kd + 0.45;
  const dRetro = -4.5;
  const D = dFronte - dRetro;
  const centro = sposta(t.z - 1, t.theta, 0, (dFronte + dRetro) / 2, H);
  const r = costruisciRipiano(ctx, { zona: 'terrazza', nome: 'terrazza_pedrazzini', z: centro.z, theta: centro.theta, yaw, larghezza: 30, profondita: D, quota: H, superficie: 'erba', dettaglio: 'alto', luogo: 'terrazza_pedrazzini' });
  void r;
  // il chiodo 3 sulla copertina del muro di fronte
  posaChiodo(ctx, 'terrazza', cs3.numero, cs3.z, cs3.theta, 'cs_3', 'terrazza_pedrazzini', H + 0.3);
  // castagni da frutto inselvatichiti sul ripiano
  // (fuori dalle visuali dal chiodo 3 verso il chiodo 37 e il Pilastro 4, a Mont e a Sera)
  const posti: Array<[number, number, number]> = [
    [3.5, -2.5, 11],
    [9.5, 1.5, 12.5],
    [14, -1.5, 10.5],
    [-12.5, 3.5, 11],
  ];
  posti.forEach(([dz, de, h], i) => {
    const p = localeDa(centro.z, centro.theta, yaw, -dz, de, H);
    // (i ricci li mette l'erba del ripiano: quelli del castagno, vicino al muro, cadevano oltre il bordo e restavano sospesi)
    const c = creaCastagno({ seme: `pedrazzini-${i}`, altezza: h, stagione: 'autunno', dettaglio: 'alto', ricci: false });
    ctx.posa('terrazza', c, p.z, p.theta, i * 70, { h: H - 0.1, tag: () => 'tronco' });
    c.dispose();
  });
  // erba alta e ricci solo sul ripiano (un rettangolo orientato come il ripiano, a 0,5 m dai muri):
  // il cerchio di 13 m usciva oltre il muro di fronte e l'erba restava sospesa nel vuoto
  ctx.posa('terrazza', creaErbaRicci('erba-pedrazzini', 13, 90, 70, { x: 15 - 0.5, z: D / 2 - 0.5 }), centro.z, centro.theta, yaw, { h: H, collider: false });
  // il castagno del cartellino (vigoroso, inselvatichito) con il cartellino di zinco al ramo più basso
  const cc = luogo('castagno_cartellino');
  const hc = Math.max(H, suolo(cc.z, cc.theta)) - 0.1;
  const cast = creaCastagno({ seme: 'castagno-cartellino', altezza: 12.5, larghezzaChioma: 12, stagione: 'autunno', dettaglio: 'alto' });
  const yawC = 90;
  ctx.posa('terrazza', cast, cc.z, cc.theta, yawC, { h: hc, tag: () => 'tronco', luogo: 'castagno_cartellino' });
  cast.dispose();
  ctx.occupa({ nome: 'castagno_cartellino', z: cc.z, theta: cc.theta, raggio: 2 });
  // ramo basso verso il ripiano, cartellino appeso con il fil di ferro, punto d'innesto
  const b = new Costruttore(950);
  const rami = [new THREE.Vector3(0, 2.0, 0.35), new THREE.Vector3(0, 2.25, 1.6), new THREE.Vector3(0.1, 2.15, 2.6)];
  b.aggiungi(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rami), 6, 0.11, 6, false), { colore: 0x5e4535 });
  b.aggiungi(geoCilindro(0.004, 0.004, 0.22, 3), { matrice: mat([0.05, 1.95, 1.9]), colore: 0x6f6f72 });
  b.aggiungi(geoBoxC(0.13, 0.085, 0.006), { matrice: mat([0.05, 1.9, 1.9], [0, 0.4, 0.12]), colore: 0xa8aeb4 });
  // il vecchio innesto: un ingrossamento sul tronco
  b.aggiungi(new THREE.TorusGeometry(0.42, 0.09, 5, 10), { matrice: mat([0, 1.55, 0], [Math.PI / 2, 0, 0]), colore: 0x4e3a2c, piatto: true });
  const mC = matriceSuperficie(cc.z, cc.theta, hc, yawC);
  ctx.zona('terrazza').oggetto(b.costruisci('cartellino'), mC, { lumi: false });
  ctx.punto('leggi:cartellino_castagno', 'leggi', 'Leggi il cartellino di zinco', new THREE.Vector3(0.05, 1.9, 1.9).applyMatrix4(mC), { raggio: 2.2, luogo: 'castagno_cartellino', rif: 'cartellino_castagno' });
  ctx.punto('lente:innesto_vecchio', 'lente', "Lente: il vecchio innesto", new THREE.Vector3(0, 1.55, 0.4).applyMatrix4(mC), { raggio: 2.0, luogo: 'castagno_cartellino', rif: 'flag:lente:innesto_vecchio' });
  ctx.punto('innesta:castagno_cartellino', 'innesta', 'Innesta la marza', new THREE.Vector3(0, 2.1, 1.2).applyMatrix4(mC), { raggio: 2.4, luogo: 'castagno_cartellino', rif: 'flag:innesto_fatto' });
  ctx.punto('esamina:terrazza_pedrazzini', 'esamina', 'La Terrazza Pedrazzini', mondo(centro.z, centro.theta, H + 1.2), { raggio: 8, luogo: 'terrazza_pedrazzini', attivo: false });
}

/** Trova il piede di un'alzata scendendo da (z, theta) lungo `yaw`: restituisce distanza e quote. */
function piedeAlzata(z: number, theta: number, yaw: number, cerca = 12): { d: number; alto: number; basso: number } {
  const h0 = suolo(z, theta);
  let ultimo = 0;
  for (let d = 0; d <= cerca; d += 0.25) {
    const p = spostaYaw(z, theta, yaw, d, h0);
    const h = suolo(p.z, p.theta);
    if (h0 - h > 3.0) {
      // continua finché la discesa rallenta (piede)
      let dd = d;
      let hp = h;
      for (; dd <= d + 4; dd += 0.25) {
        const q = spostaYaw(z, theta, yaw, dd + 0.25, h0);
        const hq = suolo(q.z, q.theta);
        if (hp - hq < 0.04) break;
        hp = hq;
      }
      return { d: dd, alto: h0, basso: hp };
    }
    ultimo = d;
  }
  return { d: ultimo, alto: h0, basso: h0 - 3.5 };
}

/** I tre muri del Velo. */
export function costruisciMuriDelVelo(ctx: Contesto): void {
  // 1. Muretto della Terrazza: l'alzata 63 → 59,5 vicino al luogo, muro alto e ben fatto
  {
    const l = luogo('muretto_terrazza');
    const yv = yawValle(l.z, l.theta);
    const a = piedeAlzata(l.z, l.theta, yv);
    const piede = spostaYaw(l.z, l.theta, yv, a.d - 0.3, a.alto);
    const altezza = a.alto - a.basso + 0.35;
    // percorso lungo la curva di livello (coordinate della libreria: X = sinistra)
    const muro = creaMuroSecco({ seme: 'muretto-terrazza', percorso: [[5, 0], [-5, 0]], altezza, spessore: 0.8, scarpa: 0.1, terrapieno: true, pietra: 0.55, dettaglio: 'alto', interrata: 0.7 });
    ctx.posa('velo', muro, piede.z, piede.theta, yv, { h: a.basso - 0.05, luogo: 'muretto_terrazza', tag: () => 'muro' });
    // riempimento dietro la testa (sottile striscia calpestabile alla quota del gradone)
    const dietro = spostaYaw(piede.z, piede.theta, yv + 180, 1.2, a.alto);
    costruisciRipiano(ctx, { zona: 'velo', nome: 'muretto_terrazza', z: dietro.z, theta: dietro.theta, yaw: yv, larghezza: 10, profondita: 1.8, quota: a.alto, superficie: 'erba', dettaglio: 'basso', luogo: 'muretto_terrazza' });
    ctx.occupa({ nome: 'muretto_terrazza', z: piede.z, theta: piede.theta, yaw: yv, larghezza: 11, profondita: 5 });
    const cima = spostaYaw(piede.z, piede.theta, yv + 180, 0.4, a.alto);
    ctx.punto('lancio_velo:muretto_terrazza', 'lancio_velo', 'Salta e apri il Velo', mondo(cima.z, cima.theta, a.alto + 0.2), { raggio: 2.5, luogo: 'muretto_terrazza', rif: 'suggerimento:velo' });
  }
  // 2. Muraglione della Grà: ripiano a 56 sopra il gradone a 52,5, faccia sul gradone a 49 (~8 m)
  {
    const l = luogo('muraglione_gra');
    const yv = yawValle(l.z, l.theta);
    // risale all'alzata alta e scende a quella bassa
    const quotaTop = Math.ceil((suolo(l.z, l.theta) + 0.2) / 3.5) * 3.5;
    let dFronte = 0;
    for (let d = 0; d < 20; d += 0.25) {
      const p = spostaYaw(l.z, l.theta, yv, d, quotaTop);
      if (suolo(p.z, p.theta) < quotaTop - 6.5) {
        dFronte = d;
        break;
      }
    }
    const D = dFronte + 3.0;
    const centro = spostaYaw(l.z, l.theta, yv, dFronte - D / 2, quotaTop);
    const r = costruisciRipiano(ctx, { zona: 'velo', nome: 'muraglione_gra', z: centro.z, theta: centro.theta, yaw: yv, larghezza: 13, profondita: D, quota: quotaTop, superficie: 'erba', parapetto: 0.9, senzaParapetto: ['fronte'], dettaglio: 'alto', luogo: 'muraglione_gra' });
    // parapetto con il varco per il lancio: due tratti ai lati del fronte
    for (const s of [-1, 1]) {
      const p = localeDa(centro.z, centro.theta, yv, s * 4.4, D / 2 - 0.45, quotaTop);
      const par = creaMuroSecco({ seme: `parapetto-gra-${s}`, percorso: [[-2.1, 0], [2.1, 0]], altezza: 0.95, spessore: 0.5, pietra: 0.42, dettaglio: 'alto', interrata: 0.2 });
      ctx.posa('velo', par, p.z, p.theta, yv, { h: quotaTop, tag: () => 'muro', luogo: 'muraglione_gra' });
    }
    // la vecchia grà sul ciglio (a Lag del varco)
    const pg = localeDa(centro.z, centro.theta, yv, -0.5 + 0, -D / 2 + 3.2, quotaTop);
    const pgg = spostaYaw(pg.z, pg.theta, 0, 9, quotaTop);
    // migliorie «porte»: la grà sta al piede del Muraglione, sul gradone di sotto, con la porta sul
    // prato (prima era alla quota del ripiano, 3,4 m sopra il prato, con la porta sul vuoto)
    const { oggetto: gra, base: baseGra, porta: portaGra } = oggettoSullaSoglia(() => creaGra('gra-muraglione', false), pgg.z, pgg.theta, yv, 4.4, 5.0, 2.2);
    ctx.posa('velo', gra, pgg.z, pgg.theta, yv, { h: baseGra, luogo: 'muraglione_gra', tag: (t) => t ?? 'muro' });
    if (portaGra) gradiniLuogo(ctx, ctx.zona('velo'), 'gra_muraglione', pgg.z, pgg.theta, baseGra, yv, portaGra, { luogo: 'muraglione_gra', seme: 985 });
    ctx.occupa({ nome: 'gra_muraglione', z: pgg.z, theta: pgg.theta, raggio: 4 });
    const lancio = localeDa(centro.z, centro.theta, yv, 0, D / 2 - 0.6, quotaTop);
    ctx.punto('lancio_velo:muraglione_gra', 'lancio_velo', 'Salta dal Muraglione e apri il Velo', mondo(lancio.z, lancio.theta, quotaTop + 0.2), { raggio: 2.5, luogo: 'muraglione_gra', rif: 'suggerimento:velo' });
    void r;
  }
  // 3. Ripa di San Vigilio: bastione di pietra sul gradone a 42 sopra la piazza
  {
    const l = luogo('ripa_san_vigilio');
    const piazza = luogo('piazza_ore');
    const yawR = 90; // la faccia guarda a Mane, verso la piazza
    const base = suolo(l.z, l.theta);
    const top = piazza.altezza + 12;
    const W = 16;
    const D = 7;
    const centro = sposta(l.z, l.theta, 0, 1.0, base);
    costruisciRipiano(ctx, { zona: 'velo', nome: 'ripa_san_vigilio', z: centro.z, theta: centro.theta, yaw: yawR, larghezza: W, profondita: D, quota: top, superficie: 'lastre', parapetto: 1.0, senzaParapetto: ['fronte', 'sinistra'], dettaglio: 'alto', luogo: 'ripa_san_vigilio' });
    // parapetto a Lag con il varco dove arriva la scala (in fondo, a Sera)
    {
      const p = localeDa(centro.z, centro.theta, yawR, -(W / 2 - 0.42), 1.1, top);
      const par = creaMuroSecco({ seme: 'parapetto-ripa-lag', percorso: [[0, -2.4], [0, 2.4]], altezza: 1.0, spessore: 0.5, pietra: 0.42, dettaglio: 'alto', interrata: 0.2 });
      ctx.posa('velo', par, p.z, p.theta, yawR, { h: top, tag: () => 'muro', luogo: 'ripa_san_vigilio' });
    }
    // parapetto del fronte con il varco centrale
    for (const s of [-1, 1]) {
      const p = localeDa(centro.z, centro.theta, yawR, s * 4.9, D / 2 - 0.45, top);
      const par = creaMuroSecco({ seme: `parapetto-ripa-${s}`, percorso: [[-2.9, 0], [2.9, 0]], altezza: 1.0, spessore: 0.5, pietra: 0.42, dettaglio: 'alto', interrata: 0.2 });
      ctx.posa('velo', par, p.z, p.theta, yawR, { h: top, tag: () => 'muro', luogo: 'ripa_san_vigilio' });
    }
    // scala sul fianco a Lag: sale verso Sera dal gradone fino alla quota della testa
    const kd = metriPerGrado(base);
    const zS = centro.z + W / 2 + 0.9;
    const a = { z: zS, theta: centro.theta + (D / 2 + 1.5) / kd };
    const bb = { z: zS, theta: centro.theta - (D / 2 - 1.2) / kd };
    scalinata(ctx.zona('velo'), a, bb, base, top, 1.6, 0.4, 'gradino', 'ripa_san_vigilio', 1036);
    // pianerottolo in cima che entra nel bastione
    costruisciRipiano(ctx, { zona: 'velo', nome: 'ripa_pianerottolo', z: zS - 0.2, theta: bb.theta - 0.8 / kd, yaw: yawR, larghezza: 2.2, profondita: 2.0, quota: top, superficie: 'lastre', dettaglio: 'basso', luogo: 'ripa_san_vigilio' });
    ctx.occupa({ nome: 'ripa_scala', z: zS, theta: (a.theta + bb.theta) / 2, yaw: yawR, larghezza: 2.6, profondita: D + 4 });
    // lanterna sul bastione (si vede dalla piazza di notte)
    const pl = localeDa(centro.z, centro.theta, yawR, -W / 2 + 0.6, D / 2 - 0.5, top);
    const lan = new Costruttore(1037);
    lan.aggiungi(geoCilindro(0.05, 0.06, 1.6, 6), { matrice: mat([0, 0, 0]), colore: 0x2e2c30 });
    lan.aggiungi(geoBoxC(0.3, 0.38, 0.3), { matrice: mat([0, 1.75, 0]), colore: 0xffd27a, canale: 'lume' });
    ctx.posa('velo', lan.costruisci('lanterna-ripa'), pl.z, pl.theta, 0, { h: top + 0.9, collider: false });
    const lancio = localeDa(centro.z, centro.theta, yawR, 0, D / 2 - 0.5, top);
    ctx.punto('lancio_velo:ripa_san_vigilio', 'lancio_velo', 'Salta dalla Ripa e plana in piazza', mondo(lancio.z, lancio.theta, top + 0.2), { raggio: 2.5, luogo: 'ripa_san_vigilio', rif: 'flag:planata:ripa_san_vigilio' });
  }
}
