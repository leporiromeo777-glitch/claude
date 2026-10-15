/**
 * Strati dei luoghi: l'acqua che lambisce vicino al lago, il rombo lontano «come di treno»
 * della Ruota sotto il Sordo, il silenzio delle Finestre col cigolio del ferro e il
 * fruscio del vetro.
 */
import { RAGGIO_INTERNO, LUNGHEZZA_CILINDRO } from '../costanti';
import type { ParametriAmbiente } from '../mappature';
import { Pianificatore } from '../pianificatore';
import type { Vec3 } from '../tipi';
import { tra } from '../util';
import { colpo, gonfia, pulisci, pulisciA, soffio, suonaModi, type Kit } from '../sintesi/kit';
import { Strato, avviaContinua, puntoAttorno, type Ascoltatore, type ContestoStrato, type ProfiloSpaziale } from './strato';

// ---------------------------------------------------------------------------
// Lago
// ---------------------------------------------------------------------------

/** Un'onda che lambisce la riva: «shhh» che si gonfia e si ritira. */
export function onda(kit: Kit, uscita: AudioNode, t: number, forza: number): number {
  const r = kit.rng;
  const s = kit.sorgenteRumore('rosa');
  const lp = kit.filtro('lowpass', 1100, 0.6);
  const pan = kit.pan(tra(r, -0.6, 0.6));
  const g = kit.guadagno(0);
  s.connect(lp).connect(g).connect(pan).connect(uscita);
  const salita = tra(r, 0.22, 0.35);
  lp.frequency.setValueAtTime(tra(r, 900, 1200), t);
  lp.frequency.exponentialRampToValueAtTime(tra(r, 450, 650), t + salita + 0.9);
  const fine = gonfia(g.gain, t, 0.13 * forza, salita, 0.08, 0.9);
  s.start(t, s.scarto);
  s.stop(fine);
  pulisci(s, [s, lp, pan, g]);
  return fine;
}

/** Un piccolo gorgoglio o una goccia. */
export function gorgoglio(kit: Kit, uscita: AudioNode, t: number): number {
  const r = kit.rng;
  const goccia = r() < 0.25;
  const f0 = goccia ? tra(r, 700, 900) : tra(r, 200, 320);
  const o = kit.osc('sine', f0);
  const pan = kit.pan(tra(r, -0.7, 0.7));
  const g = kit.guadagno(0);
  o.connect(g).connect(pan).connect(uscita);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f0 * (goccia ? 1.6 : 1.7), t + (goccia ? 0.03 : 0.06));
  const fine = colpo(g.gain, t, goccia ? 0.02 : 0.04, 0.003, goccia ? 0.015 : 0.025);
  o.start(t);
  o.stop(fine);
  pulisci(o, [o, pan, g]);
  return fine;
}

export class StratoLago extends Strato {
  private readonly gLago: GainNode;
  private readonly pOnde: Pianificatore;
  private readonly pGorgoglii: Pianificatore;

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    this.gLago = this.tieni(kit.guadagno(0));
    this.gLago.connect(c.uscita);
    const mandata = this.tieni(kit.guadagno(0.15));
    this.gLago.connect(mandata).connect(c.riverbero);
    const letto = this.tieni(kit.sorgenteRumore('marrone'));
    const lp = this.tieni(kit.filtro('lowpass', 380, 0.5));
    const gLetto = this.tieni(kit.guadagno(0.12));
    letto.connect(lp).connect(gLetto).connect(this.gLago);
    avviaContinua(letto, t);
    this.pOnde = new Pianificatore(kit.rng, 4);
    this.pGorgoglii = new Pianificatore(kit.rng, 1);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const { kit } = this.c;
    const w = p.pesoLago;
    this.gLago.gain.setTargetAtTime(1.4 * w, t, 0.8);
    const [da, a] = this.finestra(t);
    const attivo = w > 0.01 ? 1 : 0;
    for (const te of this.pOnde.eventi(da, a, 0.42 * attivo)) onda(kit, this.gLago, te, tra(kit.rng, 0.6, 1));
    for (const te of this.pGorgoglii.eventi(da, a, 0.3 * attivo)) gorgoglio(kit, this.gLago, te);
  }
}

// ---------------------------------------------------------------------------
// Il Sordo: la Ruota sotto la montagna
// ---------------------------------------------------------------------------

/** Il punto, sotto il Sordo, da cui arriva il rombo (stessa θ dell'ascoltatore, sotto il suolo, z = 3000). */
export function puntoSordo(asc: Ascoltatore): Vec3 {
  const r = Math.hypot(asc.posizione.x, asc.posizione.y);
  const k = r > 1e-6 ? (RAGGIO_INTERNO + 6) / r : 0;
  return {
    x: r > 1e-6 ? asc.posizione.x * k : 0,
    y: r > 1e-6 ? asc.posizione.y * k : -(RAGGIO_INTERNO + 6),
    z: LUNGHEZZA_CILINDRO,
  };
}

export class StratoSordo extends Strato {
  private readonly gSordo: GainNode;
  private readonly pan: PannerNode;
  private readonly pBattiti: Pianificatore;

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    // nessuna attenuazione con la distanza (la gestisce pesoSordo): solo la direzione
    this.pan = this.tieni(c.panner(puntoSordo(c.ascoltatore()), { rif: 1, max: 10000, rolloff: 0 }));
    this.gSordo = this.tieni(kit.guadagno(0));
    this.gSordo.connect(this.pan);
    // il rombo
    const s = this.tieni(kit.sorgenteRumore('marrone'));
    const lp1 = this.tieni(kit.filtro('lowpass', 110, 0.7));
    const lp2 = this.tieni(kit.filtro('lowpass', 160, 0.5));
    const gRombo = this.tieni(kit.guadagno(0.9));
    s.connect(lp1).connect(lp2).connect(gRombo).connect(this.gSordo);
    avviaContinua(s, t);
    // il tono delle ruote, con un lento ondeggiare
    const lfo = this.tieni(kit.osc('sine', 0.13));
    const prof = this.tieni(kit.guadagno(9)); // cent
    lfo.connect(prof);
    lfo.start(t);
    for (const [tipo, f, a] of [
      ['sine', 32, 0.25],
      ['sine', 47.5, 0.17],
      ['triangle', 64, 0.06],
    ] as const) {
      const o = this.tieni(kit.osc(tipo, f));
      const g = this.tieni(kit.guadagno(a));
      prof.connect(o.detune);
      o.connect(g).connect(this.gSordo);
      o.start(t);
    }
    this.pBattiti = new Pianificatore(kit.rng, 14);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const { kit } = this.c;
    const w = p.pesoSordo;
    this.gSordo.gain.setTargetAtTime(0.32 * w, t, 1.5);
    const ps = puntoSordo(this.c.ascoltatore());
    this.pan.positionX.setTargetAtTime(ps.x, t, 0.1);
    this.pan.positionY.setTargetAtTime(ps.y, t, 0.1);
    this.pan.positionZ.setTargetAtTime(ps.z, t, 0.1);
    const [da, a] = this.finestra(t);
    // «ta-dum, ta-dum»: le giunzioni sotto la Ruota, con un'onda lenta che va e viene
    for (const te of this.pBattiti.eventi(da, a, w > 0.01 ? 0.8 : 0)) {
      const onda = 0.6 + 0.4 * Math.sin((2 * Math.PI * te) / 27);
      for (const dt of [0, 0.16]) {
        const k = onda * (dt === 0 ? 1 : 0.8);
        soffio(kit, this.gSordo, te + dt, { tipo: 'marrone', filtro: 'lowpass', f: 180, picco: 0.5 * k, attacco: 0.004, tau: 0.05 });
        suonaModi(kit, this.gSordo, te + dt, [{ f: 70, a: 0.12 * k, tau: 0.06 }], 0.003);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Le Finestre
// ---------------------------------------------------------------------------

/**
 * Cigolio di ferro: impulsi lenti (attrito a scatti) in tre filtri risonanti
 * stretti, come una trave che si assesta. Lontano e riverberato.
 */
export function cigolio(kit: Kit, uscita: AudioNode, t: number, forza: number): number {
  const r = kit.rng;
  const durata = tra(r, 0.8, 1.8);
  const f = tra(r, 9, 20);
  const o = kit.osc('sawtooth', f);
  const env = kit.guadagno(0);
  const nodi: AudioNode[] = [o, env];
  for (const [fc, q, a] of [
    [tra(r, 230, 320), 14, 0.5],
    [tra(r, 640, 760), 16, 0.35],
    [tra(r, 1250, 1500), 10, 0.15],
  ] as const) {
    const bp = kit.filtro('bandpass', fc, q);
    const g = kit.guadagno(a);
    o.connect(bp).connect(g).connect(env);
    nodi.push(bp, g);
  }
  env.connect(uscita);
  o.frequency.setValueAtTime(f, t);
  for (let x = t + 0.1; x < t + durata; x += tra(r, 0.08, 0.2)) {
    o.frequency.linearRampToValueAtTime(f * (1 - (0.4 * (x - t)) / durata) * tra(r, 0.85, 1.15), x);
  }
  const fine = gonfia(env.gain, t, 2.2 * forza, durata * 0.3, durata * 0.4, durata * 0.4);
  o.start(t);
  o.stop(fine);
  pulisci(o, nodi);
  return fine;
}

/** Il «tonc» profondo di un costolone che si dilata: lunghi modi gravi. */
export function tonfoCostolone(kit: Kit, uscita: AudioNode, t: number): number {
  const v = tra(kit.rng, 0.9, 1.1);
  return suonaModi(
    kit,
    uscita,
    t,
    [
      { f: 62 * v, a: 0.09, tau: 2.2 },
      { f: 97.5 * v, a: 0.06, tau: 1.5 },
      { f: 151 * v, a: 0.035, tau: 0.9 },
      { f: 233 * v, a: 0.015, tau: 0.5 },
    ],
    0.01,
  );
}

const PROFILO_FERRO: ProfiloSpaziale = { rif: 15, max: 1000, rolloff: 0.8 };
const PROFILO_COSTOLONE: ProfiloSpaziale = { rif: 30, max: 2000, rolloff: 0.6 };

export class StratoFinestre extends Strato {
  private readonly gFin: GainNode;
  private readonly gOnda: GainNode;
  private prossimaOnda = 0;
  private readonly pCigolii: Pianificatore;
  private readonly pTonfi: Pianificatore;

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    this.gFin = this.tieni(kit.guadagno(0));
    this.gFin.connect(c.uscita);
    const mandata = this.tieni(kit.guadagno(0.3));
    this.gFin.connect(mandata).connect(c.riverbero);
    // il fruscio del vetro: un sibilo chiarissimo e lontano che va e viene
    this.gOnda = this.tieni(kit.guadagno(0.6));
    const vetro = this.tieni(kit.sorgenteRumore('bianco'));
    const bpV = this.tieni(kit.filtro('bandpass', 4200, 0.6));
    const gV = this.tieni(kit.guadagno(0.04));
    vetro.connect(bpV).connect(gV).connect(this.gOnda).connect(this.gFin);
    // l'aria ferma sopra il vetro
    const aria = this.tieni(kit.sorgenteRumore('rosa'));
    const bpA = this.tieni(kit.filtro('bandpass', 900, 0.5));
    const gA = this.tieni(kit.guadagno(0.06));
    aria.connect(bpA).connect(gA).connect(this.gFin);
    avviaContinua(vetro, t);
    avviaContinua(aria, t);
    this.pCigolii = new Pianificatore(kit.rng, 2);
    this.pTonfi = new Pianificatore(kit.rng, 1);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const { kit } = this.c;
    const r = kit.rng;
    const w = p.pesoFinestra;
    this.gFin.gain.setTargetAtTime(w, t, 0.8);
    if (t >= this.prossimaOnda) {
      this.gOnda.gain.setTargetAtTime(tra(r, 0.3, 1), t, tra(r, 0.8, 2));
      this.prossimaOnda = t + tra(r, 1.5, 4);
    }
    const [da, a] = this.finestra(t);
    const attivo = w > 0.05 ? w : 0;
    const asc = this.c.ascoltatore();
    for (const te of this.pCigolii.eventi(da, a, 0.13 * attivo)) {
      const pan = this.c.panner(puntoAttorno(asc, r, 20, 90, tra(r, -3, 8)), PROFILO_FERRO);
      const mandata = kit.guadagno(0.45);
      pan.connect(mandata).connect(this.c.riverbero);
      pulisciA(kit, cigolio(kit, pan, te, tra(r, 0.6, 1)), [pan, mandata]);
    }
    for (const te of this.pTonfi.eventi(da, a, 0.035 * attivo)) {
      const pan = this.c.panner(puntoAttorno(asc, r, 60, 200, tra(r, -5, 2)), PROFILO_COSTOLONE);
      const mandata = kit.guadagno(0.5);
      pan.connect(mandata).connect(this.c.riverbero);
      pulisciA(kit, tonfoCostolone(kit, pan, te), [pan, mandata]);
    }
  }
}
