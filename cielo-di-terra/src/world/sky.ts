/**
 * Orologio del giorno del cilindro e stato del cielo (la Linea).
 *
 * - Un giorno di gioco (24 ore) dura `dayLengthMinutes` minuti reali (40 di default).
 * - All'alba la Linea si accende dal Tappo Sud verso nord come una miccia
 *   (`lineaIgnite` va da 0 a L); al tramonto si ritira verso sud e resta una
 *   brace blu per la notte.
 * - Il NUCLEO luminoso della Linea (licenza artistica motivata nel brief grafico) scorre lungo
 *   l'asse durante il giorno: vicino al Tappo Sud al mattino, a metà cilindro a mezzogiorno,
 *   verso il Sordo la sera, poi segue la brace che si ritira. La luce principale in ogni punto
 *   arriva dal nucleo (`coreZ`): radente lungo la valle al mattino e alla sera, alta a
 *   mezzogiorno. `coreFlat` la rende ancora più radente nelle ore basse, `coreSide` aggiunge
 *   la componente laterale dello "schermo girevole" (da Mane al mattino, da Sera la sera).
 * - `tiltAlpha`/`tiltBeta` restano come prima (schermo girevole: 30-50 gradi dalla verticale,
 *   azimut che ruota) per chi li usa come luce "media" (luci toon degli abitanti, squadro).
 *   Per la direzione vera della luce principale in un punto usare `keyLightDir`.
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

/**
 * Orari predefiniti, allineati a docs/design/FASE1.md: alba 05:30, la miccia
 * arriva sopra Corbella (z ~ 1050) alle 05:40 e in fondo al cilindro alle 06:00;
 * il ritiro comincia alle 19:30 e alle 21:00 resta la brace.
 */
export const DEFAULT_TIMES: SkyTimes = { dawnStart: 5.5, dawnEnd: 6.0, duskStart: 19.5, duskEnd: 21.0 };

/** Estremi della corsa del nucleo lungo l'asse (m). */
export const CORE_Z_MORNING = 120;
export const CORE_Z_EVENING = L - 120;

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
  /** 0..1 fase rosa del crepuscolo (mentre la Linea si accende o si ritira). */
  rosa: number;
  /** Moltiplicatore della luce principale (`uSole.w`): più piena nelle ore dorate. */
  forzaLuce: number;
  /** Inclinazione della luce dalla verticale (rad). */
  tiltAlpha: number;
  /** Azimut dell'inclinazione: 0 = da Mane (est), pi/2 = da Lag (nord), pi = da Sera (rad). */
  tiltBeta: number;
  /** z del nucleo luminoso della Linea (m): da qui arriva la luce principale. */
  coreZ: number;
  /** Radenza: moltiplica la componente "dall'asse" della luce (1 = geometrica, < 1 più radente). */
  coreFlat: number;
  /** Componente laterale della luce (frazione del raggio, + = da Mane, - = da Sera). */
  coreSide: number;
  sunColor: RGB;
  ambientTop: RGB;
  ambientBottom: RGB;
  /** Foschia verso l'orizzonte (raggi radenti al fondo): più chiara. */
  hazeColor: RGB;
  /** Foschia verso lo "zenit" (raggi che attraversano il cilindro passando vicino all'asse): azzurro pieno. */
  hazeZenith: RGB;
  /** Colore della foschia in controluce, verso il nucleo (diffusione in avanti). */
  hazeSun: RGB;
  /** Moltiplicatore della densità dell'aria (foschie del mattino, aria limpida a mezzogiorno). */
  airDensity: number;
  lineaCore: RGB;
  lineaGlow: RGB;
  /** Intensità visiva del filamento (anche di notte, come brace). */
  lineaBrightness: number;
}

const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const mixc = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/**
 * Palette del cielo d'ottobre. Luce principale calda, riempimento freddo dal cielo (l'aria
 * azzurra del cilindro), rimbalzo caldo dal suolo; foschia azzurra di giorno, pesca e oro
 * all'alba e al tramonto, blu-viola di notte.
 */
const PAL = {
  sunDay: hex(0xfff0d2),
  sunGold: hex(0xffaa66),
  sunNight: hex(0x6a6ee0),
  ambTopDay: hex(0x93a7cf),
  ambTopGold: hex(0xa898c4),
  ambTopNight: hex(0x3e4088),
  ambBotDay: hex(0xa2906a),
  ambBotGold: hex(0xa47e60),
  // (il suolo di notte più scuro del cielo: il prato non è più lilla chiaro)
  ambBotNight: hex(0x141628),
  hazeDay: hex(0xbcd1e6),
  // all'alba e al tramonto la foschia è pesca (il controluce dorato del bozzetto 1)
  hazeGold: hex(0xf0c49a),
  hazeNight: hex(0x3a4288),
  zenithDay: hex(0x5286cc),
  zenithGold: hex(0x7884c4),
  zenithNight: hex(0x2c387e),
  hazeSunDay: hex(0xfff0d2),
  hazeSunGold: hex(0xffa452),
  hazeSunNight: hex(0x4a58c8),
  coreDay: hex(0xfffbec),
  coreGold: hex(0xffd9a0),
  coreEmber: hex(0x6f86ff),
  glowDay: hex(0xffe9c4),
  glowEmber: hex(0x3b4fd8),
  // fase rosa del crepuscolo (fra il tramonto dorato e il blu della notte, e prima dell'alba)
  hazeRosa: hex(0xe0909a),
  zenithRosa: hex(0x5a5aa0),
  ambTopRosa: hex(0xa088b8),
  sunRosa: hex(0xff9a7a),
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
  // (finestra larga: la luce dorata dura le prime e le ultime tre ore, come nei bozzetti)
  const golden = dayK * smoothstep(0.3, 1.0, fromMid);
  const night = 1 - dayK;
  // fase rosa: mentre la Linea si accende o si ritira (lit fra 0.9 e 0.3, circa 19:40-20:40 e
  // 5:35-5:55) il cielo passa per il rosa e il lilla prima del blu della notte
  const rosa = smoothstep(0.22, 0.5, lit) * (1 - smoothstep(0.72, 0.95, lit));
  // nella fase rosa la notte vela meno il cielo (il blu arriva dopo)
  const notteCielo = night * (1 - 0.6 * rosa);

  // inclinazione della luce (schermo girevole)
  const dayFrac = clamp((h - t.dawnStart) / (t.duskEnd - t.dawnStart), 0, 1);
  const tiltAlpha = (30 + 20 * Math.abs(Math.cos(Math.PI * dayFrac))) * (Math.PI / 180);
  const tiltBeta = Math.PI * dayFrac;

  // il nucleo: corre da sud a nord fra la fine dell'alba e l'inizio del tramonto
  const lineaIgnite = lit * L;
  const dayU = clamp((h - t.dawnEnd) / (t.duskStart - t.dawnEnd), 0, 1);
  let coreZ = lerp(CORE_Z_MORNING, CORE_Z_EVENING, dayU);
  // all'alba sta sulla punta della miccia finché non arriva al suo posto; al tramonto segue la brace
  if (h >= t.dawnStart && h < t.dawnEnd) coreZ = Math.min(coreZ, lineaIgnite);
  if (h >= t.duskStart || h < t.dawnStart) coreZ = Math.min(coreZ, Math.max(0, lineaIgnite - 60));
  // radenza: luce bassa nelle prime e nelle ultime ore, alta a mezzogiorno
  const arc = Math.sin(Math.PI * dayU);
  // nelle ore dorate la luce scende più radente (ombre lunghe), nella fase rosa quasi di lato
  const coreFlat = lerp(lerp(lerp(0.5, 0.3, golden), 0.18, rosa), 1, smoothstep(0, 0.75, arc));
  const coreSide = 0.32 * Math.cos(tiltBeta);

  const sunColor = mixc(mixc(mixc(PAL.sunDay, PAL.sunGold, golden), PAL.sunRosa, rosa * 0.6), PAL.sunNight, night);
  const res: SkyState = out ?? ({} as SkyState);
  res.hours = h;
  res.lineaIgnite = lineaIgnite;
  res.sunIntensity = lerp(0.1, 1, dayK);
  res.night = night;
  res.golden = golden;
  res.rosa = rosa;
  // luce principale più piena nelle ore dorate (il moltiplicatore va in uSole.w; sunIntensity resta
  // quella del giorno, che regola anche le termiche del Velo)
  res.forzaLuce = 1 + 0.2 * golden;
  res.tiltAlpha = tiltAlpha;
  res.tiltBeta = tiltBeta;
  res.coreZ = coreZ;
  res.coreFlat = coreFlat;
  res.coreSide = coreSide;
  res.sunColor = sunColor;
  res.ambientTop = mixc(mixc(mixc(PAL.ambTopDay, PAL.ambTopGold, golden), PAL.ambTopRosa, rosa * 0.7), PAL.ambTopNight, night);
  res.ambientBottom = mixc(mixc(PAL.ambBotDay, PAL.ambBotGold, golden), PAL.ambBotNight, night);
  res.hazeColor = mixc(mixc(mixc(PAL.hazeDay, PAL.hazeGold, golden * 0.85), PAL.hazeRosa, rosa), PAL.hazeNight, notteCielo);
  res.hazeZenith = mixc(mixc(mixc(PAL.zenithDay, PAL.zenithGold, golden * 0.8), PAL.zenithRosa, rosa), PAL.zenithNight, notteCielo);
  res.hazeSun = mixc(mixc(PAL.hazeSunDay, PAL.hazeSunGold, golden), PAL.hazeSunNight, night);
  res.airDensity = lerp(1, 1.18, golden) * lerp(1, 0.92, night);
  res.lineaCore = mixc(mixc(PAL.coreDay, PAL.coreGold, golden), PAL.coreEmber, night);
  res.lineaGlow = mixc(PAL.glowDay, PAL.glowEmber, night);
  res.lineaBrightness = lerp(0.45, 1, dayK);
  return res;
}

/**
 * Direzione (versore, verso la luce) della luce principale nel punto mondo (x, y, z):
 * verso il nucleo della Linea sull'asse, resa più radente da `coreFlat`, con la componente
 * laterale `coreSide`. È la stessa formula dello shader (`lineaLightDir` in
 * `render/shaders/common.ts`): usarla per luci CPU (prima persona, abitanti, ombre).
 */
export function keyLightDir(x: number, y: number, z: number, s: SkyState, out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 }): { x: number; y: number; z: number } {
  const r = Math.hypot(x, y);
  // terna locale: su = verso l'asse, est = tangente, nord = +z
  const ux = r > 1e-3 ? -x / r : 0;
  const uy = r > 1e-3 ? -y / r : 1;
  const ex = -uy;
  const ey = ux;
  const rr = Math.max(r, 40);
  const up = rr * s.coreFlat;
  const north = s.coreZ - z;
  const east = rr * s.coreSide;
  let lx = ux * up + ex * east;
  let ly = uy * up + ey * east;
  let lz = north;
  const n = Math.hypot(lx, ly, lz) || 1;
  lx /= n;
  ly /= n;
  lz /= n;
  out.x = lx;
  out.y = ly;
  out.z = lz;
  return out;
}
