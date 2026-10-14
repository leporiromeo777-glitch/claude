/**
 * Riproduzione sul grafo: ogni suono è una sorgente (buffer o oscillatore) con il suo
 * guadagno e, se serve, una panoramica, registrata nel limitatore di voci prima di
 * partire. Non dipende dal tipo di contesto: la usano il gioco e la verifica offline.
 */
import type { AudioGraph, BusId } from './graph';
import type { SoundBank } from './bank';
import type { VoiceEntry, VoiceKind, VoiceLimiter } from './voices';
import type { RecipeId } from './synth/sfx';
import { type Rand, centsToRatio } from './synth/dsp';
import { randomDetuneCents } from './synth/musicbox';

/** Desintonia della nota "sotto" in un incrocio di rancore (GDD 13.2). */
export const RANCOR_CENTS = 40;
/** Nell'incrocio la nota di chi sta sopra parte 30 ms prima. */
export const CROSSING_GAP = 0.03;
/** Guadagno delle note dei personaggi negli effetti. */
export const NOTE_GAIN = 0.32;

export interface PlayOpts {
  bus: BusId;
  kind: VoiceKind;
  /** Tempo del contesto; se manca (o è passato) parte subito. */
  when?: number;
  gain?: number;
  /** Panoramica -1 (sinistra) … 1 (destra). */
  pan?: number;
  /** playbackRate (desintonia, variazioni). */
  rate?: number;
  loop?: boolean;
  persistent?: boolean;
  /** Inizio dentro il buffer (s). */
  offset?: number;
  /** Destinazione diversa dall'ingresso del bus (per esempio il gruppo di un ambiente). */
  dest?: AudioNode;
}

export interface PlayHandle {
  readonly entry: VoiceEntry;
  readonly source: AudioScheduledSourceNode;
  readonly gain: GainNode;
  /** Fine prevista (tempo del contesto; Infinity per i loop). */
  readonly end: number;
  stop(when?: number): void;
}

function clampPan(p: number): number {
  return Number.isFinite(p) ? Math.min(1, Math.max(-1, p)) : 0;
}

export class Player {
  constructor(
    readonly graph: AudioGraph,
    readonly bank: SoundBank,
    readonly limiter: VoiceLimiter,
    private readonly rand: Rand,
  ) {}

  get ctx(): BaseAudioContext {
    return this.graph.ctx;
  }

  now(): number {
    return this.graph.ctx.currentTime;
  }

  private connectOut(g: GainNode, o: { pan?: number; bus: BusId; dest?: AudioNode }): AudioNode[] {
    const extra: AudioNode[] = [];
    let last: AudioNode = g;
    if (o.pan !== undefined && o.pan !== 0 && typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clampPan(o.pan);
      g.connect(p);
      last = p;
      extra.push(p);
    }
    last.connect(o.dest ?? this.graph.input(o.bus));
    return extra;
  }

  private track(src: AudioScheduledSourceNode, g: GainNode, extra: AudioNode[], o: PlayOpts, when: number, end: number): PlayHandle {
    const entry = this.limiter.add(src, { kind: o.kind, persistent: !!o.persistent, end, gain: g });
    src.onended = () => {
      this.limiter.release(entry);
      try {
        src.disconnect();
        g.disconnect();
        for (const n of extra) n.disconnect();
      } catch {
        /* già scollegati */
      }
    };
    return {
      entry,
      source: src,
      gain: g,
      end,
      stop: (at?: number) => {
        try {
          src.stop(Math.max(when, at ?? this.now()));
        } catch {
          /* già fermo */
        }
        if (at === undefined || at <= this.now()) this.limiter.release(entry);
        else entry.end = Math.min(entry.end, at);
      },
    };
  }

  /** Suona un buffer. null se il limitatore non trova posto. */
  play(buffer: AudioBuffer, o: PlayOpts): PlayHandle | null {
    if (!this.limiter.reserve()) return null;
    const ctx = this.ctx;
    const when = Math.max(ctx.currentTime, o.when ?? ctx.currentTime);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const rate = o.rate && o.rate > 0 ? o.rate : 1;
    if (rate !== 1) src.playbackRate.value = rate;
    if (o.loop) src.loop = true;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    src.connect(g);
    const extra = this.connectOut(g, o);
    const offset = Math.max(0, o.offset ?? 0);
    src.start(when, offset);
    const end = o.loop || o.persistent ? Infinity : when + (buffer.duration - offset) / rate + 0.02;
    return this.track(src, g, extra, o, when, end);
  }

  /** Oscillatore persistente (bordone, LFO). `out` riceve l'uscita al posto del bus. */
  oscillator(type: OscillatorType, freq: number, o: { out: AudioNode; detuneCents?: number; gain?: number; kind?: VoiceKind; when?: number }): PlayHandle | null {
    if (!this.limiter.reserve()) return null;
    const ctx = this.ctx;
    const when = Math.max(ctx.currentTime, o.when ?? ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    if (o.detuneCents) osc.detune.value = o.detuneCents;
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    osc.connect(g);
    g.connect(o.out);
    osc.start(when);
    const opts: PlayOpts = { bus: 'musica', kind: o.kind ?? 'music', persistent: true };
    return this.track(osc, g, [], opts, when, Infinity);
  }

  /** Effetto da ricetta. */
  sfx(id: RecipeId, o: { when?: number; gain?: number; pan?: number; detune?: number; bus?: BusId; kind?: VoiceKind } = {}): PlayHandle | null {
    const opts: PlayOpts = { bus: o.bus ?? 'effetti', kind: o.kind ?? 'sfx' };
    if (o.when !== undefined) opts.when = o.when;
    if (o.gain !== undefined) opts.gain = o.gain;
    if (o.pan !== undefined) opts.pan = o.pan;
    if (o.detune) opts.rate = centsToRatio(o.detune);
    return this.play(this.bank.sfx(id), opts);
  }

  /**
   * Nota di carillon a `freq` (desintonia casuale ±3 cent, più `cents`). Senza
   * frequenza (Lino, personaggi senza nota) suona un tocco di legno.
   */
  note(
    freq: number | null,
    o: { when?: number; gain?: number; pan?: number; cents?: number; bus?: BusId; kind?: VoiceKind; exact?: boolean } = {},
  ): PlayHandle | null {
    const opts: PlayOpts = { bus: o.bus ?? 'effetti', kind: o.kind ?? 'sfx', gain: o.gain ?? NOTE_GAIN };
    if (o.when !== undefined) opts.when = o.when;
    if (o.pan !== undefined) opts.pan = o.pan;
    if (freq === null) {
      opts.gain = (o.gain ?? NOTE_GAIN) * 1.2;
      return this.play(this.bank.wood(), opts);
    }
    const cents = (o.cents ?? 0) + (o.exact ? 0 : randomDetuneCents(this.rand));
    if (cents !== 0) opts.rate = centsToRatio(cents);
    return this.play(this.bank.note(freq), opts);
  }

  /**
   * Incrocio (GDD 13.2): tocco di legno + bicordo delle due note, quella di chi sta
   * sopra 30 ms prima. In rancore la nota sotto è stonata di +40 cent (battimenti).
   */
  crossing(overHz: number | null, underHz: number | null, o: { when?: number; rancor?: boolean; pan?: number; gain?: number; wood?: boolean } = {}): void {
    const when = Math.max(this.now(), o.when ?? this.now());
    const k = o.gain ?? 1;
    const pan = o.pan ?? 0;
    if (o.wood !== false) this.play(this.bank.wood(), { bus: 'effetti', kind: 'sfx', when, gain: 0.75 * k, pan });
    this.note(overHz, { when: when + 0.004, gain: NOTE_GAIN * k, pan });
    this.note(underHz, { when: when + 0.004 + CROSSING_GAP, gain: NOTE_GAIN * k, pan, cents: o.rancor ? RANCOR_CENTS : 0 });
  }

  /** Campana: uno dei colpi pre-renderizzati per la stonatura `s`. */
  bell(s: number, o: { when?: number; gain?: number; bus?: BusId; kind?: VoiceKind } = {}): PlayHandle | null {
    const opts: PlayOpts = { bus: o.bus ?? 'effetti', kind: o.kind ?? 'sfx', gain: o.gain ?? 0.85 };
    if (o.when !== undefined) opts.when = o.when;
    return this.play(this.bank.bell(s), opts);
  }
}
