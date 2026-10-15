/**
 * Bagliori dei lumi: finestre accese, lanterne, lampioni. Punti in additivo con
 * dimensione in pixel limitata, così restano leggibili anche dall'altra parte
 * del cielo ("luci notturne" fra i segnali di cielo). Di giorno quasi spenti.
 * Fornisce anche gli 8 lumi più vicini allo shader del mondo (luce locale).
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import { MAX_LAMPS, type WorldUniforms } from './uniforms';

export class LampGlows {
  readonly points: Points;
  private positions: Vector3[] = [];
  private material: ShaderMaterial;

  constructor(private world: WorldUniforms) {
    this.material = new ShaderMaterial({
      name: 'bagliori-lumi',
      uniforms: { uNight: world.uNight, uLampColor: world.uLampColor, uPixelAngle: world.uPixelAngle, uTime: world.uTime, uHazeColor: world.uHazeColor },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aSeed;
        uniform float uPixelAngle;
        uniform float uTime;
        varying float vFade;
        varying float vFlicker;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mv.xyz);
          // spinge il bagliore verso la camera: non viene coperto dal muro o dal terreno lontano
          mv.xyz *= max(0.0, 1.0 - min(6.0 + dist * 0.004, dist * 0.5) / max(dist, 1e-3));
          float px = aSize / max(dist * uPixelAngle, 1e-4);
          gl_PointSize = clamp(px * 3.0, 4.0, 28.0);
          vFade = exp(-dist / 2500.0);
          vFlicker = 0.85 + 0.15 * sin(uTime * (3.0 + aSeed * 4.0) + aSeed * 30.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uNight;
        uniform vec3 uLampColor;
        uniform vec3 uHazeColor;
        varying float vFade;
        varying float vFlicker;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          float core = exp(-d * d * 9.0) * 1.4;
          float halo = exp(-d * d * 2.5) * 0.5;
          float k = (core + halo) * mix(0.04, 1.0, uNight) * vFlicker;
          vec3 col = mix(uHazeColor, uLampColor * 1.2, 0.35 + 0.65 * vFade) * k;
          gl_FragColor = vec4(col, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.points = new Points(new BufferGeometry(), this.material);
    this.points.name = 'bagliori';
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /** Imposta tutti i lumi (sostituisce i precedenti). */
  setLamps(list: Vector3[], sizes?: number[]): void {
    this.positions = list.map((p) => p.clone());
    const n = list.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    list.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      size[i] = sizes?.[i] ?? 0.6;
      seed[i] = (i * 0.618) % 1;
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    this.points.geometry.dispose();
    this.points.geometry = g;
  }

  get count(): number {
    return this.positions.length;
  }

  /** Copia negli uniform i lumi più vicini alla camera (luce locale sul terreno e sui muri). */
  updateNearest(cam: Vector3): void {
    const arr = this.world.uLamps.value;
    const best: { d: number; p: Vector3 }[] = [];
    for (const p of this.positions) {
      const d = p.distanceToSquared(cam);
      if (d > 140 * 140) continue;
      if (best.length < MAX_LAMPS) {
        best.push({ d, p });
        best.sort((a, b) => a.d - b.d);
      } else if (d < best[best.length - 1]!.d) {
        best[best.length - 1] = { d, p };
        best.sort((a, b) => a.d - b.d);
      }
    }
    for (let i = 0; i < MAX_LAMPS; i++) {
      const e = best[i];
      if (e) arr[i]!.set(e.p.x, e.p.y, e.p.z, 1.6);
      else arr[i]!.set(0, 0, 0, 0);
    }
  }
}
