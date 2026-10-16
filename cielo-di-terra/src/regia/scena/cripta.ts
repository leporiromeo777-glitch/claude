/**
 * SEGNAPOSTO della Cripta dei Giardinieri (FASE1 §4, P0.1-P0.3), finché il modulo
 * `popolamento` non porta quella vera. Sotto Corbella, a h −4,5 (50 m sotto il suolo):
 *
 * - la sala a volta con le sette capsule a semicerchio attorno a Q; la capsula 5 sta dove
 *   dice luoghi.json (1112, 27,4, −4,5), con il coperchio appannato e la scritta a matita;
 * - l'armadietto n. 5 accanto alla capsula; le buste sui vetri delle capsule 6 e 7;
 * - il corridoio di servizio verso Mont, con gli orari dipinti e la scritta a gesso;
 * - la scala alla marinara e il pozzo, con la botola e il filo di luce grigia.
 *
 * Coordinate locali dell'ancora (botola, z 1112, θ 27,0, h −4,5): e verso Mane, n verso
 * Lag, y in su dal pavimento. Le pareti sono scatole sottili: la stanza si vede da dentro
 * anche se il terreno, visto da sotto, non si disegna.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
} from 'three';
import { GeomBuilder, PRIMS } from '../../render/geomBuilder';
import { SUPERFICIE } from '../../render/superfici';
import type { RGB } from '../../render/palette';
import type { Collider } from '../../world/colliders';
import { Ancora } from './ancora';

/** Quota del pavimento della Cripta (luoghi.json). */
export const QUOTA_CRIPTA = -4.5;
export const ANCORA_CRIPTA = { z: 1112, theta: 27.0 };

/** Centro del semicerchio delle capsule e raggio. */
const Q = { e: 4.5, n: -4.2 };
const RAGGIO_ANELLO = 4.2;
/** Angolo (gradi, da Mane verso Lag) della capsula i (1-7): la 5 a nord di Q. */
export const angoloCapsula = (i: number): number => 210 - 30 * (i - 1);

export function centroCapsula(i: number, r = RAGGIO_ANELLO): { e: number; n: number } {
  const a = (angoloCapsula(i) * Math.PI) / 180;
  return { e: Q.e + r * Math.cos(a), n: Q.n + r * Math.sin(a) };
}

/** Il pozzo della scala. */
export const SCALA = { e: 4.5, n: -13.3, cima: 6.3 };
const SALA = { e0: -1.0, e1: 10.0, n0: -9.0, n1: 1.8, alt: 3.8 };
const CORRIDOIO = { e0: 3.6, e1: 5.4, n0: -14.2, alt: 2.5 };

const PIETRA: RGB = [0.62, 0.6, 0.57];
const VOLTA: RGB = [0.7, 0.66, 0.6];
const PAVIMENTO: RGB = [0.42, 0.4, 0.38];
const METALLO: RGB = [0.5, 0.55, 0.5];
const RAME: RGB = [0.72, 0.42, 0.24];


export interface Cripta {
  gruppo: Group;
  collisori: Collider[];
  lumi: Vector3[];
  ancora: Ancora;
  /** Punti d'interazione (mondo) per id. */
  punti: Record<string, Vector3>;
  /** Posizione degli occhi di Elvira sdraiata nella capsula 5 e punto della scritta. */
  occhiSdraiata: Vector3;
  scritta: Vector3;
  /** Dove si alza Elvira (piedi), guardando la capsula. */
  inPiedi: { z: number; theta: number; yaw: number };
  apriCoperchio(): void;
  apriArmadietto(): void;
  togliBusta(): void;
  apriBotola(): void;
  coperchioAperto(): boolean;
  update(dt: number): void;
}

/** Texture del vetro appannato con la scritta a matita (rovesciata: è scritta da fuori). */
function texturaVetro(conScritta: boolean, gelato: boolean): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(256, 128, 30, 256, 128, 300);
  grad.addColorStop(0, gelato ? 'rgba(232,240,248,0.78)' : 'rgba(214,224,230,0.32)');
  grad.addColorStop(1, gelato ? 'rgba(220,232,244,0.92)' : 'rgba(200,212,220,0.62)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // gocce di condensa
  for (let i = 0; i < 260; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12345.678) % 1;
    g.fillStyle = `rgba(255,255,255,${0.12 + 0.2 * Math.abs(x)})`;
    g.beginPath();
    g.arc(Math.abs(x) * 512, Math.abs(y) * 256, 1 + Math.abs(y) * 3, 0, Math.PI * 2);
    g.fill();
  }
  if (conScritta) {
    g.save();
    g.translate(512, 0);
    g.scale(-1, 1);
    g.font = 'italic 46px "Patrick Hand SC", "Caveat", Georgia, serif';
    g.fillStyle = 'rgba(52,50,58,0.92)';
    g.textAlign = 'center';
    g.fillText('Non fidarti', 256, 112);
    g.fillText('delle campane', 256, 166);
    g.restore();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function costruisciCripta(materiale: Material): Cripta {
  const A = new Ancora(ANCORA_CRIPTA.z, ANCORA_CRIPTA.theta, QUOTA_CRIPTA);
  const b = new GeomBuilder();
  const col: Collider[] = [];
  const gruppo = new Group();
  gruppo.name = 'cripta-segnaposto';
  const sp = 0.4; // spessore delle pareti

  // --- sala ---
  const S = SALA;
  const larg = S.e1 - S.e0;
  const prof = S.n1 - S.n0;
  const ec = (S.e0 + S.e1) / 2;
  const nc = (S.n0 + S.n1) / 2;
  A.scatola(b, ec, nc, -sp, larg + 2 * sp, sp, prof + 2 * sp, PAVIMENTO);
  A.scatola(b, ec, nc, S.alt, larg + 2 * sp, sp, prof + 2 * sp, VOLTA);
  // volta: costoloni
  for (let k = 0; k < 5; k++) {
    const n = S.n0 + 1 + k * ((prof - 2) / 4);
    A.scatola(b, ec, n, S.alt - 0.35, larg, 0.35, 0.35, PIETRA);
  }
  // pareti (la sud ha il varco del corridoio)
  A.scatola(b, S.e0 - sp / 2, nc, 0, sp, S.alt, prof + 2 * sp, PIETRA);
  A.scatola(b, S.e1 + sp / 2, nc, 0, sp, S.alt, prof + 2 * sp, PIETRA);
  A.scatola(b, ec, S.n1 + sp / 2, 0, larg, S.alt, sp, PIETRA);
  const varco = { e0: CORRIDOIO.e0, e1: CORRIDOIO.e1 };
  A.scatola(b, (S.e0 + varco.e0) / 2, S.n0 - sp / 2, 0, varco.e0 - S.e0, S.alt, sp, PIETRA);
  A.scatola(b, (varco.e1 + S.e1) / 2, S.n0 - sp / 2, 0, S.e1 - varco.e1, S.alt, sp, PIETRA);
  A.scatola(b, (varco.e0 + varco.e1) / 2, S.n0 - sp / 2, CORRIDOIO.alt, varco.e1 - varco.e0, S.alt - CORRIDOIO.alt, sp, PIETRA);
  col.push(A.collisoreScatola(S.e0 - sp / 2, nc, -0.5, sp, S.alt + 1, prof + 2 * sp, 'cripta'));
  col.push(A.collisoreScatola(S.e1 + sp / 2, nc, -0.5, sp, S.alt + 1, prof + 2 * sp, 'cripta'));
  col.push(A.collisoreScatola(ec, S.n1 + sp / 2, -0.5, larg, S.alt + 1, sp, 'cripta'));
  col.push(A.collisoreScatola((S.e0 + varco.e0) / 2, S.n0 - sp / 2, -0.5, varco.e0 - S.e0, S.alt + 1, sp, 'cripta'));
  col.push(A.collisoreScatola((varco.e1 + S.e1) / 2, S.n0 - sp / 2, -0.5, S.e1 - varco.e1, S.alt + 1, sp, 'cripta'));
  // tubi con la condensa lungo le pareti
  for (const n of [-7.5, -3.5, 0.5]) {
    A.scatola(b, S.e0 + 0.15, n, 0, 0.18, S.alt, 0.18, METALLO);
    A.scatola(b, S.e1 - 0.15, n, 0, 0.18, S.alt, 0.18, METALLO);
  }
  A.scatola(b, ec, S.n1 - 0.15, S.alt - 0.7, larg, 0.16, 0.16, METALLO);

  // --- capsule ---
  const punti: Record<string, Vector3> = {};
  const lumi: Vector3[] = [];
  let coperchio5: Mesh | null = null;
  const vetri: Mesh[] = [];
  const chiarori: BufferGeometry[] = [];
  for (let i = 1; i <= 7; i++) {
    const c = centroCapsula(i);
    const a = angoloCapsula(i);
    const ruota = 90 - a; // il lato lungo lungo il raggio
    A.scatola(b, c.e, c.n, 0, 1.05, 0.62, 2.25, METALLO, 0, ruota);
    A.scatola(b, c.e, c.n, 0.62, 1.12, 0.06, 2.32, [0.38, 0.4, 0.38], 0, ruota);
    // display ambrato sul fianco interno
    const dentro = centroCapsula(i, RAGGIO_ANELLO - 1.18);
    A.scatola(b, dentro.e, dentro.n, 0.3, 0.32, 0.18, 0.06, [0.95, 0.66, 0.25], 1, ruota);
    col.push(A.collisoreScatola(c.e, c.n, 0, 1.05, 0.95, 2.25, 'capsula', ruota));
    const testa = centroCapsula(i, RAGGIO_ANELLO - 0.9);
    punti[`capsula_${i}`] = A.punto(c.e, c.n, 0.95);
    if (i === 5) {
      punti['serratura_5'] = A.punto(dentro.e, dentro.n, 0.75);
      punti['targhette'] = A.punto(dentro.e, dentro.n, 0.35);
    }
    // contenuti
    if (i === 2) A.cilindro(b, c.e, c.n, 0.68, 0.18, 0.42, RAME, 0, 12); // l'urna di rame (sotto il vetro)
    if (i === 3) {
      A.aggiungi(b, PRIMS.blob(1), testa.e, testa.n, 1.02, Ancora.scala(0.42, 0.08, 0.42), [0.55, 0.42, 0.26]); // corona secca
      A.scatola(b, dentro.e, dentro.n, 0.55, 0.36, 0.14, 0.05, [0.82, 0.68, 0.32], 0.2, ruota); // targa d'ottone
    }
    if (i === 6 || i === 7) {
      // i dormienti sotto il vetro gelato, la busta sul vetro
      A.aggiungi(b, PRIMS.blob(1), c.e, c.n, 0.72, Ancora.scala(0.32, 0.14, 0.85), [0.3, 0.32, 0.4]);
      const busta = A.punto(c.e, c.n, 1.0);
      punti[`busta_${i}`] = busta;
      A.scatola(b, c.e, c.n, 0.98, 0.32, 0.015, 0.22, [0.86, 0.8, 0.66], 0, ruota + 12);
      // cavi tagliati
      A.scatola(b, dentro.e + 0.4, dentro.n, 0.2, 0.05, 0.05, 0.5, [0.15, 0.15, 0.15], 0, ruota + 40);
    }
    // coperchio di vetro (mesh a parte: la 5 si apre, la 1 è già aperta)
    const tex = texturaVetro(i === 5, i === 6 || i === 7);
    const mat = new MeshBasicMaterial({ map: tex ?? undefined, color: tex ? 0xe4eef8 : 0xc8d8e6, transparent: true, opacity: i === 5 ? 0.95 : 0.85, side: DoubleSide, depthWrite: false });
    // la luce fredda della capsula: un chiarore azzurrino sotto il vetro (additivo, non illuminato;
    // tutti in una mesh sola). Nella 5 c'è Elvira (gli occhi stanno sotto): lì niente chiarore
    if (i !== 5) chiarori.push(new PlaneGeometry(0.9, 2.0).applyMatrix4(A.matriceScatola(c.e, c.n, 0.71, 1, 1, 1, ruota).multiply(new Matrix4().makeRotationX(-Math.PI / 2))).toNonIndexed());
    const vetro = new Mesh(new PlaneGeometry(1.0, 2.15), mat);
    vetro.name = `vetro-${i}`;
    // perno sul bordo esterno (lontano da Q): il vetro ruota attorno a quello
    const perno = centroCapsula(i, RAGGIO_ANELLO + 1.08);
    const cardine = new Group();
    cardine.matrixAutoUpdate = false;
    cardine.matrix.copy(A.matrice).multiply(new Matrix4().makeTranslation(perno.e, 0.97, -perno.n));
    cardine.matrix.multiply(new Matrix4().makeRotationY((-ruota * Math.PI) / 180));
    const braccio = new Group();
    braccio.name = `cardine-${i}`;
    vetro.rotation.x = -Math.PI / 2;
    vetro.position.set(0, 0, 1.08); // dal perno verso Q (−Z locale ruotato = verso l'esterno)
    braccio.add(vetro);
    cardine.add(braccio);
    gruppo.add(cardine);
    vetri.push(vetro);
    if (i === 1) braccio.rotation.x = -1.1;
    if (i === 5) coperchio5 = vetro;
  }
  {
    // i chiarori delle capsule in una mesh sola (una draw call)
    const n = chiarori.reduce((t, g) => t + g.getAttribute('position').count, 0);
    const pos = new Float32Array(n * 3);
    let k = 0;
    for (const g of chiarori) {
      pos.set(g.getAttribute('position').array as Float32Array, k);
      k += g.getAttribute('position').count * 3;
      g.dispose();
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const chiarore = new Mesh(geo, new MeshBasicMaterial({ color: 0x5f86ad, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    chiarore.name = 'chiarori-capsule';
    gruppo.add(chiarore);
  }
  // il vetro della 5: dove sta la scritta e dove sono gli occhi di Elvira sdraiata
  const c5 = centroCapsula(5);
  const scritta = A.punto(c5.e, c5.n + 0.25, 0.97);
  const occhiSdraiata = A.punto(c5.e, c5.n + 0.45, 0.62);
  punti['scritta_vetro'] = scritta.clone();

  // --- armadietto n. 5 (fra la 4 e la 5, contro il muro) ---
  const arm = centroCapsula(4.5, RAGGIO_ANELLO + 0.9);
  const ruotaArm = 90 - angoloCapsula(4.5);
  A.scatola(b, arm.e, arm.n, 0, 0.75, 1.95, 0.5, [0.46, 0.5, 0.46], 0, ruotaArm);
  col.push(A.collisoreScatola(arm.e, arm.n, 0, 0.75, 1.95, 0.5, 'armadietto', ruotaArm));
  const gAnta = new GeomBuilder();
  const fronte = centroCapsula(4.5, RAGGIO_ANELLO + 0.62);
  A.scatola(gAnta, fronte.e, fronte.n, 0.05, 0.7, 1.85, 0.04, [0.52, 0.57, 0.52], 0, ruotaArm);
  A.scatola(gAnta, fronte.e, fronte.n - 0.03, 1.45, 0.16, 0.22, 0.05, [0.9, 0.86, 0.72], 0, ruotaArm); // il 5 in vernice
  const anta = new Mesh(gAnta.build(), materiale);
  anta.name = 'anta-armadietto-5';
  gruppo.add(anta);
  // dentro: la borsa di cuoio, il Velo ripiegato, lo squadro d'ottone (si vedono ad anta aperta)
  const interno = centroCapsula(4.5, RAGGIO_ANELLO + 0.8);
  A.scatola(b, interno.e, interno.n, 0.9, 0.4, 0.3, 0.25, [0.45, 0.3, 0.18]);
  A.scatola(b, interno.e, interno.n, 1.25, 0.18, 0.4, 0.1, [0.8, 0.62, 0.28]);
  A.scatola(b, interno.e, interno.n, 0.4, 0.5, 0.25, 0.3, [0.32, 0.36, 0.42]);
  punti['armadietto_5'] = A.punto(centroCapsula(4.5, RAGGIO_ANELLO + 0.55).e, centroCapsula(4.5, RAGGIO_ANELLO + 0.55).n, 1.2);

  // la busta «Per la mamma» sul bordo della capsula 5, dalla parte di Q
  const bustaPos = centroCapsula(5, RAGGIO_ANELLO - 0.95);
  const gBusta = new GeomBuilder();
  A.scatola(gBusta, bustaPos.e + 0.2, bustaPos.n, 0.68, 0.3, 0.02, 0.2, [0.9, 0.85, 0.72], 0, 8);
  const busta = new Mesh(gBusta.build(), materiale);
  busta.name = 'busta-5';
  gruppo.add(busta);
  punti['busta_5'] = A.punto(bustaPos.e + 0.2, bustaPos.n, 0.7);

  // --- corridoio di servizio ---
  const C = CORRIDOIO;
  const cl = C.e1 - C.e0;
  const cn = (S.n0 + C.n0) / 2;
  const cp = S.n0 - C.n0;
  A.scatola(b, (C.e0 + C.e1) / 2, cn, -sp, cl + 2 * sp, sp, cp + sp, PAVIMENTO);
  A.scatola(b, C.e0 - sp / 2, cn, 0, sp, C.alt, cp, [0.5, 0.48, 0.46]);
  A.scatola(b, C.e1 + sp / 2, cn, 0, sp, C.alt, cp, [0.5, 0.48, 0.46]);
  col.push(A.collisoreScatola(C.e0 - sp / 2, cn, -0.5, sp, C.alt + 1, cp, 'cripta'));
  col.push(A.collisoreScatola(C.e1 + sp / 2, cn, -0.5, sp, C.alt + 1, cp, 'cripta'));
  // soffitto del corridoio, tranne il pozzo
  const pozzo = { e0: SCALA.e - 0.8, e1: SCALA.e + 0.8, n0: C.n0, n1: SCALA.n + 0.9 };
  A.scatola(b, (C.e0 + C.e1) / 2, (S.n0 + pozzo.n1) / 2, C.alt, cl + 2 * sp, sp, S.n0 - pozzo.n1, [0.46, 0.44, 0.42]);
  // segmenti di ferro (anelli) lungo il corridoio
  for (let n = S.n0 - 1; n > C.n0 + 1.2; n -= 1.6) A.scatola(b, (C.e0 + C.e1) / 2, n, C.alt - 0.12, cl, 0.12, 0.12, METALLO);
  // fondo del corridoio e pozzo
  A.scatola(b, (C.e0 + C.e1) / 2, C.n0 - sp / 2, 0, cl + 2 * sp, SCALA.cima + 3.2, sp, [0.48, 0.46, 0.44]);
  col.push(A.collisoreScatola((C.e0 + C.e1) / 2, C.n0 - sp / 2, -0.5, cl + 2 * sp, 3, sp, 'cripta'));
  const hPozzo = SCALA.cima + 3.2 - C.alt;
  A.scatola(b, pozzo.e0 - sp / 2, (pozzo.n0 + pozzo.n1) / 2, C.alt, sp, hPozzo, pozzo.n1 - pozzo.n0, [0.4, 0.38, 0.37]);
  A.scatola(b, pozzo.e1 + sp / 2, (pozzo.n0 + pozzo.n1) / 2, C.alt, sp, hPozzo, pozzo.n1 - pozzo.n0, [0.4, 0.38, 0.37]);
  A.scatola(b, SCALA.e, pozzo.n1 + sp / 2, C.alt, pozzo.e1 - pozzo.e0 + 2 * sp, hPozzo, sp, [0.4, 0.38, 0.37]);
  // la scala alla marinara
  for (const de of [-0.32, 0.32]) A.scatola(b, SCALA.e + de, C.n0 + 0.18, 0, 0.06, SCALA.cima + 2.4, 0.06, [0.36, 0.36, 0.34]);
  for (let y = 0.3; y < SCALA.cima + 2.2; y += 0.32) A.scatola(b, SCALA.e, C.n0 + 0.18, y, 0.64, 0.04, 0.04, [0.4, 0.4, 0.38]);
  // la botola in cima al pozzo, con il filo di luce attorno
  const yBotola = SCALA.cima + 3.2;
  const gBotola = new GeomBuilder();
  A.scatola(gBotola, SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola - 0.12, pozzo.e1 - pozzo.e0 - 0.08, 0.1, pozzo.n1 - pozzo.n0 - 0.08, [0.3, 0.26, 0.22]);
  const botola = new Mesh(gBotola.build(), materiale);
  botola.name = 'botola-interna';
  gruppo.add(botola);
  A.scatola(b, SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola - 0.02, pozzo.e1 - pozzo.e0 + 0.1, 0.03, pozzo.n1 - pozzo.n0 + 0.1, [0.85, 0.86, 0.88], 1);
  A.scatola(b, SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola + 0.01, pozzo.e1 - pozzo.e0 + 2 * sp, 0.3, pozzo.n1 - pozzo.n0 + 2 * sp, [0.2, 0.18, 0.17]);
  punti['scala'] = A.punto(SCALA.e, C.n0 + 0.4, 1.4);
  punti['botola_interna'] = A.punto(SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola - 0.2);
  // scritte del corridoio (sulle pareti)
  A.scatola(b, C.e1 + 0.01, -10.6, 0.9, 0.02, 0.9, 1.6, [0.86, 0.84, 0.78]); // gesso
  A.scatola(b, C.e0 - 0.01, -10.2, 1.0, 0.02, 1.1, 1.3, [0.72, 0.36, 0.2]); // orari dipinti
  punti['gesso_corridoio'] = A.punto(C.e1, -10.6, 1.35);
  punti['orari_cripta'] = A.punto(C.e0, -10.2, 1.55);

  // lumi color miele
  // (i lumi del motore illuminano forte e da vicino: due bastano per la sala e il corridoio)
  for (const [e, n, y, luce] of [
    [0.2, -2.0, 3.0, true],
    [9.0, -2.0, 3.0, false],
    [4.5, -6.5, 3.5, true],
    [4.5, -12.0, 2.2, true],
  ] as const) {
    A.scatola(b, e, n, y, 0.18, 0.22, 0.18, [1, 0.8, 0.45], 1);
    if (luce) lumi.push(A.punto(e, n, y));
  }

  const geoMuri = b.build();
  illuminaCripta(geoMuri, A);
  const mesh = new Mesh(geoMuri, materiale);
  mesh.name = 'cripta-muri';
  mesh.frustumCulled = false;
  gruppo.add(mesh);

  // animazioni
  let aperturaCoperchio = 0;
  let apri = false;
  let aperturaArm = 0;
  let apriArm = false;
  return {
    gruppo,
    collisori: col,
    lumi,
    ancora: A,
    punti,
    occhiSdraiata,
    scritta,
    inPiedi: { ...(() => { const p = A.cyl(Q.e, Q.n + 2.0); return { z: p.z, theta: p.theta }; })(), yaw: 0 },
    apriCoperchio: () => (apri = true),
    apriArmadietto: () => (apriArm = true),
    togliBusta: () => (busta.visible = false),
    apriBotola: () => (botola.visible = false),
    coperchioAperto: () => aperturaCoperchio > 0.95,
    update(dt: number) {
      if (apri && aperturaCoperchio < 1) {
        aperturaCoperchio = Math.min(1, aperturaCoperchio + dt / 2.2);
        const k = 0.5 - 0.5 * Math.cos(aperturaCoperchio * Math.PI);
        if (coperchio5?.parent) coperchio5.parent.rotation.x = -1.25 * k;
      }
      if (apriArm && aperturaArm < 1) {
        // segnaposto: l'anta sparisce a metà del gesto (niente cardine vero)
        aperturaArm = Math.min(1, aperturaArm + dt / 0.8);
        anta.visible = aperturaArm < 0.5;
      }
    },
  };
}

/**
 * Luce dipinta della Cripta (traccia «paese»): il materiale del mondo illumina tutto col cielo, ma
 * qui sotto il cielo non arriva. Si cuoce nella geometria:
 * - la superficie dipinta per colore (pareti e costoloni di pietra, volta a intonaco con le macchie
 *   d'umido, pavimento di lastre, tubi e capsule di ferro, display e lumi di vetro);
 * - un'occlusione media (il riempimento del cielo cala; non di più, perché scurisce anche le pozze
 *   dei lumi), che cala ancora attorno alle capsule: lì il riempimento rimasto si legge come la
 *   loro luce fredda, e i vertici vicini virano all'azzurro;
 * - più buio e più umido in basso (il piede delle pareti).
 * I lumi color miele restano i lumi del motore (pozze calde).
 */
function illuminaCripta(geo: BufferGeometry, A: Ancora): void {
  const pos = geo.getAttribute('position');
  const col = geo.getAttribute('aColor');
  if (!pos || !col) return;
  const inv = A.matrice.clone().invert();
  const v = new Vector3();
  const n = pos.count;
  const sup = new Float32Array(n * 2);
  const capsule = [1, 2, 3, 4, 5, 6, 7].map((i) => centroCapsula(i));
  const vicino = (c: readonly number[], t: readonly number[]) => Math.abs(c[0]! - t[0]!) + Math.abs(c[1]! - t[1]!) + Math.abs(c[2]! - t[2]!) < 0.02;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(inv);
    const e = v.x;
    const y = v.y;
    const nn = -v.z;
    const c = [col.getX(i), col.getY(i), col.getZ(i)];
    const emette = col.getW(i) > 0.02;
    let tipo = 0;
    if (emette) tipo = SUPERFICIE.VETRO;
    else if (vicino(c, PIETRA)) tipo = SUPERFICIE.PIETRA + 0.3;
    else if (vicino(c, VOLTA)) tipo = SUPERFICIE.INTONACO + 0.6;
    else if (vicino(c, PAVIMENTO)) tipo = SUPERFICIE.PIETRA + 0.75;
    else if (vicino(c, METALLO)) tipo = SUPERFICIE.METALLO;
    else if (vicino(c, RAME)) tipo = SUPERFICIE.OTTONE;
    else if (c[0]! < 0.55 && Math.abs(c[0]! - c[2]!) < 0.08) tipo = SUPERFICIE.PIETRA + 0.5;
    // luce fredda delle capsule (a metà altezza)
    let glow = 0;
    for (const k of capsule) {
      const d2 = Math.pow(e - k.e, 2) + Math.pow(nn - k.n, 2) + Math.pow(y - 0.8, 2);
      glow += Math.exp(-d2 / (2.2 * 2.2));
    }
    glow = Math.min(1, glow);
    const piede = Math.max(0, 1 - y / 0.9);
    const occ = emette ? 0 : Math.min(0.6, Math.max(0.1, 0.44 - glow * 0.3 + piede * 0.12));
    sup[i * 2] = tipo;
    sup[i * 2 + 1] = occ;
    if (!emette) {
      // azzurro vicino alle capsule, bruno umido al piede delle pareti
      const k = glow * 0.35;
      let r = c[0]! * (1 - k * 0.25);
      let g = c[1]! * (1 - k * 0.05);
      let bb = c[2]! * (1 + k * 0.25);
      if (piede > 0) {
        const u = piede * 0.25;
        r *= 1 - u;
        g *= 1 - u * 0.9;
        bb *= 1 - u * 1.1;
      }
      col.setXYZ(i, r, g, bb);
    }
  }
  col.needsUpdate = true;
  geo.setAttribute('aSuperficie', new BufferAttribute(sup, 2));
}
