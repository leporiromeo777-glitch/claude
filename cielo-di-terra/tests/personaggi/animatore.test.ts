/**
 * Animatore dei personaggi generati: su uno scheletro sintetico con le stesse 17 ossa (e orientamenti
 * di riposo casuali, come quelli che esporta Blender) controlla che le rotazioni in spazio modello
 * facciano quello che dicono: braccia giù, passo alternato, IK della mano, testa che guarda.
 */
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AnimatorePersonaggio } from '../../src/personaggi/animatore';
import { ATTACCHI, scheletro } from './scheletro';

const posizione = (b: THREE.Bone) => {
  b.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
};

describe('AnimatorePersonaggio', () => {
  it('vuole tutte le 17 ossa', () => {
    const { radice, ossa } = scheletro();
    (ossa.get('manoD') as THREE.Bone).name = 'altro';
    expect(() => new AnimatorePersonaggio(radice)).toThrow(/manoD/);
  });

  it('da fermo abbassa le braccia dalla posa ad A fino all’apertura chiesta', () => {
    const { radice, ossa } = scheletro();
    const a = new AnimatorePersonaggio(radice, { apertura: 10, altezza: 1.62 });
    for (let i = 0; i < 30; i++) a.update(1 / 60, { modo: 'fermo' });
    radice.updateMatrixWorld(true);
    const spalla = posizione(ossa.get('braccioS') as THREE.Bone);
    const gomito = posizione(ossa.get('avambraccioS') as THREE.Bone);
    const ang = THREE.MathUtils.radToDeg(Math.atan2(gomito.x - spalla.x, spalla.y - gomito.y));
    expect(ang).toBeGreaterThan(6);
    expect(ang).toBeLessThan(14);
    // anche il destro, simmetrico (a meno del peso che si sposta da un fianco all'altro)
    const spallaD = posizione(ossa.get('braccioD') as THREE.Bone);
    const gomitoD = posizione(ossa.get('avambraccioD') as THREE.Bone);
    const angD = THREE.MathUtils.radToDeg(Math.atan2(spallaD.x - gomitoD.x, spallaD.y - gomitoD.y));
    expect(Math.abs(angD - ang)).toBeLessThan(2);
  });

  it('camminando i piedi vanno avanti e indietro in controfase', () => {
    const { radice, ossa } = scheletro(11);
    const a = new AnimatorePersonaggio(radice, { altezza: 1.62 });
    const zs: number[] = [];
    const zd: number[] = [];
    for (let i = 0; i < 240; i++) {
      a.update(1 / 60, { modo: 'cammina', velocita: 1.2 });
      if (i > 60) {
        radice.updateMatrixWorld(true);
        zs.push(posizione(ossa.get('piedeS') as THREE.Bone).z);
        zd.push(posizione(ossa.get('piedeD') as THREE.Bone).z);
      }
    }
    expect(Math.max(...zs)).toBeGreaterThan(0.12);
    expect(Math.min(...zs)).toBeLessThan(-0.08);
    // controfase: quando il sinistro è più avanti, il destro è indietro
    const k = zs.indexOf(Math.max(...zs));
    expect(zd[k] as number).toBeLessThan(0);
    for (const z of [...zs, ...zd]) expect(Number.isFinite(z)).toBe(true);
  });

  it('IK: la mano destra va sul petto', () => {
    const { radice, ossa } = scheletro(3);
    const a = new AnimatorePersonaggio(radice, { altezza: 1.62, fronteBusto: 0.14 });
    for (let i = 0; i < 180; i++) a.update(1 / 60, { modo: 'fermo', gesto: 'mano-al-petto' });
    radice.updateMatrixWorld(true);
    const polso = posizione(ossa.get('manoD') as THREE.Bone);
    const petto = ATTACCHI.petto[1];
    const collo = ATTACCHI.collo[1];
    const bersaglio = new THREE.Vector3(0.03 * 1.62, petto + 0.3 * (collo - petto), 0.14 + 0.035 * 1.62);
    expect(polso.distanceTo(bersaglio)).toBeLessThan(0.03);
  });

  it('la testa si gira verso il punto guardato', () => {
    const { radice, ossa } = scheletro(5);
    const a = new AnimatorePersonaggio(radice, { altezza: 1.62 });
    const testa = ossa.get('testa') as THREE.Bone;
    radice.updateMatrixWorld(true);
    const qRiposo = testa.getWorldQuaternion(new THREE.Quaternion());
    for (let i = 0; i < 120; i++) a.update(1 / 60, { modo: 'fermo', guarda: new THREE.Vector3(3, 1.4, 2) });
    radice.updateMatrixWorld(true);
    // la rotazione del mondo della testa rispetto al riposo, applicata all'avanti (+Z), punta verso +X
    const delta = testa.getWorldQuaternion(new THREE.Quaternion()).multiply(qRiposo.invert());
    const avanti = new THREE.Vector3(0, 0, 1).applyQuaternion(delta);
    expect(avanti.x).toBeGreaterThan(0.5);
  });
});
