/**
 * Ciclo a passo fisso: la simulazione avanza a 60 Hz esatti, il disegno avviene
 * a ogni fotogramma con un fattore di interpolazione `alpha` fra l'ultimo stato
 * e il precedente. Il tempo può essere messo in pausa e fatto avanzare a mano
 * (`stepFrames`), utile per test e screenshot deterministici.
 */
export interface LoopCallbacks {
  /** Un passo di simulazione di durata fissa `dt` (s). */
  update(dt: number): void;
  /** Disegno: `alpha` in [0,1] fra stato precedente e corrente; `frameDt` = tempo reale trascorso. */
  render(alpha: number, frameDt: number): void;
}

export class FixedLoop {
  readonly dt: number;
  /** Massimo numero di passi per fotogramma (evita la "spirale della morte"). */
  maxSteps = 5;
  accumulator = 0;
  paused = false;
  /** Passi di simulazione eseguiti dall'avvio. */
  steps = 0;
  private last = -1;
  private raf = 0;
  private running = false;

  constructor(
    private cb: LoopCallbacks,
    hz = 60,
  ) {
    this.dt = 1 / hz;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = -1;
    const frame = (t: number) => {
      if (!this.running) return;
      this.tick(t);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  /** Un fotogramma all'istante `nowMs` (esposto per i test). */
  tick(nowMs: number): number {
    if (this.last < 0) this.last = nowMs;
    let frameDt = (nowMs - this.last) / 1000;
    this.last = nowMs;
    if (frameDt > 0.25) frameDt = 0.25;
    let n = 0;
    if (!this.paused) {
      this.accumulator += frameDt;
      while (this.accumulator >= this.dt && n < this.maxSteps) {
        this.cb.update(this.dt);
        this.accumulator -= this.dt;
        this.steps++;
        n++;
      }
      if (n === this.maxSteps) this.accumulator = Math.min(this.accumulator, this.dt);
    }
    this.cb.render(this.paused ? 1 : this.accumulator / this.dt, frameDt);
    return n;
  }

  /** Avanza di `n` passi fissi senza disegnare (test e prove E2E veloci). */
  stepUpdates(n: number): void {
    for (let i = 0; i < n; i++) {
      this.cb.update(this.dt);
      this.steps++;
    }
  }

  /** Avanza di `n` passi fissi e disegna una volta (anche in pausa). */
  stepFrames(n: number): void {
    for (let i = 0; i < n; i++) {
      this.cb.update(this.dt);
      this.steps++;
    }
    this.cb.render(1, n * this.dt);
  }
}
