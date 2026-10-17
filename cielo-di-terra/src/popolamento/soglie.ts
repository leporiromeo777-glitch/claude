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
 *   un quarto di metro dentro il muro a 0,9 m fuori (larga quanto il pianerottolo dei gradini, la
 *   porta più 25 cm per parte), e il più basso davanti;
 * - `baseDaPorta` dà la quota della base dell'oggetto perché la soglia stia 3 cm sopra quel punto
 *   più alto (niente terra sopra il battente); i muri scendono poi fin sotto il suolo più basso
 *   dell'impronta (`interrataPer`);
 * - `progettaGradini` progetta, se davanti il suolo scende più di 15 cm, la scaletta dalla soglia al
 *   prato (senza costruirla: chi posa le case la usa per scegliere porta e posto), `zoneGradini` dà lo
 *   spazio che occupa e `gradiniPorta` la costruisce: pedate di gneiss su blocchi di muratura, con i
 *   collider «gradino», e la segna nel registro del cantiere per la verifica.
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
import type { Rettangolo } from './rettangoli';
import type { Contesto } from './contesto';

/** Quanto la soglia sta sopra il punto più alto del suolo davanti (m). */
export const SOPRA_SOGLIA = 0.03;
/** Dislivello oltre il quale davanti alla porta serve un gradino (m). */
export const SALTO_GRADINO = 0.15;
/** Pedata dei gradini davanti alle porte (m). */
const PEDATA = 0.32;

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
  /** il suolo più alto sulla striscia della soglia (da 0,25 m dentro a 0,9 m fuori, larga la porta più 25 cm per parte), rispetto alla base */
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
  // (largo quanto il pianerottolo dei gradini, la porta più un quarto di metro per parte: prima un
  // palmo, e sugli spigoli del pianerottolo spuntava l'erba)
  const w = p.larghezza / 2 + 0.25;
  let alto = -Infinity;
  for (const d of [-0.25, 0, 0.3, 0.6, 0.9]) for (const l of [-w, -w * 0.75, -w / 2, -w / 4, 0, w / 4, w / 2, w * 0.75, w]) alto = Math.max(alto, suoloLocale(m, ...davanti(p, d, l)));
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
  /** quanto la scaletta si allontana dal filo del muro (m) */
  lunghezza: number;
  /** dislivello superato (m) */
  salto: number;
  /** il progetto della scaletta (pianerottolo e gradini) */
  progetto: ProgettoGradini;
}

/**
 * Una lastra della scaletta (il pianerottolo o un gradino) nel riferimento della porta: `d` m
 * davanti al filo del muro lungo la normale, `l` m di lato (verso t = su × normale).
 */
export interface PedataProgetto {
  /** centro della pedata */
  d: number;
  l: number;
  /** direzione della rampa (unitaria) nel riferimento (d, l) */
  fd: number;
  fl: number;
  /** lunghezza lungo la rampa e larghezza di traverso (m) */
  lungo: number;
  largo: number;
  /** cima e fondo rispetto alla soglia (m) */
  top: number;
  fondo: number;
}

/** Da che parte scende la scaletta: dritta davanti alla porta o di lato, lungo la facciata. */
export type VersoScala = 'avanti' | 'mezza+' | 'mezza-' | 'lato+' | 'lato-' | `diag${30 | 45 | 60}${'+' | '-'}`;

/**
 * Progetto di una scaletta davanti a una porta (migliorie «porte», correzione dopo la verifica):
 * dove stanno pianerottolo e gradini, e quanto stanno bene sul suolo.
 */
export interface ProgettoGradini {
  quanti: number;
  /** alzata (uguale per tutti i gradini e per l'ultimo scalino fino al prato) */
  alzata: number;
  verso: VersoScala;
  /** profondità del pianerottolo (m dal muro) */
  inizio: number;
  /** quanto la scaletta si allontana dal filo del muro lungo la normale (m; 0 senza gradini) */
  lunghezza: number;
  /** dislivello fino al prato (m) */
  salto: number;
  /** larghezza del pianerottolo (m) */
  larghezza: number;
  pianerottolo: PedataProgetto | null;
  gradini: PedataProgetto[];
  /**
   * muretti sul bordo del pianerottolo dove sotto c'è un salto (solo con la rampa di lato): centro
   * (d, l) sul bordo, direzione (fd, fl), lunghezza
   */
  parapetti: Array<{ d: number; l: number; fd: number; fl: number; lungo: number }>;
  /** dove si scende sul prato, 0,3 m dopo l'ultimo gradino (riferimento della porta) */
  uscita: { d: number; l: number };
  /**
   * quanto la pedata più sepolta resta sotto il suolo, da un fianco (m; ≤ 0 = nessuna): una pedata
   * sotto il prato da un fianco e fuori dall'altro è il «dente» di pietra dei pendii di traverso
   */
  sepolto: number;
  /** quanto il pianerottolo resta sotto il suolo, da un fianco (m; ≤ 0 = niente) */
  sepoltoPianerottolo: number;
  /** quanto il fianco più alto dei gradini sta sopra il suolo (m) */
  esposto: number;
  /** l'ultimo scalino, dalla cima dell'ultimo gradino al prato (m) */
  ultimo: number;
  /** oltre la fine il suolo scende ancora ripido (la scaletta non arriva in piano) */
  ripida: boolean;
  /** la scaletta va bene: niente pedate sepolte, ultimo scalino al più un'alzata, in piano alla fine */
  buona: boolean;
  /** quanto costa (per scegliere fra porte, versi e posti: più basso, meglio) */
  costo: number;
}

/** Tutti i versi della scaletta: dritta, a metà, di lato, in diagonale (per i luoghi su un pendio di traverso). */
export const VERSI_TUTTI: readonly VersoScala[] = ['avanti', 'mezza+', 'mezza-', 'diag30+', 'diag30-', 'diag45+', 'diag45-', 'diag60+', 'diag60-', 'lato+', 'lato-'];

/** Alzata massima dei gradini davanti alle porte (m). */
const ALZATA_MAX = 0.215;
/** Gradini al più (13 gradini e il pianerottolo: 4,6 m, 2,9 m di dislivello). */
const GRADINI_MAX = 13;
/**
 * Quanto una pedata può stare sotto il suolo, da un fianco (m): negativo, cioè ogni pedata sta almeno
 * 2 cm sopra il suolo più alto sotto di sé (a filo, il prato spuntava sulla pietra; sotto, era il
 * «dente» dei pendii di traverso).
 */
export const SEPOLTO_MAX = -0.02;
/** La cima del pianerottolo rispetto alla soglia (m): 2 cm sopra il suolo più alto davanti alla porta. */
const PIANEROTTOLO_TOP = -0.01;
/**
 * Il pianerottolo può stare sotto il suolo al più di tanto, sul suo spigolo a monte (m): lì il prato
 * arriva alla quota della soglia e ci si sale senza gradino.
 */
export const SEPOLTO_PIANEROTTOLO = 0.1;
/** Profondità del pianerottolo quando la scaletta scende di lato, lungo la facciata (m). */
const PIANEROTTOLO_LATO = 1.1;

/**
 * Progetta (senza costruire niente) la scaletta davanti alla porta `p` (locale) di un oggetto posato
 * in (z, θ, base) con `yaw`, se il suolo davanti scende più di `SALTO_GRADINO` sotto la soglia.
 * Vedi `progettaGradiniMondo`.
 */
export function progettaGradini(z: number, theta: number, base: number, yaw: number, p: PortaLocale & { centro: Vector3 }, opz: OpzioniProgetto = {}): ProgettoGradini {
  const m = matrice(z, theta, base, yaw);
  const o = p.centro.clone().applyMatrix4(m);
  const n = p.normale.clone().transformDirection(m);
  const u = new Vector3(0, 1, 0).transformDirection(m);
  return progettaGradiniMondo(o, n, u, p.larghezza, opz);
}

export interface OpzioniProgetto {
  /** profondità del pianerottolo della scaletta dritta (predefinita 0,48 m) */
  inizio?: number;
  /**
   * i versi da provare (predefinito: solo dritta davanti alla porta). Di lato solo per i luoghi su un
   * pendio di traverso (il mulino), con i muretti sul bordo del pianerottolo dove c'è un salto
   */
  versi?: readonly VersoScala[];
  /** gradini al più (predefinito 13) */
  gradiniMax?: number;
  /** diagnosi: riceve una riga per ogni prova (verso, gradini) */
  traccia?: (riga: string) => void;
}

/**
 * Progetta la scaletta davanti a una porta con la soglia in coordinate mondo: centro `o` sul filo
 * del muro, normale orizzontale `n` (verso fuori), su locale `u`, porta larga `larghezzaPorta`.
 *
 * Correzione dopo la verifica: prima i gradini scendevano lungo il suolo più basso di traverso, e
 * sui pendii di traverso le pedate finivano sotto il prato da un fianco (file di «denti» bianchi);
 * la scaletta si fermava dopo 12 gradini anche se il prato era ancora sotto. Ora:
 * - le alzate sono tutte uguali (al più 21,5 cm, anche l'ultimo scalino fino al prato) e ogni pedata
 *   sta sopra il suolo più alto sotto di sé: dal fianco a valle si vede il muretto di sostegno, come
 *   nelle scale esterne dei rustici;
 * - si cerca il numero di gradini più piccolo che arriva sul prato senza pedate sepolte e senza che
 *   oltre la fine il suolo scenda ancora ripido;
 * - se il suolo scende di traverso (il mulino, la Casa del Velo), la scaletta può scendere di lato,
 *   lungo la facciata, da un pianerottolo più fondo: si sceglie il verso che costa meno.
 */
export function progettaGradiniMondo(o: Vector3, n: Vector3, u: Vector3, larghezzaPorta: number, opz: OpzioniProgetto = {}): ProgettoGradini {
  const t = new Vector3().crossVectors(u, n).normalize();
  const inizio = opz.inizio ?? 0.48;
  const w = larghezzaPorta + 0.5;
  const q = new Vector3();
  const cache = new Map<number, number>();
  /** il suolo (rispetto alla soglia, sul piano della soglia) nel punto (d, l) del riferimento della porta */
  const G = (d: number, l: number): number => {
    const k = Math.round(d * 50) * 100003 + Math.round(l * 50);
    let v = cache.get(k);
    if (v === undefined) {
      const c = worldToCyl(q.copy(o).addScaledVector(n, Math.round(d * 50) / 50).addScaledVector(t, Math.round(l * 50) / 50));
      // (le pedate stanno sul piano della soglia, che si stacca dal cilindro di d²/2R)
      v = groundHeight(c.z, c.theta) - c.h;
      cache.set(k, v);
    }
    return v;
  };
  /** il suolo più alto e più basso sotto una pedata (3 punti lungo la rampa × 5 di traverso) */
  const sotto = (r: Pick<PedataProgetto, 'd' | 'l' | 'fd' | 'fl' | 'lungo' | 'largo'>) => {
    let alto = -Infinity;
    let basso = Infinity;
    for (const a of [-r.lungo / 2 + 0.03, 0, r.lungo / 2 - 0.03]) {
      for (const b of [-r.largo / 2 + 0.04, -r.largo / 4, 0, r.largo / 4, r.largo / 2 - 0.04]) {
        // (di traverso: (−fl, fd))
        const g = G(r.d + r.fd * a - r.fl * b, r.l + r.fl * a + r.fd * b);
        alto = Math.max(alto, g);
        basso = Math.min(basso, g);
      }
    }
    return { alto, basso };
  };
  const vuoto = (): ProgettoGradini => ({ quanti: 0, alzata: 0, verso: 'avanti', inizio, lunghezza: 0, salto: 0, larghezza: w, pianerottolo: null, gradini: [], parapetti: [], uscita: { d: 0.6, l: 0 }, sepolto: 0, sepoltoPianerottolo: 0, esposto: 0, ultimo: 0, ripida: false, buona: true, costo: 0 });
  // il suolo sotto la lastra di soglia e nel metro davanti (anche un'alzata del gradone a 80 cm dalla
  // porta vuole i gradini: la porta non dà su un salto)
  let giu = Infinity;
  for (const d of [0.1, 0.3, Math.max(0.3, inizio - 0.05), inizio + 0.15, inizio + 0.45, inizio + 0.8]) for (const l of [-w / 2 + 0.04, 0, w / 2 - 0.04]) giu = Math.min(giu, G(d, l));
  if (-giu <= SALTO_GRADINO) return vuoto();

  const progettaVerso = (verso: VersoScala): ProgettoGradini => {
    const Lp = verso === 'avanti' ? inizio : Math.max(inizio, verso.startsWith('mezza') ? 0.8 : PIANEROTTOLO_LATO);
    const pl0 = { d: Lp / 2, l: 0, fd: 1, fl: 0, lungo: Lp, largo: w };
    const spl = sotto(pl0);
    const pianerottolo: PedataProgetto = { ...pl0, top: PIANEROTTOLO_TOP, fondo: spl.basso - 0.3 };
    const sepoltoPl = spl.alto - PIANEROTTOLO_TOP;
    // inizio della rampa, direzione e larghezza: dritta davanti (larga quanto il pianerottolo, o metà
    // dalla parte dove il suolo scende di traverso); di lato, lungo la facciata, dal fianco del
    // pianerottolo; in diagonale (45°), dallo spigolo davanti del pianerottolo
    const sg = verso.endsWith('+') ? 1 : -1;
    const ang = verso.startsWith('diag') ? (Number(verso.slice(4, -1)) * Math.PI) / 180 : 0;
    const [S, f, wf] =
      verso === 'avanti'
        ? ([{ d: Lp, l: 0 }, { d: 1, l: 0 }, w] as const)
        : verso.startsWith('mezza')
          ? ([{ d: Lp, l: sg * (w / 4 - 0.1) }, { d: 1, l: 0 }, w / 2 + 0.2] as const)
          : verso.startsWith('lato')
            ? ([{ d: Lp / 2, l: (sg * w) / 2 }, { d: 0, l: sg }, Lp] as const)
            : ([{ d: Lp, l: sg * (w / 2 - 0.4) }, { d: Math.cos(ang), l: sg * Math.sin(ang) }, 1.1] as const);
    const lungo = (s: number) => ({ d: S.d + f.d * s, l: S.l + f.l * s });
    // tranne che dritta, un muretto sui bordi del pianerottolo da cui non si scende, dove sotto c'è un
    // salto di più di 35 cm: dalla porta non si cade, si scende per i gradini
    const parapetti: ProgettoGradini['parapetti'] = [];
    if (verso !== 'avanti') {
      const tipo = verso.slice(0, 4) === 'diag' ? 'diag' : verso.slice(0, -1);
      /**
       * Il muretto lungo il bordo da `a` a `b` (riferimento della porta) dove fuori, a 20 cm, il suolo
       * sta più di 30 cm sotto il pianerottolo: solo il tratto col salto (più un palmo per parte),
       * dove il prato arriva al pianerottolo non serve. `fuori` = la direzione verso fuori.
       */
      const muretto = (a: { d: number; l: number }, b: { d: number; l: number }, fuori: { d: number; l: number }, dentro: number) => {
        const N = 9;
        const salti: number[] = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N;
          salti.push(PIANEROTTOLO_TOP - G(a.d + (b.d - a.d) * t + fuori.d * 0.2, a.l + (b.l - a.l) * t + fuori.l * 0.2));
        }
        const dentroI = salti.map((x) => x > 0.3);
        if (!dentroI.some(Boolean)) return;
        const i0 = dentroI.indexOf(true);
        const i1 = dentroI.lastIndexOf(true);
        const L = Math.hypot(b.d - a.d, b.l - a.l);
        const t0 = Math.max(0, i0 / N - 0.15 / L);
        const t1 = Math.min(1, i1 / N + 0.15 / L);
        // (un mozzicone di muretto più corto di 60 cm sembrava un sasso squadrato sul pianerottolo)
        if ((t1 - t0) * L < 0.6) return;
        const tm = (t0 + t1) / 2;
        const fd = (b.d - a.d) / L;
        const fl = (b.l - a.l) / L;
        // (il muretto sta dentro il bordo, di mezzo spessore)
        parapetti.push({ d: a.d + (b.d - a.d) * tm - fuori.d * dentro, l: a.l + (b.l - a.l) * tm - fuori.l * dentro, fd, fl, lungo: (t1 - t0) * L });
      };
      // davanti: tutto (di lato) o la parte lontana dalla rampa
      const [la, lb] = tipo === 'diag' ? [-sg * (w / 2), sg * (w / 2 - 0.95)] : tipo === 'mezza' ? [-sg * (w / 2), -sg * 0.2] : [-w / 2, w / 2];
      muretto({ d: Lp, l: la }, { d: Lp, l: lb }, { d: 1, l: 0 }, 0.14);
      const davanti = parapetti.length ? 0.28 : 0;
      // il fianco dall'altra parte della rampa
      muretto({ d: 0.02, l: -sg * (w / 2) }, { d: Lp - davanti, l: -sg * (w / 2) }, { d: 0, l: -sg }, 0.14);
      // in diagonale e con la rampa a metà anche il fianco dalla parte della rampa (in diagonale fino a
      // mezzo metro dallo spigolo)
      const fino = tipo === 'diag' ? Lp - 0.55 : Lp;
      if (tipo !== 'lato' && fino > 0.4) muretto({ d: 0.02, l: sg * (w / 2) }, { d: fino, l: sg * (w / 2) }, { d: 0, l: sg }, 0.14);
    }
    const centro = (s: number) => {
      const c = lungo(s);
      return G(c.d, c.l);
    };
    let migliore: ProgettoGradini | null = null;
    for (let k = 1; k <= (opz.gradiniMax ?? GRADINI_MAX); k++) {
      const e = k * PEDATA;
      // il prato dove si scende dall'ultimo gradino (al centro, il più basso dei due punti)
      const prato = Math.min(centro(e + 0.1), centro(e + 0.35));
      const salto = Math.max(0, -prato);
      const alzata = Math.min(ALZATA_MAX, salto / (k + 1));
      const gradini: PedataProgetto[] = [];
      let sepolto = sepoltoPl - (SEPOLTO_PIANEROTTOLO - SEPOLTO_MAX);
      let esposto = PIANEROTTOLO_TOP - spl.basso;
      for (let i = 1; i <= k; i++) {
        const c = lungo((i - 0.5) * PEDATA);
        const r = { d: c.d, l: c.l, fd: f.d, fl: f.l, lungo: PEDATA, largo: wf };
        const top = -i * alzata;
        const sg = sotto(r);
        sepolto = Math.max(sepolto, sg.alto - top);
        esposto = Math.max(esposto, top - sg.basso);
        gradini.push({ ...r, top, fondo: sg.basso - 0.3 });
      }
      const ultimo = -k * alzata - prato;
      // oltre la fine, nei 65 cm dopo il primo passo, il suolo non deve scendere più di un gradino e mezzo
      const ripida = centro(e + 0.1) - centro(e + 0.75) > 0.33;
      const buona = ultimo <= ALZATA_MAX + 0.02 && sepolto <= SEPOLTO_MAX && !ripida;
      const costo =
        (buona ? 0 : 5) +
        Math.max(0, ultimo - ALZATA_MAX) * 4 +
        Math.max(0, sepolto - SEPOLTO_MAX) * 3 +
        (ripida ? 0.3 : 0) +
        k * 0.03 +
        Math.max(0, esposto - 0.6) * 0.4 +
        (verso === 'avanti' ? 0 : verso.startsWith('mezza') ? 0.15 : verso.startsWith('diag') ? 0.25 : 0.2) +
        parapetti.length * 0.15;
      const uscita = lungo(e + 0.3);
      const lunghezza = verso === 'avanti' || verso.startsWith('mezza') ? Lp + e : verso.startsWith('diag') ? Lp + e * Math.cos(ang) : Lp;
      opz.traccia?.(`${verso} k ${k} alzata ${alzata.toFixed(3)} prato ${prato.toFixed(2)} sepolto ${sepolto.toFixed(2)} ultimo ${ultimo.toFixed(2)} ripida ${ripida}`);
      const prog: ProgettoGradini = { quanti: k, alzata, verso, inizio: Lp, lunghezza, salto, larghezza: w, pianerottolo, gradini, parapetti, uscita, sepolto, sepoltoPianerottolo: sepoltoPl, esposto, ultimo, ripida, buona, costo };
      if (buona) return prog;
      if (!migliore || costo < migliore.costo) migliore = prog;
    }
    return migliore!;
  };
  let scelta: ProgettoGradini | null = null;
  for (const v of opz.versi ?? (['avanti'] as const)) {
    const pr = progettaVerso(v);
    if (!scelta || pr.costo < scelta.costo) scelta = pr;
  }
  return scelta!;
}

/** Punto locale (x, z) dell'oggetto nel riferimento della porta: `d` davanti al muro, `l` di lato (t = su × normale). */
function locale(p: PortaLocale, d: number, l: number): [number, number] {
  const ln = Math.hypot(p.normale.x, p.normale.z) || 1;
  const nx = p.normale.x / ln;
  const nz = p.normale.z / ln;
  // t = (0, 1, 0) × n = (nz, 0, −nx)
  return [p.centro.x + nx * d + nz * l, p.centro.z + nz * d - nx * l];
}

/** Bussola (rispetto allo `yaw` dell'oggetto) della direzione (fd, fl) del riferimento della porta. */
function rotLocale(p: PortaLocale, fd: number, fl: number): number {
  const ln = Math.hypot(p.normale.x, p.normale.z) || 1;
  const nx = p.normale.x / ln;
  const nz = p.normale.z / ln;
  const vx = nx * fd + nz * fl;
  const vz = nz * fd - nx * fl;
  // rotazione attorno al su che porta il +Z locale su (vx, vz)
  return Math.atan2(vx, vz);
}

/**
 * Il rettangolo sul suolo nel riferimento della porta `p` (locale): centro (d, l), lungo `lungo`
 * nella direzione (fd, fl), largo `largo` di traverso.
 */
export function rettangoloPorta(z: number, theta: number, base: number, yaw: number, p: PortaLocale, r: Pick<PedataProgetto, 'd' | 'l' | 'fd' | 'fl' | 'lungo' | 'largo'>): Rettangolo {
  const m = matrice(z, theta, base, yaw);
  const [x, zl] = locale(p, r.d, r.l);
  _p.set(x, 0, zl).applyMatrix4(m);
  const c = worldToCyl(_p);
  // (X locale = sinistra del davanti: la rotazione `rot` attorno al su è la bussola yaw − rot)
  const yawR = yaw - (rotLocale(p, r.fd, r.fl) * 180) / Math.PI;
  return { z: c.z, theta: c.theta, yaw: yawR, larghezza: r.largo, profondita: r.lungo };
}

/**
 * Lo spazio da tenere libero davanti alla porta e sulla sua scaletta: il pianerottolo e la rampa
 * fino a `oltre` m dopo l'ultimo gradino, larghi quanto la scaletta più un palmo per parte (almeno
 * `largo`). Senza gradini, il rettangolo davanti alla porta fino a 0,35 + `oltre` m.
 */
export function zoneGradini(z: number, theta: number, base: number, yaw: number, p: PortaLocale, prog: ProgettoGradini, oltre = 1.0, largo = 1.8): Rettangolo[] {
  const L = Math.max(largo, prog.larghezza + 0.3);
  if (!prog.quanti || prog.verso === 'avanti') {
    const fine = Math.max(prog.lunghezza, 0.35) + oltre;
    return [rettangoloPorta(z, theta, base, yaw, p, { d: (0.05 + fine) / 2, l: 0, fd: 1, fl: 0, lungo: fine - 0.05, largo: L })];
  }
  // di lato o in diagonale: il pianerottolo (con un passo davanti) e la rampa fino a `oltre` dopo l'ultimo gradino
  const g0 = prog.gradini[0]!;
  const lungoRampa = prog.quanti * PEDATA + oltre;
  const S = { d: g0.d - (g0.fd * PEDATA) / 2, l: g0.l - (g0.fl * PEDATA) / 2 };
  return [
    rettangoloPorta(z, theta, base, yaw, p, { d: (0.05 + prog.inizio + 0.6) / 2, l: 0, fd: 1, fl: 0, lungo: prog.inizio + 0.55, largo: L }),
    rettangoloPorta(z, theta, base, yaw, p, { d: S.d + (g0.fd * lungoRampa) / 2, l: S.l + (g0.fl * lungoRampa) / 2, fd: g0.fd, fl: g0.fl, lungo: lungoRampa, largo: g0.largo + 0.3 }),
  ];
}

/**
 * Gradini di lastre di gneiss davanti alla porta `p` (locale) di un oggetto posato in (z, θ, base)
 * con `yaw`, secondo `progettaGradini`: il pianerottolo sotto la lastra di soglia, poi i gradini fino
 * al prato. Ogni gradino è una pedata di gneiss (un dito di sporgenza) sopra un blocco di muratura
 * che scende fin sotto il suolo, e ha il collider «gradino». La scaletta resta nel registro del
 * cantiere (`scalette`) per la verifica.
 */
export function gradiniPorta(
  c: Cantiere,
  z: number,
  theta: number,
  base: number,
  yaw: number,
  p: PortaLocale & { centro: Vector3 },
  opz: OpzioniProgetto & { luogo?: string; seme?: number; nome?: string; proprietario?: string; progetto?: ProgettoGradini } = {},
): Gradini {
  const prog = opz.progetto ?? progettaGradini(z, theta, base, yaw, p, opz);
  if (!prog.quanti || !prog.pianerottolo) return { quanti: 0, lunghezza: 0, salto: 0, progetto: prog };
  const m = matrice(z, theta, base, yaw);
  const y0 = p.centro.y;
  const b = new Costruttore(opz.seme ?? 4711);
  const collider: Collider[] = [];
  const muretti: Collider[] = [];
  // la muratura sotto le pedate: la stessa pietra dei muri delle case, più scura in basso
  const tonoMuro = mescola(mescola(PALETTE.gneiss, PALETTE.gneissCaldo, 0.35 + b.rng.next() * 0.25), PALETTE.gneissScuro, 0.18);
  const pezzo = (g: PedataProgetto, chiara: number, lato: boolean) => {
    const rotY = rotLocale(p, g.fd, g.fl);
    const [x, zl] = locale(p, g.d, g.l);
    // il blocco di muratura scende fin sotto il suolo più basso sotto la pedata
    const cima = g.top - 0.09;
    if (cima - g.fondo > 0.02) {
      b.aggiungi(geoLastra(g.largo - 0.02, cima - g.fondo, g.lungo + 0.02, b.rng.intero(0, 1e6), 0.02), {
        matrice: mat([x, y0 + g.fondo, zl], [0, rotY, 0]),
        colore: tonoMuro,
        variazione: 0.04,
        gradiente: { basso: 0.62, alto: 0.95, y0: y0 + g.fondo + 0.3, y1: y0 + cima },
        piatto: true,
        superficie: sup(SUP.PIETRA, b.rng.next()),
        occlusione: (qq) => (qq.y < y0 + cima - 0.25 ? 0.35 : 0.12),
      });
    }
    // la pedata di gneiss sporge un dito davanti (verso dove si scende) e ai lati
    const sp = lato ? 0 : 0.015;
    const [xp, zp] = locale(p, g.d + g.fd * sp, g.l + g.fl * sp);
    b.aggiungi(geoLastra(g.largo + 0.05, 0.1, g.lungo + (lato ? 0.02 : 0.03), b.rng.intero(0, 1e6), 0.05), {
      matrice: mat([xp, y0 + g.top - 0.1, zp], [0, rotY, 0]),
      // (la pietra dei muri, appena più chiara: il gneiss grigio, con la luce del cielo sulle facce in
      // su, veniva azzurro e da lontano faceva file di blocchi bianchi)
      colore: mescola(tonoMuro, PALETTE.gneissChiaro, 0.12 + chiara * 0.5),
      variazione: 0.05,
      piatto: true,
      superficie: sup(SUP.PIETRA, b.rng.next()),
      occlusione: 0.04,
    });
    // (i collider dei gradini si sovrappongono di 2 cm: niente fessure fra uno e l'altro)
    collider.push(box(x, y0 + (g.top + g.fondo) / 2, zl, g.largo / 2, (g.top - g.fondo) / 2, g.lungo / 2 + 0.02, 'gradino', rotY));
  };
  // il pianerottolo sotto la lastra di soglia, dal muro al primo gradino: senza, fra il muro e i
  // gradini si vedeva il vuoto sotto la soglia
  pezzo({ ...prog.pianerottolo, d: prog.pianerottolo.d - 0.01, lungo: prog.pianerottolo.lungo + 0.02 }, 0.2, true);
  prog.gradini.forEach((g, i) => pezzo(g, 0.12 + 0.18 * (i % 2), false));
  // i muretti sul bordo del pianerottolo: muratura dal piede del pianerottolo a 75 cm sopra, con la copertina
  for (const pp of prog.parapetti) {
    const rotY = rotLocale(p, pp.fd, pp.fl);
    const [x, zl] = locale(p, pp.d, pp.l);
    const fondo = prog.pianerottolo.fondo;
    const cima = prog.pianerottolo.top + 0.7;
    // (il muretto corre lungo (fd, fl): la sua X locale è la larghezza, la Z la lunghezza)
    b.aggiungi(geoLastra(0.28, cima - fondo, pp.lungo, b.rng.intero(0, 1e6), 0.03), {
      matrice: mat([x, y0 + fondo, zl], [0, rotY, 0]),
      colore: tonoMuro,
      variazione: 0.05,
      gradiente: { basso: 0.62, alto: 0.98, y0: y0 + fondo + 0.3, y1: y0 + cima },
      piatto: true,
      superficie: sup(SUP.PIETRA, b.rng.next()),
      occlusione: (qq) => (qq.y < y0 + prog.pianerottolo!.top + 0.2 ? 0.3 : 0.1),
    });
    b.aggiungi(geoLastra(0.36, 0.08, pp.lungo + 0.06, b.rng.intero(0, 1e6), 0.05), {
      matrice: mat([x, y0 + cima, zl], [0, rotY, 0]),
      colore: mescola(PALETTE.gneiss, PALETTE.gneissChiaro, 0.25),
      variazione: 0.05,
      piatto: true,
      superficie: sup(SUP.PIETRA, b.rng.next()),
      occlusione: 0.05,
    });
    muretti.push(box(x, y0 + (cima + 0.08 + fondo) / 2, zl, 0.14, (cima + 0.08 - fondo) / 2, pp.lungo / 2, 'muro', rotY));
  }
  const gruppo = b.costruisci(opz.nome ?? 'gradini-porta');
  c.oggetto(risultato({ nome: 'gradini', seme: opz.seme ?? 4711, gruppo, collider: [...collider, ...muretti], ingombro: ingombroDa(gruppo) }), m, { tag: (t) => (t === 'muro' ? 'muro' : 'gradino'), ...(opz.luogo ? { luogo: opz.luogo } : {}) });
  // nel registro del cantiere, in coordinate mondo
  const soglia = p.centro.clone().applyMatrix4(m);
  const normale = p.normale.clone().transformDirection(m);
  const su = new Vector3(0, 1, 0).transformDirection(m);
  const pedate = [prog.pianerottolo, ...prog.gradini].map((g) => ({ d: g.d, l: g.l, fd: g.fd, fl: g.fl, lungo: g.lungo, largo: g.largo, top: g.top }));
  c.scalette.push({
    ...(opz.proprietario ? { proprietario: opz.proprietario } : {}),
    zona: c.nome,
    soglia,
    normale,
    su,
    verso: prog.verso,
    larghezza: prog.larghezza,
    inizio: prog.inizio,
    lunghezza: prog.lunghezza,
    alzata: prog.alzata,
    gradini: pedate,
    parapetti: prog.parapetti.map((pp) => ({ ...pp })),
    uscita: prog.uscita,
    direzione: { d: prog.gradini[0]!.fd, l: prog.gradini[0]!.fl },
  });
  return { quanti: prog.quanti, lunghezza: prog.lunghezza, salto: prog.salto, progetto: prog };
}

/**
 * Gradini davanti alla porta di un luogo (casupole, mulino, fienile, grà, casa di Nando) e lo spazio
 * davanti alla porta e sulla scaletta come impronta `porta:nome` (i muri delle terrazze, gli annessi,
 * gli orti la lasciano libera). Restituisce i gradini.
 */
export function gradiniLuogo(
  ctx: Contesto,
  c: Cantiere,
  nome: string,
  z: number,
  theta: number,
  base: number,
  yaw: number,
  p: PortaLocale & { centro: Vector3 },
  opz: OpzioniProgetto & { luogo?: string; seme?: number; progetto?: ProgettoGradini; occupa?: boolean } = {},
): Gradini {
  const gr = gradiniPorta(c, z, theta, base, yaw, p, { ...opz, proprietario: nome });
  if (opz.occupa ?? true) for (const r of zoneGradini(z, theta, base, yaw, p, gr.progetto, 1.0, 1.8)) ctx.occupa({ nome: `porta:${nome}`, ...r });
  return gr;
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
