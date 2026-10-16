/**
 * Le porte del paese (migliorie «porte», dopo la prova del 16 ottobre: «alcune porte che non si
 * vedono e sono incastrate»). Sul paese vero costruito in Node:
 *
 * - l'inventario: ogni generatore con una porta la dichiara, e la versione lontana delle case ha la
 *   sua porta nello stesso posto;
 * - la verifica di `verificaPorte` su tutte le porte (varianti degli elementi mobili comprese):
 *   soglia a ±15 cm dal suolo visivo, 1,2 m liberi davanti, niente impronte di altri edifici,
 *   battente in vista e senza superfici complanari, porta anche nel dettaglio lontano;
 * - le porte che la Fase 1 fa usare (campanile, fienile di Ottavio, Casa del Velo, San Vigilio,
 *   botola della Cripta) raggiunte a piedi con il controller vero, e ci si allontana senza restare
 *   incastrati sulla soglia.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PlayerController, emptyInput, type ViewBasis } from '../../src/player/controller';
import { installaCorbella, type ManigliaCorbella } from '../../src/popolamento/index';
import { riassuntoPorte, verificaPaese, type EsitoPorta } from '../../src/popolamento/verificaPorte';
import type { PortaPosata } from '../../src/popolamento/cantiere';
import { METERS_PER_DEG } from '../../src/world/constants';
import { cylToWorld, localFrameTheta, worldToCyl } from '../../src/world/cylinder';
import { groundHeight } from '../../src/world/terrain';
import { TRACCIATI } from '../../src/popolamento/luoghi/sentieriCorbella';
import { quotaAppoggio } from '../../src/regia/luoghi';
import { giocoFinto } from './banco';

type P = { z: number; theta: number };

let g: ReturnType<typeof giocoFinto>;
let c: ManigliaCorbella;
let esiti: EsitoPorta[];

beforeAll(() => {
  g = giocoFinto(true);
  c = installaCorbella(g, { agganciaCiclo: false, luciAbitanti: false, orari: false });
  esiti = verificaPaese(c, g.world.colliders);
}, 180000);

/** metri per grado alla quota del suolo in (z, θ) (sul Tappo Sud, a 450 m, sono un terzo che sul fondo) */
const mpg = (a: P): number => METERS_PER_DEG * ((646 - groundHeight(a.z, a.theta)) / 646);
const dist = (a: P, b: P): number => Math.hypot(a.z - b.z, (((a.theta - b.theta + 540) % 360) - 180) * mpg(a));
const yawVerso = (a: P, b: P): number => (Math.atan2((((b.theta - a.theta + 540) % 360) - 180) * mpg(a), b.z - a.z) * 180) / Math.PI;

function vista(yawDeg: number, theta: number): ViewBasis {
  const f = localFrameTheta(theta);
  const y = (yawDeg * Math.PI) / 180;
  const base = f.north.clone().multiplyScalar(Math.cos(y)).addScaledVector(f.east, Math.sin(y));
  return { forward: base.clone(), up: f.up.clone() };
}

/** Quota d'appoggio in (z, θ): il suolo o la cima di un ripiano, di un gradino, di una lastra. */
function appoggio(q: P): number {
  const gh = groundHeight(q.z, q.theta);
  const p = cylToWorld(q.z, q.theta, gh);
  let h = gh;
  for (const k of g.world.colliders.query(q.z, q.theta, 12)) {
    if (k.kind !== 'box' || !k.tag || !['calpestabile', 'gradino', 'scala'].includes(k.tag)) continue;
    const v = p.clone().sub(k.center);
    if (Math.abs(v.dot(k.right)) > k.half.x || Math.abs(v.dot(k.forward)) > k.half.z) continue;
    const top = gh + (k.half.y - v.dot(k.up));
    if (top > h && top < gh + 12) h = top;
  }
  return h;
}

/** Un punto (z, θ) a `d` m davanti alla porta (lungo la sua normale). */
function davanti(p: PortaPosata, d: number): P {
  const q = worldToCyl(p.centro.clone().addScaledVector(p.normale, d));
  return { z: q.z, theta: q.theta };
}

/**
 * Cammina con W da `da` verso `meta` guardandola, al più `secondi`; si ferma a `raggio` m.
 * Restituisce il controller (per continuare a camminare) e se è arrivata.
 */
function cammina(p: PlayerController | null, da: P, meta: P, raggio: number, secondi = 20): { p: PlayerController; arrivata: boolean; distanza: number } {
  const pc = p ?? new PlayerController(g.world.colliders);
  if (!p) {
    pc.groundFn = groundHeight;
    // (l'altezza di `teleport` è sopra il suolo: sui ripiani e sui gradini si parte dalla loro cima)
    pc.teleport(da.z, da.theta, appoggio(da) - groundHeight(da.z, da.theta) + 0.05);
    for (let i = 0; i < 30; i++) pc.step(1 / 60, emptyInput(), vista(0, pc.cyl.theta));
  }
  const avanti = { ...emptyInput(), forward: 1 };
  for (let passo = 0; passo < secondi * 60; passo++) {
    const qui: P = { z: pc.cyl.z, theta: pc.cyl.theta };
    if (dist(qui, meta) < raggio) return { p: pc, arrivata: true, distanza: dist(qui, meta) };
    pc.step(1 / 60, avanti, vista(yawVerso(qui, meta), pc.cyl.theta));
  }
  return { p: pc, arrivata: false, distanza: dist({ z: pc.cyl.z, theta: pc.cyl.theta }, meta) };
}

const porta = (id: string): PortaPosata => {
  const p = c.porte(true).find((x) => x.id === id);
  if (!p) throw new Error(`porta ${id} non trovata`);
  return p;
};

describe('inventario delle porte', () => {
  it('ogni generatore con una porta la dichiara (case, annessi, casupole, campanile, chiesa, fienile, mulino, grà, capanno)', () => {
    const per = new Map<string, number>();
    for (const p of c.porte(true)) per.set(p.oggetto, (per.get(p.oggetto) ?? 0) + 1);
    expect(per.get('rustico') ?? 0).toBeGreaterThan(120);
    expect(per.get('annesso') ?? 0).toBeGreaterThan(10);
    expect(per.get('casupola') ?? 0).toBeGreaterThanOrEqual(5);
    for (const o of ['campanile', 'chiesa', 'fienile', 'mulino', 'capanno']) expect(per.get(o), o).toBe(1);
    expect(per.get('gra')).toBe(2);
  });
  it('ogni casa e annesso del paese ha la porta anche nella versione lontana, nello stesso posto', () => {
    const lontane = c.porteLontane();
    expect(lontane.porte.length).toBeGreaterThan(80);
    expect(esiti.filter((e) => e.difetti.includes('lod')).map((e) => e.porta.id)).toEqual([]);
    const conLontana = esiti.filter((e) => e.distanzaLontana !== undefined);
    expect(conLontana.length).toBeGreaterThan(80);
    for (const e of conLontana) expect(e.distanzaLontana!, e.porta.id).toBeLessThan(0.3);
  });
});

describe('verifica di tutte le porte', () => {
  it('nessuna porta sepolta, sospesa, contro un pendio, ostruita, dentro un altro edificio, coperta o complanare', () => {
    const r = riassuntoPorte(esiti);
    const difettose = esiti.filter((e) => e.difetti.length).map((e) => `${e.porta.id}: ${e.difetti.join(', ')} (${e.note.join('; ')}${e.ostacolo ? `; ${e.ostacolo}` : ''})`);
    expect(r.totale).toBeGreaterThan(150);
    expect(difettose).toEqual([]);
  });
  it('le soglie delle porte a terra stanno a ±15 cm dal suolo davanti', () => {
    for (const e of esiti) {
      if (e.porta.appoggio !== 'suolo') continue;
      expect(e.suoloMax, e.porta.id).toBeLessThanOrEqual(0.15);
      expect(e.suoloMin, e.porta.id).toBeGreaterThanOrEqual(-0.15);
    }
  });
});

describe("i punti d'interazione delle porte", () => {
  it('nessun punto apri:/entra:/dormi: dentro un muro (al più a filo di un piano calpestabile)', () => {
    const dentro: string[] = [];
    for (const [id, p] of c.punti) {
      if (!/^(apri|entra|dormi):/.test(id)) continue;
      const q = worldToCyl(p.pos);
      for (const k of g.world.colliders.query(q.z, q.theta, 4)) {
        if (k.kind !== 'box') continue;
        const v = p.pos.clone().sub(k.center);
        const sotto = k.half.y - v.dot(k.up);
        if (Math.abs(v.dot(k.right)) >= k.half.x || Math.abs(v.dot(k.forward)) >= k.half.z || Math.abs(v.dot(k.up)) >= k.half.y) continue;
        // a filo (5 cm) di una lastra, di un gradino o del ripiano su cui si cammina: va bene
        if (['calpestabile', 'gradino', 'scala'].includes(k.tag ?? '') && sotto < 0.05) continue;
        dentro.push(`${id} dentro «${k.tag}» (${sotto.toFixed(2)} m sotto la cima)`);
      }
    }
    expect(dentro).toEqual([]);
  });
});

describe('le porte della Fase 1 a piedi', () => {
  // (il capanno sta sul Balcone dei Messi, un ripiano profondo 7 m: si parte a 3 m, sul ripiano)
  for (const [id, partenza] of [
    ['campanile:porta', 6],
    ['fienile_ottavio:porta', 6],
    ['casa_del_velo:porta', 6],
    ['san_vigilio:portale', 6],
    ['mulino:porta', 6],
    ['balcone_messi:porta', 3],
  ] as const) {
    it(`${id}: da ${partenza} m fino alla soglia, e poi indietro senza restare incastrati`, () => {
      const p = porta(id);
      const da = davanti(p, partenza);
      const soglia = davanti(p, 0.55);
      const r = cammina(null, da, soglia, 0.45);
      expect(r.arrivata, `${id}: fermo a ${r.distanza.toFixed(2)} m dalla soglia`).toBe(true);
      // la soglia: alla quota della porta (±25 cm: il corpo sta sui gradini e sulle lastre)
      const hSoglia = worldToCyl(p.centro).h;
      expect(Math.abs(r.p.cyl.h - hSoglia), `${id}: quota sulla soglia`).toBeLessThan(0.3);
      const via = cammina(r.p, soglia, davanti(p, Math.min(4, partenza)), 0.6, 8);
      expect(via.arrivata, `${id}: incastrato sulla soglia (a ${via.distanza.toFixed(2)} m dalla meta)`).toBe(true);
    });
  }
  it('la botola della Cripta si raggiunge a piedi: dal muretto del belvedere, dalla fine della strada della Cripta e da quasi ogni parte', () => {
    const b = c.punto('apri:botola')!;
    const meta = { z: b.cil.z, theta: b.cil.theta };
    const muretto = c.punto('siediti:belvedere')!;
    // (la botola si apre da 3 m: il bersaglio «Scendi nella Cripta» ha portata 3; qui si chiede 2,2)
    const r0 = cammina(null, { z: muretto.cil.z, theta: muretto.cil.theta }, meta, 2.2, 25);
    expect(r0.arrivata, `dal muretto: fermo a ${r0.distanza.toFixed(2)} m dalla botola`).toBe(true);
    // la botola sta su un ripianino di lastre con il muretto di sostegno a valle: dalla strada della
    // Cripta si gira attorno al muretto (dal suo spigolo a monte)
    const strada = TRACCIATI.cripta[TRACCIATI.cripta.length - 1]!;
    const r1 = cammina(null, { z: strada.z, theta: strada.theta }, { z: meta.z - 1.5, theta: meta.theta + 1.6 / mpg(meta) }, 0.8, 20);
    const r1b = cammina(r1.p, meta, meta, 2.2, 10);
    expect(r1b.arrivata, `dalla strada della Cripta: fermo a ${r1b.distanza.toFixed(2)} m dalla botola`).toBe(true);
    let fatte = 0;
    for (let a = 0; a < 360; a += 45) {
      const y = (a * Math.PI) / 180;
      const r = cammina(null, { z: meta.z + Math.cos(y) * 5, theta: meta.theta + (Math.sin(y) * 5) / mpg(meta) }, meta, 2.2, 15);
      if (r.arrivata) fatte++;
    }
    expect(fatte, 'direzioni da cui si arriva dritti alla botola').toBeGreaterThanOrEqual(4);
  });
  it('uscite dalla Cripta (botola aperta): non si cade fra i muretti del ripiano, si va al muretto del belvedere', () => {
    // come `Regia.esciDallaBotola`: 1,3 m dalla botola, dalla parte opposta al tronco, sul ripiano
    // (prima, da aperta, la botola non aveva collider e il ripiano nemmeno: si restava in una fossa)
    c.apriBotola(true);
    try {
      const b = c.punto('apri:botola')!.cil;
      const t = c.punto('esamina:castagno_morto')!.cil;
      const dz = b.z - t.z;
      const ds = (b.theta - t.theta) * METERS_PER_DEG;
      const d = Math.hypot(dz, ds);
      const uscita = { z: b.z + (dz / d) * 1.3, theta: b.theta + ((ds / d) * 1.3) / METERS_PER_DEG };
      const hUscita = quotaAppoggio(g.world.colliders, uscita.z, uscita.theta);
      expect(hUscita, "l'uscita sta sulle lastre del ripiano").toBeGreaterThan(b.h - 0.3);
      const nuovo = () => {
        const pc = new PlayerController(g.world.colliders);
        pc.groundFn = groundHeight;
        pc.teleport(uscita.z, uscita.theta, hUscita, true);
        for (let i = 0; i < 30; i++) pc.step(1 / 60, emptyInput(), vista(0, pc.cyl.theta));
        return pc;
      };
      // verso il vano aperto: ci si ferma sul telaio, senza cadere
      const pc = nuovo();
      const meta = { z: b.z, theta: b.theta };
      let hMin = Infinity;
      for (let k = 0; k < 120; k++) {
        const q = { z: pc.cyl.z, theta: pc.cyl.theta };
        pc.step(1 / 60, { ...emptyInput(), forward: 1 }, vista(yawVerso(q, meta), pc.cyl.theta));
        hMin = Math.min(hMin, pc.cyl.h);
      }
      expect(hMin, 'quota minima andando verso il vano').toBeGreaterThan(b.h - 0.35);
      expect(dist({ z: pc.cyl.z, theta: pc.cyl.theta }, meta), 'fermi prima del vano').toBeGreaterThan(0.5);
      // e da lì (e dall'uscita) al muretto del belvedere, a piedi
      const m = c.punto('siediti:belvedere')!.cil;
      const r = cammina(pc, { z: pc.cyl.z, theta: pc.cyl.theta }, { z: m.z, theta: m.theta }, 2.0, 25);
      expect(r.arrivata, `dal vano al muretto: fermo a ${r.distanza.toFixed(2)} m`).toBe(true);
      const r2 = cammina(nuovo(), uscita, { z: m.z, theta: m.theta }, 2.0, 25);
      expect(r2.arrivata, `dall'uscita al muretto: fermo a ${r2.distanza.toFixed(2)} m`).toBe(true);
    } finally {
      c.apriBotola(false);
    }
  });
});
