/**
 * Dove si siede un personaggio, dal PROFILO del suolo che gli passa il popolamento: le quote (m, rispetto
 * ai piedi della figura) del piano più alto sotto una fila di punti lungo la direzione in cui guarda,
 * panche comprese (src/popolamento/abitanti.ts, `profiloSeduta`). Da qui:
 *  - la seduta su uno SPIGOLO (panca, gradino, soglia): il primo spigolo vicino all'origine con un salto
 *    di almeno 10 cm davanti; le anche 12 cm dietro lo spigolo, a ANCA_SEDUTA·H sopra il piano; i piedi
 *    sul piano davanti;
 *  - altrimenti per TERRA (il selciato davanti al telo dell'Ombrista): le anche sul suolo, gambe raccolte.
 *
 * Più qualche correzione a mano per i posti dove la figura guarda storta rispetto alla panca (`CORREZIONI`):
 * solo la figura che si vede gira, la posizione e il cilindro del popolamento restano quelli.
 *
 * Gira in Node (niente WebGL): lo usano i test.
 */
import type { Seduta } from './animatore';

/** Quote del suolo lungo la direzione in cui guarda la figura: quote[i] a distanza inizio + i·passo (m). */
export interface ProfiloSuolo {
  readonly inizio: number;
  readonly passo: number;
  readonly quote: readonly number[];
}

/** Il campionamento che usa il popolamento: da 0,8 m dietro a 1,0 m davanti, ogni 10 cm. */
export const CAMPIONI_PROFILO = { inizio: -0.8, passo: 0.1, n: 19 } as const;

/** Salto minimo (m) davanti a un piano perché sia una seduta (la soglia di Pina è alta 14 cm). */
const SALTO_MINIMO = 0.1;
/** Le anche stanno questo tanto (m) dietro lo spigolo. */
const DIETRO_SPIGOLO = 0.12;

/**
 * Correzioni per id@luogo: `giro` (gradi, verso sinistra) della figura che si vede; `seduta` al posto di
 * quella del profilo, dove il sedile non è un collider (la soglia di Pina è solo disegnata).
 */
export const CORREZIONI: Readonly<Record<string, { giro?: number; seduta?: Seduta }>> = {
  // la panca davanti al portale di San Vigilio sta di sbieco (25° rispetto alla chiesa): Annunciata la
  // guarda storta di 27° (misurato nel gioco), le si gira la figura perché la panca le stia sotto le cosce
  'annunciata@san_vigilio': { giro: 27 },
  // la soglia di casa di Pina: la pietra alta 14 cm dietro di lei (da 0,3 m indietro), il selciato a 0,26
  // sopra l'origine della figura (il popolamento la mette 26 cm sotto, come la figura procedurale)
  'pina@soglia_pina': { seduta: { sedile: 0.4, piedi: 0.26, avanti: -0.42, terra: false } },
};

function quota(p: ProfiloSuolo, d: number): number {
  const n = p.quote.length;
  const x = (d - p.inizio) / p.passo;
  const i = Math.max(0, Math.min(n - 1, Math.floor(x)));
  const j = Math.min(n - 1, i + 1);
  const f = Math.max(0, Math.min(1, x - i));
  // a gradini: niente interpolazione attraverso uno spigolo (si prende il più vicino)
  const a = p.quote[i] as number;
  const b = p.quote[j] as number;
  return Math.abs(a - b) > 0.05 ? (f < 0.5 ? a : b) : a + (b - a) * f;
}

function minimo(p: ProfiloSuolo, d0: number, d1: number): number {
  let m = Infinity;
  for (let d = d0; d <= d1 + 1e-6; d += p.passo * 0.5) m = Math.min(m, quota(p, d));
  return m;
}

/**
 * La seduta dal profilo del suolo (in metri, nel riferimento della figura). Senza profilo: una panca alta
 * 0,45 m con le anche 12 cm dietro l'origine (come le pagine di prova).
 */
export function sedutaDaProfilo(p: ProfiloSuolo | null | undefined): Seduta {
  if (!p || !p.quote.length) return { sedile: 0.45, piedi: 0, avanti: -DIETRO_SPIGOLO, terra: false };
  const q0 = quota(p, 0);
  // candidati per il sedile: vicino all'origine prima, poi via via più lontano (fino a 0,7 m dietro e 0,1
  // davanti); mai un gradino più alto di 15 cm di quello sotto l'origine (non si sale su quello dietro)
  const candidati: number[] = [0];
  for (let k = 1; k <= 7; k++) {
    candidati.push(-k * 0.1);
    if (k <= 1) candidati.push(k * 0.1);
  }
  for (const d of candidati) {
    const s = quota(p, d);
    if (s > q0 + 0.15) continue;
    const davanti = minimo(p, d + 0.15, d + 0.55);
    if (s - davanti < SALTO_MINIMO) continue;
    // lo spigolo: fin dove il piano resta alla stessa quota, andando avanti
    let e = d;
    while (e + 0.05 <= d + 0.5 && Math.abs(quota(p, e + 0.05) - s) < 0.04) e += 0.05;
    // uno spigolo lontano dall'origine sposterebbe troppo la figura dal suo posto (e dal cilindro)
    if (e > 0.45) continue;
    const piedi = minimo(p, e + 0.12, e + 0.5);
    return { sedile: s, piedi, avanti: e - DIETRO_SPIGOLO, terra: false };
  }
  // nessuno spigolo: per terra, le anche sopra l'origine
  const s = quota(p, 0);
  return { sedile: s, piedi: s, avanti: -0.05, terra: true };
}
