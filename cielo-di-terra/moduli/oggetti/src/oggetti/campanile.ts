/**
 * Campanile romanico di San Vigilio: un unico blocco bianco di calce con lesene, archetti pensili,
 * feritoie, cella campanaria con bifore e campane, cappello di piode a piramide e, in cima,
 * il Pilastro 1 (colonnina di bronzo con la targa del 2120) e la palina bianca e rossa.
 * La porta guarda +Z.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../costruttore';
import { box, cil, ingombroDa, risultato } from '../comune';
import { formaArco, geoBoxC, geoCilindro, geoEstrusione, geoLastra } from '../forme';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';
import { aggiungiPalina, numero, testaChiodo } from './caposaldo';

export interface OpzioniCampanile {
  seme?: Seme;
  /** lato della pianta quadrata (m) */
  lato?: number;
  /** altezza del fusto fino alla cella (m) */
  altezzaFusto?: number;
  /** numero di ordini (cornici con archetti) sul fusto */
  ordini?: number;
  /** palina del Pilastro 1 sulla cima */
  palina?: boolean;
  /** altezza della palina del Pilastro 1 (8 m secondo capisaldi.json) */
  altezzaPalina?: number;
  /** aperture della cella: bifore o trifore */
  aperture?: 2 | 3;
}

export function creaCampanile(opz: OpzioniCampanile = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'san-vigilio');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const L = opz.lato ?? 4.4;
  const hF = opz.altezzaFusto ?? 19;
  const ordini = opz.ordini ?? 4;
  const hC = 4.4; // cella
  const interr = 1.0;
  const calce = PALETTE.calce;
  const ombraCalce = mescola(PALETTE.calceOmbra, PALETTE.gneissViola, 0.45);

  // fusto
  b.aggiungi(geoBoxC(L, hF + interr, L), {
    matrice: mat([0, (hF - interr) / 2, 0]),
    colore: calce,
    gradiente: { basso: 0.82, alto: 1.02, y0: 0, y1: hF * 0.5 },
    rumore: 0.03,
  });
  // zoccolo di pietra a vista
  b.aggiungi(geoLastra(L + 0.2, 1.2 + interr, L + 0.2, rng.intero(0, 1e6), 0.01), {
    matrice: mat([0, -interr, 0]),
    colore: PALETTE.gneiss,
    gradiente: { basso: 0.7, alto: 1.0, y0: 0, y1: 1.2 },
    piatto: true,
  });
  // lesene sugli spigoli e cornici con archetti pensili per ordine
  const hOrd = hF / ordini;
  const sp = 0.07;
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    b.aggiungi(geoBoxC(0.5, hF - 1.2, 0.5), {
      matrice: mat([sx * (L / 2 - 0.25 + sp), 1.2 + (hF - 1.2) / 2, sz * (L / 2 - 0.25 + sp)]),
      colore: calce,
      gradiente: { basso: 0.85, alto: 1.02, y0: 0, y1: hF * 0.5 },
    });
  }
  for (let o = 1; o <= ordini; o++) {
    const y = o * hOrd;
    // cornice
    b.aggiungi(geoBoxC(L + 0.34, 0.16, L + 0.34), { matrice: mat([0, y - 0.08, 0]), colore: PALETTE.calce, piatto: true });
    // archetti pensili: piccoli archi in ombra dipinti sotto la cornice
    const n = 5;
    for (let lato = 0; lato < 4; lato++) {
      const rot = (lato * Math.PI) / 2;
      for (let k = 0; k < n; k++) {
        const u = -L / 2 + 0.5 + ((k + 0.5) * (L - 1.0)) / n;
        const arco = new THREE.ShapeGeometry(formaArco((L - 1.0) / n - 0.1, 0.42, 5));
        arco.deleteAttribute('uv');
        const pos = new THREE.Vector3(u, y - 0.6, L / 2 + sp + 0.005).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        b.aggiungi(arco, { matrice: mat(pos, [0, rot, 0]), colore: ombraCalce, piatto: true });
      }
    }
    // feritoia sull'asse di ogni lato (solo ordini intermedi)
    if (o < ordini) {
      for (let lato = 0; lato < 4; lato++) {
        if ((lato + o) % 2 === 1) continue;
        const rot = (lato * Math.PI) / 2;
        const pos = new THREE.Vector3(0, y - hOrd * 0.62, L / 2 + 0.01).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        const fer = new THREE.ShapeGeometry(formaArco(0.22, 1.0, 4));
        fer.deleteAttribute('uv');
        b.aggiungi(fer, { matrice: mat(pos, [0, rot, 0]), colore: PALETTE.finestraBuia, canale: 'lume' });
      }
    }
  }

  // porta ad arco
  const formaPorta = new THREE.ShapeGeometry(formaArco(1.2, 2.5, 6));
  formaPorta.deleteAttribute('uv');
  b.aggiungi(formaPorta, { matrice: mat([0, 0, L / 2 + 0.02]), colore: PALETTE.legnoScuro });
  const ghiera = new THREE.Shape();
  {
    const ri = 0.6;
    const re = 0.82;
    ghiera.moveTo(-re, 1.9);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      ghiera.lineTo(Math.cos(a) * re, 1.9 + Math.sin(a) * re);
    }
    ghiera.lineTo(ri, 1.9);
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      ghiera.lineTo(Math.cos(a) * ri, 1.9 + Math.sin(a) * ri);
    }
    ghiera.lineTo(-re, 1.9);
  }
  b.aggiungi(geoEstrusione(ghiera, 0.12), { matrice: mat([0, 0, L / 2 + 0.06]), colore: PALETTE.gneissChiaro, piatto: true });

  // cella campanaria: quattro pareti con bifore (o trifore) vere
  const nAp = opz.aperture ?? 2;
  const spessore = 0.45;
  const wAp = nAp === 2 ? 0.95 : 0.7;
  const hAp = 2.5;
  const yAp = hF + 0.9;
  for (let lato = 0; lato < 4; lato++) {
    const rot = (lato * Math.PI) / 2;
    const s = new THREE.Shape();
    const lw = L / 2;
    s.moveTo(-lw, hF);
    s.lineTo(lw, hF);
    s.lineTo(lw, hF + hC);
    s.lineTo(-lw, hF + hC);
    s.lineTo(-lw, hF);
    for (let k = 0; k < nAp; k++) {
      const u = (k - (nAp - 1) / 2) * (wAp + 0.32);
      const arco = formaArco(wAp, hAp, 6);
      const pts = arco.getPoints();
      const path = new THREE.Path();
      // i fori vanno in senso opposto al contorno
      const rev = pts.slice().reverse();
      rev.forEach((p, i) => (i === 0 ? path.moveTo(p.x + u, p.y + yAp) : path.lineTo(p.x + u, p.y + yAp)));
      s.holes.push(path);
    }
    const geo = geoEstrusione(s, spessore, 6);
    const pos = new THREE.Vector3(0, 0, L / 2 - spessore / 2 + 0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    b.aggiungi(geo, {
      matrice: mat(pos, [0, rot, 0], [1.03, 1, 1]),
      colore: calce,
      gradiente: { basso: 0.95, alto: 1.03, y0: hF, y1: hF + hC },
      piatto: true,
    });
    // colonnine con capitello fra le aperture
    for (let k = 0; k < nAp - 1; k++) {
      const u = (k - (nAp - 2) / 2) * (wAp + 0.32);
      const pc = new THREE.Vector3(u, yAp, L / 2 - spessore / 2 + 0.06).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      b.aggiungi(geoCilindro(0.1, 0.12, hAp - wAp / 2 - 0.25, 8), { matrice: mat(pc), colore: PALETTE.gneissChiaro });
      b.aggiungi(geoLastra(0.36, 0.22, 0.42, rng.intero(0, 1e6), 0.04), {
        matrice: mat(pc.clone().add(new THREE.Vector3(0, hAp - wAp / 2 - 0.25, 0)), [0, rot, 0]),
        colore: PALETTE.gneissChiaro,
        piatto: true,
      });
    }
  }
  // pavimento della cella (scuro) e interno in ombra
  b.aggiungi(geoBoxC(L - 0.4, 0.2, L - 0.4), { matrice: mat([0, hF + 0.1, 0]), colore: mescola(calce, 0x000000, 0.55), piatto: true });
  b.aggiungi(geoBoxC(L - 0.8, hC - 0.3, L - 0.8), { matrice: mat([0, hF + hC / 2, 0]), colore: mescola(calce, 0x302a3a, 0.75), piatto: true });
  // campane (profilo a tornio) appese a un ceppo di legno
  const profilo: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.62, 0.0),
    new THREE.Vector2(0.58, 0.12),
    new THREE.Vector2(0.44, 0.42),
    new THREE.Vector2(0.38, 0.85),
    new THREE.Vector2(0.3, 1.0),
    new THREE.Vector2(0.0, 1.05),
  ];
  const campana = new THREE.LatheGeometry(profilo, 10);
  campana.deleteAttribute('uv');
  // le tre campane: la grande davanti, le due minori sui fianchi
  for (let lato = 0; lato < 3; lato++) {
    const rot = (lato * Math.PI) / 2;
    const pc = new THREE.Vector3(0, yAp + 0.6, L / 2 - spessore - 0.25).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    b.aggiungi(campana, { matrice: mat(pc, [0, 0, 0], lato === 0 ? 1 : lato === 1 ? 0.8 : 0.65), colore: PALETTE.bronzo, gradiente: { basso: 0.8, alto: 1.15, y0: yAp + 0.6, y1: yAp + 1.6 } });
    b.aggiungi(geoBoxC(0.25, 0.3, 1.4), { matrice: mat(pc.clone().add(new THREE.Vector3(0, 1.2, 0)), [0, rot + Math.PI / 2, 0]), colore: PALETTE.legnoScuro, piatto: true });
  }
  // terrazza sommitale: cornice, pavimento di lastre, parapetto basso
  const yTop = hF + hC;
  const lt = L + 0.5;
  b.aggiungi(geoBoxC(lt, 0.22, lt), { matrice: mat([0, yTop + 0.11, 0]), colore: PALETTE.calce, piatto: true });
  b.aggiungi(geoBoxC(lt - 0.5, 0.04, lt - 0.5), { matrice: mat([0, yTop + 0.24, 0]), colore: PALETTE.gneissChiaro, variazione: 0.04, piatto: true });
  const yPav = yTop + 0.26;
  const hPar = 0.55;
  for (let lato = 0; lato < 4; lato++) {
    const rot = (lato * Math.PI) / 2;
    const pc = new THREE.Vector3(0, yPav, lt / 2 - 0.13).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    b.aggiungi(geoBoxC(lt, hPar, 0.26), { matrice: mat(pc.clone().add(new THREE.Vector3(0, hPar / 2, 0)), [0, rot, 0]), colore: PALETTE.calce, gradiente: { basso: 0.9, alto: 1.02, y0: yPav, y1: yPav + hPar }, piatto: true });
    b.aggiungi(geoLastra(lt + 0.04, 0.08, 0.34, rng.intero(0, 1e6), 0.03), { matrice: mat(pc.clone().add(new THREE.Vector3(0, hPar, 0)), [0, rot, 0]), colore: PALETTE.gneissChiaro, piatto: true });
  }

  // cuspide di piode al centro della terrazza: piramide a gradoni
  const hTetto = 5.0;
  const base = L * 0.36;
  const strati = 5;
  for (let st = 0; st < strati; st++) {
    const t0 = st / strati;
    const t1 = (st + 1) / strati;
    const r0 = base * (1 - t0) * Math.SQRT2;
    const r1 = base * (1 - t1) * Math.SQRT2;
    const g = new THREE.CylinderGeometry(r1, r0 + 0.04, (hTetto / strati) * 1.05, 4, 1, false);
    g.deleteAttribute('uv');
    g.translate(0, hTetto / strati / 2, 0);
    b.aggiungi(g, {
      matrice: mat([0, yPav + t0 * hTetto, 0], [0, Math.PI / 4 + rng.centrato(0.02), 0]),
      colore: mescola(PALETTE.piode, st % 2 === 0 ? PALETTE.piodeChiare : PALETTE.piodeScure, 0.35),
      variazione: 0.06,
      piatto: true,
    });
  }
  // zoccolo della cuspide e croce di ferro in cima
  b.aggiungi(geoBoxC(base * 2 + 0.2, 0.35, base * 2 + 0.2), { matrice: mat([0, yPav + 0.17, 0]), colore: PALETTE.calce, piatto: true });
  const yApice = yPav + hTetto;
  b.aggiungi(geoBoxC(0.05, 0.9, 0.05), { matrice: mat([0, yApice + 0.4, 0]), colore: PALETTE.ferro, piatto: true });
  b.aggiungi(geoBoxC(0.45, 0.05, 0.05), { matrice: mat([0, yApice + 0.6, 0]), colore: PALETTE.ferro, piatto: true });
  // botola di legno da cui si esce sulla terrazza (dalla scala interna)
  b.aggiungi(geoBoxC(0.8, 0.06, 0.8), { matrice: mat([-(lt / 2 - 0.75), yPav + 0.03, -(lt / 2 - 0.75)]), colore: PALETTE.legnoVecchio, piatto: true });
  b.aggiungi(geoBoxC(0.7, 0.02, 0.06), { matrice: mat([-(lt / 2 - 0.75), yPav + 0.07, -(lt / 2 - 0.75) + 0.2]), colore: PALETTE.ferro, piatto: true });

  // Pilastro 1 sulla terrazza, accanto alla cuspide: colonnina di bronzo, targa del 2120, chiodo e palina
  const punti: Record<string, THREE.Vector3> = {};
  const px = lt / 2 - 0.62;
  const pz = lt / 2 - 0.62;
  const hPil = 1.15;
  b.aggiungi(geoCilindro(0.17, 0.21, 0.1, 8), { matrice: mat([px, yPav, pz]), colore: PALETTE.bronzoScuro, piatto: true });
  b.aggiungi(geoCilindro(0.15, 0.17, hPil, 8), { matrice: mat([px, yPav + 0.1, pz]), colore: PALETTE.bronzo, gradiente: { basso: 0.75, alto: 1.1, y0: yPav, y1: yPav + hPil }, piatto: true });
  b.aggiungi(geoCilindro(0.2, 0.16, 0.1, 8), { matrice: mat([px, yPav + hPil + 0.1, pz]), colore: PALETTE.bronzoScuro, piatto: true });
  const mTarga = mat([px, yPav + hPil * 0.62, pz], [0, Math.PI / 4, 0]).multiply(mat([0, 0, 0.155]));
  b.aggiungi(geoBoxC(0.22, 0.26, 0.015), { matrice: mTarga, colore: PALETTE.ottone });
  numero(b, '1', mTarga.clone().multiply(mat([0, 0.045, 0.008])), 0.09, PALETTE.bronzoScuro);
  numero(b, '2120', mTarga.clone().multiply(mat([0, -0.075, 0.008])), 0.035, PALETTE.bronzoScuro, 0.003);
  const yChiodo = yPav + hPil + 0.2;
  // chiodo numerato sulla sommità del pilastro
  testaChiodo(b, mat([px, yChiodo, pz]), 1);
  punti['chiodo'] = new THREE.Vector3(px, yChiodo + 0.02, pz);
  punti['terrazza'] = new THREE.Vector3(0.0, yPav, lt / 2 - 0.9);
  punti['botolaTerrazza'] = new THREE.Vector3(-(lt / 2 - 0.75), yPav, -(lt / 2 - 0.75));
  if (opz.palina ?? true) {
    // la palina sta su un collare di ferro accanto al chiodo
    const bp = new THREE.Vector3(px - 0.26, yPav, pz + 0.05);
    b.aggiungi(geoCilindro(0.07, 0.08, 0.5, 6), { matrice: mat(bp), colore: PALETTE.ferro });
    punti['cima'] = aggiungiPalina(b, bp.clone().add(new THREE.Vector3(0, 0.5, 0)), opz.altezzaPalina ?? 8, 1.0, 0.075);
  }
  punti['porta'] = new THREE.Vector3(0, 0, L / 2 + 0.8);
  punti['campane'] = new THREE.Vector3(0, yAp + 1, 0);

  const gruppo = b.costruisci('campanile');
  return risultato({
    nome: 'campanile',
    seme,
    gruppo,
    collider: [
      box(0, (yTop - interr) / 2, 0, L / 2 + 0.1, (yTop + interr) / 2, L / 2 + 0.1, 'muro'),
      box(0, yTop + 0.13, 0, lt / 2, 0.13, lt / 2, 'calpestabile'),
      box(0, yPav + hPar / 2, lt / 2 - 0.13, lt / 2, hPar / 2, 0.13, 'muro'),
      box(0, yPav + hPar / 2, -(lt / 2 - 0.13), lt / 2, hPar / 2, 0.13, 'muro'),
      box(lt / 2 - 0.13, yPav + hPar / 2, 0, 0.13, hPar / 2, lt / 2, 'muro'),
      box(-(lt / 2 - 0.13), yPav + hPar / 2, 0, 0.13, hPar / 2, lt / 2, 'muro'),
      box(0, yPav + hTetto / 2, 0, base + 0.1, hTetto / 2, base + 0.1, 'tetto'),
      cil(px, yPav, pz, 0.21, hPil + 0.2, 'caposaldo'),
    ],
    ingombro: ingombroDa(gruppo),
    punti,
  });
}
