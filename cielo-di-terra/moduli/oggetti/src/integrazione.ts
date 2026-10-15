/**
 * Adattatore verso il materiale del mondo del motore (src/render/worldMaterial.ts), che si aspetta
 * l'attributo `aColor` (vec4: rgb = albedo sRGB, a = emissione notturna 0..1) invece di `color`.
 *
 * - i canali 'opaco' e 'sottile' ricevono a = 0;
 * - il canale 'lume' (vetri, fiamme, finestre) riceve a = luminosità del colore: le finestre accese e i
 *   vetri delle lanterne si accendono di notte con `uLampColor`, quelle buie restano buie.
 * Le SkinnedMesh (abitanti) e gli sprite/punti degli aloni mantengono i materiali della libreria
 * (lo shader del motore non ha lo skinning).
 */
import * as THREE from 'three';

/** Aggiunge `aColor` (sRGB + emissione) a una geometria che ha `color` (lineare). */
export function aggiungiAColor(geo: THREE.BufferGeometry, emissione: 'nessuna' | 'da-colore' | number = 'nessuna'): void {
  const col = geo.getAttribute('color') as THREE.BufferAttribute | undefined;
  if (!col) return;
  const out = new Float32Array(col.count * 4);
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace);
    const s = { r: 0, g: 0, b: 0 };
    c.getRGB(s, THREE.SRGBColorSpace);
    out[i * 4] = s.r;
    out[i * 4 + 1] = s.g;
    out[i * 4 + 2] = s.b;
    let a = 0;
    if (emissione === 'da-colore') a = THREE.MathUtils.clamp((Math.max(s.r, s.g, s.b) - 0.25) * 1.6, 0, 1);
    else if (typeof emissione === 'number') a = emissione;
    out[i * 4 + 3] = a;
  }
  geo.setAttribute('aColor', new THREE.BufferAttribute(out, 4));
}

export interface MaterialiMotore {
  /** materiale del mondo, variante 'object' (FrontSide) */
  oggetto: THREE.Material;
  /** variante a doppia faccia per vele, veli e tele (se assente si usa `oggetto`) */
  oggettoDoppio?: THREE.Material;
  /** variante istanziata (USE_INSTANCING è automatico in three; serve solo se diversa) */
  istanze?: THREE.Material;
}

/**
 * Sostituisce i materiali della libreria con quelli del motore in tutto il sotto-albero e aggiunge
 * `aColor` alle geometrie. Restituisce il numero di mesh adattate.
 */
export function adattaAlMotore(radice: THREE.Object3D, m: MaterialiMotore): number {
  let n = 0;
  radice.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const canale = mesh.userData['canale'] as string | undefined;
    if (!canale) return;
    if (!mesh.geometry.getAttribute('aColor')) aggiungiAColor(mesh.geometry, canale === 'lume' ? 'da-colore' : 'nessuna');
    const inst = (o as THREE.InstancedMesh).isInstancedMesh;
    mesh.material = canale === 'sottile' ? (m.oggettoDoppio ?? m.oggetto) : inst && m.istanze ? m.istanze : m.oggetto;
    n++;
  });
  return n;
}
