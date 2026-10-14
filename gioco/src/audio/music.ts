/**
 * Musica generativa: il "filò" (GDD 13.4), ispirato alle veglie in cui si filava raccontando.
 *
 * - Bordone: due onde triangolari desintonate di ±4 cent sulla tonica e sulla quinta,
 *   passa-basso 600 Hz, guadagno 0,06, tremolo a 0,05 Hz. Gli accordi ruotano ogni
 *   8 battute fra i (Re-La), IV (Sol-Re) e VII (Do-Sol) di Re dorico.
 * - Arpeggio: ogni 800 ms (75 bpm) una nota a timbro di carillon scelta fra le note dei
 *   personaggi presenti nella giornata: salita e discesa con salti decisi da un
 *   generatore con seme (l'ID della giornata). Guadagno 0,08.
 * - Stati: titolo (bordone e campana), sera (1 nota ogni 1,6 s), notte (normale),
 *   alba (con la quinta sopra, più brillante), archivio (solo carillon stonato a metà
 *   velocità), finale (tutte le note di tutti, intonate).
 * - Durante le battute la musica scende di 8 dB (graph.ts, applyDuck).
 */
import type { CharacterId, MusicState } from '../core/types';
import { rngFromSeed, type Rng } from '../core/rng';
import { FADE_TC } from './graph';
import type { PlayHandle, Player } from './player';
import type { Track } from './scheduler';
import { midiToHz } from './synth/dsp';
import { DEFAULT_NOTE_HZ } from './synth/musicbox';

export interface DroneChord {
  name: 'i' | 'IV' | 'VII';
  root: number;
  fifth: number;
}

/** Accordi del bordone in Re dorico: i (Re2-La2), IV (Sol2-Re3), VII (Do2-Sol2). */
export const DRONE_CHORDS: readonly DroneChord[] = [
  { name: 'i', root: midiToHz(38), fifth: midiToHz(45) },
  { name: 'IV', root: midiToHz(43), fifth: midiToHz(50) },
  { name: 'VII', root: midiToHz(36), fifth: midiToHz(43) },
];
/** Una battuta = 4 pulsazioni da 800 ms (75 bpm). */
export const BEAT_SECONDS = 0.8;
export const BAR_SECONDS = 4 * BEAT_SECONDS;
export const BARS_PER_CHORD = 8;
export const CHORD_SECONDS = BAR_SECONDS * BARS_PER_CHORD;

export const DRONE = { gain: 0.06, lowpass: 600, detuneCents: 4, tremoloHz: 0.05, tremoloDepth: 0.35 } as const;
export const ARP_GAIN = 0.08;
/** Desintonia delle note dell'Archivio (carillon stonato), in cent. */
export const ARCHIVE_DETUNE = [15, 35] as const;

export interface MusicStateConfig {
  drone: boolean;
  /** Secondi fra due note dell'arpeggio (null = niente arpeggio). */
  arpStep: number | null;
  /** Alba: si aggiunge la quinta sopra. */
  fifthAbove: boolean;
  /** Ogni quanti secondi suona la campana (titolo). */
  bellEvery: number | null;
  /** Archivio: note stonate. */
  detuned: boolean;
  /** Finale vero: tutte le note di tutti i personaggi. */
  allNotes: boolean;
  /** Note intonate esatte (senza la desintonia casuale di ±3 cent). */
  exact: boolean;
  droneLowpass: number;
}

const BASE: MusicStateConfig = {
  drone: true,
  arpStep: null,
  fifthAbove: false,
  bellEvery: null,
  detuned: false,
  allNotes: false,
  exact: false,
  droneLowpass: DRONE.lowpass,
};

export const MUSIC_STATES: Readonly<Record<MusicState, MusicStateConfig>> = {
  off: { ...BASE, drone: false },
  titolo: { ...BASE, bellEvery: CHORD_SECONDS },
  sera: { ...BASE, arpStep: 2 * BEAT_SECONDS },
  notte: { ...BASE, arpStep: BEAT_SECONDS },
  alba: { ...BASE, arpStep: BEAT_SECONDS, fifthAbove: true, droneLowpass: 1100 },
  archivio: { ...BASE, drone: false, arpStep: 2 * BEAT_SECONDS, detuned: true },
  finale: { ...BASE, arpStep: BEAT_SECONDS, allNotes: true, exact: true },
};

/** Indice dell'accordo dopo `seconds` dall'inizio del bordone (cambia ogni 8 battute). */
export function chordIndexAt(seconds: number): number {
  const k = Math.floor(Math.max(0, seconds) / CHORD_SECONDS);
  return k % DRONE_CHORDS.length;
}

/** Note dell'arpeggio di sempre quando la giornata non ne indica (il cast dell'isola). */
export const DEFAULT_ARP_CAST: readonly CharacterId[] = ['piero', 'bepi', 'zeno', 'marta', 'lunardi', 'teresa', 'nina'];

/**
 * Note dell'arpeggio: frequenze distinte in ordine crescente. Con meno di 3 note si
 * aggiungono le ottave sopra, perché una salita e discesa abbia senso.
 */
export function arpeggioNotes(freqs: readonly (number | null)[]): number[] {
  const set = new Set<number>();
  for (const f of freqs) if (typeof f === 'number' && Number.isFinite(f) && f > 0) set.add(Math.round(f * 100) / 100);
  const out = [...set].sort((a, b) => a - b);
  if (out.length === 0) return out;
  const base = out.slice();
  for (let k = 0; out.length < 3 && k < 3; k++) for (const f of base) out.push(f * Math.pow(2, k + 1));
  return out.sort((a, b) => a - b);
}

/**
 * Passeggiata dell'arpeggio sugli indici 0..count-1: sale e scende, con salti di 2
 * gradi e qualche inversione decisi dal generatore con seme. Deterministica.
 */
export class ArpWalker {
  private idx = 0;
  private dir = 1;
  private readonly rng: Rng;

  constructor(
    seed: string,
    private readonly count: number,
  ) {
    this.rng = rngFromSeed(`filo:${seed}`);
    // Si parte dal basso o dal centro, secondo il seme.
    this.idx = count > 2 && this.rng() < 0.5 ? Math.floor(count / 2) : 0;
  }

  next(): number {
    const out = this.idx;
    if (this.count <= 1) return 0;
    const step = this.rng() < 0.22 ? 2 : 1;
    if (this.rng() < 0.12) this.dir = -this.dir;
    let n = this.idx + this.dir * step;
    if (n >= this.count || n < 0) {
      this.dir = -this.dir;
      n = this.idx + this.dir * step;
    }
    this.idx = Math.min(this.count - 1, Math.max(0, n));
    return out;
  }

  /** Il generatore (per la desintonia dell'Archivio, anch'essa deterministica). */
  random(): number {
    return this.rng();
  }
}

/** Sequenza di `length` indici dell'arpeggio per un seme (funzione pura). */
export function arpeggioSequence(seed: string, count: number, length: number): number[] {
  const w = new ArpWalker(seed, count);
  const out: number[] = [];
  for (let i = 0; i < length; i++) out.push(w.next());
  return out;
}

export interface MusicOpts {
  seed?: string;
  notes?: (CharacterId | 'lino')[];
  stonatura?: number;
}

export interface MusicDeps {
  player: Player;
  noteHz(who: CharacterId | 'lino'): number | null;
  /** Note della giornata in corso se la scena non le passa (personaggi del livello). */
  defaultNotes(): (CharacterId | 'lino')[];
  /** Seme di riserva (id della giornata in corso). */
  defaultSeed(): string;
  /** Stonatura della campana del titolo se non è indicata. */
  stonatura(): number;
  /** Tutti i personaggi con una nota (finale vero). */
  allCharacters(): CharacterId[];
}

interface Drone {
  out: GainNode;
  trem: GainNode;
  filter: BiquadFilterNode;
  oscs: PlayHandle[];
  lfo: PlayHandle | null;
  chord: number;
  origin: number;
}

export class MusicTrack implements Track {
  private state: MusicState = 'off';
  private key = '';
  private cfg: MusicStateConfig = MUSIC_STATES.off;
  private notes: number[] = [];
  private walker: ArpWalker | null = null;
  private nextArp = Infinity;
  private nextBell = Infinity;
  private bellS = 1;
  private drone: Drone | null = null;
  private fading: { drone: Drone; until: number }[] = [];

  constructor(private readonly deps: MusicDeps) {}

  current(): MusicState {
    return this.state;
  }

  private get ctx(): BaseAudioContext {
    return this.deps.player.ctx;
  }

  set(state: MusicState, o: MusicOpts = {}): void {
    const cfg = MUSIC_STATES[state] ?? MUSIC_STATES.off;
    const seed = o.seed || this.deps.defaultSeed() || state;
    const who = cfg.allNotes ? this.deps.allCharacters() : o.notes && o.notes.length > 0 ? o.notes : this.deps.defaultNotes();
    const list = who.length > 0 ? who : [...DEFAULT_ARP_CAST];
    const notes = arpeggioNotes(list.map((w) => this.deps.noteHz(w)));
    const bellS = o.stonatura ?? this.deps.stonatura();
    const key = `${state}|${seed}|${notes.join(',')}|${bellS}`;
    if (key === this.key) return;
    const sameState = state === this.state;
    this.key = key;
    this.state = state;
    this.cfg = cfg;
    this.bellS = bellS;
    const now = this.ctx.currentTime;

    if (cfg.drone) this.startDrone(now, cfg.droneLowpass);
    else this.stopDrone(now);

    if (cfg.arpStep !== null) {
      const notesChanged = notes.join(',') !== this.notes.join(',');
      if (!sameState || notesChanged || !this.walker) {
        this.walker = new ArpWalker(seed, Math.max(1, notes.length));
        this.nextArp = now + 0.4;
      }
      this.notes = notes.length > 0 ? notes : [DEFAULT_NOTE_HZ.marta ?? 293.66];
    } else {
      this.walker = null;
      this.nextArp = Infinity;
    }
    this.nextBell = cfg.bellEvery !== null ? (sameState ? this.nextBell : now + 1.2) : Infinity;
  }

  private startDrone(now: number, lowpass: number): void {
    const d = this.drone;
    if (d) {
      d.filter.frequency.setTargetAtTime(lowpass, now, FADE_TC);
      d.out.gain.cancelScheduledValues(now);
      d.out.gain.setTargetAtTime(DRONE.gain, now, FADE_TC);
      return;
    }
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(DRONE.gain, now, FADE_TC * 2);
    out.connect(this.deps.player.graph.input('musica'));
    const trem = ctx.createGain();
    trem.gain.value = 1;
    trem.connect(out);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    filter.Q.value = 0.7;
    filter.connect(trem);
    const chord = DRONE_CHORDS[0]!;
    const oscs: PlayHandle[] = [];
    for (const f of [chord.root, chord.fifth]) {
      for (const c of [-DRONE.detuneCents, DRONE.detuneCents]) {
        const h = this.deps.player.oscillator('triangle', f, { out: filter, detuneCents: c, gain: 0.25 });
        if (h) oscs.push(h);
      }
    }
    // Tremolo lento: l'LFO si somma al guadagno (base 1) del nodo trem.
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = DRONE.tremoloDepth;
    lfoDepth.connect(trem.gain);
    const lfo = this.deps.player.oscillator('sine', DRONE.tremoloHz, { out: lfoDepth, gain: 1 });
    this.drone = { out, trem, filter, oscs, lfo, chord: 0, origin: now };
  }

  private stopDrone(now: number): void {
    const d = this.drone;
    if (!d) return;
    this.drone = null;
    d.out.gain.cancelScheduledValues(now);
    d.out.gain.setTargetAtTime(0, now, FADE_TC);
    const until = now + FADE_TC * 7;
    for (const h of d.oscs) h.stop(until);
    d.lfo?.stop(until);
    this.fading.push({ drone: d, until });
  }

  schedule(from: number, to: number): void {
    const p = this.deps.player;
    // Rotazione degli accordi del bordone.
    const d = this.drone;
    if (d) {
      const idx = chordIndexAt(to - d.origin);
      if (idx !== d.chord) {
        d.chord = idx;
        const k = Math.floor((to - d.origin) / CHORD_SECONDS);
        const at = Math.max(from, d.origin + k * CHORD_SECONDS);
        const chord = DRONE_CHORDS[idx]!;
        const freqs = [chord.root, chord.root, chord.fifth, chord.fifth];
        d.oscs.forEach((h, i) => {
          const osc = h.source as OscillatorNode;
          osc.frequency.setTargetAtTime(freqs[i] ?? chord.root, at, 0.25);
        });
      }
    }
    // Arpeggio.
    const step = this.cfg.arpStep;
    if (step !== null && this.walker && this.notes.length > 0) {
      if (this.nextArp < from - 1) this.nextArp = from;
      while (this.nextArp < to) {
        const t = this.nextArp;
        const freq = this.notes[this.walker.next()] ?? this.notes[0]!;
        let cents = 0;
        if (this.cfg.detuned) {
          const r = this.walker.random();
          const mag = ARCHIVE_DETUNE[0] + (ARCHIVE_DETUNE[1] - ARCHIVE_DETUNE[0]) * r;
          cents = r < 0.5 ? -mag : mag;
        }
        const exact = this.cfg.exact;
        if (t >= from - 0.05) {
          p.note(freq, { when: t, gain: ARP_GAIN, bus: 'musica', kind: 'music', cents, exact });
          if (this.cfg.fifthAbove) p.note(freq * 1.5, { when: t, gain: ARP_GAIN * 0.5, bus: 'musica', kind: 'music', exact });
        }
        this.nextArp += step;
      }
    }
    // Campana del titolo.
    const every = this.cfg.bellEvery;
    if (every !== null) {
      if (this.nextBell < from - 1) this.nextBell = from;
      while (this.nextBell < to) {
        if (this.nextBell >= from - 0.05) p.bell(this.bellS, { when: this.nextBell, gain: 0.3, bus: 'musica', kind: 'music' });
        this.nextBell += every;
      }
    }
    // Bordoni in dissolvenza: si scollegano a fine corsa.
    if (this.fading.length) {
      const now = this.ctx.currentTime;
      this.fading = this.fading.filter((f) => {
        if (now < f.until) return true;
        try {
          f.drone.out.disconnect();
          f.drone.trem.disconnect();
          f.drone.filter.disconnect();
        } catch {
          /* già scollegati */
        }
        return false;
      });
    }
  }

  active(): boolean {
    return this.state !== 'off' || this.drone !== null || this.fading.length > 0;
  }

  /** Ferma tutto subito (chiusura del contesto). */
  stop(): void {
    this.key = '';
    this.state = 'off';
    this.cfg = MUSIC_STATES.off;
    this.walker = null;
    this.nextArp = this.nextBell = Infinity;
    const now = this.ctx.currentTime;
    this.stopDrone(now);
  }
}

