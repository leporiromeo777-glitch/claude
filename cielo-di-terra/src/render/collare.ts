/**
 * Il Collare: l'anello di nubi a chiazze attorno al raggio R - 300.
 * Nubi stilizzate fatte di masse tonde schiacciate (carta velina), una sola
 * InstancedMesh: una chiamata di disegno.
 */
import { BufferAttribute, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4 } from 'three';
import { L, LAYOUT, METERS_PER_DEG, R } from '../world/constants';
import { Simplex3, mulberry32 } from '../world/noise';
import { capMeanHeight } from '../world/terrainProfile';
import type { WorldUniforms } from './uniforms';
import { createWorldMaterial } from './worldMaterial';
import { surfaceMatrix } from './placement';

const C = LAYOUT.collare;

export function createCollare(world: WorldUniforms): InstancedMesh {
  const geo = new IcosahedronGeometry(1, 2);
  const n = geo.getAttribute('position').count;
  const col = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    col[i * 4] = 0.97;
    col[i * 4 + 1] = 0.955;
    col[i * 4 + 2] = 0.93;
    col[i * 4 + 3] = 0;
  }
  geo.setAttribute('aColor', new BufferAttribute(col, 4));

  const rnd = mulberry32(C.seed);
  const noise = new Simplex3(C.seed + 11);
  const rc = R - C.height;
  const circ = 2 * Math.PI * rc;
  const nAround = Math.round(circ / C.patchSpacing);
  const mats: Matrix4[] = [];
  const tints: number[] = [];
  const m = new Matrix4();
  for (let z = C.patchSpacing / 2; z < L; z += C.patchSpacing) {
    for (let k = 0; k < nAround; k++) {
      const jz = z + (rnd() - 0.5) * C.patchSpacing * 0.8;
      const th = ((k + (rnd() - 0.5) * 0.8) / nAround) * 360;
      // niente nubi dentro le pareti dei Tappi
      if (capMeanHeight(jz) > C.height - 40) continue;
      const t = (th * Math.PI) / 180;
      const cov = noise.fbm((-Math.sin(t) * rc) / 420, (-Math.cos(t) * rc) / 420, jz / 420, 3) * 0.5 + 0.5;
      if (cov < 1 - C.coverage * 1.05) continue;
      const blobs = 3 + Math.floor(rnd() * 5);
      const size = 0.7 + rnd() * 0.7;
      for (let b = 0; b < blobs; b++) {
        const dz = (rnd() - 0.5) * 70 * size;
        const darc = (rnd() - 0.5) * 60 * size;
        const dh = (rnd() - 0.5) * C.thickness * 0.4;
        const bth = th + darc / ((rc / R) * METERS_PER_DEG);
        const sx = (16 + rnd() * 22) * size;
        const sz = (14 + rnd() * 20) * size;
        const sy = (5 + rnd() * 7) * size;
        surfaceMatrix(jz + dz, bth, C.height + dh, rnd() * 360, sx, sy, sz, m);
        mats.push(m.clone());
        const warm = rnd();
        tints.push(1.0, 0.985 + warm * 0.015, 0.97 + warm * 0.03);
      }
    }
  }
  const mesh = new InstancedMesh(geo, createWorldMaterial(world, { kind: 'cloud', tint: true, brush: 0.5 }), mats.length);
  mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
  geo.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(tints), 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  mesh.name = 'collare';
  return mesh;
}
