import { it } from 'vitest';
import { creaLineaLibera, posizioniCapisaldi } from '../src/regia/catasto';
import { CAPISALDI } from '../src/regia/contenuti';
import { installaCorbella, portaPopolamento } from '../src/popolamento';
import { giocoFinto } from './popolamento/banco';
import { worldToCyl } from '../src/world/cylinder';
import { groundHeight } from '../src/world/terrain';

it('sonda', () => {
  const g = giocoFinto();
  const c = installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false });
  const porta = portaPopolamento(c);
  const pos = posizioniCapisaldi({ punto: (id) => porta.punto(`chiodo_${id}`), segnale: (id) => porta.punto(`segnale_${id}`) });
  const f = creaLineaLibera(g.world.colliders, pos.occhio, pos.segnale);
  const pm = (id: string) => { const x = CAPISALDI.find((y) => y.id === id)!; return { id, z: x.z, theta: x.theta, altezza: x.altezza, altezzaSegnale: x.altezza_segnale ?? 0 }; };
  const righe: string[] = [];
  for (const x of CAPISALDI) {
    const o = pos.occhio(pm(x.id)); const s = pos.segnale(pm(x.id)); const co = worldToCyl(o); const cs = worldToCyl(s);
    righe.push(`${x.id} occhio h ${co.h.toFixed(1)} (suolo ${groundHeight(co.z, co.theta).toFixed(1)}) segnale h ${cs.h.toFixed(1)} (suolo ${groundHeight(cs.z, cs.theta).toFixed(1)})`);
  }
  for (const x of CAPISALDI) for (const v of (x as any).visibile_da ?? []) {
    const id = typeof v === 'string' ? v : v.id;
    righe.push(`${id} -> ${x.id}: ${JSON.stringify(f(pm(id), pm(x.id), { scopo: 'lato', ora: 600 }))}`);
  }
  console.log(righe.join('\n'));
});
