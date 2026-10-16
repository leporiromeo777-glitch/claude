/**
 * Fienile in legno e pietra: stalla di gneiss al pianterreno, fienile ad assi di legno con i pilastri
 * d'angolo in pietra, portellone del fieno aperto con il fieno che sporge, tetto in piode.
 * Orientamento come il rustico: colmo lungo Z, portellone verso +Z.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../costruttore';
import { box, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoEstrusione, geoLastra, geoMassa, geoPiano } from '../forme';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';
import { cantonali, facciata, finestra, inF, porta, tettoPiode } from './dettagli';
import { SUP } from '../superfici';

export interface OpzioniFienile {
  seme?: Seme;
  larghezza?: number;
  profondita?: number;
  /** altezza della parte in pietra */
  altezzaStalla?: number;
  /** altezza della parte in legno (fino alla gronda) */
  altezzaFienile?: number;
  pendenza?: number;
  /** fieno visibile dal portellone */
  fieno?: boolean;
  /**
   * scivolo di pietra sul retro (predefinito sì). Migliorie «porte»: il fienile di Ottavio ha la
   * porta a monte e il retro più in basso di due metri: lì lo scivolo restava appeso nel vuoto
   */
  scivolo?: boolean;
  interrata?: number;
}

export function creaFienile(opz: OpzioniFienile = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'fienile');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const W = opz.larghezza ?? rng.tra(5.5, 7);
  const D = opz.profondita ?? rng.tra(6, 8);
  const hS = opz.altezzaStalla ?? 2.4;
  const hF = opz.altezzaFienile ?? 2.6;
  const hG = hS + hF;
  const p = THREE.MathUtils.degToRad(opz.pendenza ?? 30);
  const yColmo = hG + (W / 2) * Math.tan(p);
  const interr = opz.interrata ?? 1;
  const tono = mescola(PALETTE.gneiss, PALETTE.gneissCaldo, rng.next() * 0.5);

  // stalla di pietra
  b.aggiungi(geoBoxC(W, hS + interr, D), {
    matrice: mat([0, (hS - interr) / 2, 0]),
    colore: tono,
    gradiente: { basso: 0.65, alto: 1.02, y0: -interr * 0.3, y1: hS },
    rumore: 0.05,
    piatto: true,
  });
  cantonali(b, W, D, -0.1, hG, 0.55);

  // corpo del fienile (legno scuro, fa da fondo alle assi)
  const forma = new THREE.Shape();
  const wi = W / 2 - 0.12;
  forma.moveTo(-wi, hS);
  forma.lineTo(wi, hS);
  forma.lineTo(wi, hG);
  forma.lineTo(0, yColmo - 0.05);
  forma.lineTo(-wi, hG);
  forma.lineTo(-wi, hS);
  const legnoFondo = mescola(PALETTE.legnoScuro, 0x000000, 0.35);
  b.aggiungi(geoEstrusione(forma, D - 0.24), { colore: legnoFondo, piatto: true });

  // assi verticali con fessure su tutti i lati
  const legno = rng.scegli([PALETTE.legnoVecchio, PALETTE.legno, PALETTE.legnoGrigio]);
  const lati: Array<{ f: THREE.Matrix4; l: number; timpano: boolean }> = [
    { f: facciata(0, D / 2 - 0.12, 0), l: W - 0.6, timpano: true },
    { f: facciata(0, -D / 2 + 0.12, Math.PI), l: W - 0.6, timpano: true },
    { f: facciata(W / 2 - 0.12, 0, Math.PI / 2), l: D - 0.6, timpano: false },
    { f: facciata(-W / 2 + 0.12, 0, -Math.PI / 2), l: D - 0.6, timpano: false },
  ];
  const portellone = { u: 0, v: hS + 0.5, w: 1.5, h: 1.7 };
  for (const [i, lato] of lati.entries()) {
    const na = Math.round(lato.l / 0.24);
    const lw = lato.l / na;
    for (let k = 0; k < na; k++) {
      const u = -lato.l / 2 + (k + 0.5) * lw;
      let top = hG - 0.05;
      if (lato.timpano) top = hG + (W / 2 - Math.abs(u) - 0.3) * Math.tan(p) - 0.1;
      const bottom = hS + 0.02;
      // il portellone sul fronte: assi solo sopra
      if (i === 0 && Math.abs(u - portellone.u) < portellone.w / 2) {
        const yb = portellone.v + portellone.h;
        if (top - yb > 0.1) {
          b.aggiungi(geoPiano(lw - 0.045, top - yb), { matrice: inF(lato.f, u, (top + yb) / 2, 0.01), colore: mescola(legno, 0xffffff, rng.next() * 0.12), variazione: 0.08, piatto: true });
        }
        const hb = portellone.v - bottom;
        b.aggiungi(geoPiano(lw - 0.045, hb), { matrice: inF(lato.f, u, bottom + hb / 2, 0.01), colore: mescola(legno, 0xffffff, rng.next() * 0.12), variazione: 0.08, piatto: true });
        continue;
      }
      b.aggiungi(geoPiano(lw - 0.045, top - bottom), {
        matrice: inF(lato.f, u, (top + bottom) / 2, 0.01),
        colore: mescola(legno, 0xffffff, rng.next() * 0.12),
        variazione: 0.08,
        gradiente: { basso: 0.85, alto: 1.05, y0: hS, y1: yColmo },
        piatto: true,
      });
    }
    // trave orizzontale alla base del legno
    b.aggiungi(geoBoxC(lato.l + 0.3, 0.16, 0.18), { matrice: inF(lato.f, 0, hS + 0.05, 0.05), colore: PALETTE.legnoScuro, superficie: SUP.LEGNO, piatto: true });
  }
  // portellone: vano buio, anta aperta, fieno che sporge
  const fF = (lati[0] as { f: THREE.Matrix4 }).f;
  b.aggiungi(geoPiano(portellone.w, portellone.h), { matrice: inF(fF, portellone.u, portellone.v + portellone.h / 2, -0.05), colore: 0x2a2018, piatto: true });
  b.aggiungi(geoBoxC(portellone.w * 0.5, portellone.h, 0.05), {
    matrice: inF(fF, portellone.u - portellone.w / 2 - 0.05, portellone.v + portellone.h / 2, portellone.w * 0.25 + 0.05, [0, -Math.PI / 2 + 0.25, 0]),
    colore: legno,
    variazione: 0.06,
    piatto: true,
  });
  if (opz.fieno ?? true) {
    // mucchio di fieno che riempie il vano e trabocca dalla soglia, con qualche ciuffo caduto
    const cumuli: Array<[number, number, number, number]> = [
      [-0.45, 0.3, -0.35, 0.62],
      [0.4, 0.28, -0.3, 0.6],
      [0.0, 0.55, -0.45, 0.7],
      [-0.1, 0.12, -0.05, 0.5],
      [0.35, 0.05, 0.05, 0.38],
    ];
    for (const [k, [du, dv, dw, rr]] of cumuli.entries()) {
      const g = geoMassa(rr, seme + k, 0.3, 1, 0.75);
      g.scale(1.25, 0.8, 1);
      b.aggiungi(g, {
        matrice: inF(fF, portellone.u + du, portellone.v + dv, dw),
        colore: mescola(PALETTE.fieno, PALETTE.stoppie, rng.next() * 0.5),
        gradiente: { basso: 0.7, alto: 1.12, y0: portellone.v - 0.2, y1: portellone.v + 1.2 },
        rumore: 0.12,
      });
    }
    for (let k = 0; k < 3; k++) {
      const g = geoMassa(0.18 + rng.next() * 0.1, seme + 10 + k, 0.35, 0, 0.5);
      b.aggiungi(g, {
        matrice: inF(fF, portellone.u + rng.centrato(1.2), 0.06, 0.6 + rng.next() * 0.8),
        colore: PALETTE.fieno,
        rumore: 0.1,
      });
    }
  }
  // porta della stalla e finestrelle con inferriata
  const portaStalla = porta(b, facciata(0, D / 2, 0), W * 0.18, 0, 1.1, 1.9, PALETTE.legnoVecchio);
  finestra(b, facciata(0, D / 2, 0), -W * 0.25, 1.1, { larghezza: 0.45, altezza: 0.5, inferriata: true });
  finestra(b, facciata(W / 2, 0, Math.PI / 2), 0, 1.2, { larghezza: 0.45, altezza: 0.45, inferriata: true });

  tettoPiode(b, rng, { larghezza: W, profondita: D, yGronda: hG, pendenza: p, sporgenzaGronda: 0.55, sporgenzaTimpano: 0.4, sporgenzaFronte: 0.7, corsi: 4, pezziPerCorso: 5 });

  // scivolo di pietra sul retro (rampa per il carro del fieno)
  if (opz.scivolo ?? true) b.aggiungi(geoLastra(1.8, 0.25, 2.6, rng.intero(0, 1e6), 0.04), {
    matrice: mat([0, hS - 0.2, -D / 2 - 1.2], [-Math.atan2(hS, 2.6) * 0.35, 0, 0]),
    colore: PALETTE.gneiss, superficie: SUP.PIETRA,
    piatto: true,
  });

  const gruppo = b.costruisci('fienile');
  const hT = yColmo - hG;
  return risultato({
    nome: 'fienile',
    seme,
    gruppo,
    collider: [
      box(0, (hG - interr) / 2, 0, W / 2, (hG + interr) / 2, D / 2, 'muro'),
      box(0, hG + hT * 0.25 + 0.1, 0.15, W / 2 + 0.3, hT * 0.25 + 0.1, D / 2 + 0.55, 'tetto'),
      box(0, hG + hT * 0.72 + 0.1, 0.15, W / 4 + 0.2, hT * 0.25 + 0.1, D / 2 + 0.55, 'tetto'),
    ],
    ingombro: ingombroDa(gruppo),
    punti: {
      porta: new THREE.Vector3(W * 0.18, 0, D / 2 + 0.6),
      portellone: new THREE.Vector3(portellone.u, portellone.v, D / 2),
      colmo: new THREE.Vector3(0, yColmo, 0),
    },
    porte: [portaStalla],
  });
}
