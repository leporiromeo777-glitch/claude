/**
 * Chi parla con Elvira si muove come una persona vera in una conversazione tranquilla (traccia «parlare»,
 * docs/migliorie/parlare.md). Sui 13 modelli veri (GLB in Node, skinning sulla CPU) una conversazione
 * simulata come nel gioco (conversazione.ts): Elvira arriva di lato, chi parla si gira con calma, tre
 * battute, il dialogo si chiude, poi si torna alla posa. Le soglie:
 *
 * - niente scatti: nessun osso oltre 220°/s nello spazio della figura (un cenno vivace sta sotto i 100°/s;
 *   prima i gesti delle battute arrivavano a 1100°/s) e niente gradini di velocità (accelerazione sotto
 *   i 3000°/s²: prima il cenno partiva a 63°/s da fermo in un fotogramma, 3800°/s²);
 * - il busto respira piano: petto, collo e testa sotto i 120°/s, la testa che si volta compresa (prima il
 *   respiro cambiava ritmo a ogni battuta con la fase t·2π/periodo e, con qualche minuto di gioco, il petto
 *   tremava);
 * - le mani non entrano nel busto (al più 1,5 cm, la stoffa) e i polsi non si girano (al più 45° rispetto
 *   all'avambraccio), i gomiti non si piegano oltre 150°, la testa non oltre 90° rispetto al petto;
 * - i piedi a terra non scivolano mentre il corpo si gira (al più 0,12 m/s al 95° percentile: si alzano e
 *   fanno passi), e si alzano davvero (almeno 2 cm);
 * - chi è seduto non si alza (bacino fermo entro 1 cm), chi è chino tiene le mani nel lavoro.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { creaAbitante } from '../../src/oggetti/oggetti/abitante';
import { battutaPersonaggio, ripostoOggettoPersonaggio } from '../../src/personaggi/fabbrica';
import { conversazione, sguardoDaDietro } from './conversazione';
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

describe('il giro ampio (Elvira alle spalle): i piedi fanno passi, non strisciano', () => {
  // prima il piede in aria andava da dov'era a dove si posava rispetto al corpo: nel momento in cui si
  // staccava e in quello in cui si posava correva, ancora a terra, con il corpo che girava (0,3 m/s) e poi
  // si fermava di colpo; e si alzava alla quarta del seno, sotto 1,5 cm per metà del passo mentre già
  // girava. A 165° i piedi a terra scivolavano a 0,11-0,26 m/s (95° percentile) e fino a 0,4-0,7 m/s, il
  // piede fermo si torceva fino a 30° rispetto al bacino. Adesso la traiettoria del piede in aria è nel
  // mondo (si stacca e si posa fermo), gira solo quando è su, il piede a terra ruota un po' sul posto.
  for (const id of MODELLI) {
    it(id, () => {
      for (const da of [165, -165, 120]) {
        const m = conversazione(figura(id), { da, fine: 12 });
        const dove = `${id} da ${da}°: ${JSON.stringify(m, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v))}`;
        expect(m.scivolaP95, dove).toBeLessThan(0.05);
        expect(m.scivolaMax, dove).toBeLessThan(0.25);
        expect(m.torsione, dove).toBeLessThan(27);
        expect(m.velGambe, dove).toBeLessThan(SOGLIE.gambe);
        expect(m.accGambe, dove).toBeLessThan(SOGLIE.accGambe);
        expect(m.velBusto, dove).toBeLessThan(SOGLIE.busto);
        expect(m.alzataPiedi, dove).toBeGreaterThan(0.02);
        expect(Math.abs(Math.abs(m.giro) - (Math.abs(da) - 5)), dove).toBeLessThan(1);
      }
    });
  }
});

describe('Elvira arriva da dietro: la testa si gira dalla sua parte', () => {
  // prima, oltre i 100° la testa restava dal lato da cui era girata per uno sguardo distratto: una volta su
  // due guardava dalla parte opposta a Elvira e, quando il corpo si girava, attraversava 150° a 160°/s
  // (232°/s nel mondo); adesso la guarda dalla sua parte e, mentre il corpo gira, la testa rientra piano
  for (const id of MODELLI) {
    it(id, () => {
      for (const da of [110, -110, 150, -150]) {
        const m = sguardoDaDietro(figura(id), { da, distratto: -Math.sign(da) * 40 });
        const dove = `${id} da ${da}°: ${JSON.stringify(m, (_k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v))}`;
        expect(Math.sign(m.testaAllApertura), dove).toBe(Math.sign(da));
        expect(Math.abs(m.testaAllApertura), dove).toBeGreaterThan(55);
        expect(m.dallaParteSbagliata, dove).toBe(0);
        expect(m.cambiLato, dove).toBe(0);
        expect(m.velFigura, dove).toBeLessThan(SOGLIE.busto);
        expect(m.velMondo, dove).toBeLessThan(SOGLIE.busto);
      }
      // quasi alle spalle (170°), con la testa ancora dal lato di prima: il popolamento gira il corpo da
      // quel lato (rivolgiVerso, il giro un po' più lungo) e la testa non passa all'altra spalla
      for (const da of [170, -170]) {
        const o = figura(id);
        const m = sguardoDaDietro(o, { da, distratto: -Math.sign(da) * 140, verso: -Math.sign(da) });
        const dove = `${id} da ${da}° col giro lungo: ${JSON.stringify(m, (_k, v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v))}`;
        expect(Math.sign(m.testaAllApertura), dove).toBe(-Math.sign(da));
        expect(m.cambiLato, dove).toBe(0);
        expect(m.velFigura, dove).toBeLessThan(SOGLIE.busto);
        expect(m.velMondo, dove).toBeLessThan(SOGLIE.busto);
      }
    });
  }

  it('chi le passa dietro le spalle: la testa cambia spalla una volta sola, piano', () => {
    for (const id of ['bortolo', 'clelia', 'lisa']) {
      const m = sguardoDaDietro(figura(id), { da: 130, distratto: 0, passaDietro: true });
      const dove = `${id}: ${JSON.stringify(m)}`;
      expect(m.cambiLato, dove).toBe(1);
      expect(m.velFigura, dove).toBeLessThan(SOGLIE.busto);
    }
  });
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

  it('i passi sul posto del giro cominciano e finiscono senza gradini di velocità', () => {
    // il popolamento, mentre la figura procedurale si gira verso chi parla, la fa camminare sul posto
    // (abitanti.ts, gira): il peso della camminata entrava e usciva al primo ordine, gambe e braccia
    // partivano a 100-120°/s in un fotogramma (gli stinchi hanno il loro ginocchio a gomito: fuori). Si
    // ferma a metà passo, il caso peggiore: prima 120°/s e 5300°/s², adesso 64°/s e 900°/s²
    const o = creaAbitante({ seme: 'riserva-giro' });
    const nomi = ['cosciaS', 'cosciaD', 'braccioS', 'braccioD', 'petto', 'testa'];
    const ossa = nomi.map((n) => o.gruppo.getObjectByName(n) as THREE.Bone);
    for (let i = 0; i < 60; i++) o.update?.(1 / 60, { modo: 'fermo' });
    const prec = ossa.map((b) => b.quaternion.clone());
    const vPrec = ossa.map(() => 0);
    let vMax = 0;
    let aMax = 0;
    for (let i = 0; i < 240; i++) {
      o.update?.(1 / 60, { modo: i >= 30 && i < 100 ? 'cammina' : 'fermo', velocita: 0.45 });
      ossa.forEach((b, j) => {
        const v = b.quaternion.angleTo(prec[j] as THREE.Quaternion) * 60 * (180 / Math.PI);
        vMax = Math.max(vMax, v);
        if (i > 0) aMax = Math.max(aMax, Math.abs(v - (vPrec[j] as number)) * 60);
        vPrec[j] = v;
        (prec[j] as THREE.Quaternion).copy(b.quaternion);
      });
    }
    expect(vMax).toBeLessThan(90);
    expect(aMax).toBeLessThan(SOGLIE.acc);
  });
});

describe('Clelia, dato il pacchetto, non lo tiene più in mano', () => {
  it('il pacchetto si mette via e resta via mentre la figura si anima; si può riprendere', () => {
    const o = figura('clelia');
    const p = o.gruppo.getObjectByName('oggetto:pacchetto')!;
    expect(p).toBeTruthy();
    expect(p.visible).toBe(true);
    ripostoOggettoPersonaggio(o.gruppo, 'pacchetto', true);
    expect(p.visible).toBe(false);
    anima(o, { modo: 'fermo' }, 30);
    expect(p.visible).toBe(false);
    ripostoOggettoPersonaggio(o.gruppo, 'pacchetto', false);
    expect(p.visible).toBe(true);
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
