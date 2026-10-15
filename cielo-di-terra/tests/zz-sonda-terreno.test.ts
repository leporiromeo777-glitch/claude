import { it } from 'vitest';
import { groundHeight, surfaceHeight, isWindowTheta } from '../src/world/terrain';
it('sonda', () => {
  let maxErr = 0; let dove = '';
  for (let k = 0; k < 400000; k++) {
    const z = 700 + Math.random() * 1800; const th = Math.random() * 360;
    if (isWindowTheta(th)) continue;
    const e = Math.abs(groundHeight(z, th) - surfaceHeight(z, th));
    if (e > maxErr) { maxErr = e; dove = `${z.toFixed(1)},${th.toFixed(2)}`; }
  }
  let n = 0; for (let k = 0; k < 400000; k++) { const z = 700 + Math.random() * 1800; const th = Math.random() * 360; if (isWindowTheta(th)) continue; if (Math.abs(groundHeight(z, th) - surfaceHeight(z, th)) >= 1.5) n++; }
  console.log('maxErr', maxErr, dove, 'oltre 1.5 su 400k:', n);
});
