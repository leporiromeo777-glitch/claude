import { Scene } from 'three';
import { World } from '../src/world/world';
import { LAYOUT } from '../src/world/constants';
import { createWorldUniforms } from '../src/render/uniforms';
import { createWorldMaterial } from '../src/render/worldMaterial';
import { buildVillage, PLACEHOLDER_HAMLETS } from '../src/scene/village';
import { buildProps } from '../src/scene/props';
import { Vegetation } from '../src/scene/vegetation';
import { Segnaposto } from '../src/regia/scena/segnaposto';
import { costruisciCella } from '../src/regia/scena/campanile';
import { creaLineaLibera, posizioniCapisaldi } from '../src/regia/catasto';
import { LATI, CAPISALDI } from '../src/regia/contenuti';
const w = new World();
const u = createWorldUniforms();
const m = createWorldMaterial(u, { kind: 'object' });
buildVillage(LAYOUT.villages[0]!, m, w.colliders, { seed: 2120, church: true, walls: true });
PLACEHOLDER_HAMLETS.forEach((v, i) => buildVillage(v, m, w.colliders, { seed: 500 + i, church: false, walls: false }));
buildProps(m, w.colliders);
new Vegetation(m, m, w.colliders);
const scena = new Scene();
const sp = new Segnaposto(scena, w.colliders, m, u);
const cella = costruisciCella(m, w.colliders);
const pos = posizioniCapisaldi({ punto: (id) => (id === 'cs_1' ? cella.punti['chiodo_cs_1']!.clone() : sp.punto(`chiodo_${id}`)), segnale: (id) => sp.punto(`segnale_${id}`) });
const ll = creaLineaLibera(w.colliders, pos.occhio, pos.segnale);
const def = (id: string) => CAPISALDI.find((c) => c.id === id)!;
for (const l of LATI) {
  const a = def(l.a), b = def(l.b);
  const r1 = ll({ id: a.id, z: a.z, theta: a.theta, altezza: a.altezza }, { id: b.id, z: b.z, theta: b.theta, altezza: b.altezza, altezzaSegnale: b.altezza_segnale }, { scopo: 'lato', ora: 600 });
  const r2 = ll({ id: b.id, z: b.z, theta: b.theta, altezza: b.altezza }, { id: a.id, z: a.z, theta: a.theta, altezza: a.altezza, altezzaSegnale: a.altezza_segnale }, { scopo: 'lato', ora: 600 });
  console.log(l.id.padEnd(5), l.chiudibile ? 'chiudibile' : 'bloccato  ', `${l.a}->${l.b}:`, JSON.stringify(r1), ` ${l.b}->${l.a}:`, JSON.stringify(r2));
}
import { worldToCyl } from '../src/world/cylinder';
import { groundHeight } from '../src/world/terrain';
import { Vector3 } from 'three';
for (const [x, y] of [['cs_1', 'cs_4'], ['cs_3', 'cs_4'], ['cs_3', 'cs_11'], ['cs_4', 'cs_37'], ['cs_11', 'cs_3']]) {
  const a = def(x!), b = def(y!);
  const o = pos.occhio({ id: a.id, z: a.z, theta: a.theta, altezza: a.altezza });
  const s = pos.segnale({ id: b.id, z: b.z, theta: b.theta, altezza: b.altezza });
  const d = o.distanceTo(s);
  let peggio = 0, dove = 0;
  for (let t = 2.5; t < d - 2.5; t += 1) {
    const p = new Vector3().lerpVectors(o, s, t / d);
    const c = worldToCyl(p);
    const g = groundHeight(c.z, c.theta);
    if (g - c.h > peggio) { peggio = g - c.h; dove = t; }
  }
  console.log(x, '->', y, 'dist', d.toFixed(0), 'max sotto il suolo', peggio.toFixed(1), 'm a', dove.toFixed(0), 'm');
}
