/**
 * Rumori di base (GDD 13.3, ARCHITETTURA 11): bianco, rosa (algoritmo di Voss-McCartney)
 * e marrone (rumore integrato con perdita). Usati in loop dall'ambiente e come materia
 * prima di molte ricette (fruscii, carta, vento, motore della barca).
 */
import { type Rand, normalizeRms } from './dsp';

export type NoiseKind = 'bianco' | 'rosa' | 'marrone';
export const NOISE_KINDS: readonly NoiseKind[] = ['bianco', 'rosa', 'marrone'];

/** Valore efficace dei rumori normalizzati (circa -12 dBFS). */
export const NOISE_RMS = 0.25;

/** Righe del generatore di Voss: 16 ottave coprono tutto lo spettro udibile. */
const VOSS_ROWS = 16;

export function whiteNoise(n: number, rand: Rand): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = rand() * 2 - 1;
  return out;
}

/**
 * Rumore rosa con l'algoritmo di Voss-McCartney: 16 generatori, ognuno aggiornato a
 * metà della frequenza del precedente (si sceglie quello del bit meno significativo che
 * cambia nel contatore), più un bianco. Pendenza di circa -3 dB per ottava.
 */
export function pinkNoise(n: number, rand: Rand): Float32Array {
  const out = new Float32Array(n);
  const rows = new Float64Array(VOSS_ROWS);
  let running = 0;
  for (let k = 0; k < VOSS_ROWS; k++) {
    rows[k] = rand() * 2 - 1;
    running += rows[k]!;
  }
  let counter = 0;
  for (let i = 0; i < n; i++) {
    counter = (counter + 1) & 0xffff;
    if (counter !== 0) {
      // Numero di zeri finali del contatore = indice della riga da aggiornare.
      const k = 31 - Math.clz32(counter & -counter);
      if (k < VOSS_ROWS) {
        running -= rows[k]!;
        const v = rand() * 2 - 1;
        rows[k] = v;
        running += v;
      }
    }
    out[i] = (running + (rand() * 2 - 1)) / (VOSS_ROWS + 1);
  }
  return normalizeRms(out, NOISE_RMS);
}

/** Rumore marrone (rosso): bianco integrato con una piccola perdita, -6 dB per ottava. */
export function brownNoise(n: number, rand: Rand): Float32Array {
  const out = new Float32Array(n);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = (b + 0.02 * (rand() * 2 - 1)) / 1.02;
    out[i] = b;
  }
  // Toglie la componente continua residua.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += out[i]!;
  mean /= Math.max(1, n);
  for (let i = 0; i < n; i++) out[i] = out[i]! - mean;
  return normalizeRms(out, NOISE_RMS);
}

export function noise(kind: NoiseKind, n: number, rand: Rand): Float32Array {
  if (kind === 'rosa') return pinkNoise(n, rand);
  if (kind === 'marrone') return brownNoise(n, rand);
  return normalizeRms(whiteNoise(n, rand), NOISE_RMS);
}

/**
 * Rende un buffer ripetibile senza cuciture: si genera `seconds + fade`, poi la coda
 * si dissolve (a potenza costante) dentro l'inizio. L'ultimo campione del loop è
 * contiguo al primo, quindi in loop non si sente nessun clic.
 */
export function makeLoop(src: Float32Array, loopLength: number): Float32Array {
  const fade = src.length - loopLength;
  if (fade <= 0) return src.slice(0, loopLength);
  const out = src.slice(0, loopLength);
  for (let i = 0; i < fade; i++) {
    const k = i / fade;
    const a = Math.sin((Math.PI / 2) * k);
    const b = Math.cos((Math.PI / 2) * k);
    out[i] = src[i]! * a + src[loopLength + i]! * b;
  }
  return out;
}

/** Rumore in loop di `seconds` secondi (2 s per il pre-render di ARCHITETTURA 11). */
export function noiseLoop(kind: NoiseKind, sr: number, seconds: number, rand: Rand): Float32Array {
  const len = Math.max(2, Math.round(seconds * sr));
  const fade = Math.min(Math.round(0.08 * sr), Math.floor(len / 4));
  return makeLoop(noise(kind, len + fade, rand), len);
}
