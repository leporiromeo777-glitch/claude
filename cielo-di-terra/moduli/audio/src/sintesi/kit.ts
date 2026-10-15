/**
 * Il «kit» del liutaio: fabbrica di nodi Web Audio, cache dei campioni generati
 * e piccoli attrezzi per inviluppi, grani e modi risonanti. Ogni suono del gioco
 * riceve un Kit e una Destinazione e non sa nulla del motore.
 */
import { creaRng, midiAHz, type Rng } from '../util';
import {
  generaRispostaRiverbero,
  generaRumore,
  sintetizzaCampana,
  sintetizzaCoroGrilli,
  sintetizzaCorda,
  type TipoRumore,
} from './campioni';

/** Dove va un suono: il segnale diretto e la mandata al riverbero (facoltativa). */
export interface Destinazione {
  secco: AudioNode;
  riverbero: AudioNode | null;
}

/** Un modo risonante: frequenza, ampiezza e costante di decadimento (s). */
export interface Modo {
  f: number;
  a: number;
  tau: number;
}

const cacheBuffer = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
const cacheOnde = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

export class Kit {
  constructor(
    readonly ctx: BaseAudioContext,
    readonly rng: Rng,
  ) {}

  get sr(): number {
    return this.ctx.sampleRate;
  }

  private buffer(chiave: string, crea: () => AudioBuffer): AudioBuffer {
    let m = cacheBuffer.get(this.ctx);
    if (!m) {
      m = new Map();
      cacheBuffer.set(this.ctx, m);
    }
    let b = m.get(chiave);
    if (!b) {
      b = crea();
      m.set(chiave, b);
    }
    return b;
  }

  private daCanali(canali: Float32Array[]): AudioBuffer {
    const len = canali[0]?.length ?? 1;
    const b = this.ctx.createBuffer(canali.length, Math.max(1, len), this.sr);
    canali.forEach((c, i) => b.getChannelData(i).set(c));
    return b;
  }

  /** Rumore ciclico (6 s; il bianco 3 s). Generato una volta per contesto. */
  rumore(tipo: TipoRumore): AudioBuffer {
    return this.buffer(`rumore:${tipo}`, () => {
      const sec = tipo === 'bianco' ? 3 : 6;
      const seme = tipo === 'bianco' ? 11 : tipo === 'rosa' ? 23 : 37;
      return this.daCanali([generaRumore(tipo, Math.floor(sec * this.sr), creaRng(seme))]);
    });
  }

  /** Corda del salterio per una nota MIDI. */
  corda(midi: number): AudioBuffer {
    const m = Math.round(midi);
    return this.buffer(`corda:${m}`, () => {
      const f = midiAHz(m);
      const t60 = Math.max(0.9, 5.5 - (m - 48) * 0.09);
      return this.daCanali([
        sintetizzaCorda(
          this.sr,
          f,
          { durata: Math.min(5, t60 * 0.9 + 0.4), t60, durezza: 0.45, cori: 3, scordatura: 3.5 },
          creaRng(1000 + m),
        ),
      ]);
    });
  }

  /** Campana con una certa nota di percussione (Hz). */
  campana(prime: number): AudioBuffer {
    const f = Math.round(prime * 10) / 10;
    return this.buffer(`campana:${f}`, () =>
      this.daCanali([sintetizzaCampana(this.sr, f, 7.5, creaRng(Math.round(f * 13)))]),
    );
  }

  /** Coro di grilli lontani, stereo e ciclico (8 s). */
  coroGrilli(): AudioBuffer {
    return this.buffer('grilli', () => this.daCanali(sintetizzaCoroGrilli(this.sr, 8, 4242)));
  }

  /** Risposta all'impulso del riverbero condiviso (2,6 s). */
  rispostaRiverbero(): AudioBuffer {
    return this.buffer('riverbero', () => this.daCanali(generaRispostaRiverbero(this.sr, 2.6, 777)));
  }

  /** Onda periodica da un elenco di ampiezze armoniche (cache per contesto). */
  onda(nome: string, armoniche: readonly number[]): PeriodicWave {
    let m = cacheOnde.get(this.ctx);
    if (!m) {
      m = new Map();
      cacheOnde.set(this.ctx, m);
    }
    let w = m.get(nome);
    if (!w) {
      const reale = new Float32Array(armoniche.length + 1);
      const imm = new Float32Array(armoniche.length + 1);
      armoniche.forEach((a, i) => (imm[i + 1] = a));
      w = this.ctx.createPeriodicWave(reale, imm, { disableNormalization: false });
      m.set(nome, w);
    }
    return w;
  }

  // ---- fabbrica di nodi ----

  guadagno(v = 1): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  filtro(tipo: BiquadFilterType, f: number, q = 0.707): BiquadFilterNode {
    const b = this.ctx.createBiquadFilter();
    b.type = tipo;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  osc(tipo: OscillatorType, f: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = f;
    return o;
  }

  oscOnda(onda: PeriodicWave, f: number): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.setPeriodicWave(onda);
    o.frequency.value = f;
    return o;
  }

  /** Sorgente di rumore in loop con partenza casuale nel buffer (strati non correlati). */
  sorgenteRumore(tipo: TipoRumore, loop = true): AudioBufferSourceNode & { scarto: number } {
    const s = this.ctx.createBufferSource() as AudioBufferSourceNode & { scarto: number };
    s.buffer = this.rumore(tipo);
    s.loop = loop;
    s.scarto = this.rng() * (s.buffer.duration - 0.5);
    return s;
  }

  /** Pan stereo semplice (−1..1). */
  pan(v: number): StereoPannerNode {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, v));
    return p;
  }
}

// ---------------------------------------------------------------------------
// Attrezzi per inviluppi
// ---------------------------------------------------------------------------

/**
 * Inviluppo percussivo: sale linearmente a `picco` in `attacco` secondi e decade
 * esponenzialmente con costante `tau`. Restituisce l'istante in cui è praticamente spento.
 */
export function colpo(param: AudioParam, t: number, picco: number, attacco: number, tau: number): number {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(picco, t + Math.max(0.0005, attacco));
  param.setTargetAtTime(0, t + Math.max(0.0005, attacco), Math.max(0.001, tau));
  return t + attacco + tau * 7;
}

/**
 * Inviluppo a campana (attacco, tenuta, rilascio) per suoni lunghi e morbidi.
 * Restituisce l'istante di fine.
 */
export function gonfia(
  param: AudioParam,
  t: number,
  picco: number,
  attacco: number,
  tenuta: number,
  rilascio: number,
): number {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(picco, t + attacco);
  param.setValueAtTime(picco, t + attacco + tenuta);
  param.setTargetAtTime(0, t + attacco + tenuta, rilascio / 4);
  return t + attacco + tenuta + rilascio * 1.8;
}

/**
 * Grani: tanti piccoli «tic» scritti sull'automazione di un unico guadagno
 * (economico: una sola sorgente di rumore per centinaia di grani).
 * I grani sovrapposti vengono saltati.
 */
export function grani(
  param: AudioParam,
  istanti: readonly number[],
  durate: readonly number[],
  ampiezze: readonly number[],
): void {
  const ordine = istanti.map((_, i) => i).sort((a, b) => (istanti[a] as number) - (istanti[b] as number));
  let libero = -Infinity;
  for (const i of ordine) {
    const t = istanti[i] as number;
    const d = Math.max(0.0015, durate[i] as number);
    if (t < libero) continue;
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(ampiezze[i] as number, t + d * 0.25);
    param.linearRampToValueAtTime(0, t + d);
    libero = t + d + 0.0005;
  }
}

/** Scollega i nodi quando la sorgente indicata (l'ultima a finire) termina. */
export function pulisci(sorgente: AudioScheduledSourceNode, nodi: readonly AudioNode[]): void {
  sorgente.onended = () => {
    for (const n of nodi) {
      try {
        n.disconnect();
      } catch {
        /* già scollegato */
      }
    }
  };
}

/**
 * Scollega un gruppo di nodi intermedi (guadagni, filtri, mandate) quando il suono è finito.
 * Usa una sorgente costante muta, collegata al primo nodo, come «timer» sul tempo audio:
 * funziona anche nei contesti offline.
 */
export function pulisciA(kit: Kit, fine: number, nodi: readonly (AudioNode | null)[]): void {
  const ancora = nodi.find((n): n is AudioNode => n !== null);
  if (!ancora) return;
  const c = kit.ctx.createConstantSource();
  c.offset.value = 0;
  c.connect(ancora);
  c.start(kit.ctx.currentTime);
  c.stop(Math.max(kit.ctx.currentTime, fine) + 0.05);
  c.onended = () => {
    c.disconnect();
    for (const n of nodi) {
      if (!n) continue;
      try {
        n.disconnect();
      } catch {
        /* già scollegato */
      }
    }
  };
}

/** Collega in catena e restituisce l'ultimo nodo. */
export function catena(...nodi: AudioNode[]): AudioNode {
  for (let i = 0; i < nodi.length - 1; i++) (nodi[i] as AudioNode).connect(nodi[i + 1] as AudioNode);
  return nodi[nodi.length - 1] as AudioNode;
}

/** Collega un nodo alla destinazione: diretto e, se c'è, una mandata al riverbero. */
export function invia(kit: Kit, nodo: AudioNode, dest: Destinazione, mandata: number): GainNode | null {
  nodo.connect(dest.secco);
  if (dest.riverbero && mandata > 0) {
    const g = kit.guadagno(mandata);
    nodo.connect(g);
    g.connect(dest.riverbero);
    return g;
  }
  return null;
}

/**
 * Suona un gruppo di modi risonanti (seni che decadono): legni, ottoni, pietre,
 * piccoli carillon. Restituisce l'istante di fine.
 */
export function suonaModi(
  kit: Kit,
  uscita: AudioNode,
  t: number,
  modi: readonly Modo[],
  attacco = 0.002,
): number {
  let fine = t;
  const nodi: AudioNode[] = [];
  let ultima: OscillatorNode | null = null;
  for (const m of modi) {
    if (m.f <= 20 || m.f >= kit.sr * 0.45 || m.a <= 0) continue;
    const o = kit.osc('sine', m.f);
    const g = kit.guadagno(0);
    o.connect(g).connect(uscita);
    const f = colpo(g.gain, t, m.a, attacco, m.tau);
    o.start(t);
    o.stop(f);
    nodi.push(o, g);
    if (f >= fine) {
      fine = f;
      ultima = o;
    }
  }
  if (ultima) pulisci(ultima, nodi);
  return fine;
}

/** Rumore filtrato con un inviluppo percussivo: soffi, tonfi, fruscii brevi. */
export function soffio(
  kit: Kit,
  uscita: AudioNode,
  t: number,
  opz: {
    tipo?: TipoRumore;
    filtro: BiquadFilterType;
    f: number;
    q?: number;
    fFine?: number;
    picco: number;
    attacco: number;
    tau: number;
  },
): number {
  const s = kit.sorgenteRumore(opz.tipo ?? 'rosa', true);
  const fl = kit.filtro(opz.filtro, opz.f, opz.q ?? 0.707);
  const g = kit.guadagno(0);
  s.connect(fl).connect(g).connect(uscita);
  const fine = colpo(g.gain, t, opz.picco, opz.attacco, opz.tau);
  if (opz.fFine !== undefined) {
    fl.frequency.setValueAtTime(opz.f, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(20, opz.fFine), t + opz.attacco + opz.tau * 2);
  }
  s.start(t, s.scarto);
  s.stop(fine);
  pulisci(s, [s, fl, g]);
  return fine;
}
