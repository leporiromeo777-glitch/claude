/**
 * Rettangoli orientati sul suolo (migliorie «porte»): lo spazio davanti a una porta, una scala
 * esterna, il muro di una casa. Servono a non posare annessi, case, muri delle terrazze, orti e
 * alberi davanti alle porte, e a scegliere da che parte mettere porta e scala.
 *
 * Un rettangolo è come un'`Impronta` del contesto: centro (z, θ), `yaw` (bussola) del suo asse
 * «profondità», `larghezza` di traverso. Le distanze sono in metri a 40 m di quota (come le impronte).
 */
import { Vector3 } from 'three';
import { matriceSuperficie } from '../oggetti/cilindro';
import { worldToCyl } from '../world/cylinder';
import { differenza, type PuntoCil } from './terreno';

export interface Rettangolo {
  z: number;
  theta: number;
  /** bussola dell'asse della profondità (gradi) */
  yaw: number;
  larghezza: number;
  profondita: number;
}

const _v = new Vector3();

/**
 * Il rettangolo locale [x0, x1] × [z0, z1] (X, Z della libreria) di un oggetto posato in (z, θ)
 * alla quota h con il davanti a `yaw`, portato sul suolo.
 */
export function rettangoloLocale(z: number, theta: number, h: number, yaw: number, x0: number, x1: number, z0: number, z1: number): Rettangolo {
  _v.set((x0 + x1) / 2, 0, (z0 + z1) / 2).applyMatrix4(matriceSuperficie(z, theta, h, yaw));
  const c = worldToCyl(_v);
  return { z: c.z, theta: c.theta, yaw, larghezza: Math.abs(x1 - x0), profondita: Math.abs(z1 - z0) };
}

/** (z, θ) dentro il rettangolo (allargato di `margine` per parte)? */
export function dentroRettangolo(r: Rettangolo, p: PuntoCil, margine = 0): boolean {
  const d = differenza(r, p, 40);
  const y = (r.yaw * Math.PI) / 180;
  const avanti = d.nord * Math.cos(y) + d.est * Math.sin(y);
  const destra = -d.nord * Math.sin(y) + d.est * Math.cos(y);
  return Math.abs(avanti) <= r.profondita / 2 + margine && Math.abs(destra) <= r.larghezza / 2 + margine;
}

/** Spigoli del rettangolo in metri (nord, est) rispetto a `o`. */
function spigoli(r: Rettangolo, o: PuntoCil, margine: number): Array<[number, number]> {
  const c = differenza(o, r, 40);
  const y = (r.yaw * Math.PI) / 180;
  const f: [number, number] = [Math.cos(y), Math.sin(y)];
  const l: [number, number] = [-Math.sin(y), Math.cos(y)];
  const a = r.profondita / 2 + margine;
  const b = r.larghezza / 2 + margine;
  return [
    [c.nord + f[0] * a + l[0] * b, c.est + f[1] * a + l[1] * b],
    [c.nord + f[0] * a - l[0] * b, c.est + f[1] * a - l[1] * b],
    [c.nord - f[0] * a - l[0] * b, c.est - f[1] * a - l[1] * b],
    [c.nord - f[0] * a + l[0] * b, c.est - f[1] * a + l[1] * b],
  ];
}

/** I due rettangoli si sovrappongono (con `margine` per parte)? Separazione degli assi. */
export function rettangoliSiToccano(a: Rettangolo, b: Rettangolo, margine = 0): boolean {
  const pa = spigoli(a, a, margine);
  const pb = spigoli(b, a, 0);
  for (const r of [a, b]) {
    const y = (r.yaw * Math.PI) / 180;
    for (const asse of [
      [Math.cos(y), Math.sin(y)],
      [-Math.sin(y), Math.cos(y)],
    ] as const) {
      const proj = (pp: Array<[number, number]>) => pp.map(([n, e]) => n * asse[0] + e * asse[1]);
      const qa = proj(pa);
      const qb = proj(pb);
      if (Math.max(...qa) < Math.min(...qb) || Math.max(...qb) < Math.min(...qa)) return false;
    }
  }
  return true;
}

/** Punti di controllo (griglia ogni `passo` m, bordi compresi) di un rettangolo. */
export function puntiRettangolo(r: Rettangolo, passo = 0.35): PuntoCil[] {
  const out: PuntoCil[] = [];
  const nl = Math.max(1, Math.ceil(r.larghezza / passo));
  const np = Math.max(1, Math.ceil(r.profondita / passo));
  const y = (r.yaw * Math.PI) / 180;
  const k = (646 - 40) * (Math.PI / 180);
  for (let i = 0; i <= nl; i++) {
    for (let j = 0; j <= np; j++) {
      const l = -r.larghezza / 2 + (i * r.larghezza) / nl;
      const a = -r.profondita / 2 + (j * r.profondita) / np;
      const nord = a * Math.cos(y) - l * Math.sin(y);
      const est = a * Math.sin(y) + l * Math.cos(y);
      out.push({ z: r.z + nord, theta: r.theta + est / k });
    }
  }
  return out;
}
