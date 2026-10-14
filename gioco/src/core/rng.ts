/**
 * Generatori pseudo-casuali deterministici (ARCHITETTURA 5.1, GDD 8.3).
 * Il motore non usa mai Math.random(): usa queste funzioni con un seme.
 *
 * - xmur3(str): funzione di hash che produce una sequenza di semi a 32 bit;
 * - sfc32(a, b, c, d): "Small Fast Counter", numeri in [0, 1);
 * - rngFromSeed(seme): xmur3 → quattro semi → sfc32 (con 15 estrazioni di riscaldamento).
 */

export type Rng = () => number;

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function sfc32(a: number, b: number, c: number, d: number): Rng {
  let s0 = a >>> 0;
  let s1 = b >>> 0;
  let s2 = c >>> 0;
  let s3 = d >>> 0;
  return () => {
    const t = (((s0 + s1) >>> 0) + s3) >>> 0;
    s3 = (s3 + 1) >>> 0;
    s0 = s1 ^ (s1 >>> 9);
    s1 = (s2 + (s2 << 3)) >>> 0;
    s2 = (s2 << 21) | (s2 >>> 11);
    s2 = (s2 + t) >>> 0;
    return t / 4294967296;
  };
}

export function rngFromSeed(seed: string): Rng {
  const h = xmur3(seed);
  const rng = sfc32(h(), h(), h(), h());
  for (let i = 0; i < 15; i++) rng();
  return rng;
}

/** Intero in [min, max] (estremi inclusi). */
export function intBetween(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Copia mescolata (Fisher-Yates): l'array di partenza non cambia. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/** Un elemento a caso. Lancia un errore se l'array è vuoto. */
export function pick<T>(arr: readonly T[], rng: Rng): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  return arr[Math.floor(rng() * arr.length)] as T;
}
