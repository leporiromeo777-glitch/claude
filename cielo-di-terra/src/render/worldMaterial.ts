/**
 * Il materiale condiviso del mondo (terreno, edifici, alberi, nubi) e le sue varianti.
 *
 * Attributi di geometria attesi:
 * - `position`, `normal` (standard);
 * - `aColor` (vec4): rgb = albedo sRGB, a = extra
 *   (terreno: 1 = vetro di finestra da scartare; oggetti: emissione notturna 0..1);
 * - `aTint` (vec3, solo InstancedMesh, opzionale): moltiplica l'albedo per istanza.
 *
 * Varianti (defines): TERRAIN, OBJECT, CLOUD, NO_PENCIL, USE_TINT.
 */
import { FrontSide, ShaderMaterial, type Side } from 'three';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import type { WorldUniforms } from './uniforms';

export type WorldMaterialKind = 'terrain' | 'object' | 'cloud';

export interface WorldMaterialOptions {
  kind: WorldMaterialKind;
  /** Istanze con colore per istanza (`aTint`). */
  tint?: boolean;
  /** Escludi dal mondo a matita (es. nubi, lumi). */
  noPencil?: boolean;
  side?: Side;
  /** Forza della pennellata (0..1). */
  brush?: number;
}

const VERT = /* glsl */ `
attribute vec4 aColor;
#ifdef USE_TINT
attribute vec3 aTint;
#endif
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec4 vColor;
void main() {
  vec4 lp = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  mat3 im = mat3(instanceMatrix);
  n = inverse(transpose(im)) * n;
#endif
  vec4 wp = modelMatrix * lp;
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vColor = aColor;
#ifdef USE_TINT
  vColor.rgb *= aTint;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
uniform float uBrush;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec4 vColor;
${NOISE_GLSL}
${LIGHT_GLSL}
${BRUSH_GLSL}
${PENCIL_GLSL}
void main() {
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);
#ifdef TERRAIN
  if (vColor.a > 0.5) discard;
  vec2 suv = cylUV(P);
#else
  vec2 suv = tangentUV(P, N);
#endif
  vec3 albedo = vColor.rgb;
  // variazione pittorica a bassa frequenza e pennellata
  float big = vnoise3(P * 0.0045) - 0.5;
  albedo *= 1.0 + big * 0.14;
  float br = brushStrokes(suv, dist);
  albedo *= 1.0 + br * 0.16 * uBrush;
  // leggero viraggio caldo/freddo
  albedo = mix(albedo, albedo * vec3(1.05, 0.98, 0.9), clamp(big * 2.0 + 0.5, 0.0, 1.0) * 0.35);
  float tone;
#ifdef CLOUD
  // nubi: carta velina, ombre fredde, luce calda
  vec3 up = cylUp(P);
  vec3 Ld = lineaLightDir(P, up);
  float ndl = dot(N, Ld) * 0.5 + 0.5;
  float b = bandLight(ndl) * lineaReach(P);
  vec3 shadowC = mix(uAmbTop * 0.95, vec3(0.62, 0.66, 0.82), 0.5);
  vec3 col = albedo * mix(shadowC, uSunColor * (0.55 + 0.6 * uSunIntensity), b);
  float rimC = pow(1.0 - abs(dot(N, V)), 2.0);
  col = mix(col, uHazeColor * 1.05 + 0.08, rimC * 0.45);
  tone = 1.0;
#else
  vec3 col = shadeLit(albedo, N, P, tone);
  // bordo dipinto: le campiture viste di taglio si scuriscono appena
  float rimD = 1.0 - abs(dot(N, V));
  col *= 1.0 - smoothstep(0.75, 1.0, rimD) * 0.12;
#endif
  float hazeK = 1.0;
#ifndef NO_PENCIL
  float th = cylThetaDeg(P);
  vec3 ps = paintState(P, th, dist);
  hazeK = mix(0.5, 1.0, ps.x);
  if (ps.x < 0.999) {
    float hgt = uR - length(P.xy);
    vec3 pc = pencilColor(suv, N, V, tone, hgt, dist, ps.y);
    col = mix(pc, col, ps.x);
  }
  // linea d'inchiostro sul fronte della rivelazione
  col = mix(col, vec3(0.17, 0.14, 0.22), clamp(ps.z, 0.0, 1.0) * 0.8);
#endif
#ifdef OBJECT
  // finestre illuminate di notte (segnali vivi: restano a colori anche a matita)
  col = mix(col, uLampColor * 1.15, vColor.a * uNight);
#endif
  col = applyHazeK(col, P, dist, hazeK);
  if (uDebugView > 0.5) col = N * 0.5 + 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createWorldMaterial(u: WorldUniforms, opts: WorldMaterialOptions): ShaderMaterial {
  const defines: Record<string, string> = {};
  if (opts.kind === 'terrain') defines.TERRAIN = '';
  if (opts.kind === 'object') defines.OBJECT = '';
  if (opts.kind === 'cloud') {
    defines.CLOUD = '';
    defines.NO_PENCIL = '';
  }
  if (opts.noPencil) defines.NO_PENCIL = '';
  if (opts.tint) defines.USE_TINT = '';
  const mat = new ShaderMaterial({
    name: `world-${opts.kind}`,
    uniforms: { ...u, uBrush: { value: opts.brush ?? 1 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side: opts.side ?? FrontSide,
  });
  return mat;
}
