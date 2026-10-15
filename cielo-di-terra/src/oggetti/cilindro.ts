/**
 * Posare gli oggetti sulla superficie interna del cilindro.
 *
 * Stessa parametrizzazione del motore (src/world/cylinder.ts):
 *   x = −r·sin θ,  y = −r·cos θ,  z = z,   r = R − h
 *   su    = ( sin θ,  cos θ, 0)   (verso l'asse)
 *   est   = (−cos θ,  sin θ, 0)   («a Mane»)
 *   nord  = (0, 0, 1)             («a Lag»)
 *
 * Gli oggetti di questa libreria hanno il «davanti» verso +Z locale: con yaw = 0 il davanti
 * guarda a nord; lo yaw positivo ruota da nord verso est (come una bussola, come il motore).
 * NB: le geometrie del motore guardano −Z; se si usa `surfaceMatrix` del motore con questi oggetti
 * bisogna aggiungere 180° allo yaw (oppure usare `matriceSuperficie` qui sotto).
 */
import * as THREE from 'three';
import type { Collider } from './tipi';

/** Raggio interno del cilindro (m), identico al motore. */
export const R_CILINDRO = 646;
/** Lunghezza utile lungo l'asse (m). */
export const L_CILINDRO = 3000;
/** Periodo di rotazione (s). */
export const PERIODO_ROTAZIONE = 51;

const DEG = Math.PI / 180;

export interface Terna {
  su: THREE.Vector3;
  est: THREE.Vector3;
  nord: THREE.Vector3;
}

/** Terna locale (su, est, nord) all'angolo θ in gradi. */
export function terna(thetaGradi: number): Terna {
  const t = thetaGradi * DEG;
  return {
    su: new THREE.Vector3(Math.sin(t), Math.cos(t), 0),
    est: new THREE.Vector3(-Math.cos(t), Math.sin(t), 0),
    nord: new THREE.Vector3(0, 0, 1),
  };
}

/** Punto della superficie a (z, θ) e quota h sopra il fondo. */
export function puntoCilindro(z: number, thetaGradi: number, h = 0, R = R_CILINDRO, out = new THREE.Vector3()): THREE.Vector3 {
  const r = R - h;
  const t = thetaGradi * DEG;
  return out.set(-r * Math.sin(t), -r * Math.cos(t), z);
}

/**
 * Matrice che porta un oggetto della libreria (su = +Y, davanti = +Z) al punto (z, θ, h)
 * con il davanti orientato secondo `yawGradi` (0 = nord/Lag, 90 = est/Mane).
 */
export function matriceSuperficie(z: number, thetaGradi: number, h = 0, yawGradi = 0, scala = 1, R = R_CILINDRO, out = new THREE.Matrix4()): THREE.Matrix4 {
  const f = terna(thetaGradi);
  const y = yawGradi * DEG;
  const avanti = f.nord.clone().multiplyScalar(Math.cos(y)).addScaledVector(f.est, Math.sin(y));
  const destra = new THREE.Vector3().crossVectors(f.su, avanti); // X locale = su × avanti
  out.makeBasis(destra.multiplyScalar(scala), f.su.clone().multiplyScalar(scala), avanti.multiplyScalar(scala));
  out.setPosition(puntoCilindro(z, thetaGradi, h, R));
  return out;
}

/** Posa un Object3D (di solito `oggetto.gruppo`) sul cilindro. */
export function posaSulCilindro(obj: THREE.Object3D, z: number, thetaGradi: number, h = 0, yawGradi = 0, R = R_CILINDRO): THREE.Object3D {
  const m = matriceSuperficie(z, thetaGradi, h, yawGradi, 1, R);
  m.decompose(obj.position, obj.quaternion, obj.scale);
  obj.updateMatrix();
  return obj;
}

/** Collider nel formato del motore (src/world/colliders.ts), in coordinate mondo. */
export type ColliderMondo =
  | { kind: 'box'; center: THREE.Vector3; right: THREE.Vector3; up: THREE.Vector3; forward: THREE.Vector3; half: THREE.Vector3; tag?: string }
  | { kind: 'cylinder'; base: THREE.Vector3; up: THREE.Vector3; radius: number; height: number; tag?: string };

/**
 * Porta un collider locale nel mondo con la matrice dell'oggetto (rotazione + traslazione, scala
 * uniforme ammessa). I cilindri restano «verticali» rispetto al su locale dell'oggetto.
 */
export function colliderAlMondo(c: Collider, matrice: THREE.Matrix4): ColliderMondo {
  const pos = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  matrice.decompose(pos, q, s);
  const k = s.x;
  const su = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  if (c.tipo === 'box') {
    const r = c.rotY ?? 0;
    const asseX = new THREE.Vector3(Math.cos(r), 0, -Math.sin(r)).applyQuaternion(q);
    const asseZ = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)).applyQuaternion(q);
    const centro = new THREE.Vector3(...c.centro).applyMatrix4(matrice);
    const out: ColliderMondo = {
      kind: 'box',
      center: centro,
      right: asseX,
      up: su,
      forward: asseZ,
      half: new THREE.Vector3(c.mezze[0] * k, c.mezze[1] * k, c.mezze[2] * k),
    };
    if (c.tag) out.tag = c.tag;
    return out;
  }
  const out: ColliderMondo = {
    kind: 'cylinder',
    base: new THREE.Vector3(...c.base).applyMatrix4(matrice),
    up: su,
    radius: c.raggio * k,
    height: c.altezza * k,
  };
  if (c.tag) out.tag = c.tag;
  return out;
}
