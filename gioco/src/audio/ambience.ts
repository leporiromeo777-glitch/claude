/**
 * Ambienti (GDD 13.3), nodi persistenti con dissolvenze setTargetAtTime (costante 0,3 s):
 *
 * - laguna: rumore rosa → passa-basso 900 Hz, più un passa-banda che oscilla con un LFO
 *   a 0,08 Hz (le onde); gabbiani ogni 8-20 s;
 * - notte: acqua che lambisce (rumore passa-basso 400 Hz modulato in ampiezza a 0,3 Hz)
 *   e un orologio che ticchetta piano (fermo nel prologo);
 * - pioggia: granulare (200 grani al secondo, passa-alto 2 kHz) più un letto passa-basso;
 * - vento: rumore marrone passa-banda 300-800 Hz con LFO lento;
 * - tempesta: vento + pioggia + tuoni (rumore marrone di 2,5 s, passa-basso 800 → 120 Hz).
 */
import type { AmbienceId } from '../core/types';
import { FADE_TC } from './graph';
import type { PlayHandle, Player } from './player';
import type { Track } from './scheduler';
import type { Rand } from './synth/dsp';

export const AMBIENCE_IDS: readonly AmbienceId[] = ['silenzio', 'laguna', 'notte', 'pioggia', 'vento', 'tempesta'];
export const GULL_EVERY = [8, 20] as const;
export const THUNDER_EVERY = [9, 22] as const;
export const CLOCK_GAIN = 0.16;

export interface AmbienceDeps {
  player: Player;
  rand: Rand;
  /** Nel prologo l'orologio è fermo (Clotilde è morta alle 5:59). */
  clockStopped(): boolean;
  /** Suoni d'ambiente che meritano una didascalia (tuono). */
  onEvent?(id: 'tuono'): void;
}

interface Group {
  id: AmbienceId;
  out: GainNode;
  handles: PlayHandle[];
  nodes: AudioNode[];
  until: number;
}

export class AmbienceTrack implements Track {
  private current: AmbienceId = 'silenzio';
  private group: Group | null = null;
  private fading: Group[] = [];
  private nextGull = Infinity;
  private nextTick = Infinity;
  private tickOdd = false;
  private nextThunder = Infinity;

  constructor(private readonly deps: AmbienceDeps) {}

  id(): AmbienceId {
    return this.current;
  }

  private get ctx(): BaseAudioContext {
    return this.deps.player.ctx;
  }

  private between(a: number, b: number): number {
    return a + (b - a) * this.deps.rand();
  }

  set(a: AmbienceId, fadeMs?: number): void {
    if (a === this.current && (this.group || a === 'silenzio')) return;
    const now = this.ctx.currentTime;
    const tc = fadeMs !== undefined && Number.isFinite(fadeMs) ? Math.max(0.005, fadeMs / 1000 / 3) : FADE_TC;
    if (this.group) {
      const g = this.group;
      this.group = null;
      g.out.gain.cancelScheduledValues(now);
      g.out.gain.setTargetAtTime(0, now, tc);
      g.until = now + tc * 7 + 0.05;
      for (const h of g.handles) h.stop(g.until);
      this.fading.push(g);
    }
    this.current = a;
    this.nextGull = this.nextTick = this.nextThunder = Infinity;
    if (a === 'silenzio') return;
    this.group = this.build(a, now, tc);
  }

  private build(a: AmbienceId, now: number, tc: number): Group {
    const ctx = this.ctx;
    const p = this.deps.player;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, now, tc);
    out.connect(p.graph.input('ambiente'));
    const g: Group = { id: a, out, handles: [], nodes: [out], until: Infinity };
    const keep = (h: PlayHandle | null): void => {
      if (h) g.handles.push(h);
    };
    const biquad = (type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      f.connect(dest);
      g.nodes.push(f);
      return f;
    };
    const gain = (v: number, dest: AudioNode): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      n.connect(dest);
      g.nodes.push(n);
      return n;
    };
    const loop = (buffer: AudioBuffer, dest: AudioNode, level: number, offset = 0): void => {
      keep(p.play(buffer, { bus: 'ambiente', kind: 'ambience', loop: true, persistent: true, dest, gain: level, offset }));
    };
    /** LFO persistente che modula un parametro: valore = base + depth · sin. */
    const lfo = (hz: number, depth: number, param: AudioParam): void => {
      const d = ctx.createGain();
      d.gain.value = depth;
      d.connect(param);
      g.nodes.push(d);
      keep(p.oscillator('sine', hz, { out: d, kind: 'ambience', gain: 1 }));
    };
    const bank = p.bank;

    const wind = (level: number): void => {
      const amp = gain(1, out);
      lfo(0.11, 0.3, amp.gain);
      const bp = biquad('bandpass', 550, 1.1, amp);
      lfo(0.07, 200, bp.frequency);
      loop(bank.noise('marrone'), bp, 1.6 * level);
    };
    const rain = (level: number): void => {
      loop(bank.rainLoop(), out, 0.55 * level);
      const bed = biquad('lowpass', 500, 0.7, out);
      loop(bank.noise('rosa'), bed, 0.35 * level, 0.7);
    };

    switch (a) {
      case 'laguna': {
        const lp = biquad('lowpass', 900, 0.7, out);
        loop(bank.noise('rosa'), lp, 0.5);
        const bp = biquad('bandpass', 500, 1.2, out);
        lfo(0.08, 300, bp.frequency);
        loop(bank.noise('rosa'), bp, 0.6, 1.0);
        this.nextGull = now + this.between(3, 8);
        break;
      }
      case 'notte': {
        const am = gain(0.55, out);
        lfo(0.3, 0.4, am.gain);
        const lp = biquad('lowpass', 400, 0.7, am);
        loop(bank.noise('rosa'), lp, 0.9);
        this.nextTick = now + 0.6;
        break;
      }
      case 'pioggia':
        rain(1);
        break;
      case 'vento':
        wind(1);
        break;
      case 'tempesta':
        wind(1.25);
        rain(1);
        this.nextThunder = now + this.between(2, 5);
        break;
      case 'silenzio':
        break;
    }
    return g;
  }

  schedule(from: number, to: number): void {
    const p = this.deps.player;
    const g = this.group;
    if (g) {
      if (this.nextGull < from - 1) this.nextGull = from + this.between(1, 4);
      while (this.nextGull < to) {
        p.play(p.bank.sfx('gabbiano'), {
          bus: 'ambiente',
          kind: 'ambience',
          when: this.nextGull,
          dest: g.out,
          gain: 0.4 + 0.25 * this.deps.rand(),
          pan: (this.deps.rand() * 2 - 1) * 0.7,
        });
        this.nextGull += this.between(GULL_EVERY[0], GULL_EVERY[1]);
      }
      if (this.nextTick < from - 1) this.nextTick = from;
      while (this.nextTick < to) {
        if (!this.deps.clockStopped()) {
          p.play(p.bank.sfx(this.tickOdd ? 'toc' : 'tic'), { bus: 'ambiente', kind: 'ambience', when: this.nextTick, dest: g.out, gain: CLOCK_GAIN, pan: 0.25 });
        }
        this.tickOdd = !this.tickOdd;
        this.nextTick += 1;
      }
      if (this.nextThunder < from - 1) this.nextThunder = from + this.between(1, 4);
      while (this.nextThunder < to) {
        p.play(p.bank.sfx('tuono'), {
          bus: 'ambiente',
          kind: 'ambience',
          when: this.nextThunder,
          dest: g.out,
          gain: 0.7 + 0.3 * this.deps.rand(),
          pan: (this.deps.rand() * 2 - 1) * 0.4,
        });
        this.deps.onEvent?.('tuono');
        this.nextThunder += this.between(THUNDER_EVERY[0], THUNDER_EVERY[1]);
      }
    }
    if (this.fading.length) {
      const now = this.ctx.currentTime;
      this.fading = this.fading.filter((f) => {
        if (now < f.until) return true;
        for (const n of f.nodes) {
          try {
            n.disconnect();
          } catch {
            /* già scollegato */
          }
        }
        return false;
      });
    }
  }

  active(): boolean {
    return this.group !== null || this.fading.length > 0;
  }

  stop(): void {
    this.set('silenzio', 50);
  }
}
