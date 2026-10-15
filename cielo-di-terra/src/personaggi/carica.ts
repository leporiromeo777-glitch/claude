/**
 * Caricamento libero dei personaggi generati per la pagina di prova (tools/personaggi/prova.ts): per il
 * gioco si usano precaricaPersonaggi + creaPersonaggio (precarica.ts, fabbrica.ts).
 * Modelli: public/personaggi/<id>.glb, prodotti da tools/personaggi/processa.py: una SkinnedMesh per livello di dettaglio («lod0», «lod1») sullo
 * stesso scheletro, un solo materiale con la texture dipinta.
 *
 * Ogni chiamata dà una copia indipendente (SkeletonUtils.clone) con il suo animatore; il GLB si
 * scarica una volta sola per URL.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneScheletro } from 'three/addons/utils/SkeletonUtils.js';
import { AnimatorePersonaggio, type OpzioniAnimatore, type StatoPersonaggio } from './animatore';
import { rampaToni } from './materiale';

export type StileMateriale = 'toon' | 'lambert' | 'originale';

export interface OpzioniCaricamento extends OpzioniAnimatore {
  /**
   * 'toon' (predefinito): tre campiture morbide come il resto della libreria;
   * 'lambert': diffuso continuo; 'originale': il materiale PBR del GLB.
   */
  stile?: StileMateriale;
  /**
   * 'srgb' (predefinito, three.js con la gestione del colore) oppure 'grezzo' per il motore del gioco,
   * che lavora con ColorManagement spento e colori già in sRGB (la texture non va decodificata).
   */
  colore?: 'srgb' | 'grezzo';
  /** distanza (m) oltre la quale si passa al LOD1 */
  distanzaLod?: number;
  /** tinta moltiplicata sulla texture (varianti dei velati generici) */
  tinta?: THREE.ColorRepresentation;
  /**
   * se il personaggio riceve ombre (predefinito false: l'ombra delle braccia sulle vesti, a toni piatti,
   * fa macchie scure che non c'entrano con i bozzetti; le proietta comunque sul terreno)
   */
  riceveOmbre?: boolean;
}

export interface ModelloPersonaggio {
  /** da aggiungere alla scena: y = 0 è il suolo, guarda +Z */
  readonly gruppo: THREE.Group;
  readonly animatore: AnimatorePersonaggio;
  readonly lod: readonly THREE.SkinnedMesh[];
  /** altezza (m) dal GLB */
  readonly altezza: number;
  /** anima e, se c'è la camera, sceglie il livello di dettaglio */
  update(dt: number, stato?: StatoPersonaggio, camera?: THREE.Camera): void;
  /** livello di dettaglio mostrato (0 o 1) */
  readonly livello: number;
  libera(): void;
}

const cache = new Map<string, Promise<GLTF>>();
let loader: GLTFLoader | null = null;

/** Scarica (una volta) il GLB di un personaggio. */
export function scaricaPersonaggio(url: string): Promise<GLTF> {
  let p = cache.get(url);
  if (!p) {
    loader ??= new GLTFLoader();
    p = loader.loadAsync(url);
    cache.set(url, p);
  }
  return p;
}

function materiale(orig: THREE.Material, opz: OpzioniCaricamento): THREE.Material {
  const src = orig as THREE.MeshStandardMaterial;
  const map = src.map ?? null;
  if (map && opz.colore === 'grezzo') {
    map.colorSpace = THREE.NoColorSpace;
    map.needsUpdate = true;
  }
  const tinta = new THREE.Color(opz.tinta ?? 0xffffff);
  switch (opz.stile ?? 'toon') {
    case 'originale': {
      const m = src.clone();
      m.metalness = 0;
      m.roughness = 1;
      m.color.copy(tinta);
      return m;
    }
    case 'lambert':
      return new THREE.MeshLambertMaterial({ map, color: tinta });
    default:
      return new THREE.MeshToonMaterial({ map, color: tinta, gradientMap: rampaToni() });
  }
}

/** Crea una copia animabile di un personaggio. */
export async function caricaPersonaggio(url: string, opz: OpzioniCaricamento = {}): Promise<ModelloPersonaggio> {
  const gltf = await scaricaPersonaggio(url);
  const copia = cloneScheletro(gltf.scene) as THREE.Group;
  const gruppo = new THREE.Group();
  gruppo.name = `personaggio:${url.split('/').pop() ?? url}`;
  gruppo.add(copia);
  const lod: THREE.SkinnedMesh[] = [];
  const materiali = new Map<THREE.Material, THREE.Material>();
  copia.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const vecchio = m.material as THREE.Material;
    let nuovo = materiali.get(vecchio);
    if (!nuovo) {
      nuovo = materiale(vecchio, opz);
      materiali.set(vecchio, nuovo);
    }
    m.material = nuovo;
    m.castShadow = true;
    m.receiveShadow = opz.riceveOmbre ?? false;
    lod.push(m);
  });
  lod.sort((a, b) => a.name.localeCompare(b.name));
  if (!lod.length) throw new Error(`${url}: nessuna SkinnedMesh`);
  // altezza: dall'ingombro della geometria a riposo
  const box = new THREE.Box3();
  for (const m of lod) {
    m.geometry.computeBoundingBox();
    box.union(m.geometry.boundingBox as THREE.Box3);
    // le braccia e le gambe escono dall'ingombro di riposo: sfera più larga per il frustum culling
    m.geometry.computeBoundingSphere();
    (m.geometry.boundingSphere as THREE.Sphere).radius *= 1.3;
  }
  const altezza = box.max.y - box.min.y;
  // dove sta la superficie del petto (per le mani): il punto più avanti del busto fra 0,66 e 0,78 H
  const pos0 = (lod[0] as THREE.SkinnedMesh).geometry.getAttribute('position');
  let fronteBusto = -Infinity;
  for (let i = 0; i < pos0.count; i++) {
    const y = pos0.getY(i) - box.min.y;
    if (y > 0.66 * altezza && y < 0.78 * altezza && Math.abs(pos0.getX(i)) < 0.08 * altezza) fronteBusto = Math.max(fronteBusto, pos0.getZ(i));
  }
  const animatore = new AnimatorePersonaggio(copia, { ...opz, altezza, ...(Number.isFinite(fronteBusto) ? { fronteBusto } : {}) });
  const distanzaLod = opz.distanzaLod ?? 16;
  let livello = 0;
  const mostra = (l: number) => {
    livello = Math.min(l, lod.length - 1);
    lod.forEach((m, i) => (m.visible = i === livello));
  };
  mostra(0);
  const pos = new THREE.Vector3();
  const cam = new THREE.Vector3();
  return {
    gruppo,
    animatore,
    lod,
    altezza,
    get livello() {
      return livello;
    },
    update(dt, stato, camera) {
      animatore.update(dt, stato);
      copia.position.copy(animatore.spostamento);
      if (camera) {
        gruppo.getWorldPosition(pos);
        camera.getWorldPosition(cam);
        const d = pos.distanceTo(cam);
        // isteresi di un metro per non sfarfallare sul confine
        if (livello === 0 && d > distanzaLod + 1) mostra(1);
        else if (livello === 1 && d < distanzaLod - 1) mostra(0);
      }
    },
    libera() {
      gruppo.removeFromParent();
      for (const m of materiali.values()) m.dispose();
    },
  };
}
