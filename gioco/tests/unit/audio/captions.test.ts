/**
 * Testi del pacchetto audio (namespace `audio`, livello L1): ogni didascalia che il
 * pacchetto può emettere esiste in italiano e in inglese; le due lingue hanno le
 * stesse chiavi e gli stessi segnaposto; filtro anti-ripetizione delle didascalie.
 */
import { describe, expect, it } from 'vitest';
import itAudio from '../../../src/i18n/it/audio.json';
import enAudio from '../../../src/i18n/en/audio.json';
import { flatten } from '../../../src/core/i18n';
import { CHARACTER_IDS } from '../../../src/core/ids';
import {
  ALL_CAPTION_KEYS,
  AMBIENCE_CAPTIONS,
  CAPTIONS,
  Captioner,
  SFX_CAPTIONS,
  characterStyleKey,
  shortNameKey,
} from '../../../src/audio/captions';
import { SFX_IDS } from '../../../src/audio/synth/sfx';

function table(data: unknown): Map<string, string> {
  const m = new Map<string, string>();
  flatten(data, 'audio', m);
  return m;
}
const IT = table(itAudio);
const EN = table(enAudio);
const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe('audio.json', () => {
  it('italiano e inglese hanno le stesse chiavi', () => {
    expect([...EN.keys()].sort()).toEqual([...IT.keys()].sort());
  });

  it('stessi segnaposto nelle due lingue, nessun testo vuoto', () => {
    for (const [k, v] of IT) {
      expect(v.trim().length, k).toBeGreaterThan(0);
      expect(placeholders(EN.get(k)!), k).toEqual(placeholders(v));
    }
  });

  it('ogni didascalia che il pacchetto emette esiste in it e en', () => {
    expect(ALL_CAPTION_KEYS.length).toBeGreaterThan(30);
    for (const k of ALL_CAPTION_KEYS) {
      expect(IT.has(k), k).toBe(true);
      expect(EN.has(k), k).toBe(true);
    }
  });

  it('i segnaposto delle didascalie sono quelli usati dal codice', () => {
    expect(placeholders(IT.get(CAPTIONS.campana)!)).toEqual(['ora']);
    expect(placeholders(IT.get(CAPTIONS.borbottio)!)).toEqual(['carattere', 'nome']);
    expect(placeholders(IT.get(CAPTIONS.incrocioRancore)!)).toEqual(['sopra', 'sotto']);
    expect(placeholders(IT.get(CAPTIONS.nodoTra)!)).toEqual(['a', 'b']);
    for (const k of [CAPTIONS.letteraA, CAPTIONS.consegna, CAPTIONS.voceA, CAPTIONS.segretoA, CAPTIONS.febbreA, CAPTIONS.curaA, CAPTIONS.legge]) {
      expect(placeholders(IT.get(k)!), k).toEqual(['nome']);
    }
  });

  it('gli esempi del GDD 13.6', () => {
    expect(IT.get(CAPTIONS.campana)!.replace('{ora}', '9')).toBe('[campana, ore 9]');
    expect(IT.get('audio.didascalie.vaporetto')).toBe('[il vaporetto suona]');
    expect(IT.get(CAPTIONS.borbottio)!.replace('{nome}', 'Marta').replace('{carattere}', 'deciso')).toBe('[Marta: borbottio deciso]');
    expect(IT.get(CAPTIONS.febbreA)!.replace('{nome}', 'Gino')).toBe('[la febbre passa a Gino]');
  });

  it('ogni SfxId e ogni ambiente ha una voce nella tabella delle didascalie', () => {
    expect(Object.keys(SFX_CAPTIONS).sort()).toEqual([...SFX_IDS].sort());
    expect(Object.keys(AMBIENCE_CAPTIONS).sort()).toEqual(['laguna', 'notte', 'pioggia', 'silenzio', 'tempesta', 'vento']);
  });

  it('nomi e caratteri delle voci per tutti i personaggi; testi dell\'overlay', () => {
    for (const c of CHARACTER_IDS) {
      expect(IT.has(characterStyleKey(c)), c).toBe(true);
      expect(IT.has(shortNameKey(c)), c).toBe(true);
    }
    expect(IT.has(shortNameKey('lino'))).toBe(true);
    for (const k of ['audio.autoplay.tocca', 'audio.autoplay.spiegazione', 'audio.autoplay.etichetta']) {
      expect(IT.has(k)).toBe(true);
      expect(EN.has(k)).toBe(true);
    }
    expect(IT.get('audio.autoplay.tocca')).toBe('Tocca per continuare');
  });
});

describe('Captioner', () => {
  it('la stessa didascalia non riparte prima di 1,2 s; parametri diversi sì', () => {
    let t = 0;
    const out: string[] = [];
    const c = new Captioner((k, p) => out.push(p ? `${k}:${JSON.stringify(p)}` : k), () => t);
    expect(c.say('a')).toBe(true);
    expect(c.say('a')).toBe(false);
    expect(c.say('a', { ora: 9 })).toBe(true);
    expect(c.say('a', { ora: 10 })).toBe(true);
    t = 1300;
    expect(c.say('a')).toBe(true);
    expect(c.say(null)).toBe(false);
    expect(out).toEqual(['a', 'a:{"ora":9}', 'a:{"ora":10}', 'a']);
    expect(c.history()).toHaveLength(4);
  });
});
