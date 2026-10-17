/**
 * I Ronchi e il riale: le casupole «non benedette» degli Smascherati (muri a secco rifatti, tetti di
 * frasche e lamiera), il mulino con la ruota ferma e il chiodo 7 sulla soglia, il Ponte del Mulino a
 * schiena d'asino, il guado del Sass (cinque pietre piatte), il fienile di Ottavio con la
 * finestrella sul prato e sul riale, il Sass dal Messo con il chiodo 8.
 * La casa di Nando (E2), il muro di Ronco (E3) e la passerella del Messo (E1) sono elementi mobili:
 * li costruisce `mobili.ts` con tutte le loro varianti.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../../oggetti/costruttore';
import { matriceSuperficie } from '../../oggetti/cilindro';
import { creaFienile } from '../../oggetti/oggetti/fienile';
import { creaCaposaldo } from '../../oggetti/oggetti/caposaldo';
import { geoBoxC, geoEstrusione, geoLastra } from '../../oggetti/forme';
import { PALETTE } from '../../oggetti/palette';
import { boxAt, cylinderAt } from '../../world/colliders';
import { RETE, luogo } from '../contenuti';
import type { Contesto } from '../contesto';
import { creaCasupola, creaMasso, creaMulino } from '../edifici';
import { metriPerGrado, mondo, sposta, spostaYaw, suolo, yawValle, yawVerso } from '../terreno';
import { rialeTheta } from '../../world/terrain';
import { posaChiodo } from './sanVigilio';
import { VERSI_TUTTI, gradiniLuogo, oggettoSullaSoglia, progettaGradini, zoneGradini, type ProgettoGradini } from '../soglie';
import { dentroImpronta, puntiRettangolo } from '../rettangoli';
import { improntaAperta } from '../verificaPorte';

/** Casupole dei Ronchi (oltre alla casa di Nando, che è mobile). */
export function costruisciRonchi(ctx: Contesto): void {
  const posti: Array<[number, number, number]> = [
    [1158, 43.3, 0],
    [1176, 43.6, 1],
    [1193, 44.4, 2],
    [1171, 48.0, 3],
  ];
  for (const [z, th, i] of posti) {
    const yaw0 = yawValle(z, th) + (i % 2 ? 12 : -10);
    const W = 4.2 + (i % 2) * 0.6;
    const D = 4.8 + (i % 3) * 0.4;
    const crea = (interrata: number) => creaCasupola({ seme: `ronco-${i}`, larghezza: W, profondita: D, interrata, finestraAccesa: i !== 2 });
    // migliorie «porte»: la soglia sul suolo davanti (prima la base era il suolo più basso: la porta di
    // casupola 0 restava mezza sepolta), e i gradini se davanti il suolo scende. Correzione dopo la
    // verifica: con la porta verso valle la casupola 0 aveva 13 gradini giù per l'alzata del gradone,
    // dentro il muro a secco della terrazza. La casupola può girarsi (la porta di lato, lungo la curva
    // di livello, o verso monte): si sceglie il verso con la scaletta più corta, che non va contro
    // impronte, luoghi o sentieri; a parità, verso valle come prima
    let scelta: { yaw: number; m: ReturnType<typeof oggettoSullaSoglia<ReturnType<typeof crea>>>; progetto: ProgettoGradini | null; costo: number } | null = null;
    for (const giro of [0, 90, -90, 180]) {
      const yaw = yaw0 + giro;
      const m = oggettoSullaSoglia(crea, z, th, yaw, W, D);
      const progetto = m.porta ? progettaGradini(z, th, m.base, yaw, m.porta, { inizio: 0.3 }) : null;
      const zone = m.porta && progetto ? zoneGradini(z, th, m.base, yaw, m.porta, progetto, 1.2, 1.8) : [];
      const occupate = zone.some((r) => puntiRettangolo(r, 0.4).some((pt) => ctx.impronte.some((imp) => !improntaAperta(imp.nome) && dentroImpronta(imp, pt)) || ctx.distanzaSentieri(pt.z, pt.theta) < 0.4));
      const costo = (progetto?.costo ?? 0) + (occupate ? 20 : 0) + (giro ? 0.4 : 0);
      if (!scelta || costo < scelta.costo) {
        scelta?.m.oggetto.dispose();
        scelta = { yaw, m, progetto, costo };
      } else m.oggetto.dispose();
    }
    const { yaw, m, progetto } = scelta!;
    const { oggetto: c, base, porta } = m;
    const punti = ctx.posa('ronchi', c, z, th, yaw, { h: base, luogo: 'i_ronchi', nome: `casupola_${i}`, tag: (t) => t ?? 'muro' });
    if (porta && progetto) gradiniLuogo(ctx, ctx.zona('ronchi'), `casupola_${i}`, z, th, base, yaw, porta, { luogo: 'i_ronchi', seme: 1160 + i, progetto });
    c.dispose();
    ctx.occupa({ nome: `casupola_${i}`, z, theta: th, yaw, larghezza: W + 1, profondita: D + 1.4 });
    void punti;
  }
  // orto dei Ronchi: aiuole di terra con file di cavoli e pali dei fagioli
  const orto = new Costruttore(1180);
  for (let r = 0; r < 4; r++) {
    orto.aggiungi(geoBoxC(5.5, 0.12, 0.9), { matrice: mat([0, 0.04, r * 1.3]), colore: 0x6a4e34, piatto: true });
    for (let k = 0; k < 7; k++) orto.aggiungi(new THREE.IcosahedronGeometry(0.22, 0), { matrice: mat([-2.4 + k * 0.8, 0.22, r * 1.3]), colore: r % 2 ? 0x5f7f3a : 0x7e9a4a, piatto: true });
  }
  for (let k = 0; k < 6; k++) orto.aggiungi(geoBoxC(0.04, 1.7, 0.04), { matrice: mat([-2.5 + k, 0.85, 5.3], [0, 0, (k % 2 ? 1 : -1) * 0.12]), colore: PALETTE.legno, piatto: true });
  // (migliorie «porte»: 2,5 m più in là di prima, perché la casa di Nando, salita sul gradone, ha
  // l'orto davanti alla porta)
  const po = { z: 1181.7, theta: 44.8 };
  ctx.posa('ronchi', orto.costruisci('orto-ronchi'), po.z, po.theta, yawValle(po.z, po.theta) + 90, { collider: false });
  ctx.occupa({ nome: 'orto_ronchi', z: po.z, theta: po.theta, raggio: 3.8 });
}

/** Mulino, ponte del Mulino, guado del Sass. */
export function costruisciRiale(ctx: Contesto): void {
  // mulino: porta e soglia a Mont (chiodo 7), ruota a Mane verso il riale
  const ml = luogo('mulino');
  const cs7 = RETE.find((c) => c.id === 'cs_7')!;
  const yaw = 0;
  const D = 6.8;
  // la soglia del mulino (chiodo 7) sta allo spigolo a Sera della facciata a Lag: da lì si vedono
  // sia il campanile (a Sera e a Mont) sia il Sass dal Messo (a Mane)
  const centro = spostaYaw(cs7.z, cs7.theta, yaw + 180, D / 2 + 0.75, 7);
  const c2 = spostaYaw(centro.z, centro.theta, yaw - 90, -1.95, 7);
  // migliorie «porte»: la soglia sul suolo più alto davanti alla porta (il suolo scende di traverso:
  // prima mezza porta era sepolta e l'altra metà sospesa), gradini dalla parte che scende
  const { oggetto: mulino, base, porta: portaMulino } = oggettoSullaSoglia(() => creaMulino('mulino-riale', true), c2.z, c2.theta, yaw, 5.6, 6.8, 2.0);
  const pm = ctx.posa('riale', mulino, c2.z, c2.theta, yaw, { h: base, luogo: 'mulino' });
  // correzione dopo la verifica: il suolo davanti alla porta scende di traverso (un metro sulla
  // larghezza dei gradini): i gradini dritti finivano sotto il prato da un fianco, e il pianerottolo
  // aveva un fianco alto più di un metro. La scaletta può scendere di lato, lungo la facciata, dal
  // pianerottolo della soglia del chiodo 7, con un muretto dove sotto c'è il salto
  if (portaMulino) gradiniLuogo(ctx, ctx.zona('riale'), 'mulino', c2.z, c2.theta, base, yaw, portaMulino, { luogo: 'mulino', seme: 1130, inizio: 1.27, versi: VERSI_TUTTI, gradiniMax: 16 });
  ctx.occupa({ nome: 'mulino', z: c2.z, theta: c2.theta, yaw, larghezza: 9.5, profondita: 8 });
  posaChiodo(ctx, 'riale', cs7.numero, cs7.z, cs7.theta, 'cs_7', 'mulino', base + 0.1);
  if (pm['porta']) ctx.punto('apri:porta_mulino', 'apri', 'Porta del mulino', pm['porta'], { raggio: 2, luogo: 'mulino' });
  if (pm['ruota']) ctx.punto('esamina:ruota_mulino', 'esamina', 'La ruota ferma', pm['ruota'], { raggio: 4, luogo: 'mulino' });
  void ml;

  // ponte del Mulino: schiena d'asino di pietra sul riale
  const pt = luogo('ponte_mulino');
  const thR = rialeTheta(pt.z);
  const kd = metriPerGrado(3);
  // sponde: dove il suolo torna sopra 2,8 m
  let a = 0;
  let bb = 0;
  for (let d = 1; d < 14; d += 0.25) {
    if (!a && suolo(pt.z, thR - d / kd) > 2.6) a = d;
    if (!bb && suolo(pt.z, thR + d / kd) > 2.6) bb = d;
  }
  a = a || 5;
  bb = bb || 5;
  const L = a + bb + 1.5;
  const cP = { z: pt.z, theta: thR + (bb - a) / 2 / kd };
  const hS = Math.min(suolo(pt.z, thR - a / kd), suolo(pt.z, thR + bb / kd));
  ponte(ctx, cP.z, cP.theta, hS - 0.3, L, 2.4);
  ctx.punto('attraversa:ponte_mulino', 'attraversa', 'Ponte del Mulino', mondo(cP.z, cP.theta, hS + 1.6), { raggio: 3, luogo: 'ponte_mulino', attivo: false });
  ctx.occupa({ nome: 'ponte_mulino', z: cP.z, theta: cP.theta, yaw: 90, larghezza: 3, profondita: L });

  // guado del Sass: cinque pietre piatte in fila
  const gs = luogo('guado_sass');
  const thG = rialeTheta(gs.z);
  for (let i = 0; i < 5; i++) {
    const th = thG + ((i - 2) * 1.15) / kd;
    const z = gs.z + (i % 2 ? 0.25 : -0.2);
    const h = suolo(z, th);
    const pietra = new Costruttore(1205 + i);
    pietra.aggiungi(geoLastra(0.95, 0.4, 0.85, 1205 + i, 0.12), { matrice: mat([0, 0.0, 0], [0, i * 0.7, 0]), colore: mescola(PALETTE.gneiss, PALETTE.gneissChiaro, (i % 3) * 0.3), variazione: 0.05, piatto: true });
    ctx.posa('riale', pietra.costruisci('pietra-guado'), z, th, 0, { h: h + 0.12, collider: false });
    ctx.zona('riale').aggiungiCollider(cylinderAt(z, th, h - 0.4, 0.45, 0.72, 'calpestabile'), 'calpestabile', 'guado_sass');
  }
  ctx.punto('attraversa:guado_sass', 'attraversa', 'Guado del Sass', mondo(gs.z, thG, suolo(gs.z, thG) + 0.4), { raggio: 3.5, luogo: 'guado_sass', attivo: false });
  ctx.occupa({ nome: 'guado_sass', z: gs.z, theta: thG, raggio: 3.5 });
}

/** Ponte a schiena d'asino (asse lungo theta). */
function ponte(ctx: Contesto, z: number, theta: number, hBase: number, L: number, larghezza: number): void {
  const b = new Costruttore(1100);
  const freccia = 1.9;
  const sp = 0.55;
  // profilo dell'arco: estradosso a schiena d'asino, intradosso a tutto sesto
  const forma = new THREE.Shape();
  const n = 12;
  forma.moveTo(-L / 2, -0.4);
  for (let i = 0; i <= n; i++) {
    const x = -L / 2 + (i / n) * L;
    forma.lineTo(x, freccia + sp - Math.pow(x / (L / 2), 2) * freccia);
  }
  forma.lineTo(L / 2, -0.4);
  const luce = L * 0.36;
  const buco = new THREE.Path();
  buco.moveTo(luce, -0.4);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI;
    buco.lineTo(Math.cos(a) * luce, -0.4 + Math.sin(a) * (freccia + 0.2));
  }
  buco.lineTo(luce, -0.4);
  forma.holes.push(buco);
  const g = geoEstrusione(forma, larghezza, 2);
  b.aggiungi(g, { matrice: mat([0, 0, 0], [0, Math.PI / 2, 0]), colore: PALETTE.gneiss, rumore: 0.07, piatto: true });
  // parapetti bassi
  for (const s of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const x0 = -L / 2 + (i / n) * L;
      const x1 = -L / 2 + ((i + 1) / n) * L;
      const y0 = freccia + sp - Math.pow(x0 / (L / 2), 2) * freccia;
      const y1 = freccia + sp - Math.pow(x1 / (L / 2), 2) * freccia;
      const xm = (x0 + x1) / 2;
      const ym = (y0 + y1) / 2;
      b.aggiungi(geoLastra(0.3, 0.55, Math.hypot(x1 - x0, y1 - y0) + 0.04, 1100 + i, 0.1), { matrice: mat([s * (larghezza / 2 - 0.15), ym + 0.25, xm], [Math.atan2(y1 - y0, x1 - x0) * -1, 0, 0]), colore: PALETTE.gneissChiaro, variazione: 0.06, piatto: true });
    }
  }
  // l'asse del ponte va lungo theta: yaw 90 porta +Z della libreria a Mane
  const m = matriceSuperficie(z, theta, hBase, 90);
  ctx.zona('riale').oggetto(b.costruisci('ponte-mulino'), m, { lumi: false });
  // collider: tratti calpestabili lungo la schiena
  const nC = 9;
  const kd = metriPerGrado(hBase);
  for (let i = 0; i < nC; i++) {
    const x = -L / 2 + ((i + 0.5) / nC) * L;
    const y = freccia + sp - Math.pow(x / (L / 2), 2) * freccia;
    ctx.zona('riale').aggiungiCollider(boxAt(z, theta + x / kd, hBase + y - 1.2, 90, larghezza - 0.3, 1.2, L / nC + 0.05), 'calpestabile', 'ponte_mulino');
  }
  for (const s of [-1, 1]) ctx.zona('riale').aggiungiCollider(boxAt(z + s * (larghezza / 2 - 0.15), theta, hBase, 90, 0.3, freccia + sp + 0.8, L), 'muro', 'ponte_mulino');
}

/** Fienile di Ottavio, Sass dal Messo con il chiodo 8. */
export function costruisciFienile(ctx: Contesto): void {
  const f = luogo('fienile_ottavio');
  const pas = luogo('passerella_messo');
  const yaw = yawVerso(f, pas);
  // migliorie «porte»: il fienile guarda la passerella, a monte: la porta della stalla stava quasi
  // due metri sotto il prato (si vedeva il fieno del portellone a filo d'erba). Ora la soglia è sul
  // prato davanti e il retro, più in basso, mostra la stalla di pietra intera
  const { oggetto: fienile, base, porta: portaStalla } = oggettoSullaSoglia(
    (interrata) => creaFienile({ seme: 'fienile-ottavio', larghezza: 6.2, profondita: 7.0, altezzaStalla: 2.4, altezzaFienile: 2.7, fieno: true, interrata, scivolo: false }),
    f.z,
    f.theta,
    yaw,
    6.4,
    7.2,
    0.8,
  );
  const punti = ctx.posa('fienile', fienile, f.z, f.theta, yaw, { h: base, luogo: 'fienile_ottavio' });
  if (portaStalla) gradiniLuogo(ctx, ctx.zona('fienile'), 'fienile_ottavio', f.z, f.theta, base, yaw, portaStalla, { luogo: 'fienile_ottavio', seme: 1176 });
  ctx.occupa({ nome: 'fienile_ottavio', z: f.z, theta: f.theta, yaw, larghezza: 7.4, profondita: 8.6 });
  // finestrella del fieno che guarda il prato e il riale, lume dentro
  const b = new Costruttore(1176);
  b.aggiungi(geoBoxC(0.55, 0.5, 0.05), { matrice: mat([-1.6, 3.55, 3.53]), colore: 0xf2c46e, canale: 'lume' });
  b.aggiungi(geoBoxC(0.75, 0.08, 0.2), { matrice: mat([-1.6, 3.25, 3.6]), colore: PALETTE.legnoScuro, piatto: true });
  ctx.zona('fienile').oggetto(b.costruisci('finestrella'), matriceSuperficie(f.z, f.theta, base, yaw), {});
  const porta = punti['porta'] ?? ctx.qui(f.z, f.theta, 0.2);
  ctx.punto('entra:fienile_ottavio', 'entra', 'Entra nel fienile', porta, { raggio: 2.2, luogo: 'fienile_ottavio' });
  ctx.punto('dormi:fienile_ottavio', 'dormi', 'Dormi nel fieno', porta.clone(), { raggio: 2.5, luogo: 'fienile_ottavio', rif: 'dormi:fino 05:30' });
  ctx.punto('guarda:finestrella_fienile', 'guarda', 'Guarda dalla finestrella', new THREE.Vector3(-1.6, 3.4, 3.2).applyMatrix4(matriceSuperficie(f.z, f.theta, base, yaw)), { raggio: 2.5, luogo: 'fienile_ottavio', attivo: false });
  // Sass dal Messo: masso tondo lisciato, chiodo 8 in cima
  const cs8 = RETE.find((c) => c.id === 'cs_8')!;
  const hs = suolo(cs8.z, cs8.theta);
  const masso = creaMasso('sass-dal-messo', 1.15, 0.72);
  const pm = ctx.posa('fienile', masso, cs8.z, cs8.theta, 30, { h: hs - 0.1, luogo: 'sass_messo' });
  const cima = pm['cima'] ?? mondo(cs8.z, cs8.theta, hs + 1.0);
  const hCima = suolo(cs8.z, cs8.theta) - 0.1 + 1.15 * 0.72 * 1.32 - 0.04;
  const ch = creaCaposaldo({ numero: 8, supporto: 'nessuno', segno: true });
  const pc = ctx.posa('fienile', ch, cs8.z, cs8.theta, 0, { h: hCima, luogo: 'sass_messo', tag: () => 'chiodo' });
  ctx.zona('fienile').aggiungiCollider(cylinderAt(cs8.z, cs8.theta, hCima - 0.05, 0.08, 0.08, 'chiodo'), 'chiodo', 'sass_messo');
  ctx.punto('chiodo:8', 'pianta_squadro', 'Pianta lo squadro sul chiodo 8', pc['chiodo'] ?? cima, { raggio: 1.8, luogo: 'sass_messo', rif: 'cs_8' });
  ctx.punto('siediti:sass_messo', 'siediti', 'Siediti sul Sass dal Messo', cima.clone(), { raggio: 2, luogo: 'sass_messo' });
  ctx.occupa({ nome: 'sass_messo', z: cs8.z, theta: cs8.theta, raggio: 1.6 });
  void sposta;
}
