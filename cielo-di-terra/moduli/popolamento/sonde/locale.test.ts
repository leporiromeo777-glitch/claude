import { test } from 'vitest';
import { groundHeight } from '../../../src/world/terrain';
import { sposta } from '../src/terreno';

function mappaLocale(nome: string, z0: number, th0: number, h0: number, x0: number, x1: number, y0: number, y1: number, passo: number) {
  const righe = [`== ${nome} origine (${z0}, ${th0}) righe y(nord) da ${y1} a ${y0}, colonne x(est) da ${x0} a ${x1} passo ${passo}`];
  let hdr = '      ';
  for (let x = x0; x <= x1; x += passo) hdr += String(x).padStart(4);
  righe.push(hdr);
  for (let y = y1; y >= y0; y -= passo) {
    let r = String(y).padStart(5) + ' ';
    for (let x = x0; x <= x1; x += passo) {
      const p = sposta(z0, th0, y, x, h0);
      r += groundHeight(p.z, p.theta).toFixed(0).padStart(4);
    }
    righe.push(r);
  }
  console.log(righe.join('\n'));
}

test('mappe locali', () => {
  mappaLocale('Piazza e chiesa', 1046, 37.0, 38.5, -48, 48, -27, 45, 3);
  mappaLocale('Cripta', 1112, 27.0, 46, -21, 30, -27, 24, 3);
  mappaLocale('Terrazza', 948, 23.0, 77, -24, 45, -36, 36, 3);
  mappaLocale('Fienile/riale', 1170, 52, 6, -45, 45, -60, 45, 3);
});
