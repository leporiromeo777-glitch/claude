/**
 * Muri a secco delle terrazze: seguono le alzate dei gradoni del terreno del motore.
 *
 * Le alzate si trovano con le curve di livello (marching squares) del suolo alle quote
 * k·3,5 + 0,5 m (appena sopra il piano inferiore). Ogni curva diventa una catena di muri di
 * sostegno (`creaMuroSecco` con `terrapieno`) con la faccia verso valle: il piede sul piano di
 * sotto, la testa al livello del piano di sopra. Dove passa un sentiero si apre un varco (i gradini
 * li mette il sentiero); dentro le impronte (case, piattaforme) non si costruisce.
 */
import { matriceSuperficie } from '../../oggetti/src/cilindro';
import { creaMuroSecco } from '../../oggetti/src/oggetti/muri';
import type { Contesto } from './contesto';
import { muroLontano } from './forme';
import { metriPerGrado, sposta, suolo } from './terreno';

export interface Regione {
  z0: number;
  theta0: number;
  /** estremi in metri locali (x = est, y = nord) */
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  passo: number;
}

export type Spezzata = Array<[number, number]>; // (x est, y nord) in metri locali

/** Curve di livello del suolo alla quota `livello` nella regione. */
export function curveDiLivello(r: Regione, griglia: Float32Array, nx: number, ny: number, livello: number): Spezzata[] {
  const segmenti: Array<[[number, number], [number, number], string, string]> = [];
  const X = (i: number) => r.xMin + i * r.passo;
  const Y = (j: number) => r.yMin + j * r.passo;
  const v = (i: number, j: number) => griglia[j * nx + i]! - livello;
  const interp = (i0: number, j0: number, i1: number, j1: number): [number, number] => {
    const a = v(i0, j0);
    const b = v(i1, j1);
    const t = a / (a - b);
    return [X(i0) + (X(i1) - X(i0)) * t, Y(j0) + (Y(j1) - Y(j0)) * t];
  };
  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = v(i, j) > 0 ? 1 : 0;
      const b = v(i + 1, j) > 0 ? 2 : 0;
      const c = v(i + 1, j + 1) > 0 ? 4 : 0;
      const d = v(i, j + 1) > 0 ? 8 : 0;
      const caso = a | b | c | d;
      if (caso === 0 || caso === 15) continue;
      // lati: 0 basso (i,j)-(i+1,j), 1 destra, 2 alto, 3 sinistra
      const lato = (k: number): [[number, number], string] => {
        if (k === 0) return [interp(i, j, i + 1, j), `h${i},${j}`];
        if (k === 1) return [interp(i + 1, j, i + 1, j + 1), `v${i + 1},${j}`];
        if (k === 2) return [interp(i, j + 1, i + 1, j + 1), `h${i},${j + 1}`];
        return [interp(i, j, i, j + 1), `v${i},${j}`];
      };
      const coppie: Array<[number, number]> = [];
      switch (caso) {
        case 1: case 14: coppie.push([3, 0]); break;
        case 2: case 13: coppie.push([0, 1]); break;
        case 3: case 12: coppie.push([3, 1]); break;
        case 4: case 11: coppie.push([1, 2]); break;
        case 6: case 9: coppie.push([0, 2]); break;
        case 7: case 8: coppie.push([3, 2]); break;
        case 5: coppie.push([3, 0], [1, 2]); break;
        case 10: coppie.push([0, 1], [2, 3]); break;
      }
      for (const [p, q] of coppie) {
        const [pa, ka] = lato(p);
        const [pb, kb] = lato(q);
        segmenti.push([pa, pb, ka, kb]);
      }
    }
  }
  // unisce i segmenti in spezzate
  const perChiave = new Map<string, number[]>();
  segmenti.forEach((s, idx) => {
    for (const k of [s[2], s[3]]) {
      const l = perChiave.get(k) ?? [];
      l.push(idx);
      perChiave.set(k, l);
    }
  });
  const usato = new Uint8Array(segmenti.length);
  const out: Spezzata[] = [];
  for (let s0 = 0; s0 < segmenti.length; s0++) {
    if (usato[s0]) continue;
    usato[s0] = 1;
    const seg = segmenti[s0]!;
    const linea: Array<[number, number]> = [seg[0], seg[1]];
    for (const verso of [1, -1]) {
      let chiave = verso > 0 ? seg[3] : seg[2];
      for (;;) {
        const cand = (perChiave.get(chiave) ?? []).find((x) => !usato[x]);
        if (cand === undefined) break;
        usato[cand] = 1;
        const s = segmenti[cand]!;
        const [pt, prossima] = s[2] === chiave ? [s[1], s[3]] : [s[0], s[2]];
        if (verso > 0) linea.push(pt);
        else linea.unshift(pt);
        chiave = prossima;
      }
    }
    out.push(linea);
  }
  return out;
}

/** Griglia delle quote del suolo nella regione. */
export function grigliaQuote(r: Regione): { griglia: Float32Array; nx: number; ny: number } {
  const nx = Math.floor((r.xMax - r.xMin) / r.passo) + 1;
  const ny = Math.floor((r.yMax - r.yMin) / r.passo) + 1;
  const g = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = locale(r, r.xMin + i * r.passo, r.yMin + j * r.passo);
      g[j * nx + i] = suolo(p.z, p.theta);
    }
  }
  return { griglia: g, nx, ny };
}

export function locale(r: Regione, x: number, y: number): { z: number; theta: number } {
  return sposta(r.z0, r.theta0, y, x, 40);
}

/** Lunghezza di una spezzata. */
export function lunghezza(s: Spezzata): number {
  let l = 0;
  for (let i = 1; i < s.length; i++) l += Math.hypot(s[i]![0] - s[i - 1]![0], s[i]![1] - s[i - 1]![1]);
  return l;
}

/** Smussa una spezzata (Chaikin), tenendo gli estremi. */
export function smussa(s: Spezzata, iterazioni = 2): Spezzata {
  let p = s;
  for (let it = 0; it < iterazioni; it++) {
    if (p.length < 3) return p;
    const q: Spezzata = [p[0]!];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i]!;
      const b = p[i + 1]!;
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]!);
    p = q;
  }
  return p;
}

/** Media mobile sui punti interni (toglie il dente di sega del marching squares). */
export function media(s: Spezzata, raggio = 2): Spezzata {
  return s.map((pt, i) => {
    if (i === 0 || i === s.length - 1) return pt;
    let x = 0;
    let y = 0;
    let n = 0;
    for (let k = Math.max(0, i - raggio); k <= Math.min(s.length - 1, i + raggio); k++) {
      x += s[k]![0];
      y += s[k]![1];
      n++;
    }
    return [x / n, y / n] as [number, number];
  });
}

/** Ricampiona e semplifica una spezzata a passo ~`passo`. */
export function semplifica(s: Spezzata, passo: number): Spezzata {
  const out: Spezzata = [s[0]!];
  let acc = 0;
  for (let i = 1; i < s.length; i++) {
    acc += Math.hypot(s[i]![0] - s[i - 1]![0], s[i]![1] - s[i - 1]![1]);
    if (acc >= passo || i === s.length - 1) {
      out.push(s[i]!);
      acc = 0;
    }
  }
  return out;
}

export interface OpzioniMuriTerrazze {
  regione: Regione;
  /** zone del contesto in cui mettere i muri (una per riquadro di ~80 m per il culling) */
  prefissoZona: string;
  /** il punto (z, theta) va saltato? (piazza, riale, luoghi speciali) */
  escludi?: (z: number, theta: number) => boolean;
  /** dettaglio dei muri */
  dettaglio?: (z: number, theta: number) => 'alto' | 'basso';
  passoGradoni?: number;
  livelloMin?: number;
  livelloMax?: number;
  /** altezza minima per costruire un muro (m) */
  altezzaMin?: number;
}

/** Costruisce i muri delle terrazze. Restituisce la lunghezza totale costruita (m). */
export function costruisciMuriTerrazze(ctx: Contesto, opz: OpzioniMuriTerrazze): { metri: number; pezzi: number } {
  const r = opz.regione;
  const passoG = opz.passoGradoni ?? 3.5;
  const { griglia, nx, ny } = grigliaQuote(r);
  let min = Infinity;
  let max = -Infinity;
  for (const q of griglia) {
    min = Math.min(min, q);
    max = Math.max(max, q);
  }
  const k0 = Math.max(Math.floor(min / passoG), Math.floor((opz.livelloMin ?? 0) / passoG));
  const k1 = Math.min(Math.ceil(max / passoG), Math.ceil((opz.livelloMax ?? 1e9) / passoG));
  let metri = 0;
  let pezzi = 0;
  const kdeg = metriPerGrado(40);
  for (let k = k0; k <= k1; k++) {
    const livello = k * passoG + 0.45;
    for (const curva of curveDiLivello(r, griglia, nx, ny, livello)) {
      if (lunghezza(curva) < 3) continue;
      const linea = semplifica(smussa(media(curva, 3), 1), 1.0);
      // taglia in pezzi validi
      let pezzo: Spezzata = [];
      const chiudi = () => {
        if (pezzo.length >= 2 && lunghezza(pezzo) >= 1.8) {
          const fatto = muroSuPezzo(ctx, opz, r, pezzo, kdeg);
          if (fatto > 0) {
            metri += fatto;
            pezzi++;
          }
        }
        pezzo = [];
      };
      for (let i = 0; i < linea.length; i++) {
        const [x, y] = linea[i]!;
        const p = locale(r, x, y);
        const valido = !(opz.escludi?.(p.z, p.theta) ?? false) && !ctx.occupato(p.z, p.theta, 0.6) && ctx.distanzaSentieri(p.z, p.theta) > 0.9;
        if (!valido) {
          chiudi();
          continue;
        }
        pezzo.push([x, y]);
        if (lunghezza(pezzo) >= 4.2) {
          const ultimo = pezzo[pezzo.length - 1]!;
          chiudi();
          pezzo.push(ultimo);
        }
      }
      chiudi();
    }
  }
  return { metri, pezzi };
}

/** Un tratto di muro di sostegno lungo il pezzo di curva. Restituisce la lunghezza o 0. */
function muroSuPezzo(ctx: Contesto, opz: OpzioniMuriTerrazze, r: Regione, pezzo: Spezzata, kdeg: number): number {
  void kdeg;
  const a = pezzo[0]!;
  const b = pezzo[pezzo.length - 1]!;
  const m = pezzo[Math.floor(pezzo.length / 2)]!;
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  const l = Math.hypot(dx, dy);
  if (l < 1e-3) return 0;
  dx /= l;
  dy /= l;
  // Nel riferimento della libreria con yaw 0: X locale = OVEST, Z locale = nord. La faccia del muro
  // guarda a destra del verso nel riferimento della libreria: in (est, nord) è (dy, -dx).
  let nx = dy;
  let ny = -dx;
  const pm = locale(r, m[0], m[1]);
  const qa = suolo(...xy(locale(r, m[0] + nx * 1.5, m[1] + ny * 1.5)));
  const qb = suolo(...xy(locale(r, m[0] - nx * 1.5, m[1] - ny * 1.5)));
  if (qa > qb) {
    pezzo.reverse();
    nx = -nx;
    ny = -ny;
  }
  // misure: piede a valle, testa a monte
  let piede = Infinity;
  let testa = -Infinity;
  for (const [x, y] of pezzo) {
    piede = Math.min(piede, suolo(...xy(locale(r, x + nx * 1.0, y + ny * 1.0))), suolo(...xy(locale(r, x, y))));
    testa = Math.max(testa, suolo(...xy(locale(r, x - nx * 2.2, y - ny * 2.2))));
  }
  const alto = Math.min(testa - piede, 4.2);
  if (alto < (opz.altezzaMin ?? 1.4)) return 0;
  const origine = locale(r, pezzo[0]![0], pezzo[0]![1]);
  // coordinate della libreria: X = ovest, Z = nord
  const percorso: Array<[number, number]> = pezzo.map(([x, y]) => [-(x - pezzo[0]![0]), y - pezzo[0]![1]]);
  const dettaglio = opz.dettaglio?.(pm.z, pm.theta) ?? 'basso';
  const muro = creaMuroSecco({
    seme: Math.floor(pm.z * 31 + pm.theta * 977),
    percorso: percorso.map(([x, y]) => [x, y]),
    altezza: alto + 0.2,
    spessore: 0.7,
    scarpa: 0.1,
    terrapieno: true,
    pietra: dettaglio === 'alto' ? 0.5 : 0.62,
    dettaglio,
    interrata: 0.7,
  });
  const zona = `${opz.prefissoZona}:${Math.floor(pm.z / 80)}:${Math.floor(pm.theta / 7)}`;
  ctx.posa(zona, muro, origine.z, origine.theta, 0, { h: piede, tag: () => 'muro', lumi: false });
  muro.dispose();
  // versione lontana: nastro semplice
  const cz = ctx.zona(zona);
  cz.distanzaLod = 170;
  muroLontano(cz.lontano, matriceSuperficie(origine.z, origine.theta, piede, 0), percorso, alto + 0.2, 0.7, Math.floor(pm.z));
  return lunghezza(pezzo);
}

function xy(p: { z: number; theta: number }): [number, number] {
  return [p.z, p.theta];
}
