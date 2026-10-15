import { test } from 'vitest';
import { installaCorbella } from '../src/index';
import { giocoFinto } from '../test/banco';

test('installa', () => {
  const g = giocoFinto();
  const t0 = performance.now();
  const c = installaCorbella(g);
  console.log('ms', (performance.now() - t0).toFixed(0), JSON.stringify(c.statistiche));
  const zone: Record<string, number> = {};
  c.radice.traverse((o) => { const t = o.userData['triangoli']; if (t) zone[o.name] = t; });
  console.log(Object.entries(zone).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join('\n'));
});
