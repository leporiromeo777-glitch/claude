/**
 * La regia, logica pura: l'orologio della storia (fermi, limiti, sonno, «aspetta fino a»)
 * e i luoghi dei contenuti (quote, «dentro», dove sono).
 */
import { describe, expect, it } from 'vitest';
import { OrologioStoria, assolutoDi, attraversa, eNotte } from '../../src/regia/orologio';
import { Luoghi, dentroLuogo, quotaAppoggio, quotaLuogo } from '../../src/regia/luoghi';
import { ColliderWorld, boxAt } from '../../src/world/colliders';
import { luogo, oreDa, ostacoloFra, testo, testoOra } from '../../src/regia/contenuti';
import { groundHeight } from '../../src/world/terrain';

const ore = (hhmm: string): number => oreDa(hhmm);

describe('OrologioStoria', () => {
  it('parte al risveglio del giorno 1 e conta il tempo assoluto dal giorno 1', () => {
    const o = new OrologioStoria();
    expect(o.giorno).toBe(1);
    expect(o.ore).toBeCloseTo(ore('05:38'), 6);
    expect(o.assoluto).toBeCloseTo(o.ore, 6);
    o.imposta(3, 7.5);
    expect(o.assoluto).toBeCloseTo(48 + 7.5, 6);
    expect(assolutoDi(2, 1)).toBe(25);
  });

  it('a velocità normale un giorno dura 40 minuti reali', () => {
    const o = new OrologioStoria();
    o.imposta(1, 8);
    const iv = o.avanza(60); // un minuto reale
    expect(iv.a - iv.da).toBeCloseTo(24 / 40, 6);
  });

  it('«orologio:fermo» tiene l\'ora ferma finché non arriva «libero»', () => {
    const o = new OrologioStoria();
    o.comando(['fermo', '05:38']);
    for (let i = 0; i < 100; i++) o.avanza(1);
    expect(o.ore).toBeCloseTo(ore('05:38'), 6);
    o.comando(['libero']);
    o.avanza(60);
    expect(o.ore).toBeGreaterThan(ore('05:38'));
  });

  it('«orologio:max» non lascia passare la prossima occorrenza dell\'ora (e ferma l\'attesa)', () => {
    const o = new OrologioStoria();
    o.imposta(1, 17);
    o.comando(['max', '17:30']);
    expect(o.aspettaFino(19.5)).toBe(true);
    for (let i = 0; i < 600; i++) o.avanza(1);
    expect(o.ore).toBeCloseTo(17.5, 6);
    expect(o.inAttesa).toBe(false);
    // al limite l'attesa non parte più
    expect(o.aspettaFino(19.5)).toBe(false);
  });

  it('dormire porta alla prossima occorrenza dell\'ora, anche il giorno dopo, e toglie i limiti superati', () => {
    const o = new OrologioStoria();
    o.imposta(1, 21);
    o.comando(['max', '22:00']);
    const iv = o.saltaA(7);
    expect(o.giorno).toBe(2);
    expect(o.ore).toBeCloseTo(7, 6);
    expect(iv.a - iv.da).toBeCloseTo(10, 6);
    expect(o.limite).toBeNull();
  });

  it('«aspetta fino a» accelera fino all\'ora chiesta e si ferma lì', () => {
    const o = new OrologioStoria();
    o.imposta(1, 9);
    expect(o.aspettaFino(10)).toBe(true);
    const base = 24 / (40 * 60);
    expect(o.oreAlSecondo()).toBeCloseTo(base * 20, 9);
    let secondi = 0;
    while (o.inAttesa && secondi < 60) {
      o.avanza(0.25);
      secondi += 0.25;
    }
    expect(o.ore).toBeCloseTo(10, 6);
    // un'ora di gioco in 5 secondi reali (x20 su 40 minuti al giorno)
    expect(secondi).toBeCloseTo(5, 0);
    // non si aspetta con l'orologio fermo
    o.comando(['fermo', '10:00']);
    expect(o.aspettaFino(12)).toBe(false);
  });

  it('esporta e importa giorno, ora, fermo e limite (l\'attesa no)', () => {
    const o = new OrologioStoria();
    o.imposta(2, 19);
    o.comando(['max', '20:30']);
    o.aspettaFino(20);
    const s = o.esporta();
    const p = new OrologioStoria();
    p.importa(s);
    expect(p.giorno).toBe(2);
    expect(p.ore).toBeCloseTo(19, 6);
    expect(p.limite).toBeCloseTo(assolutoDi(2, 20.5), 6);
    expect(p.inAttesa).toBe(false);
  });

  it('attraversa trova un\'ora del giorno dentro un intervallo, anche su più giorni', () => {
    expect(attraversa({ da: assolutoDi(1, 20), a: assolutoDi(2, 7) }, 5.5)).toEqual([assolutoDi(2, 5.5)]);
    expect(attraversa({ da: assolutoDi(1, 4), a: assolutoDi(3, 6) }, 5.5)).toEqual([assolutoDi(1, 5.5), assolutoDi(2, 5.5), assolutoDi(3, 5.5)]);
    // estremo sinistro escluso, destro incluso
    expect(attraversa({ da: assolutoDi(1, 5.5), a: assolutoDi(1, 6) }, 5.5)).toEqual([]);
    expect(attraversa({ da: assolutoDi(1, 5), a: assolutoDi(1, 5.5) }, 5.5)).toEqual([assolutoDi(1, 5.5)]);
    expect(attraversa({ da: 10, a: 10 }, 10)).toEqual([]);
  });

  it('la notte va dalle 21:00 alle 05:30', () => {
    expect(eNotte(21)).toBe(true);
    expect(eNotte(2)).toBe(true);
    expect(eNotte(5.49)).toBe(true);
    expect(eNotte(5.5)).toBe(false);
    expect(eNotte(20.99)).toBe(false);
  });
});

describe('contenuti per la regia', () => {
  it('legge e scrive le ore HH:MM', () => {
    expect(oreDa('07:45')).toBeCloseTo(7.75, 9);
    expect(testoOra(19.5)).toBe('19:30');
  });

  it('trova i testi in qualunque sezione (lettere, cartellini, targhe)', () => {
    expect(testo('lettera_marta')).toBeTruthy();
    expect(testo('targa_p1')).toBeTruthy();
    expect(testo('non_esiste')).toBeFalsy();
  });

  it('dice che cosa copre un segnale secondo i contenuti (il tasso, la tettoia)', () => {
    expect(ostacoloFra('cs_2', 'cs_1')).toBe('il tasso del sagrato');
    expect(ostacoloFra('cs_1', 'cs_2')).toBe('il tasso del sagrato');
    expect(ostacoloFra('cs_3', 'cs_1')).toBeNull();
    expect(ostacoloFra(null, 'cs_1')).toBeNull();
  });
});

describe('Luoghi', () => {
  const luoghi = new Luoghi();

  it('all\'aperto la quota è quella del terreno del motore; dentro (la cella) quella dei contenuti', () => {
    const piazza = luogo('piazza_ore')!;
    expect(quotaLuogo(piazza)).toBeCloseTo(groundHeight(piazza.z, piazza.theta), 6);
    const cella = luogo('cella_campanaria')!;
    expect(quotaLuogo(cella)).toBeCloseTo(cella.altezza, 6);
  });

  it('«dentro» un luogo: entro il raggio sulla superficie e non troppo sopra o sotto', () => {
    const p = luogo('piazza_ore')!;
    const h = quotaLuogo(p);
    expect(dentroLuogo(p, p.z, p.theta, h)).toBe(true);
    expect(dentroLuogo(p, p.z + p.raggio - 1, p.theta, h)).toBe(true);
    expect(dentroLuogo(p, p.z + p.raggio + 2, p.theta, h)).toBe(false);
    // in volo sopra la piazza non si è «in piazza»
    expect(dentroLuogo(p, p.z, p.theta, h + 40)).toBe(false);
  });

  it('dove sono: al centro della piazza delle Ore c\'è la piazza; il più vicino di un tipo', () => {
    const p = luogo('piazza_ore')!;
    expect(luoghi.doveSono(p.z, p.theta, luoghi.quota('piazza_ore'))).toContain('piazza_ore');
    const f = luogo('fienile_ottavio')!;
    expect(luoghi.piuVicino(f.z + 1, f.theta)?.id).toBe('fienile_ottavio');
    expect(luoghi.posizione('non_esiste')).toBeNull();
  });

  it('quota d\'appoggio: sul ripiano o sul gradino del popolamento, non ai piedi del muro', () => {
    const z = 948;
    const theta = 23;
    const suolo = groundHeight(z, theta);
    const cols = new ColliderWorld();
    expect(quotaAppoggio(cols, z, theta)).toBeCloseTo(suolo, 6);
    // un muro alto non è un appoggio; un ripiano riempito alto 4 m sì
    cols.add(boxAt(z, theta, suolo - 1, 0, 6, 9, 6, 'muro'));
    expect(quotaAppoggio(cols, z, theta)).toBeCloseTo(suolo, 6);
    cols.add(boxAt(z, theta, suolo - 2, 0, 20, 6, 20, 'calpestabile'));
    expect(quotaAppoggio(cols, z, theta)).toBeCloseTo(suolo + 4, 1);
    // fuori dall'impronta del ripiano resta il terreno
    expect(quotaAppoggio(cols, z + 15, theta)).toBeCloseTo(groundHeight(z + 15, theta), 6);
    expect(quotaAppoggio(null, z, theta)).toBeCloseTo(suolo, 6);
  });
});
