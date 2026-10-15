import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AnimatorePersonaggio } from '../../src/personaggi/animatore';
import { MODELLI, prototipoGlb } from './glbNode';

describe('misure (provvisorio)', () => {
  it('carica e misura', async () => {
    for (const id of MODELLI) {
      const p = await prototipoGlb(id);
      const a = new AnimatorePersonaggio(p.scena, { altezza: p.altezza, fronteBusto: p.fronteBusto, apertura: p.scheda.apertura });
      const r: Record<string, number> = {};
      for (const braccia of ['braccia-conserte', 'mani-giunte', 'mani-dietro'] as const) {
        for (let i = 0; i < 60; i++) a.update(1 / 30, { braccia });
        p.scena.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        const s = new THREE.Vector3();
        let est = 0;
        for (const L of ['S', 'D']) {
          const b = a.ossa.get(`braccio${L}` as 'braccioS')!.osso;
          const m = a.ossa.get(`mano${L}` as 'manoS')!.osso;
          b.getWorldPosition(s);
          m.getWorldPosition(v);
          const L1 = a.attacco(`avambraccio${L}` as 'avambraccioS').distanceTo(a.attacco(`braccio${L}` as 'braccioS'));
          const L2 = a.attacco(`mano${L}` as 'manoS').distanceTo(a.attacco(`avambraccio${L}` as 'avambraccioS'));
          est = Math.max(est, v.distanceTo(s) / (L1 + L2));
        }
        r[braccia] = +est.toFixed(2);
      }
      console.log(id, p.altezza.toFixed(2), 'fronte', p.fronteBusto.toFixed(3), 'petto', a.attacco('petto').z.toFixed(3), JSON.stringify(r));
    }
    expect(MODELLI.length).toBe(13);
  });
});
