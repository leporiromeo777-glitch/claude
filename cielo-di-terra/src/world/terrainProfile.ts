/**
 * Profili medi dei due Tappi (senza rumore né gradoni), in funzione di z.
 * Il Tappo Sud sale a conca (dolce in basso, ripido verso l'asse) con gli
 * Alpeggi a gradoni; il Sordo (Tappo Nord) è una parete ripida di roccia grigia.
 */
import { L, LAYOUT, R } from './constants';

const S = LAYOUT.endCaps.south;
const N = LAYOUT.endCaps.north;

/** Quota massima raggiungibile da un Tappo: si ferma al mozzo attorno all'asse. */
export const SOUTH_TOP = R - S.hubRadius;
export const NORTH_TOP = R - N.hubRadius;

/** Parametro t del Tappo Sud: 0 alla base, 1 sulla parete terminale (z = 0). */
export function southT(z: number): number {
  return z >= S.baseZ ? 0 : Math.min(1, (S.baseZ - z) / S.baseZ);
}

/** Parametro t del Sordo: 0 alla base, 1 sulla parete terminale (z = L). */
export function northT(z: number): number {
  return z <= N.baseZ ? 0 : Math.min(1, (z - N.baseZ) / (L - N.baseZ));
}

/** Profilo medio del Tappo Sud. */
export function southProfile(z: number): number {
  const t = southT(z);
  return t <= 0 ? 0 : SOUTH_TOP * Math.pow(t, S.profileExponent);
}

/** Profilo medio del Sordo: parete ripida che si addolcisce appena in cima. */
export function northProfile(z: number): number {
  const t = northT(z);
  if (t <= 0) return 0;
  // piede raccordato (primi 4%) e poi parete
  const foot = Math.min(1, t / 0.04);
  const wall = Math.pow(t, N.profileExponent);
  return NORTH_TOP * wall * (0.35 + 0.65 * foot * foot * (3 - 2 * foot));
}

/** Quota media dei Tappi a z (0 nella parte centrale del cilindro). */
export function capMeanHeight(z: number): number {
  return Math.max(southProfile(z), northProfile(z));
}
