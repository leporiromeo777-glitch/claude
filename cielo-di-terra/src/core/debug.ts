/**
 * API di debug su `window.__GAME__` (attiva in sviluppo e con VITE_E2E=1).
 * Serve agli screenshot automatici e a chi sviluppa: teletrasporto, ora del
 * giorno, camera libera, stato del giocatore, avanzamento a passi.
 *
 * Convenzioni: z in metri (0 = Tappo Sud), theta in gradi (crescente verso Mane),
 * quote in metri verso l'asse; yaw 0 = nord (Lag), 90 = est (Mane).
 */
import { Vector3 } from 'three';
import type { Game, PlayerState } from '../game';
import { CellState, type CellOrigin } from '../world/cells';
import { cylToWorld, localFrameAt, worldToCyl } from '../world/cylinder';
import { DEG } from '../world/constants';
import { isSceltaQualita, type SceltaQualita } from '../render/post/qualita';
import type { GameSettings } from './settings';

/**
 * Impostazioni che `setSetting` accetta: quelle del motore più la qualità grafica
 * (`setSetting('qualita', 'alta')`; in E2E 'automatica' vale 'media' e non misura).
 */
export type ImpostazioniDebug = GameSettings & { qualita: SceltaQualita };

export interface GameDebugApi {
  version: string;
  ready: boolean;
  /** Porta il giocatore a (z, theta) a `height` m dal suolo (o quota assoluta). */
  teleport(z: number, thetaDeg: number, height?: number, absolute?: boolean): PlayerState;
  /** Orienta lo sguardo (gradi). */
  look(yawDeg: number, pitchDeg: number): void;
  /** Guarda verso un punto (z, theta, h). */
  lookAt(z: number, thetaDeg: number, h: number): void;
  setTime(hours: number): void;
  getTime(): number;
  setTimeScale(k: number): void;
  setClockRunning(on: boolean): void;
  /** Imposta l'orologio di simulazione (s): stelle, animazioni, rivelazioni. */
  setSimTime(t: number): void;
  setFreeCamera(on: boolean): void;
  toggleFreeCamera(): boolean;
  /** Camera libera in (z, theta, h) con yaw e pitch. */
  setCamera(z: number, thetaDeg: number, h: number, yawDeg: number, pitchDeg: number): void;
  getPlayerState(): PlayerState;
  /** Avanza di n passi a 60 Hz e disegna. */
  step(n: number): void;
  pause(): void;
  resume(): void;
  /** Ferma/riavvia il ciclo requestAnimationFrame (gli screenshot disegnano solo con step). */
  stopLoop(): void;
  startLoop(): void;
  /** Disegna un fotogramma (post compresa) e restituisce il tempo impiegato (ms). */
  timedRender(): number;
  /** PNG del canvas dopo la post-produzione, come data URL (richiede preserveDrawingBuffer, attivo in E2E). */
  capture(): string;
  /** Millisecondi del mondo e di ogni passata della post (media su n fotogrammi, confronto relativo). */
  misuraPassi(n?: number): Record<string, number>;
  /** Apre il Velo in volo con una velocità iniziale lungo lo sguardo orizzontale (m/s). */
  startGlide(speed?: number): void;
  /** Tiene premuto o rilascia un tasto (codici KeyboardEvent.code). */
  holdKey(code: string, down: boolean): void;
  setCellState(id: number, state: 0 | 1 | 2): void;
  revealCells(ids: number[], origin: CellOrigin): void;
  cellAt(z: number, thetaDeg: number): number;
  cellsInRadius(z: number, thetaDeg: number, radius: number): number[];
  /** Costruisce subito tutti i LOD necessari alla vista corrente. */
  ensureLoaded(): void;
  render(): void;
  getStats(): Record<string, unknown>;
  setSetting<K extends keyof ImpostazioniDebug>(key: K, value: ImpostazioniDebug[K]): void;
  /** Accesso diretto (per strumenti di sviluppo). */
  game: Game;
}

export function installDebugApi(game: Game): GameDebugApi {
  const api: GameDebugApi = {
    version: '1a',
    ready: true,
    teleport(z, thetaDeg, height = 0, absolute = false) {
      if (game.freeCamera) game.freeCamera = false;
      game.player.teleport(z, thetaDeg, height, absolute);
      const yawPitch = currentYawPitch(game);
      game.setView(yawPitch.yaw, yawPitch.pitch);
      game.syncEyeNow();
      return game.getPlayerState();
    },
    look(yawDeg, pitchDeg) {
      game.setView(yawDeg, pitchDeg);
      game.syncEyeNow();
    },
    lookAt(z, thetaDeg, h) {
      const target = cylToWorld(z, thetaDeg, h);
      const eye = game.camera.position.clone();
      const pos = game.freeCamera ? game.freePos : game.player.pos;
      const f = localFrameAt(pos, undefined, game.player.cyl.theta);
      const d = target.sub(eye).normalize();
      const pitch = Math.asin(Math.max(-1, Math.min(1, d.dot(f.up))));
      const yaw = Math.atan2(d.dot(f.east), d.dot(f.north));
      game.setView(yaw / DEG, pitch / DEG);
      game.syncEyeNow();
    },
    setTime(hours) {
      game.clock.setHours(hours);
      game.sky = game.clock.state(game.sky);
    },
    getTime: () => game.clock.hours,
    setTimeScale(k) {
      game.clock.timeScale = k;
    },
    setClockRunning(on) {
      game.clock.running = on;
    },
    setSimTime(t) {
      game.simTime = t;
      game.world.time = t;
      game.uniforms.uTime.value = t;
    },
    setFreeCamera(on) {
      game.setFreeCamera(on);
    },
    toggleFreeCamera() {
      game.setFreeCamera(!game.freeCamera);
      return game.freeCamera;
    },
    setCamera(z, thetaDeg, h, yawDeg, pitchDeg) {
      game.setCameraPose(z, thetaDeg, h, yawDeg, pitchDeg);
    },
    getPlayerState: () => game.getPlayerState(),
    step(n) {
      game.loop.stepFrames(Math.max(0, Math.floor(n)));
    },
    pause() {
      game.loop.paused = true;
    },
    resume() {
      game.loop.paused = false;
    },
    stopLoop() {
      game.loop.stop();
    },
    startLoop() {
      game.loop.start();
    },
    timedRender() {
      const t0 = performance.now();
      game.loop.stepFrames(0);
      game.renderer.getContext().finish();
      return performance.now() - t0;
    },
    capture() {
      return game.renderer.domElement.toDataURL('image/png');
    },
    misuraPassi(n = 3) {
      return game.misuraPassi(n);
    },
    startGlide(speed = 12) {
      const p = game.player;
      const f = localFrameAt(p.pos, undefined, p.cyl.theta);
      const fwd = game.rig.forward(new Vector3());
      fwd.addScaledVector(f.up, -fwd.dot(f.up)).normalize();
      p.vel.copy(fwd).multiplyScalar(speed);
      p.grounded = false;
      p.veloOpen = true;
      p.veloAmount = 1;
      p.mode = 'glide';
      game.input.simulate('Space', true);
      game.input.consumePressed('Space');
    },
    holdKey(code, down) {
      game.input.simulate(code, down);
    },
    setCellState(id, state) {
      game.world.setCellState(id, state as CellState);
    },
    revealCells(ids, origin) {
      game.world.revealCells(ids, origin);
    },
    cellAt: (z, thetaDeg) => game.world.cellAt(z, thetaDeg),
    cellsInRadius: (z, thetaDeg, radius) => game.world.cellsInRadius(z, thetaDeg, radius),
    ensureLoaded() {
      game.ensureLoaded();
    },
    render() {
      game.loop.stepFrames(0);
    },
    getStats() {
      const r = game.renderer.info.render;
      const t = game.terrain.stats();
      return {
        drawCalls: r.calls,
        triangles: r.triangles,
        terrainChunks: t.chunks,
        terrainByLod: t.byLod,
        terrainTriangles: t.triangles,
        trees: game.vegetation.trees.length,
        treesByLod: game.vegetation.counts(),
        colliders: game.world.colliders.size,
        lamps: game.lamps.count,
        fps: game.stats.currentFps,
        renderer: rendererName(game),
        qualita: game.livelloQualita,
        sceltaQualita: game.qualita,
        risoluzioneInterna: [game.post.interna.x, game.post.interna.y],
      };
    },
    setSetting(key, value) {
      if (key === 'qualita') {
        if (!isSceltaQualita(value)) throw new Error(`qualità sconosciuta: ${String(value)}`);
        game.setQualita(value);
        return;
      }
      const k = key as keyof GameSettings;
      (game.settings as unknown as Record<string, unknown>)[k] = value;
      game.applySettings();
    },
    game,
  };
  (window as unknown as { __GAME__: GameDebugApi }).__GAME__ = api;
  return api;
}

function currentYawPitch(game: Game): { yaw: number; pitch: number } {
  const pos = game.player.pos;
  const f = localFrameAt(pos, undefined, worldToCyl(pos).theta);
  const d = game.rig.forward(new Vector3());
  const pitch = Math.asin(Math.max(-1, Math.min(1, d.dot(f.up))));
  const yaw = Math.atan2(d.dot(f.east), d.dot(f.north));
  return { yaw: yaw / DEG, pitch: pitch / DEG };
}

function rendererName(game: Game): string {
  const gl = game.renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
}
