import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { G_EARTH, OMEGA, R } from '../src/world/constants';
import {
  apparentAcceleration,
  centrifugal,
  coriolis,
  cylToWorld,
  deltaDeg,
  eastAt,
  gravityAtHeight,
  gravityInG,
  heightForGravity,
  localFrameAt,
  rotatingToInertialDir,
  upAt,
  worldToCyl,
  wrapDeg,
} from '../src/world/cylinder';

describe('gravità apparente', () => {
  it('vale 1 g sul fondo (T = 51 s, R = 646 m)', () => {
    expect(gravityInG(0)).toBeCloseTo(1, 2);
    const p = cylToWorld(1500, 37, 0);
    const a = centrifugal(p);
    expect(a.length() / G_EARTH).toBeCloseTo(1, 2);
  });

  it('vale circa 0.54 g a 300 m di quota', () => {
    expect(gravityInG(300)).toBeGreaterThan(0.53);
    expect(gravityInG(300)).toBeLessThan(0.55);
  });

  it('mezza g a circa 323 m (il concept dice ~325 m)', () => {
    expect(heightForGravity(0.5)).toBeGreaterThan(320);
    expect(heightForGravity(0.5)).toBeLessThan(327);
  });

  it('è zero sull asse', () => {
    expect(gravityAtHeight(R)).toBe(0);
    const a = centrifugal(new Vector3(0, 0, 1000));
    expect(a.length()).toBe(0);
  });

  it('punta verso l esterno (opposta al "su")', () => {
    for (const th of [0, 45, 135, 200, 300]) {
      const p = cylToWorld(800, th, 50);
      const a = centrifugal(p).normalize();
      const up = upAt(th);
      expect(a.dot(up)).toBeCloseTo(-1, 6);
    }
  });
});

describe('conversioni di coordinate', () => {
  it('andata e ritorno (z, theta, h) -> xyz -> (z, theta, h)', () => {
    for (let k = 0; k < 200; k++) {
      const z = Math.random() * 3000;
      const th = Math.random() * 360;
      const h = Math.random() * 640;
      const p = cylToWorld(z, th, h);
      const c = worldToCyl(p);
      expect(c.z).toBeCloseTo(z, 9);
      expect(deltaDeg(c.theta, th)).toBeCloseTo(0, 6);
      expect(c.h).toBeCloseTo(h, 6);
      expect(c.r).toBeCloseTo(R - h, 6);
    }
  });

  it('theta = 0 sta in basso (y = -R) con il "su" verso +Y', () => {
    const p = cylToWorld(0, 0, 0);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(-R, 9);
    expect(upAt(0).y).toBeCloseTo(1, 9);
  });

  it('wrapDeg e deltaDeg', () => {
    expect(wrapDeg(-10)).toBeCloseTo(350);
    expect(wrapDeg(725)).toBeCloseTo(5);
    expect(deltaDeg(350, 10)).toBeCloseTo(20);
    expect(deltaDeg(10, 350)).toBeCloseTo(-20);
  });
});

describe('terna locale', () => {
  it('è ortonormale e destrorsa (est x nord = su)', () => {
    for (const th of [0, 17, 90, 181, 271.5]) {
      const f = localFrameAt(cylToWorld(100, th, 20));
      expect(f.up.length()).toBeCloseTo(1, 9);
      expect(f.east.length()).toBeCloseTo(1, 9);
      expect(f.up.dot(f.east)).toBeCloseTo(0, 9);
      const c = new Vector3().crossVectors(f.east, f.north);
      expect(c.distanceTo(f.up)).toBeLessThan(1e-9);
    }
  });

  it('est è il verso della rotazione: theta cresce andando a est', () => {
    const th = 40;
    const p0 = cylToWorld(0, th, 0);
    const p1 = cylToWorld(0, th + 0.01, 0);
    const d = p1.sub(p0).normalize();
    expect(d.dot(eastAt(th))).toBeCloseTo(1, 6);
    // velocità del fondo nel riferimento inerziale: Omega x p con Omega = (0,0,-omega)
    const omega = new Vector3(0, 0, -OMEGA);
    const v = new Vector3().crossVectors(omega, p0).normalize();
    expect(v.dot(eastAt(th))).toBeCloseTo(1, 9);
  });
});

describe('Coriolis', () => {
  const th = 30;
  const up = upAt(th);
  const east = eastAt(th);
  const north = new Vector3(0, 0, 1);

  it('una palla lanciata in su devia verso Mane (est, verso della rotazione)', () => {
    const a = coriolis(up.clone().multiplyScalar(10));
    expect(a.dot(east)).toBeGreaterThan(0);
    expect(a.length()).toBeCloseTo(2 * OMEGA * 10, 9);
  });

  it('correndo a Mane si pesa di più, a Sera di meno', () => {
    const aMane = coriolis(east.clone().multiplyScalar(6));
    const aSera = coriolis(east.clone().multiplyScalar(-6));
    expect(aMane.dot(up)).toBeLessThan(0); // spinge verso il fondo
    expect(aSera.dot(up)).toBeGreaterThan(0);
  });

  it('una palla lanciata avanti lungo l asse (a Lag) non devia', () => {
    const a = coriolis(north.clone().multiplyScalar(20));
    expect(a.length()).toBeCloseTo(0, 12);
  });

  it('il fattore riduce solo il Coriolis', () => {
    const p = cylToWorld(500, th, 0);
    const v = up.clone().multiplyScalar(5);
    const full = apparentAcceleration(p, v, 1);
    const reduced = apparentAcceleration(p, v, 0.4);
    const cf = centrifugal(p);
    expect(full.clone().sub(cf).length()).toBeCloseTo(2 * OMEGA * 5, 9);
    expect(reduced.clone().sub(cf).length()).toBeCloseTo(0.4 * 2 * OMEGA * 5, 9);
  });

  it('caduta libera: l integrazione nel riferimento rotante coincide con la retta inerziale', () => {
    // palla ferma (nel riferimento rotante) a 120 m di quota: atterra a Sera della verticale
    const h0 = 120;
    const th0 = 45;
    const p = cylToWorld(1000, th0, h0);
    const v = new Vector3();
    const a = new Vector3();
    const dt = 1 / 600;
    let t = 0;
    // RK2 (punto medio) nel riferimento rotante
    const pm = new Vector3();
    const vm = new Vector3();
    while (Math.hypot(p.x, p.y) < R && t < 60) {
      apparentAcceleration(p, v, 1, a);
      pm.copy(p).addScaledVector(v, dt / 2);
      vm.copy(v).addScaledVector(a, dt / 2);
      apparentAcceleration(pm, vm, 1, a);
      p.addScaledVector(vm, dt);
      v.addScaledVector(a, dt);
      t += dt;
    }
    const landed = worldToCyl(p);
    // soluzione inerziale: moto rettilineo con velocità tangenziale omega*r0
    const r0 = R - h0;
    const tHit = Math.sqrt(R * R - r0 * r0) / (OMEGA * r0);
    const p0 = cylToWorld(1000, th0, h0);
    const vin = new Vector3().crossVectors(new Vector3(0, 0, -OMEGA), p0);
    const pin = p0.clone().addScaledVector(vin, tHit);
    // torna nel riferimento rotante: ruota di +omega*t attorno a z (inversa di rotatingToInertial)
    const back = rotatingToInertialDir(pin, -tHit);
    const expected = worldToCyl(back);
    expect(t).toBeCloseTo(tHit, 1);
    expect(deltaDeg(landed.theta, expected.theta)).toBeCloseTo(0, 2);
    // e atterra a Sera (theta minore) del punto di partenza
    expect(deltaDeg(th0, landed.theta)).toBeLessThan(0);
  });
});
