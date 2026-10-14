import { describe, expect, it } from 'vitest';
import { createLoop, MAX_FRAME, MAX_STEPS, STEP } from '../../../src/core/loop';

function setup() {
  let now = 0;
  const updates: number[] = [];
  const renders: number[] = [];
  const loop = createLoop(
    (dt) => updates.push(dt),
    (a) => renders.push(a),
    { raf: () => 1, caf: () => undefined, now: () => now, doc: null },
  );
  return {
    loop,
    updates,
    renders,
    setNow: (ms: number) => {
      now = ms;
    },
  };
}

describe('ciclo a passo fisso', () => {
  it('costanti di ARCHITETTURA 6', () => {
    expect(STEP).toBeCloseTo(1 / 60, 12);
    expect(MAX_FRAME).toBe(0.25);
    expect(MAX_STEPS).toBe(5);
  });

  it('un fotogramma a 60 Hz → un passo da 1/60 s e un render', () => {
    const { loop, updates, renders } = setup();
    loop.frame(0);
    loop.frame(1000 / 60 + 0.01);
    expect(updates).toEqual([STEP]);
    expect(renders.length).toBe(2);
  });

  it('a 120 Hz un passo ogni due fotogrammi, con alpha di interpolazione', () => {
    const { loop, updates, renders } = setup();
    loop.frame(0);
    loop.frame(1000 / 120);
    expect(updates.length).toBe(0);
    expect(renders.at(-1)).toBeCloseTo(0.5, 5);
    loop.frame(1000 / 60 + 0.01);
    expect(updates.length).toBe(1);
  });

  it('dt limitato a 250 ms e al massimo 5 passi per fotogramma', () => {
    const { loop, updates, renders } = setup();
    loop.frame(0);
    loop.frame(3000); // 3 s di pausa del browser
    expect(updates.length).toBe(MAX_STEPS);
    // L'accumulatore è stato azzerato: niente recupero nei fotogrammi successivi.
    expect(renders.at(-1)).toBe(0);
    loop.frame(3000 + 1000 / 60 + 0.01);
    expect(updates.length).toBe(MAX_STEPS + 1);
  });

  it('50 ms → 3 passi', () => {
    const { loop, updates } = setup();
    loop.frame(0);
    loop.frame(50.5);
    expect(updates.length).toBe(3);
  });

  it('in pausa niente update né render; alla ripresa il dt non salta', () => {
    const { loop, updates, renders, setNow } = setup();
    loop.frame(0);
    loop.pause();
    loop.frame(100);
    loop.frame(5000);
    expect(updates.length).toBe(0);
    expect(renders.length).toBe(1);
    setNow(10_000);
    loop.resume();
    loop.frame(10_000 + 1000 / 60 + 0.01);
    expect(updates.length).toBe(1);
  });

  it('step(ms) avanza il tempo simulato in modo deterministico, anche in pausa', () => {
    const { loop, updates, renders } = setup();
    loop.pause();
    loop.step(1000);
    expect(updates.length).toBe(60);
    expect(loop.ticks()).toBe(60);
    expect(loop.simTime()).toBeCloseTo(1, 9);
    expect(renders.length).toBe(1);
    loop.step(10);
    expect(updates.length).toBe(60);
    loop.step(10); // 20 ms in tutto: un passo
    expect(updates.length).toBe(61);
    loop.step(1000 / 60);
    expect(updates.length).toBe(62);
  });

  it('setSpeed moltiplica il tempo reale', () => {
    const { loop, updates } = setup();
    loop.setSpeed(2);
    loop.frame(0);
    loop.frame(1000 / 60 + 0.01);
    expect(updates.length).toBe(2);
    loop.setSpeed(-1); // valore non valido → 1
    expect(loop.speed()).toBe(1);
  });

  it('setSpeed(8) a 60 Hz vale davvero 8 passi per fotogramma (i test accelerano le animazioni)', () => {
    const { loop, updates } = setup();
    loop.setSpeed(8);
    loop.frame(0);
    for (let i = 1; i <= 60; i++) loop.frame(i * (1000 / 60) + 0.001);
    // 60 fotogrammi da 1/60 s a 8× = 480 passi (con tolleranza per l'arrotondamento)
    expect(updates.length).toBeGreaterThanOrEqual(478);
    expect(updates.length).toBeLessThanOrEqual(480);
    // Dopo una lunga pausa del browser il tetto resta finito: 250 ms × 8 = 120 passi al massimo.
    const before = updates.length;
    loop.frame(60 * (1000 / 60) + 5000);
    expect(updates.length - before).toBeLessThanOrEqual(MAX_STEPS * 8);
  });

  it('pausa di sistema indipendente da quella di debug', () => {
    const { loop } = setup();
    loop.setSystemPaused(true);
    expect(loop.paused()).toBe(true);
    loop.pause();
    loop.setSystemPaused(false);
    expect(loop.paused()).toBe(true);
    loop.resume();
    expect(loop.paused()).toBe(false);
  });

  it('perf misura i tempi di lavoro', () => {
    const { loop } = setup();
    for (let i = 0; i < 20; i++) loop.frame(i * 16.7);
    const p = loop.perf();
    expect(p.frames).toBe(20);
    expect(p.p95).toBeGreaterThanOrEqual(0);
    expect(p.fps).toBeGreaterThan(55);
  });
});
