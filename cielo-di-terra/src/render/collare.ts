/**
 * Il Collare: l'anello di nubi a chiazze attorno al raggio R - 300.
 *
 * Ogni nube è un cumulo di sbuffi morbidi disegnati come sprite rivolti alla camera (una sola
 * InstancedMesh per strato, una chiamata di disegno): sagoma tonda e sfrangiata, normale da
 * sfera finta per la luce, base piatta e in ombra, sommità calde verso la Linea, bordo d'argento
 * in controluce (sopra 1: lo raccoglie il bagliore della post), foschia come il resto del mondo.
 * Due strati: i cumuli del Collare e, più vicino all'asse, veli stirati lungo il giro del cielo.
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
attribute vec3 aTint;
varying vec2 vQ;
varying vec3 vWorldPos;
varying vec3 vCenter;
varying vec4 vForma;
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
varying vec3 vTint;
varying vec3 vAsseA;
varying vec3 vAsseB;
varying float vR;
${NOISE_GLSL}
${LIGHT_GLSL}
void main() {
  vec3 P = vWorldPos;
  vec3 up = cylUp(vCenter);
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / max(dist, 1e-3);
  float seed = vForma.y;
  // sagoma: disco sfrangiato da un rumore nello spazio dello sprite (stabile mentre si gira)
  vec2 q = vQ;
  float ang = atan(q.y, q.x);
  float d = length(q);
  float frangia = vnoise2(vec2(ang * 2.2 + seed * 17.0, seed * 5.0)) * 0.55 + vnoise2(q * 3.1 + seed * 31.0) * 0.45;
  float bordo = d + (frangia - 0.5) * 0.42;
  // base piatta: sotto il centro della nube lo sbuffo si taglia (si vede di lato)
  float hRel = dot(P - vCenter, up) / vR;
  float base = mix(-0.25, -0.75, vForma.x);
  float alpha = (1.0 - smoothstep(0.62, 1.0, bordo)) * smoothstep(base - 0.18, base + 0.12, hRel);
  // da vicino si attraversa: lo sbuffo svanisce invece di riempire lo schermo
  float dc = length(cameraPosition - vCenter);
  alpha *= smoothstep(vR * 0.35, vR * 1.4, dc) * vForma.w;
  if (alpha < 0.01) discard;
  // normale di una sfera finta rivolta alla camera, schiacciata in basso
  float zz = sqrt(max(0.0, 1.0 - min(d * d, 1.0)));
  vec3 N = normalize(vAsseA * q.x + vAsseB * q.y + V * zz * 0.9);
  N = normalize(N - up * smoothstep(-0.1, -0.6, hRel) * 0.6);
  vec3 Ld = lineaLightDir(vCenter, up);
  float reach = lineaReach(vCenter);
  float ndl = dot(N, Ld) * 0.5 + 0.5;
  float lit = bandLight(ndl) * reach;
  // ombra sotto: le parti basse della nube (e la base piatta) restano in ombra fredda
  float cima = clamp(vForma.x * 0.7 + hRel * 0.35 + 0.3, 0.0, 1.0);
  lit *= mix(0.45, 1.0, cima);
  float notte = uNight;
  vec3 ombra = mix(mix(vec3(0.58, 0.62, 0.78), uAmbTop * 0.9, 0.35), uHazeColor * 0.75, 0.25);
  vec3 luce = mix(uSunColor, vec3(1.0, 0.97, 0.9), 0.3) * (0.84 + 0.3 * uSunIntensity);
  vec3 col = vTint * mix(ombra, luce, lit);
  col *= mix(1.0, 0.42, notte);
  // bordo luminoso verso la Linea: sul contorno, dalla parte della luce
  vec3 nOrlo = normalize(vAsseA * q.x + vAsseB * q.y);
  float orlo = smoothstep(0.55, 0.95, bordo) * max(0.0, dot(nOrlo, Ld));
  col += uSunColor * orlo * 0.35 * reach * (1.0 - notte * 0.8);
  // controluce: guardando verso la Linea attraverso la nube il bordo si accende d'argento
  float contro = pow(max(0.0, dot(-V, Ld)), 6.0);
  float sottile = smoothstep(0.45, 0.95, bordo);
  col += mix(uSunColor, vec3(1.0, 0.95, 0.85), 0.5) * contro * sottile * 1.6 * reach * (1.0 - notte);
  // pennellata leggera dentro lo sbuffo
  float pen = vnoise2(q * vec2(4.0, 1.6) + seed * 9.0);
  col *= 0.95 + pen * 0.1;
  // di notte le nubi prendono la luce dei paesi dal basso, appena
  col += uLampColor * 0.05 * notte * (1.0 - cima);
  col = applyHaze(col, P, dist);
  gl_FragColor = vec4(col, alpha * 0.92);
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
}

function creaStrato(world: WorldUniforms, sbuffi: Sbuffo[], nome: string, ordine: number): Mesh {
  const geo = new InstancedBufferGeometry();
  geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const n = sbuffi.length;
  const puff = new Float32Array(n * 4);
  const forma = new Float32Array(n * 4);
  const tinta = new Float32Array(n * 3);
  sbuffi.forEach((s, i) => {
    puff.set([s.p.x, s.p.y, s.p.z, s.r], i * 4);
    forma.set([s.quota, s.seme, s.allunga, s.opacita], i * 4);
    tinta.set(s.tinta, i * 3);
  });
  geo.setAttribute('aPuff', new InstancedBufferAttribute(puff, 4));
  geo.setAttribute('aForma', new InstancedBufferAttribute(forma, 4));
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
  return mesh;
}

export function createCollare(world: WorldUniforms): Group {
  const rnd = mulberry32(C.seed);
  const noise = new Simplex3(C.seed + 11);
  const rc = R - C.height;
  const circ = 2 * Math.PI * rc;
  const nAround = Math.round(circ / C.patchSpacing);
  const cumuli: Sbuffo[] = [];
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
      // cumulo: una base larga di sbuffi bassi, poi torri tonde più in alto (verso l'asse)
      const size = 0.8 + rnd() * 0.6;
      const lungo = (40 + rnd() * 50) * size;
      const largo = (26 + rnd() * 24) * size;
      const nBase = 6 + Math.floor(rnd() * 5);
      const nTorri = 4 + Math.floor(rnd() * 6);
      const calda = rnd();
      const tinta: [number, number, number] = [1.0, 0.985 + calda * 0.015, 0.95 + calda * 0.04];
      const metti = (dz: number, darc: number, dh: number, r: number, quota: number) => {
        const p = cylToWorld(jz + dz, th + darc * gradiPerMetro, C.height + dh);
        cumuli.push({ p, r, quota, seme: rnd(), allunga: 1, opacita: 0.85 + rnd() * 0.15, tinta });
      };
      for (let b = 0; b < nBase; b++) {
        const u = (b / Math.max(1, nBase - 1) - 0.5) * 2;
        metti(u * lungo * 0.5 + (rnd() - 0.5) * 10, (rnd() - 0.5) * largo, (rnd() - 0.5) * 4, (10 + rnd() * 8) * size, 0);
      }
      for (let b = 0; b < nTorri; b++) {
        const ang = rnd() * Math.PI * 2;
        const rad = Math.sqrt(rnd()) * 0.6;
        const alto = 0.35 + rnd() * 0.65;
        metti(Math.cos(ang) * rad * lungo * 0.5, Math.sin(ang) * rad * largo * 0.6, (6 + alto * 16) * size, (9 + rnd() * 9) * size * (1.1 - alto * 0.3), alto);
      }
      // ogni tanto un secondo strato più alto (più vicino all'asse): banchi sottili e chiari,
      // appena allungati lungo il giro del cielo
      if (rnd() < 0.4) {
        const nv = 3 + Math.floor(rnd() * 4);
        const hv = C.height + 50 + rnd() * 30;
        const z0 = jz + (rnd() - 0.5) * 80;
        const t0 = th + (rnd() - 0.5) * 60 * gradiPerMetro;
        for (let v = 0; v < nv; v++) {
          const p = cylToWorld(z0 + (rnd() - 0.5) * 30, t0 + (v - nv / 2) * 16 * gradiPerMetro, hv + (rnd() - 0.5) * 5);
          veli.push({ p, r: (10 + rnd() * 8) * size, quota: 0.5, seme: rnd(), allunga: 1.3 + rnd() * 0.5, opacita: 0.3 + rnd() * 0.18, tinta: [1, 0.99, 0.97] });
        }
      }
    }
  }
  const g = new Group();
  g.name = 'collare';
  g.add(creaStrato(world, veli, 'collare-veli', 1));
  g.add(creaStrato(world, cumuli, 'collare-cumuli', 2));
  return g;
}
