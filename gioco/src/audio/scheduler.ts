/**
 * Orologio con anticipo ("lookahead"): un timer a bassa frequenza chiede alle tracce
 * (musica, ambiente, carillon) di programmare i suoni dei prossimi 300 ms sul tempo
 * preciso del contesto audio. Se il contesto è sospeso il suo tempo non avanza e non
 * si accumula nulla; il timer gira solo finché qualche traccia è attiva.
 */

export interface Track {
  /** Programma gli eventi con tempo in [from, to). */
  schedule(from: number, to: number): void;
  /** false quando la traccia ha finito e si può togliere. */
  active(): boolean;
}

export interface ClockTimers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const TICK_MS = 90;
export const LOOKAHEAD = 0.3;

export class Clock {
  private readonly tracks = new Set<Track>();
  private handle: unknown = null;
  private horizon = 0;
  private running = false;

  constructor(
    private readonly time: () => number,
    private readonly timers: ClockTimers = {
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    },
    private readonly lookahead = LOOKAHEAD,
  ) {}

  add(t: Track): void {
    this.tracks.add(t);
    // Primo giro subito: i suoni del primo istante non aspettano il timer.
    try {
      const now = this.time();
      t.schedule(now, Math.max(this.horizon, now + this.lookahead));
    } catch (err) {
      console.error('[audio] track error', err);
    }
    this.ensure();
  }

  remove(t: Track): void {
    this.tracks.delete(t);
  }

  has(t: Track): boolean {
    return this.tracks.has(t);
  }

  /** Il contesto è (o non è) in esecuzione: il timer gira solo quando serve. */
  setRunning(on: boolean): void {
    this.running = on;
    if (on) this.ensure();
    else this.cancel();
  }

  /** Un giro dell'orologio (anche per i test). */
  tick(): void {
    const now = this.time();
    const from = Math.max(now, this.horizon);
    const to = now + this.lookahead;
    if (to > from) {
      for (const t of [...this.tracks]) {
        try {
          t.schedule(from, to);
        } catch (err) {
          console.error('[audio] track error', err);
        }
      }
      this.horizon = to;
    }
    for (const t of [...this.tracks]) if (!t.active()) this.tracks.delete(t);
  }

  private ensure(): void {
    if (this.handle !== null || !this.running || this.tracks.size === 0) return;
    const loop = (): void => {
      this.handle = null;
      this.tick();
      if (this.running && this.tracks.size > 0) this.handle = this.timers.set(loop, TICK_MS);
    };
    this.handle = this.timers.set(loop, TICK_MS);
  }

  private cancel(): void {
    if (this.handle !== null) this.timers.clear(this.handle);
    this.handle = null;
  }

  stop(): void {
    this.cancel();
    this.tracks.clear();
  }
}
