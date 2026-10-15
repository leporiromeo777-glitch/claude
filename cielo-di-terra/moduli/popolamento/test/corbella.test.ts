/**
 * Test del popolamento di Corbella in Node (vitest): un gioco finto con il paese segnaposto vero del
 * motore, poi installaCorbella e le verifiche su contenuti, collider, punti, personaggi, varianti,
 * visuali dei lati del rilievo, dispose.
 */
import { Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Collider } from '../../../src/world/colliders';
import { cylToWorld } from '../../../src/world/cylinder';
import { groundHeight } from '../../../src/world/terrain';
import { ELEMENTI_MOBILI, LATI, LONTANI, PERSONAGGI, RETE, luogo } from '../src/contenuti';
import { installaCorbella, type ManigliaCorbella } from '../src/index';
import { dentroCorbella } from '../src/segnaposto';
import { distanza } from '../src/terreno';
import { giocoFinto } from './banco';

let g: ReturnType<typeof giocoFinto>;
let c: ManigliaCorbella;
let collPrima = 0;
let lumiPrima = 0;

beforeAll(() => {
  g = giocoFinto(true);
  collPrima = g.world.colliders.size;
  lumiPrima = g.lumi().length;
  c = installaCorbella(g, { agganciaCiclo: true });
}, 120000);

describe('segnaposto del motore', () => {
  it('toglie il paese segnaposto, i suoi collider e i suoi lumi in Corbella', () => {
    expect(g.scene.getObjectByName('paese-corbella')).toBeUndefined();
    const st = c.statistiche.segnaposto!;
    expect(st.colliderTolti).toBeGreaterThan(300);
    expect(st.lumiTolti).toBeGreaterThan(20);
    for (const col of g.world.colliders.all() as IterableIterator<Collider>) {
      if (!col.tag || !['rustico', 'campanile', 'chiesa', 'lampione'].includes(col.tag)) continue;
      expect(dentroCorbella(col.kind === 'box' ? col.center : col.base)).toBe(false);
    }
  });
});

describe('luoghi e capisaldi dai contenuti', () => {
  it('ogni caposaldo della rete ha il suo chiodo («pianta lo squadro») al posto giusto, sul suolo vero', () => {
    for (const cs of RETE) {
      const p = c.punto(`chiodo:${cs.numero}`);
      expect(p, cs.id).toBeDefined();
      expect(p!.azione).toBe('pianta_squadro');
      expect(p!.rif).toBe(cs.id);
      // posizione orizzontale entro 1,5 m dal contenuto (il Pilastro 1 sta sulla terrazza del campanile, accanto alla cuspide)
      expect(distanza(p!.cil, cs, p!.cil.h), cs.id).toBeLessThan(cs.id === 'cs_1' ? 3.5 : 1.5);
      const suolo = groundHeight(cs.z, cs.theta);
      if (cs.id === 'cs_1') expect(p!.cil.h - suolo).toBeGreaterThan(23);
      else expect(p!.cil.h - suolo, cs.id).toBeGreaterThan(-0.3);
    }
  });
  it('i pilastri lontani della rete notturna ci sono, con i lumi permanenti', () => {
    for (const cs of LONTANI) expect(c.punto(`appunta:${cs.id}`), cs.id).toBeDefined();
    const permanenti = LONTANI.filter((x) => x.lume === 'permanente').length;
    expect(permanenti).toBeGreaterThan(3);
  });
  it('i punti d’interazione principali esistono', () => {
    for (const id of [
      'leggi:targa_p1',
      'leggi:cartellino_castagno',
      'leggi:bacheca_ore',
      'leggi:motto_messi',
      'esamina:castagno_morto',
      'lente:ricci',
      'lente:amenti',
      'lente:corteccia',
      'lente:innesto_vecchio',
      'lente:cippo',
      'taglia:ramo_vivo',
      'innesta:castagno_cartellino',
      'apri:botola',
      'apri:porta_campanile',
      'dormi:fienile_ottavio',
      'siediti:belvedere',
      'lancio_velo:muretto_terrazza',
      'lancio_velo:muraglione_gra',
      'lancio_velo:ripa_san_vigilio',
      'lancio_velo:balcone_messi',
      'parla:ottavio',
      'parla:pina',
      'parla:meridiana',
      'guarda:scatola_pina',
    ]) {
      expect(c.punto(id), id).toBeDefined();
    }
  });
  it('la cella campanaria sta 24 m sopra il suolo del campanile e la palina arriva a +8 m', () => {
    const cella = luogo('cella_campanaria');
    const p = c.punto('chiodo:1')!;
    const suolo = groundHeight(cella.z, cella.theta);
    expect(p.cil.h - suolo).toBeGreaterThan(cella.altezza - luogo('campanile').altezza - 0.5);
    const cima = c.punto('guarda:palina_p1')!;
    // la palina parte dal pavimento della terrazza (il chiodo è sulla colonnina, 1,35 m più su)
    expect(cima.cil.h - (p.cil.h - 1.35)).toBeGreaterThan(8);
  });
});

describe('collider', () => {
  it('ci sono collider etichettati per muri, tetti, porte, botola, chiodi, gradini, calpestabili', () => {
    const tag = new Set(c.collider().map((v) => v.tag));
    for (const t of ['muro', 'tetto', 'porta', 'botola', 'chiodo', 'caposaldo', 'gradino', 'calpestabile', 'tronco', 'palo']) expect(tag.has(t), t).toBe(true);
    expect(g.world.colliders.size).toBeGreaterThan(collPrima - c.statistiche.segnaposto!.colliderTolti + 1000);
  });
  it('la botola chiusa ha il collider, aperta no', () => {
    const conta = () => [...(g.world.colliders.all() as IterableIterator<Collider>)].filter((x) => x.tag === 'botola').length;
    expect(conta()).toBeGreaterThan(0);
    c.apriBotola(true);
    expect(conta()).toBe(0);
    expect(c.punto('entra:cripta')!.attivo).toBe(true);
    c.apriBotola(false);
    expect(conta()).toBeGreaterThan(0);
  });
});

describe('elementi mobili', () => {
  it('ogni elemento ha tutte le varianti dei contenuti e parte dalla variante iniziale', () => {
    for (const el of ELEMENTI_MOBILI) {
      const m = c.elementi.get(el.id)!;
      expect(m.varianti.sort()).toEqual(el.varianti.map((v) => v.id).sort());
      expect(c.variante(el.id)).toBe(el.variante_iniziale);
    }
  });
  it('setVariante cambia visibilità, collider e punti (passerella del Messo)', () => {
    const passerella = () => [...(g.world.colliders.all() as IterableIterator<Collider>)].filter((x) => x.tag === 'passerella').length;
    c.setVariante('E1', 'Carta');
    expect(passerella()).toBe(0);
    expect(c.punto('attraversa:passerella')!.attivo).toBe(false);
    c.setVariante('E1', 'Abitata');
    expect(passerella()).toBeGreaterThan(0);
    expect(c.punto('attraversa:passerella')!.attivo).toBe(true);
    const gruppo = c.radice.getObjectByName('mobile:E1:Abitata')!;
    expect(gruppo.visible).toBe(true);
    expect(c.radice.getObjectByName('mobile:E1:Carta')!.visible).toBe(false);
    expect(() => c.setVariante('E1', 'Scritta')).toThrow();
    c.setVariante('E1', 'Carta');
  });
  it('la casa di Nando smontata ha meno muri della casa intera', () => {
    const muri = (v: string) => {
      c.setVariante('E2', v);
      return c.collider().filter((x) => x.luogo === 'casa_nando' && x.tag === 'muro').length;
    };
    expect(muri('Smontata')).toBeLessThan(muri('Abitata'));
    c.setVariante('E2', 'Smontata');
  });
});

describe('personaggi', () => {
  it('ogni personaggio dei contenuti ha una maniglia npc()', () => {
    for (const p of PERSONAGGI) expect(c.npc(p.id), p.id).toBeDefined();
    for (let i = 1; i <= 12; i++) expect(c.npc(`velato_${i}`)).toBeDefined();
  });
  it('gli orari mettono ciascuno al suo luogo', () => {
    const vicino = (id: string, luogoId: string, raggio: number) => {
      const p = c.npc(id)!.posizione()!;
      const l = luogo(luogoId);
      expect(c.npc(id)!.presente, id).toBe(true);
      expect(distanza(p, l), `${id}@${luogoId}`).toBeLessThan(raggio);
      // in piedi sul suolo vero (o su un gradino / ripiano)
      expect(p.h - groundHeight(p.z, p.theta), id).toBeGreaterThan(-0.6);
    };
    c.applicaOrario(1, 10);
    vicino('togna', 'lavatoio', 5);
    vicino('pina', 'soglia_pina', 3);
    vicino('bortolo', 'sagrato', 6);
    vicino('annunciata', 'san_vigilio', 11);
    vicino('nando', 'casa_nando', 7);
    vicino('lisa', 'piazza_ore', 18);
    vicino('gioanin', 'piazza_ore', 18);
    c.applicaOrario(1, 20);
    vicino('pina', 'telo_ombrista', 4);
    vicino('lisa', 'telo_ombrista', 8);
    c.applicaOrario(3, 6);
    vicino('ottavio', 'passerella_messo', 3);
    c.applicaOrario(2, 10);
    vicino('clelia', 'bacheca_ore', 4);
    expect(c.npc('elvira')!.figura).toBeNull();
    expect(c.npc('meridiana')!.figura).toBeNull();
    expect(c.npc('la_madre')!.presente).toBe(false);
  });
  it('un personaggio cammina lungo il suolo fino alla meta e la promessa si risolve', async () => {
    c.applicaOrario(1, 10);
    const n = c.npc('velato_3')!;
    n.manuale = true;
    n.mostra(true);
    n.vaiA(1046, 36.0);
    let arrivato = false;
    const promessa = n.cammina({ z: 1050, theta: 36.5 }, 1.2).then(() => (arrivato = true));
    for (let i = 0; i < 120 && !arrivato; i++) {
      c.update(1 / 10);
      await Promise.resolve();
    }
    await promessa;
    expect(arrivato).toBe(true);
    const p = n.posizione()!;
    expect(distanza(p, { z: 1050, theta: 36.5 })).toBeLessThan(0.2);
    expect(Math.abs(p.h - groundHeight(p.z, p.theta))).toBeLessThan(0.6);
    n.gesto('saluta', 1);
    n.guarda({ z: 1062, theta: 37.2, h: 62 });
    c.update(0.5);
    n.manuale = false;
  });
});

describe('lumi', () => {
  it('finestre e lanterne aggiungono lumi al motore', () => {
    expect(c.statistiche.lumi).toBeGreaterThan(80);
    expect(g.lumi().length).toBeGreaterThan(lumiPrima - c.statistiche.segnaposto!.lumiTolti + 80);
  });
});

/** Raggio contro i collider (scatole orientate e cilindri): primo collider colpito o null. */
function colpisce(a: Vector3, b: Vector3, voci: ReturnType<ManigliaCorbella['collider']>, salta: (t: string) => boolean): string | null {
  const d = b.clone().sub(a);
  const L = d.length();
  d.normalize();
  for (const v of voci) {
    if (salta(v.tag)) continue;
    const col = v.collider;
    if (col.kind === 'box') {
      const o = a.clone().sub(col.center);
      let tmin = 0.5;
      let tmax = L - 0.5;
      let ok = true;
      for (const [ax, h] of [
        [col.right, col.half.x],
        [col.up, col.half.y],
        [col.forward, col.half.z],
      ] as const) {
        const e = o.dot(ax);
        const f = d.dot(ax);
        if (Math.abs(f) < 1e-9) {
          if (Math.abs(e) > h) ok = false;
          continue;
        }
        let t1 = (-h - e) / f;
        let t2 = (h - e) / f;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) ok = false;
      }
      if (ok) return `${v.tag}@${v.luogo ?? ''}`;
    } else {
      // campiona il segmento
      for (let t = 0.5; t < L - 0.5; t += 0.25) {
        const p = a.clone().addScaledVector(d, t).sub(col.base);
        const y = p.dot(col.up);
        if (y < 0 || y > col.height) continue;
        p.addScaledVector(col.up, -y);
        if (p.length() < col.radius) return `${v.tag}@${v.luogo ?? ''}`;
      }
    }
  }
  return null;
}

/** Il segmento sfiora o passa sotto il suolo del motore (campioni ogni 0,5 m, margine 0,25 m)? */
function copertoDalTerreno(a: Vector3, b: Vector3): boolean {
  const L = a.distanceTo(b);
  const p = new Vector3();
  for (let t = 3; t < L - 3; t += 0.5) {
    p.lerpVectors(a, b, t / L);
    const th = ((Math.atan2(-p.x, -p.y) * 180) / Math.PI + 360) % 360;
    const h = 646 - Math.hypot(p.x, p.y);
    if (h < groundHeight(p.z, th) + 0.25) return true;
  }
  return false;
}

describe('visuali dei lati del rilievo (capisaldi.json → lati)', () => {
  const occhio = (id: string) => {
    const cs = RETE.find((x) => x.id === id)!;
    const chiodo = c.punto(`chiodo:${cs.numero}`)!;
    // l'occhio sta 1,45 m sopra il chiodo (squadro piantato); il bersaglio è la cima del segnale
    return { occhio: cylToWorld(chiodo.cil.z, chiodo.cil.theta, chiodo.cil.h + 1.45), segnale: cylToWorld(chiodo.cil.z, chiodo.cil.theta, chiodo.cil.h + Math.max(1.2, cs.altezza_segnale * 0.6)) };
  };
  const salta = (t: string) => ['chiodo', 'caposaldo', 'palina', 'personaggio', 'gradino'].includes(t);
  it('i lati bloccati dai contenuti sono bloccati dal paese (il tasso copre 2-1, la tettoia del lavatoio copre 5-1)', () => {
    const voci = c.collider();
    for (const lato of LATI.filter((l) => !l.chiudibile)) {
      const a = occhio(lato.b);
      const b = occhio(lato.a);
      expect(colpisce(a.occhio, b.segnale, voci, salta), lato.id).not.toBeNull();
    }
  });
  it('i lati chiudibili non sono coperti da case, muri o alberi del popolamento', () => {
    const voci = c.collider();
    const bloccati: string[] = [];
    const terreno: string[] = [];
    for (const lato of LATI.filter((l) => l.chiudibile)) {
      const a = occhio(lato.b);
      const b = occhio(lato.a);
      if (copertoDalTerreno(a.occhio, b.segnale)) {
        terreno.push(lato.id);
        continue;
      }
      const h = colpisce(a.occhio, b.segnale, voci, salta);
      if (h) bloccati.push(`${lato.id}: ${h}`);
    }
    // i lati che il terreno del motore copre (le quote dei contenuti sono di un terreno precedente)
    // non dipendono dal popolamento: li segnala la console
    if (terreno.length) console.log('lati coperti dal terreno del motore:', terreno.join(', '));
    expect(bloccati).toEqual([]);
  });
});

describe('dispose', () => {
  it('toglie tutto dalla scena, dai collider e dai lumi', () => {
    const quanti = g.world.colliders.size;
    expect(quanti).toBeGreaterThan(1000);
    c.dispose();
    expect(g.scene.getObjectByName('corbella')).toBeUndefined();
    expect(g.world.colliders.size).toBeLessThan(collPrima);
    expect(g.lumi().length).toBe(lumiPrima - c.statistiche.segnaposto!.lumiTolti);
  });
});
