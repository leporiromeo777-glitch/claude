/**
 * Costanti del mondo: il cilindro del Verbano.
 *
 * Fonte unica: `layout.json` (stesso file letto dai contenuti). Questo modulo
 * lo tipizza e ne ricava le grandezze fisiche. I valori fissati dal progetto
 * (R = 646 m, L = 3000 m, T = 51 s, finestre e valli) sono verificati da
 * `tests/constants.test.ts`: se qualcuno cambia il JSON per sbaglio, i test falliscono.
 *
 * Convenzioni (vedi anche `cylinder.ts`):
 * - asse del cilindro = asse Z del mondo; z da 0 (Tappo Sud) a L (Tappo Nord);
 * - angolo theta in gradi, 0-360, crescente nel verso della rotazione (Mane = est);
 * - quota h = distanza dal fondo verso l'asse, r = R - h.
 */
import layoutJson from './layout.json';

export type StripKind = 'valle' | 'finestra';

export interface StripDef {
  id: string;
  kind: StripKind;
  name: string;
  thetaStart: number;
  thetaEnd: number;
  floorHeight?: number;
  ridgeMin?: number;
  ridgeMax?: number;
  hillAmplitude?: number;
  theme?: string;
}

export interface CapDef {
  id: string;
  name: string;
  theme: string;
  baseZ: number;
  profileExponent: number;
  noiseAmplitude: number;
  hubRadius: number;
  terraceStep?: number;
  terraceTop?: number;
}

export interface IslandDef {
  name: string;
  z: number;
  theta: number;
  radius: number;
  height: number;
}

export interface VillageDef {
  id: string;
  name: string;
  strip: string;
  zStart: number;
  zEnd: number;
  zCenter: number;
  thetaCenter: number;
  radius: number;
  houseCount: number;
  terraceStep: number;
  terraceRadius: number;
  slope: number;
  campanile: { name: string; z: number; theta: number; height: number };
  piazza: { name: string; z: number; theta: number; radius: number };
}

export interface Layout {
  version: number;
  cylinder: { radius: number; length: number; rotationPeriod: number; hullDepth: number };
  strips: StripDef[];
  valleyEdge: { bankWidth: number; ridgeStart: number; ridgePeak: number; edgeHeight: number };
  windows: { ribSpacing: number; ribWidth: number; ribHeight: number; edgeBeamWidth: number; glassThickness: number };
  endCaps: { south: CapDef; north: CapDef };
  lanterna: { name: string; z: number; radius: number; length: number };
  linea: { name: string; zStart: number; zEnd: number; coreRadius: number; haloRadius: number };
  collare: { name: string; height: number; thickness: number; coverage: number; patchSpacing: number; seed: number };
  lake: {
    name: string;
    strip: string;
    zStart: number;
    zEnd: number;
    thetaCenter: number;
    halfWidth: number;
    waterHeight: number;
    depth: number;
    shoreWidth: number;
    islands: IslandDef[];
  };
  riale: { name: string; strip: string; thetaBase: number; amplitude: number; wavelength: number; width: number; depth: number };
  villages: VillageDef[];
  forests: { strip: string; density: number }[];
  cells: { size: number; nZ: number; nTheta: number };
  start: { z: number; theta: number; yaw: number; pitch: number };
  demo: {
    paintedAroundStart: number;
    /** Intervallo di z in cui la Valle 1 è dipinta per tutta la larghezza. */
    paintedValle1Z: [number, number];
    paintedStrips: string[];
    pencilStrips: string[];
    paintedSouthCap: boolean;
    pencilNorthCap: boolean;
    valle3PaintedFraction: number;
  };
}

export const LAYOUT: Layout = layoutJson as unknown as Layout;

/** Raggio interno del cilindro (m). */
export const R = LAYOUT.cylinder.radius;
/** Lunghezza lungo l'asse (m). */
export const L = LAYOUT.cylinder.length;
/** Periodo di rotazione (s). */
export const ROTATION_PERIOD = LAYOUT.cylinder.rotationPeriod;
/** Velocità angolare (rad/s): omega = 2*pi/T. */
export const OMEGA = (2 * Math.PI) / ROTATION_PERIOD;
/** Gravità apparente sul fondo (m/s^2): omega^2 * R, circa 9.805. */
export const G_FLOOR = OMEGA * OMEGA * R;
/** Gravità standard terrestre, per esprimere i valori in "g". */
export const G_EARTH = 9.80665;
/** Velocità tangenziale del fondo nel riferimento inerziale (m/s). */
export const FLOOR_SPEED = OMEGA * R;

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
/** Metri di arco per grado sul fondo (R * pi / 180), circa 11.27 m. */
export const METERS_PER_DEG = R * DEG;

/** Griglia delle particelle (celle) per lo stato matita/colore. */
export const CELL_SIZE = LAYOUT.cells.size;
export const CELLS_NZ = LAYOUT.cells.nZ;
export const CELLS_NTHETA = LAYOUT.cells.nTheta;
export const CELL_DEG = 360 / CELLS_NTHETA;
export const CELL_DZ = L / CELLS_NZ;

/** Quota del Collare (nubi) sopra il fondo. */
export const COLLARE_HEIGHT = LAYOUT.collare.height;
