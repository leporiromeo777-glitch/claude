import { test } from 'vitest';
import { groundHeight } from '../../../src/world/terrain';
import { METERS_PER_DEG } from '../../../src/world/constants';

function mappa(nome: string, z0: number, z1: number, th0: number, th1: number, passo = 3) {
  const righe: string[] = [`== ${nome}  (righe z da ${z1} a ${z0}, colonne theta ${th0}..${th1}, passo ${passo} m; valori = quota)`];
  const dth = passo / METERS_PER_DEG;
  let hdr = '       ';
  for (let th = th0; th <= th1 + 1e-6; th += dth * 2) hdr += th.toFixed(1).padStart(8);
  righe.push(hdr);
  for (let z = z1; z >= z0; z -= passo) {
    let r = String(z).padStart(6) + ' ';
    for (let th = th0; th <= th1 + 1e-6; th += dth) r += groundHeight(z, th).toFixed(0).padStart(4);
    righe.push(r);
  }
  console.log(righe.join('\n'));
}

test('mappe', () => {
  console.log('METERS_PER_DEG', METERS_PER_DEG);
  mappa('Terrazza Pedrazzini', 920, 980, 19, 28);
  mappa('muri del Velo', 950, 1050, 22, 38, 4);
  mappa('Piazza', 1020, 1090, 31, 42, 3);
  mappa('Cripta', 1090, 1130, 23, 31, 3);
  mappa('Ronchi e riale', 1120, 1220, 40, 62, 4);
});
