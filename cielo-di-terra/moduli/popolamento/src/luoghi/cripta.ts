/**
 * La Cripta dei Giardinieri e il castagno morto.
 *
 * In superficie: il castagno secolare morto (corteccia grigia, rami spogli, ricci vuoti per terra,
 * gli amenti dell'ultima fioritura sui rami bassi, il ramo basso a Mane con la corteccia verde),
 * la botola di pietra cerchiata di ferro fra le radici (animata: si apre e si chiude), il cippo con
 * il chiodo 11 (graffi freschi), il muretto del belvedere con la pietra piatta per sedersi.
 *
 * La botola dei contenuti (1112, 27,0) cade sull'alzata del gradone (pendenza 29°): la botola sta
 * fra le radici al piede dell'alzata, 2,5 m dal tronco verso il punto dei contenuti, su un piccolo
 * ripiano di lastre (il punto «apri:botola» è lì).
 *
 * Sotto: la sala delle capsule (`costruisciInterno`), il corridoio di servizio e la scala alla
 * marinara, 4,5-6 m sotto il suolo come dicono i contenuti (le quote dei luoghi «interno» sono
 * profondità sotto il suolo della botola). Il motore cammina solo sul terreno: per entrare
 * l'integratore porta il giocatore in modalità interno (vedi README).
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../../../oggetti/src/costruttore';
import { matriceSuperficie } from '../../../oggetti/src/cilindro';
import { creaBotolaCripta, creaCastagnoMorto, type StatoBotola } from '../../../oggetti/src/oggetti/castagno';
import { creaMuroSecco } from '../../../oggetti/src/oggetti/muri';
import { geoBoxC, geoCiuffo, geoCilindro, geoLastra, geoTubo } from '../../../oggetti/src/forme';
import { PALETTE } from '../../../oggetti/src/palette';
import { box } from '../../../oggetti/src/comune';
import { colliderAlMondo } from '../../../oggetti/src/cilindro';
import type { Collider } from '../../../../src/world/colliders';
import { RETE, luogo } from '../contenuti';
import type { Contesto } from '../contesto';
import { creaErbaRicci } from '../edifici';
import { adattaOggetto } from '../materiali';
import type { MaterialiCantiere } from '../cantiere';
import { costruisciRipiano } from '../ripiano';
import { impronta, mondo, spostaYaw, suolo, yawValle, yawVerso } from '../terreno';
import { posaChiodo } from './sanVigilio';

export interface Cripta {
  /** apre/chiude la botola (animata) */
  apriBotola(aperta: boolean): void;
  readonly botolaAperta: boolean;
  /** posizione (z, theta, h) della botola e della sala */
  botola: { z: number; theta: number; h: number };
  sala: { z: number; theta: number; h: number };
  /** gruppo dell'interno (nascosto finché l'integratore non entra) */
  interno: THREE.Group;
  /** id dei collider che la botola chiusa aggiunge (da togliere quando è aperta) */
  colliderBotola: Collider[];
}

export function costruisciCripta(ctx: Contesto, mat: MaterialiCantiere): Cripta {
  const cm = luogo('castagno_morto');
  const bl = luogo('botola');
  const zona = 'cripta';
  const H = 12.5;
  const rT = H * 0.08;
  // il castagno guarda (davanti +Z) verso la botola dei contenuti
  const yaw = yawVerso(cm, bl);
  const baseT = suolo(cm.z, cm.theta) - 0.15;
  const castagno = creaCastagnoMorto({ seme: 'castagno-pedrazzini', altezza: H, cripta: false });
  const pc = ctx.posa(zona, castagno, cm.z, cm.theta, yaw, { h: baseT, luogo: 'castagno_morto' });
  void pc;
  castagno.dispose();
  ctx.occupa({ nome: 'castagno_morto', z: cm.z, theta: cm.theta, raggio: 3.2 });

  // ramo vivo basso a Mane, rami bassi con gli amenti, radici lunghe verso la botola
  const b = new Costruttore(4242);
  const yawMane = 90 - yaw; // direzione est nel riferimento del tronco (bussola → locale)
  const aM = (yawMane * Math.PI) / 180;
  // in coordinate della libreria: X = sinistra, Z = avanti; l'est in coordinate di bussola relativa all'avanti è
  const dirEst = new THREE.Vector3(-Math.sin(aM), 0, Math.cos(aM));
  void dirEst;
  const est = localeDaBussola(90 - yaw);
  const pRamo = [
    new THREE.Vector3(est.x * rT * 0.8, 2.3, est.z * rT * 0.8),
    new THREE.Vector3(est.x * 1.6, 2.55, est.z * 1.6),
    new THREE.Vector3(est.x * 2.7, 2.45, est.z * 2.7 + 0.2),
    new THREE.Vector3(est.x * 3.4, 2.2, est.z * 3.4 + 0.3),
  ];
  b.aggiungi(geoTubo(pRamo, [0.2, 0.14, 0.09, 0.05], 6, { chiudiFine: true }), { colore: 0x5f6e3c, rumore: 0.06 });
  for (let k = 0; k < 7; k++) {
    const t = 0.45 + (k / 6) * 0.55;
    const p = pRamo[2]!.clone().lerp(pRamo[3]!, t - 0.45).add(new THREE.Vector3((k % 3) * 0.18 - 0.18, 0.12 + (k % 2) * 0.1, (k % 2) * 0.2 - 0.1));
    b.aggiungi(geoCiuffo(0.24, 900 + k, 0.55), { matrice: mat(p, [0, k, 0]), colore: k % 2 ? 0x6f8f3a : 0x587a30, piatto: true });
  }
  // rami bassi morti con gli amenti appesi (a Sera e verso la botola)
  const rami: THREE.Vector3[][] = [];
  for (const [ang, h] of [
    [150, 3.0],
    [215, 2.7],
    [290, 3.3],
  ] as const) {
    const d = localeDaBussola(ang - yaw);
    const r = [new THREE.Vector3(d.x * rT, h, d.z * rT), new THREE.Vector3(d.x * 2.0, h + 0.4, d.z * 2.0), new THREE.Vector3(d.x * 3.4, h + 0.2, d.z * 3.4)];
    rami.push(r);
    b.aggiungi(geoTubo(r, [0.17, 0.1, 0.04], 5, { chiudiFine: true }), { colore: 0x8a8076 });
    for (let k = 0; k < 6; k++) {
      const p = r[1]!.clone().lerp(r[2]!, k / 6).add(new THREE.Vector3(0, -0.22, 0));
      const g = geoCiuffo(0.05, 300 + k, 4.5);
      b.aggiungi(g, { matrice: mat(p), colore: PALETTE.amenti, variazione: 0.06, piatto: true });
    }
  }
  // radici lunghe che scendono verso la botola
  const versoBotola = localeDaBussola(0); // avanti
  for (const off of [-0.55, 0.5]) {
    const lat = new THREE.Vector3(versoBotola.z, 0, -versoBotola.x).multiplyScalar(off);
    const pts = [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(versoBotola.x * (rT * 0.7 + i * 0.95) + lat.x * (1 + i * 0.3), 0.55 - i * 0.16, versoBotola.z * (rT * 0.7 + i * 0.95) + lat.z * (1 + i * 0.3)));
    b.aggiungi(geoTubo(pts, [0.42, 0.32, 0.24, 0.16, 0.07], 6, { chiudiFine: true }), { colore: 0x8a8177 });
  }
  ctx.zona(zona).oggetto(b.costruisci('castagno-dettagli'), matriceSuperficie(cm.z, cm.theta, baseT, yaw), { lumi: false });
  // ricci vuoti ed erba fredda
  ctx.posa(zona, creaErbaRicci('ricci-castagno-morto', 5.5, 26, 60), cm.z, cm.theta, 0, { collider: false });

  // botola fra le radici: 2,5 m dal tronco verso il punto dei contenuti
  const pb = spostaYaw(cm.z, cm.theta, yaw, rT * 0.6 + 1.9, 46);
  const fp = impronta(pb.z, pb.theta, yaw, 2.4, 2.4);
  const hB = fp.max + 0.04;
  costruisciRipiano(ctx, { zona, nome: 'ripiano_botola', z: pb.z, theta: pb.theta, yaw, larghezza: 3.2, profondita: 3.2, quota: hB - 0.02, superficie: 'lastre', dettaglio: 'alto', luogo: 'botola', collider: false });
  const botola = creaBotolaCripta({ seme: 'botola-cripta', apertaAllInizio: false, boccaBuia: true });
  adattaOggetto(botola.gruppo, mat);
  const gB = new THREE.Group();
  gB.name = 'botola-cripta';
  gB.add(botola.gruppo);
  const mB = matriceSuperficie(pb.z, pb.theta, hB, yaw + 180);
  mB.decompose(gB.position, gB.quaternion, gB.scale);
  const stato: StatoBotola = { aperta: false };
  ctx.animato('botola', gB, (dt) => botola.update?.(dt, stato));
  const colliderBotola: Collider[] = [];
  for (const c of botola.collider) {
    const cw = { ...colliderAlMondo(c, mB), id: -1, tag: 'botola' } as Collider;
    colliderBotola.push(cw);
    ctx.colliderDinamici.push({ collider: cw, tag: 'botola', luogo: 'botola' });
  }
  ctx.occupa({ nome: 'botola', z: pb.z, theta: pb.theta, raggio: 1.8 });
  const pBotola = mondo(pb.z, pb.theta, hB + 0.15);
  ctx.punto('apri:botola', 'apri', 'Apri la botola', pBotola, { raggio: 2.2, luogo: 'botola', rif: 'botola' });
  ctx.punto('entra:cripta', 'entra', 'Scendi nella Cripta', pBotola.clone(), { raggio: 1.6, luogo: 'botola', rif: 'cripta_scala', attivo: false });

  // punti della lente e del castagno
  const tronco = mondo(cm.z, cm.theta, baseT + 1.4);
  ctx.punto('esamina:castagno_morto', 'esamina', 'Il castagno morto', tronco, { raggio: 3.2, luogo: 'castagno_morto' });
  ctx.punto('lente:corteccia', 'lente', 'Lente: la corteccia', tronco.clone(), { raggio: 2.4, luogo: 'castagno_morto', rif: 'flag:lente:corteccia' });
  const pR = spostaYaw(cm.z, cm.theta, yaw + 140, 2.6, 46);
  ctx.punto('lente:ricci', 'lente', 'Lente: i ricci vuoti', mondo(pR.z, pR.theta, suolo(pR.z, pR.theta) + 0.05), { raggio: 2.4, luogo: 'castagno_morto', rif: 'flag:lente:ricci' });
  const mT = matriceSuperficie(cm.z, cm.theta, baseT, yaw);
  ctx.punto('lente:amenti', 'lente', 'Lente: gli amenti', rami[0]![1]!.clone().add(new THREE.Vector3(0, -0.25, 0)).applyMatrix4(mT), { raggio: 2.6, luogo: 'castagno_morto', rif: 'flag:lente:amenti' });
  ctx.punto('taglia:ramo_vivo', 'taglia', 'Taglia una marza dal ramo vivo', pRamo[2]!.clone().applyMatrix4(mT), { raggio: 2.6, luogo: 'castagno_morto', rif: 'oggetto:marza_pedrazzini' });

  // cippo della Cripta: masso squadrato con il chiodo 11
  const cs11 = RETE.find((c) => c.id === 'cs_11')!;
  const fpc = impronta(cs11.z, cs11.theta, 0, 0.9, 0.9);
  const bc = new Costruttore(1111);
  bc.aggiungi(geoLastra(0.78, 0.95 + (fpc.max - fpc.min), 0.72, 1111, 0.07), { matrice: mat([0, (0.95 + (fpc.max - fpc.min)) / 2 - (fpc.max - fpc.min) - 0.1, 0], [0, 0.4, 0]), colore: mescola(PALETTE.gneiss, PALETTE.muschio, 0.15), gradiente: { basso: 0.7, alto: 1.05, y0: -0.5, y1: 0.85 }, piatto: true });
  ctx.zona(zona).oggetto(bc.costruisci('cippo'), matriceSuperficie(cs11.z, cs11.theta, fpc.max, yawValle(cs11.z, cs11.theta)), { lumi: false });
  ctx.zona(zona).aggiungiCollider(boxCippo(cs11.z, cs11.theta, fpc.min - 0.2, fpc.max + 0.75), 'caposaldo', 'cippo_cripta');
  posaChiodo(ctx, zona, 11, cs11.z, cs11.theta, 'cs_11', 'cippo_cripta', fpc.max + 0.75);
  ctx.punto('lente:cippo', 'lente', 'Lente: i graffi sul chiodo 11', mondo(cs11.z, cs11.theta, fpc.max + 0.8), { raggio: 1.8, luogo: 'cippo_cripta', rif: 'flag:lente:cippo' });
  ctx.occupa({ nome: 'cippo_cripta', z: cs11.z, theta: cs11.theta, raggio: 1.2 });

  // muretto del belvedere sul ciglio della prima terrazza, con la pietra piatta
  const bv = luogo('belvedere_muretto');
  const yv = yawValle(bv.z, bv.theta);
  const pv = spostaYaw(bv.z, bv.theta, yv, 0.0, 42);
  const hv = suolo(pv.z, pv.theta);
  const muretto = creaMuroSecco({ seme: 'belvedere', percorso: [[-3.5, 0], [3.5, 0]], altezza: 0.75, spessore: 0.65, pietra: 0.4, dettaglio: 'alto', interrata: 0.4 });
  ctx.posa(zona, muretto, pv.z, pv.theta, yv, { h: hv, luogo: 'belvedere_muretto', tag: () => 'muro' });
  const bs = new Costruttore(4343);
  bs.aggiungi(geoLastra(1.2, 0.12, 0.75, 4343, 0.08), { matrice: mat([0.6, 0.8, -0.3]), colore: PALETTE.gneissChiaro, piatto: true });
  ctx.zona(zona).oggetto(bs.costruisci('pietra-seduta'), matriceSuperficie(pv.z, pv.theta, hv, yv), { lumi: false });
  ctx.occupa({ nome: 'belvedere_muretto', z: pv.z, theta: pv.theta, yaw: yv + 90, larghezza: 7.5, profondita: 1.6 });
  ctx.punto('siediti:belvedere', 'siediti', 'Siediti sul muretto a respirare', mondo(pv.z, pv.theta, hv + 0.85), { raggio: 2.5, luogo: 'belvedere_muretto', rif: 'flag:seduta' });

  // la Cripta sotto
  const interno = costruisciInterno(pb.z, pb.theta, hB, yaw);
  interno.visible = false;
  ctx.dinamici.add(interno);
  const sala = spostaYaw(pb.z, pb.theta, yaw, 7.5, hB);

  let aperta = false;
  return {
    apriBotola(a: boolean) {
      aperta = a;
      stato.aperta = a;
      const p = ctx.punti.get('entra:cripta');
      if (p) p.attivo = a;
    },
    get botolaAperta() {
      return aperta;
    },
    botola: { z: pb.z, theta: pb.theta, h: hB },
    sala: { z: sala.z, theta: sala.theta, h: hB - 6 },
    interno,
    colliderBotola,
  };
}

/** Direzione locale (X sinistra, Z avanti) di una bussola relativa all'avanti (gradi). */
function localeDaBussola(gradiRelativi: number): THREE.Vector3 {
  const a = (gradiRelativi * Math.PI) / 180;
  // avanti = +Z; destra (bussola +90) = −X nella libreria
  return new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
}

function boxCippo(z: number, theta: number, h0: number, h1: number): Collider {
  const m = matriceSuperficie(z, theta, h0, 0);
  return { ...colliderAlMondo(box(0, (h1 - h0) / 2, 0, 0.42, (h1 - h0) / 2, 0.4, 'caposaldo'), m), id: -1, tag: 'caposaldo' } as Collider;
}

/**
 * Interno della Cripta (sotto la botola): pozzo con la scala alla marinara, corridoio di segmenti di
 * ferro con gli orari dipinti, sala a volta con le sette capsule in semicerchio, luci color miele.
 * Materiale proprio (luce cotta nei colori per vertice): il sole della Linea qui non arriva.
 */
function costruisciInterno(z: number, theta: number, hBotola: number, yaw: number): THREE.Group {
  const b = new Costruttore(2121);
  const fondo = -6.0; // pavimento sotto la botola
  // pozzo e scala (i pioli li ha la botola fino a −2,4)
  b.aggiungi(geoBoxC(1.3, 4.0, 0.12), { matrice: mat([0, fondo + 2.0, -0.7]), colore: 0x4a4440, piatto: true });
  for (let i = 0; i < 6; i++) b.aggiungi(geoBoxC(0.5, 0.04, 0.04), { matrice: mat([0, fondo + 0.4 + i * 0.32, 0.45]), colore: PALETTE.ferro, piatto: true });
  // corridoio verso −Z (lungo 6 m): segmenti di ferro
  const lc = 6.0;
  for (let k = 0; k <= 6; k++) {
    const zz = -0.6 - k * 1.0;
    b.aggiungi(new THREE.TorusGeometry(1.15, 0.06, 4, 12, Math.PI), { matrice: mat([0, fondo + 1.0, zz]), colore: 0x5a524a, piatto: true });
  }
  b.aggiungi(geoBoxC(2.3, 0.1, lc), { matrice: mat([0, fondo, -0.6 - lc / 2]), colore: 0x4f4943, piatto: true });
  for (const s of [-1, 1]) b.aggiungi(geoBoxC(0.1, 1.0, lc), { matrice: mat([s * 1.15, fondo + 0.5, -0.6 - lc / 2]), colore: 0x6a625a, piatto: true });
  const volta = new THREE.CylinderGeometry(1.15, 1.15, lc, 10, 1, true, -Math.PI / 2, Math.PI);
  volta.rotateX(Math.PI / 2);
  b.aggiungi(volta, { matrice: mat([0, fondo + 1.0, -0.6 - lc / 2], [0, 0, Math.PI / 2]), colore: 0x7b7168, canale: 'sottile' });
  // orari dipinti (righe chiare sul ferro) e la scritta a gesso
  for (let r = 0; r < 4; r++) b.aggiungi(geoBoxC(0.01, 0.05, 1.4 - r * 0.2), { matrice: mat([1.09, fondo + 1.5 - r * 0.12, -3.0]), colore: 0xd8c9a0 });
  for (let r = 0; r < 2; r++) b.aggiungi(geoBoxC(0.01, 0.04, 1.2), { matrice: mat([-1.09, fondo + 1.2 - r * 0.1, -4.2]), colore: 0xf0ede6 });
  // sala a volta (centro a −7,5)
  const zs = -7.5;
  const R = 5.0;
  const sala = new THREE.CylinderGeometry(R, R, 9, 16, 1, true, -Math.PI / 2, Math.PI);
  sala.rotateX(Math.PI / 2);
  b.aggiungi(sala, { matrice: mat([0, fondo + 0.4, zs], [0, 0, Math.PI / 2]), colore: 0x8a8076, canale: 'sottile' });
  b.aggiungi(geoBoxC(2 * R, 0.12, 9), { matrice: mat([0, fondo - 0.06, zs]), colore: 0x5d564f, piatto: true });
  for (const s of [-1, 1]) b.aggiungi(geoBoxC(2 * R, 5.4, 0.2), { matrice: mat([0, fondo + 2.7, zs + s * 4.5]), colore: 0x766d64, piatto: true });
  // sette capsule in semicerchio (aperte verso il centro della sala)
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (i / 6) * 0.76);
    const cx = Math.cos(a) * 3.4;
    const cz = zs - Math.sin(a) * 3.0 + 1.2;
    const rot = Math.atan2(cx, cz - (zs + 1.2)) + Math.PI / 2;
    const m = mat([cx, fondo, cz], [0, rot, 0]);
    b.aggiungi(geoBoxC(2.3, 0.7, 1.0), { matrice: m.clone().multiply(mat([0, 0.35, 0])), colore: 0xc9c3b6, piatto: true });
    b.aggiungi(geoBoxC(2.1, 0.5, 0.8), { matrice: m.clone().multiply(mat([0, 0.62, 0])), colore: i === 4 || i === 0 || i === 3 ? 0x3a3a3e : 0x6f8890, piatto: true });
    // coperchio di vetro (la n. 5 sollevato)
    const aperto = i === 4 || i === 0;
    b.aggiungi(geoBoxC(2.1, 0.06, 0.8), { matrice: m.clone().multiply(mat(aperto ? [0, 1.25, -0.45] : [0, 0.9, 0], [aperto ? -1.1 : 0, 0, 0])), colore: 0xb8d4dc, canale: 'sottile' });
    // targhetta di smalto e display
    b.aggiungi(geoBoxC(0.3, 0.12, 0.01), { matrice: m.clone().multiply(mat([0.7, 0.45, 0.51])), colore: 0xf2efe8 });
    b.aggiungi(geoBoxC(0.22, 0.1, 0.01), { matrice: m.clone().multiply(mat([-0.7, 0.55, 0.51])), colore: i === 4 ? 0xf0b85a : 0x2a3a3a, canale: i === 4 ? 'lume' : 'opaco' });
    // tubi con la condensa
    b.aggiungi(geoCilindro(0.05, 0.05, 2.6, 6), { matrice: m.clone().multiply(mat([1.0, 0.9, -0.45])), colore: 0x8a8f94 });
  }
  // urna di rame (n. 2) e corona secca (n. 3)
  b.aggiungi(geoCilindro(0.12, 0.18, 0.4, 8), { matrice: mat([Math.cos(Math.PI * 0.247) * 3.4, fondo + 0.95, zs - Math.sin(Math.PI * 0.247) * 3.0 + 1.2]), colore: PALETTE.rame ?? 0xb0683a });
  b.aggiungi(new THREE.TorusGeometry(0.35, 0.07, 4, 10), { matrice: mat([Math.cos(Math.PI * 0.373) * 3.4, fondo + 0.98, zs - Math.sin(Math.PI * 0.373) * 3.0 + 1.2], [Math.PI / 2, 0, 0]), colore: 0x7a6a40 });
  // armadietto n. 5
  b.aggiungi(geoBoxC(0.7, 1.9, 0.5), { matrice: mat([3.7, fondo + 0.95, zs + 3.6]), colore: 0x6d7a72, piatto: true });
  // luci di servizio color miele
  const luci: THREE.Vector3[] = [];
  for (const [x, y, zz] of [
    [0, fondo + 3.8, zs],
    [-3, fondo + 2.8, zs - 1],
    [3, fondo + 2.8, zs - 1],
    [0, fondo + 1.9, -3.0],
  ] as const) {
    b.aggiungi(geoBoxC(0.3, 0.12, 0.3), { matrice: mat([x, y, zz]), colore: 0xffcf80, canale: 'lume' });
    luci.push(new THREE.Vector3(x, y, zz));
  }
  const gruppo = b.costruisci('cripta-interno');
  // luce cotta: ambiente scuro + luci color miele (materiale non illuminato)
  const miele = new THREE.Color(1.0, 0.78, 0.45);
  const lb = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  lb.name = 'cripta-luce-cotta';
  gruppo.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const col = g.getAttribute('color') as THREE.BufferAttribute;
    const lume = m.userData['canale'] === 'lume';
    const c = new THREE.Color();
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace);
      const s = { r: 0, g: 0, b: 0 };
      c.getRGB(s, THREE.SRGBColorSpace);
      if (lume) {
        col.setXYZ(i, Math.min(1, s.r * 1.2), Math.min(1, s.g * 1.1), s.b);
        continue;
      }
      p.fromBufferAttribute(pos, i);
      if (nor) n.fromBufferAttribute(nor, i);
      let k = 0.16;
      for (const l of luci) {
        const d = l.distanceTo(p);
        const dir = l.clone().sub(p).normalize();
        k += (Math.max(0.25, Math.abs(dir.dot(n))) * 2.2) / (1 + d * d * 0.12);
      }
      col.setXYZ(i, Math.min(1, s.r * k * miele.r), Math.min(1, s.g * k * miele.g), Math.min(1, s.b * k * miele.b));
    }
    col.needsUpdate = true;
    m.material = lb;
  });
  const radice = new THREE.Group();
  radice.name = 'cripta-interno';
  radice.add(gruppo);
  const mI = matriceSuperficie(z, theta, hBotola, yaw + 180);
  mI.decompose(radice.position, radice.quaternion, radice.scale);
  radice.userData['luci'] = luci.map((l) => l.clone().applyMatrix4(mI));
  return radice;
}
