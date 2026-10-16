/**
 * Soglie e gradini delle porte (migliorie «porte», dopo la prova del 16 ottobre).
 *
 * Il paese «a grumo» sta sui gradoni: prima la base di una casa era il suolo più basso della sua
 * impronta, e la porta (sempre sul davanti) finiva dove capitava. Se il davanti guardava a monte
 * (le case della corona della piazza, la Casa del Velo, il fienile di Ottavio, la casa di Nando) la
 * porta restava sepolta fino a tre metri sotto il prato; se il suolo davanti scendeva, la soglia
 * restava sospesa sopra il vuoto. Qui:
 *
 * - `suoloPorta` misura il suolo attorno alla soglia: il punto più alto della striscia che va da
 *   un quarto di metro dentro il muro a 0,9 m fuori (largo quanto la porta più un palmo per parte),
 *   e il più basso davanti;
 * - `baseDaPorta` dà la quota della base dell'oggetto perché la soglia stia 3 cm sopra quel punto
 *   più alto (niente terra sopra il battente); i muri scendono poi fin sotto il suolo più basso
 *   dell'impronta (`interrataPer`);
 * - `gradiniPorta` posa, se davanti il suolo scende più di 15 cm, una scaletta di lastre di gneiss
 *   dalla soglia fino al prato, con i collider «gradino».
 *
 * Tutto in coordinate locali dell'oggetto (davanti = +Z, su = +Y) posato con `matriceSuperficie`.
 */
import { Matrix4, Vector3 } from 'three';
import { Costruttore, mat, mescola } from '../oggetti/costruttore';
import { box, ingombroDa, risultato } from '../oggetti/comune';
import { matriceSuperficie } from '../oggetti/cilindro';
import { geoLastra } from '../oggetti/forme';
import { PALETTE } from '../oggetti/palette';
import { SUP, sup } from '../oggetti/superfici';
import type { Collider, PortaOggetto } from '../oggetti/tipi';
import { worldToCyl } from '../world/cylinder';
import { groundHeight } from '../world/terrain';
import type { Cantiere } from './cantiere';

/** Quanto la soglia sta sopra il punto più alto del suolo davanti (m). */
export const SOPRA_SOGLIA = 0.03;
/** Dislivello oltre il quale davanti alla porta serve un gradino (m). */
export const SALTO_GRADINO = 0.15;
/** Pedata e alzata massima dei gradini davanti alle porte (m). */
const PEDATA = 0.32;
const ALZATA = 0.19;

/** Porta in coordinate locali (dalla descrizione del generatore). */
type PortaLocale = Pick<PortaOggetto, 'centro' | 'normale' | 'larghezza'>;

const _p = new Vector3();

/** Matrice di un oggetto posato in (z, θ) a quota h con il davanti a `yaw`. */
function matrice(z: number, theta: number, h: number, yaw: number): Matrix4 {
  return matriceSuperficie(z, theta, h, yaw);
}

/** Suolo (rispetto alla quota h della base) nel punto locale (x, 0, z) dell'oggetto posato con `m`. */
function suoloLocale(m: Matrix4, x: number, zl: number): number {
  _p.set(x, 0, zl).applyMatrix4(m);
  const c = worldToCyl(_p);
  return groundHeight(c.z, c.theta) - c.h;
}

/** Punto locale a `d` m davanti alla soglia e `l` di lato. */
function davanti(p: PortaLocale, d: number, l: number): [number, number] {
  const nx = p.normale.x;
  const nz = p.normale.z;
  const ln = Math.hypot(nx, nz) || 1;
  // tangente orizzontale (−nz, nx)
  return [p.centro.x + (nx / ln) * d - (nz / ln) * l, p.centro.z + (nz / ln) * d + (nx / ln) * l];
}

export interface SuoloPorta {
  /** il suolo più alto sulla striscia della soglia (da 0,25 m dentro a 0,9 m fuori), rispetto alla base */
  alto: number;
  /** il suolo più basso davanti alla porta (da 0,4 a 1,3 m), rispetto alla base */
  basso: number;
}

/**
 * Suolo attorno alla soglia della porta `p` di un oggetto posato in (z, θ) con `yaw` alla quota `h`
 * (le quote restituite sono rispetto a h; la soglia della porta sta a `p.centro.y`).
 */
export function suoloPorta(z: number, theta: number, yaw: number, p: PortaLocale, h: number): SuoloPorta {
  const m = matrice(z, theta, h, yaw);
  const w = p.larghezza / 2 + 0.12;
  let alto = -Infinity;
  for (const d of [-0.25, 0, 0.3, 0.6, 0.9]) for (const l of [-w, -w / 2, 0, w / 2, w]) alto = Math.max(alto, suoloLocale(m, ...davanti(p, d, l)));
  let basso = Infinity;
  for (const d of [0.4, 0.85, 1.3]) for (const l of [-w, 0, w]) basso = Math.min(basso, suoloLocale(m, ...davanti(p, d, l)));
  return { alto, basso };
}

/**
 * Quota della base (h) di un oggetto posato in (z, θ) con `yaw` perché la soglia della porta `p`
 * stia `SOPRA_SOGLIA` sopra il suolo più alto davanti (vedi `suoloPorta`).
 */
export function baseDaPorta(z: number, theta: number, yaw: number, p: PortaLocale & { centro: Vector3 }): number {
  const h0 = groundHeight(z, theta);
  const s = suoloPorta(z, theta, yaw, p, h0);
  return h0 + s.alto + SOPRA_SOGLIA - p.centro.y;
}

/** Quanto devono scendere i muri sotto la base perché arrivino sotto il suolo più basso dell'impronta (m). */
export function interrataPer(base: number, minimoImpronta: number, massimoImpronta: number, margine = 0.6): number {
  return Math.max(0.8, massimoImpronta - minimoImpronta + margine, base - minimoImpronta + margine);
}

export interface Gradini {
  /** gradini posati (0 se il suolo davanti è alla quota della soglia) */
  quanti: number;
  /** quanto sporgono dal filo del muro (m) */
  lunghezza: number;
  /** dislivello superato (m) */
  salto: number;
}

/**
 * Gradini di lastre di gneiss davanti alla porta `p` (locale) di un oggetto posato in (z, θ, base)
 * con `yaw`, se il suolo davanti scende più di `SALTO_GRADINO` sotto la soglia. Partono da `inizio`
 * m dal muro (dopo la lastra di soglia) e scendono fino al prato; ognuno ha il collider «gradino».
 */
export function gradiniPorta(c: Cantiere, z: number, theta: number, base: number, yaw: number, p: PortaLocale & { centro: Vector3 }, opz: { inizio?: number; luogo?: string; seme?: number; nome?: string } = {}): Gradini {
  const m = matrice(z, theta, base, yaw);
  const y0 = p.centro.y;
  const inizio = opz.inizio ?? 0.48;
  const w = p.larghezza + 0.5;
  /** il suolo più basso (rispetto alla soglia) sulla larghezza dei gradini a `d` m dal muro */
  const suoloA = (d: number) => Math.min(...[-w / 2, 0, w / 2].map((l) => suoloLocale(m, ...davanti(p, d, l)))) - y0;
  // il suolo sotto la lastra di soglia e nel metro davanti (anche un'alzata del gradone a 80 cm dalla
  // porta vuole i gradini: la porta non dà su un salto)
  const sotto = Math.min(...[0.1, 0.3, Math.max(0.3, inizio - 0.05), inizio + 0.15, inizio + 0.45, inizio + 0.8].map(suoloA));
  if (-sotto <= SALTO_GRADINO) return { quanti: 0, lunghezza: 0, salto: 0 };
  // i gradini scendono di un'alzata alla volta finché il prato sotto il gradino seguente non è a
  // portata di un passo (se il suolo poi risale, la scaletta finisce prima); poi le alzate si
  // pareggiano: n gradini e l'ultima alzata fino al prato
  let n = 0;
  let livello = 0;
  while (n < 12) {
    const d = inizio + n * PEDATA;
    const sotto = Math.min(suoloA(d + 0.05), suoloA(d + PEDATA / 2), suoloA(d + PEDATA + 0.1));
    if (livello - sotto <= ALZATA + 0.01) break;
    livello -= ALZATA;
    n++;
  }
  const salto = Math.max(0, -suoloA(inizio + n * PEDATA + 0.1));
  const alzata = n ? Math.min(ALZATA + 0.03, Math.max(0.08, salto / (n + 1))) : 0;
  const b = new Costruttore(opz.seme ?? 4711);
  const collider: Collider[] = [];
  const rotY = Math.atan2(p.normale.x, p.normale.z);
  // il pianerottolo sotto la lastra di soglia, dal muro al primo gradino: senza, fra il muro e i
  // gradini si vedeva il vuoto sotto la soglia
  {
    const top = -0.03;
    const fondo = Math.min(suoloA(0.05), suoloA(inizio / 2), suoloA(inizio)) - 0.3;
    const [x, zl] = davanti(p, inizio / 2 - 0.01, 0);
    b.aggiungi(geoLastra(w, top - fondo, inizio + 0.02, b.rng.intero(0, 1e6), 0.03), {
      matrice: mat([x, y0 + fondo, zl], [0, rotY, 0]),
      colore: mescola(PALETTE.gneiss, PALETTE.gneissScuro, 0.2),
      variazione: 0.05,
      gradiente: { basso: 0.7, alto: 1.0, y0: y0 + top - 0.3, y1: y0 + top },
      piatto: true,
      superficie: sup(SUP.PIETRA, b.rng.next()),
      occlusione: (q) => (q.y < y0 + top - 0.15 ? 0.3 : 0.05),
    });
    collider.push(box(x, y0 + fondo / 2, zl, w / 2, -fondo / 2, inizio / 2 + 0.02, 'gradino', rotY));
  }
  for (let k = 1; k <= n; k++) {
    const top = -k * alzata;
    const d0 = inizio + (k - 1) * PEDATA;
    const dm = d0 + PEDATA / 2;
    // il blocco scende fin sotto il suolo sotto il gradino
    const fondo = Math.min(suoloA(d0), suoloA(d0 + PEDATA)) - 0.3;
    const alto = top - fondo;
    const [x, zl] = davanti(p, dm, 0);
    b.aggiungi(geoLastra(w, alto, PEDATA + 0.06, b.rng.intero(0, 1e6), 0.04), {
      matrice: mat([x, y0 + fondo, zl], [0, rotY, 0]),
      colore: mescola(PALETTE.gneiss, PALETTE.gneissChiaro, 0.25 + 0.2 * (k % 2)),
      variazione: 0.05,
      gradiente: { basso: 0.7, alto: 1.0, y0: y0 + top - 0.25, y1: y0 + top },
      piatto: true,
      superficie: sup(SUP.PIETRA, b.rng.next()),
      occlusione: (q) => (q.y < y0 + top - 0.12 ? 0.3 : 0.04),
    });
    // (i collider dei gradini si sovrappongono di 2 cm: niente fessure fra uno e l'altro)
    collider.push(box(x, y0 + (top + fondo) / 2, zl, w / 2, alto / 2, PEDATA / 2 + 0.02, 'gradino', rotY));
  }
  const gruppo = b.costruisci(opz.nome ?? 'gradini-porta');
  c.oggetto(risultato({ nome: 'gradini', seme: opz.seme ?? 4711, gruppo, collider, ingombro: ingombroDa(gruppo) }), m, { tag: () => 'gradino', ...(opz.luogo ? { luogo: opz.luogo } : {}) });
  return { quanti: n, lunghezza: inizio + n * PEDATA, salto };
}

/**
 * Crea e misura un oggetto con una porta (le case dei luoghi: casupole, fienile, mulino, grà,
 * capanno): `crea(interrata)` lo costruisce; la base è quella che mette la soglia della sua prima
 * porta sul suolo davanti (`baseDaPorta`), e se i muri non arrivano sotto il suolo più basso
 * dell'impronta (W × D) l'oggetto si ricostruisce con i muri più lunghi. Senza porte, la base è il
 * suolo più basso dell'impronta.
 */
export function oggettoSullaSoglia<T extends { porte?: PortaOggetto[]; dispose(): void }>(
  crea: (interrata: number) => T,
  z: number,
  theta: number,
  yaw: number,
  W: number,
  D: number,
  margine = 0.6,
): { oggetto: T; base: number; interrata: number; porta: PortaOggetto | null } {
  const fp = improntaSuolo(z, theta, yaw, W, D);
  let interrata = Math.max(0.8, fp.max - fp.min + margine);
  let oggetto = crea(interrata);
  const porta = oggetto.porte?.[0] ?? null;
  const base = porta ? baseDaPorta(z, theta, yaw, porta) : fp.min - 0.05;
  const serve = interrataPer(base, fp.min, fp.max, margine);
  if (serve > interrata + 0.01) {
    oggetto.dispose();
    interrata = serve;
    oggetto = crea(interrata);
  }
  return { oggetto, base, interrata, porta: oggetto.porte?.[0] ?? null };
}

/** Quota minima e massima del suolo sotto un rettangolo W × D (come `impronta` di terreno.ts). */
export function improntaSuolo(z: number, theta: number, yaw: number, W: number, D: number): { min: number; max: number } {
  const m = matrice(z, theta, groundHeight(z, theta), yaw);
  let min = Infinity;
  let max = -Infinity;
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      _p.set((i / 4) * W, 0, (j / 4) * D).applyMatrix4(m);
      const c = worldToCyl(_p);
      const g = groundHeight(c.z, c.theta);
      min = Math.min(min, g);
      max = Math.max(max, g);
    }
  }
  return { min, max };
}
