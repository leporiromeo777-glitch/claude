/**
 * Il verde fra le case (rifinitura 2): orti d'ottobre e alberi da frutto. Nei bozzetti 1 e 3 il paese
 * non è fatto solo di case: fra un tetto e l'altro ci sono orti, filari e chiome tonde di meli e
 * peri, e da lontano il nucleo si legge come un grumo di pietra e verde attorno al campanile.
 *
 * - `creaOrto`: un'aiuola di terra scura vangata con le file di cavoli, porri e qualche zucca,
 *   bordata di assi basse e sassi; nessun collider (è bassa: ci si cammina come sull'erba).
 * - `creaAlberoFrutto`: melo, pero o fico, 3,5-5 m, tronco corto e storto, chioma tonda a masse
 *   (verde oliva che ingiallisce, qualche frutto); il collider del tronco.
 * Orientamento: davanti verso +Z, il suolo a y = 0.
 */
import * as THREE from 'three';
import { Costruttore, mat, mescola, type FnColore } from '../costruttore';
import { cil, ingombroDa, risultato } from '../comune';
import { geoBoxC, geoCiuffo, geoMassa, geoTubo } from '../forme';
import { PALETTE } from '../palette';
import { Rng, hashPosizione, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';
import { SUP, legnoOrizzontale, sup } from '../superfici';

export interface OpzioniOrto {
  seme?: Seme;
  larghezza?: number;
  profondita?: number;
  dettaglio?: 'alto' | 'basso';
}

/** Orto d'ottobre: terra vangata, file di ortaggi, bordo di assi e sassi. */
export function creaOrto(opz: OpzioniOrto = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'orto');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const W = opz.larghezza ?? rng.tra(2.6, 4);
  const D = opz.profondita ?? rng.tra(2, 3.4);
  const alto = (opz.dettaglio ?? 'alto') === 'alto';
  // la terra: una zolla appena rialzata, scura e calda, sepolta nel pendio
  b.aggiungi(geoBoxC(W, 0.5, D), { matrice: mat([0, -0.2, 0]), colore: 0x4e3a2a, rumore: 0.08, piatto: true, superficie: sup(SUP.TERRA, rng.next()), occlusione: 0.1 });
  // i solchi (righe più scure) fra le file
  const passo = 0.42;
  const nFile = Math.max(2, Math.floor((D - 0.3) / passo));
  for (let f = 0; f < nFile; f++) {
    const z = -D / 2 + 0.25 + f * passo;
    b.aggiungi(geoBoxC(W - 0.3, 0.03, 0.12), { matrice: mat([0, 0.055, z + passo / 2]), colore: 0x3a2a1e, superficie: sup(SUP.TERRA, 0.7), occlusione: 0.3 });
    // la fila: cavoli (verde-azzurro), porri (verde chiaro e dritti) o bietole (verde scuro con le
    // coste), d'ottobre qualche foglia gialla; una zucca arancione ogni tanto
    const tipo = rng.intero(0, 2);
    if (!alto) {
      // da lontano la fila è una striscia verde (o gialla) a gobbe: pochi triangoli
      const c = rng.prob(0.2) ? mescola(0x8a8a4a, 0xa89a48, rng.next()) : mescola(tipo === 2 ? 0x3e5a2c : 0x5f7a4a, 0x7d9a5a, rng.next());
      b.aggiungi(geoBoxC(W - 0.5, 0.2 + rng.next() * 0.1, 0.26), { matrice: mat([0, 0.12, z]), colore: c, variazione: 0.08, piatto: true, superficie: SUP.FOGLIAME });
      continue;
    }
    const nPiante = Math.max(3, Math.round((W - 0.4) / (tipo === 1 ? 0.22 : 0.38)));
    for (let k = 0; k < nPiante; k++) {
      if (rng.prob(0.12)) continue;
      const x = -W / 2 + 0.25 + (k + 0.5) * ((W - 0.5) / nPiante) + rng.centrato(0.04);
      const giallo = rng.prob(0.15);
      if (tipo === 0) {
        const c = giallo ? mescola(0x7d8a52, 0xb0a04a, 0.6) : mescola(0x5f7a5a, 0x7d9a62, rng.next());
        b.aggiungi(geoCiuffo(0.16 + rng.next() * 0.05, rng.intero(0, 1e6), 0.7), { matrice: mat([x, 0.1, z]), colore: c, variazione: 0.08, superficie: SUP.FOGLIAME });
      } else if (tipo === 1) {
        const c = giallo ? 0xa8a050 : mescola(0x6f9a4a, 0x8aae5a, rng.next());
        b.aggiungi(geoBoxC(0.05, 0.42, 0.05), { matrice: mat([x, 0.25, z], [rng.centrato(0.25), 0, rng.centrato(0.25)]), colore: c, piatto: true, superficie: SUP.FOGLIAME });
      } else {
        const c = giallo ? 0x9a8a3a : mescola(0x3e5a2c, 0x56742e, rng.next());
        b.aggiungi(geoCiuffo(0.2 + rng.next() * 0.06, rng.intero(0, 1e6), 0.9), { matrice: mat([x, 0.14, z]), colore: c, variazione: 0.1, superficie: SUP.FOGLIAME });
      }
    }
    if (rng.prob(0.35)) {
      const x = rng.centrato(W * 0.35);
      b.aggiungi(geoMassa(0.17, rng.intero(0, 1e6), 0.12, 0, 0.75, 0.6), { matrice: mat([x, 0.13, z + passo / 2]), colore: mescola(0xc8742a, 0xd99a3a, rng.next()), superficie: sup(SUP.NESSUNA) });
    }
  }
  // il bordo: assi basse di larice grigio sui lati lunghi e qualche sasso sugli angoli
  for (const s of [-1, 1]) {
    b.aggiungi(geoBoxC(W + 0.1, 0.16, 0.05), { matrice: mat([0, 0.05, s * (D / 2 + 0.02)]), colore: PALETTE.lariceGrigio, variazione: 0.06, piatto: true, superficie: legnoOrizzontale(rng.next()), occlusione: 0.15 });
    b.aggiungi(geoBoxC(0.05, 0.16, D + 0.1), { matrice: mat([s * (W / 2 + 0.02), 0.05, 0]), colore: PALETTE.lariceGrigio, variazione: 0.06, piatto: true, superficie: legnoOrizzontale(rng.next()), occlusione: 0.15 });
  }
  if (alto) {
    // i paletti degli angoli e un paio di canne piegate (i fagioli sono finiti)
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      b.aggiungi(geoBoxC(0.06, 0.5, 0.06), { matrice: mat([sx * (W / 2 + 0.02), 0.2, sz * (D / 2 + 0.02)]), colore: PALETTE.legnoGrigio, piatto: true, superficie: SUP.LEGNO });
    }
  }
  const gruppo = b.costruisci('orto');
  return risultato({ nome: 'orto', seme, gruppo, collider: [], ingombro: ingombroDa(gruppo), punti: { centro: new THREE.Vector3() } });
}

export type SpecieFrutto = 'melo' | 'pero' | 'fico';

export interface OpzioniAlberoFrutto {
  seme?: Seme;
  specie?: SpecieFrutto;
  altezza?: number;
  dettaglio?: 'alto' | 'basso';
}

/** Verde oliva in ombra del corpo della chioma (lo stesso dei castagni). */
const OLIVA = new THREE.Color(0.26, 0.33, 0.12);

/** Tavolozze d'ottobre: [ombra, medio, luce, frutto]. */
const FOGLIE: Record<SpecieFrutto, [number, number, number, number]> = {
  melo: [0x3f5a2a, 0x6f8a3c, 0xa8a442, 0xb8402a],
  pero: [0x4a5a26, 0x86883a, 0xc0a040, 0xc8b04a],
  fico: [0x34502a, 0x5a7a34, 0x8aa048, 0x5a3a5a],
};

/** Albero da frutto fra le case: tronco corto e storto, chioma tonda a masse, qualche frutto. */
export function creaAlberoFrutto(opz: OpzioniAlberoFrutto = {}): OggettoProcedurale {
  const seme = semeNumerico(opz.seme ?? 'melo');
  const rng = new Rng(seme);
  const b = new Costruttore(rng);
  const specie = opz.specie ?? (rng.prob(0.5) ? 'melo' : rng.prob(0.6) ? 'pero' : 'fico');
  const H = opz.altezza ?? rng.tra(3.6, 5);
  const alto = (opz.dettaglio ?? 'alto') === 'alto';
  const rT = H * rng.tra(0.028, 0.036);
  const hFusto = H * rng.tra(0.28, 0.36);
  const corteccia = specie === 'fico' ? 0x8a8478 : 0x5e4a3a;
  // tronco: un tubo storto che si apre in tre branche
  const pende = new THREE.Vector3(rng.centrato(0.4), 0, rng.centrato(0.4));
  const fusto = [new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(pende.x * 0.3, hFusto * 0.5, pende.z * 0.3), new THREE.Vector3(pende.x, hFusto, pende.z)];
  b.aggiungi(geoTubo(fusto, [rT * 1.3, rT * 1.05, rT * 0.9], 7, { chiudiFine: true }), { colore: corteccia, superficie: SUP.CORTECCIA });
  const cChioma = new THREE.Vector3(pende.x, H * 0.66, pende.z);
  const larg = H * rng.tra(0.75, 0.95);
  const rx = larg / 2;
  const ry = (H - hFusto) * 0.48;
  const nMasse = alto ? rng.intero(7, 9) : 5;
  const centri: Array<{ c: THREE.Vector3; r: number }> = [];
  for (let k = 0; k < nMasse; k++) {
    const a = (k / nMasse) * Math.PI * 2 + rng.centrato(0.5);
    const alto2 = k % 3 === 0;
    const rr = rx * (alto2 ? rng.tra(0.2, 0.35) : rng.tra(0.45, 0.6));
    const y = cChioma.y + (alto2 ? ry * rng.tra(0.25, 0.45) : -ry * rng.tra(0, 0.3));
    centri.push({ c: new THREE.Vector3(cChioma.x + Math.cos(a) * rr, y, cChioma.z + Math.sin(a) * rr), r: rx * rng.tra(0.42, 0.55) });
  }
  centri.push({ c: cChioma.clone(), r: rx * 0.6 });
  for (let k = 0; k < 3; k++) {
    const t = centri[k * 2]!.c.clone().lerp(cChioma, 0.35);
    b.aggiungi(geoTubo([fusto[2]!, fusto[2]!.clone().lerp(t, 0.5).add(new THREE.Vector3(0, 0.15, 0)), t], [rT * 0.75, rT * 0.5, rT * 0.3], 5), { colore: corteccia, superficie: SUP.CORTECCIA });
  }
  const [cS, cM, cL, cF] = FOGLIE[specie].map((c) => new THREE.Color(c)) as [THREE.Color, THREE.Color, THREE.Color, THREE.Color];
  const giallo = rng.tra(0, 0.35);
  for (const [i, { c, r }] of centri.entries()) {
    const fn: FnColore = (p, n, out) => {
      const dx = (p.x - cChioma.x) / rx;
      const dy = (p.y - cChioma.y) / (ry * 1.2);
      const dz = (p.z - cChioma.z) / rx;
      const esterno = THREE.MathUtils.smoothstep(Math.sqrt(dx * dx + dy * dy + dz * dz), 0.4, 1.05);
      const t = THREE.MathUtils.clamp(n.y * 0.3 + 0.25 + esterno * 0.35 + (hashPosizione(p.x, p.y, p.z, seme) - 0.5) * 0.08, 0, 1);
      if (t < 0.5) out.copy(cS).lerp(cM, t / 0.5);
      else out.copy(cM).lerp(cL, ((t - 0.5) / 0.5) * (0.6 + giallo));
      // (le masse sono il corpo in ombra sotto i ciuffi: un filo più scure e oliva, come nei castagni)
      out.multiplyScalar((0.72 + 0.25 * esterno) * 0.9);
      out.lerp(OLIVA, 0.22);
    };
    b.aggiungi(geoMassa(r * 0.9, seme + i * 17, alto ? 0.26 : 0.16, alto ? 1 : 0, 0.82, 0.7), { matrice: mat(c, [0, rng.next() * 6, 0]), colore: fn, superficie: SUP.FOGLIAME });
  }
  // ciuffi di foglie sul contorno della chioma, come nei castagni (natura): rompono la sagoma liscia
  // delle masse, che da vicino sembravano palle gialle di plastica (a08, p1 del giro 3)
  {
    const pos: number[] = [];
    const nor: number[] = [];
    const col: number[] = [];
    const tinte = [FOGLIE[specie][1], FOGLIE[specie][2], FOGLIE[specie][1], FOGLIE[specie][0], mescola(FOGLIE[specie][1], FOGLIE[specie][2], 0.5)];
    const cc = new THREE.Color();
    const cBase = new THREE.Color();
    const nC = new THREE.Vector3();
    const ciuffi = Math.round((alto ? 190 : 70) * Math.min(1.2, larg / 3.8));
    let fatti = 0;
    for (let tent = 0; tent < ciuffi * 20 && fatti < ciuffi; tent++) {
      const m = centri[rng.intero(0, centri.length - 2)]!;
      const dir = new THREE.Vector3(rng.centrato(1), rng.tra(-0.5, 1), rng.centrato(1));
      if (dir.lengthSq() < 0.05) continue;
      dir.normalize();
      const p = m.c.clone().addScaledVector(dir, m.r * 0.9 * rng.tra(0.88, 1.04));
      if (centri.some((o) => o !== m && o.c.distanceTo(p) < o.r * 0.82)) continue;
      fatti++;
      nC.set((p.x - cChioma.x) / rx, ((p.y - cChioma.y) / ry) * 0.8, (p.z - cChioma.z) / rx).normalize().lerp(dir, 0.3).normalize();
      cc.set(tinte[rng.intero(0, tinte.length - 1)]!).multiplyScalar(rng.tra(0.85, 1.08));
      if (rng.prob(giallo * 0.6)) cc.lerp(new THREE.Color(FOGLIE[specie][2]), 0.5);
      cBase.copy(cc).multiplyScalar(0.6);
      const t1 = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      if (t1.lengthSq() < 1e-3) t1.set(1, 0, 0);
      t1.normalize();
      const t2 = new THREE.Vector3().crossVectors(dir, t1).normalize();
      for (let f = 0; f < 3; f++) {
        const a = rng.next() * Math.PI * 2;
        const df = t1.clone().multiplyScalar(Math.cos(a)).addScaledVector(t2, Math.sin(a)).addScaledVector(dir, rng.tra(0.2, 0.9)).normalize();
        df.y -= rng.tra(0.15, 0.45);
        df.normalize();
        const len = rng.tra(0.2, 0.3);
        const lat = new THREE.Vector3().crossVectors(df, dir).normalize().multiplyScalar(len * 0.2);
        const attacco = p.clone().addScaledVector(t1, rng.centrato(0.14)).addScaledVector(t2, rng.centrato(0.14));
        const b0 = attacco.clone().addScaledVector(df, 0.015);
        const punta = attacco.clone().addScaledVector(df, len);
        const mezzo = attacco.clone().addScaledVector(df, len * 0.42);
        const sx = mezzo.clone().add(lat);
        const dx = mezzo.clone().sub(lat);
        for (const [q, c] of [
          [b0, cBase],
          [sx, cc],
          [punta, cc],
          [b0, cBase],
          [punta, cc],
          [dx, cc],
        ] as const) {
          pos.push(q.x, q.y, q.z);
          nor.push(nC.x, nC.y, nC.z);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    b.aggiungi(g, { colore: 'geometria', canale: 'sottile' });
  }
  // i frutti sul contorno della chioma (da vicino)
  if (alto && specie !== 'fico') {
    for (let k = 0; k < 26; k++) {
      const m = centri[rng.intero(0, centri.length - 2)]!;
      const d = new THREE.Vector3(rng.centrato(1), rng.tra(-0.6, 0.6), rng.centrato(1)).normalize();
      const p = m.c.clone().addScaledVector(d, m.r * 0.97);
      b.aggiungi(geoMassa(0.05, rng.intero(0, 1e6), 0.05, 0, 1, 0.5), { matrice: mat(p), colore: mescola(cF, 0xd8b048, rng.next() * 0.3), superficie: sup(SUP.NESSUNA) });
    }
    // qualche frutto caduto nell'erba
    for (let k = 0; k < 5; k++) {
      const a = rng.next() * Math.PI * 2;
      const d = rT * 3 + rng.next() * rx * 0.8;
      b.aggiungi(geoMassa(0.045, rng.intero(0, 1e6), 0.05, 0, 0.9, 0.5), { matrice: mat([Math.cos(a) * d, 0.03, Math.sin(a) * d]), colore: mescola(cF, 0x6a4a2a, 0.3), superficie: sup(SUP.NESSUNA) });
    }
  }
  const gruppo = b.costruisci('albero-frutto');
  return risultato({
    nome: 'albero-frutto',
    seme,
    gruppo,
    collider: [cil(0, -0.3, 0, rT * 1.4, hFusto + 0.3, 'tronco')],
    ingombro: ingombroDa(gruppo),
    punti: { chioma: cChioma, tronco: new THREE.Vector3() },
  });
}
