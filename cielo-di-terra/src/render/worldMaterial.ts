/**
 * Il materiale condiviso del mondo (terreno, edifici, alberi, nubi, abitanti) e le sue varianti.
 *
 * Attributi di geometria attesi:
 * - `position`, `normal` (standard);
 * - `aColor` (vec4): rgb = albedo sRGB, a = extra
 *   (terreno: 1 = vetro di finestra da scartare; oggetti: emissione notturna 0..1);
 * - `aSuperficie` (float o vec2, facoltativo): x = tipo di superficie + variante, y = occlusione
 *   ambientale cotta (vedi `render/superfici.ts`, enum `SUPERFICIE`). Se manca vale 0;
 * - `aTint` (vec3, solo InstancedMesh, opzionale): moltiplica l'albedo per istanza.
 * Le SkinnedMesh funzionano (ossa di three.js): servono `aColor` e, se si vuole, `aSuperficie`.
 *
 * Varianti (defines): TERRAIN, OBJECT, CLOUD, NO_PENCIL, USE_TINT (+ USE_INSTANCING, USE_SKINNING
 * messi da three.js).
 *
 * Uniform propri di ogni materiale: `uBrush` (forza della pennellata), `uSuperficieBase` (tipo di
 * superficie usato dove il vertice non ne dichiara uno; 0 = nessuno).
 */
import { DoubleSide, FrontSide, ShaderMaterial, Vector4, type Side } from 'three';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import { TERRENO_GLSL } from './shaders/terreno';
import { SUPERFICIE, SUPERFICI_BASE_GLSL, SUPERFICI_GLSL } from './superfici';
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
  /**
   * Tipo di superficie predefinito (valore di `SUPERFICIE`, + variante) dove il vertice non lo dice.
   * Predefinito: `SUPERFICIE.AUTO` per gli oggetti (motivo dedotto dal colore), NESSUNA per il resto.
   */
  superficie?: number;
  /** Costoloni delle Finestre: di giorno la stessa aria illuminata del vetro (render/windows.ts). */
  ariaVetro?: boolean;
}

const VERT = /* glsl */ `
attribute vec4 aColor;
attribute vec2 aSuperficie;
#ifdef USE_TINT
attribute vec3 aTint;
#endif
#include <skinning_pars_vertex>
// chiome instanziate: x = quanto la normale si piega verso quella di una sfera attorno al centro
// della chioma (ombreggiatura tonda e morbida), y = altezza del centro (unità locali), z =
// schiacciamento verticale della sfera (1 = sfera)
uniform vec4 uChioma;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec4 vColor;
varying vec2 vSup;
void main() {
  vec3 transformed = vec3(position);
  vec3 objectNormal = vec3(normal);
#ifdef USE_SKINNING
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <skinning_vertex>
#endif
  vec4 lp = vec4(transformed, 1.0);
  vec3 n = objectNormal;
#ifdef USE_INSTANCING
  lp = instanceMatrix * lp;
  mat3 im = mat3(instanceMatrix);
  n = inverse(transpose(im)) * n;
#endif
  vec4 wp = modelMatrix * lp;
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
#ifdef USE_INSTANCING
  if (uChioma.x > 0.0) {
    // normale "sferica" della chioma: la luce la gira come un unico volume morbido
    vec3 cc = (modelMatrix * instanceMatrix * vec4(0.0, uChioma.y, 0.0, 1.0)).xyz;
    vec3 ax = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * vec3(0.0, 1.0, 0.0));
    vec3 d = wp.xyz - cc;
    d += ax * dot(d, ax) * (uChioma.z - 1.0);
    vNormalW = normalize(mix(vNormalW, normalize(d), uChioma.x));
  }
#endif
  vColor = aColor;
  vSup = aSuperficie;
#ifdef USE_TINT
  vColor.rgb *= aTint;
#endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
uniform float uBrush;
uniform float uSuperficieBase;
uniform float uAriaVetro;   // 1 = costoloni delle Finestre: di giorno la stessa aria illuminata del vetro
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec4 vColor;
varying vec2 vSup;
${NOISE_GLSL}
${LIGHT_GLSL}
${BRUSH_GLSL}
${SUPERFICI_BASE_GLSL}
${TERRENO_GLSL}
${SUPERFICI_GLSL}
${PENCIL_GLSL}
void main() {
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
  if (!gl_FrontFacing) N = -N;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  // costoloni delle Finestre: da lontano spariscono (retinati fra 350 e 600 m). Nei bozzetti le
  // Finestre lontane sono cielo velato; i costoloni sopra il bastione facevano trattini chiari
  if (uAriaVetro > 0.5 && hash12(floor(gl_FragCoord.xy) + 0.71) < smoothstep(350.0, 600.0, dist)) discard;
  vec3 V = toCam / max(dist, 1e-4);
  // metri per pixel: isotropo (tratteggio stabile) e reale, con lo scorcio (motivi senza moiré)
  float pix = max(dist, 0.3) * uPixelAngle;
  // (media geometrica dei due assi: come un filtro anisotropo, il dettaglio resta anche di scorcio)
  float pixW = max(pix, min(sqrt(length(dFdx(P)) * length(dFdy(P))), pix * 8.0));
  Sup s = supBase(vColor.rgb, N);
#ifdef TERRAIN
  if (vColor.a > 0.5) discard;
  vec2 suv = cylDominantUV(P, N);
  // la pennellata del terreno la fa terrenoDipinto (tocchi ancorati al mondo)
  float br = 0.0;
#else
  vec3 tW;
  vec3 bW;
  vec2 suv = uvSuperficie(P, N, tW, bW);
  float br = brushStrokes(suv, dist);
#endif
  // variazione pittorica a bassa frequenza e pennellata
  float big = vnoise3(P * 0.0045) - 0.5;
  s.albedo *= 1.0 + big * 0.14;
  s.albedo *= 1.0 + br * 0.16 * uBrush;
  // leggero viraggio caldo/freddo
  s.albedo = mix(s.albedo, s.albedo * vec3(1.05, 0.98, 0.9), clamp(big * 2.0 + 0.5, 0.0, 1.0) * 0.35);
#ifdef TERRAIN
  terrenoDipinto(s, P, N, dist, pixW);
  // curvatura dal vertice (render/terrainMesh.ts): conche più scure, dossi più chiari (±12%)
  // (solo fino a qualche centinaio di metri: lontano, sui triangoli grandi, farebbe increspature)
  float curvT = clamp((vColor.a - 0.2235) / 0.2235, -1.0, 1.0) * (1.0 - smoothstep(300.0, 650.0, dist));
  s.albedo *= 1.0 - curvT * 0.12;
  s.ao *= 1.0 - max(curvT, 0.0) * 0.15;
#elif !defined(CLOUD)
  // vertice taggato (anche NESSUNA dichiarata = 0.5) oppure la superficie predefinita del materiale
  float tipoF = vSup.x > 0.25 ? vSup.x : uSuperficieBase;
  float tipo = floor(tipoF + 1e-3);
  float var = max(tipoF - tipo, 0.0);
  // AUTO: il tipo dal colore per vertice (oggetti non ancora taggati)
  if (tipo > 13.5 && tipo < 14.5) {
    // curvatura (1/m): quanto gira la normale per metro; > ~0.45 = forma tonda (tronchi, rami,
    // sassi lisci); i selciati che seguono il suolo restano sotto
    float curv = length(fwidth(N)) / max(length(fwidth(P)), 1e-4);
    tipo = superficieAuto(vColor.rgb, vColor.a, dot(N, cylUp(P)), step(0.45, curv));
    var = 0.0; // i motivi sono ancorati al mondo: variano da soli da un oggetto all'altro
  }
  s.ao = 1.0 - clamp(vSup.y, 0.0, 1.0);
  applicaSuperficie(s, tipo, var, P, N, pixW);
#endif
  vec3 albedo = s.albedo;
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
  vec3 col = shadeSup(s, N, P, V, tone);
  // bordo dipinto: le campiture viste di taglio si scuriscono appena
  float rimD = 1.0 - abs(dot(N, V));
  col *= 1.0 - smoothstep(0.75, 1.0, rimD) * 0.12;
#endif
  float hazeK = 1.0;
#ifndef NO_PENCIL
  float th = cylThetaDeg(P);
  PaintInfo pi = paintState(P, th, dist);
  // rilevato: inchiostro e colore pieno (un filo più saturo)
  vec3 colPieno = max(mix(vec3(lumaP(col)), col, uLuce.w), 0.0);
  // l'abbozzo sta un po' più dietro l'aria (si legge come un fondale), il dipinto è più nitido
  // (di notte il non rilevato sta meno dietro l'aria: la carta e il gesso si leggono)
  hazeK = mix(mix(1.05, 0.67, uNight * (1.0 - smoothstep(400.0, 900.0, dist))), 1.0, pi.paint);
  if (pi.paint < 0.999) {
    float hgt = uR - length(P.xy);
    float steep = 1.0 - smoothstep(0.35, 0.8, abs(dot(N, cylUp(P))));
    vec3 pc = schizzo(col, suv, N, V, P, tone, hgt, dist, pi.blank, steep, pi.wet + pi.bleed * 0.6);
    // acquerello che sborda oltre il fronte: velatura diluita sul foglio
    pc = mix(pc, mix(colPieno, vec3(0.962, 0.935, 0.862), 0.28), pi.bleed * 0.7);
    col = mix(pc, colPieno, pi.paint);
  } else {
    col = colPieno;
  }
  // pigmento che si raccoglie sul bordo bagnato, poi la linea d'inchiostro del fronte
  col = mix(col, col * vec3(0.78, 0.8, 0.86), pi.wet * pi.paint * 0.6);
  col = mix(col, vec3(0.2, 0.17, 0.26), clamp(pi.ink, 0.0, 1.0) * 0.85);
#endif
#ifdef OBJECT
  // finestre illuminate di notte (segnali vivi: restano a colori anche nell'abbozzo)
  col = mix(col, uLampColor * 1.15, vColor.a * uNight);
#endif
  if (uAriaVetro > 0.5) {
    // costoloni e travi delle Finestre: di giorno stanno dietro la stessa aria del vetro (niente
    // reticolo scuro disegnato sul cielo velato). Da vicino no: sul costolone il ferro è ferro
    // (unione 3, come il vetro: l'aria comincia dopo 40-200 m)
    float giornoV = smoothstep(0.05, 0.6, uSunIntensity) * (1.0 - uNight) * smoothstep(40.0, 200.0, dist);
    col = mix(col, mix(uHazeZenith, uHazeColor, 0.45) * 0.9, giornoV * mix(0.7, 0.95, smoothstep(150.0, 900.0, dist)));
  }
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
  // superfici a doppia faccia (tele, veli, foglie piatte): AUTO legge i chiari come tessuto
  if (opts.side === DoubleSide) defines.DOPPIA_FACCIA = '';
  // gli oggetti senza superficie dichiarata prendono il motivo dal colore (AUTO, vedi superfici.ts)
  const base = opts.superficie ?? (opts.kind === 'object' ? SUPERFICIE.AUTO : SUPERFICIE.NESSUNA);
  const mat = new ShaderMaterial({
    name: `world-${opts.kind}`,
    uniforms: { ...u, uBrush: { value: opts.brush ?? 1 }, uSuperficieBase: { value: base }, uChioma: { value: new Vector4(0, 5.5, 1.35, 0) }, uAriaVetro: { value: opts.ariaVetro ? 1 : 0 } },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side: opts.side ?? FrontSide,
  });
  // senza `aSuperficie` nella geometria l'attributo vale (0, 0): nessun motivo, nessuna occlusione
  (mat.defaultAttributeValues as Record<string, number[]>)['aSuperficie'] = [0, 0];
  return mat;
}

/** Cambia il tipo di superficie predefinito di un materiale del mondo (vedi `SUPERFICIE`). */
export function impostaSuperficieBase(mat: ShaderMaterial, superficie: number): void {
  const u = mat.uniforms['uSuperficieBase'];
  if (u) u.value = superficie;
}

/**
 * Chiome instanziate (InstancedMesh): piega la normale verso quella di una sfera attorno al
 * centro della chioma, così la luce gira la chioma come un unico volume morbido (in due toni,
 * con il bordo luminoso), invece di mostrare le faccette delle masse.
 * @param forza 0 = spento, 0.5-0.7 = consigliato
 * @param altezza altezza del centro della chioma sopra l'origine dell'istanza (unità locali)
 * @param schiaccia allungamento verticale della normale (1 = sfera, 1.35 = chioma più larga che alta)
 */
export function impostaChioma(mat: ShaderMaterial, forza: number, altezza = 5.5, schiaccia = 1.35): void {
  const u = mat.uniforms['uChioma'];
  if (u) (u.value as Vector4).set(forza, altezza, schiaccia, 0);
}
