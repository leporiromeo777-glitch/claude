/**
 * Terreno procedurale del Verbano: funzione di quota h(z, theta) (metri verso
 * l'asse) ricavata da `layout.json` + rumore deterministico.
 *
 * - Valli: fondovalle con colline morbide, versanti che salgono a creste di
 *   70-120 m e un bastione di roccia che scende al vetro della finestra.
 * - Valle 1: il riale che serpeggia e il paese di Corbella su un versante a terrazze.
 * - Valle 2: il bacino del lago (superficie a raggio costante) con due isole.
 * - Finestre: vetro piatto (h = 0) con i costoloni di ferro ogni 40 m (solo fisica).
 * - Tappi: il Tappo Sud a gradoni (Alpeggi) e il Sordo, parete di roccia, fino all'asse.
 *
 * Tre funzioni da conoscere:
 * - `surfaceHeight(z, theta)`: quota analitica liscia (usata per la mesh);
 * - `groundHeight(z, theta)`: quota coerente con la mesh LOD 0 + costoloni (usata dalla fisica);
 * - `surfaceNormal(z, theta)`: normale in coordinate mondo (verso l'interno).
 */
import { Vector3 } from 'three';
import { DEG, L, LAYOUT, METERS_PER_DEG, R, type StripDef } from './constants';
import { cylToWorld, deltaDeg, surfaceDistance, wrapDeg } from './cylinder';
import { Simplex3, clamp, lerp, smax, smoothstep } from './noise';
import { DS0, DTHETA0, sAtZ, zAtS } from './terrainGrid';
import { NORTH_TOP, SOUTH_TOP, northProfile, northT, southProfile, southT } from './terrainProfile';

const N1 = new Simplex3(1337);
const N2 = new Simplex3(4242);
const N3 = new Simplex3(9001);

export const STRIPS: readonly StripDef[] = LAYOUT.strips;

// Tabella grado -> indice di striscia (i confini sono a gradi interi).
const stripByDeg = new Int8Array(360);
for (let d = 0; d < 360; d++) {
  const c = d + 0.5;
  stripByDeg[d] = STRIPS.findIndex((s) => c >= s.thetaStart && c < s.thetaEnd);
}

export function stripIndexAt(theta: number): number {
  return stripByDeg[Math.floor(wrapDeg(theta)) % 360]!;
}

export function stripAt(theta: number): StripDef {
  return STRIPS[stripIndexAt(theta)]!;
}

export function isWindowTheta(theta: number): boolean {
  return stripAt(theta).kind === 'finestra';
}

export function stripById(id: string): StripDef | undefined {
  return STRIPS.find((s) => s.id === id);
}

const EDGE = LAYOUT.valleyEdge;
const VILLAGE = LAYOUT.villages[0]!;
const LAKE = LAYOUT.lake;
const RIALE = LAYOUT.riale;
const WIN = LAYOUT.windows;
const CAP_S = LAYOUT.endCaps.south;
const CAP_N = LAYOUT.endCaps.north;

/** Gradone morbido: piani lunghi e alzate corte (frazione `riser` del passo). */
export function terrace(h: number, step: number, riser: number): number {
  const t = h / step;
  const fl = Math.floor(t);
  const fr = t - fl;
  return (fl + smoothstep(1 - riser, 1, fr)) * step;
}

/** Angolo del riale (gradi) alla progressiva z. */
export function rialeTheta(z: number): number {
  return RIALE.thetaBase + RIALE.amplitude * Math.sin((2 * Math.PI * z) / RIALE.wavelength) + 2.2 * N3.noise(z / 300, 3.1, 0.7);
}

/** Piano inclinato del paese (prima dei gradoni). */
function villagePlane(z: number, theta: number, px: number, py: number): number {
  const west = Math.max(0, rialeTheta(z) - theta) * METERS_PER_DEG;
  return 11 + VILLAGE.slope * west + 4 * N2.noise(px / 160, py / 160, z / 160);
}

/** Quota del piano della piazza (quantizzata al passo dei gradoni). */
const PIAZZA_H = (() => {
  const p = cylToWorld(VILLAGE.piazza.z, VILLAGE.piazza.theta, 0);
  return terrace(villagePlane(VILLAGE.piazza.z, VILLAGE.piazza.theta, p.x, p.y), VILLAGE.terraceStep, 0.16);
})();

/** Maschere utili per colori e posizionamento (calcolate insieme alla quota). */
export interface TerrainMasks {
  strip: number;
  kind: 'valle' | 'finestra';
  theme: string;
  /** 0..1 vicino al paese (gradoni). */
  village: number;
  /** 0..1 dentro la piazza. */
  piazza: number;
  /** distanza dal riale (m), Infinity se non c'è. */
  stream: number;
  /** distanza normalizzata dal centro del lago (<1 dentro), Infinity se non c'è. */
  lakeQ: number;
  /** 0..1 sul bastione di roccia verso le finestre. */
  bank: number;
  /** t del Tappo Sud (0 fuori), t del Sordo (0 fuori). */
  capS: number;
  capN: number;
  /** quota del contributo dei Tappi. */
  capH: number;
  /** "u" trasversale nella valle (0..1), e = |2u-1|. */
  across: number;
}

function blankMasks(): TerrainMasks {
  return { strip: 0, kind: 'valle', theme: '', village: 0, piazza: 0, stream: Infinity, lakeQ: Infinity, bank: 0, capS: 0, capN: 0, capH: 0, across: 0 };
}

const _m = blankMasks();

/** Quota dei Tappi a (z, theta) con rumore e gradoni. */
function capHeight(z: number, sinT: number, cosT: number, m: TerrainMasks): number {
  let hc = 0;
  const ts = southT(z);
  if (ts > 0) {
    let H = southProfile(z);
    // Alpeggi: gradoni fino a terraceTop, poi parete liscia verso il mozzo
    const step = CAP_S.terraceStep ?? 14;
    const top = CAP_S.terraceTop ?? 450;
    const tw = 1 - smoothstep(top - 40, top + 20, H);
    const r = R - H;
    const px = -sinT * r;
    const py = -cosT * r;
    const n = N1.fbm(px / 110, py / 110, z / 110, 4);
    H += CAP_S.noiseAmplitude * n * smoothstep(0, 0.12, ts);
    H = lerp(H, terrace(H, step, 0.38), tw * smoothstep(0.02, 0.1, ts));
    hc = Math.max(hc, Math.min(H, SOUTH_TOP));
    m.capS = ts;
  }
  const tn = northT(z);
  if (tn > 0) {
    let H = northProfile(z);
    const r = Math.max(4, R - H);
    const px = -sinT * r;
    const py = -cosT * r;
    const rid = N2.ridged(px / 95, py / 95, z / 95, 4);
    const fac = N3.fbm(px / 40, py / 40, z / 40, 2);
    const env = Math.pow(Math.sin(Math.PI * Math.min(1, tn * 1.02)), 0.6);
    // contrafforti: creste che salgono lungo la parete e convergono verso la cima
    const butt = N1.ridged(px / 70, py / 70, z / 260, 3);
    H += 78 * (butt - 0.42) * env;
    H += CAP_N.noiseAmplitude * (rid - 0.45) * 1.3 * env + 5 * fac * env;
    // cenge: ripiani orizzontali nella roccia
    H = lerp(H, terrace(H, 42, 0.7), 0.5 * env);
    hc = Math.max(hc, Math.min(H, NORTH_TOP));
    m.capN = tn;
  }
  m.capH = hc;
  return hc;
}

/** Quota di una valle (senza Tappi). */
function valleyHeight(strip: StripDef, idx: number, z: number, theta: number, sinT: number, cosT: number, m: TerrainMasks): number {
  const span = strip.thetaEnd - strip.thetaStart;
  const u = (theta - strip.thetaStart) / span;
  const e = Math.abs(2 * u - 1);
  m.across = u;
  const dEdge = Math.min(theta - strip.thetaStart, strip.thetaEnd - theta) * METERS_PER_DEG;
  const side = u < 0.5 ? 0 : 1;
  const px = -sinT * R;
  const py = -cosT * R;

  const ridgeN = N1.noise(z / 520, side * 17.3 + idx * 5.1, 0.5);
  const ridge = lerp(strip.ridgeMin ?? 70, strip.ridgeMax ?? 110, 0.5 + 0.5 * ridgeN);
  // versante che sale fino alla cresta, poi cornice di terra che scende dolce al vetro
  const peak = EDGE.ridgePeak + 0.05 * N2.noise(z / 300, side * 3.3 + idx, 1.7);
  const up = smoothstep(EDGE.ridgeStart, peak, e);
  const down = 1 - smoothstep(peak + 0.02, 1.0, e);
  const s = Math.pow(up, 1.3) * (0.03 + 0.97 * Math.pow(down, 0.85));
  const rise = ridge * s;
  const amp = strip.hillAmplitude ?? 16;
  const hills =
    N1.fbm(px / 260, py / 260, z / 260, 4) * amp * (0.55 + 0.45 * (1 - s)) * (0.25 + 0.75 * down) +
    N2.fbm(px / 70, py / 70, z / 70, 3) * 2.6 +
    (N3.ridged(px / 140, py / 140, z / 140, 3) - 0.4) * 10 * s;
  let h = (strip.floorHeight ?? 8) + rise + hills;

  if (strip.theme === 'selve') {
    // paese di Corbella: piano inclinato verso Sera e gradoni
    const dv = surfaceDistance(z, theta, VILLAGE.zCenter, VILLAGE.thetaCenter);
    const wv = 1 - smoothstep(0.5 * VILLAGE.terraceRadius, VILLAGE.terraceRadius, dv);
    if (wv > 0) {
      const plane = villagePlane(z, theta, px, py) + rise * 0.5;
      h = lerp(h, plane, wv);
      const wt = 1 - smoothstep(0.62 * VILLAGE.terraceRadius, 0.95 * VILLAGE.terraceRadius, dv);
      h = lerp(h, terrace(h, VILLAGE.terraceStep, 0.16), wt);
      m.village = wt;
      const dp = surfaceDistance(z, theta, VILLAGE.piazza.z, VILLAGE.piazza.theta);
      const wp = 1 - smoothstep(VILLAGE.piazza.radius, VILLAGE.piazza.radius + 14, dp);
      if (wp > 0) {
        h = lerp(h, PIAZZA_H, wp);
        m.piazza = wp;
      }
    }
    // riale
    const dTh = deltaDeg(rialeTheta(z), theta);
    const d = Math.abs(dTh) * METERS_PER_DEG;
    m.stream = d;
    h -= 6 * Math.exp(-(d * d) / (80 * 80)) * (1 - 0.6 * wv);
    h -= RIALE.depth * (1 - smoothstep(RIALE.width * 0.3, RIALE.width, d));
  } else if (strip.theme === 'lago') {
    const wl = LAKE.waterHeight;
    h = smax(h, wl + 1.2, 5);
    const zc = (LAKE.zStart + LAKE.zEnd) / 2;
    const hz = (LAKE.zEnd - LAKE.zStart) / 2;
    const dz = (z - zc) / hz;
    const dth = deltaDeg(LAKE.thetaCenter, theta) / LAKE.halfWidth;
    const wob = N2.noise(px / 190, py / 190, z / 190) * 0.13 + N3.noise(px / 60, py / 60, z / 60) * 0.03;
    const q = Math.sqrt(Math.pow(Math.abs(dz), 2.6) + dth * dth) + wob;
    m.lakeQ = q;
    if (q < 1.7) {
      const shape = smax(wl - LAKE.depth, wl + 42 * (q - 1), 7);
      h = lerp(shape, h, smoothstep(1.02, 1.7, q));
    }
    for (const isl of LAKE.islands) {
      const di = surfaceDistance(z, theta, isl.z, isl.theta);
      if (di < isl.radius * 1.6) {
        const x = di / isl.radius;
        const dome = wl + isl.height * (1 - x * x) - 6 * Math.max(0, x - 1) + N1.noise(px / 30, py / 30, z / 30) * 1.5;
        h = smax(h, dome, 4);
      }
    }
  }

  // raccordo con il telaio della finestra: gli ultimi metri scendono a edgeHeight
  const bw = EDGE.bankWidth;
  const b = smoothstep(0, bw, dEdge);
  m.bank = 1 - smoothstep(bw * 0.3, bw, dEdge);
  h = lerp(EDGE.edgeHeight * smoothstep(0, 3, dEdge), h, b * b * (3 - 2 * b));
  return Math.max(0, h);
}

/**
 * Quota analitica h(z, theta) del terreno (senza costoloni delle finestre).
 * Se `masks` è passato, viene riempito con le maschere usate per colori e oggetti.
 */
export function surfaceHeight(z: number, theta: number, masks?: TerrainMasks): number {
  const m = masks ?? _m;
  m.village = 0;
  m.piazza = 0;
  m.stream = Infinity;
  m.lakeQ = Infinity;
  m.bank = 0;
  m.capS = 0;
  m.capN = 0;
  m.capH = 0;
  m.across = 0;
  const th = wrapDeg(theta);
  const idx = stripIndexAt(th);
  const strip = STRIPS[idx]!;
  m.strip = idx;
  m.kind = strip.kind;
  m.theme = strip.theme ?? '';
  const t = th * DEG;
  const sinT = Math.sin(t);
  const cosT = Math.cos(t);
  const zc = clamp(z, 0, L);
  let h = strip.kind === 'valle' ? valleyHeight(strip, idx, zc, th, sinT, cosT, m) : 0;
  const hc = capHeight(zc, sinT, cosT, m);
  if (hc > 0) {
    h = strip.kind === 'valle' ? smax(h, hc, 26) : Math.max(h, hc);
  }
  return Math.min(h, R - 2);
}

/** Nuova struttura di maschere (per chi chiama molte volte senza allocare). */
export function createMasks(): TerrainMasks {
  return blankMasks();
}

/** Profilo dei costoloni di ferro sulle finestre (solo fisica; la mesh è a parte). */
export function ribHeight(z: number, theta: number): number {
  if (!isWindowTheta(theta)) return 0;
  const sp = WIN.ribSpacing;
  const d = Math.abs((((z % sp) + sp) % sp) - sp / 2); // distanza da metà campata
  const fromRib = sp / 2 - d; // distanza dal costolone più vicino
  const half = WIN.ribWidth / 2;
  return WIN.ribHeight * (1 - smoothstep(half - 0.15, half + 0.1, fromRib));
}

// --- Quota coerente con la mesh (fisica) -------------------------------------

const cache = new Map<number, number>();
const CACHE_MAX = 8192;

function cornerHeight(i: number, j: number): number {
  const key = i * 4096 + (((j % 1344) + 1344) % 1344);
  const c = cache.get(key);
  if (c !== undefined) return c;
  const h = surfaceHeight(zAtS(i * DS0), j * DTHETA0);
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, h);
  return h;
}

/**
 * Quota del suolo come la vede la mesh LOD 0 (interpolazione sui triangoli della
 * griglia) più i costoloni delle finestre. È la funzione da usare per i piedi.
 */
export function groundHeight(z: number, theta: number): number {
  const th = wrapDeg(theta);
  const s = sAtZ(clamp(z, 0, L)) / DS0;
  const a = th / DTHETA0;
  const i = Math.floor(s);
  const j = Math.floor(a);
  const fs = s - i;
  const fa = a - j;
  const h00 = cornerHeight(i, j);
  const h10 = cornerHeight(i + 1, j);
  const h01 = cornerHeight(i, j + 1);
  const h11 = cornerHeight(i + 1, j + 1);
  // stessa diagonale della mesh: triangoli (00,10,11) e (00,11,01)
  let h: number;
  if (fs >= fa) h = h00 + (h10 - h00) * fs + (h11 - h10) * fa;
  else h = h00 + (h11 - h01) * fs + (h01 - h00) * fa;
  return h + ribHeight(z, th);
}

/** Svuota la cache delle quote (dopo modifiche al layout nei test). */
export function clearGroundCache(): void {
  cache.clear();
}

const _pa = new Vector3();
const _pb = new Vector3();
const _pc = new Vector3();
const _pd = new Vector3();
const _tz = new Vector3();
const _tt = new Vector3();

/**
 * Normale del terreno in coordinate mondo (verso l'asse sul piano), per
 * differenze finite su `surfaceHeight` con passo `step` metri.
 */
export function surfaceNormal(z: number, theta: number, out: Vector3 = new Vector3(), step = 1.5, useGround = false): Vector3 {
  const f = useGround ? groundHeight : (zz: number, tt: number) => surfaceHeight(zz, tt);
  const dth = step / METERS_PER_DEG;
  cylToWorld(z - step, theta, f(z - step, theta), _pa);
  cylToWorld(z + step, theta, f(z + step, theta), _pb);
  cylToWorld(z, theta - dth, f(z, theta - dth), _pc);
  cylToWorld(z, theta + dth, f(z, theta + dth), _pd);
  _tz.subVectors(_pb, _pa);
  _tt.subVectors(_pd, _pc);
  // east x north = up  =>  normale = t_theta x t_z
  return out.crossVectors(_tt, _tz).normalize();
}

/** Pendenza (radianti) del terreno rispetto al "su" locale. */
export function slopeAt(z: number, theta: number, useGround = true): number {
  const n = surfaceNormal(z, theta, _pa, 1.0, useGround);
  const t = wrapDeg(theta) * DEG;
  const upx = Math.sin(t);
  const upy = Math.cos(t);
  return Math.acos(clamp(n.x * upx + n.y * upy, -1, 1));
}

/** Livello dell'acqua del lago (h) e test di appartenenza. */
export const WATER_HEIGHT = LAKE.waterHeight;

/** Densità di bosco (0..1) per il posizionamento dei castagni e il colore del suolo. */
export function forestDensity(z: number, theta: number, h: number, slope: number, m: TerrainMasks): number {
  if (m.kind !== 'valle' && m.capS <= 0) return 0;
  const t = wrapDeg(theta) * DEG;
  const px = -Math.sin(t) * R;
  const py = -Math.cos(t) * R;
  const n = N3.fbm(px / 210, py / 210, z / 210, 3) * 0.5 + 0.5;
  const fine = N1.noise(px / 45, py / 45, z / 45) * 0.5 + 0.5;
  let d = 0;
  if (m.capS > 0.04) {
    // Tappo Sud: radi castagni nella parte bassa degli alpeggi
    d = smoothstep(0.62, 0.8, n) * (1 - smoothstep(0.15, 0.4, m.capS)) * 0.6;
  } else if (m.theme === 'selve') {
    const e = Math.abs(2 * m.across - 1);
    const slopes = smoothstep(0.18, 0.45, e) * (1 - smoothstep(0.86, 0.97, e));
    d = slopes * smoothstep(0.28, 0.52, n) + smoothstep(0.62, 0.75, n) * 0.55;
    d *= 1 - smoothstep(0.05, 0.4, m.village) * 0.92;
    if (m.stream < 22) d *= smoothstep(10, 22, m.stream);
  } else if (m.theme === 'lago') {
    d = smoothstep(0.55, 0.75, n) * 0.7;
    if (m.lakeQ < 1.25) d *= smoothstep(1.06, 1.25, m.lakeQ);
    if (h < WATER_HEIGHT + 0.8) d = 0;
  } else if (m.theme === 'campi') {
    d = smoothstep(0.66, 0.8, n) * 0.6;
  }
  d *= 0.75 + 0.25 * fine;
  // niente alberi sulle pareti ripide e sul bastione
  d *= 1 - smoothstep(0.55, 0.8, slope);
  d *= 1 - m.bank;
  if (m.capN > 0) d = 0;
  return clamp(d, 0, 1);
}
