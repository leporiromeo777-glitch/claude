/**
 * Oggetti di scena segnaposto: la Lanterna in cima al Sordo, il Mozzo Sud,
 * le barche a vela rossa sul lago e i lampioni della piazza.
 */
import { Matrix4, Mesh, Vector3, type Material } from 'three';
import { DEG, LAYOUT, METERS_PER_DEG } from '../world/constants';
import { cylToWorld } from '../world/cylinder';
import { boxAt, cylinderAt, type ColliderWorld } from '../world/colliders';
import { mulberry32 } from '../world/noise';
import { WATER_HEIGHT, surfaceHeight } from '../world/terrain';
import { GeomBuilder, PRIMS } from '../render/geomBuilder';
import { PALETTE, type RGB } from '../render/palette';
import { surfaceMatrix } from '../render/placement';
import { piazzaLampPositions } from './village';

const _t = new Matrix4();
const _v = new Vector3();

export interface PropsResult {
  mesh: Mesh;
  lamps: Vector3[];
}

export function buildProps(material: Material, colliders: ColliderWorld): PropsResult {
  const b = new GeomBuilder();
  const lamps: Vector3[] = [];
  const lead: RGB = [0.42, 0.43, 0.47];

  // --- la Lanterna: osservatorio murato con lastre di piombo, sull'asse ---
  const lt = LAYOUT.lanterna;
  const rotZ = new Matrix4().makeRotationX(Math.PI / 2); // asse y -> asse z
  _t.makeTranslation(0, 0, lt.z).multiply(rotZ).scale(_v.set(lt.radius, lt.length, lt.radius));
  b.add(PRIMS.cylinder(20), _t.clone(), lead, 0, (lp, c) => {
    // lastre: fasce più chiare e più scure
    const k = 0.9 + 0.12 * Math.sign(Math.sin(Math.atan2(lp.x, lp.z) * 10));
    c[0] = c[0]! * k;
    c[1] = c[1]! * k;
    c[2] = c[2]! * k;
  });
  _t.makeTranslation(0, 0, lt.z + 1).scale(_v.set(lt.radius * 0.82, lt.radius * 0.82, lt.radius * 0.55));
  b.add(PRIMS.blob(2), _t.clone(), [0.5, 0.51, 0.55]);
  // anello e feritoia del telescopio
  _t.makeTranslation(0, 0, lt.z - 0.5).multiply(rotZ).scale(_v.set(lt.radius + 1.5, 2.5, lt.radius + 1.5));
  b.add(PRIMS.cylinder(20), _t.clone(), [0.34, 0.33, 0.35]);
  _t.makeTranslation(0, lt.radius * 0.45, lt.z - lt.radius * 0.5).scale(_v.set(2.2, 8, 1));
  b.add(PRIMS.box(), _t.clone(), PALETTE.windowDark, 1);
  lamps.push(new Vector3(0, lt.radius * 0.45, lt.z - lt.radius * 0.55 - 1));

  // --- il Mozzo Sud: portale chiuso verso il Fuso ---
  const hub = LAYOUT.endCaps.south.hubRadius;
  _t.makeTranslation(0, 0, -2).multiply(rotZ).scale(_v.set(hub + 2, 34, hub + 2));
  b.add(PRIMS.cylinder(16), _t.clone(), [0.55, 0.42, 0.3]);
  _t.makeTranslation(0, 0, 31).multiply(rotZ).scale(_v.set(hub + 4, 2, hub + 4));
  b.add(PRIMS.cylinder(16), _t.clone(), [0.62, 0.48, 0.32]);

  // --- barche a vela rossa sul Verbanetto (segnali di cielo) ---
  const lake = LAYOUT.lake;
  const rnd = mulberry32(31);
  let boats = 0;
  for (let tries = 0; tries < 400 && boats < 7; tries++) {
    const z = lake.zStart + 120 + rnd() * (lake.zEnd - lake.zStart - 240);
    const th = lake.thetaCenter + (rnd() - 0.5) * lake.halfWidth * 1.4;
    if (surfaceHeight(z, th) > WATER_HEIGHT - 4) continue;
    const yaw = rnd() * 360;
    surfaceMatrix(z, th, WATER_HEIGHT - 0.2, yaw, 1, 1, 1, _t);
    const base = _t.clone();
    b.add(PRIMS.box(), base.clone().multiply(new Matrix4().makeTranslation(0, 0.4, 0).scale(_v.set(2.0, 0.9, 6.2))), PALETTE.wood);
    b.add(PRIMS.box(), base.clone().multiply(new Matrix4().makeTranslation(0, 3.2, 0.3).scale(_v.set(0.14, 5.6, 0.14))), PALETTE.chestnut);
    b.add(PRIMS.pyramid(), base.clone().multiply(new Matrix4().makeTranslation(0.08, 1.0, 0.9).scale(_v.set(0.12, 5.6, 3.6))), [0.82, 0.24, 0.16]);
    lamps.push(new Vector3(0, 1.2, -3.2).applyMatrix4(base));
    boats++;
  }

  // --- lampioni della piazza delle Ore ---
  const v = LAYOUT.villages[0]!;
  for (const p of piazzaLampPositions(v)) {
    // risali a (z, theta) dal punto: il lampione sta 3.2 m sopra il suolo
    const z = p.z;
    const th = (Math.atan2(-p.x, -p.y) / DEG + 360) % 360;
    const g = surfaceHeight(z, th);
    surfaceMatrix(z, th, g, 0, 1, 1, 1, _t);
    b.add(PRIMS.cylinder(6), _t.clone().multiply(new Matrix4().scale(_v.set(0.09, 3.0, 0.09))), PALETTE.slateDark);
    b.add(PRIMS.box(), _t.clone().multiply(new Matrix4().makeTranslation(0, 3.2, 0).scale(_v.set(0.4, 0.5, 0.4))), [0.9, 0.75, 0.45], 1);
    lamps.push(cylToWorld(z, th, g + 3.2));
    colliders.add(cylinderAt(z, th, g, 0.12, 3.4, 'lampione'));
  }
  void METERS_PER_DEG;
  void boxAt;

  const mesh = new Mesh(b.build(), material);
  mesh.name = 'oggetti-di-scena';
  mesh.matrixAutoUpdate = false;
  return { mesh, lamps };
}
