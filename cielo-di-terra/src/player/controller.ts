/**
 * Controller cinematico in prima persona, simulato nel riferimento rotante.
 *
 * - gravità radiale (centrifuga) da `cylinder.ts`, Coriolis al 40% sul corpo
 *   (100% con "fisica piena" e sempre sulle planate);
 * - camminata/corsa sul piano tangente locale, salto, limite di pendenza, gradini;
 * - collisione con il terreno (`groundHeight`, coerente con la mesh) e con i
 *   collisori semplici (scatole e cilindri) di `ColliderWorld`;
 * - Velo: tenendo premuto Spazio in aria si apre l'ala (vedi `velo.ts`).
 *
 * Nessuna dipendenza da WebGL: gira nei test in Node.
 */
import { Vector3 } from 'three';
import { L, METERS_PER_DEG, R } from '../world/constants';
import { apparentAcceleration, cylToWorld, localFrameAt, upAt, worldToCyl, type CylCoords, type LocalFrame } from '../world/cylinder';
import type { Collider, ColliderWorld } from '../world/colliders';
import { groundHeight as terrainGround } from '../world/terrain';
import { PLAYER_TUNABLES, VELO_TUNABLES, type PlayerTunables, type VeloTunables } from './tunables';
import { thermalWind, veloAcceleration, type GlideDebug } from './velo';

export type PlayerMode = 'walk' | 'air' | 'glide';

export interface PlayerInput {
  /** -1..1 avanti/indietro. */
  forward: number;
  /** -1..1 destra/sinistra. */
  right: number;
  run: boolean;
  /** Spazio appena premuto (fronte di salita in questo passo). */
  jumpPressed: boolean;
  /** Spazio tenuto premuto. */
  jumpHeld: boolean;
}

export interface ViewBasis {
  /** Direzione dello sguardo (unitaria). */
  forward: Vector3;
  /** "Su" dello schermo (unitario, perpendicolare a forward). */
  up: Vector3;
}

export interface PhysicsOptions {
  /** Fattore del Coriolis sul corpo a piedi (0.4 nel concept). */
  coriolisOnFoot: number;
  /** "Fisica piena": Coriolis al 100% anche a piedi. */
  fullPhysics: boolean;
  /** Intensità delle correnti calde della Linea (0..1, 0 di notte). */
  thermals: number;
}

export type PlayerEvent =
  | { type: 'jump' }
  | { type: 'land'; speed: number; hard: boolean }
  | { type: 'velo'; open: boolean };

export function emptyInput(): PlayerInput {
  return { forward: 0, right: 0, run: false, jumpPressed: false, jumpHeld: false };
}

const _frame: LocalFrame = { up: new Vector3(), east: new Vector3(), north: new Vector3() };
const _cyl: CylCoords = { z: 0, theta: 0, r: 0, h: 0 };
const _a = new Vector3();
const _wish = new Vector3();
const _fwd = new Vector3();
const _right = new Vector3();
const _tan = new Vector3();
const _tmp = new Vector3();
const _tmp2 = new Vector3();
const _n = new Vector3();
const _wind = new Vector3();
const _aero = new Vector3();
const _newPos = new Vector3();
const _cols: Collider[] = [];
const _pa = new Vector3();
const _pb = new Vector3();
const _pc = new Vector3();
const _pd = new Vector3();

export class PlayerController {
  /** Posizione dei piedi (mondo, riferimento rotante). */
  readonly pos = new Vector3();
  /** Velocità (riferimento rotante). */
  readonly vel = new Vector3();
  mode: PlayerMode = 'air';
  grounded = false;
  /** Velo aperto (fisica). */
  veloOpen = false;
  /** Apertura visiva 0..1. */
  veloAmount = 0;
  /** Quota del suolo sotto i piedi e altezza dal suolo. */
  groundH = 0;
  heightAboveGround = 0;
  /** Quota dei piedi (h) e theta correnti. */
  readonly cyl: CylCoords = { z: 0, theta: 0, r: R, h: 0 };
  /** Ultimi dati aerodinamici (debug). */
  readonly glide: GlideDebug = { airspeed: 0, alphaDeg: 0, cl: 0, cd: 0 };
  options: PhysicsOptions = { coriolisOnFoot: PLAYER_TUNABLES.coriolisOnFoot, fullPhysics: false, thermals: 1 };
  tunables: PlayerTunables = { ...PLAYER_TUNABLES };
  velo: VeloTunables = { ...VELO_TUNABLES };
  onEvent: ((e: PlayerEvent) => void) | null = null;
  /** Funzione quota del suolo (sostituibile nei test). */
  groundFn: (z: number, theta: number) => number = terrainGround;

  private airTime = 0;
  private jumpHeldSinceTakeoff = false;
  private pressedInAir = false;

  constructor(private colliders: ColliderWorld | null = null) {}

  /** Teletrasporto a (z, theta) a `height` metri dal suolo (o quota assoluta). */
  teleport(z: number, theta: number, height = 0, absolute = false): void {
    const g = this.groundFn(z, theta);
    const h = absolute ? Math.max(height, g) : g + height;
    cylToWorld(z, theta, h, this.pos);
    this.vel.set(0, 0, 0);
    this.grounded = !absolute && height <= 0.01;
    this.mode = this.grounded ? 'walk' : 'air';
    this.veloOpen = false;
    this.airTime = 0;
    this.updateDerived();
  }

  /** Coriolis effettivo applicato in questo stato. */
  coriolisFactor(): number {
    if (this.mode === 'glide') return this.velo.coriolis;
    return this.options.fullPhysics ? 1 : this.options.coriolisOnFoot;
  }

  step(dt: number, input: PlayerInput, view: ViewBasis): void {
    const T = this.tunables;
    localFrameAt(this.pos, _frame, this.cyl.theta);
    const up = _frame.up;

    // --- Velo: si apre tenendo Spazio in aria (premuto in volo o tenuto dal salto) ---
    if (!this.grounded) {
      this.airTime += dt;
      if (input.jumpPressed) this.pressedInAir = true;
      if (!input.jumpHeld) {
        this.jumpHeldSinceTakeoff = false;
        this.pressedInAir = false;
      }
      const wantOpen =
        input.jumpHeld && (this.pressedInAir || (this.jumpHeldSinceTakeoff && this.airTime > 0.3) || this.veloOpen) && this.heightAboveGround > this.velo.minOpenHeight;
      if (wantOpen !== this.veloOpen && (wantOpen || !input.jumpHeld)) {
        this.veloOpen = wantOpen;
        this.onEvent?.({ type: 'velo', open: wantOpen });
      }
    } else if (this.veloOpen) {
      this.veloOpen = false;
      this.onEvent?.({ type: 'velo', open: false });
    }
    this.mode = this.grounded ? 'walk' : this.veloOpen ? 'glide' : 'air';
    const target = this.veloOpen ? 1 : 0;
    this.veloAmount += Math.sign(target - this.veloAmount) * Math.min(Math.abs(target - this.veloAmount), dt / this.velo.openTime);

    // --- direzione desiderata sul piano tangente ---
    _fwd.copy(view.forward).addScaledVector(up, -view.forward.dot(up));
    if (_fwd.lengthSq() < 1e-6) _fwd.copy(view.up).addScaledVector(up, -view.up.dot(up)).multiplyScalar(-Math.sign(view.forward.dot(up)) || 1);
    _fwd.normalize();
    _right.crossVectors(_fwd, up);
    _wish.set(0, 0, 0).addScaledVector(_fwd, input.forward).addScaledVector(_right, input.right);
    if (_wish.lengthSq() > 1) _wish.normalize();
    _wish.multiplyScalar(input.run ? T.runSpeed : T.walkSpeed);

    const vUp = this.vel.dot(up);
    _tan.copy(this.vel).addScaledVector(up, -vUp);

    if (this.grounded) {
      approach(_tan, _wish, T.groundAccel * dt);
      this.vel.copy(_tan).addScaledVector(up, Math.max(0, vUp));
      if (input.jumpPressed) {
        this.vel.addScaledVector(up, T.jumpSpeed);
        this.grounded = false;
        this.mode = 'air';
        this.airTime = 0;
        this.jumpHeldSinceTakeoff = true;
        this.pressedInAir = false;
        this.onEvent?.({ type: 'jump' });
      }
    } else if (this.mode === 'air' && (input.forward !== 0 || input.right !== 0)) {
      // un po' di controllo in aria
      _tmp.copy(_tan);
      approach(_tmp, _wish, T.airAccel * dt);
      this.vel.add(_tmp.sub(_tan));
    }

    // --- forze: centrifuga + Coriolis (+ aria) ---
    apparentAcceleration(this.pos, this.vel, this.coriolisFactor(), _a);
    if (!this.grounded) {
      const sp = this.vel.length();
      _a.addScaledVector(this.vel, -T.bodyDrag * sp);
      if (this.mode === 'glide') {
        thermalWind(this.pos, this.velo, this.options.thermals, _wind);
        veloAcceleration(this.vel, _wind, view.forward, view.up, up, this.velo, _aero, this.glide);
        _a.add(_aero);
      }
    }
    if (this.grounded) {
      // a terra la reazione del suolo annulla la componente radiale
      _a.addScaledVector(up, -_a.dot(up));
    }
    this.vel.addScaledVector(_a, dt);

    // --- movimento con collisioni ---
    _newPos.copy(this.pos).addScaledVector(this.vel, dt);
    this.moveTo(_newPos, dt);
    this.updateDerived();
  }

  /** Muove verso `target` risolvendo collisori e terreno. */
  private moveTo(target: Vector3, dt: number): void {
    const T = this.tunables;
    const wasGrounded = this.grounded;
    const feetBefore = this.cyl.h;

    // limiti del cilindro
    if (target.z < 1) target.z = 1;
    if (target.z > L - 1) target.z = L - 1;

    let support = this.resolveColliders(target);
    worldToCyl(target, _cyl);
    let gh = Math.max(this.groundFn(_cyl.z, _cyl.theta), support);

    // limite di pendenza e gradini quando si cammina
    if (wasGrounded) {
      const rise = gh - feetBefore;
      const moved = Math.hypot(this.vel.x, this.vel.y, this.vel.z) * dt;
      const maxRise = T.stepHeight + moved * Math.tan((T.slopeLimitDeg * Math.PI) / 180);
      const steep = support < gh - 1e-3 && this.isSteep(_cyl.z, _cyl.theta);
      if (rise > maxRise || (steep && rise > 0.02)) {
        // prova a scivolare lungo la curva di livello, altrimenti fermati
        this.groundNormal(_cyl.z, _cyl.theta, _n);
        upAt(_cyl.theta, _tmp);
        _n.addScaledVector(_tmp, -_n.dot(_tmp)); // verso valle
        if (_n.lengthSq() > 1e-8) {
          _n.normalize();
          const uphill = -this.vel.dot(_n);
          if (uphill > 0) this.vel.addScaledVector(_n, uphill);
        }
        target.copy(this.pos).addScaledVector(this.vel, dt);
        support = this.resolveColliders(target);
        worldToCyl(target, _cyl);
        gh = Math.max(this.groundFn(_cyl.z, _cyl.theta), support);
        if (gh - feetBefore > maxRise || (this.isSteep(_cyl.z, _cyl.theta) && gh - feetBefore > 0.02 && support < gh - 1e-3)) {
          target.copy(this.pos);
          this.vel.set(0, 0, 0);
          worldToCyl(target, _cyl);
          gh = Math.max(this.groundFn(_cyl.z, _cyl.theta), support);
        }
      }
    }

    upAt(_cyl.theta, _tmp);
    const vUp = this.vel.dot(_tmp);
    const snap = wasGrounded && vUp <= 0.5 ? T.groundSnap : 0;
    if (_cyl.h <= gh + snap) {
      const fromCollider = support >= gh - 1e-3 && support > -Infinity;
      const steep = !fromCollider && this.isSteep(_cyl.z, _cyl.theta);
      cylToWorld(_cyl.z, _cyl.theta, gh, target);
      if (steep) {
        // scivola: togli la componente che entra nella superficie
        this.groundNormal(_cyl.z, _cyl.theta, _n);
        const into = this.vel.dot(_n);
        if (into < 0) this.vel.addScaledVector(_n, -into);
        this.grounded = false;
      } else {
        if (!wasGrounded) {
          const speed = Math.max(0, -vUp);
          this.onEvent?.({ type: 'land', speed, hard: speed > T.hardLandingSpeed });
          // l'urto con il suolo assorbe anche parte della velocità tangenziale
          this.vel.addScaledVector(_tmp, -vUp);
        } else if (vUp < 0) {
          this.vel.addScaledVector(_tmp, -vUp);
        }
        this.grounded = true;
        this.airTime = 0;
      }
    } else {
      this.grounded = false;
    }
    this.pos.copy(target);
  }

  /** Normale del suolo (differenze finite sulla funzione quota del controller). */
  groundNormal(z: number, theta: number, out: Vector3 = new Vector3()): Vector3 {
    const st = 0.6;
    const dth = st / METERS_PER_DEG;
    const f = this.groundFn;
    cylToWorld(z - st, theta, f(z - st, theta), _pa);
    cylToWorld(z + st, theta, f(z + st, theta), _pb);
    cylToWorld(z, theta - dth, f(z, theta - dth), _pc);
    cylToWorld(z, theta + dth, f(z, theta + dth), _pd);
    _pb.sub(_pa);
    _pd.sub(_pc);
    return out.crossVectors(_pd, _pb).normalize();
  }

  private isSteep(z: number, theta: number): boolean {
    this.groundNormal(z, theta, _n);
    upAt(theta, _tmp2);
    return _n.dot(_tmp2) < Math.cos((this.tunables.slopeLimitDeg * Math.PI) / 180);
  }

  /**
   * Spinge il corpo fuori dai collisori (sul piano locale) e restituisce la
   * quota h del collisore più alto su cui si può stare (o -Infinity).
   */
  private resolveColliders(p: Vector3): number {
    if (!this.colliders) return -Infinity;
    const T = this.tunables;
    worldToCyl(p, _cyl);
    const feetH = _cyl.h;
    let support = -Infinity;
    this.colliders.query(_cyl.z, _cyl.theta, 12, _cols);
    for (const c of _cols) {
      if (c.kind === 'box') {
        _tmp.subVectors(p, c.center);
        const lx = _tmp.dot(c.right);
        const ly = _tmp.dot(c.up); // piedi rispetto al centro
        const lz = _tmp.dot(c.forward);
        const top = c.half.y - ly; // quanto sta il tetto sopra i piedi
        if (ly + T.height < -c.half.y || top < -0.05) {
          // sopra o sotto la scatola: può solo sostenere
          if (top >= -0.05 && top < 0.2 && Math.abs(lx) < c.half.x + T.radius * 0.6 && Math.abs(lz) < c.half.z + T.radius * 0.6) {
            support = Math.max(support, feetH + top);
          }
          if (top < -0.05 && top > -0.6 && Math.abs(lx) < c.half.x + T.radius * 0.6 && Math.abs(lz) < c.half.z + T.radius * 0.6) {
            support = Math.max(support, feetH + top);
          }
          continue;
        }
        const ex = c.half.x + T.radius;
        const ez = c.half.z + T.radius;
        if (Math.abs(lx) >= ex || Math.abs(lz) >= ez) continue;
        if (top <= T.stepHeight) {
          // gradino: sali sopra
          support = Math.max(support, feetH + top);
          continue;
        }
        // spingi fuori lungo l'asse di minima penetrazione (rettangolo arrotondato)
        const cx = Math.max(-c.half.x, Math.min(c.half.x, lx));
        const cz = Math.max(-c.half.z, Math.min(c.half.z, lz));
        let dx = lx - cx;
        let dz = lz - cz;
        const d = Math.hypot(dx, dz);
        let push: number;
        if (d > 1e-6) {
          if (d >= T.radius) continue;
          push = T.radius - d;
          dx /= d;
          dz /= d;
        } else {
          const px = ex - Math.abs(lx);
          const pz = ez - Math.abs(lz);
          if (px < pz) {
            dx = Math.sign(lx) || 1;
            dz = 0;
            push = px;
          } else {
            dx = 0;
            dz = Math.sign(lz) || 1;
            push = pz;
          }
        }
        _tmp2.copy(c.right).multiplyScalar(dx).addScaledVector(c.forward, dz);
        p.addScaledVector(_tmp2, push);
        const into = this.vel.dot(_tmp2);
        if (into < 0) this.vel.addScaledVector(_tmp2, -into);
      } else {
        _tmp.subVectors(p, c.base);
        const y = _tmp.dot(c.up);
        const top = c.height - y;
        if (y + T.height < 0 || top < -0.05) continue;
        _tmp.addScaledVector(c.up, -y);
        const d = _tmp.length();
        const minD = c.radius + T.radius;
        if (d >= minD) continue;
        if (top <= T.stepHeight) {
          support = Math.max(support, feetH + top);
          continue;
        }
        if (d < 1e-6) _tmp.copy(c.up).cross(new Vector3(0, 0, 1)).normalize();
        else _tmp.multiplyScalar(1 / d);
        p.addScaledVector(_tmp, minD - d);
        const into = this.vel.dot(_tmp);
        if (into < 0) this.vel.addScaledVector(_tmp, -into);
      }
    }
    return support;
  }

  private updateDerived(): void {
    worldToCyl(this.pos, this.cyl);
    this.groundH = this.groundFn(this.cyl.z, this.cyl.theta);
    this.heightAboveGround = this.cyl.h - this.groundH;
  }
}

/** Porta il vettore `v` verso `target` di al massimo `maxDelta`. */
export function approach(v: Vector3, target: Vector3, maxDelta: number): Vector3 {
  _tmp2.subVectors(target, v);
  const d = _tmp2.length();
  if (d <= maxDelta || d < 1e-9) return v.copy(target);
  return v.addScaledVector(_tmp2, maxDelta / d);
}
