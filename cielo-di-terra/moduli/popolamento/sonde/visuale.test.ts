import { test } from 'vitest';
import { Vector3 } from 'three';
import { cylToWorld, worldToCyl } from '../../../src/world/cylinder';
import { groundHeight } from '../../../src/world/terrain';
import { RETE } from '../src/contenuti';
import { installaCorbella } from '../src/index';
import { giocoFinto } from '../test/banco';

test('visuale', () => {
  const g = giocoFinto();
  const c = installaCorbella(g);
  const occhio = (id: string, eye: boolean) => {
    const cs = RETE.find((x) => x.id === id)!;
    const p = c.punto(`chiodo:${cs.numero}`)!.cil;
    return cylToWorld(p.z, p.theta, p.h + (eye ? 1.45 : Math.max(1.2, cs.altezza_segnale * 0.6)));
  };
  for (const [a, b] of [['cs_5', 'cs_3'], ['cs_11', 'cs_3'], ['cs_7', 'cs_1']]) {
    const A = occhio(a, true);
    const B = occhio(b, false);
    const L = A.distanceTo(B);
    const d = B.clone().sub(A).normalize();
    for (const v of c.collider()) {
      const col = v.collider;
      if (col.kind !== 'box' || ['chiodo','caposaldo','gradino','personaggio','palina'].includes(v.tag)) continue;
      const o = A.clone().sub(col.center);
      let tmin = 0.5, tmax = L - 0.5, ok = true;
      for (const [ax, h] of [[col.right, col.half.x], [col.up, col.half.y], [col.forward, col.half.z]] as const) {
        const e = o.dot(ax), f = d.dot(ax);
        if (Math.abs(f) < 1e-9) { if (Math.abs(e) > h) ok = false; continue; }
        let t1 = (-h - e) / f, t2 = (h - e) / f;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) ok = false;
      }
      if (ok) {
        const p = A.clone().addScaledVector(d, tmin);
        const cc = worldToCyl(p);
        const cc0 = worldToCyl(col.center);
        console.log(a, '->', b, 'colpisce', v.tag, v.luogo, 'a t', tmin.toFixed(1), 'di', L.toFixed(1), 'in', cc.z.toFixed(1), cc.theta.toFixed(2), 'h', cc.h.toFixed(2), 'suolo', groundHeight(cc.z, cc.theta).toFixed(2), 'centro', cc0.z.toFixed(1), cc0.theta.toFixed(2), cc0.h.toFixed(1), 'mezze', col.half.toArray().map((x: number) => x.toFixed(2)).join(','));
      }
    }
  }
  void Vector3;
});
