/**
 * Geometrie del sottobosco (traccia «natura»): ciuffi d'erba, felci, fiori, sassi con il muschio,
 * foglie cadute e ricci di castagne. Unità: metri, +Y = su, base in (0, 0, 0); l'istanza le scala
 * e le gira. Tutte con l'attributo `aColor` (vec4) dei materiali della vegetazione:
 * - erba, felci, fiori: rgb = moltiplicatore o colore (base scura, punta chiara), a = quanto il
 *   punto si piega nel vento (0 alla base, 1 in punta);
 * - sassi, foglie, ricci: rgb = colore, a = 0 (rigidi).
 * Triangoli: ciuffo 48, felce ~100, fiore 9, sasso 80, foglie 24, ricci ~150.
 */
import { BufferAttribute, BufferGeometry, IcosahedronGeometry, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../world/noise';

/** Accumulo di triangoli non indicizzati con normale e colore per vertice. */
class Tri {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  private readonly _a = new Vector3();
  private readonly _b = new Vector3();

  /** Triangolo con la normale della faccia (o quella data) e i colori dei tre vertici. */
  add(a: Vector3, b: Vector3, c: Vector3, ca: number[], cb: number[], cc: number[], n?: Vector3): void {
    const nn = n ?? this._a.subVectors(b, a).cross(this._b.subVectors(c, a)).normalize();
    for (const [p, col] of [
      [a, ca],
      [b, cb],
      [c, cc],
    ] as const) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(nn.x, nn.y, nn.z);
      this.col.push(col[0]!, col[1]!, col[2]!, col[3]!);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.col), 4));
    g.computeBoundingSphere();
    return g;
  }
}

const v3 = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * Ciuffo d'erba: `lame` fili che nascono da un cespo largo ~0.35 (alto 1: l'istanza dà l'altezza
 * vera), quasi diritti e curvi in punta, più scuri alla base. Il colore lo dà l'istanza (il prato
 * sotto); il vertice porta il chiaroscuro del filo (rgb) e quanto si piega nel vento (a).
 */
export function geoCiuffoErba(seme: number, lame = 16): BufferGeometry {
  const t = new Tri();
  const rnd = mulberry32(seme);
  for (let i = 0; i < lame; i++) {
    const a = rnd() * Math.PI * 2;
    const d = v3(Math.cos(a), 0, Math.sin(a));
    const lat = v3(-d.z, 0, d.x);
    const h = 0.55 + rnd() * 0.45;
    // fili quasi diritti: si aprono poco e si piegano in punta
    const piega = 0.08 + rnd() * 0.3;
    const w = 0.011 + rnd() * 0.009;
    const r0 = Math.sqrt(rnd()) * 0.17;
    const base = v3(Math.cos(a + 1.3) * r0, 0, Math.sin(a + 1.3) * r0);
    const mid = base.clone().addScaledVector(d, piega * 0.22 * h).add(v3(0, h * 0.58, 0));
    const tip = base.clone().addScaledVector(d, piega * h).add(v3(0, h * (1 - piega * 0.3), 0));
    const n = lat.clone().cross(mid.clone().sub(base)).normalize();
    const c0 = [0.8, 0.8, 0.8, 0];
    const c1 = [0.95, 0.95, 0.95, mid.y];
    const c2 = [1.1, 1.1, 1.1, tip.y];
    const bl = base.clone().addScaledVector(lat, -w);
    const br = base.clone().addScaledVector(lat, w);
    const ml = mid.clone().addScaledVector(lat, -w * 0.75);
    const mr = mid.clone().addScaledVector(lat, w * 0.75);
    t.add(bl, br, mr, c0, c0, c1, n);
    t.add(bl, mr, ml, c0, c1, c1, n);
    t.add(ml, mr, tip, c1, c1, c2, n);
  }
  return t.build();
}

/**
 * Felce: `fronde` fronde arcuate con le pinne a triangolo (la fronda è più larga a un terzo e si
 * stringe in punta). Alta ~0.7, larga ~1.4. Colore: moltiplicatore (l'istanza dà il ruggine
 * d'ottobre o il verde).
 */
export function geoFelce(seme: number, fronde = 6): BufferGeometry {
  const t = new Tri();
  const rnd = mulberry32(seme);
  const P = 9;
  for (let f = 0; f < fronde; f++) {
    const a = (f / fronde) * Math.PI * 2 + rnd() * 0.5;
    const d = v3(Math.cos(a), 0, Math.sin(a));
    const lat = v3(-d.z, 0, d.x);
    const len = 0.55 + rnd() * 0.25;
    const alza = 0.5 + rnd() * 0.25;
    const punto = (s: number): Vector3 => {
      // rachide arcuata: sale e poi ricade
      const x = s * len;
      const y = alza * len * Math.sin(Math.min(1, s * 1.15) * Math.PI * 0.8) * (1 - s * 0.35);
      return d.clone().multiplyScalar(x).add(v3(0, y, 0));
    };
    for (let k = 0; k < P; k++) {
      const s0 = (k + 0.15) / P;
      const s1 = (k + 0.85) / P;
      const p0 = punto(s0);
      const p1 = punto(s1);
      const sm = (s0 + s1) / 2;
      const larg = 0.2 * len * Math.sin(Math.PI * Math.pow(sm, 0.75)) + 0.015;
      const avanti = punto(Math.min(1, sm + 0.08)).sub(punto(sm)).normalize();
      const fl = (s: number) => Math.min(1, s * 1.2);
      for (const lato of [-1, 1]) {
        const tip = p0.clone().lerp(p1, 0.5).addScaledVector(lat, lato * larg).addScaledVector(avanti, larg * 0.5).add(v3(0, -larg * 0.25, 0));
        const g = 0.6 + 0.5 * sm;
        const cb = [g * 0.8, g * 0.8, g * 0.8, fl(s0)];
        const ct = [g * 1.05, g * 1.05, g, fl(sm)];
        if (lato > 0) t.add(p0, p1, tip, cb, cb, ct);
        else t.add(p1, p0, tip, cb, cb, ct);
      }
    }
  }
  return t.build();
}

/**
 * Fiore di prato: stelo sottile e corolla a cinque petali (margherita, colchico, cicoria): i petali
 * hanno colore 1 (lo dà l'istanza), lo stelo un verde scuro. Alto ~0.35.
 */
export function geoFiore(seme: number): BufferGeometry {
  const t = new Tri();
  const rnd = mulberry32(seme);
  const h = 0.3 + rnd() * 0.12;
  const curva = (rnd() - 0.5) * 0.08;
  const top = v3(curva, h, curva * 0.5);
  const verde = [0.42, 0.5, 0.3, 0];
  const verdeT = [0.42, 0.5, 0.3, 1];
  const w = 0.008;
  t.add(v3(-w, 0, 0), v3(w, 0, 0), top.clone().add(v3(w * 0.6, 0, 0)), verde, verde, verdeT);
  t.add(v3(-w, 0, 0), top.clone().add(v3(w * 0.6, 0, 0)), top.clone().add(v3(-w * 0.6, 0, 0)), verde, verdeT, verdeT);
  const n = 5;
  const r = 0.035 + rnd() * 0.02;
  const fase = rnd() * 6.28;
  const petalo = [1, 1, 1, 1];
  const centro = [0.95, 0.75, 0.25, 1];
  // corolla un po' inclinata verso la luce
  const su = v3(0.25, 1, 0.1).normalize();
  const ax = v3(1, 0, 0).sub(su.clone().multiplyScalar(su.x)).normalize();
  const az = su.clone().cross(ax);
  for (let k = 0; k < n; k++) {
    const a0 = fase + (k / n) * Math.PI * 2;
    const a1 = a0 + (Math.PI * 2) / n;
    const am = (a0 + a1) / 2;
    const p0 = top.clone().addScaledVector(ax, Math.cos(a0) * r * 0.25).addScaledVector(az, Math.sin(a0) * r * 0.25);
    const p1 = top.clone().addScaledVector(ax, Math.cos(a1) * r * 0.25).addScaledVector(az, Math.sin(a1) * r * 0.25);
    const pt = top.clone().addScaledVector(ax, Math.cos(am) * r).addScaledVector(az, Math.sin(am) * r).addScaledVector(su, -r * 0.15);
    t.add(p0, pt, p1, petalo, petalo, petalo, su);
  }
  // bottone centrale
  const c0 = top.clone().addScaledVector(su, r * 0.12);
  t.add(c0.clone().addScaledVector(ax, r * 0.3), c0.clone().addScaledVector(az, r * 0.3), c0.clone().addScaledVector(ax, -r * 0.3), centro, centro, centro, su);
  t.add(c0.clone().addScaledVector(ax, -r * 0.3), c0.clone().addScaledVector(az, -r * 0.3), c0.clone().addScaledVector(ax, r * 0.3), centro, centro, centro, su);
  return t.build();
}

/**
 * Sasso con il muschio: icosaedro deformato (fondo piatto e affondato, dorso a gobbe), le normali
 * morbide; colore per vertice: grigio caldo, muschio e licheni sulle facce in su. Raggio ~1.
 */
export function geoSasso(seme: number): BufferGeometry {
  let g: BufferGeometry = new IcosahedronGeometry(1, 1);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const rnd = mulberry32(seme);
  const pos = g.getAttribute('position');
  const bozzi = Array.from({ length: 5 }, () => v3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize());
  const d = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    let r = 0.85 + rnd() * 0.1;
    for (const b of bozzi) r += Math.max(0, d.dot(b) - 0.5) * 0.35;
    let y = d.y * r * 0.62;
    if (y < 0) y *= 0.35;
    pos.setXYZ(i, d.x * r, y - 0.12, d.z * r * (0.8 + rnd() * 0.05));
  }
  g.computeVertexNormals();
  const n = g.getAttribute('normal');
  const col = new Float32Array(pos.count * 4);
  const tono = 0.5 + rnd() * 0.12;
  for (let i = 0; i < pos.count; i++) {
    const ny = n.getY(i);
    const h = rnd();
    let r = tono * (1.03 + h * 0.08);
    let gg = tono * (1.0 + h * 0.06);
    let b = tono * (0.94 + h * 0.06);
    // muschio sulle facce in su, licheni chiari qua e là
    const m = Math.min(1, Math.max(0, (ny - 0.7) / 0.3)) * (0.15 + 0.3 * rnd());
    r += (0.36 - r) * m;
    gg += (0.44 - gg) * m;
    b += (0.2 - b) * m;
    if (h > 0.9 && m < 0.3) {
      r = r * 0.6 + 0.72 * 0.4;
      gg = gg * 0.6 + 0.68 * 0.4;
      b = b * 0.6 + 0.5 * 0.4;
    }
    col.set([r, gg, b, 0], i * 4);
  }
  g.setAttribute('aColor', new BufferAttribute(col, 4));
  // (normali morbide: un sasso tondeggiante consumato; il colore per vertice fa licheni e muschio)
  return g.toNonIndexed();
}

/** Foglie di castagno cadute: una chiazza di ~1.2 m con 12 foglie piatte d'ottobre (bruno, oro, ruggine). */
export function geoFoglieTerra(seme: number, n = 12): BufferGeometry {
  const t = new Tri();
  const rnd = mulberry32(seme);
  const colori = [
    [0.8, 0.5, 0.2],
    [0.88, 0.68, 0.28],
    [0.7, 0.4, 0.18],
    [0.84, 0.58, 0.24],
    [0.62, 0.48, 0.26],
  ];
  const su = v3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(rnd()) * 0.5;
    const a = rnd() * Math.PI * 2;
    const c = v3(Math.cos(a) * r, 0.02 + rnd() * 0.02, Math.sin(a) * r);
    const ang = rnd() * Math.PI * 2;
    const d = v3(Math.cos(ang), 0, Math.sin(ang));
    const lat = v3(-d.z, 0, d.x);
    const len = 0.1 + rnd() * 0.06;
    const w = len * 0.22;
    const col = colori[Math.floor(rnd() * colori.length)]!;
    const k = 0.85 + rnd() * 0.3;
    const cc = [col[0]! * k, col[1]! * k, col[2]! * k, 0];
    const cs = [col[0]! * k * 0.8, col[1]! * k * 0.8, col[2]! * k * 0.8, 0];
    const p0 = c.clone().addScaledVector(d, -len * 0.5);
    const p1 = c.clone().addScaledVector(d, len * 0.5).add(v3(0, rnd() * 0.03, 0));
    const pl = c.clone().addScaledVector(lat, w).addScaledVector(d, -len * 0.1).add(v3(0, 0.01, 0));
    const pr = c.clone().addScaledVector(lat, -w).addScaledVector(d, -len * 0.1).add(v3(0, 0.01, 0));
    t.add(p0, pl, p1, cs, cc, cc, su);
    t.add(p0, p1, pr, cs, cc, cc, su);
  }
  return t.build();
}

/**
 * Ricci di castagne: una chiazza di ~1 m con 6 ricci spinosi (verde-oro o bruni, qualcuno aperto)
 * e qualche castagna lucida per terra.
 */
export function geoRicci(seme: number): BufferGeometry {
  const t = new Tri();
  const rnd = mulberry32(seme);
  const ico = new IcosahedronGeometry(1, 1); // (già senza indici)
  const ip = ico.getAttribute('position');
  const dir = new Vector3();
  const ricci = 6;
  for (let i = 0; i < ricci; i++) {
    const r = Math.sqrt(rnd()) * 0.5;
    const a = rnd() * Math.PI * 2;
    const c = v3(Math.cos(a) * r, 0.04, Math.sin(a) * r);
    const R0 = 0.04 + rnd() * 0.012;
    const secco = rnd();
    const base = secco > 0.55 ? [0.46, 0.36, 0.2] : [0.62, 0.6, 0.26];
    for (let k = 0; k < ip.count; k += 3) {
      const pts: Vector3[] = [];
      for (let j = 0; j < 3; j++) {
        dir.fromBufferAttribute(ip, k + j).normalize();
        // spine: i vertici dell'icosaedro originale (12) si allungano, gli altri restano sul guscio
        const spina = Math.abs(dir.length() - 1) < 1e-3 && hashSpina(dir) ? 1.7 : 1;
        pts.push(c.clone().addScaledVector(dir, R0 * spina).add(v3(0, dir.y < 0 ? -dir.y * R0 * 0.4 : 0, 0)));
      }
      const kk = 0.8 + rnd() * 0.3;
      const col = [base[0]! * kk, base[1]! * kk, base[2]! * kk, 0];
      t.add(pts[0]!, pts[1]!, pts[2]!, col, col, col);
    }
  }
  // castagne lucide (tetraedri schiacciati)
  for (let i = 0; i < 4; i++) {
    const r = Math.sqrt(rnd()) * 0.55;
    const a = rnd() * Math.PI * 2;
    const c = v3(Math.cos(a) * r, 0.015, Math.sin(a) * r);
    const s = 0.028;
    const col = [0.36, 0.2, 0.11, 0];
    const top = c.clone().add(v3(0, s * 0.9, 0));
    const q = [0, 1, 2].map((k) => c.clone().add(v3(Math.cos(k * 2.09 + a) * s, 0, Math.sin(k * 2.09 + a) * s)));
    for (let k = 0; k < 3; k++) t.add(q[k]!, top, q[(k + 1) % 3]!, col, [0.5, 0.32, 0.18, 0], col);
  }
  return t.build();
}

/** Le spine stanno sui 12 vertici dell'icosaedro di partenza: |x|,|y|,|z| ∈ {0, 0.526, 0.851}. */
function hashSpina(d: Vector3): boolean {
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  const ok = (v: number) => v < 0.02 || Math.abs(v - 0.5257) < 0.02 || Math.abs(v - 0.8507) < 0.02;
  return ok(ax) && ok(ay) && ok(az);
}
