/**
 * Piccole utilità numeriche e un generatore pseudo-casuale con seme
 * (così i suoni procedurali sono riproducibili nei test).
 */
import type { Vec3 } from './tipi';

/** Generatore pseudo-casuale: restituisce numeri in [0, 1). */
export type Rng = () => number;

/** mulberry32: veloce, buono per il suono, deterministico dato il seme. */
export function creaRng(seme: number): Rng {
  let s = seme >>> 0 || 0x9e3779b9;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Numero uniforme in [a, b). */
export function tra(rng: Rng, a: number, b: number): number {
  return a + (b - a) * rng();
}

/** Intero uniforme in [a, b] (estremi inclusi). */
export function intero(rng: Rng, a: number, b: number): number {
  return Math.floor(a + (b - a + 1) * rng());
}

/** Elemento a caso di una lista non vuota. */
export function scegli<T>(rng: Rng, lista: readonly T[]): T {
  const v = lista[Math.floor(rng() * lista.length)];
  return v === undefined ? (lista[0] as T) : v;
}

/** Scelta pesata: `pesi` della stessa lunghezza di `lista`. */
export function scegliPesato<T>(rng: Rng, lista: readonly T[], pesi: readonly number[]): T {
  let totale = 0;
  for (const p of pesi) totale += Math.max(0, p);
  let r = rng() * totale;
  for (let i = 0; i < lista.length; i++) {
    r -= Math.max(0, pesi[i] ?? 0);
    if (r <= 0) return lista[i] as T;
  }
  return lista[lista.length - 1] as T;
}

/** Limita x all'intervallo [a, b]. */
export function limita(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}

/** Interpolazione lineare. */
export function mescola(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep di Hermite fra e0 ed e1 (funziona anche con e0 > e1). */
export function liscia(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = limita((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Decibel → guadagno lineare. */
export function dbAGuadagno(db: number): number {
  return Math.pow(10, db / 20);
}

/** Guadagno lineare → decibel (−Infinity per 0). */
export function guadagnoADb(g: number): number {
  return g <= 0 ? -Infinity : 20 * Math.log10(g);
}

/** Da nota MIDI a frequenza in Hz (La4 = 69 = 440 Hz). */
export function midiAHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Modulo sempre positivo. */
export function modulo(x: number, m: number): number {
  return ((x % m) + m) % m;
}

// ---- vettori ----

export function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}
export function somma(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function scala(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}
export function punto(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function vettoriale(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
export function lunghezza(a: Vec3): number {
  return Math.hypot(a.x, a.y, a.z);
}
export function normalizza(a: Vec3, riserva: Vec3 = { x: 0, y: 0, z: 1 }): Vec3 {
  const l = lunghezza(a);
  return l > 1e-9 && Number.isFinite(l) ? scala(a, 1 / l) : { ...riserva };
}
export function distanza(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
