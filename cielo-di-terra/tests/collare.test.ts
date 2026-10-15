import { Group, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ordinaCollare } from '../src/render/collare';
import { LAYOUT, R } from '../src/world/constants';

function gruppo(): Group {
  const g = new Group();
  for (const nome of ['collare-veli', 'collare-torri', 'collare-basi']) {
    const o = new Object3D();
    o.name = nome;
    g.add(o);
  }
  return g;
}

const ordine = (g: Group, nome: string): number => g.getObjectByName(nome)!.renderOrder;

describe('Collare: ordine degli strati', () => {
  it('da terra (sotto le nubi) le basi si disegnano per ultime, davanti alle torri', () => {
    const g = gruppo();
    ordinaCollare(g, new Vector3(0, -(R - 2), 1000));
    expect(ordine(g, 'collare-veli')).toBeLessThan(ordine(g, 'collare-torri'));
    expect(ordine(g, 'collare-torri')).toBeLessThan(ordine(g, 'collare-basi'));
  });

  it('sopra il Collare (planata alta) l’ordine si capovolge', () => {
    const g = gruppo();
    ordinaCollare(g, new Vector3(0, -(R - LAYOUT.collare.height - 40), 1000));
    expect(ordine(g, 'collare-basi')).toBeLessThan(ordine(g, 'collare-torri'));
    expect(ordine(g, 'collare-torri')).toBeLessThan(ordine(g, 'collare-veli'));
  });
});
