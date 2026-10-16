/**
 * Bagliori dei lumi: finestre accese, lanterne, lampioni. Punti in additivo con
 * dimensione in pixel limitata, così restano leggibili anche dall'altra parte
 * del cielo ("luci notturne" fra i segnali di cielo). Di giorno quasi spenti.
 * Fornisce anche gli 8 lumi più vicini allo shader del mondo (luce locale).
 * Un lume può avere una direzione (la normale del vetro di una finestra, traccia «paese»): il
 * bagliore si spegne quando la finestra guarda dall'altra parte, così le finestre sul retro non
 * fanno puntini attorno alla casa (il bagliore è spinto verso la camera e passa i muri); si vede
 * però anche di taglio (fino a poco oltre il piano del muro).
 * I lumi più vicini (fino a 24 entro 120 m) lasciano una pozza di luce calda sul mondo (`uPozze`);
 * quelli dell'altra metà del cilindro si vedono più grandi, col bagliore della post.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from 'three';
import { MAX_LAMPS, MAX_POZZE, type WorldUniforms } from './uniforms';

/** Raggio (m) entro cui i lumi lasciano la pozza di luce sul mondo. */
const RAGGIO_POZZE = 120;
// (l'intensità delle pozze è POZZE_FORZA in `lampLight`, shaders/common.ts)

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
          vFacing = lD < 0.5 ? 1.0 : smoothstep(-0.25, 0.12, dot(mat3(modelViewMatrix) * aDir / lD, -mv.xyz / max(dist, 1e-3)));
          // spinge il bagliore verso la camera: non viene coperto dal muro o dal terreno lontano
          mv.xyz *= max(0.0, 1.0 - min(6.0 + dist * 0.004, dist * 0.5) / max(dist, 1e-3));
          float px = aSize / max(dist * uPixelAngle, 1e-4);
          // alone largo attorno al nucleo (come le lanterne dei bozzetti), più contenuto da lontano
          // i lumi dell'altra metà (oltre ~700 m) a dimensione apparente doppia: il paese acceso appeso
          float lontano = 1.0 + smoothstep(600.0, 1100.0, dist);
          gl_PointSize = vFacing > 0.0 ? clamp(px * 4.2 * lontano, 4.0 * lontano, 46.0) : 0.0;
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

  /** Distanze e indici dei lumi più vicini (riusati: niente allocazioni a ogni fotogramma). */
  private readonly vicD = new Float64Array(MAX_POZZE);
  private readonly vicI = new Int32Array(MAX_POZZE);

  /**
   * Copia negli uniform i lumi più vicini alla camera: le pozze di luce calda (`uPozze`, fino a 24
   * entro 120 m, i più vicini prima) e gli 8 più vicini entro 140 m in `uLamps` (personaggi, Fade).
   */
  updateNearest(cam: Vector3): void {
    const d2 = this.vicD;
    const id = this.vicI;
    let n = 0;
    const lim = 140 * 140;
    for (let k = 0; k < this.positions.length; k++) {
      const d = this.positions[k]!.distanceToSquared(cam);
      if (d > lim) continue;
      if (n === MAX_POZZE && d >= d2[n - 1]!) continue;
      // inserimento ordinato
      let j = n < MAX_POZZE ? n++ : n - 1;
      while (j > 0 && d2[j - 1]! > d) {
        d2[j] = d2[j - 1]!;
        id[j] = id[j - 1]!;
        j--;
      }
      d2[j] = d;
      id[j] = k;
    }
    const arr = this.world.uLamps.value;
    for (let i = 0; i < MAX_LAMPS; i++) {
      const p = i < n ? this.positions[id[i]!]! : null;
      if (p) arr[i]!.set(p.x, p.y, p.z, 1.6);
      else arr[i]!.set(0, 0, 0, 0);
    }
    const pozze = this.world.uPozze?.value;
    if (!pozze) return;
    const limP = RAGGIO_POZZE * RAGGIO_POZZE;
    let m = 0;
    for (let i = 0; i < n && m < MAX_POZZE; i++) {
      if (d2[i]! > limP) break;
      const p = this.positions[id[i]!]!;
      // w = 1 + distanza dalla camera (in ordine crescente: lo shader salta i lumi lontani dal frammento)
      pozze[m++]!.set(p.x, p.y, p.z, 1 + Math.sqrt(d2[i]!));
    }
    for (; m < MAX_POZZE; m++) pozze[m]!.set(0, 0, 0, 0);
  }
}
