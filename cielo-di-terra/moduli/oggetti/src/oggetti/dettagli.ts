/**
 * Dettagli architettonici condivisi da rustici, fienili e campanile:
 * finestre con davanzale e architrave, ante, gerani, porte, balconi di legno, camini,
 * cantonali di pietra e tetti in piode.
 *
 * Le «facciate» sono sistemi di riferimento: x lungo la facciata, y in su, z verso l'esterno,
 * origine sulla superficie del muro alla quota y = 0 dell'oggetto.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../costruttore';
import { geoBoxC, geoCiuffo, geoLastra, geoPiano } from '../forme';
import { PALETTE } from '../palette';
import type { Rng } from '../rng';

/** Sistema di riferimento di una facciata: centro (cx, cz) sul muro, rotY tale che +Z locale esca dal muro. */
export function facciata(cx: number, cz: number, rotY: number, y = 0): THREE.Matrix4 {
  return mat([cx, y, cz], [0, rotY, 0]);
}

/** Matrice di un elemento in coordinate di facciata (u lungo il muro, v quota, w sporgenza). */
export function inF(f: THREE.Matrix4, u: number, v: number, w: number, rot: [number, number, number] = [0, 0, 0], scala: number | [number, number, number] = 1): THREE.Matrix4 {
  return f.clone().multiply(mat([u, v, w], rot, scala));
}

export const COLORI_ANTE = [0x5b6b4a, 0x6b4a33, 0x4f5f66, 0x7a5a3a, 0x86745a] as const;

export interface OpzioniFinestra {
  larghezza: number;
  altezza: number;
  /** colore delle ante (null = senza ante) */
  ante?: number | null;
  /** contorno dipinto a calce attorno alla finestra */
  contornoCalce?: boolean;
  gerani?: boolean;
  /** finestra accesa di notte */
  accesa?: boolean;
  /** inferriata invece della crociera di legno (pianterreno, stalle) */
  inferriata?: boolean;
}

/** Finestra rettangolare con architrave, davanzale, crociera, ante e gerani facoltativi. v = quota del davanzale. */
export function finestra(b: Costruttore, f: THREE.Matrix4, u: number, v: number, o: OpzioniFinestra): void {
  const w = o.larghezza;
  const h = o.altezza;
  const rng = b.rng;
  if (o.contornoCalce) {
    b.aggiungi(geoBoxC(w + 0.34, h + 0.36, 0.02), {
      matrice: inF(f, u, v + h / 2 + 0.02, 0.005),
      colore: PALETTE.calce,
      variazione: 0.04,
      piatto: true,
    });
  }
  // vetro (canale lume: buio di giorno, caldo di notte se accesa)
  const vetro = geoPiano(w, h);
  b.aggiungi(vetro, {
    matrice: inF(f, u, v + h / 2, 0.02),
    colore: o.accesa ? mescola(PALETTE.finestraAccesa, PALETTE.lumeArancio, rng.next() * 0.4) : PALETTE.finestraBuia,
    canale: 'lume',
    gradiente: o.accesa ? { basso: 1.1, alto: 0.75, y0: v, y1: v + h } : { basso: 1, alto: 1.3, y0: v, y1: v + h },
  });
  // crociera o inferriata
  if (o.inferriata) {
    const n = Math.max(2, Math.round(w / 0.16));
    for (let i = 1; i < n; i++) {
      b.aggiungi(geoBoxC(0.025, h, 0.025), { matrice: inF(f, u - w / 2 + (i * w) / n, v + h / 2, 0.05), colore: PALETTE.ferro, piatto: true });
    }
  } else {
    b.aggiungi(geoPiano(0.05, h), { matrice: inF(f, u, v + h / 2, 0.03), colore: PALETTE.legnoScuro, piatto: true });
    b.aggiungi(geoPiano(w, 0.05), { matrice: inF(f, u, v + h * 0.58, 0.032), colore: PALETTE.legnoScuro, piatto: true });
  }
  // architrave e davanzale in pietra
  b.aggiungi(geoLastra(w + 0.36, 0.17, 0.14, rng.intero(0, 1e6), 0.1), {
    matrice: inF(f, u, v + h, 0.04),
    colore: PALETTE.gneissChiaro,
    variazione: 0.06,
    piatto: true,
  });
  b.aggiungi(geoLastra(w + 0.24, 0.07, 0.22, rng.intero(0, 1e6), 0.1), {
    matrice: inF(f, u, v - 0.07, 0.07),
    colore: PALETTE.gneissChiaro,
    variazione: 0.06,
    piatto: true,
  });
  // ante aperte contro il muro
  if (o.ante !== undefined && o.ante !== null) {
    const c = o.ante;
    for (const s of [-1, 1]) {
      b.aggiungi(geoBoxC(w / 2, h, 0.04), {
        matrice: inF(f, u + s * (w / 2 + w / 4 + 0.03), v + h / 2, 0.03),
        colore: c,
        variazione: 0.06,
        gradiente: { basso: 0.85, alto: 1.05, y0: v, y1: v + h },
        piatto: true,
      });
      // traversa scura sull'anta (dipinta, 2 triangoli)
      b.aggiungi(geoPiano(w / 2 - 0.04, 0.05), {
        matrice: inF(f, u + s * (w / 2 + w / 4 + 0.03), v + h * 0.3, 0.051),
        colore: mescola(c, 0x000000, 0.35),
        piatto: true,
      });
    }
  }
  if (o.gerani) gerani(b, f, u, v, w + 0.12);
}

/** Cassetta di gerani sul davanzale (quota v), larghezza l. */
export function gerani(b: Costruttore, f: THREE.Matrix4, u: number, v: number, l: number): void {
  const rng = b.rng;
  b.aggiungi(geoBoxC(l, 0.16, 0.18), {
    matrice: inF(f, u, v + 0.08, 0.22),
    colore: PALETTE.legno,
    variazione: 0.1,
    piatto: true,
  });
  // foglie
  const nf = Math.max(2, Math.round(l / 0.3));
  for (let i = 0; i < nf; i++) {
    const x = u - l / 2 + ((i + 0.5) * l) / nf;
    b.aggiungi(geoCiuffo(0.13, rng.intero(0, 1e6), 0.7), {
      matrice: inF(f, x, v + 0.2, 0.24),
      colore: PALETTE.fogliaGeranio,
      variazione: 0.12,
      piatto: true,
    });
  }
  // fiori
  const nfiori = Math.max(3, Math.round(l / 0.18));
  const tinta = rng.prob(0.7) ? PALETTE.geranio : PALETTE.geranioRosa;
  for (let i = 0; i < nfiori; i++) {
    const x = u - l / 2 + 0.06 + rng.next() * (l - 0.12);
    b.aggiungi(geoCiuffo(0.075 + rng.next() * 0.03, rng.intero(0, 1e6), 0.9), {
      matrice: inF(f, x, v + 0.29 + rng.next() * 0.08, 0.2 + rng.next() * 0.12),
      colore: tinta,
      variazione: 0.12,
      piatto: true,
    });
  }
}

/** Porta di legno con stipiti e architrave di pietra; la base è a v. */
export function porta(b: Costruttore, f: THREE.Matrix4, u: number, v: number, larghezza = 1.0, altezza = 1.95, colore: number = PALETTE.legno): void {
  const rng = b.rng;
  b.aggiungi(geoBoxC(larghezza, altezza, 0.08), {
    matrice: inF(f, u, v + altezza / 2, -0.01),
    colore,
    variazione: 0.08,
    gradiente: { basso: 0.75, alto: 1.0, y0: v, y1: v + altezza },
    piatto: true,
  });
  // assi verticali (fughe scure)
  for (let i = 1; i < 4; i++) {
    b.aggiungi(geoBoxC(0.025, altezza - 0.05, 0.02), {
      matrice: inF(f, u - larghezza / 2 + (i * larghezza) / 4, v + altezza / 2, 0.035),
      colore: mescola(colore, 0x000000, 0.45),
      piatto: true,
    });
  }
  // stipiti e architrave
  for (const s of [-1, 1]) {
    b.aggiungi(geoLastra(0.2, altezza, 0.16, rng.intero(0, 1e6), 0.08), {
      matrice: inF(f, u + s * (larghezza / 2 + 0.1), v, 0.04),
      colore: PALETTE.gneissChiaro,
      variazione: 0.07,
      piatto: true,
    });
  }
  b.aggiungi(geoLastra(larghezza + 0.6, 0.24, 0.18, rng.intero(0, 1e6), 0.08), {
    matrice: inF(f, u, v + altezza, 0.05),
    colore: PALETTE.gneissChiaro,
    variazione: 0.06,
    piatto: true,
  });
  // soglia
  b.aggiungi(geoLastra(larghezza + 0.5, 0.12, 0.5, rng.intero(0, 1e6), 0.1), {
    matrice: inF(f, u, v - 0.1, 0.2),
    colore: PALETTE.gneiss,
    variazione: 0.06,
    piatto: true,
  });
}

/**
 * Balcone (lobbia) di legno: assito, mensole sporgenti, ringhiera ad assicelle.
 * v = quota dell'assito, sp = sporgenza dal muro, l = larghezza lungo la facciata.
 */
export function balcone(b: Costruttore, f: THREE.Matrix4, u: number, v: number, l: number, sp = 1.0, altezzaPali = 0): void {
  const rng = b.rng;
  const legno = rng.scegli([PALETTE.legno, PALETTE.legnoVecchio, PALETTE.legnoGrigio]);
  // assito
  b.aggiungi(geoBoxC(l, 0.08, sp), { matrice: inF(f, u, v, sp / 2), colore: legno, variazione: 0.06, piatto: true });
  // mensole
  const nm = Math.max(2, Math.round(l / 1.2) + 1);
  for (let i = 0; i < nm; i++) {
    const x = u - l / 2 + 0.1 + (i * (l - 0.2)) / (nm - 1);
    b.aggiungi(geoBoxC(0.12, 0.16, sp + 0.15), {
      matrice: inF(f, x, v - 0.12, (sp + 0.15) / 2),
      colore: PALETTE.legnoScuro,
      piatto: true,
    });
  }
  // ringhiera: corrimano, traverso basso, assicelle
  const hr = 0.95;
  const legnoChiaro = mescola(legno, 0xffffff, 0.08);
  b.aggiungi(geoBoxC(l, 0.07, 0.08), { matrice: inF(f, u, v + hr, sp - 0.04), colore: legnoChiaro, piatto: true });
  b.aggiungi(geoBoxC(l, 0.06, 0.06), { matrice: inF(f, u, v + 0.15, sp - 0.04), colore: legno, piatto: true });
  for (const s of [-1, 1]) {
    b.aggiungi(geoBoxC(0.07, hr, 0.07), { matrice: inF(f, u + s * (l / 2 - 0.035), v + hr / 2, sp - 0.04), colore: legno, piatto: true });
    b.aggiungi(geoBoxC(0.06, 0.07, sp), { matrice: inF(f, u + s * (l / 2 - 0.035), v + hr, sp / 2), colore: legnoChiaro, piatto: true });
  }
  const passo = 0.2;
  const na = Math.floor((l - 0.1) / passo);
  for (let i = 1; i < na; i++) {
    const x = u - l / 2 + 0.05 + i * passo;
    b.aggiungi(geoBoxC(0.09, hr - 0.15, 0.025), {
      matrice: inF(f, x, v + 0.04 + (hr - 0.15) / 2 + 0.04, sp - 0.04),
      colore: legno,
      variazione: 0.08,
      piatto: true,
    });
  }
  // pali fino alla gronda
  if (altezzaPali > 0) {
    for (const s of [-1, 1]) {
      b.aggiungi(geoBoxC(0.12, altezzaPali, 0.12), {
        matrice: inF(f, u + s * (l / 2 - 0.06), v + altezzaPali / 2, sp - 0.06),
        colore: PALETTE.legnoScuro,
        piatto: true,
      });
    }
  }
}

/** Camino di pietra con il cappello di piode. (x, z) in pianta, yBase = quota della base, h = altezza. */
export function camino(b: Costruttore, x: number, yBase: number, z: number, h: number): void {
  const rng = b.rng;
  b.aggiungi(geoLastra(0.6, h, 0.6, rng.intero(0, 1e6), 0.06), {
    matrice: mat([x, yBase, z]),
    colore: PALETTE.gneiss,
    gradiente: { basso: 0.8, alto: 1.05, y0: yBase, y1: yBase + h },
    variazione: 0.05,
    piatto: true,
  });
  for (const [dx, dz] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]] as const) {
    b.aggiungi(geoBoxC(0.1, 0.25, 0.1), { matrice: mat([x + dx, yBase + h + 0.12, z + dz]), colore: PALETTE.gneissScuro, piatto: true });
  }
  b.aggiungi(geoLastra(0.95, 0.08, 0.95, rng.intero(0, 1e6), 0.15), {
    matrice: mat([x, yBase + h + 0.25, z], [rng.centrato(0.06), rng.next(), rng.centrato(0.06)]),
    colore: PALETTE.piode,
    variazione: 0.08,
    piatto: true,
  });
}

/**
 * Cantonali: blocchi alternati lunghi/corti sugli spigoli verticali di un volume w×d (centrato in 0),
 * dalla quota y0 alla quota y1.
 */
export function cantonali(b: Costruttore, w: number, d: number, y0: number, y1: number, altezzaCorso = 0.5, spigoli: Array<[number, number]> = [[1, 1], [-1, 1], [1, -1], [-1, -1]]): void {
  const rng = b.rng;
  const n = Math.max(1, Math.floor((y1 - y0) / altezzaCorso));
  const hc = (y1 - y0) / n;
  for (const [sx, sz] of spigoli) {
    for (let i = 0; i < n; i++) {
      const lungo = (i + (sx > 0 ? 0 : 1)) % 2 === 0;
      const lx = lungo ? 0.75 : 0.42;
      const lz = lungo ? 0.42 : 0.75;
      const y = y0 + i * hc;
      b.aggiungi(geoLastra(lx, hc - 0.03, lz, rng.intero(0, 1e6), 0.06), {
        matrice: mat([sx * (w / 2 - lx / 2 + 0.035), y + 0.015, sz * (d / 2 - lz / 2 + 0.035)]),
        colore: mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next() * 0.5),
        variazione: 0.07,
        gradiente: { basso: 0.85, alto: 1.03, y0, y1 },
        piatto: true,
      });
    }
  }
}

/**
 * Pietre a vista: quadrilateri leggermente sporgenti e di tono diverso sparsi sulla facciata,
 * per suggerire la muratura senza texture.
 */
export function pietreAVista(b: Costruttore, f: THREE.Matrix4, larghezza: number, y0: number, y1: number, quante: number, evitare: Array<[number, number, number, number]> = []): void {
  const rng = b.rng;
  let messe = 0;
  for (let t = 0; t < quante * 4 && messe < quante; t++) {
    const pw = 0.3 + rng.next() * 0.45;
    const ph = 0.14 + rng.next() * 0.16;
    const u = rng.tra(-larghezza / 2 + pw / 2 + 0.3, larghezza / 2 - pw / 2 - 0.3);
    const v = rng.tra(y0 + 0.2, y1 - 0.2);
    if (evitare.some(([u0, v0, u1, v1]) => u > u0 - pw / 2 && u < u1 + pw / 2 && v > v0 - ph / 2 && v < v1 + ph / 2)) continue;
    const scuro = rng.prob(0.5);
    b.aggiungi(geoPiano(pw, ph), {
      matrice: inF(f, u, v, 0.012, [0, 0, rng.centrato(0.08)]),
      colore: scuro ? mescola(PALETTE.gneissScuro, PALETTE.gneissViola, rng.next()) : mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, rng.next()),
      variazione: 0.05,
      piatto: true,
    });
    messe++;
  }
}

export interface OpzioniTetto {
  /** larghezza del corpo (X), il colmo corre lungo Z */
  larghezza: number;
  /** profondità del corpo (Z) */
  profondita: number;
  /** quota della linea di gronda sul muro */
  yGronda: number;
  /** pendenza in radianti */
  pendenza: number;
  sporgenzaGronda?: number;
  sporgenzaTimpano?: number;
  /** sporgenza sul timpano anteriore (+Z), se diversa (balcone sotto il tetto) */
  sporgenzaFronte?: number;
  /** corsi di piode per falda (0 = solo lastra di base) */
  corsi?: number;
  /** pezzi per corso lungo Z */
  pezziPerCorso?: number;
  /** solo una falda: +1 destra, -1 sinistra (tetti a una falda dei fienili addossati) */
  falde?: Array<1 | -1>;
}

/** Tetto a due falde in piode, colmo lungo Z. Restituisce la quota del colmo. */
export function tettoPiode(b: Costruttore, rng: Rng, o: OpzioniTetto): number {
  const sg = o.sporgenzaGronda ?? 0.45;
  const st = o.sporgenzaTimpano ?? 0.3;
  const corsi = o.corsi ?? 4;
  const ppc = o.pezziPerCorso ?? 5;
  const p = o.pendenza;
  const w2 = o.larghezza / 2;
  const yColmo = o.yGronda + w2 * Math.tan(p);
  const lFalda = (w2 + sg) / Math.cos(p);
  const sf = o.sporgenzaFronte ?? st;
  const dTot = o.profondita + st + sf;
  const zc = (sf - st) / 2;
  const sp = 0.16;
  for (const s of o.falde ?? [1, -1]) {
    // direzione lungo la falda (dal colmo verso la gronda) e normale
    const dir = new THREE.Vector3(s * Math.cos(p), -Math.sin(p), 0);
    const nrm = new THREE.Vector3(s * Math.sin(p), Math.cos(p), 0);
    const colmo = new THREE.Vector3(0, yColmo, 0);
    const rotZ = -s * p;
    // lastra di base
    const cBase = colmo.clone().addScaledVector(dir, lFalda / 2).addScaledVector(nrm, sp / 2);
    cBase.z = zc;
    b.aggiungi(geoBoxC(lFalda + 0.05, sp, dTot), {
      matrice: mat(cBase, [0, 0, rotZ]),
      colore: PALETTE.piodeScure,
      variazione: 0.03,
      piatto: true,
    });
    if (corsi <= 0) continue;
    // corsi di lastre sovrapposte, con il bordo inferiore irregolare
    const passo = lFalda / corsi;
    for (let c = 0; c < corsi; c++) {
      const s0 = c * passo;
      let z = zc - dTot / 2;
      const larghezze: number[] = [];
      let somma = 0;
      for (let k = 0; k < ppc; k++) {
        const lw = 0.6 + rng.next();
        larghezze.push(lw);
        somma += lw;
      }
      for (let k = 0; k < ppc; k++) {
        const lz = ((larghezze[k] as number) / somma) * dTot;
        const lungo = passo + 0.1 + rng.next() * 0.16 + (c === corsi - 1 ? 0.05 : 0);
        const centroS = s0 + lungo / 2 - 0.02;
        const spessore = 0.06 + rng.next() * 0.03;
        const centro = colmo
          .clone()
          .addScaledVector(dir, centroS)
          .addScaledVector(nrm, sp + spessore / 2 + 0.005 + (corsi - 1 - c) * 0.012);
        centro.z = z + lz / 2;
        b.aggiungi(geoLastra(lungo, spessore, lz + 0.02, rng.intero(0, 1e6), 0.12), {
          matrice: mat(centro.clone().addScaledVector(nrm, -spessore / 2), [rng.centrato(0.015), 0, rotZ + s * 0.03 + rng.centrato(0.01)]),
          colore: mescola(PALETTE.piode, rng.prob(0.3) ? PALETTE.piodeChiare : PALETTE.piodeScure, rng.next() * 0.6),
          variazione: 0.1,
          tinta: 0.03,
          piatto: true,
        });
        z += lz;
      }
    }
  }
  // colmo: lastre di cresta
  const ncr = Math.max(3, Math.round(dTot / 0.9));
  for (let k = 0; k < ncr; k++) {
    const z = zc - dTot / 2 + ((k + 0.5) * dTot) / ncr;
    b.aggiungi(geoLastra(0.55, 0.07, dTot / ncr + 0.06, rng.intero(0, 1e6), 0.12), {
      matrice: mat([0.08 * (k % 2 === 0 ? 1 : -1), yColmo + sp + 0.04, z], [0, 0, (k % 2 === 0 ? -1 : 1) * p * 0.6]),
      colore: PALETTE.piodeChiare,
      variazione: 0.08,
      piatto: true,
    });
  }
  return yColmo;
}
