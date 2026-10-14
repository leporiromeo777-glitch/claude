/**
 * Banca dei suoni: trasforma i buffer calcolati in JavaScript (synth/) in AudioBuffer
 * di un contesto e li tiene in cache. Le ricette hanno qualche variante ciascuna
 * (i colpi di legno cambiano a ogni colpo) usate a turno; la campana ha 3 colpi per
 * ogni valore di stonatura; i rumori di base sono loop di 2 s.
 */
import type { CharacterId } from '../core/types';
import type { Rand } from './synth/dsp';
import { renderWood } from './synth/wood';
import { type CharacterLookup, renderMusicBoxNote, noteHzFor } from './synth/musicbox';
import { BELL_SECONDS, renderBell, stonaturaKey } from './synth/bell';
import { type NoiseKind, noiseLoop } from './synth/noise';
import { type BabblePlan, type VoiceLookup, renderBabble, renderPen, voiceFor } from './synth/babble';
import { type RecipeId, recipeBand, recipeVariants, renderRecipe, renderRainLoop } from './synth/sfx';
import type { VoiceProfile } from '../core/types';

/** Colpi di campana pre-renderizzati per ogni valore di stonatura (ARCHITETTURA 11). */
export const BELL_VARIANTS = 3;
/** Durata dei loop dei rumori di base. */
export const NOISE_LOOP_SECONDS = 2;
export const RAIN_LOOP_SECONDS = 4;
export const WOOD_VARIANTS = 8;

export interface BankDeps {
  rand: Rand;
  /** Personaggi (characters.json) per note e voci; null se i contenuti non ci sono. */
  characters: () => (CharacterLookup & VoiceLookup) | null;
}

interface Variants {
  buffers: AudioBuffer[];
  next: number;
}

export class SoundBank {
  readonly hiRate: number;
  readonly loRate: number;
  private readonly variants = new Map<string, Variants>();
  private readonly notes = new Map<number, AudioBuffer>();
  private readonly noises = new Map<NoiseKind, AudioBuffer>();
  private rain: AudioBuffer | null = null;

  constructor(
    readonly ctx: BaseAudioContext,
    private readonly deps: BankDeps,
  ) {
    const sr = ctx.sampleRate || 44100;
    this.hiRate = Math.min(48000, Math.max(22050, Math.round(sr)));
    // Safari non accetta buffer sotto 22050 Hz.
    this.loRate = Math.max(22050, Math.round(this.hiRate / 2));
  }

  /** Un AudioBuffer mono con i campioni dati. */
  buffer(data: Float32Array, sr: number): AudioBuffer {
    const b = this.ctx.createBuffer(1, Math.max(1, data.length), sr);
    try {
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
    } catch {
      b.getChannelData(0).set(data);
    }
    return b;
  }

  rate(band: 'lo' | 'hi'): number {
    return band === 'lo' ? this.loRate : this.hiRate;
  }

  /** Una variante (a turno) di una chiave; ne crea di nuove finché non sono `count`. */
  private variant(key: string, count: number, make: () => AudioBuffer): AudioBuffer {
    let v = this.variants.get(key);
    if (!v) {
      v = { buffers: [], next: 0 };
      this.variants.set(key, v);
    }
    if (v.buffers.length < count) {
      const b = make();
      v.buffers.push(b);
      return b;
    }
    const b = v.buffers[v.next % v.buffers.length]!;
    v.next = (v.next + 1) % v.buffers.length;
    return b;
  }

  private has(key: string): number {
    return this.variants.get(key)?.buffers.length ?? 0;
  }

  /** Buffer di una ricetta (SfxId o suono interno). */
  sfx(id: RecipeId): AudioBuffer {
    return this.variant(`sfx:${id}`, recipeVariants(id), () => this.renderSfx(id));
  }

  private renderSfx(id: RecipeId): AudioBuffer {
    const sr = this.rate(recipeBand(id));
    const chars = this.deps.characters();
    const data = renderRecipe(id, sr, {
      rand: this.deps.rand,
      martaVoice: voiceFor('marta', chars),
      liviaHz: noteHzFor('livia', chars),
    });
    return this.buffer(data, sr);
  }

  /** Tocco di legno semplice (incroci, Lino). */
  wood(): AudioBuffer {
    return this.variant('legno', WOOD_VARIANTS, () => this.buffer(renderWood(this.hiRate, this.deps.rand, { gain: 0.55 }), this.hiRate));
  }

  /** Nota di carillon intonata a `freq` (picco 1: il guadagno lo decide chi suona). */
  note(freq: number): AudioBuffer {
    const key = Math.round(freq * 100);
    let b = this.notes.get(key);
    if (!b) {
      b = this.buffer(renderMusicBoxNote(this.hiRate, freq, 1), this.hiRate);
      this.notes.set(key, b);
    }
    return b;
  }

  /** Frequenza della nota di un personaggio (null: Lino o senza nota). */
  noteHz(who: CharacterId | 'lino'): number | null {
    return noteHzFor(who, this.deps.characters());
  }

  voice(who: CharacterId): VoiceProfile | null {
    return voiceFor(who, this.deps.characters());
  }

  /** Un colpo di campana (a turno fra 3) per la stonatura s. */
  bell(s: number): AudioBuffer {
    return this.variant(`campana:${stonaturaKey(s)}`, BELL_VARIANTS, () => this.renderBell(s));
  }

  bellsReady(s: number): number {
    return this.has(`campana:${stonaturaKey(s)}`);
  }

  private renderBell(s: number): AudioBuffer {
    return this.buffer(renderBell(this.loRate, s, this.deps.rand), this.loRate);
  }

  bellSeconds(): number {
    return BELL_SECONDS;
  }

  /** Loop di 2 s di rumore bianco, rosa o marrone. */
  noise(kind: NoiseKind): AudioBuffer {
    let b = this.noises.get(kind);
    if (!b) {
      b = this.buffer(noiseLoop(kind, this.hiRate, NOISE_LOOP_SECONDS, this.deps.rand), this.hiRate);
      this.noises.set(kind, b);
    }
    return b;
  }

  /** Loop della pioggia granulare. */
  rainLoop(): AudioBuffer {
    if (!this.rain) this.rain = this.buffer(renderRainLoop(this.hiRate, RAIN_LOOP_SECONDS, this.deps.rand), this.hiRate);
    return this.rain;
  }

  babble(plan: BabblePlan, voice: VoiceProfile): AudioBuffer {
    return this.buffer(renderBabble(this.loRate, plan, voice, this.deps.rand), this.loRate);
  }

  pen(text: string): AudioBuffer {
    return this.buffer(renderPen(this.hiRate, text, this.deps.rand), this.hiRate);
  }

  /**
   * Lavori di pre-render (ARCHITETTURA 11): 3 colpi di campana per ogni stonatura
   * (prima quella della giornata corrente), i tre rumori di base, le note dei
   * personaggi, le varianti del legno e una variante di ogni effetto.
   */
  prerenderJobs(stonature: readonly number[], noteFreqs: readonly number[], recipes: readonly RecipeId[]): (() => void)[] {
    const jobs: (() => void)[] = [];
    const seen = new Set<number>();
    for (const s of stonature) {
      const k = stonaturaKey(s);
      if (seen.has(k)) continue;
      seen.add(k);
      for (let i = 0; i < BELL_VARIANTS; i++) {
        jobs.push(() => {
          if (this.bellsReady(s) < BELL_VARIANTS) this.bell(s);
        });
      }
    }
    for (const kind of ['rosa', 'marrone', 'bianco'] as const) jobs.push(() => void this.noise(kind));
    for (const f of noteFreqs) jobs.push(() => void this.note(f));
    for (let i = 0; i < WOOD_VARIANTS; i++) jobs.push(() => {
      if (this.has('legno') < WOOD_VARIANTS) this.wood();
    });
    for (const id of recipes) jobs.push(() => {
      if (this.has(`sfx:${id}`) === 0) this.sfx(id);
    });
    return jobs;
  }
}
