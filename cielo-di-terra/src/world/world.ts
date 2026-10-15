/**
 * Facciata del mondo per gli altri sistemi e agenti: stato delle particelle
 * (matita/colore), collisori, quote del terreno, layout. Nessuna dipendenza da
 * WebGL: si può usare anche nei test in Node.
 *
 *   world.setCellState(id, CellState.Painted)        // subito, senza animazione
 *   world.revealCells(ids, { z, theta })             // "l'inchiostro si allarga" (~2 s)
 *   world.cellAt(z, theta) -> id
 *   world.colliders.add(boxAt(...))                  // edifici, muri
 */
import { CellGrid, CellState, type CellOrigin } from './cells';
import { ColliderWorld, type Collider } from './colliders';
import { LAYOUT, type Layout } from './constants';
import { surfaceDistance } from './cylinder';
import { hash2 } from './noise';
import { groundHeight, stripAt, surfaceHeight } from './terrain';

export class World {
  readonly cells = new CellGrid(CellState.Pencil);
  readonly colliders = new ColliderWorld();
  readonly layout: Layout = LAYOUT;
  /** Orologio di simulazione (s) usato per le animazioni delle celle. */
  time = 0;

  /** Imposta lo stato di una particella senza animazione. */
  setCellState(cellId: number, state: CellState): void {
    this.cells.setCellState(cellId, state);
  }

  /** Rivela (dipinge) le particelle con l'animazione a partire da `origin`. */
  revealCells(ids: number[], origin: CellOrigin): void {
    this.cells.revealCells(ids, origin, this.time);
  }

  cellAt(z: number, theta: number): number {
    return this.cells.idAt(z, theta);
  }

  cellsInRadius(z: number, theta: number, radius: number): number[] {
    return this.cells.cellsInRadius(z, theta, radius);
  }

  /** Quota analitica del terreno (m verso l'asse). */
  heightAt(z: number, theta: number): number {
    return surfaceHeight(z, theta);
  }

  /** Quota del suolo usata dalla fisica (coerente con la mesh, con i costoloni). */
  groundAt(z: number, theta: number): number {
    return groundHeight(z, theta);
  }

  addCollider(c: Collider): number {
    return this.colliders.add(c);
  }
}

/** Stato iniziale delle particelle per la demo (regole in layout.json -> demo). */
export function applyDemoCells(world: World): void {
  const d = LAYOUT.demo;
  const g = world.cells;
  const start = LAYOUT.start;
  const painted: number[] = [];
  const pencil: number[] = [];
  for (let id = 0; id < g.count; id++) {
    const c = g.center(id);
    const strip = stripAt(c.theta);
    let state: CellState = CellState.Pencil;
    if (strip.kind === 'finestra') state = CellState.Painted;
    if (d.paintedStrips.includes(strip.id)) state = CellState.Painted;
    if (d.pencilStrips.includes(strip.id)) state = CellState.Pencil;
    if (strip.id === 'valle-3') {
      const { iz, it } = g.indices(id);
      if (hash2(Math.floor(iz / 2), Math.floor(it / 2)) < d.valle3PaintedFraction) state = CellState.Painted;
    }
    if (d.paintedSouthCap && c.z < LAYOUT.endCaps.south.baseZ) state = CellState.Painted;
    if (d.pencilNorthCap && c.z > LAYOUT.endCaps.north.baseZ) state = CellState.Pencil;
    if (surfaceDistance(c.z, c.theta, start.z, start.theta) < d.paintedAroundStart) state = CellState.Painted;
    (state === CellState.Painted ? painted : pencil).push(id);
  }
  g.setMany(painted, CellState.Painted);
  g.setMany(pencil, CellState.Pencil);
}
