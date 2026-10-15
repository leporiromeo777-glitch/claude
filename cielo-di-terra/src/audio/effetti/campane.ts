/**
 * Le campane di San Vigilio: sintesi a parziali inarmonici (campione generato in codice
 * una volta per nota), rintocchi delle ore e suono a festa.
 */
import { limita, tra } from '../util';
import { invia, pulisci, pulisciA, type Destinazione, type Kit } from '../sintesi/kit';

/** Nota di percussione della campana delle ore (Sol3, 196 Hz; il «hum» suona un'ottava sotto). */
export const CAMPANA_ORE = 196;
/** Le tre campane del concerto, dalla più acuta alla più grave (Re4, Si3, Sol3). */
export const CONCERTO = [293.66, 246.94, 196] as const;
/** Intervallo fra i rintocchi delle ore (s). */
export const INTERVALLO_ORE = 2.6;

/** Un colpo di campana. Restituisce l'istante di fine (la coda dura ~7 s). */
export function campana(kit: Kit, dest: Destinazione, t: number, prime: number, forza = 1, mandata = 0.42): number {
  const s = kit.ctx.createBufferSource();
  s.buffer = kit.campana(prime);
  s.playbackRate.value = tra(kit.rng, 0.998, 1.002);
  const lp = kit.filtro('lowpass', 3800, 0.5);
  const g = kit.guadagno(0.5 * limita(forza, 0, 1.2));
  s.connect(lp).connect(g);
  const m = invia(kit, g, dest, mandata);
  const fine = t + s.buffer.duration / s.playbackRate.value;
  s.start(t);
  pulisci(s, [s, lp, g]);
  if (m) pulisciA(kit, fine, [m]);
  return fine;
}

/** Batte le ore: `ore` rintocchi (1-12) della campana grave. */
export function batteOre(kit: Kit, dest: Destinazione, t: number, ore: number): number {
  const n = limita(Math.round(ore), 1, 12);
  let fine = t;
  for (let i = 0; i < n; i++) {
    const forza = 0.9 * tra(kit.rng, 0.94, 1.02) * (i === n - 1 ? 0.95 : 1);
    fine = Math.max(fine, campana(kit, dest, t + i * INTERVALLO_ORE + tra(kit.rng, 0, 0.05), CAMPANA_ORE, forza));
  }
  return fine;
}

/** Un solo rintocco. */
export function rintocco(kit: Kit, dest: Destinazione, t: number): number {
  return campana(kit, dest, t, CAMPANA_ORE, 0.85);
}

/**
 * Suono a festa: le tre campane del concerto in giri discendenti che si scambiano
 * di posto ogni tanto, come suonate a mano; l'ultimo giro si spegne.
 */
export function festa(kit: Kit, dest: Destinazione, t: number, durata = 12): number {
  const r = kit.rng;
  const ordine = [0, 1, 2];
  const passo = 0.62;
  const colpi = Math.max(3, Math.floor(durata / passo));
  let fine = t;
  for (let i = 0; i < colpi; i++) {
    const pos = i % 3;
    if (pos === 0 && i > 0 && r() < 0.45) {
      // scambio di due campane vicine, come nei «cambi»
      const a = Math.floor(r() * 2);
      const tmp = ordine[a] as number;
      ordine[a] = ordine[a + 1] as number;
      ordine[a + 1] = tmp;
    }
    const indice = ordine[pos] as number;
    const coda = i >= colpi - 4 ? 0.55 + 0.1 * (colpi - i) : 1;
    const accento = pos === 0 ? 1 : 0.85;
    const x = t + i * passo + tra(r, -0.025, 0.025) + (pos === 0 && i > 0 ? 0.08 : 0);
    fine = Math.max(fine, campana(kit, dest, Math.max(t, x), CONCERTO[indice] as number, 0.62 * accento * coda, 0.38));
  }
  return fine;
}
