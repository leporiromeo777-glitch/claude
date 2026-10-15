/**
 * La Linea: il filamento luminoso lungo l'asse che fa da sole.
 * - nucleo: un cilindro sottile emissivo (acceso fino a `uLineaIgnite`, brace blu oltre), in HDR:
 *   sopra 1 la post lo sbianca e il bagliore lo apre in un alone vero;
 * - alone: un nastro rivolto alla camera con tre profili (filo, alone caldo, velo largo), in additivo;
 *   l'alone caldo è più dorato verso il bordo, come l'aria scaldata attorno al filo;
 * - la "miccia": all'alba e al tramonto la punta accesa brilla di più.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  ShaderMaterial,
  Vector3,
} from 'three';
import { LAYOUT } from '../world/constants';
import type { SkyState } from '../world/sky';
import type { WorldUniforms } from './uniforms';

const LIN = LAYOUT.linea;

/** Quanto il nucleo acceso supera il bianco (HDR): regola anche la forza del bagliore. */
export const LINEA_HDR = 2.6;

export class Linea {
  readonly group = new Group();
  readonly uniforms = {
    uCore: { value: new Vector3(1, 0.98, 0.92) },
    uGlow: { value: new Vector3(1, 0.9, 0.75) },
    uEmber: { value: new Vector3(0.43, 0.52, 1.0) },
    uBright: { value: 1 },
    uHalfWidth: { value: LIN.haloRadius * 3.2 },
    uHdr: { value: LINEA_HDR },
  };

  constructor(world: WorldUniforms) {
    this.group.name = 'linea';
    const len = LIN.zEnd - LIN.zStart;
    const core = new CylinderGeometry(LIN.coreRadius, LIN.coreRadius, len, 10, 1, true);
    core.rotateX(Math.PI / 2);
    core.translate(0, 0, LIN.zStart + len / 2);
    const coreMat = new ShaderMaterial({
      name: 'linea-nucleo',
      uniforms: { ...this.uniforms, uLineaIgnite: world.uLineaIgnite, uTime: world.uTime, uNight: world.uNight },
      vertexShader: /* glsl */ `
        varying float vZ;
        void main() {
          vZ = position.z;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uCore; uniform vec3 uEmber; uniform float uLineaIgnite; uniform float uBright; uniform float uTime; uniform float uHdr;
        varying float vZ;
        void main() {
          float lit = 1.0 - smoothstep(uLineaIgnite - 6.0, uLineaIgnite + 6.0, vZ);
          float tip = exp(-pow((vZ - uLineaIgnite) / 30.0, 2.0)) * step(1.0, uLineaIgnite);
          // un filo vivo: pulsazioni lente lungo l'asse, appena percettibili
          float vivo = 0.94 + 0.06 * sin(vZ * 0.013 - uTime * 0.7) * sin(vZ * 0.0041 + uTime * 0.23);
          vec3 c = mix(uEmber * 1.1, uCore * uBright * uHdr * vivo, lit) + vec3(1.0, 0.85, 0.6) * tip * 2.2;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const coreMesh = new Mesh(core, coreMat);
    coreMesh.name = 'linea-nucleo';
    coreMesh.frustumCulled = false;
    this.group.add(coreMesh);

    // alone: nastro lungo l'asse, allargato verso la camera nel vertex shader
    const seg = 240;
    const pos = new Float32Array((seg + 1) * 2 * 3);
    const side = new Float32Array((seg + 1) * 2);
    for (let k = 0; k <= seg; k++) {
      const z = LIN.zStart + (k / seg) * len;
      for (let s = 0; s < 2; s++) {
        const i = k * 2 + s;
        pos[i * 3] = 0;
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = z;
        side[i] = s === 0 ? -1 : 1;
      }
    }
    const idx: number[] = [];
    for (let k = 0; k < seg; k++) {
      const a = k * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const halo = new BufferGeometry();
    halo.setAttribute('position', new BufferAttribute(pos, 3));
    halo.setAttribute('aSide', new BufferAttribute(side, 1));
    halo.setIndex(idx);
    const haloMat = new ShaderMaterial({
      name: 'linea-alone',
      uniforms: { ...this.uniforms, uLineaIgnite: world.uLineaIgnite, uTime: world.uTime, uNight: world.uNight },
      vertexShader: /* glsl */ `
        attribute float aSide;
        uniform float uHalfWidth;
        varying float vSide;
        varying float vZ;
        varying float vDist;
        varying float vHw;
        void main() {
          vec3 P = position;
          vec3 toCam = cameraPosition - P;
          vec3 w = cross(vec3(0.0, 0.0, 1.0), toCam);
          float wl = length(w);
          w = wl > 1e-3 ? w / wl : vec3(1.0, 0.0, 0.0);
          // l'alone non deve mai riempire lo schermo quando si è vicini all'asse
          float hw = min(uHalfWidth, max(6.0, length(toCam.xy) * 0.45));
          P += w * aSide * hw;
          vSide = aSide;
          vZ = position.z;
          vDist = length(toCam);
          vHw = hw;
          gl_Position = projectionMatrix * viewMatrix * vec4(P, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uGlow; uniform vec3 uEmber; uniform float uLineaIgnite; uniform float uBright; uniform float uNight; uniform float uHdr;
        varying float vSide;
        varying float vZ;
        varying float vDist;
        varying float vHw;
        void main() {
          float d = abs(vSide);
          float inner = exp(-pow(d / 0.04, 2.0));
          float mid = exp(-pow(d / 0.15, 2.0));
          float outer = exp(-pow(d / 0.5, 2.0));
          float lit = 1.0 - smoothstep(uLineaIgnite - 25.0, uLineaIgnite + 25.0, vZ);
          float tip = exp(-pow((vZ - uLineaIgnite) / 60.0, 2.0)) * step(1.0, uLineaIgnite) * (1.0 - step(2990.0, uLineaIgnite));
          // alone caldo: bianco-oro sul filo, ambra verso il bordo
          vec3 caldo = mix(uGlow, uGlow * vec3(1.05, 0.82, 0.58), smoothstep(0.03, 0.4, d));
          vec3 day = caldo * (inner * 0.9 * uHdr * 0.55 + mid * 0.3 + outer * 0.09) * uBright;
          vec3 ember = uEmber * (inner * 0.7 + mid * 0.26 + outer * 0.08);
          vec3 c = mix(ember, day, lit) + vec3(1.0, 0.8, 0.5) * tip * (inner * 1.6 + mid * 0.8 + outer * 0.2);
          gl_FragColor = vec4(c, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const haloMesh = new Mesh(halo, haloMat);
    haloMesh.name = 'linea-alone';
    haloMesh.frustumCulled = false;
    haloMesh.renderOrder = 10;
    this.group.add(haloMesh);
  }

  applySky(s: SkyState): void {
    this.uniforms.uCore.value.set(...s.lineaCore);
    this.uniforms.uGlow.value.set(...s.lineaGlow);
    this.uniforms.uBright.value = s.lineaBrightness;
  }
}
