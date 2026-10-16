/**
 * Annessi del paese (rifinitura 2): stalle, legnaie e fienili bassi addossati ai rustici, col tetto
 * di piode a una falda. Nei paesi ticinesi chiudono i vuoti fra una casa e l'altra lungo le curve di
 * livello: visto da lontano il nucleo è un grumo continuo di muri e tetti, non case staccate.
 *
 * Orientamento come il rustico: davanti verso +Z (la valle), la falda scende verso il davanti (alta
 * dietro, contro il pendio). Larghezza lungo X (lungo la cortina), profondità lungo Z. Il suolo è
 * y = 0 sul lato più basso; i muri scendono di `interrata` per coprire il pendio.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../costruttore';
import { box, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoEstrusione, geoLastra } from '../forme';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { Collider, OggettoProcedurale } from '../tipi';
import { SUP, legnoOrizzontale, legnoVerticale, occlusionePiede, sup } from '../superfici';
import { cantonali, facciata, finestra, porta, tettoPiode } from './dettagli';

export type TipoAnnesso = 'stalla' | 'legnaia' | 'fienile';

export interface OpzioniAnnesso {
  seme?: Seme;
  tipo?: TipoAnnesso;
  /** lungo X (la cortina), 2,5-5,5 m */
  larghezza?: number;
  /** lungo Z, 3-6 m */
  profondita?: number;
  /** quota della gronda sul davanti (m) */
  altezza?: number;
  /** pendenza della falda in gradi */
  pendenza?: number;
  interrata?: number;
  /** 'basso': meno pezzi (lastre del tetto in due file) */
  dettaglio?: 'alto' | 'basso';
  /** frazione di finestrelle accese di notte (0-1) */
  finestreAccese?: number;
}

/** Tinte dei tetti degli annessi: un po' più chiari e verdi di muschio dei rustici. */
const TINTE: ReadonlyArray<readonly [number, number]> = [
  [0x7d7468, 0.3],
  [0x6a6a5c, 0.35],
  [0x8a7d68, 0.3],
  [0x5e5850, 0.3],
];

export function creaAnnesso(opz: OpzioniAnnesso = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'annesso');
  const rng = new Rng(seme);
  const b = new Costruttore(rng.derivato('geometria'));
  const r = b.rng;
  const tipo: TipoAnnesso = opz.tipo ?? (r.prob(0.45) ? 'stalla' : r.prob(0.5) ? 'legnaia' : 'fienile');
  const W = opz.larghezza ?? r.tra(3, 5);
  const D = opz.profondita ?? r.tra(3.5, 5.5);
  const hF = opz.altezza ?? (tipo === 'fienile' ? r.tra(3.3, 3.9) : r.tra(2.3, 2.9));
  const p = THREE.MathUtils.degToRad(opz.pendenza ?? r.tra(17, 23));
  const hB = hF + D * Math.tan(p);
  const interr = opz.interrata ?? 1;
  const alto = (opz.dettaglio ?? 'alto') === 'alto';
  const tono = mescola(mescola(PALETTE.gneiss, r.prob(0.4) ? PALETTE.gneissViola : PALETTE.gneissCaldo, 0.2 + r.next() * 0.4), 0xcdc2ad, 0.2 + r.next() * 0.25);
  const supMuro = sup(SUP.PIETRA, r.next());

  // --- corpo di pietra: il fianco a trapezio (alto dietro) estruso lungo X
  // (la sagoma sta nel piano (x_s, y) con x_s = −z: davanti a x_s = −D/2, dietro a +D/2)
  const sagoma = new THREE.Shape();
  sagoma.moveTo(-D / 2, -interr);
  sagoma.lineTo(D / 2, -interr);
  sagoma.lineTo(D / 2, hB);
  sagoma.lineTo(-D / 2, hF);
  sagoma.lineTo(-D / 2, -interr);
  // (l'estrusione è centrata lungo z: girata di 90° attorno a Y, z → x e x_s → −z)
  const corpo = geoEstrusione(sagoma, W, 1);
  const legnoSopra = tipo === 'fienile';
  const hPietra = legnoSopra ? Math.min(hF - 0.2, r.tra(1.9, 2.3)) : hB + 1;
  // il corpo è tutto di pietra: nel fienile le assi di larice coprono il davanti e i fianchi sopra
  // `hPietra`, il retro contro il pendio resta un muro (prima, sopra la pietra, era bruno scuro: dal
  // belvedere si vedeva il retro come una scatola di legno scuro)
  b.aggiungi(corpo, {
    matrice: mat([0, 0, 0], [0, Math.PI / 2, 0]),
    colore: tono,
    gradiente: { basso: 0.7, alto: 1.05, y0: -interr * 0.3, y1: hF * 0.9 },
    rumore: 0.04,
    piatto: true,
    superficie: supMuro,
    occlusione: occlusionePiede(0.9, 0.45),
  });
  if (alto) cantonali(b, W, D, -0.1, Math.min(hF, hPietra), 0.5, [
    [1, 1],
    [-1, 1],
  ]);

  // --- fienile: assi verticali di larice sopra la pietra, sul davanti e sui fianchi
  const fronte = facciata(0, D / 2, 0);
  if (legnoSopra) {
    const assi = new THREE.Shape();
    assi.moveTo(-W / 2, hPietra);
    assi.lineTo(W / 2, hPietra);
    assi.lineTo(W / 2, hF);
    assi.lineTo(-W / 2, hF);
    assi.lineTo(-W / 2, hPietra);
    const legnoA = mescola(r.scegli([PALETTE.larice, PALETTE.lariceGrigio, PALETTE.legnoVecchio]), 0xb59a78, 0.25);
    b.aggiungi(geoEstrusione(assi, 0.05), { matrice: mat([0, 0, D / 2 + 0.01]), colore: legnoA, gradiente: { basso: 0.85, alto: 1.0, y0: hPietra, y1: hF }, piatto: true, superficie: legnoVerticale(r.next()), occlusione: 0.08 });
    for (const s of [-1, 1]) {
      const fianco = new THREE.Shape();
      fianco.moveTo(-D / 2, hPietra);
      fianco.lineTo(D / 2, hPietra);
      fianco.lineTo(D / 2, hB - 0.02);
      fianco.lineTo(-D / 2, hF - 0.02);
      fianco.lineTo(-D / 2, hPietra);
      b.aggiungi(geoEstrusione(fianco, 0.05), {
        matrice: mat([s * (W / 2 + 0.03), 0, 0], [0, Math.PI / 2, 0]),
        colore: legnoA,
        piatto: true,
        superficie: legnoVerticale(r.next()),
        occlusione: 0.08,
      });
    }
    // portellone del fieno, socchiuso
    b.aggiungi(geoBoxC(1.1, 1.0, 0.06), { matrice: mat([r.centrato(W * 0.15), hPietra + 0.65, D / 2 + 0.05]), colore: PALETTE.lariceScuro, piatto: true, superficie: legnoVerticale(0.4), occlusione: 0.15 });
    b.aggiungi(geoBoxC(0.96, 0.86, 0.02), { matrice: mat([0, hPietra + 0.65, D / 2 + 0.04]), colore: 0xb89a52, superficie: sup(SUP.NESSUNA) });
  }

  // --- davanti: porta, finestrella o la catasta di legna
  if (tipo === 'legnaia') {
    // fronte aperto: due pilastri e la catasta di ciocchi che riempie il vano (le teste chiare dei ciocchi)
    const hc = Math.min(hF - 0.3, 2.0);
    const lc = W - 0.7;
    b.aggiungi(geoBoxC(lc, hc, 0.5), { matrice: mat([0, hc / 2, D / 2 - 0.2]), colore: 0x4a3626, piatto: true, superficie: sup(SUP.NESSUNA), occlusione: 0.3 });
    const nx = Math.max(4, Math.round(lc / 0.17));
    const ny = Math.max(4, Math.round(hc / 0.17));
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        if (r.prob(0.1)) continue;
        const x = -lc / 2 + (i + 0.5) * (lc / nx) + r.centrato(0.02);
        const y = (j + 0.5) * (hc / ny) + r.centrato(0.02);
        const rr = 0.065 + r.next() * 0.025;
        const g = new THREE.CircleGeometry(rr, 6);
        b.aggiungi(g, { matrice: mat([x, y, D / 2 + 0.06 + r.next() * 0.03]), colore: mescola(0xc9a26a, 0x8a6a44, r.next() * 0.6), superficie: sup(SUP.LEGNO, 0.2), occlusione: 0.12 });
        g.dispose();
      }
    }
    for (const s of [-1, 1]) b.aggiungi(geoLastra(0.36, hF - 0.05, 0.4, r.intero(0, 1e6), 0.04), { matrice: mat([s * (W / 2 - 0.18), 0, D / 2 - 0.1]), colore: PALETTE.gneissChiaro, gradiente: { basso: 0.75, alto: 1, y0: 0, y1: hF }, piatto: true, superficie: supMuro, occlusione: occlusionePiede(0.6, 0.4) });
  } else {
    const pu = W > 3.6 ? r.centrato(W * 0.2) : 0;
    porta(b, fronte, pu, 0, tipo === 'fienile' ? 1.2 : 1.0, tipo === 'fienile' ? Math.min(1.9, hPietra - 0.05) : Math.min(1.85, hF - 0.45), r.scegli([PALETTE.larice, PALETTE.lariceScuro, PALETTE.lariceGrigio]));
    if (tipo === 'stalla' && W > 3.2) {
      const fu = pu > 0 ? -W * 0.28 : W * 0.28;
      finestra(b, fronte, fu, 1.15, { larghezza: 0.36, altezza: 0.42, inferriata: true, accesa: r.prob(opz.finestreAccese ?? 0.3), ante: null });
    }
  }

  // --- tetto di piode a una falda (alta dietro, giù verso il davanti), girato perché la falda
  // scenda verso +Z: il colmo di `tettoPiode` (x = 0) va sul muro di dietro
  const bt = new Costruttore(rng.derivato('tetto'));
  tettoPiode(bt, rng.derivato('piode'), {
    larghezza: 2 * D,
    profondita: W,
    yGronda: hF,
    pendenza: p,
    sporgenzaGronda: 0.45,
    sporgenzaTimpano: 0.22,
    corsi: alto ? 3 : 2,
    pezziPerCorso: alto ? Math.max(3, Math.round(W / 1.2)) : 2,
    falde: [1],
    contrasto: 2,
    tinta: TINTE[Math.abs(Math.floor(seme)) % TINTE.length]!,
  });
  bt.costruisci('tetto-annesso').traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    // (x del tetto → +z dell'annesso; il colmo sul muro di dietro, a z = −D/2)
    b.aggiungi(m.geometry, { matrice: mat([0, 0, -D / 2], [0, -Math.PI / 2, 0]), colore: 'geometria', canale: (m.userData['canale'] as 'opaco') ?? 'opaco' });
  });
  // la trave di gronda chiara sotto lo sporto (si legge lo spessore del tetto)
  b.aggiungi(geoBoxC(W + 0.4, 0.16, 0.18), { matrice: mat([0, hF - 0.06, D / 2 + 0.05]), colore: PALETTE.larice, piatto: true, superficie: legnoOrizzontale(r.next()), occlusione: 0.2 });

  const gruppo = b.costruisci('annesso');
  const collider: Collider[] = [
    box(0, (hF - interr) / 2, 0, W / 2, (hF + interr) / 2, D / 2, 'muro'),
    // la parte alta, sotto la falda, verso il dietro
    box(0, hF + (hB - hF) / 4, -D / 4, W / 2, (hB - hF) / 4, D / 4, 'tetto'),
  ];
  return risultato({
    nome: 'annesso',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: { davanti: new THREE.Vector3(0, 0, D / 2 + 0.5), gronda: new THREE.Vector3(0, hF, D / 2), colmo: new THREE.Vector3(0, hB, -D / 2) },
  });
}
