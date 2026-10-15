/**
 * Superfici dipinte per la libreria di oggetti (traccia «paese»).
 *
 * Il materiale del mondo (`render/superfici.ts`, traccia «luce») dipinge un motivo procedurale
 * secondo il tipo di superficie di ogni vertice (attributo `aSuperficie`): pietra a corsi, file di
 * piode, assi di legno, intonaco a calce, tessuto, ferro, ottone, vetro… Qui le scorciatoie per
 * i generatori: `SUP.PIETRA`, `sup(SUP.LEGNO, 0.6)` e le occlusioni cotte più comuni.
 *
 * Uso con il Costruttore: `b.aggiungi(geo, { colore, superficie: SUP.PIODE, occlusione: 0.1 })`.
 * Il Cantiere del popolamento porta l'attributo fino alle mesh cotte delle zone.
 */
import type * as THREE from 'three';
import { SUPERFICIE } from '../render/superfici';

export { SUPERFICIE };

/** I tipi di superficie (stessi valori di `SUPERFICIE`). */
export const SUP = SUPERFICIE;

/**
 * Valore dell'attributo per un tipo con la sua variante (seme del motivo in [0, 0.99]; per il
 * LEGNO una variante >= 0.5 vuol dire assi orizzontali). NESSUNA dichiarata vale 0.5.
 */
export function sup(tipo: number, variante = 0): number {
  if (tipo === SUPERFICIE.NESSUNA) return 0.5;
  return tipo + Math.min(0.99, Math.max(0, variante));
}

/** Legno ad assi orizzontali (ringhiere, assiti, lobbie, persiane). */
export function legnoOrizzontale(variante = 0): number {
  return SUPERFICIE.LEGNO + 0.5 + Math.min(0.49, Math.max(0, variante) * 0.49);
}

/** Legno ad assi verticali (porte, timpani, pali). */
export function legnoVerticale(variante = 0): number {
  return SUPERFICIE.LEGNO + Math.min(0.49, Math.max(0, variante) * 0.49);
}

/**
 * Occlusione al piede di un muro: buia sul suolo (y = 0), sparisce a `altezza` metri.
 * Il suolo qui è il piano y = 0 dell'oggetto.
 */
export function occlusionePiede(altezza = 1.1, forza = 0.5): (p: THREE.Vector3) => number {
  return (p) => {
    const t = Math.min(1, Math.max(0, p.y / altezza));
    return forza * (1 - t) * (1 - t);
  };
}

/** Occlusione che cresce verso l'alto (sotto una gronda o un balcone): da `y0` a `y1`. */
export function occlusioneSotto(y0: number, y1: number, forza = 0.3): (p: THREE.Vector3) => number {
  return (p) => {
    const t = Math.min(1, Math.max(0, (p.y - y0) / (y1 - y0 || 1)));
    return forza * t * t;
  };
}
