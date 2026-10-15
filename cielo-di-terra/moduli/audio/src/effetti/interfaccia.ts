/**
 * I suoni dell'interfaccia: tocchi di legno e piccoli marimba, mai acuti né metallici.
 */
import type { VarietaInterfaccia } from '../tipi';
import { invia, pulisciA, soffio, suonaModi, type Destinazione, type Kit } from '../sintesi/kit';

/** Una nota di marimba morbida (fondamentale + parziale a ~4×). */
function marimba(kit: Kit, uscita: AudioNode, t: number, f: number, a: number, tau: number): number {
  return suonaModi(
    kit,
    uscita,
    t,
    [
      { f, a, tau },
      { f: f * 3.93, a: a * 0.16, tau: tau * 0.2 },
      { f: f * 2, a: a * 0.1, tau: tau * 0.3 },
    ],
    0.003,
  );
}

export function interfaccia(kit: Kit, dest: Destinazione, t: number, varieta: VarietaInterfaccia): number {
  const out = kit.guadagno(1);
  const lp = kit.filtro('lowpass', 6000, 0.5);
  out.connect(lp);
  const mandata = invia(kit, lp, dest, varieta === 'conferma' || varieta === 'annulla' ? 0.1 : 0.03);
  let fine = t;
  switch (varieta) {
    case 'clic':
      fine = Math.max(
        suonaModi(kit, out, t, [
          { f: 1450, a: 0.06, tau: 0.012 },
          { f: 2930, a: 0.016, tau: 0.006 },
        ]),
        soffio(kit, out, t, { tipo: 'bianco', filtro: 'bandpass', f: 3000, q: 1, picco: 0.025, attacco: 0.0008, tau: 0.003 }),
      );
      break;
    case 'sopra':
      fine = suonaModi(kit, out, t, [{ f: 2200, a: 0.018, tau: 0.006 }]);
      break;
    case 'conferma':
      fine = Math.max(marimba(kit, out, t, 587.33, 0.07, 0.16), marimba(kit, out, t + 0.075, 880, 0.07, 0.2));
      break;
    case 'annulla':
      fine = Math.max(marimba(kit, out, t, 659.25, 0.05, 0.1), marimba(kit, out, t + 0.08, 493.88, 0.05, 0.12));
      break;
    case 'apri':
      fine = Math.max(
        soffio(kit, out, t, { tipo: 'rosa', filtro: 'lowpass', f: 500, picco: 0.08, attacco: 0.004, tau: 0.03 }),
        soffio(kit, out, t + 0.04, { tipo: 'rosa', filtro: 'bandpass', f: 2600, q: 0.9, picco: 0.05, attacco: 0.04, tau: 0.06 }),
      );
      break;
    case 'chiudi':
      fine = Math.max(
        soffio(kit, out, t, { tipo: 'rosa', filtro: 'bandpass', f: 2300, q: 0.9, picco: 0.045, attacco: 0.03, tau: 0.04 }),
        soffio(kit, out, t + 0.08, { tipo: 'rosa', filtro: 'lowpass', f: 480, picco: 0.08, attacco: 0.004, tau: 0.03 }),
        suonaModi(kit, out, t + 0.09, [{ f: 320, a: 0.03, tau: 0.02 }]),
      );
      break;
  }
  pulisciA(kit, fine, [out, lp, mandata]);
  return fine;
}
