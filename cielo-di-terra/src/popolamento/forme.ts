/**
 * Forme proprie del popolamento: mantelli che seguono il suolo (selciati, sentieri, prati
 * pettinati), lastre, pietre e piccoli oggetti costruiti con il Costruttore della libreria.
 */
import { BoxGeometry, BufferAttribute as THREE_ATTR, BufferGeometry as THREE_BUFGEO, IcosahedronGeometry as IcoGeo, Matrix4 as THREE_MAT4, PlaneGeometry as THREE_PLANE, Vector3 } from 'three';
const THREE_GEOM = { BoxGeometry };
import { SUPERFICIE } from '../render/superfici';
import { DEG } from '../world/constants';
import { cylToWorld } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import type { Cantiere, RGB } from './cantiere';
import { metriPerGrado, sposta } from './terreno';

/**
 * Mantello sul suolo: griglia polare (disco) o lungo una spezzata, a `sopra` metri dal suolo.
 * `colore(x, y)` riceve le coordinate locali (est, nord in metri dal centro) e restituisce rgb.
 */
export function discoSulSuolo(c: Cantiere, z0: number, th0: number, raggio: number, passo: number, sopra: number, colore: (x: number, y: number, r: number) => RGB, quota?: (z: number, th: number) => number, piatto = true, opz: OpzioniMantello = {}): void {
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
  aggiungiMantello(c, pos, col, opz);
}

/** Opzioni dei mantelli sul suolo. */
export interface OpzioniMantello {
  /** superficie dipinta (valore di `SUPERFICIE` + variante; 0 = quella del materiale) */
  superficie?: number;
  /** occlusione cotta (0..1) */
  occlusione?: number;
  /**
   * normali morbide (media delle facce che toccano il vertice; predefinito sì): i motivi dipinti
   * (pietre, ciottoli, terra) restano continui da un triangolo all'altro, senza tessere
   */
  normaliLisce?: boolean;
}

/**
 * Nastro sul suolo lungo una spezzata (sentieri, selciati stretti): larghezza `l`, segmenti ogni `passo` m.
 */
/**
 * Corona sul suolo (fra `r0` e `r1`): come `discoSulSuolo`, ma la superficie dipinta e il colore si
 * scelgono per triangolo (al baricentro), così le zone diverse (selciato, terra battuta, prato
 * calpestato) non si mescolano dentro un triangolo. `zona(x, y, r)` restituisce
 * `[superficie, colore]` oppure null (niente triangolo: si vede il suolo).
 */
export function coronaSulSuolo(
  c: Cantiere,
  z0: number,
  th0: number,
  r0: number,
  r1: number,
  passo: number,
  sopra: number,
  zona: (x: number, y: number, r: number) => [number, RGB] | null,
  occlusione: (x: number, y: number, r: number) => number = () => 0,
  /**
   * colore per vertice (rifinitura 2, facoltativo): se c'è, il colore non è più piatto per triangolo
   * ma sfuma da un vertice all'altro, così i bordi fra le zone (terra battuta e prato) non fanno più
   * il dente di sega dei triangoli; la superficie dipinta resta quella della zona del triangolo
   */
  coloreVertice?: (x: number, y: number, r: number) => RGB,
): void {
  const anelli = Math.max(1, Math.ceil((r1 - r0) / passo));
  const settori = Math.max(24, Math.ceil((2 * Math.PI * r1) / passo));
  const pos: number[] = [];
  const col: number[] = [];
  const sup: number[] = [];
  const h0 = groundHeight(z0, th0);
  const kdeg = metriPerGrado(h0);
  const v = new Vector3();
  const vertice = (x: number, y: number, cc: RGB, s: number) => {
    const z = z0 + y;
    const th = th0 + x / kdeg;
    cylToWorld(z, th, groundHeight(z, th) + sopra, v);
    pos.push(v.x, v.y, v.z);
    col.push(cc[0], cc[1], cc[2], 0);
    const r = Math.hypot(x, y);
    sup.push(s, occlusione(x, y, r));
  };
  const tri = (a: number[], b: number[], d: number[]) => {
    const cx = (a[0]! + b[0]! + d[0]!) / 3;
    const cy = (a[1]! + b[1]! + d[1]!) / 3;
    const z = zona(cx, cy, Math.hypot(cx, cy));
    if (!z) return;
    const cv = coloreVertice;
    vertice(a[0]!, a[1]!, cv ? cv(a[0]!, a[1]!, Math.hypot(a[0]!, a[1]!)) : z[1], z[0]);
    vertice(b[0]!, b[1]!, cv ? cv(b[0]!, b[1]!, Math.hypot(b[0]!, b[1]!)) : z[1], z[0]);
    vertice(d[0]!, d[1]!, cv ? cv(d[0]!, d[1]!, Math.hypot(d[0]!, d[1]!)) : z[1], z[0]);
  };
  for (let i = 0; i < anelli; i++) {
    const ra = r0 + ((r1 - r0) * i) / anelli;
    const rb = r0 + ((r1 - r0) * (i + 1)) / anelli;
    for (let s2 = 0; s2 < settori; s2++) {
      const a0 = (s2 / settori) * Math.PI * 2;
      const a1 = ((s2 + 1) / settori) * Math.PI * 2;
      const p00 = [Math.cos(a0) * ra, Math.sin(a0) * ra];
      const p01 = [Math.cos(a1) * ra, Math.sin(a1) * ra];
      const p10 = [Math.cos(a0) * rb, Math.sin(a0) * rb];
      const p11 = [Math.cos(a1) * rb, Math.sin(a1) * rb];
      tri(p00, p11, p10);
      tri(p00, p01, p11);
    }
  }
  if (!pos.length) return;
  // orienta e calcola le normali come il mantello (poi rimette la superficie per vertice)
  const n = pos.length / 3;
  const P = new Float32Array(pos);
  const C = new Float32Array(col);
  const S = new Float32Array(sup);
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
      for (let k = 0; k < 3; k++) {
        const tmp = P[o + 3 + k]!;
        P[o + 3 + k] = P[o + 6 + k]!;
        P[o + 6 + k] = tmp;
      }
      for (let k = 0; k < 2; k++) {
        const i1 = (t * 3 + 1) * 2 + k;
        const i2 = (t * 3 + 2) * 2 + k;
        const tmp = S[i1]!;
        S[i1] = S[i2]!;
        S[i2] = tmp;
      }
      for (let k = 0; k < 4; k++) {
        const i1 = (t * 3 + 1) * 4 + k;
        const i2 = (t * 3 + 2) * 4 + k;
        const tmp = C[i1]!;
        C[i1] = C[i2]!;
        C[i2] = tmp;
      }
    }
  }
  // normali morbide (media delle facce che toccano il vertice): seguono i gradoni del suolo, e i
  // motivi restano continui da un triangolo all'altro
  const somma = new Map<string, [number, number, number]>();
  const chiave = (i: number) => `${Math.round(P[i * 3]! * 200)},${Math.round(P[i * 3 + 1]! * 200)},${Math.round(P[i * 3 + 2]! * 200)}`;
  for (let t = 0; t < n / 3; t++) {
    const o = t * 9;
    a.set(P[o + 3]! - P[o]!, P[o + 4]! - P[o + 1]!, P[o + 5]! - P[o + 2]!);
    b.set(P[o + 6]! - P[o]!, P[o + 7]! - P[o + 1]!, P[o + 8]! - P[o + 2]!);
    d.crossVectors(a, b).normalize();
    for (let k = 0; k < 3; k++) {
      const key = chiave(t * 3 + k);
      const v2 = somma.get(key) ?? [0, 0, 0];
      v2[0] += d.x;
      v2[1] += d.y;
      v2[2] += d.z;
      somma.set(key, v2);
    }
  }
  for (let i = 0; i < n; i++) {
    const v2 = somma.get(chiave(i))!;
    const l = Math.hypot(v2[0], v2[1], v2[2]) || 1;
    N[i * 3] = v2[0] / l;
    N[i * 3 + 1] = v2[1] / l;
    N[i * 3 + 2] = v2[2] / l;
  }
  c.grezzo(P, N, C, 'singolo', S);
}

export function nastroSulSuolo(
  c: Cantiere,
  punti: Array<{ z: number; theta: number }>,
  larghezza: number,
  passo: number,
  sopra: number,
  colore: (s: number, u: number) => RGB,
  quota?: (z: number, th: number, s: number) => number,
  opz: OpzioniMantello = {},
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
  aggiungiMantello(c, pos, col, opz);
}

/** Aggiunge triangoli già in coordinate mondo; ogni triangolo viene girato con la faccia verso l'asse. */
function aggiungiMantello(c: Cantiere, pos: number[], col: number[], opz: OpzioniMantello = {}): void {
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
  if (opz.normaliLisce ?? true) {
    // media delle normali delle facce che condividono il vertice (chiave: posizione al millimetro)
    const somma = new Map<string, [number, number, number]>();
    const chiave = (i: number) => `${Math.round(P[i * 3]! * 1000)},${Math.round(P[i * 3 + 1]! * 1000)},${Math.round(P[i * 3 + 2]! * 1000)}`;
    for (let i = 0; i < n; i++) {
      const k = chiave(i);
      const v = somma.get(k) ?? [0, 0, 0];
      v[0] += N[i * 3]!;
      v[1] += N[i * 3 + 1]!;
      v[2] += N[i * 3 + 2]!;
      somma.set(k, v);
    }
    for (let i = 0; i < n; i++) {
      const v = somma.get(chiave(i))!;
      const l = Math.hypot(v[0], v[1], v[2]) || 1;
      N[i * 3] = v[0] / l;
      N[i * 3 + 1] = v[1] / l;
      N[i * 3 + 2] = v[2] / l;
    }
  }
  let S: Float32Array | undefined;
  if (opz.superficie !== undefined || opz.occlusione !== undefined) {
    S = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      S[i * 2] = opz.superficie ?? 0;
      S[i * 2 + 1] = opz.occlusione ?? 0;
    }
  }
  c.grezzo(P, N, C, 'singolo', S);
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


/**
 * Versione lontana di un rustico (oltre 350 m ad Alta, 310 a Media, 260 a Bassa: vedi
 * `distanzaLodPerQualita`). Rifinitura 1: dal Velo e dalle terrazze le case lontane erano cubetti grigio-blu col tetto liscio («Monopoli»); ora
 * hanno, con circa 200 triangoli:
 * - il tetto di piode grigio-bruno caldo che sporge 0,4 m (gronde e timpani) con l'ombra di gronda
 *   sul muro, tre file di lastre a contrasto forte (alternate chiare e scure, una riga scura sotto
 *   ogni fila) e licheni ocra su una fila ogni tanto;
 * - due finestrelle scure per facciata (accese di notte come quelle vicine) e la porta;
 * - il camino con la lastra sopra.
 */
export function casaLontana(c: Cantiere, m: import('three').Matrix4, W: number, D: number, hMuri: number, interrata: number, seme = 0, proprietario?: string, portaU = 0): void {
  const { BoxGeometry } = THREE_GEOM;
  const t = new THREE_MAT4();
  const box = new BoxGeometry(1, 1, 1);
  const q = new THREE_MAT4();
  const v3 = new Vector3();
  /** scatola centrata in (x, y, z) locali, ruotata di `rz` attorno a Z */
  const scatola = (x: number, y: number, z: number, sx: number, sy: number, sz: number, colore: RGB, sup: readonly [number, number], rz = 0) => {
    t.makeTranslation(x, y, z);
    if (rz) t.multiply(q.makeRotationZ(rz));
    t.scale(v3.set(sx, sy, sz));
    c.forma(box, m.clone().multiply(t), colore, 0, 'singolo', undefined, sup);
  };
  // lo stesso gneiss chiaro e caldo delle case vicine
  const pietra: RGB = [0.72 + hash2(seme, 1) * 0.06, 0.68 + hash2(seme, 2) * 0.05, 0.61 + hash2(seme, 3) * 0.05];
  const supPietra = [SUPERFICIE.PIETRA + hash2(seme, 5) * 0.9, 0.05] as const;
  t.makeTranslation(0, (hMuri - interrata) / 2, 0).scale(new Vector3(W, hMuri + interrata, D));
  // muri di pietra, più scuri al piede (stesso motivo dipinto della casa vicina)
  c.forma(
    box,
    m.clone().multiply(t),
    pietra,
    0,
    'singolo',
    (p, out) => {
      const k = p.y < -0.3 ? 0.72 : 1;
      out[0] *= k;
      out[1] *= k;
      out[2] *= k;
    },
    supPietra,
  );
  // ombra di gronda: una fascia scura appena fuori dal muro, sotto lo sporto
  const ombra: RGB = [pietra[0] * 0.5, pietra[1] * 0.48, pietra[2] * 0.47];
  scatola(0, hMuri - 0.22, 0, W + 0.03, 0.44, D + 0.03, ombra, [SUPERFICIE.PIETRA + 0.3, 0.45]);
  // timpani di pietra fin sotto il colmo
  const pend = 0.52;
  const hT = (W / 2) * Math.tan(pend);
  t.makeTranslation(0, hMuri - 0.01, 0).scale(new Vector3(W, hT, D));
  c.forma(timpanoUnitario(), m.clone().multiply(t), pietra, 0, 'singolo', undefined, supPietra);
  // tetto: due falde che sporgono 0,6 m (rifinitura 2: prima 0,4), ognuna in tre file di lastre a
  // gradino, con lo spessore chiaro della lastra di gronda che si legge da lontano
  const sp = 0.6;
  const sT = 0.35;
  const L = (W / 2 + sp) / Math.cos(pend);
  const dT = D + 2 * sT;
  const yColmo = hMuri + hT + 0.04;
  const giunti: RGB = [0.227, 0.2, 0.176];
  const lichene: RGB = [0.604, 0.541, 0.353];
  const base: RGB = [0.424 + hash2(seme, 6) * 0.04, 0.384 + hash2(seme, 6) * 0.035, 0.345 + hash2(seme, 7) * 0.03];
  const chiara = mixRGB(base, [0.62, 0.58, 0.52], 0.42);
  const scura = mixRGB(base, giunti, 0.38);
  for (const s of [1, -1]) {
    const dx = s * Math.cos(pend);
    const dy = -Math.sin(pend);
    const nx = s * Math.sin(pend);
    const ny = Math.cos(pend);
    const rz = -s * pend;
    for (let k = 0; k < 3; k++) {
      // la fila più alta sta sopra quella sotto (il bordo basso fa il gradino con la sua ombra)
      const a = (L * (k + 0.5)) / 3;
      const lungo = L / 3 + 0.12;
      const sopra = 0.08 + (2 - k) * 0.045;
      let col = k % 2 === 0 ? chiara : scura;
      if (hash2(seme * 3 + k, s, 12) < 0.15) col = mixRGB(col, lichene, 0.45);
      scatola(dx * a + nx * sopra, yColmo + dy * a + ny * sopra, 0, lungo, 0.1, dT, col, [SUPERFICIE.PIODE + hash2(seme, 8 + k) * 0.9, 0.06], rz);
      // la riga scura sotto il bordo della fila (sulla fila sotto)
      if (k < 2) {
        const b = (L * (k + 1)) / 3 + 0.08;
        scatola(dx * b + nx * (sopra - 0.02), yColmo + dy * b + ny * (sopra - 0.02), 0, 0.2, 0.1, dT + 0.01, giunti, [SUPERFICIE.PIODE + 0.5, 0.4], rz);
      }
    }
  }
  // lo spessore del tetto (0,15 m), chiaro, lungo le gronde e sui timpani
  const bordo: RGB = mixRGB(chiara, [0.78, 0.74, 0.67], 0.45);
  for (const s of [1, -1]) {
    const dx = s * Math.cos(pend);
    const dy = -Math.sin(pend);
    const nx = s * Math.sin(pend);
    const ny = Math.cos(pend);
    const rz = -s * pend;
    // gronda: la testa della lastra in fondo alla falda
    scatola(dx * (L - 0.03) + nx * 0.06, yColmo + dy * (L - 0.03) + ny * 0.06, 0, 0.08, 0.15, dT + 0.02, bordo, [SUPERFICIE.PIODE + 0.6, 0.02], rz);
    // timpani: il bordo della falda davanti e dietro
    for (const zz of [dT / 2, -dT / 2]) scatola(dx * (L / 2) + nx * 0.06, yColmo + dy * (L / 2) + ny * 0.06, zz, L, 0.15, 0.08, bordo, [SUPERFICIE.PIODE + 0.6, 0.02], rz);
  }
  // lastre di colmo, più chiare
  scatola(0, yColmo + 0.22, 0, 0.42, 0.09, dT + 0.02, mixRGB(chiara, [0.7, 0.66, 0.6], 0.3), [SUPERFICIE.PIODE + 0.2, 0.05]);
  // camino di pietra con la lastra
  const lato = hash2(seme, 13) < 0.5 ? -1 : 1;
  const xc = lato * W * 0.24;
  const zc = -D * 0.25;
  const yTetto = yColmo - Math.abs(xc) * Math.tan(pend);
  scatola(xc, yTetto + 0.35, zc, 0.5, 1.3, 0.5, mixRGB(pietra, [0.5, 0.47, 0.44], 0.25), supPietra);
  scatola(xc, yTetto + 1.05, zc, 0.72, 0.08, 0.72, scura, [SUPERFICIE.PIODE + 0.4, 0.1]);
  // finestrelle (accese di notte come quelle vicine): due per facciata, la porta sul fronte.
  // Rifinitura 2: da lontano erano buchi neri; ora hanno la cornice di calce chiara (#d8cfc0, 8 cm) e
  // le persiane aperte, verde salvia (#5a6b48) o noce (#7a4a30), una tinta per casa
  const finestra = new THREE_PLANE(0.55, 0.72);
  const cornice = new THREE_PLANE(0.55 + 0.16, 0.72 + 0.16);
  const anta = new THREE_PLANE(0.3, 0.76);
  const vetro: RGB = [0.17, 0.155, 0.19];
  const calce: RGB = [0.847, 0.812, 0.753];
  const persiane: RGB = hash2(seme, 31) < 0.55 ? [0.353, 0.42, 0.282] : [0.478, 0.29, 0.188];
  const yF = Math.min(hMuri - 1.15, 3.35);
  const accesa = (k: number) => (hash2(seme, 20 + k) < 0.7 ? 1 : 0);
  /** una finestra sulla facciata: `f` = matrice della facciata (z fuori dal muro) */
  const conCornice = (f: import('three').Matrix4, k: number) => {
    c.forma(cornice, m.clone().multiply(f).multiply(q.makeTranslation(0, 0, 0.005)), calce, 0, 'singolo', undefined, [SUPERFICIE.INTONACO + 0.3, 0]);
    c.forma(finestra, m.clone().multiply(f).multiply(q.makeTranslation(0, 0, 0.012)), vetro, accesa(k), 'singolo', undefined, [SUPERFICIE.VETRO, 0]);
    for (const sx of [-1, 1]) c.forma(anta, m.clone().multiply(f).multiply(q.makeTranslation(sx * (0.36 + 0.15), 0, 0.01)), persiane, 0, 'singolo', undefined, [SUPERFICIE.LEGNO + 0.2, 0.05]);
  };
  const ff = new THREE_MAT4();
  for (const s of [-1, 1]) {
    for (const u of [-D * 0.22, D * 0.22]) {
      ff.makeTranslation(s * (W / 2 + 0.02), yF, u).multiply(new THREE_MAT4().makeRotationY((s * Math.PI) / 2));
      conCornice(ff, s * 3 + u);
    }
  }
  for (const u of [-W * 0.24, W * 0.24]) {
    ff.makeTranslation(u, yF, D / 2 + 0.02);
    conCornice(ff, u);
  }
  ff.makeTranslation(0, yF, -D / 2 - 0.02).multiply(new THREE_MAT4().makeRotationY(Math.PI));
  conCornice(ff, 7);
  // la porta (migliorie «porte»): dove sta quella vera (`portaU`), una lastra scura che sporge 10 cm.
  // Prima era un piano a 2 cm dal muro, sempre al centro del fronte: al cambio di dettaglio la porta
  // saltava di un metro e mezzo, e oltre i 300 m sfarfallava con il muro
  t.makeTranslation(portaU, 0.95, D / 2 + 0.05).scale(new Vector3(0.95, 1.9, 0.1));
  c.forma(box, m.clone().multiply(t), [0.36, 0.24, 0.16], 0, 'singolo', undefined, [SUPERFICIE.LEGNO, 0.2]);
  if (proprietario) c.segnaPorta(m, proprietario, 'lontano', portaU, 0, 0.95, 1.9, D / 2, 0.1);
}

/**
 * Versione lontana di un annesso (rifinitura 2): il corpo di pietra, la falda unica di piode che
 * scende verso il davanti (alta `hB` dietro, `hF` davanti) col suo bordo chiaro, la porta scura.
 */
export function annessoLontano(c: Cantiere, m: import('three').Matrix4, W: number, D: number, hF: number, hB: number, interrata: number, seme = 0, proprietario?: string, portaU: number | null = 0): void {
  const { BoxGeometry } = THREE_GEOM;
  const box = new BoxGeometry(1, 1, 1);
  const t = new THREE_MAT4();
  const q = new THREE_MAT4();
  const pietra: RGB = [0.7 + hash2(seme, 1) * 0.06, 0.66 + hash2(seme, 2) * 0.05, 0.59 + hash2(seme, 3) * 0.05];
  const supPietra = [SUPERFICIE.PIETRA + hash2(seme, 5) * 0.9, 0.05] as const;
  t.makeTranslation(0, (hF - interrata) / 2, 0).scale(new Vector3(W, hF + interrata, D));
  c.forma(box, m.clone().multiply(t), pietra, 0, 'singolo', (p, out) => {
    const k = p.y < -0.3 ? 0.72 : 1;
    out[0] *= k;
    out[1] *= k;
    out[2] *= k;
  }, supPietra);
  // i fianchi a trapezio sopra la gronda davanti: un cuneo
  const cuneo = new THREE_BUFGEO();
  const a = hB - hF;
  const P = [
    // fianchi (x = ±W/2): triangolo (z = D/2, y = 0) → (z = −D/2, y = 0) → (z = −D/2, y = a)
    W / 2, 0, D / 2, W / 2, 0, -D / 2, W / 2, a, -D / 2,
    -W / 2, 0, D / 2, -W / 2, a, -D / 2, -W / 2, 0, -D / 2,
    // dietro
    -W / 2, 0, -D / 2, -W / 2, a, -D / 2, W / 2, a, -D / 2,
    -W / 2, 0, -D / 2, W / 2, a, -D / 2, W / 2, 0, -D / 2,
  ];
  cuneo.setAttribute('position', new THREE_ATTR(new Float32Array(P), 3));
  cuneo.computeVertexNormals();
  t.makeTranslation(0, hF, 0);
  c.forma(cuneo, m.clone().multiply(t), pietra, 0, 'singolo', undefined, supPietra);
  // la falda: una lastra inclinata che sporge 0,4 m davanti e 0,2 sui fianchi
  const pend = Math.atan2(a, D);
  const lungo = Math.hypot(a, D) + 0.45;
  const tetto: RGB = [0.46 + hash2(seme, 6) * 0.05, 0.43 + hash2(seme, 7) * 0.04, 0.38];
  t.makeTranslation(0, hF + a / 2 + 0.06, 0.2).multiply(q.makeRotationX(pend)).scale(new Vector3(W + 0.4, 0.14, lungo));
  c.forma(box, m.clone().multiply(t), tetto, 0, 'singolo', undefined, [SUPERFICIE.PIODE + hash2(seme, 8) * 0.9, 0.06]);
  // la porta
  // la porta, dove sta quella vera (le legnaie non ne hanno: `portaU` null), sporgente come nelle case
  if (portaU !== null) {
    t.makeTranslation(portaU, 0.9, D / 2 + 0.05).scale(new Vector3(1.0, 1.8, 0.1));
    c.forma(box, m.clone().multiply(t), [0.33, 0.22, 0.15], 0, 'singolo', undefined, [SUPERFICIE.LEGNO, 0.2]);
    if (proprietario) c.segnaPorta(m, proprietario, 'lontano', portaU, 0, 1.0, 1.8, D / 2, 0.1);
  }
}

/**
 * Versione lontana di un albero da frutto (rifinitura 2): il tronco e la chioma tonda, verde oliva
 * che ingiallisce (`yChioma` = quota del centro della chioma, `r` = raggio).
 */
export function alberoLontano(c: Cantiere, m: import('three').Matrix4, yChioma: number, r: number, seme = 0): void {
  const { BoxGeometry } = THREE_GEOM;
  const t = new THREE_MAT4();
  t.makeTranslation(0, yChioma * 0.35, 0).scale(new Vector3(0.25, yChioma * 0.7, 0.25));
  c.forma(new BoxGeometry(1, 1, 1), m.clone().multiply(t), [0.36, 0.29, 0.22], 0, 'singolo', undefined, [SUPERFICIE.CORTECCIA, 0.1]);
  const chioma = new IcoGeo(1, 1);
  t.makeTranslation(0, yChioma, 0).scale(new Vector3(r, r * 0.85, r));
  const k = hash2(seme, 9);
  const col: RGB = [0.42 + k * 0.18, 0.5 + k * 0.08, 0.24];
  c.forma(chioma, m.clone().multiply(t), col, 0, 'singolo', (p, out) => {
    const l = 0.75 + Math.max(0, p.y) * 0.3;
    out[0] *= l;
    out[1] *= l;
    out[2] *= l;
  }, [SUPERFICIE.FOGLIAME, 0.1]);
}

function mixRGB(a: RGB, b: RGB, k: number): RGB {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
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
