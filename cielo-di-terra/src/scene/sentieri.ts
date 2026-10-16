/**
 * Sentieri di terra battuta dipinti sul terreno (traccia «natura», solo grafica).
 *
 * - i tracciati di Corbella (`TRACCIATI` del popolamento): sotto il loro nastro di lastre o di terra
 *   il terreno prende la terra battuta con le spalle consumate, così da lontano si leggono;
 * - qualche sentiero di campagna fra i luoghi dei contenuti (la via del riale lungo il fondovalle,
 *   la salita alle selve di Pian dei Ricci e al Sentiero dei Nastri, la traccia per il Sass Grand),
 *   che tengono insieme il paesaggio come nei bozzetti.
 *
 * Nessun effetto sul gioco: colorano i vertici del terreno (`render/terrainMesh.ts`) e tengono
 * lontani l'erba e i sassi del sottobosco (`scene/sottobosco.ts`).
 */
import { METERS_PER_DEG } from '../world/constants';
import { rialeTheta } from '../world/terrain';
import { TRACCIATI } from '../popolamento/luoghi/sentieriCorbella';

/** Un tratto di sentiero in (z, arco sul fondo = theta · m/grado), con la sua larghezza (m). */
export interface Tratto {
  z0: number;
  a0: number;
  z1: number;
  a1: number;
  larghezza: number;
}

const tratti: Tratto[] = [];

function aggiungi(punti: Array<{ z: number; theta: number }>, larghezza: number): void {
  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i]!;
    const b = punti[i + 1]!;
    tratti.push({ z0: a.z, a0: a.theta * METERS_PER_DEG, z1: b.z, a1: b.theta * METERS_PER_DEG, larghezza });
  }
}

/** Spezzata morbida fra punti di controllo, con un serpeggiare leggero (deterministico). */
function serpeggia(ctrl: Array<[number, number]>, passo = 14, ampiezza = 2.5): Array<{ z: number; theta: number }> {
  const out: Array<{ z: number; theta: number }> = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const [z0, t0] = ctrl[i]!;
    const [z1, t1] = ctrl[i + 1]!;
    const l = Math.hypot(z1 - z0, (t1 - t0) * METERS_PER_DEG);
    const n = Math.max(1, Math.round(l / passo));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      // spostamento laterale (perpendicolare) a onda lunga
      const s = Math.sin((i * 7.1 + t * l) / 23) * ampiezza * Math.sin(Math.PI * t);
      const dz = (z1 - z0) / l;
      const da = ((t1 - t0) * METERS_PER_DEG) / l;
      out.push({ z: z0 + (z1 - z0) * t - da * s, theta: t0 + (t1 - t0) * t + (dz * s) / METERS_PER_DEG });
    }
  }
  const [zl, tl] = ctrl[ctrl.length - 1]!;
  out.push({ z: zl, theta: tl });
  return out;
}

// --- i tracciati di Corbella (lastre, terra battuta): la terra sotto e le spalle
for (const t of Object.values(TRACCIATI)) aggiungi([...t], 2.0);

// --- la via del riale: lungo la sponda a Sera del torrente, fuori dal paese
{
  const sopra: Array<[number, number]> = [];
  const sotto: Array<[number, number]> = [];
  for (let z = 660; z <= 2580; z += 40) {
    const th = rialeTheta(z) - 13 / METERS_PER_DEG;
    if (z < 885) sopra.push([z, th]);
    else if (z > 1225) sotto.push([z, th]);
  }
  aggiungi(serpeggia(sopra, 16, 2), 1.8);
  aggiungi(serpeggia(sotto, 16, 2), 1.8);
}
// --- dal margine delle terrazze (sotto la Grà di Pian) a Pian dei Ricci e al Sentiero dei Nastri
aggiungi(
  serpeggia([
    [860, 14.5],
    [830, 12.0],
    [800, 9.4],
    [760, 10.6],
    [700, 12.0],
    [650, 13.5],
  ]),
  1.6,
);
// --- dai Ronchi al Sass Grand (il belvedere a Mane, sopra il riale)
aggiungi(
  serpeggia([
    [1182, 48.0],
    [1186, 55.0],
    [1178, 61.0],
    [1186, 67.0],
    [1190, 73.5],
  ]),
  1.4,
);

/** Tutti i tratti (sola lettura). */
export const SENTIERI_NATURA: readonly Tratto[] = tratti;

/** Distanza (m) dal punto (z, arco) al tratto, sul fondo. */
export function distanzaTratto(z: number, a: number, t: Tratto): number {
  const dz = t.z1 - t.z0;
  const da = t.a1 - t.a0;
  const l2 = dz * dz + da * da || 1;
  const k = Math.min(1, Math.max(0, ((z - t.z0) * dz + (a - t.a0) * da) / l2));
  return Math.hypot(z - (t.z0 + dz * k), a - (t.a0 + da * k));
}

/** I tratti che passano entro `margine` m dal rettangolo (z, arco). */
export function trattiVicini(zMin: number, zMax: number, aMin: number, aMax: number, margine: number): Tratto[] {
  return tratti.filter((t) => Math.max(t.z0, t.z1) >= zMin - margine && Math.min(t.z0, t.z1) <= zMax + margine && Math.max(t.a0, t.a1) >= aMin - margine && Math.min(t.a0, t.a1) <= aMax + margine);
}

/**
 * Quanto il punto (z, theta) sta sul sentiero (0..1): 1 sul battuto, poi le spalle consumate che
 * sfumano nel prato (2.5 m). `lista` = i tratti vicini (da `trattiVicini`).
 */
export function suSentiero(z: number, theta: number, lista: readonly Tratto[]): number {
  const a = theta * METERS_PER_DEG;
  let best = 0;
  for (const t of lista) {
    const d = distanzaTratto(z, a, t) - t.larghezza / 2;
    if (d < 2.5) best = Math.max(best, 1 - Math.min(1, Math.max(0, d) / 2.5));
  }
  return best;
}
