/**
 * Note dei personaggi a timbro di carillon (GDD 13.2): sinusoide fondamentale +
 * armonica 2 (ampiezza 0,3) + parziale 4,2 (0,1), attacco 2 ms, decadimento
 * esponenziale di 1,2 s, desintonia casuale di ±3 cent (applicata in riproduzione).
 * Le note sono in Re dorico; Lino non ha nota (solo tocco di legno).
 */
import type { CharacterDef, CharacterId } from '../../core/types';
import { type Rand, addDecayingSine, makeBuffer, normalizePeak } from './dsp';

export const MUSICBOX_PARTIALS: readonly { ratio: number; amp: number }[] = [
  { ratio: 1, amp: 1 },
  { ratio: 2, amp: 0.3 },
  { ratio: 4.2, amp: 0.1 },
];
export const MUSICBOX_ATTACK = 0.002;
export const MUSICBOX_T60 = 1.2;
/** Desintonia casuale massima di ogni nota (cent). */
export const MUSICBOX_DETUNE_CENTS = 3;

/** Note dei personaggi (GDD 13.2), in Hz. */
export const DEFAULT_NOTE_HZ: Readonly<Partial<Record<CharacterId, number>>> = {
  piero: 146.83, // Re3
  bepi: 196.0, // Sol3
  livia: 220.0, // La3
  zeno: 261.63, // Do4
  marta: 293.66, // Re4
  lunardi: 349.23, // Fa4
  teresa: 440.0, // La4
  nina: 493.88, // Si4
  clotilde: 523.25, // Do5
  ada: 587.33, // Re5
  gino: 659.25, // Mi5
};

/** Nome della nota di ogni personaggio (per i test e la documentazione). */
export const NOTE_NAMES: Readonly<Partial<Record<CharacterId, string>>> = {
  piero: 'Re3',
  bepi: 'Sol3',
  livia: 'La3',
  zeno: 'Do4',
  marta: 'Re4',
  lunardi: 'Fa4',
  teresa: 'La4',
  nina: 'Si4',
  clotilde: 'Do5',
  ada: 'Re5',
  gino: 'Mi5',
};

/** Le note della scala di Re dorico usate dai suoni (cura, successo, fallimento). */
export const DORIAN_HZ = {
  re4: 293.66,
  fa4: 349.23,
  la4: 440.0,
  do5: 523.25,
  re5: 587.33,
} as const;

export type CharacterLookup = ReadonlyMap<CharacterId, Pick<CharacterDef, 'noteHz'>>;

/**
 * Nota di un personaggio: quella di characters.json se il personaggio c'è (anche null:
 * nessuna nota), altrimenti quella del GDD; null per Lino e per chi non ha nota.
 */
export function noteHzFor(who: CharacterId | 'lino', characters?: CharacterLookup | null): number | null {
  if (who === 'lino') return null;
  const def = characters?.get(who);
  if (def && def.noteHz !== undefined) {
    return typeof def.noteHz === 'number' && Number.isFinite(def.noteHz) && def.noteHz > 0 ? def.noteHz : null;
  }
  return DEFAULT_NOTE_HZ[who] ?? null;
}

/** Desintonia casuale di una nota: ±3 cent. */
export function randomDetuneCents(rand: Rand, max = MUSICBOX_DETUNE_CENTS): number {
  return (rand() * 2 - 1) * max;
}

/** Durata del buffer di una nota (attacco + decadimento fino a -60 dB). */
export function musicBoxSeconds(t60 = MUSICBOX_T60): number {
  return MUSICBOX_ATTACK + t60 + 0.02;
}

/** Somma una nota di carillon in `out` al tempo `start`. */
export function addMusicBoxNote(out: Float32Array, sr: number, start: number, freq: number, amp: number, t60 = MUSICBOX_T60): void {
  for (const p of MUSICBOX_PARTIALS) {
    addDecayingSine(out, sr, { start, freq: freq * p.ratio, amp: amp * p.amp, t60, attack: MUSICBOX_ATTACK });
  }
}

/** Una nota di carillon intonata, con picco `gain`. */
export function renderMusicBoxNote(sr: number, freq: number, gain = 1, t60 = MUSICBOX_T60): Float32Array {
  const out = makeBuffer(musicBoxSeconds(t60), sr);
  addMusicBoxNote(out, sr, 0, freq, 1, t60);
  return normalizePeak(out, gain);
}
