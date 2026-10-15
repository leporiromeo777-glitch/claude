/**
 * I suoni del rilievo: lo squadro d'ottone piantato sul caposaldo, la bolla che si
 * livella, l'inchiostro che si spande nella particella (pennello e carta) e le pagine
 * del taccuino.
 */
import { limita, midiAHz, scegli, tra } from '../util';
import { gonfia, invia, pulisci, pulisciA, soffio, suonaModi, type Destinazione, type Kit } from '../sintesi/kit';
import { graniDiRumore } from './passi';

/** Il tintinnio di un piccolo pezzo d'ottone (parziali inarmonici, caldi e brevi). */
export function tintinnioOttone(kit: Kit, uscita: AudioNode, t: number, ampiezza: number, f0: number): number {
  return suonaModi(kit, uscita, t, [
    { f: f0, a: 0.09 * ampiezza, tau: 0.3 },
    { f: f0 * 2.31, a: 0.045 * ampiezza, tau: 0.19 },
    { f: f0 * 3.87, a: 0.02 * ampiezza, tau: 0.11 },
    { f: f0 * 5.12, a: 0.008 * ampiezza, tau: 0.06 },
  ]);
}

/** Lo squadro piantato sul caposaldo: il colpo nella terra e il tintinnio d'ottone. */
export function squadroPianta(kit: Kit, dest: Destinazione, t: number): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const lp = kit.filtro('lowpass', 5500, 0.5);
  out.connect(lp);
  const mandata = invia(kit, lp, dest, 0.14);
  const f0 = tra(r, 1060, 1220);
  const fine = Math.max(
    soffio(kit, out, t, { tipo: 'rosa', filtro: 'lowpass', f: 300, picco: 0.15, attacco: 0.003, tau: 0.035 }),
    suonaModi(kit, out, t, [{ f: 86, a: 0.1, tau: 0.045 }], 0.003),
    tintinnioOttone(kit, out, t + 0.05, 1, f0),
    tintinnioOttone(kit, out, t + tra(r, 0.15, 0.18), 0.45, f0 * 1.06),
    tintinnioOttone(kit, out, t + tra(r, 0.25, 0.3), 0.18, f0 * 0.97),
  );
  pulisciA(kit, fine, [out, lp, mandata]);
  return fine;
}

/** La bolla della livella che si ferma al centro: due piccoli «blip» liquidi e un rintocco soffice. */
export function bollaLivellata(kit: Kit, dest: Destinazione, t: number): number {
  const out = kit.guadagno(1);
  const lp = kit.filtro('lowpass', 4000, 0.5);
  out.connect(lp);
  const mandata = invia(kit, lp, dest, 0.2);
  let fine = t;
  for (const [dt, f0, f1, a] of [
    [0, 480, 720, 0.05],
    [0.09, 560, 690, 0.03],
  ] as const) {
    const o = kit.osc('sine', f0);
    const g = kit.guadagno(0);
    o.connect(g).connect(out);
    o.frequency.setValueAtTime(f0, t + dt);
    o.frequency.exponentialRampToValueAtTime(f1, t + dt + 0.05);
    const f = Math.max(fine, gonfia(g.gain, t + dt, a, 0.006, 0.02, 0.05));
    o.start(t + dt);
    o.stop(f);
    pulisci(o, [o, g]);
    fine = Math.max(fine, f);
  }
  fine = Math.max(
    fine,
    suonaModi(kit, out, t + 0.16, [{ f: 2100, a: 0.022, tau: 0.009 }]),
    suonaModi(kit, out, t + 0.19, [
      { f: 1046.5, a: 0.035, tau: 0.34 },
      { f: 1568, a: 0.014, tau: 0.24 },
      { f: 2093 * 1.002, a: 0.005, tau: 0.14 },
    ]),
  );
  pulisciA(kit, fine, [out, lp, mandata]);
  return fine;
}

/** Accordi caldi per la fioritura del colore (note MIDI dal grave all'acuto). */
const ACCORDI_INCHIOSTRO: readonly (readonly number[])[] = [
  [50, 57, 62, 66, 69], // Re
  [48, 55, 60, 64, 67], // Do
  [45, 52, 57, 61, 64], // La
  [43, 50, 55, 59, 62], // Sol
];

/**
 * L'inchiostro che si spande quando una particella si colora: il tocco del pennello,
 * la pennellata sulla carta, la grana delle fibre e un accordo caldo che entra
 * «a velature», una nota dopo l'altra, in circa tre secondi.
 * @param ampiezza 0-1: grandezza/importanza della particella.
 */
export function inchiostro(kit: Kit, dest: Destinazione, t: number, ampiezza = 0.7): number {
  const r = kit.rng;
  const k = 0.55 + 0.45 * limita(ampiezza, 0, 1);
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.25);
  // tocco del pennello bagnato
  let fine = Math.max(
    soffio(kit, out, t, { tipo: 'rosa', filtro: 'lowpass', f: 650, picco: 0.07 * k, attacco: 0.008, tau: 0.03 }),
    suonaModi(kit, out, t, [{ f: 170, a: 0.035 * k, tau: 0.04 }], 0.006),
  );
  // la pennellata: due passate che respirano
  {
    const s = kit.sorgenteRumore('rosa');
    const bp = kit.filtro('bandpass', 1300, 0.6);
    const ombra = kit.filtro('highshelf', 5000, 0.7);
    ombra.gain.value = -8;
    const g = kit.guadagno(0);
    s.connect(bp).connect(ombra).connect(g).connect(out);
    bp.frequency.setValueAtTime(1300, t);
    bp.frequency.exponentialRampToValueAtTime(3000, t + 1.2);
    bp.frequency.exponentialRampToValueAtTime(2100, t + 2.4);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.07 * k, t + 0.25);
    g.gain.linearRampToValueAtTime(0.045 * k, t + 0.6);
    g.gain.linearRampToValueAtTime(0.075 * k, t + 0.95);
    g.gain.setTargetAtTime(0, t + 1.3, 0.32);
    const f = t + 1.3 + 0.32 * 7;
    s.start(t, s.scarto);
    s.stop(f);
    pulisci(s, [s, bp, ombra, g]);
    fine = Math.max(fine, f);
  }
  // la grana della carta
  fine = Math.max(
    fine,
    graniDiRumore(kit, out, t + 0.05, {
      quanti: 38,
      finestra: 1.5,
      durataMin: 0.0015,
      durataMax: 0.004,
      ampiezza: 0.035 * k,
      filtro: 'highpass',
      f: 3500,
      q: 0.6,
      forma: 1.4,
    }),
  );
  // l'umido che si allarga: un respiro grave
  {
    const s = kit.sorgenteRumore('marrone');
    const lp = kit.filtro('lowpass', 500, 0.5);
    const g = kit.guadagno(0);
    s.connect(lp).connect(g).connect(out);
    const f = gonfia(g.gain, t + 0.2, 0.08 * k, 0.5, 0.4, 1.4);
    s.start(t, s.scarto);
    s.stop(f);
    pulisci(s, [s, lp, g]);
    fine = Math.max(fine, f);
  }
  // il colore: un accordo che entra a velature, dal grave all'acuto
  {
    const accordo = scegli(r, ACCORDI_INCHIOSTRO);
    const lp = kit.filtro('lowpass', 1600, 0.5);
    lp.connect(out);
    accordo.forEach((m, i) => {
      const f = midiAHz(m);
      const t0 = t + 0.35 + i * tra(r, 0.22, 0.3);
      for (const [tipo, det, amp] of [
        ['sine', -3, 1],
        ['triangle', 4, 0.3],
      ] as const) {
        const o = kit.osc(tipo, f);
        o.detune.value = det;
        const g = kit.guadagno(0);
        o.connect(g).connect(lp);
        const fe = gonfia(g.gain, t0, 0.016 * k * amp * (i === 0 ? 1.3 : 1), 0.45, 0.7, 1.6);
        o.start(t0);
        o.stop(fe);
        pulisci(o, [o, g]);
        fine = Math.max(fine, fe);
      }
    });
    pulisciA(kit, fine, [lp]);
  }
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}

/** Una pagina del taccuino: si solleva, gira con uno schiocco morbido e si posa. */
export function pagina(kit: Kit, dest: Destinazione, t: number, verso: 'avanti' | 'indietro' = 'avanti'): number {
  const r = kit.rng;
  const out = kit.guadagno(1);
  const mandata = invia(kit, out, dest, 0.05);
  const giro = t + tra(r, 0.08, 0.12);
  const [fDa, fA] = verso === 'avanti' ? [3800, 1400] : [1600, 3400];
  const fine = Math.max(
    soffio(kit, out, t, { tipo: 'rosa', filtro: 'bandpass', f: 2400, q: 0.9, picco: 0.05, attacco: 0.06, tau: 0.03 }),
    soffio(kit, out, giro, { tipo: 'rosa', filtro: 'bandpass', f: fDa, fFine: fA, q: 0.8, picco: 0.14, attacco: 0.035, tau: 0.05 }),
    graniDiRumore(kit, out, giro, {
      quanti: 10,
      finestra: 0.15,
      durataMin: 0.0015,
      durataMax: 0.004,
      ampiezza: 0.05,
      filtro: 'highpass',
      f: 3000,
    }),
    soffio(kit, out, giro + 0.14, { tipo: 'rosa', filtro: 'lowpass', f: 900, picco: 0.06, attacco: 0.004, tau: 0.025 }),
  );
  pulisciA(kit, fine, [out, mandata]);
  return fine;
}
