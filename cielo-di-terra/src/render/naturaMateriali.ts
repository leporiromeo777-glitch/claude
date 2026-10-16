/**
 * Materiali della vegetazione (traccia «natura»): chiome, tronchi, erba, sottobosco e le masse
 * dei boschi lontani. Stesso modello di luce, stessa matita e stessa foschia del materiale del
 * mondo (`worldMaterial.ts`: usano gli stessi pezzi GLSL), più:
 * - il vento (`uVento`, condiviso da tutti: vedi `ventoCondiviso`);
 * - la comparsa e la scomparsa con la distanza (`uSfuma`, per materiale: i livelli di dettaglio
 *   si passano il testimone retinando, il filtro pittorico della post ammorbidisce la retinatura);
 * - la chioma dipinta (`chiomaDipinta` in shaders/natura.ts) e le carte di foglie (`ciuffoFoglie`,
 *   `carteDipinte`): quadrati rivolti alla camera e ritagliati a ciuffi di foglie per specie
 *   (`uFoglia.x`, vedi `FORMA_FOGLIA` in scene/alberi.ts).
 *
 * Attributi (oltre a position e normal):
 * - `aColor` (vec4, per vertice), secondo il tipo:
 *     chioma:     r = occlusione propria (1 = in luce), g = quanto è sul bordo della chioma,
 *                 b = 1 sul tronco dentro la chioma lontana, a = valore della massa (sceglie il
 *                 colore principale o il secondario)
 *     carte:      come la chioma, più `aCarta` (x, y = angolo -1..1, z = lato in m, w = seme)
 *     tronco:     rgb = corteccia, a = libero
 *     erba:       rgb = moltiplicatore (base scura, punta chiara), a = punta (0 base, 1 punta)
 *     sottobosco: rgb = colore, a = flessione nel vento (0 rigido, 1 morbido)
 *     bosco:      rgb = colore della massa, a = copertura (sotto 0.5 non si disegna)
 * - per istanza (InstancedMesh): `aTint` (vec4: rgb = colore o moltiplicatore, a = seme) e, per
 *   le chiome e le carte, `aTint2` (vec4: rgb = colore secondario, a = quota di masse col secondario).
 *
 * Retinatura: ogni livello riceve (comparsa, scomparsa) e il fragment le retina con soglie
 * complementari (`retinato`), così due livelli che si passano il testimone coprono insieme ogni
 * pixel (niente puntini scuri nella fascia di passaggio).
 */
import { DoubleSide, FrontSide, ShaderMaterial, Vector4, type Side } from 'three';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import { CHIOMA_GLSL, DIPINTO_GLSL, ERBA_GLSL, FOGLIE_GLSL, NATURA_UNIFORMS_GLSL, RETINA_GLSL, SFUMA_GLSL, VENTO_GLSL } from './shaders/natura';
import { TERRENO_GLSL } from './shaders/terreno';
import { SUPERFICI_BASE_GLSL, SUPERFICI_GLSL } from './superfici';
import type { WorldUniforms } from './uniforms';

export type TipoNatura = 'chioma' | 'carte' | 'tronco' | 'erba' | 'sottobosco' | 'bosco';

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
  /** carte di foglie: forma delle foglie (0 lanceolata, 1 tonda, 2 aghi, 3 squame) */
  foglia?: number;
}

/** Il vento condiviso da tutti i materiali della vegetazione (x forza, y raffiche, zw direzione est/nord). */
export const ventoCondiviso = { value: new Vector4(0.6, 0.7, 0.35, 0.94) };

const VERT = /* glsl */ `
attribute vec4 aColor;
#ifdef CARTE
attribute vec4 aCarta;
varying vec4 vCarta;   // xy = angolo della carta (-1..1), z = seme, w = lato (m)
varying vec3 vAltro;   // l'altra tinta dell'albero (foglie che hanno girato)
#endif
#ifdef USE_INSTANCING
attribute vec4 aTint;
#if defined(CHIOMA) || defined(CARTE)
attribute vec4 aTint2;
#endif
#endif
uniform float uTime;
uniform float uFlessione;
${NATURA_UNIFORMS_GLSL}
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vAlbedo;
varying vec4 vInfo;   // x = seme, y = occlusione, z = bordo/punta (-1 = tronco nella chioma), w = visibilità
varying vec2 vSfuma;  // comparsa, scomparsa (retinatura complementare fra i livelli)
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
  float scalaX = 1.0;
#ifdef USE_INSTANCING
  tint = aTint.rgb;
  seme = aTint.a;
  lp = instanceMatrix * lp;
  mat3 im = mat3(instanceMatrix);
  n = inverse(transpose(im)) * n;
  origine = (modelMatrix * vec4(instanceMatrix[3].xyz, 1.0)).xyz;
  scalaY = length(im[1]);
  scalaX = length(im[0]);
#endif
  vec4 wp = modelMatrix * lp;
  vec3 nW = normalize(mat3(modelMatrix) * n);
  // quota sopra la base dell'istanza (m)
  float alto = max(position.y * scalaY, 0.0);
#if defined(CHIOMA) || defined(CARTE)
#ifdef USE_INSTANCING
  vec3 c2 = aTint2.rgb;
  float qa = aTint2.a;
#else
  vec3 c2 = tint;
  float qa = 0.5;
#endif
  float f = smoothstep(qa - 0.09, qa + 0.09, aColor.a);
  vAlbedo = mix(c2, tint, f);
  vInfo = vec4(seme, aColor.r, aColor.g, 1.0);
  wp.xyz += vento(origine, alto, uFlessione * 0.0022, seme);
#ifdef CHIOMA
  if (aColor.b > 0.5) {
    // tronco dentro la chioma lontana (LOD 3)
    vAlbedo = vec3(0.34, 0.28, 0.23) * (0.9 + 0.2 * seme);
    vInfo.z = -1.0;
  } else {
    // tremolio delle foglie: piccolo, lungo la normale
    wp.xyz += nW * sin(uTime * 7.0 + dot(wp.xyz, vec3(1.7, 2.3, 1.9)) + seme * 20.0) * 0.035 * uVento.x;
  }
#else
  // carta di foglie: il quadrato si apre attorno al suo centro, rivolto alla camera, e trema
  vAltro = mix(tint, c2, f);
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float tr = uTime * (2.2 + aCarta.w * 2.0) + aCarta.w * 40.0;
  float rot = sin(tr) * 0.06 * uVento.x;
  vec2 cr = vec2(aCarta.x * cos(rot) - aCarta.y * sin(rot), aCarta.x * sin(rot) + aCarta.y * cos(rot));
  // vicinissimo alla camera la carta si rimpicciolisce (fra 3 e 1,2 m) e sotto 1,2 m sparisce:
  // la camera non finisce mai dentro un ciuffo di foglie grande come lo schermo
  float vicinoCam = smoothstep(1.2, 3.0, distance(cameraPosition, wp.xyz));
  wp.xyz += (camR * cr.x + camU * cr.y) * (aCarta.z * 0.5 * scalaX * vicinoCam);
  // la carta sta un poco davanti al suo punto (verso la camera): non entra nella massa sotto
  vec3 versoCam = cameraPosition - wp.xyz;
  float dCam = length(versoCam);
  wp.xyz += versoCam / max(dCam, 1e-3) * min(aCarta.z * 0.42 * scalaX, dCam * 0.3);
  vCarta = vec4(aCarta.xy, aCarta.w, aCarta.z * scalaX);
#endif
#elif defined(TRONCO)
  vAlbedo = aColor.rgb * tint;
  vInfo = vec4(seme, 1.0, 0.0, 1.0);
  wp.xyz += vento(origine, alto, uFlessione * 0.0022, seme);
#elif defined(ERBA)
  // uFoglia.z = 1: l'istanza porta il colore del prato sotto, il vertice il chiaroscuro del filo
  vAlbedo = uFoglia.z > 0.5 ? tint : tint * aColor.rgb;
  vInfo = vec4(seme, aColor.r, aColor.a, 1.0);
  wp.xyz += vento(wp.xyz, aColor.a, uFlessione * 0.55, seme + dot(wp.xyz, vec3(0.13, 0.17, 0.11)));
  // la luce dell'erba è quella del prato: normale quasi in su (niente fili neri controluce)
  nW = normalize(mix(nW, cylUp(origine), 0.72));
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
  vSfuma = sfumaDistanza2(distance(cameraPosition, wp.xyz));
#else
  vSfuma = sfumaDistanza2(distance(cameraPosition, origine));
#endif
  vInfo.w = vSfuma.x * vSfuma.y;
#if defined(ERBA) || defined(SOTTOBOSCO)
  // erba e sottobosco: con la distanza si rimpiccioliscono fino a sparire nel prato (niente retino)
  wp.xyz = origine + (wp.xyz - origine) * smoothstep(0.0, 1.0, vInfo.w);
  vSfuma = vec2(1.0);
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
varying vec2 vSfuma;
#ifdef CARTE
varying vec4 vCarta;
varying vec3 vAltro;
#endif
${NOISE_GLSL}
${LIGHT_GLSL}
${BRUSH_GLSL}
${SUPERFICI_BASE_GLSL}
${TERRENO_GLSL}
${SUPERFICI_GLSL}
${PENCIL_GLSL}
${CHIOMA_GLSL}
${FOGLIE_GLSL}
${ERBA_GLSL}
${DIPINTO_GLSL}
${RETINA_GLSL}
void main() {
  // retinatura del passaggio fra livelli di dettaglio (stabile sullo schermo, complementare)
  if (retinato(vSfuma)) discard;
#ifdef BOSCO
  // le masse dei boschi lontani: da vicino una cella = una chioma; da lontano (oltre ~300 m) gruppi
  // di chiome della stessa specie, larghi 20-40 m. Al margine del bosco spariscono una chioma o un
  // gruppo alla volta (il bordo è fatto di chiome, non tagliato)
  float distB = distance(cameraPosition, vWorldPos);
  float lonB = smoothstep(220.0, 500.0, distB);
  // (rifinitura 2) le due voronoi solo dove servono: quella delle chiome (6,5 m) fino a 500 m, quella
  // dei gruppi (26 m) solo da lontano e solo sul margine del bosco (copertura sotto 0,68: altrove il
  // test qui sotto passa comunque). Il valore che manca vale 0,5
  vec3 relB = vec3(0.0);
  vec3 voB = vec3(1.0, 0.5, 0.5);
  if (lonB < 1.0) voB = voronoi3(vWorldPos / 6.5, relB);
  float idG = 0.5;
  if (lonB > 0.0 && vInfo.z < 0.68) {
    vec3 relG;
    idG = voronoi3(vWorldPos / 26.0 + 3.7, relG).z;
  }
  if (vInfo.z < 0.3 + 0.38 * mix(voB.z, idG, lonB)) discard;
#endif
#ifdef CARTE
  float idF;
  vec2 dirF;
  float trasvF;
  float pxCarta = 2.0 / max(fwidth(vCarta.x), 1e-4);
  if (ciuffoFoglie(vCarta.xy, vCarta.z, uFoglia.x, pxCarta, idF, dirF, trasvF) < 0.5) discard;
#endif
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
#if !defined(CARTE) && !defined(ERBA)
  if (!gl_FrontFacing) N = -N;
#endif
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
  if (vInfo.z < -0.5) {
    applicaSuperficie(s, 5.0, 0.3, P, N, pixW);
    s.bande = 0.55;
  } else {
    chiomaDipinta(s, P, N, up, pixW, vInfo.x, vInfo.z);
    // nucleo sotto le carte di foglie (LOD 0 e 1): l'interno in ombra della chioma
    float kn = uFoglia.y > 0.01 ? uFoglia.y : 1.0;
    s.albedo *= kn;
    s.ao *= mix(1.0, kn, 0.6);
  }
#elif defined(CARTE)
  s.ao = vInfo.y;
  vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camU = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  carteDipinte(s, vAltro, vInfo.z, idF, dirF, trasvF, camR, camU, smoothstep(30.0, 90.0, pxCarta));
  // (rifinitura 2) gli aghi del larice lasciano passare meno luce: in controluce, al tramonto, i
  // larici erano candelotti arancioni accesi
  if (uFoglia.x > 1.5 && uFoglia.x < 2.5) s.trasm = 0.5;
#elif defined(TRONCO)
  applicaSuperficie(s, 5.0, fract(vInfo.x * 7.0) * 0.9, P, N, pixW);
  s.bande = 0.55;
#elif defined(ERBA)
  if (uFoglia.z > 0.5) {
    // il prato dipinto del terreno (stesse chiazze, stessi tocchi), poi il chiaroscuro del filo
    float st;
    s.albedo = pratoDipinto(s.albedo, cylLocal(P), cylDominantUV(P, up), pixW, 1.0, 1.0, st);
    s.albedo *= vInfo.y;
  }
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
  // BOSCO: chiome lontane come masse dipinte. Da vicino (fino a ~250 m) una cella = un albero, con
  // la sua cupola; da lontano niente gobba per albero (era un «pluriball»): macchie morbide di
  // gruppi di specie (oliva, oro, ruggine) larghe 20-40 m, più scure nelle valli fra i gruppi
  {
    vec3 rel = relB;
    vec3 vo = voB;
    float lon = lonB;
    float vis = visMotivo(pixW, 9.0) * (1.0 - lon);
    // ogni chioma vicina è una cupola: la normale gira attorno al centro della cella, più in su
    vec3 nb = normalize(s.N * 0.6 - rel * 1.4 + up * 0.5);
    s.N = normalize(mix(s.N, nb, 0.3 * vis));
    // da lontano la normale si ammorbidisce verso il su: masse continue, niente gobbe
    s.N = normalize(mix(s.N, normalize(s.N + up * 0.8), 0.5 * lon));
    // lo scurimento fra le chiome solo da vicino (oltre 300 m niente buchi)
    float gap = (1.0 - smoothstep(0.0, 0.36, vo.x)) * vis * 0.7 * (1.0 - smoothstep(220.0, 300.0, distB));
    // il colore d'ottobre va a macchie (gruppi della stessa specie: verde, oro, ruggine); da vicino
    // ogni chioma ci aggiunge un poco del suo, da lontano comanda il gruppo
    float macchia = vnoise3(P * 0.012 + 4.0) * 0.65 + vnoise3(P * 0.045) * 0.35;
    // (rifinitura 2: da lontano i gruppi sono macchie di rumore, non celle: le celle di 26 m col filo
    // scuro fra l'una e l'altra facevano sui versanti un selciato di ciottoli grandi)
    float macchiaG = vnoise3(P * 0.034 + 9.0) * 0.7 + vnoise3(P * 0.11 + 2.0) * 0.3;
    float t = mix(mix(macchia, vo.z, 0.35 * vis + 0.1), mix(macchia, macchiaG, 0.6), lon);
    vec3 c = s.albedo;
    c = mix(c, c * vec3(1.3, 1.08, 0.64), smoothstep(0.55, 0.72, t) * 0.7);
    c = mix(c, c * vec3(1.2, 0.8, 0.52), smoothstep(0.74, 0.88, t) * 0.7);
    c = mix(c, c * vec3(0.84, 0.95, 0.9), smoothstep(0.38, 0.2, t) * 0.45);
    c *= 1.0 - gap * 0.24;
    // fra un gruppo e l'altro appena più scuro e freddo, con un rumore morbido (niente righe né
    // ciottoli: da lontano il bosco è una massa continua a chiazze)
    float valle = smoothstep(0.42, 0.2, vnoise3(P * 0.03 + 3.3)) * lon;
    c *= mix(1.0, 0.9, valle);
    c = mix(c, c * vec3(0.94, 0.98, 1.04), valle * 0.5);
    // il bordo del bosco (copertura bassa) sfuma verso il colore del sottobosco, invece di staccarsi
    c = mix(c, c * vec3(0.82, 0.8, 0.7), (1.0 - smoothstep(0.32, 0.62, vInfo.z)) * 0.5);
    s.albedo = c;
    s.ao *= 1.0 - gap * 0.4 - valle * 0.15;
    s.trasm = 0.6;
    s.bordo = 0.5;
    s.bande = 0.5;
    s.avvolge = 0.5;
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
  carte: 'CARTE',
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
      uFoglia: { value: new Vector4(opz.foglia ?? 0, 0, 0, 0) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side: opz.side ?? (opz.tipo === 'erba' || opz.tipo === 'carte' ? DoubleSide : FrontSide),
  });
  (mat.defaultAttributeValues as Record<string, number[]>)['aTint'] = [1, 1, 1, 0];
  (mat.defaultAttributeValues as Record<string, number[]>)['aTint2'] = [1, 1, 1, 0];
  return mat;
}

/**
 * Chiome con le carte di foglie sopra: le masse sono il nucleo in ombra della chioma e si scuriscono
 * (k = 0.6..1; 1 = masse normali, per i livelli senza carte).
 */
export function impostaNucleo(mat: ShaderMaterial, k: number): void {
  const f = mat.uniforms['uFoglia'];
  if (f) (f.value as Vector4).y = k;
}

/** Cambia la comparsa/scomparsa con la distanza di un materiale della vegetazione. */
export function impostaSfuma(mat: ShaderMaterial, da0: number, a0: number, da1: number, a1: number): void {
  const s = mat.uniforms['uSfuma'];
  if (s) (s.value as Vector4).set(da0, a0, da1, a1);
}
