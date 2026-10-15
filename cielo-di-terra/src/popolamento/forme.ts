/**
 * Forme proprie del popolamento: mantelli che seguono il suolo (selciati, sentieri, prati
 * pettinati), lastre, pietre e piccoli oggetti costruiti con il Costruttore della libreria.
 */
import { BoxGeometry, BufferAttribute as THREE_ATTR, BufferGeometry as THREE_BUFGEO, Matrix4 as THREE_MAT4, PlaneGeometry as THREE_PLANE, Vector3 } from 'three';
const THREE_GEOM = { BoxGeometry };
import { DEG } from '../world/constants';
import { cylToWorld } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import type { Cantiere, RGB } from './cantiere';
import { metriPerGrado, sposta } from './terreno';

/**
 * Mantello sul suolo: griglia polare (disco) o lungo una spezzata, a `sopra` metri dal suolo.
 * `colore(x, y)` riceve le coordinate locali (est, nord in metri dal centro) e restituisce rgb.
 */
export function discoSulSuolo(c: Cantiere, z0: number, th0: number, raggio: number, passo: number, sopra: number, colore: (x: number, y: number, r: number) => RGB, quota?: (z: number, th: number) => number, piatto = true): void {
  const anelli = Math.max(2, Math.ceil(raggio / passo));
  const settori = Math.max(16, Math.ceil((2 * Math.PI * raggio) / passo));
  const pos: number[] = [];
  const col: number[] = [];
  const q = quota ?? groundHeight;
  const h0 = q(z0, th0);
  const kdeg = metriPerGrado(h0);
  const v = new Vector3();
  let triCol: RGB | null = null;
  const vertice = (x: number, y: number) => {
    const z = z0 + y;
    const th = th0 + x / kdeg;
    cylToWorld(z, th, q(z, th) + sopra, v);
    pos.push(v.x, v.y, v.z);
    const cc = triCol ?? colore(x, y, Math.hypot(x, y));
    col.push(cc[0], cc[1], cc[2], 0);
  };
  const tri = (a: number[], b: number[], d: number[]) => {
    // colore piatto per triangolo (ciottoli netti): al baricentro
    triCol = piatto ? colore((a[0]! + b[0]! + d[0]!) / 3, (a[1]! + b[1]! + d[1]!) / 3, Math.hypot((a[0]! + b[0]! + d[0]!) / 3, (a[1]! + b[1]! + d[1]!) / 3)) : null;
    vertice(a[0]!, a[1]!);
    vertice(b[0]!, b[1]!);
    vertice(d[0]!, d[1]!);
    triCol = null;
  };
  for (let i = 0; i < anelli; i++) {
    const r0 = (i / anelli) * raggio;
    const r1 = ((i + 1) / anelli) * raggio;
    for (let s = 0; s < settori; s++) {
      const a0 = (s / settori) * Math.PI * 2;
      const a1 = ((s + 1) / settori) * Math.PI * 2;
      const p00 = [Math.cos(a0) * r0, Math.sin(a0) * r0];
      const p01 = [Math.cos(a1) * r0, Math.sin(a1) * r0];
      const p10 = [Math.cos(a0) * r1, Math.sin(a0) * r1];
      const p11 = [Math.cos(a1) * r1, Math.sin(a1) * r1];
      // x = est, y = nord (l'orientamento delle facce lo sistema aggiungiMantello)
      tri(p00, p11, p10);
      if (i > 0) tri(p00, p01, p11);
    }
  }
  aggiungiMantello(c, pos, col);
}

/**
 * Nastro sul suolo lungo una spezzata (sentieri, selciati stretti): larghezza `l`, segmenti ogni `passo` m.
 */
export function nastroSulSuolo(
  c: Cantiere,
  punti: Array<{ z: number; theta: number }>,
  larghezza: number,
  passo: number,
  sopra: number,
  colore: (s: number, u: number) => RGB,
  quota?: (z: number, th: number, s: number) => number,
): void {
  // ricampiona
  const camp: Array<{ z: number; theta: number; s: number; tz: number; te: number }> = [];
  let s = 0;
  const k = metriPerGrado(40);
  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i]!;
    const b = punti[i + 1]!;
    const dn = b.z - a.z;
    const de = (((b.theta - a.theta + 540) % 360) - 180) * k;
    const l = Math.hypot(dn, de);
    const n = Math.max(1, Math.ceil(l / passo));
    for (let j = 0; j < n || (i === punti.length - 2 && j === n); j++) {
      const t = j / n;
      const p = sposta(a.z, a.theta, dn * t, de * t, 40);
      camp.push({ ...p, s: s + l * t, tz: dn / l, te: de / l });
      if (j === n) break;
    }
    s += l;
  }
  const pos: number[] = [];
  const col: number[] = [];
  const v = new Vector3();
  const q = quota ?? ((z: number, th: number) => groundHeight(z, th));
  const vert = (p: { z: number; theta: number; s: number; tz: number; te: number }, u: number) => {
    // u in [-1, 1] sulla larghezza; destra = (te, -tz) in (nord, est)? destra di (nord=tz, est=te) è (nord=-te, est=tz)
    const off = (u * larghezza) / 2;
    const pp = sposta(p.z, p.theta, -p.te * off, p.tz * off, 40);
    cylToWorld(pp.z, pp.theta, q(pp.z, pp.theta, p.s) + sopra, v);
    pos.push(v.x, v.y, v.z);
    const cc = colore(p.s, u);
    col.push(cc[0], cc[1], cc[2], 0);
  };
  const U = [-1, -0.5, 0, 0.5, 1];
  for (let i = 0; i < camp.length - 1; i++) {
    const a = camp[i]!;
    const b = camp[i + 1]!;
    for (let j = 0; j < U.length - 1; j++) {
      const u0 = U[j]!;
      const u1 = U[j + 1]!;
      vert(a, u0);
      vert(b, u0);
      vert(b, u1);
      vert(a, u0);
      vert(b, u1);
      vert(a, u1);
    }
  }
  aggiungiMantello(c, pos, col);
}

/** Aggiunge triangoli già in coordinate mondo; ogni triangolo viene girato con la faccia verso l'asse. */
function aggiungiMantello(c: Cantiere, pos: number[], col: number[]): void {
  const n = pos.length / 3;
  const P = new Float32Array(pos);
  const C = new Float32Array(col);
  const N = new Float32Array(n * 3);
  const a = new Vector3();
  const b = new Vector3();
  const d = new Vector3();
  for (let t = 0; t < n / 3; t++) {
    const o = t * 9;
    a.set(P[o + 3]! - P[o]!, P[o + 4]! - P[o + 1]!, P[o + 5]! - P[o + 2]!);
    b.set(P[o + 6]! - P[o]!, P[o + 7]! - P[o + 1]!, P[o + 8]! - P[o + 2]!);
    d.crossVectors(a, b);
    const cx = (P[o]! + P[o + 3]! + P[o + 6]!) / 3;
    const cy = (P[o + 1]! + P[o + 4]! + P[o + 7]!) / 3;
    if (d.x * -cx + d.y * -cy < 0) {
      // scambia i vertici 1 e 2 (posizione e colore)
      for (let k = 0; k < 3; k++) {
        const tmp = P[o + 3 + k]!;
        P[o + 3 + k] = P[o + 6 + k]!;
        P[o + 6 + k] = tmp;
      }
      for (let k = 0; k < 4; k++) {
        const i1 = (t * 3 + 1) * 4 + k;
        const i2 = (t * 3 + 2) * 4 + k;
        const tmp = C[i1]!;
        C[i1] = C[i2]!;
        C[i2] = tmp;
      }
      d.negate();
    }
    d.normalize();
    for (let k = 0; k < 3; k++) N.set([d.x, d.y, d.z], o + k * 3);
  }
  c.grezzo(P, N, C, 'singolo');
}

/** Rumore di valore 2D deterministico (0..1). */
export function rumore2(x: number, y: number, seme = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7 + seme * 74.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy);
  const b = h(ix + 1, iy);
  const cc = h(ix, iy + 1);
  const d = h(ix + 1, iy + 1);
  return a + (b - a) * ux + (cc - a) * uy + (a - b - cc + d) * ux * uy;
}

/** Hash 2D (0..1). */
export function hash2(x: number, y: number, seme = 0): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seme * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

export const RAD = DEG;

/** Versione lontana di un rustico: scatola di gneiss, tetto a capanna di piode, due finestre accese. */
export function casaLontana(c: Cantiere, m: import('three').Matrix4, W: number, D: number, hMuri: number, interrata: number, seme = 0): void {
  const { BoxGeometry } = THREE_GEOM;
  const t = new THREE_MAT4();
  const box = new BoxGeometry(1, 1, 1);
  const pietra: RGB = [0.66 + hash2(seme, 1) * 0.08, 0.64 + hash2(seme, 2) * 0.06, 0.6 + hash2(seme, 3) * 0.06];
  t.makeTranslation(0, (hMuri - interrata) / 2, 0).scale(new Vector3(W, hMuri + interrata, D));
  c.forma(box, m.clone().multiply(t), pietra);
  const pend = 0.55;
  const hT = (W / 2 + 0.45) * Math.tan(pend);
  t.makeTranslation(0, hMuri - 0.02, 0).scale(new Vector3(W + 0.9, hT, D + 0.8));
  c.forma(timpanoUnitario(), m.clone().multiply(t), [0.3, 0.29, 0.31]);
  // finestre (accese di notte) sulle due facciate lunghe
  const q = new THREE_PLANE(0.7, 0.85);
  for (const s of [-1, 1]) {
    t.makeTranslation(s * (W / 2 + 0.02), Math.min(hMuri - 1.2, 3.2), 0).multiply(new THREE_MAT4().makeRotationY((s * Math.PI) / 2));
    c.forma(q, m.clone().multiply(t), [0.17, 0.155, 0.19], hash2(seme, s) < 0.6 ? 1 : 0);
  }
}

/** Nastro semplice di muro a secco (versione lontana): faccia e testa lungo la spezzata locale. */
export function muroLontano(c: Cantiere, m: import('three').Matrix4, percorso: Array<[number, number]>, altezza: number, spessore: number, seme = 0): void {
  const pos: number[] = [];
  const v = new Vector3();
  const push = (x: number, y: number, z: number) => {
    v.set(x, y, z).applyMatrix4(m);
    pos.push(v.x, v.y, v.z);
  };
  for (let i = 0; i < percorso.length - 1; i++) {
    const [ax, az] = percorso[i]!;
    const [bx, bz] = percorso[i + 1]!;
    const l = Math.hypot(bx - ax, bz - az) || 1;
    // normale della faccia (a destra del verso, convenzione della libreria): (-dz, dx)
    const nx = -(bz - az) / l;
    const nz = (bx - ax) / l;
    const y0 = -0.4;
    // faccia
    push(ax, y0, az);
    push(bx, y0, bz);
    push(bx, altezza, bz);
    push(ax, y0, az);
    push(bx, altezza, bz);
    push(ax, altezza, az);
    // testa
    push(ax, altezza, az);
    push(bx, altezza, bz);
    push(bx - nx * spessore, altezza, bz - nz * spessore);
    push(ax, altezza, az);
    push(bx - nx * spessore, altezza, bz - nz * spessore);
    push(ax - nx * spessore, altezza, az - nz * spessore);
  }
  const g = new THREE_BUFGEO();
  g.setAttribute('position', new THREE_ATTR(new Float32Array(pos), 3));
  g.computeVertexNormals();
  const k = 0.92 + hash2(seme, 7) * 0.12;
  c.forma(g, new THREE_MAT4(), [0.55 * k, 0.53 * k, 0.52 * k], 0, 'doppio');
}

function timpanoUnitario(): import('three').BufferGeometry {
  // prisma: base 1x1 (x, z in [-0.5, 0.5]), colmo alto 1 lungo z
  const A = [-0.5, 0, -0.5], B = [-0.5, 0, 0.5], E = [0.5, 0, -0.5], F = [0.5, 0, 0.5], C = [0, 1, 0.5], D = [0, 1, -0.5];
  const p = [...A, ...B, ...C, ...A, ...C, ...D, ...E, ...D, ...C, ...E, ...C, ...F, ...B, ...F, ...C, ...A, ...D, ...E];
  const g = new THREE_BUFGEO();
  g.setAttribute('position', new THREE_ATTR(new Float32Array(p), 3));
  g.computeVertexNormals();
  return g;
}
