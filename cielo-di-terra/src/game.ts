/**
 * Il gioco: mette insieme mondo, rendering, giocatore e ciclo principale.
 *
 * Ordine di un fotogramma:
 *   update (60 Hz fissi): input -> giocatore (o camera libera) -> camera rig -> orologio
 *   render: interpolazione dell'occhio, uniform del cielo, LOD di terreno e alberi,
 *           lumi vicini, mondo, poi il Velo in primo piano.
 */
import { ColorManagement, LinearSRGBColorSpace, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type Material } from 'three';
import { EventBus } from './core/events';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { loadSettings, type GameSettings } from './core/settings';
import { CameraRig } from './player/cameraRig';
import { PlayerController, emptyInput, type PlayerInput } from './player/controller';
import { PLAYER_TUNABLES } from './player/tunables';
import { CellTexture } from './render/cellTexture';
import { createCollare } from './render/collare';
import { FirstPersonVelo } from './render/firstPerson';
import { LampGlows } from './render/lamps';
import { Linea } from './render/linea';
import { TerrainSystem } from './render/terrainMesh';
import { applySky, createWorldUniforms, hazeClearColor, type WorldUniforms } from './render/uniforms';
import { createLake } from './render/water';
import { Windows } from './render/windows';
import { createWorldMaterial } from './render/worldMaterial';
import { buildProps } from './scene/props';
import { PLACEHOLDER_HAMLETS, buildVillage } from './scene/village';
import { Vegetation } from './scene/vegetation';
import { StatsOverlay } from './ui/stats';
import { DEG, G_EARTH, LAYOUT } from './world/constants';
import { apparentAcceleration, cylToWorld, gravityAtHeight, localFrameAt, localFrameTheta, upAt, worldToCyl, type LocalFrame } from './world/cylinder';
import { WorldClock, type SkyState } from './world/sky';
import { World, applyDemoCells } from './world/world';

export interface GameOptions {
  /** Pannello statistiche visibile all'avvio. */
  debugOverlay: boolean;
  /** Modalità E2E: rendering deterministico (niente pixel ratio alto, buffer conservato). */
  e2e: boolean;
  /** Ora iniziale. */
  hours?: number;
}

export interface PlayerState {
  z: number;
  theta: number;
  h: number;
  r: number;
  groundH: number;
  heightAboveGround: number;
  gravity: number;
  gravityG: number;
  velocity: [number, number, number];
  speed: number;
  grounded: boolean;
  mode: string;
  veloOpen: boolean;
  coriolisFactor: number;
  freeCamera: boolean;
  camera: { z: number; theta: number; h: number };
  hours: number;
}

const _f: LocalFrame = { up: new Vector3(), east: new Vector3(), north: new Vector3() };
const _v = new Vector3();
const _w = new Vector3();

export class Game {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly uniforms: WorldUniforms;
  readonly world = new World();
  readonly bus = new EventBus();
  readonly input = new Input();
  readonly clock: WorldClock;
  readonly settings: GameSettings;
  readonly player: PlayerController;
  readonly rig = new CameraRig();
  readonly loop: FixedLoop;
  readonly stats: StatsOverlay;
  terrain!: TerrainSystem;
  linea!: Linea;
  windows!: Windows;
  vegetation!: Vegetation;
  lamps!: LampGlows;
  fp!: FirstPersonVelo;
  cellTexture!: CellTexture;
  materials: Record<string, Material> = {};

  /** Tempo di simulazione (s). */
  simTime = 0;
  sky: SkyState;
  freeCamera = false;
  readonly freePos = new Vector3();
  private prevEye = new Vector3();
  private currEye = new Vector3();
  private prevVel = new Vector3();
  private playerAccel = new Vector3();
  private lastLit = -1;
  private renderScale = 1;

  constructor(
    private container: HTMLElement,
    private opts: GameOptions,
  ) {
    ColorManagement.enabled = false;
    this.settings = loadSettings();
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: opts.e2e });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(opts.e2e ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);
    this.camera = new PerspectiveCamera(this.settings.fov, 1, 0.3, 6000);
    this.uniforms = createWorldUniforms();
    this.clock = new WorldClock(opts.hours ?? 10.5, this.settings.dayLengthMinutes);
    this.sky = this.clock.state();
    this.player = new PlayerController(this.world.colliders);
    this.player.onEvent = (e) => {
      if (e.type === 'jump') this.bus.emit('player:jump', {});
      else if (e.type === 'land') this.bus.emit('player:land', { speed: e.speed, hard: e.hard });
      else this.bus.emit('velo:toggle', { open: e.open });
    };
    this.world.cells.onChange((c) => this.bus.emit('cells:changed', c));
    this.loop = new FixedLoop({ update: (dt) => this.update(dt), render: (a, fdt) => this.render(a, fdt) });
    this.stats = new StatsOverlay(container, opts.debugOverlay);
  }

  /** Costruisce il mondo. `progress` riceve messaggi per la schermata di caricamento. */
  async init(progress: (msg: string) => Promise<void> | void = () => {}): Promise<void> {
    const u = this.uniforms;
    await progress('particelle');
    applyDemoCells(this.world);
    this.cellTexture = new CellTexture(this.world.cells);
    u.uCellTex.value = this.cellTexture.texture;
    u.uPencil.value.x = this.settings.nearPaint[0];
    u.uPencil.value.y = this.settings.nearPaint[1];

    this.materials.terrain = createWorldMaterial(u, { kind: 'terrain' });
    this.materials.object = createWorldMaterial(u, { kind: 'object' });
    this.materials.crown = createWorldMaterial(u, { kind: 'object', tint: true, brush: 0.8 });
    this.materials.trunk = createWorldMaterial(u, { kind: 'object', brush: 0.6 });

    await progress('terreno');
    this.terrain = new TerrainSystem(this.materials.terrain);
    this.scene.add(this.terrain.group);

    await progress('finestre, Linea, Collare');
    this.windows = new Windows(u);
    this.scene.add(this.windows.group);
    this.windows.setStarSpeed(this.settings.starSpeed);
    this.linea = new Linea(u);
    this.scene.add(this.linea.group);
    this.scene.add(createCollare(u));
    this.scene.add(createLake(u));

    await progress('paesi');
    const lampPoints: Vector3[] = [];
    const corbella = buildVillage(LAYOUT.villages[0]!, this.materials.object, this.world.colliders, { seed: 2120, church: true, walls: true });
    this.scene.add(corbella.mesh);
    lampPoints.push(...corbella.lamps);
    PLACEHOLDER_HAMLETS.forEach((v, i) => {
      const r = buildVillage(v, this.materials.object, this.world.colliders, { seed: 500 + i, church: false, walls: false });
      this.scene.add(r.mesh);
      lampPoints.push(...r.lamps);
    });
    const props = buildProps(this.materials.object, this.world.colliders);
    this.scene.add(props.mesh);
    lampPoints.push(...props.lamps);

    await progress('castagni');
    this.vegetation = new Vegetation(this.materials.crown, this.materials.trunk, this.world.colliders);
    this.scene.add(this.vegetation.group);

    this.lamps = new LampGlows(u);
    this.lamps.setLamps(lampPoints);
    this.scene.add(this.lamps.points);

    this.fp = new FirstPersonVelo(this.settings.fov, 1);

    // partenza: piazza di Corbella
    const s = LAYOUT.start;
    this.player.teleport(s.z, s.theta, 0);
    this.setView(s.yaw, s.pitch);
    this.syncEyeNow();
    this.applySettings();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.input.attach(this.renderer.domElement);
    await progress('pronto');
  }

  start(): void {
    this.loop.start();
  }

  applySettings(): void {
    const st = this.settings;
    this.player.options.fullPhysics = st.fullPhysics;
    this.player.options.coriolisOnFoot = st.coriolisOnFoot;
    this.clock.dayLengthMinutes = st.dayLengthMinutes;
    this.camera.fov = st.fov;
    this.uniforms.uPencil.value.x = st.nearPaint[0];
    this.uniforms.uPencil.value.y = st.nearPaint[1];
    this.windows?.setStarSpeed(st.starSpeed);
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fp?.setAspect(this.camera.fov, w / h);
    const pxH = h * this.renderer.getPixelRatio() * this.renderScale;
    this.uniforms.uPixelAngle.value = (this.camera.fov * DEG) / pxH;
  }

  /** Orienta lo sguardo: yaw 0 = nord (Lag), 90 = est (Mane); pitch in gradi. */
  setView(yawDeg: number, pitchDeg: number): void {
    const pos = this.freeCamera ? this.freePos : this.player.pos;
    localFrameAt(pos, _f, this.player.cyl.theta);
    const yaw = yawDeg * DEG;
    const heading = _f.north.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(_f.east, Math.sin(yaw));
    this.rig.set(_f.up, heading, pitchDeg * DEG);
  }

  /** Posiziona subito l'occhio (niente interpolazione: dopo teletrasporti). */
  syncEyeNow(): void {
    this.computeEye(this.currEye);
    this.prevEye.copy(this.currEye);
    this.camera.position.copy(this.currEye);
    this.camera.quaternion.copy(this.rig.quaternion);
    this.camera.updateMatrixWorld();
  }

  private computeEye(out: Vector3): Vector3 {
    if (this.freeCamera) return out.copy(this.freePos);
    localFrameAt(this.player.pos, _f, this.player.cyl.theta);
    out.copy(this.player.pos).addScaledVector(_f.up, PLAYER_TUNABLES.eyeHeight);
    if (this.settings.headBob && this.player.grounded) {
      const sp = this.player.vel.length();
      out.addScaledVector(_f.up, Math.sin(this.simTime * 9) * 0.03 * Math.min(1, sp / 4));
    }
    return out;
  }

  private readInput(): PlayerInput {
    const i = this.input;
    const inp = emptyInput();
    inp.forward = (i.isDown('KeyW') || i.isDown('ArrowUp') ? 1 : 0) - (i.isDown('KeyS') || i.isDown('ArrowDown') ? 1 : 0);
    inp.right = (i.isDown('KeyD') || i.isDown('ArrowRight') ? 1 : 0) - (i.isDown('KeyA') || i.isDown('ArrowLeft') ? 1 : 0);
    inp.run = i.isDown('ShiftLeft') || i.isDown('ShiftRight');
    inp.jumpPressed = i.consumePressed('Space');
    inp.jumpHeld = i.isDown('Space');
    return inp;
  }

  update(dt: number): void {
    this.simTime += dt;
    this.world.time = this.simTime;
    this.uniforms.uTime.value = this.simTime;
    this.prevEye.copy(this.currEye);

    if (this.input.consumePressed('F3')) this.stats.toggle();
    if (this.input.consumePressed('KeyF') && (import.meta.env.DEV || import.meta.env.VITE_E2E === '1')) this.setFreeCamera(!this.freeCamera);
    if (this.input.consumePressed('KeyE')) {
      const c = this.player.cyl;
      this.bus.emit('player:interact', { z: c.z, theta: c.theta, h: c.h });
    }

    if (this.freeCamera) {
      const i = this.input;
      const speed = i.isDown('ShiftLeft') ? 160 : 35;
      const f = this.rig.forward(_v);
      const r = this.rig.right(_w);
      localFrameAt(this.freePos, _f, 0);
      const fw = (i.isDown('KeyW') ? 1 : 0) - (i.isDown('KeyS') ? 1 : 0);
      const rt = (i.isDown('KeyD') ? 1 : 0) - (i.isDown('KeyA') ? 1 : 0);
      const upd = (i.isDown('Space') ? 1 : 0) - (i.isDown('KeyC') ? 1 : 0);
      this.freePos.addScaledVector(f, fw * speed * dt).addScaledVector(r, rt * speed * dt).addScaledVector(_f.up, upd * speed * dt);
      this.rig.update(dt, _f.up, false);
    } else {
      const inp = this.readInput();
      this.prevVel.copy(this.player.vel);
      this.player.options.thermals = this.sky.sunIntensity > 0.5 ? 1 : 0.3;
      this.player.step(dt, inp, { forward: this.rig.forward(_v), up: this.rig.screenUp(_w) });
      this.playerAccel.lerp(_v.subVectors(this.player.vel, this.prevVel).multiplyScalar(1 / dt), 0.2);
      localFrameAt(this.player.pos, _f, this.player.cyl.theta);
      this.rig.update(dt, _f.up, this.player.grounded);
    }

    this.clock.advance(dt);
    this.sky = this.clock.state(this.sky);
    const lit = this.sky.lineaIgnite;
    if (this.lastLit >= 0) {
      if (lit >= LAYOUT.cylinder.length && this.lastLit < LAYOUT.cylinder.length) this.bus.emit('sky:dawn', { hours: this.sky.hours });
      if (lit <= 0 && this.lastLit > 0) this.bus.emit('sky:dusk', { hours: this.sky.hours });
    }
    this.lastLit = lit;
    this.computeEye(this.currEye);
  }

  render(alpha: number, frameDt: number): void {
    // sguardo dal mouse a ogni fotogramma (latenza minima)
    const m = this.input.consumeMouse();
    if (m.dx || m.dy) {
      const pos = this.freeCamera ? this.freePos : this.player.pos;
      localFrameAt(pos, _f, this.player.cyl.theta);
      const k = this.settings.mouseSensitivity;
      this.rig.look(m.dx * k, -m.dy * k * (this.settings.invertY ? -1 : 1), _f.up);
    }
    this.camera.position.lerpVectors(this.prevEye, this.currEye, alpha);
    this.camera.quaternion.copy(this.rig.quaternion);
    this.camera.updateMatrixWorld();

    applySky(this.uniforms, this.sky);
    this.linea.applySky(this.sky);
    this.renderer.setClearColor(hazeClearColor(this.sky), 1);

    this.terrain.update(this.camera.position, this.opts.e2e ? 50 : 5);
    this.vegetation.update(this.camera.position);
    this.lamps.updateNearest(this.camera.position);
    this.cellTexture.sync();

    // Velo in primo piano e nappina
    this.updateFirstPerson(frameDt);

    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.fp.openAmount > 0.01 && !this.freeCamera) {
      this.renderer.clearDepth();
      this.renderer.render(this.fp.scene, this.fp.camera);
    }
    this.stats.frame(frameDt, () => this.statsLines());
  }

  private updateFirstPerson(dt: number): void {
    const fp = this.fp;
    const pl = this.player;
    // gravità apparente sentita dalla nappina (Coriolis pieno) meno l'accelerazione del corpo
    apparentAcceleration(pl.pos, pl.vel, 1, _v).sub(this.playerAccel);
    const right = this.rig.right(_w);
    const lateral = _v.dot(right);
    const scrUp = this.rig.screenUp(new Vector3());
    const vertical = -_v.dot(scrUp);
    fp.update(Math.min(0.05, dt), pl.veloAmount, lateral, vertical, this.rig.rollError);
    // luce della Linea nello spazio della camera
    localFrameAt(this.camera.position, _f, pl.cyl.theta);
    const a = this.sky.tiltAlpha;
    const b = this.sky.tiltBeta;
    const L = _f.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(_f.east, Math.sin(a) * Math.cos(b)).addScaledVector(_f.north, Math.sin(a) * Math.sin(b));
    fp.uniforms.uLightView.value.copy(L.transformDirection(this.camera.matrixWorldInverse));
    fp.uniforms.uSun.value.set(...this.sky.sunColor);
    fp.uniforms.uSunI.value = this.sky.sunIntensity;
    fp.uniforms.uAmb.value.set(...this.sky.ambientTop);
    fp.uniforms.uNight.value = this.sky.night;
  }

  private statsLines(): string[] {
    const s = this.getPlayerState();
    const r = this.renderer.info.render;
    const t = this.terrain.stats();
    const trees = this.vegetation.counts();
    return [
      `draw ${r.calls}  tri ${(r.triangles / 1000).toFixed(0)}k`,
      `terreno LOD ${t.byLod.join('/')}  alberi ${trees.join('/')}`,
      `z ${s.z.toFixed(0)}  θ ${s.theta.toFixed(1)}°  h ${s.h.toFixed(1)} m`,
      `g ${s.gravityG.toFixed(2)}  v ${s.speed.toFixed(1)} m/s  ${s.mode}${s.freeCamera ? ' (libera)' : ''}`,
      `ora ${s.hours.toFixed(2)}`,
    ];
  }

  setFreeCamera(on: boolean): void {
    if (on === this.freeCamera) return;
    if (on) this.freePos.copy(this.currEye);
    else {
      const c = worldToCyl(this.freePos);
      this.player.teleport(c.z, c.theta, 0);
    }
    this.freeCamera = on;
    this.syncEyeNow();
    this.bus.emit('debug:freecam', { on });
  }

  /** Posa della camera libera in (z, theta, h) con yaw/pitch (gradi). */
  setCameraPose(z: number, theta: number, h: number, yawDeg: number, pitchDeg: number): void {
    this.freeCamera = true;
    cylToWorld(z, theta, h, this.freePos);
    localFrameTheta(theta, _f);
    const yaw = yawDeg * DEG;
    const heading = _f.north.clone().multiplyScalar(Math.cos(yaw)).addScaledVector(_f.east, Math.sin(yaw));
    this.rig.set(_f.up, heading, pitchDeg * DEG);
    this.syncEyeNow();
  }

  getPlayerState(): PlayerState {
    const p = this.player;
    const c = p.cyl;
    const cam = worldToCyl(this.camera.position);
    const g = gravityAtHeight(c.h);
    return {
      z: c.z,
      theta: c.theta,
      h: c.h,
      r: c.r,
      groundH: p.groundH,
      heightAboveGround: p.heightAboveGround,
      gravity: g,
      gravityG: g / G_EARTH,
      velocity: [p.vel.x, p.vel.y, p.vel.z],
      speed: p.vel.length(),
      grounded: p.grounded,
      mode: p.mode,
      veloOpen: p.veloOpen,
      coriolisFactor: p.coriolisFactor(),
      freeCamera: this.freeCamera,
      camera: { z: cam.z, theta: cam.theta, h: cam.h },
      hours: this.sky.hours,
    };
  }

  /** Costruisce subito i LOD del terreno e degli alberi per la camera corrente. */
  ensureLoaded(): void {
    this.terrain.ensureAll(this.camera.position);
    this.vegetation.update(this.camera.position, true);
  }

  upAtPlayer(): Vector3 {
    return upAt(this.player.cyl.theta);
  }
}
