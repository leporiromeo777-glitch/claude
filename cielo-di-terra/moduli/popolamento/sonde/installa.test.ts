import { test } from 'vitest';
import { installaCorbella } from '../src/index';
import { giocoFinto } from '../test/banco';

test('installa', () => {
  const g = giocoFinto();
  const t0 = performance.now();
  const c = installaCorbella(g);
  console.log('ms', (performance.now() - t0).toFixed(0), JSON.stringify(c.statistiche));
  const gruppi: Record<string, number> = {};
  c.radice.traverse((o) => {
    const t = o.userData['triangoli'];
    if (!t) return;
    const k = o.name.replace(/^corbella:/, '').split(':')[0]! + (o.name.includes('lontano') ? ':lontano' : '');
    gruppi[k] = (gruppi[k] ?? 0) + t;
  });
  console.log(Object.entries(gruppi).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
});
