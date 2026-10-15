/**
 * Materiali della vegetazione (traccia «natura»): chiome, tronchi, erba, sottobosco e le masse
 * dei boschi lontani. Stesso modello di luce, stessa matita e stessa foschia del materiale del
 * mondo (`worldMaterial.ts`: usano gli stessi pezzi GLSL), più:
 * - il vento (`uVento`, condiviso da tutti: vedi `ventoCondiviso`);
 * - la comparsa e la scomparsa con la distanza (`uSfuma`, per materiale: i livelli di dettaglio
 *   si passano il testimone retinando, il filtro pittorico della post ammorbidisce la retinatura);
 * - la chioma dipinta (`chiomaDipinta` in shaders/natura.ts).
 *
 * Attributi (oltre a position e normal):
 * - `aColor` (vec4, per vertice), secondo il tipo:
 *     chioma:     r = occlusione propria (1 = in luce), g = quanto è sul bordo della chioma,
 *                 b = libero, a = valore della massa (sceglie il colore principale o il secondario)
 *     tronco:     rgb = corteccia, a = libero
 *     erba:       rgb = moltiplicatore (base scura, punta chiara), a = punta (0 base, 1 punta)
 *     sottobosco: rgb = colore, a = flessione nel vento (0 rigido, 1 morbido)
 *     bosco:      rgb = colore della massa, a = copertura (sotto 0.5 non si disegna)
 * - per istanza (InstancedMesh): `aTint` (vec4: rgb = colore o moltiplicatore, a = seme) e, per
 *   le chiome, `aTint2` (vec4: rgb = colore secondario, a = quota di masse col secondario).
 */
import { DoubleSide, FrontSide, ShaderMaterial, Vector4, type Side } from 'three';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import { CHIOMA_GLSL, DIPINTO_GLSL, ERBA_GLSL, NATURA_UNIFORMS_GLSL, SFUMA_GLSL, VENTO_GLSL } from './shaders/natura';
import { TERRENO_GLSL } from './shaders/terreno';
import { SUPERFICI_BASE_GLSL, SUPERFICI_GLSL } from './superfici';
import type { WorldUniforms } from './uniforms';

export type TipoNatura = 'chioma' | 'tronco' | 'erba' | 'sottobosco' | 'bosco';

export interface OpzioniNatura {
  tipo: TipoNatura;
  /** comparsa (da, a) e scomparsa (da, a) con la distanza, in metri; 0 = niente */
  sfuma?: [number, number, number, number];
  /** tipo di superficie (valore di SUPERFICIE) per il sottobosco: 6 fogliame, 11 roccia, 5 corteccia… */
  superficie?: number;
  /** flessione nel vento (moltiplica la forza): chiome ~1, tronchi ~1 (stessa curva), erba ~1 */
  flessione?: number;
  side?: Side;
  /** fuori dal passaggio matita/colore (sempre dipinto) */
  noPencil?: boolean;
}

/** Il vento condiviso da tutti i materiali della vegetazione (x forza, y raffiche, zw direzione est/nord). */
export const ventoCondiviso = { value: new Vector4(0.6, 0.7, 0.35, 0.94) };

const VERT = /* glsl */ `
attribute vec4 aColor;
#ifdef USE_INSTANCING
attribute vec4 aTint;
#ifdef CHIOMA
attribute vec4 aTint2;
#endif
#endif
uniform float uTime;
uniform float uFlessione;
${NATURA_UNIFORMS_GLSL}
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vAlbedo;
varying vec4 vInfo;   // x = seme, y = occlusione, z = bordo/punta, w = visibilità (retinatura)
vec3 cylUp(vec3 P) {
  float r = length(P.xy);
  return r > 1e-3 ? vec3(-P.xy / r, 0.0) : vec3(0.0, 1.0, 0.0);
}
${VENTO_GLSL}
${SFUMA_GLSL}
void main() {
  vec4 lp = vec4(position, 1.0);
  vec3 n = normal;
  vec3 tint = vec3(1.0);
  float seme = 0.0;
  vec3 origine = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float scalaY = 1.0;
#ifdef USE_INSTANCING
  tint = aTint.rgb;
  seme = aTint.a;
  lp = instanceMatrix * lp;
  mat3 im = mat3(instanceMatrix);
  n = inverse(transpose(im)) * n;
  origine = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  scalaY = length(im[1]);
#endif
  vec4 wp = modelMatrix * lp;
  vec3 nW = normalize(mat3(modelMatrix) * n);
  // quota sopra la base dell'istanza (m)
  float alto = max(position.y * scalaY, 0.0);
#if defined(CHIOMA)
  vec3 c2 = aTint2.rgb;
  float f = smoothstep(aTint2.a - 0.09, aTint2.a + 0.09, aColor.a);
  vAlbedo = mix(c2, tint, f);
  vInfo = vec4(seme, aColor.r, aColor.g, 1.0);
  wp.xyz += vento(origine, alto, uFlessione * 0.0022, seme);
  // tremolio delle foglie: piccolo, lungo la normale
  wp.xyz += nW * sin(uTime * 7.0 + dot(wp.xyz, vec3(1.7, 2.3, 1.9)) + seme * 20.0) * 0.035 * uVento.x;
#elif defined(TRONCO)
  vAlbedo = aColor.rgb * tint;
  vInfo = vec4(seme, 1.0, 0.0, 1.0);
  wp.xyz += vento(origine, alto, uFlessione * 0.0022, seme);
#elif defined(ERBA)
  vAlbedo = tint * aColor.rgb;
  vInfo = vec4(seme, 1.0, aColor.a, 1.0);
  wp.xyz += vento(wp.xyz, aColor.a, uFlessione * 0.55, seme + dot(wp.xyz, vec3(0.13, 0.17, 0.11)));
#elif defined(SOTTOBOSCO)
  vAlbedo = aColor.rgb * tint;
  vInfo = vec4(seme, 1.0, aColor.a, 1.0);
  wp.xyz += vento(origine, alto, uFlessione * 0.12 * aColor.a, seme);
#else
  // BOSCO: masse lontane, niente vento
  vAlbedo = aColor.rgb;
  vInfo = vec4(0.0, 1.0, aColor.a, 1.0);
#endif
  vWorldPos = wp.xyz;
  vNormalW = nW;
#ifdef BOSCO
  vInfo.w = sfumaDistanza(distance(cameraPosition, wp.xyz));
#else
  vInfo.w = sfumaDistanza(distance(cameraPosition, origine));
#endif
  // completamente sparito: la geometria si chiude in un punto (niente frammenti da scartare)
  if (vInfo.w <= 0.0) wp.xyz = origine;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
uniform float uSuperficieBase;
${NATURA_UNIFORMS_GLSL}
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vAlbedo;
varying vec4 vInfo;
${NOISE_GLSL}
${LIGHT_GLSL}
${BRUSH_GLSL}
${SUPERFICI_BASE_GLSL}
${TERRENO_GLSL}
${SUPERFICI_GLSL}
${PENCIL_GLSL}
${CHIOMA_GLSL}
${ERBA_GLSL}
${DIPINTO_GLSL}
void main() {
  // retinatura del passaggio fra livelli di dettaglio (stabile sullo schermo)
  if (vInfo.w < 0.999 && vInfo.w < hash12(floor(gl_FragCoord.xy) + 0.37)) discard;
#ifdef BOSCO
  // le masse dei boschi lontani: si disegnano solo dove il bosco copre davvero
  if (vInfo.z < 0.5) discard;
#endif
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-4);
  float pix = max(dist, 0.3) * uPixelAngle;
  float pixW = max(pix, min(sqrt(length(dFdx(P)) * length(dFdy(P))), pix * 8.0));
  vec3 up = cylUp(P);
  Sup s = supBase(vAlbedo, N);
  vec2 suv = cylDominantUV(P, N);
  // variazione pittorica a bassa frequenza (come il materiale del mondo)
  float big = vnoise3(P * 0.0045) - 0.5;
  s.albedo *= 1.0 + big * 0.12;
#if defined(CHIOMA)
  s.ao = vInfo.y;
  chiomaDipinta(s, P, N, up, pixW, vInfo.x, vInfo.z);
#elif defined(TRONCO)
  applicaSuperficie(s, 5.0, fract(vInfo.x * 7.0) * 0.9, P, N, pixW);
  s.bande = 0.55;
#elif defined(ERBA)
  erbaDipinta(s, P, pixW, vInfo.z);
#elif defined(SOTTOBOSCO)
  float tipo = floor(uSuperficieBase + 1e-3);
  if (tipo > 5.5 && tipo < 6.5) {
    chiomaDipinta(s, P, N, up, pixW, vInfo.x, 0.6 + 0.4 * vInfo.z);
    s.trasm = 0.8;
  } else if (tipo > 11.5 && tipo < 12.5) {
    erbaDipinta(s, P, pixW, vInfo.z);
  } else {
    applicaSuperficie(s, tipo, fract(vInfo.x * 7.0) * 0.9, P, N, pixW);
  }
#else
  // BOSCO: chiome lontane come masse dipinte (ciuffi grandi: una cella = un albero)
  {
    vec3 rel;
    vec3 vo = voronoi3(P / 4.2, rel);
    float vis = visMotivo(pixW, 9.0);
    vec3 nb = normalize(s.N - rel * 1.3);
    s.N = normalize(mix(s.N, nb, 0.75 * vis));
    float gap = (1.0 - smoothstep(0.03, 0.26, vo.x)) * vis;
    // ogni albero col suo colore d'ottobre: verde, oro, ruggine
    float t = vo.z;
    vec3 c = s.albedo;
    c = mix(c, c * vec3(1.32, 1.08, 0.62), smoothstep(0.62, 0.8, t) * 0.75);
    c = mix(c, c * vec3(1.22, 0.78, 0.5), smoothstep(0.86, 0.96, t) * 0.8);
    c = mix(c, c * vec3(0.82, 0.95, 0.9), smoothstep(0.3, 0.1, t) * 0.5);
    c *= 1.0 - gap * 0.38;
    s.albedo = c;
    s.ao *= 1.0 - gap * 0.5;
    s.trasm = 0.6;
    s.bordo = 0.5;
    s.bande = 0.5;
  }
#endif
  float tone;
  vec3 col = shadeSup(s, N, P, V, tone);
  col = dipintoNatura(col, P, N, V, dist, tone, suv);
  if (uDebugView > 0.5) col = N * 0.5 + 0.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DEFINES: Record<TipoNatura, string> = {
  chioma: 'CHIOMA',
  tronco: 'TRONCO',
  erba: 'ERBA',
  sottobosco: 'SOTTOBOSCO',
  bosco: 'BOSCO',
};

/** Crea un materiale della vegetazione (vedi l'intestazione del file per gli attributi). */
export function creaMaterialeNatura(u: WorldUniforms, opz: OpzioniNatura): ShaderMaterial {
  const defines: Record<string, string> = { [DEFINES[opz.tipo]]: '' };
  if (opz.noPencil) defines.NO_PENCIL = '';
  const sf = opz.sfuma ?? [0, 0, 0, 0];
  const mat = new ShaderMaterial({
    name: `natura-${opz.tipo}`,
    uniforms: {
      ...u,
      uVento: ventoCondiviso,
      uSfuma: { value: new Vector4(sf[0], sf[1], sf[2], sf[3]) },
      uFlessione: { value: opz.flessione ?? 1 },
      uSuperficieBase: { value: opz.superficie ?? 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side: opz.side ?? (opz.tipo === 'erba' ? DoubleSide : FrontSide),
  });
  (mat.defaultAttributeValues as Record<string, number[]>)['aTint'] = [1, 1, 1, 0];
  (mat.defaultAttributeValues as Record<string, number[]>)['aTint2'] = [1, 1, 1, 0];
  return mat;
}

/** Cambia la comparsa/scomparsa con la distanza di un materiale della vegetazione. */
export function impostaSfuma(mat: ShaderMaterial, da0: number, a0: number, da1: number, a1: number): void {
  const s = mat.uniforms['uSfuma'];
  if (s) (s.value as Vector4).set(da0, a0, da1, a1);
}
