/**
 * Capisaldi fuori dal nucleo e la rete notturna:
 * - Grà di Pian (essiccatoio con il fumo bianco dalle 6 alle 10) con il chiodo 37 murato nell'angolo
 *   e la legnaia dove c'era il castagno;
 * - Pilastro 4 al Pian dei Ricci (bronzo verde, disco bianco e rosso su un'asta di 6 m);
 * - Pilastro 6 sul Sass Grand (sperone di gneiss sopra il bastione della Finestra dei Ponti);
 * - Balcone dei Messi sul lobo del Tappo Sud (0,3 g): Pilastro 42, il capanno con i Veli rattoppati;
 * - i pilastri lontani visti di notte (`capisaldi.json → lontani_di_notte`) con i loro lumi
 *   permanenti (faro, lanterna della Torre dei Bugni, lumini delle nicchie e della croce d'alpe).
 * I chiodi del nucleo (2, 3, 5, 7, 8, 11) e il Pilastro 1 li posano i moduli dei loro luoghi.
 */
import * as THREE from 'three';
import { Costruttore, mat } from '../../oggetti/costruttore';
import { matriceSuperficie } from '../../oggetti/cilindro';
import { creaCaposaldo, creaPilastro } from '../../oggetti/oggetti/caposaldo';
import { geoBoxC, geoCilindro, geoSfera } from '../../oggetti/forme';
import { PALETTE } from '../../oggetti/palette';
import { cylinderAt } from '../../world/colliders';
import { LONTANI, RETE, luogo, type CaposaldoLontano } from '../contenuti';
import type { Contesto } from '../contesto';
import { creaCapanno, creaGra, creaMasso } from '../edifici';
import { costruisciRipiano } from '../ripiano';
import { impronta, mondo, spostaYaw, suolo, yawValle, yawVerso } from '../terreno';
import { isWindowTheta } from '../../world/terrain';
import { gradiniLuogo, oggettoSullaSoglia } from '../soglie';

export interface Fumo {
  gruppo: THREE.Object3D;
}

export function costruisciGraDiPian(ctx: Contesto): THREE.Object3D {
  const g0 = luogo('gra_di_pian');
  const cs37 = RETE.find((c) => c.id === 'cs_37')!;
  const yaw = yawValle(g0.z, g0.theta);
  // chiodo 37 murato nell'angolo: lo spigolo da cui si vedono il chiodo 3 (a Mane) e il Pilastro 4
  // (a Mont); la grà si sposta in modo che quello spigolo cada sul punto dei contenuti
  const cs3 = RETE.find((c) => c.id === 'cs_3')!;
  const cs4 = RETE.find((c) => c.id === 'cs_4')!;
  const rad = Math.PI / 180;
  const b3 = yawVerso(cs37, cs3);
  const b4 = yawVerso(cs37, cs4);
  const bis = Math.atan2(Math.sin(b3 * rad) + Math.sin(b4 * rad), Math.cos(b3 * rad) + Math.cos(b4 * rad)) / rad;
  const voluta = bis + 90;
  let migliore = { sx: 1, sz: 1, d: 1e9 };
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      // spigolo (X = sinistra: bussola yaw - 90; Z = avanti: bussola yaw)
      const bx = sx > 0 ? yaw - 90 : yaw + 90;
      const bz = sz > 0 ? yaw : yaw + 180;
      const dir = Math.atan2(Math.sin(bx * rad) + Math.sin(bz * rad), Math.cos(bx * rad) + Math.cos(bz * rad)) / rad;
      const d = Math.min(Math.abs(((dir - voluta + 540) % 360) - 180), Math.abs(((dir - voluta - 180 + 540) % 360) - 180));
      if (d < migliore.d) migliore = { sx, sz, d };
    }
  }
  const pAng = new THREE.Vector3(migliore.sx * 2.21, 1.1, migliore.sz * 2.52);
  // centro = chiodo − spigolo (X sinistra = bussola yaw − 90)
  const q = spostaYaw(cs37.z, cs37.theta, yaw, -pAng.z, 100);
  const g = spostaYaw(q.z, q.theta, yaw - 90, -pAng.x, 100);
  // migliorie «porte»: la soglia sul suolo davanti alla porta (prima 16 cm sotto)
  const { oggetto: gra, base, porta: portaGra } = oggettoSullaSoglia(() => creaGra('gra-di-pian', false), g.z, g.theta, yaw, 5.0, 5.6, 2.2);
  ctx.posa('selve', gra, g.z, g.theta, yaw, { h: base, luogo: 'gra_di_pian', tag: (t) => t ?? 'muro' });
  if (portaGra) gradiniLuogo(ctx, ctx.zona('selve'), 'gra_di_pian', g.z, g.theta, base, yaw, portaGra, { luogo: 'gra_di_pian', seme: 890 });
  ctx.occupa({ nome: 'gra_di_pian', z: g.z, theta: g.theta, yaw, larghezza: 6, profondita: 7 });
  const mG = matriceSuperficie(g.z, g.theta, base, yaw);
  const m = mG.clone().multiply(new THREE.Matrix4().makeTranslation(pAng.x, pAng.y, pAng.z)).multiply(new THREE.Matrix4().makeRotationX((migliore.sz * Math.PI) / 2));
  const ch = creaCaposaldo({ numero: 37, supporto: 'nessuno', segno: true });
  ctx.zona('selve').oggetto(ch, m, { tag: () => 'chiodo', luogo: 'gra_di_pian' });
  const angolo = pAng.clone().add(new THREE.Vector3(0, 0, migliore.sz * 0.06)).applyMatrix4(mG);
  ctx.punto('chiodo:37', 'pianta_squadro', 'Pianta lo squadro sul chiodo 37', angolo, { raggio: 1.8, luogo: 'gra_di_pian', rif: 'cs_37' });
  // legnaia dove c'era il castagno
  const lg = new Costruttore(890);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 9; k++) lg.aggiungi(geoCilindro(0.1, 0.1, 1.1, 6), { matrice: mat([-0.9 + k * 0.22, 0.12 + r * 0.2, 0], [Math.PI / 2, 0, 0]), colore: k % 2 ? 0x8a6a48 : 0x6e5236 });
  lg.aggiungi(geoBoxC(2.4, 0.08, 1.5), { matrice: mat([0, 1.4, 0], [0.15, 0, 0]), colore: PALETTE.legnoScuro, piatto: true });
  const pl = spostaYaw(g.z, g.theta, yaw + 90, 5, 100);
  ctx.posa('selve', lg.costruisci('legnaia'), pl.z, pl.theta, yaw, { collider: false });
  // fumo bianco dalle 6 alle 10 (gruppo dinamico, visibilità per ora)
  const fumo = new Costruttore(891);
  for (let k = 0; k < 7; k++) {
    const t = k / 6;
    fumo.aggiungi(geoSfera(0.5 + t * 1.3, 7, 5), { matrice: mat([0.2 + t * 1.8, 6.3 + t * 5, Math.sin(k) * 0.4]), colore: 0xf2efe8, canale: 'sottile' });
  }
  const gF = fumo.costruisci('fumo-gra');
  return posaDinamico(ctx, 'fumo_gra_di_pian', gF, g.z, g.theta, base, yaw);
}

function posaDinamico(ctx: Contesto, nome: string, o: THREE.Object3D, z: number, theta: number, h: number, yaw: number): THREE.Object3D {
  const g = new THREE.Group();
  g.name = nome;
  g.add(o);
  matriceSuperficie(z, theta, h, yaw).decompose(g.position, g.quaternion, g.scale);
  ctx.animato(nome, g);
  return g;
}

export function costruisciPilastriValle(ctx: Contesto): void {
  // Pilastro 4, Pian dei Ricci (disco su asta di 6 m) e Pilastro 6 sul Sass Grand (palina 8 m)
  for (const id of ['cs_4', 'cs_6'] as const) {
    const c = RETE.find((x) => x.id === id)!;
    const fp = impronta(c.z, c.theta, 0, 1.2, 1.2);
    let h = fp.max;
    if (id === 'cs_6') {
      // sperone di gneiss
      const sp = creaMasso('sass-grand', 3.2, 0.55);
      ctx.posa('selve', sp, c.z, c.theta, 20, { h: fp.min - 0.4, luogo: 'sass_grand', tag: () => 'roccia' });
      h = fp.min - 0.4 + 3.2 * 0.55 * 1.32 - 0.15;
    }
    const pil = creaPilastro({ numero: c.numero, segnale: id === 'cs_4' ? 'disco' : 'palina', altezzaSegnale: c.altezza_segnale, lumeDiMira: false });
    const pp = ctx.posa('selve', pil, c.z, c.theta, 200, { h: h + 0.35, luogo: c.luogo, tag: (t) => t ?? 'caposaldo' });
    if (pp['cima']) ctx.segnali.set(c.id, pp['cima'].clone());
    ctx.punto(`chiodo:${c.numero}`, 'pianta_squadro', `Pianta lo squadro sul Pilastro ${c.numero}`, pp['chiodo'] ?? mondo(c.z, c.theta, h + 1.8), { raggio: 1.8, luogo: c.luogo, rif: c.id });
    ctx.occupa({ nome: c.id, z: c.z, theta: c.theta, raggio: 2 });
  }
}

/** Balcone dei Messi: sperone sul lobo del Tappo Sud, Pilastro 42, capanno con i Veli rattoppati. */
export function costruisciBalcone(ctx: Contesto): void {
  const b = luogo('balcone_messi');
  // il Balcone guarda verso l'altra valle (a Mane, dove si «cade» nel Verbanetto) e verso l'asse
  const yaw = 90;
  const fp = impronta(b.z, b.theta, yaw, 9, 7);
  const H = fp.max + 0.2;
  costruisciRipiano(ctx, { zona: 'balcone', nome: 'balcone_messi', z: b.z, theta: b.theta, yaw, larghezza: 9, profondita: 7, quota: H, superficie: 'lastre', parapetto: 0.8, senzaParapetto: ['fronte'], dettaglio: 'basso', luogo: 'balcone_messi' });
  const pil = creaPilastro({ numero: 42, segnale: 'palina', altezzaSegnale: 8, lumeDiMira: true });
  const pfr = spostaYaw(b.z, b.theta, yaw, 2.6, H);
  const pfr2 = spostaYaw(pfr.z, pfr.theta, yaw - 90, 3.2, H);
  const pp = ctx.posa('balcone', pil, pfr2.z, pfr2.theta, 270, { h: H + 0.35, luogo: 'balcone_messi', tag: (t) => t ?? 'caposaldo' });
  if (pp['cima']) ctx.segnali.set('cs_42', pp['cima'].clone());
  ctx.punto('chiodo:42', 'pianta_squadro', 'Pianta lo squadro sul Pilastro 42', pp['chiodo'] ?? mondo(pfr2.z, pfr2.theta, H + 1.8), { raggio: 1.8, luogo: 'balcone_messi', rif: 'cs_42' });
  // il capanno sul retro del Balcone, dentro il parapetto, con la porta verso il Balcone. Migliorie
  // «porte»: prima stava 6,2 m dietro il centro, fuori dal ripiano (profondo 7): appeso cinque metri
  // sopra il pendio, con la porta contro il parapetto
  const pc = spostaYaw(b.z, b.theta, yaw + 180, 7 / 2 - 0.75 - 1.5, H);
  const capanno = creaCapanno('capanno-messi');
  const ppc = ctx.posa('balcone', capanno, pc.z, pc.theta, yaw, { h: H - 0.2, luogo: 'balcone_messi' });
  ctx.punto('leggi:motto_messi', 'leggi', 'Leggi il motto sulla porta', ppc['motto'] ?? mondo(pc.z, pc.theta, H + 1.5), { raggio: 2.2, luogo: 'balcone_messi', rif: 'motto_messi' });
  const lancio = spostaYaw(b.z, b.theta, yaw, 3.2, H);
  ctx.punto('lancio_velo:balcone_messi', 'lancio_velo', "Buttati nell'altra valle (aspetta che la nappina penda)", mondo(lancio.z, lancio.theta, H + 0.2), { raggio: 3, luogo: 'balcone_messi', rif: 'flag:atterrata_altra_valle' });
}

/** Pilastri lontani (rete di notte) con i loro lumi. Restituisce i lumi permanenti con nome. */
export function costruisciLontani(ctx: Contesto): Array<{ id: string; pos: THREE.Vector3; permanente: boolean }> {
  const out: Array<{ id: string; pos: THREE.Vector3; permanente: boolean }> = [];
  for (const c of LONTANI) {
    if (c.id === 'cs_0') {
      // il Caposaldo Zero è la soglia della Lanterna sull'asse: solo il punto (si appunta, resta bianco)
      ctx.punto('appunta:cs_0', 'guarda', 'Il disco della Lanterna', mondo(c.z, c.theta, c.altezza), { raggio: 0, rif: 'cs_0', attivo: false });
      ctx.segnali.set('cs_0', mondo(c.z, c.theta, c.altezza));
      continue;
    }
    const finestra = isWindowTheta(c.theta);
    const g = suolo(c.z, c.theta);
    // sulle Finestre il pilastro sta su un pilone di ferro alto `altezza` sopra il vetro
    const hBase = finestra ? g + c.altezza : g;
    const zona = `lontani:${c.id}`;
    if (finestra) {
      const pil = new Costruttore(c.numero);
      pil.aggiungi(geoBoxC(0.9, c.altezza, 0.9), { matrice: mat([0, c.altezza / 2, 0]), colore: PALETTE.ferro, piatto: true });
      for (let k = 0; k < 4; k++) pil.aggiungi(geoBoxC(1.6, 0.12, 0.12), { matrice: mat([0, 1 + k * (c.altezza / 4), 0], [0, k * 0.8, 0]), colore: PALETTE.ferro, piatto: true });
      // nicchia con il lumino
      pil.aggiungi(geoBoxC(1.4, 1.2, 1.0), { matrice: mat([0, c.altezza - 0.6, 0.6]), colore: PALETTE.gneissChiaro, piatto: true });
      ctx.posa(zona, pil.costruisci('pilone'), c.z, c.theta, 0, { h: g, tag: () => 'palo' });
    }
    const pilastro = creaPilastro({ numero: c.numero, segnale: 'palina', altezzaSegnale: 6, lumeDiMira: c.lume === 'permanente' });
    const pp = ctx.posa(zona, pilastro, c.z, c.theta, 0, { h: hBase + 0.35, tag: (t) => t ?? 'caposaldo', lumi: false });
    ctx.zona(zona).aggiungiCollider(cylinderAt(c.z, c.theta, hBase, 0.4, 1.6), 'caposaldo', c.id);
    // il lume del luogo: grande (si vede attraverso il cielo)
    const pLume = lumeLontano(c, pp['lume'] ?? mondo(c.z, c.theta, hBase + 8));
    if (c.lume === 'permanente') ctx.zona(zona).lume(pLume, 2.4);
    out.push({ id: c.id, pos: pLume, permanente: c.lume === 'permanente' });
    ctx.segnali.set(c.id, (pp['cima'] ?? pLume).clone());
    ctx.punto(`appunta:${c.id}`, 'guarda', c.nome, pLume, { raggio: 0, rif: c.id, attivo: false });
  }
  return out;
}

function lumeLontano(c: CaposaldoLontano, p: THREE.Vector3): THREE.Vector3 {
  void c;
  return p.clone();
}
