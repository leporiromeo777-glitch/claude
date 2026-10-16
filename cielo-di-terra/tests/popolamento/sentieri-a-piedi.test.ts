/**
 * Le strade della missione 1 percorse a piedi, con il controller vero sul paese vero (in Node):
 * con W, lo sguardo verso il prossimo pezzo del sentiero e qualche grado d'errore, come chi segue
 * le lastre a occhio. La partita automatica si teletrasporta sulla Terrazza Pedrazzini e non
 * vedeva che nessuna delle due strade ci arrivava (il nastro di traverso sulle alzate faceva
 * scivolare a valle, i muri delle terrazze tagliavano la scorciatoia, le strade finivano sotto il
 * ripiano).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerController, emptyInput, type ViewBasis } from '../../src/player/controller';
import { luogo } from '../../src/popolamento/contenuti';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento/index';
import { TRACCIATI } from '../../src/popolamento/luoghi/sentieriCorbella';
import { TRACCIATO_SCORCIATOIA } from '../../src/popolamento/mobili';
import { METERS_PER_DEG } from '../../src/world/constants';
import { localFrameTheta } from '../../src/world/cylinder';
import { groundHeight } from '../../src/world/terrain';
import { giocoFinto } from './banco';

type P = { z: number; theta: number };

let g: ReturnType<typeof giocoFinto>;
let c: ManigliaCorbella;

beforeAll(() => {
  g = giocoFinto(true);
  c = installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false, orari: false, varianti: { E4: 'Abitata' } });
}, 120000);

const dist = (a: P, b: P): number => Math.hypot(a.z - b.z, ((((a.theta - b.theta + 540) % 360) - 180) * METERS_PER_DEG));
const yawVerso = (a: P, b: P): number => (Math.atan2((((b.theta - a.theta + 540) % 360) - 180) * METERS_PER_DEG, b.z - a.z) * 180) / Math.PI;

function vista(yawDeg: number, theta: number): ViewBasis {
  const f = localFrameTheta(theta);
  const y = (yawDeg * Math.PI) / 180;
  const pitch = (-8 * Math.PI) / 180;
  const base = f.north.clone().multiplyScalar(Math.cos(y)).addScaledVector(f.east, Math.sin(y));
  return {
    forward: base.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(f.up, Math.sin(pitch)).normalize(),
    up: f.up.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(base, -Math.sin(pitch)).normalize(),
  };
}

/**
 * Cammina con W lungo la spezzata (inseguendo il campione due passi più in là) fino a `meta`.
 * `errore`: gradi d'errore dello sguardo, cambiato ogni secondo. Niente salti: chi segue un
 * sentiero non salta. Restituisce se è arrivata e dove si è fermata.
 */
function cammina(punti: readonly P[], meta: P, errore: number, seme = 7, maxS = 600): { arrivata: boolean; dove: P; quota: number } {
  let s = seme;
  const caso = (): number => (s = (s * 16807) % 2147483647) / 2147483647;
  const camp: P[] = [];
  for (let i = 0; i + 1 < punti.length; i++) {
    const a = punti[i]!;
    const b = punti[i + 1]!;
    const n = Math.max(1, Math.round(dist(a, b) / 0.75));
    for (let k = 0; k < n; k++) camp.push({ z: a.z + ((b.z - a.z) * k) / n, theta: a.theta + ((b.theta - a.theta) * k) / n });
  }
  camp.push(punti[punti.length - 1]!, meta);
  const p = new PlayerController(g.world.colliders);
  p.groundFn = groundHeight;
  p.teleport(camp[0]!.z, camp[0]!.theta, 0);
  for (let i = 0; i < 30; i++) p.step(1 / 60, emptyInput(), vista(0, p.cyl.theta));
  let j = 1;
  let scarto = 0;
  let fermo = 0;
  let ultimo: P = { z: p.cyl.z, theta: p.cyl.theta };
  const avanti = { ...emptyInput(), forward: 1 };
  for (let passo = 0; passo < maxS * 6; passo++) {
    const qui: P = { z: p.cyl.z, theta: p.cyl.theta };
    if (dist(qui, meta) < 3) return { arrivata: true, dove: qui, quota: p.cyl.h };
    let migliore = j;
    let bd = Infinity;
    for (let k = Math.max(0, j - 3); k < Math.min(camp.length, j + 8); k++) {
      const d = dist(qui, camp[k]!);
      if (d < bd) {
        bd = d;
        migliore = k;
      }
    }
    j = Math.min(camp.length - 1, Math.max(j, migliore + 2));
    if (passo % 6 === 0) scarto = (caso() * 2 - 1) * errore;
    const yaw = yawVerso(qui, camp[j]!) + scarto;
    for (let k = 0; k < 10; k++) p.step(1 / 60, avanti, vista(yaw, p.cyl.theta));
    const ora: P = { z: p.cyl.z, theta: p.cyl.theta };
    fermo = dist(ora, ultimo) < 0.05 ? fermo + 1 : 0;
    ultimo = ora;
    if (fermo > 30) break;
  }
  return { arrivata: false, dove: { z: p.cyl.z, theta: p.cyl.theta }, quota: p.cyl.h };
}

const cartellino = (): P => luogo('castagno_cartellino');
const conMeta = (punti: readonly P[]): P[] => [...punti];

describe('a piedi alla Terrazza Pedrazzini (M1.3, M1.18)', () => {
  it('dalla mulattiera delle Terrazze, a occhio, fino al castagno del cartellino', () => {
    for (const errore of [0, 8, 12]) {
      const r = cammina(conMeta(TRACCIATI.mulattiera), cartellino(), errore);
      expect(r.arrivata, `errore ${errore}°: ferma a (${r.dove.z.toFixed(1)}, ${r.dove.theta.toFixed(2)}) quota ${r.quota.toFixed(2)}`).toBe(true);
    }
  });
  it('dalla scorciatoia con i gradini di assi (variante Abitata), anche dritti dal castagno morto', () => {
    const morto = luogo('castagno_morto');
    for (const errore of [0, 8, 12]) {
      const r = cammina([{ z: morto.z - 2, theta: morto.theta + 0.3 }, ...TRACCIATO_SCORCIATOIA], cartellino(), errore);
      expect(r.arrivata, `errore ${errore}°: ferma a (${r.dove.z.toFixed(1)}, ${r.dove.theta.toFixed(2)}) quota ${r.quota.toFixed(2)}`).toBe(true);
    }
  });
  it('e in discesa, dalla terrazza alla piazza e alla strada della Cripta', () => {
    const m = cammina([...TRACCIATI.mulattiera].reverse(), TRACCIATI.mulattiera[0]!, 8);
    expect(m.arrivata, `mulattiera: ferma a (${m.dove.z.toFixed(1)}, ${m.dove.theta.toFixed(2)})`).toBe(true);
    const s = cammina([...TRACCIATO_SCORCIATOIA].reverse(), TRACCIATO_SCORCIATOIA[0]!, 8);
    expect(s.arrivata, `scorciatoia: ferma a (${s.dove.z.toFixed(1)}, ${s.dove.theta.toFixed(2)})`).toBe(true);
  });
  it('senza i gradini (variante Carta) la scorciatoia non porta in cima', () => {
    c.setVariante('E4', 'Carta');
    try {
      const r = cammina(conMeta(TRACCIATO_SCORCIATOIA), cartellino(), 0, 7, 240);
      expect(r.arrivata).toBe(false);
      expect(r.quota).toBeLessThan(60);
    } finally {
      c.setVariante('E4', 'Abitata');
    }
  });
});

describe('a piedi fra il riale e la piazza (M1.13, M1.21)', () => {
  it('dal guado del Sass alla Piazza delle Ore per la strada dei Ronchi, e ritorno', () => {
    const piazza = luogo('piazza_ore');
    const su = cammina([...TRACCIATI.ronchi].reverse(), { z: piazza.z + 4, theta: piazza.theta + 2.4 }, 8);
    expect(su.arrivata, `ferma a (${su.dove.z.toFixed(1)}, ${su.dove.theta.toFixed(2)})`).toBe(true);
    const giu = cammina(conMeta(TRACCIATI.ronchi), luogo('guado_sass'), 8);
    expect(giu.arrivata, `ferma a (${giu.dove.z.toFixed(1)}, ${giu.dove.theta.toFixed(2)})`).toBe(true);
  });
});
