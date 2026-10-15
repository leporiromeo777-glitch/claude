/**
 * Geometria del cilindro e del suolo per il piazzamento.
 *
 * Coordinate del gioco: (z, theta, h). z lungo l'asse (+z = nord = «a Lag»), theta in gradi
 * (+theta = est = «a Mane»), h quota verso l'asse sopra il fondo (r = R − h).
 * In questo modulo «yaw» segue la bussola del motore: 0 = nord, 90 = est.
 *
 * Gli spostamenti locali sono in metri misurati alla quota del punto (l'arco di 1° vale
 * (R − h)·π/180 m, non METERS_PER_DEG che è riferito al fondo).
 */
import { Vector3 } from 'three';
import { DEG, R } from '../../../src/world/constants';
import { cylToWorld, deltaDeg, localFrameTheta, worldToCyl, wrapDeg } from '../../../src/world/cylinder';
import { groundHeight } from '../../../src/world/terrain';

export interface PuntoCil {
  z: number;
  theta: number;
}

export interface PuntoCilH extends PuntoCil {
  h: number;
}

/** Quota del suolo coerente con la fisica del motore. */
export function suolo(z: number, theta: number): number {
  return groundHeight(z, theta);
}

/** Metri di arco per grado alla quota h. */
export function metriPerGrado(h = 0): number {
  return (R - h) * DEG;
}

/** Sposta (z, theta) di `nord` metri lungo +z e `est` metri lungo +theta (alla quota h). */
export function sposta(z: number, theta: number, nord: number, est: number, h = 40): PuntoCil {
  return { z: z + nord, theta: wrapDeg(theta + est / metriPerGrado(h)) };
}

/** Sposta lungo una direzione di bussola (gradi) di `d` metri. */
export function spostaYaw(z: number, theta: number, yawDeg: number, d: number, h = 40): PuntoCil {
  const y = yawDeg * DEG;
  return sposta(z, theta, Math.cos(y) * d, Math.sin(y) * d, h);
}

/** Differenza (nord, est) in metri da a a b. */
export function differenza(a: PuntoCil, b: PuntoCil, h = 40): { nord: number; est: number } {
  return { nord: b.z - a.z, est: deltaDeg(a.theta, b.theta) * metriPerGrado(h) };
}

/** Distanza sul suolo (m) fra due punti. */
export function distanza(a: PuntoCil, b: PuntoCil, h = 40): number {
  const d = differenza(a, b, h);
  return Math.hypot(d.nord, d.est);
}

/** Yaw (bussola, gradi) da a verso b. */
export function yawVerso(a: PuntoCil, b: PuntoCil, h = 40): number {
  const d = differenza(a, b, h);
  return Math.atan2(d.est, d.nord) / DEG;
}

/** Punto mondo a (z, theta) e quota sopra il suolo `sopra`. */
export function mondoSulSuolo(z: number, theta: number, sopra = 0, out = new Vector3()): Vector3 {
  return cylToWorld(z, theta, groundHeight(z, theta) + sopra, out);
}

/** Punto mondo a quota assoluta. */
export function mondo(z: number, theta: number, h: number, out = new Vector3()): Vector3 {
  return cylToWorld(z, theta, h, out);
}

/** Da mondo a (z, theta, h). */
export function cil(p: Vector3): PuntoCilH {
  const c = worldToCyl(p);
  return { z: c.z, theta: c.theta, h: c.h };
}

/** Quota minima e massima del suolo sotto un rettangolo (larghezza lungo «destra», profondità lungo «avanti»). */
export function impronta(z: number, theta: number, yawDeg: number, larghezza: number, profondita: number, h = 40): { min: number; max: number; media: number } {
  let min = Infinity;
  let max = -Infinity;
  let somma = 0;
  let n = 0;
  const y = yawDeg * DEG;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const a = (j / 4) * profondita; // avanti
      const r = (i / 4) * larghezza; // destra
      const nord = a * Math.cos(y) - r * Math.sin(y);
      const est = a * Math.sin(y) + r * Math.cos(y);
      const p = sposta(z, theta, nord, est, h);
      const q = groundHeight(p.z, p.theta);
      min = Math.min(min, q);
      max = Math.max(max, q);
      somma += q;
      n++;
    }
  }
  return { min, max, media: somma / n };
}

/** Yaw della massima discesa del suolo (verso valle). */
export function yawValle(z: number, theta: number, passo = 3): number {
  const h = groundHeight(z, theta);
  const dth = passo / metriPerGrado(h);
  const gz = (groundHeight(z + passo, theta) - groundHeight(z - passo, theta)) / (2 * passo);
  const ge = (groundHeight(z, theta + dth) - groundHeight(z, theta - dth)) / (2 * passo);
  return Math.atan2(-ge, -gz) / DEG;
}

/** Pendenza media (m/m) del suolo attorno al punto. */
export function pendenza(z: number, theta: number, passo = 3): number {
  const h = groundHeight(z, theta);
  const dth = passo / metriPerGrado(h);
  const gz = (groundHeight(z + passo, theta) - groundHeight(z - passo, theta)) / (2 * passo);
  const ge = (groundHeight(z, theta + dth) - groundHeight(z, theta - dth)) / (2 * passo);
  return Math.hypot(gz, ge);
}

/** Terna locale (su, est, nord) a theta. */
export function terna(theta: number) {
  return localFrameTheta(theta);
}
