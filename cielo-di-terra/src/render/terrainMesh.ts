/**
 * Mesh del terreno: una griglia (s, theta) avvolta sulla superficie interna del
 * cilindro, con le normali verso l'interno, divisa in chunk per il frustum
 * culling e con 4 livelli di dettaglio (LOD). Il lato opposto del cilindro è a
 * ~1.3 km: lì bastano i LOD grossolani.
 *
 * - Colonne di chunk di 30 gradi, allineate alle strisce: le finestre non hanno
 *   chunk, tranne dove i Tappi le coprono.
 * - Le crepe fra LOD diversi sono nascoste da "gonne" (skirt) che scendono sotto il suolo.
 * - La costruzione è progressiva (generatori a tempo) per non bloccare il gioco;
 *   `ensureAll()` completa tutto subito (screenshot, teletrasporti).
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, Sphere, Vector3, type Material } from 'three';
import { R } from '../world/constants';
import { cylToWorld, upAt } from '../world/cylinder';
import { createMasks, surfaceHeight } from '../world/terrain';
import { CHUNK_COLS, CHUNK_DEG, CHUNK_ROWS, CHUNK_S, LOD_COUNT, S_TOTAL, lodCols, lodRows, zAtS } from '../world/terrainGrid';
import { capMeanHeight } from '../world/terrainProfile';
import { stripAt } from '../world/terrain';
import { terrainColor } from './palette';
import { suSentiero, trattiVicini } from '../scene/sentieri';
import { METERS_PER_DEG } from '../world/constants';

export interface TerrainChunk {
  row: number;
  col: number;
  sStart: number;
  thetaStart: number;
  center: Vector3;
  radius: number;
  lods: (Mesh | null)[];
  /** LOD attualmente visibile (-1 nessuno). */
  current: number;
  /** LOD desiderato all'ultimo aggiornamento. */
  wanted: number;
}

interface BuildJob {
  chunk: TerrainChunk;
  lod: number;
  iter: Generator<void, BufferGeometry, void>;
}

const _cam = new Vector3();

/** Vero se la geometria ha almeno un vertice di vetro di Finestra (alfa 255). */
function haVetro(geo: BufferGeometry): boolean {
  const a = geo.getAttribute('aColor');
  if (!a || a.itemSize < 4) return false;
  const arr = a.array as ArrayLike<number>;
  const soglia = a.normalized || arr instanceof Uint8Array ? 200 : 0.8;
  for (let i = 3; i < arr.length; i += 4) if (arr[i]! > soglia) return true;
  return false;
}

export class TerrainSystem {
  readonly group = new Group();
  readonly chunks: TerrainChunk[] = [];
  /** Distanze (m dal bordo del chunk) oltre cui si passa al LOD successivo. */
  lodDistances = [110, 430, 1000];
  private job: BuildJob | null = null;

  /**
   * @param material materiale del terreno
   * @param materialeVetro variante con il discard del vetro delle Finestre (alfa 255): la usano solo
   *   i chunk che contengono vetro; senza, tutti usano `material`
   */
  constructor(
    private material: Material,
    private materialeVetro: Material = material,
  ) {
    this.group.name = 'terreno';
    for (let row = 0; row < CHUNK_ROWS; row++) {
      for (let col = 0; col < CHUNK_COLS; col++) {
        const thetaStart = col * CHUNK_DEG;
        const sStart = row * CHUNK_S;
        if (stripAt(thetaStart + CHUNK_DEG / 2).kind === 'finestra') {
          // finestra: serve un chunk solo dove un Tappo la copre
          let maxCap = 0;
          for (let k = 0; k <= 16; k++) maxCap = Math.max(maxCap, capMeanHeight(zAtS(sStart + (k / 16) * CHUNK_S)));
          if (maxCap < 0.5) continue;
        }
        const chunk: TerrainChunk = { row, col, sStart, thetaStart, center: new Vector3(), radius: 1, lods: new Array(LOD_COUNT).fill(null), current: -1, wanted: LOD_COUNT - 1 };
        this.chunks.push(chunk);
        // il LOD più grossolano si costruisce subito: dà anche la sfera di ingombro
        const geo = runToEnd(buildChunkGeometry(chunk, LOD_COUNT - 1));
        this.attach(chunk, LOD_COUNT - 1, geo);
        geo.computeBoundingSphere();
        const bs = geo.boundingSphere as Sphere;
        chunk.center.copy(bs.center);
        chunk.radius = bs.radius;
        this.show(chunk, LOD_COUNT - 1);
      }
    }
  }

  private attach(chunk: TerrainChunk, lod: number, geo: BufferGeometry): void {
    const mesh = new Mesh(geo, haVetro(geo) ? this.materialeVetro : this.material);
    mesh.name = `terreno-${chunk.row}-${chunk.col}-lod${lod}`;
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    chunk.lods[lod] = mesh;
    this.group.add(mesh);
  }

  private show(chunk: TerrainChunk, lod: number): void {
    if (chunk.current === lod) return;
    if (chunk.current >= 0) chunk.lods[chunk.current]!.visible = false;
    chunk.lods[lod]!.visible = true;
    chunk.current = lod;
  }

  private desiredLod(chunk: TerrainChunk, cam: Vector3): number {
    const d = Math.max(0, cam.distanceTo(chunk.center) - chunk.radius * 0.85);
    const ld = this.lodDistances;
    let lod = d < ld[0]! ? 0 : d < ld[1]! ? 1 : d < ld[2]! ? 2 : 3;
    // isteresi: non salire di dettaglio per pochi metri
    if (chunk.current >= 0 && lod > chunk.current) {
      const back = d - 20 < ld[chunk.current]! ? chunk.current : lod;
      lod = back;
    }
    return lod;
  }

  /**
   * Aggiorna i LOD e avanza la costruzione per al massimo `budgetMs` millisecondi.
   */
  update(camPos: Vector3, budgetMs = 5): void {
    _cam.copy(camPos);
    let best: TerrainChunk | null = null;
    let bestScore = Infinity;
    let bestLod = 0;
    for (const c of this.chunks) {
      const lod = this.desiredLod(c, _cam);
      c.wanted = lod;
      if (c.lods[lod]) {
        this.show(c, lod);
        // libera i LOD fini lontani
        for (let l = 0; l < lod; l++) {
          if (c.lods[l] && lod - l >= 2) this.dispose(c, l);
        }
      } else {
        // mostra il migliore disponibile e metti in coda il voluto
        for (let l = lod + 1; l < LOD_COUNT; l++) {
          if (c.lods[l]) {
            this.show(c, l);
            break;
          }
        }
        const score = _cam.distanceTo(c.center) + lod * 50;
        if (score < bestScore) {
          bestScore = score;
          best = c;
          bestLod = lod;
        }
      }
    }
    const t0 = performance.now();
    while (performance.now() - t0 < budgetMs) {
      if (!this.job) {
        if (!best) break;
        this.job = { chunk: best, lod: bestLod, iter: buildChunkGeometry(best, bestLod) };
        best = null;
      }
      const r = this.job.iter.next();
      if (r.done) {
        const { chunk, lod } = this.job;
        this.job = null;
        if (!chunk.lods[lod]) this.attach(chunk, lod, r.value);
        if (chunk.wanted === lod) this.show(chunk, lod);
        if (!best) break;
      }
    }
  }

  /** Costruisce subito tutto ciò che serve per la posizione `camPos`. */
  ensureAll(camPos: Vector3): void {
    for (let guard = 0; guard < 10000; guard++) {
      this.update(camPos, 1e9);
      if (!this.job && this.chunks.every((c) => c.lods[c.wanted])) break;
    }
    this.update(camPos, 0);
  }

  private dispose(c: TerrainChunk, lod: number): void {
    const m = c.lods[lod];
    if (!m) return;
    if (c.current === lod) return;
    this.group.remove(m);
    m.geometry.dispose();
    c.lods[lod] = null;
  }

  /** Statistiche: numero di chunk visibili per LOD e triangoli totali dei LOD mostrati. */
  stats(): { chunks: number; byLod: number[]; triangles: number } {
    const byLod = [0, 0, 0, 0];
    let tris = 0;
    for (const c of this.chunks) {
      if (c.current < 0) continue;
      byLod[c.current]!++;
      const g = c.lods[c.current]!.geometry;
      tris += (g.index ? g.index.count : 0) / 3;
    }
    return { chunks: this.chunks.length, byLod, triangles: tris };
  }
}

function runToEnd<T>(gen: Generator<void, T, void>): T {
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

const _n = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _up = new Vector3();

/** Costruisce la geometria di un chunk a un LOD (generatore: cede ogni poche righe). */
export function* buildChunkGeometry(chunk: TerrainChunk, lod: number): Generator<void, BufferGeometry, void> {
  const rows = lodRows(lod);
  const cols = lodCols(lod);
  const ds = CHUNK_S / rows;
  const dth = CHUNK_DEG / cols;
  const W = cols + 3; // con bordo di un campione per lato
  const H = rows + 3;
  const P = new Float32Array(W * H * 3);
  const Z = new Float64Array(H);
  const masks = createMasks();
  const nV = (rows + 1) * (cols + 1);
  const colors = new Uint8Array(nV * 4);
  const hs = new Float32Array(nV);
  const tmpColor = [0, 0, 0];

  for (let i = 0; i < H; i++) {
    const s = Math.min(S_TOTAL, Math.max(0, chunk.sStart + (i - 1) * ds));
    Z[i] = zAtS(s);
  }
  // quote e posizioni (con bordo)
  const maskStore: ReturnType<typeof createMasks>[] = [];
  for (let i = 0; i < H; i++) {
    const z = Z[i]!;
    for (let j = 0; j < W; j++) {
      const th = chunk.thetaStart + (j - 1) * dth;
      const interior = i >= 1 && i <= rows + 1 && j >= 1 && j <= cols + 1;
      const h = surfaceHeight(z, th, interior ? masks : undefined);
      const p = cylToWorld(z, th, h, _a);
      const o = (i * W + j) * 3;
      P[o] = p.x;
      P[o + 1] = p.y;
      P[o + 2] = p.z;
      if (interior) {
        const vi = (i - 1) * (cols + 1) + (j - 1);
        hs[vi] = h;
        maskStore[vi] = { ...masks };
      }
    }
    if (i % 2 === 1) yield;
  }

  const positions = new Float32Array(nV * 3);
  const normals = new Float32Array(nV * 3);
  // sentieri di terra battuta (traccia «natura»): solo il colore, solo dove passano vicino al chunk
  const sentieri = trattiVicini(Math.min(Z[1]!, Z[rows + 1]!), Math.max(Z[1]!, Z[rows + 1]!), chunk.thetaStart * METERS_PER_DEG, (chunk.thetaStart + CHUNK_DEG) * METERS_PER_DEG, 6);
  for (let i = 1; i <= rows + 1; i++) {
    for (let j = 1; j <= cols + 1; j++) {
      const vi = (i - 1) * (cols + 1) + (j - 1);
      const o = (i * W + j) * 3;
      positions[vi * 3] = P[o]!;
      positions[vi * 3 + 1] = P[o + 1]!;
      positions[vi * 3 + 2] = P[o + 2]!;
      // normale per differenze centrali: t_theta x t_s (verso l'interno)
      const oe = (i * W + j + 1) * 3;
      const ow = (i * W + j - 1) * 3;
      let on = ((i + 1) * W + j) * 3;
      let os = ((i - 1) * W + j) * 3;
      _a.set(P[oe]! - P[ow]!, P[oe + 1]! - P[ow + 1]!, P[oe + 2]! - P[ow + 2]!);
      _b.set(P[on]! - P[os]!, P[on + 1]! - P[os + 1]!, P[on + 2]! - P[os + 2]!);
      if (_b.lengthSq() < 1e-8) {
        on = o;
        os = o;
        _b.set(0, 0, 1);
      }
      _n.crossVectors(_a, _b).normalize();
      const th = chunk.thetaStart + (j - 1) * dth;
      upAt(th, _up);
      if (_n.lengthSq() < 0.5) _n.copy(_up);
      normals[vi * 3] = _n.x;
      normals[vi * 3 + 1] = _n.y;
      normals[vi * 3 + 2] = _n.z;
      const slope = Math.acos(Math.max(-1, Math.min(1, _n.dot(_up))));
      const m = maskStore[vi]!;
      const h = hs[vi]!;
      terrainColor(Z[i]!, th, h, slope, m, tmpColor);
      if (sentieri.length) {
        const k = suSentiero(Z[i]!, th, sentieri);
        if (k > 0) {
          // terra battuta grigio-bruna sotto il sentiero, poi le spalle: erba calpestata (più chiara e
          // più gialla, ma ancora prato per la pittura del terreno), che sfuma nel prato in ~1,5 m.
          // (Migliorie, suolo: prima l'ocra 0,62/0,51/0,36 arrivava a 2,5 m dal bordo con un peso
          // k^1,6: una fascia arancione larga il doppio del sentiero, e niente bordo d'erba)
          const d = (1 - k) * 2.5; // metri dal bordo del sentiero (0 = bordo o dentro)
          const v = 0.92 + 0.16 * Math.abs(Math.sin(Z[i]! * 1.7 + th * 31));
          const piano = 1 - smoothSlope(slope);
          const terra = (1 - smoothstep01(0.05, 0.55, d)) * piano;
          const calpestata = (1 - smoothstep01(0.4, 1.6, d)) * piano * 0.6;
          tmpColor[0] = tmpColor[0]! + (0.53 - tmpColor[0]!) * calpestata;
          tmpColor[1] = tmpColor[1]! + (0.56 - tmpColor[1]!) * calpestata;
          tmpColor[2] = tmpColor[2]! + (0.33 - tmpColor[2]!) * calpestata;
          tmpColor[0] = tmpColor[0]! + (0.55 * v - tmpColor[0]!) * terra;
          tmpColor[1] = tmpColor[1]! + (0.48 * v - tmpColor[1]!) * terra;
          tmpColor[2] = tmpColor[2]! + (0.38 * v - tmpColor[2]!) * terra;
        }
      }
      colors[vi * 4] = Math.round(Math.min(1, Math.max(0, tmpColor[0]!)) * 255);
      colors[vi * 4 + 1] = Math.round(Math.min(1, Math.max(0, tmpColor[1]!)) * 255);
      colors[vi * 4 + 2] = Math.round(Math.min(1, Math.max(0, tmpColor[2]!)) * 255);
      // alfa: 255 = vetro di finestra da scartare; altrimenti la curvatura del suolo in 0..115
      // (57 = piano): quanto il vertice sta sotto (conca, > 57) o sopra (dosso, < 57) la media dei
      // vicini, in metri / 1.5. Lo shader scurisce le conche e schiarisce i dossi (±12%): i
      // gradoni si leggono (piede scuro, ciglio chiaro) anche senza ombre
      if (m.kind === 'finestra' && h < 0.35) colors[vi * 4 + 3] = 255;
      else {
        const hN = (o2: number): number => R - Math.hypot(P[o2]!, P[o2 + 1]!);
        const media = (hN(oe) + hN(ow) + hN(((i + 1) * W + j) * 3) + hN(((i - 1) * W + j) * 3)) * 0.25;
        const c = Math.max(-1, Math.min(1, (media - h) / 1.5));
        colors[vi * 4 + 3] = Math.round(57 + c * 57);
      }
    }
    if (i % 3 === 0) yield;
  }

  // gonne lungo i quattro bordi
  const edge: number[] = [];
  for (let j = 0; j <= cols; j++) edge.push(j); // sud (i = 0)
  for (let i = 1; i <= rows; i++) edge.push(i * (cols + 1) + cols); // est
  for (let j = cols; j >= 0; j--) edge.push(rows * (cols + 1) + j); // nord
  for (let i = rows - 1; i >= 1; i--) edge.push(i * (cols + 1)); // ovest
  edge.push(0);
  const skirtDepth = 3 + 2.5 * Math.max(ds, dth * (Math.PI / 180) * R);
  const nSk = edge.length;
  const totalV = nV + nSk;
  const pos = new Float32Array(totalV * 3);
  const nor = new Float32Array(totalV * 3);
  const col = new Uint8Array(totalV * 4);
  pos.set(positions);
  nor.set(normals);
  col.set(colors);
  for (let k = 0; k < nSk; k++) {
    const v = edge[k]!;
    const x = positions[v * 3]!;
    const y = positions[v * 3 + 1]!;
    const r = Math.hypot(x, y);
    const f = r > 1e-3 ? (r + skirtDepth) / r : 1;
    const o = (nV + k) * 3;
    pos[o] = x * f;
    pos[o + 1] = y * f;
    pos[o + 2] = positions[v * 3 + 2]!;
    nor[o] = normals[v * 3]!;
    nor[o + 1] = normals[v * 3 + 1]!;
    nor[o + 2] = normals[v * 3 + 2]!;
    col.set(colors.subarray(v * 4, v * 4 + 4), (nV + k) * 4);
  }

  const quads = rows * cols;
  const idxCount = quads * 6 + (nSk - 1) * 12;
  const index = totalV < 65536 ? new Uint16Array(idxCount) : new Uint32Array(idxCount);
  let p = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const b = (i + 1) * (cols + 1) + j;
      const c = b + 1;
      const d = a + 1;
      // diagonale a-c (come groundHeight), facce verso l'asse
      index[p++] = a;
      index[p++] = c;
      index[p++] = b;
      index[p++] = a;
      index[p++] = d;
      index[p++] = c;
    }
  }
  for (let k = 0; k < nSk - 1; k++) {
    const t0 = edge[k]!;
    const t1 = edge[k + 1]!;
    const s0 = nV + k;
    const s1 = nV + k + 1;
    // entrambe le facce: la gonna si vede da un lato o dall'altro
    index[p++] = t0;
    index[p++] = s0;
    index[p++] = t1;
    index[p++] = t1;
    index[p++] = s0;
    index[p++] = s1;
    index[p++] = t0;
    index[p++] = t1;
    index[p++] = s0;
    index[p++] = t1;
    index[p++] = s1;
    index[p++] = s0;
  }

  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('normal', new BufferAttribute(nor, 3));
  geo.setAttribute('aColor', new BufferAttribute(col, 4, true));
  geo.setIndex(new BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

function smoothstep01(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Sui pendii ripidi (roccia) il sentiero non si dipinge: 0 in piano, 1 oltre ~45°. */
function smoothSlope(slope: number): number {
  const t = Math.min(1, Math.max(0, (slope - 0.6) / 0.3));
  return t * t * (3 - 2 * t);
}
