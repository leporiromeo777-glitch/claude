/**
 * Geometrie degli alberi della traccia «natura»: castagni, betulle, larici, noci e cipressi, ognuno
 * in quattro livelli di dettaglio (LOD 0 vicino … LOD 3 lontanissimo). Unità: metri, albero «tipo»
 * (l'istanza lo scala); +Y = su, base del tronco in (0, 0, 0).
 *
 * Una chioma è fatta di due cose:
 * - le MASSE: volumi tondeggianti a ciuffi (icosaedri suddivisi con il bordo «a smerli») che danno
 *   il corpo scuro della chioma, con le normali piegate verso quelle dell'ellissoide della chioma
 *   intera (la luce gira la chioma come un unico volume morbido in due toni) e l'occlusione propria
 *   cotta per vertice (fondo e interno più scuri);
 * - le CARTE DI FOGLIE (LOD 0 e 1): quadrati sul contorno delle masse che lo shader gira verso la
 *   camera e ritaglia a ciuffi di foglie (maschera procedurale per specie: foglie lanceolate del
 *   castagno, foglioline tonde di betulla e noce, aghi del larice). Rompono la sagoma come le
 *   pennellate di un pittore e prendono la luce foglia per foglia; nel passaggio delle ombre sono
 *   degeneri (tutti i vertici nel centro) e non proiettano nulla: l'ombra la fanno le masse.
 *
 * Attributi delle chiome (vedi `render/naturaMateriali.ts`): `aColor` r = occlusione, g = bordo
 * della chioma, b = 1 sui vertici del tronco dentro la chioma lontana (LOD 3), a = valore della massa
 * (sceglie fra il colore principale e il secondario dell'istanza: così le masse di un castagno
 * d'ottobre sono verdi, oro o ruggine). Carte: in più `aCarta` (x, y = angolo del quadrato in -1..1,
 * z = lato in m, w = seme). Tronchi: `aColor` rgb = corteccia.
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { geoTubo } from '../oggetti/forme';
import { mulberry32 } from '../world/noise';

export type Specie = 'castagno' | 'betulla' | 'larice' | 'noce' | 'cipresso';
export const SPECIE: readonly Specie[] = ['castagno', 'betulla', 'larice', 'noce', 'cipresso'];
export const N_LOD_ALBERI = 4;

/** Forma delle foglie nelle carte (uniform `uFoglia.x` dello shader). */
export const FORMA_FOGLIA = { lanceolata: 0, tonda: 1, aghi: 2, squame: 3 } as const;

export interface GeometrieAlbero {
  /** chioma (masse) per LOD (0..3) */
  chioma: BufferGeometry[];
  /** carte di foglie per LOD (null = niente carte a quel livello) */
  carte: (BufferGeometry | null)[];
  /** tronco per LOD (null = nessun tronco a quel livello) */
  tronco: (BufferGeometry | null)[];
  /** forma delle foglie delle carte (FORMA_FOGLIA) */
  forma: number;
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
  /** forza dei bozzi della sagoma a smerli */
  bozzi: number;
  /** quanto le normali si piegano verso l'ellissoide della chioma */
  sferiche: number;
  seme: number;
  /** schiaccia il fondo delle masse (0.6 = fondo piatto) */
  fondo?: number;
  /** tronco dentro la chioma (solo il LOD lontano: un prisma, colore di corteccia) */
  fusto?: { raggio: number; altezza: number };
}

/** Accumulo di geometrie indicizzate (position, normal, aColor vec4, aCarta vec4 facoltativo). */
class Accumulo {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  carta: number[] = [];
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
    if (this.carta.length) g.setAttribute('aCarta', new BufferAttribute(new Float32Array(this.carta), 4));
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

/** Ellissoide della chioma: normale (gradiente) in `ns` e distanza normalizzata dal centro (1 = bordo). */
function ellissoide(C: Vector3, S: Vector3, p: Vector3, ns: Vector3): number {
  ns.set((p.x - C.x) / (S.x * S.x), (p.y - C.y) / (S.y * S.y), (p.z - C.z) / (S.z * S.z)).normalize();
  _t.set((p.x - C.x) / S.x, (p.y - C.y) / S.y, (p.z - C.z) / S.z);
  return _t.length();
}

/** Occlusione propria di un punto della chioma: in basso e dentro la luce del cielo arriva meno. */
function occlusione(ns: Vector3, q: number): [number, number] {
  const esterno = Math.min(1, Math.max(0, (q - 0.45) / 0.55));
  const bassa = Math.min(1, Math.max(0, (ns.y + 0.75) / 1.3));
  return [(0.6 + 0.4 * Math.pow(bassa, 0.8)) * (0.78 + 0.22 * esterno), esterno];
}

/** Chioma a masse con la sagoma a smerli. */
function chiomaAMasse(o: OpzioniChioma): BufferGeometry {
  const acc = new Accumulo();
  const rnd = mulberry32(o.seme);
  const C = o.centro;
  const S = o.semiassi;
  const fondo = o.fondo ?? 0.72;
  const ns = new Vector3();
  const colore = (p: Vector3, m: number): [number, number, number, number] => {
    const q = ellissoide(C, S, p, ns);
    const [occl, esterno] = occlusione(ns, q);
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
      ellissoide(C, S, v, ns);
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
  if (o.fusto) {
    // tronco lontano: un prisma a 4 facce dentro la chioma (si vede sotto le masse)
    const f = o.fusto;
    const t = geoTubo([new Vector3(0, -0.4, 0), new Vector3(0, f.altezza, 0)], [f.raggio, f.raggio * 0.6], 4, {});
    acc.aggiungi(t, () => [0.85, 0, 1, 0]);
  }
  return acc.costruisci();
}

/**
 * Carte di foglie sul contorno delle masse (LOD 0 e 1). `n` carte di lato `lato` (m); ogni carta sta
 * su un punto della superficie di una massa (scelta in proporzione all'area) che sia anche sul
 * contorno della chioma intera: le carte nascoste dentro non servono.
 */
function carteChioma(o: { masse: Massa[]; centro: Vector3; semiassi: Vector3; n: number; lato: number; seme: number; fondo?: number; sferiche?: number; fuori?: number; minimo?: number; nucleo?: number }): BufferGeometry {
  const acc = new Accumulo();
  const rnd = mulberry32(o.seme + 77);
  const C = o.centro;
  const S = o.semiassi;
  const fondo = o.fondo ?? 0.72;
  const ns = new Vector3();
  const pesi = o.masse.map((M) => M.r.x * M.r.y + M.r.x * M.r.z);
  const tot = pesi.reduce((a, b) => a + b, 0);
  const sceglie = (): Massa => {
    let x = rnd() * tot;
    for (let i = 0; i < o.masse.length; i++) {
      x -= pesi[i]!;
      if (x <= 0) return o.masse[i]!;
    }
    return o.masse[o.masse.length - 1]!;
  };
  const p = new Vector3();
  const nn = new Vector3();
  let fatte = 0;
  for (let tent = 0; tent < o.n * 30 && fatte < o.n; tent++) {
    const M = sceglie();
    // direzione sulla massa: di lato e in alto più spesso che sotto
    _d.set(rnd() * 2 - 1, rnd() * 1.75 - 0.8, rnd() * 2 - 1);
    if (_d.lengthSq() < 0.05) continue;
    _d.normalize();
    const k = (o.fuori ?? 0.96) + (rnd() - 0.5) * 0.12;
    let y = _d.y * M.r.y * k;
    if (y < 0) y *= fondo;
    p.set(M.c.x + _d.x * M.r.x * k, M.c.y + y, M.c.z + _d.z * M.r.z * k);
    const q = ellissoide(C, S, p, ns);
    if (q < (o.minimo ?? 0.66)) continue;
    // niente carte sepolte dentro il nucleo di un'altra massa (le coprirebbe)
    let sepolta = false;
    for (const A of o.masse) {
      if (A === M) continue;
      _t.set((p.x - A.c.x) / A.r.x, (p.y - A.c.y) / A.r.y, (p.z - A.c.z) / A.r.z);
      if (_t.lengthSq() < (o.nucleo ?? 0.72) ** 2) {
        sepolta = true;
        break;
      }
    }
    if (sepolta) continue;
    // normale: quella della chioma intera, con un po' di quella della massa
    nn.copy(ns).lerp(_d, 1 - (o.sferiche ?? 0.75)).normalize();
    const [occl0, esterno] = occlusione(ns, q);
    // (le foglie esterne prendono il cielo più del corpo della chioma: occlusione più leggera)
    const occl = 0.42 + occl0 * 0.62;
    const lato = o.lato * (0.78 + rnd() * 0.44);
    const seme = rnd();
    const m = Math.min(1, Math.max(0, M.m + (rnd() - 0.5) * 0.2));
    const base = acc.pos.length / 3;
    for (const [cx, cy] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ] as const) {
      acc.pos.push(p.x, p.y, p.z);
      acc.nor.push(nn.x, nn.y, nn.z);
      acc.col.push(occl, esterno, 0, m);
      acc.carta.push(cx, cy, lato, seme);
    }
    acc.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    fatte++;
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

/** Masse di una chioma tonda (castagno, noce): anello basso, anello alto, cima, nucleo. */
function masseTonde(rnd: () => number, C: Vector3, S: Vector3, nBasse: number, nAlte: number, det: number[], scala = 1): Massa[] {
  const out: Massa[] = [];
  const fase = rnd() * 6;
  for (let k = 0; k < nBasse; k++) {
    const a = fase + (k / nBasse) * Math.PI * 2 + (rnd() - 0.5) * 0.5;
    const rr = S.x * (0.5 + rnd() * 0.12);
    const r = S.x * (0.5 + rnd() * 0.1) * scala;
    out.push({ c: new Vector3(C.x + Math.cos(a) * rr, C.y - S.y * (0.16 + rnd() * 0.14), C.z + Math.sin(a) * rr), r: new Vector3(r, r * 0.86, r), m: rnd(), det: det[0]! });
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

/** Riduce le masse (il nucleo scuro sotto le carte di foglie); `det` = suddivisione massima. */
function rimpicciolisci(masse: Massa[], k: number, det = 9): Massa[] {
  return masse.map((M) => ({ ...M, r: M.r.clone().multiplyScalar(k), det: Math.min(M.det, det) }));
}

function castagno(seme: number): GeometrieAlbero {
  const H = 12;
  const C = new Vector3(0.2, 7.3, 0);
  const S = new Vector3(5.3, 3.8, 5.3);
  const rT = 0.6;
  const hF = 3.0;
  const chioma: BufferGeometry[] = [];
  const carte: (BufferGeometry | null)[] = [];
  const tr: (BufferGeometry | null)[] = [];
  const bark = { chiaro: [0.52, 0.44, 0.35] as [number, number, number], scuro: [0.26, 0.21, 0.17] as [number, number, number] };
  const rndR = mulberry32(seme + 5);
  const pende = new Vector3((rndR() - 0.5) * 0.6, 0, (rndR() - 0.5) * 0.6);
  // branche dalla cima del fusto verso le masse basse
  const rami: Ramo[] = [];
  const cima = new Vector3(pende.x, hF, pende.z);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rndR() * 0.8;
    const fine = new Vector3(C.x + Math.cos(a) * S.x * 0.6, C.y - 0.5 + rndR() * 1.2, C.z + Math.sin(a) * S.x * 0.6);
    rami.push({ punti: torto(rndR, cima.clone().add(new Vector3(0, -0.4, 0)), fine, 5, 0.12), raggi: [rT * 0.62, rT * 0.48, rT * 0.36, rT * 0.24, rT * 0.12] });
  }
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    let masse: Massa[];
    if (lod === 0) masse = masseTonde(rnd, C, S, 5, 3, [2, 1, 1]);
    else if (lod === 1) masse = masseTonde(rnd, C, S, 5, 2, [1, 1, 0]);
    else if (lod === 2) masse = masseTonde(rnd, C, S, 3, 1, [0, 0, -1], 1.18);
    else masse = [{ c: C.clone().add(new Vector3(0, -0.3, 0)), r: S.clone().multiplyScalar(0.86), m: 0.5, det: 1 }];
    // (il nucleo sotto le carte: più piccolo, così le carte di foglie fanno la sagoma)
    const nucleo = lod <= 2 ? rimpicciolisci(masse, lod === 2 ? 0.9 : lod === 1 ? 0.51 : 0.35, lod === 0 ? 1 : 0) : masse;
    chioma.push(
      chiomaAMasse({
        masse: nucleo,
        centro: C,
        semiassi: S,
        bozzi: lod === 0 ? 0.2 : lod === 1 ? 0.16 : 0.12,
        sferiche: lod === 0 ? 0.58 : 0.66,
        seme: seme + lod * 101,
        fondo: 0.8,
        // (rifinitura 2: tronco lontano più grosso, da 1,1 a 1,7 volte: da 300-600 m deve leggersi
        // sotto la chioma, che altrimenti galleggia sul prato come un lecca-lecca)
        ...(lod === 3 ? { fusto: { raggio: rT * 1.7, altezza: hF + 2.4 } } : {}),
      }),
    );
    carte.push(
      // LOD 0: carte doppie e grandi il 60%: foglie da 15-20 cm, non girandole da un metro
      lod === 0
        ? carteChioma({ masse, centro: C, semiassi: S, n: 1240, lato: 0.63, seme: seme + 7, fondo: 0.8 })
        : lod === 1
          ? carteChioma({ masse, centro: C, semiassi: S, n: 190, lato: 2.1, seme: seme + 7, fondo: 0.8 })
          : lod === 2
            ? carteChioma({ masse, centro: C, semiassi: S, n: 28, lato: 4.4, seme: seme + 7, fondo: 0.8, minimo: 0.7 })
            : carteChioma({ masse: masseTonde(mulberry32(seme), C, S, 3, 1, [0, 0, -1], 1.18), centro: C, semiassi: S, n: 14, lato: 5.6, seme: seme + 7, fondo: 0.8, minimo: 0.72 }),
    );
    if (lod === 0) tr.push(tronco({ seme, raggio: rT, fusto: hF + 0.6, segmenti: 9, anelli: 6, lobi: 5, pende, rami, segRami: 6, ...bark, altezzaColore: H * 0.6 }));
    else if (lod === 1) tr.push(tronco({ seme, raggio: rT, fusto: hF + 0.6, segmenti: 6, anelli: 3, lobi: 3, pende, rami: rami.slice(0, 2).map((r) => ({ punti: [r.punti[0]!, r.punti[2]!, r.punti[4]!], raggi: [r.raggi[0]!, r.raggi[2]!, r.raggi[4]!] })), segRami: 4, ...bark, altezzaColore: H * 0.6 }));
    else if (lod === 2) tr.push(tronco({ seme, raggio: rT * 1.45, fusto: hF + 1.5, segmenti: 4, anelli: 2, lobi: 2, pende, rami: [], segRami: 3, ...bark, altezzaColore: H * 0.6 }));
    else tr.push(null);
  }
  return { chioma, carte, tronco: tr, forma: FORMA_FOGLIA.lanceolata, altezza: H, raggioTronco: rT, altezzaFusto: hF };
}

function noce(seme: number): GeometrieAlbero {
  const H = 13;
  const C = new Vector3(0, 7.6, 0);
  const S = new Vector3(6.0, 3.8, 6.0);
  const rT = 0.45;
  const hF = 3.4;
  const bark = { chiaro: [0.6, 0.57, 0.52] as [number, number, number], scuro: [0.33, 0.31, 0.29] as [number, number, number] };
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
  const carte: (BufferGeometry | null)[] = [];
  const tr: (BufferGeometry | null)[] = [];
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const rnd = mulberry32(seme);
    let masse: Massa[];
    if (lod === 0) masse = masseTonde(rnd, C, S, 4, 2, [2, 1, 1], 1.08);
    else if (lod === 1) masse = masseTonde(rnd, C, S, 4, 2, [1, 1, 0], 1.08);
    else if (lod === 2) masse = masseTonde(rnd, C, S, 3, 1, [0, 0, -1], 1.2);
    else masse = [{ c: C.clone().add(new Vector3(0, -0.3, 0)), r: S.clone().multiplyScalar(0.86), m: 0.5, det: 1 }];
    const nucleo = lod <= 2 ? rimpicciolisci(masse, lod === 2 ? 0.9 : lod === 1 ? 0.64 : 0.44, lod === 0 ? 1 : 0) : masse;
    chioma.push(chiomaAMasse({ masse: nucleo, centro: C, semiassi: S, bozzi: lod === 0 ? 0.18 : 0.12, sferiche: 0.64, seme: seme + lod * 101, fondo: 0.72, ...(lod === 3 ? { fusto: { raggio: rT * 1.8, altezza: hF + 2.4 } } : {}) }));
    carte.push(
      lod === 0
        ? carteChioma({ masse, centro: C, semiassi: S, n: 340, lato: 1.35, seme: seme + 7, fondo: 0.72 })
        : lod === 1
          ? carteChioma({ masse, centro: C, semiassi: S, n: 140, lato: 2.3, seme: seme + 7, fondo: 0.72 })
          : lod === 2
            ? carteChioma({ masse, centro: C, semiassi: S, n: 28, lato: 4.6, seme: seme + 7, fondo: 0.72, minimo: 0.7 })
            : carteChioma({ masse: masseTonde(mulberry32(seme), C, S, 3, 1, [0, 0, -1], 1.2), centro: C, semiassi: S, n: 14, lato: 5.8, seme: seme + 7, fondo: 0.72, minimo: 0.72 }),
    );
    if (lod <= 1) tr.push(tronco({ seme, raggio: rT, fusto: hF + 0.6, segmenti: lod === 0 ? 8 : 5, anelli: lod === 0 ? 5 : 3, lobi: 3, pende, rami: lod === 0 ? rami : [], segRami: 5, ...bark, altezzaColore: H * 0.6 }));
    else if (lod === 2) tr.push(tronco({ seme, raggio: rT * 1.4, fusto: hF + 1.5, segmenti: 4, anelli: 2, lobi: 2, pende, rami: [], segRami: 3, ...bark, altezzaColore: H * 0.6 }));
    else tr.push(null);
  }
  return { chioma, carte, tronco: tr, forma: FORMA_FOGLIA.tonda, altezza: H, raggioTronco: rT, altezzaFusto: hF };
}

function betulla(seme: number): GeometrieAlbero {
  const H = 13;
  const C = new Vector3(0, 8.6, 0);
  const S = new Vector3(2.6, 4.4, 2.6);
  const rT = 0.2;
  const hF = 9.5;
  const chioma: BufferGeometry[] = [];
  const carte: (BufferGeometry | null)[] = [];
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
      masse.push({ c: new Vector3(pende.x * (y / H) + Math.cos(a) * rr * 0.35, y, pende.z * (y / H) + Math.sin(a) * rr * 0.35), r: new Vector3(r, r * (n === 1 ? 2.4 : 1.05), r), m: rnd(), det: lod <= 1 ? 1 : 0 });
    }
    const nucleo = lod <= 2 ? rimpicciolisci(masse, lod === 2 ? 0.9 : lod === 1 ? 0.64 : 0.44, lod === 0 ? 1 : 0) : masse;
    chioma.push(chiomaAMasse({ masse: nucleo, centro: C, semiassi: S, bozzi: 0.2, sferiche: 0.55, seme: seme + lod * 101, fondo: 0.85, ...(lod === 3 ? { fusto: { raggio: rT * 2.0, altezza: hF * 0.85 } } : {}) }));
    carte.push(
      lod === 0
        ? carteChioma({ masse, centro: C, semiassi: S, n: 240, lato: 0.95, seme: seme + 7, fondo: 0.85 })
        : lod === 1
          ? carteChioma({ masse, centro: C, semiassi: S, n: 80, lato: 1.7, seme: seme + 7, fondo: 0.85 })
          : lod === 2
            ? carteChioma({ masse, centro: C, semiassi: S, n: 16, lato: 3.0, seme: seme + 7, fondo: 0.85, minimo: 0.7 })
            : carteChioma({ masse, centro: C, semiassi: S, n: 9, lato: 3.8, seme: seme + 7, fondo: 0.85, minimo: 0.6 }),
    );
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
  return { chioma, carte, tronco: tr, forma: FORMA_FOGLIA.tonda, altezza: H, raggioTronco: rT, altezzaFusto: 2.5 };
}

/** Masse equivalenti di una chioma a fuso (servono a disporre le carte; la geometria la fa chiomaFuso). */
function fuso(o: { det: number; base: number; altezza: number; raggio: number; prof: (t: number) => number; palchi: number; m: number }): Massa[] {
  const out: Massa[] = [];
  const n = Math.max(2, o.palchi);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    const r = o.raggio * o.prof(t);
    out.push({ c: new Vector3(0, o.base + t * o.altezza, 0), r: new Vector3(r, (o.altezza / n) * 0.75, r), m: (o.m + k * 0.37) % 1, det: o.det });
  }
  return out;
}

/**
 * Chioma «a fuso» (larice, cipresso): un icosaedro suddiviso stirato lungo l'asse con il profilo
 * `prof(t)` (t = 0 alla base, 1 in punta), con i bozzi dei rami a palchi.
 */
function chiomaFuso(o: { seme: number; det: number; base: number; altezza: number; raggio: number; prof: (t: number) => number; bozzi: number; palchi: number; pendenti?: boolean; C: Vector3; S: Vector3; fusto?: { raggio: number; altezza: number } }): BufferGeometry {
  const acc = new Accumulo();
  const rnd = mulberry32(o.seme);
  const g = sfera(o.det);
  const pos = g.getAttribute('position');
  const ns = new Vector3();
  const fase = rnd() * 6.28;
  for (let i = 0; i < pos.count; i++) {
    _d.fromBufferAttribute(pos, i).normalize();
    const t = (_d.y + 1) / 2;
    const ang = Math.atan2(_d.z, _d.x);
    const rad = Math.sqrt(Math.max(0, 1 - _d.y * _d.y));
    // palchi: il profilo si gonfia a ogni palco di rami; bozzi attorno
    // (pendenti: ogni palco è più largo in basso, come rami che ricadono)
    const palco = o.pendenti ? Math.pow(1 - (t * o.palchi - Math.floor(t * o.palchi)), 1.4) : Math.pow(Math.abs(Math.sin(t * o.palchi * Math.PI)), 0.6);
    const b = 1 + o.bozzi * (0.55 * palco + 0.45 * Math.sin(ang * 5 + fase + t * 9) * 0.5 - 0.3) + (rnd() - 0.5) * 0.06;
    // (vicino ai poli il raggio si chiude sull'asse: fondo piatto e punta)
    const r = o.raggio * o.prof(t) * b * Math.min(1, rad * 3);
    pos.setXYZ(i, Math.cos(ang) * r, o.base + t * o.altezza, Math.sin(ang) * r);
  }
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  const v = new Vector3();
  const nn = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    nn.fromBufferAttribute(n, i);
    ellissoide(o.C, o.S, v, ns);
    nn.lerp(ns, 0.5).normalize();
    n.setXYZ(i, nn.x, nn.y, nn.z);
  }
  acc.aggiungi(g, (p) => {
    const q = ellissoide(o.C, o.S, p, ns);
    const [occl, esterno] = occlusione(ns, q);
    return [occl, esterno, 0, Math.min(1, Math.max(0, 0.5 + Math.sin(p.y * 1.3 + fase) * 0.4 + (rnd() - 0.5) * 0.2))];
  });
  if (o.fusto) {
    const t = geoTubo([new Vector3(0, -0.4, 0), new Vector3(0, o.fusto.altezza, 0)], [o.fusto.raggio, o.fusto.raggio * 0.6], 4, {});
    acc.aggiungi(t, () => [0.85, 0, 1, 0]);
  }
  return acc.costruisci();
}

function larice(seme: number): GeometrieAlbero {
  const H = 16;
  const C = new Vector3(0, 8.5, 0);
  const S = new Vector3(3.6, 7.0, 3.6);
  const rT = 0.32;
  const chioma: BufferGeometry[] = [];
  const carte: (BufferGeometry | null)[] = [];
  const tr: (BufferGeometry | null)[] = [];
  // cono morbido: largo in basso, punta smussata (non un candelotto)
  const prof = (t: number) => Math.pow(Math.max(0, 1 - t * 0.88), 0.8) * (0.55 + 0.45 * Math.sin(Math.min(1, t * 4) * Math.PI * 0.5));
  const base = 2.6;
  const alt = H - base;
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const det = lod === 0 ? 3 : lod === 1 ? 2 : 1;
    // palchi pendenti: quattro livelli di rami che ricadono (gonne), fino in cima
    chioma.push(chiomaFuso({ seme: seme + lod * 101, det, base, altezza: alt, raggio: S.x * (lod === 0 ? 0.62 : lod === 1 ? 0.72 : lod === 2 ? 0.86 : 1), prof, bozzi: lod <= 1 ? 0.3 : 0.18, palchi: 4, pendenti: true, C, S, ...(lod === 3 ? { fusto: { raggio: rT * 1.9, altezza: base + 1.2 } } : {}) }));
    const masse = fuso({ det: 0, base, altezza: alt * 1.04, raggio: S.x, prof, palchi: 5, m: mulberry32(seme)() });
    carte.push(
      lod === 0
        ? carteChioma({ masse, centro: C, semiassi: S, n: 260, lato: 1.1, seme: seme + 7, fondo: 0.9, fuori: 0.92 })
        : lod === 1
          ? carteChioma({ masse, centro: C, semiassi: S, n: 90, lato: 1.9, seme: seme + 7, fondo: 0.9, fuori: 0.92 })
          : lod === 2
            ? carteChioma({ masse, centro: C, semiassi: S, n: 16, lato: 3.4, seme: seme + 7, fondo: 0.9, fuori: 0.92, minimo: 0.7 })
            : carteChioma({ masse, centro: C, semiassi: S, n: 10, lato: 4.2, seme: seme + 7, fondo: 0.9, fuori: 0.92, minimo: 0.6 }),
    );
    if (lod <= 2) tr.push(tronco({ seme, raggio: rT, fusto: H - 2, segmenti: lod === 0 ? 7 : 4, anelli: lod === 0 ? 5 : 2, lobi: 3, pende: new Vector3(), rami: [], segRami: 3, chiaro: [0.55, 0.4, 0.32], scuro: [0.3, 0.2, 0.16], altezzaColore: H }));
    else tr.push(null);
  }
  return { chioma, carte, tronco: tr, forma: FORMA_FOGLIA.aghi, altezza: H, raggioTronco: rT, altezzaFusto: 2.4 };
}

function cipresso(seme: number): GeometrieAlbero {
  const H = 15;
  const C = new Vector3(0, 7.6, 0);
  const S = new Vector3(1.3, 7.0, 1.3);
  const chioma: BufferGeometry[] = [];
  const carte: (BufferGeometry | null)[] = [];
  const tr: (BufferGeometry | null)[] = [];
  // fiamma: larga a un terzo, punta lunga e stretta, base stretta
  const prof = (t: number) => Math.pow(Math.sin(Math.min(1, Math.pow(t, 0.62) * 1.06) * Math.PI), 0.9) * (1 - 0.15 * t) + 0.04;
  const base = 0.9;
  const alt = H - base;
  for (let lod = 0; lod < N_LOD_ALBERI; lod++) {
    const det = lod === 0 ? 3 : lod === 1 ? 2 : 1;
    chioma.push(chiomaFuso({ seme: seme + lod * 101, det, base, altezza: alt, raggio: S.x, prof, bozzi: lod <= 1 ? 0.16 : 0.08, palchi: 9, C, S, ...(lod === 3 ? { fusto: { raggio: 0.3, altezza: base + 1 } } : {}) }));
    const masse = fuso({ det: 0, base, altezza: alt, raggio: S.x, prof, palchi: 9, m: 0.5 });
    carte.push(lod === 0 ? carteChioma({ masse, centro: C, semiassi: S, n: 46, lato: 0.9, seme: seme + 7, fondo: 0.95, fuori: 0.92, sferiche: 0.6 }) : null);
    if (lod <= 1) tr.push(tronco({ seme, raggio: 0.25, fusto: 2.0, segmenti: 5, anelli: 2, lobi: 2, pende: new Vector3(), rami: [], segRami: 3, chiaro: [0.45, 0.36, 0.28], scuro: [0.28, 0.22, 0.18], altezzaColore: 3 }));
    else tr.push(null);
  }
  return { chioma, carte, tronco: tr, forma: FORMA_FOGLIA.squame, altezza: H, raggioTronco: 0.25, altezzaFusto: 1.5 };
}

let cespuglio: { chioma: BufferGeometry; carte: BufferGeometry } | null = null;

/**
 * Cespuglio (nocciolo, rovo, ginestra): tre o quattro masse basse con le carte di foglie tonde.
 * Alto ~1.5 m, largo ~2 m (l'istanza lo scala). Le masse sono il nucleo scuro sotto le foglie.
 */
export function geometrieCespuglio(seme = 4242): { chioma: BufferGeometry; carte: BufferGeometry } {
  if (cespuglio) return cespuglio;
  const rnd = mulberry32(seme);
  const C = new Vector3(0, 0.75, 0);
  const S = new Vector3(1.05, 0.75, 1.05);
  const masse: Massa[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + rnd();
    const rr = k === 3 ? 0 : 0.45 + rnd() * 0.2;
    const r = 0.55 + rnd() * 0.15;
    masse.push({ c: new Vector3(Math.cos(a) * rr, 0.55 + (k === 3 ? 0.35 : rnd() * 0.15), Math.sin(a) * rr), r: new Vector3(r, r * 0.85, r), m: rnd(), det: 1 });
  }
  cespuglio = {
    chioma: chiomaAMasse({ masse: rimpicciolisci(masse, 0.6), centro: C, semiassi: S, bozzi: 0.18, sferiche: 0.6, seme, fondo: 0.5 }),
    carte: carteChioma({ masse, centro: C, semiassi: S, n: 150, lato: 0.5, seme: seme + 7, fondo: 0.5, minimo: 0.45 }),
  };
  return cespuglio;
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
