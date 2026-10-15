/**
 * Toglie il paese segnaposto di Corbella costruito dal motore (src/scene/village.ts e props.ts)
 * SENZA modificare src/: si lavora sugli oggetti che `Game.init()` ha già messo in scena.
 *
 * Che cosa toglie:
 * 1. la mesh `paese-corbella` (rustici, campanile, chiesa e muri a secco segnaposto, una sola mesh);
 * 2. dalla mesh `oggetti-di-scena` i triangoli dei 4 lampioni della piazza (la stessa mesh contiene
 *    anche la Lanterna, il Mozzo Sud e le barche, che restano);
 * 3. i collider del segnaposto nel riquadro di Corbella: tag `rustico`, `campanile`, `chiesa`, `muro`,
 *    `lampione`;
 * 4. i lumi del segnaposto (finestre, campanile, lampioni) nel riquadro di Corbella da `game.lamps`;
 * 5. i castagni del motore (istanze + collider `castagno`) che cadono dentro le impronte del paese vero
 *    (lo fa `liberaCastagni`, chiamata dopo aver costruito).
 *
 * Il riquadro di Corbella è z 860-1260, theta 0-90, quota < 160 m: le frazioni segnaposto delle altre
 * valli e le cascine sparse di Valle 1 (z ≥ 1680) restano intatte.
 */
import { BufferAttribute, BufferGeometry, Vector3, type Mesh, type Object3D } from 'three';
import { worldToCyl } from '../world/cylinder';
import type { Collider } from '../world/colliders';
import type { GiocoCorbella } from './tipi';

export const RIQUADRO_CORBELLA = { zMin: 860, zMax: 1260, thetaMin: 0, thetaMax: 90, hMax: 160 } as const;

const TAG_SEGNAPOSTO = new Set(['rustico', 'campanile', 'chiesa', 'muro', 'lampione']);

export function dentroCorbella(p: Vector3): boolean {
  const c = worldToCyl(p);
  const r = RIQUADRO_CORBELLA;
  return c.z >= r.zMin && c.z <= r.zMax && c.theta >= r.thetaMin && c.theta <= r.thetaMax && c.h <= r.hMax;
}

export interface RisultatoSegnaposto {
  meshTolte: string[];
  triangoliTolti: number;
  colliderTolti: number;
  lumiTolti: number;
}

/** Toglie il segnaposto di Corbella dalla scena, dai collider e dai lumi del motore. */
export function rimuoviSegnaposto(game: GiocoCorbella): RisultatoSegnaposto {
  const out: RisultatoSegnaposto = { meshTolte: [], triangoliTolti: 0, colliderTolti: 0, lumiTolti: 0 };
  const scena = game.scene;

  // 1. il paese segnaposto
  const paese = scena.getObjectByName('paese-corbella') as Mesh | undefined;
  if (paese) {
    paese.parent?.remove(paese);
    paese.geometry?.dispose();
    out.meshTolte.push('paese-corbella');
  }

  // 2. i lampioni della piazza dentro la mesh degli oggetti di scena
  const props = scena.getObjectByName('oggetti-di-scena') as Mesh | undefined;
  if (props?.geometry) out.triangoliTolti = togliTriangoli(props, (p) => dentroCorbella(p));

  // 3. collider
  const daTogliere: number[] = [];
  for (const c of game.world.colliders.all() as IterableIterator<Collider>) {
    if (!c.tag || !TAG_SEGNAPOSTO.has(c.tag)) continue;
    const centro = c.kind === 'box' ? c.center : c.base;
    if (dentroCorbella(centro)) daTogliere.push(c.id);
  }
  for (const id of daTogliere) game.world.colliders.remove(id);
  out.colliderTolti = daTogliere.length;

  // 4. lumi
  out.lumiTolti = filtraLumi(game, (p) => !dentroCorbella(p));
  return out;
}

/** Tiene solo i lumi per cui `tieni` è vero (lavora sulla geometria pubblica di LampGlows). */
export function filtraLumi(game: GiocoCorbella, tieni: (p: Vector3) => boolean): number {
  const geo = game.lamps.points.geometry as BufferGeometry;
  const pos = geo.getAttribute('position') as BufferAttribute | undefined;
  if (!pos) return 0;
  const size = geo.getAttribute('aSize') as BufferAttribute | undefined;
  const lista: Vector3[] = [];
  const dim: number[] = [];
  let tolti = 0;
  for (let i = 0; i < pos.count; i++) {
    const p = new Vector3().fromBufferAttribute(pos, i);
    if (tieni(p)) {
      lista.push(p);
      dim.push(size ? size.getX(i) : 0.6);
    } else tolti++;
  }
  if (tolti) game.lamps.setLamps(lista, dim);
  return tolti;
}

/** Toglie da una mesh non indicizzata i triangoli con il baricentro (mondo) che soddisfa `via`. */
function togliTriangoli(mesh: Mesh, via: (p: Vector3) => boolean): number {
  const g = mesh.geometry as BufferGeometry;
  if (g.index) return 0;
  mesh.updateMatrixWorld(true);
  const pos = g.getAttribute('position') as BufferAttribute;
  const nomi = Object.keys(g.attributes);
  const tri = pos.count / 3;
  const tieni: number[] = [];
  const c = new Vector3();
  const v = new Vector3();
  for (let t = 0; t < tri; t++) {
    c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) c.add(v.fromBufferAttribute(pos, t * 3 + k));
    c.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
    if (!via(c)) tieni.push(t);
  }
  const tolti = tri - tieni.length;
  if (!tolti) return 0;
  const nuova = new BufferGeometry();
  for (const n of nomi) {
    const a = g.getAttribute(n) as BufferAttribute;
    const s = a.itemSize;
    const arr = new Float32Array(tieni.length * 3 * s);
    tieni.forEach((t, i) => arr.set((a.array as Float32Array).subarray(t * 3 * s, (t + 1) * 3 * s), i * 3 * s));
    nuova.setAttribute(n, new BufferAttribute(arr, s));
  }
  nuova.computeBoundingSphere();
  g.dispose();
  mesh.geometry = nuova;
  return tolti;
}

/**
 * Toglie i castagni del motore che cadono dentro le impronte del paese vero.
 * `occupato(p)` riceve la base del tronco (mondo) e dice se lì c'è qualcosa di costruito.
 */
export function liberaCastagni(game: GiocoCorbella, occupato: (p: Vector3) => boolean): number {
  const veg = game.vegetation;
  if (!veg) return 0;
  const via = new Set<number>();
  veg.trees.forEach((t, i) => {
    if (dentroCorbella(t.pos) && occupato(t.pos)) via.add(i);
  });
  if (!via.size) return 0;
  const basi = [...via].map((i) => veg.trees[i]!.pos.clone());
  for (let i = veg.trees.length - 1; i >= 0; i--) if (via.has(i)) veg.trees.splice(i, 1);
  // collider dei tronchi: cilindri `castagno` con la base vicina a una base tolta
  const ids: number[] = [];
  for (const c of game.world.colliders.all() as IterableIterator<Collider>) {
    if (c.kind !== 'cylinder' || c.tag !== 'castagno') continue;
    if (!dentroCorbella(c.base)) continue;
    if (basi.some((b) => b.distanceToSquared(c.base) < 1.2 * 1.2)) ids.push(c.id);
  }
  for (const id of ids) game.world.colliders.remove(id);
  // ridistribuisce le istanze rimaste fra i LOD
  const cam = (game.camera as Object3D | undefined)?.position ?? new Vector3();
  veg.update(cam, true);
  return via.size;
}
