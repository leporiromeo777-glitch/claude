/**
 * Sentieri sul terreno del motore, con i gradini dove il terreno è troppo ripido.
 *
 * I gradoni del paese hanno alzate di 3,5 m quasi verticali (60°): a piedi non si salgono
 * (limite del controller 47°). Ogni sentiero calcola il profilo «camminabile» lungo il suo
 * tracciato (rampa di al massimo ~30° sopra il suolo) e, dove il profilo sta sopra il suolo,
 * mette gradini (lastre di gneiss o assi) con alzate ≤ 0,4 m e un collider per gradino: il
 * controller del motore li sale come scalini (stepHeight 0,5 m).
 *
 * Il sentiero lascia anche il suo nastro sul suolo (lastre, terra battuta o prato pettinato) e si
 * registra nel contesto: i muri delle terrazze vi aprono un varco, le case lo evitano.
 */
import { BoxGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { geoLastra } from '../oggetti/forme';
import { Costruttore, mat } from '../oggetti/costruttore';
import { boxAt } from '../world/colliders';
import { cylToWorld, localFrameTheta } from '../world/cylinder';
import { hex, mix, type Cantiere, type RGB } from './cantiere';
import type { Contesto } from './contesto';
import { hash2, nastroSulSuolo, rumore2 } from './forme';
import { metriPerGrado, sposta, suolo, type PuntoCil } from './terreno';

export type TipoSentiero = 'lastre' | 'battuto' | 'pettinato' | 'erba';

export interface OpzioniSentiero {
  larghezza?: number;
  tipo?: TipoSentiero;
  /** materiale dei gradini */
  gradini?: 'pietra' | 'assi' | 'nessuno';
  /** pendenza massima del profilo camminabile (gradi) */
  pendenzaMax?: number;
  /** alzata massima dei gradini (m) */
  alzata?: number;
  /** registra il sentiero nel contesto (varchi nei muri, case lontane) */
  registra?: boolean;
  /** disegna il nastro sul suolo */
  nastro?: boolean;
  /** tag dei collider dei gradini */
  tag?: string;
  luogo?: string;
  seme?: number;
}

export interface CampioneSentiero {
  z: number;
  theta: number;
  s: number;
  suolo: number;
  cammino: number;
  /** direzione (nord, est) normalizzata */
  dn: number;
  de: number;
}

/** Ricampiona la spezzata ogni `passo` metri. */
export function campionaSentiero(punti: PuntoCil[], passo = 0.5): CampioneSentiero[] {
  const k = metriPerGrado(40);
  const out: CampioneSentiero[] = [];
  let s = 0;
  for (let i = 0; i < punti.length - 1; i++) {
    const a = punti[i]!;
    const b = punti[i + 1]!;
    const dn = b.z - a.z;
    const de = (((b.theta - a.theta + 540) % 360) - 180) * k;
    const l = Math.hypot(dn, de);
    if (l < 1e-6) continue;
    const n = Math.max(1, Math.ceil(l / passo));
    const ultimo = i === punti.length - 2;
    for (let j = 0; j < n + (ultimo ? 1 : 0); j++) {
      const t = j / n;
      const p = sposta(a.z, a.theta, dn * t, de * t, 40);
      const g = suolo(p.z, p.theta);
      out.push({ z: p.z, theta: p.theta, s: s + l * t, suolo: g, cammino: g, dn: dn / l, de: de / l });
    }
    s += l;
  }
  return out;
}

/** Profilo camminabile: il minimo sopra il suolo con pendenza ≤ `gradi`. */
export function profiloCamminabile(c: CampioneSentiero[], gradi = 30): void {
  const t = Math.tan((gradi * Math.PI) / 180);
  for (let i = 0; i < c.length; i++) c[i]!.cammino = c[i]!.suolo;
  for (let i = 1; i < c.length; i++) {
    const ds = c[i]!.s - c[i - 1]!.s;
    c[i]!.cammino = Math.max(c[i]!.cammino, c[i - 1]!.cammino - ds * t);
  }
  for (let i = c.length - 2; i >= 0; i--) {
    const ds = c[i + 1]!.s - c[i]!.s;
    c[i]!.cammino = Math.max(c[i]!.cammino, c[i + 1]!.cammino - ds * t);
  }
}

const LASTRA: RGB = hex(0xa59e94);
const LASTRA_SCURA: RGB = hex(0x7c766f);
const TERRA: RGB = hex(0x9a7e58);
const TERRA_SCURA: RGB = hex(0x7a6244);
const ERBA_PETTINATA: RGB = hex(0x9db45a);

function coloreNastro(tipo: TipoSentiero, s: number, u: number): RGB {
  if (tipo === 'lastre') {
    const h = hash2(Math.floor(s / 0.7), Math.floor((u + 1) * 1.5), 5);
    const base = mix(LASTRA, LASTRA_SCURA, h * 0.6);
    return Math.abs(u) > 0.92 ? mix(base, TERRA_SCURA, 0.5) : base;
  }
  if (tipo === 'pettinato') {
    // il prato «pettinato come da una mano enorme»: strisce regolari chiare e scure
    const str = Math.sin(u * 9.5 + s * 0.15) * 0.5 + 0.5;
    return mix(ERBA_PETTINATA, hex(0x7f9a45), str * 0.6);
  }
  if (tipo === 'erba') return mix(hex(0x87a148), hex(0x9cb556), rumore2(s * 0.6, u * 2, 2));
  const n = rumore2(s * 0.8, u * 2.5, 4);
  const bordo = Math.abs(u) > 0.7 ? 0.6 : 0;
  return mix(mix(TERRA, TERRA_SCURA, n * 0.7), hex(0x8a9a4c), bordo);
}

/**
 * Costruisce un sentiero nella zona `zona`. Restituisce i campioni (con il profilo camminabile)
 * e il numero di gradini.
 */
export function costruisciSentiero(ctx: Contesto, zona: string, nome: string, punti: PuntoCil[], opz: OpzioniSentiero = {}): { campioni: CampioneSentiero[]; gradini: number } {
  const larghezza = opz.larghezza ?? 1.6;
  const tipo = opz.tipo ?? 'battuto';
  const c = campionaSentiero(punti, 0.5);
  profiloCamminabile(c, opz.pendenzaMax ?? 30);
  const cant = ctx.zona(zona);
  if (opz.nastro ?? true) {
    nastroSulSuolo(cant, punti, larghezza, 0.8, 0.05, (s, u) => coloreNastro(tipo, s, u));
  }
  let gradini = 0;
  if ((opz.gradini ?? 'pietra') !== 'nessuno') gradini = gradiniLungo(cant, c, larghezza, (opz.gradini ?? 'pietra') as 'pietra' | 'assi', opz.alzata ?? 0.4, opz.tag ?? 'gradino', opz.luogo, opz.seme ?? hashNome(nome));
  if (opz.registra ?? true) ctx.sentieri.push({ nome, punti, larghezza });
  return { campioni: c, gradini };
}

function hashNome(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Gradini dove il profilo camminabile sta sopra il suolo. */
export function gradiniLungo(cant: Cantiere, c: CampioneSentiero[], larghezza: number, materiale: 'pietra' | 'assi', alzata: number, tag: string, luogo: string | undefined, seme: number): number {
  let n = 0;
  let i = 0;
  while (i < c.length) {
    if (c[i]!.cammino <= c[i]!.suolo + 0.08) {
      i++;
      continue;
    }
    // tratto a gradini [i0, i1]
    const i0 = Math.max(0, i - 1);
    let i1 = i;
    while (i1 < c.length - 1 && c[i1 + 1]!.cammino > c[i1 + 1]!.suolo + 0.08) i1++;
    i1 = Math.min(c.length - 1, i1 + 1);
    const base = Math.min(c[i0]!.cammino, c[i1]!.cammino);
    // runs di livello costante
    let j = i0;
    while (j <= i1) {
      const livello = base + Math.round((c[j]!.cammino - base) / alzata) * alzata;
      let k = j;
      while (k + 1 <= i1 && Math.abs(base + Math.round((c[k + 1]!.cammino - base) / alzata) * alzata - livello) < 1e-6) k++;
      if (livello > base + 0.05 || k > j) {
        let minSuolo = Infinity;
        for (let q = j; q <= k; q++) minSuolo = Math.min(minSuolo, c[q]!.suolo);
        if (livello > minSuolo + 0.06) {
          gradino(cant, c[j]!, c[k]!, larghezza, livello, minSuolo - 0.35, materiale, tag, luogo, seme + n);
          n++;
        }
      }
      j = k + 1;
    }
    i = i1 + 1;
  }
  return n;
}

const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

/** Un gradino: blocco dal suolo al livello, lungo il tratto a→b del sentiero. */
function gradino(cant: Cantiere, a: CampioneSentiero, b: CampioneSentiero, larghezza: number, livello: number, fondo: number, materiale: 'pietra' | 'assi', tag: string, luogo: string | undefined, seme: number): void {
  const z = (a.z + b.z) / 2;
  const theta = (a.theta + b.theta) / 2;
  const lung = Math.max(0.42, b.s - a.s + 0.5);
  const yaw = (Math.atan2(a.de, a.dn) * 180) / Math.PI;
  const alto = livello - fondo;
  // matrice di posa (libreria: davanti +Z), origine al fondo del gradino
  const f = localFrameTheta(theta);
  const y = (yaw * Math.PI) / 180;
  const avanti = f.north.clone().multiplyScalar(Math.cos(y)).addScaledVector(f.east, Math.sin(y));
  const destra = new Vector3().crossVectors(f.up, avanti);
  const m = new Matrix4().makeBasis(destra, f.up, avanti);
  m.setPosition(cylToWorld(z, theta, fondo));
  const b2 = new Costruttore(seme);
  if (materiale === 'pietra') {
    // corpo del gradino e lastra di copertina
    b2.aggiungi(new BoxGeometry(larghezza, alto - 0.12, lung), { matrice: mat([0, (alto - 0.12) / 2, 0]), colore: 0x7f7970, variazione: 0.06, piatto: true });
    b2.aggiungi(geoLastra(larghezza + 0.1, 0.14, lung + 0.04, seme, 0.08), { matrice: mat([0, alto - 0.13, 0]), colore: 0x948e85, variazione: 0.08, piatto: true });
  } else {
    // asse di castagno infilata nel muro, su due paletti
    b2.aggiungi(new BoxGeometry(larghezza, 0.07, Math.min(lung, 0.5)), { matrice: mat([0, alto - 0.035, 0]), colore: 0x7a5236, variazione: 0.1, piatto: true });
    for (const sx of [-1, 1]) b2.aggiungi(new BoxGeometry(0.08, alto - 0.05, 0.08), { matrice: mat([sx * (larghezza / 2 - 0.12), (alto - 0.05) / 2, 0]), colore: 0x5a3e2a, piatto: true });
  }
  cant.oggetto(b2.costruisci('gradino'), m, { lumi: false });
  m.decompose(_p, _q, _s);
  const col = boxAt(z, theta, fondo, yaw, larghezza, alto, lung, tag);
  cant.aggiungiCollider(col, tag, luogo);
}

/**
 * Gradinata che segue il suolo da a a b (sagrati, scalette fra i gradoni dolci): ogni gradino è il
 * suolo arrotondato in su al passo `alzata` (contato dalla quota d'arrivo), quindi i gradini stanno
 * sempre sopra il terreno e il controller li sale.
 */
export function gradinataSulSuolo(cant: Cantiere, a: PuntoCil, b: PuntoCil, larghezza: number, alzata = 0.4, materiale: 'pietra' | 'assi' = 'pietra', tag = 'gradino', luogo?: string, seme = 7): number {
  const c = campionaSentiero([a, b], 0.3);
  const fine = c[c.length - 1]!.suolo;
  const inizio = c[0]!.suolo;
  const rif = Math.min(fine, inizio);
  for (const x of c) x.cammino = rif + Math.ceil((x.suolo - rif) / alzata - 0.05) * alzata;
  let n = 0;
  let j = 0;
  while (j < c.length) {
    const livello = c[j]!.cammino;
    let k = j;
    while (k + 1 < c.length && Math.abs(c[k + 1]!.cammino - livello) < 1e-6) k++;
    let minSuolo = Infinity;
    for (let q = j; q <= k; q++) minSuolo = Math.min(minSuolo, c[q]!.suolo);
    if (livello > minSuolo + 0.04 || k - j >= 1) {
      gradino(cant, c[j]!, c[k]!, larghezza, Math.max(livello, minSuolo + 0.12), minSuolo - 0.35, materiale, tag, luogo, seme + n);
      n++;
    }
    j = k + 1;
  }
  return n;
}

/** Scalinata dritta fra due quote assegnate (rampe di bastioni, scale dei campanili all'aperto). */
export function scalinata(cant: Cantiere, a: PuntoCil, b: PuntoCil, ha: number, hb: number, larghezza: number, alzata = 0.38, tag = 'gradino', luogo?: string, seme = 11): number {
  const c = campionaSentiero([a, b], 0.25);
  const L = c[c.length - 1]!.s;
  const salita = hb - ha;
  const n = Math.max(1, Math.ceil(Math.abs(salita) / alzata));
  let fatti = 0;
  for (let i = 0; i < n; i++) {
    const s0 = (i / n) * L;
    const s1 = ((i + 1) / n) * L;
    const livello = ha + (salita * (i + (salita > 0 ? 1 : 0))) / n;
    const ca = c.reduce((m, x) => (Math.abs(x.s - s0) < Math.abs(m.s - s0) ? x : m), c[0]!);
    const cb = c.reduce((m, x) => (Math.abs(x.s - s1) < Math.abs(m.s - s1) ? x : m), c[0]!);
    const minSuolo = Math.min(ca.suolo, cb.suolo);
    if (livello <= minSuolo + 0.03) continue;
    gradino(cant, ca, cb, larghezza, livello, Math.min(minSuolo, livello - 0.5) - 0.3, 'pietra', tag, luogo, seme + i);
    fatti++;
  }
  return fatti;
}
