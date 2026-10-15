/**
 * Scena di prova delle superfici (solo sviluppo/E2E: `window.__LUCE__.provaSuperfici(z, theta)`).
 *
 * Un piccolo campionario sul prato, in fila verso est: un rustico (muri in PIETRA, tetto in PIODE,
 * lobbia in LEGNO), una torretta in INTONACO, un castagno (CORTECCIA e FOGLIAME), una tela
 * (TESSUTO) su pali di METALLO, un'aia in TERRA, un cilindro d'OTTONE, un masso di ROCCIA, una
 * zolla d'ERBA, una lastra di VETRO e, per confronto, un blocco senza superficie (NESSUNA).
 * Serve a vedere i motivi e come prendono la luce; mostra anche come si taggano le geometrie.
 */
import { Group, Matrix4, Mesh, type BufferGeometry, type Material } from 'three';
import { METERS_PER_DEG } from '../world/constants';
import { surfaceHeight } from '../world/terrain';
import { GeomBuilder, PRIMS } from './geomBuilder';
import type { GiocoLuce } from './luce';
import type { RGB } from './palette';
import { surfaceMatrix } from './placement';
import { SUPERFICIE, taggaSuperficie, type Superficie } from './superfici';
import { createWorldMaterial } from './worldMaterial';

interface Pezzo {
  tipo: Superficie;
  da: number;
  a: number;
  variante?: number;
  occlusione?: number;
}

class Campionario {
  readonly b = new GeomBuilder();
  readonly pezzi: Pezzo[] = [];
  private m = new Matrix4();
  private l = new Matrix4();

  constructor(
    private z: number,
    private theta: number,
    private yaw: number,
  ) {}

  /** Aggiunge una primitiva in coordinate locali (x verso est della fila, y su, z verso nord). */
  add(g: BufferGeometry, x: number, zz: number, local: Matrix4, color: RGB, tipo: Superficie, opz: { variante?: number; occlusione?: number; emissione?: number } = {}): void {
    const yaw = (this.yaw * Math.PI) / 180;
    const dzz = zz * Math.cos(yaw) - x * Math.sin(yaw);
    const dea = zz * Math.sin(yaw) + x * Math.cos(yaw);
    const z = this.z + dzz;
    const th = this.theta + dea / METERS_PER_DEG;
    const h = surfaceHeight(z, th) - 0.15;
    surfaceMatrix(z, th, h, this.yaw, 1, 1, 1, this.m);
    this.l.multiplyMatrices(this.m, local);
    const da = this.b.vertexCount;
    this.b.add(g, this.l, color, opz.emissione ?? 0);
    this.pezzi.push({ tipo, da, a: this.b.vertexCount, variante: opz.variante, occlusione: opz.occlusione });
  }

  build(): BufferGeometry {
    const g = this.b.build();
    for (const p of this.pezzi) taggaSuperficie(g, p.tipo, { da: p.da, a: p.a, variante: p.variante, occlusione: p.occlusione ?? 0 });
    return g;
  }
}

const T = (x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rz = 0): Matrix4 => {
  const m = new Matrix4().makeTranslation(x, y, z);
  if (ry) m.multiply(new Matrix4().makeRotationY(ry));
  if (rz) m.multiply(new Matrix4().makeRotationZ(rz));
  return m.multiply(new Matrix4().makeScale(sx, sy, sz));
};

export interface ProvaSuperfici {
  gruppo: Group;
  rimuovi(): void;
}

let corrente: ProvaSuperfici | null = null;

export function mostraProvaSuperfici(game: GiocoLuce, z: number, theta: number, yaw = 0): ProvaSuperfici {
  corrente?.rimuovi();
  const c = new Campionario(z, theta, yaw);
  const box = PRIMS.box();
  // 1. rustico: muri in pietra, tetto in piode con sporgenza, lobbia in legno
  const pietra: RGB = [0.64, 0.6, 0.55];
  c.add(box, 0, 0, T(0, 1.6, 0, 4.4, 3.2, 4.0), pietra, SUPERFICIE.PIETRA);
  c.add(box, 0, 0, T(0, 0.35, 0, 4.5, 0.7, 4.1), pietra, SUPERFICIE.PIETRA, { variante: 0.4, occlusione: 0.25 });
  // tetto: due falde come lastre spesse
  const piode: RGB = [0.46, 0.44, 0.42];
  const falda = Math.atan2(1.5, 2.6);
  c.add(box, 0, 0, T(-1.25, 3.95, 0, 3.05, 0.18, 4.9, 0, falda), piode, SUPERFICIE.PIODE);
  c.add(box, 0, 0, T(1.25, 3.95, 0, 3.05, 0.18, 4.9, 0, -falda), piode, SUPERFICIE.PIODE, { variante: 0.5 });
  const legno: RGB = [0.5, 0.37, 0.25];
  c.add(box, 2.6, 0, T(0, 2.3, 0, 0.12, 1.0, 3.6), legno, SUPERFICIE.LEGNO);
  c.add(box, 2.75, 0, T(0, 2.85, 0, 0.1, 0.08, 3.6), legno, SUPERFICIE.LEGNO, { variante: 0.6 });
  c.add(box, 2.5, 0, T(0, 1.75, 0, 0.9, 0.1, 3.6), legno, SUPERFICIE.LEGNO, { variante: 0.7 });
  // 2. torretta intonacata, con lo zoccolo in pietra
  c.add(box, 7.5, 0, T(0, 3.0, 0, 2.2, 6.0, 2.2), [0.93, 0.9, 0.82], SUPERFICIE.INTONACO);
  c.add(box, 7.5, 0, T(0, 6.4, 0, 2.5, 0.5, 2.5), [0.86, 0.72, 0.48], SUPERFICIE.INTONACO, { variante: 0.3 });
  // 3. castagno: tronco e chioma d'autunno
  const tronco: RGB = [0.42, 0.33, 0.26];
  c.add(PRIMS.frustum(0.7, 9), 13, 0, T(0, 0, 0, 0.55, 4.2, 0.55), tronco, SUPERFICIE.CORTECCIA);
  c.add(PRIMS.frustum(0.6, 7), 13, 0, T(0.5, 3.6, 0, 0.3, 2.0, 0.3, 0, -0.5), tronco, SUPERFICIE.CORTECCIA, { variante: 0.3 });
  const chioma: RGB = [0.62, 0.55, 0.22];
  c.add(PRIMS.blob(2), 13, 0, T(0.3, 6.2, 0, 3.2, 2.7, 3.0), chioma, SUPERFICIE.FOGLIAME, { occlusione: 0.1 });
  c.add(PRIMS.blob(2), 13, 0, T(-1.6, 5.2, 0.8, 2.1, 1.8, 2.1), [0.5, 0.56, 0.24], SUPERFICIE.FOGLIAME, { variante: 0.4 });
  c.add(PRIMS.blob(2), 13, 0, T(1.9, 5.0, -0.6, 2.0, 1.7, 2.0), [0.74, 0.46, 0.2], SUPERFICIE.FOGLIAME, { variante: 0.7 });
  // 4. tela tesa fra due pali di ferro
  const ferro: RGB = [0.34, 0.35, 0.38];
  c.add(PRIMS.cylinder(8), 17.5, -1.4, T(0, 0, 0, 0.06, 3.0, 0.06), ferro, SUPERFICIE.METALLO);
  c.add(PRIMS.cylinder(8), 17.5, 1.4, T(0, 0, 0, 0.06, 3.0, 0.06), ferro, SUPERFICIE.METALLO);
  c.add(box, 17.5, 0, T(0, 2.1, 0, 0.03, 1.6, 2.7), [0.82, 0.74, 0.58], SUPERFICIE.TESSUTO);
  // 5. aia in terra battuta
  c.add(box, 22, 0, T(0, 0.12, 0, 3.6, 0.24, 3.6), [0.62, 0.5, 0.34], SUPERFICIE.TERRA);
  // 6. ottone e ferro
  c.add(PRIMS.cylinder(20), 22, 0, T(0.6, 0.24, 0, 0.45, 1.2, 0.45), [0.8, 0.62, 0.3], SUPERFICIE.OTTONE);
  c.add(box, 22, 0, T(-0.9, 0.74, 0.6, 0.9, 1.0, 0.7), ferro, SUPERFICIE.METALLO, { variante: 0.5 });
  // 7. masso di roccia
  c.add(PRIMS.blob(1), 27, 0, T(0, 0.9, 0, 2.2, 1.6, 1.8), [0.6, 0.58, 0.55], SUPERFICIE.ROCCIA);
  // 8. zolla d'erba
  c.add(box, 31, 0, T(0, 0.45, 0, 2.0, 0.9, 2.0), [0.46, 0.56, 0.26], SUPERFICIE.ERBA);
  // 9. lastra di vetro in una cornice di legno
  c.add(box, 34.5, 0, T(0, 1.5, 0, 0.06, 1.8, 1.4), [0.22, 0.26, 0.32], SUPERFICIE.VETRO);
  c.add(box, 34.5, 0, T(0, 1.5, 0, 0.1, 2.0, 1.6), legno, SUPERFICIE.LEGNO, { variante: 0.2 });
  // 10. confronto: lo stesso grigio senza superficie
  c.add(box, 38, 0, T(0, 1.2, 0, 2.0, 2.4, 2.0), pietra, SUPERFICIE.NESSUNA);

  const geo = c.build();
  const mat = (game.materials['object'] as Material | undefined) ?? createWorldMaterial(game.uniforms, { kind: 'object' });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'prova-superfici';
  const gruppo = new Group();
  gruppo.name = 'prova-superfici';
  gruppo.add(mesh);
  game.scene.add(gruppo);
  const out: ProvaSuperfici = {
    gruppo,
    rimuovi() {
      game.scene.remove(gruppo);
      geo.dispose();
      if (corrente === out) corrente = null;
    },
  };
  corrente = out;
  return out;
}
