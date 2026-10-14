/**
 * Borbottio (GDD 13.5): sillabe dalle vocali del testo vero, durata coerente con il
 * ritmo (sillabe al secondo), una consonante ogni due sillabe, discesa lungo la frase,
 * voci dei personaggi da characters.json con i valori del GDD come riserva.
 */
import { describe, expect, it } from 'vitest';
import {
  CONSONANT_SECONDS,
  DEFAULT_VOICES,
  FORMANTS,
  FORMANT_Q,
  SYLLABLE_RELEASE,
  nucleus,
  penSeconds,
  planBabble,
  plainText,
  renderBabble,
  renderPen,
  styleFor,
  textToSyllables,
  voiceFor,
} from '../../../src/audio/synth/babble';
import { statsOf } from '../../../src/audio/synth/dsp';
import type { CharacterDef, CharacterId, VoiceProfile } from '../../../src/core/types';
import { seeded } from './fakeAudio';

const vowels = (text: string): string => textToSyllables(text).map((s) => s.vowel).join('');
const FLAT = { duty: 0.75, jitter: 0, descent: 0 };

describe('dal testo alle sillabe', () => {
  it('una sillaba per gruppo di vocali, nucleo = la vocale più aperta', () => {
    expect(vowels('Buongiorno')).toBe('ooo'); // buon-gior-no
    expect(vowels('cara')).toBe('aa');
    expect(vowels('Chi tesse non è tessuto')).toBe('ieeoeeuo');
    expect(vowels('lalalala')).toBe('aaaa');
    expect(vowels('qui')).toBe('i');
    expect(vowels('più')).toBe('u');
    expect(nucleus('ia')).toBe('a');
    expect(nucleus('uo')).toBe('o');
    expect(nucleus('ui')).toBe('i');
  });

  it('accenti, maiuscole e marcatori del testo ricco non contano', () => {
    expect(plainText('Perché *Già* [[teresa]]')).toBe('perche gia teresa');
    expect(vowels('È là, già!')).toBe(vowels('e la, gia!'));
    expect(vowels('[[marta]] dice')).toBe('aaie');
  });

  it('le cifre sono sillabe, i testi senza vocali non ne hanno', () => {
    expect(textToSyllables('alle 9').length).toBe(3);
    expect(textToSyllables('...').length).toBe(0);
    expect(textToSyllables('').length).toBe(0);
  });

  it('punteggiatura e spazi diventano pause', () => {
    const s = textToSyllables('Sì, no. Va bene? E poi');
    expect(s[0]!.pause).toBe(0);
    expect(s[1]!.pause).toBe(1); // dopo la virgola
    expect(s[2]!.pause).toBe(2); // dopo il punto
    expect(s[3]!.pause).toBe(0.25); // fra due parole
    // L'ultima sillaba prima del punto interrogativo sale.
    const q = s.findIndex((x) => x.question);
    expect(s[q]!.vowel).toBe('e');
    expect(q).toBe(4);
  });
});

describe('piano del borbottio', () => {
  const voice: VoiceProfile = { pitch: 220, rate: 8, formantShift: 0, noise: 0 };

  it('durata coerente con il ritmo: n sillabe ≈ n / rate', () => {
    for (const rate of [4, 8, 12]) {
      const plan = planBabble('lalalala', voice, { rate, style: FLAT, rand: seeded(1) });
      expect(plan.syllables).toHaveLength(4);
      expect(plan.rate).toBe(rate);
      const period = 1 / rate;
      // Una sillaba per periodo, una dopo l'altra.
      plan.syllables.forEach((s, i) => expect(s.t).toBeCloseTo(CONSONANT_SECONDS + i * period, 10));
      const expected = CONSONANT_SECONDS + 3 * period + 0.75 * period + SYLLABLE_RELEASE;
      expect(plan.duration).toBeCloseTo(expected, 10);
      expect(Math.abs(plan.duration - 4 / rate)).toBeLessThan(period);
    }
  });

  it('il ritmo della voce viene da VoiceProfile, ma si può forzare', () => {
    const slow = planBabble('la la la la la la', { ...voice, rate: 5 }, { style: FLAT, rand: seeded(1) });
    const fast = planBabble('la la la la la la', { ...voice, rate: 10 }, { style: FLAT, rand: seeded(1) });
    expect(slow.duration).toBeGreaterThan(fast.duration * 1.8);
    const forced = planBabble('la la la la la la', { ...voice, rate: 5 }, { rate: 10, style: FLAT, rand: seeded(1) });
    expect(forced.duration).toBeCloseTo(fast.duration, 10);
  });

  it('la punteggiatura allunga la battuta', () => {
    const a = planBabble('la la la', voice, { style: FLAT, rand: seeded(1) });
    const b = planBabble('la. la. la.', voice, { style: FLAT, rand: seeded(1) });
    expect(b.duration).toBeGreaterThan(a.duration + 2 * (1 / 8));
  });

  it('una sillaba su due ha la consonante, vocali dal testo', () => {
    const plan = planBabble('Buongiorno, cara!', voice, { style: FLAT, rand: seeded(1) });
    expect(plan.syllables.map((s) => s.vowel).join('')).toBe('oooaa');
    expect(plan.syllables.map((s) => s.consonant)).toEqual([true, false, true, false, true]);
  });

  it('altezza ±8% per sillaba e leggera discesa lungo la frase', () => {
    const text = 'la la la la la la la la la la la la la la la la la la la la';
    const flat = planBabble(text, voice, { style: { duty: 0.75, jitter: 0, descent: 0.1 }, rand: seeded(1) });
    const f = flat.syllables.map((s) => s.f0);
    expect(f[0]).toBeCloseTo(220, 6);
    expect(f[f.length - 1]).toBeCloseTo(198, 6);
    for (let i = 1; i < f.length; i++) expect(f[i]!).toBeLessThan(f[i - 1]!);
    const jit = planBabble(text, voice, { style: { duty: 0.75, jitter: 0.08, descent: 0 }, rand: seeded(7) });
    for (const s of jit.syllables) {
      expect(s.f0).toBeGreaterThanOrEqual(220 * 0.92 - 1e-9);
      expect(s.f0).toBeLessThanOrEqual(220 * 1.08 + 1e-9);
    }
    expect(new Set(jit.syllables.map((s) => s.f0.toFixed(3))).size).toBeGreaterThan(5);
  });

  it('Marta ha le sillabe corte', () => {
    expect(styleFor('marta').duty).toBeLessThan(styleFor('teresa').duty);
    const m = planBabble('pane caldo', DEFAULT_VOICES.marta!, { style: styleFor('marta'), rand: seeded(2) });
    expect(m.syllables[0]!.dur).toBeCloseTo(0.5 / 8, 10);
  });

  it('formanti delle vocali come nel GDD, Q 8', () => {
    expect(FORMANTS).toEqual({ a: [800, 1200], e: [400, 2000], i: [300, 2300], o: [450, 800], u: [325, 700] });
    expect(FORMANT_Q).toBe(8);
  });
});

describe('voci dei personaggi', () => {
  it('valori della tabella del GDD come riserva', () => {
    const table: [CharacterId, number, number][] = [
      ['teresa', 260, 11],
      ['marta', 220, 8],
      ['piero', 110, 5],
      ['gino', 330, 12],
      ['bepi', 120, 7],
      ['nina', 280, 9],
      ['zeno', 100, 4],
      ['lunardi', 150, 7],
      ['livia', 200, 6],
    ];
    for (const [who, pitch, rate] of table) {
      const v = voiceFor(who, null)!;
      expect(v.pitch).toBe(pitch);
      expect(v.rate).toBe(rate);
    }
    expect(voiceFor('bepi', null)!.noise).toBeCloseTo(0.2);
    expect(voiceFor('zeno', null)!.noise).toBeCloseTo(0.3);
    expect(voiceFor('lunardi', null)!.formantShift).toBeCloseTo(0.1);
    expect(voiceFor('livia', null)!.lowpass).toBe(2500);
    expect(voiceFor('clotilde', null)).toBeNull();
  });

  it('characters.json ha la precedenza (e un valore assurdo si corregge)', () => {
    const db = new Map<CharacterId, Pick<CharacterDef, 'voice'>>([
      ['teresa', { voice: { pitch: 300, rate: 9, formantShift: 0.05, noise: 0.1 } }],
      ['marta', { voice: { pitch: Number.NaN, rate: 99, formantShift: 0, noise: 0 } }],
      ['clotilde', { voice: null }],
    ]);
    expect(voiceFor('teresa', db)).toEqual({ pitch: 300, rate: 9, formantShift: 0.05, noise: 0.1 });
    const m = voiceFor('marta', db)!;
    expect(m.pitch).toBe(220);
    expect(m.rate).toBe(20);
    expect(voiceFor('clotilde', db)).toBeNull();
    // Personaggio assente dal file: tabella.
    expect(voiceFor('gino', db)!.pitch).toBe(330);
  });
});

describe('rendering', () => {
  it('borbottio finito, con picco 0,5 e durata del piano', () => {
    const v = DEFAULT_VOICES.zeno!;
    const plan = planBabble('Il mare è calmo stanotte.', v, { rand: seeded(4), style: styleFor('zeno') });
    const sr = 22050;
    const b = renderBabble(sr, plan, v, seeded(4));
    const st = statsOf(b);
    expect(st.nan).toBe(false);
    expect(st.peak).toBeCloseTo(0.5, 4);
    expect(b.length / sr).toBeCloseTo(plan.duration + 0.02, 2);
  });

  it('la penna di Clotilde', () => {
    const sr = 44100;
    const b = renderPen(sr, 'Chi tesse non è tessuto.', seeded(5));
    expect(statsOf(b).nan).toBe(false);
    expect(b.length / sr).toBeCloseTo(penSeconds('Chi tesse non è tessuto.'), 2);
  });
});
