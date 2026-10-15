import { describe, expect, it } from 'vitest';
import {
  aspettoDaPersonaggio,
  battutaDaNodo,
  capisaldiDaContenuti,
  cartaDaTesto,
  grigliaDaParticelle,
  librettoDaTesti,
  separaNote,
  staccaFirma,
  taccuinoDaContenuti,
  terrenoDaTipo,
} from '../src/adattatori';

describe('testi.json → carte', () => {
  it('separa le note a margine e quelle di Elvira', () => {
    const r = separaNote('Chiodo sul muro.\n\n(a margine) Per E.: qui.\n\n(Elvira, a matita) Le scollerò.');
    expect(r).toEqual({ corpo: 'Chiodo sul muro.', margine: 'Per E.: qui.', notaElvira: 'Le scollerò.' });
  });

  it('stacca la firma breve e non le frasi', () => {
    expect(staccaFirma('Mamma,\n\nciao.\n\nMarta').firma).toBe('Marta');
    expect(staccaFirma('Ciao.\n\nLa Madre').firma).toBe('La Madre');
    expect(staccaFirma('Ciao.\n\nTi voglio bene.').firma).toBeUndefined();
    expect(staccaFirma('Io vi raggiungo.\n\nA.').firma).toBe('A.');
  });

  it('una lettera diventa una carta con supporto e firma', () => {
    const c = cartaDaTesto('lettera_marta', { titolo: 'Per la mamma', supporto: 'carta grezza', testo: 'Mamma,\n\nti scrivo.\n\nMarta' }, 'lettere');
    expect(c.tipo).toBe('lettera');
    expect(c.supporto).toBe('carta grezza');
    expect(c.pagine[0]).toMatchObject({ testo: 'Mamma,\n\nti scrivo.', firma: 'Marta' });
    expect(cartaDaTesto('biglietto_madre', { testo: 'x' }, 'lettere').tipo).toBe('biglietto');
  });

  it('il libretto mette intestazioni, schizzi e note del 2322', () => {
    const l = librettoDaTesti({
      cs_37: { titolo: 'CS 37', testo: 'Chiodo nel muro.', nota_2322: 'Il castagno non c’è più.', schizzo: 'il muro' },
      cs_1: { titolo: 'CS 1', testo: 'Pilastro.\n\n(a margine) Per E.' },
    });
    expect(l.tipo).toBe('libretto');
    expect(l.pagine).toHaveLength(2);
    expect(l.pagine[0]).toMatchObject({ intestazione: 'CS 37', notaElvira: 'Il castagno non c’è più.', schizzo: 'il muro' });
    expect(l.pagine[1]).toMatchObject({ intestazione: 'CS 1', margine: 'Per E.' });
  });

  it('una leggenda dell’Ombrista ha una pagina per quadro', () => {
    const c = cartaDaTesto('partenza_1', { titolo: 'La Partenza', quadri: [{ figure: 'i Padri', testo: 'C’era una volta.' }, { testo: 'Fine.' }], chiusura: 'Pina spegne.' }, 'leggende');
    expect(c.pagine.map((p) => p.testo)).toEqual(['C’era una volta.', 'Fine.']);
    expect(c.pagine[0]!.schizzo).toBe('i Padri');
    expect(c.pagine[1]!.margine).toBe('Pina spegne.');
  });
});

describe('taccuino.json → Taccuino', () => {
  const json = {
    domande: [
      { id: 'q1', mano: 'tecnica', testo: 'Chi?', indizi: ['i1', 'pv1', 'i2'] },
      { id: 'q2', mano: 'tecnica', testo: 'Perché?', indizi: ['i3'], risposta: 'i4' },
    ],
    indizi: [
      { id: 'i1', mano: 'tecnica', testo: 'Uno', fonte: 'A', domanda: 'q1' },
      { id: 'i2', mano: 'madre', testo: 'Due', fonte: 'B', domanda: 'q1' },
      { id: 'i3', testo: 'Tre', fonte: 'C', domanda: 'q2' },
      { id: 'i4', testo: 'La notte rimette la Carta.', fonte: 'D' },
      { id: 'i9', testo: 'Orfano', fonte: 'E' },
    ],
    note: [
      { id: 'n1', mano: 'madre', testo: 'Sotto la domanda', sotto: 'q1' },
      { id: 'n2', mano: 'madre', testo: 'Sotto l’indizio', sotto: 'i1' },
      { id: 'n3', testo: 'Libera' },
    ],
    parole: [{ id: 'w1', tecnica: 'asse', locale: 'il Fuso' }],
    proverbi: [{ id: 'pv1', dialetto: 'La préda', italiano: 'La pietra', fonte: 'Ottavio', nota_elvira: 'Vero.' }],
    leggende: [{ id: 'lg1', testo: '«…e la Svegliata…»', fonte: 'Prima sera', testo_completo: 'testi.leggende.partenza_1' }],
  };

  it('mette indizi, proverbi e note al loro posto', () => {
    const t = taccuinoDaContenuti(json, {
      voci: ['q1', 'i1', 'i2', 'pv1', 'n1', 'n2', 'n3', 'i9', 'w1', 'lg1', 'q2', 'i3'],
      nuove: ['i2'],
      chiuse: ['q2'],
      prossimoEvento: 'Alba alle 05:30',
    });
    const q1 = t.piste.find((p) => p.id === 'q1')!;
    expect(q1.indizi.map((i) => i.id)).toEqual(['i1', 'pv1', 'i2']);
    expect(q1.note?.[0]?.testo).toBe('Sotto la domanda');
    expect(q1.indizi[0]!.note?.[0]?.testo).toBe('Sotto l’indizio');
    expect(q1.indizi[2]).toMatchObject({ mano: 'madre', nuovo: true });
    expect(q1.indizi[1]!.testo).toContain('La préda');
    const q2 = t.piste.find((p) => p.id === 'q2')!;
    expect(q2).toMatchObject({ chiusa: true, risposta: 'La notte rimette la Carta.' });
    expect(t.note?.map((n) => n.id)).toEqual(['n3', 'i9']);
    expect(t.proverbi?.[0]).toMatchObject({ dialetto: 'La préda', italiano: 'La pietra', nota: 'Vero.' });
    expect(t.leggende?.[0]?.testoCompleto).toBe('testi.leggende.partenza_1');
    expect(t.prossimoEvento).toBe('Alba alle 05:30');
  });
});

describe('fade, capisaldi, dialoghi', () => {
  it('la griglia prende stati, terreno e inchiostro seppia', () => {
    const g = grigliaDaParticelle(
      [
        { id: 2599, iz: 27, itheta: 7, tipo: 'abitato', stato_iniziale: 'colore', rilevata_da: 'G4 2291' },
        { id: 2310, iz: 24, itheta: 6, tipo: 'terrazze', stato_iniziale: 'matita' },
        { id: 2700, iz: 28, itheta: 12, tipo: 'riale', stato_iniziale: 'bianco' },
      ],
      { stati: new Map([[2700, 'colore' as const]]) },
    );
    expect(g.stati[2599]).toBe(2);
    expect(g.seppia?.[2599]).toBe(1);
    expect(g.stati[2310]).toBe(1);
    expect(g.stati[2700]).toBe(2);
    expect(g.terreno?.[2700]).toBe(1);
    expect(terrenoDaTipo('cresta')).toBe('roccia');
  });

  it('i capisaldi rilevati e visti', () => {
    const c = capisaldiDaContenuti(
      { rete_corbella: [{ id: 'cs_1', numero: 1, tipo: 'pilastro', z: 1062, theta: 37.2 }], lontani_di_notte: [{ id: 'cs_12', numero: 12, z: 1500, theta: 105 }] },
      { rilevati: ['cs_1'], visti: ['cs_12'] },
    );
    expect(c[0]).toMatchObject({ id: 'cs_1', rilevato: true, tipo: 'pilastro' });
    expect(c[1]).toMatchObject({ id: 'cs_12', rilevato: false, visto: true });
  });

  it('una battuta con didascalia, aspetto e risposte filtrate', () => {
    const r = battutaDaNodo(
      {
        personaggio: 'ottavio',
        nodi: [
          {
            id: 'n1',
            didascalia: 'Atterra correndo.',
            testo: 'Allora è vero.',
            risposte: [{ testo: 'Chi sei?', vai_a: 'n2' }, { testo: 'Segreto', vai_a: 'n3', condizione: 'flag:x' }],
          },
        ],
      },
      'n1',
      [{ id: 'ottavio', nome: 'Ottavio, detto Ventin', come_appare: { velo: 'velo da corsa verde; Velo aperto', maschera: 'nessuna' } }],
      (c) => c !== 'flag:x',
    )!;
    expect(r.battuta).toMatchObject({ chi: 'Ottavio, detto Ventin', aspetto: 'velo da corsa verde', didascalia: 'Atterra correndo.' });
    expect(r.battuta.risposte).toEqual([{ testo: 'Chi sei?' }]);
    expect(r.risposte[0]!.vai_a).toBe('n2');
    expect(aspettoDaPersonaggio({ id: 'c', nome: 'Clelia', come_appare: { velo: 'veste di garza nera', maschera: 'maschera di castagno liscia' } })).toBe(
      'veste di garza nera · maschera di castagno liscia',
    );
  });
});
