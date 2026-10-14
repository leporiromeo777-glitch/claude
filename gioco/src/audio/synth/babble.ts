/**
 * Borbottio dei personaggi (GDD 13.5). Per ogni sillaba: dente di sega all'altezza del
 * personaggio (±8% per sillaba, leggera discesa lungo la frase) → due passa-banda F1 e
 * F2 della vocale (Q 8) → inviluppo (attacco 10 ms, rilascio 30 ms). Una sillaba su due
 * ha prima 15 ms di rumore di consonante (passa-alto 3 kHz). Le vocali vengono dal testo
 * vero della battuta, così il ritmo del borbottio segue la frase.
 *
 * I parametri di ogni voce arrivano da characters.json (`voice`); se mancano si usano
 * quelli della tabella del GDD. Clotilde non parla: le sue note hanno solo la penna.
 */
import type { CharacterDef, CharacterId, VoiceProfile } from '../../core/types';
import { Biquad, type Rand, Saw, filter, makeBuffer, normalizePeak } from './dsp';

export type Vowel = 'a' | 'e' | 'i' | 'o' | 'u';

/** Formanti F1/F2 delle vocali (Hz). */
export const FORMANTS: Readonly<Record<Vowel, readonly [number, number]>> = {
  a: [800, 1200],
  e: [400, 2000],
  i: [300, 2300],
  o: [450, 800],
  u: [325, 700],
};
export const FORMANT_Q = 8;
export const SYLLABLE_ATTACK = 0.01;
export const SYLLABLE_RELEASE = 0.03;
export const CONSONANT_SECONDS = 0.015;
export const CONSONANT_HIGHPASS = 3000;
/** Variazione d'altezza per sillaba (±8%). */
export const PITCH_JITTER = 0.08;
/** Sillabe al massimo per battuta (una riga di gioco ne ha meno di 40). */
export const MAX_SYLLABLES = 72;

/** Pause prima di una sillaba, in periodi di sillaba. */
const PAUSE_WORD = 0.25;
const PAUSE_COMMA = 1;
const PAUSE_SENTENCE = 2;
const PAUSE_DASH = 0.6;

/** Voci della tabella GDD 13.5 (più quelle dei personaggi che il GDD non elenca). */
export const DEFAULT_VOICES: Readonly<Record<CharacterId, VoiceProfile | null>> = {
  teresa: { pitch: 260, rate: 11, formantShift: 0, noise: 0 },
  marta: { pitch: 220, rate: 8, formantShift: 0, noise: 0 },
  piero: { pitch: 110, rate: 5, formantShift: 0, noise: 0 },
  gino: { pitch: 330, rate: 12, formantShift: 0, noise: 0 },
  bepi: { pitch: 120, rate: 7, formantShift: 0, noise: 0.2 },
  nina: { pitch: 280, rate: 9, formantShift: 0, noise: 0 },
  zeno: { pitch: 100, rate: 4, formantShift: 0, noise: 0.3 },
  lunardi: { pitch: 150, rate: 7, formantShift: 0.1, noise: 0 },
  livia: { pitch: 200, rate: 6, formantShift: 0, noise: 0, lowpass: 2500 },
  // Non nella tabella del GDD: valori coerenti con età e carattere.
  ada: { pitch: 240, rate: 8, formantShift: 0.05, noise: 0.05 },
  clotilde: null,
  ernesto: { pitch: 125, rate: 6, formantShift: 0, noise: 0.1 },
  anselmo: { pitch: 105, rate: 5, formantShift: 0, noise: 0.05 },
  aldo: { pitch: 135, rate: 7, formantShift: 0, noise: 0.1 },
  bortolo: { pitch: 140, rate: 6, formantShift: 0.05, noise: 0 },
  arianna: { pitch: 230, rate: 7, formantShift: 0, noise: 0.05, lowpass: 3000 },
};

/** Il carattere della voce oltre ai numeri di VoiceProfile (colonna "Carattere" del GDD). */
export interface VoiceStyle {
  /** Parte del periodo in cui la sillaba suona (sillabe corte < 1). */
  duty: number;
  /** Variazione d'altezza fra le sillabe. */
  jitter: number;
  /** Discesa dell'altezza dall'inizio alla fine della frase. */
  descent: number;
}
export const DEFAULT_STYLE: VoiceStyle = { duty: 0.75, jitter: PITCH_JITTER, descent: 0.1 };
export const VOICE_STYLES: Readonly<Partial<Record<CharacterId, Partial<VoiceStyle>>>> = {
  marta: { duty: 0.5 }, // decisa, sillabe corte
  piero: { descent: 0.15, duty: 0.85 }, // lenta, grave
  gino: { jitter: 0.16 }, // saltellante
  nina: { jitter: 0.11 }, // viva
  lunardi: { jitter: 0.04, duty: 0.65 }, // precisa
  livia: { duty: 0.9 }, // morbida
};

/** Voce di riserva per un personaggio senza dati. */
export const FALLBACK_VOICE: VoiceProfile = { pitch: 200, rate: 8, formantShift: 0, noise: 0 };

export type VoiceLookup = ReadonlyMap<CharacterId, Pick<CharacterDef, 'voice'>>;

function num(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

/** Voce di un personaggio: characters.json se c'è, altrimenti la tabella; null = non parla. */
export function voiceFor(who: CharacterId, characters?: VoiceLookup | null): VoiceProfile | null {
  const fromDb = characters?.get(who)?.voice;
  const v = fromDb ?? DEFAULT_VOICES[who];
  if (v === null) return null;
  if (v === undefined) return FALLBACK_VOICE;
  const base = DEFAULT_VOICES[who] ?? FALLBACK_VOICE;
  const out: VoiceProfile = {
    pitch: num(v.pitch, 40, 1000, base.pitch),
    rate: num(v.rate, 1, 20, base.rate),
    formantShift: num(v.formantShift, -0.5, 0.5, 0),
    noise: num(v.noise, 0, 1, 0),
  };
  const lp = v.lowpass ?? (fromDb ? undefined : base.lowpass);
  if (typeof lp === 'number' && Number.isFinite(lp) && lp > 100) out.lowpass = lp;
  return out;
}

export function styleFor(who: CharacterId): VoiceStyle {
  return { ...DEFAULT_STYLE, ...(VOICE_STYLES[who] ?? {}) };
}

// ───────────── Dal testo alle sillabe (funzioni pure) ─────────────

export interface SyllableToken {
  vowel: Vowel;
  /** Pausa prima della sillaba, in periodi (0 dentro una parola). */
  pause: number;
  /** Ultima sillaba prima di un punto interrogativo. */
  question: boolean;
}

const OPENNESS: Record<Vowel, number> = { a: 4, e: 3, o: 3, i: 1, u: 1 };

/** Toglie i marcatori del testo ricco (`[[teresa]]`, `*corsivo*`) e gli accenti. */
export function plainText(text: string): string {
  return text
    .replace(/\[\[([a-z0-9_]+)\]\]/gi, '$1')
    .replace(/\*/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Vocale nucleo di un gruppo di vocali: la più aperta (a > e, o > i, u); a parità l'ultima. */
export function nucleus(run: string): Vowel {
  let best: Vowel = 'a';
  let score = -1;
  for (const ch of run) {
    const v = (ch === 'y' ? 'i' : ch) as Vowel;
    const s = OPENNESS[v];
    if (s !== undefined && s >= score) {
      best = v;
      score = s;
    }
  }
  return best;
}

function isVowel(ch: string): boolean {
  return ch === 'a' || ch === 'e' || ch === 'i' || ch === 'o' || ch === 'u' || ch === 'y';
}

/**
 * Sillabe di un testo: ogni gruppo di vocali consecutive è una sillaba (con la vocale
 * più aperta come nucleo: "buon-gior-no" → o, o, o), ogni cifra una sillaba. Spazi,
 * virgole e punti diventano pause prima della sillaba successiva.
 */
export function textToSyllables(text: string): SyllableToken[] {
  const s = plainText(text);
  const out: SyllableToken[] = [];
  let run = '';
  let pending = 0;
  const flush = (): void => {
    if (!run) return;
    out.push({ vowel: nucleus(run), pause: out.length === 0 ? 0 : pending, question: false });
    pending = 0;
    run = '';
  };
  for (const ch of s) {
    if (isVowel(ch)) {
      run += ch;
      continue;
    }
    flush();
    if (ch >= '0' && ch <= '9') {
      out.push({ vowel: 'e', pause: out.length === 0 ? 0 : pending, question: false });
      pending = 0;
    } else if (ch === ' ' || ch === '\t') pending = Math.max(pending, PAUSE_WORD);
    else if (ch === ',' || ch === ';' || ch === ':') pending = Math.max(pending, PAUSE_COMMA);
    else if (ch === '.' || ch === '!' || ch === '…' || ch === '\n') pending = Math.max(pending, PAUSE_SENTENCE);
    else if (ch === '?') {
      pending = Math.max(pending, PAUSE_SENTENCE);
      const last = out[out.length - 1];
      if (last) last.question = true;
    } else if (ch === '—' || ch === '–' || ch === '-') pending = Math.max(pending, PAUSE_DASH);
  }
  flush();
  return out;
}

export interface PlannedSyllable {
  /** Inizio della vocale (s). */
  t: number;
  /** Durata della vocale prima del rilascio (s). */
  dur: number;
  vowel: Vowel;
  /** Altezza (Hz). */
  f0: number;
  /** Rumore di consonante nei 15 ms prima. */
  consonant: boolean;
}

export interface BabblePlan {
  syllables: PlannedSyllable[];
  /** Durata totale, rilascio compreso (s). */
  duration: number;
  /** Sillabe al secondo usate. */
  rate: number;
}

/**
 * Pianifica il borbottio: tempi, vocali e altezze. Una sillaba per periodo (1 / rate),
 * più le pause della punteggiatura; la durata è quindi circa sillabe / rate.
 */
export function planBabble(
  text: string,
  voice: VoiceProfile,
  o: { rate?: number; rand?: Rand; style?: VoiceStyle; maxSyllables?: number } = {},
): BabblePlan {
  const rand = o.rand ?? Math.random;
  const style = o.style ?? DEFAULT_STYLE;
  const rate = num(o.rate ?? voice.rate, 1, 30, 8);
  const period = 1 / rate;
  const tokens = textToSyllables(text).slice(0, o.maxSyllables ?? MAX_SYLLABLES);
  const n = tokens.length;
  const syllables: PlannedSyllable[] = [];
  // La prima consonante deve stare dentro il buffer.
  let t = CONSONANT_SECONDS;
  for (let i = 0; i < n; i++) {
    const tok = tokens[i]!;
    if (i > 0) t += tok.pause * period;
    const progress = n > 1 ? i / (n - 1) : 0;
    const jitter = 1 + style.jitter * (rand() * 2 - 1);
    const f0 = voice.pitch * jitter * (1 - style.descent * progress) * (tok.question ? 1.15 : 1);
    syllables.push({ t, dur: period * style.duty, vowel: tok.vowel, f0, consonant: i % 2 === 0 });
    t += period;
  }
  const last = syllables[n - 1];
  const duration = last ? last.t + last.dur + SYLLABLE_RELEASE : 0;
  return { syllables, duration, rate };
}

/** Rende il borbottio pianificato, mono, con picco `gain`. */
export function renderBabble(sr: number, plan: BabblePlan, voice: VoiceProfile, rand: Rand, gain = 0.5): Float32Array {
  const out = makeBuffer(plan.duration + 0.02, sr);
  const shift = 1 + voice.formantShift;
  const noiseMix = Math.min(1, Math.max(0, voice.noise));
  const attackN = Math.max(1, Math.round(SYLLABLE_ATTACK * sr));
  const releaseN = Math.max(1, Math.round(SYLLABLE_RELEASE * sr));
  const consN = Math.max(1, Math.round(CONSONANT_SECONDS * sr));
  for (const syl of plan.syllables) {
    const n0 = Math.round(syl.t * sr);
    const holdN = Math.max(attackN, Math.round(syl.dur * sr));
    const len = holdN + releaseN;
    const [fa, fb] = FORMANTS[syl.vowel];
    const bp1 = new Biquad('bandpass', fa * shift, FORMANT_Q, sr);
    const bp2 = new Biquad('bandpass', fb * shift, FORMANT_Q, sr);
    const saw = new Saw(rand());
    const sawGain = 1 - 0.5 * noiseMix;
    const noiseGain = noiseMix * 3;
    const end = Math.min(len, out.length - n0);
    // Piccola discesa dentro la sillaba, come nel parlato: -4% dall'inizio alla fine.
    const glide = (0.04 * syl.f0) / len;
    for (let k = 0; k < end; k++) {
      let src = saw.tick(syl.f0 - glide * k, sr) * sawGain;
      if (noiseGain > 0) src += (rand() * 2 - 1) * noiseGain;
      const y = bp1.tick(src) + 0.7 * bp2.tick(src);
      const env = k < attackN ? k / attackN : k < holdN ? 1 : 1 - (k - holdN) / releaseN;
      out[n0 + k] = out[n0 + k]! + y * env;
    }
    if (syl.consonant) {
      const hp = new Biquad('highpass', CONSONANT_HIGHPASS, 0.7, sr);
      const c0 = n0 - consN;
      for (let k = 0; k < consN; k++) {
        const i = c0 + k;
        if (i < 0 || i >= out.length) continue;
        const w = Math.sin((Math.PI * k) / consN);
        out[i] = out[i]! + 0.15 * hp.tick((rand() * 2 - 1) * w);
      }
    }
  }
  if (voice.lowpass) filter(out, sr, 'lowpass', voice.lowpass, 0.7);
  return normalizePeak(out, gain);
}

/** Durata della penna di Clotilde per un testo (s). */
export function penSeconds(text: string): number {
  const strokes = Math.min(24, Math.max(3, textToSyllables(text).length));
  // Un tratto ogni 0,14-0,26 s (vedi renderPen), più l'ultimo tratto.
  return strokes * 0.26 + 0.15;
}

/** Penna di Clotilde: graffi di pennino (rumore passa-banda ~3,2 kHz, tratti di 60-120 ms). */
export function renderPen(sr: number, text: string, rand: Rand, gain = 0.4): Float32Array {
  const strokes = Math.min(24, Math.max(3, textToSyllables(text).length));
  const out = makeBuffer(penSeconds(text), sr);
  let t = 0.02;
  for (let s = 0; s < strokes; s++) {
    const dur = 0.06 + 0.06 * rand();
    const n0 = Math.round(t * sr);
    const len = Math.round(dur * sr);
    const bp = new Biquad('bandpass', 3200 * (0.8 + 0.4 * rand()), 1.8, sr);
    const grain = 30 + 20 * rand();
    for (let k = 0; k < len && n0 + k < out.length; k++) {
      const x = k / len;
      const env = Math.sin(Math.PI * x) * (0.55 + 0.45 * Math.sin((2 * Math.PI * grain * k) / sr));
      out[n0 + k] = out[n0 + k]! + bp.tick(rand() * 2 - 1) * env;
    }
    t += 0.2 * (0.7 + 0.6 * rand());
  }
  return normalizePeak(out, gain);
}
