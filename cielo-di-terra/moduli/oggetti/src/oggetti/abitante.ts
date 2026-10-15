/**
 * Abitanti velati di Corbella: figura umana stilizzata SENZA volto, con
 * - velo di garza di canapa tinto di noce (campana che copre testa e spalle),
 * - maschera di legno di castagno intagliata (o liscia, come quella della Madre) sotto un cappuccio,
 * - cappello e velo a rete da apicoltore (bugnera),
 * - cappuccio di lana con il viso in ombra,
 * - cappello a tesa larga con il viso in ombra.
 * Varianti di corporatura, colori e postura; gerla e bastone facoltativi.
 *
 * Una sola SkinnedMesh con scheletro procedurale (13 ossa): 1 draw call (2 col velo a rete).
 * Animazione procedurale con update(dt, stato): respiro, peso che si sposta, testa che si gira verso
 * un punto, gesti della mano, camminata semplice sul posto (lo spostamento lo fa il motore).
 * Guarda +Z.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola, type FnColore } from '../costruttore';
import { cil, ingombroDa, risultato, smorza } from '../comune';
import { geoBoxC, geoCilindro, geoSfera, geoTubo } from '../forme';
import { materialePer } from '../materiali';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';

export type Copricapo = 'velo' | 'maschera' | 'maschera-liscia' | 'apicoltore' | 'cappuccio' | 'cappello';
export type Corporatura = 'esile' | 'media' | 'robusta' | 'anziana' | 'bambino';
export type Postura = 'eretta' | 'curva' | 'mani-giunte' | 'braccia-conserte' | 'mani-dietro';
export type Gesto = 'nessuno' | 'saluta' | 'indica' | 'mano-al-petto';

export interface OpzioniAbitante {
  seme?: Seme;
  copricapo?: Copricapo;
  corporatura?: Corporatura;
  postura?: Postura;
  /** colore della veste (sRGB); se assente lo sceglie il seme fra le terre */
  colore?: number;
  /** colore del velo / cappuccio */
  coloreVelo?: number;
  gerla?: boolean;
  bastone?: boolean;
  /** mani guantate (altrimenti nude, color pelle) */
  guanti?: boolean;
}

export interface StatoAbitante {
  /** 'fermo' (respiro e peso) o 'cammina' (passo sul posto) */
  modo?: 'fermo' | 'cammina';
  /** velocità di camminata in m/s (cadenza del passo) */
  velocita?: number;
  /** punto da guardare, in coordinate MONDO (null = guarda avanti) */
  guarda?: THREE.Vector3 | null;
  gesto?: Gesto;
  /** per 'indica': punto indicato in coordinate mondo */
  indica?: THREE.Vector3 | null;
}

// indici delle ossa
const O = {
  radice: 0,
  bacino: 1,
  schiena: 2,
  petto: 3,
  testa: 4,
  braccioS: 5,
  avambraccioS: 6,
  braccioD: 7,
  avambraccioD: 8,
  cosciaS: 9,
  stincoS: 10,
  cosciaD: 11,
  stincoD: 12,
} as const;

const GENITORI: number[] = [-1, 0, 1, 2, 3, 3, 5, 3, 7, 1, 9, 1, 11];

const VESTI = [0x6a5a48, 0x7d6a4f, 0x5b6146, 0x6e5440, 0x58525a, 0x8a6d4a, 0x4f4a3f, 0x77624c, 0x5f5240] as const;
const VELI = [PALETTE.noce, PALETTE.noceScuro, 0x7d5a3c, 0x8c6c4c, 0x5c4330] as const;
const ACCENTI = [PALETTE.vermiglio, 0xb08a3e, 0x4f6b55, 0x8a3b2e, 0xcdbb97, 0x3f5560] as const;
const PELLI = [0xc9a183, 0xb88d6c, 0xd8b496, 0xa77b5a] as const;

interface Proporzioni {
  h: number; // fattore altezza
  l: number; // fattore larghezza
  testa: number; // fattore testa
  pancia: number;
}

function proporzioni(c: Corporatura, rng: Rng): Proporzioni {
  const j = () => 1 + rng.centrato(0.04);
  switch (c) {
    case 'esile':
      return { h: 1.02 * j(), l: 0.86, testa: 1, pancia: 0.9 };
    case 'robusta':
      return { h: 1.0 * j(), l: 1.2, testa: 1.05, pancia: 1.25 };
    case 'anziana':
      return { h: 0.93 * j(), l: 0.98, testa: 1, pancia: 1.05 };
    case 'bambino':
      return { h: 0.64 * j(), l: 0.75, testa: 1.35, pancia: 0.95 };
    default:
      return { h: 1.0 * j(), l: 1.0, testa: 1, pancia: 1.0 };
  }
}

/** Crea un abitante velato animabile. */
export function creaAbitante(opz: OpzioniAbitante = {}): OggettoProcedurale<StatoAbitante> {
  const seme = semeNumerico(opz.seme ?? 'abitante');
  const rng = new Rng(seme);
  const corp = opz.corporatura ?? rng.scegli(['esile', 'media', 'media', 'robusta', 'anziana'] as const);
  const P = proporzioni(corp, rng);
  const copr = opz.copricapo ?? rng.scegli(['velo', 'velo', 'maschera', 'cappuccio', 'cappello', 'apicoltore'] as const);
  const postura = opz.postura ?? (corp === 'anziana' ? 'curva' : rng.scegli(['eretta', 'eretta', 'mani-giunte', 'braccia-conserte', 'mani-dietro'] as const));
  const cVeste = opz.colore ?? rng.scegli(VESTI);
  const cVelo = opz.coloreVelo ?? rng.scegli(VELI);
  const cAccento = rng.scegli(ACCENTI);
  const cPelle = rng.scegli(PELLI);
  const guanti = opz.guanti ?? rng.prob(0.5);
  const cMani = guanti ? PALETTE.guanto : cPelle;
  const H = P.h;
  const Lx = P.l;

  // giunture in posa di legame (coordinate del gruppo)
  const J: THREE.Vector3[] = [
    new THREE.Vector3(0, 0, 0), // radice
    new THREE.Vector3(0, 0.92 * H, 0), // bacino
    new THREE.Vector3(0, 1.02 * H, 0), // schiena
    new THREE.Vector3(0, 1.24 * H, 0), // petto
    new THREE.Vector3(0, 1.46 * H, 0.01), // testa (base del collo)
    new THREE.Vector3(0.19 * Lx, 1.4 * H, 0), // braccio S
    new THREE.Vector3(0.24 * Lx, 1.12 * H, -0.01), // gomito S
    new THREE.Vector3(-0.19 * Lx, 1.4 * H, 0), // braccio D
    new THREE.Vector3(-0.24 * Lx, 1.12 * H, -0.01), // gomito D
    new THREE.Vector3(0.1 * Lx, 0.9 * H, 0), // anca S
    new THREE.Vector3(0.1 * Lx, 0.49 * H, 0.01), // ginocchio S
    new THREE.Vector3(-0.1 * Lx, 0.9 * H, 0), // anca D
    new THREE.Vector3(-0.1 * Lx, 0.49 * H, 0.01), // ginocchio D
  ];
  const polso = (s: number) => new THREE.Vector3(s * 0.26 * Lx, 0.86 * H, 0.02);
  const caviglia = (s: number) => new THREE.Vector3(s * 0.1 * Lx, 0.08 * H, 0);

  const b = new Costruttore(rng.derivato('corpo'));
  const r = b.rng;
  const yOrlo = (corp === 'bambino' ? 0.3 : 0.2) * H;

  // --- gambe (si vedono sotto l'orlo) e scarpe
  for (const s of [1, -1]) {
    const coscia = s > 0 ? O.cosciaS : O.cosciaD;
    const stinco = s > 0 ? O.stincoS : O.stincoD;
    const anca = J[coscia] as THREE.Vector3;
    const gin = J[stinco] as THREE.Vector3;
    const cav = caviglia(s);
    b.aggiungi(geoTubo([anca, gin], [0.075 * Lx * P.pancia, 0.06 * Lx], 6), { colore: mescola(cVeste, 0x000000, 0.35), osso: coscia });
    b.aggiungi(geoTubo([gin, cav], [0.058 * Lx, 0.045 * Lx], 6), { colore: 0x4a4038, osso: stinco });
    b.aggiungi(geoBoxC(0.11 * Lx, 0.08 * H, 0.24 * H), { matrice: mat([cav.x, 0.04 * H, cav.z + 0.04 * H]), colore: 0x2f2620, osso: stinco, piatto: true });
  }

  // --- veste lunga (tornio con pieghe), pesata fra bacino, schiena, petto e gambe
  const profVeste: Array<[number, number]> = [
    [0.13, 1.47],
    [0.2, 1.4],
    [0.215, 1.28],
    [0.2 * P.pancia, 1.1],
    [0.205 * P.pancia, 0.95],
    [0.24, 0.7],
    [0.29, 0.42],
    [0.33, yOrlo / H + 0.02],
    [0.3, yOrlo / H - 0.01],
  ];
  const segV = 14;
  const posV: number[] = [];
  const idxV: number[] = [];
  for (let i = 0; i < profVeste.length; i++) {
    const [rr, yy] = profVeste[i] as [number, number];
    for (let k = 0; k < segV; k++) {
      const a = (k / segV) * Math.PI * 2;
      const piega = i >= 5 ? 1 + Math.sin(a * 7 + i) * 0.045 : 1;
      posV.push(Math.sin(a) * rr * Lx * piega, yy * H, Math.cos(a) * rr * Lx * 0.78 * piega);
    }
  }
  for (let i = 0; i < profVeste.length - 1; i++) {
    for (let k = 0; k < segV; k++) {
      const a = i * segV + k;
      const bb = i * segV + ((k + 1) % segV);
      const c = (i + 1) * segV + k;
      const d = (i + 1) * segV + ((k + 1) % segV);
      idxV.push(a, c, bb, bb, c, d);
    }
  }
  // chiusura in alto
  {
    const centro = posV.length / 3;
    posV.push(0, 1.5 * H, 0);
    for (let k = 0; k < segV; k++) idxV.push(centro, k, (k + 1) % segV);
  }
  const gVeste = new THREE.BufferGeometry();
  gVeste.setAttribute('position', new THREE.Float32BufferAttribute(posV, 3));
  gVeste.setIndex(idxV);
  gVeste.computeVertexNormals();
  const yAnca = 0.9 * H;
  const pesiVeste = (p: THREE.Vector3): [number, number, number, number] => {
    if (p.y > 1.3 * H) return [O.petto, 1, O.schiena, 0];
    if (p.y > 1.1 * H) {
      const t = (p.y - 1.1 * H) / (0.2 * H);
      return [O.petto, t, O.schiena, 1 - t];
    }
    if (p.y > yAnca) {
      const t = (p.y - yAnca) / (1.1 * H - yAnca);
      return [O.schiena, t, O.bacino, 1 - t];
    }
    // sotto l'anca l'orlo segue in parte la gamba dal suo lato
    const t = THREE.MathUtils.clamp((yAnca - p.y) / (yAnca - yOrlo), 0, 1);
    const lato = THREE.MathUtils.clamp(Math.abs(p.x) / (0.12 * Lx), 0, 1);
    const w = t * 0.55 * lato;
    return [p.x >= 0 ? O.cosciaS : O.cosciaD, w, O.bacino, 1 - w];
  };
  const cV1 = new THREE.Color(cVeste);
  const cV2 = mescola(cVeste, 0x000000, 0.22);
  const coloreVeste: FnColore = (p, n, out) => {
    const a = Math.atan2(p.x, p.z);
    const piega = p.y < 0.95 * H ? Math.sin(a * 7) * 0.5 + 0.5 : 0.5;
    out.copy(cV2).lerp(cV1, 0.45 + piega * 0.4 + n.y * 0.1);
  };
  b.aggiungi(gVeste, { colore: coloreVeste, pesi: pesiVeste, gradiente: { basso: 0.8, alto: 1.05, y0: yOrlo, y1: 1.4 * H } });
  // cintura
  b.aggiungi(new THREE.TorusGeometry(0.205 * Lx * P.pancia, 0.028, 4, 14).rotateX(Math.PI / 2).scale(1, 1, 0.78), {
    matrice: mat([0, 0.97 * H, 0]),
    colore: cAccento,
    osso: O.bacino,
  });
  // stola sulle spalle (a volte)
  if (r.prob(0.45) && copr !== 'velo') {
    const st = new THREE.TorusGeometry(0.2 * Lx, 0.05, 4, 14).rotateX(Math.PI / 2).scale(1, 1, 0.8);
    b.aggiungi(st, { matrice: mat([0, 1.4 * H, 0.0], [0.15, 0, 0]), colore: mescola(cAccento, cVeste, 0.3), osso: O.petto });
  }

  // --- braccia: manica larga e mano (guanto o pelle)
  for (const s of [1, -1]) {
    const ib = s > 0 ? O.braccioS : O.braccioD;
    const ia = s > 0 ? O.avambraccioS : O.avambraccioD;
    const spalla = J[ib] as THREE.Vector3;
    const gomito = J[ia] as THREE.Vector3;
    const pol = polso(s);
    b.aggiungi(geoTubo([spalla.clone().add(new THREE.Vector3(0, 0.03, 0)), gomito], [0.07 * Lx, 0.065 * Lx], 6, { chiudiInizio: true }), { colore: cVeste, osso: ib });
    b.aggiungi(geoTubo([gomito.clone().add(new THREE.Vector3(0, 0.03, 0)), pol], [0.066 * Lx, 0.085 * Lx], 6), { colore: mescola(cVeste, 0xffffff, 0.05), osso: ia });
    const mano = geoSfera(0.05 * Lx, 6, 5);
    mano.scale(0.8, 1.35, 1.0);
    b.aggiungi(mano, { matrice: mat(pol.clone().add(new THREE.Vector3(0, -0.06 * H, 0.01))), colore: cMani, osso: ia });
    if (opz.bastone && s < 0) {
      const top = pol.clone().add(new THREE.Vector3(0, -0.04, 0.05));
      b.aggiungi(geoCilindro(0.018, 0.022, 1, 5), {
        matrice: new THREE.Matrix4().compose(
          top.clone().add(new THREE.Vector3(0, -0.86 * H, 0.1)),
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0.86 * H, -0.1).normalize()),
          new THREE.Vector3(1, Math.hypot(0.86 * H, 0.1) + 0.08, 1),
        ),
        colore: PALETTE.legnoScuro,
        osso: ia,
      });
    }
  }

  // --- testa e copricapo (nessun volto)
  const cT = new THREE.Vector3(0, 1.58 * H * (corp === 'bambino' ? 0.985 : 1), 0.02);
  const rT = 0.105 * P.testa * (corp === 'bambino' ? 0.9 : 1);
  const pesiTesta = (p: THREE.Vector3): [number, number, number, number] => {
    if (p.y > 1.49 * H) return [O.testa, 1, O.petto, 0];
    const t = THREE.MathUtils.clamp((p.y - 1.36 * H) / (0.13 * H), 0, 1);
    return [O.testa, t, O.petto, 1 - t];
  };
  const tornio = (prof: Array<[number, number]>, seg: number, scalaZ = 0.9, pieghe = 0): THREE.BufferGeometry => {
    const g = new THREE.LatheGeometry(
      prof.map(([x, y]) => new THREE.Vector2(x, y)),
      seg,
    );
    g.deleteAttribute('uv');
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const a = Math.atan2(x, z);
      const f = pieghe ? 1 + Math.sin(a * pieghe) * 0.04 * THREE.MathUtils.clamp((cT.y - pos.getY(i)) / 0.2, 0, 1) : 1;
      pos.setXYZ(i, x * f, pos.getY(i), z * scalaZ * f);
    }
    g.computeVertexNormals();
    return g;
  };
  const yC = cT.y;
  switch (copr) {
    case 'velo': {
      // campana di garza tinta di noce: copre testa e spalle, scende sul petto
      const prof: Array<[number, number]> = [
        [0.001, yC + rT * 1.12],
        [rT * 0.6, yC + rT * 1.02],
        [rT * 1.05, yC + rT * 0.55],
        [rT * 1.18, yC - rT * 0.1],
        [rT * 1.3, yC - rT * 0.75],
        [0.2 * Lx, 1.41 * H],
        [0.27 * Lx, 1.32 * H],
        [0.29 * Lx, 1.2 * H],
        [0.27 * Lx, 1.14 * H],
      ];
      const g = tornio(prof, 14, 0.86, 9);
      const c1 = new THREE.Color(cVelo);
      const c2 = mescola(cVelo, PALETTE.canapa, 0.35);
      b.aggiungi(g, {
        colore: (p, n, out) => {
          const a = Math.atan2(p.x, p.z);
          // trama della garza: bande verticali più chiare e orlo chiaro
          const banda = Math.sin(a * 9) * 0.5 + 0.5;
          out.copy(c1).lerp(c2, banda * 0.35 + (p.y < 1.17 * H ? 0.45 : 0) + n.y * 0.08);
        },
        pesi: pesiTesta,
      });
      break;
    }
    case 'maschera':
    case 'maschera-liscia': {
      // cappuccio di lana dietro e attorno
      const prof: Array<[number, number]> = [
        [0.001, yC + rT * 1.2],
        [rT * 0.75, yC + rT * 1.08],
        [rT * 1.18, yC + rT * 0.4],
        [rT * 1.22, yC - rT * 0.5],
        [0.19 * Lx, 1.4 * H],
        [0.24 * Lx, 1.3 * H],
      ];
      b.aggiungi(tornio(prof, 12, 0.92), { colore: copr === 'maschera-liscia' ? 0x242022 : mescola(cVelo, PALETTE.lana, 0.4), pesi: pesiTesta });
      // maschera ovale di castagno, intagliata a forme semplici
      const masch = geoSfera(rT * 0.95, 10, 8);
      masch.scale(0.92, 1.18, 0.5);
      const cLegno = copr === 'maschera-liscia' ? new THREE.Color(0x8a6a4c) : new THREE.Color(0xa47a52);
      b.aggiungi(masch, {
        matrice: mat([0, yC + 0.005, cT.z + rT * 0.78]),
        colore: (_p, n, out) => out.copy(cLegno).multiplyScalar(0.85 + n.z * 0.2),
        osso: O.testa,
      });
      if (copr === 'maschera') {
        // intagli: due fessure orizzontali e un motivo a foglia (linee scure)
        const scuro = 0x2b1d14;
        for (const s of [-1, 1]) {
          b.aggiungi(geoBoxC(rT * 0.42, rT * 0.07, 0.02), { matrice: mat([s * rT * 0.34, yC + rT * 0.18, cT.z + rT * 1.23], [0, s * 0.35, s * 0.12]), colore: scuro, osso: O.testa, piatto: true });
        }
        b.aggiungi(geoBoxC(rT * 0.06, rT * 0.62, 0.02), { matrice: mat([0, yC - rT * 0.35, cT.z + rT * 1.22]), colore: scuro, osso: O.testa, piatto: true });
        for (const s of [-1, 1]) {
          b.aggiungi(geoBoxC(rT * 0.28, rT * 0.05, 0.02), { matrice: mat([s * rT * 0.13, yC - rT * 0.42, cT.z + rT * 1.2], [0, 0, s * 0.6]), colore: scuro, osso: O.testa, piatto: true });
        }
      }
      break;
    }
    case 'apicoltore': {
      // cappello a tesa larga e velo a rete color rame (canale sottile, aperto)
      const tesa = geoCilindro(rT * 2.6, rT * 2.6, 0.02, 14);
      b.aggiungi(tesa, { matrice: mat([0, yC + rT * 0.7, 0]), colore: PALETTE.canapa, osso: O.testa });
      b.aggiungi(geoCilindro(rT * 1.0, rT * 1.15, rT * 0.8, 12), { matrice: mat([0, yC + rT * 0.7, 0]), colore: PALETTE.canapa, osso: O.testa });
      b.aggiungi(geoCilindro(rT * 1.16, rT * 1.16, rT * 0.18, 12, true), { matrice: mat([0, yC + rT * 0.72, 0]), colore: PALETTE.vermiglio, osso: O.testa });
      // testa scura dentro la rete
      b.aggiungi(geoSfera(rT, 8, 6), { matrice: mat(cT), colore: 0x2b2420, osso: O.testa });
      const rete = geoCilindro(rT * 2.2, rT * 2.4, rT * 2.6 + 0.06 * H, 14, true);
      const cR1 = mescola(PALETTE.rame, PALETTE.canapaScura, 0.45);
      const cR2 = mescola(PALETTE.rameScuro, 0x2b2420, 0.45);
      b.aggiungi(rete, {
        matrice: mat([0, yC + rT * 0.7 - (rT * 2.6 + 0.06 * H), 0], [0, 0, 0], [1, 1, 0.85]),
        colore: (p, _n, out) => out.copy(cR2).lerp(cR1, Math.sin(Math.atan2(p.x, p.z) * 16) * 0.5 + 0.5),
        canale: 'sottile',
        pesi: (p) => (p.y > 1.45 * H ? [O.testa, 1, O.petto, 0] : [O.testa, 0.4, O.petto, 0.6]),
      });
      break;
    }
    case 'cappuccio': {
      // cappuccio di lana a punta con il viso in ombra
      const prof: Array<[number, number]> = [
        [0.001, yC + rT * 1.75],
        [rT * 0.45, yC + rT * 1.3],
        [rT * 1.12, yC + rT * 0.6],
        [rT * 1.28, yC - rT * 0.3],
        [rT * 1.4, yC - rT * 0.9],
        [0.23 * Lx, 1.37 * H],
        [0.27 * Lx, 1.28 * H],
      ];
      const cL = new THREE.Color(mescola(PALETTE.lana, cVelo, 0.3));
      b.aggiungi(tornio(prof, 12, 0.92, 6), { colore: cL, pesi: pesiTesta });
      // apertura del viso: ovale buio
      const vuoto = geoSfera(rT * 0.82, 8, 6);
      vuoto.scale(0.85, 1.05, 0.45);
      b.aggiungi(vuoto, { matrice: mat([0, yC - rT * 0.05, cT.z + rT * 0.95]), colore: 0x15110f, osso: O.testa });
      break;
    }
    case 'cappello': {
      // cappello di feltro a tesa larga; sotto, il viso resta in ombra
      b.aggiungi(geoSfera(rT, 8, 6), { matrice: mat(cT), colore: 0x241d19, osso: O.testa });
      b.aggiungi(geoCilindro(rT * 2.4, rT * 2.5, 0.025, 14), { matrice: mat([0, yC + rT * 0.55, 0]), colore: mescola(cVelo, 0x000000, 0.25), osso: O.testa });
      b.aggiungi(geoCilindro(rT * 0.95, rT * 1.1, rT * 0.95, 12), { matrice: mat([0, yC + rT * 0.55, 0]), colore: mescola(cVelo, 0x000000, 0.25), osso: O.testa });
      b.aggiungi(geoCilindro(rT * 1.11, rT * 1.11, rT * 0.2, 12, true), { matrice: mat([0, yC + rT * 0.6, 0]), colore: cAccento, osso: O.testa });
      // scialle sulle spalle
      const prof: Array<[number, number]> = [
        [rT * 0.9, 1.47 * H],
        [0.21 * Lx, 1.4 * H],
        [0.27 * Lx, 1.3 * H],
        [0.28 * Lx, 1.22 * H],
      ];
      b.aggiungi(tornio(prof, 12, 0.85, 7), { colore: mescola(cVelo, PALETTE.canapa, 0.2), osso: O.petto });
      break;
    }
  }

  // --- gerla sulla schiena
  if (opz.gerla) {
    // gerla: cesto conico di vimini (righe di intreccio chiare e scure)
    const prof: Array<[number, number]> = [[0.12, 0]];
    for (let i = 1; i <= 10; i++) prof.push([0.12 + (0.15 * i) / 10, (0.62 * i) / 10]);
    prof.push([0.29, 0.66], [0.26, 0.66]);
    const g = new THREE.LatheGeometry(
      prof.map(([x, y]) => new THREE.Vector2(x, y)),
      10,
    );
    g.deleteAttribute('uv');
    const cG1 = new THREE.Color(0x9a7a4e);
    const cG2 = new THREE.Color(0x6e5534);
    b.aggiungi(g, {
      matrice: mat([0, 0.98 * H, -0.3 * Lx], [-0.12, 0, 0], [1, 1, 0.8]),
      colore: (p, _n, out) => out.copy(cG2).lerp(cG1, Math.sin(p.y * 48) * 0.5 + 0.5),
      osso: O.petto,
    });
    for (const s of [-1, 1]) {
      b.aggiungi(geoTubo([new THREE.Vector3(s * 0.11, 1.42 * H, 0.06), new THREE.Vector3(s * 0.12, 1.3 * H, 0.17 * Lx), new THREE.Vector3(s * 0.14, 1.08 * H, 0.14 * Lx)], [0.015], 3), {
        colore: PALETTE.legnoScuro,
        osso: O.petto,
      });
    }
  }

  // --- scheletro
  const ossa: THREE.Bone[] = J.map((_, i) => {
    const o = new THREE.Bone();
    o.name = Object.keys(O)[i] as string;
    return o;
  });
  for (let i = 0; i < ossa.length; i++) {
    const g = GENITORI[i] as number;
    const pos = (J[i] as THREE.Vector3).clone();
    if (g >= 0) {
      pos.sub(J[g] as THREE.Vector3);
      (ossa[g] as THREE.Bone).add(ossa[i] as THREE.Bone);
    }
    (ossa[i] as THREE.Bone).position.copy(pos);
  }
  const gruppo = new THREE.Group();
  gruppo.name = 'abitante';
  const radice = ossa[0] as THREE.Bone;
  gruppo.add(radice);
  // le matrici mondo delle ossa devono essere aggiornate PRIMA di calcolare le inverse di legame
  gruppo.updateMatrixWorld(true);
  const scheletro = new THREE.Skeleton(ossa);
  const mesh: THREE.SkinnedMesh[] = [];
  for (const canale of ['opaco', 'sottile'] as const) {
    const g = b.geometria(canale);
    if (!g) continue;
    const m = new THREE.SkinnedMesh(g, materialePer(canale));
    m.name = `abitante:${canale}`;
    m.userData['canale'] = canale;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    gruppo.add(m);
    m.bind(scheletro);
    mesh.push(m);
  }

  // --- animazione procedurale
  const os = (k: keyof typeof O) => ossa[O[k]] as THREE.Bone;
  const base = ossa.map((o) => o.position.clone());
  for (const o of ossa) o.rotation.order = 'YXZ';
  // posa di riposo per postura (offset di rotazione aggiunti all'animazione)
  const riposo: Record<number, [number, number, number]> = {};
  const set = (k: keyof typeof O, x: number, y: number, z: number) => (riposo[O[k]] = [x, y, z]);
  set('braccioS', 0, 0, 0.1);
  set('braccioD', 0, 0, -0.1);
  set('avambraccioS', -0.15, 0, 0);
  set('avambraccioD', -0.15, 0, 0);
  switch (postura) {
    case 'curva':
      set('schiena', 0.22, 0, 0);
      set('petto', 0.18, 0, 0);
      set('testa', -0.25, 0, 0);
      set('avambraccioD', -0.7, 0, 0);
      break;
    case 'mani-giunte':
      set('braccioS', -0.25, 0, 0.15);
      set('braccioD', -0.25, 0, -0.15);
      set('avambraccioS', -1.15, -0.55, 0);
      set('avambraccioD', -1.15, 0.55, 0);
      break;
    case 'braccia-conserte':
      set('braccioS', -0.35, 0, 0.25);
      set('braccioD', -0.35, 0, -0.25);
      set('avambraccioS', -1.75, -0.95, 0);
      set('avambraccioD', -1.65, 0.95, 0);
      break;
    case 'mani-dietro':
      set('braccioS', 0.35, 0, 0.12);
      set('braccioD', 0.35, 0, -0.12);
      set('avambraccioS', -0.5, 0.7, 0);
      set('avambraccioD', -0.5, -0.7, 0);
      break;
  }
  if (opz.bastone && postura !== 'curva') set('avambraccioD', -0.6, 0, 0);

  let t = rng.next() * 20;
  let fase = 0;
  let pesoCamminata = 0;
  const gesti: Record<Gesto, number> = { nessuno: 1, saluta: 0, indica: 0, 'mano-al-petto': 0 };
  const sguardo = { yaw: 0, pitch: 0 };
  const indicaDir = { yaw: 0, pitch: 0 };
  const respiroPeriodo = 3.6 + rng.next() * 1.4;
  const pesoPeriodo = 6 + rng.next() * 4;
  const tmp = new THREE.Vector3();
  const posTesta = J[O.testa] as THREE.Vector3;

  const update = (dt: number, stato?: StatoAbitante) => {
    t += dt;
    const modo = stato?.modo ?? 'fermo';
    const vel = stato?.velocita ?? 1.1;
    pesoCamminata = smorza(pesoCamminata, modo === 'cammina' ? 1 : 0, 5, dt);
    fase += dt * (vel / (0.62 * H)) * Math.PI * pesoCamminata;
    const gesto = stato?.gesto ?? 'nessuno';
    for (const k of Object.keys(gesti) as Gesto[]) gesti[k] = smorza(gesti[k], k === gesto ? 1 : 0, 6, dt);

    // reset alle rotazioni di riposo
    for (let i = 0; i < ossa.length; i++) {
      const o = ossa[i] as THREE.Bone;
      const rr = riposo[i] ?? [0, 0, 0];
      o.rotation.set(rr[0], rr[1], rr[2]);
      o.position.copy(base[i] as THREE.Vector3);
      o.scale.set(1, 1, 1);
    }
    const fermo = 1 - pesoCamminata;
    // respiro
    const resp = Math.sin((t / respiroPeriodo) * Math.PI * 2);
    os('petto').scale.set(1 + resp * 0.012, 1 + resp * 0.008, 1 + resp * 0.02);
    os('braccioS').rotation.z += resp * 0.01;
    os('braccioD').rotation.z -= resp * 0.01;
    // peso che si sposta da un piede all'altro
    const peso = Math.sin((t / pesoPeriodo) * Math.PI * 2) * fermo;
    os('bacino').position.x += peso * 0.025;
    os('bacino').rotation.z += peso * 0.035;
    os('schiena').rotation.z -= peso * 0.045;
    os('cosciaS').rotation.z -= peso * 0.035;
    os('cosciaD').rotation.z -= peso * 0.035;
    os('stincoS').rotation.x += Math.max(0, -peso) * 0.12;
    os('stincoD').rotation.x += Math.max(0, peso) * 0.12;
    // camminata
    if (pesoCamminata > 0.001) {
      const s = Math.sin(fase);
      const c = Math.cos(fase);
      const a = 0.42 * pesoCamminata;
      os('cosciaS').rotation.x += -s * a;
      os('cosciaD').rotation.x += s * a;
      os('stincoS').rotation.x += Math.max(0, c) * 0.7 * pesoCamminata;
      os('stincoD').rotation.x += Math.max(0, -c) * 0.7 * pesoCamminata;
      os('braccioS').rotation.x += s * 0.32 * pesoCamminata;
      os('braccioD').rotation.x += -s * 0.32 * pesoCamminata;
      os('bacino').position.y += Math.abs(c) * 0.03 * pesoCamminata - 0.015 * pesoCamminata;
      os('bacino').rotation.y += s * 0.08 * pesoCamminata;
      os('petto').rotation.y -= s * 0.1 * pesoCamminata;
      os('schiena').rotation.x += 0.05 * pesoCamminata;
    }
    // sguardo verso un punto (coordinate mondo)
    let yawObj = Math.sin(t * 0.21) * 0.15 * fermo;
    let pitchObj = 0;
    if (stato?.guarda) {
      gruppo.updateWorldMatrix(true, false);
      tmp.copy(stato.guarda);
      gruppo.worldToLocal(tmp);
      tmp.sub(posTesta);
      yawObj = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.4, 1.4);
      pitchObj = THREE.MathUtils.clamp(Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)), -0.6, 0.7);
    }
    sguardo.yaw = smorza(sguardo.yaw, yawObj, 4, dt);
    sguardo.pitch = smorza(sguardo.pitch, pitchObj, 4, dt);
    const yawTesta = THREE.MathUtils.clamp(sguardo.yaw, -1.0, 1.0);
    os('testa').rotation.y += yawTesta;
    os('testa').rotation.x += -sguardo.pitch * 0.8;
    os('petto').rotation.y += (sguardo.yaw - yawTesta) * 0.8;
    // gesti con la mano destra (o sinistra per il bastone)
    const g1 = gesti.saluta;
    if (g1 > 0.001) {
      const onda = Math.sin(t * 9) * 0.35;
      mescolaRot(os('braccioD'), [-0.3, 0, -2.5], g1);
      mescolaRot(os('avambraccioD'), [-0.2, 0, -0.35 + onda], g1);
    }
    const g2 = gesti.indica;
    if (g2 > 0.001) {
      if (stato?.indica) {
        gruppo.updateWorldMatrix(true, false);
        tmp.copy(stato.indica);
        gruppo.worldToLocal(tmp);
        tmp.sub(J[O.braccioD] as THREE.Vector3);
        indicaDir.yaw = THREE.MathUtils.clamp(Math.atan2(tmp.x, tmp.z), -1.2, 0.6);
        indicaDir.pitch = THREE.MathUtils.clamp(Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)), -0.5, 1.0);
      }
      mescolaRot(os('braccioD'), [-(Math.PI / 2 + indicaDir.pitch), indicaDir.yaw, 0], g2);
      mescolaRot(os('avambraccioD'), [0, 0, 0], g2);
    }
    const g3 = gesti['mano-al-petto'];
    if (g3 > 0.001) {
      mescolaRot(os('braccioD'), [-0.35, 0, 0.25], g3);
      mescolaRot(os('avambraccioD'), [-1.85, 0.6, 0], g3);
      mescolaRot(os('testa'), [0.2, 0, 0], g3 * 0.5);
    }
  };
  update(0);

  const altezza = 1.75 * H;
  return risultato<StatoAbitante>({
    nome: 'abitante',
    seme,
    gruppo,
    collider: [cil(0, 0, 0, 0.3 * Lx, altezza, 'personaggio')],
    ingombro: ingombroDa(gruppo),
    punti: {
      testa: cT.clone(),
      manoDestra: polso(-1),
      manoSinistra: polso(1),
    },
    update,
  });
}

/** Porta le rotazioni di un osso verso un obiettivo con peso w. */
function mescolaRot(o: THREE.Bone, obiettivo: [number, number, number], w: number): void {
  o.rotation.x += (obiettivo[0] - o.rotation.x) * w;
  o.rotation.y += (obiettivo[1] - o.rotation.y) * w;
  o.rotation.z += (obiettivo[2] - o.rotation.z) * w;
}
