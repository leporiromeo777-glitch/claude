/**
 * Passi, salto e atterraggio. Ogni superficie ha una sua ricetta:
 * l'erba fruscia, la pietra schiocca asciutta, il legno suona cavo, la ghiaia scricchiola.
 */
import type { Superficie } from '../tipi';
import { limita, tra, type Rng } from '../util';
import { colpo, grani, invia, pulisci, pulisciA, soffio, suonaModi, type Destinazione, type Kit } from '../sintesi/kit';
import type { TipoRumore } from '../sintesi/campioni';

/** Grani di rumore filtrato (steli d'erba, sassolini, fibre di carta, scintille). */
export function graniDiRumore(
  kit: Kit,
  uscita: AudioNode,
  t: number,
  opz: {
    quanti: number;
    finestra: number;
    durataMin: number;
    durataMax: number;
    ampiezza: number;
    filtro: BiquadFilterType;
    f: number;
    q?: number;
    tipo?: TipoRumore;
    /** Esponente della distribuzione nel tempo: >1 addensa i grani all'inizio. */
    forma?: number;
  },
): number {
  const r: Rng = kit.rng;
  const s = kit.sorgenteRumore(opz.tipo ?? 'bianco', true);
  const fl = kit.filtro(opz.filtro, opz.f, opz.q ?? 0.8);
  const g = kit.guadagno(0);
  s.connect(fl).connect(g).connect(uscita);
  const istanti: number[] = [];
  const durate: number[] = [];
  const ampiezze: number[] = [];
  const forma = opz.forma ?? 1;
  for (let i = 0; i < opz.quanti; i++) {
    istanti.push(t + opz.finestra * Math.pow(r(), forma));
    durate.push(tra(r, opz.durataMin, opz.durataMax));
    ampiezze.push(opz.ampiezza * tra(r, 0.35, 1));
  }
  g.gain.setValueAtTime(0, t);
  grani(g.gain, istanti, durate, ampiezze);
  const fine = t + opz.finestra + opz.durataMax + 0.02;
  s.start(t, s.scarto);
  s.stop(fine);
  pulisci(s, [s, fl, g]);
  return fine;
}

/** Un passo sulla superficie data. `forza` 0-1,3 (camminata ≈ 0,6, corsa ≈ 1). */
export function passo(kit: Kit, dest: Destinazione, t: number, superficie: Superficie, forza = 0.7): number {
  const r = kit.rng;
  const k = limita(forza, 0.1, 1.3);
  const out = kit.guadagno(1);
  const lp = kit.filtro('lowpass', 7500, 0.5);
  out.connect(lp);
  const mandata = invia(kit, lp, dest, 0.06);
  const v = tra(r, 0.92, 1.08); // ogni passo un po' diverso
  // il peso del corpo: un tonfo grave e corto, comune a tutte le superfici
  let fine = suonaModi(kit, out, t, [{ f: 80 * v, a: 0.1 * k, tau: 0.03 }], 0.004);
  switch (superficie) {
    case 'erba': {
      fine = Math.max(
        fine,
        soffio(kit, out, t, { tipo: 'rosa', filtro: 'bandpass', f: 2200 * v, q: 0.7, picco: 0.16 * k, attacco: 0.014, tau: 0.045 }),
        soffio(kit, out, t + tra(r, 0.05, 0.08), {
          tipo: 'rosa',
          filtro: 'bandpass',
          f: 2700 * v,
          q: 0.8,
          picco: 0.1 * k,
          attacco: 0.012,
          tau: 0.035,
        }),
        graniDiRumore(kit, out, t, {
          quanti: 9,
          finestra: 0.11,
          durataMin: 0.002,
          durataMax: 0.005,
          ampiezza: 0.09 * k,
          filtro: 'bandpass',
          f: 4200,
          q: 0.9,
          forma: 1.3,
        }),
      );
      break;
    }
    case 'pietra': {
      fine = Math.max(
        fine,
        soffio(kit, out, t, { tipo: 'bianco', filtro: 'bandpass', f: 2100 * v, q: 1.5, picco: 0.2 * k, attacco: 0.001, tau: 0.011 }),
        suonaModi(kit, out, t, [
          { f: 390 * v, a: 0.07 * k, tau: 0.028 },
          { f: 940 * v, a: 0.045 * k, tau: 0.018 },
          { f: 1720 * v, a: 0.022 * k, tau: 0.011 },
        ]),
        soffio(kit, out, t + 0.035, { tipo: 'rosa', filtro: 'bandpass', f: 3100, q: 1, picco: 0.035 * k, attacco: 0.02, tau: 0.025 }),
      );
      break;
    }
    case 'legno': {
      fine = Math.max(
        fine,
        suonaModi(
          kit,
          out,
          t,
          [
            { f: 172 * v, a: 0.12 * k, tau: 0.07 },
            { f: 398 * v, a: 0.085 * k, tau: 0.045 },
            { f: 725 * v, a: 0.045 * k, tau: 0.028 },
            { f: 1135 * v, a: 0.02 * k, tau: 0.016 },
          ],
          0.002,
        ),
        soffio(kit, out, t, { tipo: 'bianco', filtro: 'bandpass', f: 1500, q: 1.2, picco: 0.07 * k, attacco: 0.001, tau: 0.006 }),
      );
      // ogni tanto l'asse scricchiola
      if (r() < 0.18) fine = Math.max(fine, scricchiolio(kit, out, t + 0.03, 0.035 * k));
      break;
    }
    case 'ghiaia': {
      fine = Math.max(
        fine,
        graniDiRumore(kit, out, t, {
          quanti: 26,
          finestra: 0.16,
          durataMin: 0.002,
          durataMax: 0.006,
          ampiezza: 0.17 * k,
          filtro: 'bandpass',
          f: 2900 * v,
          q: 0.8,
          forma: 1.6,
        }),
        soffio(kit, out, t, { tipo: 'rosa', filtro: 'lowpass', f: 900, picco: 0.06 * k, attacco: 0.01, tau: 0.045 }),
      );
      break;
    }
  }
  pulisciA(kit, fine, [out, lp, mandata]);
  return fine;
}

/** Breve scricchiolio di legno: impulsi lenti in un filtro risonante. */
export function scricchiolio(kit: Kit, uscita: AudioNode, t: number, ampiezza: number): number {
  const r = kit.rng;
  const o = kit.osc('sawtooth', tra(r, 22, 34));
  const bp = kit.filtro('bandpass', tra(r, 750, 1000), 9);
  const g = kit.guadagno(0);
  o.connect(bp).connect(g).connect(uscita);
  o.frequency.setValueAtTime(o.frequency.value, t);
  o.frequency.linearRampToValueAtTime(o.frequency.value * 0.7, t + 0.12);
  const fine = colpo(g.gain, t, ampiezza, 0.03, 0.03);
  o.start(t);
  o.stop(fine);
  pulisci(o, [o, bp, g]);
  return fine;
}

/** Lo stacco del salto: la spinta sulla superficie, un piccolo respiro e la stoffa che si muove. */
export function salto(kit: Kit, dest: Destinazione, t: number, superficie: Superficie = 'erba'): number {
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.05);
  const fine = Math.max(
    passo(kit, dest, t, superficie, 0.85),
    soffio(kit, out, t + 0.02, { tipo: 'bianco', filtro: 'bandpass', f: 1100, q: 0.6, picco: 0.03, attacco: 0.03, tau: 0.07 }),
    soffio(kit, out, t + 0.03, {
      tipo: 'rosa',
      filtro: 'bandpass',
      f: 500,
      fFine: 1600,
      q: 0.8,
      picco: 0.06,
      attacco: 0.08,
      tau: 0.09,
    }),
  );
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}

/** Atterraggio: tonfo proporzionato alla velocità di caduta, due appoggi e la stoffa che si posa. */
export function atterraggio(
  kit: Kit,
  dest: Destinazione,
  t: number,
  superficie: Superficie = 'erba',
  velocita = 6,
): number {
  const r = kit.rng;
  const forza = limita(Math.abs(velocita) / 10, 0.3, 1.2);
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.07);
  // tonfo: seno che cala di altezza
  const o = kit.osc('sine', 95);
  const g = kit.guadagno(0);
  o.connect(g).connect(out);
  o.frequency.setValueAtTime(95, t);
  o.frequency.exponentialRampToValueAtTime(46, t + 0.14);
  const fineTonfo = colpo(g.gain, t, 0.28 * forza, 0.003, 0.055);
  o.start(t);
  o.stop(fineTonfo);
  pulisci(o, [o, g]);
  const fine = Math.max(
    fineTonfo,
    soffio(kit, out, t, { tipo: 'rosa', filtro: 'lowpass', f: 380, picco: 0.15 * forza, attacco: 0.004, tau: 0.045 }),
    passo(kit, dest, t, superficie, 0.9 * forza),
    passo(kit, dest, t + tra(r, 0.03, 0.055), superficie, 0.7 * forza),
    soffio(kit, out, t + 0.04, { tipo: 'rosa', filtro: 'bandpass', f: 1400, q: 0.7, picco: 0.04, attacco: 0.03, tau: 0.07 }),
  );
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}
