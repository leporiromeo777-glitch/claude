/**
 * Piazza delle Ore: selciato tondo a ciottoli bianchi e neri che è una meridiana (le linee delle
 * ore convergono verso il Sordo, una più scura punta a Lag e a Mane), la Bacheca delle Ore sotto
 * la tettoia di piode, il telo dell'Ombrista fra due pali con la lampada a olio, i gradini dove
 * siede il pubblico, le panche e i lampioni.
 */
import { luogo } from '../contenuti';
import type { Contesto } from '../contesto';
import { hex, mix, type RGB } from '../cantiere';
import { discoSulSuolo, hash2, rumore2 } from '../forme';

const CIOTTOLO_CHIARO: RGB = hex(0xd9d0bd);
const CIOTTOLO_GRIGIO: RGB = hex(0xa69f93);
const CIOTTOLO_SCURO: RGB = hex(0x4b4650);
const CORDOLO: RGB = hex(0x8d877f);

/** Colore del selciato a meridiana in (x est, y nord) dal centro. */
export function coloreMeridiana(x: number, y: number, r: number, raggio: number): RGB {
  // ciottoli: macchie chiare e grigie a scala 0.35 m
  const n = rumore2(x / 0.35, y / 0.35, 3) * 0.6 + rumore2(x / 1.4, y / 1.4, 7) * 0.4;
  let c = mix(CIOTTOLO_CHIARO, CIOTTOLO_GRIGIO, Math.min(1, Math.max(0, (n - 0.35) * 1.6)));
  const fine = hash2(Math.floor(x / 0.22), Math.floor(y / 0.22), 1);
  c = mix(c, CIOTTOLO_GRIGIO, fine < 0.18 ? 0.5 : 0);
  // cordolo esterno e anello delle ore
  if (r > raggio - 0.7) return mix(CORDOLO, CIOTTOLO_SCURO, 0.25 + 0.2 * fine);
  if (Math.abs(r - (raggio - 2.2)) < 0.22) return mix(CIOTTOLO_SCURO, c, 0.15);
  if (r < 0.9) return mix(CIOTTOLO_SCURO, c, 0.1);
  // linee delle ore: rette che passano per un punto lontano a Lag (il Sordo, 1750 m a nord)
  const V = { x: 0, y: 1750 };
  for (let k = -5; k <= 5; k++) {
    const sx = k * 2.6;
    const sy = -raggio;
    const dx = V.x - sx;
    const dy = V.y - sy;
    const l = Math.hypot(dx, dy);
    const d = Math.abs((x - sx) * dy - (y - sy) * dx) / l;
    if (y > raggio - 2.2) continue;
    if (d < 0.11) return mix(CIOTTOLO_SCURO, c, 0.12 + fine * 0.1);
  }
  // la linea più scura: punta a Lag e a Mane (un punto preciso della parete del Sordo)
  const ang = (12 * Math.PI) / 180;
  const d2 = Math.abs(x * Math.cos(ang) - y * Math.sin(ang));
  if (d2 < 0.17 && y > -raggio + 3 && r < raggio - 2.2) return hex(0x2c2830);
  return c;
}

export function costruisciPiazza(ctx: Contesto): void {
  const p = luogo('piazza_ore');
  const raggio = p.raggio;
  discoSulSuolo(ctx.zona('piazza'), p.z, p.theta, raggio, 0.3, 0.04, (x, y, r) => coloreMeridiana(x, y, r, raggio));
  ctx.occupa({ nome: 'piazza_ore', z: p.z, theta: p.theta, raggio: raggio + 1 });
}
