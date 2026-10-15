/**
 * Costruttore di geometrie unite: accumula primitive trasformate (scatole,
 * prismi, cilindri, sfere...) con un colore e un'emissione, e produce un'unica
 * BufferGeometry con gli attributi del materiale del mondo (`aColor`).
 * Serve per tenere basso il numero di chiamate di disegno.
 */
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Matrix3,
  Matrix4,
  Vector3,
} from 'three';
import type { RGB } from './palette';

const _v = new Vector3();
const _n = new Vector3();
const _nm = new Matrix3();

const cache = new Map<string, BufferGeometry>();
function prim(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = cache.get(key);
  if (!g) {
    const made = make();
    g = made.index ? made.toNonIndexed() : made;
    cache.set(key, g);
  }
  return g;
}

/** Prisma per tetti a due falde: base 1x1 (x,z in [-0.5,0.5]), colmo alto 1 lungo z, base a y=0. */
function gableGeometry(): BufferGeometry {
  // vertici: A(-x,-z) B(-x,+z) E(+x,-z) F(+x,+z) alla base; C(+z) D(-z) sul colmo
  const A = [-0.5, 0, -0.5];
  const B = [-0.5, 0, 0.5];
  const E = [0.5, 0, -0.5];
  const F = [0.5, 0, 0.5];
  const C = [0, 1, 0.5];
  const D = [0, 1, -0.5];
  // ordine antiorario visto da fuori (normali verso l'esterno)
  const p = [
    ...A, ...B, ...C, ...A, ...C, ...D, // falda ovest
    ...E, ...D, ...C, ...E, ...C, ...F, // falda est
    ...B, ...F, ...C, // timpano nord (+z)
    ...A, ...D, ...E, // timpano sud (-z)
    ...A, ...E, ...F, ...A, ...F, ...B, // sotto
  ];
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
  g.computeVertexNormals();
  return g;
}

export const PRIMS = {
  box: () => prim('box', () => new BoxGeometry(1, 1, 1)),
  gable: () => prim('gable', gableGeometry),
  /** cilindro di raggio 1, alto 1, base a y=0 */
  cylinder: (seg = 8) => prim(`cyl${seg}`, () => new CylinderGeometry(1, 1, 1, seg, 1).translate(0, 0.5, 0)),
  /** tronco di cono: raggio in basso 1, in alto `top` */
  frustum: (top: number, seg = 7) => prim(`fr${top}-${seg}`, () => new CylinderGeometry(top, 1, 1, seg, 1).translate(0, 0.5, 0)),
  /** piramide a base quadrata (cono a 4 lati) alta 1, base a y=0 */
  pyramid: () => prim('pyr', () => new ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0)),
  /** sfera "a massa tonda" (icosaedro) di raggio 1 */
  blob: (detail = 1) => prim(`blob${detail}`, () => new IcosahedronGeometry(1, detail)),
  /** quadrato 1x1 nel piano xy, normale +z */
  quad: () => {
    let g = cache.get('quad');
    if (!g) {
      g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
      g.setAttribute('normal', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
      cache.set('quad', g);
    }
    return g;
  },
};

export class GeomBuilder {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  /**
   * Aggiunge una geometria (non indicizzata) trasformata da `m`.
   * @param shade funzione opzionale che varia il colore per vertice (posizione locale)
   */
  add(g: BufferGeometry, m: Matrix4, color: RGB, emissive = 0, shade?: (local: Vector3, out: number[]) => void): void {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    _nm.getNormalMatrix(m);
    const c = [color[0], color[1], color[2]];
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i);
      if (shade) {
        c[0] = color[0];
        c[1] = color[1];
        c[2] = color[2];
        shade(_v, c);
      }
      _v.applyMatrix4(m);
      _n.fromBufferAttribute(n, i).applyMatrix3(_nm).normalize();
      this.pos.push(_v.x, _v.y, _v.z);
      this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(c[0]!, c[1]!, c[2]!, emissive);
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.col), 4));
    g.computeBoundingSphere();
    return g;
  }
}
