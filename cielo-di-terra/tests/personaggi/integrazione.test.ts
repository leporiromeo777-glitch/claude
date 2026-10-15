/**
 * L'integrazione nel popolamento (src/popolamento/abitanti.ts): con i modelli registrati (sintetici, uno
 * per ciascuno dei 13 id dell'indice) Corbella usa creaPersonaggio per i nove personaggi e i dodici
 * velati, mentre la Madre e Rosa restano procedurali; posizioni, presenze e cilindri nel mondo sono
 * quelli della stessa Corbella senza modelli; gli oggetti di scena vengono dall'indice; seduti e Velo
 * da planata passano dallo stato. In Node, con il banco del popolamento.
 */
import * as THREE from 'three';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Collider } from '../../src/world/colliders';
import { worldToCyl } from '../../src/world/cylinder';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento/index';
import { preparaPrototipo, registraPrototipo, svuotaPersonaggi } from '../../src/personaggi/precarica';
import { GENERICI, SCHEDE } from '../../src/personaggi/schede';
import { giocoFinto } from '../popolamento/banco';
import { modelloSintetico } from './sintetico';

const NOMINATI = ['ottavio', 'togna', 'bortolo', 'pina', 'annunciata', 'nando', 'clelia', 'lisa', 'gioanin'];

let gProc: ReturnType<typeof giocoFinto>;
let gNuovo: ReturnType<typeof giocoFinto>;
let proc: ManigliaCorbella;
let nuovo: ManigliaCorbella;

beforeAll(() => {
  // prima Corbella com'era (nessun modello), poi con i 13 modelli
  svuotaPersonaggi();
  gProc = giocoFinto(true);
  proc = installaCorbella(gProc, { agganciaCiclo: false });
  Object.keys(SCHEDE).forEach((id, i) => registraPrototipo(preparaPrototipo(id, modelloSintetico(11 + i), SCHEDE[id])));
  gNuovo = giocoFinto(true);
  nuovo = installaCorbella(gNuovo, { agganciaCiclo: false });
}, 240000);

afterAll(() => {
  proc.dispose();
  nuovo.dispose();
  svuotaPersonaggi();
});

/** il modello usato da un abitante (userData.personaggio del gruppo dentro la figura), o null se procedurale */
function modello(c: ManigliaCorbella, id: string): string | null {
  const f = c.npc(id)?.figura;
  const g = f?.children[0];
  return (g?.userData['personaggio'] as string | undefined) ?? null;
}

function cerca(f: THREE.Object3D | null | undefined, nome: string): THREE.Object3D | null {
  let o: THREE.Object3D | null = null;
  f?.traverse((x) => {
    if (!o && x.name === nome) o = x;
  });
  return o;
}

/** i cilindri «personaggio» del mondo, come (z, θ, h, raggio, altezza) */
function cilindri(g: ReturnType<typeof giocoFinto>): Array<[number, number, number, number, number]> {
  const out: Array<[number, number, number, number, number]> = [];
  for (const c of g.world.colliders.all() as IterableIterator<Collider>) {
    if (c.tag !== 'personaggio' || c.kind !== 'cylinder') continue;
    const p = worldToCyl(c.base);
    out.push([p.z, p.theta, p.h, c.radius, c.height]);
  }
  return out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

describe('i personaggi nuovi nel popolamento', () => {
  it('i nove personaggi hanno il loro modello, i velati un generico, la Madre e Rosa la figura procedurale', () => {
    for (const id of NOMINATI) expect(modello(nuovo, id), id).toBe(id);
    for (let i = 1; i <= 12; i++) expect(GENERICI as readonly string[]).toContain(modello(nuovo, `velato_${i}`));
    expect(modello(nuovo, 'la_madre')).toBeNull();
    expect(modello(nuovo, 'rosa')).toBeNull();
    // senza modelli tutto come prima
    for (const id of [...NOMINATI, 'velato_1', 'velato_12']) expect(modello(proc, id), id).toBeNull();
  });

  it('stesse posizioni, presenze e cilindri (raggio 0,3) per gli stessi giorni e ore', () => {
    for (const [giorno, ora] of [
      [1, 6.2],
      [1, 9.5],
      [1, 10],
      [1, 20.2],
      [2, 5.9],
      [2, 10],
      [2, 15],
      [3, 6],
    ] as const) {
      proc.applicaOrario(giorno, ora);
      nuovo.applicaOrario(giorno, ora);
      for (const [id, n] of proc.personaggi) {
        const m = nuovo.npc(id)!;
        expect(m.presente, `${id} ${giorno} ${ora}`).toBe(n.presente);
        const a = n.posizione();
        const b = m.posizione();
        if (!a || !b) {
          expect(b, id).toEqual(a);
          continue;
        }
        expect(b.z, id).toBeCloseTo(a.z, 6);
        expect(b.theta, id).toBeCloseTo(a.theta, 6);
        expect(b.h, id).toBeCloseTo(a.h, 6);
      }
    }
  });

  it('i cilindri nel mondo hanno lo stesso raggio e la stessa base; l altezza segue la figura', () => {
    proc.applicaOrario(1, 10);
    nuovo.applicaOrario(1, 10);
    const a = cilindri(gProc);
    const b = cilindri(gNuovo);
    expect(b.length).toBe(a.length);
    expect(a.length).toBeGreaterThan(15);
    a.forEach((ca, i) => {
      const cb = b[i]!;
      expect(cb[0]).toBeCloseTo(ca[0], 4);
      expect(cb[1]).toBeCloseTo(ca[1], 6);
      expect(cb[2]).toBeCloseTo(ca[2], 4);
      expect(cb[3]).toBe(ca[3]);
      // l'altezza è quella del modello (qui sintetico, 1,62 m per tutti; nel gioco fra -16 e +11 cm
      // rispetto alla figura procedurale, vedi docs/personaggi/INTEGRAZIONE.md)
      expect(cb[4]).toBeGreaterThanOrEqual(1.0);
      expect(cb[4]).toBeLessThan(1.9);
    });
  });

  it('gli oggetti di scena: dall indice per i modelli nuovi, gli accessori del popolamento al loro posto', () => {
    const fig = (id: string) => nuovo.npc(id)?.figura;
    // Nando: la pietra dell'indice in mano, non quella procedurale sull'avambraccio
    expect(cerca(fig('nando'), 'oggetto:pietra')).not.toBeNull();
    expect(cerca(fig('nando'), 'pietra-nando')).toBeNull();
    expect(cerca(proc.npc('nando')?.figura, 'pietra-nando')).not.toBeNull();
    // Ottavio: il lume sulla presa «cintura», il Velo da planata nel gruppo (png.ts lo cerca per nome)
    expect(cerca(fig('ottavio'), 'lume-ottavio')?.parent?.name).toBe('cintura');
    expect(cerca(fig('ottavio'), 'velo-ottavio')).not.toBeNull();
    expect(cerca(fig('pina'), 'oggetto:forbici')).not.toBeNull();
    expect(cerca(fig('pina'), 'oggetto:figura-di-cartone')).not.toBeNull();
    expect(cerca(fig('clelia'), 'oggetto:pacchetto')).not.toBeNull();
    // il bastone di Annunciata è quello della fabbrica (da terra alla mano), non un secondo dall'indice
    expect(cerca(fig('annunciata'), 'bastone')).not.toBeNull();
    expect(cerca(fig('annunciata'), 'oggetto:bastone')).toBeNull();
    // la gerla solo ai velati che l'avevano (velato_5 e velato_10), non a chi ha solo il cappello
    expect(cerca(fig('velato_5'), 'oggetto:gerla')).not.toBeNull();
    expect(cerca(fig('velato_10'), 'oggetto:gerla')).not.toBeNull();
    expect(modello(nuovo, 'velato_2')).toBe('velato_gerla');
    expect(cerca(fig('velato_2'), 'oggetto:gerla')).toBeNull();
  });

  it('seduti e chini passano dallo stato (niente posaOssa sulle ossa del modello)', () => {
    nuovo.applicaOrario(1, 10);
    for (let i = 0; i < 90; i++) nuovo.update(1 / 30);
    const anca = (id: string, osso: string) => {
      const f = nuovo.npc(id)!.figura!;
      f.updateMatrixWorld(true);
      const o = cerca(f, osso)!;
      return o.getWorldPosition(new THREE.Vector3()).applyMatrix4(f.matrixWorld.clone().invert());
    };
    // Annunciata seduta sulla panca: le anche a 0,5 m più lo spessore delle vesti (5% di 1,62)
    expect(anca('annunciata', 'cosciaS').y).toBeCloseTo(0.5 + 0.05 * 1.62, 1);
    // Togna china sulla vasca: la testa avanti rispetto al bacino
    nuovo.applicaOrario(1, 9.5);
    for (let i = 0; i < 90; i++) nuovo.update(1 / 30);
    expect(anca('togna', 'testa').z - anca('togna', 'bacino').z).toBeGreaterThan(0.15);
  });

  it('col Velo da planata aperto Ottavio si tiene ai montanti, a terra no', () => {
    const mani = () => {
      const f = nuovo.npc('ottavio')!.figura!;
      f.updateMatrixWorld(true);
      return cerca(f, 'manoD')!.getWorldPosition(new THREE.Vector3()).applyMatrix4(f.matrixWorld.clone().invert()).y;
    };
    nuovo.applicaOrario(1, 6.2); // in volo sopra la valle
    expect(cerca(nuovo.npc('ottavio')!.figura, 'velo-ottavio')!.visible).toBe(true);
    for (let i = 0; i < 60; i++) nuovo.update(1 / 30);
    const inVolo = mani();
    nuovo.applicaOrario(2, 15); // a terra al prato del ronco
    for (let i = 0; i < 60; i++) nuovo.update(1 / 30);
    const aTerra = mani();
    expect(inVolo).toBeGreaterThan(aTerra + 0.3);
  });
});
