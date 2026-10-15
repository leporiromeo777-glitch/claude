/**
 * Ombre morbide vicino alla camera (traccia «luce»).
 *
 * Una sorgente virtuale ortografica segue la camera e guarda lungo la luce principale (dal
 * nucleo della Linea, vedi `keyLightDir` in world/sky.ts): a ogni fotogramma disegna la
 * profondità degli oggetti vicini in una DepthTexture con confronto hardware; lo shader del
 * mondo la legge con un disco di Poisson ruotato (penombra morbida) e la fa sparire verso il
 * bordo della zona (`uOmbra.z`..`uOmbra.w`).
 *
 * Chi proietta ombra: le Mesh opache (anche InstancedMesh e SkinnedMesh), messe sul layer
 * `LAYER_OMBRE` da una scansione periodica della scena. Si escludono con `userData.ombra = false`
 * (e si forzano con `userData.ombra = true`); sono esclusi d'ufficio i materiali trasparenti, la
 * Linea, il Collare, il lago, i vetri e le InstancedMesh dei livelli lontani (nome che finisce con
 * `lod1`, `lod2`…: stanno oltre la zona d'ombra ma la loro sfera di contenimento copre il mondo,
 * quindi non si scarterebbero mai). Il terreno non proietta ombra (le sue maglie di 3 m darebbero bordi a
 * dente di sega; la sua forma la dice già la luce a bande): `PROFILI_OMBRE.*.terreno` lo riaccende.
 *
 * Accensione e qualità (la traccia «post» la collega alle impostazioni):
 *   ombre.impostaQualita('spente' | 'bassa' | 'media' | 'alta');
 *   ombre.attive = false;            // spegne senza cambiare la qualità
 *   uniforms.uLuce.value.x = 0.6;    // forza delle ombre nello shader (0..1)
 * Di notte (brace) il passaggio non si disegna e `uOmbra.x` vale 0.
 *
 * Si aggancia al ciclo come un `SistemaGioco` (metodo `render`, chiamato con la camera già al
 * suo posto e prima del disegno del mondo): vedi `installaLuce` in render/luce.ts.
 */
import {
  DepthFormat,
  DepthTexture,
  DoubleSide,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  MeshBasicMaterial,
  NearestFilter,
  OrthographicCamera,
  UnsignedByteType,
  UnsignedIntType,
  Vector3,
  WebGLRenderTarget,
  type Camera,
  type InstancedMesh,
  type Material,
  type Mesh,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { mappaOmbraVuota, type WorldUniforms } from './uniforms';

/** Layer degli oggetti che proiettano ombra (la camera principale non lo guarda). */
export const LAYER_OMBRE = 7;

export type QualitaOmbre = 'spente' | 'bassa' | 'media' | 'alta';

interface ProfiloOmbre {
  /** Lato della mappa (texel). */
  risoluzione: number;
  /** Mezzo lato della zona coperta (m). */
  raggio: number;
  /** Il terreno proietta ombra. */
  terreno: boolean;
  /** Ridisegna ogni n fotogrammi (1 = sempre). */
  ogni: number;
}

export const PROFILI_OMBRE: Record<Exclude<QualitaOmbre, 'spente'>, ProfiloOmbre> = {
  // (la mappa e la sua matrice si aggiornano insieme: ridisegnare a fotogrammi alterni non sposta
  // le ombre ferme, fa solo ritardare di un fotogramma quelle degli oggetti che si muovono)
  bassa: { risoluzione: 1024, raggio: 38, terreno: false, ogni: 3 },
  media: { risoluzione: 2048, raggio: 60, terreno: false, ogni: 2 },
  alta: { risoluzione: 3072, raggio: 85, terreno: false, ogni: 1 },
};

/**
 * Distanza della sorgente virtuale dal centro, lungo la luce (m): chi sta più a monte non
 * proietta nella zona (con la luce radente servirebbe un oggetto alto più di 40-70 m). Più
 * corta = meno oggetti del paese nel passaggio d'ombra.
 */
const DISTANZA = 160;
/** Nomi (prefissi) mai proiettanti. */
const ESCLUSI = /^(linea|collare|lago|vetro|bagliori|finestre|velo-in-primo-piano)/;

const _L = new Vector3();
const _c = new Vector3();
const _r = new Vector3();
const _u = new Vector3();
const _bias = new Matrix4();

export class Ombre {
  readonly camera = new OrthographicCamera(-50, 50, 50, -50, 1, 800);
  /** Ombre accese (indipendente dalla qualità). */
  attive = true;
  /** Ultimo passaggio: chiamate di disegno e triangoli (non contati in renderer.info del mondo). */
  readonly stats = { calls: 0, triangles: 0, proiettori: 0 };
  private _qualita: QualitaOmbre = 'media';
  private profilo: ProfiloOmbre = PROFILI_OMBRE.media;
  private target: WebGLRenderTarget | null = null;
  private readonly materiale: Material;
  private readonly dir = new Vector3(0, 1, 0);
  private dirValida = false;
  private fotogramma = 0;
  private ultimaScansione = -1e9;
  private readonly ultimoCentro = new Vector3(1e9, 1e9, 1e9);
  private readonly vuota: DepthTexture;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly scene: Scene,
    private readonly vista: Camera,
    private readonly u: WorldUniforms,
    qualita: QualitaOmbre = 'media',
  ) {
    this.materiale = new MeshBasicMaterial({ colorWrite: false, side: DoubleSide });
    this.materiale.name = 'ombre-profondita';
    this.camera.layers.set(LAYER_OMBRE);
    // la mappa vuota degli uniform (o una nuova se qualcuno l'ha tolta): legata finché non c'è
    // un passaggio d'ombra disegnato (di notte, a ombre spente, prima del primo fotogramma)
    const m = u.uOmbraMappa.value as DepthTexture | null;
    this.vuota = m && m.isDepthTexture && m.name === 'ombre-vuota' ? m : mappaOmbraVuota();
    u.uOmbraMappa.value = this.vuota;
    this.impostaQualita(qualita);
  }

  get qualita(): QualitaOmbre {
    return this._qualita;
  }

  /** Cambia la qualità ('spente' libera la mappa). */
  impostaQualita(q: QualitaOmbre): void {
    this._qualita = q;
    if (q === 'spente') {
      this.liberaTarget();
      this.u.uOmbra.value.x = 0;
      return;
    }
    const p = PROFILI_OMBRE[q];
    const cambiaTerreno = p.terreno !== this.profilo.terreno;
    this.profilo = p;
    if (!this.target || this.target.width !== p.risoluzione) {
      this.liberaTarget();
      const dt = new DepthTexture(p.risoluzione, p.risoluzione);
      dt.format = DepthFormat;
      dt.type = UnsignedIntType;
      dt.compareFunction = LessEqualCompare;
      dt.minFilter = LinearFilter;
      dt.magFilter = LinearFilter;
      dt.name = 'ombre-mappa';
      this.target = new WebGLRenderTarget(p.risoluzione, p.risoluzione, {
        depthTexture: dt,
        depthBuffer: true,
        stencilBuffer: false,
        type: UnsignedByteType,
        minFilter: NearestFilter,
        magFilter: NearestFilter,
        generateMipmaps: false,
      });
      this.target.texture.name = 'ombre-colore';
    }
    const s = p.raggio;
    this.camera.left = -s;
    this.camera.right = s;
    this.camera.top = s;
    this.camera.bottom = -s;
    this.camera.near = 1;
    this.camera.far = DISTANZA + s * 2.2;
    this.camera.updateProjectionMatrix();
    if (cambiaTerreno) this.ultimaScansione = -1e9;
  }

  private liberaTarget(): void {
    // lo shader torna sulla mappa vuota (mai null: vedi mappaOmbraVuota in uniforms.ts)
    this.u.uOmbra.value.x = 0;
    this.u.uOmbraMappa.value = this.vuota;
    if (!this.target) return;
    this.target.depthTexture?.dispose();
    this.target.dispose();
    this.target = null;
  }

  /** Mette (o toglie) sul layer delle ombre gli oggetti della scena. */
  scansiona(): void {
    let n = 0;
    const terreno = this.profilo.terreno;
    const visita = (o: Object3D): void => {
      if (ESCLUSI.test(o.name) && o.userData['ombra'] !== true) {
        o.traverse((x) => x.layers.disable(LAYER_OMBRE));
        return;
      }
      const m = o as Mesh;
      if (m.isMesh) {
        let si = true;
        const forza = o.userData['ombra'];
        if (forza === false) si = false;
        else if (forza !== true) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          if (mats.some((x) => !x || x.transparent || x.depthWrite === false || x.visible === false)) si = false;
          else if (!terreno && o.name.startsWith('terreno')) si = false;
          // istanze dei livelli lontani: stanno tutte oltre la zona d'ombra (i castagni lod1 partono
          // da 140 m) ma la loro sfera di contenimento copre il mondo e non si scartano mai
          else if ((o as InstancedMesh).isInstancedMesh && /lod[1-9]$/.test(o.name)) si = false;
        }
        if (si) {
          o.layers.enable(LAYER_OMBRE);
          n++;
        } else o.layers.disable(LAYER_OMBRE);
      }
      for (const c of o.children) visita(c);
    };
    visita(this.scene);
    this.stats.proiettori = n;
  }

  /** Direzione verso la luce al punto (x, y, z): stessa formula di `lineaLightDir` nello shader. */
  private direzione(x: number, y: number, z: number, out: Vector3): Vector3 {
    const r = Math.hypot(x, y);
    const ux = r > 1e-3 ? -x / r : 0;
    const uy = r > 1e-3 ? -y / r : 1;
    const rr = Math.max(r, 40);
    const sole = this.u.uSole.value;
    const up = rr * sole.y;
    const east = rr * sole.z;
    out.set(ux * up - uy * east, uy * up + ux * east, sole.x - z).normalize();
    return out;
  }

  /** Passaggio d'ombra: da chiamare a ogni fotogramma con la camera già al suo posto. */
  render(): void {
    const u = this.u;
    const notte = u.uNight.value;
    if (!this.attive || this._qualita === 'spente' || !this.target || notte > 0.8 || u.uSunIntensity.value < 0.25) {
      u.uOmbra.value.x = 0;
      this.stats.calls = 0;
      this.stats.triangles = 0;
      return;
    }
    this.fotogramma++;
    const tempo = performance.now();
    if (tempo - this.ultimaScansione > 500) {
      this.ultimaScansione = tempo;
      this.scansiona();
    }
    const p = this.profilo;
    const centro = _c.copy(this.vista.position);
    this.direzione(centro.x, centro.y, centro.z, _L);
    // direzione stabile: si aggiorna solo quando cambia di più di ~0.2 gradi (niente bordi che strisciano)
    let nuova = !this.dirValida || this.dir.dot(_L) < 0.999994;
    if (nuova) {
      this.dir.copy(_L);
      this.dirValida = true;
    }
    // fotogrammi alterni, salvo dopo un salto della camera (teletrasporto, taglio di regia)
    const saltata = this.ultimoCentro.distanceToSquared(centro) > (p.raggio * 0.2) ** 2;
    if (!nuova && !saltata && p.ogni > 1 && this.fotogramma % p.ogni !== 0) return;
    this.ultimoCentro.copy(centro);
    const L = this.dir;
    // base della vista della luce, poi il centro agganciato alla griglia dei texel
    const ref = Math.abs(L.z) < 0.95 ? _u.set(0, 0, 1) : _u.set(1, 0, 0);
    const right = _r.crossVectors(ref, L).normalize();
    const upV = _u.crossVectors(L, right).normalize();
    const texel = (2 * p.raggio) / p.risoluzione;
    const x = centro.dot(right);
    const y = centro.dot(upV);
    const dx = Math.round(x / texel) * texel - x;
    const dy = Math.round(y / texel) * texel - y;
    const agganciato = centro.clone().addScaledVector(right, dx).addScaledVector(upV, dy);
    const cam = this.camera;
    cam.position.copy(agganciato).addScaledVector(L, DISTANZA);
    cam.up.copy(upV);
    cam.lookAt(agganciato);
    cam.updateMatrixWorld();

    const renderer = this.renderer;
    const prima = renderer.getRenderTarget();
    const override = this.scene.overrideMaterial;
    const info = renderer.info.render;
    const c0 = info.calls;
    const t0 = info.triangles;
    renderer.setRenderTarget(this.target);
    renderer.clear(false, true, false);
    this.scene.overrideMaterial = this.materiale;
    renderer.render(this.scene, cam);
    this.scene.overrideMaterial = override;
    renderer.setRenderTarget(prima);
    this.stats.calls = info.calls - c0;
    this.stats.triangles = info.triangles - t0;

    // mondo -> [0,1]^3, con un piccolo bias di profondità (5 cm)
    const prof = cam.far - cam.near;
    _bias.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5 - 0.05 / prof, 0, 0, 0, 1);
    u.uOmbraMatrice.value.copy(_bias).multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
    u.uOmbraMappa.value = this.target.depthTexture ?? this.vuota;
    u.uOmbra.value.set(1, 1 / p.risoluzione, p.raggio * 0.62, p.raggio * 0.94);
    u.uOmbraCentro.value.set(centro.x, centro.y, centro.z, texel);
  }

  dispose(): void {
    this.liberaTarget();
    this.materiale.dispose();
  }
}
