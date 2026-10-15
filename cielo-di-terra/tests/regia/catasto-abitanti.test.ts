/**
 * La regia col catasto (src/rilievo) e gli abitanti: la «linea libera?» sul terreno e sui
 * collisori, le tappe del tempo (brace, notte che comincia, alba, resoconto), gli orari dei
 * personaggi e Ottavio che viene incontro a Elvira.
 */
import { describe, expect, it } from 'vitest';
import { Scene, Vector3 } from 'three';
import { CatastoGioco, creaLineaLibera, dentroCollisore, posizioniCapisaldi } from '../../src/regia/catasto';
import { CAPISALDI, PARTICELLE_AREA, PERSONAGGI, type Personaggio } from '../../src/regia/contenuti';
import { assolutoDi } from '../../src/regia/orologio';
import { Abitanti, luogoDaOrario, type ContestoAbitanti } from '../../src/regia/png';
import type { ContestoVisibilita, EventoCatasto, PuntoMira } from '../../src/rilievo';
import { ColliderWorld, boxAt } from '../../src/world/colliders';
import { cylToWorld } from '../../src/world/cylinder';
import { groundHeight } from '../../src/world/terrain';
import type { World } from '../../src/world/world';

/** Punto di mira di un caposaldo dei contenuti. */
function pm(id: string): PuntoMira {
  const c = CAPISALDI.find((x) => x.id === id)!;
  return { id, z: c.z, theta: c.theta, altezza: c.altezza, altezzaSegnale: c.altezza_segnale ?? 0 };
}

/** Le posizioni senza scena: il Pilastro 1 sta in alto sulla cella (20 m sopra la piazza). */
/** Contesto di una mira di giorno per un lato. */
const LATO: ContestoVisibilita = { scopo: 'lato', ora: 10 * 60 };

const posizioni = posizioniCapisaldi({
  punto: (id) => (id === 'cs_1' ? cylToWorld(1062, 37.2, groundHeight(1062, 37.2) + 20) : null),
  segnale: () => null,
});

describe('linea libera', () => {
  const libera = creaLineaLibera(null, posizioni.occhio, posizioni.segnale);

  it('i lati della Fase 1 si vedono sul terreno (3-1, 7-8, 6-2, 1-11)', () => {
    expect(libera(pm('cs_3'), pm('cs_1'), LATO)).toBe(true);
    expect(libera(pm('cs_7'), pm('cs_8'), LATO)).toBe(true);
    expect(libera(pm('cs_6'), pm('cs_2'), LATO)).toBe(true);
    expect(libera(pm('cs_11'), pm('cs_1'), LATO)).toBe(true);
  });

  it('il terreno copre il Monte (CS 4) da Corbella', () => {
    expect(libera(pm('cs_1'), pm('cs_4'), LATO)).toEqual({ libera: false, motivo: 'Il terreno copre la mira.' });
  });

  it('una casa in mezzo copre la mira; il collisore che regge la stazione no', () => {
    const cols = new ColliderWorld();
    const a = pm('cs_7');
    const b = pm('cs_8');
    // a metà del lato 7-8, una casa di 8 m
    const zm = (a.z + b.z) / 2;
    const tm = (a.theta + b.theta) / 2;
    cols.add(boxAt(zm, tm, groundHeight(zm, tm) - 1, 0, 30, 12, 30, 'casa'));
    // il muro su cui sta il chiodo 7
    cols.add(boxAt(a.z, a.theta, groundHeight(a.z, a.theta) - 1, 0, 2, 4, 2, 'muro'));
    const coperta = creaLineaLibera(cols, posizioni.occhio, posizioni.segnale);
    expect(coperta(a, b, LATO)).toEqual({ libera: false, motivo: 'Una casa copre la mira.' });
    cols.clear();
    cols.add(boxAt(a.z, a.theta, groundHeight(a.z, a.theta) - 1, 0, 2, 4, 2, 'muro'));
    expect(creaLineaLibera(cols, posizioni.occhio, posizioni.segnale)(a, b, LATO)).toBe(true);
  });

  it('dentroCollisore: scatole e cilindri, con il margine', () => {
    const box = boxAt(1000, 30, groundHeight(1000, 30), 0, 4, 4, 4);
    expect(dentroCollisore(box, cylToWorld(1000, 30, groundHeight(1000, 30) + 2))).toBe(true);
    expect(dentroCollisore(box, cylToWorld(1000, 30, groundHeight(1000, 30) + 5))).toBe(false);
    expect(dentroCollisore(box, cylToWorld(1001.9, 30, groundHeight(1000, 30) + 2), 0.5)).toBe(false);
  });
});

describe('CatastoGioco', () => {
  function nuovo() {
    const celle = new Map<number, number>();
    const world = { colliders: null, setCellState: (id: number, s: number) => celle.set(id, s), revealCells: () => {} } as unknown as World;
    const varianti: string[] = [];
    const effetti: string[] = [];
    const eventi: EventoCatasto[] = [];
    const c = new CatastoGioco(world, { mostraVariante: (e, v) => varianti.push(`${e}=${v}`) }, (e) => effetti.push(...e), posizioni);
    c.onEvento((e) => eventi.push(e));
    return { c, celle, varianti, effetti, eventi };
  }

  it('collegato al mondo: le altre valli restano a matita, gli elementi mobili mostrano la variante', () => {
    const { c, celle, varianti } = nuovo();
    const area = new Set(PARTICELLE_AREA.map((p) => p.id));
    const fuori = [...celle.keys()].find((id) => !area.has(id))!;
    expect(c.stato(fuori)).toBe('bianco');
    expect(celle.get(fuori)).toBe(1);
    const bianca = PARTICELLE_AREA.map((p) => p.id).find((id) => c.stato(id) === 'bianco');
    if (bianca !== undefined) expect(celle.get(bianca)).toBe(0);
    for (const e of ['E1', 'E2', 'E3', 'E4']) expect(varianti.some((v) => v.startsWith(`${e}=`))).toBe(true);
  });

  it('dormendo, la notte si fa tutta all\'alba e la mattina dopo c\'è il resoconto', () => {
    const { c, eventi } = nuovo();
    c.scorri({ da: assolutoDi(1, 20.5), a: assolutoDi(2, 7) }, { cella: null, dorme: true });
    expect(eventi.some((e) => e.tipo === 'resoconto')).toBe(true);
    expect(c.resocontoDelMattino(2, 7)).not.toBeNull();
    expect(c.resocontoDelMattino(2, 12.5)).toBeNull();
    expect(c.resocontoDelMattino(3, 7)).toBeNull();
  });

  it('vegliando, la notte comincia alle 22:00, va avanti a minuti e si chiude alle 05:30', () => {
    const { c } = nuovo();
    c.scorri({ da: assolutoDi(1, 21.5), a: assolutoDi(1, 22.1) }, { cella: null, dorme: false });
    expect(c.catasto.stato.notteInCorso).toBeTruthy();
    for (let t = assolutoDi(1, 22.1); t < assolutoDi(2, 5.6); t += 0.25) c.scorri({ da: t, a: t + 0.25 }, { cella: null, dorme: false });
    expect(c.catasto.stato.notteInCorso).toBeFalsy();
    expect(c.resocontoDelMattino(2, 6)).not.toBeNull();
  });

  it('il primo rilievo (3-1) colora le particelle del lato e torna come effetto alla storia', () => {
    const { c, effetti, eventi } = nuovo();
    const r = c.rileva('cs_3', 'cs_1', 10, 2);
    expect(r.ok).toBe(true);
    expect(c.latiChiusi().length).toBeGreaterThan(0);
    expect(eventi.some((e) => e.tipo === 'lato_chiuso')).toBe(true);
    expect(effetti.length).toBeGreaterThan(0);
    // salvataggio e caricamento
    const blob = c.salva();
    const { c: d } = nuovo();
    d.carica(JSON.parse(JSON.stringify(blob)));
    expect(d.latiChiusi()).toEqual(c.latiChiusi());
  });

  it('dal chiodo 2 il Pilastro 1 non si chiude (il tasso del sagrato)', () => {
    const { c } = nuovo();
    const r = c.rileva('cs_2', 'cs_1', 10, 2);
    expect(r.ok).toBe(false);
  });
});

describe('Abitanti', () => {
  it('gli orari di personaggi.json: giorno, fasce orarie, condizioni', () => {
    const p: Personaggio = {
      id: 'prova',
      nome: 'Prova',
      posizioni: [
        { fase: 'giorno 1', luogo: 'piazza_ore', dalle: '07:00', alle: '12:00' },
        { fase: 'dal giorno 2', luogo: 'sagrato (sulla soglia)', dalle: '08:00', alle: '10:00', condizione: 'flag:campanile_aperto' },
        { fase: 'ogni giorno', luogo: 'in volo', dalle: '20:00', alle: '06:00' },
        { fase: 'notte', luogo: 'lavatoio' },
      ],
    } as Personaggio;
    expect(luogoDaOrario(p, 1, 8)).toBe('piazza_ore');
    expect(luogoDaOrario(p, 1, 13)).toBeNull();
    expect(luogoDaOrario(p, 3, 9, () => true)).toBe('sagrato');
    expect(luogoDaOrario(p, 3, 9, () => false)).toBeNull();
    expect(luogoDaOrario(p, 2, 23)).toBeNull(); // in volo
    expect(luogoDaOrario(p, 2, 3)).toBeNull();
  });

  it('i personaggi della Fase 1 hanno un posto nel villaggio di giorno', () => {
    const togna = PERSONAGGI.find((p) => p.id === 'togna')!;
    expect(luogoDaOrario(togna, 1, 9)).toBeTruthy();
  });

  it('Ottavio viene incontro a Elvira e si ferma a un paio di metri', () => {
    const a = new Abitanti(new Scene());
    const elvira = { z: 1046, theta: 37 };
    const ctx: ContestoAbitanti = { giorno: 1, ore: 10, assoluto: 10, valuta: () => true, occhi: cylToWorld(elvira.z, elvira.theta, groundHeight(elvira.z, elvira.theta) + 1.6), elvira };
    a.ottavioFermo(1046 + 15, 37, 12);
    a.update(1 / 60, ctx);
    expect(a.distanzaDa('ottavio', elvira.z, elvira.theta)).toBeGreaterThan(14);
    a.ottavioRaggiunge();
    expect(a.modoOttavio).toBe('raggiunge');
    for (let i = 0; i < 60 * 10 && a.modoOttavio === 'raggiunge'; i++) a.update(1 / 60, ctx);
    expect(a.modoOttavio).toBe('fermo');
    const d = a.distanzaDa('ottavio', elvira.z, elvira.theta);
    expect(d).toBeLessThan(3);
    expect(d).toBeGreaterThan(1.5);
    // nel salvataggio resta il modo di prima, non il cammino
    a.ottavioRaggiunge();
    expect((a.esporta() as { ottavio: { tipo: string } }).ottavio.tipo).toBe('fermo');
    expect(a.puntoDialogo('ottavio')).toBeInstanceOf(Vector3);
  });
});
