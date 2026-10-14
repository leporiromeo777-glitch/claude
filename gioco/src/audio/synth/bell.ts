/**
 * Campana dell'ora (GDD 13.2): sintesi additiva con le parziali di una campana.
 *
 * | parziale  | 0,5 | 1   | 1,2 | 1,5  | 2   | 2,5  | 3   | 4    |
 * | ampiezza  | 0,6 | 0,8 | 0,5 | 0,35 | 0,7 | 0,25 | 0,2 | 0,15 |
 * | T60 (s)   | 4   | 3   | 2,5 | 2    | 1,8 | 1,2  | 1   | 0,8  |
 * | stonatura | -35 | +20 | -45 | +30  | -25 | +40  | -15 | +10  | (cent, moltiplicati per s)
 *
 * Fondamentale (prime) 196 Hz; colpo di batacchio di 15 ms (rumore passa-banda 1,2 kHz).
 * Con s > 0 si aggiunge un ronzio (rumore modulato) di ampiezza 0,15 × s.
 * s = 1 nel prologo e nell'Atto I, 0,6 nell'Atto II, 0,25 nell'Atto III, 0 dopo il finale vero.
 */
import { Biquad, type Rand, addDecayingSine, centsToRatio, makeBuffer, normalizePeak, t60ToRadius } from './dsp';

export const BELL_PRIME = 196;
export const BELL_RATIOS = [0.5, 1, 1.2, 1.5, 2, 2.5, 3, 4] as const;
export const BELL_AMPS = [0.6, 0.8, 0.5, 0.35, 0.7, 0.25, 0.2, 0.15] as const;
export const BELL_T60 = [4, 3, 2.5, 2, 1.8, 1.2, 1, 0.8] as const;
export const BELL_DETUNE_CENTS = [-35, 20, -45, 30, -25, 40, -15, 10] as const;
/** Ampiezza del ronzio per s = 1. */
export const BELL_HUM = 0.15;
export const BELL_STRIKE_SECONDS = 0.015;
export const BELL_STRIKE_HZ = 1200;
/** I valori di stonatura usati dal gioco (GDD 13.2), da pre-renderizzare. */
export const STONATURE: readonly number[] = [1, 0.6, 0.25, 0];
/** Durata del buffer: la parziale più lunga (4 s) più un margine. */
export const BELL_SECONDS = 4.2;

export interface BellPartial {
  ratio: number;
  freq: number;
  amp: number;
  t60: number;
  /** Spostamento applicato in cent (s × tabella). */
  cents: number;
}

function clamp01(s: number): number {
  return Number.isFinite(s) ? Math.min(1, Math.max(0, s)) : 1;
}

/** Le 8 parziali della campana per la stonatura `s` (0..1). Funzione pura. */
export function bellPartials(s: number, prime = BELL_PRIME): BellPartial[] {
  const k = clamp01(s);
  return BELL_RATIOS.map((ratio, i) => {
    const cents = k * BELL_DETUNE_CENTS[i]!;
    return { ratio, freq: prime * ratio * centsToRatio(cents), amp: BELL_AMPS[i]!, t60: BELL_T60[i]!, cents };
  });
}

/** Ampiezza del ronzio per la stonatura `s`. */
export function bellHum(s: number): number {
  return BELL_HUM * clamp01(s);
}

/** Chiave di cache di un valore di stonatura (centesimi). */
export function stonaturaKey(s: number): number {
  return Math.round(clamp01(s) * 100);
}

export interface BellOpts {
  prime?: number;
  /** Picco del colpo. */
  gain?: number;
  /** Variazione naturale fra un colpo e l'altro (ampiezze ±8%, batacchio diverso). */
  vary?: boolean;
}

/** Un colpo di campana, mono. */
export function renderBell(sr: number, s: number, rand: Rand, o: BellOpts = {}): Float32Array {
  const out = makeBuffer(BELL_SECONDS, sr);
  const vary = o.vary ?? true;
  for (const p of bellPartials(s, o.prime ?? BELL_PRIME)) {
    const amp = p.amp * (vary ? 1 + (rand() * 2 - 1) * 0.08 : 1);
    addDecayingSine(out, sr, { start: 0, freq: p.freq, amp, t60: p.t60, attack: 0.003, phase: vary ? rand() * 0.6 : 0 });
  }

  // Batacchio: 15 ms di rumore passa-banda a 1,2 kHz, con un decadimento rapido.
  const strikeN = Math.round(BELL_STRIKE_SECONDS * sr);
  const bp = new Biquad('bandpass', BELL_STRIKE_HZ * (vary ? 1 + (rand() * 2 - 1) * 0.04 : 1), 1.5, sr);
  const strikeLen = Math.min(out.length, strikeN + Math.round(0.02 * sr));
  for (let i = 0; i < strikeLen; i++) {
    const env = i < strikeN ? Math.exp(-i / (strikeN * 0.35)) : 0;
    out[i] = out[i]! + 2.4 * bp.tick((rand() * 2 - 1) * env);
  }

  // Ronzio della campana crepata: rumore stretto attorno alla prime, modulato a ~7 Hz.
  const hum = bellHum(s);
  if (hum > 0) {
    const prime = o.prime ?? BELL_PRIME;
    const f1 = new Biquad('bandpass', prime * 1.02, 6, sr);
    const f2 = new Biquad('bandpass', prime * 2.03, 8, sr);
    const humT60 = 3;
    const r = t60ToRadius(humT60, sr);
    let g = 1;
    // Il rumore filtrato così stretto ha un'ampiezza bassa: la si riporta a ~1 di picco
    // (la banda passante, relativa a Nyquist, cresce quando sr scende).
    const norm = 7.5 * Math.sqrt(sr / 44100);
    // Modulazione a 6,7 Hz con un oscillatore ricorsivo (niente Math.sin per campione).
    const wm = (2 * Math.PI * 6.7) / sr;
    const cm = 2 * Math.cos(wm);
    let s1 = Math.sin(-wm);
    let s2 = Math.sin(-2 * wm);
    const end = Math.min(out.length, Math.ceil(humT60 * sr));
    for (let i = 0; i < end; i++) {
      const sm = cm * s1 - s2;
      s2 = s1;
      s1 = sm;
      const x = rand() * 2 - 1;
      const h = (f1.tick(x) + 0.6 * f2.tick(x)) * norm;
      out[i] = out[i]! + hum * h * (0.55 + 0.45 * sm) * g;
      g *= r;
    }
  }
  return normalizePeak(out, o.gain ?? 0.7);
}
