/**
 * I suoni della notte: le Fade (piccoli carillon, ronzii di meccanismi, pietre posate)
 * e le api di rame.
 */
import type { VarietaFade } from '../tipi';
import { intero, midiAHz, tra } from '../util';
import { gonfia, invia, pulisci, pulisciA, soffio, suonaModi, type Destinazione, type Kit } from '../sintesi/kit';

/** Una nota di carillon (lamella d'acciaio pizzicata): seno puro con due parziali tenui. */
export function notaCarillon(kit: Kit, uscita: AudioNode, t: number, f: number, ampiezza: number): number {
  return suonaModi(
    kit,
    uscita,
    t,
    [
      { f, a: 0.045 * ampiezza, tau: 0.55 },
      { f: f * 2.0, a: 0.007 * ampiezza, tau: 0.25 },
      { f: f * 4.07, a: 0.005 * ampiezza, tau: 0.07 },
    ],
    0.002,
  );
}

/** Pentatonica alta del carillon delle Fade (Sol5-Sol6). */
const NOTE_CARILLON = [79, 81, 84, 86, 88, 91] as const;

/** Un piccolo carillon: da tre a sei note in una passeggiata sulla pentatonica, con rubato. */
export function fadeCarillon(kit: Kit, dest: Destinazione, t: number): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const lp = kit.filtro('lowpass', 4500, 0.5);
  out.connect(lp);
  const mandata = invia(kit, lp, dest, 0.35);
  let i = intero(r, 0, NOTE_CARILLON.length - 1);
  let x = t;
  let fine = t;
  const quante = intero(r, 3, 6);
  for (let n = 0; n < quante; n++) {
    const m = NOTE_CARILLON[i] as number;
    fine = Math.max(fine, notaCarillon(kit, out, x, midiAHz(m), tra(r, 0.6, 1) * (n === quante - 1 ? 0.8 : 1)));
    i = Math.max(0, Math.min(NOTE_CARILLON.length - 1, i + intero(r, -2, 2)));
    x += tra(r, 0.14, 0.32) * (n === quante - 2 ? 1.5 : 1);
  }
  pulisciA(kit, fine, [out, lp, mandata]);
  return fine;
}

/** Il ronzio di una Fade che passa: un piccolo motore con un tremolo e il «zip» di un servo. */
export function fadeRonzio(kit: Kit, dest: Destinazione, t: number): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.15);
  const durata = tra(r, 1.6, 2.4);
  const f = tra(r, 130, 180);
  const o = kit.osc('sawtooth', f);
  const lp = kit.filtro('lowpass', 1000, 1);
  const trem = kit.guadagno(0.75);
  const lfo = kit.osc('sine', tra(r, 17, 23));
  const prof = kit.guadagno(0.25);
  lfo.connect(prof).connect(trem.gain);
  const env = kit.guadagno(0);
  o.connect(lp).connect(trem).connect(env).connect(out);
  o.frequency.setValueAtTime(f * 0.97, t);
  o.frequency.linearRampToValueAtTime(f * 1.03, t + durata * 0.45);
  o.frequency.linearRampToValueAtTime(f * 0.95, t + durata);
  let fine = gonfia(env.gain, t, 0.05, durata * 0.35, durata * 0.25, durata * 0.4);
  o.start(t);
  lfo.start(t);
  o.stop(fine);
  lfo.stop(fine);
  pulisci(o, [o, lp, trem, lfo, prof, env]);
  // il servo
  const tz = t + tra(r, 0.4, Math.max(0.5, durata - 0.4));
  const z = kit.osc('triangle', 520);
  const zl = kit.filtro('lowpass', 2000, 0.5);
  const zg = kit.guadagno(0);
  z.connect(zl).connect(zg).connect(out);
  z.frequency.setValueAtTime(520, tz);
  z.frequency.exponentialRampToValueAtTime(780, tz + 0.14);
  const fz = gonfia(zg.gain, tz, 0.012, 0.01, 0.1, 0.05);
  z.start(tz);
  z.stop(fz);
  pulisci(z, [z, zl, zg]);
  fine = Math.max(fine, fz);
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}

/** Una pietra posata da una Fade: la raschiata, il colpo, l'assestamento. */
export function fadePietra(kit: Kit, dest: Destinazione, t: number): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.18);
  const v = tra(r, 0.9, 1.1);
  const colpoPietra = (t0: number, k: number, vv: number): number =>
    Math.max(
      suonaModi(kit, out, t0, [
        { f: 820 * vv, a: 0.09 * k, tau: 0.03 },
        { f: 1490 * vv, a: 0.05 * k, tau: 0.02 },
        { f: 2270 * vv, a: 0.022 * k, tau: 0.012 },
        { f: 130 * vv, a: 0.06 * k, tau: 0.035 },
      ]),
      soffio(kit, out, t0, { tipo: 'bianco', filtro: 'bandpass', f: 2500, q: 1.5, picco: 0.06 * k, attacco: 0.001, tau: 0.006 }),
    );
  const fine = Math.max(
    soffio(kit, out, t, { tipo: 'rosa', filtro: 'bandpass', f: 1100, fFine: 800, q: 1.4, picco: 0.05, attacco: 0.06, tau: 0.05 }),
    colpoPietra(t + 0.14, 1, v),
    colpoPietra(t + tra(r, 0.25, 0.3), 0.4, v * 1.04),
  );
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}

/** Dispatcher delle tre varietà di suoni delle Fade. */
export function fade(kit: Kit, dest: Destinazione, t: number, varieta: VarietaFade): number {
  switch (varieta) {
    case 'carillon':
      return fadeCarillon(kit, dest, t);
    case 'ronzio':
      return fadeRonzio(kit, dest, t);
    case 'pietra':
      return fadePietra(kit, dest, t);
  }
}

/**
 * Le api di rame: un piccolo sciame che passa. Ogni ape è un ronzio d'ali
 * con un'ondulazione lenta dell'altezza, una formante morbida e, ogni tanto,
 * il tintinnio del rame quando due ali si sfiorano.
 */
export function api(kit: Kit, dest: Destinazione, t: number, durata = 4): number {
  const r = kit.rng;
  const d = Math.max(1, durata);
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.08);
  let fine = t;
  const quante = intero(r, 4, 6);
  for (let i = 0; i < quante; i++) {
    const t0 = t + r() * d * 0.3;
    const len = d * tra(r, 0.6, 0.9);
    const f = tra(r, 195, 245);
    const o = kit.osc('sawtooth', f);
    const bp = kit.filtro('bandpass', tra(r, 700, 950), 1.2);
    const lp = kit.filtro('lowpass', 2400, 0.5);
    const pan = kit.pan(0);
    const env = kit.guadagno(0);
    o.connect(bp).connect(lp).connect(env).connect(pan).connect(out);
    // ondulazione dell'altezza e piccolo effetto Doppler (si avvicina, poi si allontana)
    o.frequency.setValueAtTime(f * 0.98, t0);
    for (let x = t0 + 0.15; x < t0 + len; x += tra(r, 0.12, 0.2)) {
      const avanzamento = (x - t0) / len;
      const doppler = avanzamento < 0.5 ? 1 + 0.03 * avanzamento : 1.015 - 0.07 * (avanzamento - 0.5);
      o.frequency.linearRampToValueAtTime(f * doppler * tra(r, 0.975, 1.025), x);
    }
    const p0 = tra(r, -0.9, 0.9);
    pan.pan.setValueAtTime(p0, t0);
    pan.pan.linearRampToValueAtTime(-p0 * tra(r, 0.5, 1), t0 + len);
    const fe = gonfia(env.gain, t0, 0.035, len * 0.3, len * 0.3, len * 0.4);
    o.start(t0);
    o.stop(fe);
    pulisci(o, [o, bp, lp, pan, env]);
    fine = Math.max(fine, fe);
    if (r() < 0.6) {
      const ft = tra(r, 2600, 3300);
      fine = Math.max(
        fine,
        suonaModi(kit, out, t0 + len * tra(r, 0.3, 0.6), [
          { f: ft, a: 0.008, tau: 0.04 },
          { f: ft * 1.5, a: 0.004, tau: 0.03 },
        ]),
      );
    }
  }
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}
