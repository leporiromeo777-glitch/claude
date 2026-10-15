import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { L, LAYOUT, R } from '../src/world/constants';
import { cylToWorld, upAt } from '../src/world/cylinder';
import {
  createMasks,
  groundHeight,
  isWindowTheta,
  ribHeight,
  stripAt,
  surfaceHeight,
  surfaceNormal,
  WATER_HEIGHT,
} from '../src/world/terrain';
import { S_TOTAL, sAtZ, zAtS } from '../src/world/terrainGrid';

describe('terreno', () => {
  it('è deterministico', () => {
    expect(surfaceHeight(1234.5, 47.3)).toBe(surfaceHeight(1234.5, 47.3));
  });

  it('le finestre sono vetro piatto (h = 0) nella parte centrale', () => {
    for (const th of [95, 105, 119, 215, 235, 335, 359]) {
      expect(isWindowTheta(th)).toBe(true);
      for (const z of [900, 1500, 2100]) expect(surfaceHeight(z, th)).toBe(0);
    }
  });

  it('i costoloni stanno ogni 40 m e sono alti 1 m', () => {
    expect(ribHeight(1200, 100)).toBeCloseTo(LAYOUT.windows.ribHeight, 3);
    expect(ribHeight(1220, 100)).toBeCloseTo(0, 3);
    expect(ribHeight(1240, 100)).toBeCloseTo(LAYOUT.windows.ribHeight, 3);
    expect(ribHeight(1220, 45)).toBe(0); // non in valle
  });

  it('le valli restano entro ~150 m di quota fuori dai Tappi', () => {
    let max = 0;
    let min = Infinity;
    for (let z = 750; z <= 2550; z += 37) {
      for (let th = 0.5; th < 360; th += 1.7) {
        if (isWindowTheta(th)) continue;
        const h = surfaceHeight(z, th);
        max = Math.max(max, h);
        min = Math.min(min, h);
      }
    }
    expect(max).toBeGreaterThan(70);
    expect(max).toBeLessThan(160);
    expect(min).toBeGreaterThanOrEqual(0);
  });

  it('i Tappi salgono fino quasi all asse', () => {
    expect(surfaceHeight(2, 45)).toBeGreaterThan(R - 40);
    expect(surfaceHeight(L - 2, 45)).toBeGreaterThan(R - 40);
    expect(surfaceHeight(2, 105)).toBeGreaterThan(R - 40); // anche sopra le finestre
    expect(surfaceHeight(L / 2, 45)).toBeLessThan(150);
  });

  it('il lago ha il fondo sotto il pelo dell acqua e le rive sopra', () => {
    const zc = (LAYOUT.lake.zStart + LAYOUT.lake.zEnd) / 2;
    // centro del lago lontano dalle isole
    const hCenter = surfaceHeight(zc - 300, LAYOUT.lake.thetaCenter - 6);
    expect(hCenter).toBeLessThan(WATER_HEIGHT - 5);
    // fuori dal lago, in Valle 2, la terra sta sopra l'acqua
    expect(surfaceHeight(zc, 128)).toBeGreaterThan(WATER_HEIGHT);
    // le isole emergono
    for (const isl of LAYOUT.lake.islands) expect(surfaceHeight(isl.z, isl.theta)).toBeGreaterThan(WATER_HEIGHT);
  });

  it('la piazza di Corbella è piana', () => {
    const p = LAYOUT.villages[0]!.piazza;
    const h0 = surfaceHeight(p.z, p.theta);
    const h1 = surfaceHeight(p.z + 8, p.theta + 0.5);
    expect(Math.abs(h1 - h0)).toBeLessThan(0.6);
    const m = createMasks();
    surfaceHeight(p.z, p.theta, m);
    expect(m.piazza).toBeGreaterThan(0.9);
  });

  it('groundHeight coincide con surfaceHeight sui vertici della griglia e resta vicino altrove', () => {
    let maxErr = 0;
    for (let k = 0; k < 400; k++) {
      const z = 700 + Math.random() * 1800;
      const th = Math.random() * 360;
      if (isWindowTheta(th)) continue;
      const e = Math.abs(groundHeight(z, th) - surfaceHeight(z, th));
      maxErr = Math.max(maxErr, e);
    }
    expect(maxErr).toBeLessThan(1.5);
  });

  it('la normale punta verso l asse su terreno piano', () => {
    const n = surfaceNormal(1500, 105, new Vector3()); // vetro: piatto
    expect(n.dot(upAt(105))).toBeCloseTo(1, 4);
    const n2 = surfaceNormal(1500, 45, new Vector3());
    expect(n2.dot(upAt(45))).toBeGreaterThan(0.3);
  });

  it('la tabella s(z) è invertibile', () => {
    for (const z of [0, 10, 300, 620, 1500, 2700, 2999, 3000]) expect(zAtS(sAtZ(z))).toBeCloseTo(z, 3);
    expect(S_TOTAL).toBeGreaterThan(L);
  });

  it('stripAt riconosce le strisce', () => {
    expect(stripAt(45).id).toBe('valle-1');
    expect(stripAt(100).id).toBe('finestra-ponti');
    expect(stripAt(165).id).toBe('valle-2');
    expect(stripAt(300).id).toBe('valle-3');
    expect(stripAt(-5).id).toBe('finestra-3');
  });

  it('i punti del terreno stanno dentro il cilindro', () => {
    for (let k = 0; k < 200; k++) {
      const z = Math.random() * L;
      const th = Math.random() * 360;
      const p = cylToWorld(z, th, surfaceHeight(z, th));
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-6);
      expect(Math.hypot(p.x, p.y)).toBeGreaterThan(1);
    }
  });
});
