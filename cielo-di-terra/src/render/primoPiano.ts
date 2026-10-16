/**
 * Il primo piano (traccia «paese»): materiale e costruttore di forme per ciò che Elvira tiene in
 * mano (il Velo, lo squadro, la lettera) con i guanti di cuoio e le maniche di lana.
 *
 * - **Materiale** (`materialePrimoPiano`): stessa luce del mondo (la luce principale arriva dal
 *   nucleo della Linea, `keyLightDir`; riempimento freddo dal cielo, rimbalzo caldo dal suolo),
 *   in due toni morbidi come il dipinto, con un motivo per ogni materia: venature del legno, grana
 *   e cuciture del cuoio, coste della lana, trama e punti a croce della tela (in controluce),
 *   ottone lucido che riflette cielo e suolo, torsione della corda, fibre della carta. Le forme
 *   passano poi dalla post-produzione (filtro pittorico, toni) come il mondo.
 * - **Uniform condivisi** (`UNIFORMI_PRIMO_PIANO`): il motore li aggiorna a ogni fotogramma
 *   (`Game.updateFirstPerson`, tramite `FirstPersonVelo.uniforms`); lo squadro li usa così come sono.
 * - **Costruttore** (`FormePrimoPiano`): tubi lisci lungo una curva (dita, maniche, aste, corde),
 *   ellissoidi e geometrie qualsiasi, con gli attributi del materiale: `aColor` (rgb = colore,
 *   a = materia, vedi `MATERIA`) e `aPP` (u = metri lungo la forma, v = giro 0..1, occlusione).
 *
 * Coordinate: spazio della camera del primo piano (la camera guarda −Z, +Y in su, +X a destra).
 */
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  DoubleSide,
  FrontSide,
  Matrix3,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Side,
} from 'three';

/** Le materie del primo piano (canale alfa di `aColor`). */
export const MATERIA = {
  PIENA: 0,
  LEGNO: 1,
  CUOIO: 2,
  LANA: 3,
  TELA: 4,
  OTTONE: 5,
  CORDA: 6,
  CARTA: 7,
  FERRO: 8,
  FILO: 9,
  VETRO: 10,
} as const;
export type Materia = number;

/** Cuoio con la cucitura (una riga di punti di filo scuro dove v = 0, sul dorso delle dita e sui polsini). */
export const CUOIO_CUCITO = MATERIA.CUOIO + 0.25;

/** Lana a maglia fitta, senza coste (il corpo delle maniche; il polsino resta `MATERIA.LANA`, a coste). */
export const LANA_MAGLIA = MATERIA.LANA + 0.25;

export type Colore = number | readonly [number, number, number];

/** Colore esadecimale sRGB → [r, g, b] in 0..1 (gli stessi valori del materiale del mondo). */
export function rgb(c: Colore): [number, number, number] {
  if (typeof c !== 'number') return [c[0], c[1], c[2]];
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
}

/** Mescola due colori (t = 0 → a, 1 → b). */
export function misto(a: Colore, b: Colore, t: number): [number, number, number] {
  const x = rgb(a);
  const y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
}

/** Uniform della luce del primo piano, condivisi da Velo, squadro e lettera. */
export const UNIFORMI_PRIMO_PIANO = {
  /** direzione della luce principale nello spazio della camera */
  uLightView: { value: new Vector3(0.3, 0.8, 0.4).normalize() },
  uSun: { value: new Vector3(1, 0.95, 0.85) },
  uSunI: { value: 1 },
  /** riempimento del cielo (`SkyState.ambientTop`) */
  uAmb: { value: new Vector3(0.55, 0.6, 0.7) },
  uNight: { value: 0 },
  uTime: { value: 0 },
};

export type UniformiPrimoPiano = typeof UNIFORMI_PRIMO_PIANO;

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute vec3 aPP;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec4 vC;
varying vec3 vPP;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vP = mv.xyz;
  vO = position;
  vC = aColor;
  vPP = aPP;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uLightView;
uniform vec3 uSun;
uniform float uSunI;
uniform vec3 uAmb;
uniform float uNight;
uniform float uTime;
varying vec3 vN;
varying vec3 vP;
varying vec3 vO;
varying vec4 vC;
varying vec3 vPP;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float rum(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * rum(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
float rum3(vec3 p) {
  return rum(p.xy + p.z * vec2(0.37, 1.31)) * 0.5 + rum(p.yz * 1.13 + p.x * vec2(1.7, 0.29)) * 0.5;
}

void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(-vP);
  vec3 L = normalize(uLightView);
  float materia = floor(vC.a + 0.5);
  vec3 alb = vC.rgb;
  float u = vPP.x;
  float v = vPP.y;
  float occ = clamp(vPP.z, 0.0, 1.0);
  float avvolgi = 0.22;   // luce che gira attorno alle forme (stoffe e lana di più)
  float lucido = 0.0;     // forza del riflesso
  float durezza = 10.0;   // esponente del riflesso
  float metallo = 0.0;
  float trasmessa = 0.0;  // luce che passa (tela, carta, foglie)
  float peluria = 0.0;    // bordo vellutato (lana)
  float opaco = 0.0;      // 1 = niente controluce sul contorno (il cuoio dei guanti)

  if (materia < 0.5) {
    alb *= 0.94 + 0.12 * fbm(vO.xy * 40.0 + vO.z * 13.0);
  } else if (materia < 1.5) {
    // legno: venature lungo la forma, nodi radi, fibra scura
    float w = fbm(vec2(u * 7.0, v * 3.0 + 4.0));
    float ven = sin(u * 70.0 + w * 9.0 + v * 6.2831 * 2.0);
    alb *= 0.86 + 0.16 * smoothstep(-0.4, 0.9, ven);
    alb *= 0.9 + 0.14 * fbm(vec2(u * 3.0, v * 25.0));
    float nodo = smoothstep(0.86, 0.95, rum(vec2(u * 9.0, v * 4.0) + 7.0));
    alb = mix(alb, alb * 0.55, nodo);
    lucido = 0.18;
    durezza = 14.0;
  } else if (materia < 2.5) {
    // cuoio dei guanti (rifinitura 1, bozzetto 2): cuoio scuro e opaco, grana e pieghe, più chiaro
    // dove si consuma; niente riflesso né bordo luminoso (se no sembra pelle nuda), cuciture SCURE
    float gr = fbm(vO.xy * 140.0 + vO.z * 77.0);
    float pieghe = fbm(vec2(u * 60.0, v * 5.0));
    alb *= 0.86 + 0.22 * gr;
    alb *= 0.9 + 0.16 * smoothstep(0.35, 0.8, pieghe);
    // consumato (più chiaro e caldo) dove non c'è occlusione
    alb = mix(alb, alb * vec3(1.22, 1.12, 1.0), (1.0 - occ) * 0.25 * smoothstep(0.5, 0.8, gr));
    // cucitura (materia + 0,25: forme con la cucitura): un solco appena più scuro con i punti di
    // filo scuro dove v = 0
    float conCuc = step(0.6, fract(vC.a + 0.5));
    float cuc = 1.0 - smoothstep(0.012, 0.03, abs(fract(v + 0.5) - 0.5));
    float punti = step(0.45, fract(u * 95.0));
    alb *= 1.0 - 0.18 * conCuc * (1.0 - smoothstep(0.02, 0.05, abs(fract(v + 0.5) - 0.5)));
    alb = mix(alb, alb * 0.42, cuc * punti * conCuc * 0.85);
    // (rifinitura 2: di notte il cuoio resta bruno, non una macchia viola)
    alb = mix(alb, alb * vec3(1.35, 1.05, 0.6), uNight * 0.7);
    lucido = 0.035;
    durezza = 6.0;
    avvolgi = 0.42;
    opaco = 1.0;
  } else if (materia < 3.5) {
    // lana verde: il polsino a coste; il corpo della manica (materia + 0,25, LANA_MAGLIA) a maglia
    // fitta e a basso contrasto (le coste lungo tutta la manica la facevano un tubo rigato)
    float magliaF = step(0.6, fract(vC.a + 0.5));
    float coste = sin(v * 6.2831 * 34.0);
    float maglia = sin(u * 260.0 + sin(v * 6.2831 * 34.0) * 1.5);
    // (rifinitura 2, area «oggetti»: maglia più grossa e più contrastata, ±12%, che sfuma dove i punti
    // diventano più piccoli di un pixel; di notte la lana non diventa grigio neutro sotto il cielo blu)
    float fasePunto = sin(v * 6.2831 * 48.0);
    float punto = fasePunto * sin(u * 230.0 + fasePunto * 0.8);
    float nitido = 1.0 - smoothstep(0.35, 0.9, fwidth(u * 230.0) + fwidth(v * 48.0) * 6.2831);
    alb *= mix(0.86 + 0.1 * coste + 0.06 * maglia, 0.97 + 0.12 * punto * nitido, magliaF);
    alb *= mix(0.85 + 0.25 * fbm(vec2(u * 18.0, v * 12.0)), 0.82 + 0.3 * fbm(vec2(u * 11.0, v * 8.0)), magliaF);
    alb = mix(alb, alb * vec3(1.3, 1.25, 0.5), uNight * 0.85);
    avvolgi = 0.5;
    peluria = mix(0.45, 0.3, magliaF);
  } else if (materia < 4.5) {
    // tela del Velo: trama fine, rattoppi, punti a croce sulle cuciture (u, v in metri)
    float trama = 0.5 + 0.25 * sin(u * 2400.0) + 0.25 * sin(v * 2400.0);
    alb *= 0.93 + 0.07 * trama;
    alb *= 0.9 + 0.14 * fbm(vec2(u, v) * 9.0);
    // cuciture: ogni 0,42 m lungo u (sopramano: due teli sovrapposti) e l'orlo a v < 0,05
    float du = (fract(u / 0.42 + 0.5) - 0.5) * 0.42;
    float sCuc = 1.0 - smoothstep(0.006, 0.011, abs(du));
    float orlo = smoothstep(0.012, 0.02, v) * (1.0 - smoothstep(0.046, 0.054, v));
    alb *= 1.0 - 0.16 * max(sCuc, orlo);
    // punti a croce (X di spago) sopra le cuciture e lungo l'orlo
    vec2 q = vec2(du, mod(v, 0.026) - 0.013);
    float croce = (1.0 - smoothstep(0.0011, 0.0023, abs(abs(q.x) - abs(q.y) * 0.75))) * step(abs(q.x), 0.0085) * step(0.06, v);
    vec2 qo = vec2(mod(u, 0.026) - 0.013, v - 0.033);
    float croceOrlo = (1.0 - smoothstep(0.0011, 0.0023, abs(abs(qo.y) - abs(qo.x) * 0.75))) * step(abs(qo.y), 0.0085);
    float sCroce = max(croce, croceOrlo);
    alb = mix(alb, vec3(0.55, 0.42, 0.28), sCroce * 0.75);
    trasmessa = 0.85;
    avvolgi = 0.45;
  } else if (materia < 5.5) {
    // ottone lucido: patina scura negli incavi, graffi fini
    alb *= 0.9 + 0.12 * fbm(vec2(u * 30.0, v * 40.0));
    metallo = 1.0;
    lucido = 1.4;
    durezza = 46.0;
    avvolgi = 0.0;
  } else if (materia < 6.5) {
    // corda: trefoli attorcigliati
    float tr = fract(u * 90.0 + v * 3.0);
    alb *= 0.72 + 0.38 * smoothstep(0.0, 0.45, tr) * smoothstep(1.0, 0.55, tr);
    alb *= 0.9 + 0.15 * fbm(vec2(u * 40.0, v * 9.0));
    avvolgi = 0.35;
  } else if (materia < 7.5) {
    // carta: fibre, macchie del tempo, luce che passa
    alb *= 0.93 + 0.07 * fbm(vec2(u, v) * 60.0);
    float macchie = smoothstep(0.62, 0.8, fbm(vec2(u, v) * 7.0 + 3.0));
    alb = mix(alb, alb * vec3(0.86, 0.76, 0.6), macchie * 0.6);
    trasmessa = 0.45;
    avvolgi = 0.35;
  } else if (materia < 8.5) {
    // ferro: scuro, un po' lucido, ruggine a chiazze
    float rug = smoothstep(0.55, 0.75, fbm(vO.xy * 30.0 + vO.z * 11.0));
    alb = mix(alb, vec3(0.42, 0.24, 0.13), rug * 0.6);
    metallo = 0.5;
    lucido = 0.5;
    durezza = 24.0;
  } else if (materia < 9.5) {
    // fili della nappina
    alb *= 0.78 + 0.3 * rum(vec2(v * 60.0, u * 4.0));
    avvolgi = 0.45;
    trasmessa = 0.3;
  } else {
    // vetro delle lenti: scuro, riflette il cielo
    metallo = 1.0;
    lucido = 2.0;
    durezza = 70.0;
  }

  float ndl = dot(N, L);
  float d = clamp((ndl + avvolgi) / (1.0 + avvolgi), 0.0, 1.0);
  // due toni morbidi, come le campiture del mondo
  float banda = smoothstep(0.3, 0.46, d);
  d = mix(d, 0.12 + 0.88 * banda, 0.5);
  float alto = N.y * 0.5 + 0.5;
  vec3 cielo = uAmb;
  vec3 suolo = mix(uAmb * 0.55, vec3(0.6, 0.5, 0.36), 0.55 * (1.0 - uNight));
  vec3 amb = mix(suolo, cielo, alto);
  // il cuoio (opaco) prende meno occlusione e più riempimento frontale: scuro e opaco sì, ma non una
  // sagoma nera quando la mano è in ombra (rifinitura 1)
  float ao = 1.0 - occ * mix(0.85, 0.6, opaco);
  vec3 luce = uSun * uSunI;
  // riempimento dal corpo e dall'occhio (le cose in mano non stanno mai al buio, come nei bozzetti)
  float fronte = max(0.0, dot(N, V)) * 0.5 + 0.5;
  vec3 col = alb * (amb * 0.82 * ao + amb * (0.16 + 0.34 * opaco) * fronte + luce * d * 0.86 * mix(1.0, ao, 0.4));
  // luce trasmessa (controluce della tela e della carta)
  col += alb * luce * trasmessa * max(0.0, -ndl) * 0.55;
  col += alb * luce * trasmessa * 0.18;
  // riflesso
  vec3 H = normalize(L + V);
  float sp = pow(max(dot(N, H), 0.0), durezza) * lucido * smoothstep(-0.1, 0.2, ndl);
  col += luce * sp * mix(vec3(0.9), alb * 1.7, metallo);
  // metalli: riflettono il cielo (chiaro) e il suolo (scuro, caldo): un orizzonte netto sul tubo
  if (metallo > 0.0) {
    vec3 R = reflect(-V, N);
    float k = smoothstep(-0.03, 0.14, R.y + 0.1 * (fbm(R.xz * 3.0) - 0.5));
    vec3 env = mix(suolo * 0.5 + vec3(0.05, 0.035, 0.02), cielo * 0.95 + luce * 0.22, k);
    // la luce principale riflessa: una macchia larga e calda dalla parte della luce
    env += luce * 0.7 * smoothstep(0.6, 0.95, dot(R, L));
    vec3 m = alb * env * 1.1 * ao + alb * luce * d * 0.25;
    // il riflesso della luce: caldo ma non giallo pieno (l'ottone non è plastica)
    col = mix(col, m + luce * sp * mix(alb * 1.6, vec3(1.0, 0.93, 0.8), 0.35), metallo * 0.9);
    // bordi chiari (Fresnel)
    float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += alb * cielo * fr * 0.3 * metallo;
  }
  // peluria: bordo vellutato dalla parte della luce
  float bordo = pow(1.0 - max(dot(N, V), 0.0), 2.5);
  col += alb * (luce * 0.6 + cielo * 0.3) * bordo * peluria * (0.4 + 0.6 * max(0.0, ndl + 0.3));
  // controluce sui contorni di tutte le forme (il bordo luminoso dei bozzetti)
  col += luce * alb * bordo * 0.22 * smoothstep(0.0, 0.6, dot(-V, L) + 0.4) * (1.0 - opaco);
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface OpzioniMateriale {
  /** doppia faccia (tela, carta, fili) */
  doppia?: boolean;
  nome?: string;
}

/** Il materiale del primo piano (uniform condivisi `UNIFORMI_PRIMO_PIANO`). */
export function materialePrimoPiano(o: OpzioniMateriale = {}): ShaderMaterial {
  const side: Side = o.doppia ? DoubleSide : FrontSide;
  return new ShaderMaterial({
    name: o.nome ?? (o.doppia ? 'primo-piano-doppio' : 'primo-piano'),
    uniforms: UNIFORMI_PRIMO_PIANO,
    vertexShader: VERT,
    fragmentShader: FRAG,
    side,
  });
}

/** Occlusione cotta: costante o in funzione di (posizione, u, v). */
export type Occlusione = number | ((p: Vector3, u: number, v: number) => number);

export interface OpzioniForma {
  colore: Colore | ((p: Vector3, u: number, v: number) => Colore);
  materia?: Materia;
  occlusione?: Occlusione;
}

export interface OpzioniTubo extends OpzioniForma {
  /** vertici per giro */
  segmenti?: number;
  /** anelli lungo la curva (predefinito: secondo la lunghezza) */
  passi?: number;
  /** schiacciamento della sezione (raggio y / raggio x) */
  ellisse?: number;
  /** verso del raggio x della sezione (si proietta sul piano normale alla curva) */
  lato?: Vector3;
  /** calotta tonda all'inizio e alla fine */
  chiudiInizio?: boolean;
  chiudiFine?: boolean;
  /** la curva passa esattamente per i punti (Catmull-Rom) o li unisce a segmenti */
  liscio?: boolean;
  /** offset di v (giro), per far cadere la cucitura dove serve */
  giro?: number;
}

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _n = new Vector3();
const _m3 = new Matrix3();

/**
 * Accumula forme in un'unica geometria (non indicizzata) con `position`, `normal`, `aColor`, `aPP`.
 */
export class FormePrimoPiano {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  private pp: number[] = [];

  get triangoli(): number {
    return this.pos.length / 9;
  }

  private vertice(p: Vector3, n: Vector3, c: readonly number[], materia: number, u: number, v: number, occ: number): void {
    this.pos.push(p.x, p.y, p.z);
    this.nor.push(n.x, n.y, n.z);
    this.col.push(c[0]!, c[1]!, c[2]!, materia);
    this.pp.push(u, v, occ);
  }

  /** Tubo lungo una curva: raggi costanti, per punto di controllo (interpolati) o funzione di t (0..1). */
  tubo(punti: Vector3[], raggi: number | number[] | ((t: number) => number), o: OpzioniTubo): void {
    const liscio = o.liscio ?? true;
    const lungh = punti.reduce((s, p, i) => (i ? s + p.distanceTo(punti[i - 1]!) : 0), 0);
    const passi = o.passi ?? Math.max(2, Math.min(40, Math.round(lungh / 0.012) + 1));
    const seg = o.segmenti ?? 10;
    const ell = o.ellisse ?? 1;
    // campioni lungo la curva
    const cs: Vector3[] = [];
    if (punti.length > 2 && liscio) {
      const curva = new CatmullRomCurve3(punti, false, 'centripetal');
      for (let i = 0; i <= passi; i++) cs.push(curva.getPointAt(i / passi));
    } else {
      // spezzata: campioni uniformi in lunghezza
      const segm: number[] = [];
      let tot = 0;
      for (let i = 1; i < punti.length; i++) {
        const l = punti[i]!.distanceTo(punti[i - 1]!);
        segm.push(l);
        tot += l;
      }
      for (let i = 0; i <= passi; i++) {
        let s = (i / passi) * tot;
        let k = 0;
        while (k < segm.length - 1 && s > segm[k]!) s -= segm[k++]!;
        cs.push(punti[k]!.clone().lerp(punti[k + 1]!, Math.min(1, s / (segm[k]! || 1))));
      }
    }
    const raggioA = (t: number): number => {
      if (typeof raggi === 'number') return raggi;
      if (typeof raggi === 'function') return raggi(t);
      if (raggi.length === 1) return raggi[0]!;
      const x = t * (raggi.length - 1);
      const i = Math.min(raggi.length - 2, Math.floor(x));
      const f = x - i;
      return raggi[i]! * (1 - f) + raggi[i + 1]! * f;
    };
    // lunghezze cumulate e tangenti
    const sAcc: number[] = [0];
    for (let i = 1; i < cs.length; i++) sAcc.push(sAcc[i - 1]! + cs[i]!.distanceTo(cs[i - 1]!));
    const T: Vector3[] = cs.map((_p, i) => {
      const a = cs[Math.max(0, i - 1)]!;
      const b = cs[Math.min(cs.length - 1, i + 1)]!;
      return b.clone().sub(a).normalize();
    });
    // trasporto parallelo della terna, partendo dal «lato» richiesto
    const lato = o.lato ? o.lato.clone() : Math.abs(T[0]!.y) < 0.9 ? new Vector3(0, 1, 0).cross(T[0]!) : new Vector3(1, 0, 0);
    let Nn = lato.addScaledVector(T[0]!, -lato.dot(T[0]!)).normalize();
    const NN: Vector3[] = [];
    const BB: Vector3[] = [];
    for (let i = 0; i < cs.length; i++) {
      if (i > 0) {
        const q = new Quaternion().setFromUnitVectors(T[i - 1]!, T[i]!);
        Nn = Nn.clone().applyQuaternion(q);
        Nn.addScaledVector(T[i]!, -Nn.dot(T[i]!)).normalize();
      }
      NN.push(Nn.clone());
      BB.push(T[i]!.clone().cross(Nn).normalize());
    }
    // anelli (con le calotte: anelli in più che si stringono a emisfero)
    type Anello = { c: Vector3; T: Vector3; N: Vector3; B: Vector3; r: number; s: number; tappo: number };
    const anelli: Anello[] = [];
    const nCal = 4;
    const r0 = raggioA(0);
    const r1 = raggioA(1);
    if (o.chiudiInizio) {
      for (let k = nCal; k >= 1; k--) {
        const a = (k / nCal) * (Math.PI / 2) * 0.97;
        anelli.push({ c: cs[0]!.clone().addScaledVector(T[0]!, -Math.sin(a) * r0 * 0.9), T: T[0]!, N: NN[0]!, B: BB[0]!, r: Math.cos(a) * r0, s: -Math.sin(a) * r0, tappo: -Math.sin(a) });
      }
    }
    for (let i = 0; i < cs.length; i++) anelli.push({ c: cs[i]!, T: T[i]!, N: NN[i]!, B: BB[i]!, r: raggioA(sAcc[i]! / (sAcc[cs.length - 1]! || 1)), s: sAcc[i]!, tappo: 0 });
    if (o.chiudiFine) {
      const l = cs.length - 1;
      for (let k = 1; k <= nCal; k++) {
        const a = (k / nCal) * (Math.PI / 2) * 0.97;
        anelli.push({ c: cs[l]!.clone().addScaledVector(T[l]!, Math.sin(a) * r1 * 0.9), T: T[l]!, N: NN[l]!, B: BB[l]!, r: Math.cos(a) * r1, s: sAcc[l]! + Math.sin(a) * r1, tappo: Math.sin(a) });
      }
    }
    const giro = o.giro ?? 0;
    const materia = o.materia ?? MATERIA.PIENA;
    // vertici di ogni anello
    const P: Vector3[][] = [];
    const Nv: Vector3[][] = [];
    for (const an of anelli) {
      const rp: Vector3[] = [];
      const rn: Vector3[] = [];
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2;
        const cx = Math.cos(th);
        const sy = Math.sin(th);
        const p = an.c.clone().addScaledVector(an.N, cx * an.r).addScaledVector(an.B, sy * an.r * ell);
        const n = an.N.clone().multiplyScalar(cx / Math.max(1e-4, 1)).addScaledVector(an.B, sy / Math.max(1e-4, ell));
        n.normalize();
        if (an.tappo !== 0) n.multiplyScalar(Math.sqrt(Math.max(0, 1 - an.tappo * an.tappo))).addScaledVector(an.T, an.tappo).normalize();
        rp.push(p);
        rn.push(n);
      }
      P.push(rp);
      Nv.push(rn);
    }
    const colA = (p: Vector3, u: number, v: number): readonly number[] => (typeof o.colore === 'function' ? rgb(o.colore(p, u, v)) : rgb(o.colore));
    const occA = (p: Vector3, u: number, v: number): number => (typeof o.occlusione === 'function' ? o.occlusione(p, u, v) : o.occlusione ?? 0);
    const quad = (i: number, j: number) => {
      const idx: Array<[number, number]> = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j],
        [i + 1, j + 1],
        [i, j + 1],
      ];
      // verso: la faccia deve guardare come le normali dei vertici
      const a = P[i]![j]!;
      const b = P[i + 1]![j]!;
      const c = P[i + 1]![j + 1]!;
      _a.subVectors(b, a);
      _b.subVectors(c, a);
      _c.crossVectors(_a, _b);
      const giusto = _c.dot(Nv[i]![j]!) + _c.dot(Nv[i + 1]![j + 1]!) >= 0;
      const ord = giusto ? idx : [idx[0]!, idx[2]!, idx[1]!, idx[3]!, idx[5]!, idx[4]!];
      for (const [ii, jj] of ord) {
        const p = P[ii]![jj]!;
        const u = anelli[ii]!.s;
        const v = (jj / seg + giro) % 1;
        this.vertice(p, Nv[ii]![jj]!, colA(p, u, v), materia, u, v, occA(p, u, v));
      }
    };
    for (let i = 0; i < anelli.length - 1; i++) for (let j = 0; j < seg; j++) quad(i, j);
  }

  /** Ellissoide (centro, semiassi, rotazione). */
  ellissoide(centro: Vector3, raggi: Vector3, q: Quaternion, o: OpzioniForma & { w?: number; h?: number }): void {
    const g = new SphereGeometry(1, o.w ?? 14, o.h ?? 10);
    const m = new Matrix4().compose(centro, q, raggi);
    this.geometria(g, m, o);
    g.dispose();
  }

  /**
   * Una geometria qualsiasi trasformata da `m` (le normali con la matrice delle normali; se `m`
   * specchia, i triangoli girano). u, v dalla `uv` della geometria (moltiplicate per `uvScala`).
   */
  geometria(g: BufferGeometry, m: Matrix4, o: OpzioniForma & { uvScala?: number }): void {
    const gg = g.index ? g.toNonIndexed() : g;
    if (!gg.getAttribute('normal')) gg.computeVertexNormals();
    const pos = gg.getAttribute('position');
    const nor = gg.getAttribute('normal');
    const uv = gg.getAttribute('uv');
    _m3.getNormalMatrix(m);
    const specchio = m.determinant() < 0;
    const k = o.uvScala ?? 1;
    const materia = o.materia ?? MATERIA.PIENA;
    for (let t = 0; t < pos.count; t += 3) {
      const ordine = specchio ? [0, 2, 1] : [0, 1, 2];
      for (const d of ordine) {
        const i = t + d;
        const p = new Vector3().fromBufferAttribute(pos, i).applyMatrix4(m);
        _n.fromBufferAttribute(nor, i).applyMatrix3(_m3).normalize();
        const u = uv ? uv.getX(i) * k : 0;
        const v = uv ? uv.getY(i) * k : 0;
        const c = typeof o.colore === 'function' ? rgb(o.colore(p, u, v)) : rgb(o.colore);
        const occ = typeof o.occlusione === 'function' ? o.occlusione(p, u, v) : o.occlusione ?? 0;
        this.vertice(p, _n, c, materia, u, v, occ);
      }
    }
    if (gg !== g) gg.dispose();
  }

  /** Unisce un altro costruttore trasformato da `m` (specchiando se serve). */
  unisci(altre: FormePrimoPiano, m: Matrix4 = new Matrix4()): void {
    _m3.getNormalMatrix(m);
    const specchio = m.determinant() < 0;
    const n = altre.pos.length / 3;
    for (let t = 0; t < n; t += 3) {
      const ordine = specchio ? [0, 2, 1] : [0, 1, 2];
      for (const d of ordine) {
        const i = t + d;
        _a.set(altre.pos[i * 3]!, altre.pos[i * 3 + 1]!, altre.pos[i * 3 + 2]!).applyMatrix4(m);
        _n.set(altre.nor[i * 3]!, altre.nor[i * 3 + 1]!, altre.nor[i * 3 + 2]!).applyMatrix3(_m3).normalize();
        this.pos.push(_a.x, _a.y, _a.z);
        this.nor.push(_n.x, _n.y, _n.z);
        this.col.push(altre.col[i * 4]!, altre.col[i * 4 + 1]!, altre.col[i * 4 + 2]!, altre.col[i * 4 + 3]!);
        this.pp.push(altre.pp[i * 3]!, altre.pp[i * 3 + 1]!, altre.pp[i * 3 + 2]!);
      }
    }
  }

  costruisci(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(this.nor), 3));
    g.setAttribute('aColor', new BufferAttribute(new Float32Array(this.col), 4));
    g.setAttribute('aPP', new BufferAttribute(new Float32Array(this.pp), 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
