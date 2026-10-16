/**
 * I tronchi dei boschi (collisori `castagno` della vegetazione, traccia «natura») non devono
 * ostruire i punti del gioco: i capisaldi della rete di Corbella, i luoghi delle missioni e il centro
 * delle aree d'atterraggio del percorso facile (Ronchi, Terrazza Pedrazzini, alpeggi del Tappo Sud).
 * Il rifacimento grafico ha piantato i boschi fitti (23 275 tronchi contro 5140): è un cambio di
 * gioco, e questa prova lo tiene d'occhio. Si costruisce come nel gioco: vegetazione, poi il paese
 * vero di Corbella che libera i tronchi dove costruisce.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { ShaderMaterial, Vector3 } from 'three';
import { installaCorbella } from '../../src/popolamento/index';
import { LUOGHI, RETE } from '../../src/popolamento/contenuti';
import { createWorldUniforms } from '../../src/render/uniforms';
import { createWorldMaterial } from '../../src/render/worldMaterial';
import { Vegetation } from '../../src/scene/vegetation';
import { METERS_PER_DEG } from '../../src/world/constants';
import { worldToCyl } from '../../src/world/cylinder';
import type { CylinderCollider } from '../../src/world/colliders';
import { giocoFinto } from './banco';

/** Distanza minima (m) fra il bordo di un tronco e un punto del gioco. */
const MARGINE = 1.5;
/** Tipi di luogo che non sono punti da raggiungere a piedi (interni, cielo, alberi, montagne). */
const SALTA = new Set(['interno', 'cielo', 'montagna', 'albero']);
/** Aree d'atterraggio del percorso facile: il loro centro resta libero per più metri. */
const ATTERRAGGI: Array<{ id: string; raggio: number }> = [
  { id: 'terrazza_pedrazzini', raggio: 4 },
  { id: 'i_ronchi', raggio: 4 },
  { id: 'prato_ronco', raggio: 4 },
  { id: 'balcone_messi', raggio: 4 },
];

let tronchi: Array<{ z: number; arc: number; r: number }> = [];

beforeAll(() => {
  const g = giocoFinto(true);
  const u = createWorldUniforms();
  const mat = createWorldMaterial(u, { kind: 'object' }) as ShaderMaterial;
  const veg = new Vegetation(mat, mat, g.world.colliders);
  (g as unknown as { vegetation: Vegetation }).vegetation = veg;
  installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false, orari: false });
  tronchi = [];
  for (const c of g.world.colliders.all()) {
    if (c.kind !== 'cylinder' || c.tag !== 'castagno') continue;
    const cc = c as CylinderCollider;
    const p = worldToCyl(new Vector3().copy(cc.base));
    tronchi.push({ z: p.z, arc: p.theta * METERS_PER_DEG, r: cc.radius });
  }
}, 180000);

/** Il tronco più vicino a (z, theta): distanza dal suo bordo (m). */
function piuVicino(z: number, theta: number): number {
  const arc = theta * METERS_PER_DEG;
  const giro = 360 * METERS_PER_DEG;
  let best = Infinity;
  for (const t of tronchi) {
    let da = t.arc - arc;
    da -= Math.round(da / giro) * giro;
    best = Math.min(best, Math.hypot(t.z - z, da) - t.r);
  }
  return best;
}

describe('i tronchi dei boschi non ostruiscono il gioco', () => {
  it('ci sono i boschi fitti (migliaia di tronchi)', () => {
    expect(tronchi.length).toBeGreaterThan(10000);
  });

  it(`nessun tronco a meno di ${MARGINE} m da un caposaldo della rete di Corbella`, () => {
    const ostruiti = RETE.filter((c) => piuVicino(c.z, c.theta) < MARGINE).map((c) => `${c.id} (${piuVicino(c.z, c.theta).toFixed(2)} m)`);
    expect(ostruiti).toEqual([]);
  });

  it(`nessun tronco a meno di ${MARGINE} m da un luogo delle missioni`, () => {
    const ostruiti = LUOGHI.filter((l) => !SALTA.has(l.tipo ?? '') && piuVicino(l.z, l.theta) < MARGINE).map((l) => `${l.id} (${piuVicino(l.z, l.theta).toFixed(2)} m)`);
    expect(ostruiti).toEqual([]);
  });

  it('il centro delle aree d’atterraggio del percorso facile è libero', () => {
    const ostruiti = ATTERRAGGI.map((a) => ({ a, l: LUOGHI.find((x) => x.id === a.id)! }))
      .filter(({ a, l }) => piuVicino(l.z, l.theta) < a.raggio)
      .map(({ a, l }) => `${a.id} (${piuVicino(l.z, l.theta).toFixed(2)} m)`);
    expect(ostruiti).toEqual([]);
  });
});
