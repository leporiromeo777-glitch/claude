/**
 * Scheletro sintetico dei test dei personaggi: le 17 ossa di NOMI_OSSA negli attacchi di una figura di
 * 1,62 m in posa ad A, con orientamenti di riposo casuali (come quelli che esporta Blender).
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
