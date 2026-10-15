/**
 * Il gioco: mette insieme mondo, rendering, giocatore e ciclo principale.
 *
 * Ordine di un fotogramma:
 *   update (60 Hz fissi): input -> giocatore (o camera libera) -> camera rig -> orologio
 *   render: interpolazione dell'occhio (mouse e frecce), uniform del cielo, LOD di terreno e
 *           alberi, lumi vicini; poi il disegno passa dalla post-produzione pittorica
 *           (src/render/post): mondo nel render target HDR, contorni, Velo e sovrapposizioni
 *           della regia nello stesso target, bagliore, filtro di Kuwahara, passata finale.
 *
 * Qualità grafica: `setQualita('automatica' | 'bassa' | 'media' | 'alta')`; le ombre della
 * traccia «luce» la seguono da sé (`applicaOmbre`), il resto si iscrive con `onQualita`.
 */
import {
  ColorManagement,
  Group,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { EventBus } from './core/events';
import { Input } from './core/input';
import { FixedLoop } from './core/loop';
import { loadSettings, type GameSettings } from './core/settings';
import { CameraRig } from './player/cameraRig';
import { PlayerController, emptyInput, type PlayerInput } from './player/controller';
import { PLAYER_TUNABLES } from './player/tunables';
import { CellTexture } from './render/cellTexture';
import { createCollare, ordinaCollare } from './render/collare';
import { FirstPersonVelo } from './render/firstPerson';
import { LampGlows } from './render/lamps';
import { installaLuce, type Luce } from './render/luce';
import { Linea } from './render/linea';
import { TerrainSystem } from './render/terrainMesh';
import { applySky, createWorldUniforms, hazeClearColor, type WorldUniforms } from './render/uniforms';
import { PostProduzione } from './render/post/pipeline';
import { MisuraQualita, PRESET_QUALITA, stimaIniziale, type LivelloQualita, type PresetQualita, type SceltaQualita } from './render/post/qualita';
import { TempoGpu } from './render/post/tempoGpu';
import { createLake, createRiale } from './render/water';
import { Windows } from './render/windows';
import { createWorldMaterial } from './render/worldMaterial';
import { buildProps } from './scene/props';
import { PLACEHOLDER_HAMLETS, buildVillage } from './scene/village';
import { Vegetation } from './scene/vegetation';
import { StatsOverlay } from './ui/stats';
import { DEG, G_EARTH, LAYOUT } from './world/constants';
import { apparentAcceleration, cylToWorld, gravityAtHeight, localFrameAt, localFrameTheta, upAt, worldToCyl, type LocalFrame } from './world/cylinder';
import { WorldClock, keyLightDir, type SkyState } from './world/sky';
import { World, applyDemoCells } from './world/world';

export interface GameOptions {
  /** Pannello statistiche visibile all'avvio. */
  debugOverlay: boolean;
  /** Modalità E2E: rendering deterministico (niente pixel ratio alto, buffer conservato). */
  e2e: boolean;
  /** Ora iniziale. */
  hours?: number;
}

/**
 * Un sistema esterno agganciato al ciclo del gioco (la regia, l'audio, gli oggetti animati...).
 * - `update(dt)`: a ogni passo fisso, dopo il giocatore e prima dell'orologio del cielo;
 * - `render(frameDt)`: a ogni fotogramma, con la camera già al suo posto, prima del disegno del mondo;
 * - `overlay(renderer)`: dopo il mondo e il Velo (oggetti in primo piano, come lo squadro).
 */
export interface SistemaGioco {
  update?(dt: number): void;
  render?(frameDt: number): void;
  overlay?(renderer: WebGLRenderer): void;
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
const _luce = { x: 0, y: 0, z: 0 };

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
  /** Post-produzione pittorica (render target HDR, bagliore, Kuwahara, contorni, toni). */
  readonly post: PostProduzione;
  terrain!: TerrainSystem;
  linea!: Linea;
  windows!: Windows;
  /** Le nubi del Collare (l'ordine dei loro strati segue la quota della camera). */
  collare!: Group;
  vegetation!: Vegetation;
  lamps!: LampGlows;
  fp!: FirstPersonVelo;
  /** Traccia «luce»: ombre morbide vicino alla camera (`luce.ombre.impostaQualita(...)`), vedi render/luce.ts. */
  luce!: Luce;
  cellTexture!: CellTexture;
  materials: Record<string, Material> = {};

  /** Sistemi agganciati al ciclo (vedi `SistemaGioco`), chiamati nell'ordine. */
  readonly sistemi: SistemaGioco[] = [];
  /** Se vero i comandi di movimento sono ignorati (menu, dialoghi, Elvira seduta). */
  movimentoBloccato = false;
  /**
   * Controllo esterno del corpo (scala a pioli, capsula, squadro piantato): se la funzione
   * restituisce true il controller del giocatore salta il passo.
   */
  controlloEsterno: ((dt: number) => boolean) | null = null;
  /** Moltiplicatore del campo visivo (cannocchiale x4 = 0.25). */
  private fovScale = 1;
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
  private sceltaQualita: SceltaQualita = 'automatica';
  private livello: LivelloQualita = 'media';
  private misura: MisuraQualita | null = null;
  private readonly tempoGpu: TempoGpu;
  private readonly ascoltatoriQualita = new Set<(p: PresetQualita) => void>();

  constructor(
    private container: HTMLElement,
    private opts: GameOptions,
  ) {
    ColorManagement.enabled = false;
    this.settings = loadSettings();
    // niente MSAA sul canvas: riceve solo la passata finale (l'antialiasing lo fa la post)
    this.renderer = new WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: opts.e2e });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(opts.e2e ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);
    this.post = new PostProduzione(this.renderer);
    this.tempoGpu = new TempoGpu(this.renderer.getContext() as WebGL2RenderingContext);
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
    this.setQualita('automatica');
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
    this.collare = createCollare(u);
    this.scene.add(this.collare);
    this.scene.add(createLake(u));
    this.scene.add(createRiale(u));

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
    // la vegetazione (alberi, sottobosco) segue la qualità grafica (traccia «natura»)
    this.onQualita((p) => this.vegetation.impostaQualita(p.vegetazione));

    this.lamps = new LampGlows(u);
    this.lamps.setLamps(lampPoints);
    this.scene.add(this.lamps.points);

    // Aggancio della traccia «luce»: il passaggio delle ombre si registra fra i `sistemi`
    // (render prima del disegno del mondo); niente altro cambia nel percorso di rendering.
    this.luce = installaLuce(this);

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
    // le ombre (traccia «luce», se c'è) prendono la qualità scelta
    this.applicaOmbre(this.presetQualita);
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
    this.camera.fov = st.fov * this.fovScale;
    this.uniforms.uPencil.value.x = st.nearPaint[0];
    this.uniforms.uPencil.value.y = st.nearPaint[1];
    this.windows?.setStarSpeed(st.starSpeed);
    this.resize();
  }

  resize(): void {
    const w = Math.max(1, this.container.clientWidth || window.innerWidth);
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    const dpr = this.opts.e2e ? 1 : window.devicePixelRatio || 1;
    const dprCanvas = Math.min(dpr, 2);
    if (this.renderer.getPixelRatio() !== dprCanvas) this.renderer.setPixelRatio(dprCanvas);
    this.renderer.setSize(w, h, false);
    this.post.setSize(w, h, dprCanvas, dpr);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fp?.setAspect(this.settings.fov, w / h);
    // il mondo si disegna alla risoluzione interna della post
    this.uniforms.uPixelAngle.value = (this.camera.fov * DEG) / this.post.interna.y;
  }

  // ------------------------------------------------------------------ qualità grafica

  /**
   * Sceglie la qualità. 'automatica' parte da una stima (nome della scheda) e misura i primi
   * secondi: se il fotogramma è lento scende. In modalità E2E 'automatica' vale sempre 'media'
   * e non misura (deterministica e abbastanza leggera per SwiftShader); `npm run shots` forza
   * 'alta' con `__GAME__.setSetting('qualita', 'alta')`.
   */
  setQualita(scelta: SceltaQualita): void {
    this.sceltaQualita = scelta;
    let livello: LivelloQualita;
    if (scelta === 'automatica') {
      livello = this.opts.e2e ? 'media' : stimaIniziale(this.nomeRenderer());
      this.misura = this.opts.e2e ? null : new MisuraQualita(livello);
    } else {
      livello = scelta;
      this.misura = null;
    }
    this.applicaLivello(livello);
  }

  /** La scelta fatta (anche 'automatica'). */
  get qualita(): SceltaQualita {
    return this.sceltaQualita;
  }

  /** Il livello in uso adesso. */
  get livelloQualita(): LivelloQualita {
    return this.livello;
  }

  /** Il preset in uso adesso (che cosa è acceso). */
  get presetQualita(): PresetQualita {
    return PRESET_QUALITA[this.livello];
  }

  /**
   * Avvisa quando il livello cambia (subito, poi a ogni cambio). È il punto dove collegare ciò
   * che dipende dalla qualità fuori dalla post (l'interfaccia, per la nota «Adesso: Media»).
   * Restituisce la funzione per staccarsi.
   */
  onQualita(fn: (p: PresetQualita) => void): () => void {
    this.ascoltatoriQualita.add(fn);
    fn(this.presetQualita);
    return () => this.ascoltatoriQualita.delete(fn);
  }

  private applicaLivello(l: LivelloQualita): void {
    this.livello = l;
    const p = PRESET_QUALITA[l];
    this.post.setPreset(p);
    this.resize();
    this.applicaOmbre(p);
    for (const fn of this.ascoltatoriQualita) fn(p);
  }

  /**
   * Ciò che la qualità comanda nel mondo della traccia «luce»: le ombre portate (spente a Bassa,
   * 'media' e 'alta' sopra: `PresetQualita.ombre`) e i motivi delle superfici e del prato
   * (`uDettaglio`: economici a Bassa, pieni sopra: `PresetQualita.motivi`). Si richiama a ogni
   * cambio di qualità e alla fine di `init` (prima `luce` non c'è ancora).
   *
   * La mappa d'ombra non è mai null: a ombre spente e di notte `Ombre` lega la mappa vuota di
   * `mappaOmbraVuota()` (uniforms.ts), così lo shader del mondo non perde mai le sue draw.
   */
  private applicaOmbre(p: PresetQualita): void {
    this.uniforms.uDettaglio.value = p.motivi;
    this.luce?.ombre.impostaQualita(p.ombre);
  }

  private nomeRenderer(): string {
    try {
      const gl = this.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    } catch {
      return '';
    }
  }

  /**
   * Misura (ms) del mondo e di ogni passata della post, mediata su `n` fotogrammi, con una
   * lettura di un pixel fra una fase e l'altra per aspettare la scheda. Solo per lo sviluppo:
   * i numeri valgono come confronto relativo (su SwiftShader sono lentissimi).
   */
  misuraPassi(n = 3): Record<string, number> {
    const gl = this.renderer.getContext();
    const px = new Uint8Array(4);
    const sync = (): void => {
      const rt = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      this.renderer.setRenderTarget(rt);
    };
    this.loop.stepFrames(0);
    const tempi: Record<string, number> = {};
    this.post.cronometro = { sync, tempi };
    try {
      for (let i = 0; i < n; i++) this.loop.stepFrames(0);
    } finally {
      this.post.cronometro = null;
    }
    let tot = 0;
    for (const k of Object.keys(tempi)) {
      tempi[k] = +(tempi[k]! / n).toFixed(2);
      tot += tempi[k]!;
    }
    tempi.totale = +tot.toFixed(2);
    return tempi;
  }

  /** Qualità automatica: un campione per fotogramma (tempo GPU se c'è, altrimenti il fotogramma). */
  private misuraQualita(frameDt: number): void {
    const m = this.misura;
    if (!m || m.finita) return;
    let costo = frameDt;
    if (this.tempoGpu.disponibile) {
      const gpu = this.tempoGpu.raccogli();
      if (!gpu.length) return;
      costo = Math.max(...gpu) / 1000;
    }
    const nuovo = m.campione(frameDt, costo);
    if (nuovo) this.applicaLivello(nuovo);
  }

  /** Restringe o allarga il campo visivo (1 = quello delle impostazioni; 0.25 = cannocchiale x4). */
  setFovScale(k: number): void {
    if (Math.abs(k - this.fovScale) < 1e-4) return;
    this.fovScale = k;
    this.camera.fov = this.settings.fov * k;
    this.resize();
  }

  get currentFovScale(): number {
    return this.fovScale;
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
    if (this.movimentoBloccato) return inp;
    // le frecce girano lo sguardo (vedi render): si cammina con WASD
    inp.forward = (i.isDown('KeyW') ? 1 : 0) - (i.isDown('KeyS') ? 1 : 0);
    inp.right = (i.isDown('KeyD') ? 1 : 0) - (i.isDown('KeyA') ? 1 : 0);
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
    } else if (this.controlloEsterno?.(dt)) {
      this.player.vel.set(0, 0, 0);
      this.prevVel.set(0, 0, 0);
      localFrameAt(this.player.pos, _f, this.player.cyl.theta);
      this.rig.update(dt, _f.up, true);
    } else {
      const inp = this.readInput();
      this.prevVel.copy(this.player.vel);
      this.player.options.thermals = this.sky.sunIntensity > 0.5 ? 1 : 0.3;
      this.player.step(dt, inp, { forward: this.rig.forward(_v), up: this.rig.screenUp(_w) });
      this.playerAccel.lerp(_v.subVectors(this.player.vel, this.prevVel).multiplyScalar(1 / dt), 0.2);
      localFrameAt(this.player.pos, _f, this.player.cyl.theta);
      this.rig.update(dt, _f.up, this.player.grounded);
    }

    for (const s of this.sistemi) s.update?.(dt);

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
    // sguardo dal mouse (o dal trascinamento) e dalle frecce a ogni fotogramma (latenza minima)
    const m = this.input.consumeMouse();
    const kb = this.input.lookKeys(frameDt);
    if (m.dx || m.dy || kb.yaw || kb.pitch) {
      const pos = this.freeCamera ? this.freePos : this.player.pos;
      localFrameAt(pos, _f, this.player.cyl.theta);
      const k = this.settings.mouseSensitivity;
      const inv = this.settings.invertY ? -1 : 1;
      // «inverti asse Y» vale per il mouse; ↑ alza sempre lo sguardo
      this.rig.look(m.dx * k + kb.yaw, -m.dy * k * inv + kb.pitch, _f.up);
    }
    this.camera.position.lerpVectors(this.prevEye, this.currEye, alpha);
    this.camera.quaternion.copy(this.rig.quaternion);
    this.camera.updateMatrixWorld();

    applySky(this.uniforms, this.sky);
    this.linea.applySky(this.sky);
    ordinaCollare(this.collare, this.camera.position);
    this.renderer.setClearColor(hazeClearColor(this.sky), 1);

    this.terrain.update(this.camera.position, this.opts.e2e ? 50 : 5);
    this.vegetation.update(this.camera.position);
    this.lamps.updateNearest(this.camera.position);
    this.cellTexture.sync();

    // Velo in primo piano e nappina
    this.updateFirstPerson(frameDt);
    for (const s of this.sistemi) s.render?.(frameDt);

    this.renderer.info.reset();
    const misura = !!this.misura && !this.misura.finita;
    if (misura) this.tempoGpu.inizio();
    // 1. il mondo nel render target HDR della post
    this.post.inizioMondo();
    this.post.fase('mondo', () => this.renderer.render(this.scene, this.camera));
    // 2. contorni dalla profondità del mondo, poi profondità pulita per la prima persona
    this.post.dopoMondo(this.camera);
    // 3. Velo e sovrapposizioni della regia nello stesso target: passano dalla stessa post
    this.post.fase('primo piano', () => {
      if (this.fp.openAmount > 0.01 && !this.freeCamera) {
        this.renderer.clearDepth();
        this.renderer.render(this.fp.scene, this.fp.camera);
      }
      for (const s of this.sistemi) s.overlay?.(this.renderer);
    });
    // 4. bagliore, filtro pittorico, toni: sul canvas
    this.post.fine({ notte: this.sky.night });
    if (misura) this.tempoGpu.fine();
    this.misuraQualita(frameDt);
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
    // luce della Linea nello spazio della camera: la stessa luce principale del mondo (il nucleo che
    // scorre lungo l'asse, radente al mattino e alla sera: `keyLightDir` della traccia «luce»)
    const c = this.camera.position;
    const k = keyLightDir(c.x, c.y, c.z, this.sky, _luce);
    _w.set(k.x, k.y, k.z);
    fp.uniforms.uLightView.value.copy(_w.transformDirection(this.camera.matrixWorldInverse));
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
      `qualità ${this.livello}${this.sceltaQualita === 'automatica' ? ' (automatica)' : ''}  ${this.post.interna.x}×${this.post.interna.y}`,
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
