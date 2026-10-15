/**
 * Forme proprie del popolamento: mantelli che seguono il suolo (selciati, sentieri, prati
 * pettinati), lastre, pietre e piccoli oggetti costruiti con il Costruttore della libreria.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Vector3 } from 'three';
import { DEG } from '../../../src/world/constants';
import { cylToWorld } from '../../../src/world/cylinder';
import { groundHeight } from '../../../src/world/terrain';
import type { Cantiere, RGB } from './cantiere';
import { metriPerGrado, sposta } from './terreno';

/**
 * Mantello sul suolo: griglia polare (disco) o lungo una spezzata, a `sopra` metri dal suolo.
 * `colore(x, y)` riceve le coordinate locali (est, nord in metri dal centro) e restituisce rgb.
 */
export function discoSulSuolo(c: Cantiere, z0: number, th0: number, raggio: number, passo: number, sopra: number, colore: (x: number, y: number, r: number) => RGB, quota?: (z: number, th: number) => number): void {
  const anelli = Math.max(2, Math.ceil(raggio / passo));
  const settori = Math.max(16, Math.ceil((2 * Math.PI * raggio) / passo));
  const pos: number[] = [];
  const col: number[] = [];
  const q = quota ?? groundHeight;
  const h0 = q(z0, th0);
  const kdeg = metriPerGrado(h0);
  const v = new Vector3();
  const vertice = (x: number, y: number) => {
    const z = z0 + y;
    const th = th0 + x / kdeg;
    cylToWorld(z, th, q(z, th) + sopra, v);
    pos.push(v.x, v.y, v.z);
    const cc = colore(x, y, Math.hypot(x, y));
    col.push(cc[0], cc[1], cc[2], 0);
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
      // x = est, y = nord; ordine dei vertici per normale verso l'asse (su)
      vertice(p00[0]!, p00[1]!);
      vertice(p11[0]!, p11[1]!);
      vertice(p10[0]!, p10[1]!);
      if (i > 0) {
        vertice(p00[0]!, p00[1]!);
        vertice(p01[0]!, p01[1]!);
        vertice(p11[0]!, p11[1]!);
      }
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

/** Aggiunge triangoli già in coordinate mondo; le normali vengono calcolate e girate verso l'asse. */
function aggiungiMantello(c: Cantiere, pos: number[], col: number[]): void {
  const g = new BufferGeometry();
  const P = new Float32Array(pos);
  g.setAttribute('position', new BufferAttribute(P, 3));
  g.computeVertexNormals();
  // tutte le normali devono guardare verso l'asse (su locale = -(x, y) normalizzato)
  const N = g.getAttribute('normal') as BufferAttribute;
  for (let t = 0; t < P.length / 9; t++) {
    const cx = (P[t * 9]! + P[t * 9 + 3]! + P[t * 9 + 6]!) / 3;
    const cy = (P[t * 9 + 1]! + P[t * 9 + 4]! + P[t * 9 + 7]!) / 3;
    const nx = N.getX(t * 3);
    const ny = N.getY(t * 3);
    if (nx * -cx + ny * -cy < 0) {
      // inverte il triangolo
      for (let k = 0; k < 3; k++) {
        const tmp = P[t * 9 + 3 + k]!;
        P[t * 9 + 3 + k] = P[t * 9 + 6 + k]!;
        P[t * 9 + 6 + k] = tmp;
      }
      for (let k = 0; k < 2; k++) {
        const ia = t * 3 + 1;
        const ib = t * 3 + 2;
        const t4 = col.slice(ia * 4, ia * 4 + 4);
        col.splice(ia * 4, 4, ...col.slice(ib * 4, ib * 4 + 4));
        col.splice(ib * 4, 4, ...t4);
        break;
      }
    }
  }
  g.computeVertexNormals();
  // in coordinate mondo: la matrice è l'identità
  const colori: RGB[] = [];
  for (let i = 0; i < col.length; i += 4) colori.push([col[i]!, col[i + 1]!, col[i + 2]!]);
  c.forma(g, new Matrix4(), [1, 1, 1], 0, 'singolo', undefined);
  // sostituisce i colori dell'ultima parte con quelli per vertice
  const parte = c.singolo.parti[c.singolo.parti.length - 1]!;
  for (let i = 0; i < colori.length; i++) {
    parte.col[i * 4] = colori[i]![0];
    parte.col[i * 4 + 1] = colori[i]![1];
    parte.col[i * 4 + 2] = colori[i]![2];
    parte.col[i * 4 + 3] = col[i * 4 + 3]!;
  }
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
