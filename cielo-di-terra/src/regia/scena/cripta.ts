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
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  TorusGeometry,
  Vector3,
  Vector4,
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

// Colori della Cripta (rifinitura 1): conci di gneiss caldo, malta scura, volta a calce con le
// macchie d'umido, lastre grandi del pavimento, capsule di rame-ottone con i chiodi, lumi miele
const PIETRA: RGB = [0.62, 0.6, 0.57];
const VOLTA: RGB = [0.74, 0.7, 0.63];
const PAVIMENTO: RGB = [0.42, 0.4, 0.38];
const MALTA: RGB = [0.34, 0.315, 0.29];
const CONCIO: RGB = [0.55, 0.52, 0.47];
const LASTRA: RGB = [0.47, 0.44, 0.4];
const METALLO: RGB = [0.5, 0.55, 0.5];
const RAME: RGB = [0.72, 0.42, 0.24];
/**
 * corpo delle capsule: rame #a0582c (rifinitura 2: prima un rame-ottone #8a6a3a che sotto la luce
 * della Cripta sembrava legno marrone), con le fasce d'ottone #b08a3a
 */
const CAPSULA: RGB = [0.627, 0.345, 0.173];
const CAPSULA_SCURA: RGB = [0.36, 0.19, 0.1];
const FASCIA_OTTONE: RGB = [0.69, 0.541, 0.227];
/** il tubo di rame lungo la volta */
const TUBO_VOLTA: RGB = [0.66, 0.36, 0.18];
/** verderame sullo zoccolo delle capsule (il rame si legge come rame, non come legno) */
const PATINA: RGB = [0.26, 0.36, 0.31];
const CORNICE: RGB = [0.66, 0.52, 0.27];
const CHIODO: RGB = [0.42, 0.33, 0.19];
const TUBO: RGB = [0.46, 0.3, 0.19];
const FERRO: RGB = [0.2, 0.19, 0.18];
/** vetro dei lumi: #ffb060 */
const LUME: RGB = [1, 0.69, 0.38];
/** vetro scuro dentro la capsula (sotto il coperchio appannato) */
const FONDO_CAPSULA: RGB = [0.11, 0.12, 0.14];

/** Superficie «nessun motivo» dichiarata (`taggaSuperficie` scrive 0,5): campitura con la pennellata. */
const NESSUNA = 0.5;


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
  // rifinitura 2: il vetro è quasi trasparente (alfa ~0,3; prima un piano bianco opaco), più appannato
  // dove c'è la scritta e gelato sulle capsule dei dormienti
  const grad = g.createRadialGradient(256, 128, 30, 256, 128, 300);
  grad.addColorStop(0, gelato ? 'rgba(232,240,248,0.66)' : conScritta ? 'rgba(214,224,230,0.32)' : 'rgba(214,224,230,0.04)');
  grad.addColorStop(1, gelato ? 'rgba(220,232,244,0.84)' : conScritta ? 'rgba(200,212,220,0.5)' : 'rgba(200,212,220,0.2)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 256);
  // gocce di condensa
  for (let i = 0; i < 260; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12345.678) % 1;
    g.fillStyle = `rgba(255,255,255,${(gelato || conScritta ? 0.08 : 0.04) + 0.14 * Math.abs(x)})`;
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
  // il bordo del vetro prende la luce del lume (rifinitura 2): un filo chiaro e caldo tutt'attorno, e
  // un riflesso di sbieco; il resto del vetro è quasi trasparente
  g.fillStyle = 'rgba(255,236,200,0.85)';
  g.fillRect(0, 0, 512, 5);
  g.fillRect(0, 251, 512, 5);
  g.fillRect(0, 0, 9, 256);
  g.fillRect(503, 0, 9, 256);
  const riflesso = g.createLinearGradient(120, 0, 230, 256);
  riflesso.addColorStop(0, 'rgba(255,240,215,0)');
  riflesso.addColorStop(0.5, 'rgba(255,240,215,0.14)');
  riflesso.addColorStop(1, 'rgba(255,240,215,0)');
  g.fillStyle = riflesso;
  g.beginPath();
  g.moveTo(150, 0);
  g.lineTo(200, 0);
  g.lineTo(330, 256);
  g.lineTo(280, 256);
  g.fill();
  const t = new CanvasTexture(c);
  // colori «da pittore» come il resto della catena (ColorManagement spento, uscita lineare): con
  // SRGBColorSpace la scheda linearizzava in lettura e brina e scritta uscivano più scure
  t.colorSpace = NoColorSpace;
  return t;
}

/** Hash 2D deterministico (0..1). */
function hc(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function tinta(c: RGB, k: number, caldo = 0): RGB {
  return [c[0] * k * (1 + caldo * 0.08), c[1] * k * (1 + caldo * 0.02), c[2] * k * (1 - caldo * 0.08)];
}

const _q = new Quaternion();
const _su = new Vector3(0, 1, 0);

/**
 * Costruttore della Cripta: il GeomBuilder del motore più le superfici per intervallo di vertici
 * (pietra a conci, volta a calce, pavimento a lastre, rame delle capsule: ognuno il suo motivo).
 */
class CantiereCripta {
  readonly b = new GeomBuilder();
  readonly tipi: Array<[number, number, number]> = [];
  constructor(readonly A: Ancora) {}
  /** Le forme aggiunte da `fn` prendono la superficie `tipo`. */
  con(tipo: number, fn: () => void): void {
    const s = this.b.vertexCount;
    fn();
    this.tipi.push([s, this.b.vertexCount, tipo]);
  }
  scatola(e: number, n: number, y: number, larg: number, alt: number, prof: number, colore: RGB, emissione = 0, ruota = 0): void {
    this.A.scatola(this.b, e, n, y, larg, alt, prof, colore, emissione, ruota);
  }
  /** Cilindro fra due punti locali (e, n, y), raggio r. */
  tubo(e0: number, n0: number, y0: number, e1: number, n1: number, y1: number, r: number, colore: RGB, seg = 8): void {
    const p0 = new Vector3(e0, y0, -n0);
    const d = new Vector3(e1, y1, -n1).sub(p0);
    const l = d.length();
    _q.setFromUnitVectors(_su, d.normalize());
    const m = this.A.matrice.clone().multiply(new Matrix4().compose(p0, _q, new Vector3(r, l, r)));
    this.b.add(PRIMS.cylinder(seg), m, colore);
  }
  /** Scatola con una rotazione qualsiasi (locale: x = e, y, z = −n). */
  blocco(e: number, n: number, y: number, rot: Euler, sx: number, sy: number, sz: number, colore: RGB): void {
    const m = this.A.matrice.clone().multiply(new Matrix4().compose(new Vector3(e, y, -n), _q.setFromEuler(rot), new Vector3(sx, sy, sz)));
    this.b.add(PRIMS.box(), m, colore);
  }
}

/**
 * Piastrella unitaria (x, y in [−0,5, 0,5], normale +z) divisa in 3 × 3 riquadri: il bordo (10%)
 * prende il colore della malta e il centro quello della pietra, così il giunto è una sfumatura
 * dipinta e non un gradino (i contorni della post-produzione disegnavano ogni concio di nero).
 */
const TESSERA = (() => {
  const xs = [-0.5, -0.4, 0.4, 0.5];
  const pos: number[] = [];
  const nor: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const [a, b2, c, d] = [xs[i]!, xs[i + 1]!, xs[j]!, xs[j + 1]!];
      pos.push(a, c, 0, b2, c, 0, b2, d, 0, a, c, 0, b2, d, 0, a, d, 0);
      for (let k = 0; k < 6; k++) nor.push(0, 0, 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  return g;
})();

/**
 * Parete a conci squadrati (0,5 × 0,25 m circa, a corsi sfalsati), dipinti su tessere a filo appena
 * davanti alla parete: `lungo` 'n' = parete parallela a n (a e = `fisso`), 'e' = parallela a e (a
 * n = `fisso`); `dentro` = verso (+1/−1) della faccia che guarda la stanza. `salta(u, y)` lascia i vani.
 */
function pareteConci(C: CantiereCripta, lungo: 'e' | 'n', fisso: number, dentro: 1 | -1, da: number, a: number, y0: number, y1: number, seme: number, salta: (u: number, y: number) => boolean = () => false): void {
  // la tessera guarda +z locale; la ruoto perché guardi dentro la stanza
  const rot = new Matrix4();
  if (lungo === 'n') rot.makeRotationY(dentro > 0 ? Math.PI / 2 : -Math.PI / 2);
  else rot.makeRotationY(dentro > 0 ? Math.PI : 0);
  const m = new Matrix4();
  const sc = new Matrix4();
  let y = y0;
  let corso = 0;
  while (y < y1 - 0.05) {
    const hcorso = Math.min(y1 - y, 0.23 + hc(seme, corso) * 0.08);
    let u = da - (corso % 2 ? 0.22 : 0) - hc(corso, seme) * 0.15;
    let k = 0;
    while (u < a) {
      const L = 0.4 + hc(seme + corso * 7.1, k) * 0.3;
      const u0 = Math.max(u, da);
      const u1 = Math.min(u + L, a);
      const um = (u0 + u1) / 2;
      if (u1 - u0 > 0.12 && !salta(um, y + hcorso / 2)) {
        const r = hc(um * 3.1 + seme, y * 5.3);
        const k2 = 0.8 + r * 0.32 - (hc(um, y + seme) < 0.12 ? 0.18 : 0);
        const col = tinta(CONCIO, k2, hc(y * 2.3, um * 1.7 + seme) - 0.5);
        const off = fisso + dentro * 0.006;
        const [e, n] = lungo === 'n' ? [off, um] : [um, off];
        m.copy(C.A.matrice).multiply(sc.makeTranslation(e, y + hcorso / 2, -n)).multiply(rot).multiply(sc.makeScale(u1 - u0, hcorso, 1));
        C.b.add(TESSERA, m, col, 0, (p, out) => {
          // bordo della tessera: la malta (calda e scura), il centro: la pietra
          if (Math.abs(p.x) > 0.45 || Math.abs(p.y) > 0.45) {
            out[0] = MALTA[0];
            out[1] = MALTA[1];
            out[2] = MALTA[2];
          }
        });
      }
      u += L;
      k++;
    }
    y += hcorso;
    corso++;
  }
}

/**
 * Piastrella del pavimento (x, z in [−0,5, 0,5], normale +y) in 3 × 3 riquadri: il riquadro centrale
 * è la lastra (`giunto` falso), gli otto del bordo (6%) il giunto, dipinto, a filo della lastra (più
 * stretto il filtro pittorico lo cancellava). Due geometrie, perché i vertici del bordo della lastra
 * stanno anche sul giunto: col colore per vertice la lastra intera prendeva il colore del giunto.
 */
function tesseraPavimento(giunto: boolean): BufferGeometry {
  const xs = [-0.5, -0.44, 0.44, 0.5];
  const pos: number[] = [];
  const nor: number[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if ((i === 1 && j === 1) === giunto) continue;
      const [a, b2, c, d] = [xs[i]!, xs[i + 1]!, xs[j]!, xs[j + 1]!];
      pos.push(a, 0, c, a, 0, d, b2, 0, d, a, 0, c, b2, 0, d, b2, 0, c);
      for (let k = 0; k < 6; k++) nor.push(0, 1, 0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  return g;
}
const TESSERA_LASTRA = tesseraPavimento(false);
const TESSERA_GIUNTO = tesseraPavimento(true);

/**
 * Pavimento a lastre grandi (0,8-1,2 m) sfalsate. Rifinitura 2: prima le lastre erano scatole staccate
 * di 3,5 cm sopra la malta scura, e il contorno della post disegnava ogni giunto come una riga nera
 * spessa; ora sono piastrelle a filo con il giunto dipinto a ×0,75 del colore della lastra (più
 * scuro, non nero), e le lastre variano di ±10%.
 */
function pavimentoLastre(C: CantiereCripta, e0: number, e1: number, n0: number, n1: number, seme: number): void {
  const m = new Matrix4();
  const t = new Matrix4();
  let n = n0;
  let fila = 0;
  while (n < n1 - 0.05) {
    const p = Math.min(n1 - n, 0.85 + hc(seme, fila) * 0.35);
    let e = e0 - hc(fila, seme) * 0.5;
    let k = 0;
    while (e < e1) {
      const w = 0.8 + hc(seme + fila * 3.3, k) * 0.4;
      const a = Math.max(e, e0);
      const b = Math.min(e + w, e1);
      if (b - a > 0.15) {
        const r = hc(a * 1.7 + seme, n * 2.9);
        const col = tinta(LASTRA, 0.9 + r * 0.2, hc(n, a) - 0.5);
        m.copy(C.A.matrice).multiply(t.makeTranslation((a + b) / 2, 0.004, -(n + p / 2))).multiply(t.makeScale(b - a, 1, p));
        C.b.add(TESSERA_LASTRA, m, col, 0);
        C.b.add(TESSERA_GIUNTO, m, tinta(col, 0.75), 0);
      }
      e += w;
      k++;
    }
    n += p;
    fila++;
  }
}

/**
 * Volta a botte ribassata lungo n, sopra la sala: arco ellittico da e0 a e1 (imposta a `y0`,
 * freccia `freccia`), da n0 a n1; normali verso dentro; macchie d'umido dipinte nel colore.
 */
function voltaABotte(C: CantiereCripta, e0: number, e1: number, n0: number, n1: number, y0: number, freccia: number): (e: number) => number {
  const ec = (e0 + e1) / 2;
  const ra = (e1 - e0) / 2;
  const segA = 16;
  const segN = 12;
  const quota = (e: number) => y0 + freccia * Math.sqrt(Math.max(0, 1 - ((e - ec) / ra) ** 2));
  const pt = (i: number, j: number): [Vector3, Vector3] => {
    const t = Math.PI - (i / segA) * Math.PI;
    const e = ec + Math.cos(t) * ra;
    const y = y0 + Math.sin(t) * freccia;
    const n = n0 + ((n1 - n0) * j) / segN;
    // normale dell'ellisse, verso dentro (verso il basso e verso l'asse)
    const nrm = new Vector3(-Math.cos(t) / ra, -Math.sin(t) / freccia, 0).normalize();
    return [new Vector3(e, y, -n), nrm];
  };
  const pos: number[] = [];
  const nor: number[] = [];
  const quad = (i: number, j: number) => {
    const a = pt(i, j);
    const b = pt(i + 1, j);
    const c = pt(i + 1, j + 1);
    const d = pt(i, j + 1);
    for (const [p, nn] of [a, c, b, a, d, c]) {
      pos.push(p.x, p.y, p.z);
      nor.push(nn.x, nn.y, nn.z);
    }
  };
  for (let i = 0; i < segA; i++) for (let j = 0; j < segN; j++) quad(i, j);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  // il verso dei triangoli: devono guardare come le normali
  const P = g.getAttribute('position');
  const v0 = new Vector3().fromBufferAttribute(P, 0);
  const v1 = new Vector3().fromBufferAttribute(P, 1);
  const v2 = new Vector3().fromBufferAttribute(P, 2);
  const fn = v1.sub(v0).cross(v2.sub(v0));
  if (fn.dot(new Vector3().fromBufferAttribute(g.getAttribute('normal'), 0)) < 0) {
    const arr = P.array as Float32Array;
    for (let k = 0; k < arr.length; k += 9) for (let q = 0; q < 3; q++) [arr[k + 3 + q], arr[k + 6 + q]] = [arr[k + 6 + q]!, arr[k + 3 + q]!];
  }
  // calce con le macchie d'umido (più scure e verdastre, colano dall'imposta) e gli aloni
  C.con(SUPERFICIE.INTONACO + 0.6, () =>
    C.b.add(g, C.A.matrice, VOLTA, 0, (p, out) => {
      const n = -p.z;
      const macchia = Math.max(0, hc(Math.floor(p.x / 1.7), Math.floor(n / 1.9)) - 0.55) * 2.2;
      const basso = Math.max(0, 1 - (p.y - y0) / (freccia * 0.6));
      const k = 1 - macchia * 0.22 - basso * 0.12;
      out[0] = VOLTA[0] * k * (1 - macchia * 0.05);
      out[1] = VOLTA[1] * k;
      out[2] = VOLTA[2] * k * (1 - macchia * 0.08);
    }),
  );
  // lunette di calce sopra le pareti di testa (fra l'imposta e la volta)
  for (const [n, verso] of [
    [n1, 1],
    [n0, -1],
  ] as const) {
    const lp: number[] = [];
    const ln: number[] = [];
    for (let i = 0; i < segA; i++) {
      const ea = e0 + ((e1 - e0) * i) / segA;
      const eb = e0 + ((e1 - e0) * (i + 1)) / segA;
      const tri = [
        [ec, y0],
        [ea, quota(ea)],
        [eb, quota(eb)],
      ];
      const ord = verso > 0 ? [0, 2, 1] : [0, 1, 2];
      for (const o of ord) {
        lp.push(tri[o]![0]!, tri[o]![1]!, -n);
        ln.push(0, 0, verso);
      }
    }
    const gl = new BufferGeometry();
    gl.setAttribute('position', new BufferAttribute(new Float32Array(lp), 3));
    gl.setAttribute('normal', new BufferAttribute(new Float32Array(ln), 3));
    C.con(SUPERFICIE.INTONACO + 0.3, () => C.b.add(gl, C.A.matrice, tinta(VOLTA, 0.92)));
  }
  return quota;
}

/** La riga dell'emissione notturna nello shader degli oggetti del mondo (`render/worldMaterial.ts`). */
const RIGA_EMISSIONE = 'col = mix(col, uLampColor * 1.15, vColor.a * uNight);';

/**
 * Materiale della Cripta (rifinitura 2). È lo stesso materiale degli oggetti del mondo, con le sue
 * superfici dipinte, ma con una luce sua: sotto terra non arrivano né il cielo né la notte del
 * motore. Prima, di notte (il prologo comincia prima dell'alba) il materiale del mondo spegneva i
 * colori verso il blu della luna (saturazione 0,37) e le pozze cotte dei lumi si accendevano solo
 * con `uNight`; di giorno restavano spente. Qui:
 * - niente notte (`uNight` 0): i colori restano veri, il rame è rame;
 * - la luce principale è quella dei lumi appesi alla volta: calda, dall'alto, senza le ombre del
 *   sole (la mappa d'ombra vedrebbe il terreno sopra la Cripta);
 * - il riempimento è caldo e basso (il rimbalzo dei lumi sulla calce e sul rame);
 * - l'emissione cotta (le pozze dei lumi e i loro vetri) è sempre accesa: `uEmissioneInterna`.
 * Gli altri uniform restano condivisi con il mondo (stesso oggetto: si aggiornano da soli). Se lo
 * shader del mondo cambia e la riga dell'emissione non c'è più, la Cripta resta senza emissione ma
 * con la sua luce.
 */
export function materialeCripta(base: Material): Material {
  const m = base as ShaderMaterial;
  if (!m.isShaderMaterial || !m.uniforms) return base;
  const U = m.uniforms;
  const propri: Record<string, { value: unknown }> = {
    uNight: { value: 0 },
    uSunColor: { value: new Vector3(1.0, 0.78, 0.55) },
    uSunIntensity: { value: 0.7 },
    // il nucleo della luce sopra la sala: la luce scende dall'alto (vedi `lineaLightDir`)
    uSole: { value: new Vector4(ANCORA_CRIPTA.z, 4, 0, 1) },
    uLineaIgnite: { value: 1e6 },
    uGolden: { value: 0 },
    uAmbTop: { value: new Vector3(0.38, 0.3, 0.24) },
    uAmbBottom: { value: new Vector3(0.24, 0.18, 0.13) },
    // ombre portate spente (x), occlusione, trasmissione, saturazione del colore pieno (w)
    uLuce: { value: new Vector4(0, 1, 1, 1.06) },
  };
  const uniforms: Record<string, { value: unknown }> = { ...U };
  for (const [k, v] of Object.entries(propri)) if (k in U) uniforms[k] = v;
  let frag = m.fragmentShader;
  if (frag.includes(RIGA_EMISSIONE)) {
    uniforms['uEmissioneInterna'] = { value: 1 };
    frag = frag.replace(RIGA_EMISSIONE, 'col = mix(col, uLampColor * 1.15, vColor.a * max(uNight, uEmissioneInterna));').replace('void main() {', 'uniform float uEmissioneInterna;\nvoid main() {');
  }
  const mat = new ShaderMaterial({ name: 'world-object-cripta', uniforms, vertexShader: m.vertexShader, fragmentShader: frag, defines: { ...m.defines }, side: m.side });
  (mat.defaultAttributeValues as Record<string, number[]>)['aSuperficie'] = [0, 0];
  return mat;
}

export function costruisciCripta(materialeMondo: Material): Cripta {
  const materiale = materialeCripta(materialeMondo);
  const A = new Ancora(ANCORA_CRIPTA.z, ANCORA_CRIPTA.theta, QUOTA_CRIPTA);
  const C = new CantiereCripta(A);
  const b = C.b;
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
  // il fondo di malta sotto le lastre, poi le lastre grandi
  C.con(NESSUNA, () => A.scatola(b, ec, nc, -sp - 0.012, larg + 2 * sp, sp, prof + 2 * sp, MALTA));
  C.con(NESSUNA, () => pavimentoLastre(C, S.e0, S.e1, S.n0, S.n1, 3));
  // pareti: la malta scura (i giunti) e davanti i conci squadrati a corsi (la sud ha il varco del corridoio)
  const varco = { e0: CORRIDOIO.e0, e1: CORRIDOIO.e1 };
  C.con(NESSUNA, () => {
    A.scatola(b, S.e0 - sp / 2, nc, 0, sp, S.alt, prof + 2 * sp, MALTA);
    A.scatola(b, S.e1 + sp / 2, nc, 0, sp, S.alt, prof + 2 * sp, MALTA);
    A.scatola(b, ec, S.n1 + sp / 2, 0, larg, S.alt, sp, MALTA);
    A.scatola(b, (S.e0 + varco.e0) / 2, S.n0 - sp / 2, 0, varco.e0 - S.e0, S.alt, sp, MALTA);
    A.scatola(b, (varco.e1 + S.e1) / 2, S.n0 - sp / 2, 0, S.e1 - varco.e1, S.alt, sp, MALTA);
    A.scatola(b, (varco.e0 + varco.e1) / 2, S.n0 - sp / 2, CORRIDOIO.alt, varco.e1 - varco.e0, S.alt - CORRIDOIO.alt, sp, MALTA);
  });
  C.con(NESSUNA, () => {
    pareteConci(C, 'n', S.e0, 1, S.n0, S.n1, 0, S.alt, 11);
    pareteConci(C, 'n', S.e1, -1, S.n0, S.n1, 0, S.alt, 23);
    pareteConci(C, 'e', S.n1, -1, S.e0, S.e1, 0, S.alt, 37);
    pareteConci(C, 'e', S.n0, 1, S.e0, S.e1, 0, S.alt, 41, (u, y) => u > varco.e0 - 0.1 && u < varco.e1 + 0.1 && y < CORRIDOIO.alt + 0.1);
    // l'arco del varco: un architrave di pietra più chiara
    C.scatola((varco.e0 + varco.e1) / 2, S.n0 + 0.05, CORRIDOIO.alt, varco.e1 - varco.e0 + 0.5, 0.3, 0.1, tinta(CONCIO, 1.12));
  });
  col.push(A.collisoreScatola(S.e0 - sp / 2, nc, -0.5, sp, S.alt + 1, prof + 2 * sp, 'cripta'));
  col.push(A.collisoreScatola(S.e1 + sp / 2, nc, -0.5, sp, S.alt + 1, prof + 2 * sp, 'cripta'));
  col.push(A.collisoreScatola(ec, S.n1 + sp / 2, -0.5, larg, S.alt + 1, sp, 'cripta'));
  col.push(A.collisoreScatola((S.e0 + varco.e0) / 2, S.n0 - sp / 2, -0.5, varco.e0 - S.e0, S.alt + 1, sp, 'cripta'));
  col.push(A.collisoreScatola((varco.e1 + S.e1) / 2, S.n0 - sp / 2, -0.5, S.e1 - varco.e1, S.alt + 1, sp, 'cripta'));
  // volta a botte a calce, ribassata, con tre sottarchi di conci
  const freccia = 1.5;
  const quotaVolta = voltaABotte(C, S.e0, S.e1, S.n0 - 0.02, S.n1 + 0.02, S.alt, freccia);
  C.con(NESSUNA, () => {
    for (const n of [-6.6, -3.6, -0.6]) {
      const seg = 14;
      for (let i = 0; i < seg; i++) {
        const t0 = Math.PI - (i / seg) * Math.PI;
        const t1 = Math.PI - ((i + 1) / seg) * Math.PI;
        const ra = larg / 2;
        const e0 = ec + Math.cos(t0) * ra;
        const e1 = ec + Math.cos(t1) * ra;
        const y0 = S.alt + Math.sin(t0) * freccia;
        const y1 = S.alt + Math.sin(t1) * freccia;
        const ang = Math.atan2(y1 - y0, e1 - e0);
        const l = Math.hypot(e1 - e0, y1 - y0);
        C.blocco((e0 + e1) / 2, n, (y0 + y1) / 2 - 0.09, new Euler(0, 0, ang), l - 0.03, 0.2, 0.42, tinta(CONCIO, 0.95 + hc(n, i) * 0.2));
      }
      // i piedritti del sottarco lungo le pareti
      for (const e of [S.e0 + 0.11, S.e1 - 0.11]) C.scatola(e, n, 0, 0.2, S.alt, 0.42, tinta(CONCIO, 0.9));
    }
  });
  // tubi lungo le pareti (rame scuro e ferro), con le staffe, e le discese verso il pavimento
  C.con(SUPERFICIE.METALLO, () => {
    for (const [e, y, r, c] of [
      [S.e0 + 0.2, 3.0, 0.07, TUBO],
      [S.e0 + 0.38, 3.22, 0.045, FERRO],
      [S.e1 - 0.2, 3.0, 0.07, TUBO],
      [S.e1 - 0.38, 3.22, 0.045, FERRO],
    ] as const) {
      C.tubo(e, S.n0 + 0.2, y, e, S.n1 - 0.2, y, r, c);
      for (let n = S.n0 + 0.8; n < S.n1 - 0.4; n += 1.6) C.scatola(e < ec ? S.e0 + 0.15 : S.e1 - 0.15, n, y - 0.1, 0.3, 0.05, 0.08, FERRO);
    }
    C.tubo(S.e0 + 0.2, S.n1 - 0.2, 3.0, S.e1 - 0.2, S.n1 - 0.2, 3.0, 0.07, TUBO);
    for (const n of [-7.5, -3.6, 0.4]) {
      C.tubo(S.e0 + 0.2, n, 3.0, S.e0 + 0.2, n, 0.0, 0.06, TUBO);
      C.tubo(S.e1 - 0.2, n, 3.0, S.e1 - 0.2, n, 0.0, 0.06, TUBO);
      // le valvole: un volantino scuro a metà altezza
      C.scatola(S.e0 + 0.32, n, 1.25, 0.04, 0.22, 0.22, FERRO);
      C.scatola(S.e1 - 0.32, n, 1.25, 0.04, 0.22, 0.22, FERRO);
    }
  });
  // rifinitura 2: un tubo di rame lungo la volta, accanto al colmo (al centro pende il lume), con le
  // staffe di ferro: prende il riflesso caldo dei lumi e porta l'occhio lungo la sala
  {
    const eT = ec + 0.62;
    const yT = quotaVolta(eT) - 0.2;
    C.con(SUPERFICIE.OTTONE + 0.55, () => {
      C.tubo(eT, S.n0 + 0.3, yT, eT, S.n1 - 0.3, yT, 0.065, TUBO_VOLTA, 12);
      // le teste: il tubo piega e scende lungo le pareti di testa
      C.tubo(eT, S.n0 + 0.3, yT, eT, S.n0 + 0.3, S.alt - 0.2, 0.065, TUBO_VOLTA, 12);
      C.tubo(eT, S.n1 - 0.3, yT, eT, S.n1 - 0.3, S.alt - 0.2, 0.065, TUBO_VOLTA, 12);
      // manicotti d'ottone ogni tanto
      for (let n = S.n0 + 1.1; n < S.n1 - 0.6; n += 2.2) C.tubo(eT, n - 0.05, yT, eT, n + 0.05, yT, 0.078, FASCIA_OTTONE, 12);
    });
    C.con(SUPERFICIE.METALLO, () => {
      for (let n = S.n0 + 0.6; n < S.n1 - 0.3; n += 1.5) C.scatola(eT, n, yT + 0.04, 0.04, quotaVolta(eT) - yT, 0.05, FERRO);
    });
  }

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
    const rr = (ruota * Math.PI) / 180;
    /** punto sulla capsula: `s` lungo il lato lungo, `w` di traverso */
    // (gli assi della scatola ruotata: lungo = (−sin, −cos), traverso = (cos, −sin) in (e, n))
    const su = (s: number, w: number) => ({ e: c.e - s * Math.sin(rr) + w * Math.cos(rr), n: c.n - s * Math.cos(rr) - w * Math.sin(rr) });
    C.con(SUPERFICIE.METALLO + 0.2, () => C.scatola(c.e, c.n, 0, 1.15, 0.1, 2.35, PATINA, 0, ruota));
    // rifinitura 2: il corpo di rame (#a0582c) con il riflesso caldo del lume (superficie OTTONE: riflesso
    // netto e patina negli incavi), non più il ferro brunito che lo faceva sembrare legno
    C.con(SUPERFICIE.OTTONE + 0.35, () => {
      // cassa di rame fino al vano e le pareti del vano
      C.scatola(c.e, c.n, 0.1, 1.05, 0.52, 2.25, CAPSULA, 0, ruota);
      for (const w of [-0.49, 0.49]) {
        const p = su(0, w);
        C.scatola(p.e, p.n, 0.62, 0.07, 0.3, 2.25, tinta(CAPSULA, 0.95), 0, ruota);
      }
      for (const s of [-1.09, 1.09]) {
        const p = su(s, 0);
        C.scatola(p.e, p.n, 0.62, 1.05, 0.3, 0.07, tinta(CAPSULA, 0.95), 0, ruota);
      }
      // costole verticali di lamiera ribattuta sui fianchi lunghi e il bordo scuro in basso:
      // la cassa si legge come un sarcofago di metallo, non come una cassa di legno
      for (const s of [-0.75, -0.25, 0.25, 0.75]) {
        for (const w of [-0.54, 0.54]) {
          const p = su(s, w);
          C.scatola(p.e, p.n, 0.1, 0.03, 0.8, 0.07, tinta(CAPSULA, 0.78), 0, ruota);
        }
      }
      C.scatola(c.e, c.n, 0.1, 1.08, 0.05, 2.28, CAPSULA_SCURA, 0, ruota);
    });
    // due fasce d'ottone (#b08a3a) attorno alla cassa
    C.con(SUPERFICIE.OTTONE + 0.75, () => {
      for (const s of [-0.78, 0.78]) {
        const p = su(s, 0);
        C.scatola(p.e, p.n, 0.2, 1.1, 0.1, 0.1, FASCIA_OTTONE, 0, ruota);
      }
    });
    // il fondo scuro del vano, sotto il vetro appannato
    C.con(NESSUNA, () => C.scatola(c.e, c.n, 0.6, 0.92, 0.025, 2.12, FONDO_CAPSULA, 0, ruota));
    // cornice d'ottone del vetro e i chiodi lungo i bordi
    C.con(SUPERFICIE.OTTONE, () => {
      for (const w of [-0.5, 0.5]) {
        const p = su(0, w);
        C.scatola(p.e, p.n, 0.92, 0.08, 0.05, 2.27, CORNICE, 0, ruota);
      }
      for (const s of [-1.1, 1.1]) {
        const p = su(s, 0);
        C.scatola(p.e, p.n, 0.92, 1.07, 0.05, 0.08, CORNICE, 0, ruota);
      }
      for (let s = -1.0; s <= 1.01; s += 0.2) {
        for (const w of [-0.535, 0.535]) {
          const p = su(s, w);
          C.scatola(p.e, p.n, 0.78, 0.03, 0.035, 0.035, CHIODO, 0, ruota);
          C.scatola(p.e, p.n, 0.3, 0.03, 0.035, 0.035, CHIODO, 0, ruota);
        }
      }
      for (let w = -0.4; w <= 0.41; w += 0.2) {
        for (const s of [-1.135, 1.135]) {
          const p = su(s, w);
          C.scatola(p.e, p.n, 0.78, 0.035, 0.035, 0.03, CHIODO, 0, ruota);
        }
      }
    });
    // il tubo che esce dalla testa della capsula e scende nel pavimento
    C.con(SUPERFICIE.METALLO, () => {
      const t0 = su(-1.17, 0.25);
      const t1 = su(-1.5, 0.25);
      C.tubo(t0.e, t0.n, 0.45, t1.e, t1.n, 0.45, 0.05, TUBO);
      C.tubo(t1.e, t1.n, 0.45, t1.e, t1.n, -0.02, 0.05, TUBO);
    });
    // display ambrato piccolo, nella sua cornice scura, sul fianco interno
    const dentro = centroCapsula(i, RAGGIO_ANELLO - 1.18);
    C.con(NESSUNA, () => A.scatola(b, dentro.e, dentro.n, 0.3, 0.3, 0.2, 0.05, FERRO, 0, ruota));
    C.con(SUPERFICIE.VETRO, () => A.scatola(b, dentro.e, dentro.n, 0.36, 0.18, 0.08, 0.07, [0.92, 0.6, 0.26], 1, ruota));
    col.push(A.collisoreScatola(c.e, c.n, 0, 1.05, 0.95, 2.25, 'capsula', ruota));
    const testa = centroCapsula(i, RAGGIO_ANELLO - 0.9);
    punti[`capsula_${i}`] = A.punto(c.e, c.n, 0.95);
    if (i === 5) {
      punti['serratura_5'] = A.punto(dentro.e, dentro.n, 0.75);
      punti['targhette'] = A.punto(dentro.e, dentro.n, 0.35);
    }
    // contenuti
    if (i === 2) C.con(SUPERFICIE.OTTONE, () => A.cilindro(b, c.e, c.n, 0.62, 0.18, 0.28, RAME, 0, 12)); // l'urna di rame (sotto il vetro)
    if (i === 3) {
      // corona secca sul vetro: un anello sottile di rami intrecciati con sopra ciuffi di foglie
      // secche (bruno, ocra, verde spento) e qualche bacca rossa; prima era un disco (e poi un
      // salvagente) marrone
      const toro = new TorusGeometry(0.19, 0.018, 4, 18).rotateX(Math.PI / 2).toNonIndexed();
      A.aggiungi(b, toro, testa.e, testa.n, 0.985, 1, [0.36, 0.26, 0.16]);
      toro.dispose();
      const foglie: RGB[] = [[0.56, 0.4, 0.22], [0.66, 0.52, 0.28], [0.42, 0.44, 0.28], [0.5, 0.32, 0.18]];
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + (k % 3) * 0.08;
        const r = 0.19 + ((k * 7) % 5) * 0.006 - 0.012;
        A.aggiungi(b, PRIMS.blob(0), testa.e + Math.cos(a) * r, testa.n + Math.sin(a) * r, 1.0, Ancora.scala(0.055, 0.02, 0.04), foglie[k % 4]!);
        if (k % 4 === 1) A.aggiungi(b, PRIMS.blob(0), testa.e + Math.cos(a + 0.12) * (r + 0.03), testa.n + Math.sin(a + 0.12) * (r + 0.03), 1.015, 0.014, [0.62, 0.16, 0.1]);
      }
      C.con(SUPERFICIE.OTTONE, () => A.scatola(b, dentro.e, dentro.n, 0.55, 0.36, 0.14, 0.05, [0.82, 0.68, 0.32], 0.2, ruota)); // targa d'ottone
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
    // (il vetro non è illuminato: nella penombra della Cripta resta grigio-azzurro tenue, chiaro solo
    // dove è appannato o gelato e sul bordo che prende il lume)
    const mat = new MeshBasicMaterial({ map: tex ?? undefined, color: !tex ? 0xc8d8e6 : i === 5 || i === 6 || i === 7 ? 0xd6dde4 : 0xa8b2bc, transparent: true, opacity: tex ? 1 : 0.3, side: DoubleSide, depthWrite: false });
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

  // --- armadietto n. 5 (fra la 4 e la 5, contro il muro): lamiera verde scura con le borchie ---
  const arm = centroCapsula(4.5, RAGGIO_ANELLO + 0.9);
  const ruotaArm = 90 - angoloCapsula(4.5);
  C.con(SUPERFICIE.METALLO, () => A.scatola(b, arm.e, arm.n, 0, 0.75, 1.95, 0.5, [0.34, 0.4, 0.34], 0, ruotaArm));
  col.push(A.collisoreScatola(arm.e, arm.n, 0, 0.75, 1.95, 0.5, 'armadietto', ruotaArm));
  const gAnta = new GeomBuilder();
  const fronte = centroCapsula(4.5, RAGGIO_ANELLO + 0.62);
  A.scatola(gAnta, fronte.e, fronte.n, 0.05, 0.7, 1.85, 0.04, [0.4, 0.46, 0.38], 0, ruotaArm);
  A.scatola(gAnta, fronte.e, fronte.n - 0.03, 1.45, 0.16, 0.22, 0.05, [0.9, 0.86, 0.72], 0, ruotaArm); // il 5 in vernice
  const anta = new Mesh(gAnta.build(), materiale);
  anta.name = 'anta-armadietto-5';
  gruppo.add(anta);
  // dentro: la borsa di cuoio, il Velo ripiegato, lo squadro d'ottone (si vedono ad anta aperta)
  const interno = centroCapsula(4.5, RAGGIO_ANELLO + 0.8);
  A.scatola(b, interno.e, interno.n, 0.9, 0.4, 0.3, 0.25, [0.45, 0.3, 0.18]);
  C.con(SUPERFICIE.OTTONE, () => A.scatola(b, interno.e, interno.n, 1.25, 0.18, 0.4, 0.1, [0.8, 0.62, 0.28]));
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
  const Co = CORRIDOIO;
  const cl = Co.e1 - Co.e0;
  const cn = (S.n0 + Co.n0) / 2;
  const cp = S.n0 - Co.n0;
  C.con(NESSUNA, () => {
    A.scatola(b, (Co.e0 + Co.e1) / 2, cn, -sp - 0.012, cl + 2 * sp, sp, cp + sp, MALTA);
    A.scatola(b, Co.e0 - sp / 2, cn, 0, sp, Co.alt, cp, MALTA);
    A.scatola(b, Co.e1 + sp / 2, cn, 0, sp, Co.alt, cp, MALTA);
  });
  C.con(NESSUNA, () => pavimentoLastre(C, Co.e0, Co.e1, Co.n0, S.n0 - sp, 7));
  C.con(NESSUNA, () => {
    pareteConci(C, 'n', Co.e0, 1, Co.n0, S.n0 - sp, 0, Co.alt, 53);
    pareteConci(C, 'n', Co.e1, -1, Co.n0, S.n0 - sp, 0, Co.alt, 59);
  });
  col.push(A.collisoreScatola(Co.e0 - sp / 2, cn, -0.5, sp, Co.alt + 1, cp, 'cripta'));
  col.push(A.collisoreScatola(Co.e1 + sp / 2, cn, -0.5, sp, Co.alt + 1, cp, 'cripta'));
  // soffitto del corridoio (calce), tranne il pozzo
  const pozzo = { e0: SCALA.e - 0.8, e1: SCALA.e + 0.8, n0: Co.n0, n1: SCALA.n + 0.9 };
  C.con(SUPERFICIE.INTONACO + 0.4, () => A.scatola(b, (Co.e0 + Co.e1) / 2, (S.n0 + pozzo.n1) / 2, Co.alt, cl + 2 * sp, sp, S.n0 - pozzo.n1, tinta(VOLTA, 0.82)));
  // segmenti di ferro (anelli) lungo il corridoio e il tubo sotto il soffitto
  C.con(SUPERFICIE.METALLO, () => {
    for (let n = S.n0 - 1; n > Co.n0 + 1.2; n -= 1.6) A.scatola(b, (Co.e0 + Co.e1) / 2, n, Co.alt - 0.12, cl, 0.12, 0.12, FERRO);
    C.tubo(Co.e1 - 0.15, S.n0, Co.alt - 0.25, Co.e1 - 0.15, Co.n0 + 0.3, Co.alt - 0.25, 0.05, TUBO);
  });
  // fondo del corridoio e pozzo
  A.scatola(b, (Co.e0 + Co.e1) / 2, Co.n0 - sp / 2, 0, cl + 2 * sp, SCALA.cima + 3.2, sp, [0.48, 0.46, 0.44]);
  col.push(A.collisoreScatola((Co.e0 + Co.e1) / 2, Co.n0 - sp / 2, -0.5, cl + 2 * sp, 3, sp, 'cripta'));
  const hPozzo = SCALA.cima + 3.2 - Co.alt;
  A.scatola(b, pozzo.e0 - sp / 2, (pozzo.n0 + pozzo.n1) / 2, Co.alt, sp, hPozzo, pozzo.n1 - pozzo.n0, [0.4, 0.38, 0.37]);
  A.scatola(b, pozzo.e1 + sp / 2, (pozzo.n0 + pozzo.n1) / 2, Co.alt, sp, hPozzo, pozzo.n1 - pozzo.n0, [0.4, 0.38, 0.37]);
  A.scatola(b, SCALA.e, pozzo.n1 + sp / 2, Co.alt, pozzo.e1 - pozzo.e0 + 2 * sp, hPozzo, sp, [0.4, 0.38, 0.37]);
  // la scala alla marinara
  C.con(SUPERFICIE.METALLO, () => {
    for (const de of [-0.32, 0.32]) A.scatola(b, SCALA.e + de, Co.n0 + 0.18, 0, 0.06, SCALA.cima + 2.4, 0.06, [0.36, 0.36, 0.34]);
    for (let y = 0.3; y < SCALA.cima + 2.2; y += 0.32) A.scatola(b, SCALA.e, Co.n0 + 0.18, y, 0.64, 0.04, 0.04, [0.4, 0.4, 0.38]);
  });
  // la botola in cima al pozzo, con il filo di luce attorno
  const yBotola = SCALA.cima + 3.2;
  const gBotola = new GeomBuilder();
  A.scatola(gBotola, SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola - 0.12, pozzo.e1 - pozzo.e0 - 0.08, 0.1, pozzo.n1 - pozzo.n0 - 0.08, [0.3, 0.26, 0.22]);
  const botola = new Mesh(gBotola.build(), materiale);
  botola.name = 'botola-interna';
  gruppo.add(botola);
  A.scatola(b, SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola - 0.02, pozzo.e1 - pozzo.e0 + 0.1, 0.03, pozzo.n1 - pozzo.n0 + 0.1, [0.85, 0.86, 0.88], 1);
  A.scatola(b, SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola + 0.01, pozzo.e1 - pozzo.e0 + 2 * sp, 0.3, pozzo.n1 - pozzo.n0 + 2 * sp, [0.2, 0.18, 0.17]);
  punti['scala'] = A.punto(SCALA.e, Co.n0 + 0.4, 1.4);
  punti['botola_interna'] = A.punto(SCALA.e, (pozzo.n0 + pozzo.n1) / 2, yBotola - 0.2);
  // scritte del corridoio (sulle pareti, davanti ai conci)
  C.con(NESSUNA, () => {
    A.scatola(b, Co.e1 - 0.075, -10.6, 0.9, 0.02, 0.9, 1.6, [0.86, 0.84, 0.78]); // gesso
    A.scatola(b, Co.e0 + 0.075, -10.2, 1.0, 0.02, 1.1, 1.3, [0.72, 0.36, 0.2]); // orari dipinti
  });
  punti['gesso_corridoio'] = A.punto(Co.e1, -10.6, 1.35);
  punti['orari_cripta'] = A.punto(Co.e0, -10.2, 1.55);

  // lumi color miele (#ffb060): due a braccio sulle pareti della sala, uno appeso al centro della
  // volta, uno nel corridoio; tre fanno luce (le pozze calde), quello a Mane è spento
  const posLumi: Array<[number, number, number, boolean, 'muro' | 'appeso']> = [
    [S.e0 + 0.45, -2.0, 2.9, true, 'muro'],
    [S.e1 - 0.45, -2.0, 2.9, false, 'muro'],
    [4.5, -6.3, 3.4, true, 'appeso'],
    [4.5, -12.0, 2.05, true, 'appeso'],
  ];
  const lumiCotti: Array<{ p: Vector3; k: number }> = [];
  for (const [e, n, y, luce, tipo] of posLumi) {
    C.con(SUPERFICIE.METALLO, () => {
      // gabbia di ferro: base, cappello, montanti, e il braccio al muro o la catena alla volta
      A.scatola(b, e, n, y - 0.13, 0.2, 0.03, 0.2, FERRO);
      A.scatola(b, e, n, y + 0.12, 0.24, 0.04, 0.24, FERRO);
      A.aggiungi(b, PRIMS.pyramid(), e, n, y + 0.16, Ancora.scala(0.26, 0.1, 0.26), FERRO);
      for (const [de, dn] of [
        [0.09, 0.09],
        [-0.09, 0.09],
        [0.09, -0.09],
        [-0.09, -0.09],
      ] as const)
        A.scatola(b, e + de, n + dn, y - 0.1, 0.02, 0.22, 0.02, FERRO);
      if (tipo === 'muro') {
        const muro = e < ec ? S.e0 : S.e1;
        C.tubo(muro, n, y + 0.32, e, n, y + 0.3, 0.018, FERRO, 5);
        C.tubo(muro, n, y - 0.05, e, n, y + 0.3, 0.014, FERRO, 5);
        A.scatola(b, muro + (e < ec ? 0.03 : -0.03), n, y - 0.12, 0.04, 0.5, 0.14, FERRO);
      } else {
        const cima = n > S.n0 ? quotaVolta(e) : Co.alt;
        C.tubo(e, n, y + 0.26, e, n, cima, 0.012, FERRO, 4);
      }
    });
    C.con(SUPERFICIE.VETRO, () => A.scatola(b, e, n, y - 0.1, 0.16, 0.2, 0.16, LUME, luce ? 1 : 0.35));
    if (luce) lumi.push(A.punto(e, n, y));
    lumiCotti.push({ p: new Vector3(e, y, -n), k: luce ? 1.25 : 0.35 });
  }

  const geoMuri = b.build();
  illuminaCripta(geoMuri, A, C.tipi, lumiCotti);
  const mesh = new Mesh(geoMuri, materiale);
  mesh.name = 'cripta-muri';
  // (rifinitura 1: la Cripta ha più triangoli, conci e capsule: fuori dal campo non si disegna più;
  // la sfera di contorno è quella vera, in coordinate mondo)
  geoMuri.computeBoundingSphere();
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
        // 1,5 s (erano 2,2: «Alzati» arrivava dopo più di due secondi fermi a guardare il coperchio)
        aperturaCoperchio = Math.min(1, aperturaCoperchio + dt / 1.5);
        const k = 0.5 - 0.5 * Math.cos(aperturaCoperchio * Math.PI);
        if (coperchio5?.parent) coperchio5.parent.rotation.x = -1.25 * k;
        // rifinitura 2: aperto, il vetro non è più appannato dal fiato (la scritta è stata letta): da
        // fuori resta un vetro quasi trasparente col bordo di luce, non un pannello bianco
        if (coperchio5) (coperchio5.material as MeshBasicMaterial).opacity = 1 - 0.55 * k;
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
 * Luce dipinta della Cripta (rifinitura 1): il materiale del mondo illumina tutto col cielo, ma
 * qui sotto il cielo non arriva, e le pozze dei lumi del motore ci sono solo di notte. Si cuoce
 * nella geometria:
 * - la superficie dipinta di ogni parte (`tipi`: conci e lastre senza il motivo a poligoni, volta a
 *   calce, rame e ottone delle capsule, vetro dei lumi); dove manca, la si deduce dal colore;
 * - la luce calda dei lumi (#ffb060): attorno a ognuno una pozza che scalda e schiarisce i colori,
 *   con la caduta morbida e la faccia girata verso il lume; lontano dai lumi gli angoli restano
 *   scuri e freddi (colori spenti e azzurrini, occlusione alta: il riempimento del cielo sparisce);
 * - il chiarore freddo delle capsule a metà altezza e il piede delle pareti più buio e umido.
 */
function illuminaCripta(geo: BufferGeometry, A: Ancora, tipi: Array<[number, number, number]>, lumiCotti: Array<{ p: Vector3; k: number }>): void {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const col = geo.getAttribute('aColor');
  if (!pos || !col || !nor) return;
  const inv = A.matrice.clone().invert();
  const rotInv = new Matrix4().extractRotation(A.matrice).invert();
  const v = new Vector3();
  const nn = new Vector3();
  const d = new Vector3();
  const n = pos.count;
  const sup = new Float32Array(n * 2);
  const capsule = [1, 2, 3, 4, 5, 6, 7].map((i) => centroCapsula(i));
  const vicino = (c: readonly number[], t: readonly number[]) => Math.abs(c[0]! - t[0]!) + Math.abs(c[1]! - t[1]!) + Math.abs(c[2]! - t[2]!) < 0.02;
  // superficie per intervallo di vertici
  const tipoDi = new Float32Array(n).fill(-1);
  for (const [a, b, t] of tipi) for (let i = a; i < b; i++) tipoDi[i] = t;
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(inv);
    nn.fromBufferAttribute(nor, i).applyMatrix4(rotInv).normalize();
    const e = v.x;
    const y = v.y;
    const nl = -v.z;
    const c = [col.getX(i), col.getY(i), col.getZ(i)];
    const emette = col.getW(i) > 0.02;
    let tipo = tipoDi[i]!;
    if (tipo < 0) {
      tipo = 0;
      if (emette) tipo = SUPERFICIE.VETRO;
      else if (vicino(c, PIETRA)) tipo = SUPERFICIE.PIETRA + 0.3;
      else if (vicino(c, VOLTA)) tipo = SUPERFICIE.INTONACO + 0.6;
      else if (vicino(c, PAVIMENTO)) tipo = SUPERFICIE.PIETRA + 0.75;
      else if (vicino(c, METALLO)) tipo = SUPERFICIE.METALLO;
      else if (vicino(c, RAME)) tipo = SUPERFICIE.OTTONE;
      else if (c[0]! < 0.55 && Math.abs(c[0]! - c[2]!) < 0.08) tipo = SUPERFICIE.PIETRA + 0.5;
    }
    // luce calda dei lumi (pozze cotte)
    let caldo = 0;
    for (const l of lumiCotti) {
      d.copy(l.p).sub(v);
      const dist = d.length();
      const ndl = Math.min(1, Math.max(0, d.dot(nn) / Math.max(dist, 1e-3) * 0.7 + 0.3));
      caldo += (l.k * ndl) / (1 + dist * dist * 0.15);
      // rifinitura 2: la pozza sotto il lume, sul pavimento e sulle facce rivolte in su: un cerchio
      // caldo di circa 1,5 m che si legge (con la sola caduta morbida il pavimento era tutto uguale)
      const h2 = d.x * d.x + d.z * d.z;
      caldo += l.k * 0.5 * Math.exp(-h2 / (2 * 1.5 * 1.5)) * (nn.y > 0.7 ? 1 : 0.25);
    }
    caldo = Math.min(1.15, caldo);
    // luce fredda delle capsule (a metà altezza)
    let glow = 0;
    for (const k of capsule) {
      const d2 = Math.pow(e - k.e, 2) + Math.pow(nl - k.n, 2) + Math.pow(y - 0.8, 2);
      glow += Math.exp(-d2 / (2.0 * 2.0));
    }
    glow = Math.min(1, glow);
    const piede = Math.max(0, 1 - y / 0.9);
    const occ = emette ? 0 : Math.min(0.6, Math.max(0.05, 0.5 - caldo * 0.45 - glow * 0.12 + piede * 0.1));
    sup[i * 2] = tipo;
    sup[i * 2 + 1] = occ;
    if (!emette) {
      // dai colori freddi e spenti degli angoli ai colori caldi e chiari vicino ai lumi
      const t = caldo / (caldo + 0.35);
      // (rifinitura 2: la luce della Cripta è già calda nel materiale; qui meno arancio e più valori:
      // pozze chiare, angoli scuri)
      let r = c[0]! * (0.58 + t * 0.78);
      let g = c[1]! * (0.6 + t * 0.64);
      let bb = c[2]! * (0.7 + t * 0.42);
      // azzurro vicino alle capsule, bruno umido al piede delle pareti
      const k = glow * 0.3 * (1 - t);
      r *= 1 - k * 0.25;
      g *= 1 - k * 0.05;
      bb *= 1 + k * 0.3;
      if (piede > 0) {
        const u = piede * 0.22;
        r *= 1 - u;
        g *= 1 - u * 0.9;
        bb *= 1 - u * 1.1;
      }
      col.setXYZ(i, r, g, bb);
      // la pozza calda dei lumi accesi: un filo d'emissione (il colore dei lumi di notte, vedi
      // `worldMaterial`), così la luce calda si legge anche sotto l'ambiente freddo della notte
      if (tipo > 0.25) col.setW(i, Math.min(0.3, Math.max(0, caldo - 0.25) * 0.32));
    }
  }
  col.needsUpdate = true;
  geo.setAttribute('aSuperficie', new BufferAttribute(sup, 2));
}
