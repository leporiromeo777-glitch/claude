/**
 * Oggetti in prima persona (da agganciare alla camera: la camera guarda −Z, +Y in su, +X a destra):
 * - lo squadro a cannocchiale di Aurelio con le mani guantate di Elvira, in due pose:
 *   'mano' (tenuto in mano come cannocchiale) e 'piantato' (piantato sul chiodo del caposaldo),
 *   più 'riposo' (abbassato fuori campo); le transizioni sono animate;
 * - il Velo: traversa di legno, tela cucita a punti a croce, montanti legati con la corda, nappina
 *   che pende dalla parte della deriva.
 * Guanti da giardino rattoppati, maniche verdi (che seguono i polsi), l'anello di fidanzamento al dito.
 */
import * as THREE from 'three';
import { Costruttore, mat, matSegmento, mescola } from '../costruttore';
import { ingombroDa, risultato, smorza } from '../comune';
import { geoBoxC, geoCilindro, geoCono, geoEstrusione, geoSfera, geoToro, geoTubo } from '../forme';
import { materialePer } from '../materiali';
import { PALETTE } from '../palette';
import { Rng, semeNumerico, type Seme } from '../rng';
import type { OggettoProcedurale } from '../tipi';

/** Punto su un arco attorno all'asse Y (angolo φ da +X verso −Z). */
function arco(r: number, phi: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(phi) * r, y, -Math.sin(phi) * r);
}
const gradi = THREE.MathUtils.degToRad;

/**
 * Mano destra guantata che impugna una barra di raggio rc con l'asse lungo Y (nell'origine).
 * Il dorso guarda +X, le dita avvolgono la barra passando davanti (−Z), il polso sta dietro (+Z).
 * Per la mano sinistra si specchia la matrice (scala x −1). Restituisce il punto del polso
 * (fine del polsino) nello spazio di `m`, dove attaccare la manica.
 */
export function manoPresa(b: Costruttore, m: THREE.Matrix4, rc: number, opz: { anello?: boolean } = {}): THREE.Vector3 {
  const g = PALETTE.guanto;
  const gs = PALETTE.guantoScuro;
  const add = (geo: THREE.BufferGeometry, colore: number | THREE.Color, mm?: THREE.Matrix4, piatto = false) =>
    b.aggiungi(geo, { matrice: mm ? m.clone().multiply(mm) : m, colore, piatto, gradiente: { basso: 0.85, alto: 1.08, y0: -0.06, y1: 0.06 } });
  // dita: quattro archi attorno alla barra
  const rf = 0.0105;
  const ys = [0.033, 0.011, -0.011, -0.032];
  for (let i = 0; i < 4; i++) {
    const y = ys[i] as number;
    const accorcia = i === 3 ? 0.8 : 1;
    const pts = [
      arco(rc + 0.03, gradi(35), y),
      arco(rc + rf + 0.002, gradi(80), y),
      arco(rc + rf + 0.001, gradi(80 + 70 * accorcia), y),
      arco(rc + rf + 0.002, gradi(80 + 125 * accorcia), y - 0.002),
    ];
    add(geoTubo(pts, [rf * 1.05, rf, rf * 0.95, rf * 0.85], 6, { chiudiFine: true }), i % 2 === 0 ? g : mescola(g, 0xffffff, 0.04));
    // anello di fidanzamento sull'anulare: una fascetta d'oro attorno al dito, sopra il guanto
    if (opz.anello && i === 2) {
      const fascia = [92, 97, 102].map((a) => arco(rc + rf + 0.002, gradi(a), y));
      add(geoTubo(fascia, [rf * 1.22], 8), PALETTE.ottoneChiaro);
    }
  }
  // corpo della mano (dal polso alle nocche), all'esterno della barra
  const W = arco(rc + 0.045, gradi(-50), 0.0);
  const K = arco(rc + 0.03, gradi(30), 0.0);
  const centro = W.clone().lerp(K, 0.5);
  const dirM = K.clone().sub(W).normalize();
  const qM = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirM);
  add(geoSfera(1, 10, 8), g, new THREE.Matrix4().compose(centro, qM, new THREE.Vector3(0.03, 0.052, W.distanceTo(K) * 0.62)));
  // nocche
  add(geoTubo([arco(rc + 0.034, gradi(35), 0.045), arco(rc + 0.034, gradi(35), -0.042)], [0.012], 6, { chiudiInizio: true, chiudiFine: true }), gs);
  // toppa più chiara sul dorso (rattoppo) con due punti di cucitura
  const dorso = centro.clone().add(new THREE.Vector3(0.029, 0.004, 0));
  add(new THREE.CircleGeometry(0.021, 6), PALETTE.guantoCucitura, new THREE.Matrix4().compose(dorso, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)), new THREE.Vector3(1, 1.2, 1)));
  for (const dy of [-0.017, 0.017]) add(geoBoxC(0.002, 0.004, 0.022), PALETTE.noceScuro, mat(dorso.clone().add(new THREE.Vector3(0.002, dy, 0))), true);
  // pollice: passa sopra e dietro la barra
  const pollice = [arco(rc + 0.03, gradi(-55), 0.03), arco(rc + 0.016, gradi(-80), 0.045), arco(rc + 0.012, gradi(-125), 0.046), arco(rc + 0.012, gradi(-160), 0.044)];
  add(geoTubo(pollice, [0.013, 0.012, 0.011, 0.0095], 6, { chiudiFine: true }), g);
  // polsino a manopola con l'orlo cucito
  const dirAvambraccio = new THREE.Vector3(0.55, -0.45, 0.7).normalize();
  const p1 = W.clone().addScaledVector(dirAvambraccio, 0.1);
  add(geoTubo([W, p1], [0.036, 0.05], 8, { chiudiInizio: true }), gs);
  add(geoTubo([p1.clone().addScaledVector(dirAvambraccio, -0.006), p1.clone().addScaledVector(dirAvambraccio, 0.004)], [0.052, 0.052], 8), PALETTE.guantoCucitura);
  return p1.clone().applyMatrix4(m);
}

/** Mano destra appoggiata di piatto (dita in avanti verso −Z, palmo in giù), polso nell'origine. Restituisce il polso. */
export function manoAppoggiata(b: Costruttore, m: THREE.Matrix4): THREE.Vector3 {
  const g = PALETTE.guanto;
  const add = (geo: THREE.BufferGeometry, colore: number | THREE.Color, mm?: THREE.Matrix4) =>
    b.aggiungi(geo, { matrice: mm ? m.clone().multiply(mm) : m, colore, gradiente: { basso: 0.8, alto: 1.08, y0: -0.03, y1: 0.04 } });
  add(geoSfera(1, 10, 8), g, mat([0, 0.018, -0.055], [0, 0, 0], [0.048, 0.022, 0.06]));
  for (let i = 0; i < 4; i++) {
    const x = -0.033 + i * 0.022;
    const l = i === 3 ? 0.055 : i === 0 ? 0.065 : 0.075;
    add(
      geoTubo([new THREE.Vector3(x, 0.02, -0.1), new THREE.Vector3(x * 1.05, 0.018, -0.1 - l * 0.6), new THREE.Vector3(x * 1.08, 0.005, -0.1 - l)], [0.0105, 0.0098, 0.009], 6, { chiudiFine: true }),
      i % 2 === 0 ? g : mescola(g, 0xffffff, 0.04),
    );
  }
  add(geoTubo([new THREE.Vector3(-0.04, 0.015, -0.035), new THREE.Vector3(-0.065, 0.012, -0.07), new THREE.Vector3(-0.072, 0.006, -0.1)], [0.013, 0.012, 0.0105], 6, { chiudiFine: true }), g);
  add(new THREE.CircleGeometry(0.02, 6), PALETTE.guantoCucitura, mat([0.008, 0.041, -0.055], [-Math.PI / 2, 0, 0.3], [1.2, 1, 1]));
  const dir = new THREE.Vector3(0.25, -0.1, 1).normalize();
  const p1 = new THREE.Vector3(0, 0.02, 0).addScaledVector(dir, 0.1);
  add(geoTubo([new THREE.Vector3(0, 0.02, -0.01), p1], [0.034, 0.05], 8, { chiudiInizio: true }), PALETTE.guantoScuro);
  return p1.clone().applyMatrix4(m);
}

/** Manica verde della giacca: va dal polso a un «gomito» fuori campo e si riorienta ogni fotogramma. */
function creaManica(rng: Rng, nome: string): { mesh: THREE.Mesh; orienta: (polso: THREE.Vector3, gomito: THREE.Vector3) => void } {
  const b = new Costruttore(rng.derivato(nome));
  b.aggiungi(geoTubo([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 1, 0)], [0.054, 0.078], 9, { chiudiInizio: true }), {
    colore: PALETTE.manica,
    gradiente: { basso: 1.05, alto: 0.8, y0: 0, y1: 1 },
  });
  b.aggiungi(geoTubo([new THREE.Vector3(0, 0.0, 0), new THREE.Vector3(0, 0.06, 0)], [0.058, 0.06], 9), { colore: PALETTE.manicaScura });
  const mesh = b.mesh(nome, 'opaco', false) as THREE.Mesh;
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  const su = new THREE.Vector3(0, 1, 0);
  const d = new THREE.Vector3();
  const orienta = (polso: THREE.Vector3, gomito: THREE.Vector3) => {
    d.subVectors(gomito, polso);
    const l = d.length();
    mesh.position.copy(polso);
    mesh.quaternion.setFromUnitVectors(su, d.divideScalar(l || 1));
    mesh.scale.set(1, l, 1);
  };
  return { mesh, orienta };
}

/** Squadro a cannocchiale: origine sulla punta del puntale, asta lungo +Y, cannocchiale verso −Z. */
function squadro(b: Costruttore): { quotaCannocchiale: number; quotaPresa: number } {
  const ott = PALETTE.ottone;
  const scuro = PALETTE.ottoneScuro;
  const chiaro = PALETTE.ottoneChiaro;
  const grad = { basso: 0.85, alto: 1.1, y0: 0, y1: 0.6 };
  // puntale e disco d'appoggio
  b.aggiungi(geoCono(0.012, 0.12, 10), { matrice: mat([0, 0.12, 0], [Math.PI, 0, 0]), colore: ott, gradiente: grad });
  b.aggiungi(geoCilindro(0.036, 0.036, 0.012, 16), { matrice: mat([0, 0.12, 0]), colore: chiaro });
  b.aggiungi(geoToro(0.036, 0.003, 4, 16), { matrice: mat([0, 0.132, 0], [Math.PI / 2, 0, 0]), colore: scuro });
  // asta
  b.aggiungi(geoCilindro(0.011, 0.012, 0.42, 10), { matrice: mat([0, 0.132, 0]), colore: ott, gradiente: grad });
  b.aggiungi(geoCilindro(0.015, 0.015, 0.02, 10), { matrice: mat([0, 0.3, 0]), colore: scuro });
  // montante piatto e squadra triangolare cava a destra
  b.aggiungi(geoBoxC(0.034, 0.22, 0.008), { matrice: mat([0.012, 0.435, 0.0]), colore: ott, gradiente: grad, piatto: true });
  const tri = new THREE.Shape();
  tri.moveTo(0.02, 0.3);
  tri.lineTo(0.02, 0.545);
  tri.lineTo(0.24, 0.545);
  tri.lineTo(0.02, 0.3);
  const foro = new THREE.Path();
  foro.moveTo(0.045, 0.37);
  foro.lineTo(0.17, 0.523);
  foro.lineTo(0.045, 0.523);
  foro.lineTo(0.045, 0.37);
  tri.holes.push(foro);
  b.aggiungi(geoEstrusione(tri, 0.006), { colore: ott, gradiente: grad, piatto: true });
  // viti
  for (const [x, y] of [[0.03, 0.535], [0.2, 0.535], [0.03, 0.33]] as const) {
    b.aggiungi(geoCilindro(0.005, 0.005, 0.004, 6), { matrice: mat([x, y, 0.004], [Math.PI / 2, 0, 0]), colore: scuro });
  }
  // supporto del cannocchiale
  b.aggiungi(geoBoxC(0.03, 0.03, 0.05), { matrice: mat([0, 0.56, 0]), colore: scuro, piatto: true });
  b.aggiungi(geoCilindro(0.008, 0.008, 0.02, 8), { matrice: mat([0, 0.585, 0.0]), colore: chiaro });
  b.aggiungi(geoCilindro(0.012, 0.012, 0.006, 8), { matrice: mat([0, 0.605, 0.0]), colore: scuro });
  // cannocchiale lungo Z
  const yC = 0.6;
  const tubo = (r0: number, r1: number, z0: number, z1: number, colore: number) =>
    b.aggiungi(geoCilindro(r1, r0, z1 - z0, 14), { matrice: mat([0, yC, z0], [Math.PI / 2, 0, 0]), colore, gradiente: { basso: 0.8, alto: 1.1, y0: yC - 0.02, y1: yC + 0.02 } });
  // nota: dopo la rotazione l'asse del cilindro va verso +Z a partire da z0
  tubo(0.019, 0.019, -0.16, 0.08, ott);
  tubo(0.025, 0.025, -0.2, -0.155, scuro);
  tubo(0.021, 0.021, -0.205, -0.198, PALETTE.ferro);
  tubo(0.0215, 0.0215, -0.02, 0.0, scuro);
  tubo(0.013, 0.013, 0.08, 0.13, chiaro);
  tubo(0.016, 0.016, 0.125, 0.145, PALETTE.ferro);
  // lenti (vetro scuro azzurrato)
  b.aggiungi(new THREE.CircleGeometry(0.019, 12), { matrice: mat([0, yC, -0.2055], [0, Math.PI, 0]), colore: 0x26384a });
  b.aggiungi(new THREE.CircleGeometry(0.008, 10), { matrice: mat([0, yC, 0.1455]), colore: 0x1a2430 });
  // livella a bolla sul fianco (quella che trema sul Pilastro 12)
  b.aggiungi(geoBoxC(0.012, 0.012, 0.06), { matrice: mat([-0.026, yC - 0.006, -0.06]), colore: scuro, piatto: true });
  b.aggiungi(geoCilindro(0.005, 0.005, 0.045, 8), { matrice: mat([-0.026, yC + 0.002, -0.0825], [Math.PI / 2, 0, 0]), colore: 0xb9d39a });
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
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const e = (x: number, y: number, z: number) => new THREE.Euler(x, y, z, 'YXZ');

/** Posizione (spazio camera) del puntale nella posa 'piantato': serve per far coincidere la camera col chiodo. */
export const PUNTALE_PIANTATO = v(0.02, -0.5, -0.85);

/** Pose: strumento (punta del puntale) in spazio camera, mani agganciate allo strumento o alla camera. */
const POSE: Record<PosaSquadro, Posa> = {
  // piantato sul chiodo davanti, sul muro: la sinistra impugna l'asta, la destra è appoggiata sul muro
  piantato: {
    strumento: [PUNTALE_PIANTATO.clone(), e(0, 0.3, 0)],
    sinistra: { strumento: [v(0, 0.22, 0), e(0, -0.35, 0)] },
    destra: { camera: [v(0.27, -0.47, -0.95), e(0.3, -0.45, 0.05)] },
    destraAppoggiata: true,
  },
  // tenuto in mano come cannocchiale: la destra impugna l'asta, la sinistra culla il tubo
  mano: {
    strumento: [v(0.17, -0.68, -0.55), e(0.06, 0.45, 0.03)],
    destra: { strumento: [v(0, 0.22, 0), e(0, 0.3, 0)] },
    sinistra: { strumento: [v(0, 0.6, -0.1), e(Math.PI / 2, 0, 0)] },
    destraAppoggiata: false,
  },
  riposo: {
    strumento: [v(0.25, -1.45, -0.5), e(0.4, 0.4, 0.2)],
    destra: { strumento: [v(0, 0.22, 0), e(0, 0.3, 0)] },
    sinistra: { camera: [v(-0.3, -1.1, -0.45), e(0.4, -0.2, -0.2)] },
    destraAppoggiata: false,
  },
};

const mDa = ([p, r]: Trasf) => new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(r), new THREE.Vector3(1, 1, 1));

/** Squadro a cannocchiale di Aurelio con le mani di Elvira (da aggiungere alla camera). */
export function creaSquadroPrimaPersona(opz: OpzioniSquadro = {}): OggettoProcedurale<StatoSquadro> {
  const seme = semeNumerico(opz.seme ?? 'squadro');
  const rng = new Rng(seme);
  const bs = new Costruttore(rng.derivato('squadro'));
  const info = squadro(bs);
  const strumento = bs.costruisci('squadro', false);
  // mani (geometrie nel loro spazio; i nodi le muovono)
  const bd = new Costruttore(rng.derivato('destra'));
  const polsoD = manoPresa(bd, new THREE.Matrix4(), 0.012);
  const manoD = bd.costruisci('mano-destra', false);
  const bsn = new Costruttore(rng.derivato('sinistra'));
  const polsoS = manoPresa(bsn, mat([0, 0, 0], [0, 0, 0], [-1, 1, 1]), 0.012, { anello: true });
  const manoS = bsn.costruisci('mano-sinistra', false);
  const bap = new Costruttore(rng.derivato('appoggiata'));
  const polsoDApp = manoAppoggiata(bap, new THREE.Matrix4());
  const manoDApp = bap.costruisci('mano-destra-appoggiata', false);
  const manicaD = creaManica(rng, 'manica-destra');
  const manicaS = creaManica(rng, 'manica-sinistra');

  const gruppo = new THREE.Group();
  gruppo.name = 'squadro-prima-persona';
  const nodoS = new THREE.Group();
  const nodoD = new THREE.Group();
  const nodoSt = new THREE.Group();
  nodoS.add(manoS);
  nodoD.add(manoD, manoDApp);
  nodoSt.add(strumento);
  gruppo.add(nodoSt, nodoD, nodoS, manicaD.mesh, manicaS.mesh);
  for (const g of [strumento, manoD, manoS, manoDApp]) g.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.renderOrder = 5) : null));
  // gomiti fuori campo, in basso ai lati
  const gomitoD = v(0.36, -0.95, 0.05);
  const gomitoS = v(-0.36, -0.95, 0.05);

  let posa: PosaSquadro = opz.posa ?? 'piantato';
  const obiettivoMano = (a: Aggancio, mStrumento: THREE.Matrix4): THREE.Matrix4 => ('strumento' in a ? mStrumento.clone().multiply(mDa(a.strumento)) : mDa(a.camera));
  const avvicina = (n: THREE.Object3D, m: THREE.Matrix4, k: number) => {
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    m.decompose(p, q, s);
    n.position.lerp(p, k);
    n.quaternion.slerp(q, k);
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
      mSt.premultiply(new THREE.Matrix4().makeTranslation(-0.2 * mira, 0.33 * mira, 0.12 * mira));
    }
    avvicina(nodoSt, mSt, k);
    nodoSt.updateMatrix();
    // le mani agganciate allo strumento seguono la sua posizione attuale (restano incollate nelle transizioni)
    avvicina(nodoS, obiettivoMano(P.sinistra, 'strumento' in P.sinistra ? nodoSt.matrix : mSt), 'strumento' in P.sinistra ? 1 : k);
    avvicina(nodoD, obiettivoMano(P.destra, 'strumento' in P.destra ? nodoSt.matrix : mSt), 'strumento' in P.destra ? 1 : k);
    manoD.visible = !P.destraAppoggiata;
    manoDApp.visible = P.destraAppoggiata;
    nodoS.updateMatrix();
    nodoD.updateMatrix();
    manicaS.orienta(polso.copy(polsoS).applyMatrix4(nodoS.matrix), gomitoS);
    manicaD.orienta(polso.copy(P.destraAppoggiata ? polsoDApp : polsoD).applyMatrix4(nodoD.matrix), gomitoD);
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

export interface OpzioniVelo {
  seme?: Seme;
  /** colore della tela */
  tela?: number;
}

export interface StatoVelo {
  /** deriva laterale (−1 sinistra … +1 destra): la nappina pende da quella parte */
  deriva?: number;
  /** vento relativo 0-1: gonfia e fa vibrare la tela */
  vento?: number;
  /** rollio della planata (radianti) */
  rollio?: number;
}

/** Il Velo in prima persona (da aggiungere alla camera). */
export function creaVeloPrimaPersona(opz: OpzioniVelo = {}): OggettoProcedurale<StatoVelo> {
  const seme = semeNumerico(opz.seme ?? 'velo');
  const rng = new Rng(seme);
  const b = new Costruttore(rng.derivato('telaio'));
  const legno = PALETTE.legno;
  const yT = -0.2;
  const zT = -0.56;
  // traversa con fasciature di cuoio dove si impugna
  b.aggiungi(geoCilindro(0.026, 0.026, 1.7, 10), { matrice: mat([-0.85, yT, zT], [0, 0, -Math.PI / 2]), colore: legno, gradiente: { basso: 0.75, alto: 1.1, y0: yT - 0.03, y1: yT + 0.03 } });
  for (const x of [-0.24, 0.24]) {
    for (let k = 0; k < 6; k++) {
      b.aggiungi(geoToro(0.029, 0.006, 4, 10), { matrice: mat([x - 0.06 + k * 0.024, yT, zT], [0, Math.PI / 2, 0.25]), colore: k % 2 ? PALETTE.guantoScuro : PALETTE.noce });
    }
  }
  // montanti verso la tela, legati con la corda
  const montanti: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (const s of [-1, 1]) {
    const a = v(s * 0.62, yT, zT);
    const c = v(s * 1.05, 0.82, -1.15);
    montanti.push([a, c]);
    b.aggiungi(geoCilindro(0.021, 0.024, 1, 8), { matrice: matSegmento(a.clone().add(v(0, -0.04, 0)), c), colore: mescola(legno, 0x000000, 0.1) });
    for (let k = 0; k < 5; k++) {
      b.aggiungi(geoToro(0.032, 0.006, 4, 8), { matrice: mat(a.clone().add(v(s * 0.01 * k, 0.012 * k, 0)), [Math.PI / 2 + 0.3, 0, s * 0.6]), colore: PALETTE.canapa });
    }
  }
  // tela: griglia deformabile, vista da sotto, «traslucida» (normali girate verso la luce)
  const nx = 12;
  const nz = 7;
  const posT = new Float32Array((nx + 1) * (nz + 1) * 3);
  const base: THREE.Vector3[] = [];
  const colT: number[] = [];
  const cTela = new THREE.Color(opz.tela ?? PALETTE.tela);
  const cOmbra = new THREE.Color(PALETTE.telaOmbra);
  const cCuc = new THREE.Color(PALETTE.cucitura);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const w = j / nz;
      const x = (u - 0.5) * 3.6;
      const z = -1.95 + w * 2.0;
      const y = 0.95 + Math.sin(Math.PI * w) * 0.18 - Math.pow(Math.abs(u - 0.5) * 2, 2) * 0.35;
      base.push(v(x, y, z));
      // pannelli cuciti: cuciture più scure ogni tre colonne, orlo scuro sul bordo
      const cucitura = i % 3 === 0 || j === nz;
      const c = cucitura ? cOmbra.clone().lerp(cCuc, 0.55) : cTela.clone().lerp(cOmbra, (i % 3) * 0.1);
      colT.push(c.r, c.g, c.b);
    }
  }
  const idxT: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      idxT.push(a, a + nx + 1, a + 1, a + 1, a + nx + 1, a + nx + 2);
    }
  }
  const gTela = new THREE.BufferGeometry();
  gTela.setAttribute('position', new THREE.BufferAttribute(posT, 3));
  gTela.setAttribute('color', new THREE.Float32BufferAttribute(colT, 3));
  gTela.setIndex(idxT);
  const tela = new THREE.Mesh(gTela, materialePer('sottile'));
  tela.name = 'velo-tela:sottile';
  tela.userData['canale'] = 'sottile';
  tela.frustumCulled = false;
  // punti a croce lungo l'orlo vicino agli occhi (l'ultima fila della tela non si muove: si uniscono al telaio)
  {
    const orlo = base[nz * (nx + 1) + Math.floor(nx / 2)] as THREE.Vector3;
    for (let i = 0; i < 26; i++) {
      const x = -1.5 + i * 0.12;
      for (const s of [-1, 1]) b.aggiungi(geoBoxC(0.05, 0.004, 0.006), { matrice: mat([x, orlo.y - 0.015, orlo.z - 0.01], [0, 0, s * 0.7]), colore: PALETTE.cucitura });
    }
  }

  // nappina: cordino, perlina di legno, frange (pendolo)
  const bn = new Costruttore(rng.derivato('nappina'));
  bn.aggiungi(geoCilindro(0.003, 0.003, 0.11, 4), { matrice: mat([0, -0.11, 0]), colore: PALETTE.canapaScura });
  bn.aggiungi(geoSfera(0.016, 8, 6), { matrice: mat([0, -0.12, 0]), colore: PALETTE.legnoChiaro });
  bn.aggiungi(geoCilindro(0.012, 0.018, 0.02, 8), { matrice: mat([0, -0.155, 0]), colore: PALETTE.vermiglio });
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    bn.aggiungi(geoBoxC(0.005, 0.085, 0.005), {
      matrice: mat([Math.cos(a) * 0.012, -0.2, Math.sin(a) * 0.012], [Math.sin(a) * 0.12, 0, -Math.cos(a) * 0.12]),
      colore: k % 3 === 0 ? mescola(PALETTE.vermiglio, 0x000000, 0.3) : PALETTE.vermiglio,
    });
  }
  const nappina = bn.costruisci('velo-nappina', false);
  const pernoNappina = new THREE.Group();
  const [aD, cD] = montanti[1] as [THREE.Vector3, THREE.Vector3];
  pernoNappina.position.copy(aD.clone().lerp(cD, 0.16)).add(v(-0.03, 0, 0));
  pernoNappina.add(nappina);

  // mani sulla traversa e maniche
  const bm = new Costruttore(rng.derivato('mani'));
  const presa = (x: number, sx: number) => mat([x, yT, zT]).multiply(mat([0, 0, 0], [0, 0, -Math.PI / 2])).multiply(mat([0, 0, 0], [sx > 0 ? -2.3 : 2.3, 0, 0], [1, sx, 1]));
  const polsoD = manoPresa(bm, presa(0.24, 1), 0.026);
  const polsoS = manoPresa(bm, presa(-0.24, -1), 0.026, { anello: true });
  // le maniche qui sono ferme rispetto alla traversa: si cuociono con le mani (una draw call)
  for (const [polso, gomito] of [[polsoD, v(0.42, -0.95, 0.0)], [polsoS, v(-0.42, -0.95, 0.0)]] as const) {
    const manica = creaManica(rng, 'velo-manica');
    manica.orienta(polso, gomito);
    manica.mesh.updateMatrix();
    bm.aggiungi(manica.mesh.geometry, { matrice: manica.mesh.matrix, colore: 'geometria' });
  }
  const mani = bm.costruisci('velo-mani', false);

  const telaio = b.costruisci('velo-telaio', false);
  const gruppo = new THREE.Group();
  gruppo.name = 'velo-prima-persona';
  const assetto = new THREE.Group();
  assetto.add(telaio, tela, pernoNappina, mani);
  gruppo.add(assetto);
  assetto.traverse((o) => ((o as THREE.Mesh).isMesh ? (o.renderOrder = 5) : null));

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
        const p = base[k] as THREE.Vector3;
        const u = i / nx;
        const w = j / nz;
        const libero = Math.sin(Math.PI * u) * Math.sin(Math.PI * w);
        const onda = Math.sin(t * 9 + u * 7 + w * 3) * 0.012 * vento + Math.sin(t * 2.3 + u * 3) * 0.02 * vento;
        posT[k * 3] = p.x;
        posT[k * 3 + 1] = p.y + libero * (0.06 * vento + onda);
        posT[k * 3 + 2] = p.z;
      }
    }
    gTela.getAttribute('position').needsUpdate = true;
    gTela.computeVertexNormals();
    // traslucenza finta: la faccia vista da sotto riceve normali rivolte alla luce (in su)
    const n = gTela.getAttribute('normal') as THREE.BufferAttribute;
    for (let i = 0; i < n.count; i++) {
      nor.fromBufferAttribute(n, i).negate();
      n.setXYZ(i, nor.x, nor.y, nor.z);
    }
    // nappina: pendolo smorzato, pende dalla parte della deriva
    const deriva = stato?.deriva ?? 0;
    const obiettivo = THREE.MathUtils.clamp(deriva, -1, 1) * 0.8 + Math.sin(t * 3.1) * 0.05 * vento;
    const acc = (obiettivo - angNappina) * 30 - velNappina * 4;
    velNappina += acc * dt;
    angNappina += velNappina * dt;
    pernoNappina.rotation.z = angNappina;
    pernoNappina.rotation.x = Math.sin(t * 2.2) * 0.08 * vento;
    // assetto: piccolo tremolio e rollio
    assetto.rotation.z = smorza(assetto.rotation.z, -(stato?.rollio ?? 0) * 0.3, 3, dt) + Math.sin(t * 13) * 0.0015 * vento;
    assetto.position.y = Math.sin(t * 1.4) * 0.006;
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
