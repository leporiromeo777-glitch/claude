/**
 * Boschi lontani (traccia «natura»): oltre ~250 m gli alberi dei boschi lasciano il posto a una
 * «coltre» di chiome, un guscio sopra il terreno dove la densità di bosco è alta, alto quanto le
 * chiome e a gobbe come un bosco visto da lontano. Lo shader (`BOSCO` in render/naturaMateriali.ts)
 * lo dipinge a chiome tonde (una cella = un albero) con i colori d'ottobre: così l'altra metà del
 * cilindro e i versanti lontani si leggono come masse dipinte di bosco, non come puntini.
 *
 * Una mesh per valle (3 chiamate di disegno), costruita a pezzi (un blocco di terreno alla volta,
 * con un tempo massimo per fotogramma) o subito con `completa()`. Vicino alla camera il guscio
 * sparisce retinando (gli alberi veri prendono il posto).
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, Vector3, type ShaderMaterial } from 'three';
import { DEG } from '../world/constants';
import { cylToWorld, upAt } from '../world/cylinder';
import { Simplex3, smoothstep } from '../world/noise';
import { STRIPS, WATER_HEIGHT, createMasks, forestDensity, surfaceHeight } from '../world/terrain';
import { CHUNK_DEG, CHUNK_ROWS, CHUNK_S, zAtS } from '../world/terrainGrid';
import { creaMaterialeNatura, impostaSfuma } from '../render/naturaMateriali';
import type { WorldUniforms } from '../render/uniforms';

/** Passo della griglia del guscio (m circa). */
const RIGHE = 50;
const COLONNE = 56;
/** Altezza media delle chiome dei boschi (m). */
const ALTEZZA = 10.5;

const N1 = new Simplex3(3131);
/** maschere del terreno per vertice di un blocco (riusate) */
const MASCHERE = Array.from({ length: (COLONNE + 3) * (RIGHE + 3) }, () => createMasks());
const _a = new Vector3();
const _b = new Vector3();
const _n = new Vector3();
const _up = new Vector3();

interface Valle {
  thetaStart: number;
  thetaEnd: number;
  pos: number[];
  nor: number[];
  col: number[];
  /** prossimo blocco (riga di chunk, colonna) da costruire */
  prossimo: number;
  blocchi: Array<[number, number]>;
  mesh: Mesh | null;
}

export class BoschiLontani {
  readonly group = new Group();
  readonly materiale: ShaderMaterial;
  private valli: Valle[] = [];
  /** triangoli costruiti (statistiche) */
  triangoli = 0;

  constructor(u: WorldUniforms) {
    this.group.name = 'boschi-lontani';
    this.materiale = creaMaterialeNatura(u, { tipo: 'bosco' });
    for (const s of STRIPS) {
      if (s.kind !== 'valle') continue;
      const blocchi: Array<[number, number]> = [];
      const c0 = Math.round(s.thetaStart / CHUNK_DEG);
      const c1 = Math.round(s.thetaEnd / CHUNK_DEG);
      for (let r = 0; r < CHUNK_ROWS; r++) for (let c = c0; c < c1; c++) blocchi.push([r, c]);
      this.valli.push({ thetaStart: s.thetaStart, thetaEnd: s.thetaEnd, pos: [], nor: [], col: [], prossimo: 0, blocchi, mesh: null });
    }
  }

  /** Comparsa con la distanza (m): sotto `da` il guscio non c'è, da `a` in su è pieno. */
  impostaComparsa(da: number, a: number): void {
    impostaSfuma(this.materiale, da, a, 0, 0);
  }

  get finito(): boolean {
    return this.valli.every((v) => v.prossimo >= v.blocchi.length);
  }

  /** Costruisce blocchi per al più `budgetMs` millisecondi. */
  update(budgetMs: number): void {
    if (this.finito) return;
    const t0 = performance.now();
    for (const v of this.valli) {
      while (v.prossimo < v.blocchi.length) {
        const [r, c] = v.blocchi[v.prossimo++]!;
        this.blocco(v, r, c);
        if (v.prossimo >= v.blocchi.length) this.chiudi(v);
        if (performance.now() - t0 > budgetMs) return;
      }
    }
  }

  /** Costruisce subito tutto. */
  completa(): void {
    this.update(1e9);
  }

  private chiudi(v: Valle): void {
    if (!v.pos.length) return;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(v.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(v.nor), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(v.col), 4));
    g.computeBoundingSphere();
    const m = new Mesh(g, this.materiale);
    m.name = `boschi-lontani-${Math.round(v.thetaStart)}`;
    m.userData['ombra'] = false;
    m.matrixAutoUpdate = false;
    this.group.add(m);
    v.mesh = m;
    this.triangoli += v.pos.length / 9;
    v.pos = [];
    v.nor = [];
    v.col = [];
  }

  /** Un blocco di terreno (stessa griglia dei chunk del terreno). */
  private blocco(v: Valle, row: number, col: number): void {
    const W = COLONNE + 3;
    const H = RIGHE + 3;
    const sStart = row * CHUNK_S;
    const thStart = col * CHUNK_DEG;
    const ds = CHUNK_S / RIGHE;
    const dth = CHUNK_DEG / COLONNE;
    const P = new Float32Array(W * H * 3);
    const G = new Float32Array(W * H * 3); // posizioni del suolo (pendenza)
    const C = new Float32Array(W * H * 4);
    let qualcosa = false;
    for (let i = 0; i < H; i++) {
      const z = zAtS(Math.max(0, sStart + (i - 1) * ds));
      for (let j = 0; j < W; j++) {
        const th = thStart + (j - 1) * dth;
        const o = i * W + j;
        const h = surfaceHeight(z, th, MASCHERE[o]!);
        cylToWorld(z, th, h, _a);
        G[o * 3] = _a.x;
        G[o * 3 + 1] = _a.y;
        G[o * 3 + 2] = _a.z;
        C[o * 4 + 3] = -1; // da calcolare dopo (serve la pendenza)
        P[o * 3] = h;
        P[o * 3 + 1] = z;
        P[o * 3 + 2] = th;
      }
    }
    // densità di bosco, quota delle chiome, colore
    for (let i = 1; i < H - 1; i++) {
      for (let j = 1; j < W - 1; j++) {
        const o = i * W + j;
        const h = P[o * 3]!;
        const z = P[o * 3 + 1]!;
        const th = P[o * 3 + 2]!;
        // pendenza dal suolo vicino
        const oe = o + 1;
        const ow = o - 1;
        const on = o + W;
        const os = o - W;
        _a.set(G[oe * 3]! - G[ow * 3]!, G[oe * 3 + 1]! - G[ow * 3 + 1]!, G[oe * 3 + 2]! - G[ow * 3 + 2]!);
        _b.set(G[on * 3]! - G[os * 3]!, G[on * 3 + 1]! - G[os * 3 + 1]!, G[on * 3 + 2]! - G[os * 3 + 2]!);
        _n.crossVectors(_a, _b).normalize();
        upAt(th, _up);
        const slope = Math.acos(Math.max(-1, Math.min(1, _n.dot(_up))));
        const masks = MASCHERE[o]!;
        let f = forestDensity(z, th, h, slope, masks);
        if (masks.lakeQ < 1.1 || h < WATER_HEIGHT + 0.5) f = 0;
        const x = -Math.sin(th * DEG) * 646;
        const y = -Math.cos(th * DEG) * 646;
        const n1 = N1.noise(x / 14, y / 14, z / 14);
        const n2 = N1.noise(x / 5.5 + 7, y / 5.5, z / 5.5);
        const cop = smoothstep(0.24, 0.4, f) + n1 * 0.12;
        if (cop > 0.3) qualcosa = true;
        const alto = ALTEZZA * smoothstep(0.16, 0.42, f) * (0.88 + 0.22 * n1) + 1.6 * n2 * smoothstep(0.2, 0.4, f);
        P[o * 3] = h + Math.max(0, alto);
        // colore della massa: verde d'ottobre; in alto (larici) più oro
        const hl = smoothstep(55, 95, h);
        let r = 0.44;
        let g = 0.5;
        let b = 0.22;
        if (masks.theme === 'selve') {
          r = 0.5;
          g = 0.5;
          b = 0.21;
        }
        r += (0.74 - r) * hl * 0.6;
        g += (0.56 - g) * hl * 0.6;
        b += (0.22 - b) * hl * 0.6;
        const k = 0.9 + 0.2 * (N1.noise(x / 60, y / 60, z / 60) * 0.5 + 0.5);
        C[o * 4] = r * k;
        C[o * 4 + 1] = g * k;
        C[o * 4 + 2] = b * k;
        C[o * 4 + 3] = cop;
      }
    }
    if (!qualcosa) return;
    // posizioni del guscio
    for (let i = 1; i < H - 1; i++) {
      for (let j = 1; j < W - 1; j++) {
        const o = i * W + j;
        cylToWorld(P[o * 3 + 1]!, P[o * 3 + 2]!, P[o * 3]!, _a);
        G[o * 3] = _a.x;
        G[o * 3 + 1] = _a.y;
        G[o * 3 + 2] = _a.z;
      }
    }
    const vert = (i: number, j: number): void => {
      const o = i * W + j;
      v.pos.push(G[o * 3]!, G[o * 3 + 1]!, G[o * 3 + 2]!);
      // normale per differenze (bordi della griglia: lato interno)
      const ie = Math.min(W - 2, j + 1);
      const iw = Math.max(1, j - 1);
      const jn = Math.min(H - 2, i + 1);
      const js = Math.max(1, i - 1);
      const oe = i * W + ie;
      const ow = i * W + iw;
      const on = jn * W + j;
      const os = js * W + j;
      _a.set(G[oe * 3]! - G[ow * 3]!, G[oe * 3 + 1]! - G[ow * 3 + 1]!, G[oe * 3 + 2]! - G[ow * 3 + 2]!);
      _b.set(G[on * 3]! - G[os * 3]!, G[on * 3 + 1]! - G[os * 3 + 1]!, G[on * 3 + 2]! - G[os * 3 + 2]!);
      _n.crossVectors(_a, _b).normalize();
      v.nor.push(_n.x, _n.y, _n.z);
      v.col.push(C[o * 4]!, C[o * 4 + 1]!, C[o * 4 + 2]!, C[o * 4 + 3]!);
    };
    for (let i = 1; i < H - 2; i++) {
      for (let j = 1; j < W - 2; j++) {
        const a = i * W + j;
        const b = (i + 1) * W + j;
        const c = b + 1;
        const d = a + 1;
        if (Math.max(C[a * 4 + 3]!, C[b * 4 + 3]!, C[c * 4 + 3]!, C[d * 4 + 3]!) < 0.42) continue;
        // facce verso l'asse (come il terreno): a, c, b e a, d, c
        vert(i, j);
        vert(i + 1, j + 1);
        vert(i + 1, j);
        vert(i, j);
        vert(i, j + 1);
        vert(i + 1, j + 1);
      }
    }
  }
}
