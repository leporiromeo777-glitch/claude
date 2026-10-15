import { it } from 'vitest';
import { installaCorbella } from '../src/corbella';
import { giocoFinto } from './banco';
it('elenco', () => {
  const g = giocoFinto(true);
  const c = installaCorbella(g, { agganciaCiclo: false });
  const perAzione = new Map<string, string[]>();
  for (const p of c.punti.values()) {
    const l = perAzione.get(p.azione) ?? [];
    l.push(p.id + (p.attivo ? '' : '*'));
    perAzione.set(p.azione, l);
  }
  for (const [a, l] of perAzione) console.log('PUNTI', a, l.join(' '));
  const tag = new Map<string, number>();
  for (const v of c.collider()) tag.set(v.tag, (tag.get(v.tag) ?? 0) + 1);
  console.log('TAG', [...tag].map(([t, n]) => `${t}:${n}`).join(' '));
  console.log('NPC', [...c.personaggi.keys()].join(' '));
  for (const e of c.elementi.values()) console.log('EL', e.id, e.nome, e.varianti.join('/'), e.variante, e.particelle.join(','));
  console.log('STAT', JSON.stringify(c.statistiche));
});
