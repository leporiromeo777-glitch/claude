/**
 * Il lavatoio a piedi (rifinitura 2): dal chiodo 5, sul primo gradino, con il controller vero sul
 * paese vero, si arriva alla vasca (`esamina:lavatoio`) e a Togna, che alle 10 del primo giorno
 * lava lì. La rifinitura 1 aveva alzato il lavatoio di 0,8 m (collider e posizioni nuovi): tornato
 * alla quota di prima, la prova controlla che il punto d'interazione e il personaggio restino
 * raggiungibili camminando, senza salti.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerController, emptyInput, type ViewBasis } from '../../src/player/controller';
import { RETE } from '../../src/popolamento/contenuti';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento/index';
import { DISLIVELLO_LAVATOIO } from '../../src/popolamento/luoghi/piazza';
import { METERS_PER_DEG } from '../../src/world/constants';
import { localFrameTheta } from '../../src/world/cylinder';
import { groundHeight } from '../../src/world/terrain';
import { giocoFinto } from './banco';

type P = { z: number; theta: number };

let g: ReturnType<typeof giocoFinto>;
let c: ManigliaCorbella;

beforeAll(() => {
  g = giocoFinto(true);
  c = installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false, orari: false });
}, 120000);

const dist = (a: P, b: P): number => Math.hypot(a.z - b.z, (((a.theta - b.theta + 540) % 360) - 180) * METERS_PER_DEG);
const yawVerso = (a: P, b: P): number => (Math.atan2((((b.theta - a.theta + 540) % 360) - 180) * METERS_PER_DEG, b.z - a.z) * 180) / Math.PI;

function vista(yawDeg: number, theta: number): ViewBasis {
  const f = localFrameTheta(theta);
  const y = (yawDeg * Math.PI) / 180;
  const base = f.north.clone().multiplyScalar(Math.cos(y)).addScaledVector(f.east, Math.sin(y));
  return { forward: base.clone(), up: f.up.clone() };
}

/**
 * Cammina con W verso `meta` dal punto `da` (passando per `via`, se c'è), guardando sempre il prossimo
 * punto; si ferma a `raggio` m. Niente salti. Restituisce se è arrivata e la distanza finale.
 */
function cammina(da: P, meta: P, raggio: number, via: P[] = []): { arrivata: boolean; distanza: number } {
  const p = new PlayerController(g.world.colliders);
  p.groundFn = groundHeight;
  p.teleport(da.z, da.theta, groundHeight(da.z, da.theta) + 0.3);
  for (let i = 0; i < 30; i++) p.step(1 / 60, emptyInput(), vista(0, p.cyl.theta));
  const tappe = [...via, meta];
  let k = 0;
  const avanti = { ...emptyInput(), forward: 1 };
  for (let passo = 0; passo < 60 * 30; passo++) {
    const qui: P = { z: p.cyl.z, theta: p.cyl.theta };
    if (dist(qui, meta) < raggio) return { arrivata: true, distanza: dist(qui, meta) };
    if (k < tappe.length - 1 && dist(qui, tappe[k]!) < 0.6) k++;
    p.step(1 / 60, avanti, vista(yawVerso(qui, tappe[k]!), p.cyl.theta));
  }
  return { arrivata: false, distanza: dist({ z: p.cyl.z, theta: p.cyl.theta }, meta) };
}

/** Prova a piedi dal chiodo: diritto, poi girando attorno alla vasca da una parte o dall'altra. */
function raggiungibile(meta: P, raggio: number): { arrivata: boolean; distanza: number } {
  const cs5 = RETE.find((x) => x.id === 'cs_5')!;
  const chiodo = c.punto(`chiodo:${cs5.numero}`)!;
  const da = { z: chiodo.cil.z, theta: chiodo.cil.theta };
  let migliore = cammina(da, meta, raggio);
  if (migliore.arrivata) return migliore;
  // girando attorno: un punto a metà strada, spostato di lato di 2,5 m
  const m = { z: (da.z + meta.z) / 2, theta: (da.theta + meta.theta) / 2 };
  const lat = yawVerso(da, meta) + 90;
  for (const s of [1, -1]) {
    const y = (lat * Math.PI) / 180;
    const via = { z: m.z + Math.cos(y) * 2.5 * s, theta: m.theta + (Math.sin(y) * 2.5 * s) / METERS_PER_DEG };
    const r = cammina(da, meta, raggio, [via]);
    if (r.arrivata) return r;
    if (r.distanza < migliore.distanza) migliore = r;
  }
  return migliore;
}

describe('il lavatoio a piedi dal chiodo 5', () => {
  it('il lavatoio sta alla sua quota (niente basamento rialzato senza approvazione)', () => {
    expect(DISLIVELLO_LAVATOIO).toBe(0);
  });
  it('si arriva alla vasca (esamina:lavatoio) camminando', () => {
    const v = c.punto('esamina:lavatoio')!;
    expect(v).toBeDefined();
    const r = raggiungibile({ z: v.cil.z, theta: v.cil.theta }, 1.8);
    expect(r.arrivata, `ferma a ${r.distanza.toFixed(2)} m dalla vasca`).toBe(true);
  });
  it('si arriva a Togna, che alle 10 lava al lavatoio', () => {
    c.applicaOrario(1, 10);
    const t = c.npc('togna')!;
    expect(t.presente).toBe(true);
    const pos = t.posizione()!;
    const r = raggiungibile({ z: pos.z, theta: pos.theta }, 1.8);
    expect(r.arrivata, `ferma a ${r.distanza.toFixed(2)} m da Togna`).toBe(true);
  });
});
