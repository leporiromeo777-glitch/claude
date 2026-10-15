/**
 * Banco di prova in Node: un «gioco» finto con scena, collider e lumi come quelli del motore
 * (senza WebGL), più il paese segnaposto vero costruito da src/scene/village.ts.
 */
import { BufferAttribute, BufferGeometry, MeshBasicMaterial, Points, Scene, Vector3 } from 'three';
import { ColliderWorld } from '../../../src/world/colliders';
import { LAYOUT } from '../../../src/world/constants';
import { buildVillage } from '../../../src/scene/village';
import { buildProps } from '../../../src/scene/props';
import type { GiocoCorbella } from '../src/tipi';

export function giocoFinto(conSegnaposto = true): GiocoCorbella & { lumi(): Vector3[] } {
  const scene = new Scene();
  const colliders = new ColliderWorld();
  let lista: Vector3[] = [];
  let dim: number[] = [];
  const points = new Points(new BufferGeometry(), new MeshBasicMaterial());
  const setLamps = (l: Vector3[], s?: number[]) => {
    lista = l.map((p) => p.clone());
    dim = s ?? l.map(() => 0.6);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(lista.flatMap((p) => [p.x, p.y, p.z])), 3));
    g.setAttribute('aSize', new BufferAttribute(new Float32Array(dim), 1));
    points.geometry = g;
  };
  const lamps = {
    points,
    setLamps,
    addLamps: (l: Vector3[], s?: number[]) => setLamps([...lista, ...l], [...dim, ...(s ?? l.map(() => 0.6))]),
  };
  if (conSegnaposto) {
    const mat = new MeshBasicMaterial();
    const v = buildVillage(LAYOUT.villages[0]!, mat, colliders, { seed: 2120, church: true, walls: true });
    scene.add(v.mesh);
    const props = buildProps(mat, colliders);
    scene.add(props.mesh);
    setLamps([...v.lamps, ...props.lamps]);
  }
  let ore = 10;
  return {
    scene,
    world: { colliders },
    lamps,
    clock: {
      get hours() {
        return ore;
      },
      set hours(h: number) {
        ore = h;
      },
    },
    update: () => {},
    lumi: () => lista,
  };
}
