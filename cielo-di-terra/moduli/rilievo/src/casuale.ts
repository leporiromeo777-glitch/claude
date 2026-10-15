/**
 * Generatore pseudo-casuale con seme (mulberry32): la notte è deterministica e le
 * poche scelte (quali chiodi sposta la Notte dei Termini) dipendono solo dal seme.
 */
export function generatore(seme: number): () => number {
  let a = seme >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mescola una copia della lista (Fisher-Yates) con il generatore dato. */
export function mescola<T>(lista: readonly T[], rnd: () => number): T[] {
  const out = [...lista];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Combina il seme della partita con il numero della notte. */
export function semeNotte(seme: number, notte: number): number {
  let h = (seme ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ notte, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return Math.imul(h, 0xc2b2ae35) >>> 0;
}
