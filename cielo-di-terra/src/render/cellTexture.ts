/**
 * Copia lo stato delle particelle (`CellGrid`) in una DataTexture RGBA32F
 * letta dallo shader del mondo (larghezza = nTheta, altezza = nZ).
 *
 * Canali per cella:
 *   R = stato precedente + 3 * stato corrente + 9 * ceil(raggio_evento / 10 m)
 *   G = istante d'inizio della transizione (s, orologio di simulazione)
 *   B = z dell'origine della rivelazione (m)
 *   A = theta dell'origine (gradi)
 */
import { DataTexture, FloatType, NearestFilter, RGBAFormat } from 'three';
import type { CellGrid } from '../world/cells';

export class CellTexture {
  readonly texture: DataTexture;
  /** Istante d'inizio (s) della rivelazione animata più recente (-1e9 se nessuna). */
  ultimaRivelazione = -1e9;
  private data: Float32Array;

  constructor(private grid: CellGrid) {
    this.data = new Float32Array(grid.nTheta * grid.nZ * 4);
    this.texture = new DataTexture(this.data, grid.nTheta, grid.nZ, RGBAFormat, FloatType);
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.name = 'celle-matita-colore';
    this.writeAll();
  }

  private write(id: number): void {
    const g = this.grid;
    const o = id * 4; // id = iz * nTheta + it  ->  riga iz, colonna it
    const q = Math.ceil(g.radius[id]! / 10);
    this.data[o] = g.prev[id]! + 3 * g.state[id]! + 9 * q;
    this.data[o + 1] = g.start[id]!;
    if (g.start[id]! > -1e5 && g.start[id]! > this.ultimaRivelazione) this.ultimaRivelazione = g.start[id]!;
    this.data[o + 2] = g.originZ[id]!;
    this.data[o + 3] = g.originTheta[id]!;
  }

  writeAll(): void {
    for (let i = 0; i < this.grid.count; i++) this.write(i);
    this.texture.needsUpdate = true;
  }

  /** Aggiorna le celle cambiate; da chiamare una volta per fotogramma. */
  sync(): void {
    const dirty = this.grid.consumeDirty();
    if (!dirty.length) return;
    for (const id of dirty) this.write(id);
    this.texture.needsUpdate = true;
  }
}
