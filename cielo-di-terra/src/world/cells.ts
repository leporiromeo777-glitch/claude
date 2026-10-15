/**
 * Griglia delle "particelle" (celle) sulla superficie (z, theta) e loro stato
 * visivo: BIANCO (mai visto), MATITA (visto, non rilevato), DIPINTO (rilevato).
 *
 * Logica pura (nessuna dipendenza da WebGL): il renderer legge `CellGrid` e la
 * copia in una DataTexture (vedi `render/cellTexture.ts`).
 *
 * id = iz * nTheta + itheta, con iz lungo z (0 = Tappo Sud) e itheta lungo theta
 * (0 = theta 0, crescente verso Mane).
 */
import { CELLS_NTHETA, CELLS_NZ, CELL_DEG, CELL_DZ, DEG, R } from './constants';
import { deltaDeg, surfaceDistance, wrapDeg } from './cylinder';

export const CellState = {
  Blank: 0,
  Pencil: 1,
  Painted: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

export interface CellOrigin {
  z: number;
  theta: number;
}

export interface CellChange {
  ids: number[];
  state: CellState;
  time: number;
  origin: CellOrigin | null;
}

/** Durata standard della rivelazione "l'inchiostro si allarga" (s). */
export const REVEAL_DURATION = 2.2;

export class CellGrid {
  readonly nZ = CELLS_NZ;
  readonly nTheta = CELLS_NTHETA;
  readonly count = CELLS_NZ * CELLS_NTHETA;
  /** Stato corrente per cella. */
  readonly state = new Uint8Array(this.count);
  /** Stato precedente (per l'animazione di transizione). */
  readonly prev = new Uint8Array(this.count);
  /** Istante d'inizio dell'ultima transizione (s, orologio di simulazione). */
  readonly start = new Float32Array(this.count).fill(-1e6);
  /** Origine della transizione (z, theta) e raggio massimo dell'evento (m). */
  readonly originZ = new Float32Array(this.count);
  readonly originTheta = new Float32Array(this.count);
  readonly radius = new Float32Array(this.count);
  /** Celle cambiate dall'ultimo `consumeDirty()`. */
  private dirty = new Set<number>();
  private listeners: ((c: CellChange) => void)[] = [];

  constructor(initial: CellState = CellState.Pencil) {
    this.state.fill(initial);
    this.prev.fill(initial);
  }

  /** Indice di cella che contiene (z, theta). */
  idAt(z: number, theta: number): number {
    const iz = Math.min(this.nZ - 1, Math.max(0, Math.floor(z / CELL_DZ)));
    const it = Math.floor(wrapDeg(theta) / CELL_DEG) % this.nTheta;
    return iz * this.nTheta + it;
  }

  /** Indici (iz, itheta) di una cella. */
  indices(id: number): { iz: number; it: number } {
    return { iz: Math.floor(id / this.nTheta), it: id % this.nTheta };
  }

  /** Centro della cella in (z, theta). */
  center(id: number): CellOrigin {
    const { iz, it } = this.indices(id);
    return { z: (iz + 0.5) * CELL_DZ, theta: (it + 0.5) * CELL_DEG };
  }

  /** Celle il cui centro dista meno di `radius` metri (sul fondo) da (z, theta). */
  cellsInRadius(z: number, theta: number, radius: number): number[] {
    const out: number[] = [];
    const izMin = Math.max(0, Math.floor((z - radius) / CELL_DZ));
    const izMax = Math.min(this.nZ - 1, Math.floor((z + radius) / CELL_DZ));
    const dDeg = radius / (R * DEG) + CELL_DEG;
    const itSpan = Math.min(this.nTheta, Math.ceil(dDeg / CELL_DEG) * 2 + 1);
    const itC = Math.floor(wrapDeg(theta) / CELL_DEG);
    for (let iz = izMin; iz <= izMax; iz++) {
      for (let k = -Math.floor(itSpan / 2); k <= Math.floor(itSpan / 2); k++) {
        const it = (((itC + k) % this.nTheta) + this.nTheta) % this.nTheta;
        const id = iz * this.nTheta + it;
        const c = this.center(id);
        if (surfaceDistance(z, theta, c.z, c.theta) <= radius && !out.includes(id)) out.push(id);
      }
    }
    return out;
  }

  /** Celle con centro dentro l'intervallo angolare [thetaStart, thetaEnd) e z in [zMin, zMax]. */
  cellsInRange(thetaStart: number, thetaEnd: number, zMin = 0, zMax = Infinity): number[] {
    const out: number[] = [];
    for (let id = 0; id < this.count; id++) {
      const c = this.center(id);
      if (c.z < zMin || c.z > zMax) continue;
      const rel = wrapDeg(c.theta - thetaStart);
      if (rel < wrapDeg(thetaEnd - thetaStart) || thetaEnd - thetaStart >= 360) out.push(id);
    }
    return out;
  }

  get(id: number): CellState {
    return this.state[id] as CellState;
  }

  /** Imposta lo stato di una cella senza animazione (o con animazione se `time` è dato). */
  setCellState(id: number, state: CellState, time?: number, origin?: CellOrigin): void {
    this.applyMany([id], state, time ?? -1e6, origin ?? null);
  }

  /** Imposta lo stato di molte celle subito (nessuna animazione). */
  setMany(ids: Iterable<number>, state: CellState): void {
    this.applyMany([...ids], state, -1e6, null);
  }

  /**
   * Rivela (passa a DIPINTO) le celle date con l'animazione "l'inchiostro si
   * allarga" a partire da `origin`, all'istante `time` (orologio di simulazione).
   */
  revealCells(ids: number[], origin: CellOrigin, time: number): void {
    this.applyMany(ids, CellState.Painted, time, origin);
  }

  private applyMany(ids: number[], state: CellState, time: number, origin: CellOrigin | null): void {
    const changed: number[] = [];
    let maxDist = 0;
    if (origin) {
      for (const id of ids) {
        const c = this.center(id);
        // distanza dall'origine allo spigolo più lontano della cella
        const dz = Math.abs(c.z - origin.z) + CELL_DZ * 0.5;
        const ds = Math.abs(deltaDeg(origin.theta, c.theta)) * DEG * R + CELL_DEG * DEG * R * 0.5;
        maxDist = Math.max(maxDist, Math.hypot(dz, ds));
      }
    }
    for (const id of ids) {
      if (id < 0 || id >= this.count) continue;
      if (this.state[id] === state) continue;
      this.prev[id] = this.state[id]!;
      this.state[id] = state;
      this.start[id] = time;
      if (origin) {
        this.originZ[id] = origin.z;
        this.originTheta[id] = wrapDeg(origin.theta);
        this.radius[id] = maxDist;
      } else {
        const c = this.center(id);
        this.originZ[id] = c.z;
        this.originTheta[id] = c.theta;
        this.radius[id] = 0;
      }
      this.dirty.add(id);
      changed.push(id);
    }
    if (changed.length) {
      const ev: CellChange = { ids: changed, state, time, origin };
      for (const l of this.listeners) l(ev);
    }
  }

  /** Avanzamento 0..1 della transizione della cella all'istante `time`. */
  progress(id: number, time: number): number {
    const s = this.start[id]!;
    if (s < 0) return 1;
    return Math.min(1, Math.max(0, (time - s) / REVEAL_DURATION));
  }

  onChange(fn: (c: CellChange) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /** Restituisce e azzera l'insieme delle celle cambiate. */
  consumeDirty(): number[] {
    const d = [...this.dirty];
    this.dirty.clear();
    return d;
  }

  markAllDirty(): void {
    for (let i = 0; i < this.count; i++) this.dirty.add(i);
  }
}
