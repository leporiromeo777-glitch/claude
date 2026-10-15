/**
 * Palette del Ticino d'autunno e colori del terreno per bioma.
 * Colori nello spazio sRGB "da pittore" (0..1), come tutto il resto del rendering.
 */
import { DEG, METERS_PER_DEG, R } from '../world/constants';
import { Simplex3, clamp, hash2, lerp, smoothstep } from '../world/noise';
import { WATER_HEIGHT, forestDensity, type TerrainMasks } from '../world/terrain';

export type RGB = [number, number, number];

export const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

export const PALETTE = {
  meadow: hex(0x93a866),
  meadowLight: hex(0xb3bd78),
  meadowDark: hex(0x6f8a4c),
  meadowOchre: hex(0xbfa862),
  forestFloor: hex(0x6d6a3a),
  forestLitter: hex(0x9a7643),
  rock: hex(0x9c9a9a),
  rockViolet: hex(0x8b8494),
  rockDark: hex(0x6d6872),
  sordo: hex(0x8e8c92),
  pasture: hex(0xadb86a),
  pastureDry: hex(0xc7b56c),
  terraceRiser: hex(0x8d826a),
  village: hex(0xa59a87),
  piazza: hex(0xbdb19d),
  stream: hex(0x5b9b92),
  shore: hex(0xcdb98e),
  lakeBed: hex(0x4f8c80),
  fieldOchre: hex(0xcfa95a),
  fieldGreen: hex(0x97ac60),
  fieldBrown: hex(0x8f6c4a),
  fieldGold: hex(0xdcbb68),
  fieldSage: hex(0xa3b07e),
  hedge: hex(0x5f7a40),
  // oggetti
  gneiss: hex(0x9a958f),
  gneissLight: hex(0xb1aca4),
  gneissDark: hex(0x7d7871),
  slate: hex(0x5d5752),
  slateDark: hex(0x4a4541),
  lime: hex(0xf1ece0),
  chestnut: hex(0x6b4a33),
  leafGreen: hex(0x6f8f42),
  leafDeep: hex(0x56743a),
  leafOchre: hex(0xc19a45),
  leafRust: hex(0xb06a3a),
  windowDark: hex(0x2e2a33),
  wood: hex(0x7a5838),
};

const N = new Simplex3(77);

function mixInto(out: number[], c: RGB, w: number): void {
  out[0] = lerp(out[0]!, c[0], w);
  out[1] = lerp(out[1]!, c[1], w);
  out[2] = lerp(out[2]!, c[2], w);
}

/** Campo coltivato (Valle 3): mosaico ruotato di appezzamenti. */
function fieldColor(z: number, theta: number, out: number[]): number {
  const arc = theta * METERS_PER_DEG;
  const a = 0.13;
  const u = arc * Math.cos(a) + z * Math.sin(a);
  const v = -arc * Math.sin(a) + z * Math.cos(a);
  const iu = Math.floor(u / 74);
  const iv = Math.floor(v / 118);
  const pick = hash2(iu, iv);
  const cols = [PALETTE.fieldOchre, PALETTE.fieldGreen, PALETTE.fieldBrown, PALETTE.fieldGold, PALETTE.fieldSage, PALETTE.meadow];
  const c = cols[Math.floor(pick * cols.length)]!;
  out[0] = c[0];
  out[1] = c[1];
  out[2] = c[2];
  // siepi ai bordi
  const fu = u / 74 - iu;
  const fv = v / 118 - iv;
  const edge = Math.min(fu, 1 - fu, fv, 1 - fv) * 80;
  return 1 - smoothstep(1.2, 3.2, edge);
}

/**
 * Colore del terreno (sRGB 0..1) per un vertice.
 * @param slope pendenza in radianti rispetto al "su" locale
 */
export function terrainColor(z: number, theta: number, h: number, slope: number, m: TerrainMasks, out: number[]): number[] {
  const t = theta * DEG;
  const r = R - h;
  const px = -Math.sin(t) * r;
  const py = -Math.cos(t) * r;
  const n1 = N.fbm(px / 140, py / 140, z / 140, 3) * 0.5 + 0.5;
  const n2 = N.noise(px / 38, py / 38, z / 38) * 0.5 + 0.5;

  // base: prato con macchie chiare/scure e ocra
  out[0] = PALETTE.meadow[0];
  out[1] = PALETTE.meadow[1];
  out[2] = PALETTE.meadow[2];
  mixInto(out, PALETTE.meadowLight, smoothstep(0.55, 0.8, n1) * 0.7);
  mixInto(out, PALETTE.meadowDark, smoothstep(0.45, 0.2, n1) * 0.6);
  mixInto(out, PALETTE.meadowOchre, smoothstep(0.62, 0.85, n2) * 0.45);

  if (m.theme === 'campi' && m.capS <= 0) {
    const e = Math.abs(2 * m.across - 1);
    const fieldW = (1 - smoothstep(0.5, 0.72, e)) * (1 - smoothstep(0.25, 0.4, slope));
    if (fieldW > 0) {
      const tmp = [0, 0, 0];
      const hedge = fieldColor(z, theta, tmp);
      mixInto(tmp, PALETTE.hedge, hedge * 0.85);
      mixInto(out, tmp as RGB, fieldW);
    }
  }

  // bosco: sottobosco bruno-oliva con foglie ocra
  const forest = forestDensity(z, theta, h, slope, m);
  if (forest > 0) {
    mixInto(out, PALETTE.forestFloor, smoothstep(0.15, 0.6, forest) * 0.85);
    mixInto(out, PALETTE.forestLitter, smoothstep(0.55, 0.85, n2) * forest * 0.5);
  }

  // paese: gradoni con alzate in pietra, terra battuta, piazza lastricata
  if (m.village > 0) {
    mixInto(out, PALETTE.meadowLight, m.village * 0.25);
    const riser = smoothstep(0.22, 0.45, slope);
    mixInto(out, PALETTE.terraceRiser, riser * m.village * 0.85);
  }
  if (m.piazza > 0) mixInto(out, PALETTE.piazza, m.piazza);

  // riale
  if (m.stream < 16) {
    mixInto(out, PALETTE.shore, (1 - smoothstep(6, 16, m.stream)) * 0.6);
    mixInto(out, PALETTE.stream, 1 - smoothstep(2.5, 5.5, m.stream));
  }

  // lago: rive di ghiaia e fondale (visto attraverso l'acqua)
  if (m.lakeQ < 1.4) {
    const shore = 1 - smoothstep(WATER_HEIGHT + 0.6, WATER_HEIGHT + 3.2, h);
    mixInto(out, PALETTE.shore, shore * 0.9);
    if (h < WATER_HEIGHT) mixInto(out, PALETTE.lakeBed, smoothstep(WATER_HEIGHT, WATER_HEIGHT - 4, h));
  }

  // Tappo Sud: alpeggi a gradoni, poi roccia vicino al mozzo
  if (m.capS > 0.02) {
    const w = smoothstep(0.02, 0.1, m.capS);
    const tmp: number[] = [PALETTE.pasture[0], PALETTE.pasture[1], PALETTE.pasture[2]];
    mixInto(tmp, PALETTE.pastureDry, smoothstep(0.45, 0.75, n1) * 0.7);
    mixInto(tmp, PALETTE.terraceRiser, smoothstep(0.3, 0.55, slope) * 0.8);
    mixInto(tmp, PALETTE.rockViolet, smoothstep(0.62, 0.85, m.capS));
    mixInto(out, tmp as RGB, w);
  }

  // roccia sui pendii ripidi e sui bastioni verso le finestre
  const rockW = clamp(smoothstep(0.6, 0.95, slope) + m.bank * 0.9, 0, 1);
  if (rockW > 0) {
    const tmp: number[] = [PALETTE.rock[0], PALETTE.rock[1], PALETTE.rock[2]];
    mixInto(tmp, PALETTE.rockViolet, n2 * 0.7);
    mixInto(tmp, PALETTE.rockDark, smoothstep(0.55, 0.3, n1) * 0.5);
    mixInto(out, tmp as RGB, rockW);
  }

  // il Sordo: roccia grigia, poliedri a poche facce
  if (m.capN > 0.01) {
    const w = smoothstep(0.01, 0.06, m.capN);
    const tmp: number[] = [PALETTE.sordo[0], PALETTE.sordo[1], PALETTE.sordo[2]];
    mixInto(tmp, PALETTE.rockViolet, smoothstep(0.4, 0.8, n2) * 0.6);
    mixInto(tmp, PALETTE.rockDark, smoothstep(0.5, 0.25, n1) * 0.4);
    mixInto(out, tmp as RGB, w);
  }
  return out;
}
