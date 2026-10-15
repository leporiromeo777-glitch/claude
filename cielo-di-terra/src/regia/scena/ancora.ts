/**
 * Un'«ancora» per costruire piccoli ambienti (la Cripta, la cella campanaria) in coordinate
 * locali comode: `e` metri verso Mane (est), `n` metri verso Lag (nord, +z), `y` metri in su.
 *
 * Gli ambienti sono piccoli (una decina di metri): la curvatura del cilindro si trascura e
 * tutto si posa con la stessa matrice di superficie del motore. I collisori invece si
 * calcolano punto per punto (centro in (z, θ) vero), così restano coerenti con la fisica.
 */
import { Matrix4, Vector3, type BufferGeometry } from 'three';
import { boxAt, cylinderAt, type BoxCollider, type CylinderCollider } from '../../world/colliders';
import { worldToCyl } from '../../world/cylinder';
import { GeomBuilder, PRIMS } from '../../render/geomBuilder';
import { surfaceMatrix } from '../../render/placement';
import type { RGB } from '../../render/palette';

const _t = new Matrix4();
const _s = new Vector3();

export class Ancora {
  readonly matrice: Matrix4;

  constructor(
    readonly z0: number,
    readonly theta0: number,
    readonly h0: number,
    readonly yaw = 0,
  ) {
    this.matrice = surfaceMatrix(z0, theta0, h0, yaw);
  }

  /** Punto mondo da coordinate locali (e verso Mane, n verso Lag, y in su). */
  punto(e: number, n: number, y = 0, out = new Vector3()): Vector3 {
    return out.set(e, y, -n).applyMatrix4(this.matrice);
  }

  /** (z, θ, h) di un punto locale. */
  cyl(e: number, n: number, y = 0): { z: number; theta: number; h: number } {
    const c = worldToCyl(this.punto(e, n, y));
    return { z: c.z, theta: c.theta, h: c.h };
  }

  /** Matrice locale→mondo per una scatola unitaria centrata in (e, n, y) con le dimensioni date. */
  matriceScatola(e: number, n: number, y: number, larg: number, alt: number, prof: number, ruota = 0): Matrix4 {
    const m = this.matrice.clone();
    _t.makeTranslation(e, y, -n);
    m.multiply(_t);
    if (ruota) m.multiply(_t.makeRotationY(-ruota * (Math.PI / 180)));
    m.multiply(_t.makeScale(larg, alt, prof));
    return m;
  }

  /** Aggiunge una scatola al costruttore: base a quota `y`, centro in (e, n); `ruota` in gradi da nord verso est. */
  scatola(b: GeomBuilder, e: number, n: number, y: number, larg: number, alt: number, prof: number, colore: RGB, emissione = 0, ruota = 0): void {
    b.add(PRIMS.box(), this.matriceScatola(e, n, y + alt / 2, larg, alt, prof, ruota), colore, emissione);
  }

  /** Cilindro (base a quota y). */
  cilindro(b: GeomBuilder, e: number, n: number, y: number, raggio: number, alt: number, colore: RGB, emissione = 0, seg = 10): void {
    const m = this.matrice.clone();
    m.multiply(_t.makeTranslation(e, y, -n)).multiply(_t.makeScale(raggio, alt, raggio));
    b.add(PRIMS.cylinder(seg), m, colore, emissione);
  }

  /** Geometria qualsiasi con una trasformazione locale. */
  aggiungi(b: GeomBuilder, g: BufferGeometry, e: number, n: number, y: number, scala: Vector3 | number, colore: RGB, emissione = 0): void {
    const m = this.matrice.clone();
    m.multiply(_t.makeTranslation(e, y, -n));
    m.multiply(_t.makeScale(...(typeof scala === 'number' ? [scala, scala, scala] as const : ([scala.x, scala.y, scala.z] as const))));
    b.add(g, m, colore, emissione);
  }

  /** Collisore a scatola in coordinate locali (larghezza lungo e, profondità lungo n). */
  collisoreScatola(e: number, n: number, y: number, larg: number, alt: number, prof: number, tag: string, ruota = 0): BoxCollider {
    const c = this.cyl(e, n, y);
    return boxAt(c.z, c.theta, c.h, this.yaw + ruota, larg, alt, prof, tag);
  }

  collisoreCilindro(e: number, n: number, y: number, raggio: number, alt: number, tag: string): CylinderCollider {
    const c = this.cyl(e, n, y);
    return cylinderAt(c.z, c.theta, c.h, raggio, alt, tag);
  }

  /** Scala di comodo per `aggiungi`. */
  static scala(x: number, y: number, z: number): Vector3 {
    return _s.set(x, y, z).clone();
  }
}
