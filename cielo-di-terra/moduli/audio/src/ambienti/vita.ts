/**
 * Strati della vita nelle valli: uccelli di giorno (merli, cince, fringuelli e,
 * lontano, il cuculo), grilli di notte, e le Fade che lavorano nei dintorni.
 */
import type { ParametriAmbiente } from '../mappature';
import { normalizzaOra } from '../mappature';
import { Pianificatore } from '../pianificatore';
import type { VarietaFade } from '../tipi';
import { intero, liscia, scegli, scegliPesato, tra, type Rng } from '../util';
import { grani, pulisci, pulisciA, type Kit } from '../sintesi/kit';
import { fade } from '../effetti/notte';
import { Strato, avviaContinua, puntoAttorno, type ContestoStrato, type ProfiloSpaziale } from './strato';

/** Una nota di un canto: istante relativo, durata, glissando da f0 a f1, ampiezza. */
export interface NotaCanto {
  t: number;
  d: number;
  f0: number;
  f1: number;
  a: number;
}

export type Specie = 'merlo' | 'cincia' | 'fringuello' | 'cuculo';

const SPECIE: readonly Specie[] = ['merlo', 'cincia', 'fringuello', 'cuculo'];

/** Quanto è probabile ogni specie a una certa ora (merli all'alba e alla sera, cuculo a metà mattina). */
export function pesiSpecie(ora: number): number[] {
  const h = normalizzaOra(ora);
  const alba = 1 - liscia(7, 9, h);
  const sera = liscia(17, 18.5, h);
  const mattina = liscia(7.5, 9, h) * (1 - liscia(12, 14, h));
  return [0.3 + 0.4 * alba + 0.5 * sera, 0.35 - 0.15 * sera, 0.3 - 0.1 * sera, 0.1 * mattina];
}

/** Le note del canto di una specie (pure: dipendono solo dall'Rng). */
export function noteCanto(specie: Specie, rng: Rng): NotaCanto[] {
  const note: NotaCanto[] = [];
  let x = 0;
  switch (specie) {
    case 'merlo': {
      const base = tra(rng, 1250, 1700);
      const n = intero(rng, 4, 7);
      for (let i = 0; i < n; i++) {
        const f0 = base * scegli(rng, [1, 1.12, 1.26, 1.33, 1.5, 0.89]);
        const d = tra(rng, 0.08, 0.2);
        note.push({ t: x, d, f0, f1: f0 * tra(rng, 0.85, 1.25), a: tra(rng, 0.7, 1) });
        x += d + tra(rng, 0.02, 0.07);
      }
      if (rng() < 0.5) {
        for (let i = 0; i < intero(rng, 2, 3); i++) {
          const f0 = tra(rng, 2600, 3300);
          note.push({ t: x, d: 0.03, f0, f1: f0 * 0.92, a: 0.35 });
          x += 0.045;
        }
      }
      break;
    }
    case 'cincia': {
      const n = intero(rng, 3, 5);
      const alto = tra(rng, 2750, 3000);
      const basso = alto * tra(rng, 0.75, 0.8);
      for (let i = 0; i < n; i++) {
        note.push({ t: x, d: 0.09, f0: alto, f1: alto * 0.98, a: 0.55 });
        x += 0.13;
        note.push({ t: x, d: 0.1, f0: basso, f1: basso * 0.97, a: 0.5 });
        x += 0.2;
      }
      break;
    }
    case 'fringuello': {
      const n = intero(rng, 8, 13);
      for (let i = 0; i < n; i++) {
        const f0 = 3100 - (1100 * i) / n;
        const d = 0.05 - (0.012 * i) / n;
        note.push({ t: x, d, f0, f1: f0 * 0.93, a: 0.45 });
        x += d + 0.018;
      }
      note.push({ t: x + 0.03, d: 0.12, f0: 2400, f1: 3300, a: 0.55 });
      note.push({ t: x + 0.17, d: 0.1, f0: 2600, f1: 2100, a: 0.5 });
      break;
    }
    case 'cuculo': {
      const n = intero(rng, 2, 4);
      const f = tra(rng, 680, 720);
      for (let i = 0; i < n; i++) {
        note.push({ t: x, d: 0.22, f0: f, f1: f * 0.985, a: 1 });
        note.push({ t: x + 0.3, d: 0.32, f0: f * 0.82, f1: f * 0.81, a: 0.95 });
        x += 0.95;
      }
      break;
    }
  }
  return note;
}

/** Suona un canto su un solo oscillatore (frequenza e guadagno automatizzati). */
export function canto(kit: Kit, uscita: AudioNode, t: number, note: readonly NotaCanto[], ampiezza: number): number {
  if (note.length === 0) return t;
  const o = kit.oscOnda(kit.onda('uccello', [1, 0.12, 0.04]), note[0]?.f0 ?? 1000);
  const lp = kit.filtro('lowpass', 5500, 0.5);
  const g = kit.guadagno(0);
  o.connect(lp).connect(g).connect(uscita);
  g.gain.setValueAtTime(0, t);
  let fine = t;
  for (const n of note) {
    const t0 = t + n.t;
    const att = Math.min(0.015, n.d * 0.3);
    o.frequency.setValueAtTime(n.f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, n.f1), t0 + n.d);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(n.a * ampiezza, t0 + att);
    g.gain.linearRampToValueAtTime(n.a * ampiezza * 0.8, t0 + n.d * 0.7);
    g.gain.linearRampToValueAtTime(0, t0 + n.d);
    fine = Math.max(fine, t0 + n.d);
  }
  o.start(t);
  o.stop(fine + 0.02);
  pulisci(o, [o, lp, g]);
  return fine + 0.02;
}

/** Un grillo vicino: qualche secondo di canti a tre impulsi. */
export function grillo(kit: Kit, uscita: AudioNode, t: number, durata: number, ampiezza: number): number {
  const r = kit.rng;
  const o = kit.osc('sine', tra(r, 2900, 3700));
  const lp = kit.filtro('lowpass', 6000, 0.5);
  const g = kit.guadagno(0);
  o.connect(lp).connect(g).connect(uscita);
  const periodo = tra(r, 0.5, 0.8);
  const impulsi = intero(r, 2, 4);
  const istanti: number[] = [];
  const durate: number[] = [];
  const ampiezze: number[] = [];
  for (let x = 0; x < durata; x += periodo * tra(r, 0.95, 1.05)) {
    for (let k = 0; k < impulsi; k++) {
      istanti.push(t + x + k * 0.032);
      durate.push(0.017);
      ampiezze.push(ampiezza);
    }
  }
  g.gain.setValueAtTime(0, t);
  grani(g.gain, istanti, durate, ampiezze);
  const fine = t + durata + 0.1;
  o.start(t);
  o.stop(fine);
  pulisci(o, [o, lp, g]);
  return fine;
}

const PROFILO_UCCELLO: ProfiloSpaziale = { rif: 8, max: 800, rolloff: 1 };
const PROFILO_GRILLO: ProfiloSpaziale = { rif: 2, max: 300, rolloff: 1.2 };
const PROFILO_FADE: ProfiloSpaziale = { rif: 4, max: 400, rolloff: 1 };

/** Uccelli e grilli posizionati attorno all'ascoltatore, più un coro lontano di grilli. */
export class StratoFauna extends Strato {
  private readonly gCoro: GainNode;
  private readonly pUccelli: Pianificatore;
  private readonly pGrilli: Pianificatore;

  constructor(c: ContestoStrato) {
    super(c);
    const { kit } = c;
    const t = kit.ctx.currentTime;
    const coro = this.tieni(kit.ctx.createBufferSource());
    coro.buffer = kit.coroGrilli();
    coro.loop = true;
    this.gCoro = this.tieni(kit.guadagno(0));
    coro.connect(this.gCoro).connect(c.uscita);
    const mandata = this.tieni(kit.guadagno(0.12));
    this.gCoro.connect(mandata).connect(c.riverbero);
    avviaContinua(coro, t);
    this.pUccelli = new Pianificatore(kit.rng, 2);
    this.pGrilli = new Pianificatore(kit.rng, 1);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const { kit } = this.c;
    const r = kit.rng;
    this.gCoro.gain.setTargetAtTime(0.12 * p.fauna.grilli * p.duckValle, t, 1.5);
    const [da, a] = this.finestra(t);
    const asc = this.c.ascoltatore();
    for (const te of this.pUccelli.eventi(da, a, 1.3 * p.fauna.uccelli)) {
      const specie = scegliPesato(r, SPECIE, pesiSpecie(p.ora));
      const lontano = specie === 'cuculo';
      const pos = puntoAttorno(asc, r, lontano ? 70 : 12, lontano ? 180 : 60, tra(r, 3, 14));
      const pan = this.c.panner(pos, PROFILO_UCCELLO);
      const mandata = kit.guadagno(0.12);
      pan.connect(mandata).connect(this.c.riverbero);
      const fine = canto(kit, pan, te, noteCanto(specie, r), (lontano ? 0.35 : 0.18) * tra(r, 0.6, 1));
      pulisciA(kit, fine, [pan, mandata]);
    }
    for (const te of this.pGrilli.eventi(da, a, 0.35 * p.fauna.grilli)) {
      const pos = puntoAttorno(asc, r, 3, 18, 0.1);
      const pan = this.c.panner(pos, PROFILO_GRILLO);
      const fine = grillo(kit, pan, te, tra(r, 2, 5), 0.05);
      pulisciA(kit, fine, [pan]);
    }
  }
}

/** Le Fade al lavoro nei dintorni, di notte: carillon, ronzii, pietre posate. */
export class StratoFade extends Strato {
  private readonly pFade: Pianificatore;

  constructor(c: ContestoStrato) {
    super(c);
    this.pFade = new Pianificatore(c.kit.rng, 2);
  }

  aggiorna(p: ParametriAmbiente, t: number): void {
    const { kit } = this.c;
    const r = kit.rng;
    const [da, a] = this.finestra(t);
    const tasso = 0.45 * p.fadeVicine * liscia(0.5, 0.9, p.notte);
    for (const te of this.pFade.eventi(da, a, tasso)) {
      const varieta = scegliPesato<VarietaFade>(r, ['carillon', 'ronzio', 'pietra'], [0.4, 0.35, 0.25]);
      const pos = puntoAttorno(this.c.ascoltatore(), r, 6, 35, tra(r, 0.2, 3));
      const pan = this.c.panner(pos, PROFILO_FADE);
      const fine = fade(kit, { secco: pan, riverbero: this.c.riverbero }, te, varieta);
      pulisciA(kit, fine, [pan]);
    }
  }
}
