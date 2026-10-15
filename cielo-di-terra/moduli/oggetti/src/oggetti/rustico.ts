/**
 * Rustico ticinese in gneiss grigio-argento con tetto in piode.
 *
 * Varianti per dimensione, piani (1-3), balcone di legno (sul timpano o sul fianco), gerani,
 * scala esterna, timpano di legno, camino. Con `smontato: true` lo stesso rustico (stesse
 * opzioni e stesso seme) diventa la versione «smontata dalle Fade»: muri mezzi crollati con il
 * bordo a gradoni, una trave appoggiata, lastre e pietre a terra, cataste squadrate.
 *
 * Orientamento: colmo lungo Z, facciata principale (porta) verso +Z.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola } from '../costruttore';
import { box, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoEstrusione, geoLastra, geoMasso } from '../forme';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { Collider, OggettoProcedurale } from '../tipi';
import {
  balcone,
  camino,
  cantonali,
  COLORI_ANTE,
  facciata,
  finestra,
  inF,
  pietreAVista,
  porta,
  tettoPiode,
} from './dettagli';

export type Dettaglio = 'alto' | 'medio' | 'basso';

export interface OpzioniRustico {
  seme?: Seme;
  /** larghezza in X (m), 4.5-8 */
  larghezza?: number;
  /** profondità in Z (m), 5-10 */
  profondita?: number;
  piani?: 1 | 2 | 3;
  /** pendenza del tetto in gradi */
  pendenza?: number;
  balcone?: 'fronte' | 'lato' | 'nessuno';
  /** probabilità di gerani per finestra (0-1) */
  gerani?: number;
  /** frazione di finestre accese di notte (0-1) */
  finestreAccese?: number;
  camino?: boolean;
  scalaEsterna?: boolean;
  timpanoLegno?: boolean;
  /** versione smontata dalle Fade */
  smontato?: boolean;
  /** quanto è smontato (0-1), solo con smontato */
  crollo?: number;
  dettaglio?: Dettaglio;
  /** profondità della fondazione sotto il suolo (copre i pendii) */
  interrata?: number;
}

interface Finestra {
  lato: 'fronte' | 'retro' | 'destra' | 'sinistra';
  u: number;
  v: number;
  w: number;
  h: number;
  terra: boolean;
  timpano?: boolean;
}

interface Pianta {
  W: number;
  D: number;
  piani: number;
  hTerra: number;
  hPiano: number;
  hMuri: number;
  pendenza: number;
  yColmo: number;
  interrata: number;
  balcone: 'fronte' | 'lato' | 'nessuno';
  scalaEsterna: boolean;
  timpanoLegno: boolean;
  camino: boolean;
  latoCamino: 1 | -1;
  finestre: Finestra[];
  portaU: number;
  porteSuperiori: Array<{ lato: 'destra' | 'sinistra'; u: number; v: number }>;
  colAnte: number | null;
  contornoCalce: boolean;
}

/** Quota del pavimento del piano i (0 = terra). */
function quotaPiano(p: Pick<Pianta, 'hTerra' | 'hPiano'>, i: number): number {
  return i === 0 ? 0 : p.hTerra + (i - 1) * p.hPiano;
}

/** Pianta e disposizione delle aperture: condivisa fra versione intera e smontata. */
function progetta(o: OpzioniRustico, rng: Rng): Pianta {
  const r = rng.derivato('pianta');
  const piani = o.piani ?? (r.prob(0.2) ? 1 : r.prob(0.75) ? 2 : 3);
  const W = o.larghezza ?? r.tra(5, 7.2);
  const D = o.profondita ?? r.tra(5.6, 8.6) + (piani - 1) * 0.3;
  const hTerra = 2.5;
  const hPiano = 2.45;
  const hMuri = hTerra + (piani - 1) * hPiano + 0.35;
  const pendenza = THREE.MathUtils.degToRad(o.pendenza ?? r.tra(27, 34));
  const yColmo = hMuri + (W / 2) * Math.tan(pendenza);
  const balconeTipo = o.balcone ?? (piani >= 2 ? (r.prob(0.45) ? 'fronte' : r.prob(0.35) ? 'lato' : 'nessuno') : 'nessuno');
  const scalaEsterna = o.scalaEsterna ?? (piani >= 2 && balconeTipo !== 'lato' && r.prob(0.4));
  const timpanoLegno = o.timpanoLegno ?? (balconeTipo === 'fronte' && r.prob(0.6));
  const caminoSi = o.camino ?? r.prob(0.75);
  const latoCamino: 1 | -1 = r.prob(0.5) ? 1 : -1;
  const colAnte = r.prob(0.55) ? r.scegli(COLORI_ANTE) : null;
  const contornoCalce = r.prob(0.35);

  const finestre: Finestra[] = [];
  const fw = r.tra(0.55, 0.72);
  const fh = r.tra(0.7, 0.88);
  // porta sulla facciata principale
  const portaU = W >= 5.6 ? r.scegli([-1, 1]) * W * 0.22 : 0;
  for (let i = 0; i < piani; i++) {
    const y = quotaPiano({ hTerra, hPiano }, i);
    const terra = i === 0;
    const vv = y + (terra ? 1.15 : 0.95);
    const ww = terra ? fw * 0.8 : fw;
    const hh = terra ? fh * 0.75 : fh;
    // fronte
    if (terra) {
      if (portaU !== 0) finestre.push({ lato: 'fronte', u: -portaU * 1.1, v: vv, w: ww, h: hh, terra });
    } else if (!(balconeTipo === 'fronte' && i === piani - 1 && false)) {
      if (W >= 5.8) {
        finestre.push({ lato: 'fronte', u: -W * 0.22, v: vv, w: ww, h: hh, terra });
        finestre.push({ lato: 'fronte', u: W * 0.22, v: vv, w: ww, h: hh, terra });
      } else finestre.push({ lato: 'fronte', u: 0, v: vv, w: ww, h: hh, terra });
    }
    // fianchi
    const nf = Math.max(1, Math.floor(D / 3.2));
    for (const lato of ['destra', 'sinistra'] as const) {
      for (let k = 0; k < nf; k++) {
        if (terra && r.prob(0.4)) continue;
        if (scalaEsterna && lato === 'destra' && i === 1 && k === nf - 1) continue;
        const u = -D / 2 + ((k + 0.5) * D) / nf + r.centrato(0.3);
        finestre.push({ lato, u, v: vv, w: ww, h: hh, terra });
      }
    }
    // retro
    if (!terra && r.prob(0.6)) finestre.push({ lato: 'retro', u: r.centrato(W * 0.2), v: vv, w: ww, h: hh, terra });
  }
  // finestrella del sottotetto nel timpano
  if (W * Math.tan(pendenza) * 0.5 > 1.3 && !timpanoLegno) {
    finestre.push({ lato: 'fronte', u: 0, v: hMuri + 0.15, w: 0.42, h: 0.42, terra: false, timpano: true });
  }
  const porteSuperiori: Pianta['porteSuperiori'] = [];
  if (scalaEsterna) {
    porteSuperiori.push({ lato: 'destra', u: D / 2 - 1.0, v: hTerra });
  }
  return {
    W,
    D,
    piani,
    hTerra,
    hPiano,
    hMuri,
    pendenza,
    yColmo,
    interrata: o.interrata ?? 1.0,
    balcone: balconeTipo,
    scalaEsterna,
    timpanoLegno,
    camino: caminoSi,
    latoCamino,
    finestre,
    portaU,
    porteSuperiori,
    colAnte,
    contornoCalce,
  };
}

function telaio(p: Pianta, lato: Finestra['lato']): { f: THREE.Matrix4; larghezza: number } {
  switch (lato) {
    case 'fronte':
      return { f: facciata(0, p.D / 2, 0), larghezza: p.W };
    case 'retro':
      return { f: facciata(0, -p.D / 2, Math.PI), larghezza: p.W };
    case 'destra':
      return { f: facciata(p.W / 2, 0, Math.PI / 2), larghezza: p.D };
    case 'sinistra':
      return { f: facciata(-p.W / 2, 0, -Math.PI / 2), larghezza: p.D };
  }
}

/** Genera un rustico ticinese (intero o smontato). */
export function creaRustico(opz: OpzioniRustico = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 1);
  const rng = new Rng(seme);
  const p = progetta(opz, rng);
  return opz.smontato ? rusticoSmontato(opz, p, seme, rng) : rusticoIntero(opz, p, seme, rng);
}

function rusticoIntero(opz: OpzioniRustico, p: Pianta, seme: number, rng: Rng): OggettoProcedurale {
  const det = opz.dettaglio ?? 'alto';
  const b = new Costruttore(rng.derivato('geometria'));
  const r = b.rng;
  const { W, D, hMuri, interrata } = p;
  const pendenza = p.pendenza;

  // corpo: prisma a cinque lati estruso lungo Z
  const forma = new THREE.Shape();
  forma.moveTo(-W / 2, -interrata);
  forma.lineTo(W / 2, -interrata);
  forma.lineTo(W / 2, hMuri);
  forma.lineTo(0, p.yColmo);
  forma.lineTo(-W / 2, hMuri);
  forma.lineTo(-W / 2, -interrata);
  const tonoMuro = mescola(PALETTE.gneiss, r.prob(0.5) ? PALETTE.gneissViola : PALETTE.gneissCaldo, r.next() * 0.45);
  b.aggiungi(geoEstrusione(forma, D), {
    colore: tonoMuro,
    gradiente: { basso: 0.68, alto: 1.06, y0: -interrata * 0.3, y1: hMuri * 0.85 },
    rumore: 0.05,
    piatto: true,
  });

  // cantonali e pietre a vista
  if (det !== 'basso') {
    cantonali(b, W, D, -0.1, hMuri, det === 'alto' ? 0.5 : 0.8);
    const quante = det === 'alto' ? 1 : 0.5;
    for (const lato of ['fronte', 'retro', 'destra', 'sinistra'] as const) {
      const { f, larghezza } = telaio(p, lato);
      const evitare: Array<[number, number, number, number]> = p.finestre
        .filter((x) => x.lato === lato)
        .map((x) => [x.u - x.w / 2 - 0.35, x.v - 0.3, x.u + x.w / 2 + 0.35, x.v + x.h + 0.3]);
      if (lato === 'fronte') evitare.push([p.portaU - 0.9, -0.2, p.portaU + 0.9, 2.4]);
      pietreAVista(b, f, larghezza, 0.2, hMuri - 0.2, Math.round(((larghezza * hMuri) / 3.5) * quante), evitare);
    }
  }

  // timpano di legno sul fronte
  if (p.timpanoLegno) {
    const yb = quotaPiano(p, p.piani - 1) + 0.1;
    const ft = new THREE.Shape();
    const hw = W / 2 - 0.02;
    ft.moveTo(-hw, yb);
    ft.lineTo(hw, yb);
    ft.lineTo(hw, hMuri);
    ft.lineTo(0, p.yColmo - 0.05);
    ft.lineTo(-hw, hMuri);
    ft.lineTo(-hw, yb);
    const legnoT = r.scegli([PALETTE.legnoVecchio, PALETTE.legno, PALETTE.legnoGrigio]);
    b.aggiungi(geoEstrusione(ft, 0.06), {
      matrice: mat([0, 0, D / 2 + 0.03]),
      colore: legnoT,
      gradiente: { basso: 0.8, alto: 1.0, y0: yb, y1: p.yColmo },
      piatto: true,
    });
    // assi verticali
    const na = Math.floor(W / 0.32);
    for (let i = 1; i < na; i++) {
      const x = -W / 2 + (i * W) / na;
      const top = hMuri + (W / 2 - Math.abs(x)) * Math.tan(pendenza) - 0.08;
      b.aggiungi(geoBoxC(0.03, top - yb, 0.02), {
        matrice: mat([x, (top + yb) / 2, D / 2 + 0.065]),
        colore: mescola(legnoT, 0x000000, 0.4),
        piatto: true,
      });
    }
  }

  // finestre (accese di notte secondo la frazione richiesta)
  const accese = opz.finestreAccese ?? 0.45;
  const rf = r.derivato('finestre');
  for (const fin of p.finestre) {
    const { f } = telaio(p, fin.lato);
    if (p.timpanoLegno && fin.lato === 'fronte' && fin.v > quotaPiano(p, p.piani - 1)) {
      // sul timpano di legno: finestra semplice sporgente dal legno
      finestra(b, inF(f, 0, 0, 0.07), fin.u, fin.v, { larghezza: fin.w, altezza: fin.h, accesa: rf.prob(accese), ante: null });
      continue;
    }
    finestra(b, f, fin.u, fin.v, {
      larghezza: fin.w,
      altezza: fin.h,
      ante: fin.terra || fin.timpano ? null : p.colAnte,
      contornoCalce: p.contornoCalce && !fin.timpano,
      gerani: !fin.terra && !fin.timpano && det !== 'basso' && rf.prob(opz.gerani ?? 0.5),
      accesa: !fin.timpano && rf.prob(accese),
      inferriata: fin.terra,
    });
  }

  // porta
  const fFronte = telaio(p, 'fronte').f;
  porta(b, fFronte, p.portaU, 0, 1.0, 1.95, r.scegli([PALETTE.legno, PALETTE.legnoVecchio, PALETTE.legnoScuro]));
  for (const ps of p.porteSuperiori) {
    const { f } = telaio(p, ps.lato);
    porta(b, f, ps.u, ps.v, 0.9, 1.85, PALETTE.legnoVecchio);
  }

  const collider: Collider[] = [];
  const punti: Record<string, THREE.Vector3> = {
    porta: new THREE.Vector3(p.portaU, 0, D / 2 + 0.6),
    colmo: new THREE.Vector3(0, p.yColmo, 0),
  };

  // balcone
  const yb = quotaPiano(p, p.piani - 1);
  let sporgenzaFronte = 0.35;
  let sporgenzaGronda = 0.45;
  if (p.balcone === 'fronte') {
    const sp = 1.0;
    sporgenzaFronte = sp + 0.35;
    balcone(b, fFronte, 0, yb, W - 0.2, sp, hMuri - yb + 0.2);
    collider.push(box(0, yb + 0.5, D / 2 + sp / 2, W / 2, 0.55, sp / 2, 'calpestabile'));
    punti['balcone'] = new THREE.Vector3(0, yb, D / 2 + sp / 2);
  } else if (p.balcone === 'lato') {
    const sp = 0.95;
    sporgenzaGronda = sp + 0.4;
    const { f } = telaio(p, 'destra');
    const l = D - 0.8;
    balcone(b, f, 0, yb, l, sp, hMuri - yb);
    collider.push(box(W / 2 + sp / 2, yb + 0.5, 0, sp / 2, 0.55, l / 2, 'calpestabile'));
    punti['balcone'] = new THREE.Vector3(W / 2 + sp / 2, yb, 0);
  }

  // scala esterna di pietra sul fianco destro, fino alla porta del primo piano
  if (p.scalaEsterna) {
    const ps = p.porteSuperiori[0];
    if (ps) {
      const n = Math.round(p.hTerra / 0.24);
      const alz = p.hTerra / n;
      const ped = 0.3;
      const zTop = ps.u;
      // pianerottolo
      b.aggiungi(geoLastra(1.1, 0.2, 1.3, r.intero(0, 1e6), 0.06), {
        matrice: mat([W / 2 + 0.55, p.hTerra - 0.2, zTop]),
        colore: PALETTE.gneissChiaro,
        piatto: true,
      });
      b.aggiungi(geoLastra(1.1, p.hTerra - 0.2 + interrata, 1.3, r.intero(0, 1e6), 0.03), {
        matrice: mat([W / 2 + 0.55, -interrata, zTop]),
        colore: tonoMuro,
        gradiente: { basso: 0.7, alto: 1.0, y0: 0, y1: p.hTerra },
        piatto: true,
      });
      for (let i = 0; i < n - 1; i++) {
        const z = zTop - 0.65 - (n - 1 - i) * ped + ped / 2;
        const y = (i + 1) * alz;
        b.aggiungi(geoLastra(1.0, alz + 0.05, ped + 0.06, r.intero(0, 1e6), 0.1), {
          matrice: mat([W / 2 + 0.52, y - alz - 0.03, z]),
          colore: mescola(PALETTE.gneiss, PALETTE.gneissChiaro, r.next()),
          variazione: 0.06,
          piatto: true,
        });
        // muretto di sostegno sotto i gradini
        b.aggiungi(geoBoxC(1.0, y + interrata - alz, ped), {
          matrice: mat([W / 2 + 0.52, (y - alz - interrata) / 2, z]),
          colore: tonoMuro,
          gradiente: { basso: 0.7, alto: 0.95, y0: 0, y1: p.hTerra },
          piatto: true,
        });
      }
      const zInizio = zTop - 0.65 - (n - 1) * ped;
      collider.push(
        box(W / 2 + 0.55, p.hTerra / 2 - 0.1, (zTop + 0.65 + zInizio) / 2, 0.55, p.hTerra / 2, (zTop + 0.65 - zInizio) / 2, 'scala'),
      );
      punti['scala'] = new THREE.Vector3(W / 2 + 0.55, 0, zInizio - 0.4);
    }
  }

  // tetto in piode
  tettoPiode(b, r, {
    larghezza: W,
    profondita: D,
    yGronda: hMuri,
    pendenza,
    sporgenzaGronda,
    sporgenzaTimpano: 0.35,
    sporgenzaFronte,
    corsi: det === 'alto' ? 4 : det === 'medio' ? 3 : 0,
    pezziPerCorso: det === 'alto' ? Math.max(4, Math.round(D / 1.5)) : 3,
  });

  if (p.camino) {
    const xc = p.latoCamino * W * 0.24;
    const zc = -D * 0.25;
    const yTetto = p.yColmo - Math.abs(xc) * Math.tan(pendenza);
    camino(b, xc, yTetto - 0.4, zc, 1.3);
    punti['camino'] = new THREE.Vector3(xc, yTetto + 1.2, zc);
    collider.push(box(xc, yTetto + 0.5, zc, 0.3, 0.9, 0.3, 'muro'));
  }

  const gruppo = b.costruisci('rustico');
  // collider principali
  collider.unshift(box(0, (hMuri - interrata) / 2, 0, W / 2, (hMuri + interrata) / 2, D / 2, 'muro'));
  const hT = p.yColmo - hMuri;
  const dTetto = D + 0.35 + sporgenzaFronte;
  const zT = (sporgenzaFronte - 0.35) / 2;
  collider.push(box(0, hMuri + hT * 0.25 + 0.1, zT, W / 2 + sporgenzaGronda * 0.6, hT * 0.25 + 0.1, dTetto / 2, 'tetto'));
  collider.push(box(0, hMuri + hT * 0.72 + 0.1, zT, W / 4 + 0.2, hT * 0.25 + 0.1, dTetto / 2, 'tetto'));

  return risultato({
    nome: 'rustico',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti,
  });
}

/** Profilo superiore spezzato di un muro rotto (in coordinate del muro: x lungo il muro). */
function muroRotto(
  r: Rng,
  L: number,
  spessore: number,
  interrata: number,
  altezzaPiena: (x: number) => number,
  obiettivo: (x: number) => number,
  aperture: Array<{ u: number; v: number; w: number; h: number }>,
): { geo: THREE.BufferGeometry; cima: (x: number) => number; aperte: Array<{ u: number; v: number; w: number; h: number }> } {
  const passi: Array<{ x0: number; x1: number; h: number }> = [];
  let x = L / 2;
  while (x > -L / 2 + 0.01) {
    const lw = Math.min(x + L / 2, 0.3 + r.next() * 0.45);
    const x1 = x;
    const x0 = x - lw < -L / 2 + 0.15 ? -L / 2 : x - lw;
    const xm = (x0 + x1) / 2;
    let h = obiettivo(xm) + r.centrato(0.22);
    h = Math.round(h / 0.17) * 0.17;
    h = Math.min(h, altezzaPiena(xm));
    h = Math.max(h, 0.25);
    passi.push({ x0, x1, h });
    x = x0;
  }
  const s = new THREE.Shape();
  s.moveTo(-L / 2, -interrata);
  s.lineTo(L / 2, -interrata);
  for (const p of passi) {
    s.lineTo(p.x1, p.h);
    s.lineTo(p.x0, p.h);
  }
  s.lineTo(-L / 2, -interrata);
  const cima = (xx: number): number => {
    for (const p of passi) if (xx >= p.x0 - 1e-6 && xx <= p.x1 + 1e-6) return p.h;
    return 0;
  };
  const minCima = (a: number, bb: number): number => {
    let m = Infinity;
    for (const p of passi) if (p.x1 > a && p.x0 < bb) m = Math.min(m, p.h);
    return m;
  };
  const aperte: Array<{ u: number; v: number; w: number; h: number }> = [];
  for (const a of aperture) {
    if (minCima(a.u - a.w / 2 - 0.25, a.u + a.w / 2 + 0.25) > a.v + a.h + 0.3) {
      const hole = new THREE.Path();
      hole.moveTo(a.u - a.w / 2, a.v);
      hole.lineTo(a.u - a.w / 2, a.v + a.h);
      hole.lineTo(a.u + a.w / 2, a.v + a.h);
      hole.lineTo(a.u + a.w / 2, a.v);
      hole.lineTo(a.u - a.w / 2, a.v);
      s.holes.push(hole);
      aperte.push(a);
    }
  }
  return { geo: geoEstrusione(s, spessore), cima, aperte };
}

function rusticoSmontato(opz: OpzioniRustico, p: Pianta, seme: number, rng: Rng): OggettoProcedurale {
  const b = new Costruttore(rng.derivato('rovina'));
  const r = b.rng;
  const crollo = THREE.MathUtils.clamp(opz.crollo ?? 0.7, 0, 1);
  const { W, D, hMuri, interrata, pendenza } = p;
  const t = 0.5;
  const tonoMuro = mescola(PALETTE.gneiss, r.prob(0.5) ? PALETTE.gneissViola : PALETTE.gneissCaldo, r.next() * 0.45);

  // altezze agli spigoli: il retro resta in piedi, il fronte crolla
  const alto = (k: number): number => hMuri * THREE.MathUtils.lerp(1, k, crollo);
  const hBL = alto(r.tra(0.7, 1.0));
  const hBR = alto(r.tra(0.6, 0.95));
  const hFL = alto(r.tra(0.12, 0.45));
  const hFR = alto(r.tra(0.15, 0.55));
  const gableRetro = THREE.MathUtils.lerp(1, r.tra(0.45, 0.9), crollo);
  const gableFronte = THREE.MathUtils.lerp(1, r.tra(0, 0.15), crollo);
  const breccia = (L: number) => {
    const c = r.centrato(L * 0.3);
    const larg = r.tra(0.8, 1.8);
    const prof = r.tra(0.4, 1.3) * crollo;
    return (x: number) => -prof * Math.max(0, 1 - Math.abs(x - c) / larg);
  };

  const collider: Collider[] = [];
  const aperturePer = (lato: Finestra['lato']) =>
    p.finestre.filter((f) => f.lato === lato && !f.timpano).map((f) => ({ u: f.u, v: f.v, w: f.w, h: f.h }));

  const muri: Array<{
    lato: Finestra['lato'];
    L: number;
    hA: number;
    hB: number;
    timpano: number;
    centro: [number, number];
    rotY: number;
  }> = [
    { lato: 'fronte', L: W, hA: hFL, hB: hFR, timpano: gableFronte, centro: [0, D / 2 - t / 2], rotY: 0 },
    { lato: 'retro', L: W, hA: hBR, hB: hBL, timpano: gableRetro, centro: [0, -D / 2 + t / 2], rotY: Math.PI },
    { lato: 'destra', L: D - 2 * t, hA: hFR, hB: hBR, timpano: 0, centro: [W / 2 - t / 2, 0], rotY: Math.PI / 2 },
    { lato: 'sinistra', L: D - 2 * t, hA: hBL, hB: hFL, timpano: 0, centro: [-W / 2 + t / 2, 0], rotY: -Math.PI / 2 },
  ];

  let cimaRetro = hMuri;
  for (const m of muri) {
    const piena = (x: number): number => (m.lato === 'fronte' || m.lato === 'retro' ? hMuri + (W / 2 - Math.abs(x)) * Math.tan(pendenza) : hMuri);
    const br = breccia(m.L);
    const obiettivo = (x: number): number => {
      const tt = (x + m.L / 2) / m.L;
      let h = THREE.MathUtils.lerp(m.hA, m.hB, tt);
      if (m.timpano > 0) h += (W / 2 - Math.abs(x)) * Math.tan(pendenza) * m.timpano;
      return h + br(x);
    };
    // per i fianchi le aperture sono in coordinate di facciata (u lungo Z): converto nel sistema del muro
    const aperture = aperturePer(m.lato);
    if (m.lato === 'fronte') aperture.push({ u: p.portaU, v: 0.02, w: 1.0, h: 1.95 });
    const { geo, cima, aperte } = muroRotto(r, m.L, t, interrata, piena, obiettivo, aperture);
    const M = mat([m.centro[0], 0, m.centro[1]], [0, m.rotY, 0]);
    // le facciate della pianta guardano verso l'esterno con lo stesso rotY, quindi u coincide
    b.aggiungi(geo, {
      matrice: M,
      colore: tonoMuro,
      gradiente: { basso: 0.62, alto: 1.05, y0: -interrata * 0.3, y1: hMuri },
      rumore: 0.06,
      piatto: true,
    });
    if (m.lato === 'retro') cimaRetro = cima(0);
    // cornici di legno rimaste in qualche apertura
    for (const a of aperte) {
      if (a.v < 0.5 || !r.prob(0.6)) continue;
      const fl = inF(M, 0, 0, 0);
      const leg = PALETTE.legnoVecchio;
      b.aggiungi(geoBoxC(a.w, 0.07, t * 0.6), { matrice: inF(fl, a.u, a.v + 0.035, 0), colore: leg, piatto: true });
      b.aggiungi(geoBoxC(a.w, 0.07, t * 0.6), { matrice: inF(fl, a.u, a.v + a.h - 0.035, 0), colore: leg, piatto: true });
      b.aggiungi(geoBoxC(0.07, a.h, t * 0.6), { matrice: inF(fl, a.u - a.w / 2 + 0.035, a.v + a.h / 2, 0), colore: leg, piatto: true });
      if (r.prob(0.6)) b.aggiungi(geoBoxC(0.06, a.h, 0.06), { matrice: inF(fl, a.u + 0.02, a.v + a.h / 2, 0, [0, 0, r.centrato(0.25)]), colore: leg, piatto: true });
      // architrave di pietra
      b.aggiungi(geoLastra(a.w + 0.4, 0.17, t + 0.04, r.intero(0, 1e6), 0.1), { matrice: inF(fl, a.u, a.v + a.h, 0), colore: PALETTE.gneissChiaro, piatto: true });
    }
    // pietre a vista sulle due facce, solo sotto il bordo rotto
    for (const faccia of [1, -1]) {
      const fm = inF(M, 0, 0, (faccia * t) / 2, [0, faccia > 0 ? 0 : Math.PI, 0]);
      const n = Math.round((m.L * hMuri) / 3.2);
      for (let k = 0, messe = 0; k < n * 4 && messe < n; k++) {
        const pw = 0.3 + r.next() * 0.4;
        const ph = 0.14 + r.next() * 0.14;
        const uu = r.tra(-m.L / 2 + pw / 2 + 0.1, m.L / 2 - pw / 2 - 0.1);
        const vv = r.tra(0.15, hMuri);
        const uMuro = faccia > 0 ? uu : -uu;
        if (vv + ph / 2 > Math.min(cima(uMuro - pw / 2), cima(uMuro + pw / 2), cima(uMuro)) - 0.08) continue;
        if (aperte.some((a) => Math.abs(uMuro - a.u) < a.w / 2 + pw / 2 + 0.05 && vv > a.v - ph && vv < a.v + a.h + ph + 0.2)) continue;
        const scuro = r.prob(0.5);
        b.aggiungi(new THREE.PlaneGeometry(pw, ph), {
          matrice: inF(fm, uu, vv, 0.012, [0, 0, r.centrato(0.08)]),
          colore: scuro ? mescola(PALETTE.gneissScuro, PALETTE.gneissViola, r.next()) : mescola(PALETTE.gneissChiaro, PALETTE.gneissCaldo, r.next()),
          variazione: 0.05,
          piatto: true,
        });
        messe++;
      }
    }
    // pietre sparse sulla cima del muro
    for (let k = 0; k < Math.round(m.L / 1.6); k++) {
      const x = r.tra(-m.L / 2 + 0.3, m.L / 2 - 0.3);
      const h = cima(x);
      if (h < 0.4) continue;
      b.aggiungi(geoMasso(r.tra(0.16, 0.26), r.intero(0, 1e6), 0.3, 0, 0.6), {
        matrice: inF(M, x, h + 0.05, r.centrato(0.12)),
        colore: mescola(tonoMuro, PALETTE.gneissChiaro, r.next() * 0.5),
        variazione: 0.08,
        piatto: true,
      });
    }
    // collider a tratti di ~1.5 m con l'altezza massima del tratto
    const nTratti = Math.max(1, Math.round(m.L / 1.5));
    for (let k = 0; k < nTratti; k++) {
      const x0 = -m.L / 2 + (k * m.L) / nTratti;
      const x1 = -m.L / 2 + ((k + 1) * m.L) / nTratti;
      let hmax = 0;
      for (let s = 0; s <= 6; s++) hmax = Math.max(hmax, cima(x0 + ((x1 - x0) * s) / 6));
      const cLoc = new THREE.Vector3((x0 + x1) / 2, 0, 0).applyMatrix4(M);
      collider.push(box(cLoc.x, (hmax - interrata) / 2, cLoc.z, (x1 - x0) / 2, (hmax + interrata) / 2, t / 2, 'muro', m.rotY));
    }
  }

  // pavimento di terra battuta all'interno
  b.aggiungi(geoBoxC(W - 2 * t, 0.1, D - 2 * t), { matrice: mat([0, -0.03, 0]), colore: PALETTE.terra, variazione: 0.05, piatto: true });

  // trave di colmo appoggiata dal timpano posteriore al suolo, e qualche puntone
  if (crollo < 0.95) {
    const a = new THREE.Vector3(r.centrato(0.3), Math.min(cimaRetro, p.yColmo) - 0.15, -D / 2 + 0.2);
    const bb = new THREE.Vector3(r.centrato(1.2), 0.1, D / 2 + r.tra(0.2, 1.4));
    const d = bb.clone().sub(a);
    const lung = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize());
    const M = new THREE.Matrix4().compose(a.clone().add(bb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    b.aggiungi(geoBoxC(0.2, 0.22, lung), { matrice: M, colore: PALETTE.legnoVecchio, variazione: 0.06, piatto: true });
    for (let k = 0; k < 2; k++) {
      const s = k === 0 ? 1 : -1;
      const pa = new THREE.Vector3(s * (W / 2 - 0.2), Math.min(hBL, hBR) - 0.1, -D / 2 + 0.6 + k * 0.8);
      const pb = new THREE.Vector3(s * r.tra(0.5, 1.5), 0.08, r.tra(-0.5, 1.5));
      const dd = pb.clone().sub(pa);
      const qq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dd.clone().normalize());
      b.aggiungi(geoBoxC(0.13, 0.13, dd.length()), {
        matrice: new THREE.Matrix4().compose(pa.clone().add(pb).multiplyScalar(0.5), qq, new THREE.Vector3(1, 1, 1)),
        colore: PALETTE.legnoScuro,
        piatto: true,
      });
    }
  }
  // un lembo di tetto ancora sul retro (se il crollo è parziale)
  if (crollo < 0.6) {
    const yG = Math.min(hBL, hBR);
    const bt = new Costruttore(r.derivato('lembo'));
    tettoPiode(bt, bt.rng, { larghezza: W, profondita: D * 0.35, yGronda: yG, pendenza, corsi: 3, pezziPerCorso: 2, sporgenzaTimpano: 0.3, sporgenzaFronte: 0 });
    const g = bt.geometria('opaco');
    if (g) b.aggiungi(g, { matrice: mat([0, 0, -D / 2 + D * 0.175]), colore: 'geometria' });
  }

  // macerie: pietre a terra, più fitte davanti dove il muro è crollato
  const nPietre = Math.round(26 + crollo * 40);
  for (let k = 0; k < nPietre; k++) {
    const davanti = r.prob(0.6);
    const ang = r.next() * Math.PI * 2;
    let x: number;
    let z: number;
    if (davanti) {
      x = r.centrato(W / 2 + 1.2);
      z = D / 2 + r.tra(-1.5, 2.2);
    } else {
      const rr = r.tra(0.2, 1.3);
      x = Math.cos(ang) * (W / 2 + rr);
      z = Math.sin(ang) * (D / 2 + rr);
    }
    const s = r.tra(0.14, 0.34);
    b.aggiungi(geoMasso(s, r.intero(0, 1e6), 0.35, 0, r.tra(0.45, 0.8)), {
      matrice: mat([x, s * 0.25, z], [r.centrato(0.3), r.next() * 6, r.centrato(0.3)]),
      colore: mescola(tonoMuro, r.prob(0.3) ? PALETTE.gneissScuro : PALETTE.gneissChiaro, r.next() * 0.6),
      variazione: 0.1,
      piatto: true,
    });
  }
  // lastre di piode cadute
  for (let k = 0; k < 8 + Math.round(crollo * 8); k++) {
    const x = r.centrato(W / 2 + 1.5);
    const z = r.tra(-D / 2 - 1, D / 2 + 2);
    b.aggiungi(geoLastra(r.tra(0.5, 0.9), 0.06, r.tra(0.4, 0.7), r.intero(0, 1e6), 0.15), {
      matrice: mat([x, 0.02, z], [r.centrato(0.25), r.next() * 6, r.centrato(0.25)]),
      colore: PALETTE.piode,
      variazione: 0.1,
      piatto: true,
    });
  }
  // cataste squadrate lasciate dalle Fade
  const nCataste = 1 + Math.round(crollo * 2);
  for (let k = 0; k < nCataste; k++) {
    const cx = (k % 2 === 0 ? 1 : -1) * (W / 2 + r.tra(1.4, 2.4));
    const cz = r.tra(-D / 3, D / 2);
    const rot = r.next() * Math.PI;
    for (let liv = 0; liv < 3; liv++) {
      const n = 3 - liv;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.48;
        const pos = new THREE.Vector3(off, liv * 0.27, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
        b.aggiungi(geoLastra(0.44, 0.26, 0.32, r.intero(0, 1e6), 0.1), {
          matrice: mat([cx + pos.x, pos.y, cz + pos.z], [0, rot + r.centrato(0.08), 0]),
          colore: mescola(tonoMuro, PALETTE.gneissChiaro, r.next() * 0.5),
          variazione: 0.08,
          piatto: true,
        });
      }
    }
    collider.push(box(cx, 0.4, cz, 0.75, 0.4, 0.3, 'macerie', rot));
  }

  const gruppo = b.costruisci('rustico-smontato');
  return risultato({
    nome: 'rustico-smontato',
    seme,
    gruppo,
    collider,
    ingombro: ingombroDa(gruppo),
    punti: {
      porta: new THREE.Vector3(p.portaU, 0, D / 2 + 0.6),
      timpano: new THREE.Vector3(0, cimaRetro, -D / 2),
    },
  });
}
