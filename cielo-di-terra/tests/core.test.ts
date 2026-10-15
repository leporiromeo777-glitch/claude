import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { FixedLoop } from '../src/core/loop';
import { EventBus } from '../src/core/events';
import { ColliderWorld, boxAt, cylinderAt } from '../src/world/colliders';
import { cylToWorld } from '../src/world/cylinder';
import { DEFAULT_TIMES, WorldClock, computeSky } from '../src/world/sky';
import { L, LAYOUT } from '../src/world/constants';
import { World, applyDemoCells } from '../src/world/world';
import { CellState } from '../src/world/cells';

describe('ciclo a passo fisso', () => {
  it('esegue 60 aggiornamenti al secondo e interpola il resto', () => {
    let updates = 0;
    let lastAlpha = -1;
    const loop = new FixedLoop({ update: () => updates++, render: (a) => (lastAlpha = a) });
    loop.tick(0);
    for (let t = 1; t <= 100; t++) loop.tick(t * 10); // 1 s a 100 fps
    expect(updates).toBeGreaterThanOrEqual(59);
    expect(updates).toBeLessThanOrEqual(60);
    expect(lastAlpha).toBeGreaterThanOrEqual(0);
    expect(lastAlpha).toBeLessThan(1);
  });

  it('limita i passi dopo una pausa lunga e rispetta la pausa', () => {
    let updates = 0;
    const loop = new FixedLoop({ update: () => updates++, render: () => {} });
    loop.tick(0);
    loop.tick(5000);
    expect(updates).toBeLessThanOrEqual(loop.maxSteps);
    loop.paused = true;
    const before = updates;
    loop.tick(5100);
    expect(updates).toBe(before);
    loop.stepFrames(10);
    expect(updates).toBe(before + 10);
  });
});

describe('bus di eventi', () => {
  it('on, once, off', () => {
    const bus = new EventBus();
    const got: number[] = [];
    const off = bus.on('player:land', (e) => got.push(e.speed));
    bus.once('player:land', (e) => got.push(-e.speed));
    bus.emit('player:land', { speed: 3, hard: false });
    bus.emit('player:land', { speed: 4, hard: false });
    off();
    bus.emit('player:land', { speed: 5, hard: false });
    expect(got).toEqual([3, -3, 4]);
  });
});

describe('collisori', () => {
  it('indice spaziale e punto dentro', () => {
    const cw = new ColliderWorld();
    cw.add(boxAt(1000, 40, 0, 30, 6, 5, 8, 'casa'));
    cw.add(cylinderAt(1020, 40, 0, 0.5, 4, 'tronco'));
    expect(cw.size).toBe(2);
    expect(cw.query(1000, 40, 10).length).toBeGreaterThanOrEqual(1);
    expect(cw.query(1500, 200, 10).length).toBe(0);
    expect(cw.pointInside(cylToWorld(1000, 40, 2))).toBe(true);
    expect(cw.pointInside(cylToWorld(1000, 40, 7))).toBe(false);
    expect(cw.pointInside(cylToWorld(1020, 40, 1))).toBe(true);
    const id = [...cw.all()].find((c) => c.tag === 'tronco')!.id;
    cw.remove(id);
    expect(cw.pointInside(cylToWorld(1020, 40, 1))).toBe(false);
  });

  it('boxAt: a yaw 0 il davanti è il nord e la destra è l est', () => {
    const b = boxAt(500, 10, 0, 0, 2, 2, 2);
    expect(b.forward.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-9);
    const e = boxAt(500, 10, 0, 90, 2, 2, 2);
    expect(e.forward.z).toBeCloseTo(0, 9);
  });
});

describe('cielo e Linea', () => {
  it('di giorno la Linea è accesa da un capo all altro, di notte è brace', () => {
    const noon = computeSky(13);
    expect(noon.lineaIgnite).toBe(L);
    expect(noon.night).toBe(0);
    const night = computeSky(2);
    expect(night.lineaIgnite).toBe(0);
    expect(night.night).toBe(1);
  });

  it('all alba la miccia avanza dal Tappo Sud verso nord', () => {
    const mid = (DEFAULT_TIMES.dawnStart + DEFAULT_TIMES.dawnEnd) / 2;
    const s = computeSky(mid);
    expect(s.lineaIgnite).toBeGreaterThan(0.3 * L);
    expect(s.lineaIgnite).toBeLessThan(0.7 * L);
    expect(computeSky(DEFAULT_TIMES.dawnStart + 0.1).lineaIgnite).toBeLessThan(s.lineaIgnite);
  });

  it('la luce resta fra 30 e 50 gradi dalla verticale', () => {
    for (let h = 6; h <= 20; h += 0.5) {
      const a = (computeSky(h).tiltAlpha * 180) / Math.PI;
      expect(a).toBeGreaterThanOrEqual(29.99);
      expect(a).toBeLessThanOrEqual(50.01);
    }
  });

  it('un giorno dura 40 minuti reali', () => {
    const c = new WorldClock(0, 40);
    c.advance(40 * 60 * 0.5);
    expect(c.hours).toBeCloseTo(12, 6);
  });
});

describe('facciata World', () => {
  it('stato demo: paese dipinto, Sordo a matita, rivelazione animata', () => {
    const w = new World();
    applyDemoCells(w);
    const s = LAYOUT.start;
    expect(w.cells.get(w.cellAt(s.z, s.theta))).toBe(CellState.Painted);
    expect(w.cells.get(w.cellAt(2900, 45))).toBe(CellState.Pencil);
    expect(w.cells.get(w.cellAt(1500, 165))).toBe(CellState.Painted);
    const ids = w.cellsInRadius(1800, 30, 60).filter((id) => w.cells.get(id) === CellState.Pencil);
    expect(ids.length).toBeGreaterThan(0);
    w.time = 100;
    w.revealCells(ids, { z: 1800, theta: 30 });
    expect(w.cells.progress(ids[0]!, 100)).toBe(0);
    expect(w.cells.progress(ids[0]!, 103)).toBe(1);
    w.setCellState(ids[0]!, CellState.Blank);
    expect(w.cells.get(ids[0]!)).toBe(CellState.Blank);
    expect(w.heightAt(1500, 105)).toBe(0);
  });
});
