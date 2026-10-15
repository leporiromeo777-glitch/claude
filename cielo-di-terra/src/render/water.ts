/**
 * Il lago del Verbanetto: superficie a raggio costante (r = R - quota dell'acqua),
 * acqua dipinta a bande dalla giada al blu cobalto con la profondità, pennellate
 * chiare sulle rive e sulle increspature, e lo stesso passaggio matita/colore
 * del resto del mondo.
 */
import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial } from 'three';
import { DEG, LAYOUT, R } from '../world/constants';
import { WATER_HEIGHT, surfaceHeight } from '../world/terrain';
import { BRUSH_GLSL, LIGHT_GLSL, NOISE_GLSL, PENCIL_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import type { WorldUniforms } from './uniforms';

const LAKE = LAYOUT.lake;

const VERT = /* glsl */ `
attribute float aDepth;
varying vec3 vWorldPos;
varying float vDepth;
void main() {
  vDepth = aDepth;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
varying vec3 vWorldPos;
varying float vDepth;
${NOISE_GLSL}
${LIGHT_GLSL}
${BRUSH_GLSL}
${PENCIL_GLSL}
void main() {
  if (vDepth < -0.2) discard;
  vec3 P = vWorldPos;
  vec3 toCam = cameraPosition - P;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec3 N = cylUp(P);
  vec2 suv = cylUV(P);
  // bande di colore con la profondità
  float d = max(vDepth, 0.0);
  vec3 shallow = vec3(0.45, 0.79, 0.60);
  vec3 jade = vec3(0.13, 0.62, 0.50);
  vec3 deep = vec3(0.10, 0.42, 0.52);
  float b1 = smoothstep(1.0, 2.4, d);
  float b2 = smoothstep(12.0, 16.5, d);
  vec3 albedo = mix(mix(shallow, jade, b1), deep, b2);
  // increspature: pennellate allungate che scorrono piano
  vec2 wuv = suv + vec2(uTime * 0.6, uTime * 0.25);
  float w1 = vnoise2(wuv * vec2(0.08, 0.5));
  float w2 = vnoise2(wuv * vec2(0.03, 0.16) + 9.0);
  float strokes = smoothstep(0.72, 0.86, w1 * 0.6 + w2 * 0.5) * (1.0 - smoothstep(60.0, 400.0, dist));
  float tone;
  vec3 col = shadeLit(albedo, N, P, tone);
  col = mix(col, vec3(0.93, 0.95, 0.92) * (0.6 + 0.5 * uSunIntensity), strokes * 0.55);
  // schiuma dipinta sulla riva
  float foam = (1.0 - smoothstep(0.15, 0.9, d)) * (0.55 + 0.45 * vnoise2(suv * 0.4 + uTime * 0.3));
  col = mix(col, vec3(0.95, 0.96, 0.93), foam * 0.7);
  // riflesso: di taglio l'acqua prende il colore della foschia (striscia dipinta)
  float fres = pow(1.0 - max(dot(V, N), 0.0), 4.0);
  col = mix(col, uHazeColor * 1.08, fres * 0.6);
  float th = cylThetaDeg(P);
  PaintInfo pi = paintState(P, th, dist);
  if (pi.paint < 0.999) {
    // non rilevato: abbozzo ad acquerello dell'acqua (vedi schizzo() in shaders/common.ts)
    vec3 pc = schizzo(col, suv, N, V, P, 0.8, 0.0, dist, pi.blank, 0.0, pi.wet);
    pc = mix(pc, mix(col, vec3(0.962, 0.935, 0.862), 0.3), pi.bleed * 0.55);
    col = mix(pc, col, pi.paint);
  }
  col *= 1.0 - pi.wet * 0.2 * pi.paint;
  col = mix(col, vec3(0.17, 0.14, 0.22), clamp(pi.ink, 0.0, 1.0) * 0.8);
  col = applyHazeK(col, P, dist, mix(0.92, 1.0, pi.paint));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createLake(world: WorldUniforms): Mesh {
  const z0 = LAKE.zStart - 60;
  const z1 = LAKE.zEnd + 60;
  const th0 = LAKE.thetaCenter - LAKE.halfWidth - 7;
  const th1 = LAKE.thetaCenter + LAKE.halfWidth + 7;
  const nZ = Math.ceil((z1 - z0) / 8);
  const nT = Math.ceil(((th1 - th0) * R * DEG) / 8);
  const r = R - WATER_HEIGHT;
  const pos = new Float32Array((nZ + 1) * (nT + 1) * 3);
  const depth = new Float32Array((nZ + 1) * (nT + 1));
  for (let i = 0; i <= nZ; i++) {
    const z = z0 + ((z1 - z0) * i) / nZ;
    for (let j = 0; j <= nT; j++) {
      const th = th0 + ((th1 - th0) * j) / nT;
      const t = th * DEG;
      const v = i * (nT + 1) + j;
      pos[v * 3] = -r * Math.sin(t);
      pos[v * 3 + 1] = -r * Math.cos(t);
      pos[v * 3 + 2] = z;
      depth[v] = WATER_HEIGHT - surfaceHeight(z, th);
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < nZ; i++) {
    for (let j = 0; j < nT; j++) {
      const a = i * (nT + 1) + j;
      const b = (i + 1) * (nT + 1) + j;
      // salta i quadrati tutti all'asciutto
      if (depth[a]! < -1 && depth[a + 1]! < -1 && depth[b]! < -1 && depth[b + 1]! < -1) continue;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new BufferAttribute(depth, 1));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = new ShaderMaterial({ name: 'lago', uniforms: { ...world }, vertexShader: VERT, fragmentShader: FRAG });
  const mesh = new Mesh(geo, mat);
  mesh.name = 'lago';
  return mesh;
}
