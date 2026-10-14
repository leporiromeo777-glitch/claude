/**
 * Ciclo di gioco a passo fisso (ARCHITETTURA 6).
 *
 * - Passo fisso di 1/60 s; il dt di un fotogramma è limitato a 250 ms (dopo una
 *   ripresa) e si eseguono al massimo 5 passi per fotogramma: oltre, si azzera
 *   l'accumulatore (niente spirale della morte).
 * - Pausa automatica quando la pagina si nasconde (visibilitychange); alla ripresa
 *   l'orologio è riallineato, così il dt non salta.
 * - Debug: pause/resume/step(ms)/setSpeed(x). `step` esegue gli update a passi di
 *   1/60 s di tempo simulato e poi un render: è deterministico.
 * - Misura il tempo di JavaScript per fotogramma (update + render) per `perf()`.
 */
import type { GameLoop } from './types';

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const MAX_STEPS = 5;
const PERF_SAMPLES = 240;

export interface LoopDeps {
  raf?: (cb: (t: number) => void) => number;
  caf?: (id: number) => void;
  now?: () => number;
  /** Documento da osservare per la pausa automatica (null: nessuna). */
  doc?: Document | null;
}

export interface PerfStats {
  fps: number;
  /** Millisecondi di JavaScript per fotogramma (update + render). */
  p50: number;
  p95: number;
  max: number;
  frames: number;
}

export interface CoreLoop extends GameLoop {
  start(): void;
  stop(): void;
  running(): boolean;
  /** Esegue un fotogramma con l'orario indicato (ms): usato da rAF e dai test. */
  frame(nowMs: number): void;
  perf(): PerfStats;
  /** Passi di simulazione eseguiti dall'avvio. */
  ticks(): number;
  /** Tempo simulato in secondi (ticks × 1/60). */
  simTime(): number;
  speed(): number;
  /** Pausa di sistema (pagina nascosta, app in pausa): indipendente da pause(). */
  setSystemPaused(on: boolean): void;
}

function defaultNow(): number {
  return performance.now();
}

export function createLoop(
  onUpdate: (dt: number) => void,
  onRender: (alpha: number) => void,
  deps: LoopDeps = {},
): CoreLoop {
  const raf = deps.raf ?? ((cb: (t: number) => void) => requestAnimationFrame(cb));
  const caf = deps.caf ?? ((id: number) => cancelAnimationFrame(id));
  const now = deps.now ?? defaultNow;
  const doc = deps.doc === undefined ? (typeof document !== 'undefined' ? document : null) : deps.doc;

  let acc = 0;
  let last = now() / 1000;
  let speed = 1;
  let userPaused = false;
  let systemPaused = false;
  let rafId = 0;
  let isRunning = false;
  let tickCount = 0;
  let stepAcc = 0;

  // Statistiche: durate di lavoro per fotogramma e istanti dei fotogrammi.
  const work = new Float64Array(PERF_SAMPLES);
  const stamps = new Float64Array(PERF_SAMPLES);
  let perfHead = 0;
  let perfCount = 0;
  let frameCount = 0;

  const isPaused = (): boolean => userPaused || systemPaused;

  function update(dt: number): void {
    onUpdate(dt);
    tickCount++;
  }

  function frame(nowMs: number): void {
    const t = nowMs / 1000;
    const dt = Math.min(Math.max(t - last, 0), MAX_FRAME);
    last = t;
    if (isPaused()) return;
    const t0 = now();
    acc += dt * speed;
    let steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0; // niente spirale della morte
    onRender(acc / STEP);
    const t1 = now();
    work[perfHead] = t1 - t0;
    stamps[perfHead] = nowMs;
    perfHead = (perfHead + 1) % PERF_SAMPLES;
    if (perfCount < PERF_SAMPLES) perfCount++;
    frameCount++;
  }

  function onFrame(t: number): void {
    if (!isRunning) return;
    rafId = raf(onFrame);
    frame(t);
  }

  function realign(): void {
    last = now() / 1000;
    acc = 0;
  }

  function onVisibility(): void {
    if (!doc) return;
    loop.setSystemPaused(doc.visibilityState === 'hidden');
  }

  const loop: CoreLoop = {
    start() {
      if (isRunning) return;
      isRunning = true;
      realign();
      rafId = raf(onFrame);
      doc?.addEventListener('visibilitychange', onVisibility);
    },
    stop() {
      isRunning = false;
      if (rafId) caf(rafId);
      rafId = 0;
      doc?.removeEventListener('visibilitychange', onVisibility);
    },
    running: () => isRunning,
    frame,
    pause() {
      userPaused = true;
    },
    resume() {
      if (!userPaused) return;
      userPaused = false;
      realign();
    },
    paused: isPaused,
    setSystemPaused(on) {
      if (systemPaused === on) return;
      systemPaused = on;
      if (!on) realign();
    },
    step(ms) {
      if (!Number.isFinite(ms) || ms <= 0) {
        onRender(0);
        return;
      }
      stepAcc += ms / 1000;
      // Tolleranza per gli errori di arrotondamento (step(1000/60) = un passo).
      while (stepAcc >= STEP - 1e-9) {
        update(STEP);
        stepAcc -= STEP;
      }
      if (stepAcc < 0) stepAcc = 0;
      onRender(0);
    },
    setSpeed(x) {
      speed = Number.isFinite(x) && x > 0 ? Math.min(x, 64) : 1;
    },
    speed: () => speed,
    fps() {
      if (perfCount < 2) return 0;
      const newest = (perfHead - 1 + PERF_SAMPLES) % PERF_SAMPLES;
      const n = Math.min(perfCount, 61);
      const oldest = (perfHead - n + PERF_SAMPLES) % PERF_SAMPLES;
      const span = (stamps[newest] ?? 0) - (stamps[oldest] ?? 0);
      return span > 0 ? Math.round(((n - 1) * 1000) / span) : 0;
    },
    perf() {
      const n = perfCount;
      const sorted = Array.from(work.subarray(0, n)).sort((a, b) => a - b);
      const q = (p: number): number => (n === 0 ? 0 : (sorted[Math.min(n - 1, Math.floor(p * (n - 1)))] ?? 0));
      const round = (v: number): number => Math.round(v * 1000) / 1000;
      return {
        fps: loop.fps(),
        p50: round(q(0.5)),
        p95: round(q(0.95)),
        max: round(n ? (sorted[n - 1] ?? 0) : 0),
        frames: frameCount,
      };
    },
    ticks: () => tickCount,
    simTime: () => tickCount * STEP,
  };
  return loop;
}
