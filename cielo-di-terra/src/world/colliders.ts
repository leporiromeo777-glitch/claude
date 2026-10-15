/**
 * Collisori semplici per edifici, muri e alberi: scatole orientate e cilindri
 * "verticali" (cioè allineati al "su" locale del punto in cui stanno).
 *
 * Ogni collisore ha una terna locale propria: (right, up, forward). Per le
 * scatole create con `boxAt` il "forward" a yaw 0 è il nord (+z) e il "right"
 * è l'est: yaw positivo ruota da nord verso est (come una bussola).
 *
 * Un indice spaziale a celle (z, arco sul fondo) da 32 m rende veloci le
 * interrogazioni del controller. Gli altri agenti aggiungono collisori con
 * `world.colliders.add(...)`.
 */
import { Vector3 } from 'three';
import { DEG, METERS_PER_DEG } from './constants';
import { cylToWorld, localFrameTheta, worldToCyl, wrapDeg } from './cylinder';

export interface BoxCollider {
  kind: 'box';
  id: number;
  /** Centro della scatola (mondo). */
  center: Vector3;
  right: Vector3;
  up: Vector3;
  forward: Vector3;
  /** Semiassi lungo right, up, forward (m). */
  half: Vector3;
  /** Etichetta libera (es. "casa", "muro"). */
  tag?: string;
}

export interface CylinderCollider {
  kind: 'cylinder';
  id: number;
  /** Centro della base (mondo). */
  base: Vector3;
  up: Vector3;
  radius: number;
  height: number;
  tag?: string;
}

export type Collider = BoxCollider | CylinderCollider;

const BUCKET = 32;
const BUCKETS_AROUND = Math.round((360 * METERS_PER_DEG) / BUCKET);

function bucketKey(iz: number, ia: number): number {
  const a = ((ia % BUCKETS_AROUND) + BUCKETS_AROUND) % BUCKETS_AROUND;
  return iz * 1024 + a;
}

/**
 * Scatola appoggiata sul terreno: base a quota `hBase` in (z, theta), alta
 * `height`, larga `width` (lungo right) e profonda `depth` (lungo forward),
 * ruotata di `yawDeg` attorno al "su" locale.
 */
export function boxAt(z: number, theta: number, hBase: number, yawDeg: number, width: number, height: number, depth: number, tag?: string): BoxCollider {
  const f = localFrameTheta(theta);
  const yaw = yawDeg * DEG;
  const forward = f.north.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(f.east, Math.sin(yaw));
  const right = forward.clone().cross(f.up).normalize(); // forward x up = right
  const center = cylToWorld(z, theta, hBase).addScaledVector(f.up, height / 2);
  return { kind: 'box', id: -1, center, right, up: f.up.clone(), forward, half: new Vector3(width / 2, height / 2, depth / 2), tag };
}

/** Cilindro verticale (tronco, palo, torre) con base a quota `hBase`. */
export function cylinderAt(z: number, theta: number, hBase: number, radius: number, height: number, tag?: string): CylinderCollider {
  const f = localFrameTheta(theta);
  return { kind: 'cylinder', id: -1, base: cylToWorld(z, theta, hBase), up: f.up.clone(), radius, height, tag };
}

const _v = new Vector3();

export class ColliderWorld {
  private items = new Map<number, Collider>();
  private buckets = new Map<number, number[]>();
  private nextId = 1;

  get size(): number {
    return this.items.size;
  }

  all(): IterableIterator<Collider> {
    return this.items.values();
  }

  add(c: Collider): number {
    c.id = this.nextId++;
    this.items.set(c.id, c);
    const center = c.kind === 'box' ? c.center : c.base;
    const reach = c.kind === 'box' ? Math.hypot(c.half.x, c.half.z) + 1 : c.radius + 1;
    const cyl = worldToCyl(center);
    const arc = cyl.theta * METERS_PER_DEG;
    const z0 = Math.floor((cyl.z - reach) / BUCKET);
    const z1 = Math.floor((cyl.z + reach) / BUCKET);
    // l'arco sul fondo è più largo dell'arco alla quota del collisore: va bene (conservativo)
    const a0 = Math.floor((arc - reach) / BUCKET);
    const a1 = Math.floor((arc + reach) / BUCKET);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ia = a0; ia <= a1; ia++) {
        const k = bucketKey(iz, ia);
        let b = this.buckets.get(k);
        if (!b) this.buckets.set(k, (b = []));
        b.push(c.id);
      }
    }
    return c.id;
  }

  addMany(cs: Collider[]): void {
    for (const c of cs) this.add(c);
  }

  remove(id: number): void {
    if (!this.items.delete(id)) return;
    for (const b of this.buckets.values()) {
      const i = b.indexOf(id);
      if (i >= 0) b.splice(i, 1);
    }
  }

  clear(): void {
    this.items.clear();
    this.buckets.clear();
  }

  /** Collisori vicini al punto (z, theta) entro circa `radius` metri. */
  query(z: number, theta: number, radius: number, out: Collider[] = []): Collider[] {
    out.length = 0;
    const arc = wrapDeg(theta) * METERS_PER_DEG;
    const z0 = Math.floor((z - radius) / BUCKET);
    const z1 = Math.floor((z + radius) / BUCKET);
    const a0 = Math.floor((arc - radius) / BUCKET);
    const a1 = Math.floor((arc + radius) / BUCKET);
    const seen = new Set<number>();
    for (let iz = z0; iz <= z1; iz++) {
      for (let ia = a0; ia <= a1; ia++) {
        const b = this.buckets.get(bucketKey(iz, ia));
        if (!b) continue;
        for (const id of b) {
          if (seen.has(id)) continue;
          seen.add(id);
          out.push(this.items.get(id)!);
        }
      }
    }
    return out;
  }

  /** Vero se il punto mondo `p` sta dentro un collisore (utile per il posizionamento). */
  pointInside(p: Vector3, margin = 0): boolean {
    const c = worldToCyl(p);
    for (const col of this.query(c.z, c.theta, 20)) {
      if (col.kind === 'box') {
        _v.subVectors(p, col.center);
        if (
          Math.abs(_v.dot(col.right)) <= col.half.x + margin &&
          Math.abs(_v.dot(col.up)) <= col.half.y + margin &&
          Math.abs(_v.dot(col.forward)) <= col.half.z + margin
        )
          return true;
      } else {
        _v.subVectors(p, col.base);
        const y = _v.dot(col.up);
        if (y < -margin || y > col.height + margin) continue;
        _v.addScaledVector(col.up, -y);
        if (_v.length() <= col.radius + margin) return true;
      }
    }
    return false;
  }
}
