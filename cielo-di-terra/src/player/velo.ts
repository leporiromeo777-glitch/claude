/**
 * Il Velo: ala di stoffa per planare. Modello aerodinamico semplice nel
 * riferimento rotante (l'aria ruota con il cilindro, quindi la velocità
 * dell'aria è la velocità del giocatore meno il vento delle correnti calde).
 *
 * - portanza perpendicolare alla velocità rispetto all'aria, nel piano che
 *   contiene il "su" dello sguardo (la normale dell'ala);
 * - incidenza = angolo fra lo sguardo e la traiettoria (guardare in giù = picchiata);
 * - resistenza parabolica cd = cd0 + k cl^2;
 * - virata: la traiettoria orizzontale segue la direzione dello sguardo.
 */
import { Vector3 } from 'three';
import { R } from '../world/constants';
import { smoothstep } from '../world/noise';
import { VELO_TUNABLES, type VeloTunables } from './tunables';

/** Vento delle correnti calde della Linea nel punto p (verso l'asse). */
export function thermalWind(p: Vector3, t: VeloTunables = VELO_TUNABLES, strength = 1, out: Vector3 = new Vector3()): Vector3 {
  const r = Math.hypot(p.x, p.y);
  const h = R - r;
  if (r < 1e-3 || strength <= 0) return out.set(0, 0, 0);
  const s = t.thermalSpeed * strength * smoothstep(t.thermalFrom, t.thermalFull, h) * (1 - smoothstep(t.thermalTo - 15, t.thermalTo, h));
  return out.set((-p.x / r) * s, (-p.y / r) * s, 0);
}

const _air = new Vector3();
const _vh = new Vector3();
const _l = new Vector3();
const _fh = new Vector3();
const _side = new Vector3();

export interface GlideDebug {
  airspeed: number;
  alphaDeg: number;
  cl: number;
  cd: number;
}

/**
 * Accelerazione aerodinamica del Velo (m/s^2).
 * @param vel velocità del giocatore (riferimento rotante)
 * @param wind vento locale (correnti calde)
 * @param forward direzione dello sguardo
 * @param wingUp "su" dello sguardo (normale dell'ala)
 * @param up "su" locale (verso l'asse) per la virata
 */
export function veloAcceleration(
  vel: Vector3,
  wind: Vector3,
  forward: Vector3,
  wingUp: Vector3,
  up: Vector3,
  t: VeloTunables = VELO_TUNABLES,
  out: Vector3 = new Vector3(),
  dbg?: GlideDebug,
): Vector3 {
  out.set(0, 0, 0);
  _air.subVectors(vel, wind);
  const s = _air.length();
  if (s < 0.05) {
    if (dbg) Object.assign(dbg, { airspeed: s, alphaDeg: 0, cl: 0, cd: 0 });
    return out;
  }
  _vh.copy(_air).multiplyScalar(1 / s); // direzione della traiettoria rispetto all'aria
  // apertura alare = destra dello sguardo; la portanza è perpendicolare a traiettoria e apertura
  _side.crossVectors(forward, wingUp);
  _l.crossVectors(_side, _vh);
  if (_l.lengthSq() < 1e-8) {
    // traiettoria lungo l'apertura (scivolata d'ala): usa il "su" dell'ala
    _l.copy(wingUp).addScaledVector(_vh, -wingUp.dot(_vh));
  }
  _l.normalize();
  if (_l.dot(wingUp) < 0) _l.negate();
  // incidenza geometrica: lo sguardo sopra la traiettoria = positiva
  const alphaGeom = Math.atan2(forward.dot(_l), forward.dot(_vh));
  // l'ala di stoffa si "autoregola": l'incidenza efficace resta sotto lo stallo;
  // guardare molto sopra la traiettoria frena (richiamata), non stalla
  const stall = t.stallDeg * (Math.PI / 180);
  const alphaMax = stall * 0.9;
  const alpha = Math.min(alphaMax, Math.max(-0.22, alphaGeom));
  let cl = t.cl0 + t.clAlpha * alpha;
  cl = Math.min(t.clMax, Math.max(t.clMin, cl));
  const flare = Math.max(0, alphaGeom - alphaMax);
  const cd = t.cd0 + t.kInduced * cl * cl + Math.min(1.2, flare * 0.6);
  const q = t.aeroK * s * s;
  out.addScaledVector(_l, q * cl).addScaledVector(_vh, -q * cd);
  // virata: porta la traiettoria orizzontale verso lo sguardo orizzontale
  _fh.copy(forward).addScaledVector(up, -forward.dot(up));
  const fl = _fh.length();
  _vh.copy(_air).addScaledVector(up, -_air.dot(up));
  const vl = _vh.length();
  if (fl > 1e-3 && vl > 0.3) {
    _fh.multiplyScalar(1 / fl);
    _vh.multiplyScalar(1 / vl);
    _side.copy(_fh).addScaledVector(_vh, -_fh.dot(_vh));
    out.addScaledVector(_side, t.turnRate * vl);
  }
  if (dbg) {
    dbg.airspeed = s;
    dbg.alphaDeg = (alpha * 180) / Math.PI;
    dbg.cl = cl;
    dbg.cd = cd;
  }
  return out;
}
