/**
 * Ripiani: piattaforme in piano sostenute da muri a secco (terrazze larghe, sagrati, belvederi,
 * basamenti). Il terreno del motore ha gradoni stretti (3,5 m di alzata ogni 4-8 m sul versante):
 * per una terrazza larga si riempie fino alla quota voluta e si chiude il riempimento con i muri di
 * sostegno dove il suolo è più basso. Dove il suolo è più alto, il terreno copre il ripiano.
 *
 * Fisica: un collider a scatola (tag `calpestabile`) con la faccia superiore alla quota del ripiano;
 * il controller del motore ci cammina sopra come su un tetto e si ferma contro i fianchi.
 */
import { BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { creaMuroSecco } from '../../oggetti/src/oggetti/muri';
import { matriceSuperficie } from '../../oggetti/src/cilindro';
import { boxAt } from '../../../src/world/colliders';
import { cylToWorld } from '../../../src/world/cylinder';
import { hex, mix, type RGB } from './cantiere';
import type { Contesto } from './contesto';
import { hash2, rumore2 } from './forme';
import { spostaYaw, suolo, sposta } from './terreno';

export type Superficie = 'erba' | 'lastre' | 'terra' | 'ciottoli' | 'nessuna';

export interface OpzioniRipiano {
  zona: string;
  nome: string;
  z: number;
  theta: number;
  /** direzione del lato «fronte» (bussola) */
  yaw: number;
  /** misura lungo destra-sinistra */
  larghezza: number;
  /** misura lungo avanti-dietro */
  profondita: number;
  /** quota della superficie */
  quota: number;
  superficie?: Superficie;
  /** parapetto sui lati con salto > 1,6 m (altezza in m, 0 = nessuno) */
  parapetto?: number;
  /** lati senza parapetto: 'fronte' | 'retro' | 'destra' | 'sinistra' */
  senzaParapetto?: string[];
  dettaglio?: 'alto' | 'basso';
  luogo?: string;
  /** tag del collider della superficie */
  tag?: string;
  /** collider anche per il riempimento (predefinito sì) */
  collider?: boolean;
  seme?: number;
}

export interface Ripiano {
  /** punto locale (destra, avanti) → (z, theta) */
  locale(destra: number, avanti: number): { z: number; theta: number };
  quota: number;
  /** salto massimo dei muri */
  saltoMax: number;
}

const ERBA: RGB = hex(0x8aa448);
const ERBA2: RGB = hex(0xa4b85a);
const TERRA: RGB = hex(0x9a7e58);
const LASTRA: RGB = hex(0xa59e94);

function coloreSuperficie(s: Superficie, x: number, y: number): RGB {
  switch (s) {
    case 'erba':
      return mix(ERBA, ERBA2, rumore2(x / 2.2, y / 2.2, 9) * 0.8 + hash2(Math.floor(x * 2), Math.floor(y * 2)) * 0.2);
    case 'terra':
      return mix(TERRA, hex(0x7f6748), rumore2(x / 1.5, y / 1.5, 3));
    case 'ciottoli':
      return mix(hex(0xb8ae9c), hex(0x8c857a), hash2(Math.floor(x / 0.3), Math.floor(y / 0.3), 2) * 0.7);
    default: {
      const h = hash2(Math.floor(x / 0.8 + (Math.floor(y / 0.6) % 2) * 0.5), Math.floor(y / 0.6), 4);
      return mix(LASTRA, hex(0x7e776f), h * 0.6);
    }
  }
}

export function costruisciRipiano(ctx: Contesto, o: OpzioniRipiano): Ripiano {
  const yaw = o.yaw;
  const W = o.larghezza;
  const D = o.profondita;
  const H = o.quota;
  const locale = (destra: number, avanti: number) => {
    // destra = avanti ruotato di +90° (bussola)
    const p = spostaYaw(o.z, o.theta, yaw, avanti, H);
    return spostaYaw(p.z, p.theta, yaw + 90, destra, H);
  };
  const cant = ctx.zona(o.zona);
  // superficie: griglia di 1 m alla quota H
  if ((o.superficie ?? 'erba') !== 'nessuna') {
    const nx = Math.max(1, Math.ceil(W / 1.0));
    const ny = Math.max(1, Math.ceil(D / 1.0));
    const pos: number[] = [];
    const col: number[] = [];
    const v = new Vector3();
    const vert = (i: number, j: number) => {
      const x = -W / 2 + (i / nx) * W;
      const y = -D / 2 + (j / ny) * D;
      const p = locale(x, y);
      // dove il terreno è più alto, la superficie sta appena sotto (la copre il terreno)
      cylToWorld(p.z, p.theta, H + 0.03, v);
      pos.push(v.x, v.y, v.z);
      const c = coloreSuperficie(o.superficie ?? 'erba', x, y);
      col.push(c[0], c[1], c[2], 0);
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        vert(i, j);
        vert(i + 1, j);
        vert(i + 1, j + 1);
        vert(i, j);
        vert(i + 1, j + 1);
        vert(i, j + 1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const N = g.getAttribute('normal');
    const P = g.getAttribute('position');
    // orienta verso l'asse
    const Pa = P.array as Float32Array;
    const Na = N.array as Float32Array;
    for (let t = 0; t < Pa.length / 9; t++) {
      const cx = Pa[t * 9]!;
      const cy = Pa[t * 9 + 1]!;
      if (Na[t * 9]! * -cx + Na[t * 9 + 1]! * -cy < 0) {
        for (let k = 0; k < 3; k++) {
          const a = t * 9 + 3 + k;
          const b = t * 9 + 6 + k;
          [Pa[a], Pa[b]] = [Pa[b]!, Pa[a]!];
        }
        for (let k = 0; k < 4; k++) {
          const a = (t * 3 + 1) * 4 + k;
          const b = (t * 3 + 2) * 4 + k;
          [col[a], col[b]] = [col[b]!, col[a]!];
        }
        for (let k = 0; k < 9; k++) Na[t * 9 + k] = -Na[t * 9 + k]!;
      }
    }
    cant.grezzo(new Float32Array(Pa), new Float32Array(Na), new Float32Array(col));
  }

  // muri di sostegno sui quattro lati (coordinate della libreria: X = sinistra, Z = avanti)
  const lati: Array<{ nome: string; a: [number, number]; b: [number, number] }> = [
    { nome: 'fronte', a: [-W / 2, D / 2], b: [W / 2, D / 2] },
    { nome: 'sinistra', a: [W / 2, D / 2], b: [W / 2, -D / 2] },
    { nome: 'retro', a: [W / 2, -D / 2], b: [-W / 2, -D / 2] },
    { nome: 'destra', a: [-W / 2, -D / 2], b: [-W / 2, D / 2] },
  ];
  let saltoMax = 0;
  let piedeMin = H;
  let seme = o.seme ?? Math.floor(o.z * 13 + o.theta * 101);
  for (const lato of lati) {
    const lung = Math.hypot(lato.b[0] - lato.a[0], lato.b[1] - lato.a[1]);
    const n = Math.max(1, Math.ceil(lung / 4.5));
    const dX = (lato.b[0] - lato.a[0]) / lung;
    const dZ = (lato.b[1] - lato.a[1]) / lung;
    // normale verso fuori (destra del verso nella libreria): (-dZ, dX)
    const fX = -dZ;
    const fZ = dX;
    for (let k = 0; k < n; k++) {
      const s0 = (k / n) * lung;
      const s1 = ((k + 1) / n) * lung;
      // suolo fuori dal muro lungo il tratto
      let piede = Infinity;
      for (let q = 0; q <= 4; q++) {
        const s = s0 + ((s1 - s0) * q) / 4;
        const X = lato.a[0] + dX * s + fX * 0.6;
        const Z = lato.a[1] + dZ * s + fZ * 0.6;
        const p = locale(-X, Z);
        piede = Math.min(piede, suolo(p.z, p.theta));
      }
      const salto = H - piede;
      if (salto < 0.35) continue;
      saltoMax = Math.max(saltoMax, salto);
      piedeMin = Math.min(piedeMin, piede);
      const A: [number, number] = [lato.a[0] + dX * s0, lato.a[1] + dZ * s0];
      const B: [number, number] = [lato.a[0] + dX * s1 + dX * 0.02, lato.a[1] + dZ * s1 + dZ * 0.02];
      const muro = creaMuroSecco({
        seme: seme++,
        percorso: [A, B],
        altezza: salto + 0.18,
        spessore: 0.75,
        scarpa: 0.08,
        terrapieno: true,
        pietra: (o.dettaglio ?? 'alto') === 'alto' ? (salto > 4 ? 0.62 : 0.52) : 0.72,
        dettaglio: o.dettaglio ?? 'alto',
        interrata: 0.8,
      });
      cant.oggetto(muro, matriceSuperficie(o.z, o.theta, piede, yaw), { tag: () => 'muro', lumi: false, ...(o.luogo ? { luogo: o.luogo } : {}) });
      muro.dispose();
      // parapetto
      const hp = o.parapetto ?? 0;
      if (hp > 0 && salto > 1.6 && !(o.senzaParapetto ?? []).includes(lato.nome)) {
        const rientro = 0.42;
        const pA: [number, number] = [A[0] - fX * rientro, A[1] - fZ * rientro];
        const pB: [number, number] = [B[0] - fX * rientro, B[1] - fZ * rientro];
        const par = creaMuroSecco({ seme: seme++, percorso: [pA, pB], altezza: hp, spessore: 0.5, scarpa: 0.03, pietra: 0.42, dettaglio: o.dettaglio ?? 'alto', interrata: 0.2 });
        cant.oggetto(par, matriceSuperficie(o.z, o.theta, H, yaw), { tag: () => 'muro', lumi: false, ...(o.luogo ? { luogo: o.luogo } : {}) });
        par.dispose();
      }
    }
  }
  if (o.collider ?? true) {
    const fondo = Math.min(piedeMin, H) - 0.8;
    cant.aggiungiCollider(boxAt(o.z, o.theta, fondo, yaw, W, H - fondo, D), o.tag ?? 'calpestabile', o.luogo);
  }
  ctx.occupa({ nome: o.nome, z: o.z, theta: o.theta, yaw, larghezza: W, profondita: D });
  return { locale, quota: H, saltoMax };
}

/** (z, theta) di un punto a (destra, avanti) da un centro con yaw. */
export function localeDa(z: number, theta: number, yaw: number, destra: number, avanti: number, h = 40): { z: number; theta: number } {
  const p = spostaYaw(z, theta, yaw, avanti, h);
  return spostaYaw(p.z, p.theta, yaw + 90, destra, h);
}

export { sposta };
