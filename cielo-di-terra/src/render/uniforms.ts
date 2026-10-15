/**
 * Uniform condivisi da tutti i materiali del mondo. Un solo oggetto, passato
 * per riferimento a ogni ShaderMaterial: aggiornarlo qui aggiorna tutto.
 */
import { Color, DataTexture, Vector2, Vector3, Vector4 } from 'three';
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
}

export interface HazeSettings {
  /** Densità (1/m): 1 - exp(-d * densità). */
  density: number;
  /** Massima copertura (0..1). */
  max: number;
  /** Forza delle "quinte teatrali" (0..1). */
  layers: number;
  /** Bagliore della Linea nella foschia. */
  lineaGlow: number;
}

export const DEFAULT_HAZE: HazeSettings = { density: 1 / 950, max: 0.8, layers: 0.45, lineaGlow: 0.9 };

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
    uHaze: { value: new Vector4(DEFAULT_HAZE.density, DEFAULT_HAZE.max, DEFAULT_HAZE.layers, DEFAULT_HAZE.lineaGlow) },
    uNight: { value: 0 },
    uLampColor: { value: new Vector3(1.0, 0.72, 0.38) },
    uLamps: { value: Array.from({ length: MAX_LAMPS }, () => new Vector4(0, 0, 0, 0)) },
    uCellTex: { value: null },
    uCellGrid: { value: new Vector4(CELLS_NZ, CELLS_NTHETA, CELL_DZ, CELL_DEG) },
    uPencil: { value: new Vector4(90, 170, 0, REVEAL_DURATION) },
    uPixelAngle: { value: 0.001 },
    uDebugView: { value: 0 },
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
}

/** Colore di sfondo coerente con la foschia (si vede solo in casi limite). */
export function hazeClearColor(s: SkyState, out = new Color()): Color {
  return out.setRGB(s.hazeColor[0], s.hazeColor[1], s.hazeColor[2]);
}
