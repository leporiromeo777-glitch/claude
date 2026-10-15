/**
 * Uniform condivisi da tutti i materiali del mondo. Un solo oggetto, passato
 * per riferimento a ogni ShaderMaterial: aggiornarlo qui aggiorna tutto.
 *
 * Uniform della luce (traccia «luce», vedi docs/grafica/luce.md):
 * - `uSole` (vec4): x = z del nucleo della Linea, y = radenza, z = componente laterale, w = forza
 *   della luce principale (moltiplicatore, 1 = normale);
 * - `uHazeSun` (vec3): colore della foschia in controluce verso il nucleo;
 * - `uHazeZenith` (vec3): colore della foschia "allo zenit" (raggi che passano vicino all'asse);
 *   `uHazeColor` resta il colore verso l'orizzonte (raggi radenti al fondo);
 * - `uAria` (vec4): x = densità dell'aria al suolo (1/m), y = scala d'altezza (m), z = frazione di
 *   densità in quota, w = forza della diffusione in avanti (controluce);
 * - `uLuce` (vec4): x = forza delle ombre portate, y = forza dell'occlusione dai vertici,
 *   z = forza della luce trasmessa (fogliame, tessuti), w = saturazione del mondo dipinto;
 * - `uOmbraMatrice`, `uOmbraMappa`, `uOmbra`, `uOmbraCentro`: ombre morbide vicino alla camera
 *   (scritte da `render/ombre.ts`; `uOmbra.x = 0` le spegne nello shader);
 * - `uAcquerello` (vec4): x = quanto colore resta nel non rilevato (0..1), y = forza della matita,
 *   z = velatura di carta, w = granulazione;
 * - `uCellAnim` (float): istante dell'ultima rivelazione animata (lo scrive `installaLuce` da
 *   `CellTexture.ultimaRivelazione`): vicino al giocatore, senza animazioni, lo shader salta le celle;
 * - `uDettaglio` (float): 1 = motivi pieni, 0 = economici (la traccia «post» lo lega alla qualità).
 */
import { Color, DataTexture, DepthFormat, DepthTexture, LessEqualCompare, Matrix4, NearestFilter, UnsignedIntType, Vector2, Vector3, Vector4, type Texture } from 'three';
import { CELLS_NTHETA, CELLS_NZ, CELL_DEG, CELL_DZ, L, R } from '../world/constants';
import { REVEAL_DURATION } from '../world/cells';
import type { SkyState } from '../world/sky';

export const MAX_LAMPS = 8;

export interface WorldUniforms {
  [k: string]: { value: unknown };
  uTime: { value: number };
  uR: { value: number };
  uLen: { value: number };
  uSunColor: { value: Vector3 };
  uSunIntensity: { value: number };
  uTilt: { value: Vector2 };
  uLineaIgnite: { value: number };
  uAmbTop: { value: Vector3 };
  uAmbBottom: { value: Vector3 };
  uHazeColor: { value: Vector3 };
  uLineaGlow: { value: Vector3 };
  uHaze: { value: Vector4 };
  uNight: { value: number };
  uLampColor: { value: Vector3 };
  uLamps: { value: Vector4[] };
  uCellTex: { value: DataTexture | null };
  uCellGrid: { value: Vector4 };
  uPencil: { value: Vector4 };
  uPixelAngle: { value: number };
  uDebugView: { value: number };
  uSole: { value: Vector4 };
  uHazeSun: { value: Vector3 };
  uHazeZenith: { value: Vector3 };
  uGolden: { value: number };
  uAria: { value: Vector4 };
  uLuce: { value: Vector4 };
  uAcquerello: { value: Vector4 };
  uOmbraMatrice: { value: Matrix4 };
  /** Mai null: a ombre spente vale una mappa vuota (vedi `mappaOmbraVuota`). */
  uOmbraMappa: { value: Texture };
  uOmbra: { value: Vector4 };
  uOmbraCentro: { value: Vector4 };
  uCellAnim: { value: number };
  uDettaglio: { value: number };
}

export interface HazeSettings {
  /** Densità (1/m) dell'aria al suolo. */
  density: number;
  /** Massima copertura (0..1). */
  max: number;
  /** Forza delle "quinte teatrali" (0..1). */
  layers: number;
  /** Velo dei raggi che attraversano il cilindro (l'altra metà come un cielo velato), in unità di densità al suolo. */
  velo: number;
}

export const DEFAULT_HAZE: HazeSettings = { density: 1 / 900, max: 0.9, layers: 0.5, velo: 0.12 };

/** Aria del cilindro: densa sul fondo (foschie di valle), più rada verso l'asse. */
export const DEFAULT_ARIA = { scaleHeight: 150, upperFraction: 0.32, forward: 0.8 };

/**
 * Mappa d'ombra "vuota" (1×1, profondità con confronto). Il `sampler2DShadow` dello shader deve
 * avere SEMPRE una texture di profondità con confronto legata: con `null` three.js lega una
 * texture RGBA vuota, WebGL2 rifiuta la draw («Mismatch between texture format and sampler type»)
 * e il mondo sparisce. Serve a ombre spente, di notte e prima del primo passaggio d'ombra.
 */
export function mappaOmbraVuota(): DepthTexture {
  const t = new DepthTexture(1, 1);
  t.format = DepthFormat;
  t.type = UnsignedIntType;
  t.compareFunction = LessEqualCompare;
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.name = 'ombre-vuota';
  // texture autonoma (non di un render target): three.js la alloca al primo uso
  t.needsUpdate = true;
  return t;
}

export function createWorldUniforms(): WorldUniforms {
  return {
    uTime: { value: 0 },
    uR: { value: R },
    uLen: { value: L },
    uSunColor: { value: new Vector3(1, 0.95, 0.85) },
    uSunIntensity: { value: 1 },
    uTilt: { value: new Vector2(0.6, 1.5) },
    uLineaIgnite: { value: L },
    uAmbTop: { value: new Vector3(0.55, 0.65, 0.8) },
    uAmbBottom: { value: new Vector3(0.5, 0.45, 0.35) },
    uHazeColor: { value: new Vector3(0.7, 0.78, 0.86) },
    uLineaGlow: { value: new Vector3(1, 0.9, 0.75) },
    uHaze: { value: new Vector4(DEFAULT_HAZE.density, DEFAULT_HAZE.max, DEFAULT_HAZE.layers, DEFAULT_HAZE.velo) },
    uNight: { value: 0 },
    uLampColor: { value: new Vector3(1.0, 0.7, 0.36) },
    uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new Vector4(0, 0, 0, 0)) },
    uCellTex: { value: null },
    uCellGrid: { value: new Vector4(CELLS_NZ, CELLS_NTHETA, CELL_DZ, CELL_DEG) },
    uPencil: { value: new Vector4(250, 450, 0, REVEAL_DURATION) },
    uPixelAngle: { value: 0.001 },
    uDebugView: { value: 0 },
    uSole: { value: new Vector4(L / 2, 1, 0, 1) },
    uHazeSun: { value: new Vector3(1, 0.94, 0.82) },
    uHazeZenith: { value: new Vector3(0.48, 0.64, 0.85) },
    uGolden: { value: 0 },
    uAria: { value: new Vector4(DEFAULT_HAZE.density, DEFAULT_ARIA.scaleHeight, DEFAULT_ARIA.upperFraction, DEFAULT_ARIA.forward) },
    uLuce: { value: new Vector4(1, 1, 1, 1.06) },
    uAcquerello: { value: new Vector4(0.74, 1, 1, 1) },
    uOmbraMatrice: { value: new Matrix4() },
    uOmbraMappa: { value: mappaOmbraVuota() },
    uOmbra: { value: new Vector4(0, 1 / 1024, 50, 70) },
    uOmbraCentro: { value: new Vector4(0, 0, 0, 0.06) },
    // nessuno lo aggiorna? allora si assume che una rivelazione sia sempre possibile (sicuro)
    uCellAnim: { value: 1e9 },
    uDettaglio: { value: 1 },
  };
}

/** Copia lo stato del cielo negli uniform. */
export function applySky(u: WorldUniforms, s: SkyState): void {
  u.uSunColor.value.set(...s.sunColor);
  u.uSunIntensity.value = s.sunIntensity;
  u.uTilt.value.set(s.tiltAlpha, s.tiltBeta);
  u.uLineaIgnite.value = s.lineaIgnite;
  u.uAmbTop.value.set(...s.ambientTop);
  u.uAmbBottom.value.set(...s.ambientBottom);
  u.uHazeColor.value.set(...s.hazeColor);
  u.uLineaGlow.value.set(...s.lineaGlow);
  u.uNight.value = s.night;
  u.uSole.value.x = s.coreZ;
  u.uSole.value.y = s.coreFlat;
  u.uSole.value.z = s.coreSide;
  u.uHazeSun.value.set(...s.hazeSun);
  u.uHazeZenith.value.set(...s.hazeZenith);
  u.uGolden.value = s.golden;
  u.uAria.value.x = u.uHaze.value.x * s.airDensity;
}

/** Colore di sfondo coerente con la foschia (si vede solo in casi limite). */
export function hazeClearColor(s: SkyState, out = new Color()): Color {
  return out.setRGB(s.hazeColor[0], s.hazeColor[1], s.hazeColor[2]);
}
