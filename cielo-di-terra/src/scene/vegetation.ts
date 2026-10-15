/**
 * Castagni segnaposto: masse tonde a tre toni (la luce a bande fa i toni) su un
 * tronco torto. Tre livelli di dettaglio, ciascuno una InstancedMesh: ogni
 * ~0.3 s gli alberi vengono ridistribuiti fra vicino/medio/lontano in base alla
 * distanza dalla camera. I tronchi hanno collisori cilindrici.
 */
import { BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Vector3, type Material } from 'three';
import { L, LAYOUT, METERS_PER_DEG } from '../world/constants';
import { cylToWorld, upAt } from '../world/cylinder';
import { cylinderAt, type ColliderWorld } from '../world/colliders';
import { Simplex3, mulberry32 } from '../world/noise';
import { STRIPS, WATER_HEIGHT, createMasks, forestDensity, slopeAt, surfaceHeight } from '../world/terrain';
import { GeomBuilder, PRIMS } from '../render/geomBuilder';
import { PALETTE, type RGB } from '../render/palette';
import { surfaceMatrix } from '../render/placement';

export interface TreeInstance {
  pos: Vector3;
  matrix: Matrix4;
  tint: RGB;
}

const _t = new Matrix4();
const _v = new Vector3();

/** Geometrie dei tre LOD (unità: albero alto ~10 m prima della scala). */
function treeGeometries(): BufferGeometry[] {
  const trunk = PALETTE.chestnut;
  const leaf: RGB = [1, 1, 1]; // il colore della chioma viene dalla tinta per istanza
  const out: BufferGeometry[] = [];
  // LOD 0: tronco in due tratti piegati + 5 masse
  {
    const b = new GeomBuilder();
    _t.makeTranslation(0, 0, 0).scale(_v.set(0.42, 2.4, 0.42));
    b.add(PRIMS.frustum(0.75, 7), _t.clone(), trunk);
    _t.makeTranslation(0.25, 2.3, 0).multiply(new Matrix4().makeRotationZ(-0.22)).scale(_v.set(0.32, 2.3, 0.32));
    b.add(PRIMS.frustum(0.6, 7), _t.clone(), trunk);
    _t.makeTranslation(-0.2, 2.6, 0.1).multiply(new Matrix4().makeRotationZ(0.6)).scale(_v.set(0.18, 1.8, 0.18));
    b.add(PRIMS.frustum(0.5, 5), _t.clone(), trunk);
    const blobs: [number, number, number, number][] = [
      [0.4, 5.6, 0, 2.9],
      [-1.6, 4.9, 0.6, 2.2],
      [1.9, 4.8, -0.5, 2.1],
      [0.2, 6.9, -0.8, 2.0],
      [-0.4, 5.2, -1.9, 2.0],
    ];
    for (const [x, y, z, r] of blobs) {
      _t.makeTranslation(x, y, z).scale(_v.set(r, r * 0.86, r));
      b.add(PRIMS.blob(1), _t.clone(), leaf, 0, (lp, c) => {
        // fondo della chioma più scuro (ombra propria dipinta)
        const k = lp.y < -0.3 ? 0.82 : 1;
        c[0] = c[0]! * k;
        c[1] = c[1]! * k;
        c[2] = c[2]! * k;
      });
    }
    out.push(b.build());
  }
  // LOD 1: tronco semplice + 2 masse
  {
    const b = new GeomBuilder();
    _t.makeTranslation(0, 0, 0).scale(_v.set(0.4, 4.2, 0.4));
    b.add(PRIMS.frustum(0.6, 5), _t.clone(), trunk);
    _t.makeTranslation(0.2, 5.5, 0).scale(_v.set(3.2, 2.7, 3.2));
    b.add(PRIMS.blob(0), _t.clone(), leaf);
    _t.makeTranslation(-1.2, 4.9, 0.5).scale(_v.set(2.2, 1.9, 2.2));
    b.add(PRIMS.blob(0), _t.clone(), leaf);
    out.push(b.build());
  }
  // LOD 2: una massa
  {
    const b = new GeomBuilder();
    _t.makeTranslation(0, 5.2, 0).scale(_v.set(3.6, 3.0, 3.6));
    b.add(PRIMS.blob(0), _t.clone(), leaf);
    out.push(b.build());
  }
  return out;
}

export class Vegetation {
  readonly group = new Group();
  readonly trees: TreeInstance[] = [];
  private meshes: InstancedMesh[] = [];
  private trunkMeshes: InstancedMesh[] = [];
  /** Distanze di passaggio fra i LOD (m). */
  lodDistances = [140, 520];
  private lastCam = new Vector3(1e9, 0, 0);

  constructor(material: Material, trunkMaterial: Material, colliders: ColliderWorld, seed = 99) {
    this.group.name = 'castagni';
    const rnd = mulberry32(seed);
    const noise = new Simplex3(seed);
    const masks = createMasks();
    const spacing = 10.5;
    const tintsAutumn: RGB[] = [PALETTE.leafGreen, PALETTE.leafGreen, PALETTE.leafDeep, PALETTE.leafDeep, PALETTE.leafOchre, PALETTE.leafRust, [0.62, 0.68, 0.36]];
    for (const strip of STRIPS) {
      if (strip.kind !== 'valle') continue;
      const forest = LAYOUT.forests.find((f) => f.strip === strip.id);
      const k = forest ? forest.density : 0.2;
      const arcLen = (strip.thetaEnd - strip.thetaStart) * METERS_PER_DEG;
      for (let z = 5; z < L - 5; z += spacing) {
        for (let a = 2; a < arcLen - 2; a += spacing) {
          const zz = z + (rnd() - 0.5) * spacing * 0.9;
          const th = strip.thetaStart + (a + (rnd() - 0.5) * spacing * 0.9) / METERS_PER_DEG;
          const h = surfaceHeight(zz, th, masks);
          if (masks.capN > 0 || masks.capS > 0.4) continue;
          if (masks.lakeQ < 1.08 || h < WATER_HEIGHT + 0.6 && masks.theme === 'lago') continue;
          if (masks.piazza > 0) continue;
          const slope = slopeAt(zz, th, false);
          let d = forestDensity(zz, th, h, slope, masks) * (0.55 + 0.45 * k);
          // alberi isolati nei prati
          d = Math.max(d, 0.012 * (1 - masks.bank));
          if (rnd() > d) continue;
          const base = cylToWorld(zz, th, h);
          if (colliders.pointInside(base.clone().addScaledVector(upAt(th), 1.2), 3.2)) continue;
          const scale = 0.72 + rnd() * 0.6 + noise.noise(base.x / 80, base.y / 80, base.z / 80) * 0.15;
          const m = surfaceMatrix(zz, th, h - 0.3, rnd() * 360, scale, scale * (0.9 + rnd() * 0.2), scale);
          let tint = tintsAutumn[Math.floor(rnd() * tintsAutumn.length)]!;
          if (strip.theme !== 'selve' && rnd() < 0.6) tint = PALETTE.leafGreen;
          const tv = 0.92 + rnd() * 0.16;
          this.trees.push({ pos: base, matrix: m, tint: [tint[0] * tv, tint[1] * tv, tint[2] * tv] });
          colliders.add(cylinderAt(zz, th, h - 0.3, 0.42 * scale, 4.5 * scale, 'castagno'));
        }
      }
    }
    const geos = treeGeometries();
    const n = this.trees.length;
    for (let lod = 0; lod < 3; lod++) {
      const g = geos[lod]!;
      // separa tronco (bruno, senza tinta) e chioma (tinta per istanza): due mesh per LOD
      const { crown, trunk } = splitTrunk(g);
      const crownMesh = new InstancedMesh(crown, material, n);
      crown.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(n * 3), 3));
      crownMesh.count = 0;
      crownMesh.frustumCulled = false;
      crownMesh.name = `castagni-chioma-lod${lod}`;
      this.meshes.push(crownMesh);
      this.group.add(crownMesh);
      if (trunk) {
        const trunkMesh = new InstancedMesh(trunk, trunkMaterial, n);
        trunkMesh.count = 0;
        trunkMesh.frustumCulled = false;
        trunkMesh.name = `castagni-tronco-lod${lod}`;
        this.trunkMeshes[lod] = trunkMesh;
        this.group.add(trunkMesh);
      }
    }
  }

  /** Ridistribuisce gli alberi fra i LOD (chiamare spesso: lavora solo se la camera si è mossa). */
  update(cam: Vector3, force = false): void {
    if (!force && cam.distanceToSquared(this.lastCam) < 15 * 15) return;
    this.lastCam.copy(cam);
    const counts = [0, 0, 0];
    const d0 = this.lodDistances[0]! ** 2;
    const d1 = this.lodDistances[1]! ** 2;
    for (const t of this.trees) {
      const d = t.pos.distanceToSquared(cam);
      const lod = d < d0 ? 0 : d < d1 ? 1 : 2;
      const i = counts[lod]!++;
      const crown = this.meshes[lod]!;
      t.matrix.toArray(crown.instanceMatrix.array as Float32Array, i * 16);
      const tint = crown.geometry.getAttribute('aTint') as InstancedBufferAttribute;
      (tint.array as Float32Array).set(t.tint, i * 3);
      const trunk = this.trunkMeshes[lod];
      if (trunk) t.matrix.toArray(trunk.instanceMatrix.array as Float32Array, i * 16);
    }
    for (let lod = 0; lod < 3; lod++) {
      const crown = this.meshes[lod]!;
      crown.count = counts[lod]!;
      crown.instanceMatrix.needsUpdate = true;
      crown.geometry.getAttribute('aTint').needsUpdate = true;
      const trunk = this.trunkMeshes[lod];
      if (trunk) {
        trunk.count = counts[lod]!;
        trunk.instanceMatrix.needsUpdate = true;
      }
    }
  }

  /** Numero di alberi per LOD visibili (statistiche). */
  counts(): number[] {
    return this.meshes.map((m) => m.count);
  }
}

/** Divide una geometria d'albero in tronco (colore non bianco) e chioma (bianca). */
function splitTrunk(g: BufferGeometry): { crown: BufferGeometry; trunk: BufferGeometry | null } {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = g.getAttribute('aColor');
  const cp: number[] = [];
  const cn: number[] = [];
  const cc: number[] = [];
  const tp: number[] = [];
  const tn: number[] = [];
  const tc: number[] = [];
  for (let tri = 0; tri < pos.count; tri += 3) {
    const isCrown = col.getX(tri) > 0.75 || col.getY(tri) > 0.75;
    const P = isCrown ? cp : tp;
    const Nn = isCrown ? cn : tn;
    const C = isCrown ? cc : tc;
    for (let k = 0; k < 3; k++) {
      const i = tri + k;
      P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      Nn.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      C.push(col.getX(i), col.getY(i), col.getZ(i), col.getW(i));
    }
  }
  const mk = (p: number[], n: number[], c: number[]) => {
    const out = new BufferGeometry();
    out.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
    out.setAttribute('normal', new BufferAttribute(new Float32Array(n), 3));
    out.setAttribute('aColor', new BufferAttribute(new Float32Array(c), 4));
    out.computeBoundingSphere();
    return out;
  };
  return { crown: mk(cp, cn, cc), trunk: tp.length ? mk(tp, tn, tc) : null };
}
