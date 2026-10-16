/**
 * Oggetti in prima persona (da agganciare alla camera: la camera guarda −Z, +Y in su, +X a destra),
 * con il materiale del primo piano (`render/primoPiano.ts`: la stessa luce del mondo) e le mani
 * guantate di `mani.ts`:
 * - lo squadro a cannocchiale di Aurelio, d'ottone lucido (bozzetto 2), in tre pose: 'mano'
 *   (tenuto in mano, la sinistra regge il cannocchiale), 'piantato' (piantato sul chiodo del
 *   caposaldo, la destra appoggiata sul muro) e 'riposo' (abbassato fuori campo), con transizioni;
 * - il Velo (bozzetto 3): traversa di frassino con le fasce di cuoio dove si impugna, montanti
 *   legati con la corda, tela cucita a punti a croce che si vede da sotto in controluce, nappina
 *   rossa con la perlina di legno che pende dalla parte della deriva;
 * - la lettera di Marta (bozzetto 1): un foglio piegato in tre, scritto fitto, tenuto nella destra.
 * Guanti di cuoio marrone, maniche di lana verde col polsino a coste, l'anello sotto il guanto no:
 * l'anello di fidanzamento si vede nel taccuino, non qui.
 */
import * as THREE from 'three';
import { ingombroDa, risultato, smorza } from '../comune';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';
import { CUOIO_CUCITO, FormePrimoPiano, MATERIA, materialePrimoPiano, misto, type OpzioniForma } from '../../render/primoPiano';
import { PALETTE } from '../palette';
import { braccio, COLORI_MANI, manica, manoGuanto, matriceMano, posaAngoli, posaAvvolta } from './mani';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const e = (x: number, y: number, z: number) => new THREE.Euler(x, y, z, 'YXZ');

let materiali: { opaco: THREE.ShaderMaterial; doppio: THREE.ShaderMaterial } | null = null;
/** I due materiali del primo piano (condivisi). */
export function materialiPrimoPiano(): { opaco: THREE.ShaderMaterial; doppio: THREE.ShaderMaterial } {
  if (!materiali) materiali = { opaco: materialePrimoPiano(), doppio: materialePrimoPiano({ doppia: true }) };
  return materiali;
}

function mesh(f: FormePrimoPiano | THREE.BufferGeometry, nome: string, doppia = false): THREE.Mesh {
  const g = f instanceof FormePrimoPiano ? f.costruisci() : f;
  const m = new THREE.Mesh(g, doppia ? materialiPrimoPiano().doppio : materialiPrimoPiano().opaco);
  m.name = nome;
  m.renderOrder = 5;
  m.frustumCulled = false;
  // canale proprio: il materiale del primo piano non si sostituisce con quelli del mondo
  m.userData['canale'] = doppia ? 'primo-piano-doppio' : 'primo-piano';
  return m;
}

/** Profilo di tornitura (raggio, quota) attorno all'asse Y, nella geometria di `f`. */
function tornito(f: FormePrimoPiano, profilo: Array<[number, number]>, m: THREE.Matrix4, colore: OpzioniForma['colore'], materia: number, seg = 20, occ = 0): void {
  const g = new THREE.LatheGeometry(
    profilo.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  f.geometria(g, m, { colore, materia, occlusione: occ, uvScala: 1 });
  g.dispose();
}

/** Estrusione smussata di una sagoma (piano XY, spessore lungo Z centrato). */
function sagoma(f: FormePrimoPiano, forma: THREE.Shape, spessore: number, m: THREE.Matrix4, colore: number | readonly [number, number, number], materia: number, smusso = 0.0012): void {
  const g = new THREE.ExtrudeGeometry(forma, { depth: spessore, bevelEnabled: smusso > 0, bevelThickness: smusso, bevelSize: smusso, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -spessore / 2);
  f.geometria(g, m, { colore, materia, uvScala: 1 });
  g.dispose();
}

// ---------------------------------------------------------------------------------------------
// Squadro
// ---------------------------------------------------------------------------------------------

/** Squadro a cannocchiale: origine sulla punta del puntale, asta lungo +Y, cannocchiale verso −Z. */
/**
 * L'ottone dello squadro (rifinitura 1): un ottone vecchio e caldo, mai giallo puro. Base #b08a3a,
 * cavità e giunti #5e4520, una striscia di luce dipinta lungo i tubi (dalla parte dell'occhio e
 * della luce) e il riflesso del cielo in alto lo fa il materiale.
 */
const OTTONE_SQ = { base: 0xb08a3a, cavita: 0x5e4520, luce: 0xd8c08a, scuro: 0x6e5428, cielo: 0xb9b49c } as const;

/**
 * Colore dipinto di un tubo d'ottone con l'asse lungo `asse` passante per `centro`: una striscia
 * di luce stretta e pallida verso `luceAng` (angolo nel piano della sezione), il cielo riflesso
 * (grigio chiaro, appena freddo) sulla fascia in alto, l'ombra calda e scura in basso.
 */
function ottoneStriato(centro: THREE.Vector3, asse: 'x' | 'y' | 'z', luceAng = 2.1, alto = Math.PI / 2): (p: THREE.Vector3) => [number, number, number] {
  return (p) => {
    const d = p.clone().sub(centro);
    const [a, b] = asse === 'y' ? [d.x, d.z] : asse === 'z' ? [d.x, d.y] : [d.z, d.y];
    const ang = Math.atan2(b, a);
    const k = Math.cos(ang - luceAng);
    const kc = Math.cos(ang - alto);
    const striscia = Math.max(0, (k - 0.86) / 0.14);
    const cielo = Math.max(0, (kc - 0.55) / 0.45);
    const ombra = Math.max(0, -kc - 0.1) / 0.9;
    let c = misto(OTTONE_SQ.base, OTTONE_SQ.cielo, cielo * 0.45);
    c = misto(c, OTTONE_SQ.scuro, ombra * 0.7);
    return misto(c, OTTONE_SQ.luce, striscia * 0.8);
  };
}

function squadro(f: FormePrimoPiano): { quotaCannocchiale: number; quotaPresa: number } {
  const ott = OTTONE_SQ.base;
  const scuro = OTTONE_SQ.cavita;
  const chiaro = OTTONE_SQ.luce;
  const nero = 0x262220;
  const I = new THREE.Matrix4();
  // puntale e disco d'appoggio (tornito)
  tornito(f, [[0.0006, 0], [0.004, 0.03], [0.009, 0.09], [0.012, 0.115], [0.016, 0.118], [0.038, 0.12], [0.04, 0.125], [0.037, 0.131], [0.016, 0.133], [0.013, 0.14]], I, ott, MATERIA.OTTONE, 22);
  // asta con i collari (la striscia di luce verso l'occhio e a sinistra)
  f.tubo([v(0, 0.135, 0), v(0, 0.56, 0)], [0.0118, 0.0108], { colore: ottoneStriato(v(0, 0, 0), 'y', 2.2), materia: MATERIA.OTTONE, segmenti: 14 });
  tornito(f, [[0.011, 0.29], [0.0155, 0.293], [0.0158, 0.31], [0.011, 0.313]], I, scuro, MATERIA.OTTONE, 18, 0.3);
  tornito(f, [[0.011, 0.5], [0.0145, 0.503], [0.0145, 0.515], [0.011, 0.518]], I, OTTONE_SQ.scuro, MATERIA.OTTONE, 18, 0.2);
  // montante piatto (smussato) e squadra triangolare cava a destra
  const mont = new THREE.Shape();
  mont.moveTo(-0.004, 0.33);
  mont.lineTo(0.03, 0.33);
  mont.lineTo(0.03, 0.555);
  mont.lineTo(-0.004, 0.555);
  mont.lineTo(-0.004, 0.33);
  sagoma(f, mont, 0.006, I, ott, MATERIA.OTTONE);
  const tri = new THREE.Shape();
  tri.moveTo(0.024, 0.33);
  tri.lineTo(0.024, 0.553);
  tri.lineTo(0.245, 0.553);
  tri.lineTo(0.024, 0.33);
  const foro = new THREE.Path();
  foro.moveTo(0.048, 0.4);
  foro.lineTo(0.17, 0.529);
  foro.lineTo(0.048, 0.529);
  foro.lineTo(0.048, 0.4);
  tri.holes.push(foro);
  sagoma(f, tri, 0.005, I, misto(ott, chiaro, 0.15), MATERIA.OTTONE);
  // scala incisa sull'ipotenusa (tacche scure)
  for (let i = 0; i <= 14; i++) {
    const t = 0.12 + i * 0.055;
    const p = v(0.024 + 0.221 * t, 0.33 + 0.223 * t, 0.0036);
    const l = i % 5 === 0 ? 0.011 : 0.006;
    f.tubo([p, p.clone().add(v(-0.7071 * l, 0.7071 * l, 0))], 0.0006, { colore: 0x3a2c18, materia: MATERIA.PIENA, segmenti: 3 });
  }
  // viti con l'intaglio
  for (const [x, y] of [[0.033, 0.543], [0.205, 0.543], [0.033, 0.36], [0.012, 0.44]] as const) {
    tornito(f, [[0.0001, 0.0045], [0.0045, 0.004], [0.0052, 0.0015], [0.0045, 0]], new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, y, 0.0028), scuro, MATERIA.OTTONE, 10);
    f.tubo([v(x - 0.003, y, 0.0074), v(x + 0.003, y, 0.0074)], 0.0006, { colore: nero, segmenti: 3 });
  }
  // supporto del cannocchiale: forcella e manopola zigrinata
  f.tubo([v(0, 0.552, 0), v(0, 0.585, 0)], 0.009, { colore: scuro, materia: MATERIA.OTTONE, segmenti: 12 });
  sagoma(f, (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.022, 0.574);
    s.lineTo(0.022, 0.574);
    s.lineTo(0.022, 0.6);
    s.lineTo(-0.022, 0.6);
    s.lineTo(-0.022, 0.574);
    return s;
  })(), 0.034, I, ott, MATERIA.OTTONE, 0.002);
  tornito(f, [[0.0001, 0.0], [0.0105, 0.0], [0.0115, 0.004], [0.0115, 0.011], [0.0105, 0.014], [0.0001, 0.014]], new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(0.02, 0.6, 0), scuro, MATERIA.OTTONE, 16);
  // cannocchiale lungo Z (tornito attorno all'asse, poi girato)
  const yC = 0.6;
  const mTubo = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, yC, 0);
  // profilo (raggio, z): z cresce verso l'occhio
  tornito(
    f,
    [
      [0.0001, -0.212],
      [0.0225, -0.212],
      [0.0255, -0.209],
      [0.0255, -0.17],
      [0.0225, -0.166],
      [0.0193, -0.163],
      [0.0193, -0.03],
      [0.0218, -0.027],
      [0.0218, -0.008],
      [0.0193, -0.005],
      [0.0193, 0.07],
      [0.0168, 0.074],
      [0.0136, 0.077],
      [0.0136, 0.124],
      [0.0001, 0.124],
    ],
    mTubo,
    (() => {
      // striscia di luce lungo il tubo e i giunti (gli scalini del profilo) scuri: la patina
      const s = ottoneStriato(v(0, yC, 0), 'z', 1.95);
      const giunti = [-0.209, -0.166, -0.03, -0.006, 0.072];
      return (p: THREE.Vector3) => {
        const g = giunti.reduce((m, z) => Math.max(m, 1 - Math.abs(p.z - z) / 0.006), 0);
        return misto(s(p), OTTONE_SQ.cavita, Math.max(0, g) * 0.7);
      };
    })(),
    MATERIA.OTTONE,
    24,
  );
  // paraluce e oculare scuri (cuoio nero e bachelite)
  tornito(f, [[0.0235, -0.215], [0.0262, -0.214], [0.0265, -0.176], [0.0237, -0.174]], mTubo, nero, MATERIA.CUOIO, 22);
  tornito(f, [[0.0128, 0.118], [0.0158, 0.12], [0.0162, 0.148], [0.0122, 0.152], [0.0062, 0.152], [0.0058, 0.146]], mTubo, nero, MATERIA.CUOIO, 18);
  // lenti
  f.geometria(new THREE.CircleGeometry(0.0205, 18), new THREE.Matrix4().makeRotationY(Math.PI).setPosition(0, yC, -0.2125), { colore: 0x2c4256, materia: MATERIA.VETRO });
  f.geometria(new THREE.CircleGeometry(0.0062, 12), new THREE.Matrix4().setPosition(0, yC, 0.1462), { colore: 0x1a2430, materia: MATERIA.VETRO });
  // livella a bolla sul fianco
  f.tubo([v(-0.027, yC - 0.004, -0.1), v(-0.027, yC - 0.004, -0.045)], 0.0062, { colore: scuro, materia: MATERIA.OTTONE, segmenti: 10, chiudiInizio: true, chiudiFine: true });
  f.tubo([v(-0.0305, yC - 0.002, -0.093), v(-0.0305, yC - 0.002, -0.052)], 0.0032, { colore: 0xb9d39a, materia: MATERIA.VETRO, segmenti: 8 });
  return { quotaCannocchiale: yC, quotaPresa: 0.22 };
}

export type PosaSquadro = 'mano' | 'piantato' | 'riposo';

export interface StatoSquadro {
  posa?: PosaSquadro;
  /** passo di camminata (0 fermo … 1 corsa): dondolio */
  passo?: number;
  /** per 'mano': 0 tenuto basso, 1 portato all'occhio (mira) */
  mira?: number;
}

export interface OpzioniSquadro {
  seme?: Seme;
  posa?: PosaSquadro;
}

type Trasf = [THREE.Vector3, THREE.Euler];
/** Aggancio di una mano: allo strumento (coordinate dello strumento) o alla camera. */
type Aggancio = { strumento: Trasf } | { camera: Trasf };

interface Posa {
  strumento: Trasf;
  destra: Aggancio;
  sinistra: Aggancio;
  /** la destra è appoggiata di piatto (sul muro) invece di impugnare */
  destraAppoggiata: boolean;
  /** la sinistra culla il cannocchiale invece di stringere l'asta */
  sinistraCulla: boolean;
  /**
   * direzione dell'avambraccio dal polso verso il gomito (spazio camera). Rifinitura 1: il gomito sta
   * a una lunghezza vera d'avambraccio dal polso (`AVAMBRACCIO`) e da lì il braccio va alla spalla,
   * dietro la camera; prima il «gomito» era un punto a un metro, e la manica un tubo lungo mezzo
   * schermo
   */
  avambracci: { destra: THREE.Vector3; sinistra: THREE.Vector3 };
  /**
   * lunghezza della manica dal polso al gomito, se non è `AVAMBRACCIO`: dove la mano è lontana
   * dall'occhio (piantato) il gomito deve uscire dal bordo dello schermo, come nel bozzetto 2
   */
  lunghezze?: { destra?: number; sinistra?: number };
}

/** Lunghezza dell'avambraccio dal polso del guanto al gomito (m). */
const AVAMBRACCIO = 0.27;
/** Spalle (spazio camera): dietro e sotto l'occhio. */
const SPALLE = { destra: v(0.21, -0.3, 0.1), sinistra: v(-0.21, -0.3, 0.1) };

/** Posizione (spazio camera) del puntale nella posa 'piantato': serve per far coincidere la camera col chiodo. */
export const PUNTALE_PIANTATO = v(-0.12, -0.37, -0.72);

/**
 * Pose: strumento (punta del puntale) in spazio camera, mani agganciate allo strumento o alla
 * camera. Le mani agganciate allo strumento hanno il polso nel sistema dello strumento: le
 * matrici di presa (`presaAsta`, `presaCannocchiale`) mettono l'asta o il tubo dentro il pugno.
 */
const POSE: Record<PosaSquadro, Posa> = {
  // piantato sul chiodo davanti, sul muro (bozzetto 2): la sinistra impugna l'asta da sinistra col
  // dorso verso l'occhio e l'avambraccio che esce dal bordo sinistro, la destra è appoggiata sul
  // muro. Il giro −0,38 attorno all'asta annulla l'imbardata dello strumento (dorso alla camera)
  piantato: {
    strumento: [PUNTALE_PIANTATO.clone(), e(0, 0.38, 0)],
    sinistra: { strumento: [v(0, 0.27, 0), e(0, -0.38, 0)] },
    destra: { camera: [v(0.13, -0.395, -0.6), e(0.05, 0.35, 0.04)] },
    destraAppoggiata: true,
    sinistraCulla: false,
    avambracci: { destra: v(0.35, -0.5, 0.8), sinistra: v(-0.62, -0.1, 0.78) },
    lunghezze: { sinistra: 0.42 },
  },
  // tenuto in mano a sinistra, come nel bozzetto 2: il centro dello schermo (dove si mira) resta
  // libero. La sinistra impugna l'asta sotto la squadra col dorso verso l'occhio e l'avambraccio
  // che esce dal bordo sinistro; la destra la regge in basso, vicino al puntale, quasi fuori campo.
  // Rifinitura 1: prima la sinistra cullava il cannocchiale al centro dello schermo e la manica era
  // un tubo verde lungo mezzo schermo
  mano: {
    strumento: [v(-0.25, -0.53, -0.5), e(0.04, 0.72, 0.02)],
    destra: { strumento: [v(0, 0.14, 0), e(0, -0.72, 0)] },
    sinistra: { strumento: [v(0, 0.36, 0), e(0, -0.72, 0)] },
    destraAppoggiata: false,
    sinistraCulla: false,
    avambracci: { destra: v(0.6, -0.45, 0.66), sinistra: v(-0.6, -0.22, 0.77) },
    lunghezze: { sinistra: 0.3 },
  },
  riposo: {
    strumento: [v(0.25, -1.45, -0.5), e(0.4, 0.4, 0.2)],
    destra: { strumento: [v(0, 0.235, 0), e(0, -0.72, 0)] },
    sinistra: { camera: [v(-0.3, -1.1, -0.45), e(0.4, -0.2, -0.2)] },
    destraAppoggiata: false,
    sinistraCulla: false,
    avambracci: { destra: v(0.6, 0.5, 0.6), sinistra: v(-0.1, 0.7, 0.7) },
  },
};

const mDa = ([p, r]: Trasf) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(r), new THREE.Vector3(1, 1, 1));

/**
 * Matrice di presa: dallo spazio della mano a quello dell'oggetto impugnato. `asse` = direzione
 * del cilindro (dal mignolo al pollice, per la mano non specchiata è −X della mano), `dorso` =
 * dove guarda il dorso; il cilindro sta in (0, −0,03, −0,07) della mano (vedi `posaAvvolta`).
 */
function presa(asse: THREE.Vector3, dorso: THREE.Vector3, centro: THREE.Vector3, sinistra: boolean): THREE.Matrix4 {
  const x = asse.clone().normalize().multiplyScalar(sinistra ? 1 : -1);
  const y = dorso.clone().addScaledVector(x, -dorso.dot(x)).normalize();
  const z = x.clone().cross(y).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  const pos = centro.clone().addScaledVector(y, 0.03).addScaledVector(z, 0.07);
  m.setPosition(pos);
  if (sinistra) m.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
  return m;
}

const CENTRO_PRESA = { y: -0.03, z: -0.07 };

/** Squadro a cannocchiale di Aurelio con le mani di Elvira (da aggiungere alla camera). */
export function creaSquadroPrimaPersona(opz: OpzioniSquadro = {}): OggettoProcedurale<StatoSquadro> {
  const seme = semeNumerico(opz.seme ?? 'squadro');
  const rng = new Rng(seme);
  const fs = new FormePrimoPiano();
  const info = squadro(fs);
  const strumento = mesh(fs, 'squadro');

  // destra sull'asta: dorso verso l'occhio (si vede il dorso del guanto con le cuciture), dita che
  // girano dietro l'asta, pollice sotto e polso a destra, così l'avambraccio va verso il bordo
  // destro e non attraversa lo schermo (rifinitura 1: prima il polso puntava a sinistra e la
  // manica, che andava a destra, lo spezzava)
  const fd = new FormePrimoPiano();
  const pd = manoGuanto(fd, posaAvvolta(CENTRO_PRESA, 0.0115, 1), { consumo: 0.5 });
  const mPresaD = presa(v(0, -1, 0), v(-0.22, 0.08, 1), v(0, 0, 0), false);
  const fD = new FormePrimoPiano();
  fD.unisci(fd, mPresaD);
  const manoD = mesh(fD, 'mano-destra');
  const polsoD = pd.polso.clone().applyMatrix4(mPresaD);
  // sinistra sull'asta: come la destra, specchiata (dorso verso l'occhio, polso a sinistra)
  const fs2 = new FormePrimoPiano();
  const ps = manoGuanto(fs2, posaAvvolta(CENTRO_PRESA, 0.0115, 1), { consumo: 0.35 });
  const mPresaS = presa(v(0, -1, 0), v(0.22, 0.08, 1), v(0, 0, 0), true);
  const fS = new FormePrimoPiano();
  fS.unisci(fs2, mPresaS);
  const manoS = mesh(fS, 'mano-sinistra');
  const polsoS = ps.polso.clone().applyMatrix4(mPresaS);
  // sinistra che culla il cannocchiale da sotto (le dita salgono sul fianco)
  const fc = new FormePrimoPiano();
  const pc = manoGuanto(fc, posaAvvolta(CENTRO_PRESA, 0.02, 0.62), { consumo: 0.35 });
  const mCulla = presa(v(0, 0, -1), v(0.5, -0.8, 0), v(0, 0, 0), true);
  const fC = new FormePrimoPiano();
  fC.unisci(fc, mCulla);
  const manoSCulla = mesh(fC, 'mano-sinistra-culla');
  const polsoSCulla = pc.polso.clone().applyMatrix4(mCulla);
  // destra appoggiata di piatto sul muro
  const fa = new FormePrimoPiano();
  const pa = manoGuanto(fa, posaAngoli([[0.16, 0.2, 0.12], [0.14, 0.18, 0.12], [0.18, 0.22, 0.14], [0.26, 0.28, 0.16]], [0.7, 0.2, 0.25]), { consumo: 0.5 });
  const manoDApp = mesh(fa, 'mano-destra-appoggiata');
  const polsoDApp = pa.polso.clone();

  // maniche: l'avambraccio (dal polso al gomito, lungo AVAMBRACCIO) e il braccio (dal gomito alla
  // spalla), costruiti lungo +Y e orientati ogni fotogramma
  const orientabile = (m: THREE.Mesh, L0: number) => {
    const su = v(0, 1, 0);
    const d = new THREE.Vector3();
    return (da: THREE.Vector3, a: THREE.Vector3) => {
      d.subVectors(a, da);
      const l = d.length();
      m.position.copy(da);
      m.quaternion.setFromUnitVectors(su, d.divideScalar(l || 1));
      m.scale.set(1, l / L0, 1);
    };
  };
  const creaManica = (nome: string, s: number) => {
    const fm = new FormePrimoPiano();
    manica(fm, v(0, 0, 0), v(0, AVAMBRACCIO, 0), { seme: s, lato: v(1, 0, 0) });
    const m = mesh(fm, nome);
    const fb = new FormePrimoPiano();
    braccio(fb, v(0, 0, 0), v(0, 0.3, 0), { seme: s });
    const mb = mesh(fb, `${nome}-braccio`);
    return { mesh: m, braccio: mb, orienta: orientabile(m, AVAMBRACCIO), orientaBraccio: orientabile(mb, 0.3) };
  };
  const manicaD = creaManica('manica-destra', 0.3);
  const manicaS = creaManica('manica-sinistra', 0.7);

  const gruppo = new THREE.Group();
  gruppo.name = 'squadro-prima-persona';
  const nodoS = new THREE.Group();
  const nodoD = new THREE.Group();
  const nodoSt = new THREE.Group();
  nodoS.add(manoS, manoSCulla);
  nodoD.add(manoD, manoDApp);
  nodoSt.add(strumento);
  gruppo.add(nodoSt, nodoD, nodoS, manicaD.mesh, manicaS.mesh, manicaD.braccio, manicaS.braccio);
  // direzioni degli avambracci (si spostano con la posa) e gomiti
  const dirD = POSE[opz.posa ?? 'piantato'].avambracci.destra.clone().normalize();
  const dirS = POSE[opz.posa ?? 'piantato'].avambracci.sinistra.clone().normalize();
  const gomito = new THREE.Vector3();
  let lunD = POSE[opz.posa ?? 'piantato'].lunghezze?.destra ?? AVAMBRACCIO;
  let lunS = POSE[opz.posa ?? 'piantato'].lunghezze?.sinistra ?? AVAMBRACCIO;

  let posa: PosaSquadro = opz.posa ?? 'piantato';
  // aggancio allo strumento di ciascuna mano (posizione sull'asta e giro attorno all'asta), smorzato
  // come lo strumento: cambiando posa la presa scorre lungo l'asta invece di scattare
  const uno = new THREE.Vector3(1, 1, 1);
  const _qa = new THREE.Quaternion();
  const agganci = { sinistra: { p: new THREE.Vector3(), q: new THREE.Quaternion(), pronto: false }, destra: { p: new THREE.Vector3(), q: new THREE.Quaternion(), pronto: false } };
  const mLoc = new THREE.Matrix4();
  const obiettivoMano = (a: Aggancio, lato: 'sinistra' | 'destra', mStrumento: THREE.Matrix4, k: number): THREE.Matrix4 => {
    if (!('strumento' in a)) return mDa(a.camera);
    const g = agganci[lato];
    _qa.setFromEuler(a.strumento[1]);
    if (!g.pronto || k >= 1) {
      g.p.copy(a.strumento[0]);
      g.q.copy(_qa);
      g.pronto = true;
    } else {
      g.p.lerp(a.strumento[0], k);
      g.q.slerp(_qa, k);
    }
    return mStrumento.clone().multiply(mLoc.compose(g.p, g.q, uno));
  };
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const avvicina = (n: THREE.Object3D, m: THREE.Matrix4, k: number) => {
    m.decompose(_p, _q, _s);
    n.position.lerp(_p, k);
    n.quaternion.slerp(_q, k);
  };
  let t = rng.next() * 5;
  let mira = 0;
  let passo = 0;
  let fasePasso = 0;
  const polso = new THREE.Vector3();
  const update = (dt: number, stato?: StatoSquadro) => {
    t += dt;
    if (stato?.posa) posa = stato.posa;
    mira = smorza(mira, stato?.mira ?? 0, 6, dt);
    passo = smorza(passo, stato?.passo ?? 0, 4, dt);
    fasePasso += dt * 7 * passo;
    const P = POSE[posa];
    const k = dt <= 0 ? 1 : 1 - Math.exp(-7 * dt);
    const mSt = mDa(P.strumento);
    if (posa === 'mano' && mira > 0.001) {
      // la mira porta il cannocchiale verso l'occhio
      mSt.premultiply(new THREE.Matrix4().makeTranslation(0.19 * mira, -0.1 * mira, 0.33 * mira));
    }
    avvicina(nodoSt, mSt, k);
    nodoSt.updateMatrix();
    // le mani agganciate allo strumento seguono la sua posizione attuale (restano incollate nelle transizioni)
    avvicina(nodoS, obiettivoMano(P.sinistra, 'sinistra', nodoSt.matrix, k), 'strumento' in P.sinistra ? 1 : k);
    avvicina(nodoD, obiettivoMano(P.destra, 'destra', nodoSt.matrix, k), 'strumento' in P.destra ? 1 : k);
    manoD.visible = !P.destraAppoggiata;
    manoDApp.visible = P.destraAppoggiata;
    dirD.lerp(_s.copy(P.avambracci.destra).normalize(), k).normalize();
    dirS.lerp(_s.copy(P.avambracci.sinistra).normalize(), k).normalize();
    manoS.visible = !P.sinistraCulla;
    manoSCulla.visible = P.sinistraCulla;
    nodoS.updateMatrix();
    nodoD.updateMatrix();
    polso.copy(P.sinistraCulla ? polsoSCulla : polsoS).applyMatrix4(nodoS.matrix);
    lunS += ((P.lunghezze?.sinistra ?? AVAMBRACCIO) - lunS) * k;
    lunD += ((P.lunghezze?.destra ?? AVAMBRACCIO) - lunD) * k;
    gomito.copy(polso).addScaledVector(dirS, lunS);
    manicaS.orienta(polso, gomito);
    manicaS.orientaBraccio(gomito, SPALLE.sinistra);
    polso.copy(P.destraAppoggiata ? polsoDApp : polsoD).applyMatrix4(nodoD.matrix);
    gomito.copy(polso).addScaledVector(dirD, lunD);
    manicaD.orienta(polso, gomito);
    manicaD.orientaBraccio(gomito, SPALLE.destra);
    // respiro e passo
    const resp = Math.sin(t * 1.6) * 0.004;
    const bobY = Math.abs(Math.sin(fasePasso)) * 0.02 * passo;
    const bobX = Math.sin(fasePasso) * 0.012 * passo;
    gruppo.position.set(bobX, resp - bobY, 0);
    gruppo.rotation.z = Math.sin(t * 0.7) * 0.004 + bobX * 0.4;
  };
  update(0);
  return risultato<StatoSquadro>({
    nome: 'squadro-prima-persona',
    seme,
    gruppo,
    collider: [],
    ingombro: ingombroDa(gruppo),
    punti: {
      puntale: new THREE.Vector3(0, 0, 0),
      cannocchiale: new THREE.Vector3(0, info.quotaCannocchiale, 0),
      presa: new THREE.Vector3(0, info.quotaPresa, 0),
      puntaleInPiantato: PUNTALE_PIANTATO.clone(),
    },
    update,
  });
}

// ---------------------------------------------------------------------------------------------
// Velo
// ---------------------------------------------------------------------------------------------

export interface OpzioniVelo {
  seme?: Seme;
  /** colore della tela */
  tela?: number;
}

export interface StatoVelo {
  /** deriva laterale (−1 sinistra … +1 destra): la nappina pende da quella parte */
  deriva?: number;
  /** angolo della nappina imposto da fuori (rad, + verso destra): sostituisce la deriva */
  angoloNappina?: number;
  /** beccheggio della nappina (rad) */
  beccheggioNappina?: number;
  /** vento relativo 0-1: gonfia e fa vibrare la tela */
  vento?: number;
  /** rollio della planata (radianti) */
  rollio?: number;
}

/**
 * Geometria del Velo nello spazio della camera (vedi `creaVeloPrimaPersona`).
 * Rifinitura 1 (bozzetto 3): la traversa sta bassa, nel quarto basso dello schermo; i montanti
 * partono dalla traversa vicino alle mani e si aprono verso gli angoli in alto (prima facevano una
 * cornice da televisore con l'asta dritta in alto); della tela si vede solo l'orlo cucito e curvo,
 * più alto al centro e più basso agli angoli.
 */
export const VELO = {
  /** traversa: quota, profondità, mezza lunghezza, raggio */
  yT: -0.25,
  zT: -0.42,
  mezza: 0.62,
  rT: 0.026,
  /** dove i montanti si legano alla traversa (|x|) */
  attacco: 0.24,
  /** cima dei montanti (sull'orlo della tela, agli angoli) */
  cima: v(1.08, 0.66, -1.0),
  /** di quanto l'orlo sale al centro rispetto agli angoli */
  arcoOrlo: 0.2,
  /** prese delle mani sulla traversa */
  prese: [-0.34, 0.32] as const,
  /** gomiti, fuori campo */
  gomito: v(0.46, -0.52, -0.04),
};

/** Quota dell'orlo della tela a `x` (alla profondità della cima dei montanti). */
function quotaOrlo(x: number): number {
  const k = Math.min(1.6, (x / VELO.cima.x) ** 2);
  return VELO.cima.y + VELO.arcoOrlo * (1 - k);
}

/** Fasce di cuoio avvolte a spirale attorno a una barra lungo X. */
function fasciatura(f: FormePrimoPiano, x0: number, x1: number, y: number, z: number, r: number, colore: number | readonly [number, number, number], materia: number = MATERIA.CUOIO, spessore = 0.0042, passo = 0.011): void {
  const giri = Math.max(1, Math.round((x1 - x0) / passo));
  const pts: THREE.Vector3[] = [];
  const n = giri * 10;
  for (let i = 0; i <= n; i++) {
    const a = (i / 10) * Math.PI * 2;
    pts.push(v(x0 + ((x1 - x0) * i) / n, y + Math.cos(a) * r, z + Math.sin(a) * r));
  }
  f.tubo(pts, spessore, { colore, materia, ellisse: 0.5, segmenti: 5, passi: n, liscio: false, occlusione: 0.12 });
}

/** Legatura di corda attorno a un giunto: giri attorno a un segmento (a→b), raggio r. */
function legatura(f: FormePrimoPiano, a: THREE.Vector3, b: THREE.Vector3, r: number, giri: number, colore: number | readonly [number, number, number] = PALETTE.canapa): void {
  const d = b.clone().sub(a);
  const l = d.length();
  const T = d.clone().normalize();
  const N = Math.abs(T.y) < 0.9 ? v(0, 1, 0).cross(T).normalize() : v(1, 0, 0).cross(T).normalize();
  const B = T.clone().cross(N).normalize();
  const pts: THREE.Vector3[] = [];
  const n = giri * 10;
  for (let i = 0; i <= n; i++) {
    const ang = (i / 10) * Math.PI * 2;
    pts.push(a.clone().addScaledVector(T, (l * i) / n).addScaledVector(N, Math.cos(ang) * r).addScaledVector(B, Math.sin(ang) * r));
  }
  f.tubo(pts, 0.0036, { colore, materia: MATERIA.CORDA, segmenti: 5, passi: n, liscio: false, occlusione: 0.12 });
}

/** Il Velo in prima persona (da aggiungere alla camera). */
export function creaVeloPrimaPersona(opz: OpzioniVelo = {}): OggettoProcedurale<StatoVelo> {
  const seme = semeNumerico(opz.seme ?? 'velo');
  const rng = new Rng(seme);
  const f = new FormePrimoPiano();
  const { yT, zT, mezza, rT } = VELO;
  const frassino = 0x8a5a36;
  const legnoScuro = 0x5c3b25;
  // traversa: un po' più grossa al centro, venatura lungo la barra
  f.tubo([v(-mezza - 0.02, yT, zT), v(0, yT, zT), v(mezza + 0.02, yT, zT)], (t) => rT * (0.92 + 0.12 * Math.sin(Math.PI * t)), {
    colore: frassino,
    materia: MATERIA.LEGNO,
    segmenti: 14,
    passi: 40,
    chiudiInizio: true,
    chiudiFine: true,
    lato: v(0, 1, 0),
  });
  // fasce di cuoio dove si impugna e al centro, con l'anello di ferro della corda di sospensione
  for (const x of VELO.prese) fasciatura(f, x - 0.075, x + 0.075, yT, zT, rT + 0.002, misto(COLORI_MANI.guantoScuro, 0x000000, 0.1));
  fasciatura(f, -0.04, 0.04, yT, zT, rT + 0.002, 0x7a5236, MATERIA.CUOIO, 0.0045, 0.012);
  // montanti di castagno: dalla traversa, accanto alle mani, si aprono verso gli angoli in alto
  // dove reggono l'orlo della tela (legature di corda in basso e in cima)
  for (const s of [-1, 1]) {
    const a = v(s * VELO.attacco, yT + 0.006, zT - 0.006);
    const c = v(s * VELO.cima.x, VELO.cima.y + 0.01, VELO.cima.z + 0.02);
    // un filo d'arco (il castagno piegato al vapore), più grosso in basso
    const mezzo = a.clone().lerp(c, 0.5).add(v(-s * 0.02, 0.015, 0));
    f.tubo([a.clone().add(v(0, -0.035, 0.008)), a, mezzo, c, c.clone().add(v(s * 0.05, 0.03, -0.02))], [0.021, 0.02, 0.0175, 0.0155, 0.015], { colore: legnoScuro, materia: MATERIA.LEGNO, segmenti: 10, chiudiInizio: true, chiudiFine: true });
    // legatura sul giunto basso (attorno alla traversa e al piede del montante)
    legatura(f, v(s * (VELO.attacco - 0.045), yT, zT), v(s * (VELO.attacco + 0.045), yT, zT), rT + 0.004, 7);
    const dir = c.clone().sub(a).normalize();
    legatura(f, a.clone().addScaledVector(dir, 0.015), a.clone().addScaledVector(dir, 0.07), 0.024, 5);
    legatura(f, c.clone().addScaledVector(dir, -0.1), c.clone().addScaledVector(dir, -0.025), 0.02, 5, misto(PALETTE.canapa, PALETTE.canapaScura, 0.4));
  }
  // traversino dell'orlo: solo agli angoli, dove la tela si cuce al montante (al centro l'orlo è libero)
  for (const s of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) {
      const x = s * (VELO.cima.x - 0.12 + k * 0.1);
      pts.push(v(x, quotaOrlo(x) - 0.004, VELO.cima.z - 0.012));
    }
    f.tubo(pts, 0.011, { colore: misto(frassino, 0xb08a60, 0.2), materia: MATERIA.LEGNO, segmenti: 8, chiudiInizio: true, chiudiFine: true });
  }

  // mani sulla traversa e maniche (ferme rispetto alla traversa: una sola draw call col telaio)
  // presa «a uncino»: le nocche dietro la cima della traversa, le prime falangi la scavalcano (si vedono)
  const CENTRO_VELO = { y: -0.03, z: -0.102 };
  const presaVelo = posaAvvolta(CENTRO_VELO, rT + 0.003, 1, 'sotto');
  for (const [i, x] of VELO.prese.entries()) {
    const sinistra = x < 0;
    const fm = new FormePrimoPiano();
    // sulla traversa le mani stanno quasi sempre in controluce (la Linea è sopra, davanti): un cuoio
    // un filo più chiaro e consumato, che non diventi una sagoma nera
    const p = manoGuanto(fm, presaVelo, { consumo: 1, colore: 0x684832 });
    // il dorso guarda in su e verso l'occhio, le dita avvolgono la traversa dal davanti
    const rx = 0.5;
    const m = new THREE.Matrix4().makeRotationX(rx);
    m.multiply(new THREE.Matrix4().makeRotationY(sinistra ? -0.12 : 0.12));
    const off = v(0, CENTRO_VELO.y, CENTRO_VELO.z).applyMatrix4(m);
    m.setPosition(v(x, yT, zT).sub(off));
    if (sinistra) m.multiply(new THREE.Matrix4().makeScale(-1, 1, 1));
    f.unisci(fm, m);
    const polso = p.polso.clone().applyMatrix4(m);
    const gomito = VELO.gomito.clone();
    gomito.x *= sinistra ? -1 : 1;
    manica(f, polso, gomito, { seme: 0.3 + i * 0.4 });
  }
  const telaio = mesh(f, 'velo-telaio');

  // tela: griglia vista da sotto, cucita al bordo; u, v in metri (per la trama e i punti a croce)
  const nx = 26;
  const nz = 11;
  const posT = new Float32Array((nx + 1) * (nz + 1) * 3);
  const colT = new Float32Array((nx + 1) * (nz + 1) * 4);
  const ppT = new Float32Array((nx + 1) * (nz + 1) * 3);
  const base: THREE.Vector3[] = [];
  const libero: number[] = [];
  // lino grezzo caldo: in controluce passa una luce color miele (il materiale della tela)
  const cTela = new THREE.Color(opz.tela ?? 0xf0dfbd);
  const zC = VELO.cima.z;
  const righe: Array<[number, number]> = [];
  // le prime due righe sono l'orlo rivoltato e cucito, poi la tela sale verso la nuca; le quote
  // sono relative all'orlo, che è curvo (più alto al centro: lì la tela quasi non si vede)
  righe.push([-0.008, zC - 0.026]);
  righe.push([0.034, zC - 0.01]);
  for (let j = 2; j <= nz; j++) {
    const w = (j - 1) / (nz - 1);
    righe.push([0.04 + w * 0.42 + Math.sin(Math.PI * w) * 0.06, zC + w * 1.55]);
  }
  for (let j = 0; j <= nz; j++) {
    const [y0, z0] = righe[j]!;
    const w = j / nz;
    for (let i = 0; i <= nx; i++) {
      const uu = i / nx;
      const x = (uu - 0.5) * 3.6;
      // la tela si alza verso i lati (camber) e si gonfia fra le cuciture
      const y = quotaOrlo(x) + y0 + Math.pow(Math.abs(uu - 0.5) * 2, 2) * 0.1 * Math.min(1, w * 3) + (j > 1 ? Math.abs(Math.sin((x / 0.42) * Math.PI)) * 0.012 : 0);
      base.push(v(x, y, z0));
      libero.push(j > 1 ? Math.sin(Math.PI * uu) * Math.min(1, (j - 1) / 4) : 0);
      const k = j * (nx + 1) + i;
      const tono = 0.97 + rng.centrato(0.03) - (j < 2 ? 0.06 : 0);
      colT[k * 4] = cTela.r * tono;
      colT[k * 4 + 1] = cTela.g * tono;
      colT[k * 4 + 2] = cTela.b * tono;
      colT[k * 4 + 3] = MATERIA.TELA;
    }
  }
  // u e v in metri lungo la tela
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i;
      const p = base[k]!;
      let vv = 0;
      for (let jj = 1; jj <= j; jj++) vv += base[jj * (nx + 1) + i]!.distanceTo(base[(jj - 1) * (nx + 1) + i]!);
      ppT[k * 3] = p.x + 1.8;
      ppT[k * 3 + 1] = vv;
      ppT[k * 3 + 2] = j === 1 ? 0.25 : j === 0 ? 0.35 : 0.04;
    }
  }
  const idxT: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idxT.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1);
    }
  }
  const gTela = new THREE.BufferGeometry();
  gTela.setAttribute('position', new THREE.BufferAttribute(posT, 3));
  gTela.setAttribute('aColor', new THREE.BufferAttribute(colT, 4));
  gTela.setAttribute('aPP', new THREE.BufferAttribute(ppT, 3));
  gTela.setIndex(idxT);
  const tela = mesh(gTela, 'velo-tela', true);

  // nappina: cordino, perlina di legno, testa fasciata, frange (pendolo)
  const fn = new FormePrimoPiano();
  fn.tubo([v(0, 0.01, 0), v(0.002, -0.05, 0), v(0, -0.105, 0)], 0.0028, { colore: PALETTE.canapaScura, materia: MATERIA.CORDA, segmenti: 5 });
  fn.ellissoide(v(0, -0.112, 0), v(0.0135, 0.012, 0.0135), new THREE.Quaternion(), { colore: 0xa77a4a, materia: MATERIA.LEGNO, w: 10, h: 8 });
  const rosso = 0xa8331f;
  fn.tubo([v(0, -0.124, 0), v(0, -0.15, 0)], [0.006, 0.0125], { colore: rosso, materia: MATERIA.FILO, segmenti: 10, chiudiInizio: true });
  fn.tubo([v(0, -0.137, 0), v(0, -0.145, 0)], 0.0118, { colore: 0x5e2014, materia: MATERIA.FILO, segmenti: 10 });
  // anima della frangia (un cono pieno: la nappina si legge come una massa) e i fili sopra
  fn.tubo([v(0, -0.146, 0), v(0, -0.2, 0), v(0, -0.262, 0)], [0.0118, 0.0165, 0.0175], { colore: misto(rosso, 0x5e2014, 0.35), materia: MATERIA.FILO, segmenti: 12, chiudiFine: true });
  for (let k = 0; k < 30; k++) {
    const a = (k / 30) * Math.PI * 2 + rng.centrato(0.15);
    const r0 = 0.0105;
    const l = 0.118 + rng.centrato(0.016);
    const spread = 0.006 + rng.next() * 0.006;
    const p0 = v(Math.cos(a) * r0, -0.146, Math.sin(a) * r0);
    const p1 = v(Math.cos(a) * (r0 + spread * 0.6), -0.146 - l * 0.5, Math.sin(a) * (r0 + spread * 0.6));
    const p2 = v(Math.cos(a) * (r0 + spread), -0.146 - l, Math.sin(a) * (r0 + spread));
    fn.tubo([p0, p1, p2], [0.0034, 0.0032, 0.0022], { colore: misto(rosso, k % 4 === 0 ? 0x5e2014 : 0xc4502c, rng.next() * 0.55), materia: MATERIA.FILO, segmenti: 4, passi: 6, chiudiFine: true });
  }
  const nappina = mesh(fn, 'velo-nappina', true);
  nappina.scale.setScalar(1.55);
  // la nappina pende dal montante destro, sotto la legatura alta: sempre in vista in alto a destra
  const pernoNappina = new THREE.Group();
  const dirMont = VELO.cima.clone().sub(v(VELO.attacco, VELO.yT, VELO.zT)).normalize();
  pernoNappina.position.copy(VELO.cima).addScaledVector(dirMont, -0.14).add(v(0, -0.02, 0.03));
  pernoNappina.add(nappina);

  const gruppo = new THREE.Group();
  gruppo.name = 'velo-prima-persona';
  const assetto = new THREE.Group();
  assetto.add(telaio, tela, pernoNappina);
  gruppo.add(assetto);

  let t = rng.next() * 3;
  let angNappina = 0;
  let velNappina = 0;
  let vento = 0.5;
  const nor = new THREE.Vector3();
  const update = (dt: number, stato?: StatoVelo) => {
    t += dt;
    vento = smorza(vento, stato?.vento ?? 0.5, 2, dt);
    // tela che vibra e si gonfia
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i;
        const p = base[k]!;
        const l = libero[k]!;
        const uu = i / nx;
        const w = j / nz;
        const onda = Math.sin(t * 9 + uu * 7 + w * 3) * 0.008 * vento + Math.sin(t * 2.3 + uu * 3) * 0.014 * vento;
        posT[k * 3] = p.x;
        posT[k * 3 + 1] = p.y + l * (0.035 * vento + onda);
        posT[k * 3 + 2] = p.z;
      }
    }
    gTela.getAttribute('position').needsUpdate = true;
    gTela.computeVertexNormals();
    // vista da sotto: le normali guardano in giù (verso l'occhio), la luce passa dall'alto
    const n = gTela.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) {
      nor.fromBufferAttribute(n, i);
      if (nor.y > 0) nor.negate();
      n.setXYZ(i, nor.x, nor.y, nor.z);
    }
    n.needsUpdate = true;
    // nappina: angolo imposto (fisica del motore) oppure pendolo smorzato verso la deriva
    if (stato?.angoloNappina !== undefined) {
      angNappina = stato.angoloNappina;
      velNappina = 0;
    } else {
      const deriva = stato?.deriva ?? 0;
      const obiettivo = THREE.MathUtils.clamp(deriva, -1, 1) * 0.8 + Math.sin(t * 3.1) * 0.05 * vento;
      const acc = (obiettivo - angNappina) * 30 - velNappina * 4;
      velNappina += acc * dt;
      angNappina += velNappina * dt;
    }
    pernoNappina.rotation.z = angNappina;
    pernoNappina.rotation.x = stato?.beccheggioNappina ?? Math.sin(t * 2.2) * 0.08 * vento;
    // assetto: piccolo tremolio e rollio
    assetto.rotation.z = smorza(assetto.rotation.z, -(stato?.rollio ?? 0) * 0.3, 3, dt) + Math.sin(t * 13) * 0.0015 * vento;
    assetto.position.y = Math.sin(t * 1.4) * 0.004;
  };
  update(0);
  return risultato<StatoVelo>({
    nome: 'velo-prima-persona',
    seme,
    gruppo,
    collider: [],
    ingombro: ingombroDa(gruppo),
    punti: { nappina: pernoNappina.position.clone(), traversa: v(0, yT, zT) },
    update,
  });
}

// ---------------------------------------------------------------------------------------------
// Lettera
// ---------------------------------------------------------------------------------------------

export interface StatoLettera {
  /** 0 abbassata fuori campo … 1 alzata davanti agli occhi */
  alzata?: number;
}

/**
 * La lettera di Marta tenuta nella destra (bozzetto 1): foglio di carta da lettere ingiallito,
 * piegato in tre (le pieghe prendono la luce), scritto fitto in corsivo. Il foglio sta in un
 * nodo che si alza e si abbassa con `alzata`.
 */
export function creaLetteraPrimaPersona(opz: { seme?: Seme } = {}): OggettoProcedurale<StatoLettera> {
  const seme = semeNumerico(opz.seme ?? 'lettera');
  const rng = new Rng(seme);
  // foglio: 0,21 × 0,27, tre fasce (piegato in tre e riaperto), un angolo che si arriccia
  const W = 0.2;
  const H = 0.26;
  const nx = 10;
  const ny = 15;
  const pos: number[] = [];
  const col: number[] = [];
  const pp: number[] = [];
  const carta = new THREE.Color(0xd9c094);
  // quota del foglio: pieghe in tre (orizzontali, monte e valle) e a metà (verticale), che prendono
  // la luce, e un angolo che si arriccia
  const zCarta = (x: number, y: number): number => {
    const fascia = y / H + 0.5;
    const u = x / W + 0.5;
    const piega = Math.max(0, 1 - Math.abs(fascia - 1 / 3) / 0.07) * 0.006 - Math.max(0, 1 - Math.abs(fascia - 2 / 3) / 0.07) * 0.005 + Math.max(0, 1 - Math.abs(u - 0.5) / 0.12) * 0.004;
    const arriccia = Math.max(0, u - 0.75) * Math.max(0, fascia - 0.7) * 0.18;
    return piega + arriccia + Math.sin(x * 30) * 0.002;
  };
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = (i / nx - 0.5) * W;
      const y = (j / ny - 0.5) * H;
      pos.push(x, y, zCarta(x, y));
      const tono = 0.95 + rng.centrato(0.04);
      col.push(carta.r * tono, carta.g * tono, carta.b * tono, MATERIA.CARTA);
      pp.push(x + W / 2, y + H / 2, 0);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idx.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 4));
  g.setAttribute('aPP', new THREE.Float32BufferAttribute(pp, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // righe di scrittura: tratti scuri sottili (inchiostro seppia), su una seconda geometria appena sopra
  const fs = new FormePrimoPiano();
  for (let r = 0; r < 19; r++) {
    const y = H / 2 - 0.028 - r * 0.0118;
    let x = -W / 2 + 0.018 + (r === 0 ? 0.04 : 0);
    const fine = W / 2 - 0.016 - (r % 6 === 5 ? 0.07 : rng.next() * 0.02);
    while (x < fine) {
      const l = Math.min(fine - x, 0.008 + rng.next() * 0.03);
      const pts: THREE.Vector3[] = [];
      const n = Math.max(2, Math.round(l / 0.003));
      for (let k = 0; k <= n; k++) {
        const xx = x + (l * k) / n;
        const yy = y + Math.sin(xx * 900 + r) * 0.0016 + (k % 2 ? 0.0012 : -0.0006);
        pts.push(v(xx, yy, zCarta(xx, yy) + 0.0012));
      }
      fs.tubo(pts, 0.00045, { colore: 0x3d2a1c, materia: MATERIA.PIENA, segmenti: 3, liscio: false, passi: n });
      x += l + 0.004 + rng.next() * 0.004;
    }
  }
  const foglio = mesh(g, 'lettera-foglio', true);
  const scritta = mesh(fs, 'lettera-scritta');
  // la destra lo tiene per il bordo basso: pollice davanti, dita dietro
  const fm = new FormePrimoPiano();
  // la destra tiene l'angolo basso a destra: il dorso del guanto verso l'occhio, le dita distese sul
  // foglio (si vedono, come nel bozzetto), il pollice dietro
  const pm = manoGuanto(fm, posaAngoli([[0.3, 0.45, 0.3], [0.26, 0.42, 0.3], [0.34, 0.48, 0.32], [0.45, 0.55, 0.35]], [0.35, 0.95, 0.3], [-0.006, 0, 0.01, 0.026]), { consumo: 0.5 });
  const mMano = matriceMano(v(0.175, -0.115, 0.03), v(-0.93, 0.37, 0), v(0, 0.15, 1));
  const fM = new FormePrimoPiano();
  fM.unisci(fm, mMano);
  const polso = pm.polso.clone().applyMatrix4(mMano);
  manica(fM, polso, polso.clone().add(v(0.2, -0.45, 0.25)), { seme: 0.5 });
  const mano = mesh(fM, 'lettera-mano');
  const nodo = new THREE.Group();
  nodo.add(foglio, scritta, mano);
  const gruppo = new THREE.Group();
  gruppo.name = 'lettera-prima-persona';
  gruppo.add(nodo);
  const su = { p: v(0.235, -0.15, -0.44), r: e(0.12, -0.38, -0.2) };
  const giu = { p: v(0.45, -0.85, -0.45), r: e(0.6, -0.4, -0.3) };
  let alz = 1;
  const update = (dt: number, stato?: StatoLettera) => {
    alz = dt <= 0 ? stato?.alzata ?? alz : smorza(alz, stato?.alzata ?? 1, 5, dt);
    nodo.position.lerpVectors(giu.p, su.p, alz);
    nodo.rotation.set(THREE.MathUtils.lerp(giu.r.x, su.r.x, alz), THREE.MathUtils.lerp(giu.r.y, su.r.y, alz), THREE.MathUtils.lerp(giu.r.z, su.r.z, alz), 'YXZ');
    nodo.visible = alz > 0.02;
  };
  update(0, { alzata: 1 });
  return risultato<StatoLettera>({
    nome: 'lettera-prima-persona',
    seme,
    gruppo,
    collider: [],
    ingombro: ingombroDa(gruppo),
    punti: { foglio: v(0, 0, 0) },
    update,
  });
}

/** Il pigmento del guanto, per chi disegna altre mani (UI, taccuino). */
export const COLORE_GUANTO = COLORI_MANI.guanto;
export { CUOIO_CUCITO };
