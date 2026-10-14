/**
 * Note dei personaggi (GDD 13.2) e timbro di carillon.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTE_HZ,
  MUSICBOX_PARTIALS,
  MUSICBOX_T60,
  NOTE_NAMES,
  noteHzFor,
  randomDetuneCents,
  renderMusicBoxNote,
} from '../../../src/audio/synth/musicbox';
import { midiToHz, rmsOf, statsOf } from '../../../src/audio/synth/dsp';
import type { CharacterDef, CharacterId } from '../../../src/core/types';
import { seeded } from './fakeAudio';

/** GDD 13.2, "Note dei personaggi", trascritte a mano. */
const GDD_NOTES: [CharacterId, string, number][] = [
  ['piero', 'Re3', 146.83],
  ['bepi', 'Sol3', 196.0],
  ['livia', 'La3', 220.0],
  ['zeno', 'Do4', 261.63],
  ['marta', 'Re4', 293.66],
  ['lunardi', 'Fa4', 349.23],
  ['teresa', 'La4', 440.0],
  ['nina', 'Si4', 493.88],
  ['clotilde', 'Do5', 523.25],
  ['ada', 'Re5', 587.33],
  ['gino', 'Mi5', 659.25],
];

const NAME_TO_MIDI: Record<string, number> = { Do: 0, Re: 2, Mi: 4, Fa: 5, Sol: 7, La: 9, Si: 11 };
function midiOf(name: string): number {
  const m = /^(Do|Re|Mi|Fa|Sol|La|Si)(\d)$/.exec(name)!;
  return 12 * (Number(m[2]) + 1) + NAME_TO_MIDI[m[1]!]!;
}

describe('note dei personaggi', () => {
  it('in Hz come GDD 13.2', () => {
    for (const [who, name, hz] of GDD_NOTES) {
      expect(DEFAULT_NOTE_HZ[who]).toBe(hz);
      expect(NOTE_NAMES[who]).toBe(name);
      expect(noteHzFor(who, null)).toBe(hz);
    }
    expect(Object.keys(DEFAULT_NOTE_HZ).sort()).toEqual(GDD_NOTES.map(([w]) => w).sort());
  });

  it('sono note temperate della scala di Re dorico', () => {
    const dorian = new Set([2, 4, 5, 7, 9, 11, 0]); // Re Mi Fa Sol La Si Do
    for (const [, name, hz] of GDD_NOTES) {
      const midi = midiOf(name);
      expect(Math.abs(midiToHz(midi) - hz)).toBeLessThan(0.006);
      expect(dorian.has(midi % 12)).toBe(true);
    }
  });

  it('Lino e i personaggi senza nota suonano solo legno (null)', () => {
    expect(noteHzFor('lino', null)).toBeNull();
    expect(noteHzFor('ernesto', null)).toBeNull();
  });

  it('characters.json ha la precedenza, anche quando dice null', () => {
    const db = new Map<CharacterId, Pick<CharacterDef, 'noteHz'>>([
      ['teresa', { noteHz: 442 }],
      ['marta', { noteHz: null }],
    ]);
    expect(noteHzFor('teresa', db)).toBe(442);
    expect(noteHzFor('marta', db)).toBeNull();
    expect(noteHzFor('gino', db)).toBe(659.25);
  });
});

describe('timbro di carillon', () => {
  it('parziali 1, 2 (0,3), 4,2 (0,1) e decadimento di 1,2 s', () => {
    expect(MUSICBOX_PARTIALS).toEqual([
      { ratio: 1, amp: 1 },
      { ratio: 2, amp: 0.3 },
      { ratio: 4.2, amp: 0.1 },
    ]);
    expect(MUSICBOX_T60).toBe(1.2);
  });

  it('desintonia casuale entro ±3 cent', () => {
    const r = seeded(11);
    for (let i = 0; i < 200; i++) expect(Math.abs(randomDetuneCents(r))).toBeLessThanOrEqual(3);
  });

  it('una nota sale in 2 ms e scende di ~60 dB in 1,2 s', () => {
    const sr = 44100;
    const b = renderMusicBoxNote(sr, 440, 1);
    const st = statsOf(b);
    expect(st.nan).toBe(false);
    expect(st.peak).toBeCloseTo(1, 4);
    expect(Math.abs(b[0]!)).toBeLessThan(0.01);
    const head = rmsOf(b, Math.round(0.01 * sr), Math.round(0.06 * sr));
    const mid = rmsOf(b, Math.round(0.6 * sr), Math.round(0.65 * sr));
    const tail = rmsOf(b, Math.round(1.15 * sr), Math.round(1.19 * sr));
    // A metà del T60 circa -30 dB, alla fine quasi -60 dB.
    expect(20 * Math.log10(mid / head)).toBeLessThan(-25);
    expect(20 * Math.log10(mid / head)).toBeGreaterThan(-35);
    expect(20 * Math.log10(tail / head)).toBeLessThan(-50);
  });
});

// Contratto con i contenuti: se characters.json esiste, note e voci seguono il GDD.
const CHARS_URL = new URL('../../../src/content/characters.json', import.meta.url);
const hasCharacters = existsSync(CHARS_URL);

describe.skipIf(!hasCharacters)('characters.json coerente con GDD 13.2 e 13.5', () => {
  const chars = hasCharacters ? (JSON.parse(readFileSync(CHARS_URL, 'utf8')) as CharacterDef[]) : [];
  const byId = new Map(chars.map((c) => [c.id, c]));

  it('note dei personaggi', () => {
    for (const [who, , hz] of GDD_NOTES) {
      const c = byId.get(who);
      if (c) expect(c.noteHz, who).toBeCloseTo(hz, 2);
    }
  });

  it('altezza e ritmo delle voci della tabella', () => {
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
      const v = byId.get(who)?.voice;
      if (!v) continue;
      expect(v.pitch, who).toBe(pitch);
      expect(v.rate, who).toBe(rate);
    }
    const clotilde = byId.get('clotilde');
    if (clotilde) expect(clotilde.voice, 'clotilde').toBeNull();
  });
});
