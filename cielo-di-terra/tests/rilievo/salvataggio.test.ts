import { describe, expect, it } from 'vitest';
import { applicaCicliDelGiorno, avanzaNotte, chiudiNotte, iniziaNotte, notte } from '../../src/rilievo/notte';
import { appunta, rileva } from '../../src/rilievo/rilievo';
import { ErroreSalvataggio, FORMATO_SALVATAGGIO, caricaCatasto, deserializzaCatasto, impronta, salvaCatasto, serializzaCatasto } from '../../src/rilievo/salvataggio';
import { statoIniziale } from '../../src/rilievo/stato';
import type { StatoCatasto } from '../../src/rilievo/tipi';
import { regoleCon, regoleFase1 } from './aiuti';

const r = regoleFase1();

function partita(): StatoCatasto {
  let s = applicaCicliDelGiorno(statoIniziale(r), r, { da: '05:30', a: '21:00' }).stato;
  s = appunta(s, r, { bersaglio: { caposaldo: 'cs_17' }, ora: '20:30' }).stato;
  s = notte(s, r, { elvira: { cella: 2797 } }).nuovoStato;
  s = rileva(s, r, { stazione: 'cs_3', mira: 'cs_1', ora: 10 }).stato;
  s = rileva(s, r, { stazione: 'cs_8', mira: 'cs_7', ora: 11 }).stato;
  return s;
}

describe('salvataggio del catasto', () => {
  it('salva e ripristina tutto lo stato, anche come testo', () => {
    const s = partita();
    const blob = salvaCatasto(s);
    expect(blob.formato).toBe(FORMATO_SALVATAGGIO);
    expect(blob.versione).toBe(1);
    expect(blob.controllo).toMatch(/^[0-9a-f]{8}$/);
    const { stato, avvisi } = caricaCatasto(blob, r);
    expect(avvisi).toEqual([]);
    expect(stato).toEqual(s);
    const testo = serializzaCatasto(s);
    expect(deserializzaCatasto(testo, r).stato).toEqual(s);
    expect(deserializzaCatasto(testo).stato).toEqual(s);
    // il blob è una copia: cambiare lo stato dopo non lo tocca
    s.giorno = 99;
    expect(blob.stato.giorno).toBe(2);
  });

  it('una notte salvata a metà riprende e finisce come se nessuno l\'avesse interrotta', () => {
    const base = applicaCicliDelGiorno(statoIniziale(r), r, { da: '05:30', a: '21:00' }).stato;
    let s = iniziaNotte(base, r, { elvira: { cella: 2799 } });
    s = avanzaNotte(s, r, '23:00').stato;
    const ripreso = caricaCatasto(JSON.parse(serializzaCatasto(s)), r).stato;
    const a = chiudiNotte(ripreso, r);
    const b = notte(base, r, { elvira: { cella: 2799 } });
    expect(a.resoconto.testo).toEqual(b.resoconto.testo);
    expect(a.stato.elementi).toEqual(b.nuovoStato.elementi);
  });

  it('rifiuta i blob sbagliati con un errore leggibile', () => {
    const blob = salvaCatasto(partita());
    expect(() => caricaCatasto({ ...blob, formato: 'altro' })).toThrow(ErroreSalvataggio);
    expect(() => caricaCatasto('{non json')).toThrow(/JSON/);
    expect(() => caricaCatasto({ ...blob, versione: 2 })).toThrow(/più nuova/);
    expect(() => caricaCatasto({ ...blob, versione: 0 })).toThrow(/non valida/);
    const manomesso = structuredClone(blob);
    manomesso.stato.rilieviFatti = 200;
    expect(() => caricaCatasto(manomesso)).toThrow(/controllo/);
    expect(caricaCatasto(manomesso, undefined, { tollerante: true }).avvisi[0]).toMatch(/Controllo/);
    const rotto = structuredClone(blob) as unknown as { stato: Record<string, unknown>; controllo: string };
    delete rotto.stato.lati;
    rotto.controllo = impronta(JSON.stringify(rotto.stato));
    expect(() => caricaCatasto(rotto)).toThrow(/«lati»/);
    expect(() => caricaCatasto({ formato: FORMATO_SALVATAGGIO, versione: 1 })).toThrow(/senza stato/);
  });

  it('si riconcilia con i contenuti cambiati', () => {
    const s = partita();
    s.elementi.E9 = { variante: 'Carta', rimastaSegnalata: false };
    s.elementi.E1 = { variante: 'Sparita', rimastaSegnalata: false };
    delete s.elementi.E3;
    s.particelle['999999'] = { stato: 'matita', rilievi: [] };
    s.capisaldi.cs_zz = { visto: true, rilevato: false, firme: [], spostato: null };
    const { stato, avvisi } = caricaCatasto(salvaCatasto(s), r);
    expect(stato.elementi.E9).toBeUndefined();
    expect(stato.elementi.E1?.variante).toBe('Carta');
    expect(stato.elementi.E3?.variante).toBe('Carta');
    expect(stato.particelle['999999']).toBeUndefined();
    expect(avvisi.join('\n')).toMatch(/E9 non c'è più/);
    expect(avvisi.join('\n')).toMatch(/«Sparita» non esiste più/);
    expect(avvisi.join('\n')).toMatch(/Elemento nuovo nei contenuti: E3/);
    expect(avvisi.join('\n')).toMatch(/999999 non valida/);
    expect(avvisi.join('\n')).toMatch(/cs_zz sconosciuto/);
    // ancore nuove nei contenuti
    const conAncora = regoleCon({ ancore: [{ id: 'k1', elemento: 'E2', descrizione: '' }] });
    expect(caricaCatasto(salvaCatasto(statoIniziale(r)), conAncora).stato.ancore.k1).toEqual({ stato: 'vuota', giorno: null, variantePrima: null });
  });
});
