/**
 * Geometrie degli alberi della traccia «natura»: castagni, betulle, larici, noci e cipressi, ognuno
 * in quattro livelli di dettaglio (LOD 0 vicino … LOD 3 lontanissimo). Unità: metri, albero «tipo»
 * (l'istanza lo scala); +Y = su, base del tronco in (0, 0, 0).
 *
 * Le chiome sono masse tondeggianti a ciuffi (icosaedri suddivisi con il bordo «a smerli»: la sagoma
 * di una chioma dipinta) più, vicino, piccoli ciuffi in rilievo che rompono il contorno. Le normali
 * sono piegate verso quelle dell'ellissoide della chioma intera: la luce gira la chioma come un unico
 * volume morbido in due toni, e ogni massa tiene un poco della sua luce. L'occlusione propria (fondo
 * e interno della chioma più scuri) è cotta per vertice.
 *
 * Attributi delle chiome (vedi `render/naturaMateriali.ts`): `aColor` r = occlusione, g = bordo
 * della chioma, a = valore della massa (sceglie fra il colore principale e il secondario
 * dell'istanza: così le masse di un castagno d'ottobre sono verdi, oro o ruggine).
 * Tronchi: `aColor` rgb = corteccia.
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { geoTubo } from '../oggetti/forme';
import { mulberry32 } from '../world/noise';

export type Specie = 'castagno' | 'betulla' | 'larice' | 'noce' | 'cipresso';
export const SPECIE: readonly Specie[] = ['castagno', 'betulla', 'larice', 'noce', 'cipresso'];
export const N_LOD_ALBERI = 4;

export interface GeometrieAlbero {
  /** chioma per LOD (0..3) */
  chioma: BufferGeometry[];
  /** tronco per LOD (null = nessun tronco a quel livello) */
  tronco: (BufferGeometry | null)[];
  /** altezza dell'albero tipo (m) */
  altezza: number;
  /** raggio del tronco alla base (m, per il collisore) e altezza del fusto */
  raggioTronco: number;
  altezzaFusto: number;
}

interface Massa {
  c: Vector3;
  /** semiassi */
  r: Vector3;
  /** valore della massa (0..1): sceglie il colore */
  m: number;
  det: number;
}

interface OpzioniChioma {
  masse: Massa[];
  centro: Vector3;
  semiassi: Vector3;
  /** ciuffi in rilievo sul contorno (solo vicino) */
  ciuffi: number;
  raggioCiuffi: number;
  /** forza dei bozzi della sagoma a smerli */
  bozzi: number;
  /** quanto le normali si piegano verso l'ellissoide della chioma */
  sferiche: number;
  seme: number;
  /** schiaccia il fondo delle masse (0.6 = fondo piatto) */
  fondo?: number;
}

/** Accumulo di geometrie indicizzate (position, normal, aColor vec4). */
class Accumulo {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  aggiungi(g: BufferGeometry, colore: (p: Vector3, n: Vector3, i: number) => [number, number, number, number]): void {
    const base = this.pos.length / 3;
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const v = new Vector3();
    const nn = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      nn.fromBufferAttribute(n, i);
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(nn.x, nn.y, nn.z);
      this.col.push(...colore(v, nn, i));
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) this.idx.push(base + ix.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
  }

  costruisci(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.col), 4));
    const n = this.pos.length / 3;
    g.setIndex(new BufferAttribute(n < 65536 ? new Uint16Array(this.idx) : new Uint32Array(this.idx), 1));
    g.computeBoundingSphere();
    return g;
  }
}

const _d = new Vector3();
const _t = new Vector3();

/** Icosaedro suddiviso con i vertici condivisi (normali morbide), raggio 1. */
function sfera(det: number): BufferGeometry {
  const g = new IcosahedronGeometry(1, det);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  return mergeVertices(g);
}

/** Chioma a masse con la sagoma a smerli. */
function chiomaAMasse(o: OpzioniChioma): BufferGeometry {
  const acc = new Accumulo();
  const rnd = mulberry32(o.seme);
  const C = o.centro;
  const S = o.semiassi;
  const fondo = o.fondo ?? 0.72;
  // normale dell'ellissoide della chioma in p (gradiente) e "quanto è fuori" (0 centro, 1 bordo)
  const ns = new Vector3();
  const sferica = (p: Vector3): number => {
    ns.set((p.x - C.x) / (S.x * S.x), (p.y - C.y) / (S.y * S.y), (p.z - C.z) / (S.z * S.z)).normalize();
    _t.set((p.x - C.x) / S.x, (p.y - C.y) / S.y, (p.z - C.z) / S.z);
    return _t.length();
  };
  const colore = (p: Vector3, m: number): [number, number, number, number] => {
    const q = sferica(p);
    const esterno = Math.min(1, Math.max(0, (q - 0.45) / 0.55));
    // in basso e dentro la chioma la luce del cielo arriva meno
    const bassa = Math.min(1, Math.max(0, (ns.y + 0.75) / 1.3));
    const occl = (0.62 + 0.38 * Math.pow(bassa, 0.8)) * (0.8 + 0.2 * esterno);
    const j = (rnd() - 0.5) * 0.08;
    return [occl, esterno, 0, Math.min(1, Math.max(0, m + j))];
  };
  const piega = (g: BufferGeometry): void => {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const v = new Vector3();
    const nn = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      nn.fromBufferAttribute(n, i);
      sferica(v);
      nn.lerp(ns, o.sferiche).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
    }
  };
  for (const M of o.masse) {
    const g = sfera(M.det);
    const pos = g.getAttribute('position');
    // direzioni dei bozzi (la sagoma a smerli)
    const nb = 7 + M.det * 5;
    const bozzi: Vector3[] = [];
    for (let k = 0; k < nb; k++) bozzi.push(new Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize());
    const cosA = Math.cos(0.62 - M.det * 0.08);
    for (let i = 0; i < pos.count; i++) {
      _d.fromBufferAttribute(pos, i).normalize();
      let b = 0;
      for (const t of bozzi) {
        const x = (_d.dot(t) - cosA) / (1 - cosA);
        if (x > 0) b = Math.max(b, Math.sqrt(Math.min(1, x)));
      }
      const r = 1 + o.bozzi * (b - 0.45) + (rnd() - 0.5) * 0.05;
      let y = _d.y * r * M.r.y;
      if (y < 0) y *= fondo;
      pos.setXYZ(i, M.c.x + _d.x * r * M.r.x, M.c.y + y, M.c.z + _d.z * r * M.r.z);
    }
    g.computeVertexNormals();
    piega(g);
    acc.aggiungi(g, (p) => colore(p, M.m));
  }
  // ciuffi in rilievo sul contorno
  if (o.ciuffi > 0) {
    const base = sfera(0);
    for (let k = 0; k < o.ciuffi; k++) {
      const M = o.masse[Math.floor(rnd() * o.masse.length)]!;
      // direzione verso fuori dalla chioma, più spesso di lato e in alto
      _d.set(rnd() * 2 - 1, rnd() * 1.4 - 0.45, rnd() * 2 - 1).normalize();
      const p0 = new Vector3(M.c.x + _d.x * M.r.x * 0.95, M.c.y + _d.y * M.r.y * (_d.y < 0 ? fondo : 1) * 0.95, M.c.z + _d.z * M.r.z * 0.95);
      // solo i ciuffi che stanno sul bordo della chioma (gli altri sarebbero nascosti)
      if (sferica(p0) < 0.78) continue;
      const g = base.clone();
      const pos = g.getAttribute('position');
      const rr = o.raggioCiuffi * (0.7 + rnd() * 0.6);
      for (let i = 0; i < pos.count; i++) {
        _t.fromBufferAttribute(pos, i);
        const j = 0.85 + rnd() * 0.3;
        pos.setXYZ(i, p0.x + _t.x * rr * j, p0.y + _t.y * rr * 0.8 * j, p0.z + _t.z * rr * j);
      }
      g.computeVertexNormals();
      piega(g);
      acc.aggiungi(g, (p) => colore(p, M.m));
    }
  }
  return acc.costruisci();
}

/** Colore della corteccia per vertice: più scura e muschiosa in basso. */
function coloreCorteccia(chiaro: [number, number, number], scuro: [number, number, number], h: number, seme: number) {
  const rnd = mulberry32(seme);
  return (p: Vector3): [number, number, number, number] => {
    const t = Math.min(1, Math.max(0, p.y / h));
    const k = 0.35 + 0.55 * t + (rnd() - 0.5) * 0.18;
    const c: [number, number, number, number] = [scuro[0] + (chiaro[0] - scuro[0]) * k, scuro[1] + (chiaro[1] - scuro[1]) * k, scuro[2] + (chiaro[2] - scuro[2]) * k, 0];
    // muschio al piede
    if (p.y < 0.9) {
      const m = (1 - p.y / 0.9) * 0.35;
      c[0] += (0.34 - c[0]) * m;
      c[1] += (0.4 - c[1]) * m;
      c[2] += (0.2 - c[2]) * m;
    }
    return c;
  };
}

interface Ramo {
  punti: Vector3[];
  raggi: number[];
}

/** Tronco a radici di contrafforte con le branche verso la chioma. */
function tronco(o: {
  seme: number;
  raggio: number;
  fusto: number;
  segmenti: number;
  anelli: number;
  lobi: number;
  pende: Vector3;
  rami: Ramo[];
  segRami: number;
  chiaro: [number, number, number];
  scuro: [number, number, number];
  altezzaColore: number;
}): BufferGeometry {
  const acc = new Accumulo();
  const rnd = mulberry32(o.seme);
  const fase = rnd() * 6;
  const pts: Vector3[] = [];
  const raggi: number[] = [];
  for (let i = 0; i < o.anelli; i++) {
    const t = i / (o.anelli - 1);
    pts.push(new Vector3(o.pende.x * t * t, -0.5 + t * (o.fusto + 0.5), o.pende.z * t * t));
    raggi.push(o.raggio * (1 + 0.6 * Math.pow(1 - t, 3)) * (1 - 0.18 * t));
  }
  const col = coloreCorteccia(o.chiaro, o.scuro, o.altezzaColore, o.seme);
  const g = geoTubo(pts, raggi, o.segmenti, {
    chiudiFine: true,
    fase,
    forma: (i, a) => {
      const t = i / (o.anelli - 1);
      const l = Math.pow(Math.max(0, Math.cos(a * o.lobi + fase)), 2);
      return 1 + l * 0.6 * Math.pow(1 - t, 2.2) + Math.sin(a * 3 + i * 0.9) * 0.05;
    },
  });
  acc.aggiungi(g, col);
  for (const r of o.rami) {
    const gr = geoTubo(r.punti, r.raggi, o.segRami, { chiudiFine: true });
    acc.aggiungi(gr, col);
  }
  return acc.costruisci();
}

/** Spezzata torta da a verso b. */
function torto(rnd: () => number, a: Vector3, b: Vector3, n: number, torsione: number): Vector3[] {
  const d = b.clone().sub(a);
  const perp = new Vector3(-d.z, 0, d.x).normalize();
  if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0);
  const perp2 = new Vector3().crossVectors(d, perp).normalize();
  const f1 = rnd() * 2 - 1;
  const f2 = rnd() * 2 - 1;
  const out: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const s = Math.sin(t * Math.PI) * torsione * d.length();
    out.push(a.clone().lerp(b, t).addScaledVector(perp, s * f1).addScaledVector(perp2, s * f2 * 0.6));
  }
  return out;
}

// ------------------------------------------------------------------------------------- specie

/** Masse di una chioma tonda (castagno, noce): anello basso, anello alto, cima. */
function masseTonde(rnd: () => number, C: Vector3, S: Vector3, nBasse: number, nAlte: number, det: number[], scala = 1): Massa[] {
  const out: Massa[] = [];
  const fase = rnd() * 6;
  for (let k = 0; k < nBasse; k++) {
    const a = fase + (k / nBasse) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const rr = S.x * (0.5 + rnd() * 0.12);
    const r = S.x * (0.5 + rnd() * 0.1) * scala;
    out.push({ c: new Vector3(C.x + Math.cos(a) * rr, C.y - S.y * (0.18 + rnd() * 0.14), C.z + Math.sin(a) * rr), r: new Vector3(r, r * 0.86, r), m: rnd(), det: det[0]! });
  }
  for (let k = 0; k < nAlte; k++) {
    const a = fase + 0.6 + (k / nAlte) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const rr = S.x * (0.24 + rnd() * 0.1);
    const r = S.x * (0.46 + rnd() * 0.08) * scala;
    out.push({ c: new Vector3(C.x + Math.cos(a) * rr, C.y + S.y * (0.22 + rnd() * 0.12), C.z + Math.sin(a) * rr), r: new Vector3(r, r * 0.84, r), m: rnd(), det: det[1]! });
  }
  if (det[2]! >= 0) {
    const r = S.x * 0.4 * scala;
    out.push({ c: new Vector3(C.x + (rnd() - 0.5) * 0.8, C.y + S.y * 0.55, C.z + (rnd() - 0.5) * 0.8), r: new Vector3(r, r * 0.8, r), m: rnd(), det: det[2]! });
  }
  return out;
}

function castagno(seme: number): GeometrieAlbero {
  const H = 12;
  const C = new Vector3(0.2, 7.1, 0);
  const S = new Vector3(5.3, 3.5, 5.3);
  const rT = 0.55;
  const hF = 3.0;
  const chioma: BufferGeometry[] = [];
  const tr: (BufferGeometry | null)[] = [];
  const bark = { chiaro: [0.5, 0.42, 0.33] as [number, number, number], scuro: [0.25, 0.2, 0.16] as [number, number, number] };
  const rndR = mulberry32(seme + 5);
  const pende = new Vector3((rndR() - 0.5) * 0.6, 0, (rndR() - 0.5) * 0.6);
  // branche dalla cima del fusto verso le masse basse
  const rami: Ramo[] = [];
  const cima = new Vector3(pende.x, hF, pende.z);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rndR() * 0.8;
    const fine = new Vector3(C.x + Math.cos(a) * S.x * 0.55, C.y - 0.6 + rndR() * 1.2, C.z + Math.sin(a) * S.x * 0.55);
    rami.push({ punti: torto(rndR, cima.clone().add(new Vector3(0, -0.4, 0)), fine, 5, 0.12), raggi: [rT * 0.62, rT * 0.48, rT * 0.36, rT * 0.24, rT * 0.12] });
  }
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    let masse: Massa[];
    if (lod === 0) masse = masseTonde(rnd, C, S, 5, 3, [2, 1, 1]);
    else if (lod === 1) masse = masseTonde(rnd, C, S, 5, 2, [1, 1, 0]);
    else if (lod === 2) masse = masseTonde(rnd, C, S, 3, 1, [0, 0, -1], 1.18);
    else masse = [{ c: C.clone(), r: S.clone().multiplyScalar(0.95), m: 0.5, det: 1 }];
    chioma.push(
      chiomaAMasse({
        masse,
        centro: C,
        semiassi: S,
        ciuffi: lod === 0 ? 26 : 0,
        raggioCiuffi: 0.75,
        bozzi: lod === 0 ? 0.2 : lod === 1 ? 0.16 : 0.1,
        sferiche: lod === 0 ? 0.58 : 0.66,
        seme: seme + lod * 101,
      }),
    );
    if (lod === 0) tr.push(tronco({ seme, raggio: rT, fusto: hF + 0.6, segmenti: 9, anelli: 6, lobi: 5, pende, rami, segRami: 6, ...bark, altezzaColore: H * 0.6 }));
    else if (lod === 1) tr.push(tronco({ seme, raggio: rT, fusto: hF + 0.6, segmenti: 6, anelli: 3, lobi: 3, pende, rami: rami.slice(0, 2).map((r) => ({ punti: [r.punti[0]!, r.punti[2]!, r.punti[4]!], raggi: [r.raggi[0]!, r.raggi[2]!, r.raggi[4]!] })), segRami: 4, ...bark, altezzaColore: H * 0.6 }));
    else if (lod === 2) tr.push(tronco({ seme, raggio: rT * 1.1, fusto: hF + 1.5, segmenti: 4, anelli: 2, lobi: 2, pende, rami: [], segRami: 3, ...bark, altezzaColore: H * 0.6 }));
    else tr.push(null);
  }
  return { chioma, tronco: tr, altezza: H, raggioTronco: rT, altezzaFusto: hF };
}

function noce(seme: number): GeometrieAlbero {
  const H = 13;
  const C = new Vector3(0, 7.6, 0);
  const S = new Vector3(6.0, 3.6, 6.0);
  const rT = 0.45;
  const hF = 3.4;
  const bark = { chiaro: [0.58, 0.55, 0.5] as [number, number, number], scuro: [0.32, 0.3, 0.28] as [number, number, number] };
  const rndR = mulberry32(seme + 5);
  const pende = new Vector3((rndR() - 0.5) * 0.4, 0, (rndR() - 0.5) * 0.4);
  const rami: Ramo[] = [];
  const cima = new Vector3(pende.x, hF, pende.z);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + rndR();
    const fine = new Vector3(Math.cos(a) * S.x * 0.6, C.y - 0.3, Math.sin(a) * S.x * 0.6);
    rami.push({ punti: torto(rndR, cima, fine, 5, 0.1), raggi: [rT * 0.6, rT * 0.45, rT * 0.32, rT * 0.2, rT * 0.1] });
  }
  const chioma: BufferGeometry[] = [];
  const tr: (BufferGeometry | null)[] = [];
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    let masse: Massa[];
    if (lod === 0) masse = masseTonde(rnd, C, S, 4, 2, [2, 1, 1], 1.08);
    else if (lod === 1) masse = masseTonde(rnd, C, S, 4, 2, [1, 1, 0], 1.08);
    else if (lod === 2) masse = masseTonde(rnd, C, S, 3, 1, [0, 0, -1], 1.2);
    else masse = [{ c: C.clone(), r: S.clone().multiplyScalar(0.95), m: 0.5, det: 1 }];
    chioma.push(chiomaAMasse({ masse, centro: C, semiassi: S, ciuffi: lod === 0 ? 20 : 0, raggioCiuffi: 0.8, bozzi: lod === 0 ? 0.18 : 0.12, sferiche: 0.64, seme: seme + lod * 101, fondo: 0.6 }));
    if (lod <= 1) tr.push(tronco({ seme, raggio: rT, fusto: hF + 0.6, segmenti: lod === 0 ? 8 : 5, anelli: lod === 0 ? 5 : 3, lobi: 3, pende, rami: lod === 0 ? rami : [], segRami: 5, ...bark, altezzaColore: H * 0.6 }));
    else if (lod === 2) tr.push(tronco({ seme, raggio: rT, fusto: hF + 1.5, segmenti: 4, anelli: 2, lobi: 2, pende, rami: [], segRami: 3, ...bark, altezzaColore: H * 0.6 }));
    else tr.push(null);
  }
  return { chioma, tronco: tr, altezza: H, raggioTronco: rT, altezzaFusto: hF };
}

function betulla(seme: number): GeometrieAlbero {
  const H = 13;
  const C = new Vector3(0, 8.6, 0);
  const S = new Vector3(2.5, 4.2, 2.5);
  const rT = 0.2;
  const hF = 9.5;
  const chioma: BufferGeometry[] = [];
  const tr: (BufferGeometry | null)[] = [];
  const rndR = mulberry32(seme + 5);
  const pende = new Vector3((rndR() - 0.5) * 0.9, 0, (rndR() - 0.5) * 0.9);
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    const masse: Massa[] = [];
    const n = lod === 0 ? 6 : lod === 1 ? 5 : lod === 2 ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0.5 : k / (n - 1);
      const y = C.y - S.y * 0.65 + t * S.y * 1.4;
      const rr = (1 - Math.abs(t - 0.4) * 0.9) * S.x;
      const a = rnd() * 6.28;
      const r = rr * (0.62 + rnd() * 0.15) * (n === 1 ? 1.5 : 1);
      masse.push({ c: new Vector3(pende.x * (y / H) + Math.cos(a) * rr * 0.35, y, pende.z * (y / H) + Math.sin(a) * rr * 0.35), r: new Vector3(r, r * (n === 1 ? 2.4 : 1.05), r), m: rnd(), det: lod === 0 ? 1 : lod === 1 ? 1 : 0 });
    }
    chioma.push(chiomaAMasse({ masse, centro: C, semiassi: S, ciuffi: lod === 0 ? 14 : 0, raggioCiuffi: 0.45, bozzi: 0.2, sferiche: 0.55, seme: seme + lod * 101, fondo: 0.85 }));
    // tronco bianco con le macchie scure
    if (lod <= 2) {
      const g = tronco({ seme, raggio: rT, fusto: hF, segmenti: lod === 0 ? 7 : lod === 1 ? 5 : 3, anelli: lod === 0 ? 6 : 3, lobi: 2, pende, rami: [], segRami: 3, chiaro: [0.9, 0.88, 0.82], scuro: [0.7, 0.68, 0.64], altezzaColore: H });
      const c = g.getAttribute('aColor');
      const p = g.getAttribute('position');
      for (let i = 0; i < c.count; i++) {
        const y = p.getY(i);
        const band = Math.sin(y * 7.3 + Math.sin(y * 2.1) * 2) > 0.72 || y < 0.4 ? 0.35 : 1;
        c.setXYZ(i, c.getX(i) * band, c.getY(i) * band, c.getZ(i) * band);
      }
      tr.push(g);
    } else tr.push(null);
  }
  return { chioma, tronco: tr, altezza: H, raggioTronco: rT, altezzaFusto: 2.5 };
}

function larice(seme: number): GeometrieAlbero {
  const H = 16;
  const C = new Vector3(0, 8.5, 0);
  const S = new Vector3(3.9, 7.0, 3.9);
  const rT = 0.32;
  const chioma: BufferGeometry[] = [];
  const tr: (BufferGeometry | null)[] = [];
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    const masse: Massa[] = [];
    // cono morbido: masse alte che si sovrappongono, larghe in basso e strette in cima
    const n = lod === 0 ? 5 : lod === 1 ? 4 : lod === 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0.3 : k / (n - 1);
      const y = 3.4 + t * (H - 6.4);
      const rr = S.x * (1.05 - t * 0.78) * (n === 1 ? 0.85 : 1);
      const hy = n === 1 ? (H - 3) * 0.5 : ((H - 3) / n) * 1.25;
      masse.push({ c: new Vector3((rnd() - 0.5) * 0.3, y, (rnd() - 0.5) * 0.3), r: new Vector3(rr, hy, rr), m: rnd(), det: lod <= 1 ? 1 : 0 });
    }
    if (n === 1) masse[0]!.c.y = 2.6 + (H - 3) * 0.48;
    chioma.push(chiomaAMasse({ masse, centro: C, semiassi: S, ciuffi: lod === 0 ? 14 : 0, raggioCiuffi: 0.55, bozzi: 0.16, sferiche: 0.6, seme: seme + lod * 101, fondo: 0.9 }));
    if (lod <= 2) tr.push(tronco({ seme, raggio: rT, fusto: H - 2, segmenti: lod === 0 ? 7 : 4, anelli: lod === 0 ? 5 : 2, lobi: 3, pende: new Vector3(), rami: [], segRami: 3, chiaro: [0.55, 0.4, 0.32], scuro: [0.3, 0.2, 0.16], altezzaColore: H }));
    else tr.push(null);
  }
  return { chioma, tronco: tr, altezza: H, raggioTronco: rT, altezzaFusto: 2.4 };
}

function cipresso(seme: number): GeometrieAlbero {
  const H = 14;
  const C = new Vector3(0, 7.4, 0);
  const S = new Vector3(1.5, 6.6, 1.5);
  const chioma: BufferGeometry[] = [];
  const tr: (BufferGeometry | null)[] = [];
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    const masse: Massa[] = [];
    const n = lod === 0 ? 6 : lod === 1 ? 4 : lod === 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0.5 : k / (n - 1);
      const y = 1.6 + t * (H - 3.2);
      // colonna a fiamma: più larga a un terzo, punta stretta
      const prof = Math.sin(Math.min(1, t * 1.25 + 0.15) * Math.PI) * 0.8 + 0.25;
      const rr = S.x * prof;
      masse.push({ c: new Vector3((rnd() - 0.5) * 0.2, y, (rnd() - 0.5) * 0.2), r: new Vector3(rr, n === 1 ? H * 0.48 : ((H - 2) / n) * 0.9, rr), m: rnd(), det: lod <= 1 ? 1 : 0 });
    }
    if (n === 1) masse[0]!.c.y = H * 0.52;
    chioma.push(chiomaAMasse({ masse, centro: C, semiassi: S, ciuffi: lod === 0 ? 10 : 0, raggioCiuffi: 0.4, bozzi: 0.14, sferiche: 0.5, seme: seme + lod * 101, fondo: 0.8 }));
    if (lod <= 1) tr.push(tronco({ seme, raggio: 0.25, fusto: 2.2, segmenti: 5, anelli: 2, lobi: 2, pende: new Vector3(), rami: [], segRami: 3, chiaro: [0.45, 0.36, 0.28], scuro: [0.28, 0.22, 0.18], altezzaColore: 3 }));
    else tr.push(null);
  }
  return { chioma, tronco: tr, altezza: H, raggioTronco: 0.25, altezzaFusto: 1.5 };
}

const COSTRUTTORI: Record<Specie, (seme: number) => GeometrieAlbero> = { castagno, betulla, larice, noce, cipresso };
const cache = new Map<string, GeometrieAlbero>();

/** Geometrie (in cache) di una specie e di una sua variante. */
export function geometrieAlbero(specie: Specie, variante = 0): GeometrieAlbero {
  const k = `${specie}:${variante}`;
  let g = cache.get(k);
  if (!g) {
    g = COSTRUTTORI[specie](9001 + variante * 7919 + SPECIE.indexOf(specie) * 131);
    cache.set(k, g);
  }
  return g;
}

/** Triangoli di una geometria indicizzata o no. */
export function triangoli(g: BufferGeometry | null): number {
  if (!g) return 0;
  return (g.index ? g.index.count : g.getAttribute('position').count) / 3;
}
