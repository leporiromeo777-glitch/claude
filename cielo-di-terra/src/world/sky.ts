/**
 * Orologio del giorno del cilindro e stato del cielo (la Linea).
 *
 * - Un giorno di gioco (24 ore) dura `dayLengthMinutes` minuti reali (40 di default).
 * - All'alba la Linea si accende dal Tappo Sud verso nord come una miccia
 *   (`lineaIgnite` va da 0 a L); al tramonto si ritira verso sud e resta una
 *   brace blu per la notte.
 * - La direzione della luce in ogni punto è il versore verso l'asse, inclinato
 *   di 30-50 gradi dallo "schermo girevole" (alpha), con un azimut (beta) che
 *   ruota durante il giorno: luce da Mane al mattino, da Lag a mezzogiorno, da
 *   Sera la sera. Così ci sono sempre ombre laterali.
 *
 * Tutti i colori sono nello spazio sRGB "da pittore" (il renderer non converte).
 */
import { L } from './constants';
import { clamp, lerp, smoothstep } from './noise';

export type RGB = [number, number, number];

export interface SkyTimes {
  /** Inizio dell'accensione (ore). */
  dawnStart: number;
  /** Linea accesa da un capo all'altro (ore). */
  dawnEnd: number;
  /** Inizio del ritiro (ore). */
  duskStart: number;
  /** Linea ridotta a brace (ore). */
  duskEnd: number;
}

export const DEFAULT_TIMES: SkyTimes = { dawnStart: 5.5, dawnEnd: 6.6, duskStart: 19.4, duskEnd: 20.6 };

export interface SkyState {
  hours: number;
  /** z fino a cui la Linea è accesa (m). */
  lineaIgnite: number;
  /** Intensità della luce della Linea (0 notte, 1 pieno giorno). */
  sunIntensity: number;
  /** 0 giorno, 1 notte piena (lampade, brace). */
  night: number;
  /** 0..1 quanto è "alba/tramonto" (colori caldi). */
  golden: number;
  /** Inclinazione della luce dalla verticale (rad). */
  tiltAlpha: number;
  /** Azimut dell'inclinazione: 0 = da Mane (est), pi/2 = da Lag (nord), pi = da Sera (rad). */
  tiltBeta: number;
  sunColor: RGB;
  ambientTop: RGB;
  ambientBottom: RGB;
  hazeColor: RGB;
  lineaCore: RGB;
  lineaGlow: RGB;
  /** Intensità visiva del filamento (anche di notte, come brace). */
  lineaBrightness: number;
}

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

const PAL = {
  sunDay: hex(0xffeccb),
  sunGold: hex(0xffc58e),
  sunNight: hex(0x5a64d8),
  ambTopDay: hex(0xa9b6cc),
  ambTopNight: hex(0x2c2f66),
  ambBotDay: hex(0xa08e66),
  ambBotNight: hex(0x1c1a36),
  hazeDay: hex(0x8eabd6),
  hazeGold: hex(0xc9a7a6),
  hazeNight: hex(0x252a55),
  coreDay: hex(0xfffbec),
  coreGold: hex(0xffd9a0),
  coreEmber: hex(0x6f86ff),
  glowDay: hex(0xffe9c4),
  glowEmber: hex(0x3b4fd8),
};

export class WorldClock {
  /** Ora del giorno (0..24). */
  hours: number;
  /** Minuti reali per un giorno di 24 ore. */
  dayLengthMinutes: number;
  /** Moltiplicatore del tempo (debug). */
  timeScale = 1;
  /** Se falso l'ora resta ferma (utile per gli screenshot). */
  running = true;
  times: SkyTimes;

  constructor(hours = 10, dayLengthMinutes = 40, times: SkyTimes = DEFAULT_TIMES) {
    this.hours = hours;
    this.dayLengthMinutes = dayLengthMinutes;
    this.times = { ...times };
  }

  /** Avanza di dt secondi reali. */
  advance(dt: number): void {
    if (!this.running) return;
    const hoursPerSecond = 24 / (this.dayLengthMinutes * 60);
    this.hours = (this.hours + dt * hoursPerSecond * this.timeScale) % 24;
  }

  setHours(h: number): void {
    this.hours = ((h % 24) + 24) % 24;
  }

  state(out?: SkyState): SkyState {
    return computeSky(this.hours, this.times, out);
  }
}

/** Calcola lo stato del cielo per un'ora del giorno. */
export function computeSky(hours: number, t: SkyTimes = DEFAULT_TIMES, out?: SkyState): SkyState {
  const h = ((hours % 24) + 24) % 24;
  // frazione "accesa" della Linea lungo l'asse
  let lit: number;
  if (h < t.dawnStart || h >= t.duskEnd) lit = 0;
  else if (h < t.dawnEnd) lit = (h - t.dawnStart) / (t.dawnEnd - t.dawnStart);
  else if (h < t.duskStart) lit = 1;
  else lit = 1 - (h - t.duskStart) / (t.duskEnd - t.duskStart);
  lit = clamp(lit, 0, 1);

  // intensità: sale con la miccia, cala col ritiro
  const dayK = smoothstep(0, 1, lit);
  // "golden": vicino ad alba e tramonto
  const mid = (t.dawnEnd + t.duskStart) / 2;
  const half = (t.duskStart - t.dawnEnd) / 2;
  const fromMid = Math.abs(h - mid) / half; // 0 a mezzogiorno, 1 a fine alba/inizio tramonto
  const golden = dayK * smoothstep(0.62, 1.05, fromMid);
  const night = 1 - dayK;

  // inclinazione della luce (schermo girevole)
  const dayFrac = clamp((h - t.dawnStart) / (t.duskEnd - t.dawnStart), 0, 1);
  const tiltAlpha = (30 + 20 * Math.abs(Math.cos(Math.PI * dayFrac))) * (Math.PI / 180);
  const tiltBeta = Math.PI * dayFrac;

  const sunColor = mixc(mixc(PAL.sunDay, PAL.sunGold, golden), PAL.sunNight, night);
  const res: SkyState = out ?? ({} as SkyState);
  res.hours = h;
  res.lineaIgnite = lit * L;
  res.sunIntensity = lerp(0.1, 1, dayK);
  res.night = night;
  res.golden = golden;
  res.tiltAlpha = tiltAlpha;
  res.tiltBeta = tiltBeta;
  res.sunColor = sunColor;
  res.ambientTop = mixc(PAL.ambTopDay, PAL.ambTopNight, night);
  res.ambientBottom = mixc(PAL.ambBotDay, PAL.ambBotNight, night);
  res.hazeColor = mixc(mixc(PAL.hazeDay, PAL.hazeGold, golden * 0.8), PAL.hazeNight, night);
  res.lineaCore = mixc(mixc(PAL.coreDay, PAL.coreGold, golden), PAL.coreEmber, night);
  res.lineaGlow = mixc(PAL.glowDay, PAL.glowEmber, night);
  res.lineaBrightness = lerp(0.45, 1, dayK);
  return res;
}
