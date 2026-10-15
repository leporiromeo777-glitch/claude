/**
 * Istanziare e unire gli oggetti statici.
 * - `istanzia`: N copie dello stesso oggetto (stessa variante) con una InstancedMesh per materiale
 *   e un'unica nuvola di punti per gli aloni → poche draw call per un intero paese di rustici uguali.
 * - `unisciStatici`: oggetti diversi (es. tutti quelli di una particella di 40 m) cotti in una mesh
 *   per materiale.
 * Gli oggetti animati (abitanti, Fade, barche, cancelli, botole) vanno lasciati come sono.
 */
import * as THREE from 'three';
import { materiali } from './materiali';
import type { OggettoProcedurale } from './tipi';

interface PezzoCotto {
  materiale: THREE.Material;
  geometria: THREE.BufferGeometry;
  ombre: boolean;
  canale: string;
}

/** Unisce geometrie con gli stessi attributi (position, normal, color [, aColor]) in una non indicizzata. */
export function unisciGeometrie(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const nomi = ['position', 'normal', 'color', 'aColor'].filter((n) => geos.every((g) => g.getAttribute(n)));
  const dati: Record<string, number[]> = {};
  const dim: Record<string, number> = {};
  for (const n of nomi) dati[n] = [];
  for (const g of geos) {
    const gg = g.index ? g.toNonIndexed() : g;
    for (const n of nomi) {
      const a = gg.getAttribute(n) as THREE.BufferAttribute;
      dim[n] = a.itemSize;
      const arr = dati[n] as number[];
      for (let i = 0; i < a.count * a.itemSize; i++) arr.push(a.array[i] as number);
    }
  }
  const out = new THREE.BufferGeometry();
  for (const n of nomi) out.setAttribute(n, new THREE.Float32BufferAttribute(dati[n] as number[], dim[n] as number));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

/** Cuoce le mesh di un sotto-albero nello spazio della radice (geometrie trasformate). */
function cuoci(radice: THREE.Object3D, extra?: THREE.Matrix4): { pezzi: PezzoCotto[]; aloni: THREE.Vector3[]; dimAlone: number } {
  radice.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(radice.matrixWorld).invert();
  const pezzi: PezzoCotto[] = [];
  const aloni: THREE.Vector3[] = [];
  let dimAlone = 1;
  radice.traverse((o) => {
    if (!o.visible) return;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    if (extra) rel.premultiply(extra);
    if (o instanceof THREE.Sprite) {
      aloni.push(new THREE.Vector3().setFromMatrixPosition(rel));
      dimAlone = o.scale.x;
      return;
    }
    const m = o as THREE.Mesh;
    if (!m.isMesh || (o as THREE.SkinnedMesh).isSkinnedMesh || (o as THREE.InstancedMesh).isInstancedMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(rel);
    if (rel.determinant() < 0 && g.index === null) {
      // ribalta l'ordine dei vertici per le copie specchiate
      const p = g.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i += 3) {
        for (const nome of Object.keys(g.attributes)) {
          const a = g.getAttribute(nome) as THREE.BufferAttribute;
          for (let k = 0; k < a.itemSize; k++) {
            const t = a.getComponent(i + 1, k);
            a.setComponent(i + 1, k, a.getComponent(i + 2, k));
            a.setComponent(i + 2, k, t);
          }
        }
      }
    }
    pezzi.push({ materiale: m.material as THREE.Material, geometria: g, ombre: m.castShadow, canale: String(m.userData['canale'] ?? '') });
  });
  return { pezzi, aloni, dimAlone };
}

function raggruppaPerMateriale(pezzi: PezzoCotto[]): Map<THREE.Material, PezzoCotto[]> {
  const mappa = new Map<THREE.Material, PezzoCotto[]>();
  for (const p of pezzi) {
    const l = mappa.get(p.materiale) ?? [];
    l.push(p);
    mappa.set(p.materiale, l);
  }
  return mappa;
}

function nuvolaAloni(posizioni: THREE.Vector3[], dimensione: number): THREE.Points {
  const g = new THREE.BufferGeometry().setFromPoints(posizioni);
  const mAlone = materiali().alone;
  const m = new THREE.PointsMaterial({
    map: mAlone.map,
    color: mAlone.color,
    size: dimensione,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: mAlone.opacity,
  });
  m.userData['proprio'] = true;
  // segue l'intensità dei lumi del materiale condiviso
  m.onBeforeRender = () => {
    m.opacity = mAlone.opacity;
    m.visible = mAlone.visible;
  };
  const p = new THREE.Points(g, m);
  p.name = 'aloni';
  p.userData['canale'] = 'alone';
  p.frustumCulled = false;
  return p;
}

/**
 * N copie dello stesso oggetto statico, una InstancedMesh per materiale.
 * @param matrici matrici delle copie (es. da `matriceSuperficie`)
 */
export function istanzia(oggetto: OggettoProcedurale<unknown> | THREE.Object3D, matrici: THREE.Matrix4[]): THREE.Group {
  const radice = 'gruppo' in oggetto ? oggetto.gruppo : oggetto;
  const { pezzi, aloni, dimAlone } = cuoci(radice);
  const out = new THREE.Group();
  out.name = `${radice.name}×${matrici.length}`;
  for (const [mat, lista] of raggruppaPerMateriale(pezzi)) {
    const geo = unisciGeometrie(lista.map((p) => p.geometria));
    const im = new THREE.InstancedMesh(geo, mat, matrici.length);
    matrici.forEach((m, i) => im.setMatrixAt(i, m));
    im.instanceMatrix.needsUpdate = true;
    im.castShadow = lista.some((p) => p.ombre);
    im.receiveShadow = true;
    im.userData['canale'] = lista[0]?.canale;
    im.name = `${out.name}:${lista[0]?.canale}`;
    im.computeBoundingSphere();
    out.add(im);
  }
  if (aloni.length) {
    const tutte: THREE.Vector3[] = [];
    for (const m of matrici) for (const a of aloni) tutte.push(a.clone().applyMatrix4(m));
    out.add(nuvolaAloni(tutte, dimAlone));
  }
  return out;
}

/** Cuoce più oggetti statici (ognuno con la sua matrice) in una mesh per materiale. */
export function unisciStatici(voci: Array<{ oggetto: OggettoProcedurale<unknown> | THREE.Object3D; matrice: THREE.Matrix4 }>): THREE.Group {
  const tutti: PezzoCotto[] = [];
  const aloni: THREE.Vector3[] = [];
  let dim = 1;
  for (const v of voci) {
    const radice = 'gruppo' in v.oggetto ? v.oggetto.gruppo : v.oggetto;
    const c = cuoci(radice, v.matrice);
    tutti.push(...c.pezzi);
    aloni.push(...c.aloni);
    dim = c.dimAlone;
  }
  const out = new THREE.Group();
  out.name = 'statici-uniti';
  for (const [mat, lista] of raggruppaPerMateriale(tutti)) {
    const mesh = new THREE.Mesh(unisciGeometrie(lista.map((p) => p.geometria)), mat);
    mesh.castShadow = lista.some((p) => p.ombre);
    mesh.receiveShadow = true;
    mesh.userData['canale'] = lista[0]?.canale;
    mesh.name = `statici:${lista[0]?.canale}`;
    out.add(mesh);
  }
  if (aloni.length) out.add(nuvolaAloni(aloni, dim));
  return out;
}
