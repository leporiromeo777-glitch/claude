/**
 * Carillon del merletto (GDD 13.2): una riga = un battito (380 ms). Ogni incrocio della
 * riga suona il bicordo dei due personaggi (sopra prima, sotto 30 ms dopo); le righe
 * vuote un tic leggero. Le note sono buffer pre-renderizzati (una sorgente per nota) e
 * si programmano poco alla volta con l'orologio, così anche il carillon dell'intera
 * partita (titoli di coda, Tovaglia) resta sotto il limite di 48 sorgenti.
 */
import type { CarillonScore, CharacterId } from '../core/types';
import type { PlayHandle, Player } from './player';
import { CROSSING_GAP } from './player';
import type { Track } from './scheduler';
import { MUSICBOX_T60 } from './synth/musicbox';

export const CARILLON_BEAT_MS = 380;
/** Sfasamento fra due bicordi della stessa riga (arpeggiato leggero). */
export const DYAD_STAGGER = 0.012;
export const CARILLON_NOTE_GAIN = 0.28;
export const CARILLON_TICK_GAIN = 0.3;

export type CarillonEvent =
  | { t: number; kind: 'nota'; who: CharacterId | 'lino'; role: 'sopra' | 'sotto' }
  | { t: number; kind: 'tic' };

export function beatSeconds(score: CarillonScore): number {
  const ms = Number.isFinite(score.beatMs) && score.beatMs > 0 ? score.beatMs : CARILLON_BEAT_MS;
  return ms / 1000;
}

/** Eventi del carillon in ordine di tempo (funzione pura). */
export function carillonEvents(score: CarillonScore): CarillonEvent[] {
  const beat = beatSeconds(score);
  const out: CarillonEvent[] = [];
  score.rows.forEach((row, r) => {
    const t0 = r * beat;
    if (!row || row.length === 0) {
      out.push({ t: t0, kind: 'tic' });
      return;
    }
    row.forEach((dyad, d) => {
      const td = t0 + d * DYAD_STAGGER;
      const [over, under] = dyad;
      if (over) out.push({ t: td, kind: 'nota', who: over, role: 'sopra' });
      if (under) out.push({ t: td + CROSSING_GAP, kind: 'nota', who: under, role: 'sotto' });
    });
  });
  return out.sort((a, b) => a.t - b.t);
}

/** Durata complessiva, con la coda dell'ultima nota (s). */
export function carillonSeconds(score: CarillonScore): number {
  return score.rows.length * beatSeconds(score) + MUSICBOX_T60;
}

export class CarillonTrack implements Track {
  private i = 0;
  private stopped = false;
  private readonly handles: PlayHandle[] = [];

  constructor(
    private readonly player: Player,
    private readonly events: readonly CarillonEvent[],
    private readonly start: number,
    private readonly noteHz: (who: CharacterId | 'lino') => number | null,
    private readonly gain = 1,
  ) {}

  schedule(_from: number, to: number): void {
    if (this.stopped) return;
    const p = this.player;
    while (this.i < this.events.length) {
      const e = this.events[this.i]!;
      const when = this.start + e.t;
      if (when >= to) break;
      this.i++;
      // Un evento rimasto indietro (contesto sospeso a lungo) non si recupera.
      if (when < p.now() - 0.1) continue;
      const h =
        e.kind === 'tic'
          ? p.sfx('tic', { when, gain: CARILLON_TICK_GAIN * this.gain, kind: 'music' })
          : p.note(this.noteHz(e.who), { when, gain: CARILLON_NOTE_GAIN * this.gain, kind: 'music' });
      if (h) this.handles.push(h);
    }
    // Tiene solo i riferimenti alle note ancora in corso.
    const now = p.now();
    for (let k = this.handles.length - 1; k >= 0; k--) if (this.handles[k]!.end <= now) this.handles.splice(k, 1);
  }

  active(): boolean {
    return !this.stopped && this.i < this.events.length;
  }

  stop(): void {
    this.stopped = true;
    for (const h of this.handles.splice(0)) h.stop();
  }
}
