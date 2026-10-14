/**
 * FNV-1a a 32 bit (ARCHITETTURA 9): checksum dell'involucro dei salvataggi.
 * Lavora sulle unità UTF-16 della stringa, quindi è stabile fra browser e Node.
 */
export function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Checksum in esadecimale, 8 cifre minuscole. */
export function fnv1a32Hex(str: string): string {
  return fnv1a32(str).toString(16).padStart(8, '0');
}
