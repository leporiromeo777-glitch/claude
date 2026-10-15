/**
 * Il Velo: apertura (la stoffa si srotola e si gonfia d'aria) e chiusura (si ripiega).
 * Il fruscio continuo del volo è uno strato d'ambiente (ambienti/volo.ts).
 */
import { mescola, tra } from '../util';
import { gonfia, invia, pulisci, pulisciA, soffio, suonaModi, type Destinazione, type Kit } from '../sintesi/kit';

/**
 * Battito della stoffa: rampe alternate sul guadagno, con frequenza che passa
 * da `fDa` a `fA` Hz. Il guadagno oscilla fra `min` e 1.
 */
export function battito(param: AudioParam, t: number, durata: number, fDa: number, fA: number, min: number): void {
  param.setValueAtTime(1, t);
  let x = t;
  let alto = false;
  for (let i = 0; i < 400 && x < t + durata; i++) {
    const f = mescola(fDa, fA, (x - t) / durata);
    x += 0.5 / Math.max(1, f);
    param.linearRampToValueAtTime(alto ? 1 : min, x);
    alto = !alto;
  }
  param.linearRampToValueAtTime(1, x + 0.01);
}

/** Stoffa che scorre: rumore rosa in un passa-banda che scivola, con battito. */
function stoffa(
  kit: Kit,
  uscita: AudioNode,
  t: number,
  opz: { fDa: number; fA: number; durata: number; picco: number; battitoDa: number; battitoA: number },
): number {
  const s = kit.sorgenteRumore('rosa');
  const bp = kit.filtro('bandpass', opz.fDa, 0.9);
  const mod = kit.guadagno(1);
  const env = kit.guadagno(0);
  s.connect(bp).connect(mod).connect(env).connect(uscita);
  bp.frequency.setValueAtTime(opz.fDa, t);
  bp.frequency.exponentialRampToValueAtTime(opz.fA, t + opz.durata);
  battito(mod.gain, t, opz.durata, opz.battitoDa, opz.battitoA, 0.35);
  const fine = gonfia(env.gain, t, opz.picco, opz.durata * 0.2, opz.durata * 0.5, opz.durata * 0.5);
  s.start(t, s.scarto);
  s.stop(fine);
  pulisci(s, [s, bp, mod, env]);
  return fine;
}

/** Il Velo si apre: srotolamento, poi l'aria lo gonfia con un tonfo morbido. */
export function veloApri(kit: Kit, dest: Destinazione, t: number): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.08);
  const gonfiato = t + tra(r, 0.3, 0.36);
  const fine = Math.max(
    stoffa(kit, out, t, { fDa: 450, fA: 2200, durata: 0.42, picco: 0.13, battitoDa: 24, battitoA: 14 }),
    soffio(kit, out, gonfiato, { tipo: 'rosa', filtro: 'lowpass', f: 260, picco: 0.17, attacco: 0.03, tau: 0.09 }),
    suonaModi(kit, out, gonfiato, [{ f: 62, a: 0.08, tau: 0.08 }], 0.02),
    soffio(kit, out, gonfiato + 0.01, { tipo: 'bianco', filtro: 'bandpass', f: 2600, q: 2, picco: 0.03, attacco: 0.001, tau: 0.01 }),
  );
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}

/** Il Velo si chiude: fruscio che scende, la piega e il fermaglio di legno. */
export function veloChiudi(kit: Kit, dest: Destinazione, t: number): number {
  const out = kit.guadagno(1.4);
  const mandata = invia(kit, out, dest, 0.06);
  const fine = Math.max(
    stoffa(kit, out, t, { fDa: 2000, fA: 520, durata: 0.36, picco: 0.1, battitoDa: 20, battitoA: 11 }),
    soffio(kit, out, t + 0.28, { tipo: 'rosa', filtro: 'lowpass', f: 700, picco: 0.07, attacco: 0.02, tau: 0.06 }),
    suonaModi(kit, out, t + 0.42, [
      { f: 1250, a: 0.05, tau: 0.014 },
      { f: 2650, a: 0.018, tau: 0.008 },
    ]),
  );
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}
