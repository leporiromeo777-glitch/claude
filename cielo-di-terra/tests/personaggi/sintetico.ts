/**
 * Un personaggio sintetico per le prove in Node: le 17 ossa del pilota con orientamenti di riposo
 * casuali (come quelli che esporta Blender), una scatoletta per osso pesata tutta su quell'osso, due
 * SkinnedMesh `lod0` e `lod1` sullo stesso scheletro e una texture di 2×2 pixel.
 */
import * as THREE from 'three';
import { NOMI_OSSA, PADRE, type NomeOsso } from '../../src/personaggi/ossa';

// attacchi a riposo (spazio modello: X sinistra, Y alto, Z avanti), posa ad A, altezza 1.62
export const ATTACCHI: Record<NomeOsso, [number, number, number]> = {
  bacino: [0, 0.86, 0],
  schiena: [0, 0.99, 0],
  petto: [0, 1.13, 0],
  collo: [0, 1.34, 0],
  testa: [0, 1.41, 0],
  braccioS: [0.24, 1.26, -0.02],
  avambraccioS: [0.32, 1.07, -0.03],
  manoS: [0.4, 0.87, 0],
  braccioD: [-0.24, 1.26, -0.02],
  avambraccioD: [-0.32, 1.07, -0.03],
  manoD: [-0.4, 0.87, 0],
  cosciaS: [0.07, 0.82, 0],
  stincoS: [0.08, 0.45, 0.01],
  piedeS: [0.08, 0.08, 0.02],
  cosciaD: [-0.07, 0.82, 0],
  stincoD: [-0.08, 0.45, 0.01],
  piedeD: [-0.08, 0.08, 0.02],
};

export function scheletro(seme = 7): { radice: THREE.Group; ossa: Map<NomeOsso, THREE.Bone> } {
  let s = seme;
  const caso = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const radice = new THREE.Group();
  const ossa = new Map<NomeOsso, THREE.Bone>();
  const W = new Map<NomeOsso, THREE.Quaternion>();
  for (const nome of NOMI_OSSA) {
    const b = new THREE.Bone();
    b.name = nome;
    const Wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(caso() * 3, caso() * 3, caso() * 3));
    W.set(nome, Wq);
    const p = new THREE.Vector3(...ATTACCHI[nome]);
    const padre = PADRE[nome];
    if (padre) {
      const Wp = W.get(padre) as THREE.Quaternion;
      const pp = new THREE.Vector3(...ATTACCHI[padre]);
      b.quaternion.copy(Wp.clone().invert().multiply(Wq));
      b.position.copy(p.sub(pp).applyQuaternion(Wp.clone().invert()));
      (ossa.get(padre) as THREE.Bone).add(b);
    } else {
      b.quaternion.copy(Wq);
      b.position.copy(p);
      radice.add(b);
    }
    ossa.set(nome, b);
  }
  radice.updateMatrixWorld(true);
  return { radice, ossa };
}

/** Il «modello» sintetico: radice con lod0, lod1 e lo scheletro. Altezza 1,62 (la testa arriva a 1,62). */
export function modelloSintetico(seme = 7): THREE.Group {
  const { radice, ossa } = scheletro(seme);
  const pos: number[] = [];
  const idx: number[] = [];
  const si: number[] = [];
  const sw: number[] = [];
  const uv: number[] = [];
  NOMI_OSSA.forEach((nome, i) => {
    const [x, y, z] = ATTACCHI[nome];
    // scatoletta: il busto e la testa più grandi (la testa arriva a 1,62, il petto sporge in avanti)
    const g =
      nome === 'testa'
        ? new THREE.BoxGeometry(0.18, 0.21, 0.2).translate(x, y + 0.105, z)
        : nome === 'petto'
          ? new THREE.BoxGeometry(0.34, 0.24, 0.24).translate(x, y, z + 0.02)
          : nome === 'piedeS' || nome === 'piedeD'
            ? new THREE.BoxGeometry(0.1, 0.08, 0.22).translate(x, 0.04, z + 0.05)
            : new THREE.BoxGeometry(0.08, 0.08, 0.08).translate(x, y, z);
    const p = g.getAttribute('position');
    const base = pos.length / 3;
    for (let k = 0; k < p.count; k++) {
      pos.push(p.getX(k), p.getY(k), p.getZ(k));
      si.push(i, 0, 0, 0);
      sw.push(1, 0, 0, 0);
      uv.push(0.5, 0.5);
    }
    const ix = g.getIndex() as THREE.BufferAttribute;
    for (let k = 0; k < ix.count; k++) idx.push(base + ix.getX(k));
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tex = new THREE.DataTexture(new Uint8Array([200, 160, 120, 255, 90, 70, 50, 255, 200, 160, 120, 255, 90, 70, 50, 255]), 2, 2, THREE.RGBAFormat);
  tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex });
  const bones = NOMI_OSSA.map((n) => ossa.get(n) as THREE.Bone);
  const scheletroT = new THREE.Skeleton(bones);
  for (const nome of ['lod0', 'lod1']) {
    const m = new THREE.SkinnedMesh(geo, mat);
    m.name = nome;
    radice.add(m);
    radice.updateMatrixWorld(true);
    m.bind(scheletroT);
  }
  radice.name = 'sintetico';
  return radice;
}
