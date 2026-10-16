/**
 * Paesi segnaposto (Corbella e due frazioni): rustici in gneiss con tetti in
 * piode, il campanile bianco di San Vigilio con la palina bianca e rossa del
 * Pilastro 1, la chiesa, i muri a secco sui gradoni. Tutto con collisori.
 *
 * Forme semplici e pulite nello stile del gioco: un altro agente le sostituirà
 * o arricchirà. Tutta la geometria di un paese è unita in una sola mesh.
 */
import { Matrix4, Mesh, Vector3, type Material } from 'three';
import { DEG, METERS_PER_DEG, type VillageDef } from '../world/constants';
import { cylToWorld, deltaDeg, surfaceDistance, worldToCyl } from '../world/cylinder';
import { boxAt, type Collider, type ColliderWorld } from '../world/colliders';
import { Simplex3, mulberry32 } from '../world/noise';
import { createMasks, slopeAt, surfaceHeight } from '../world/terrain';
import { GeomBuilder, PRIMS } from '../render/geomBuilder';
import { PALETTE, type RGB } from '../render/palette';
import { surfaceMatrix } from '../render/placement';

export interface HouseSite {
  z: number;
  theta: number;
  baseH: number;
  yaw: number;
  width: number;
  depth: number;
  wallH: number;
}

export interface VillageResult {
  mesh: Mesh;
  colliders: Collider[];
  /** Punti luce (finestre accese, lanterne) per i bagliori e l'illuminazione notturna. */
  lamps: Vector3[];
  houses: HouseSite[];
  /** Posizione del campanile (se c'è). */
  campanile: Vector3 | null;
}

const _m = new Matrix4();
const _t = new Matrix4();
const _v = new Vector3();

function vary(c: RGB, rnd: () => number, k = 0.08): RGB {
  const f = 1 + (rnd() - 0.5) * k;
  return [c[0] * f, c[1] * f, c[2] * (f + (rnd() - 0.5) * k * 0.5)];
}

/** Quota minima e massima del suolo sotto un'impronta rettangolare. */
function footprintHeights(z: number, theta: number, yawDeg: number, w: number, d: number): { min: number; max: number } {
  const yaw = yawDeg * DEG;
  let min = Infinity;
  let max = -Infinity;
  for (const [sx, sz] of [
    [-0.5, -0.5],
    [0.5, -0.5],
    [0.5, 0.5],
    [-0.5, 0.5],
    [0, 0],
  ] as const) {
    // offset locale: forward (nord ruotato) e right (est ruotato)
    const fwd = sz * d;
    const rgt = sx * w;
    const dzz = fwd * Math.cos(yaw) - rgt * Math.sin(yaw);
    const dea = fwd * Math.sin(yaw) + rgt * Math.cos(yaw);
    const h = surfaceHeight(z + dzz, theta + dea / METERS_PER_DEG);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  return { min, max };
}

/** Direzione di valle (yaw in gradi: 0 = nord, 90 = est). */
function downhillYaw(z: number, theta: number): number {
  const e = 2;
  const dTh = e / METERS_PER_DEG;
  const gz = (surfaceHeight(z + e, theta) - surfaceHeight(z - e, theta)) / (2 * e);
  const ga = (surfaceHeight(z, theta + dTh) - surfaceHeight(z, theta - dTh)) / (2 * e);
  return (Math.atan2(-ga, -gz) * 180) / Math.PI;
}

/** Aggiunge un rustico al builder. */
function addHouse(b: GeomBuilder, s: HouseSite, rnd: () => number, lamps: Vector3[], stone: RGB): number {
  const totalH = s.wallH;
  // corpo in gneiss
  surfaceMatrix(s.z, s.theta, s.baseH, s.yaw, 1, 1, 1, _m);
  _t.makeTranslation(0, totalH / 2, 0).scale(_v.set(s.width, totalH, s.depth));
  b.add(PRIMS.box(), _m.clone().multiply(_t), stone, 0, (lp, c) => {
    // fasce di pietra più scure in basso e una leggera variazione per corso
    const k = lp.y < -0.35 ? 0.88 : 1;
    const course = Math.sin(lp.y * 23 + lp.x * 3) * 0.025;
    c[0] = c[0]! * (k + course);
    c[1] = c[1]! * (k + course);
    c[2] = c[2]! * (k + course);
  });
  // tetto in piode: prisma con sporto
  const pitch = 33 * DEG;
  const roofH = (s.width / 2 + 0.5) * Math.tan(pitch);
  _t.makeTranslation(0, totalH - 0.05, 0).scale(_v.set(s.width + 1.0, roofH, s.depth + 1.0));
  b.add(PRIMS.gable(), _m.clone().multiply(_t), vary(PALETTE.slate, rnd, 0.12));
  // comignolo
  if (rnd() < 0.65) {
    const cz = (rnd() - 0.5) * s.depth * 0.5;
    _t.makeTranslation(s.width * 0.18, totalH + roofH * 0.55, cz).scale(_v.set(0.75, roofH * 0.9 + 0.6, 0.75));
    b.add(PRIMS.box(), _m.clone().multiply(_t), vary(PALETTE.gneissDark, rnd));
  }
  // finestre sui lati lunghi (alcune accese di notte) e porta verso valle
  let lit = 0;
  for (const side of [-1, 1]) {
    const n = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++) {
      const fz = (n === 1 ? 0 : (k - 0.5) * s.depth * 0.45) + (rnd() - 0.5) * 0.6;
      for (const fy of [1.8, totalH - 1.6]) {
        if (fy > totalH - 0.8 || (fy < 2 && rnd() < 0.3)) continue;
        const on = rnd() < 0.55 ? 1 : 0;
        _t.makeTranslation(side * (s.width / 2 + 0.03), fy, fz)
          .multiply(new Matrix4().makeRotationY((side * Math.PI) / 2))
          .scale(_v.set(0.75, 0.95, 1));
        const mm = _m.clone().multiply(_t);
        b.add(PRIMS.quad(), mm, PALETTE.windowDark, on);
        if (on) {
          lamps.push(new Vector3(0, 0, 0.6).applyMatrix4(mm));
          lit++;
        }
      }
    }
  }
  // la porta (migliorie «porte»): parte dal suolo davanti, non dalla base della casa (che sta 60 cm
  // sotto il punto più basso dell'impronta: la porta era mezza sepolta), ed è una lastra che sporge
  // 12 cm dal muro (un quadrato a 3 cm sfarfallava con il muro da lontano, e queste frazioni si
  // vedono quasi sempre da lontano)
  const piede = new Vector3(0, 0, -s.depth / 2 - 0.3).applyMatrix4(_m);
  const pc = worldToCyl(piede);
  const y0 = Math.max(0, surfaceHeight(pc.z, pc.theta) - s.baseH);
  _t.makeTranslation(0, y0 + 1.05, -s.depth / 2 - 0.05).scale(_v.set(1.1, 2.1, 0.14));
  b.add(PRIMS.box(), _m.clone().multiply(_t), PALETTE.wood, 0);
  return lit;
}

export interface VillageOptions {
  seed: number;
  /** Costruisci il campanile e la chiesa. */
  church: boolean;
  /** Costruisci i muri a secco sui gradoni. */
  walls: boolean;
}

/** Costruisce un paese a partire dalla sua definizione. */
export function buildVillage(v: VillageDef, material: Material, colliders: ColliderWorld, opts: VillageOptions): VillageResult {
  const rnd = mulberry32(opts.seed);
  const noise = new Simplex3(opts.seed + 3);
  const b = new GeomBuilder();
  const cols: Collider[] = [];
  const lamps: Vector3[] = [];
  const houses: HouseSite[] = [];
  const masks = createMasks();
  let campanile: Vector3 | null = null;

  // --- campanile di San Vigilio e chiesa ---
  if (opts.church) {
    const c = v.campanile;
    const p = v.piazza;
    // la facciata guarda la piazza
    const towardPiazza = (Math.atan2(deltaDeg(c.theta, p.theta) * METERS_PER_DEG, p.z - c.z) * 180) / Math.PI;
    const yaw = towardPiazza;
    const base = surfaceHeight(c.z, c.theta) - 0.8;
    const side = 5.6;
    surfaceMatrix(c.z, c.theta, base, yaw, 1, 1, 1, _m);
    const lime = PALETTE.lime;
    _t.makeTranslation(0, c.height / 2, 0).scale(_v.set(side, c.height, side));
    b.add(PRIMS.box(), _m.clone().multiply(_t), lime, 0, (lp, col) => {
      const k = lp.y < -0.42 ? 0.9 : 1; // zoccolo
      col[0] = col[0]! * k;
      col[1] = col[1]! * k;
      col[2] = col[2]! * k;
    });
    // cornice e cella campanaria
    _t.makeTranslation(0, c.height - 0.3, 0).scale(_v.set(side + 0.5, 0.6, side + 0.5));
    b.add(PRIMS.box(), _m.clone().multiply(_t), PALETTE.gneissLight);
    for (let f = 0; f < 4; f++) {
      const rot = new Matrix4().makeRotationY((f * Math.PI) / 2);
      for (const ox of [-1.2, 1.2]) {
        _t.copy(rot).multiply(new Matrix4().makeTranslation(ox, c.height - 3.4, side / 2 + 0.03)).scale(_v.set(1.25, 2.6, 1));
        b.add(PRIMS.quad(), _m.clone().multiply(_t), PALETTE.windowDark, 0);
      }
      _t.copy(rot).multiply(new Matrix4().makeTranslation(0, c.height * 0.45, side / 2 + 0.03)).scale(_v.set(0.35, 1.1, 1));
      b.add(PRIMS.quad(), _m.clone().multiply(_t), PALETTE.windowDark, 0);
    }
    // cappello di piode (piramide)
    _t.makeTranslation(0, c.height, 0).scale(_v.set(side + 0.9, 6.2, side + 0.9));
    b.add(PRIMS.pyramid(), _m.clone().multiply(_t), PALETTE.slate);
    // palina bianca e rossa del Pilastro 1 (segnale del Catasto)
    const poleH = 9;
    for (let k = 0; k < 9; k++) {
      _t.makeTranslation(0, c.height + 5.6 + k * (poleH / 9), 0).scale(_v.set(0.16, poleH / 9, 0.16));
      b.add(PRIMS.cylinder(8), _m.clone().multiply(_t), k % 2 === 0 ? [0.95, 0.94, 0.9] : [0.78, 0.16, 0.13]);
    }
    _t.makeTranslation(0, c.height + 5.6 + poleH, 0).scale(_v.set(0.5, 0.5, 0.5));
    b.add(PRIMS.blob(1), _m.clone().multiply(_t), [0.78, 0.16, 0.13]);
    cols.push(boxAt(c.z, c.theta, base, yaw, side, c.height + 3, side, 'campanile'));
    campanile = cylToWorld(c.z, c.theta, base + c.height + 5.6 + poleH);
    lamps.push(cylToWorld(c.z, c.theta, base + c.height - 3));

    // chiesa: navata dietro il campanile, lontano dalla piazza
    const naveW = 9;
    const naveL = 17;
    const naveOff = -(side / 2 + naveL / 2 - 1);
    const yawR = yaw * DEG;
    const nz = c.z + naveOff * Math.cos(yawR) + 6.5 * -Math.sin(yawR);
    const nth = c.theta + (naveOff * Math.sin(yawR) + 6.5 * Math.cos(yawR)) / METERS_PER_DEG;
    const fh = footprintHeights(nz, nth, yaw, naveW, naveL);
    const nb = fh.min - 0.8;
    const wallH = 8 + (fh.max - fh.min);
    surfaceMatrix(nz, nth, nb, yaw, 1, 1, 1, _m);
    _t.makeTranslation(0, wallH / 2, 0).scale(_v.set(naveW, wallH, naveL));
    b.add(PRIMS.box(), _m.clone().multiply(_t), [0.93, 0.9, 0.84]);
    _t.makeTranslation(0, wallH - 0.05, 0).scale(_v.set(naveW + 1, 4.2, naveL + 1));
    b.add(PRIMS.gable(), _m.clone().multiply(_t), PALETTE.slate);
    _t.makeTranslation(0, 2.0, -naveL / 2 - 0.03).multiply(new Matrix4().makeRotationY(Math.PI)).scale(_v.set(1.8, 3.4, 1));
    b.add(PRIMS.quad(), _m.clone().multiply(_t), PALETTE.wood);
    _t.makeTranslation(0, wallH - 2.5, -naveL / 2 - 0.03).multiply(new Matrix4().makeRotationY(Math.PI)).scale(_v.set(1.4, 1.4, 1));
    b.add(PRIMS.quad(), _m.clone().multiply(_t), PALETTE.windowDark, 1);
    cols.push(boxAt(nz, nth, nb, yaw, naveW, wallH + 2, naveL, 'chiesa'));
  }
  colliders.addMany(cols.slice());

  // --- rustici ---
  const target = v.houseCount;
  const minSpacing = 12.5;
  for (let tries = 0; tries < 4000 && houses.length < target; tries++) {
    const ang = rnd() * Math.PI * 2;
    const rad = Math.sqrt(rnd()) * v.radius;
    const z = v.zCenter + Math.cos(ang) * rad;
    const theta = v.thetaCenter + (Math.sin(ang) * rad) / METERS_PER_DEG;
    surfaceHeight(z, theta, masks);
    if (masks.kind !== 'valle' || masks.stream < 20 || masks.lakeQ < 1.12) continue;
    if (surfaceDistance(z, theta, v.piazza.z, v.piazza.theta) < v.piazza.radius + 8) continue;
    if (surfaceDistance(z, theta, v.campanile.z, v.campanile.theta) < 26) continue;
    if (houses.some((hh) => surfaceDistance(z, theta, hh.z, hh.theta) < minSpacing)) continue;
    const width = 5 + rnd() * 2.6;
    const depth = 6.5 + rnd() * 3;
    const yaw = downhillYaw(z, theta) + (rnd() - 0.5) * 14;
    const fh = footprintHeights(z, theta, yaw, width + 1, depth + 1);
    if (fh.max - fh.min > 2.2) continue;
    if (slopeAt(z, theta, false) > 0.5) continue;
    const baseH = fh.min - 0.6;
    const wallH = 5 + rnd() * 2.4 + (fh.max - fh.min);
    const center = cylToWorld(z, theta, baseH + 1.5);
    if (colliders.pointInside(center, 3)) continue;
    const site: HouseSite = { z, theta, baseH, yaw, width, depth, wallH };
    houses.push(site);
    const stone = vary(rnd() < 0.5 ? PALETTE.gneiss : PALETTE.gneissLight, rnd, 0.1);
    addHouse(b, site, rnd, lamps, stone);
    const col = boxAt(z, theta, baseH, yaw, width, wallH + (width / 2 + 0.5) * Math.tan(33 * DEG) * 0.5, depth, 'rustico');
    cols.push(col);
    colliders.add(col);
  }

  // --- muri a secco sui gradoni ---
  if (opts.walls) {
    const step = v.terraceStep;
    const R0 = v.terraceRadius * 0.9;
    const grid = 4;
    for (let dz = -R0; dz <= R0; dz += grid) {
      for (let da = -R0; da <= R0; da += grid) {
        if (dz * dz + da * da > R0 * R0) continue;
        const z = v.zCenter + dz + (rnd() - 0.5) * 1.2;
        const theta = v.thetaCenter + (da + (rnd() - 0.5) * 1.2) / METERS_PER_DEG;
        const h = surfaceHeight(z, theta, masks);
        if (masks.village < 0.6 || masks.piazza > 0.05 || masks.stream < 14) continue;
        const t = h / step;
        const fr = t - Math.floor(t);
        if (fr < 0.87 || fr > 0.985) continue;
        const pt = cylToWorld(z, theta, h);
        if (noise.noise(pt.x / 30, pt.y / 30, pt.z / 30) > 0.55) continue; // varchi per salire
        if (colliders.pointInside(pt, 2.5)) continue;
        const yaw = downhillYaw(z, theta) + 90; // lungo la curva di livello
        const lowerTread = Math.floor(t) * step;
        const height = Math.max(1.2, (Math.floor(t) + 1) * step - lowerTread + 0.75);
        const base = lowerTread - 0.4;
        surfaceMatrix(z, theta, base, yaw, 1, 1, 1, _m);
        const len = grid * 1.25;
        _t.makeTranslation(0, height / 2, 0).scale(_v.set(len, height, 1.1));
        const stone = vary(PALETTE.gneissDark, rnd, 0.14);
        b.add(PRIMS.box(), _m.clone().multiply(_t), stone, 0, (lp, c) => {
          const k = 0.92 + 0.12 * Math.sin(lp.x * 17 + lp.y * 9);
          c[0] = c[0]! * k;
          c[1] = c[1]! * k;
          c[2] = c[2]! * k;
        });
        const wc = boxAt(z, theta, base, yaw, len, height, 1.1, 'muro');
        cols.push(wc);
        colliders.add(wc);
      }
    }
  }

  const mesh = new Mesh(b.build(), material);
  mesh.name = `paese-${v.id}`;
  mesh.matrixAutoUpdate = false;
  return { mesh, colliders: cols, lamps, houses, campanile };
}

/** Frazioni segnaposto nelle altre valli: solo per giudicare scala e segnali di cielo. */
export const PLACEHOLDER_HAMLETS: VillageDef[] = [
  {
    id: 'frazione-lago',
    name: 'Frazione sul lago (segnaposto)',
    strip: 'valle-2',
    zStart: 1330,
    zEnd: 1470,
    zCenter: 1400,
    thetaCenter: 136,
    radius: 55,
    houseCount: 9,
    terraceStep: 3.5,
    terraceRadius: 0,
    slope: 0,
    campanile: { name: '', z: 1400, theta: 136, height: 16 },
    piazza: { name: '', z: 1400, theta: 136, radius: 6 },
  },
  {
    id: 'cascine-valle3',
    name: 'Cascine di Valle 3 (segnaposto)',
    strip: 'valle-3',
    zStart: 1180,
    zEnd: 1320,
    zCenter: 1250,
    thetaCenter: 292,
    radius: 60,
    houseCount: 8,
    terraceStep: 3.5,
    terraceRadius: 0,
    slope: 0,
    campanile: { name: '', z: 1250, theta: 292, height: 14 },
    piazza: { name: '', z: 1250, theta: 292, radius: 6 },
  },
  sparse('cascine-sparse-valle2', 'valle-2', 1950, 196, 230, 9),
  sparse('cascine-sparse-valle3', 'valle-3', 1850, 268, 280, 11),
  sparse('cascine-sparse-valle1-nord', 'valle-1', 1900, 30, 220, 8),
  sparse('cascine-sparse-valle3-sud', 'valle-3', 800, 300, 200, 7),
];

/** Cascine sparse segnaposto (luci notturne nelle altre valli). */
function sparse(id: string, strip: string, z: number, theta: number, radius: number, houseCount: number): VillageDef {
  return {
    id,
    name: `${id} (segnaposto)`,
    strip,
    zStart: z - radius,
    zEnd: z + radius,
    zCenter: z,
    thetaCenter: theta,
    radius,
    houseCount,
    terraceStep: 3.5,
    terraceRadius: 0,
    slope: 0,
    campanile: { name: '', z, theta, height: 14 },
    piazza: { name: '', z, theta, radius: 4 },
  };
}

/** Posizione cilindrica di comodo per i lampioni della piazza. */
export function piazzaLampPositions(v: VillageDef): Vector3[] {
  const out: Vector3[] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    const z = v.piazza.z + Math.cos(a) * (v.piazza.radius - 3);
    const th = v.piazza.theta + (Math.sin(a) * (v.piazza.radius - 3)) / METERS_PER_DEG;
    out.push(cylToWorld(z, th, surfaceHeight(z, th) + 3.2));
  }
  return out;
}

