/**
 * Il materiale dei personaggi generati: la variante «con texture e skinning» del materiale del mondo
 * (src/render/worldMaterial.ts), così i personaggi prendono la stessa luce della Linea, la stessa
 * foschia a quinte, le lampade di notte e, nelle celle non rilevate, la stessa resa a matita: non
 * sembrano incollati sopra il paesaggio.
 *
 * Usa gli uniform del mondo PER RIFERIMENTO (`{ ...game.uniforms }`: gli oggetti `{ value }` sono gli
 * stessi, aggiornarli nel motore aggiorna anche i personaggi) più tre uniform propri:
 *   uMappa (texture dipinta, valori sRGB «da pittore», nessuna decodifica), uTinta (varianti dei
 *   velati), uOnda (x = ampiezza dell'ondeggio dell'orlo in m, y = tempo, z = quanto cammina),
 *   uRiempimento (riempimento freddo dal cielo di giorno e di notte, condiviso: RIEMPIMENTO).
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
 * FRAMMENTO qui sotto (il corpo segue quello della variante 'object' di worldMaterial.ts).
 *
 * Senza gli uniform del mondo (pagina di prova, banco in Node) si usa un toon a tre campiture con le
 * luci della scena, come gli abitanti procedurali.
 */
import * as THREE from 'three';
import type { WorldUniforms } from '../render/uniforms';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from '../render/shaders/common';

/** I pezzi GLSL comuni, nell'ordine in cui vanno inclusi (come in worldMaterial.ts). */
export const PEZZI_COMUNI = [NOISE_GLSL, LIGHT_GLSL, BRUSH_GLSL, PENCIL_GLSL] as const;

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

const FRAMMENTO = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
uniform float uBrush;
uniform sampler2D uMappa;
uniform vec3 uTinta;
uniform vec2 uRiempimento;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv;
${PEZZI_COMUNI.join('\n')}
void main() {
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);
  vec2 suv = tangentUV(P, N);
  // la texture dipinta è già in sRGB «da pittore», come aColor del mondo
  vec3 albedo = texture2D(uMappa, vUv).rgb * uTinta;
  // la stessa variazione pittorica a bassa frequenza del mondo, pennellata più leggera (la texture ha già la sua)
  float big = vnoise3(P * 0.0045) - 0.5;
  albedo *= 1.0 + big * 0.1;
  albedo *= 1.0 + brushStrokes(suv * 3.0, dist) * 0.1 * uBrush;
  albedo = mix(albedo, albedo * vec3(1.05, 0.98, 0.9), clamp(big * 2.0 + 0.5, 0.0, 1.0) * 0.3);
  float tone;
  vec3 col = shadeLit(albedo, N, P, tone);
  // bordo dipinto: le campiture viste di taglio si scuriscono appena (un filo di più che nel mondo: la sagoma si stacca)
  float rimD = 1.0 - abs(dot(N, V));
  col *= 1.0 - smoothstep(0.7, 1.0, rimD) * 0.16 * (1.0 - uNight);
  // un personaggio si legge sempre, come nei bozzetti (anche di notte, in blu-viola): riempimento freddo
  // dal cielo sulle superfici in piedi e, di notte, un filo di controluce sulla sagoma
  col += albedo * uAmbTop * mix(uRiempimento.x, uRiempimento.y, uNight);
  col += uAmbTop * pow(rimD, 3.0) * uRiempimento.y * 0.35 * uNight;
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

export interface OpzioniMaterialePersonaggio {
  /** la texture del colore del GLB (già con colorSpace giusto) */
  mappa: THREE.Texture | null;
  /** tinta moltiplicata sulla texture (varianti dei velati generici) */
  tinta?: THREE.ColorRepresentation;
  /** forza della pennellata del mondo sopra la texture (0..1, predefinito 0.5) */
  pennellata?: number;
  /** escludi dalla resa a matita (mai: i personaggi stanno nel mondo come tutto il resto) */
  senzaMatita?: boolean;
}

/**
 * Riempimento freddo dal cielo, condiviso da tutti i personaggi (x di giorno, y di notte): le superfici
 * in piedi prendono poco cielo nel materiale del mondo e di notte i vestiti scuri diventano sagome nere.
 */
export const RIEMPIMENTO = new THREE.Vector2(0.1, 0.6);

/** Uniform propri di un materiale del mondo per i personaggi. */
export interface UniformPersonaggio {
  uMappa: { value: THREE.Texture | null };
  uTinta: { value: THREE.Color };
  uOnda: { value: THREE.Vector4 };
  uBrush: { value: number };
  /** riempimento freddo dal cielo: x di giorno, y di notte (frazione di uAmbTop sull'albedo) */
  uRiempimento: { value: THREE.Vector2 };
}

/** Il materiale del mondo con texture e skinning (uno per personaggio: tinta e ondeggio sono suoi). */
export function creaMaterialeMondo(u: WorldUniforms, opz: OpzioniMaterialePersonaggio): THREE.ShaderMaterial {
  const propri: UniformPersonaggio = {
    uMappa: { value: opz.mappa },
    uTinta: { value: new THREE.Color(opz.tinta ?? 0xffffff) },
    uOnda: { value: new THREE.Vector4(0, 0, 0, 0) },
    uBrush: { value: opz.pennellata ?? 0.5 },
    uRiempimento: { value: RIEMPIMENTO },
  };
  const defines: Record<string, string> = {};
  if (opz.senzaMatita) defines['NO_PENCIL'] = '';
  const m = new THREE.ShaderMaterial({
    name: 'personaggio-mondo',
    // gli uniform del mondo per riferimento: lo spread copia gli oggetti { value }, non i valori
    uniforms: { ...u, ...propri },
    vertexShader: VERTICE,
    fragmentShader: FRAMMENTO,
    defines,
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
  const m = new THREE.MeshToonMaterial({ map: opz.mappa, color: new THREE.Color(opz.tinta ?? 0xffffff), gradientMap: rampaToni() });
  m.name = 'personaggio-toon';
  m.userData['personaggio'] = 'toon';
  return m;
}

/** Il materiale giusto: del mondo se ci sono gli uniform del motore, altrimenti il toon. */
export function creaMaterialePersonaggio(u: WorldUniforms | null, opz: OpzioniMaterialePersonaggio): THREE.Material {
  return u ? creaMaterialeMondo(u, opz) : creaMaterialeToon(opz);
}

/** Aggiorna l'ondeggio dell'orlo (se il materiale è quello del mondo): ampiezza in m, tempo, passo 0..1. */
export function aggiornaOnda(m: THREE.Material, ampiezza: number, tempo: number, passo: number): void {
  const u = (m as THREE.ShaderMaterial).uniforms as Partial<UniformPersonaggio> | undefined;
  if (u?.uOnda) u.uOnda.value.set(ampiezza, tempo, passo, 0);
}
