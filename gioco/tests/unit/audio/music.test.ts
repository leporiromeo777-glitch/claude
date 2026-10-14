/**
 * Il filò (GDD 13.4): bordone in Re dorico con rotazione i, IV, VII ogni 8 battute,
 * arpeggio deterministico per seme, stati della musica.
 */
import { describe, expect, it } from 'vitest';
import {
  ARP_GAIN,
  ArpWalker,
  BAR_SECONDS,
  BEAT_SECONDS,
  CHORD_SECONDS,
  DRONE,
  DRONE_CHORDS,
  MUSIC_STATES,
  MusicTrack,
  arpeggioNotes,
  arpeggioSequence,
  chordIndexAt,
} from '../../../src/audio/music';
import { createGraph, applyVolumes } from '../../../src/audio/graph';
import { SoundBank } from '../../../src/audio/bank';
import { VoiceLimiter } from '../../../src/audio/voices';
import { Player } from '../../../src/audio/player';
import { FakeAudioContext, FakeBufferSource, FakeOscillator, seeded } from './fakeAudio';

describe('arpeggio', () => {
  it('scelta delle note deterministica per seme', () => {
    const a = arpeggioSequence('g03', 7, 64);
    const b = arpeggioSequence('g03', 7, 64);
    expect(a).toEqual(b);
    expect(arpeggioSequence('g04', 7, 64)).not.toEqual(a);
    expect(arpeggioSequence('g00', 3, 32)).toEqual(arpeggioSequence('g00', 3, 32));
  });

  it('indici validi, passi di 1 o 2 gradi, sale e scende', () => {
    for (const seed of ['g00', 'g07', 'g13', 'fin_aperto', 'day-2026-10-14']) {
      const seq = arpeggioSequence(seed, 6, 200);
      let up = 0;
      let down = 0;
      for (let i = 0; i < seq.length; i++) {
        expect(seq[i]!).toBeGreaterThanOrEqual(0);
        expect(seq[i]!).toBeLessThan(6);
        if (i > 0) {
          const d = seq[i]! - seq[i - 1]!;
          expect(Math.abs(d)).toBeLessThanOrEqual(2);
          if (d > 0) up++;
          if (d < 0) down++;
        }
      }
      expect(up).toBeGreaterThan(40);
      expect(down).toBeGreaterThan(40);
      // Salti di due gradi ci sono, ma non sono la maggioranza.
      const leaps = seq.slice(1).filter((x, i) => Math.abs(x - seq[i]!) === 2).length;
      expect(leaps).toBeGreaterThan(5);
      expect(leaps).toBeLessThan(100);
    }
  });

  it('una nota sola si ripete', () => {
    expect(arpeggioSequence('x', 1, 5)).toEqual([0, 0, 0, 0, 0]);
    const w = new ArpWalker('x', 2);
    for (let i = 0; i < 50; i++) expect([0, 1]).toContain(w.next());
  });

  it('note dei presenti in ordine crescente, con le ottave se sono poche', () => {
    expect(arpeggioNotes([440, 293.66, null, 146.83, 440])).toEqual([146.83, 293.66, 440]);
    expect(arpeggioNotes([220])).toEqual([220, 440, 880]);
    expect(arpeggioNotes([220, 330])).toEqual([220, 330, 440, 660]);
    expect(arpeggioNotes([null])).toEqual([]);
  });
});

describe('bordone e stati', () => {
  it('accordi i (Re-La), IV (Sol-Re), VII (Do-Sol)', () => {
    const name = (hz: number): string => {
      const midi = Math.round(69 + 12 * Math.log2(hz / 440));
      return ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'][midi % 12]!;
    };
    expect(DRONE_CHORDS.map((c) => `${c.name}:${name(c.root)}-${name(c.fifth)}`)).toEqual(['i:Re-La', 'IV:Sol-Re', 'VII:Do-Sol']);
    for (const c of DRONE_CHORDS) expect(c.fifth / c.root).toBeCloseTo(1.4983, 3);
  });

  it('gli accordi ruotano ogni 8 battute (75 bpm)', () => {
    expect(BEAT_SECONDS).toBe(0.8);
    expect(BAR_SECONDS).toBeCloseTo(3.2, 10);
    expect(CHORD_SECONDS).toBeCloseTo(25.6, 10);
    expect(chordIndexAt(0)).toBe(0);
    expect(chordIndexAt(25.5)).toBe(0);
    expect(chordIndexAt(25.7)).toBe(1);
    expect(chordIndexAt(51.3)).toBe(2);
    expect(chordIndexAt(77)).toBe(0);
  });

  it('parametri del GDD', () => {
    expect(DRONE).toEqual({ gain: 0.06, lowpass: 600, detuneCents: 4, tremoloHz: 0.05, tremoloDepth: 0.35 });
    expect(ARP_GAIN).toBe(0.08);
    expect(MUSIC_STATES.titolo.arpStep).toBeNull();
    expect(MUSIC_STATES.titolo.bellEvery).not.toBeNull();
    expect(MUSIC_STATES.sera.arpStep).toBeCloseTo(1.6, 10);
    expect(MUSIC_STATES.notte.arpStep).toBeCloseTo(0.8, 10);
    expect(MUSIC_STATES.alba.fifthAbove).toBe(true);
    expect(MUSIC_STATES.archivio.drone).toBe(false);
    expect(MUSIC_STATES.archivio.detuned).toBe(true);
    expect(MUSIC_STATES.archivio.arpStep).toBeCloseTo(1.6, 10);
    expect(MUSIC_STATES.finale.allNotes).toBe(true);
    expect(MUSIC_STATES.finale.exact).toBe(true);
    expect(MUSIC_STATES.off.drone).toBe(false);
  });
});

function setup() {
  const ctx = new FakeAudioContext();
  const graph = createGraph(ctx.asAudioContext());
  applyVolumes(graph, { master: 1, music: 1, sfx: 1, voice: 1 }, false, true);
  const limiter = new VoiceLimiter(() => ctx.currentTime);
  const bank = new SoundBank(ctx.asAudioContext(), { rand: seeded(1), characters: () => null });
  const player = new Player(graph, bank, limiter, seeded(2));
  const track = new MusicTrack({
    player,
    noteHz: (w) => bank.noteHz(w),
    defaultNotes: () => ['teresa', 'marta', 'piero'],
    defaultSeed: () => 'g00',
    stonatura: () => 1,
    allCharacters: () => ['piero', 'bepi', 'livia', 'zeno', 'marta', 'lunardi', 'teresa', 'nina', 'clotilde', 'ada', 'gino'],
  });
  return { ctx, track, limiter, bank };
}

describe('traccia della musica', () => {
  it('notte: bordone persistente (4 triangolari + LFO) e una nota ogni 800 ms', () => {
    const { ctx, track } = setup();
    track.set('notte', { seed: 'g00' });
    const oscs = ctx.sources.filter((s) => s instanceof FakeOscillator) as FakeOscillator[];
    expect(oscs.filter((o) => o.type === 'triangle')).toHaveLength(4);
    expect(oscs.filter((o) => o.type === 'sine')).toHaveLength(1);
    expect(oscs.filter((o) => o.type === 'triangle').map((o) => o.detune.value).sort()).toEqual([-4, -4, 4, 4]);
    track.schedule(0, 8.05);
    const notes = ctx.sources.filter((s) => s instanceof FakeBufferSource);
    // Prima nota a 0,4 s, poi ogni 0,8 s: 10 note entro 8,05 s.
    expect(notes).toHaveLength(10);
    expect(notes.map((n) => Number(n.startAt!.toFixed(3)))).toEqual([0.4, 1.2, 2, 2.8, 3.6, 4.4, 5.2, 6, 6.8, 7.6]);
  });

  it('stesso seme → stessa melodia; il seme cambia la melodia', () => {
    const who = ['teresa', 'marta', 'piero', 'gino', 'nina'] as const;
    const melody = (seed: string): (number | undefined)[] => {
      const { ctx, track, bank } = setup();
      track.set('notte', { seed, notes: [...who] });
      track.schedule(0, 10);
      // Ogni nota ha il suo buffer in cache: dal buffer si risale alla frequenza.
      const freqOf = new Map<unknown, number>();
      for (const w of who) {
        const f = bank.noteHz(w)!;
        freqOf.set(bank.note(f), f);
      }
      return (ctx.sources.filter((s) => s instanceof FakeBufferSource) as FakeBufferSource[]).map((s) => freqOf.get(s.buffer));
    };
    expect(melody('g05').every((f) => typeof f === 'number')).toBe(true);
    expect(melody('g05')).toEqual(melody('g05'));
    expect(melody('g05')).not.toEqual(melody('g06'));
  });

  it('sera: una nota ogni 1,6 s; titolo: niente arpeggio ma la campana', () => {
    const a = setup();
    a.track.set('sera');
    a.track.schedule(0, 6.5);
    expect(a.ctx.sources.filter((s) => s instanceof FakeBufferSource)).toHaveLength(4);
    const b = setup();
    b.track.set('titolo');
    b.track.schedule(0, 2);
    const bufs = b.ctx.sources.filter((s) => s instanceof FakeBufferSource) as FakeBufferSource[];
    expect(bufs).toHaveLength(1);
    expect(bufs[0]!.buffer!.duration).toBeGreaterThan(4);
  });

  it('archivio: niente bordone, note stonate; off spegne tutto', () => {
    const { ctx, track } = setup();
    track.set('archivio');
    expect(ctx.sources.filter((s) => s instanceof FakeOscillator)).toHaveLength(0);
    track.schedule(0, 5);
    const rates = (ctx.sources.filter((s) => s instanceof FakeBufferSource) as FakeBufferSource[]).map((s) => s.playbackRate.value);
    expect(rates.length).toBe(3);
    // ±15-35 cent di stonatura più la desintonia casuale di ±3 cent.
    for (const r of rates) expect(Math.abs(1200 * Math.log2(r))).toBeGreaterThanOrEqual(12 - 1e-6);
    track.set('notte');
    track.set('off');
    expect(track.current()).toBe('off');
    const drones = ctx.sources.filter((s) => s instanceof FakeOscillator);
    expect(drones.every((o) => o.stopAt !== null)).toBe(true);
  });

  it('gli accordi del bordone cambiano dopo 8 battute', () => {
    const { ctx, track } = setup();
    track.set('titolo');
    const tri = (ctx.sources.filter((s) => s instanceof FakeOscillator) as FakeOscillator[]).filter((o) => o.type === 'triangle');
    expect(tri[0]!.frequency.value).toBeCloseTo(DRONE_CHORDS[0]!.root, 6);
    track.schedule(25, 26);
    expect(tri[0]!.frequency.value).toBeCloseTo(DRONE_CHORDS[1]!.root, 6);
    expect(tri[2]!.frequency.value).toBeCloseTo(DRONE_CHORDS[1]!.fifth, 6);
  });
});
