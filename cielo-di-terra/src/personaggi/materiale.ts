/**
 * Il materiale dei personaggi generati: la variante «con texture e skinning» del materiale del mondo
 * (src/render/worldMaterial.ts), così i personaggi prendono la stessa luce della Linea, la stessa
 * foschia a quinte, le lampade di notte e, nelle celle non rilevate, la stessa resa a matita: non
 * sembrano incollati sopra il paesaggio.
 *
 * Usa gli uniform del mondo PER RIFERIMENTO (`{ ...game.uniforms }`: gli oggetti `{ value }` sono gli
 * stessi, aggiornarli nel motore aggiorna anche i personaggi) più alcuni uniform propri:
 *   uMappa (texture dipinta, valori sRGB «da pittore», nessuna decodifica), uTinta (varianti dei
 *   velati), uOnda (x = ampiezza dell'ondeggio dell'orlo in m, y = tempo, z = quanto cammina),
 *   uRiempimento (riempimento freddo dal cielo di giorno e di notte, condiviso: RIEMPIMENTO),
 *   uSagoma (0 vicino, 1 dal LOD1 in là: la sagoma si scurisce sul bordo e si legge da lontano),
 *   uTavolozza / uSposta (le varianti di colore PER REGIONE dei velati generici: ogni colore della
 *   tavolozza del modello, cioè velo, giacca, gonna, grembiule..., gira di tinta, saturazione e luce).
 *
 * Di notte i colori caldi non devono brillare: l'albedo va verso la sua luminanza tinta dal cielo
 * (metà, con uNight), il riempimento notturno è basso e il controluce c'è solo vicino alle lampade
 * (uLamps): il caldo lo danno le lampade di shadeLit, non il riempimento.
 *
 * Il materiale è a doppia faccia: l'interno delle vesti e dei veli (che si vede da seduti e dal basso)
 * ha il colore della stoffa, non un buco nero.
 *
 * PEZZI COMUNI USATI (src/render/shaders/common.ts), per nome, nello stesso ordine di worldMaterial.ts:
 *   WORLD_UNIFORMS_GLSL, NOISE_GLSL, LIGHT_GLSL, BRUSH_GLSL, PENCIL_GLSL
 * e le funzioni GLSL:
 *   shadeLit(albedo, N, P, out tone)   luce della Linea + ambiente + lampade
 *   applyHazeK(col, P, dist, k)        foschia a quinte e bagliore della Linea
 *   paintState(P, thetaDeg, dist)      stato dipinto/matita della cella (PaintInfo: paint, blank, ink, wet, bleed)
 *   pencilColor(uv, N, V, tone, hgt, dist, blank, steep, inked)   resa a matita
 *   tangentUV(P, N), brushStrokes(uv, dist), vnoise3(p), cylUp(P), cylThetaDeg(P)   (uR è un uniform)
 * Se il rifacimento grafico cambia una di queste firme o l'ordine dei pezzi, va adattato solo
 * `sorgenteFrammento` qui sotto (il corpo segue quello della variante 'object' di worldMaterial.ts);
 * tools/personaggi/compila.html prova a compilarlo nel browser con i pezzi di un altro ramo.
 *
 * Senza gli uniform del mondo (pagina di prova, banco in Node) si usa un toon a tre campiture con le
 * luci della scena, come gli abitanti procedurali.
 */
import * as THREE from 'three';
import type { WorldUniforms } from '../render/uniforms';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from '../render/shaders/common';

/** I pezzi GLSL comuni, nell'ordine in cui vanno inclusi (come in worldMaterial.ts). */
export const PEZZI_COMUNI = [NOISE_GLSL, LIGHT_GLSL, BRUSH_GLSL, PENCIL_GLSL] as const;

/** Quanti colori ha al più la tavolozza di un modello (variante per regione). */
export const COLORI_TAVOLOZZA = 8;

const VERTICE = /* glsl */ `
#include <skinning_pars_vertex>
attribute float aOrlo;
uniform vec4 uOnda;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
void main() {
  vec3 objectNormal = normal;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vec3 transformed = position;
  #include <skinning_vertex>
  // l'orlo di gonne e vesti ondeggia appena (aOrlo: 0 sopra il ginocchio, 1 all'orlo), di più nel passo
  if (aOrlo > 0.0) {
    float a = uOnda.x * aOrlo * (0.45 + 0.55 * uOnda.z);
    float ang = atan(transformed.x, transformed.z);
    float onda = sin(uOnda.y * (1.3 + 1.6 * uOnda.z) + ang * 3.0) + 0.5 * sin(uOnda.y * 2.9 - ang * 5.0);
    transformed.xz += normalize(transformed.xz + 1e-4) * a * onda;
    transformed.y += a * 0.3 * onda;
  }
  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorldPos = wp.xyz;
  vNormalW = normalize(transpose(inverse(mat3(modelMatrix))) * objectNormal);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

/**
 * Il frammento, costruito dai pezzi comuni: così si può provare (e adattare) con un'altra versione di
 * common.ts senza toccare il resto (vedi tools/personaggi/compila.html).
 */
export function sorgenteFrammento(uniformMondo: string = WORLD_UNIFORMS_GLSL, pezzi: readonly string[] = PEZZI_COMUNI): string {
  return /* glsl */ `
${uniformMondo}
uniform float uBrush;
uniform sampler2D uMappa;
uniform vec3 uTinta;
uniform vec2 uRiempimento;
uniform float uSagoma;
uniform vec3 uTavolozza[${COLORI_TAVOLOZZA}];
uniform vec3 uSposta[${COLORI_TAVOLOZZA}];
uniform float uVaria;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
${pezzi.join('\n')}
vec3 rgbHsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-6)), d / (q.x + 1e-6), q.x);
}
vec3 hsvRgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
// la variante per regione: il colore della tavolozza più vicino decide di quanto girare (velo, giacca, gonna...)
vec3 variaColore(vec3 c) {
  float bd = 1e9;
  vec3 s = vec3(0.0, 1.0, 1.0);
  for (int i = 0; i < ${COLORI_TAVOLOZZA}; i++) {
    vec3 d = c - uTavolozza[i];
    float dd = dot(d, d);
    if (dd < bd) {
      bd = dd;
      s = uSposta[i];
    }
  }
  vec3 h = rgbHsv(c);
  h.x = fract(h.x + s.x);
  h.y = clamp(h.y * s.y, 0.0, 1.0);
  h.z = clamp(h.z * s.z, 0.0, 1.0);
  return hsvRgb(h);
}
void main() {
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);
  // la normale si gira solo se guarda dalla parte opposta della superficie che si vede (l'interno di
  // vesti e veli). NON con gl_FrontFacing: i modelli generati hanno qua e là facce con l'avvolgimento
  // al contrario ma la normale giusta, e girandole venivano macchie scure (la schiena del cappuccio)
  vec3 Ng = normalize(cross(dFdx(P), dFdy(P)));
  if (dot(Ng, V) < 0.0) Ng = -Ng;
  if (dot(N, Ng) < 0.0) N = -N;
  vec2 suv = tangentUV(P, N);
  // la texture dipinta è già in sRGB «da pittore», come aColor del mondo
  vec3 albedo = texture2D(uMappa, vUv).rgb;
  if (uVaria > 0.5) albedo = variaColore(albedo);
  albedo *= uTinta;
  // di notte i colori caldi non brillano: metà verso la luminanza, tinta dal cielo notturno
  float luma = dot(albedo, vec3(0.299, 0.587, 0.114));
  vec3 cielo = uAmbTop / max(dot(uAmbTop, vec3(0.299, 0.587, 0.114)), 0.05);
  albedo = mix(albedo, luma * cielo * 0.85, 0.5 * uNight);
  // la stessa variazione pittorica a bassa frequenza del mondo, pennellata più leggera (la texture ha già la sua)
  float big = vnoise3(P * 0.0045) - 0.5;
  albedo *= 1.0 + big * 0.1;
  albedo *= 1.0 + brushStrokes(suv * 3.0, dist) * 0.1 * uBrush;
  albedo = mix(albedo, albedo * vec3(1.05, 0.98, 0.9), clamp(big * 2.0 + 0.5, 0.0, 1.0) * 0.3);
  float tone;
  vec3 col = shadeLit(albedo, N, P, tone);
  // bordo dipinto: le campiture viste di taglio si scuriscono appena (un filo di più che nel mondo: la sagoma si
  // stacca); da lontano (uSagoma) di più e più largo, così la figura non è una macchia bruna sul selciato
  float rimD = 1.0 - abs(dot(N, V));
  col *= 1.0 - smoothstep(mix(0.7, 0.5, uSagoma), 1.0, rimD) * (0.16 + 0.14 * uSagoma) * (1.0 - 0.5 * uNight);
  // un personaggio si legge sempre, come nei bozzetti (anche di notte, in blu-viola): riempimento freddo
  // dal cielo sulle superfici in piedi e, di notte e solo vicino alle lampade, un filo di controluce sulla sagoma
  col += albedo * uAmbTop * mix(uRiempimento.x, uRiempimento.y, uNight);
  float lampade = 0.0;
  for (int i = 0; i < 8; i++) lampade = max(lampade, uLamps[i].w * (1.0 - smoothstep(2.0, 7.0, distance(P, uLamps[i].xyz))));
  col += uAmbTop * pow(rimD, 3.0) * 0.25 * uNight * clamp(lampade, 0.0, 1.0);
  float hazeK = 1.0;
#ifndef NO_PENCIL
  float th = cylThetaDeg(P);
  PaintInfo pi = paintState(P, th, dist);
  hazeK = mix(0.72, 1.0, pi.paint);
  if (pi.paint < 0.999) {
    float hgt = uR - length(P.xy);
    float steep = 1.0 - smoothstep(0.35, 0.8, abs(dot(N, cylUp(P))));
    vec3 pc = pencilColor(suv, N, V, tone, hgt, dist, pi.blank, steep, pi.wet + pi.bleed * 0.6);
    pc = mix(pc, mix(col, vec3(0.965, 0.918, 0.815), 0.3), pi.bleed * 0.75);
    col = mix(pc, col, pi.paint);
  }
  col = mix(col, col * vec3(0.78, 0.8, 0.86), pi.wet * pi.paint * 0.6);
  col = mix(col, vec3(0.2, 0.17, 0.26), clamp(pi.ink, 0.0, 1.0) * 0.85);
#endif
  col = applyHazeK(col, P, dist, hazeK);
  if (uDebugView > 0.5) col = N * 0.5 + 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;
}

/** Il vertice (skinning di three, ondeggio dell'orlo), per le prove di compilazione. */
export const SORGENTE_VERTICE = VERTICE;

export interface OpzioniMaterialePersonaggio {
  /** la texture del colore del GLB (già con colorSpace giusto) */
  mappa: THREE.Texture | null;
  /** tinta moltiplicata sulla texture (varianti dei velati generici) */
  tinta?: THREE.ColorRepresentation;
  /** forza della pennellata del mondo sopra la texture (0..1, predefinito 0.5) */
  pennellata?: number;
  /** escludi dalla resa a matita (mai: i personaggi stanno nel mondo come tutto il resto) */
  senzaMatita?: boolean;
  /**
   * seme della variante di colore per regione (solo i velati generici; 0 = nessuna): serve la tavolozza
   * del modello (`tavolozza`, colori sRGB 0..1 dall'indice)
   */
  variante?: number;
  tavolozza?: readonly (readonly number[])[];
}

/**
 * Riempimento freddo dal cielo, condiviso da tutti i personaggi (x di giorno, y di notte): le superfici
 * in piedi prendono poco cielo nel materiale del mondo e di notte i vestiti scuri diventerebbero sagome
 * nere; ma basso, perché di notte il caldo lo danno le lampade e non deve brillare.
 */
export const RIEMPIMENTO = new THREE.Vector2(0.1, 0.3);

/**
 * Gli spostamenti di colore di una variante (seme), uno per colore della tavolozza: x = giro di tinta
 * (frazione di giro), y e z = moltiplicatori di saturazione e luce.
 *
 * Uno spostamento di tutta la figura (tinta ±20°, saturazione ±15%, luce ±12%) più uno piccolo per
 * STOFFA (±8°, ±8%, ±6%). Le stoffe si riconoscono nella tavolozza: colori con la tinta entro 0,04 di
 * giro e la luce entro 0,12 (o tutti e due quasi grigi) sono la stessa stoffa e prendono lo stesso
 * spostamento. Con uno spostamento indipendente per ogni colore il chiaro e lo scuro della stessa gonna
 * giravano in due tinte diverse e la gonna veniva a chiazze, come una mimetica.
 */
export function spostamentiVariante(seme: number, tavolozza?: readonly (readonly number[])[]): THREE.Vector3[] {
  let s = (seme ^ 0x9e3779b9) >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const tutto = new THREE.Vector3(((r() * 2 - 1) * 20) / 360, (r() * 2 - 1) * 0.15, (r() * 2 - 1) * 0.12);
  const nuovo = () => new THREE.Vector3(tutto.x + ((r() * 2 - 1) * 8) / 360, 1 + tutto.y + (r() * 2 - 1) * 0.08, 1 + tutto.z + (r() * 2 - 1) * 0.06);
  const hsl = { h: 0, s: 0, l: 0 };
  const stoffe: { h: number; l: number; grigio: boolean; v: THREE.Vector3 }[] = [];
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < COLORI_TAVOLOZZA; i++) {
    const c = tavolozza?.[i];
    if (!c || c.length < 3) {
      out.push(nuovo());
      continue;
    }
    new THREE.Color(c[0], c[1], c[2]).getHSL(hsl);
    const grigio = hsl.s < 0.12 || hsl.l < 0.08;
    const dh = (h: number) => Math.min(Math.abs(h - hsl.h), 1 - Math.abs(h - hsl.h));
    const stessa = stoffe.find((x) => x.grigio === grigio && Math.abs(x.l - hsl.l) < 0.12 && (grigio || dh(x.h) < 0.04));
    if (stessa) out.push(stessa.v.clone());
    else {
      const v = nuovo();
      stoffe.push({ h: hsl.h, l: hsl.l, grigio, v });
      out.push(v.clone());
    }
  }
  return out;
}

/** Uniform propri di un materiale del mondo per i personaggi. */
export interface UniformPersonaggio {
  uMappa: { value: THREE.Texture | null };
  uTinta: { value: THREE.Color };
  uOnda: { value: THREE.Vector4 };
  uBrush: { value: number };
  /** riempimento freddo dal cielo: x di giorno, y di notte (frazione di uAmbTop sull'albedo) */
  uRiempimento: { value: THREE.Vector2 };
  /** 0 vicino, 1 lontano (LOD1 e oltre): bordo più scuro */
  uSagoma: { value: number };
  /** variante per regione: tavolozza del modello, spostamenti per colore, accesa (1) o no (0) */
  uTavolozza: { value: THREE.Vector3[] };
  uSposta: { value: THREE.Vector3[] };
  uVaria: { value: number };
}

/** La tavolozza (sempre COLORI_TAVOLOZZA voci: quelle mancanti lontanissime) e gli spostamenti di una variante. */
function uniformVariante(opz: OpzioniMaterialePersonaggio): Pick<UniformPersonaggio, 'uTavolozza' | 'uSposta' | 'uVaria'> {
  const tav: THREE.Vector3[] = [];
  for (let i = 0; i < COLORI_TAVOLOZZA; i++) {
    const c = opz.tavolozza?.[i];
    tav.push(c && c.length >= 3 ? new THREE.Vector3(c[0], c[1], c[2]) : new THREE.Vector3(9, 9, 9));
  }
  const attiva = !!opz.variante && !!opz.tavolozza?.length;
  return {
    uTavolozza: { value: tav },
    uSposta: { value: attiva ? spostamentiVariante(opz.variante as number, opz.tavolozza) : tav.map(() => new THREE.Vector3(0, 1, 1)) },
    uVaria: { value: attiva ? 1 : 0 },
  };
}

/** Il materiale del mondo con texture e skinning (uno per personaggio: tinta e ondeggio sono suoi). */
export function creaMaterialeMondo(u: WorldUniforms, opz: OpzioniMaterialePersonaggio): THREE.ShaderMaterial {
  const propri: UniformPersonaggio = {
    uMappa: { value: opz.mappa },
    uTinta: { value: new THREE.Color(opz.tinta ?? 0xffffff) },
    uOnda: { value: new THREE.Vector4(0, 0, 0, 0) },
    uBrush: { value: opz.pennellata ?? 0.5 },
    uRiempimento: { value: RIEMPIMENTO },
    uSagoma: { value: 0 },
    ...uniformVariante(opz),
  };
  const defines: Record<string, string> = {};
  if (opz.senzaMatita) defines['NO_PENCIL'] = '';
  const m = new THREE.ShaderMaterial({
    name: 'personaggio-mondo',
    // gli uniform del mondo per riferimento: lo spread copia gli oggetti { value }, non i valori
    uniforms: { ...u, ...propri },
    vertexShader: VERTICE,
    fragmentShader: sorgenteFrammento(),
    defines,
    // l'interno delle vesti e dei veli ha il colore della stoffa (N si gira nel frammento)
    side: THREE.DoubleSide,
  });
  m.userData['personaggio'] = 'mondo';
  return m;
}

/** Rampa del toon di ripiego: tre campiture con passaggi morbidi (coordinata = N·L·0.5+0.5). */
let rampa: THREE.DataTexture | null = null;
export function rampaToni(): THREE.DataTexture {
  if (rampa) return rampa;
  const n = 64;
  const dati = new Uint8Array(n * 4);
  const livelli = [0.5, 0.78, 1.0];
  const soglie = [0.46, 0.64];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let v = livelli[0] as number;
    for (let k = 0; k < soglie.length; k++) {
      const s = soglie[k] as number;
      v += ((livelli[k + 1] as number) - (livelli[k] as number)) * THREE.MathUtils.smoothstep(x, s - 0.06, s + 0.06);
    }
    const b = Math.round(v * 255);
    dati.set([b, b, b, 255], i * 4);
  }
  rampa = new THREE.DataTexture(dati, n, 1, THREE.RGBAFormat);
  rampa.minFilter = THREE.LinearFilter;
  rampa.magFilter = THREE.LinearFilter;
  rampa.generateMipmaps = false;
  rampa.needsUpdate = true;
  return rampa;
}

/** Il toon di ripiego (servono luci nella scena: la regia ne mette per le figure). */
export function creaMaterialeToon(opz: OpzioniMaterialePersonaggio): THREE.MeshToonMaterial {
  const m = new THREE.MeshToonMaterial({ map: opz.mappa, color: new THREE.Color(opz.tinta ?? 0xffffff), gradientMap: rampaToni(), side: THREE.DoubleSide });
  m.name = 'personaggio-toon';
  m.userData['personaggio'] = 'toon';
  // la faccia «di dietro» si decide con la normale geometrica, come nel materiale del mondo (vedi sopra):
  // le facce con l'avvolgimento al contrario dei modelli generati non diventano macchie scure
  m.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
#ifdef DOUBLE_SIDED
{
  vec3 ng = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
  if (dot(ng, vViewPosition) < 0.0) ng = -ng;
  vec3 nv = normalize(vNormal);
  normal = dot(nv, ng) < 0.0 ? -nv : nv;
}
#endif`,
    );
  };
  m.customProgramCacheKey = () => 'personaggio-toon-fronte';
  return m;
}

/** Il materiale giusto: del mondo se ci sono gli uniform del motore, altrimenti il toon. */
export function creaMaterialePersonaggio(u: WorldUniforms | null, opz: OpzioniMaterialePersonaggio): THREE.Material {
  return u ? creaMaterialeMondo(u, opz) : creaMaterialeToon(opz);
}

/** Il livello di dettaglio mostrato (0 vicino; 1, 2 lontano): la sagoma si scurisce sul bordo da lontano. */
export function aggiornaVariante(m: THREE.Material, livello: number): void {
  const u = (m as THREE.ShaderMaterial).uniforms as Partial<UniformPersonaggio> | undefined;
  if (u?.uSagoma) u.uSagoma.value = livello >= 1 ? 1 : 0;
}

/** Aggiorna l'ondeggio dell'orlo (se il materiale è quello del mondo): ampiezza in m, tempo, passo 0..1. */
export function aggiornaOnda(m: THREE.Material, ampiezza: number, tempo: number, passo: number): void {
  const u = (m as THREE.ShaderMaterial).uniforms as Partial<UniformPersonaggio> | undefined;
  if (u?.uOnda) u.uOnda.value.set(ampiezza, tempo, passo, 0);
}
