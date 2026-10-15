import { test } from 'vitest';
import { curveDiLivello, grigliaQuote, lunghezza, locale, type Regione } from '../src/terrazzi';
import { suolo } from '../src/terreno';

test('alzate', () => {
  const r: Regione = { z0: 1050, theta0: 33, xMin: -130, xMax: 150, yMin: -130, yMax: 170, passo: 1.5 };
  const { griglia, nx, ny } = grigliaQuote(r);
  let tot = 0, ripide = 0;
  for (let k = 8; k <= 28; k++) {
    let lk = 0, rk = 0;
    for (const c of curveDiLivello(r, griglia, nx, ny, k * 3.5 + 0.45)) {
      const l = lunghezza(c);
      lk += l;
      // ripidità: campiona il punto medio
      const m = c[Math.floor(c.length / 2)]!;
      const p = locale(r, m[0], m[1]);
      const a = suolo(...([locale(r, m[0] + 2, m[1]).z, locale(r, m[0] + 2, m[1]).theta] as [number, number]));
      void a; void p;
    }
    tot += lk;
    console.log('livello', k * 3.5, 'lunghezza', lk.toFixed(0));
  }
  console.log('totale', tot.toFixed(0), ripide);
});
