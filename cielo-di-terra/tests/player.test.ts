import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { G_EARTH, R } from '../src/world/constants';
import { cylToWorld, deltaDeg, eastAt, localFrameTheta, upAt, worldToCyl } from '../src/world/cylinder';
import { ColliderWorld, boxAt, cylinderAt } from '../src/world/colliders';
import { PlayerController, emptyInput, type ViewBasis } from '../src/player/controller';
import { CameraRig } from '../src/player/cameraRig';
import { PLAYER_TUNABLES } from '../src/player/tunables';

const DT = 1 / 60;

type GroundFn = (z: number, theta: number) => number;

/** Terreno piatto a quota costante (per isolare la fisica). */
function flat(h = 0): GroundFn {
  return () => h;
}

function viewLooking(theta: number, dir: 'north' | 'east' | 'west' | 'up', pitchDeg = 0): ViewBasis {
  const f = localFrameTheta(theta);
  const base = dir === 'north' ? f.north : dir === 'east' ? f.east : dir === 'west' ? f.east.clone().negate() : f.up;
  const p = (pitchDeg * Math.PI) / 180;
  const forward = base.clone().multiplyScalar(Math.cos(p)).addScaledVector(f.up, Math.sin(p)).normalize();
  const up = f.up.clone().multiplyScalar(Math.cos(p)).addScaledVector(base, -Math.sin(p)).normalize();
  return { forward, up };
}

function makePlayer(ground: GroundFn = flat(0), colliders: ColliderWorld | null = null) {
  const p = new PlayerController(colliders);
  p.groundFn = ground;
  return p;
}

describe('controller del giocatore', () => {
  it('resta appoggiato su terreno piano', () => {
    const p = makePlayer();
    p.teleport(1500, 40, 0);
    const v = viewLooking(40, 'north');
    for (let i = 0; i < 120; i++) p.step(DT, emptyInput(), v);
    expect(p.grounded).toBe(true);
    expect(p.heightAboveGround).toBeLessThan(1e-6);
  });

  it('cammina verso nord alla velocità di passo', () => {
    const p = makePlayer();
    p.teleport(1500, 40, 0);
    const v = viewLooking(40, 'north');
    const inp = { ...emptyInput(), forward: 1 };
    for (let i = 0; i < 120; i++) p.step(DT, inp, v);
    const c = worldToCyl(p.pos);
    expect(c.z - 1500).toBeGreaterThan(PLAYER_TUNABLES.walkSpeed * 1.8);
    expect(Math.abs(deltaDeg(40, c.theta))).toBeLessThan(0.01);
  });

  it('salta circa 1.3 m a 1 g e molto più in alto a bassa gravità', () => {
    const jump = (h: number) => {
      const p = makePlayer(flat(h));
      p.teleport(1500, 40, 0);
      const v = viewLooking(40, 'north');
      let max = 0;
      p.step(DT, { ...emptyInput(), jumpPressed: true, jumpHeld: false }, v);
      for (let i = 0; i < 60 * 30 && !p.grounded; i++) {
        p.step(DT, emptyInput(), v);
        max = Math.max(max, p.heightAboveGround);
      }
      return max;
    };
    const h1 = jump(0);
    expect(h1).toBeGreaterThan(1.1);
    expect(h1).toBeLessThan(1.45);
    const h2 = jump(450); // ~0.3 g
    expect(h2).toBeGreaterThan(h1 * 2.5);
  });

  it('un salto da fermo atterra spostato a Mane, meno con il Coriolis ridotto al 40%', () => {
    const run = (full: boolean) => {
      const p = makePlayer(flat(400));
      p.options.fullPhysics = full;
      p.teleport(1500, 40, 0);
      const v = viewLooking(40, 'north');
      p.step(DT, { ...emptyInput(), jumpPressed: true }, v);
      for (let i = 0; i < 60 * 30 && !p.grounded; i++) p.step(DT, emptyInput(), v);
      return deltaDeg(40, worldToCyl(p.pos).theta);
    };
    const reduced = run(false);
    const full = run(true);
    // nel riferimento inerziale la palla percorre una corda che sottende 2*beta mentre
    // il suolo ruota di sin(2*beta) < 2*beta: un salto verticale atterra a Mane
    expect(full).toBeGreaterThan(0);
    expect(reduced).toBeGreaterThan(0);
    expect(reduced).toBeLessThan(full);
  });

  it('non sale pendenze oltre il limite', () => {
    // parete ripida: la quota sale di 2 m per metro andando a nord oltre z = 1505
    const wall = (z: number) => (z > 1505 ? (z - 1505) * 2 : 0);
    const p = makePlayer(wall);
    p.teleport(1500, 40, 0);
    const v = viewLooking(40, 'north');
    const inp = { ...emptyInput(), forward: 1 };
    for (let i = 0; i < 300; i++) p.step(DT, inp, v);
    expect(worldToCyl(p.pos).z).toBeLessThan(1506);
    expect(p.heightAboveGround).toBeLessThan(0.05);
  });

  it('sale un gradino basso ma non un muro', () => {
    const step = (hStep: number) => {
      const g = (z: number) => (z > 1503 ? hStep : 0);
      const p = makePlayer(g);
      p.teleport(1500, 40, 0);
      const v = viewLooking(40, 'north');
      for (let i = 0; i < 180; i++) p.step(DT, { ...emptyInput(), forward: 1 }, v);
      return worldToCyl(p.pos).z;
    };
    expect(step(0.3)).toBeGreaterThan(1507);
    expect(step(1.2)).toBeLessThan(1503.5);
  });

  it('i collisori a scatola bloccano e permettono di salirci sopra se bassi', () => {
    const cw = new ColliderWorld();
    cw.add(boxAt(1506, 40, 0, 0, 6, 3, 2, 'casa'));
    cw.add(boxAt(1500, 40.25, 0, 0, 2, 0.4, 2, 'gradino'));
    const p = makePlayer(flat(0), cw);
    p.teleport(1500, 40, 0);
    const v = viewLooking(40, 'north');
    for (let i = 0; i < 240; i++) p.step(DT, { ...emptyInput(), forward: 1 }, v);
    const c = worldToCyl(p.pos);
    expect(c.z).toBeLessThan(1505 - PLAYER_TUNABLES.radius + 0.05);
    expect(c.z).toBeGreaterThan(1503);
    // gradino a est: ci sale
    p.teleport(1500, 40, 0);
    const ve = viewLooking(40, 'east');
    for (let i = 0; i < 60; i++) p.step(DT, { ...emptyInput(), forward: 1 }, ve);
    expect(p.cyl.h).toBeGreaterThan(0.35);
  });

  it('i cilindri (tronchi) spingono fuori', () => {
    const cw = new ColliderWorld();
    cw.add(cylinderAt(1504, 40, 0, 0.6, 5, 'tronco'));
    const p = makePlayer(flat(0), cw);
    p.teleport(1500, 40, 0);
    const v = viewLooking(40, 'north');
    for (let i = 0; i < 200; i++) p.step(DT, { ...emptyInput(), forward: 1 }, v);
    const pos = p.pos;
    const base = cylToWorld(1504, 40, 0);
    expect(pos.distanceTo(base)).toBeGreaterThan(0.6 + PLAYER_TUNABLES.radius - 0.05);
  });
});

describe('il Velo', () => {
  it('plana a 1 g con efficienza ragionevole (5-10)', () => {
    const p = makePlayer(flat(0));
    p.teleport(1500, 40, 200);
    const f = localFrameTheta(40);
    p.vel.copy(f.north).multiplyScalar(13);
    const v = viewLooking(40, 'north', 0);
    const start = p.pos.clone();
    const hold = { ...emptyInput(), jumpHeld: true, jumpPressed: true };
    p.step(DT, hold, v);
    expect(p.veloOpen).toBe(true);
    const held = { ...emptyInput(), jumpHeld: true };
    for (let i = 0; i < 60 * 6; i++) p.step(DT, held, v); // assestamento
    const a = p.pos.clone();
    const ha = p.cyl.h;
    for (let i = 0; i < 60 * 8; i++) p.step(DT, held, v);
    const drop = ha - p.cyl.h;
    const dist = Math.abs(p.pos.z - a.z);
    const ratio = dist / drop;
    expect(p.mode).toBe('glide');
    expect(ratio).toBeGreaterThan(5);
    expect(ratio).toBeLessThan(10);
    expect(p.glide.airspeed).toBeGreaterThan(9);
    expect(p.glide.airspeed).toBeLessThan(20);
    expect(start.z).toBeLessThan(p.pos.z);
  });

  it('da circa 0.3 g, con le correnti calde, si attraversa il cielo fino alla valle opposta', () => {
    // Tecnica: sali nelle correnti calde guardando a Lag; vicino all'asse chiudi il Velo
    // e lasciati portare oltre; appena passato l'asse riaprilo e scendi in picchiata
    // attraverso la fascia delle correnti (l'aria ti fa ruotare con il cilindro),
    // poi plana puntando la valle voluta (qui il lago, theta ~165).
    const theta0 = 10;
    const target = 165;
    const p = makePlayer(flat(0));
    p.teleport(800, theta0, 470, true);
    expect(((R - p.cyl.h) * (2 * Math.PI / 51) ** 2) / G_EARTH).toBeLessThan(0.3);
    let phase: 'climb' | 'fall' | 'dive' | 'glide' = 'climb';
    let minR = Infinity;
    const north = new Vector3(0, 0, 1);
    for (let t = 0; t < 900 && !(p.grounded && t > 5); t += DT) {
      const r = R - p.cyl.h;
      minR = Math.min(minR, r);
      const up = upAt(p.cyl.theta);
      const east = new Vector3(-up.y, up.x, 0);
      if (phase === 'climb' && r < 12) phase = 'fall';
      if (phase === 'fall' && Math.abs(deltaDeg(theta0, p.cyl.theta)) > 90 && r > 25) phase = 'dive';
      if (phase === 'dive' && p.cyl.h < 390) phase = 'glide';
      const pitch = phase === 'glide' ? -0.22 : phase === 'dive' ? -0.75 : 0.03;
      const steer = phase === 'climb' || phase === 'fall' ? 0 : Math.max(-1, Math.min(1, deltaDeg(p.cyl.theta, target) * 0.05));
      const head = north.clone().multiplyScalar(Math.cos(steer)).addScaledVector(east, Math.sin(steer));
      const v: ViewBasis = {
        forward: head.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(up, Math.sin(pitch)).normalize(),
        up: up.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(head, -Math.sin(pitch)).normalize(),
      };
      const held = phase !== 'fall';
      p.step(DT, { ...emptyInput(), jumpHeld: held, jumpPressed: held && !p.veloOpen }, v);
    }
    expect(minR).toBeLessThan(12);
    expect(phase).toBe('glide');
    expect(p.grounded).toBe(true);
    // atterrato nella valle del lago, dall'altra parte del cielo, a velocità da planata
    expect(Math.abs(deltaDeg(theta0, p.cyl.theta))).toBeGreaterThan(120);
    expect(p.cyl.theta).toBeGreaterThan(120);
    expect(p.cyl.theta).toBeLessThan(210);
  });
});

describe('camera', () => {
  it('a terra segue il suolo: girando attorno al cilindro il pitch resta costante', () => {
    const rig = new CameraRig();
    rig.set(upAt(30), eastAt(30), 0.2);
    let last = 30;
    for (let i = 0; i <= 1800; i++) {
      last = 30 + i * 0.05;
      rig.update(DT, upAt(last), true);
    }
    expect(rig.pitch(upAt(last))).toBeCloseTo(0.2, 3);
    expect(rig.forward().dot(eastAt(last))).toBeGreaterThan(0.97);
  });

  it('in aria il capovolgimento del giù diventa un rollio lento', () => {
    const rig = new CameraRig();
    const up0 = upAt(0);
    rig.set(up0, new Vector3(0, 0, 1), 0);
    const f0 = rig.forward();
    const up1 = upAt(180);
    rig.update(DT, up1, false);
    // subito dopo: lo sguardo non cambia e il rollio è appena iniziato
    expect(rig.forward().dot(f0)).toBeCloseTo(1, 6);
    expect(Math.abs(rig.rollError)).toBeGreaterThan(2.5);
    for (let i = 0; i < 60 * 4; i++) rig.update(DT, up1, false);
    expect(rig.forward().dot(f0)).toBeCloseTo(1, 6);
    expect(rig.screenUp().dot(up1)).toBeGreaterThan(0.99);
  });

  it('il pitch è limitato a 89 gradi', () => {
    const rig = new CameraRig();
    rig.set(upAt(0), new Vector3(0, 0, 1), 0);
    rig.look(0, 3, upAt(0));
    expect(rig.pitch(upAt(0))).toBeLessThanOrEqual((89 * Math.PI) / 180 + 1e-6);
  });
});
