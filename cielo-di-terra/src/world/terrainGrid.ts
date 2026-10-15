/**
 * Griglia parametrica del terreno.
 *
 * Il terreno è una funzione h(z, theta). Sui Tappi la quota sale fino quasi
 * all'asse, quindi una griglia uniforme in z darebbe triangoli lunghissimi sulle
 * pareti. Le righe della mesh sono perciò spaziate uniformemente nella lunghezza
 * d'arco "s" del profilo medio (z, Hmedio(z)): fitte sulle pareti, normali in valle.
 *
 * La stessa griglia (LOD 0) è usata dalla fisica (`groundHeight`) per avere i
 * piedi del giocatore esattamente sulla superficie disegnata.
 */
import { L } from './constants';
import { capMeanHeight } from './terrainProfile';

/** Numero di colonne di chunk attorno al cilindro (30 gradi ciascuna, allineate alle strisce). */
export const CHUNK_COLS = 12;
export const CHUNK_DEG = 360 / CHUNK_COLS;
/** Lunghezza d'arco indicativa di un chunk lungo il profilo (m). */
const CHUNK_S_TARGET = 300;
/** Righe e colonne di vertici per chunk al LOD 0 (poi dimezzate a ogni LOD). */
export const LOD0_ROWS = 96;
export const LOD0_COLS = 112;
export const LOD_COUNT = 4;

const TABLE_STEP = 1; // m in z
const tableN = Math.round(L / TABLE_STEP) + 1;
const sTable = new Float64Array(tableN);

(function buildTable() {
  let s = 0;
  let prevH = capMeanHeight(0);
  sTable[0] = 0;
  for (let i = 1; i < tableN; i++) {
    const z = i * TABLE_STEP;
    const hh = capMeanHeight(z);
    s += Math.hypot(TABLE_STEP, hh - prevH);
    sTable[i] = s;
    prevH = hh;
  }
})();

/** Lunghezza totale del profilo (m). */
export const S_TOTAL = sTable[tableN - 1]!;
/** Numero di righe di chunk. */
export const CHUNK_ROWS = Math.max(1, Math.round(S_TOTAL / CHUNK_S_TARGET));
/** Lunghezza d'arco di un chunk. */
export const CHUNK_S = S_TOTAL / CHUNK_ROWS;
/** Passo in s e in theta al LOD 0. */
export const DS0 = CHUNK_S / LOD0_ROWS;
export const DTHETA0 = CHUNK_DEG / LOD0_COLS;

/** s(z): lunghezza d'arco del profilo dal Tappo Sud fino a z. */
export function sAtZ(z: number): number {
  if (z <= 0) return 0;
  if (z >= L) return S_TOTAL;
  const f = z / TABLE_STEP;
  const i = Math.floor(f);
  const t = f - i;
  return sTable[i]! + (sTable[Math.min(i + 1, tableN - 1)]! - sTable[i]!) * t;
}

/** z(s): inversa di sAtZ (ricerca binaria sulla tabella). */
export function zAtS(s: number): number {
  if (s <= 0) return 0;
  if (s >= S_TOTAL) return L;
  let lo = 0;
  let hi = tableN - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (sTable[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const s0 = sTable[lo]!;
  const s1 = sTable[hi]!;
  const t = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
  return (lo + t) * TABLE_STEP;
}

/** Righe/colonne per chunk a un dato LOD. */
export function lodRows(lod: number): number {
  return LOD0_ROWS >> lod;
}
export function lodCols(lod: number): number {
  return LOD0_COLS >> lod;
}
