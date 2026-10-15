/**
 * Le tre Finestre: strisce di vetro sul fondo del cilindro, con i costoloni di
 * ferro ogni 40 m e le travi di bordo. Sotto il vetro le stelle ruotano: lo
 * shader porta la direzione di vista nel riferimento inerziale (il cielo gira
 * una volta ogni 51 s) e disegna un cielo procedurale con la Via Lattea e la
 * Meta (il sole lontano, bianco duro). La Luna arriverà più avanti (uMoonDir).
 */
import { BufferAttribute, BufferGeometry, DoubleSide, Group, Mesh, ShaderMaterial, Vector3 } from 'three';
import { DEG, LAYOUT, OMEGA, R } from '../world/constants';
import { cylToWorld } from '../world/cylinder';
import { surfaceHeight } from '../world/terrain';
import { LIGHT_GLSL, NOISE_GLSL, WORLD_UNIFORMS_GLSL } from './shaders/common';
import type { WorldUniforms } from './uniforms';
import { createWorldMaterial } from './worldMaterial';
import type { RGB } from './palette';

/** Acciaio del telaio e dei costoloni. */
const STEEL: RGB = [0.5, 0.53, 0.59];
const STEEL_DARK: RGB = [0.3, 0.31, 0.36];

const WIN = LAYOUT.windows;

const GLASS_FRAG = /* glsl */ `
${WORLD_UNIFORMS_GLSL}
uniform float uOmega;
uniform float uStarSpeed;
uniform vec3 uMetaDir;
uniform float uMetaOn;
uniform vec3 uMoonDir;
uniform float uMoonOn;
uniform vec2 uWinRange; // theta inizio, fine (gradi)
varying vec3 vWorldPos;
${NOISE_GLSL}
${LIGHT_GLSL}
vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}
float starLayer(vec3 D, float scale, float density, float pix) {
  vec3 q = D * scale;
  vec3 cell = floor(q);
  vec3 h = hash33(cell);
  if (h.x > density) return 0.0;
  vec3 sp = cell + 0.2 + 0.6 * hash33(cell + 13.7);
  float d = length(q - sp) / scale;
  float b = pow(h.y, 3.0) * 1.4 + 0.25;
  float rad = pix * (0.7 + 1.6 * h.y);
  float tw = 0.85 + 0.15 * sin(uTime * (2.0 + 6.0 * h.z) + h.x * 40.0);
  return b * tw * (1.0 - smoothstep(rad * 0.35, rad, d));
}
void main() {
  vec3 P = vWorldPos;
  vec3 toP = P - cameraPosition;
  float dist = length(toP);
  vec3 V = toP / dist;
  // direzione nel riferimento inerziale: il cilindro ha ruotato di -omega*t attorno a z
  float a = -uOmega * uTime * uStarSpeed;
  float ca = cos(a);
  float sa = sin(a);
  vec3 D = vec3(ca * V.x - sa * V.y, sa * V.x + ca * V.y, V.z);
  float pix = max(uPixelAngle, 1e-5);
  // fondo nero-viola e Via Lattea
  vec3 nmw = normalize(vec3(0.35, 0.55, 0.76));
  float band = exp(-pow(dot(D, nmw) / 0.22, 2.0));
  float mwn = vnoise3(D * 7.0) * 0.6 + vnoise3(D * 19.0) * 0.4;
  vec3 col = vec3(0.035, 0.022, 0.07) + vec3(0.11, 0.085, 0.17) * band * (0.35 + 0.9 * mwn);
  float s = starLayer(D, 70.0, 0.55, pix) + starLayer(D, 150.0, 0.5, pix) * 0.8 + starLayer(D, 320.0, 0.45, pix) * 0.6 * (0.4 + band);
  col += vec3(0.95, 0.93, 1.0) * s;
  // la Meta: disco bianco con bagliore
  if (uMetaOn > 0.5) {
    float ang = acos(clamp(dot(D, normalize(uMetaDir)), -1.0, 1.0));
    float disc = 1.0 - smoothstep(0.0045, 0.0045 + pix * 1.5, ang);
    float glare = exp(-ang / 0.035) * 0.9 + exp(-ang / 0.2) * 0.25;
    col += vec3(1.0, 0.99, 0.95) * (disc * 6.0 + glare);
  }
  if (uMoonOn > 0.5) {
    float ang = acos(clamp(dot(D, normalize(uMoonDir)), -1.0, 1.0));
    col = mix(col, vec3(0.78, 0.78, 0.74), 1.0 - smoothstep(0.0045, 0.0045 + pix * 1.5, ang));
  }
  // vetro: brina ai bordi, condensa, riflesso della foschia di taglio
  float th = cylThetaDeg(P);
  float edgeDist = min(th - uWinRange.x, uWinRange.y - th) * uR * PI / 180.0;
  float frost = (1.0 - smoothstep(4.0, 30.0, edgeDist)) * (0.5 + 0.5 * vnoise2(vec2(P.z, th * 11.0) * 0.12));
  float ribD = abs(mod(P.z + 20.0, 40.0) - 20.0);
  frost += (1.0 - smoothstep(1.2, 5.0, ribD)) * 0.35 * vnoise2(vec2(P.z * 0.6, th * 30.0));
  vec3 up = cylUp(P);
  float graz = 1.0 - abs(dot(-V, up));
  vec3 glassTint = vec3(0.16, 0.18, 0.28);
  col = mix(col, glassTint + uHazeColor * 0.25, clamp(pow(graz, 3.0) * 0.8, 0.0, 0.8));
  col = mix(col, vec3(0.62, 0.68, 0.78), clamp(frost, 0.0, 1.0) * 0.45);
  col = applyHaze(col, P, dist);
  gl_FragColor = vec4(col, 1.0);
}
`;

const GLASS_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export class Windows {
  readonly group = new Group();
  readonly glassMaterials: ShaderMaterial[] = [];
  /** Uniform propri delle finestre (velocità delle stelle, Meta, Luna). */
  readonly uniforms = {
    uOmega: { value: OMEGA },
    uStarSpeed: { value: 1 },
    uMetaDir: { value: new Vector3(1, 0, 0.08).normalize() },
    uMetaOn: { value: 1 },
    uMoonDir: { value: new Vector3(-0.6, 0.8, 0.05).normalize() },
    uMoonOn: { value: 0 },
  };

  constructor(world: WorldUniforms) {
    this.group.name = 'finestre';
    const windows = LAYOUT.strips.filter((s) => s.kind === 'finestra');
    const ironMat = createWorldMaterial(world, { kind: 'object', brush: 0.6, side: DoubleSide });
    const ribPos: number[] = [];
    const ribNor: number[] = [];
    const ribCol: number[] = [];
    for (const w of windows) {
      // vetro: griglia a raggio R (+ un soffio), suddivisa in 4 tratti per il culling
      const zSegs = 4;
      for (let k = 0; k < zSegs; k++) {
        const z0 = (k / zSegs) * LAYOUT.cylinder.length;
        const z1 = ((k + 1) / zSegs) * LAYOUT.cylinder.length;
        const geo = cylinderStrip(w.thetaStart, w.thetaEnd, z0, z1, R + 0.03, 24, 30);
        const mat = new ShaderMaterial({
          name: `vetro-${w.id}`,
          uniforms: { ...world, ...this.uniforms, uWinRange: { value: [w.thetaStart, w.thetaEnd] } },
          vertexShader: GLASS_VERT,
          fragmentShader: GLASS_FRAG,
        });
        this.glassMaterials.push(mat);
        const mesh = new Mesh(geo, mat);
        mesh.name = `vetro-${w.id}-${k}`;
        this.group.add(mesh);
      }
      // costoloni ogni 40 m (dove il Tappo non copre il vetro)
      const thMid = (w.thetaStart + w.thetaEnd) / 2;
      for (let z = 0; z <= LAYOUT.cylinder.length; z += WIN.ribSpacing) {
        if (surfaceHeight(z, thMid) > 0.5) continue;
        addCurvedBeam(ribPos, ribNor, ribCol, z, w.thetaStart, w.thetaEnd, WIN.ribWidth, WIN.ribHeight, 24, STEEL_DARK);
      }
      // travi di bordo lungo le due rive del vetro
      for (const edge of [w.thetaStart, w.thetaEnd]) {
        const dir = edge === w.thetaStart ? 1 : -1;
        const thA = edge + (dir * (WIN.edgeBeamWidth * 0.5)) / (R * DEG);
        for (let z = 0; z < LAYOUT.cylinder.length; z += 40) {
          if (surfaceHeight(z + 20, thMid) > 0.5) continue;
          addLongBeam(ribPos, ribNor, ribCol, z, z + 40, thA, WIN.edgeBeamWidth, 2.9, STEEL);
        }
      }
    }
    const ribs = new BufferGeometry();
    ribs.setAttribute('position', new BufferAttribute(new Float32Array(ribPos), 3));
    ribs.setAttribute('normal', new BufferAttribute(new Float32Array(ribNor), 3));
    ribs.setAttribute('aColor', new BufferAttribute(new Float32Array(ribCol), 4));
    ribs.computeBoundingSphere();
    const ribMesh = new Mesh(ribs, ironMat);
    ribMesh.name = 'costoloni';
    this.group.add(ribMesh);
  }

  setStarSpeed(k: number): void {
    this.uniforms.uStarSpeed.value = k;
  }
}

/** Striscia di superficie cilindrica (faccia verso l'asse). */
export function cylinderStrip(th0: number, th1: number, z0: number, z1: number, r: number, nTh: number, nZ: number): BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const v = new Vector3();
  for (let i = 0; i <= nZ; i++) {
    const z = z0 + ((z1 - z0) * i) / nZ;
    for (let j = 0; j <= nTh; j++) {
      const th = th0 + ((th1 - th0) * j) / nTh;
      const t = th * DEG;
      v.set(-r * Math.sin(t), -r * Math.cos(t), z);
      pos.push(v.x, v.y, v.z);
    }
  }
  for (let i = 0; i < nZ; i++) {
    for (let j = 0; j < nTh; j++) {
      const a = i * (nTh + 1) + j;
      const b = (i + 1) * (nTh + 1) + j;
      idx.push(a, b + 1, b, a, a + 1, b + 1);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

const _p = new Vector3();
const _q = new Vector3();

function pushQuad(pos: number[], nor: number[], col: number[], a: Vector3, b: Vector3, c: Vector3, d: Vector3, n: Vector3, color: [number, number, number]): void {
  for (const p of [a, b, c, a, c, d]) {
    pos.push(p.x, p.y, p.z);
    nor.push(n.x, n.y, n.z);
    col.push(color[0], color[1], color[2], 0);
  }
}

/** Costolone curvo che attraversa la finestra a quota z (sezione width x height). */
function addCurvedBeam(pos: number[], nor: number[], col: number[], z: number, th0: number, th1: number, width: number, height: number, segs: number, color: [number, number, number]): void {
  const za = z - width / 2;
  const zb = z + width / 2;
  for (let s = 0; s < segs; s++) {
    const ta = th0 + ((th1 - th0) * s) / segs;
    const tb = th0 + ((th1 - th0) * (s + 1)) / segs;
    const tm = (ta + tb) / 2;
    const up = new Vector3(Math.sin(tm * DEG), Math.cos(tm * DEG), 0);
    // sopra
    pushQuad(pos, nor, col, cylToWorld(za, ta, height), cylToWorld(za, tb, height), cylToWorld(zb, tb, height), cylToWorld(zb, ta, height), up, color);
    // fianchi (sud e nord)
    pushQuad(pos, nor, col, cylToWorld(za, ta, -0.2), cylToWorld(za, tb, -0.2), cylToWorld(za, tb, height), cylToWorld(za, ta, height), new Vector3(0, 0, -1), color);
    pushQuad(pos, nor, col, cylToWorld(zb, tb, -0.2), cylToWorld(zb, ta, -0.2), cylToWorld(zb, ta, height), cylToWorld(zb, tb, height), new Vector3(0, 0, 1), color);
  }
}

/** Trave longitudinale lungo il bordo della finestra. */
function addLongBeam(pos: number[], nor: number[], col: number[], z0: number, z1: number, thC: number, width: number, height: number, color: [number, number, number]): void {
  const dth = width / 2 / (R * DEG);
  const ta = thC - dth;
  const tb = thC + dth;
  const up = new Vector3(Math.sin(thC * DEG), Math.cos(thC * DEG), 0);
  const east = new Vector3(-up.y, up.x, 0);
  pushQuad(pos, nor, col, cylToWorld(z0, ta, height), cylToWorld(z1, ta, height), cylToWorld(z1, tb, height), cylToWorld(z0, tb, height), up, color);
  _p.copy(east).negate();
  pushQuad(pos, nor, col, cylToWorld(z0, ta, -0.3), cylToWorld(z1, ta, -0.3), cylToWorld(z1, ta, height), cylToWorld(z0, ta, height), _p, color);
  _q.copy(east);
  pushQuad(pos, nor, col, cylToWorld(z1, tb, -0.3), cylToWorld(z0, tb, -0.3), cylToWorld(z0, tb, height), cylToWorld(z1, tb, height), _q, color);
}
