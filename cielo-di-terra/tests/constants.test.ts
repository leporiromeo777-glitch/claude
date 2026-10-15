import { describe, expect, it } from 'vitest';
import layout from '../src/world/layout.json';
import { CELLS_NTHETA, CELLS_NZ, G_FLOOR, L, OMEGA, R, ROTATION_PERIOD } from '../src/world/constants';

describe('costanti fissate dal progetto', () => {
  it('cilindro: R = 646 m, L = 3000 m, T = 51 s', () => {
    expect(R).toBe(646);
    expect(L).toBe(3000);
    expect(ROTATION_PERIOD).toBe(51);
    expect(OMEGA).toBeCloseTo((2 * Math.PI) / 51, 12);
    expect(G_FLOOR).toBeGreaterThan(9.7);
    expect(G_FLOOR).toBeLessThan(9.9);
  });

  it('strisce: valli e finestre alternate come da specifica', () => {
    const s = layout.strips.map((x) => [x.id, x.kind, x.thetaStart, x.thetaEnd]);
    expect(s).toEqual([
      ['valle-1', 'valle', 0, 90],
      ['finestra-ponti', 'finestra', 90, 120],
      ['valle-2', 'valle', 120, 210],
      ['finestra-2', 'finestra', 210, 240],
      ['valle-3', 'valle', 240, 330],
      ['finestra-3', 'finestra', 330, 360],
    ]);
  });

  it('costoloni ogni 40 m, Collare a R - 300', () => {
    expect(layout.windows.ribSpacing).toBe(40);
    expect(layout.collare.height).toBe(300);
  });

  it('griglia delle celle copre il cilindro', () => {
    expect(CELLS_NZ * layout.cells.size).toBeCloseTo(L, 0);
    expect(CELLS_NTHETA % 12).toBe(0); // i confini a 30 gradi cadono sui bordi delle celle
  });

  it('Corbella sta in Valle 1 fra z 900 e 1200', () => {
    const v = layout.villages[0]!;
    expect(v.zCenter).toBeGreaterThanOrEqual(900);
    expect(v.zCenter).toBeLessThanOrEqual(1200);
    expect(v.thetaCenter).toBeGreaterThan(0);
    expect(v.thetaCenter).toBeLessThan(90);
  });
});
