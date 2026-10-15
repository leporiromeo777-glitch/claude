// misura provvisoria (non committare)
import * as THREE from 'three';
import { creaRustico } from '../src/oggetti/oggetti/rustico';
import { CATALOGO } from '../src/oggetti/catalogo';

function tri(g: THREE.Object3D): number {
  let t = 0;
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const geo = m.geometry;
    t += (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3;
  });
  return t;
}
for (const v of CATALOGO) {
  if (!/rustico|campanile|chiesa|fienile/.test(v.nome)) continue;
  console.log(v.nome, tri(v.crea().gruppo));
}
for (const det of ['alto', 'medio'] as const) {
  let s = 0;
  for (let i = 0; i < 20; i++) s += tri(creaRustico({ seme: `corbella-${i}`, dettaglio: det }).gruppo);
  console.log('media', det, Math.round(s / 20));
}
