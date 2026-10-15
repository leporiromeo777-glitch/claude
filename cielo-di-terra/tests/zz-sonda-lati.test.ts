import { it } from 'vitest';
import { creaLineaLibera, posizioniCapisaldi } from '../src/regia/catasto';
import { CAPISALDI } from '../src/regia/contenuti';
import { installaCorbella, portaPopolamento } from '../src/popolamento';
import { giocoFinto } from './popolamento/banco';
import { cylToWorld, worldToCyl } from '../src/world/cylinder';
import { groundHeight } from '../src/world/terrain';

it('sonda', () => {
  const g = giocoFinto();
  const c = installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false });
  const porta = portaPopolamento(c);
  const pm = (id: string) => { const x = CAPISALDI.find((y) => y.id === id)!; return { id, z: x.z, theta: x.theta, altezza: x.altezza, altezzaSegnale: x.altezza_segnale ?? 0 }; };
  const righe: string[] = [];
  const s4 = worldToCyl(porta.punto('segnale_cs_4')!);
  const ch4 = worldToCyl(porta.punto('chiodo_cs_4')!);
  righe.push(`cs_4 chiodo h ${ch4.h.toFixed(1)} segnale h ${s4.h.toFixed(1)} z ${s4.z.toFixed(1)} th ${s4.theta.toFixed(2)}`);
  for (const alza of [0, 4, 8, 11.5, 15, 20, 25, 30, 40]) {
    const pos = posizioniCapisaldi({
      punto: (id) => { const p = porta.punto(`chiodo_${id}`); if (!p) return null; if (id !== 'cs_4') return p; const q = worldToCyl(p); return cylToWorld(q.z, q.theta, q.h + alza); },
      segnale: (id) => { const p = porta.punto(`segnale_${id}`); if (!p) return null; if (id !== 'cs_4') return p; const q = worldToCyl(p); return cylToWorld(q.z, q.theta, q.h + alza); },
    });
    const f = creaLineaLibera(g.world.colliders, pos.occhio, pos.segnale);
    const r = (a: string, b: string) => { const e = f(pm(a), pm(b), { scopo: 'lato', ora: 600 }); return e === true ? 'ok' : 'NO'; };
    righe.push(`alza ${alza}: 1->4 ${r('cs_1','cs_4')} 3->4 ${r('cs_3','cs_4')} 37->4 ${r('cs_37','cs_4')} | 4->1 ${r('cs_4','cs_1')} 4->3 ${r('cs_4','cs_3')} 4->37 ${r('cs_4','cs_37')}`);
  }
  // profilo del terreno fra 3 e 4 e fra 37 e 4
  for (const [a, b] of [['cs_3', 'cs_4'], ['cs_37', 'cs_4'], ['cs_1', 'cs_4']]) {
    const A = CAPISALDI.find((y) => y.id === a)!; const B = CAPISALDI.find((y) => y.id === b)!;
    const prof: string[] = [];
    for (let t = 0; t <= 1.0001; t += 0.1) { const z = A.z + (B.z - A.z) * t; const th = A.theta + (B.theta - A.theta) * t; prof.push(groundHeight(z, th).toFixed(0)); }
    righe.push(`${a}-${b} suolo: ${prof.join(' ')}`);
  }
  console.log(righe.join('\n'));
});
