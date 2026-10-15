/**
 * Matematica del cilindro di O'Neill (modulo "cilindro.ts" della Fase 0).
 *
 * Tutto il gioco vive nel riferimento ROTANTE solidale con il cilindro: le
 * coordinate del mondo three.js sono quelle rotanti. La fisica aggiunge quindi
 * le forze apparenti (centrifuga e Coriolis).
 *
 * Parametrizzazione (destrorsa, scelta perché la terna locale est-nord-su sia
 * destrorsa come una mappa: guardando "in giù" dall'asse, nord in alto e est a destra):
 *
 *   x = -r * sin(theta)
 *   y = -r * cos(theta)
 *   z = z
 *
 * con r = R - h. Per theta = 0 il fondo sta a y = -R e "su" punta a +Y, come in
 * una scena three.js qualunque. La rotazione del cilindro, vista nel riferimento
 * inerziale, fa crescere theta: il vettore velocità angolare è Omega = (0, 0, -omega).
 *
 * Terna locale in un punto:
 *   up    = verso l'asse          = ( sin t,  cos t, 0)
 *   east  = verso della rotazione = (-cos t,  sin t, 0)   ("a Mane")
 *   north = +z                    = (0, 0, 1)             ("a Lag")
 * e vale east x north = up.
 *
 * Accelerazioni apparenti nel riferimento rotante:
 *   centrifuga = -Omega x (Omega x p) = omega^2 * (x, y, 0)        (verso l'esterno)
 *   Coriolis   = -2 Omega x v        = 2 omega * (-v_y, v_x, 0)
 */
import { Vector3 } from 'three';
import { DEG, G_EARTH, L, OMEGA, R, RAD } from './constants';

/** Coordinate cilindriche di un punto. */
export interface CylCoords {
  /** Posizione lungo l'asse (m). */
  z: number;
  /** Angolo in gradi, normalizzato in [0, 360). */
  theta: number;
  /** Distanza dall'asse (m). */
  r: number;
  /** Quota sopra il fondo verso l'asse: h = R - r. */
  h: number;
}

/** Terna locale (versori). */
export interface LocalFrame {
  up: Vector3;
  east: Vector3;
  north: Vector3;
}

/** Riporta un angolo in gradi nell'intervallo [0, 360). */
export function wrapDeg(theta: number): number {
  const t = theta % 360;
  return t < 0 ? t + 360 : t;
}

/** Differenza angolare con segno più breve (b - a) in gradi, in (-180, 180]. */
export function deltaDeg(a: number, b: number): number {
  let d = (b - a) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Punto del mondo a (z, theta, h). */
export function cylToWorld(z: number, thetaDeg: number, h: number, out: Vector3 = new Vector3()): Vector3 {
  const r = R - h;
  const t = thetaDeg * DEG;
  return out.set(-r * Math.sin(t), -r * Math.cos(t), z);
}

/** Punto del mondo a (z, theta) e distanza r dall'asse. */
export function cylToWorldR(z: number, thetaDeg: number, r: number, out: Vector3 = new Vector3()): Vector3 {
  const t = thetaDeg * DEG;
  return out.set(-r * Math.sin(t), -r * Math.cos(t), z);
}

/** Angolo theta (gradi, [0,360)) di un punto qualsiasi del mondo. */
export function thetaOf(x: number, y: number): number {
  // x = -r sin t, y = -r cos t  =>  t = atan2(-x, -y)
  return wrapDeg(Math.atan2(-x, -y) * RAD);
}

/** Coordinate cilindriche di un punto del mondo. */
export function worldToCyl(p: { x: number; y: number; z: number }, out?: CylCoords): CylCoords {
  const r = Math.hypot(p.x, p.y);
  const res = out ?? { z: 0, theta: 0, r: 0, h: 0 };
  res.z = p.z;
  res.r = r;
  res.h = R - r;
  res.theta = r > 1e-9 ? thetaOf(p.x, p.y) : 0;
  return res;
}

/** Versore "su" (verso l'asse) per l'angolo theta. */
export function upAt(thetaDeg: number, out: Vector3 = new Vector3()): Vector3 {
  const t = thetaDeg * DEG;
  return out.set(Math.sin(t), Math.cos(t), 0);
}

/** Versore "est" (verso della rotazione) per l'angolo theta. */
export function eastAt(thetaDeg: number, out: Vector3 = new Vector3()): Vector3 {
  const t = thetaDeg * DEG;
  return out.set(-Math.cos(t), Math.sin(t), 0);
}

/**
 * Terna locale nel punto p. Sull'asse (r ~ 0) la direzione "su" non è definita:
 * si usa il valore di ripiego `fallbackTheta`.
 */
export function localFrameAt(p: { x: number; y: number }, out?: LocalFrame, fallbackTheta = 0): LocalFrame {
  const f = out ?? { up: new Vector3(), east: new Vector3(), north: new Vector3() };
  const r = Math.hypot(p.x, p.y);
  if (r < 1e-6) {
    upAt(fallbackTheta, f.up);
    eastAt(fallbackTheta, f.east);
  } else {
    f.up.set(-p.x / r, -p.y / r, 0);
    f.east.set(-f.up.y, f.up.x, 0);
  }
  f.north.set(0, 0, 1);
  return f;
}

/** Terna locale per (theta) in gradi. */
export function localFrameTheta(thetaDeg: number, out?: LocalFrame): LocalFrame {
  const f = out ?? { up: new Vector3(), east: new Vector3(), north: new Vector3() };
  upAt(thetaDeg, f.up);
  eastAt(thetaDeg, f.east);
  f.north.set(0, 0, 1);
  return f;
}

/** Accelerazione centrifuga nel punto p (m/s^2), verso l'esterno: omega^2 * r_perp. */
export function centrifugal(p: { x: number; y: number }, out: Vector3 = new Vector3()): Vector3 {
  const w2 = OMEGA * OMEGA;
  return out.set(w2 * p.x, w2 * p.y, 0);
}

/** Accelerazione di Coriolis per la velocità v (nel riferimento rotante): -2 Omega x v. */
export function coriolis(v: { x: number; y: number }, out: Vector3 = new Vector3()): Vector3 {
  const k = 2 * OMEGA;
  return out.set(-k * v.y, k * v.x, 0);
}

/**
 * Accelerazione apparente totale = centrifuga + fattore * Coriolis.
 * `coriolisFactor` permette il Coriolis ridotto sul corpo del giocatore (0.4).
 */
export function apparentAcceleration(
  p: { x: number; y: number },
  v: { x: number; y: number },
  coriolisFactor = 1,
  out: Vector3 = new Vector3(),
): Vector3 {
  const w2 = OMEGA * OMEGA;
  const k = 2 * OMEGA * coriolisFactor;
  return out.set(w2 * p.x - k * v.y, w2 * p.y + k * v.x, 0);
}

/** Modulo della gravità apparente a quota h (m/s^2). Lineare: zero sull'asse. */
export function gravityAtHeight(h: number): number {
  return OMEGA * OMEGA * Math.max(0, R - h);
}

/** Gravità apparente a quota h espressa in g terrestri. */
export function gravityInG(h: number): number {
  return gravityAtHeight(h) / G_EARTH;
}

/** Quota alla quale la gravità vale `g` (in g terrestri). */
export function heightForGravity(gInG: number): number {
  return R - (gInG * G_EARTH) / (OMEGA * OMEGA);
}

/** Lunghezza d'arco (m) fra due angoli a distanza r dall'asse (percorso più breve). */
export function arcLength(thetaA: number, thetaB: number, r = R): number {
  return Math.abs(deltaDeg(thetaA, thetaB)) * DEG * r;
}

/** Distanza "sul foglio" (z, arco sul fondo) fra due punti cilindrici, con avvolgimento in theta. */
export function surfaceDistance(zA: number, thetaA: number, zB: number, thetaB: number): number {
  const dz = zB - zA;
  const ds = deltaDeg(thetaA, thetaB) * DEG * R;
  return Math.hypot(dz, ds);
}

/** True se z è dentro la lunghezza del cilindro. */
export function insideLength(z: number): boolean {
  return z >= 0 && z <= L;
}

/**
 * Trasforma una direzione dal riferimento rotante a quello inerziale al tempo t
 * (s), assumendo i due riferimenti coincidenti a t = 0. Serve per il cielo
 * stellato delle Finestre: nel riferimento rotante le stelle girano con periodo T.
 */
export function rotatingToInertialDir(d: Vector3, t: number, out: Vector3 = new Vector3()): Vector3 {
  // Il cilindro ruota attorno a z di -omega*t (Omega = -omega z).
  const a = -OMEGA * t;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return out.set(c * d.x - s * d.y, s * d.x + c * d.y, d.z);
}
