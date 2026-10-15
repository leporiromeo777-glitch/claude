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
  ctx.occupa({ nome, z, theta, yaw, larghezza: W + 1.2, profondita: D + 1.6 });
  casa.dispose();
  return { nome, z, theta, yaw, base, larghezza: W, profondita: D, porta: punti['porta']! };
}

/** Rustici generici sulle particelle abitate. */
export function costruisciCase(ctx: Contesto, quante = 44): CasaPosata[] {
  const piazza = luogo('piazza_ore');
  const ronchi = luogo('i_ronchi');
  const out: CasaPosata[] = [];
  const candidati: Array<{ z: number; theta: number; k: number }> = [];
  for (let z = 996; z <= 1206; z += 3) {
    for (let th = 26.2; th <= 50; th += 0.29) {
      const zz = z + (hash2(z, th, 1) - 0.5) * 2.4;
      const tt = th + (hash2(z, th, 2) - 0.5) * 0.24;
      const c = cella(zz, tt);
      if (!CELLE_ABITATE.has(c) || CELLE_ESCLUSE.has(c)) continue;
      // più case vicino alla piazza: ordine casuale pesato dalla distanza
      const d = distanza({ z: zz, theta: tt }, piazza);
      candidati.push({ z: zz, theta: tt, k: hash2(zz * 3.1, tt * 7.7, 3) * 0.6 + Math.min(1, d / 140) * 0.4 });
    }
  }
  candidati.sort((a, b) => a.k - b.k);
  let i = 0;
  for (const c of candidati) {
    if (out.length >= quante) break;
    if (distanza(c, ronchi) < 34) continue;
    if (distanza(c, piazza) < piazza.raggio + 6) continue;
    const r = hash2(c.z, c.theta, 9);
    const r2 = hash2(c.theta, c.z, 11);
    const W = 5 + r * 2.2;
    const D = 6 + r2 * 2.6;
    const vicinoPiazza = distanza(c, piazza) < 31;
    let yaw = vicinoPiazza ? yawVerso(c, piazza) : yawValle(c.z, c.theta);
    yaw += (hash2(c.z, c.theta, 5) - 0.5) * 16;
    // le case lontane dalla piazza si allineano un po' alle curve di livello (colmo lungo il pendio)
    const fp = impronta(c.z, c.theta, yaw, W + 1, D + 1);
    if (fp.max - fp.min > 3.9) continue;
    // spazio libero (case, luoghi, piattaforme) e distanza dai sentieri
    if (ctx.occupato(c.z, c.theta, Math.max(W, D) * 0.62 + 1.4)) continue;
    let troppoVicino = false;
    for (const [a, b] of [
      [0, 0],
      [-W / 2, -D / 2],
      [W / 2, -D / 2],
      [-W / 2, D / 2],
      [W / 2, D / 2],
      [0, D / 2 + 1.5],
    ] as const) {
      const p = spostaYaw(c.z, c.theta, yaw, b, 40);
      const q = spostaYaw(p.z, p.theta, yaw + 90, a, 40);
      if (ctx.distanzaSentieri(q.z, q.theta) < 1.0) {
        troppoVicino = true;
        break;
      }
    }
    if (troppoVicino) continue;
    const piani = (r2 < 0.2 ? 1 : r < 0.25 ? 3 : 2) as 1 | 2 | 3;
    const casa = posaRustico(ctx, `case:${Math.floor(c.z / 70)}:${Math.floor(c.theta / 8)}`, `rustico_${i}`, c.z, c.theta, yaw, {
      seme: `corbella-${i}`,
      larghezza: W,
      profondita: D,
      piani,
      finestreAccese: 0.45 + r * 0.3,
      gerani: 0.35,
      dettaglio: 'alto',
    });
    out.push(casa);
    i++;
  }
  return out;
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
