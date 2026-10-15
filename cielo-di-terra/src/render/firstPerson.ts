/**
 * Il Velo in prima persona: traversa di legno tenuta con i guanti, due montanti,
 * il bordo della tela in alto e la nappina rossa che pende dalla parte della
 * deriva (Coriolis) e annuncia il capovolgimento del "giù".
 *
 * Scena separata con camera propria (disegnata dopo il mondo, con il depth
 * pulito), così il modello non entra nei muri.
 */
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, PerspectiveCamera, Scene, ShaderMaterial, Vector3 } from 'three';
import { GeomBuilder, PRIMS } from './geomBuilder';
import type { RGB } from './palette';

const _t = new Matrix4();
const _v = new Vector3();

function cylinderBetween(b: GeomBuilder, a: Vector3, c: Vector3, radius: number, color: RGB): void {
  const dir = c.clone().sub(a);
  const len = dir.length();
  const m = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const axis = up.clone().cross(dir).normalize();
  const ang = Math.acos(Math.max(-1, Math.min(1, up.dot(dir) / len)));
  m.makeTranslation(a.x, a.y, a.z);
  if (axis.lengthSq() > 1e-8) m.multiply(new Matrix4().makeRotationAxis(axis, ang));
  m.scale(_v.set(radius, len, radius));
  b.add(PRIMS.cylinder(8), m, color);
}

export class FirstPersonVelo {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly uniforms = {
    uLightView: { value: new Vector3(0.3, 0.8, 0.4).normalize() },
    uSun: { value: new Vector3(1, 0.95, 0.85) },
    uSunI: { value: 1 },
    uAmb: { value: new Vector3(0.55, 0.6, 0.7) },
    uNight: { value: 0 },
  };
  private rig = new Group();
  private tassel = new Group();
  private tasselAngle = 0;
  private tasselVel = 0;
  private tasselPitch = 0;
  private open = 0;
  private time = 0;

  constructor(fov: number, aspect: number) {
    this.camera = new PerspectiveCamera(fov, aspect, 0.02, 10);
    const mat = new ShaderMaterial({
      name: 'velo-primo-piano',
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 aColor;
        varying vec3 vN;
        varying vec4 vC;
        varying vec3 vP;
        void main() {
          vN = normalize(normalMatrix * normal);
          vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vP = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uLightView; uniform vec3 uSun; uniform float uSunI; uniform vec3 uAmb; uniform float uNight;
        varying vec3 vN; varying vec4 vC; varying vec3 vP;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
          vec3 N = normalize(vN);
          if (!gl_FrontFacing) N = -N;
          float ndl = dot(N, uLightView) * 0.5 + 0.5;
          float b = floor(ndl * 3.0) / 3.0;
          b = mix(ndl, b + smoothstep(0.4, 0.6, fract(ndl * 3.0)) / 3.0, 0.7);
          vec3 col = vC.rgb * (uAmb * 0.75 + uSun * uSunI * b * 0.7);
          // tela: controluce della Linea, cuciture e trama
          if (vC.a > 0.5) {
            col = vC.rgb * (uAmb * 0.55 + uSun * uSunI * 0.62);
            float st = step(0.92, fract((vP.x + vP.z) * 9.0)) * step(0.5, fract(vP.y * 30.0));
            col *= 1.0 - st * 0.25;
            col *= 0.95 + 0.1 * hash(floor(vP.xy * 160.0));
          }
          col *= 1.0 - 0.45 * uNight;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });

    const b = new GeomBuilder();
    const wood: RGB = [0.5, 0.34, 0.2];
    const glove: RGB = [0.4, 0.27, 0.17];
    const sleeve: RGB = [0.36, 0.43, 0.29];
    const barY = -0.42;
    const barZ = -0.56;
    // traversa sottile
    cylinderBetween(b, new Vector3(-0.46, barY, barZ), new Vector3(0.46, barY, barZ), 0.013, wood);
    // fasciature di cuoio
    for (const x of [-0.07, 0.07]) cylinderBetween(b, new Vector3(x - 0.02, barY, barZ), new Vector3(x + 0.02, barY, barZ), 0.017, [0.48, 0.32, 0.19]);
    // guanti: palmo allungato e dita chiuse sulla traversa, polso e manica verso gli angoli in basso
    for (const s of [-1, 1]) {
      _t.makeTranslation(s * 0.2, barY + 0.012, barZ + 0.022).multiply(new Matrix4().makeRotationZ(s * 0.25)).scale(_v.set(0.05, 0.032, 0.055));
      b.add(PRIMS.blob(2), _t.clone(), glove);
      _t.makeTranslation(s * 0.2, barY - 0.004, barZ - 0.012).scale(_v.set(0.045, 0.02, 0.024));
      b.add(PRIMS.blob(2), _t.clone(), [0.36, 0.24, 0.15]);
      cylinderBetween(b, new Vector3(s * 0.205, barY - 0.01, barZ + 0.05), new Vector3(s * 0.25, barY - 0.07, barZ + 0.13), 0.032, glove);
      cylinderBetween(b, new Vector3(s * 0.25, barY - 0.07, barZ + 0.13), new Vector3(s * 0.36, barY - 0.3, barZ + 0.42), 0.05, sleeve);
    }
    // montanti corti che salgono verso gli angoli alti dello schermo
    const topL = new Vector3(-0.86, 0.5, -1.0);
    const topR = new Vector3(0.86, 0.5, -1.0);
    cylinderBetween(b, new Vector3(-0.44, barY, barZ), topL, 0.011, wood);
    cylinderBetween(b, new Vector3(0.44, barY, barZ), topR, 0.011, wood);
    const frame = b.build();
    const frameMesh = new Mesh(frame, mat);
    this.rig.add(frameMesh);

    // tela: visibile in alto, soprattutto agli angoli dove arrivano i montanti
    const cloth = new BufferGeometry();
    const cp: number[] = [];
    const cc: number[] = [];
    const cn: number[] = [];
    const segs = 16;
    const edgeY = (x: number) => 0.68 - 0.2 * Math.pow(Math.min(1, Math.abs(x) / 0.9), 2);
    for (let i = 0; i < segs; i++) {
      const x0 = -1.3 + (2.6 * i) / segs;
      const x1 = -1.3 + (2.6 * (i + 1)) / segs;
      const quad = [
        [x0, edgeY(x0), -1.02],
        [x1, edgeY(x1), -1.02],
        [x1 * 1.15, 1.25, -0.8],
        [x0 * 1.15, 1.25, -0.8],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        cp.push(...(quad[k] as [number, number, number]));
        cc.push(0.96, 0.91, 0.79, 1);
        cn.push(0, -0.75, 0.66);
      }
    }
    // orlo cucito, più scuro
    for (let i = 0; i < segs; i++) {
      const x0 = -1.3 + (2.6 * i) / segs;
      const x1 = -1.3 + (2.6 * (i + 1)) / segs;
      const quad = [
        [x0, edgeY(x0) - 0.012, -1.019],
        [x1, edgeY(x1) - 0.012, -1.019],
        [x1, edgeY(x1) + 0.012, -1.019],
        [x0, edgeY(x0) + 0.012, -1.019],
      ];
      for (const k of [0, 1, 2, 0, 2, 3]) {
        cp.push(...(quad[k] as [number, number, number]));
        cc.push(0.78, 0.7, 0.55, 0);
        cn.push(0, -0.3, 1);
      }
    }
    cloth.setAttribute('position', new BufferAttribute(new Float32Array(cp), 3));
    cloth.setAttribute('normal', new BufferAttribute(new Float32Array(cn), 3));
    cloth.setAttribute('aColor', new BufferAttribute(new Float32Array(cc), 4));
    const clothMesh = new Mesh(cloth, mat);
    this.rig.add(clothMesh);

    // nappina: cordino + fiocco rosso, appesa al montante destro
    const tb = new GeomBuilder();
    cylinderBetween(tb, new Vector3(0, 0, 0), new Vector3(0, -0.12, 0), 0.003, [0.5, 0.15, 0.1]);
    _t.makeTranslation(0, -0.12, 0).scale(_v.set(0.013, 0.013, 0.013));
    tb.add(PRIMS.blob(1), _t.clone(), [0.62, 0.18, 0.12]);
    _t.makeTranslation(0, -0.2, 0).multiply(new Matrix4().makeRotationX(Math.PI)).scale(_v.set(0.022, 0.085, 0.022)).multiply(new Matrix4().makeTranslation(0, -0.5, 0));
    tb.add(PRIMS.frustum(0.25, 8), _t.clone(), [0.78, 0.2, 0.13]);
    const tasselMesh = new Mesh(tb.build(), mat);
    this.tassel.add(tasselMesh);
    this.tassel.position.set(0.6, 0.1, -0.79);
    this.rig.add(this.tassel);

    this.scene.add(this.rig);
    this.rig.visible = false;
  }

  setAspect(fov: number, aspect: number): void {
    this.camera.fov = fov;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  /**
   * @param openAmount apertura 0..1 del Velo
   * @param lateral accelerazione laterale apparente (destra dello schermo, m/s^2)
   * @param vertical accelerazione apparente verso il basso dello schermo (m/s^2)
   * @param roll errore di rollio della camera (rad): la nappina lo anticipa
   */
  update(dt: number, openAmount: number, lateral: number, vertical: number, roll: number): void {
    this.open = openAmount;
    const e = openAmount * openAmount * (3 - 2 * openAmount);
    this.rig.visible = openAmount > 0.01;
    this.rig.position.set(0, -0.75 * (1 - e), 0.1 * (1 - e));
    this.rig.rotation.x = -0.25 * (1 - e);
    // pendolo smorzato verso la direzione della gravità apparente nello schermo
    const g = Math.max(0.5, vertical);
    const target = Math.atan2(-lateral, g) + roll * 0.6;
    const k = 30;
    const c = 4.5;
    this.tasselVel += (k * (target - this.tasselAngle) - c * this.tasselVel) * dt;
    this.tasselAngle += this.tasselVel * dt;
    this.time += dt;
    this.tasselPitch += (0.15 * Math.sin(this.time * 3) - this.tasselPitch) * Math.min(1, dt * 2);
    this.tassel.rotation.set(this.tasselPitch, 0, this.tasselAngle);
  }

  get tasselLean(): number {
    return this.tasselAngle;
  }

  get openAmount(): number {
    return this.open;
  }
}
