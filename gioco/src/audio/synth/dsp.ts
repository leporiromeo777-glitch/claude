/**
 * Strumenti di sintesi in JavaScript puro (GDD 13): nessun nodo WebAudio, solo
 * Float32Array. I suoni brevi e quelli costosi si calcolano qui e diventano
 * AudioBuffer (una sola sorgente per suono: il limitatore di 48 voci resta semplice),
 * e le stesse funzioni girano identiche in Node per i test.
 *
 * Convenzioni:
 * - i tempi sono in secondi, le frequenze in Hz, `sr` è la frequenza di campionamento;
 * - i "decadimenti" delle ricette del GDD sono T60: il tempo in cui il suono scende di 60 dB
 *   (ampiezza moltiplicata per 1/1000);
 * - il caso arriva da una funzione `Rand` iniettabile (Math.random di default), così i test
 *   possono usare un generatore con seme.
 */

export type Rand = () => number;

/** ln(1000): un decadimento T60 porta l'ampiezza a 1/1000. */
export const LN1000 = Math.log(1000);

/** Raggio del polo per un decadimento T60 a frequenza di campionamento sr. */
export function t60ToRadius(t60: number, sr: number): number {
  if (!(t60 > 0)) return 0;
  return Math.exp(-LN1000 / (t60 * sr));
}

/** Rapporto di frequenza di uno spostamento in cent. */
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}

/** Distanza in cent fra due frequenze (positiva se b è più acuta di a). */
export function ratioToCents(a: number, b: number): number {
  return 1200 * Math.log2(b / a);
}

/** Frequenza di una nota MIDI nel temperamento equabile (La4 = 69 = 440 Hz). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Buffer vuoto di `seconds` secondi. */
export function makeBuffer(seconds: number, sr: number): Float32Array {
  return new Float32Array(Math.max(1, Math.ceil(seconds * sr)));
}

/** Numero in [-1, 1). */
export function bipolar(rand: Rand): number {
  return rand() * 2 - 1;
}

/** Valore casuale in [a, b). */
export function between(rand: Rand, a: number, b: number): number {
  return a + (b - a) * rand();
}

/**
 * Somma in `out` una sinusoide smorzata: amp · r^k · sin(ωk + φ), con un risuonatore
 * a due poli (due moltiplicazioni per campione, il decadimento è già nella ricorsione).
 * `attack` (s) è una rampa lineare iniziale; il suono si ferma a -60 dB.
 */
export function addDecayingSine(
  out: Float32Array,
  sr: number,
  o: { start: number; freq: number; amp: number; t60: number; phase?: number; attack?: number; maxSeconds?: number },
): void {
  const n0 = Math.max(0, Math.round(o.start * sr));
  if (!(o.freq > 0) || o.freq >= sr * 0.49 || o.amp === 0 || n0 >= out.length) return;
  const w = (2 * Math.PI * o.freq) / sr;
  const r = t60ToRadius(o.t60, sr);
  if (r <= 0) return;
  const c = 2 * r * Math.cos(w);
  const r2 = r * r;
  const ph = o.phase ?? 0;
  // s[-1] e s[-2] della sequenza amp·r^k·sin(ωk+φ).
  let s1 = (o.amp / r) * Math.sin(ph - w);
  let s2 = (o.amp / r2) * Math.sin(ph - 2 * w);
  const len = Math.ceil(Math.min(o.t60, o.maxSeconds ?? Infinity) * sr);
  const end = Math.min(out.length, n0 + len);
  const attackN = Math.max(0, Math.round((o.attack ?? 0) * sr));
  for (let n = n0, k = 0; n < end; n++, k++) {
    const s = c * s1 - r2 * s2;
    s2 = s1;
    s1 = s;
    const v = k < attackN ? (s * k) / attackN : s;
    out[n] = out[n]! + v;
  }
}

// ───────────── Filtri biquadratici (Robert Bristow-Johnson, "Audio EQ Cookbook") ─────────────

export type BiquadType = 'lowpass' | 'highpass' | 'bandpass';

export class Biquad {
  private b0 = 1;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(type: BiquadType, freq: number, q: number, sr: number) {
    this.set(type, freq, q, sr);
  }

  /** Cambia i coefficienti senza azzerare lo stato (filtri che si muovono nel tempo). */
  set(type: BiquadType, freq: number, q: number, sr: number): void {
    const f = Math.min(Math.max(freq, 10), sr * 0.49);
    const w0 = (2 * Math.PI * f) / sr;
    const cw = Math.cos(w0);
    const alpha = Math.sin(w0) / (2 * Math.max(q, 0.05));
    let b0: number;
    let b1: number;
    let b2: number;
    if (type === 'lowpass') {
      b0 = (1 - cw) / 2;
      b1 = 1 - cw;
      b2 = (1 - cw) / 2;
    } else if (type === 'highpass') {
      b0 = (1 + cw) / 2;
      b1 = -(1 + cw);
      b2 = (1 + cw) / 2;
    } else {
      // Passa-banda con guadagno di picco 0 dB.
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  reset(): void {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }

  tick(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }

  /** Filtra il buffer sul posto, da `from` a `to` (esclusi). */
  process(buf: Float32Array, from = 0, to = buf.length): void {
    for (let i = Math.max(0, from); i < Math.min(to, buf.length); i++) buf[i] = this.tick(buf[i]!);
  }
}

/** Filtra sul posto con un solo biquad. */
export function filter(buf: Float32Array, sr: number, type: BiquadType, freq: number, q = Math.SQRT1_2): Float32Array {
  new Biquad(type, freq, q, sr).process(buf);
  return buf;
}

/**
 * Filtro con frequenza che si muove nel tempo (esponenziale da f0 a f1 fra t0 e t1,
 * costante prima e dopo). I coefficienti si aggiornano ogni 32 campioni.
 */
export function sweep(
  buf: Float32Array,
  sr: number,
  type: BiquadType,
  o: { f0: number; f1: number; t0: number; t1: number; q?: number; from?: number; to?: number },
): Float32Array {
  const q = o.q ?? Math.SQRT1_2;
  const bq = new Biquad(type, o.f0, q, sr);
  const from = Math.max(0, o.from ?? 0);
  const to = Math.min(buf.length, o.to ?? buf.length);
  const n0 = o.t0 * sr;
  const n1 = Math.max(n0 + 1, o.t1 * sr);
  const ratio = o.f1 / o.f0;
  for (let i = from; i < to; i++) {
    if ((i - from) % 32 === 0) {
      const k = Math.min(1, Math.max(0, (i - n0) / (n1 - n0)));
      bq.set(type, o.f0 * Math.pow(ratio, k), q, sr);
    }
    buf[i] = bq.tick(buf[i]!);
  }
  return buf;
}

// ───────────── Inviluppi e mescolanza ─────────────

/**
 * Inviluppo attacco-tenuta-rilascio (lineare) applicato sul posto a partire da `start`.
 * Prima di `start` e dopo il rilascio il buffer va a zero.
 */
export function envelopeAHR(buf: Float32Array, sr: number, o: { start?: number; attack: number; hold: number; release: number }): Float32Array {
  const s = Math.round((o.start ?? 0) * sr);
  const a = Math.max(1, Math.round(o.attack * sr));
  const h = Math.max(0, Math.round(o.hold * sr));
  const r = Math.max(1, Math.round(o.release * sr));
  for (let i = 0; i < buf.length; i++) {
    const k = i - s;
    let g: number;
    if (k < 0) g = 0;
    else if (k < a) g = k / a;
    else if (k < a + h) g = 1;
    else if (k < a + h + r) g = 1 - (k - a - h) / r;
    else g = 0;
    buf[i] = buf[i]! * g;
  }
  return buf;
}

/** Decadimento esponenziale (T60) applicato sul posto a partire da `start`, con attacco lineare. */
export function envelopeExp(buf: Float32Array, sr: number, o: { start?: number; attack?: number; t60: number }): Float32Array {
  const s = Math.round((o.start ?? 0) * sr);
  const a = Math.max(0, Math.round((o.attack ?? 0) * sr));
  const r = t60ToRadius(o.t60, sr);
  let g = 1;
  for (let i = 0; i < buf.length; i++) {
    const k = i - s;
    if (k < 0) {
      buf[i] = 0;
      continue;
    }
    const att = k < a ? k / a : 1;
    buf[i] = buf[i]! * g * att;
    if (k >= a) g *= r;
  }
  return buf;
}

/** Finestra di Hann (inviluppo "a campana") applicata sul posto. */
export function hann(buf: Float32Array): Float32Array {
  const n = buf.length;
  if (n < 2) return buf;
  for (let i = 0; i < n; i++) buf[i] = buf[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  return buf;
}

/** Dissolvenze lineari in entrata e in uscita (s), per evitare clic ai bordi. */
export function fadeEdges(buf: Float32Array, sr: number, fadeIn: number, fadeOut: number): Float32Array {
  const a = Math.min(buf.length, Math.round(fadeIn * sr));
  const b = Math.min(buf.length, Math.round(fadeOut * sr));
  for (let i = 0; i < a; i++) buf[i] = buf[i]! * (i / a);
  for (let i = 0; i < b; i++) {
    const j = buf.length - 1 - i;
    buf[j] = buf[j]! * (i / b);
  }
  return buf;
}

/** Somma `src` dentro `dst` a partire dal campione `offset`, con guadagno. */
export function mixInto(dst: Float32Array, src: Float32Array, offset: number, gain = 1): Float32Array {
  const o = Math.round(offset);
  const from = Math.max(0, -o);
  const to = Math.min(src.length, dst.length - o);
  for (let i = from; i < to; i++) dst[i + o] = dst[i + o]! + src[i]! * gain;
  return dst;
}

export function scale(buf: Float32Array, g: number): Float32Array {
  for (let i = 0; i < buf.length; i++) buf[i] = buf[i]! * g;
  return buf;
}

export function peakOf(buf: Float32Array): number {
  let p = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = Math.abs(buf[i]!);
    if (v > p) p = v;
  }
  return p;
}

export function rmsOf(buf: Float32Array, from = 0, to = buf.length): number {
  let s = 0;
  const a = Math.max(0, from);
  const b = Math.min(buf.length, to);
  for (let i = a; i < b; i++) s += buf[i]! * buf[i]!;
  return b > a ? Math.sqrt(s / (b - a)) : 0;
}

/** Porta il picco a `target` (niente da fare su un buffer muto). */
export function normalizePeak(buf: Float32Array, target: number): Float32Array {
  const p = peakOf(buf);
  return p > 0 ? scale(buf, target / p) : buf;
}

/** Porta il valore efficace a `target`. */
export function normalizeRms(buf: Float32Array, target: number): Float32Array {
  const r = rmsOf(buf);
  return r > 0 ? scale(buf, target / r) : buf;
}

export interface SignalStats {
  rms: number;
  peak: number;
  nan: boolean;
}

/** Statistiche di controllo: RMS, picco, presenza di NaN o infiniti. */
export function statsOf(buf: Float32Array): SignalStats {
  let s = 0;
  let p = 0;
  let nan = false;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i]!;
    if (!Number.isFinite(v)) {
      nan = true;
      continue;
    }
    s += v * v;
    const a = Math.abs(v);
    if (a > p) p = a;
  }
  return { rms: buf.length ? Math.sqrt(s / buf.length) : 0, peak: p, nan };
}

// ───────────── Oscillatori ─────────────

/** Correzione PolyBLEP per le discontinuità del dente di sega (meno aliasing). */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Oscillatore a dente di sega con fase propria (frequenza che può cambiare a ogni campione). */
export class Saw {
  phase: number;
  constructor(phase = 0) {
    this.phase = phase;
  }
  tick(freq: number, sr: number): number {
    const dt = Math.min(0.5, freq / sr);
    const v = 2 * this.phase - 1 - polyBlep(this.phase, dt);
    this.phase += dt;
    if (this.phase >= 1) this.phase -= 1;
    return v;
  }
}

/** Somma `amp · saw(f)` con frequenza costante in un intervallo del buffer. */
export function addSaw(out: Float32Array, sr: number, o: { start: number; seconds: number; freq: number; amp: number; phase?: number }): void {
  const saw = new Saw(o.phase ?? 0);
  const n0 = Math.max(0, Math.round(o.start * sr));
  const n1 = Math.min(out.length, n0 + Math.round(o.seconds * sr));
  for (let i = n0; i < n1; i++) out[i] = out[i]! + o.amp * saw.tick(o.freq, sr);
}
