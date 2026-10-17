/**
 * Utilità comuni ai generatori: composizione del risultato, aloni dei lumi, luci opzionali.
 */
import * as THREE from 'three';
import type { Collider, Ingombro, OggettoProcedurale, PortaOggetto } from './tipi';
import { materiali } from './materiali';

/** Libera tutte le geometrie di un sotto-albero (i materiali condivisi restano). */
export function liberaGeometrie(radice: THREE.Object3D): void {
  radice.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry && !(o instanceof THREE.Sprite)) m.geometry.dispose();
    if (o instanceof THREE.Points || o instanceof THREE.Line) {
      const mat = o.material as THREE.Material;
      if (mat.userData['proprio']) mat.dispose();
    }
  });
}

export interface DatiRisultato<S> {
  nome: string;
  seme: number;
  gruppo: THREE.Group;
  collider: Collider[];
  ingombro: Ingombro;
  punti?: Record<string, THREE.Vector3>;
  /** le porte dell'oggetto (coordinate locali) */
  porte?: PortaOggetto[];
  appoggio?: THREE.Vector3;
  update?: (dt: number, stato?: S) => void;
}

/** Compone il risultato standard di un generatore. */
export function risultato<S = undefined>(d: DatiRisultato<S>): OggettoProcedurale<S> {
  d.gruppo.name = d.gruppo.name || d.nome;
  d.gruppo.userData['oggetto'] = d.nome;
  d.gruppo.userData['seme'] = d.seme;
  d.gruppo.userData['collider'] = d.collider;
  const r: OggettoProcedurale<S> = {
    nome: d.nome,
    seme: d.seme,
    gruppo: d.gruppo,
    collider: d.collider,
    appoggio: d.appoggio ?? new THREE.Vector3(0, 0, 0),
    ingombro: d.ingombro,
    punti: d.punti ?? {},
    dispose: () => liberaGeometrie(d.gruppo),
  };
  if (d.porte?.length) r.porte = d.porte;
  if (d.update) r.update = d.update;
  return r;
}

/** Sprite additivo attorno a un lume (usa il materiale condiviso `alone`). */
export function creaAlone(pos: THREE.Vector3, dimensione: number): THREE.Sprite {
  const s = new THREE.Sprite(materiali().alone);
  s.position.copy(pos);
  s.scale.setScalar(dimensione);
  s.name = 'alone';
  s.userData['canale'] = 'alone';
  s.renderOrder = 10;
  return s;
}

/** Luce puntiforme calda opzionale (costosa: usarla solo per i primi piani). */
export function creaLuceLume(pos: THREE.Vector3, intensita = 2, distanza = 8): THREE.PointLight {
  const l = new THREE.PointLight(0xffb45a, intensita, distanza, 2);
  l.position.copy(pos);
  l.name = 'luce-lume';
  return l;
}

/** Collider box (scorciatoia). */
export function box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, tag?: string, rotY?: number): Collider {
  const c: Collider = { tipo: 'box', centro: [cx, cy, cz], mezze: [hx, hy, hz] };
  if (tag) c.tag = tag;
  if (rotY) c.rotY = rotY;
  return c;
}

/** Collider cilindro verticale (scorciatoia). */
export function cil(x: number, y: number, z: number, raggio: number, altezza: number, tag?: string): Collider {
  const c: Collider = { tipo: 'cilindro', base: [x, y, z], raggio, altezza };
  if (tag) c.tag = tag;
  return c;
}

/** Ingombro calcolato dal bounding box del gruppo. */
export function ingombroDa(gruppo: THREE.Object3D): Ingombro {
  gruppo.updateMatrixWorld(true);
  const bb = new THREE.Box3();
  gruppo.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      m.geometry.computeBoundingBox();
      const b = (m.geometry.boundingBox as THREE.Box3).clone().applyMatrix4(m.matrixWorld);
      bb.union(b);
    }
  });
  if (bb.isEmpty()) return { raggio: 0, altezza: 0, interrata: 0 };
  const raggio = Math.max(
    Math.hypot(bb.min.x, bb.min.z),
    Math.hypot(bb.max.x, bb.max.z),
    Math.hypot(bb.min.x, bb.max.z),
    Math.hypot(bb.max.x, bb.min.z),
  );
  return { raggio, altezza: bb.max.y, interrata: Math.max(0, -bb.min.y) };
}

/** Smorzamento esponenziale indipendente dal frame rate. */
export function smorza(attuale: number, obiettivo: number, velocita: number, dt: number): number {
  return obiettivo + (attuale - obiettivo) * Math.exp(-velocita * dt);
}
