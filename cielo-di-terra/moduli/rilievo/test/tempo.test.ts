import { describe, expect, it } from 'vitest';
import {
  dentroIntervallo,
  faseDelGiorno,
  formattaOra,
  leggiCollare,
  leggiIntervallo,
  lineaAccesa,
  minuti,
  minutiNotte,
} from '../src/tempo';

describe("l'ora di gioco", () => {
  it('legge stringhe e numeri', () => {
    expect(minuti('23:20')).toBe(1400);
    expect(minuti('0:30')).toBe(30);
    expect(minuti('05')).toBe(300);
    expect(minuti(23.5)).toBe(1410);
    expect(minuti(24)).toBe(0);
    expect(minuti('24:00')).toBe(0);
    expect(() => minuti('mezzanotte')).toThrow(/Ora non valida/);
    expect(() => minuti('12:75')).toThrow();
    expect(formattaOra(1400)).toBe('23:20');
    expect(formattaOra(-30)).toBe('23:30');
  });

  it('ordina le ore della notte dal mezzogiorno', () => {
    const ore = ['00:30', '22:20', '04:30', '21:00', '23:20'].sort((a, b) => minutiNotte(a) - minutiNotte(b));
    expect(ore).toEqual(['21:00', '22:20', '23:20', '00:30', '04:30']);
    expect(minutiNotte('05:30')).toBe(1050);
  });

  it('fasi del giorno (GDD §2.3) e Linea accesa', () => {
    expect(faseDelGiorno('05:29')).toBe('notte');
    expect(faseDelGiorno('05:30')).toBe('alba');
    expect(faseDelGiorno('06:30')).toBe('giorno');
    expect(faseDelGiorno('19:29')).toBe('giorno');
    expect(faseDelGiorno('19:30')).toBe('brace');
    expect(faseDelGiorno('21:00')).toBe('notte');
    expect(lineaAccesa(12)).toBe(true);
    expect(lineaAccesa('20:00')).toBe(false);
    expect(lineaAccesa('03:00')).toBe(false);
  });

  it('intervalli anche oltre la mezzanotte', () => {
    expect(dentroIntervallo('23:00', [1200, 330])).toBe(true);
    expect(dentroIntervallo('05:30', [1200, 330])).toBe(false);
    expect(dentroIntervallo('12:00', [1200, 330])).toBe(false);
    expect(dentroIntervallo('12:00', [600, 600])).toBe(false);
  });

  it('legge le ore dei lumi e del Collare nei formati di capisaldi.json', () => {
    expect(leggiIntervallo('20:00-05:30')).toEqual([1200, 330]);
    expect(leggiIntervallo('mai')).toBeNull();
    expect(leggiCollare('coperto dal Collare fra le 01:00 e le 01:40')).toEqual([[60, 100]]);
    expect(leggiCollare('dentro il Collare dalle 02:00 alle 02:40')).toEqual([[120, 160]]);
    expect(leggiCollare('mai coperto')).toEqual([]);
    expect(leggiCollare(undefined)).toEqual([]);
  });
});
