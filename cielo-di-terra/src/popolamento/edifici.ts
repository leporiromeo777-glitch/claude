/**
 * Edifici e arredi di Corbella che la libreria `oggetti` non ha: la chiesa di San Vigilio, il
 * lavatoio coperto, la Bacheca delle Ore, il telo dell'Ombrista, panche, il tasso del sagrato,
 * il mulino, la grà, il capanno dei Messi, le casupole dei Ronchi.
 *
 * Tutti costruiti con il Costruttore della libreria (colori per vertice, pietre e piode con le
 * stesse forme e la stessa palette) e restituiti come `OggettoProcedurale`: davanti = +Z,
 * su = +Y, X locale = sinistra (convenzione della libreria), suolo a y = 0.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../oggetti/costruttore';
import { box, cil, ingombroDa, risultato } from '../oggetti/comune';
import { formaArco, geoBoxC, geoCilindro, geoCiuffo, geoCono, geoEstrusione, geoLastra, geoMassa, geoMasso, geoPiano, geoSfera, geoTubo } from '../oggetti/forme';
import { PALETTE } from '../oggetti/palette';
import { Rng, semeNumerico, type Seme } from '../oggetti/rng';
import type { Collider, OggettoProcedurale } from '../oggetti/tipi';
import { facciata, finestra, inF, porta, tettoPiode } from '../oggetti/oggetti/dettagli';
import { SUP, legnoOrizzontale, legnoVerticale, occlusionePiede, sup } from '../oggetti/superfici';
import { testaLanterna } from '../oggetti/oggetti/lumi';

/** Prisma triangolare (timpano) largo w, alto h, profondo d, base a y = 0. */
function geoTimpano(w: number, h: number, d: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(0, h);
  s.lineTo(-w / 2, 0);
  return geoEstrusione(s, d, 1);
}

// ---------------------------------------------------------------- chiesa

export interface OpzioniChiesa {
  seme?: Seme;
  larghezza?: number;
  lunghezza?: number;
  altezza?: number;
  /** quanto scendono i muri sotto y = 0 (zoccolo nel pendio) */
  interrata?: number;
}

/**
 * San Vigilio: chiesa romanica a navata unica, muri bianchi di calce, tetto di piode, portale
 * basso ad arco con la lunetta, oculo, monofore strette, abside semicircolare a −Z con il tetto a
 * mezzo cono. Accanto al portale la bacheca delle Lettere dalla Sorella.
 */
export function creaChiesa(opz: OpzioniChiesa = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'san-vigilio-chiesa');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const W = opz.larghezza ?? 7.6;
  const L = opz.lunghezza ?? 13.5;
  const H = opz.altezza ?? 6.4;
  const interr = opz.interrata ?? 2.5;
  const p = THREE.MathUtils.degToRad(29);
  // calce sbiadita (avorio caldo); cornici, lesene e fasce dipinte d'ocra
  const calce = mescola(PALETTE.calce, PALETTE.intonacoVecchio, 0.3);
  const ocra = mescola(PALETTE.ocraIntonaco, PALETTE.calce, 0.2);
  const supCalce = sup(SUP.INTONACO, rng.next());
  // zoccolo di gneiss
  b.aggiungi(geoBoxC(W + 0.24, 0.8 + interr, L + 0.24), { matrice: mat([0, (0.8 - interr) / 2, 0]), colore: mescola(PALETTE.gneiss, PALETTE.gneissCaldo, 0.4), gradiente: { basso: 0.65, alto: 0.95, y0: -interr, y1: 0.8 }, rumore: 0.06, piatto: true, superficie: sup(SUP.PIETRA, rng.next()), occlusione: occlusionePiede(0.8, 0.5) });
  // muri di calce
  b.aggiungi(geoBoxC(W, H, L), { matrice: mat([0, H / 2, 0]), colore: calce, gradiente: { basso: 0.86, alto: 1.02, y0: 0, y1: H }, rumore: 0.025, superficie: supCalce, occlusione: occlusionePiede(1.4, 0.3) });
  // timpani e sottotetto
  const hT = (W / 2) * Math.tan(p);
  b.aggiungi(geoTimpano(W, hT, L), { matrice: mat([0, H, 0]), colore: calce, gradiente: { basso: 0.95, alto: 1.02, y0: H, y1: H + hT }, superficie: supCalce });
  // cornice di gronda d'ocra e lesene d'angolo
  for (const s of [-1, 1]) b.aggiungi(geoBoxC(0.22, 0.24, L + 0.1), { matrice: mat([s * (W / 2 + 0.05), H - 0.08, 0]), colore: ocra, piatto: true, superficie: supCalce, occlusione: 0.15 });
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    b.aggiungi(geoBoxC(0.46, H - 0.8, 0.46), { matrice: mat([sx * (W / 2 - 0.2), 0.8 + (H - 0.8) / 2, sz * (L / 2 - 0.2)]), colore: ocra, piatto: true, superficie: supCalce });
  }
  // fascia d'ocra sotto il timpano della facciata
  b.aggiungi(geoBoxC(W + 0.08, 0.2, 0.08), { matrice: mat([0, H - 0.1, L / 2 + 0.02]), colore: ocra, piatto: true, superficie: supCalce });
  // tetto di piode
  const yColmo = tettoPiode(b, rng, { larghezza: W, profondita: L, yGronda: H, pendenza: p, sporgenzaGronda: 0.55, sporgenzaTimpano: 0.35, corsi: 5, pezziPerCorso: 8 });
  // facciata (+Z): portale ad arco, lunetta, oculo, croce
  const f = facciata(0, L / 2, 0);
  porta(b, f, 0, 0, 1.5, 2.35, PALETTE.legnoScuro);
  // riquadro d'ocra attorno al portale, arco di pietra e lunetta affrescata (il santo sbiadito)
  b.aggiungi(geoBoxC(2.7, 3.9, 0.02), { matrice: inF(f, 0, 1.95, 0.004), colore: mescola(ocra, calce, 0.35), piatto: true, superficie: supCalce });
  const arco = new THREE.ShapeGeometry(formaArco(1.5, 0.75 + 0.75, 8));
  arco.deleteAttribute('uv');
  b.aggiungi(new THREE.CircleGeometry(0.75, 10, 0, Math.PI), { matrice: inF(f, 0, 2.6, 0.016), colore: 0x8e6a4a, superficie: supCalce });
  b.aggiungi(new THREE.CircleGeometry(0.42, 8, 0, Math.PI), { matrice: inF(f, 0, 2.62, 0.02), colore: 0xc9b07a, superficie: supCalce });
  b.aggiungi(new THREE.CircleGeometry(0.13, 8), { matrice: inF(f, 0, 2.95, 0.024), colore: 0xe6c779, superficie: sup(SUP.NESSUNA) });
  b.aggiungi(new THREE.TorusGeometry(0.86, 0.1, 4, 12, Math.PI), { matrice: inF(f, 0, 2.6, 0.04), colore: PALETTE.gneissChiaro, piatto: true, superficie: sup(SUP.PIETRA, 0.3) });
  // protiro: tettuccio di piode sopra il portale su due mensole
  b.aggiungi(geoLastra(2.4, 0.14, 1.3, rng.intero(0, 1e6), 0.06), { matrice: inF(f, 0, 3.75, 0.55, [-0.38, 0, 0]), colore: PALETTE.piode, variazione: 0.08, piatto: true, superficie: sup(SUP.PIODE, 0.2) });
  for (const s of [-1, 1]) b.aggiungi(geoBoxC(0.14, 0.14, 0.9), { matrice: inF(f, s * 1.05, 3.42, 0.42, [-0.5, 0, 0]), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.3), occlusione: 0.3 });
  // oculo (vetro acceso di notte) e cornice
  b.aggiungi(new THREE.CircleGeometry(0.42, 12), { matrice: inF(f, 0, H + hT * 0.35, 0.012), colore: 0xffcf7a, canale: 'lume', superficie: SUP.VETRO });
  b.aggiungi(new THREE.TorusGeometry(0.47, 0.08, 4, 14), { matrice: inF(f, 0, H + hT * 0.35, 0.03), colore: PALETTE.gneissChiaro, piatto: true, superficie: sup(SUP.PIETRA, 0.5) });
  // croce di ferro sul colmo della facciata
  b.aggiungi(geoBoxC(0.07, 1.1, 0.07), { matrice: mat([0, yColmo + 0.75, L / 2 + 0.2]), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO });
  b.aggiungi(geoBoxC(0.55, 0.07, 0.07), { matrice: mat([0, yColmo + 0.95, L / 2 + 0.2]), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO });
  // meridiana dipinta sul fianco a sud (+X): riquadro d'ocra con le linee delle ore e lo gnomone
  {
    const fm = facciata(W / 2, 0, Math.PI / 2);
    const um = L * 0.18;
    const vm = H * 0.62;
    b.aggiungi(geoBoxC(1.6, 1.3, 0.02), { matrice: inF(fm, um, vm, 0.006), colore: PALETTE.ocraIntonacoChiaro, piatto: true, superficie: supCalce });
    b.aggiungi(geoBoxC(1.72, 1.42, 0.015), { matrice: inF(fm, um, vm, 0.003), colore: 0x8a5a3a, piatto: true, superficie: supCalce });
    for (let k = -4; k <= 4; k++) {
      const a = (k / 4) * 1.15;
      const l = 0.62 / Math.max(0.55, Math.cos(a));
      b.aggiungi(geoPiano(0.018, Math.min(0.62, l)), { matrice: inF(fm, um + Math.sin(a) * 0.3, vm + 0.5 - Math.cos(a) * 0.3, 0.018, [0, 0, a]), colore: 0x5a3a2a, superficie: sup(SUP.NESSUNA) });
    }
    b.aggiungi(new THREE.CircleGeometry(0.11, 8), { matrice: inF(fm, um, vm + 0.42, 0.02), colore: 0xb8463a, superficie: sup(SUP.NESSUNA) });
    b.aggiungi(geoBoxC(0.02, 0.02, 0.45), { matrice: inF(fm, um, vm + 0.42, 0.2, [-0.6, 0, 0]), colore: PALETTE.ferro, piatto: true, superficie: SUP.METALLO });
  }
  // monofore sui fianchi (strette, a tutto sesto)
  const nF = 3;
  for (const lato of [1, -1]) {
    const fl = facciata(lato * (W / 2), 0, (lato * Math.PI) / 2);
    for (let k = 0; k < nF; k++) {
      const u = (k - (nF - 1) / 2) * (L / nF) * lato;
      const g = new THREE.ShapeGeometry(formaArco(0.36, 1.25, 5));
      g.deleteAttribute('uv');
      const accesa = (k + (lato > 0 ? 0 : 1)) % 2 === 0;
      b.aggiungi(g, { matrice: inF(fl, u, 3.1, 0.015), colore: accesa ? 0xf2c46e : 0x2e2a33, canale: accesa ? 'lume' : 'opaco', superficie: SUP.VETRO });
      // strombatura dipinta d'ocra attorno alla monofora
      const gs = new THREE.ShapeGeometry(formaArco(0.62, 1.5, 5));
      gs.deleteAttribute('uv');
      b.aggiungi(gs, { matrice: inF(fl, u, 2.98, 0.008), colore: ocra, superficie: supCalce, occlusione: 0.1 });
      b.aggiungi(geoBoxC(0.62, 0.1, 0.12), { matrice: inF(fl, u, 3.05, 0.05), colore: PALETTE.gneissChiaro, piatto: true, superficie: sup(SUP.PIETRA, 0.2) });
    }
  }
  // abside semicircolare a −Z con tetto a mezzo cono
  const rA = W * 0.4;
  const hA = H - 1.1;
  const abs = new THREE.CylinderGeometry(rA, rA, hA + interr, 12, 1, false, Math.PI / 2, Math.PI);
  abs.deleteAttribute('uv');
  b.aggiungi(abs, { matrice: mat([0, (hA - interr) / 2, -L / 2]), colore: calce, gradiente: { basso: 0.85, alto: 1.0, y0: 0, y1: hA }, superficie: supCalce, occlusione: occlusionePiede(1.4, 0.3) });
  const tA = new THREE.ConeGeometry(rA + 0.45, 2.0, 12, 1, false, Math.PI / 2, Math.PI);
  tA.deleteAttribute('uv');
  b.aggiungi(tA, { matrice: mat([0, hA + 1.0, -L / 2]), colore: PALETTE.piode, variazione: 0.05, piatto: true, superficie: sup(SUP.PIODE, 0.6) });
  // monofora dell'abside
  const ga = new THREE.ShapeGeometry(formaArco(0.3, 1.0, 5));
  ga.deleteAttribute('uv');
  b.aggiungi(ga, { matrice: mat([0, 2.6, -L / 2 - rA - 0.01], [0, Math.PI, 0]), colore: 0xf2c46e, canale: 'lume', superficie: SUP.VETRO });
  // bacheca delle Lettere dalla Sorella accanto al portale (a sinistra guardando la facciata: X−)
  const uB = -1.75;
  b.aggiungi(geoBoxC(0.9, 0.7, 0.08), { matrice: inF(f, uB, 1.55, 0.06), colore: PALETTE.legnoVecchio, piatto: true, superficie: legnoVerticale(0.6) });
  b.aggiungi(geoBoxC(0.32, 0.42, 0.01), { matrice: inF(f, uB - 0.18, 1.6, 0.105, [0, 0, 0.04]), colore: PALETTE.canapa, superficie: sup(SUP.NESSUNA) });
  b.aggiungi(geoBoxC(0.3, 0.36, 0.01), { matrice: inF(f, uB + 0.2, 1.55, 0.105, [0, 0, -0.05]), colore: 0xe6dcc3, superficie: sup(SUP.NESSUNA) });
  // lanterna a muro sopra la bacheca
  const fiamma = testaLanterna(b, inF(f, uB, 2.65, 0.3), 0.9);
  const gruppo = b.costruisci('chiesa-san-vigilio');
  const collider: Collider[] = [
    box(0, (H - interr) / 2, 0, W / 2 + 0.1, (H + interr) / 2, L / 2 + 0.1, 'muro'),
    box(0, H + hT * 0.4, 0, W / 2 + 0.5, hT * 0.4 + 0.1, L / 2 + 0.3, 'tetto'),
    cil(0, -interr, -L / 2, rA + 0.05, hA + interr, 'muro'),
    box(0, 1.2, L / 2 + 0.06, 0.8, 1.2, 0.08, 'porta'),
  ];
  return risultato({
    nome: 'chiesa',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: {
      porta: new THREE.Vector3(0, 0, L / 2 + 0.9),
      bacheca: new THREE.Vector3(uB, 1.5, L / 2 + 0.6),
      lume: fiamma,
      colmo: new THREE.Vector3(0, yColmo, 0),
    },
  });
}

// ---------------------------------------------------------------- lavatoio

/**
 * Lavatoio coperto: vasca di granito con l'acqua, quattro pilastri di pietra e una tettoia di piode
 * (costruita dopo il 2121: copre la vista della cella campanaria dal chiodo 5). Il primo gradino è a
 * +Z (davanti), con il chiodo 5 al centro.
 */
export function creaLavatoio(seme: Seme = 'lavatoio'): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const LX = 5.6; // lungo X
  const LZ = 2.2;
  const zV = -1.4; // centro della vasca
  // piattaforma di lastre e gradino davanti
  const supP = sup(SUP.PIETRA, rng.next());
  b.aggiungi(geoLastra(7.4, 0.5, 6.2, rng.intero(0, 1e6), 0.04), { matrice: mat([0, -0.12, -0.6]), colore: PALETTE.gneiss, variazione: 0.05, piatto: true, superficie: supP });
  b.aggiungi(geoLastra(4.2, 0.3, 0.8, rng.intero(0, 1e6), 0.05), { matrice: mat([0, -0.08, 3.4]), colore: PALETTE.gneissChiaro, variazione: 0.05, piatto: true, superficie: supP });
  b.aggiungi(geoLastra(4.0, 0.5, 0.7, rng.intero(0, 1e6), 0.05), { matrice: mat([0, -0.12, 2.75]), colore: PALETTE.gneiss, variazione: 0.05, piatto: true, superficie: supP });
  // vasca di granito: bordo spesso, fianchi scuriti dall'acqua, pietra per lavare inclinata
  b.aggiungi(geoBoxC(LX, 0.85, LZ), { matrice: mat([0, 0.55, zV]), colore: 0x9c968e, rumore: 0.05, gradiente: { basso: 0.7, alto: 1.05, y0: 0.12, y1: 0.97 }, piatto: true, superficie: sup(SUP.PIETRA, 0.8), occlusione: occlusionePiede(0.7, 0.45) });
  for (const sz of [-1, 1]) b.aggiungi(geoBoxC(LX + 0.06, 0.12, 0.2), { matrice: mat([0, 0.98, zV + sz * (LZ / 2 - 0.1)]), colore: 0xb0aaa0, piatto: true, superficie: sup(SUP.PIETRA, 0.3) });
  for (const sx of [-1, 1]) b.aggiungi(geoBoxC(0.2, 0.12, LZ), { matrice: mat([sx * (LX / 2 - 0.1), 0.98, zV]), colore: 0xb0aaa0, piatto: true, superficie: sup(SUP.PIETRA, 0.3) });
  b.aggiungi(geoBoxC(LX - 0.4, 0.04, LZ - 0.4), { matrice: mat([0, 0.86, zV]), colore: 0x3f6f73, superficie: SUP.VETRO });
  b.aggiungi(geoBoxC(LX + 0.1, 0.1, 0.32), { matrice: mat([0, 0.97, zV + LZ / 2 - 0.1], [0.35, 0, 0]), colore: 0xb0aaa0, piatto: true, superficie: sup(SUP.PIETRA, 0.5) });
  // fontana: pilastro con la cannella di ferro e il getto d'acqua
  b.aggiungi(geoLastra(0.55, 1.5, 0.45, rng.intero(0, 1e6), 0.05), { matrice: mat([LX / 2 + 0.12, -0.05, zV]), colore: PALETTE.gneissScuro, piatto: true, superficie: supP, occlusione: occlusionePiede(0.6, 0.4) });
  b.aggiungi(geoLastra(0.7, 0.12, 0.6, rng.intero(0, 1e6), 0.08), { matrice: mat([LX / 2 + 0.12, 1.43, zV]), colore: PALETTE.gneiss, piatto: true, superficie: supP });
  b.aggiungi(geoCilindro(0.03, 0.03, 0.4, 5), { matrice: mat([LX / 2 - 0.1, 1.2, zV], [0, 0, Math.PI / 2]), colore: PALETTE.ferro, superficie: SUP.METALLO });
  b.aggiungi(geoCilindro(0.018, 0.026, 0.3, 5), { matrice: mat([LX / 2 - 0.3, 0.88, zV]), colore: 0xbfd8d8, canale: 'sottile', superficie: sup(SUP.NESSUNA) });
  // pilastri e tettoia
  const hP = 2.75;
  for (const [x, z] of [
    [-3.1, -3.2],
    [3.1, -3.2],
    [-3.1, 1.8],
    [3.1, 1.8],
  ] as const) {
    // pilastro di pietra squadrata con il capitello (geoLastra ha la base a y = 0)
    b.aggiungi(geoLastra(0.5, hP, 0.5, rng.intero(0, 1e6), 0.04), { matrice: mat([x, 0, z]), colore: PALETTE.gneissChiaro, gradiente: { basso: 0.75, alto: 1.0, y0: 0, y1: hP }, piatto: true, superficie: supP, occlusione: occlusionePiede(0.6, 0.4) });
    b.aggiungi(geoLastra(0.66, 0.14, 0.66, rng.intero(0, 1e6), 0.06), { matrice: mat([x, hP - 0.14, z]), colore: PALETTE.gneissChiaro, piatto: true, superficie: supP });
  }
  // travi
  for (const z of [-3.2, 1.8]) b.aggiungi(geoBoxC(7.0, 0.22, 0.22), { matrice: mat([0, hP + 0.1, z]), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoOrizzontale(0.4), occlusione: 0.2 });
  // tettoia a due falde lungo X (colmo lungo X): costruita come tetto con colmo lungo Z e ruotata
  const bt = new Costruttore(rng.derivato('tettoia'));
  tettoPiode(bt, rng.derivato('t'), { larghezza: 5.6, profondita: 6.8, yGronda: 0, pendenza: 0.5, sporgenzaGronda: 0.7, sporgenzaTimpano: 0.4, corsi: 3, pezziPerCorso: 6 });
  const gT = bt.costruisci('tettoia');
  gT.updateMatrixWorld(true);
  gT.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    b.aggiungi(m.geometry, { matrice: mat([0, hP + 0.2, -0.7], [0, Math.PI / 2, 0]), colore: 'geometria', canale: (m.userData['canale'] as 'opaco') ?? 'opaco' });
  });
  // panni stesi su una corda fra due pilastri
  for (let k = 0; k < 3; k++) {
    const g = geoPiano(0.7, 0.9, 2, 2);
    b.aggiungi(g, { matrice: mat([-2.0 + k * 1.1, hP - 0.75, -3.25]), colore: k === 1 ? 0xb8463a : k === 2 ? 0x5d6f8a : 0xf3eee2, canale: 'sottile', superficie: SUP.TESSUTO });
  }
  // lanterna appesa sotto la tettoia
  const fiamma = testaLanterna(b, mat([0, hP - 0.45, 1.2]), 0.9);
  const gruppo = b.costruisci('lavatoio');
  return risultato({
    nome: 'lavatoio',
    seme: s,
    gruppo,
    collider: [
      box(0, 0.5, zV, LX / 2 + 0.3, 0.5, LZ / 2 + 0.1, 'muro'),
      box(0, 0.06, -0.6, 3.7, 0.06, 3.1, 'calpestabile'),
      box(0, 0.06, 3.4, 2.1, 0.1, 0.4, 'gradino'),
      cil(-3.1, 0, -3.2, 0.3, hP, 'muro'),
      cil(3.1, 0, -3.2, 0.3, hP, 'muro'),
      cil(-3.1, 0, 1.8, 0.3, hP, 'muro'),
      cil(3.1, 0, 1.8, 0.3, hP, 'muro'),
      box(0, hP + 1.0, -0.7, 3.3, 0.9, 3.6, 'tetto'),
    ],
    ingombro: ingombroDa(gruppo),
    punti: { gradino: new THREE.Vector3(0, 0.08, 3.4), vasca: new THREE.Vector3(0, 0.9, zV + LZ / 2 + 0.4), lume: fiamma },
  });
}

// ---------------------------------------------------------------- bacheca e telo

/** Bacheca delle Ore: tavola di legno con i fogli sotto una tettoia di piode, su due pali. */
export function creaBacheca(seme: Seme = 'bacheca'): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  for (const x of [-0.95, 0.95]) b.aggiungi(geoBoxC(0.14, 2.6, 0.14), { matrice: mat([x, 1.3, 0]), colore: PALETTE.legnoScuro, piatto: true, superficie: legnoVerticale(0.3), occlusione: occlusionePiede(0.5, 0.4) });
  b.aggiungi(geoBoxC(1.9, 1.15, 0.08), { matrice: mat([0, 1.55, 0.04]), colore: PALETTE.legnoVecchio, variazione: 0.06, piatto: true, superficie: legnoOrizzontale(0.5) });
  // cornice della tavola
  for (const y of [0.95, 2.15]) b.aggiungi(geoBoxC(2.0, 0.08, 0.12), { matrice: mat([0, y, 0.05]), colore: PALETTE.larice, piatto: true, superficie: legnoOrizzontale(0.7) });
  const fogli = [0xf1e9d6, 0xe6dcc3, 0xd9cdb0, 0xf4efe2, 0xe0d2b5];
  for (let k = 0; k < 6; k++) {
    const w = rng.tra(0.3, 0.46);
    const h = rng.tra(0.32, 0.5);
    b.aggiungi(geoBoxC(w, h, 0.01), { matrice: mat([-0.65 + (k % 3) * 0.62 + rng.centrato(0.06), 1.3 + Math.floor(k / 3) * 0.5 + rng.centrato(0.05), 0.09], [0, 0, rng.centrato(0.08)]), colore: rng.scegli(fogli), superficie: sup(SUP.NESSUNA) });
    // righe di scrittura e una puntina d'ottone
    for (let r = 0; r < 3; r++) b.aggiungi(geoPiano(w * 0.7, 0.008), { matrice: mat([-0.65 + (k % 3) * 0.62, 1.38 + Math.floor(k / 3) * 0.5 - r * 0.06, 0.097]), colore: 0x4a4038, superficie: sup(SUP.NESSUNA) });
  }
  const bt = new Costruttore(rng.derivato('t'));
  tettoPiode(bt, rng.derivato('tt'), { larghezza: 0.9, profondita: 2.2, yGronda: 0, pendenza: 0.6, sporgenzaGronda: 0.2, sporgenzaTimpano: 0.05, corsi: 2, pezziPerCorso: 4 });
  bt.costruisci('tetto-bacheca').traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) b.aggiungi(m.geometry, { matrice: mat([0, 2.45, 0.05], [0, Math.PI / 2, 0]), colore: 'geometria' });
  });
  const gruppo = b.costruisci('bacheca');
  return risultato({ nome: 'bacheca', seme: s, gruppo, collider: [box(0, 1.3, 0, 1.05, 1.3, 0.12, 'oggetto')], ingombro: ingombroDa(gruppo), punti: { leggi: new THREE.Vector3(0, 1.5, 0.9) } });
}

/** Il telo dell'Ombrista: tela bianca fra due pali, lampada a olio dietro (a −Z). */
export function creaTelo(seme: Seme = 'telo-ombrista'): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const W = 4.4;
  const Hp = 3.4;
  for (const x of [-W / 2 - 0.1, W / 2 + 0.1]) b.aggiungi(geoCilindro(0.07, 0.09, Hp, 6), { matrice: mat([x, 0, 0]), colore: PALETTE.legnoGrigio, superficie: SUP.CORTECCIA });
  const tela = geoPiano(W, 2.5, 8, 4);
  const pos = tela.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin((pos.getX(i) / W) * Math.PI) * 0.06 * (0.6 + 0.4 * Math.sin(pos.getY(i) * 2)));
  // tela di lino grezzo, con l'orlo cucito e due rattoppi
  b.aggiungi(tela, { matrice: mat([0, 1.95, 0]), colore: 0xe0d4ba, canale: 'sottile', superficie: SUP.TESSUTO });
  for (const y of [0.72, 3.18]) b.aggiungi(geoBoxC(W + 0.04, 0.07, 0.03), { matrice: mat([0, y, 0.02]), colore: 0xc9b896, piatto: true, superficie: SUP.TESSUTO });
  for (const [x, y, w, h] of [
    [-1.2, 2.4, 0.5, 0.42],
    [1.35, 1.35, 0.38, 0.5],
  ] as const) {
    b.aggiungi(geoPiano(w, h), { matrice: mat([x, y, Math.sin((x / W) * Math.PI) * 0.05 + 0.012]), colore: 0xd2c4a2, canale: 'sottile', superficie: SUP.TESSUTO });
  }
  b.aggiungi(geoCilindro(0.03, 0.03, W + 0.4, 5), { matrice: mat([-(W + 0.4) / 2, 3.25, 0], [0, 0, -Math.PI / 2]), colore: PALETTE.legnoGrigio });
  // tiranti
  for (const x of [-W / 2 - 0.1, W / 2 + 0.1]) b.aggiungi(geoCilindro(0.01, 0.01, 2.2, 3), { matrice: mat([x, Hp - 0.1, 0], [0.6, 0, 0]), colore: 0x8a7a5a });
  // sgabello e lampada a olio dietro
  b.aggiungi(geoBoxC(0.45, 0.55, 0.45), { matrice: mat([0, 0.27, -1.4]), colore: PALETTE.legno, piatto: true });
  const fiamma = testaLanterna(b, mat([0, 0.62, -1.4]), 0.8, PALETTE.ottone);
  const gruppo = b.costruisci('telo-ombrista');
  return risultato({ nome: 'telo', seme: s, gruppo, collider: [cil(-W / 2 - 0.1, 0, 0, 0.12, Hp, 'palo'), cil(W / 2 + 0.1, 0, 0, 0.12, Hp, 'palo')], ingombro: ingombroDa(gruppo), punti: { lume: fiamma, pubblico: new THREE.Vector3(0, 0, 6) } });
}

/** Panca di pietra con la seduta di legno (o tutta di pietra). */
export function creaPanca(seme: Seme = 'panca', lunghezza = 2.2, legno = true): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  // spalle di pietra (geoLastra ha la base a y = 0) e seduta di larice o di pietra
  for (const x of [-lunghezza / 2 + 0.25, lunghezza / 2 - 0.25]) b.aggiungi(geoLastra(0.3, 0.45, 0.42, rng.intero(0, 1e6), 0.08), { matrice: mat([x, -0.02, 0]), colore: PALETTE.gneiss, piatto: true, superficie: sup(SUP.PIETRA, rng.next()), occlusione: occlusionePiede(0.4, 0.45) });
  b.aggiungi(legno ? geoBoxC(lunghezza, 0.08, 0.45) : geoLastra(lunghezza, 0.12, 0.5, rng.intero(0, 1e6), 0.06), { matrice: mat([0, legno ? 0.47 : 0.42, 0]), colore: legno ? PALETTE.larice : PALETTE.gneissChiaro, variazione: 0.06, piatto: true, superficie: legno ? legnoOrizzontale(rng.next()) : sup(SUP.PIETRA, rng.next()) });
  const gruppo = b.costruisci('panca');
  return risultato({ nome: 'panca', seme: s, gruppo, collider: [box(0, 0.26, 0, lunghezza / 2, 0.26, 0.24, 'panca')], ingombro: ingombroDa(gruppo), punti: { seduta: new THREE.Vector3(0, 0.5, 0) } });
}

// ---------------------------------------------------------------- tasso

/** Tasso secolare: chioma scura e fitta a masse tonde, tronco rossiccio corto. */
export function creaTasso(seme: Seme = 'tasso', altezza = 10): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const H = altezza;
  // tronco rossiccio, corto e scanalato, con due rami grossi che si aprono
  b.aggiungi(geoTubo([new THREE.Vector3(0, -0.4, 0), new THREE.Vector3(0.1, 1.2, 0.05), new THREE.Vector3(-0.05, 2.4, 0)], [0.58, 0.46, 0.36], 8, { forma: (_i, a) => 1 + Math.sin(a * 5) * 0.08 }), {
    colore: 0x7a4532,
    superficie: SUP.CORTECCIA,
    occlusione: (p) => (p.y > 1.8 ? 0.45 : 0.15),
  });
  for (const a of [0.6, 2.9, 4.6]) {
    const p0 = new THREE.Vector3(0, 2.0, 0);
    const p1 = new THREE.Vector3(Math.cos(a) * 1.1, 3.4, Math.sin(a) * 1.1);
    b.aggiungi(geoTubo([p0, p1], [0.24, 0.14], 6), { colore: 0x6e3f2c, superficie: SUP.CORTECCIA, occlusione: 0.4 });
  }
  // chioma: tante masse a ciuffi, colonnare e appuntita come una fiamma (i tassi e i cipressi dei
  // sagrati nei bozzetti): verde scuro che prende la luce sui fianchi, mai una macchia nera
  const verdi = [0x34603a, 0x3f6c40, 0x4b7a46, 0x2f5636, 0x5a874c];
  const raggioMax = Math.min(H * 0.24, 3.4);
  const n = 46;
  for (let k = 0; k < n; k++) {
    const t = Math.pow(rng.next(), 0.8);
    // profilo a fiamma: largo poco sopra il tronco, stretto in punta
    const prof = Math.sin(Math.PI * Math.min(1, 0.18 + t * 0.95)) * (1 - t * 0.35);
    const r = (0.3 + rng.next() * 0.22) * raggioMax * (0.5 + prof * 0.6);
    const a = rng.next() * Math.PI * 2;
    const d = prof * raggioMax * (0.35 + rng.next() * 0.45);
    const y = 2.2 + t * (H - 2.6);
    b.aggiungi(geoMassa(r, rng.intero(0, 1e6), 0.32, 1, 1.15, 0.7), {
      matrice: mat([Math.cos(a) * d, y, Math.sin(a) * d], [rng.centrato(0.3), rng.next() * 6, rng.centrato(0.3)]),
      colore: rng.scegli(verdi),
      variazione: 0.1,
      gradiente: { basso: 0.75, alto: 1.12, y0: 1.5, y1: H },
      superficie: sup(SUP.FOGLIAME, rng.next()),
      occlusione: (p) => Math.min(0.32, Math.max(0, 0.3 - (p.y - 2.0) / (H * 1.6)) + Math.max(0, 0.28 - Math.hypot(p.x, p.z) / raggioMax) * 0.5),
    });
  }
  // la punta che sfugge in alto
  b.aggiungi(geoMassa(raggioMax * 0.28, rng.intero(0, 1e6), 0.35, 1, 1.8, 0.7), {
    matrice: mat([rng.centrato(0.3), H - 0.5, rng.centrato(0.3)]),
    colore: verdi[2]!,
    variazione: 0.08,
    superficie: sup(SUP.FOGLIAME, rng.next()),
  });
  const gruppo = b.costruisci('tasso');
  return risultato({
    nome: 'tasso',
    seme: s,
    gruppo,
    collider: [cil(0, -0.4, 0, 0.6, 2.6, 'tronco'), cil(0, 2.1, 0, Math.min(H * 0.28, 4.3), H - 2.1, 'chioma')],
    ingombro: ingombroDa(gruppo),
    punti: { tronco: new THREE.Vector3(0, 1.2, 0), chioma: new THREE.Vector3(0, H * 0.6, 0) },
  });
}

// ---------------------------------------------------------------- casupole dei Ronchi

export interface OpzioniCasupola {
  seme?: Seme;
  larghezza?: number;
  profondita?: number;
  altezza?: number;
  /** muri presenti: fronte (+Z), retro, sinistra (+X), destra (−X) */
  muri?: { fronte?: boolean; retro?: boolean; sinistra?: boolean; destra?: boolean };
  /** tetto di frasche e lamiera (false = senza tetto: rudere) */
  tetto?: boolean;
  /** letto visibile dentro */
  letto?: boolean;
  /** scritta di carbone sulla porta («Cà dal Nando») */
  scritta?: boolean;
  finestraAccesa?: boolean;
  interrata?: number;
}

/**
 * Casupola dei Ronchi: quattro muri a secco senza calce, tetto di frasche e lamiera (le case «non
 * benedette»). Con `muri` si toglie un muro (la casa di Nando smontata dalle Fade).
 */
export function creaCasupola(opz: OpzioniCasupola = {}): OggettoProcedurale {
  const s = semeNumerico(opz.seme ?? 'casupola');
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const W = opz.larghezza ?? 4.6;
  const D = opz.profondita ?? 5.2;
  const H = opz.altezza ?? 2.6;
  const interr = opz.interrata ?? 0.6;
  const sp = 0.55;
  const muri = { fronte: true, retro: true, sinistra: true, destra: true, ...(opz.muri ?? {}) };
  const collider: Collider[] = [];
  const muro = (cx: number, cz: number, lung: number, rotY: number, conPorta: boolean) => {
    // pietre a corsi irregolari, nessuna calce: fughe scure profonde
    const m = mat([cx, 0, cz], [0, rotY, 0]);
    b.aggiungi(geoBoxC(lung, H + interr, sp - 0.1), { matrice: m.clone().multiply(mat([0, (H - interr) / 2, 0])), colore: 0x6e6862, piatto: true });
    let y = -interr * 0.5;
    while (y < H - 0.1) {
      const hc = Math.min(H - y, rng.tra(0.2, 0.34));
      let x = -lung / 2 + rng.next() * 0.2;
      while (x < lung / 2 - 0.05) {
        const lw = Math.min(lung / 2 - x, rng.tra(0.28, 0.6));
        if (conPorta && Math.abs(x + lw / 2) < 0.55 && y < 1.85) {
          x += lw;
          continue;
        }
        for (const lato of [1]) {
          b.aggiungi(geoLastra(lw - 0.04, hc - 0.04, 0.2, rng.intero(0, 1e6), 0.16), {
            matrice: m.clone().multiply(mat([x + lw / 2, y + hc / 2, lato * (sp / 2 - 0.08)], [0, 0, rng.centrato(0.06)])),
            colore: mescola(PALETTE.gneiss, rng.prob(0.5) ? PALETTE.gneissViola : PALETTE.gneissCaldo, rng.next() * 0.7),
            variazione: 0.12,
            piatto: true,
          });
        }
        x += lw;
      }
      y += hc;
    }
    const c = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
    collider.push(box(c.x, (H - interr) / 2, c.z, lung / 2, (H + interr) / 2, sp / 2, 'muro', rotY));
  };
  if (muri.fronte) muro(0, D / 2, W, 0, true);
  if (muri.retro) muro(0, -D / 2, W, Math.PI, false);
  if (muri.sinistra) muro(W / 2, 0, D - sp, Math.PI / 2, false);
  if (muri.destra) muro(-W / 2, 0, D - sp, -Math.PI / 2, false);
  // porta di assi
  if (muri.fronte) {
    b.aggiungi(geoBoxC(0.95, 1.85, 0.06), { matrice: mat([0, 0.93, D / 2 + 0.05]), colore: PALETTE.legnoGrigio, variazione: 0.1, piatto: true });
    if (opz.scritta) {
      // «Cà dal Nando — rifacia tücc i dí», col carbone: due righe di segni scuri
      for (let r = 0; r < 2; r++) {
        for (let k = 0; k < 7 - r * 2; k++) b.aggiungi(geoBoxC(rng.tra(0.04, 0.09), 0.012, 0.005), { matrice: mat([-0.33 + k * 0.1, 1.45 - r * 0.1, D / 2 + 0.085], [0, 0, rng.centrato(0.4)]), colore: 0x1c1a1c });
      }
    }
  }
  // tetto di frasche e lamiera
  if (opz.tetto ?? true) {
    const p = 0.42;
    for (const lato of [1, -1]) {
      const lf = (W / 2 + 0.5) / Math.cos(p);
      // travi
      for (let k = 0; k < 4; k++) {
        const z = -D / 2 + (k + 0.5) * (D / 4);
        b.aggiungi(geoBoxC(lf, 0.1, 0.1), { matrice: mat([lato * (W / 4 + 0.15), H + (W / 4) * Math.tan(p) + 0.05, z], [0, 0, -lato * p]), colore: PALETTE.legnoScuro, piatto: true });
      }
      // fascine di frasche
      for (let k = 0; k < 9; k++) {
        const t = rng.next();
        const z = -D / 2 - 0.3 + rng.next() * (D + 0.6);
        const xx = lato * (0.2 + t * (W / 2 + 0.3));
        b.aggiungi(geoCiuffo(0.75, rng.intero(0, 1e6), 0.35), {
          matrice: mat([xx, H + 0.25 + ((W / 2 - Math.abs(xx)) + 0.3) * Math.tan(p), z], [0, rng.next() * 3, -lato * p]),
          colore: mescola(0x5b4a2e, rng.prob(0.5) ? 0x4d5a2c : 0x7a6338, rng.next()),
          variazione: 0.1,
          piatto: true,
        });
      }
      // lamiera ondulata (una per falda)
      const lam = new THREE.PlaneGeometry(1.6, lf * 0.8, 8, 1);
      const pp = lam.getAttribute('position');
      for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 14) * 0.025);
      lam.deleteAttribute('uv');
      b.aggiungi(lam, {
        matrice: mat([lato * (W / 4 + 0.2), H + (W / 4) * Math.tan(p) + 0.3, rng.centrato(D * 0.3)], [-Math.PI / 2, -lato * p, Math.PI / 2]),
        colore: mescola(0x8a8f94, 0x8a4f2a, rng.next() * 0.6),
        canale: 'sottile',
        piatto: true,
      });
    }
    collider.push(box(0, H + 0.6, 0, W / 2 + 0.4, 0.6, D / 2 + 0.3, 'tetto'));
  }
  // finestrella
  const fl = facciata(-W / 2 - 0.01, 0, -Math.PI / 2);
  if (muri.destra) finestra(b, fl, D * 0.15, 1.2, { larghezza: 0.45, altezza: 0.5, ante: 0x6b4a33, accesa: opz.finestraAccesa ?? true });
  // letto dentro (si vede quando manca un muro)
  if (opz.letto ?? true) {
    b.aggiungi(geoBoxC(0.95, 0.4, 1.95), { matrice: mat([-W / 2 + 0.95, 0.2, -0.4]), colore: PALETTE.legno, piatto: true });
    b.aggiungi(geoBoxC(0.9, 0.12, 1.85), { matrice: mat([-W / 2 + 0.95, 0.46, -0.4]), colore: 0xd8ccb0 });
    b.aggiungi(geoBoxC(0.92, 0.1, 1.0), { matrice: mat([-W / 2 + 0.95, 0.53, -0.1]), colore: 0x8a4f3a });
  }
  // pavimento di terra battuta
  b.aggiungi(geoBoxC(W - 0.3, 0.05, D - 0.3), { matrice: mat([0, 0.02, 0]), colore: 0x6b5236 });
  const gruppo = b.costruisci('casupola');
  return risultato({ nome: 'casupola', seme: s, gruppo, collider, ingombro: ingombroDa(gruppo), punti: { porta: new THREE.Vector3(0, 0, D / 2 + 0.7), letto: new THREE.Vector3(-W / 2 + 0.95, 0.5, -0.4) } });
}

/** Mucchio di pietre squadrate (le pietre della casa di Nando, il rudere). */
export function creaMucchioPietre(seme: Seme = 'mucchio', quante = 26, raggio = 1.2): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  for (let k = 0; k < quante; k++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * raggio;
    const y = Math.max(0, (1 - d / raggio) * 0.6) * rng.next();
    b.aggiungi(geoLastra(rng.tra(0.3, 0.55), rng.tra(0.18, 0.3), rng.tra(0.22, 0.4), rng.intero(0, 1e6), 0.18), {
      matrice: mat([Math.cos(a) * d, y + 0.1, Math.sin(a) * d], [rng.centrato(0.3), rng.next() * 3, rng.centrato(0.3)]),
      colore: mescola(PALETTE.gneiss, rng.prob(0.5) ? PALETTE.gneissViola : PALETTE.gneissCaldo, rng.next() * 0.7),
      variazione: 0.1,
      piatto: true,
    });
  }
  const gruppo = b.costruisci('mucchio-pietre');
  return risultato({ nome: 'mucchio', seme: s, gruppo, collider: [cil(0, 0, 0, raggio * 0.8, 0.45, 'macerie')], ingombro: ingombroDa(gruppo), punti: {} });
}

/** Assi di castagno: sul riale (passerella) o accatastate sulla riva. */
export function creaAssi(seme: Seme, quante: number, lunghezza: number, accatastate: boolean): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const collider: Collider[] = [];
  for (let k = 0; k < quante; k++) {
    const w = rng.tra(0.28, 0.36);
    const m = accatastate
      ? mat([rng.centrato(0.06), 0.06 + k * 0.075, rng.centrato(0.1)], [0, rng.centrato(0.06), 0])
      : mat([(k - (quante - 1) / 2) * (w + 0.03), 0.05, 0], [0, rng.centrato(0.03), rng.centrato(0.02)]);
    b.aggiungi(geoBoxC(w, 0.065, lunghezza), { matrice: m, colore: mescola(PALETTE.legno, PALETTE.legnoGrigio, rng.next() * 0.6), variazione: 0.08, piatto: true });
  }
  if (accatastate) {
    // due travetti sotto la catasta
    for (const z of [-lunghezza * 0.35, lunghezza * 0.35]) b.aggiungi(geoBoxC(0.6, 0.06, 0.1), { matrice: mat([0, 0.02, z]), colore: PALETTE.legnoScuro, piatto: true });
    collider.push(box(0, quante * 0.04, 0, 0.3, quante * 0.04, lunghezza / 2, 'oggetto'));
  } else {
    collider.push(box(0, 0.02, 0, (quante * 0.34) / 2, 0.06, lunghezza / 2 + 0.1, 'calpestabile'));
  }
  const gruppo = b.costruisci(accatastate ? 'assi-accatastate' : 'assi');
  return risultato({ nome: 'assi', seme: s, gruppo, collider, ingombro: ingombroDa(gruppo), punti: { centro: new THREE.Vector3(0, 0.1, 0) } });
}

// ---------------------------------------------------------------- mulino, grà, capanno

/** Mulino di pietra con la ruota ferma sul fianco (+X verso il riale). */
export function creaMulino(seme: Seme = 'mulino', ruotaADestra = false): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const W = 5.6;
  const D = 6.8;
  const H = 4.4;
  const interr = 2.0;
  b.aggiungi(geoBoxC(W, H + interr, D), { matrice: mat([0, (H - interr) / 2, 0]), colore: PALETTE.gneiss, rumore: 0.06, gradiente: { basso: 0.7, alto: 1.0, y0: -interr, y1: H }, piatto: true });
  const yC = tettoPiode(b, rng, { larghezza: W, profondita: D, yGronda: H, pendenza: 0.55, corsi: 4, pezziPerCorso: 6 });
  b.aggiungi(geoTimpano(W, yC - H - 0.1, D), { matrice: mat([0, H, 0]), colore: PALETTE.gneissScuro, piatto: true });
  porta(b, facciata(0, D / 2, 0), 1.85, 0, 1.0, 1.9, PALETTE.legnoVecchio);
  finestra(b, facciata(0, D / 2, 0), -0.8, 1.3, { larghezza: 0.55, altezza: 0.65, ante: 0x6b4a33, accesa: true });
  // ruota ferma
  const sR = ruotaADestra ? -1 : 1;
  const xR = sR * (W / 2 + 0.45);
  const ruota = new THREE.TorusGeometry(1.9, 0.12, 4, 16);
  b.aggiungi(ruota, { matrice: mat([xR, 1.4, 0], [0, Math.PI / 2, 0]), colore: PALETTE.legnoScuro, piatto: true });
  b.aggiungi(new THREE.TorusGeometry(1.2, 0.08, 4, 12), { matrice: mat([xR, 1.4, 0], [0, Math.PI / 2, 0]), colore: PALETTE.legnoScuro, piatto: true });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    b.aggiungi(geoBoxC(0.08, 0.5, 0.9), { matrice: mat([xR, 1.4 + Math.sin(a) * 1.9, Math.cos(a) * 1.9], [a, 0, 0]), colore: PALETTE.legno, piatto: true });
    if (k % 3 === 0) b.aggiungi(geoBoxC(0.08, 3.6, 0.1), { matrice: mat([xR, 1.4, 0], [a, 0, 0]), colore: PALETTE.legnoScuro, piatto: true });
  }
  b.aggiungi(geoCilindro(0.18, 0.18, 0.9, 6), { matrice: mat([(sR * W) / 2, 1.4, 0], [0, 0, -sR * Math.PI / 2]), colore: PALETTE.ferro });
  // gora di legno
  b.aggiungi(geoBoxC(0.9, 0.4, 4.0), { matrice: mat([xR, 3.5, -2.6], [0.18, 0, 0]), colore: PALETTE.legnoGrigio, piatto: true });
  // soglia di pietra (chiodo 7)
  b.aggiungi(geoLastra(1.7, 0.18, 1.3, rng.intero(0, 1e6), 0.06), { matrice: mat([1.95, 0.0, D / 2 + 0.6]), colore: PALETTE.gneissChiaro, piatto: true });
  const gruppo = b.costruisci('mulino');
  return risultato({
    nome: 'mulino',
    seme: s,
    gruppo,
    collider: [box(0, (H - interr) / 2, 0, W / 2, (H + interr) / 2, D / 2, 'muro'), box(0, H + 1, 0, W / 2 + 0.4, 1, D / 2 + 0.3, 'tetto'), cil(xR, -0.6, 0, 1.0, 3.5, 'oggetto'), box(1.85, 1.0, D / 2 + 0.06, 0.5, 1.0, 0.06, 'porta')],
    ingombro: ingombroDa(gruppo),
    punti: { porta: new THREE.Vector3(1.85, 0, D / 2 + 1.1), soglia: new THREE.Vector3(1.95, 0.1, D / 2 + 0.75), ruota: new THREE.Vector3(xR, 1.4, 0) },
  });
}

/** Grà: essiccatoio di castagne in gneiss, tetto di piode, graticcio, fumo bianco dal tetto. */
export function creaGra(seme: Seme = 'gra', fumo = true): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const W = 4.4;
  const D = 5.0;
  const H = 4.0;
  const interr = 2.2;
  b.aggiungi(geoBoxC(W, H + interr, D), { matrice: mat([0, (H - interr) / 2, 0]), colore: PALETTE.gneissScuro, rumore: 0.08, gradiente: { basso: 0.65, alto: 1.0, y0: -interr, y1: H }, piatto: true });
  const yC = tettoPiode(b, rng, { larghezza: W, profondita: D, yGronda: H, pendenza: 0.6, corsi: 3, pezziPerCorso: 5 });
  b.aggiungi(geoTimpano(W, yC - H - 0.1, D), { matrice: mat([0, H, 0]), colore: PALETTE.gneiss, piatto: true });
  porta(b, facciata(0, D / 2, 0), 0, 0, 0.9, 1.7, PALETTE.legnoScuro);
  finestra(b, facciata(0, D / 2, 0), 0, 2.4, { larghezza: 0.4, altezza: 0.45, ante: null, inferriata: true });
  if (fumo) {
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      b.aggiungi(geoSfera(0.45 + t * 1.1, 7, 5), { matrice: mat([0.3 + t * 1.6, yC + 0.6 + t * 4.2, rng.centrato(0.4)]), colore: mescola(0xf2efe8, 0xd8dde4, t), canale: 'sottile' });
    }
  }
  const gruppo = b.costruisci('gra');
  return risultato({ nome: 'gra', seme: s, gruppo, collider: [box(0, (H - interr) / 2, 0, W / 2, (H + interr) / 2, D / 2, 'muro'), box(0, H + 1, 0, W / 2 + 0.4, 1, D / 2 + 0.3, 'tetto')], ingombro: ingombroDa(gruppo), punti: { porta: new THREE.Vector3(0, 0, D / 2 + 0.8), angolo: new THREE.Vector3(W / 2 + 0.02, 1.1, D / 2 + 0.02) } });
}

/** Capanno dei Messi sul Balcone: legno, Veli rattoppati appesi, il motto inciso sulla porta. */
export function creaCapanno(seme: Seme = 'capanno-messi'): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  const W = 3.4;
  const D = 3.0;
  const H = 2.5;
  b.aggiungi(geoBoxC(W, 0.3, D), { matrice: mat([0, 0.15, 0]), colore: PALETTE.gneiss, piatto: true });
  for (let k = 0; k < 11; k++) {
    const x = -W / 2 + (k + 0.5) * (W / 11);
    for (const z of [-D / 2, D / 2]) {
      if (z > 0 && Math.abs(x) < 0.5) continue;
      b.aggiungi(geoBoxC(W / 11 - 0.02, H, 0.06), { matrice: mat([x, 0.3 + H / 2, z]), colore: mescola(PALETTE.legnoGrigio, PALETTE.legno, rng.next() * 0.5), piatto: true });
    }
  }
  for (const x of [-W / 2, W / 2]) b.aggiungi(geoBoxC(0.06, H, D), { matrice: mat([x, 0.3 + H / 2, 0]), colore: PALETTE.legnoGrigio, piatto: true });
  b.aggiungi(geoBoxC(1.0, 1.9, 0.06), { matrice: mat([0, 0.3 + 0.95, D / 2 + 0.03]), colore: PALETTE.legnoVecchio, piatto: true });
  // il motto inciso (segni scuri)
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) b.aggiungi(geoBoxC(0.08, 0.012, 0.005), { matrice: mat([-0.3 + k * 0.12, 1.6 - r * 0.12, D / 2 + 0.065]), colore: 0x2a2018 });
  // tetto a una falda di assi
  b.aggiungi(geoBoxC(W + 0.6, 0.1, D + 0.7), { matrice: mat([0, 0.3 + H + 0.3, 0], [0.18, 0, 0]), colore: PALETTE.legnoScuro, piatto: true });
  // Veli rattoppati appesi fuori (tela grigia e verde)
  for (let k = 0; k < 3; k++) {
    const g = geoPiano(1.4, 0.9, 3, 2);
    b.aggiungi(g, { matrice: mat([W / 2 + 0.05, 1.5, -0.8 + k * 0.8], [0, Math.PI / 2, 0.15]), colore: k === 1 ? 0x6f8a5a : 0xb8b2a2, canale: 'sottile' });
    b.aggiungi(geoBoxC(0.05, 0.05, 1.5), { matrice: mat([W / 2 + 0.1, 1.95, -0.8 + k * 0.8], [Math.PI / 2, 0, 0]), colore: PALETTE.legno, piatto: true });
  }
  const gruppo = b.costruisci('capanno');
  return risultato({ nome: 'capanno', seme: s, gruppo, collider: [box(0, 0.3 + H / 2, 0, W / 2, H / 2 + 0.3, D / 2, 'muro')], ingombro: ingombroDa(gruppo), punti: { porta: new THREE.Vector3(0, 0.3, D / 2 + 0.8), motto: new THREE.Vector3(0, 1.55, D / 2 + 0.1) } });
}

/** Masso tondo (Sass dal Messo), lisciato da chi ci si siede. */
export function creaMasso(seme: Seme, raggio: number, schiaccia = 0.7): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  b.aggiungi(geoMasso(raggio, rng.intero(0, 1e6), 0.12, 1, schiaccia), { matrice: mat([0, raggio * schiaccia * 0.35, 0]), colore: mescola(PALETTE.gneiss, PALETTE.gneissViola, 0.35), rumore: 0.06, gradiente: { basso: 0.7, alto: 1.08, y0: 0, y1: raggio }, piatto: true });
  const gruppo = b.costruisci('masso');
  return risultato({ nome: 'masso', seme: s, gruppo, collider: [cil(0, -0.3, 0, raggio * 0.9, raggio * schiaccia * 1.3, 'arrampicabile')], ingombro: ingombroDa(gruppo), punti: { cima: new THREE.Vector3(0, raggio * schiaccia * 1.32, 0) } });
}

/** Erba alta e ricci vuoti sparsi in un cerchio (terrazze di castagni). */
export function creaErbaRicci(seme: Seme, raggio: number, ciuffi = 40, ricci = 30): OggettoProcedurale {
  const s = semeNumerico(seme);
  const rng = new Rng(s);
  const b = new Costruttore(rng);
  for (let k = 0; k < ciuffi; k++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * raggio;
    const colore = mescola(0x8a9a44, rng.prob(0.4) ? 0xc4a858 : 0x6f8a3c, rng.next());
    // ciuffo: tre-cinque fili sottili e inclinati
    const nf = rng.intero(3, 5);
    for (let f = 0; f < nf; f++) {
      const h = rng.tra(0.28, 0.62);
      b.aggiungi(geoCono(rng.tra(0.025, 0.045), h, 3), {
        matrice: mat([Math.cos(a) * d + rng.centrato(0.12), -0.03, Math.sin(a) * d + rng.centrato(0.12)], [rng.centrato(0.5), rng.next() * 3, rng.centrato(0.5)]),
        colore,
        variazione: 0.12,
        piatto: true,
      });
    }
  }
  for (let k = 0; k < ricci; k++) {
    const a = rng.next() * Math.PI * 2;
    const d = Math.sqrt(rng.next()) * raggio;
    b.aggiungi(geoCiuffo(0.07, rng.intero(0, 1e6), 0.75), { matrice: mat([Math.cos(a) * d, 0.04, Math.sin(a) * d]), colore: rng.prob(0.5) ? 0x9a8a3a : 0x7a5530, piatto: true });
  }
  const gruppo = b.costruisci('erba-ricci');
  return risultato({ nome: 'erba', seme: s, gruppo, collider: [], ingombro: ingombroDa(gruppo), punti: {} });
}
