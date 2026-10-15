/**
 * L'accensione della Linea all'alba: «si accende dal Tappo Sud come una miccia».
 * Un soffio che sale, scintille e il ronzio che prende vita. Il motore lo fa scorrere
 * lungo l'asse da sud a nord con un panner direzionale.
 */
import { tra } from '../util';
import { gonfia, invia, pulisci, pulisciA, soffio, type Destinazione, type Kit } from '../sintesi/kit';
import { graniDiRumore } from './passi';

/** Durata dell'accensione (s). */
export const DURATA_ACCENSIONE = 7.5;

export function accensioneLinea(kit: Kit, dest: Destinazione, t: number): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.3);
  // la miccia: un soffio in passa-banda che sale e poi si calma
  let fine = t;
  {
    const s = kit.sorgenteRumore('rosa');
    const bp = kit.filtro('bandpass', 900, 1.1);
    const g = kit.guadagno(0);
    s.connect(bp).connect(g).connect(out);
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 3);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 6.5);
    const f = gonfia(g.gain, t, 0.05, 0.8, 3, 2.2);
    s.start(t, s.scarto);
    s.stop(f);
    pulisci(s, [s, bp, g]);
    fine = Math.max(fine, f);
  }
  // scintille
  fine = Math.max(
    fine,
    graniDiRumore(kit, out, t + 0.4, {
      quanti: 110,
      finestra: 5.5,
      durataMin: 0.001,
      durataMax: 0.004,
      ampiezza: 0.07,
      filtro: 'highpass',
      f: 1800,
      q: 0.6,
      forma: 0.9,
    }),
    soffio(kit, out, t, { tipo: 'rosa', filtro: 'lowpass', f: 200, picco: 0.08, attacco: 0.25, tau: 0.4 }),
  );
  // il ronzio che prende vita (poi lo strato continuo della Linea prosegue da solo)
  for (const [f, a] of [
    [55, 0.05],
    [110, 0.03],
    [165, 0.014],
  ] as const) {
    const o = kit.osc('sine', f * tra(r, 0.999, 1.001));
    const g = kit.guadagno(0);
    o.connect(g).connect(out);
    o.frequency.setValueAtTime(f * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 3);
    const fe = gonfia(g.gain, t + 0.5, a, 2.5, 2, 2);
    o.start(t);
    o.stop(fe);
    pulisci(o, [o, g]);
    fine = Math.max(fine, fe);
  }
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}
