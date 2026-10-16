/**
 * Bagliori dei lumi: finestre accese, lanterne, lampioni. Punti in additivo con
 * dimensione in pixel limitata, così restano leggibili anche dall'altra parte
 * del cielo ("luci notturne" fra i segnali di cielo). Di giorno quasi spenti.
 * Fornisce anche gli 8 lumi più vicini allo shader del mondo (luce locale).
 * Un lume può avere una direzione (la normale del vetro di una finestra, traccia «paese»): il
 * bagliore si spegne quando la finestra guarda dall'altra parte, così le finestre sul retro non
 * fanno puntini attorno alla casa (il bagliore è spinto verso la camera e passa i muri).
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import { MAX_LAMPS, type WorldUniforms } from './uniforms';

export class LampGlows {
  readonly points: Points;
  private positions: Vector3[] = [];
  private dirs: (Vector3 | null)[] = [];
  private material: ShaderMaterial;

  constructor(private world: WorldUniforms) {
    this.material = new ShaderMaterial({
      name: 'bagliori-lumi',
      uniforms: { uNight: world.uNight, uLampColor: world.uLampColor, uPixelAngle: world.uPixelAngle, uTime: world.uTime, uHazeColor: world.uHazeColor },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aSeed;
        attribute vec3 aDir;
        uniform float uPixelAngle;
        uniform float uTime;
        varying float vFade;
        varying float vFlicker;
        varying float vFacing;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = length(mv.xyz);
          // finestra (direzione non nulla): acceso solo se il vetro guarda verso la camera
          float lD = length(aDir);
          vFacing = lD < 0.5 ? 1.0 : smoothstep(-0.05, 0.3, dot(mat3(modelViewMatrix) * aDir / lD, -mv.xyz / max(dist, 1e-3)));
          // spinge il bagliore verso la camera: non viene coperto dal muro o dal terreno lontano
          mv.xyz *= max(0.0, 1.0 - min(6.0 + dist * 0.004, dist * 0.5) / max(dist, 1e-3));
          float px = aSize / max(dist * uPixelAngle, 1e-4);
          // alone largo attorno al nucleo (come le lanterne dei bozzetti), più contenuto da lontano
          gl_PointSize = vFacing > 0.0 ? clamp(px * 4.2, 4.0, 46.0) : 0.0;
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
        varying float vFacing;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c) * 2.0;
          // nucleo caldo quasi bianco, alone ambrato morbido che sfuma nella foschia
          float core = exp(-d * d * 16.0) * 1.5;
          float halo = exp(-d * d * 3.2) * 0.42 + exp(-d * 2.2) * 0.12;
          float k = mix(0.04, 1.0, uNight) * vFlicker * vFacing;
          vec3 lamp = mix(uHazeColor, uLampColor * 1.15, 0.35 + 0.65 * vFade);
          vec3 col = (lamp * halo + mix(lamp, vec3(1.0, 0.93, 0.8), 0.5) * core) * k;
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

  /**
   * Imposta tutti i lumi (sostituisce i precedenti). `dirs` (facoltativo): la direzione verso cui
   * guarda ogni lume (normale del vetro), null = in tutte le direzioni (lanterne, lampioni).
   */
  setLamps(list: Vector3[], sizes?: number[], dirs?: (Vector3 | null)[]): void {
    this.positions = list.map((p) => p.clone());
    this.dirs = list.map((_, i) => dirs?.[i]?.clone().normalize() ?? null);
    const n = list.length;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const seed = new Float32Array(n);
    const dir = new Float32Array(n * 3);
    list.forEach((p, i) => {
      pos.set([p.x, p.y, p.z], i * 3);
      size[i] = sizes?.[i] ?? 0.6;
      seed[i] = (i * 0.618) % 1;
      const d = this.dirs[i];
      if (d) dir.set([d.x, d.y, d.z], i * 3);
    });
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('aSize', new BufferAttribute(size, 1));
    g.setAttribute('aSeed', new BufferAttribute(seed, 1));
    g.setAttribute('aDir', new BufferAttribute(dir, 3));
    this.points.geometry.dispose();
    this.points.geometry = g;
  }

  /** Aggiunge lumi a quelli esistenti (es. nuovi edifici, lanterne delle Fade). */
  addLamps(list: Vector3[], sizes?: number[], dirs?: (Vector3 | null)[]): void {
    const oldSizes = (this.points.geometry.getAttribute('aSize')?.array as Float32Array | undefined) ?? new Float32Array(0);
    this.setLamps([...this.positions, ...list], [...Array.from(oldSizes), ...(sizes ?? list.map(() => 0.6))], [...this.dirs, ...list.map((_, i) => dirs?.[i] ?? null)]);
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
