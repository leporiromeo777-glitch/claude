/**
 * Chi parla con Elvira si muove come una persona vera in una conversazione tranquilla (traccia «parlare»,
 * docs/migliorie/parlare.md). Sui 13 modelli veri (GLB in Node, skinning sulla CPU) una conversazione
 * simulata come nel gioco (conversazione.ts): Elvira arriva di lato, chi parla si gira con calma, tre
 * battute, il dialogo si chiude, poi si torna alla posa. Le soglie:
 *
 * - niente scatti: nessun osso oltre 220°/s nello spazio della figura (un cenno vivace sta sotto i 100°/s;
 *   prima i gesti delle battute arrivavano a 1100°/s) e niente gradini di velocità (accelerazione sotto
 *   i 3000°/s²: prima il cenno partiva a 63°/s da fermo in un fotogramma, 3800°/s²);
 * - il busto respira piano: petto, collo e testa sotto i 90°/s (prima il respiro cambiava ritmo a ogni
 *   battuta con la fase t·2π/periodo e, con qualche minuto di gioco, il petto tremava);
 * - le mani non entrano nel busto (al più 1,5 cm, la stoffa) e i polsi non si girano (al più 45° rispetto
 *   all'avambraccio), i gomiti non si piegano oltre 150°, la testa non oltre 90° rispetto al petto;
 * - i piedi a terra non scivolano mentre il corpo si gira (al più 0,12 m/s al 95° percentile: si alzano e
 *   fanno passi), e si alzano davvero (almeno 2 cm);
 * - chi è seduto non si alza (bacino fermo entro 1 cm), chi è chino tiene le mani nel lavoro.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { creaAbitante } from '../../src/oggetti/oggetti/abitante';
import { battutaPersonaggio } from '../../src/personaggi/fabbrica';
import { conversazione } from './conversazione';
import { MODELLI, anima, animatoreDi, figura, osso, profiloGradino, registraVeri } from './posa';
import * as THREE from 'three';

beforeAll(async () => {
  await registraVeri();
}, 120000);

const SOGLIE = { vel: 220, acc: 3000, busto: 120, gambe: 320, accGambe: 6000, dentro: 0.015, polso: 45, gomito: 150, collo: 90, scivola: 0.12 } as const;

describe('in piedi: si gira con calma, battute senza scatti', () => {
  for (const id of MODELLI) {
    it(id, () => {
      const o = figura(id);
      const m = conversazione(o, { da: 75 });
      const dove = `${id}: ${JSON.stringify(m, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))}`;
      expect(m.velMax, dove).toBeLessThan(SOGLIE.vel);
      expect(m.accMax, dove).toBeLessThan(SOGLIE.acc);
      expect(m.velBusto, dove).toBeLessThan(SOGLIE.busto);
      expect(m.velGambe, dove).toBeLessThan(SOGLIE.gambe);
      expect(m.accGambe, dove).toBeLessThan(SOGLIE.accGambe);
      expect(m.dentroBusto, dove).toBeLessThan(SOGLIE.dentro);
      expect(m.polsoMax, dove).toBeLessThan(SOGLIE.polso);
      expect(m.gomitoMax, dove).toBeLessThan(SOGLIE.gomito);
      expect(m.collo, dove).toBeLessThan(SOGLIE.collo);
      expect(m.scivolaP95, dove).toBeLessThan(SOGLIE.scivola);
      expect(m.alzataPiedi, dove).toBeGreaterThan(0.02);
      expect(Math.abs(m.giro - 70), dove).toBeLessThan(1);
    });
  }
});

describe('seduti e chini', () => {
  const seduti: [string, Record<string, unknown>][] = [
    ['annunciata', { maniSeduta: 'bastone' }],
    ['pina', {}],
    ['ottavio', {}],
    ['lisa', {}],
  ];
  for (const [id] of seduti) {
    it(`${id} seduta: non si alza, non scatta, non gira il corpo`, () => {
      const o = figura(id);
      const m = conversazione(o, { da: 60, siGira: false, stato: { modo: 'fermo', posa: 'seduto', profilo: profiloGradino(0.42) } });
      const dove = `${id}: ${JSON.stringify(m)}`;
      expect(m.bacino, dove).toBeLessThan(0.01);
      expect(m.velMax, dove).toBeLessThan(SOGLIE.vel);
      expect(m.accMax, dove).toBeLessThan(SOGLIE.acc);
      expect(m.dentroBusto, dove).toBeLessThan(SOGLIE.dentro);
      expect(m.polsoMax, dove).toBeLessThan(SOGLIE.polso);
    });
  }

  it('Togna china alla vasca: parlando le mani restano nel lavoro, la testa si gira poco', () => {
    const o = figura('togna');
    const H = animatoreDi(o).altezza;
    const stato = { modo: 'fermo' as const, posa: 'chino' as const };
    const m = conversazione(o, { da: 50, siGira: false, stato });
    expect(m.velMax).toBeLessThan(SOGLIE.vel);
    expect(m.accMax).toBeLessThan(SOGLIE.acc);
    // dopo le battute le mani sono ancora giù, davanti, nella vasca (sotto la metà dell'altezza)
    anima(o, stato, 30);
    for (const lato of ['S', 'D']) {
      const p = osso(o, `mano${lato}`).getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(o.gruppo.matrixWorld).invert());
      expect(p.y).toBeLessThan(0.55 * H);
      expect(p.z).toBeGreaterThan(0.1 * H);
    }
  });
});

describe('la figura procedurale di riserva', () => {
  it('la testa si volta verso chi parla senza scatti e annuisce piano alla battuta', () => {
    const o = creaAbitante({ seme: 'riserva', copricapo: 'velo' });
    const testa = o.gruppo.getObjectByName('testa') as THREE.Bone;
    for (let i = 0; i < 120; i++) o.update?.(1 / 60, { modo: 'fermo' });
    const prima = testa.quaternion.clone();
    let vMax = 0;
    let aMax = 0;
    let vPrec = 0;
    const guarda = new THREE.Vector3(2.2, 1.6, 0.6); // quasi di lato: 75°
    for (let i = 0; i < 240; i++) {
      if (i === 60) battutaPersonaggio(o.gruppo);
      o.update?.(1 / 60, { modo: 'fermo', guarda });
      const v = testa.quaternion.angleTo(prima) * 60 * (180 / Math.PI);
      vMax = Math.max(vMax, v);
      if (i > 0) aMax = Math.max(aMax, Math.abs(v - vPrec) * 60);
      vPrec = v;
      prima.copy(testa.quaternion);
    }
    expect(vMax).toBeLessThan(170);
    expect(aMax).toBeLessThan(2500);
  });
});

describe('il respiro non dipende da quanto si è giocato', () => {
  it('dopo un minuto o dopo un’ora le battute muovono il petto allo stesso modo', () => {
    const a = conversazione(figura('bortolo', { seme: 'b1' }), { da: 0, prima: 60, siGira: false });
    const b = conversazione(figura('bortolo', { seme: 'b1' }), { da: 0, prima: 3600, siGira: false });
    expect(a.velBusto).toBeLessThan(SOGLIE.busto);
    expect(b.velBusto).toBeLessThan(SOGLIE.busto);
    expect(Math.abs(a.velBusto - b.velBusto)).toBeLessThan(25);
  });
});
