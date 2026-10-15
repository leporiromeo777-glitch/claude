/**
 * La cella campanaria di San Vigilio (FASE1 M1.15) nel campanile vero del popolamento.
 *
 * Il campanile di `src/popolamento` ha la cella con le bifore, le tre campane e l'altoparlante
 * di Meridiana; il Pilastro 1 (colonnina di bronzo, targa del 2120, chiodo e palina) sta sulla
 * terrazza della cuspide, subito sopra. Si sale dalla porta (la regia dissolve: la scala interna
 * è implicita) e si arriva sulla terrazza; si scende dallo stesso punto.
 *
 * Qui si leggono dal popolamento i punti che la regia usa con i suoi nomi.
 */
import { Vector3 } from 'three';
import type { ManigliaCorbella } from '../../popolamento';
import { METERS_PER_DEG } from '../../world/constants';
import { cylToWorld, deltaDeg, worldToCyl } from '../../world/cylinder';
import { luogo } from '../contenuti';

export interface CellaCampanaria {
  /** targa_p1, altoparlante_cella, scendi_campanile, chiodo_cs_1 (mondo). */
  punti: Record<string, Vector3>;
  /** Dove si arriva salendo (piedi) e dove si esce scendendo. */
  dentro: { z: number; theta: number; h: number; yaw: number };
  fuori: { z: number; theta: number; yaw: number };
  /** Quota del pavimento della terrazza (piedi). */
  quotaPavimento: number;
}

/** Yaw (gradi da nord verso est) per guardare da (z, θ) verso (z2, θ2). */
function yawFra(z: number, theta: number, z2: number, theta2: number): number {
  return (Math.atan2(deltaDeg(theta, theta2) * METERS_PER_DEG, z2 - z) * 180) / Math.PI;
}

export function cellaDaCorbella(c: ManigliaCorbella): CellaCampanaria {
  const pos = (id: string): Vector3 => {
    const p = c.punto(id);
    if (!p) throw new Error(`[regia] il popolamento non ha il punto «${id}»`);
    return p.pos.clone();
  };
  const chiodo = c.chiodo('cs_1') ?? pos('chiodo:1');
  const terrazza = pos('scendi:campanile');
  const porta = pos('apri:porta_campanile');
  const altoparlante = pos('parla:meridiana');
  const t = worldToCyl(terrazza);
  const ch = worldToCyl(chiodo);
  // la targa è sulla colonnina, sotto il chiodo
  const targa = cylToWorld(ch.z, ch.theta, ch.h - 0.55);
  // fuori: un metro oltre il punto della porta, con le spalle al campanile
  const camp = luogo('campanile') ?? { z: ch.z, theta: ch.theta };
  const pc = worldToCyl(porta);
  const dz = pc.z - camp.z;
  const ds = deltaDeg(camp.theta, pc.theta) * METERS_PER_DEG;
  const d = Math.hypot(dz, ds) || 1;
  const fz = pc.z + dz / d;
  const fth = pc.theta + ds / d / METERS_PER_DEG;
  return {
    punti: { targa_p1: targa, altoparlante_cella: altoparlante, scendi_campanile: terrazza, chiodo_cs_1: chiodo },
    dentro: { z: t.z, theta: t.theta, h: t.h, yaw: yawFra(t.z, t.theta, ch.z, ch.theta) },
    fuori: { z: fz, theta: fth, yaw: (Math.atan2(ds, dz) * 180) / Math.PI },
    quotaPavimento: t.h,
  };
}
