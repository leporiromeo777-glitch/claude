/**
 * Generatore pseudo-casuale deterministico (mulberry32) con qualche aiuto.
 * Lo stesso seme produce sempre la stessa sequenza, su qualunque macchina.
 */

export type Seme = number | string;

/** Trasforma un seme (numero o stringa) in un intero a 32 bit senza segno. */
export function semeNumerico(s: Seme): number {
  if (typeof s === 'number') {
    // mescola anche i numeri piccoli (1, 2, 3…) perché diano sequenze ben diverse
    let h = (Math.floor(s) ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (h ^ (h >>> 16)) >>> 0;
  }
  // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Rng {
  private stato: number;
  readonly seme: number;

  constructor(seme: Seme = 1) {
    this.seme = semeNumerico(seme);
    this.stato = this.seme;
  }

  /** numero in [0, 1) */
  next(): number {
    let t = (this.stato = (this.stato + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** numero in [a, b) */
  tra(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  /** intero in [a, b] (estremi compresi) */
  intero(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  /** vero con probabilità p */
  prob(p: number): boolean {
    return this.next() < p;
  }

  /** -1 o +1 */
  segno(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** valore in [-a, a] */
  centrato(a: number): number {
    return (this.next() * 2 - 1) * a;
  }

  /** gaussiana approssimata (somma di tre uniformi), media 0, deviazione ~1 */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }

  scegli<T>(lista: readonly T[]): T {
    return lista[Math.floor(this.next() * lista.length)] as T;
  }

  /** nuovo generatore indipendente, derivato da questo e da un'etichetta */
  derivato(etichetta: string): Rng {
    return new Rng((this.seme ^ semeNumerico(etichetta)) >>> 0);
  }
}

/** hash deterministico di una posizione (per rumore coerente sui vertici condivisi) */
export function hashPosizione(x: number, y: number, z: number, seme = 0): number {
  const xi = Math.round(x * 1000) | 0;
  const yi = Math.round(y * 1000) | 0;
  const zi = Math.round(z * 1000) | 0;
  let h = (seme ^ 0x27d4eb2d) >>> 0;
  h = Math.imul(h ^ xi, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ yi, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ zi, 0x27d4eb2f);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
