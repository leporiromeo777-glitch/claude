/**
 * Oggetti di scena dei personaggi generati (src/personaggi/oggetti.ts): la voce «nome@osso»
 * dell'indice, il bastone che dalla mano tocca terra ed è dritto, la gerla dietro la schiena,
 * e che seguono l'osso quando l'animatore lo muove.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AnimatorePersonaggio } from '../../src/personaggi/animatore';
import type { ModelloPersonaggio } from '../../src/personaggi/carica';
import { attaccaOggetto, leggiOggetto } from '../../src/personaggi/oggetti';
import { scheletro } from './scheletro';

function modello(): { m: ModelloPersonaggio; ossa: Map<string, THREE.Bone> } {
  const { radice, ossa } = scheletro(11);
  const animatore = new AnimatorePersonaggio(radice, { apertura: 10, altezza: 1.62 });
  const gruppo = new THREE.Group();
  gruppo.add(radice);
  const m: ModelloPersonaggio = {
    gruppo,
    animatore,
    lod: [],
    altezza: 1.62,
    livello: 0,
    update: (dt, stato) => animatore.update(dt, stato),
    libera: () => undefined,
  };
  return { m, ossa };
}

const mondo = (o: THREE.Object3D, p = new THREE.Vector3()) => {
  o.updateWorldMatrix(true, false);
  return p.clone().applyMatrix4(o.matrixWorld);
};

describe('oggetti di scena', () => {
  it('legge «nome@osso» e ignora le voci che non sono oggetti', () => {
    expect(leggiOggetto('bastone@manoD')).toEqual({ nome: 'bastone', osso: 'manoD' });
    expect(leggiOggetto('cesto@manoS (facoltativo)')).toEqual({ nome: 'cesto', osso: 'manoS' });
    expect(leggiOggetto('velo-da-planata (oggetto a parte)')).toBeNull();
    expect(leggiOggetto('lume@bacino')).toEqual({ nome: 'lume', osso: 'bacino' }); // il lume di Ottavio
    expect(leggiOggetto('ombrello@manoS')).toBeNull();
    expect(leggiOggetto('bastone@gomito')).toBeNull();
  });

  it('il bastone sta nella mano, è dritto e tocca terra; poi segue la mano', () => {
    const { m, ossa } = modello();
    m.update(0, {});
    const b = attaccaOggetto(m, 'bastone@manoD') as THREE.Object3D;
    expect(b).not.toBeNull();
    expect(b.parent).toBe(ossa.get('manoD'));
    m.gruppo.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(b);
    expect(box.min.y).toBeLessThan(0.03);
    expect(box.min.y).toBeGreaterThan(-0.06);
    // dritto: l'ingombro orizzontale resta stretto
    expect(box.max.x - box.min.x).toBeLessThan(0.08);
    expect(box.max.z - box.min.z).toBeLessThan(0.08);
    // la mano si alza (saluta): il bastone va con lei
    const prima = mondo(b);
    for (let i = 0; i < 60; i++) m.update(1 / 60, { gesto: 'saluta' });
    m.gruppo.updateMatrixWorld(true);
    expect(mondo(b).y).toBeGreaterThan(prima.y + 0.3);
  });

  it('la gerla sta dietro la schiena, sopra la vita', () => {
    const { m } = modello();
    m.update(0, {});
    const g = attaccaOggetto(m, 'gerla@petto') as THREE.Object3D;
    m.gruppo.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    // il corpo guarda +Z: la cesta è dietro la schiena (retroBusto), solo gli spallacci vengono avanti
    // sulle spalle, senza passare il davanti del petto
    expect((box.max.z + box.min.z) / 2).toBeLessThan(m.animatore.retroBusto);
    expect(box.max.z).toBeLessThan(m.animatore.fronteBusto);
    expect(Math.abs((box.max.x + box.min.x) / 2)).toBeLessThan(0.02); // centrata sulla schiena
    expect(box.min.y).toBeGreaterThan(0.6);
    expect(box.max.y).toBeGreaterThan(1.25); // la bocca arriva alle spalle
  });
});
