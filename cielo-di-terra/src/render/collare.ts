/**
 * Il Collare: l'anello di nubi a chiazze attorno al raggio R - 300.
 *
 * Ogni nube è un cumulo di sbuffi morbidi disegnati come sprite rivolti alla camera (una
 * InstancedBufferGeometry per strato, una chiamata di disegno ciascuno). La luce non è quella del
 * singolo sbuffo ma **della nube intera**: ogni sbuffo conosce il centro e la grandezza del suo
 * cumulo, così la nube ha un lato in luce verso la Linea, una base piatta in ombra fredda (con un
 * filo di luce riflessa dal suolo) e, in controluce, un orlo d'argento solo sulla sua **sagoma
 * esterna** (prima ogni sbuffo aveva il suo orlo e da sotto le nubi sembravano bolle ad anello).
 * Il controluce supera 1: lo raccoglie il bagliore della post. Foschia come il resto del mondo.
 *
 * Tre strati: le torri dei cumuli, le loro basi e, più vicino all'asse, veli stirati lungo il giro
 * del cielo. Torri e basi sono due mesh perché l'ordine di disegno conta (gli sprite trasparenti non
 * si ordinano fra loro): da sotto la base sta davanti alle torri, da sopra il contrario.
 * `ordinaCollare(gruppo, camera)` lo sistema a ogni fotogramma.
 */
import { DoubleSide, Group, InstancedBufferAttribute, InstancedBufferGeometry, BufferAttribute, Mesh, ShaderMaterial, Vector3 } from 'three';
import { L, LAYOUT, METERS_PER_DEG, R } from '../world/constants';
import { cylToWorld } from '../world/cylinder';
import { Simplex3, mulberry32 } from '../world/noise';
import { capMeanHeight } from '../world/terrainProfile';
import { LIGHT_GLSL, NOISE_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import type { WorldUniforms } from './uniforms';

const C = LAYOUT.collare;

const VERT = /* glsl */ `
attribute vec4 aPuff;    // xyz centro (mondo), w raggio
attribute vec4 aForma;   // x quota relativa nella nube (0 base, 1 cima), y seme, z allungamento, w opacità
attribute vec4 aNube;    // xyz centro della nube, w raggio della nube
attribute vec3 aTint;
varying vec2 vQ;
varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec4 vForma;
varying vec4 vNube;
varying vec3 vTint;
varying vec3 vAsseA;
varying vec3 vAsseB;
varying float vR;
void main() {
  vec3 Cc = aPuff.xyz;
  float r = aPuff.w;
  vec3 toCam = cameraPosition - Cc;
  float dist = length(toCam);
  vec3 F = toCam / max(dist, 1e-3);
  // asse lungo: il giro del cielo (est locale) proiettato sul piano della vista
  vec3 up = vec3(-Cc.xy / max(length(Cc.xy), 1e-3), 0.0);
  vec3 east = vec3(-up.y, up.x, 0.0);
  vec3 A = east - F * dot(east, F);
  float la = length(A);
  A = la > 1e-3 ? A / la : normalize(cross(F, vec3(0.0, 0.0, 1.0)));
  vec3 B = cross(F, A);
  float st = aForma.z;
  vec3 P = Cc + (A * position.x * st + B * position.y) * r;
  vQ = position.xy;
  vWorldPos = P;
  vCenter = Cc;
  vForma = aForma;
  vNube = aNube;
  vTint = aTint;
  vAsseA = A;
  vAsseB = B;
  vR = r;
  gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
varying vec2 vQ;
varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec4 vForma;
varying vec4 vNube;
varying vec3 vTint;
varying vec3 vAsseA;
varying vec3 vAsseB;
varying float vR;
${NOISE_GLSL}
${LIGHT_GLSL}
void main() {
  vec3 P = vWorldPos;
  vec3 Cn = vNube.xyz;
  float Rn = vNube.w;
  vec3 up = cylUp(Cn);
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-3);
  float seed = vForma.y;

  // --- sagoma dello sbuffo: disco sfrangiato da un rumore nello spazio dello sprite
  vec2 q = vQ;
  float ang = atan(q.y, q.x);
  float d = length(q);
  float frangia = vnoise2(vec2(ang * 2.2 + seed * 17.0, seed * 5.0)) * 0.55 + vnoise2(q * 3.1 + seed * 31.0) * 0.45;
  float bordo = d + (frangia - 0.5) * 0.42;
  // base piatta: sotto la base della nube lo sbuffo si taglia (si vede di lato)
  float hN = dot(P - Cn, up);
  float base = -Rn * 0.16 - vR * 0.15;
  float alpha = (1.0 - smoothstep(0.6, 1.0, bordo)) * smoothstep(base - vR * 0.25, base + vR * 0.12, hN);
  // da vicino si attraversa: lo sbuffo svanisce invece di riempire lo schermo
  float dc = length(cameraPosition - vCenter);
  alpha *= smoothstep(vR * 0.35, vR * 1.4, dc) * vForma.w;
  if (alpha < 0.01) discard;

  // --- luce della nube intera: ellissoide schiacciato attorno al centro del cumulo,
  // con la rotondità del singolo sbuffo sopra
  vec3 w = P - Cn;
  float hv = dot(w, up);
  vec3 wh = w - up * hv;
  vec3 nNube = normalize(wh / Rn + up * (hv / (Rn * 0.5)) + up * 0.15);
  float zz = sqrt(max(0.0, 1.0 - min(d * d, 1.0)));
  vec3 nSbuffo = normalize(vAsseA * q.x + vAsseB * q.y + V * zz * 0.9);
  vec3 N = normalize(nNube * 0.65 + nSbuffo * 0.45);
  vec3 Ld = lineaLightDir(Cn, up);
  float reach = lineaReach(Cn);
  float ndl = dot(N, Ld) * 0.5 + 0.5;
  float lit = bandLight(ndl) * reach;
  // la base piatta resta in ombra, la cima è piena di luce
  float hRel = clamp(hv / (Rn * 0.55), -1.0, 1.0);
  lit *= mix(0.55, 1.0, smoothstep(-0.7, 0.5, hRel));
  float notte = uNight;
  // ombra: azzurro freddo del cielo, con un filo di luce calda riflessa dal suolo sulla pancia
  vec3 ombra = mix(vec3(0.6, 0.65, 0.8), uAmbTop * 0.95, 0.35);
  ombra = mix(ombra, uHazeColor * 0.85, 0.2);
  ombra += vec3(0.08, 0.06, 0.02) * (1.0 - smoothstep(-0.9, 0.0, hRel)) * (1.0 - notte);
  vec3 luce = mix(uSunColor, vec3(1.0, 0.97, 0.92), 0.35) * (0.86 + 0.28 * uSunIntensity);
  vec3 col = vTint * mix(ombra, luce, lit);
  col *= mix(1.0, 0.4, notte);

  // --- sagoma della nube vista dalla camera: 0 al centro, 1 sul contorno esterno
  vec3 wp = w - V * dot(w, V);
  float lw = length(wp);
  vec3 fuori = lw > 1e-3 ? wp / lw : vec3(0.0);
  float sagoma = smoothstep(0.45, 1.0, lw / (Rn * 0.95));
  vec3 nOrlo = normalize(vAsseA * q.x + vAsseB * q.y);
  // l'orlo dello sbuffo che guarda fuori dalla nube (gli orli interni non si vedono)
  float esterno = smoothstep(0.5, 0.95, bordo) * smoothstep(0.0, 0.6, dot(nOrlo, fuori)) * sagoma;
  // bordo luminoso dalla parte della Linea
  float versoLuce = max(0.0, dot(fuori, Ld));
  col += luce * esterno * versoLuce * 0.3 * reach * (1.0 - notte * 0.8);
  // controluce: guardando verso la Linea attraverso la nube il contorno si accende d'argento
  // (sopra 1: lo apre il bagliore); dentro la nube resta solo un velo di luce diffusa
  float contro = pow(max(0.0, dot(-V, Ld)), 3.0);
  vec3 argento = mix(uSunColor, vec3(1.0, 0.96, 0.88), 0.5);
  col += argento * contro * (esterno * 1.5 + 0.12) * reach * (1.0 - notte);
  // pennellata leggera dentro lo sbuffo, sempre nello stesso verso (pittura, non rumore)
  float pen = vnoise2(vec2(dot(q, vec2(0.9, 0.44)) * 4.0, dot(q, vec2(-0.44, 0.9)) * 1.3) + seed * 9.0);
  col *= 0.95 + pen * 0.1;
  // di notte: sagome blu-viola appena più chiare dell'aria (come nel bozzetto della notte), con la
  // cima che prende la brace della Linea e la pancia un filo dei lumi dei paesi
  vec3 notturna = uHazeColor * mix(0.98, 1.28, lit) + vec3(0.01, 0.012, 0.035) + argento * esterno * 0.035;
  notturna += uLampColor * 0.02 * (1.0 - smoothstep(-0.8, 0.2, hRel));
  col = mix(col, notturna, smoothstep(0.2, 0.9, notte));
  col = applyHaze(col, P, dist);
  // di notte più velate: si confondono con l'aria invece di stagliarsi
  gl_FragColor = vec4(col, alpha * mix(0.94, 0.8, notte));
}
`;

interface Sbuffo {
  p: Vector3;
  r: number;
  quota: number;
  seme: number;
  allunga: number;
  opacita: number;
  tinta: [number, number, number];
  nube: Vector3;
  rNube: number;
}

function creaStrato(world: WorldUniforms, sbuffi: Sbuffo[], nome: string, ordine: number): Mesh {
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const n = sbuffi.length;
  const puff = new Float32Array(n * 4);
  const forma = new Float32Array(n * 4);
  const nube = new Float32Array(n * 4);
  const tinta = new Float32Array(n * 3);
  sbuffi.forEach((s, i) => {
    puff.set([s.p.x, s.p.y, s.p.z, s.r], i * 4);
    forma.set([s.quota, s.seme, s.allunga, s.opacita], i * 4);
    nube.set([s.nube.x, s.nube.y, s.nube.z, s.rNube], i * 4);
    tinta.set(s.tinta, i * 3);
  });
  geo.setAttribute('aPuff', new InstancedBufferAttribute(puff, 4));
  geo.setAttribute('aForma', new InstancedBufferAttribute(forma, 4));
  geo.setAttribute('aNube', new InstancedBufferAttribute(nube, 4));
  geo.setAttribute('aTint', new InstancedBufferAttribute(tinta, 3));
  geo.instanceCount = n;
  const mat = new ShaderMaterial({
    name: nome,
    uniforms: { ...world },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  const mesh = new Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = ordine;
  mesh.name = nome;
  // non proietta ombre (traccia «luce»): è trasparente e lontano
  mesh.userData.ombra = false;
  return mesh;
}

export function createCollare(world: WorldUniforms): Group {
  const rnd = mulberry32(C.seed);
  const noise = new Simplex3(C.seed + 11);
  const rc = R - C.height;
  const circ = 2 * Math.PI * rc;
  const nAround = Math.round(circ / C.patchSpacing);
  const torri: Sbuffo[] = [];
  const basi: Sbuffo[] = [];
  const veli: Sbuffo[] = [];
  const gradiPerMetro = 1 / ((rc / R) * METERS_PER_DEG);
  for (let z = C.patchSpacing / 2; z < L; z += C.patchSpacing) {
    for (let k = 0; k < nAround; k++) {
      const jz = z + (rnd() - 0.5) * C.patchSpacing * 0.8;
      const th = ((k + (rnd() - 0.5) * 0.8) / nAround) * 360;
      // niente nubi dentro le pareti dei Tappi
      if (capMeanHeight(jz) > C.height - 40) continue;
      const t = (th * Math.PI) / 180;
      const cov = noise.fbm((-Math.sin(t) * rc) / 420, (-Math.cos(t) * rc) / 420, jz / 420, 3) * 0.5 + 0.5;
      if (cov < 1 - C.coverage * 0.75) continue;
      // cumulo: una base larga di sbuffi bassi, poi torri tonde più in alto (verso l'asse);
      // dove la copertura è piena i cumuli crescono
      const size = (1.0 + rnd() * 0.65) * (1 + Math.max(0, cov - 0.75) * 1.6);
      const lungo = (44 + rnd() * 50) * size;
      const largo = (28 + rnd() * 24) * size;
      const nBase = 6 + Math.floor(rnd() * 5);
      const nTorri = 5 + Math.floor(rnd() * 6);
      const calda = rnd();
      const tinta: [number, number, number] = [1.0, 0.985 + calda * 0.015, 0.95 + calda * 0.04];
      const hTorri = 16 * size;
      const centro = cylToWorld(jz, th, C.height + hTorri * 0.45);
      const rNube = Math.max(lungo * 0.55, largo * 0.6, hTorri * 1.4) + 10 * size;
      const metti = (lista: Sbuffo[], dz: number, darc: number, dh: number, r: number, quota: number) => {
        const p = cylToWorld(jz + dz, th + darc * gradiPerMetro, C.height + dh);
        lista.push({ p, r, quota, seme: rnd(), allunga: 1, opacita: 0.86 + rnd() * 0.14, tinta, nube: centro, rNube });
      };
      for (let b = 0; b < nBase; b++) {
        const u = (b / Math.max(1, nBase - 1) - 0.5) * 2;
        metti(basi, u * lungo * 0.5 + (rnd() - 0.5) * 10, (rnd() - 0.5) * largo, (rnd() - 0.5) * 4, (11 + rnd() * 8) * size, 0);
      }
      for (let b = 0; b < nTorri; b++) {
        const ang = rnd() * Math.PI * 2;
        const rad = Math.sqrt(rnd()) * 0.6;
        const alto = 0.35 + rnd() * 0.65;
        metti(torri, Math.cos(ang) * rad * lungo * 0.5, Math.sin(ang) * rad * largo * 0.6, (6 + alto * hTorri) * size, (10 + rnd() * 9) * size * (1.1 - alto * 0.3), alto);
      }
      // ogni tanto un secondo strato più alto (più vicino all'asse): banchi sottili e chiari,
      // appena allungati lungo il giro del cielo
      if (rnd() < 0.4) {
        const nv = 3 + Math.floor(rnd() * 4);
        const hv = C.height + 50 + rnd() * 30;
        const z0 = jz + (rnd() - 0.5) * 80;
        const t0 = th + (rnd() - 0.5) * 60 * gradiPerMetro;
        const cv = cylToWorld(z0, t0, hv);
        const rv = nv * 9 * size + 14;
        for (let v = 0; v < nv; v++) {
          const p = cylToWorld(z0 + (rnd() - 0.5) * 30, t0 + (v - nv / 2) * 16 * gradiPerMetro, hv + (rnd() - 0.5) * 5);
          veli.push({ p, r: (10 + rnd() * 8) * size, quota: 0.5, seme: rnd(), allunga: 1.3 + rnd() * 0.5, opacita: 0.3 + rnd() * 0.18, tinta: [1, 0.99, 0.97], nube: cv, rNube: rv });
        }
      }
    }
  }
  // dentro ogni strato, le torri più alte prima (da sotto stanno dietro)
  torri.sort((a, b) => a.quota - b.quota).reverse();
  const g = new Group();
  g.name = 'collare';
  g.add(creaStrato(world, veli, 'collare-veli', 1));
  g.add(creaStrato(world, torri, 'collare-torri', 2));
  g.add(creaStrato(world, basi, 'collare-basi', 3));
  return g;
}

/**
 * Ordine di disegno degli strati secondo la quota della camera: sotto il Collare (il caso
 * normale) prima i veli, poi le torri, poi le basi, che stanno davanti; sopra, il contrario.
 */
export function ordinaCollare(g: Group, camera: Vector3): void {
  const h = R - Math.hypot(camera.x, camera.y);
  const sopra = h > C.height + 8;
  for (const m of g.children) {
    if (m.name === 'collare-veli') m.renderOrder = sopra ? 3 : 1;
    else if (m.name === 'collare-torri') m.renderOrder = 2;
    else if (m.name === 'collare-basi') m.renderOrder = sopra ? 1 : 3;
  }
}
