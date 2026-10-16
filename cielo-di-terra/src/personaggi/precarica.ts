/**
 * Precaricamento dei personaggi generati (public/personaggi/<id>.glb, elencati in
 * public/personaggi/indice.json) e registro dei modelli pronti da copiare.
 *
 * - I percorsi sono relativi alla base del gioco (`import.meta.env.BASE_URL`, './' nella build)
 *   risolta su `document.baseURI`: il gioco gira anche dentro un iframe, in una sottocartella.
 * - Ogni modello si scarica una volta; `creaPersonaggio` (fabbrica.ts) ne fa copie con
 *   SkeletonUtils.clone (geometria e texture condivise, scheletro e materiale propri).
 * - Niente eccezioni: se l'indice manca si provano i modelli del pilota; se un file manca o è rotto
 *   si annota e si va avanti (per quell'abitante il popolamento userà la figura procedurale).
 *
 * Il motore (uniform del mondo e camera) si collega con `collegaMotorePersonaggi`, prima o dopo:
 * i personaggi già creati passano al materiale del mondo quando arrivano gli uniform.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { WorldUniforms } from '../render/uniforms';
import { geometriaSeduta } from './gonne';
import { MODELLI_SENZA_INDICE, SCHEDE, leggiIndice, type SchedaModello, type VoceModello } from './schede';

/** Un modello pronto da copiare. */
export interface PrototipoPersonaggio {
  readonly id: string;
  /** la radice del GLB: SkinnedMesh `lod0`, `lod1` e lo scheletro di 17 ossa (fronte +Z, piedi a y = 0) */
  readonly scena: THREE.Object3D;
  readonly mappa: THREE.Texture | null;
  /** altezza a riposo (m) */
  readonly altezza: number;
  /** raggio orizzontale massimo a riposo (posa ad A, m) */
  readonly raggio: number;
  /**
   * z della superficie davanti al petto (m, spazio del modello), misurata solo sui vertici del busto
   * (pesati su petto e schiena: niente veli, teste, braccia)
   */
  readonly fronteBusto: number;
  /** z della schiena (m, spazio del modello), sugli stessi vertici del busto: dove posa la gerla */
  readonly retroBusto: number;
  readonly scheda: SchedaModello;
  /**
   * per le vesti lunghe: le geometrie con i pesi «da seduti» (gonne.ts), per nome della SkinnedMesh
   * (`lod0`, `lod1`); la fabbrica le usa quando il personaggio è seduto
   */
  readonly geometrieSedute: ReadonlyMap<string, THREE.BufferGeometry>;
}

export interface EsitoPrecarica {
  caricati: string[];
  /** id senza file (404) o con un file illeggibile */
  mancanti: string[];
  errori: Record<string, string>;
}

export interface OpzioniPrecarica {
  /** id da caricare (se manca: quelli dell'indice; senza indice, i modelli del pilota) */
  ids?: string[];
  /** cartella dei modelli (predefinito: `<BASE_URL>personaggi/`) */
  cartella?: string;
}

/** Distanze (m) per livello di dettaglio e frequenza dell'animazione (vedi fabbrica.ts). */
export interface DistanzePersonaggi {
  /** oltre: LOD1 (2000 triangoli) */
  lod1: number;
  /** oltre: animazione a 6 Hz, niente ombra portata */
  lontano: number;
  /** oltre: non si disegna né si anima */
  sparisce: number;
}

const prototipi = new Map<string, PrototipoPersonaggio>();
const inCorso = new Map<string, Promise<PrototipoPersonaggio | null>>();
const errori = new Map<string, string>();
let loader: GLTFLoader | null = null;
/**
 * La pagina se ne va (ricarica, chiusura) mentre i modelli si scaricano: le richieste si interrompono e
 * niente si analizza più, così GLTFLoader non decodifica texture da indirizzi blob già revocati (e non
 * riempie la console di «Couldn't load texture»).
 */
let uscendo = false;
let interruzione: AbortController | null = null;
function segnaleUscita(): AbortSignal | undefined {
  if (typeof AbortController === 'undefined') return undefined;
  if (!interruzione) {
    interruzione = new AbortController();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const ctl = interruzione;
      window.addEventListener(
        'pagehide',
        () => {
          uscendo = true;
          ctl.abort();
        },
        { once: true },
      );
    }
  }
  return interruzione.signal;
}

/** Stato condiviso con la fabbrica (uniform del mondo, camera, distanze, istanze vive). */
export const motore: {
  uniform: WorldUniforms | null;
  camera: THREE.Camera | null;
  distanze: DistanzePersonaggi;
  /** le istanze vive si iscrivono qui per ricevere gli uniform quando arrivano */
  ascoltatori: Set<() => void>;
} = {
  uniform: null,
  camera: null,
  distanze: { lod1: 25, lontano: 120, sparisce: 230 },
  ascoltatori: new Set(),
};

/** La cartella dei modelli, assoluta, risolta sulla base del gioco e sull'indirizzo del documento. */
export function cartellaPersonaggi(cartella?: string): string {
  const doc = typeof document !== 'undefined' && document.baseURI ? document.baseURI : 'http://localhost/';
  if (cartella) return new URL(cartella.endsWith('/') ? cartella : `${cartella}/`, doc).href;
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env;
  let base = env?.BASE_URL ?? './';
  if (!base.endsWith('/')) base += '/';
  return new URL('personaggi/', new URL(base, doc)).href;
}

/** La scheda di un id, corretta dalla voce dell'indice (altezza, gonna, apertura, curvo, oggetti, bambino). */
function schedaPer(id: string, voce?: VoceModello): SchedaModello {
  const base: SchedaModello = SCHEDE[id] ?? { id, altezza: 1.7, gonna: false, apertura: 10, generico: false };
  return {
    ...base,
    ...(voce?.altezza !== undefined ? { altezza: voce.altezza } : {}),
    ...(voce?.gonna !== undefined ? { gonna: voce.gonna } : {}),
    ...(voce?.apertura !== undefined ? { apertura: voce.apertura } : {}),
    ...(voce?.curvo !== undefined ? { curvo: voce.curvo } : {}),
    ...(voce?.oggetti !== undefined ? { oggetti: voce.oggetti } : {}),
    ...(voce?.bambino !== undefined ? { bambino: voce.bambino } : {}),
    ...(voce?.tavolozza !== undefined ? { tavolozza: voce.tavolozza } : {}),
  };
}

/** Decodifica il testo base64 di un modello (build pubblicata) nei suoi byte. */
function daBase64(testo: string): ArrayBuffer {
  const s = atob(testo.trim());
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out.buffer;
}

async function leggiVoci(cartella: string): Promise<VoceModello[]> {
  try {
    if (typeof fetch !== 'function') throw new Error('fetch assente');
    const r = await fetch(new URL('indice.json', cartella).href, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`indice.json: HTTP ${r.status}`);
    const voci = leggiIndice(await r.json());
    if (voci.length) return voci;
    throw new Error('indice.json vuoto');
  } catch {
    return MODELLI_SENZA_INDICE.map((id) => ({ id, file: `${id}.glb` }));
  }
}

/**
 * Scarica i modelli dei personaggi (una volta sola: le chiamate successive riusano i file già
 * scaricati). `onProgress(frazione, id)` va da 0 a 1. Non fallisce mai: l'esito dice cosa c'è.
 */
export async function precaricaPersonaggi(onProgress?: (frazione: number, id?: string) => void, opz: OpzioniPrecarica = {}): Promise<EsitoPrecarica> {
  const cartella = cartellaPersonaggi(opz.cartella);
  const voci = opz.ids ? opz.ids.map((id) => ({ id, file: `${id}.glb` })) : await leggiVoci(cartella);
  const esito: EsitoPrecarica = { caricati: [], mancanti: [], errori: {} };
  let fatti = 0;
  onProgress?.(0);
  await Promise.all(
    voci.map(async (v) => {
      const p = caricaUno(v, cartella);
      const proto = await p;
      fatti++;
      onProgress?.(fatti / voci.length, v.id);
      if (proto) esito.caricati.push(v.id);
      else {
        esito.mancanti.push(v.id);
        const e = errori.get(v.id);
        if (e) esito.errori[v.id] = e;
      }
    }),
  );
  esito.caricati.sort();
  esito.mancanti.sort();
  if (esito.mancanti.length && typeof console !== 'undefined') {
    console.warn(`personaggi: senza modello ${esito.mancanti.join(', ')} (si usa la figura procedurale)`);
  }
  return esito;
}

function caricaUno(v: VoceModello, cartella: string): Promise<PrototipoPersonaggio | null> {
  const gia = prototipi.get(v.id);
  if (gia) return Promise.resolve(gia);
  let p = inCorso.get(v.id);
  if (p) return p;
  p = (async () => {
    try {
      loader ??= new GLTFLoader();
      // la versione nell'indirizzo: dopo una nuova esportazione con lo stesso nome il browser non tiene il GLB vecchio
      const url = new URL(v.file, cartella);
      if (v.versione) url.searchParams.set('v', v.versione);
      const segnale = segnaleUscita();
      const r = await fetch(url.href, segnale ? { signal: segnale } : {});
      if (!r.ok) throw new Error(`${r.status} ${url.pathname}`);
      // nella build pubblicata i modelli sono testo base64 (<id>.glb.txt, vedi vite.config.ts)
      const dati = url.pathname.endsWith('.txt') ? daBase64(await r.text()) : await r.arrayBuffer();
      if (uscendo) throw new Error('pagina chiusa');
      const gltf = await loader.parseAsync(dati, new URL('.', url).href);
      const proto = preparaPrototipo(v.id, gltf.scene, schedaPer(v.id, v));
      prototipi.set(v.id, proto);
      errori.delete(v.id);
      return proto;
    } catch (e) {
      errori.set(v.id, e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      inCorso.delete(v.id);
    }
  })();
  inCorso.set(v.id, p);
  return p;
}

const _p = new THREE.Vector3();

/**
 * Prepara un modello appena caricato (o costruito in un test): materiale e texture «da pittore»,
 * misure a riposo, attributo `aOrlo` per l'ondeggio dell'orlo, sfere d'ingombro per il culling.
 * Lancia un errore se non è uno scheletro dei personaggi (servono le SkinnedMesh e le 17 ossa).
 */
export function preparaPrototipo(id: string, scena: THREE.Object3D, scheda: SchedaModello = schedaPer(id)): PrototipoPersonaggio {
  scena.updateMatrixWorld(true);
  const mesh: THREE.SkinnedMesh[] = [];
  scena.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) mesh.push(o as THREE.SkinnedMesh);
  });
  if (!mesh.length) throw new Error(`${id}: nessuna SkinnedMesh`);
  mesh.sort((a, b) => a.name.localeCompare(b.name));
  // misure a riposo dal LOD0 (posizioni vere in metri: la quantizzazione è nelle matrici di legame)
  const m0 = mesh[0] as THREE.SkinnedMesh;
  m0.skeleton.update();
  const pos = m0.geometry.getAttribute('position');
  const box = new THREE.Box3();
  const rest: number[] = new Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    m0.getVertexPosition(i, _p);
    box.expandByPoint(_p);
    rest[i * 3] = _p.x;
    rest[i * 3 + 1] = _p.y;
    rest[i * 3 + 2] = _p.z;
  }
  const altezza = box.max.y - Math.min(0, box.min.y);
  let raggio = 0;
  let fronteBusto = -Infinity;
  let retroBusto = Infinity;
  // le ossa del busto: solo i vertici pesati per lo più su petto e schiena contano per il davanti del petto
  // (un velo che pende davanti al petto è della testa o del collo e allontanerebbe le mani: braccia
  // conserte tese come uno zombi)
  const ossa0 = m0.skeleton.bones;
  const busto = new Set([ossa0.findIndex((b) => b.name === 'petto'), ossa0.findIndex((b) => b.name === 'schiena')]);
  const si0 = m0.geometry.getAttribute('skinIndex');
  const sw0 = m0.geometry.getAttribute('skinWeight');
  const pettoOsso = ossa0.find((b) => b.name === 'petto');
  const zPetto = pettoOsso ? pettoOsso.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(m0.matrixWorld).invert()).z : 0;
  for (let i = 0; i < pos.count; i++) {
    const x = rest[i * 3] as number;
    const y = rest[i * 3 + 1] as number;
    const z = rest[i * 3 + 2] as number;
    raggio = Math.max(raggio, Math.hypot(x, z));
    // la superficie del petto (per le mani): il punto più avanti del busto fra 0,62 e 0,76 H
    if (y > 0.62 * altezza && y < 0.76 * altezza && Math.abs(x) < 0.08 * altezza) {
      let w = 0;
      if (si0 && sw0) for (let k = 0; k < 4; k++) if (busto.has(si0.getComponent(i, k))) w += sw0.getComponent(i, k);
      if (!si0 || w >= 0.6) {
        fronteBusto = Math.max(fronteBusto, z);
        retroBusto = Math.min(retroBusto, z);
      }
    }
  }
  // mai più di 0,07·H davanti all'attacco del petto; la schiena fra 0,04 e 0,16·H dietro
  fronteBusto = Number.isFinite(fronteBusto) ? Math.min(fronteBusto, zPetto + 0.07 * altezza) : zPetto + 0.06 * altezza;
  retroBusto = Number.isFinite(retroBusto) ? THREE.MathUtils.clamp(retroBusto, zPetto - 0.16 * altezza, zPetto - 0.04 * altezza) : zPetto - 0.08 * altezza;
  let mappa: THREE.Texture | null = null;
  for (const m of mesh) {
    m.skeleton.update();
    const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
    if (!mappa && mat?.map) mappa = mat.map;
    // l'orlo: da sotto il ginocchio (0) all'orlo (1), solo per gonne e vesti lunghe
    if (scheda.gonna && !m.geometry.getAttribute('aOrlo')) {
      const p = m.geometry.getAttribute('position');
      const orlo = new Float32Array(p.count);
      const y0 = 0.36 * altezza;
      const y1 = 0.06 * altezza;
      for (let i = 0; i < p.count; i++) {
        m.getVertexPosition(i, _p);
        const k = THREE.MathUtils.clamp((y0 - _p.y) / (y0 - y1), 0, 1);
        orlo[i] = k * k * (3 - 2 * k);
      }
      m.geometry.setAttribute('aOrlo', new THREE.BufferAttribute(orlo, 1));
    }
    // ingombro per il culling (spazio della mesh), largo abbastanza per braccia, passo e seduta
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, altezza * 0.5, 0), altezza * 0.62 + 0.25);
    m.frustumCulled = true;
  }
  // le vesti lunghe: i pesi da seduti (gonne.ts), una geometria per livello di dettaglio
  const geometrieSedute = new Map<string, THREE.BufferGeometry>();
  if (scheda.gonna) {
    for (const m of mesh) {
      const g = geometriaSeduta(m, altezza);
      if (g) {
        g.boundingSphere = m.geometry.boundingSphere;
        geometrieSedute.set(m.name, g);
      }
    }
  }
  if (mappa) {
    // il motore lavora con ColorManagement spento e colori sRGB «da pittore»: niente decodifica
    mappa.colorSpace = THREE.NoColorSpace;
    mappa.anisotropy = 4;
    mappa.needsUpdate = true;
  }
  return { id, scena, mappa, altezza, raggio, fronteBusto, retroBusto, scheda, geometrieSedute };
}

/** Registra un modello già pronto (prove, pagine di prova): da qui `creaPersonaggio` lo usa. */
export function registraPrototipo(proto: PrototipoPersonaggio): void {
  prototipi.set(proto.id, proto);
}

/** Il modello caricato con questo id (o undefined). */
export function prototipo(id: string): PrototipoPersonaggio | undefined {
  return prototipi.get(id);
}

/** Gli id dei modelli pronti. */
export function personaggiDisponibili(): ReadonlySet<string> {
  return new Set(prototipi.keys());
}

/** Dimentica i modelli caricati (prove). Le copie già create restano valide. */
export function svuotaPersonaggi(): void {
  prototipi.clear();
  inCorso.clear();
  errori.clear();
}

/**
 * Collega il motore: gli uniform del mondo (materiale con la luce della Linea, la foschia, la matita)
 * e la camera (livelli di dettaglio, frequenza dell'animazione). Si può chiamare quando si vuole:
 * le copie già create cambiano materiale.
 */
export function collegaMotorePersonaggi(m: { uniforms?: WorldUniforms | null; camera?: THREE.Camera | null }): void {
  if (m.uniforms !== undefined) motore.uniform = m.uniforms;
  if (m.camera !== undefined) motore.camera = m.camera;
  for (const f of motore.ascoltatori) f();
}

/** Cambia le distanze dei livelli di dettaglio (m). */
export function impostaDistanzePersonaggi(d: Partial<DistanzePersonaggi>): void {
  motore.distanze = { ...motore.distanze, ...d };
}
