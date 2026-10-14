/**
 * Ricette degli effetti (GDD 13.2). Ogni ricetta rende un buffer mono in JavaScript:
 * in riproduzione ogni effetto è una sola sorgente (con guadagno e panoramica propri).
 * I picchi restano sotto 0,7: la somma passa poi dal compressore del master.
 *
 * Oltre agli SfxId del contratto ci sono quattro suoni interni: 'tonfo' (il rifiuto
 * senza la voce di Marta, per le altre violazioni), 'tic' e 'toc' (l'orologio della
 * notte) e 'tuono' (la tempesta).
 */
import type { SfxId, VoiceProfile } from '../../core/types';
import {
  type Rand,
  addDecayingSine,
  addSaw,
  centsToRatio,
  envelopeAHR,
  envelopeExp,
  fadeEdges,
  filter,
  hann,
  makeBuffer,
  mixInto,
  normalizePeak,
  sweep,
} from './dsp';
import { renderWood, woodF0 } from './wood';
import { DORIAN_HZ, DEFAULT_NOTE_HZ, addMusicBoxNote } from './musicbox';
import { DEFAULT_VOICES, planBabble, renderBabble } from './babble';
import { brownNoise, makeLoop, pinkNoise, whiteNoise } from './noise';

export const SFX_IDS = [
  'fuso_presa', 'fuso_rilascio', 'incrocio', 'rovescia', 'lettera', 'voce', 'segreto',
  'febbre', 'cura', 'nodo', 'rifiuto', 'disfa', 'ora_fissata', 'vaporetto', 'barca',
  'gabbiano', 'pagina', 'bottiglia', 'carta', 'successo', 'fallimento', 'trabocco',
  'marea', 'nero', 'ui_tap', 'ui_indietro',
] as const satisfies readonly SfxId[];
type Exhaustive<All, Listed> = [Exclude<All, Listed>] extends [never] ? true : false;
const sfxExhaustive: Exhaustive<SfxId, (typeof SFX_IDS)[number]> = true;
void sfxExhaustive;

export const EXTRA_SOUND_IDS = ['tonfo', 'tic', 'toc', 'tuono'] as const;
export type ExtraSoundId = (typeof EXTRA_SOUND_IDS)[number];
export type RecipeId = SfxId | ExtraSoundId;

export interface RecipeDeps {
  rand: Rand;
  /** Voce di Marta per il «No.» del rifiuto (characters.json o tabella). */
  martaVoice?: VoiceProfile | null;
  /** Nota di Livia per l'arrivo del filo nero. */
  liviaHz?: number | null;
}

/**
 * Ricette pre-renderizzate in idle dopo lo sblocco: quelle che rispondono a un gesto e
 * non devono avere nemmeno qualche millisecondo di ritardo. Le altre (vaporetto, tuono,
 * gabbiani…) si rendono al primo uso.
 */
export const WARM_RECIPES: readonly RecipeId[] = [
  'fuso_presa', 'fuso_rilascio', 'incrocio', 'rovescia', 'disfa', 'ora_fissata', 'rifiuto', 'tonfo',
  'lettera', 'voce', 'segreto', 'pagina', 'ui_tap', 'ui_indietro', 'tic', 'toc',
];

/** T60 "infinito": sinusoide che non decade (il resto lo fa l'inviluppo). */
const SUSTAIN = 1e4;

/** Ricette solo gravi: si rendono a frequenza di campionamento ridotta. */
const LOW_BAND: ReadonlySet<RecipeId> = new Set<RecipeId>(['vaporetto', 'barca', 'febbre', 'nero', 'marea', 'tuono', 'nodo']);

/** 'lo' = basta metà della frequenza di campionamento (contenuto sotto ~3 kHz). */
export function recipeBand(id: RecipeId): 'lo' | 'hi' {
  return LOW_BAND.has(id) ? 'lo' : 'hi';
}

/** Quante varianti tenere in cache per ricetta (i colpi di legno variano a ogni colpo). */
export function recipeVariants(id: RecipeId): number {
  switch (id) {
    case 'fuso_presa':
    case 'fuso_rilascio':
    case 'incrocio':
    case 'rovescia':
    case 'disfa':
    case 'ui_tap':
    case 'ui_indietro':
    case 'tic':
    case 'toc':
      return 6;
    case 'tuono':
    case 'gabbiano':
    case 'trabocco':
    case 'carta':
      return 4;
    default:
      return 3;
  }
}

function noiseBurst(sr: number, seconds: number, rand: Rand): Float32Array {
  return whiteNoise(Math.max(1, Math.round(seconds * sr)), rand);
}

function woodInto(out: Float32Array, sr: number, start: number, rand: Rand, o: Parameters<typeof renderWood>[2]): void {
  mixInto(out, renderWood(sr, rand, o), start * sr, 1);
}

/** Fruscio di carta: rumore di 60 ms, passa-banda 3 kHz, Q 1,5. */
function lettera(sr: number, rand: Rand): Float32Array {
  const b = noiseBurst(sr, 0.06, rand);
  // Grana della carta: l'ampiezza cambia ogni 2 ms.
  const step = Math.max(1, Math.round(0.002 * sr));
  let g = 1;
  for (let i = 0; i < b.length; i++) {
    if (i % step === 0) g = 0.55 + 0.45 * rand();
    b[i] = b[i]! * g;
  }
  filter(b, sr, 'bandpass', 3000, 1.5);
  envelopeAHR(b, sr, { attack: 0.006, hold: 0.025, release: 0.029 });
  return normalizePeak(b, 0.45);
}

/** "Sss": rumore di 200 ms con formante a 2,5 kHz e inviluppo a campana. */
function voce(sr: number, rand: Rand): Float32Array {
  const b = noiseBurst(sr, 0.2, rand);
  filter(b, sr, 'bandpass', 2500, 2.5);
  hann(b);
  return normalizePeak(b, 0.4);
}

/** Segreto: tocco di legno grave (f0 300 Hz) + "tin" di vetro (2,4 kHz, 300 ms). */
function segreto(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.4, sr);
  woodInto(out, sr, 0, rand, { f0: 300, gain: 0.55 });
  addDecayingSine(out, sr, { start: 0.02, freq: 2400, amp: 0.26, t60: 0.3, attack: 0.001 });
  return normalizePeak(out, 0.6);
}

/** Febbre: 110 e 113 Hz (battimento a 3 Hz), 400 ms, passa-basso 400 Hz. */
function febbre(sr: number): Float32Array {
  const out = makeBuffer(0.4, sr);
  addDecayingSine(out, sr, { start: 0, freq: 110, amp: 0.5, t60: SUSTAIN });
  addDecayingSine(out, sr, { start: 0, freq: 113, amp: 0.5, t60: SUSTAIN });
  filter(out, sr, 'lowpass', 400, 0.7);
  envelopeAHR(out, sr, { attack: 0.03, hold: 0.27, release: 0.1 });
  return normalizePeak(out, 0.5);
}

function arpeggio(sr: number, notes: readonly { hz: number; t: number; amp: number }[], seconds: number, peak: number): Float32Array {
  const out = makeBuffer(seconds, sr);
  for (const n of notes) addMusicBoxNote(out, sr, n.t, n.hz, n.amp);
  return normalizePeak(out, peak);
}

/** Corda che cigola: Karplus-Strong a 90 Hz, smorzamento alto, 500 ms, con strappi di attrito. */
function nodo(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.5, sr);
  const n = Math.max(2, Math.round(sr / 90));
  const line = new Float64Array(n);
  for (let i = 0; i < n; i++) line[i] = rand() * 2 - 1;
  let idx = 0;
  const loss = 0.975;
  // Attrito: piccoli strappi irregolari che rieccitano la corda (il cigolio).
  let nextKick = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    if (t < 0.36 && i >= nextKick) {
      const amp = (0.5 + 0.5 * rand()) * (1 - t / 0.4);
      line[idx] = line[idx]! + (rand() * 2 - 1) * amp * 1.5;
      nextKick = i + Math.round(sr / (45 + 30 * rand()));
    }
    const a = line[idx]!;
    const b = line[(idx + 1) % n]!;
    const y = 0.5 * (a + b) * loss;
    line[idx] = y;
    out[i] = y;
    idx = (idx + 1) % n;
  }
  filter(out, sr, 'lowpass', 2400, 0.7);
  fadeEdges(out, sr, 0.004, 0.06);
  return normalizePeak(out, 0.5);
}

/** Rifiuto «No.»: tonfo di legno (f0 200 Hz) + una sillaba secca di Marta. */
function rifiuto(sr: number, d: RecipeDeps, withVoice: boolean): Float32Array {
  const out = makeBuffer(0.35, sr);
  woodInto(out, sr, 0, d.rand, { f0: 200, gain: 0.6, lowpass: 1500, decay: 1.3 });
  if (withVoice) {
    const voice = d.martaVoice ?? DEFAULT_VOICES.marta ?? { pitch: 220, rate: 8, formantShift: 0, noise: 0 };
    const plan = planBabble('No.', voice, { rand: d.rand, style: { duty: 0.5, jitter: 0, descent: 0 } });
    const syl = renderBabble(sr, plan, voice, d.rand, 0.5);
    mixInto(out, syl, 0.02 * sr, 1);
  }
  return normalizePeak(out, 0.65);
}

/** Disfa: due tocchi, il secondo più grave, e un piccolo fruscio. */
function disfa(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.25, sr);
  const f = woodF0(rand);
  woodInto(out, sr, 0, rand, { f0: f, gain: 0.45, decay: 0.7 });
  woodInto(out, sr, 0.045, rand, { f0: f * 0.8, gain: 0.4, decay: 0.7 });
  const swish = noiseBurst(sr, 0.12, rand);
  sweep(swish, sr, 'bandpass', { f0: 2000, f1: 800, t0: 0, t1: 0.12, q: 1.2 });
  hann(swish);
  mixInto(out, normalizePeak(swish, 0.12), 0.02 * sr, 1);
  return normalizePeak(out, 0.5);
}

/** Ora fissata: lo spillo d'ottone che entra nel tombolo (ping metallico + legno). */
function oraFissata(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.5, sr);
  woodInto(out, sr, 0, rand, { f0: 700, gain: 0.45, decay: 0.9 });
  addDecayingSine(out, sr, { start: 0.012, freq: 2100, amp: 0.25, t60: 0.25, attack: 0.001 });
  addDecayingSine(out, sr, { start: 0.012, freq: 3370, amp: 0.15, t60: 0.18, attack: 0.001 });
  addDecayingSine(out, sr, { start: 0.012, freq: 5150, amp: 0.08, t60: 0.1, attack: 0.001 });
  return normalizePeak(out, 0.55);
}

/** Vaporetto: denti di sega a 92 e 93,5 Hz, passa-basso 600 Hz, 1,5 s con attacco lento. */
function vaporetto(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(1.5, sr);
  addSaw(out, sr, { start: 0, seconds: 1.5, freq: 92, amp: 0.5, phase: rand() });
  addSaw(out, sr, { start: 0, seconds: 1.5, freq: 93.5, amp: 0.5, phase: rand() });
  filter(out, sr, 'lowpass', 600, 0.7);
  envelopeAHR(out, sr, { attack: 0.45, hold: 0.75, release: 0.3 });
  return normalizePeak(out, 0.55);
}

/** Barca: motore, rumore marrone modulato a 9 Hz, 2 s. */
function barca(sr: number, rand: Rand): Float32Array {
  const out = brownNoise(Math.round(2 * sr), rand);
  for (let i = 0; i < out.length; i++) {
    const m = 0.5 + 0.5 * Math.sin((2 * Math.PI * 9 * i) / sr);
    out[i] = out[i]! * (0.25 + 0.75 * m * m);
  }
  filter(out, sr, 'lowpass', 500, 0.8);
  fadeEdges(out, sr, 0.25, 0.3);
  return normalizePeak(out, 0.5);
}

/** Gabbiano: FM (portante 1800 Hz, modulante a metà, indice 3), glissando 1800→1300 Hz in 250 ms, 2-3 versi. */
function gabbiano(sr: number, rand: Rand): Float32Array {
  const calls = rand() < 0.5 ? 2 : 3;
  const callDur = 0.32;
  const gaps: number[] = [];
  let t = 0;
  for (let c = 0; c < calls; c++) {
    gaps.push(t);
    t += callDur + 0.06 + 0.12 * rand();
  }
  const out = makeBuffer(t + 0.05, sr);
  for (const start of gaps) {
    const k = 1 + (rand() * 2 - 1) * 0.06;
    const n0 = Math.round(start * sr);
    const len = Math.round(callDur * sr);
    let pc = 0;
    let pm = 0;
    // Glissando esponenziale 1800 → 1300 Hz in 250 ms: un fattore costante per campione.
    const glideN = Math.round(0.25 * sr);
    const step = Math.pow(1300 / 1800, 1 / glideN);
    let fc = 1800 * k;
    const w = (2 * Math.PI) / sr;
    for (let i = 0; i < len && n0 + i < out.length; i++) {
      const tt = i / sr;
      pc += w * fc;
      pm += w * fc * 0.5;
      if (i < glideN) fc *= step;
      const env = tt < 0.02 ? tt / 0.02 : Math.max(0, 1 - (tt - 0.02) / (callDur - 0.02));
      out[n0 + i] = out[n0 + i]! + Math.sin(pc + 3 * Math.sin(pm)) * env * env;
    }
  }
  return normalizePeak(out, 0.35);
}

/** Pagina: fruscio che sale (rumore passa-banda 1,5 → 4,2 kHz) e un piccolo colpo d'aria. */
function pagina(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.35, sr);
  const w = noiseBurst(sr, 0.26, rand);
  sweep(w, sr, 'bandpass', { f0: 1500, f1: 4200, t0: 0, t1: 0.25, q: 0.9 });
  hann(w);
  mixInto(out, w, 0, 1);
  const flap = noiseBurst(sr, 0.05, rand);
  filter(flap, sr, 'lowpass', 900, 0.7);
  hann(flap);
  mixInto(out, flap, 0.25 * sr, 0.8);
  return normalizePeak(out, 0.35);
}

/** Bottiglia: tre parziali di vetro (1,9 / 3,1 / 4,7 kHz) e un tonfo leggero. */
function bottiglia(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.8, sr);
  woodInto(out, sr, 0, rand, { f0: 250, gain: 0.25, lowpass: 900 });
  addDecayingSine(out, sr, { start: 0.005, freq: 1900, amp: 0.4, t60: 0.7, attack: 0.001 });
  addDecayingSine(out, sr, { start: 0.005, freq: 3100, amp: 0.25, t60: 0.5, attack: 0.001 });
  addDecayingSine(out, sr, { start: 0.005, freq: 4700, amp: 0.15, t60: 0.35, attack: 0.001 });
  return normalizePeak(out, 0.45);
}

/** Carta che si spiega: 10-14 crepitii brevi, passa-banda fra 2 e 5 kHz. */
function carta(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(0.45, sr);
  const n = 10 + Math.floor(rand() * 5);
  for (let k = 0; k < n; k++) {
    const b = noiseBurst(sr, 0.004 + 0.016 * rand(), rand);
    filter(b, sr, 'bandpass', 2000 + 3000 * rand(), 2);
    hann(b);
    mixInto(out, b, rand() * 0.4 * sr, 0.3 + 0.7 * rand());
  }
  return normalizePeak(out, 0.35);
}

/** Trabocco: gorgoglio di 12 bolle (glissando 300 → 900 Hz in 60 ms) a intervalli casuali. */
function trabocco(sr: number, rand: Rand): Float32Array {
  const out = makeBuffer(1.0, sr);
  for (let b = 0; b < 12; b++) {
    const start = rand() * 0.85;
    const k = 0.8 + 0.45 * rand();
    const amp = 0.3 + 0.3 * rand();
    const n0 = Math.round(start * sr);
    const len = Math.round(0.08 * sr);
    let ph = 0;
    // Glissando 300 → 900 Hz in 60 ms (fattore costante), decadimento esponenziale.
    const glideN = Math.round(0.06 * sr);
    const step = Math.pow(3, 1 / glideN);
    const attackN = Math.max(1, Math.round(0.003 * sr));
    const decay = Math.exp(-1 / (0.022 * sr));
    let f = 300 * k;
    let env = 0;
    const w = (2 * Math.PI) / sr;
    for (let i = 0; i < len && n0 + i < out.length; i++) {
      ph += w * f;
      if (i < glideN) f *= step;
      env = i < attackN ? i / attackN : i === attackN ? 1 : env * decay;
      out[n0 + i] = out[n0 + i]! + Math.sin(ph) * env * amp;
    }
  }
  const bed = brownNoise(out.length, rand);
  filter(bed, sr, 'lowpass', 300, 0.7);
  fadeEdges(bed, sr, 0.1, 0.3);
  mixInto(out, bed, 0, 0.15);
  return normalizePeak(out, 0.5);
}

/** Marea: rumore rosa con passa-basso che sale da 200 a 800 Hz in 2 s. */
function marea(sr: number, rand: Rand): Float32Array {
  const out = pinkNoise(Math.round(2 * sr), rand);
  sweep(out, sr, 'lowpass', { f0: 200, f1: 800, t0: 0, t1: 2, q: 0.8 });
  fadeEdges(out, sr, 0.3, 0.4);
  return normalizePeak(out, 0.5);
}

/** Filo nero: bordone La1 (55 Hz) con tremolo lento, 2 s, sotto la nota di Livia. */
function nero(sr: number, d: RecipeDeps): Float32Array {
  const out = makeBuffer(2, sr);
  const harmonics: readonly [number, number][] = [
    [55, 0.6],
    [110, 0.35],
    [165, 0.2],
    [220, 0.1],
  ];
  for (const [f, a] of harmonics) addDecayingSine(out, sr, { start: 0, freq: f, amp: a, t60: SUSTAIN });
  // Tremolo lento (1,6 Hz).
  const w = (2 * Math.PI * 1.6) / sr;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! * (0.7 + 0.3 * Math.sin(w * i));
  envelopeAHR(out, sr, { attack: 0.4, hold: 1.1, release: 0.5 });
  const livia = d.liviaHz ?? DEFAULT_NOTE_HZ.livia ?? 220;
  addMusicBoxNote(out, sr, 0.3, livia, 0.45);
  return normalizePeak(out, 0.55);
}

/** Tuono: rumore marrone di 2,5 s con passa-basso che scende da 800 a 120 Hz. */
function tuono(sr: number, rand: Rand): Float32Array {
  const out = brownNoise(Math.round(2.5 * sr), rand);
  // Crepitio iniziale: l'ampiezza salta nei primi 300 ms.
  const step = Math.max(1, Math.round(0.012 * sr));
  let g = 1;
  for (let i = 0; i < Math.min(out.length, Math.round(0.3 * sr)); i++) {
    if (i % step === 0) g = 0.4 + 0.9 * rand();
    out[i] = out[i]! * g;
  }
  sweep(out, sr, 'lowpass', { f0: 800, f1: 120, t0: 0, t1: 2.5, q: 0.7 });
  envelopeExp(out, sr, { attack: 0.04, t60: 2.5 });
  fadeEdges(out, sr, 0, 0.2);
  return normalizePeak(out, 0.7);
}

/** Rende una ricetta (mono) a frequenza di campionamento `sr`. */
export function renderRecipe(id: RecipeId, sr: number, d: RecipeDeps): Float32Array {
  const rand = d.rand;
  switch (id) {
    case 'fuso_presa': {
      const out = renderWood(sr, rand, { gain: 0.4, decay: 0.8 });
      const click = noiseBurst(sr, 0.003, rand);
      filter(click, sr, 'highpass', 4000, 0.7);
      hann(click);
      return normalizePeak(mixInto(out, click, 0, 0.5), 0.42);
    }
    case 'fuso_rilascio':
      return renderWood(sr, rand, { f0: 420 + 200 * rand(), gain: 0.35, decay: 1.1 });
    case 'incrocio': {
      // Incrocio generico (senza personaggi): legno + bicordo Re4-La4, sopra prima di 30 ms.
      const out = makeBuffer(1.3, sr);
      woodInto(out, sr, 0, rand, { gain: 0.55 });
      addMusicBoxNote(out, sr, 0.005, DORIAN_HZ.re4, 0.22);
      addMusicBoxNote(out, sr, 0.035, DORIAN_HZ.la4, 0.2);
      return normalizePeak(out, 0.6);
    }
    case 'rovescia': {
      const out = makeBuffer(0.2, sr);
      const f = woodF0(rand);
      woodInto(out, sr, 0, rand, { f0: f, gain: 0.45, decay: 0.7 });
      woodInto(out, sr, 0.04, rand, { f0: f * 1.25, gain: 0.5, decay: 0.7 });
      return normalizePeak(out, 0.5);
    }
    case 'lettera':
      return lettera(sr, rand);
    case 'voce':
      return voce(sr, rand);
    case 'segreto':
      return segreto(sr, rand);
    case 'febbre':
      return febbre(sr);
    case 'cura':
      return arpeggio(
        sr,
        [
          { hz: DORIAN_HZ.fa4, t: 0, amp: 0.3 },
          { hz: DORIAN_HZ.la4, t: 0.07, amp: 0.3 },
          { hz: DORIAN_HZ.do5, t: 0.14, amp: 0.3 },
        ],
        1.4,
        0.55,
      );
    case 'nodo':
      return nodo(sr, rand);
    case 'rifiuto':
      return rifiuto(sr, d, true);
    case 'tonfo':
      return rifiuto(sr, d, false);
    case 'disfa':
      return disfa(sr, rand);
    case 'ora_fissata':
      return oraFissata(sr, rand);
    case 'vaporetto':
      return vaporetto(sr, rand);
    case 'barca':
      return barca(sr, rand);
    case 'gabbiano':
      return gabbiano(sr, rand);
    case 'pagina':
      return pagina(sr, rand);
    case 'bottiglia':
      return bottiglia(sr, rand);
    case 'carta':
      return carta(sr, rand);
    case 'successo':
      return arpeggio(
        sr,
        [
          { hz: DORIAN_HZ.re4, t: 0, amp: 0.28 },
          { hz: DORIAN_HZ.fa4, t: 0.09, amp: 0.28 },
          { hz: DORIAN_HZ.la4, t: 0.18, amp: 0.28 },
          { hz: DORIAN_HZ.re5, t: 0.27, amp: 0.32 },
        ],
        1.6,
        0.55,
      );
    case 'fallimento': {
      const out = arpeggio(
        sr,
        [
          { hz: DORIAN_HZ.la4 * centsToRatio(-20), t: 0, amp: 0.28 },
          { hz: DORIAN_HZ.fa4 * centsToRatio(-20), t: 0.14, amp: 0.28 },
          { hz: DORIAN_HZ.re4 * centsToRatio(-30), t: 0.28, amp: 0.3 },
        ],
        1.7,
        0.45,
      );
      woodInto(out, sr, 0.28, rand, { f0: 250, gain: 0.2, lowpass: 1200 });
      return normalizePeak(out, 0.5);
    }
    case 'trabocco':
      return trabocco(sr, rand);
    case 'marea':
      return marea(sr, rand);
    case 'nero':
      return nero(sr, d);
    case 'ui_tap':
      return renderWood(sr, rand, { f0: 1400, gain: 0.22, decay: 0.35 });
    case 'ui_indietro': {
      const out = makeBuffer(0.12, sr);
      woodInto(out, sr, 0, rand, { f0: 900, gain: 0.2, decay: 0.4 });
      woodInto(out, sr, 0.035, rand, { f0: 700, gain: 0.2, decay: 0.4 });
      return normalizePeak(out, 0.22);
    }
    case 'tic':
      return renderWood(sr, rand, { f0: 2200, gain: 0.5, decay: 0.25 });
    case 'toc':
      return renderWood(sr, rand, { f0: 1700, gain: 0.5, decay: 0.25 });
    case 'tuono':
      return tuono(sr, rand);
  }
}

/**
 * Pioggia granulare (GDD 13.3): 200 grani al secondo di rumore di 2-5 ms filtrati
 * passa-alto a 2 kHz, più un letto passa-basso. Rende un loop senza cuciture.
 */
export function renderRainLoop(sr: number, seconds: number, rand: Rand): Float32Array {
  const fadeS = 0.1;
  const total = seconds + fadeS;
  const grains = makeBuffer(total, sr);
  const count = Math.round(200 * total);
  for (let g = 0; g < count; g++) {
    const len = Math.max(2, Math.round((0.002 + 0.003 * rand()) * sr));
    const start = Math.floor(rand() * (grains.length - len));
    const amp = rand() < 0.08 ? 0.8 + 0.4 * rand() : 0.15 + 0.45 * rand();
    for (let i = 0; i < len; i++) {
      const w = Math.sin((Math.PI * i) / len);
      grains[start + i] = grains[start + i]! + (rand() * 2 - 1) * w * amp;
    }
  }
  filter(grains, sr, 'highpass', 2000, 0.7);
  const bed = pinkNoise(grains.length, rand);
  filter(bed, sr, 'lowpass', 1100, 0.7);
  mixInto(grains, bed, 0, 0.35);
  const loop = makeLoop(grains, Math.round(seconds * sr));
  return normalizePeak(loop, 0.6);
}
