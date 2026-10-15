/**
 * Utilità per piazzare oggetti sulla superficie del cilindro.
 *
 * Convenzione delle geometrie locali (come three.js): +Y = "su" (verso l'asse),
 * -Z = davanti. A yaw 0 il davanti guarda a nord (Lag, +z) e +X è l'est (Mane);
 * lo yaw positivo ruota da nord verso est.
 */
import { Matrix4, Vector3 } from 'three';
import { DEG } from '../world/constants';
import { cylToWorld, localFrameTheta } from '../world/cylinder';

const _right = new Vector3();
const _fwd = new Vector3();
const _back = new Vector3();
const _p = new Vector3();

/** Matrice che porta una geometria locale al punto (z, theta, h) con yaw e scala. */
export function surfaceMatrix(z: number, theta: number, h: number, yawDeg: number, sx = 1, sy = 1, sz = 1, out: Matrix4 = new Matrix4()): Matrix4 {
  const f = localFrameTheta(theta);
  const yaw = yawDeg * DEG;
  _fwd.copy(f.north).multiplyScalar(Math.cos(yaw)).addScaledVector(f.east, Math.sin(yaw));
  _right.crossVectors(_fwd, f.up);
  _back.copy(_fwd).negate();
  out.makeBasis(_right.multiplyScalar(sx), f.up.multiplyScalar(sy), _back.multiplyScalar(sz));
  cylToWorld(z, theta, h, _p);
  out.setPosition(_p);
  return out;
}
