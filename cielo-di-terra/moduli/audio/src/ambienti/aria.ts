/**
 * Strati dell'aria: il vento (cresce con l'altezza e con la velocità), il fruscio del
 * Velo in planata e il ronzio della Linea (cambia con l'ora del giorno).
 */
import type { ParametriAmbiente } from '../mappature';
import { limita, mescola, tra } from '../util';
import { Strato, avviaContinua, type ContestoStrato } from './strato';

/** Il vento: due canali indipendenti (stereo largo), ognuno con corpo grave e sibilo morbido. */
export class StratoVento extends Strato {
  private readonly gTot: GainNode;
  private readonly lati: {
    lp: BiquadFilterNode;
    bp: BiquadFilterNode;
    gCorpo: GainNode;
    gFischio: GainNode;
    raffica: GainNode;
    prossima: number;
    scartoFischio: number;
  }[] = [];

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    this.gTot = this.tieni(kit.guadagno(0));
    const unione = this.tieni(kit.ctx.createChannelMerger(2));
    unione.connect(this.gTot).connect(c.uscita);
    for (let lato = 0; lato < 2; lato++) {
      const corpo = this.tieni(kit.sorgenteRumore('marrone'));
      const fischio = this.tieni(kit.sorgenteRumore('rosa'));
      const lp = this.tieni(kit.filtro('lowpass', 400, 0.5));
      const bp = this.tieni(kit.filtro('bandpass', 900, 1));
      const gCorpo = this.tieni(kit.guadagno(0));
      const gFischio = this.tieni(kit.guadagno(0));
      const raffica = this.tieni(kit.guadagno(1));
      corpo.connect(lp).connect(gCorpo).connect(raffica);
      fischio.connect(bp).connect(gFischio).connect(raffica);
      raffica.connect(unione, 0, lato);
      avviaContinua(corpo, t);
      avviaContinua(fischio, t);
      this.lati.push({ lp, bp, gCorpo, gFischio, raffica, prossima: t, scartoFischio: tra(kit.rng, 0.9, 1.1) });
    }
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const v = p.vento;
    const r = this.c.kit.rng;
    // sulle Finestre il vento «del luogo» cala, quello del volo resta
    const volo = limita(p.velocita / 15, 0, 1);
    const duck = mescola(1, 0.3, p.pesoFinestra * (1 - volo));
    this.gTot.gain.setTargetAtTime(duck, t, 0.4);
    for (const l of this.lati) {
      l.gCorpo.gain.setTargetAtTime(v.guadagno, t, 0.35);
      l.gFischio.gain.setTargetAtTime(v.guadagnoFischio, t, 0.5);
      l.lp.frequency.setTargetAtTime(v.tagliaCorpo, t, 0.5);
      l.bp.Q.setTargetAtTime(v.qFischio, t, 0.8);
      if (t >= l.prossima) {
        // raffica: nuovo bersaglio di intensità e di colore
        const bersaglio = 1 + v.raffiche * tra(r, -0.7, 0.6);
        l.raffica.gain.setTargetAtTime(Math.max(0.15, bersaglio), t, tra(r, 0.3, 0.8));
        l.bp.frequency.setTargetAtTime(v.centroFischio * l.scartoFischio * (0.88 + 0.22 * bersaglio), t, 0.6);
        l.prossima = t + tra(r, 0.5, 1.6);
      }
    }
  }
}

/** Il fruscio del Velo aperto in planata: stoffa che batte più in fretta con la velocità. */
export class StratoVolo extends Strato {
  private readonly gVolo: GainNode;
  private readonly bp: BiquadFilterNode;
  private readonly lfo: OscillatorNode;

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    const s = this.tieni(kit.sorgenteRumore('rosa'));
    const s2 = this.tieni(kit.sorgenteRumore('marrone'));
    this.bp = this.tieni(kit.filtro('bandpass', 1200, 0.8));
    const lp = this.tieni(kit.filtro('lowpass', 320, 0.5));
    const mod = this.tieni(kit.guadagno(0.65));
    const mod2 = this.tieni(kit.guadagno(0.7));
    this.lfo = this.tieni(kit.osc('sine', 6));
    const prof = this.tieni(kit.guadagno(0.35));
    const prof2 = this.tieni(kit.guadagno(0.3));
    this.lfo.connect(prof).connect(mod.gain);
    this.lfo.connect(prof2).connect(mod2.gain);
    const g2 = this.tieni(kit.guadagno(1.6));
    this.gVolo = this.tieni(kit.guadagno(0));
    s.connect(this.bp).connect(mod).connect(this.gVolo);
    s2.connect(lp).connect(mod2).connect(g2).connect(this.gVolo);
    this.collegaUscita(this.gVolo, c.uscita);
    avviaContinua(s, t);
    avviaContinua(s2, t);
    this.lfo.start(t);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const v = p.volo;
    this.sonno(v.guadagno, t);
    this.gVolo.gain.setTargetAtTime(v.guadagno, t, p.inVolo ? 0.12 : 0.2);
    this.bp.frequency.setTargetAtTime(v.centro, t, 0.3);
    this.lfo.frequency.setTargetAtTime(v.battito * tra(this.c.kit.rng, 0.9, 1.1), t, 0.25);
  }
}

/**
 * La Linea: un ronzio basso e caldo (La1 di giorno, Sol1 alla brace) fatto di pochi
 * seni e di una sega filtrata. Di notte respira lentamente come una brace.
 */
export class StratoLinea extends Strato {
  private readonly oscillatori: { o: OscillatorNode; rapporto: number }[] = [];
  private readonly lp: BiquadFilterNode;
  private readonly gRespiro: GainNode;
  private readonly profRespiro: GainNode;
  private readonly profBrace: GainNode;
  private readonly gLinea: GainNode;

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    const f = 55;
    this.lp = this.tieni(kit.filtro('lowpass', 600, 0.7));
    this.gRespiro = this.tieni(kit.guadagno(1));
    this.gLinea = this.tieni(kit.guadagno(0));
    const somma = this.tieni(kit.guadagno(1));
    const voci: [OscillatorType, number, number, boolean][] = [
      ['sine', 1, 0.35, false],
      ['sine', 1.004, 0.25, false], // battimento lento
      ['triangle', 2, 0.3, false],
      ['sawtooth', 1, 0.3, true], // la sega passa nel filtro: è il «calore»
      ['sine', 3, 0.08, false],
    ];
    for (const [tipo, rapporto, amp, filtrata] of voci) {
      const o = this.tieni(kit.osc(tipo, f * rapporto));
      const g = this.tieni(kit.guadagno(amp));
      o.connect(g).connect(filtrata ? this.lp : somma);
      o.start(t);
      this.oscillatori.push({ o, rapporto });
    }
    this.lp.connect(somma);
    somma.connect(this.gRespiro).connect(this.gLinea).connect(c.uscita);
    // respiro lento della brace (ampiezza) e tremolio del colore (filtro)
    const lfo = this.tieni(kit.osc('sine', 0.07));
    this.profRespiro = this.tieni(kit.guadagno(0));
    lfo.connect(this.profRespiro).connect(this.gRespiro.gain);
    lfo.start(t);
    const lfo2 = this.tieni(kit.osc('sine', 0.045));
    this.profBrace = this.tieni(kit.guadagno(0));
    lfo2.connect(this.profBrace).connect(this.lp.frequency);
    lfo2.start(t);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const l = p.linea;
    for (const { o, rapporto } of this.oscillatori) o.frequency.setTargetAtTime(l.frequenza * rapporto, t, 3);
    this.lp.frequency.setTargetAtTime(l.taglio, t, 2);
    this.gRespiro.gain.setTargetAtTime(1 - l.respiro / 2, t, 2);
    this.profRespiro.gain.setTargetAtTime(l.respiro / 2, t, 2);
    this.profBrace.gain.setTargetAtTime(l.taglio * 0.25 * l.brace, t, 2);
    // sulle Finestre anche la Linea si fa lontana
    this.gLinea.gain.setTargetAtTime(l.guadagno * mescola(1, 0.3, p.pesoFinestra), t, 1.2);
  }
}
