/**
 * Le case di Corbella: i rustici in gneiss con il tetto di piode sulle particelle abitate del
 * nucleo (fade_fase1.json → particelle di tipo «abitato»), più le case con un nome nei contenuti:
 * la casa bassa di Pina sulla piazza (la soglia è il luogo `soglia_pina`) e la Casa del Velo
 * della Confraternita (finestre con le grate, un velo nero sulla porta).
 *
 * Le case stanno sui gradoni: la porta (davanti, +Z della libreria) è alla quota del suolo più
 * basso dell'impronta e il retro si interra nell'alzata, come i rustici costruiti nel pendio.
 * Davanti guardano la piazza (se vicine) o la valle.
 */
import { BoxGeometry, PlaneGeometry, Vector3 } from 'three';
import { Costruttore, mat } from '../../../oggetti/src/costruttore';
import { matriceSuperficie } from '../../../oggetti/src/cilindro';
import { creaRustico } from '../../../oggetti/src/oggetti/rustico';
import { PARTICELLE, luogo } from '../contenuti';
import type { Contesto } from '../contesto';
import { casaLontana, hash2 } from '../forme';
import { distanza, impronta, spostaYaw, suolo, yawValle, yawVerso } from '../terreno';
import { boxAt } from '../../../../src/world/colliders';

const CELLE_ABITATE = new Set(PARTICELLE.filter((p) => p.tipo === 'abitato' || p.tipo === 'piazza').map((p) => p.id));
/** I Ronchi hanno le loro casupole (ronchi.ts) */
const CELLE_ESCLUSE = new Set([2796, 2699, 2795, 2700, 2599, 2503]);

function cella(z: number, theta: number): number {
  return Math.floor(z / 40) * 96 + Math.floor(theta / 3.75);
}

export interface CasaPosata {
  nome: string;
  z: number;
  theta: number;
  yaw: number;
  base: number;
  larghezza: number;
  profondita: number;
  porta: Vector3;
}

/** Posa un rustico della libreria e registra impronta, punti e collider di porta. */
export function posaRustico(
  ctx: Contesto,
  zona: string,
  nome: string,
  z: number,
  theta: number,
  yaw: number,
  opz: Parameters<typeof creaRustico>[0] & { base?: number; luogo?: string },
): CasaPosata {
  const W = opz?.larghezza ?? 6;
  const D = opz?.profondita ?? 7;
  const fp = impronta(z, theta, yaw, W, D);
  const base = opz?.base ?? fp.min - 0.12;
  const interrata = Math.max(0.8, fp.max - base + 0.6);
  const casa = creaRustico({ ...opz, interrata });
  const punti = ctx.posa(zona, casa, z, theta, yaw, { h: base, tag: (t) => (t === 'muro' ? 'casa' : t ?? 'casa'), ...(opz?.luogo ? { luogo: opz.luogo } : {}) });
  if (zona.startsWith('case:')) {
    const piani = opz?.piani ?? 2;
    casaLontana(ctx.zona(zona).lontano, matriceSuperficie(z, theta, base, yaw), W, D, 2.5 + (piani - 1) * 2.45 + 0.35, interrata, Math.floor(z * 7 + theta));
  }
  // porta: collider sottile davanti all'uscio (tag 'porta') per chi interroga i collider
  const pl = casa.punti['porta']!;
  const pd = spostaYaw(z, theta, yaw, D / 2 + 0.05, base);
  const pdd = spostaYaw(pd.z, pd.theta, yaw - 90, pl.x, base);
  ctx.zona(zona).aggiungiCollider(boxAt(pdd.z, pdd.theta, base, yaw, 1.1, 2.0, 0.12), 'porta', opz?.luogo ?? nome);
  ctx.occupa({ nome, z, theta, yaw, larghezza: W + 0.3, profondita: D + 0.8 });
  casa.dispose();
  return { nome, z, theta, yaw, base, larghezza: W, profondita: D, porta: punti['porta']! };
}

interface Proposta {
  z: number;
  theta: number;
  yaw: number;
  W: number;
  D: number;
}

/**
 * Rustici generici sulle particelle abitate, a schiere come nei paesi ticinesi: si parte dai bordi
 * della piazza e dai vicoli, e ogni casa ne «chiama» altre accanto (lungo la curva di livello,
 * a 0,6-1,6 m) e una fila più su o più giù (oltre un vicolo di 3-4 m). Il davanti (timpano con la
 * porta) guarda la valle; sul bordo della piazza guarda la piazza.
 */
export function costruisciCase(ctx: Contesto, quante = 58): CasaPosata[] {
  const piazza = luogo('piazza_ore');
  const ronchi = luogo('i_ronchi');
  const out: CasaPosata[] = [];
  const coda: Proposta[] = [];
  let seme = 0;
  const misura = () => {
    const r = hash2(seme * 1.7, seme * 0.37, 9);
    const r2 = hash2(seme * 0.91, seme * 2.3, 11);
    seme++;
    return { W: 5 + r * 2.0, D: 6 + r2 * 2.4, r, r2 };
  };
  // 1. corona della piazza: case con la facciata sulla piazza (lati a Sera, a Mont e a Lag)
  for (let ang = 0; ang < 360; ang += 17) {
    const a = ang + (hash2(ang, 3, 1) - 0.5) * 5;
    const m = misura();
    const r = piazza.raggio + 2.4 + m.D / 2;
    const c = spostaYaw(piazza.z, piazza.theta, a, r, 38.5);
    coda.push({ ...c, yaw: yawVerso(c, piazza), W: m.W, D: m.D });
  }
  // 2. semi lungo i vicoli verso la Cripta e verso i Ronchi, e a Mont della piazza
  for (const [z, th] of [
    [1078, 32.0],
    [1094, 30.4],
    [1086, 35.6],
    [1104, 33.4],
    [1112, 38.0],
    [1132, 36.4],
    [1150, 39.4],
    [1120, 41.2],
    [1094, 40.6],
    [1080, 43.6],
    [1022, 33.0],
    [1012, 40.2],
    [1030, 43.0],
    [1060, 44.5],
    [1140, 33.2],
  ] as const) {
    const m = misura();
    coda.push({ z, theta: th, yaw: yawValle(z, th) + (hash2(z, th, 4) - 0.5) * 14, W: m.W, D: m.D });
  }
  let tentativi = 0;
  while (coda.length && out.length < quante && tentativi < 900) {
    tentativi++;
    const p = coda.shift()!;
    const c = cella(p.z, p.theta);
    if (!CELLE_ABITATE.has(c) || CELLE_ESCLUSE.has(c)) continue;
    if (distanza(p, ronchi) < 30) continue;
    if (distanza(p, piazza) < piazza.raggio + 1.8 + p.D / 2 - 0.5) continue;
    const fp = impronta(p.z, p.theta, p.yaw, p.W + 0.6, p.D + 0.6);
    if (fp.max - fp.min > 3.9) continue;
    if (ctx.occupato(p.z, p.theta, 0.3) || occupatoRett(ctx, p, 0.35)) continue;
    if (vicinoSentieri(ctx, p, 0.9)) continue;
    const m = { r: hash2(p.z, p.theta, 9), r2: hash2(p.theta, p.z, 11) };
    const piani = (m.r2 < 0.12 ? 1 : m.r < 0.32 ? 3 : 2) as 1 | 2 | 3;
    const i = out.length;
    const casa = posaRustico(ctx, `case:${Math.floor(p.z / 70)}:${Math.floor(p.theta / 8)}`, `rustico_${i}`, p.z, p.theta, p.yaw, {
      seme: `corbella-${i}`,
      larghezza: p.W,
      profondita: p.D,
      piani,
      finestreAccese: 0.4 + m.r * 0.35,
      gerani: 0.4,
      dettaglio: distanza(p, piazza) < 55 ? 'alto' : 'medio',
    });
    out.push(casa);
    // vicine di schiera (accanto, lungo la curva di livello) e la fila sopra/sotto oltre il vicolo
    const vicini: Array<[number, number]> = [
      [90, 1],
      [-90, 1],
      [0, 0],
      [180, 0],
    ];
    for (const [rot, schiera] of vicini) {
      const n = misura();
      const gap = schiera ? 0.6 + hash2(p.z, rot, 6) * 1.0 : 3.2 + hash2(p.theta, rot, 7) * 1.2;
      const d = schiera ? p.W / 2 + n.W / 2 + gap : p.D / 2 + n.D / 2 + gap;
      const q = spostaYaw(p.z, p.theta, p.yaw + rot, d, 40);
      const yawN = distanza(q, piazza) < piazza.raggio + 9 ? yawVerso(q, piazza) : schiera ? p.yaw + (hash2(q.z, q.theta, 8) - 0.5) * 8 : yawValle(q.z, q.theta) + (hash2(q.z, q.theta, 8) - 0.5) * 10;
      coda.push({ ...q, yaw: yawN, W: n.W, D: n.D });
    }
  }
  return out;
}

/** La proposta tocca un'impronta già occupata (controllo sui quattro spigoli e sul centro)? */
function occupatoRett(ctx: Contesto, p: Proposta, margine: number): boolean {
  for (const [a, b] of [
    [-p.W / 2, -p.D / 2],
    [p.W / 2, -p.D / 2],
    [-p.W / 2, p.D / 2],
    [p.W / 2, p.D / 2],
    [0, p.D / 2],
    [0, -p.D / 2],
    [p.W / 2, 0],
    [-p.W / 2, 0],
  ] as const) {
    const q = spostaYaw(p.z, p.theta, p.yaw, b, 40);
    const r = spostaYaw(q.z, q.theta, p.yaw + 90, a, 40);
    if (ctx.occupato(r.z, r.theta, margine)) return true;
  }
  return false;
}

function vicinoSentieri(ctx: Contesto, p: Proposta, margine: number): boolean {
  for (const [a, b] of [
    [0, 0],
    [-p.W / 2, -p.D / 2],
    [p.W / 2, -p.D / 2],
    [-p.W / 2, p.D / 2],
    [p.W / 2, p.D / 2],
    [0, p.D / 2 + 1.2],
  ] as const) {
    const q = spostaYaw(p.z, p.theta, p.yaw, b, 40);
    const r = spostaYaw(q.z, q.theta, p.yaw + 90, a, 40);
    if (ctx.distanzaSentieri(r.z, r.theta) < margine) return true;
  }
  return false;
}

/** La casa bassa di Pina sulla piazza: la soglia è il luogo `soglia_pina`. */
export function costruisciCasaPina(ctx: Contesto): CasaPosata {
  const s = luogo('soglia_pina');
  const piazza = luogo('piazza_ore');
  const yaw = yawVerso(s, piazza);
  const W = 5.4;
  const D = 6.4;
  const c = spostaYaw(s.z, s.theta, yaw + 180, D / 2 + 0.35, 39);
  const base = suolo(s.z, s.theta) - 0.08;
  const casa = posaRustico(ctx, 'piazza', 'casa_pina', c.z, c.theta, yaw, {
    seme: 'casa-pina',
    larghezza: W,
    profondita: D,
    piani: 1,
    balcone: 'nessuno',
    gerani: 0.8,
    finestreAccese: 1,
    camino: true,
    base,
    luogo: 'soglia_pina',
  });
  // gradino della soglia, sgabello e scatola dei cartoni
  const b = new Costruttore(77);
  b.aggiungi(new BoxGeometry(1.6, 0.22, 0.7), { matrice: mat([0, 0.11, 0]), colore: 0x9a948a, variazione: 0.05, piatto: true });
  b.aggiungi(new BoxGeometry(0.5, 0.42, 0.35), { matrice: mat([-1.1, 0.21, 0.35]), colore: 0x6a5546, piatto: true });
  b.aggiungi(new BoxGeometry(0.62, 0.22, 0.42), { matrice: mat([1.05, 0.11, 0.4], [0, 0.3, 0]), colore: 0xb48a52, variazione: 0.05, piatto: true });
  b.aggiungi(new BoxGeometry(0.6, 0.02, 0.4), { matrice: mat([1.05, 0.23, 0.4], [0, 0.3, 0]), colore: 0xd6b878, piatto: true });
  // figure di cartone che spuntano
  for (let k = 0; k < 5; k++) b.aggiungi(new PlaneGeometry(0.12, 0.22), { matrice: mat([0.9 + k * 0.07, 0.32, 0.4 + (k % 2) * 0.05], [0, 0.3, 0]), colore: 0xc69a55, canale: 'sottile' });
  const punti = ctx.posa('piazza', b.costruisci('soglia-pina'), s.z, s.theta, yaw, { h: base });
  void punti;
  const scatola = ctx.qui(s.z, s.theta, 0.3);
  ctx.punto('guarda:scatola_pina', 'guarda', 'Guarda nella scatola dei cartoni', scatola, { raggio: 2.2, luogo: 'soglia_pina', rif: 'flag:figura_presa' });
  return casa;
}

/** La Casa del Velo: tre piani, grate alle finestre, un velo nero sulla porta. */
export function costruisciCasaVelo(ctx: Contesto): CasaPosata {
  const l = luogo('casa_del_velo');
  const piazza = luogo('piazza_ore');
  const yaw = yawVerso(l, piazza) + 8;
  const W = 5.5;
  const D = 7.8;
  const casa = posaRustico(ctx, 'nucleo', 'casa_del_velo', l.z, l.theta, yaw, {
    seme: 'casa-del-velo',
    larghezza: W,
    profondita: D,
    piani: 3,
    balcone: 'nessuno',
    gerani: 0,
    finestreAccese: 0.6,
    scalaEsterna: false,
    camino: true,
    luogo: 'casa_del_velo',
  });
  // velo nero sulla porta e grate (sbarre di ferro sulla facciata)
  const b = new Costruttore(91);
  const veloG = new PlaneGeometry(1.25, 2.2, 6, 4);
  const pos = veloG.getAttribute('position');
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 9) * 0.04 * (1 - (pos.getY(i) + 1.1) / 2.2));
  b.aggiungi(veloG, { matrice: mat([0, 1.05, D / 2 + 0.08]), colore: 0x16141a, canale: 'sottile' });
  b.aggiungi(new BoxGeometry(1.5, 0.05, 0.08), { matrice: mat([0, 2.18, D / 2 + 0.08]), colore: 0x2a2622, piatto: true });
  // finestre della facciata (W < 5,8: una per piano al centro, davanzale a quota piano + 0,95)
  for (const yPiano of [2.5, 4.95]) {
    for (let k = -2; k <= 2; k++) b.aggiungi(new BoxGeometry(0.028, 0.9, 0.028), { matrice: mat([k * 0.13, yPiano + 1.38, D / 2 + 0.12]), colore: 0x26242a, piatto: true });
    for (const dy of [0.97, 1.8]) b.aggiungi(new BoxGeometry(0.62, 0.03, 0.03), { matrice: mat([0, yPiano + dy, D / 2 + 0.12]), colore: 0x26242a, piatto: true });
  }
  ctx.zona('nucleo').oggetto(b.costruisci('casa-velo-dettagli'), matriceSuperficie(l.z, l.theta, casa.base, yaw), { lumi: false });
  ctx.punto('apri:casa_del_velo', 'apri', 'Porta della Casa del Velo', casa.porta, { raggio: 2, luogo: 'casa_del_velo', rif: 'flag:dorme_casa_velo' });
  ctx.punto('dormi:casa_del_velo', 'dormi', 'Dormi nella Casa del Velo', casa.porta.clone(), { raggio: 2, luogo: 'casa_del_velo', rif: 'flag:dorme_casa_velo', attivo: false });
  return casa;
}
