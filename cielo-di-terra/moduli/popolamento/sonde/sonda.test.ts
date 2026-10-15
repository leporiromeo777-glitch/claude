import { test } from 'vitest';
import { groundHeight, surfaceHeight, createMasks, slopeAt } from '../../../src/world/terrain';
import luoghi from '../../../content/luoghi.json';
import capisaldi from '../../../content/capisaldi.json';

test('sonda', () => {
  const m = createMasks();
  for (const l of luoghi as any[]) {
    const g = groundHeight(l.z, l.theta);
    const s = surfaceHeight(l.z, l.theta, m);
    console.log(`${l.id.padEnd(22)} z ${l.z} th ${l.theta} alt ${l.altezza} ground ${g.toFixed(2)} surf ${s.toFixed(2)} diff ${(l.altezza - g).toFixed(2)} vill ${m.village.toFixed(2)} piaz ${m.piazza.toFixed(2)} stream ${m.stream.toFixed(1)} slope ${(slopeAt(l.z,l.theta)*57.3).toFixed(0)}`);
  }
  for (const c of [...(capisaldi as any).rete_corbella, ...(capisaldi as any).lontani_di_notte]) {
    const g = groundHeight(c.z, c.theta);
    console.log(`${c.id.padEnd(8)} z ${c.z} th ${c.theta} alt ${c.altezza} ground ${g.toFixed(2)} diff ${(c.altezza - g).toFixed(2)}`);
  }
});
