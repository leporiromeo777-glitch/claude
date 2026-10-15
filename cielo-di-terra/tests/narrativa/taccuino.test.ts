import { describe, expect, it, vi } from 'vitest';
import { normalizzaTaccuino } from '../../src/narrativa/contenuti';
import { Taccuino } from '../../src/narrativa/taccuino';

const VOCI = normalizzaTaccuino([
  { id: 'chi_marta', tipo: 'domanda', testo: 'Chi ha scritto la lettera di Marta?', risposta: 'La Madre.' },
  { id: 'api', tipo: 'domanda', testo: 'Perché le api non impollinano?' },
  { id: 'calligrafia', tipo: 'indizio', testo: 'La calligrafia è tecnica e minuta.', fonte: 'Cripta', domanda: 'chi_marta' },
  { id: 'cartellino', tipo: 'indizio', testo: 'Energia sospesa: priorità ASSETTO.', fonte: 'torre sommersa', domanda_id: 'api' },
  { id: 'meta', tipo: 'parola', tecnica: 'Meta', locale: 'Sole', testo: 'Meta' },
  { id: 'auto', tipo: 'nota', testo: 'Si scrive da sola', sblocca_quando: 'flag:x' },
  { id: 'auto_chiusa', tipo: 'domanda', testo: 'Si chiude da sola', chiudi_quando: 'flag:y' },
]);

describe('taccuino', () => {
  it('scrive voci in ordine e le mostra con tutti i campi', () => {
    let ora = 8;
    const t = new Taccuino(VOCI, () => ({ giorno: 1, ora }));
    const eventi = vi.fn();
    t.eventi.on('voce', eventi);
    expect(t.aggiungi('api')).toBe(true);
    ora = 9;
    expect(t.aggiungi('chi_marta')).toBe(true);
    expect(t.aggiungi('chi_marta')).toBe(false);
    t.aggiungi('calligrafia');
    t.aggiungi('cartellino');
    expect(t.voci().map((v) => v.id)).toEqual(['api', 'chi_marta', 'calligrafia', 'cartellino']);
    expect(t.voce('calligrafia')).toEqual({
      id: 'calligrafia',
      tipo: 'indizio',
      testo: 'La calligrafia è tecnica e minuta.',
      fonte: 'Cripta',
      domanda: 'chi_marta',
      chiusa: false,
      barrata: false,
      ordine: 2,
      nota: true,
      scrittaIl: { giorno: 1, ora: 9 },
    });
    expect(t.indizi('api').map((v) => v.id)).toEqual(['cartellino']);
    expect(t.indizi().length).toBe(2);
    expect(eventi).toHaveBeenCalledTimes(4);
  });

  it('domande aperte e chiuse, riapertura', () => {
    const t = new Taccuino(VOCI);
    t.aggiungi('chi_marta');
    t.aggiungi('api');
    expect(t.chiudi('chi_marta')).toBe(true);
    expect(t.chiudi('chi_marta')).toBe(false);
    expect(t.domandeAperte().map((v) => v.id)).toEqual(['api']);
    expect(t.domandeChiuse().map((v) => v.id)).toEqual(['chi_marta']);
    expect(t.domandeChiuse()[0]!.risposta).toBe('La Madre.');
    expect(t.riapri('chi_marta')).toBe(true);
    expect(t.domandeChiuse()).toEqual([]);
    // chiudere una domanda mai scritta la scrive già chiusa
    const u = new Taccuino(VOCI);
    u.chiudi('api');
    expect(u.domandeChiuse().map((v) => v.id)).toEqual(['api']);
  });

  it('parole: si scrivono già barrate; sostituisce toglie la voce sostituita', () => {
    const t = new Taccuino([
      ...VOCI,
      ...normalizzaTaccuino({
        parole: [
          { id: 'fade_dubbio', tecnica: '?', locale: 'le Fade?' },
          { id: 'fade', tecnica: 'macchine di manutenzione', locale: 'le Fade', sostituisce: 'fade_dubbio', nota: 'Di notte.' },
        ],
      }),
    ]);
    t.aggiungi('meta');
    expect(t.parole()[0]).toMatchObject({ tecnica: 'Meta', locale: 'Sole', barrata: true });
    expect(t.barra('meta')).toBe(false);
    t.aggiungi('fade_dubbio');
    t.aggiungi('fade');
    expect(t.parole().map((v) => v.id)).toEqual(['meta', 'fade']);
    expect(t.voce('fade')?.commento).toBe('Di notte.');
    // una nota qualunque si può barrare a mano
    t.aggiungi('api');
    expect(t.barra('api')).toBe(true);
  });

  it('voci sconosciute: scritte con l’id come testo', () => {
    const t = new Taccuino(VOCI);
    t.aggiungi('non_esiste');
    expect(t.voce('non_esiste')).toMatchObject({ testo: 'non_esiste', tipo: 'nota', nota: false });
  });

  it('riga del cielo', () => {
    const t = new Taccuino(VOCI);
    const ev = vi.fn();
    t.eventi.on('rigaCielo', ev);
    expect(t.rigaCielo()).toBeNull();
    t.impostaRigaCielo('Stanotte: la Pesarina passa sul Verbanetto');
    t.impostaRigaCielo('Stanotte: la Pesarina passa sul Verbanetto');
    expect(t.rigaCielo()).toBe('Stanotte: la Pesarina passa sul Verbanetto');
    t.impostaRigaCielo('  ');
    expect(t.rigaCielo()).toBeNull();
    expect(ev).toHaveBeenCalledTimes(2);
  });

  it('obiettivi', () => {
    const t = new Taccuino(VOCI);
    t.segnaObiettivo({ missione: 'm', passo: 'a', testo: 'Sali sul campanile' });
    t.segnaObiettivo({ missione: 'm', passo: 'b', testo: 'Rileva la terrazza' });
    t.segnaObiettivo({ missione: 'm', passo: 'a', testo: 'Sali sul campanile!' });
    expect(t.obiettivi().map((o) => o.testo)).toEqual(['Rileva la terrazza', 'Sali sul campanile!']);
    t.togliObiettivo('m', 'b');
    expect(t.obiettivi()).toHaveLength(1);
    t.togliObiettivo('m');
    expect(t.obiettivi()).toEqual([]);
  });

  it('voci automatiche con sblocca_quando e chiudi_quando', () => {
    const t = new Taccuino(VOCI);
    const flag = new Set<string>();
    const valuta = (c: unknown): boolean => typeof c === 'string' && flag.has(c.replace('flag:', ''));
    expect(t.aggiorna(valuta)).toBe(false);
    flag.add('x');
    flag.add('y');
    expect(t.aggiorna(valuta)).toBe(true);
    expect(t.ha('auto')).toBe(true);
    expect(t.ha('auto_chiusa')).toBe(false); // si chiude solo se è già scritta
    t.aggiungi('auto_chiusa');
    expect(t.aggiorna(valuta)).toBe(true);
    expect(t.stato('auto_chiusa')?.chiusa).toBe(true);
    expect(t.aggiorna(valuta)).toBe(false);
  });

  it('esporta e importa', () => {
    const t = new Taccuino(VOCI, () => ({ giorno: 2, ora: 7 }));
    t.aggiungi('api');
    t.chiudi('chi_marta');
    t.barra('meta');
    t.impostaRigaCielo('Brace fra tre ore');
    t.segnaObiettivo({ missione: 'm', passo: 'p', testo: 'Vai' });
    const dati = t.esporta();
    const u = new Taccuino(VOCI);
    u.importa(JSON.parse(JSON.stringify(dati)));
    expect(u.esporta()).toEqual(dati);
    u.aggiungi('calligrafia');
    expect(u.stato('calligrafia')?.ordine).toBe(3);
  });

  it('normalizza la forma raggruppata', () => {
    const avvisi: string[] = [];
    const voci = normalizzaTaccuino(
      {
        domande: [{ id: 'd1', domanda: 'Chi?' }],
        indizi: { i1: { testo: 'Un indizio', fonte: 'Rosa', domanda: 'd1' } },
        parole: [{ id: 'p1', tecnica: 'Meta', locale: 'Sole' }, { id: 'p2', tecnica: 'Assetto' }],
        riga_cielo: 'ignorata qui',
        boh: [],
      },
      avvisi,
    );
    expect(voci.map((v) => [v.id, v.tipo, v.testo])).toEqual([
      ['d1', 'domanda', 'Chi?'],
      ['i1', 'indizio', 'Un indizio'],
      ['p1', 'parola', 'Sole'],
      ['p2', 'parola', 'Assetto'],
    ]);
    expect(voci[1]!.domanda).toBe('d1');
    expect(avvisi).toEqual(['taccuino: la parola «p2» non ha sia «tecnica» sia «locale»', 'taccuino: gruppo sconosciuto «boh»']);
  });
});
