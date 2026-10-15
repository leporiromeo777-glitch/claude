import { describe, expect, it } from 'vitest';
import { applicaCicliDelGiorno, notte } from '../src/notte';
import { CODICE_MOTORE, celleMotore, datiPianta } from '../src/pianta';
import { appunta, rileva } from '../src/rilievo';
import { infoParticella, statoIniziale } from '../src/stato';
import { regoleFase1 } from './aiuti';

const r = regoleFase1();

describe('dati per la Pianta', () => {
  it('all\'inizio: la griglia del motore, la striscia seppia, solo i capisaldi già rilevati dal G4', () => {
    const s = statoIniziale(r);
    const d = datiPianta(s, r);
    expect(d.griglia.nZ).toBe(75);
    expect(d.griglia.nTheta).toBe(96);
    expect(d.griglia.stati).toHaveLength(7200);
    expect(d.griglia.stati[2505]).toBe(2);
    expect(d.griglia.stati[1922]).toBe(1);
    expect(d.griglia.stati[2799]).toBe(0);
    expect([...d.griglia.seppia].filter(Boolean)).toHaveLength(15);
    expect(d.particelle).toHaveLength(86 + 15);
    expect(d.particelle.find((p) => p.id === 2599)).toEqual({ id: 2599, catasto: '1-656', stato: 'colore', inchiostro: 'seppia' });
    expect(d.capisaldi.map((c) => c.id).sort()).toEqual(['cs_1', 'cs_11']);
    expect(d.capisaldi.find((c) => c.id === 'cs_1')).toMatchObject({ numero: 1, tipo: 'pilastro', rilevato: true, visto: true, inchiostro: 'seppia', z: 1062, theta: 37.2 });
    expect(d.lati).toEqual([{ id: '1-11', da: 'cs_1', a: 'cs_11', firma: 'G4' }]);
    expect(d.resoconto).toBeUndefined();
    expect(d.inventario).toEqual({ nome: 'Corbella', aColore: 15, totale: 63 });
    expect(d.totaleParticelle).toBe(63);
    expect(d.conteggi).toEqual({ bianco: 7200 - 101, matita: 86, colore: 15, china: 0, seppia: 15 });
    expect(datiPianta(s, r, { tuttiICapisaldi: true }).capisaldi.length).toBe(r.capisaldi.size);
  });

  it('i capisaldi visti con lo squadro compaiono a matita, quelli rilevati a china', () => {
    let s = statoIniziale(r);
    s = appunta(s, r, { bersaglio: { caposaldo: 'cs_6' }, ora: 10 }).stato;
    s = rileva(s, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10 }).stato;
    const d = datiPianta(s, r);
    expect(d.capisaldi.find((c) => c.id === 'cs_6')).toMatchObject({ visto: true, rilevato: false });
    expect(d.capisaldi.find((c) => c.id === 'cs_6')!.inchiostro).toBeUndefined();
    expect(d.capisaldi.find((c) => c.id === 'cs_3')).toMatchObject({ tipo: 'chiodo', rilevato: true, inchiostro: 'china' });
    expect(d.lati.map((l) => l.id).sort()).toEqual(['1-11', '1-3']);
  });

  it('il resoconto del mattino in rosso fino a mezzogiorno, poi sparisce', () => {
    let s = applicaCicliDelGiorno(statoIniziale(r), r, { da: '05:30', a: '21:00' }).stato;
    s = notte(s, r, {}).nuovoStato;
    const mattino = datiPianta(s, r, { ora: '06:00' });
    expect(mattino.resoconto?.righe).toHaveLength(4);
    expect(mattino.resoconto?.quieta).toBe(false);
    expect(mattino.resoconto?.prossimaFinestra).toMatch(/^Alle 07:00: il campanaro Bortolo/);
    expect([...mattino.griglia.cambiate].filter(Boolean)).toHaveLength(6);
    expect(mattino.particelle.filter((p) => p.cambiata).map((p) => p.id).sort()).toEqual([2311, 2407, 2699, 2796, 2797, 2798]);
    const pomeriggio = datiPianta(s, r, { ora: '12:00' });
    expect(pomeriggio.resoconto).toBeUndefined();
    expect([...pomeriggio.griglia.cambiate].filter(Boolean)).toHaveLength(0);
    expect(datiPianta(s, r, { ora: '06:00', giorno: 5 }).resoconto).toBeUndefined();
    expect(infoParticella(s, r, 2797)).toMatchObject({ catasto: '1-710', elemento: 'E1', cambiataStanotte: true, protettaStanotte: null, vegliata: false });
  });

  it('i codici del motore', () => {
    expect(CODICE_MOTORE).toEqual({ bianco: 0, matita: 1, colore: 2 });
    const c = celleMotore(statoIniziale(r));
    expect(c[2599]).toBe(2);
    expect(c[0]).toBe(0);
  });
});
