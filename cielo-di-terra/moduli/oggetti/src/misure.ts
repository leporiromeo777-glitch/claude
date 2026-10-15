/**
 * Misure di costo di un oggetto: triangoli e draw call stimate (senza GPU).
 * Conta ogni Mesh/SkinnedMesh/InstancedMesh/Points/Line/Sprite visibile come una draw call
 * (più i gruppi di materiali multipli); i triangoli delle InstancedMesh sono moltiplicati per le istanze.
 * La vetrina misura anche i valori veri con `renderer.info` (vedi shots/misure.json).
 */
import * as THREE from 'three';

export interface Misura {
  triangoli: number;
  drawCall: number;
  mesh: number;
  /** per canale di materiale */
  perCanale: Record<string, { triangoli: number; drawCall: number }>;
}

export function misura(radice: THREE.Object3D, comprendiInvisibili = false): Misura {
  const out: Misura = { triangoli: 0, drawCall: 0, mesh: 0, perCanale: {} };
  const aggiungi = (canale: string, tri: number, dc: number) => {
    const c = out.perCanale[canale] ?? { triangoli: 0, drawCall: 0 };
    c.triangoli += tri;
    c.drawCall += dc;
    out.perCanale[canale] = c;
    out.triangoli += tri;
    out.drawCall += dc;
  };
  const visita = (o: THREE.Object3D) => {
    if (!o.visible && !comprendiInvisibili) return;
    const canale = String(o.userData['canale'] ?? (o instanceof THREE.Sprite ? 'alone' : 'altro'));
    if (o instanceof THREE.Sprite) {
      aggiungi(canale, 2, 1);
      out.mesh++;
    } else if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      const g = m.geometry;
      const vertici = g.index ? g.index.count : (g.getAttribute('position')?.count ?? 0);
      let tri = Math.floor(Math.min(vertici, g.drawRange.count) / 3);
      const istanze = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh).count : 1;
      tri *= istanze;
      const dc = Array.isArray(m.material) ? Math.max(1, g.groups.length) : 1;
      aggiungi(canale, tri, dc);
      out.mesh++;
    } else if ((o as THREE.Points).isPoints || (o as THREE.Line).isLine) {
      aggiungi(canale, 0, 1);
      out.mesh++;
    }
    for (const f of o.children) visita(f);
  };
  visita(radice);
  return out;
}
