/**
 * Strumenti di sintesi con un carattere alpino:
 * - salterio: corde percosse (Karplus-Strong generato in codice, cori di tre corde);
 * - fisarmonica: due ance leggermente scordate («musette»), mantice che respira;
 * - flauto: onda quasi sinusoidale, fiato filtrato e vibrato che arriva tardi;
 * - carillon: lamelle d'acciaio (le stesse delle Fade).
 */
import { limita, midiAHz } from '../util';
import { pulisci, pulisciA, type Kit } from '../sintesi/kit';
import { notaCarillon } from '../effetti/notte';
import type { NotaMusicale } from './temi';

/** Armoniche dell'ancia della fisarmonica (dispari un po' più forti). */
const ANCIA = [1, 0.55, 0.62, 0.3, 0.38, 0.2, 0.22, 0.12, 0.12, 0.07, 0.06, 0.04] as const;
/** Armoniche del flauto. */
const FLAUTO = [1, 0.3, 0.1, 0.05, 0.02] as const;

export function salterio(kit: Kit, uscita: AudioNode, t: number, n: NotaMusicale): number {
  const s = kit.ctx.createBufferSource();
  s.buffer = kit.corda(n.midi);
  const g = kit.guadagno(0.5 * n.vel);
  const pan = kit.pan(limita((n.midi - 64) / 30, -0.6, 0.6));
  s.connect(g).connect(pan).connect(uscita);
  s.start(t);
  pulisci(s, [s, g, pan]);
  return t + s.buffer.duration;
}

export function fisarmonica(kit: Kit, uscita: AudioNode, t: number, n: NotaMusicale): number {
  const f = midiAHz(n.midi);
  const onda = kit.onda('ancia', ANCIA);
  const lp = kit.filtro('lowpass', limita(1400 + f * 2, 1500, 3000), 0.5);
  const env = kit.guadagno(0);
  lp.connect(env).connect(uscita);
  const lunga = n.durata > 2.5;
  const attacco = lunga ? Math.min(1.5, n.durata * 0.3) : Math.min(0.1, n.durata * 0.25);
  const rilascio = lunga ? 1.2 : 0.18;
  const picco = 0.085 * n.vel;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(picco, t + attacco);
  // il mantice: un piccolo respiro dentro la nota
  env.gain.linearRampToValueAtTime(picco * 1.1, t + attacco + (n.durata - attacco) * 0.5);
  env.gain.linearRampToValueAtTime(picco, t + n.durata);
  env.gain.setTargetAtTime(0, t + n.durata, rilascio / 4);
  const fine = t + n.durata + rilascio * 1.8;
  const oscillatori: OscillatorNode[] = [];
  for (const cent of [-4, 5]) {
    const o = kit.oscOnda(onda, f);
    o.detune.value = cent;
    const g = kit.guadagno(0.5);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(fine);
    oscillatori.push(o);
    pulisci(o, [o, g]);
  }
  pulisciA(kit, fine, [lp, env]);
  return fine;
}

export function flauto(kit: Kit, uscita: AudioNode, t: number, n: NotaMusicale): number {
  const f = midiAHz(n.midi);
  const env = kit.guadagno(0);
  const lp = kit.filtro('lowpass', limita(f * 6, 2500, 7000), 0.5);
  env.connect(lp).connect(uscita);
  const attacco = Math.min(0.08, n.durata * 0.3);
  const picco = 0.11 * n.vel;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(picco, t + attacco);
  env.gain.setValueAtTime(picco, t + n.durata);
  env.gain.setTargetAtTime(0, t + n.durata, 0.06);
  const fine = t + n.durata + 0.45;
  // tono, con un vibrato che arriva dopo l'attacco
  const o = kit.oscOnda(kit.onda('flauto', FLAUTO), f);
  const lfo = kit.osc('sine', 5.2);
  const prof = kit.guadagno(0);
  lfo.connect(prof).connect(o.detune);
  prof.gain.setValueAtTime(0, t);
  if (n.durata > 0.4) {
    prof.gain.setValueAtTime(0, t + 0.3);
    prof.gain.linearRampToValueAtTime(12, t + Math.min(0.8, n.durata));
  }
  o.connect(env);
  // il fiato: rumore filtrato attorno alla nota, più forte nell'attacco («chiff»)
  const s = kit.sorgenteRumore('bianco');
  const bp = kit.filtro('bandpass', f, 6);
  const gf = kit.guadagno(0);
  s.connect(bp).connect(gf).connect(env);
  gf.gain.setValueAtTime(0, t);
  gf.gain.linearRampToValueAtTime(0.9, t + 0.02);
  gf.gain.setTargetAtTime(0.25, t + 0.03, 0.05);
  o.start(t);
  lfo.start(t);
  s.start(t, s.scarto);
  o.stop(fine);
  lfo.stop(fine);
  s.stop(fine);
  pulisci(o, [o, lfo, prof, s, bp, gf, env, lp]);
  return fine;
}

export function carillon(kit: Kit, uscita: AudioNode, t: number, n: NotaMusicale): number {
  return notaCarillon(kit, uscita, t, midiAHz(n.midi), n.vel * 1.6);
}

/** Suona una nota con lo strumento indicato; restituisce l'istante di fine. */
export function suonaNota(kit: Kit, uscita: AudioNode, t: number, n: NotaMusicale): number {
  switch (n.strumento) {
    case 'salterio':
      return salterio(kit, uscita, t, n);
    case 'fisarmonica':
      return fisarmonica(kit, uscita, t, n);
    case 'flauto':
      return flauto(kit, uscita, t, n);
    case 'carillon':
      return carillon(kit, uscita, t, n);
  }
}
