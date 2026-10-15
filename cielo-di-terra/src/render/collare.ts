/**
 * Il Collare: l'anello di nubi a chiazze attorno al raggio R - 300.
 * Ogni nube è un grappolo irregolare di masse tonde (una sola InstancedMesh, una
 * chiamata di disegno). Shader proprio: carta velina traslucida, bordi che
 * sfumano, sommità calde e pance fredde, pennellata leggera.
 */
import { BufferAttribute, IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from 'three';
import { L, LAYOUT, METERS_PER_DEG, R } from '../world/constants';
import { Simplex3, mulberry32 } from '../world/noise';
import { capMeanHeight } from '../world/terrainProfile';
import { LIGHT_GLSL, NOISE_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import type { WorldUniforms } from './uniforms';
import { surfaceMatrix } from './placement';

const C = LAYOUT.collare;

const VERT = /* glsl */ `
attribute vec3 aTint;
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vTint;
varying vec3 vLocal;
void main() {
  vec4 lp = instanceMatrix * vec4(position, 1.0);
  mat3 im = mat3(instanceMatrix);
  vNormalW = normalize(inverse(transpose(im)) * normal);
  vec4 wp = modelMatrix * lp;
  vWorldPos = wp.xyz;
  vTint = aTint;
  vLocal = position;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec3 vTint;
varying vec3 vLocal;
${NOISE_GLSL}
${LIGHT_GLSL}
void main() {
  vec3 P = vWorldPos;
  vec3 N = normalize(vNormalW);
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 up = cylUp(P);
  vec3 Ld = lineaLightDir(P, up);
  // luce morbida a bande: sommità calde, pance fredde
  float ndl = dot(N, Ld) * 0.5 + 0.5;
  float b = bandLight(ndl) * lineaReach(P);
  vec3 belly = mix(vec3(0.70, 0.73, 0.86), uAmbTop, 0.35);
  vec3 top = vec3(1.0, 0.97, 0.9) * mix(uSunColor, vec3(1.0), 0.4);
  vec3 col = vTint * mix(belly, top, b) * mix(0.35, 1.0, 1.0 - uNight * 0.75);
  // pennellata: grana della carta velina
  float g = vnoise3(P * 0.08) * 0.6 + vnoise3(P * 0.25) * 0.4;
  col *= 0.94 + g * 0.1;
  // bordi irregolari e traslucidi
  float facing = abs(dot(N, V));
  float edgeN = vnoise3(P * 0.05 + vLocal * 1.7);
  float alpha = smoothstep(0.05, 0.55, facing + (edgeN - 0.5) * 0.45);
  alpha *= 0.82;
  col = applyHaze(col, P, dist);
  gl_FragColor = vec4(col, alpha);
}
`;

export function createCollare(world: WorldUniforms): InstancedMesh {
  const geo = new IcosahedronGeometry(1, 2);
  const n = geo.getAttribute('position').count;
  geo.setAttribute('aColor', new BufferAttribute(new Float32Array(n * 4).fill(1), 4));

  const rnd = mulberry32(C.seed);
  const noise = new Simplex3(C.seed + 11);
  const rc = R - C.height;
  const circ = 2 * Math.PI * rc;
  const nAround = Math.round(circ / C.patchSpacing);
  const mats: Matrix4[] = [];
  const tints: number[] = [];
  const m = new Matrix4();
  for (let z = C.patchSpacing / 2; z < L; z += C.patchSpacing) {
    for (let k = 0; k < nAround; k++) {
      const jz = z + (rnd() - 0.5) * C.patchSpacing * 0.8;
      const th = ((k + (rnd() - 0.5) * 0.8) / nAround) * 360;
      // niente nubi dentro le pareti dei Tappi
      if (capMeanHeight(jz) > C.height - 40) continue;
      const t = (th * Math.PI) / 180;
      const cov = noise.fbm((-Math.sin(t) * rc) / 420, (-Math.cos(t) * rc) / 420, jz / 420, 3) * 0.5 + 0.5;
      if (cov < 1 - C.coverage * 0.75) continue;
      // grappolo: una massa centrale grande e masse minori attorno, leggermente più in alto
      const blobs = 5 + Math.floor(rnd() * 6);
      const size = 0.8 + rnd() * 0.6;
      const stretch = 0.6 + rnd() * 0.8;
      for (let b = 0; b < blobs; b++) {
        const main = b === 0;
        const ang = rnd() * Math.PI * 2;
        const rad = main ? 0 : (8 + rnd() * 22) * size;
        const dz = Math.cos(ang) * rad * stretch;
        const darc = Math.sin(ang) * rad;
        const r0 = (main ? 16 : 7 + rnd() * 9) * size;
        const dh = (rnd() - 0.3) * r0 * 0.5;
        const bth = th + darc / ((rc / R) * METERS_PER_DEG);
        const sx = r0 * (0.9 + rnd() * 0.4);
        const sz = r0 * (0.9 + rnd() * 0.4);
        const sy = r0 * (0.62 + rnd() * 0.2);
        surfaceMatrix(jz + dz, bth, C.height + dh, rnd() * 360, sx, sy, sz, m);
        mats.push(m.clone());
        const warm = rnd();
        tints.push(1.0, 0.98 + warm * 0.02, 0.95 + warm * 0.04);
      }
    }
  }
  const mat = new ShaderMaterial({
    name: 'collare',
    uniforms: { ...world },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new InstancedMesh(geo, mat, mats.length);
  mats.forEach((mm, i) => mesh.setMatrixAt(i, mm));
  geo.setAttribute('aTint', new InstancedBufferAttribute(new Float32Array(tints), 3));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  mesh.name = 'collare';
  return mesh;
}
