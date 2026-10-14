/**
 * Tocco di legno (GDD 13.2): sintesi modale. Un rumore di 2 ms filtrato passa-banda
 * su f0 (casuale fra 500 e 900 Hz, ±5% a ogni colpo) eccita 4 modi con rapporti
 * 1 : 2,76 : 5,40 : 8,93, ampiezze 1 : 0,5 : 0,25 : 0,12 e decadimenti (T60)
 * di 120, 60, 35 e 20 ms. È il suono dei fusi, degli incroci e del tonfo del rifiuto.
 */
import { Biquad, type Rand, makeBuffer, mixInto, normalizePeak, t60ToRadius, filter } from './dsp';

export const WOOD_RATIOS = [1, 2.76, 5.4, 8.93] as const;
export const WOOD_AMPS = [1, 0.5, 0.25, 0.12] as const;
export const WOOD_T60 = [0.12, 0.06, 0.035, 0.02] as const;
export const WOOD_F0_MIN = 500;
export const WOOD_F0_MAX = 900;
/** Variazione di f0 a ogni colpo (±5%). */
export const WOOD_JITTER = 0.05;
/** Durata del rumore che eccita i modi. */
export const WOOD_BURST = 0.002;

/** f0 di un colpo: base casuale 500-900 Hz (o quella data), poi ±5%. */
export function woodF0(rand: Rand, base?: number): number {
  const f = base ?? WOOD_F0_MIN + (WOOD_F0_MAX - WOOD_F0_MIN) * rand();
  return f * (1 + (rand() * 2 - 1) * WOOD_JITTER);
}

export interface WoodOpts {
  /** f0 di base (senza variazione); se manca è casuale fra 500 e 900 Hz. */
  f0?: number;
  /** Picco del colpo. */
  gain?: number;
  /** Moltiplica i decadimenti (più corti < 1 < più lunghi). */
  decay?: number;
  /** Passa-basso finale (per i tonfi). */
  lowpass?: number;
}

/** Un colpo di legno, mono, lungo quanto il modo più lento. */
export function renderWood(sr: number, rand: Rand, o: WoodOpts = {}): Float32Array {
  const f0 = woodF0(rand, o.f0);
  const decay = o.decay ?? 1;
  const longest = Math.max(...WOOD_T60) * decay;
  const out = makeBuffer(longest + 0.01, sr);

  // Eccitazione: 2 ms di rumore con finestra, filtrato passa-banda su f0.
  const burstN = Math.max(4, Math.round(WOOD_BURST * sr));
  const excite = new Float32Array(burstN + Math.round(0.004 * sr));
  const bp = new Biquad('bandpass', f0, 1.4, sr);
  for (let i = 0; i < excite.length; i++) {
    const w = i < burstN ? Math.sin((Math.PI * i) / burstN) : 0;
    excite[i] = bp.tick((rand() * 2 - 1) * w);
  }

  // Ogni modo è un risuonatore a due poli eccitato dallo stesso rumore.
  const mode = new Float32Array(out.length);
  for (let m = 0; m < WOOD_RATIOS.length; m++) {
    const f = f0 * WOOD_RATIOS[m]!;
    if (f >= sr * 0.45) continue;
    const t60 = WOOD_T60[m]! * decay;
    const r = t60ToRadius(t60, sr);
    const c = 2 * r * Math.cos((2 * Math.PI * f) / sr);
    const r2 = r * r;
    const len = Math.min(mode.length, Math.ceil(t60 * sr) + excite.length);
    let y1 = 0;
    let y2 = 0;
    mode.fill(0);
    for (let i = 0; i < len; i++) {
      const x = i < excite.length ? excite[i]! : 0;
      const y = x + c * y1 - r2 * y2;
      y2 = y1;
      y1 = y;
      mode[i] = y;
    }
    // Ogni modo arriva alla sua ampiezza della ricetta.
    normalizePeak(mode, WOOD_AMPS[m]!);
    mixInto(out, mode, 0, 1);
  }
  if (o.lowpass) filter(out, sr, 'lowpass', o.lowpass, 0.8);
  return normalizePeak(out, o.gain ?? 0.6);
}

/** Somma un colpo di legno dentro `out` al tempo `start` (s). */
export function addWood(out: Float32Array, sr: number, start: number, rand: Rand, o: WoodOpts = {}): void {
  mixInto(out, renderWood(sr, rand, o), start * sr, 1);
}
