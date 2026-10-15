/**
 * SEGNAPOSTO della cella campanaria di San Vigilio (FASE1 M1.15), dentro il campanile
 * segnaposto del motore: una stanzetta con le bifore aperte sui quattro lati, le tre campane,
 * l'altoparlante arrugginito di Meridiana e il Pilastro 1 con la targa d'ottone.
 *
 * Il collisore pieno del campanile del motore viene sostituito da quattro muri, così dentro
 * c'è posto; si entra e si esce dalla porta (la regia teletrasporta: la scala è implicita).
 */
import { Mesh, Vector3, type Material } from 'three';
import { GeomBuilder } from '../../render/geomBuilder';
import type { RGB } from '../../render/palette';
import type { ColliderWorld } from '../../world/colliders';
import { surfaceHeight } from '../../world/terrain';
import { Ancora } from './ancora';
import { LAYOUT_CAMPANILE, yawVerso } from './segnaposto';

const CALCE: RGB = [0.9, 0.87, 0.8];
const LEGNO: RGB = [0.42, 0.3, 0.2];
const BRONZO: RGB = [0.62, 0.45, 0.24];
const OTTONE: RGB = [0.86, 0.7, 0.34];

export interface CellaCampanaria {
  mesh: Mesh;
  punti: Record<string, Vector3>;
  /** Dove si arriva salendo (piedi) e dove si esce scendendo. */
  dentro: { z: number; theta: number; h: number; yaw: number };
  fuori: { z: number; theta: number; yaw: number };
  quotaPavimento: number;
}

export function costruisciCella(materiale: Material, colliders: ColliderWorld): CellaCampanaria {
  const c = LAYOUT_CAMPANILE;
  const base = surfaceHeight(c.z, c.theta) - 0.8;
  const yaw = yawVerso(c.z, c.theta, 1046, 37);
  const A = new Ancora(c.z, c.theta, base, yaw);
  const b = new GeomBuilder();
  const lato = 5.6;
  const mezzo = lato / 2;
  const sp = 0.35;
  const y0 = c.height - 4.4; // pavimento della cella
  const yFin0 = c.height - 4.7; // davanzale delle bifore (motore: centro a altezza − 3,4, alte 2,6)
  const yFin1 = c.height - 2.1;
  const yTetto = c.height - 0.6;

  // pavimento e soffitto
  A.scatola(b, 0, 0, y0 - 0.25, lato - 2 * sp, 0.25, lato - 2 * sp, LEGNO);
  A.scatola(b, 0, 0, yTetto, lato - 2 * sp, 0.25, lato - 2 * sp, [0.38, 0.3, 0.24]);
  // quattro pareti con due bifore ciascuna (aperture larghe 1,25 centrate a ±1,2)
  const pezzi: [number, number][] = [
    [-mezzo + sp, -1.825],
    [-0.575, 0.575],
    [1.825, mezzo - sp],
  ];
  for (let f = 0; f < 4; f++) {
    const ruota = f * 90;
    const lungo = (u: number, v: number): [number, number] => {
      const r = (ruota * Math.PI) / 180;
      // u lungo la parete, v verso l'esterno (v = mezzo − sp/2)
      return [u * Math.cos(r) + v * Math.sin(r), -u * Math.sin(r) + v * Math.cos(r)];
    };
    const v = mezzo - sp / 2 - 0.03;
    for (const [u0, u1] of pezzi) {
      const [e, n] = lungo((u0 + u1) / 2, v);
      A.scatola(b, e, n, y0, u1 - u0, yTetto - y0 + 0.2, sp, CALCE, 0, ruota + 0);
    }
    const [e, n] = lungo(0, v);
    A.scatola(b, e, n, y0 - 0.2, lato - 2 * sp, yFin0 - y0 + 0.2, sp, CALCE, 0, ruota);
    A.scatola(b, e, n, yFin1, lato - 2 * sp, yTetto - yFin1 + 0.2, sp, CALCE, 0, ruota);
  }
  // le tre campane appese al ceppo
  A.scatola(b, 0, 0, yTetto - 0.5, lato - 2 * sp, 0.25, 0.3, LEGNO);
  for (const [e, r] of [
    [-1.4, 0.38],
    [0.0, 0.62],
    [1.35, 0.32],
  ] as const) {
    A.cilindro(b, e, 0, yTetto - 0.6 - r * 1.6, r, r * 1.5, BRONZO, 0, 12);
  }
  // l'altoparlante del 2121 legato al ceppo della grande
  A.scatola(b, 0.55, 0.25, yTetto - 1.05, 0.42, 0.36, 0.3, [0.42, 0.3, 0.22]);
  A.scatola(b, 0.55, 0.42, yTetto - 1.0, 0.3, 0.26, 0.04, [0.18, 0.16, 0.15]);
  // il Pilastro 1 (bronzo) con la targa d'ottone, davanti alla bifora verso la piazza
  A.scatola(b, 0, 1.75, y0, 0.45, 1.1, 0.45, BRONZO);
  A.scatola(b, 0, 1.52, y0 + 0.55, 0.36, 0.26, 0.03, OTTONE, 0.1);

  const mesh = new Mesh(b.build(), materiale);
  mesh.name = 'cella-campanaria-segnaposto';

  // collisori: via il blocco pieno del motore, dentro i muri e il pavimento
  for (const col of [...colliders.all()]) if (col.tag === 'campanile') colliders.remove(col.id);
  for (let f = 0; f < 4; f++) {
    const r = (f * 90 * Math.PI) / 180;
    const v = mezzo - sp / 2;
    colliders.add(A.collisoreScatola(v * Math.sin(r), v * Math.cos(r), 0, lato, c.height + 3, sp, 'campanile', f * 90));
  }
  colliders.add(A.collisoreScatola(0, 0, 0, lato - 2 * sp, y0, lato - 2 * sp, 'campanile'));
  colliders.add(A.collisoreScatola(0, 1.75, y0, 0.45, 1.1, 0.45, 'pilastro'));

  const dentro = A.cyl(-0.6, -0.9, y0);
  const fuori = A.cyl(0, mezzo + 2.4, 0);
  return {
    mesh,
    punti: {
      targa_p1: A.punto(0, 1.5, y0 + 0.68),
      altoparlante_cella: A.punto(0.55, 0.3, yTetto - 0.9),
      scendi_campanile: A.punto(-1.6, -1.6, y0 + 0.6),
      chiodo_cs_1: A.punto(0, 1.75, y0 + 1.12),
    },
    dentro: { ...dentro, yaw },
    fuori: { z: fuori.z, theta: fuori.theta, yaw: yaw + 180 },
    quotaPavimento: base + y0,
  };
}
