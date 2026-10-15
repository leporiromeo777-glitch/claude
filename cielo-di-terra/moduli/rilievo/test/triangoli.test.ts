import { describe, expect, it } from 'vitest';
import { celleNelRaggio, idCella } from '../src/griglia';
import { chiudiTriangolo, rileva, stazioneLibera } from '../src/rilievo';
import { cellaRilevataDaElvira, statoIniziale } from '../src/stato';
import type { EventoCatasto } from '../src/tipi';
import { flagDa, regoleCon, regoleFase1 } from './aiuti';

const r3 = regoleCon({ fase: 3, particelleTrama: { T1: [idCella(1480, 88.5)], T6: [idCella(2800, 30), idCella(2900, 30)] } });
const tutto = () => true;
const tipi = (e: EventoCatasto[]) => e.map((x) => x.tipo);

describe('triangoli attraverso il cielo (dalla Fase 3)', () => {
  it('T1 del Ponte: Pilastri 1, 12 e 14, di notte, sui lumi', () => {
    const s = statoIniziale(r3);
    const t = chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_12', 'cs_14'], ora: '22:00' });
    expect(t.ok, t.messaggio).toBe(true);
    expect(t.effetti[0]).toBe('flag:rilevato_triangolo:T1');
    const chiuso = t.eventi.find((e) => e.tipo === 'triangolo_chiuso');
    expect(chiuso).toMatchObject({ triangolo: 'T1', tipoTriangolo: 'cielo', vertici: ['cs_1', 'cs_12', 'cs_14'] });
    // le particelle entro 80 m da ogni vertice, più quelle di trama
    for (const v of ['cs_1', 'cs_12', 'cs_14']) {
      const c = r3.capisaldi.get(v)!;
      for (const id of celleNelRaggio(c, 80)) expect(cellaRilevataDaElvira(t.stato, id)).toBe(true);
    }
    expect(cellaRilevataDaElvira(t.stato, idCella(1480, 88.5))).toBe(true);
    // un'animazione d'inchiostro per vertice, più una per le particelle di trama
    expect(t.eventi.filter((e) => e.tipo === 'particelle_rivelate')).toHaveLength(4);
    expect(t.stato.triangoli.T1).toEqual({ id: 'T1', tipo: 'cielo', vertici: ['cs_1', 'cs_12', 'cs_14'], giorno: 1 });
    expect(t.stato.capisaldi.cs_14).toMatchObject({ rilevato: true, firme: ['G5'] });
  });

  it('non di giorno, non sotto il Collare, non nella Fase 1, non con due pilastri della stessa valle', () => {
    const s = statoIniziale(r3);
    expect(chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_12', 'cs_14'], ora: '12:00' }).motivo).toBe('non_notte');
    const collare = chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_12', 'cs_14'], ora: '01:15' });
    expect(collare).toMatchObject({ ok: false, motivo: 'collare' });
    expect(chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_12', 'cs_14'], ora: '20:10' })).toMatchObject({ ok: false, motivo: 'buio' }); // la lanterna di Rosa si accende alle 20:30
    const r1 = regoleFase1();
    const f1 = chiudiTriangolo(statoIniziale(r1), r1, { stazione: 'cs_1', mire: ['cs_12', 'cs_14'], ora: '22:00' });
    expect(f1).toMatchObject({ ok: false, motivo: 'non_attivo' });
    expect(f1.messaggio).toMatch(/incollate/);
    const stessa = chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_4', 'cs_14'], ora: '22:00', lumiDiOttavio: ['cs_4'] });
    expect(stessa.motivo).toBe('tre_valli');
    expect(chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_15', 'cs_14'], ora: '22:00' }).motivo).toBe('buio');
    expect(chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_1', 'cs_14'], ora: '22:00' }).motivo).toBe('stessa_stazione');
  });

  it('un triangolo fuori dalla tabella vuole che anche le due mire si vedano', () => {
    const s = statoIniziale(r3);
    const tab = chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_17', 'cs_23'], ora: '22:00' });
    expect(tab).toMatchObject({ ok: false, motivo: 'coperto' });
    const gioco = chiudiTriangolo(s, r3, { stazione: 'cs_1', mire: ['cs_17', 'cs_23'], ora: '22:00', lineaLibera: tutto });
    expect(gioco.ok).toBe(true);
    expect(gioco.stato.triangoli['cielo:cs_1-cs_17-cs_23']?.tipo).toBe('cielo');
  });
});

describe('la stazione libera (intersezione inversa)', () => {
  const sordo = { z: 2800, theta: 35, altezza: 343 };

  it('tre lumi lontani da un punto qualunque: un chiodo nuovo «E1» e un ventaglio di 40 m', () => {
    const s = statoIniziale(r3);
    const x = stazioneLibera(s, r3, { punto: sordo, lumi: ['cs_31', 'cs_14', 'cs_1'], ora: '22:30', lineaLibera: tutto, lumiDiOttavio: ['cs_31', 'cs_1'] });
    expect(x.ok, x.messaggio).toBe(true);
    expect(tipi(x.eventi)).toEqual(expect.arrayContaining(['caposaldo_nuovo', 'particelle_rivelate', 'triangolo_chiuso']));
    const e1 = x.stato.capisaldiNuovi.cs_E1!;
    expect(e1).toMatchObject({ etichetta: 'E1', nome: 'Chiodo E1', tipo: 'chiodo_nuovo', cella: idCella(2800, 35), fonte: 'stazione_libera' });
    expect(x.stato.capisaldi.cs_E1).toMatchObject({ visto: true, rilevato: true });
    for (const id of celleNelRaggio(sordo, 40)) expect(cellaRilevataDaElvira(x.stato, id)).toBe(true);
    // i lumi 31, 14 e 1 sono il triangolo T5 della parete
    expect(flagDa(x.effetti)).toEqual(expect.arrayContaining(['stazione_libera:E1', 'rilevato_triangolo:T5']));
    // il chiodo nuovo è un caposaldo a tutti gli effetti: un secondo chiodo e un lato fra i due
    const y = stazioneLibera(x.stato, r3, { punto: { z: 2850, theta: 33, altezza: 400 }, lumi: ['cs_31', 'cs_14', 'cs_1'], ora: '23:00', lineaLibera: tutto, lumiDiOttavio: ['cs_31', 'cs_1'] });
    expect(y.stato.capisaldiNuovi.cs_E2?.etichetta).toBe('E2');
    const lato = rileva(y.stato, r3, { stazione: 'cs_E1', mira: 'cs_E2', ora: '20:00', lineaLibera: tutto });
    expect(lato.ok, lato.messaggio).toBe(true);
    expect(lato.stato.lati['E1-E2']).toMatchObject({ stazione: 'cs_E1', mira: 'cs_E2' });
    expect(flagDa(lato.effetti)).toContain('rilevato_lato:E1-E2');
  });

  it('non di giorno, non senza raycast, non con i lumi allineati, non con due lumi uguali', () => {
    const s = statoIniziale(r3);
    const base = { punto: sordo, lumi: ['cs_31', 'cs_14', 'cs_1'] as [string, string, string], lumiDiOttavio: ['cs_31', 'cs_1'] };
    expect(stazioneLibera(s, r3, { ...base, ora: '12:00', lineaLibera: tutto }).motivo).toBe('non_notte');
    expect(stazioneLibera(s, r3, { ...base, ora: '22:00' }).messaggio).toMatch(/raycast del gioco/);
    const stretta = regoleCon({ fase: 3, parametri: { separazioneLumi: 179 } });
    expect(stazioneLibera(statoIniziale(stretta), stretta, { ...base, ora: '22:00', lineaLibera: tutto }).motivo).toBe('lumi_allineati');
    expect(stazioneLibera(s, r3, { ...base, lumi: ['cs_31', 'cs_31', 'cs_1'], ora: '22:00', lineaLibera: tutto }).motivo).toBe('lumi_insufficienti');
    expect(stazioneLibera(s, r3, { ...base, lumiDiOttavio: [], ora: '22:00', lineaLibera: tutto }).motivo).toBe('buio');
  });

  it('T6, il Triangolo Zero: la stazione sul Caposaldo Zero lo rimette sulla Carta e dipinge il Sordo', () => {
    const s = statoIniziale(r3);
    const x = stazioneLibera(s, r3, {
      punto: { z: 2968, theta: 0, altezza: 642 },
      caposaldo: 'cs_0',
      lumi: ['cs_1', 'cs_15', 'cs_23'],
      ora: '23:00',
      lineaLibera: tutto,
      lumiDiOttavio: ['cs_1', 'cs_15'],
    });
    expect(x.ok, x.messaggio).toBe(true);
    expect(Object.keys(x.stato.capisaldiNuovi)).toEqual([]);
    expect(x.stato.capisaldi.cs_0).toMatchObject({ rilevato: true });
    expect(x.stato.triangoli.T6?.tipo).toBe('stazione_libera');
    expect(cellaRilevataDaElvira(x.stato, idCella(2900, 30))).toBe(true);
    expect(flagDa(x.effetti)).toEqual(expect.arrayContaining(['stazione_libera:0', 'rilevato_triangolo:T6']));
  });
});
