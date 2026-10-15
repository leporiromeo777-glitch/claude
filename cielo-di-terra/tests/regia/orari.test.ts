/**
 * Quando arriva qualcuno (src/regia/orari.ts), sugli orari veri di personaggi.json: per le
 * indicazioni delle missioni («Adesso non c'è nessuno: … arriva alle 07:00»).
 */
import { describe, expect, it } from 'vitest';
import { personaggio } from '../../src/regia/contenuti';
import { luogoDellaPosizione, prossimoArrivo, valeNelGiorno } from '../../src/regia/orari';

const p = (id: string) => personaggio(id)!;

describe('il prossimo arrivo secondo gli orari', () => {
  it('le righe dell’orario: ogni giorno, giorno N, dal giorno N; i posti che non sono del mondo no', () => {
    expect(valeNelGiorno('ogni giorno', 3)).toBe(true);
    expect(valeNelGiorno('giorno 2', 2)).toBe(true);
    expect(valeNelGiorno('giorno 2', 3)).toBe(false);
    expect(valeNelGiorno('dal giorno 4', 5)).toBe(true);
    expect(valeNelGiorno('notte', 1)).toBeNull();
    expect(luogoDellaPosizione('in volo con le lettere')).toBeNull();
    expect(luogoDellaPosizione('casa (fuori scena)')).toBeNull();
    expect(luogoDellaPosizione('casa_nando (dentro)')).toBeNull();
    expect(luogoDellaPosizione('lavatoio')).toBe('lavatoio');
  });

  it('all’alba del giorno 1: Togna al lavatoio alle 7, il campanaro sul sagrato alle 8, Annunciata alle 9', () => {
    expect(prossimoArrivo(p('togna'), 1, 6.2)).toEqual({ giorno: 1, ore: 7, luogo: 'lavatoio' });
    expect(prossimoArrivo(p('bortolo'), 1, 6.2, { luogo: 'sagrato' })).toEqual({ giorno: 1, ore: 8, luogo: 'sagrato' });
    expect(prossimoArrivo(p('bortolo'), 1, 6.2)).toEqual({ giorno: 1, ore: 7, luogo: 'scorciatoia_terrazze' });
    expect(prossimoArrivo(p('annunciata'), 1, 6.2)).toEqual({ giorno: 1, ore: 9, luogo: 'san_vigilio' });
  });

  it('passata l’ora, il giorno dopo; appena cominciata (chi è in ritardo sta arrivando) vale ancora', () => {
    expect(prossimoArrivo(p('annunciata'), 1, 18)).toEqual({ giorno: 2, ore: 9, luogo: 'san_vigilio' });
    expect(prossimoArrivo(p('togna'), 1, 7.1, { luogo: 'lavatoio', giaIniziata: 0.25 })).toEqual({ giorno: 1, ore: 7, luogo: 'lavatoio' });
    expect(prossimoArrivo(p('togna'), 1, 7.5, { luogo: 'lavatoio', giaIniziata: 0.25 })).toEqual({ giorno: 2, ore: 7, luogo: 'lavatoio' });
  });

  it('la novizia: alla Bacheca solo il giorno 2 e finché il dono non è fatto (la condizione dell’orario)', () => {
    expect(prossimoArrivo(p('clelia'), 2, 6.5, { luogo: 'bacheca_ore', valuta: () => true })).toEqual({ giorno: 2, ore: 7, luogo: 'bacheca_ore' });
    expect(prossimoArrivo(p('clelia'), 2, 6.5, { luogo: 'bacheca_ore', valuta: () => false })).toBeNull();
    expect(prossimoArrivo(p('clelia'), 1, 10, { luogo: 'bacheca_ore', valuta: () => true })).toEqual({ giorno: 2, ore: 7, luogo: 'bacheca_ore' });
  });
});
