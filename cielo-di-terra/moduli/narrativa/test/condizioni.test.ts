import { describe, expect, it } from 'vitest';
import {
  ErroreCondizione,
  ParserCondizioni,
  analizzaCondizione,
  atomiDi,
  compilaCondizione,
  stampaCondizione,
  valutaCondizione,
} from '../src/condizioni';
import { contestoFinto } from './aiuti';

const stampa = (s: string): string => stampaCondizione(analizzaCondizione(s));

describe('parser delle condizioni: atomi', () => {
  it('riconosce i flag nelle varie forme', () => {
    expect(analizzaCondizione('flag:porta_aperta')).toEqual({ tipo: 'atomo', atomo: { k: 'flag', nome: 'porta_aperta' } });
    expect(analizzaCondizione('flag:visite=3')).toEqual({
      tipo: 'atomo',
      atomo: { k: 'flag', nome: 'visite', op: '=', valore: 3 },
    });
    expect(analizzaCondizione('flag:velo=nero').tipo).toBe('atomo');
    expect(stampa('flag:velo=nero')).toBe('flag:velo=nero');
    expect(stampa('flag:x=vero')).toBe('flag:x=vero');
    expect(stampa('flag:x==falso')).toBe('flag:x=falso');
    expect(stampa('flag:x>=2')).toBe('flag:x>=2');
    expect(stampa('flag:x != 2')).toBe('flag:x!=2');
    expect(stampa('flag:frase="due parole"')).toBe('flag:frase=due parole');
  });

  it('riconosce la negazione con ! e con non', () => {
    expect(analizzaCondizione('!flag:x')).toEqual({
      tipo: 'non',
      figlio: { tipo: 'atomo', atomo: { k: 'flag', nome: 'x' } },
    });
    expect(stampa('non flag:x')).toBe('!flag:x');
    expect(stampa('!!flag:x')).toBe('!!flag:x');
  });

  it('riconosce luoghi, celle, dialoghi, missioni, passi, oggetti, taccuino', () => {
    expect(stampa('luogo:campanile_san_vigilio raggiunto')).toBe('luogo:campanile_san_vigilio raggiunto');
    expect(stampa('luogo:fienile')).toBe('luogo:fienile raggiunto');
    expect(stampa('cella:c-12 rilevata')).toBe('cella:c-12 rilevata');
    expect(stampa('cella:c-12')).toBe('cella:c-12 rilevata');
    expect(stampa('cella:c-12 vista')).toBe('cella:c-12 vista');
    expect(stampa('particella:p7 mietuta')).toBe('cella:p7 mietuta');
    expect(stampa('cella:2599 colore')).toBe('cella:2599 rilevata');
    expect(stampa('cella:2599 matita')).toBe('cella:2599 vista');
    expect(stampa('cella:2599 bianco')).toBe('cella:2599 bianca');
    expect(stampa('particella:E2 Smontata')).toBe('cella:E2 smontata');
    expect(stampa('dialogo:ottavio_1 finito')).toBe('dialogo:ottavio_1 finito');
    expect(stampa('dialogo:ottavio_1 iniziato')).toBe('dialogo:ottavio_1 iniziato');
    expect(stampa('missione:m1 completata')).toBe('missione:m1 completata');
    expect(stampa('missione:m1 attiva')).toBe('missione:m1 attiva');
    expect(stampa('passo:m1/innesto completato')).toBe('passo:m1/innesto completato');
    expect(stampa('passo:m1.innesto attivo')).toBe('passo:m1/innesto attivo');
    expect(stampa('oggetto:squadro')).toBe('oggetto:squadro');
    expect(stampa('oggetto:api_rame>=3')).toBe('oggetto:api_rame>=3');
    expect(stampa('taccuino:chi_lettera_marta chiusa')).toBe('taccuino:chi_lettera_marta chiusa');
    expect(stampa('taccuino:parola_meta barrata')).toBe('taccuino:parola_meta barrata');
  });

  it("riconosce l'ora: confronti, ora singola, intervalli, minuti", () => {
    expect(analizzaCondizione('ora:>=20')).toEqual({
      tipo: 'atomo',
      atomo: { k: 'ora', confronto: { tipo: 'op', op: '>=', valore: 20 } },
    });
    expect(analizzaCondizione('ora:6-9')).toEqual({
      tipo: 'atomo',
      atomo: { k: 'ora', confronto: { tipo: 'intervallo', da: 6, a: 9 } },
    });
    expect(analizzaCondizione('ora:20')).toEqual({
      tipo: 'atomo',
      atomo: { k: 'ora', confronto: { tipo: 'intervallo', da: 20, a: 21 } },
    });
    expect(analizzaCondizione('ora:6:30-9')).toEqual({
      tipo: 'atomo',
      atomo: { k: 'ora', confronto: { tipo: 'intervallo', da: 6.5, a: 9 } },
    });
    expect(stampa('ora: >= 20')).toBe('ora:>=20');
    expect(stampa('ora:6 - 9')).toBe('ora:6-9');
  });

  it('riconosce il giorno e le parole notte/giorno', () => {
    expect(stampa('giorno:>=2')).toBe('giorno:>=2');
    expect(stampa('giorno:3')).toBe('giorno:3');
    expect(stampa('giorno:2-4')).toBe('giorno:2-4');
    expect(analizzaCondizione('notte')).toEqual({ tipo: 'atomo', atomo: { k: 'notte' } });
    expect(analizzaCondizione('giorno')).toEqual({ tipo: 'atomo', atomo: { k: 'di' } });
    expect(analizzaCondizione('NOTTE')).toEqual({ tipo: 'atomo', atomo: { k: 'notte' } });
    expect(analizzaCondizione('vero')).toEqual({ tipo: 'costante', valore: true });
    expect(analizzaCondizione('falso')).toEqual({ tipo: 'costante', valore: false });
  });
});

describe('parser delle condizioni: combinazioni', () => {
  it('«e» lega più di «o»', () => {
    const n = analizzaCondizione('flag:a o flag:b e flag:c');
    expect(n.tipo).toBe('o');
    expect(stampaCondizione(n)).toBe('flag:a o flag:b e flag:c');
    const m = analizzaCondizione('(flag:a o flag:b) e flag:c');
    expect(m.tipo).toBe('e');
    expect(stampaCondizione(m)).toBe('(flag:a o flag:b) e flag:c');
  });

  it('accetta parentesi annidate, negazioni di gruppi e sinonimi', () => {
    expect(stampa('!(flag:a e (notte o ora:<6))')).toBe('!(flag:a e (notte o ora:<6))');
    expect(stampa('flag:a && flag:b || flag:c')).toBe('flag:a e flag:b o flag:c');
    expect(stampa('flag:a, flag:b')).toBe('flag:a e flag:b');
    expect(stampa('flag:a E flag:b O flag:c')).toBe('flag:a e flag:b o flag:c');
    expect(stampa('luogo:fienile raggiunto e notte')).toBe('luogo:fienile raggiunto e notte');
    expect(stampa('dialogo:a finito o missione:m completata')).toBe('dialogo:a finito o missione:m completata');
  });

  it('una lista vale come «tutte vere», anche annidata', () => {
    const n = compilaCondizione(['flag:a', ['flag:b', 'notte'], 'ora:>=20']);
    expect(stampaCondizione(n)).toBe('flag:a e flag:b e notte e ora:>=20');
    expect(compilaCondizione([])).toEqual({ tipo: 'costante', valore: true });
    expect(compilaCondizione(null)).toEqual({ tipo: 'costante', valore: true });
    expect(compilaCondizione(undefined)).toEqual({ tipo: 'costante', valore: true });
    expect(compilaCondizione('')).toEqual({ tipo: 'costante', valore: true });
    expect(compilaCondizione('  ')).toEqual({ tipo: 'costante', valore: true });
    expect(compilaCondizione(false)).toEqual({ tipo: 'costante', valore: false });
  });

  it('accetta gli oggetti { e }, { o }, { non }', () => {
    expect(stampaCondizione(compilaCondizione({ o: ['flag:a', { e: ['flag:b', 'flag:c'] }] }))).toBe(
      'flag:a o flag:b e flag:c',
    );
    expect(stampaCondizione(compilaCondizione({ non: 'flag:a' }))).toBe('!flag:a');
    expect(stampaCondizione(compilaCondizione({ almeno_una: ['flag:a', 'flag:b'] }))).toBe('flag:a o flag:b');
    expect(() => compilaCondizione({ forse: ['flag:a'] })).toThrow(ErroreCondizione);
    expect(() => compilaCondizione({ e: 'flag:a' })).toThrow(/vuole una lista/);
  });

  it('elenca gli atomi', () => {
    const atomi = atomiDi(analizzaCondizione('luogo:a raggiunto e (cella:c1 rilevata o !flag:x)'));
    expect(atomi.map((a) => a.k)).toEqual(['luogo', 'cella', 'flag']);
  });

  it('usa la cache: la stessa stringa dà lo stesso albero', () => {
    const p = new ParserCondizioni();
    expect(p.analizza('flag:a e flag:b')).toBe(p.analizza(' flag:a e flag:b '));
  });
});

describe('parser delle condizioni: errori', () => {
  const casi: [string, RegExp][] = [
    ['flag:', /manca l'argomento/],
    ['flag:a e', /incompleta/],
    ['e flag:a', /senza condizione prima/],
    ['(flag:a', /mai chiusa/],
    ['flag:a)', /parentesi chiusa senza apertura/],
    ['flag:a flag:b', /atteso «e» oppure «o»/],
    ['luogo:a raggiunto notte', /atteso «e» oppure «o»/],
    ['pippo:a', /prefisso sconosciuto/],
    ['pippo', /termine sconosciuto/],
    ['luogo:a rilevato', /non valido per un luogo/],
    ['cella:c1 raggiunta', /stato di cella/],
    ['dialogo:a completato', /non valido per un dialogo/],
    ['flag:a acceso', /non accetta il qualificatore/],
    ['flag:a vero', /atteso «e» oppure «o»/],
    ['ora:alle20', /valore di ora non valido/],
    ['ora:>=25', /valore di ora non valido/],
    ['ora:6-x', /intervallo di ora non valido/],
    ['giorno:4-2', /rovesciato/],
    ['flag:x>abc', /vuole un numero/],
    ['flag:x=', /manca il valore/],
    ['passo:soloid', /missione\/passo/],
    ['oggetto:api>=tre', /quantità non valida/],
    ['flag:frase="aperta', /virgolette non chiuse/],
  ];
  for (const [testo, re] of casi) {
    it(`rifiuta «${testo}»`, () => {
      expect(() => analizzaCondizione(testo)).toThrow(ErroreCondizione);
      expect(() => analizzaCondizione(testo)).toThrow(re);
    });
  }

  it('indica la posizione dell’errore', () => {
    try {
      analizzaCondizione('flag:a e pippo:b');
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroreCondizione);
      expect((e as ErroreCondizione).posizione).toBe(9);
      expect((e as ErroreCondizione).message).toContain('carattere 10');
    }
  });

  it('errori() restituisce una lista invece di lanciare', () => {
    const p = new ParserCondizioni();
    expect(p.errori('flag:a')).toEqual([]);
    expect(p.errori(['flag:a', 'boh'])).toHaveLength(1);
  });

  it('prefissi aggiuntivi su richiesta', () => {
    const p = new ParserCondizioni({ prefissiExtra: ['fada'] });
    expect(p.analizza('fada:prato_alto vista')).toEqual({
      tipo: 'atomo',
      atomo: { k: 'extra', prefisso: 'fada', argomento: 'prato_alto', qualificatore: 'vista' },
    });
    expect(() => analizzaCondizione('fada:prato_alto')).toThrow(/prefisso sconosciuto/);
    const ctx = contestoFinto({ extra: { 'fada:prato_alto vista': true } });
    expect(p.valuta('fada:prato_alto vista', ctx)).toBe(true);
    expect(p.valuta('fada:altro', ctx)).toBe(false);
  });

  it('stati di cella aggiuntivi su richiesta', () => {
    const p = new ParserCondizioni({ statiCellaExtra: ['allagata'] });
    expect(p.analizza('cella:c1 allagata')).toEqual({ tipo: 'atomo', atomo: { k: 'cella', id: 'c1', stato: 'allagata' } });
  });
});

describe('valutazione', () => {
  it('flag: acceso, uguale, diverso, confronti, assenti', () => {
    const ctx = contestoFinto({ flag: { a: true, b: false, n: 3, s: 'nero', zero: 0, vuoto: '', num: '4' } });
    expect(valutaCondizione('flag:a', ctx)).toBe(true);
    expect(valutaCondizione('flag:b', ctx)).toBe(false);
    expect(valutaCondizione('flag:zero', ctx)).toBe(false);
    expect(valutaCondizione('flag:vuoto', ctx)).toBe(false);
    expect(valutaCondizione('flag:mancante', ctx)).toBe(false);
    expect(valutaCondizione('!flag:mancante', ctx)).toBe(true);
    expect(valutaCondizione('flag:n=3', ctx)).toBe(true);
    expect(valutaCondizione('flag:n>=3', ctx)).toBe(true);
    expect(valutaCondizione('flag:n>3', ctx)).toBe(false);
    expect(valutaCondizione('flag:n<4', ctx)).toBe(true);
    expect(valutaCondizione('flag:n!=3', ctx)).toBe(false);
    expect(valutaCondizione('flag:s=nero', ctx)).toBe(true);
    expect(valutaCondizione('flag:s!=bianco', ctx)).toBe(true);
    expect(valutaCondizione('flag:a=vero', ctx)).toBe(true);
    expect(valutaCondizione('flag:b=falso', ctx)).toBe(true);
    expect(valutaCondizione('flag:mancante=falso', ctx)).toBe(true);
    expect(valutaCondizione('flag:mancante=0', ctx)).toBe(true);
    expect(valutaCondizione('flag:mancante<1', ctx)).toBe(true);
    expect(valutaCondizione('flag:a=1', ctx)).toBe(true);
    expect(valutaCondizione('flag:num>3', ctx)).toBe(true);
    expect(valutaCondizione('flag:s>3', ctx)).toBe(false);
    expect(valutaCondizione('flag:s!=3', ctx)).toBe(true);
    expect(valutaCondizione('flag:n="3"', ctx)).toBe(true);
  });

  it('ora: confronti e intervalli semiaperti, anche oltre la mezzanotte', () => {
    const a = (ora: number, c: string): boolean => valutaCondizione(c, contestoFinto({ ora }));
    expect(a(20, 'ora:>=20')).toBe(true);
    expect(a(19.99, 'ora:>=20')).toBe(false);
    expect(a(6, 'ora:6-9')).toBe(true);
    expect(a(8.99, 'ora:6-9')).toBe(true);
    expect(a(9, 'ora:6-9')).toBe(false);
    expect(a(5.9, 'ora:6-9')).toBe(false);
    expect(a(23, 'ora:22-5')).toBe(true);
    expect(a(2, 'ora:22-5')).toBe(true);
    expect(a(5, 'ora:22-5')).toBe(false);
    expect(a(12, 'ora:22-5')).toBe(false);
    expect(a(20.5, 'ora:20')).toBe(true);
    expect(a(21, 'ora:20')).toBe(false);
    expect(a(6.4, 'ora:6:30-9')).toBe(false);
    expect(a(6.5, 'ora:6:30-9')).toBe(true);
  });

  it('giorno, notte e giorno-luce', () => {
    expect(valutaCondizione('giorno:>=2', contestoFinto({ giorno: 2 }))).toBe(true);
    expect(valutaCondizione('giorno:>=2', contestoFinto({ giorno: 1 }))).toBe(false);
    expect(valutaCondizione('giorno:2-4', contestoFinto({ giorno: 4 }))).toBe(true);
    expect(valutaCondizione('giorno:2-4', contestoFinto({ giorno: 5 }))).toBe(false);
    expect(valutaCondizione('giorno:3', contestoFinto({ giorno: 3 }))).toBe(true);
    expect(valutaCondizione('notte', contestoFinto({ notte: true }))).toBe(true);
    expect(valutaCondizione('giorno', contestoFinto({ notte: true }))).toBe(false);
    expect(valutaCondizione('giorno', contestoFinto({ notte: false }))).toBe(true);
  });

  it('fatti del mondo e stato narrativo', () => {
    const ctx = contestoFinto({
      luoghi: ['fienile'],
      celle: { c1: ['rilevata', 'vista'], c2: ['vista'] },
      dialoghiFiniti: ['ottavio_1'],
      dialoghiIniziati: ['ottavio_1', 'rosa_1'],
      missioni: { m0: 'completata', m1: 'attiva' },
      passi: { 'm1/innesto': 'attivo' },
      oggetti: { api_rame: 3 },
      taccuino: { d1: {}, d2: { chiusa: true }, p1: { barrata: true } },
    });
    const v = (c: string): boolean => valutaCondizione(c, ctx);
    expect(v('luogo:fienile raggiunto')).toBe(true);
    expect(v('luogo:cripta raggiunto')).toBe(false);
    expect(v('cella:c1 rilevata')).toBe(true);
    expect(v('cella:c2 rilevata')).toBe(false);
    expect(v('cella:c2 vista')).toBe(true);
    expect(v('dialogo:ottavio_1 finito')).toBe(true);
    expect(v('dialogo:rosa_1 finito')).toBe(false);
    expect(v('dialogo:rosa_1 iniziato')).toBe(true);
    expect(v('missione:m0 completata')).toBe(true);
    expect(v('missione:m1 completata')).toBe(false);
    expect(v('missione:m1 attiva')).toBe(true);
    expect(v('missione:m1 avviata')).toBe(true);
    expect(v('missione:m2 inattiva')).toBe(true);
    expect(v('passo:m1/innesto attivo')).toBe(true);
    expect(v('passo:m1/innesto completato')).toBe(false);
    expect(v('oggetto:api_rame')).toBe(true);
    expect(v('oggetto:api_rame>=3')).toBe(true);
    expect(v('oggetto:api_rame>3')).toBe(false);
    expect(v('oggetto:squadro')).toBe(false);
    expect(v('taccuino:d1')).toBe(true);
    expect(v('taccuino:d1 aperta')).toBe(true);
    expect(v('taccuino:d2 chiusa')).toBe(true);
    expect(v('taccuino:d2 aperta')).toBe(false);
    expect(v('taccuino:p1 barrata')).toBe(true);
    expect(v('taccuino:assente')).toBe(false);
  });

  it('combinazioni e liste', () => {
    const ctx = contestoFinto({ flag: { a: true, b: false }, ora: 21, notte: true });
    expect(valutaCondizione('flag:a e flag:b', ctx)).toBe(false);
    expect(valutaCondizione('flag:a o flag:b', ctx)).toBe(true);
    expect(valutaCondizione('flag:b o flag:a e notte', ctx)).toBe(true);
    expect(valutaCondizione('(flag:b o flag:a) e !notte', ctx)).toBe(false);
    expect(valutaCondizione(['flag:a', 'notte', 'ora:>=20'], ctx)).toBe(true);
    expect(valutaCondizione(['flag:a', 'flag:b'], ctx)).toBe(false);
    expect(valutaCondizione({ o: ['flag:b', ['flag:a', 'notte']] }, ctx)).toBe(true);
  });
});
