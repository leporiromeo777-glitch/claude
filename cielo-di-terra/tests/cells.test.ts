import { describe, expect, it } from 'vitest';
import { CELLS_NTHETA, CELLS_NZ, CELL_DEG, CELL_DZ } from '../src/world/constants';
import { CellGrid, CellState } from '../src/world/cells';

describe('griglia delle particelle', () => {
  it('id <-> centro', () => {
    const g = new CellGrid();
    expect(g.count).toBe(CELLS_NZ * CELLS_NTHETA);
    for (const id of [0, 1, 95, 96, 1234, g.count - 1]) {
      const c = g.center(id);
      expect(g.idAt(c.z, c.theta)).toBe(id);
    }
    expect(g.idAt(CELL_DZ * 0.5, 360 - CELL_DEG * 0.5)).toBe(CELLS_NTHETA - 1);
    expect(g.idAt(5, -0.1)).toBe(CELLS_NTHETA - 1); // avvolgimento in theta
  });

  it('cellsInRadius trova le celle vicine anche attraverso theta = 0', () => {
    const g = new CellGrid();
    const ids = g.cellsInRadius(1000, 0.5, 60);
    expect(ids.length).toBeGreaterThan(3);
    const thetas = ids.map((id) => g.center(id).theta);
    expect(thetas.some((t) => t > 300)).toBe(true);
    expect(thetas.some((t) => t < 10)).toBe(true);
  });

  it('revealCells anima la transizione dall origine', () => {
    const g = new CellGrid(CellState.Pencil);
    const seen: number[] = [];
    g.onChange((c) => seen.push(...c.ids));
    const ids = g.cellsInRadius(1500, 40, 80);
    g.revealCells(ids, { z: 1500, theta: 40 }, 10);
    for (const id of ids) {
      expect(g.get(id)).toBe(CellState.Painted);
      expect(g.prev[id]).toBe(CellState.Pencil);
      expect(g.progress(id, 10)).toBe(0);
      expect(g.progress(id, 100)).toBe(1);
      expect(g.radius[id]).toBeGreaterThan(60);
    }
    expect(seen.sort()).toEqual([...ids].sort());
    expect(g.consumeDirty().length).toBe(ids.length);
    expect(g.consumeDirty().length).toBe(0);
  });

  it('setCellState senza tempo non anima', () => {
    const g = new CellGrid(CellState.Pencil);
    g.setCellState(5, CellState.Blank);
    expect(g.get(5)).toBe(CellState.Blank);
    expect(g.progress(5, 0)).toBe(1);
  });
});
