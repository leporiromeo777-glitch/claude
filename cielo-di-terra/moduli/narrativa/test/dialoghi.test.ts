import { describe, expect, it, vi } from 'vitest';
import { ErroreDialogo } from '../src/dialoghi';
import { Narrativa } from '../src/narrativa';
import { FattiFinti } from './aiuti';

const DIALOGHI = {
  ottavio_fienile: {
    personaggio: 'ottavio',
    nodi: [
      {
        id: 'inizio',
        testo: 'Ti chiamano la Svegliata. Dove vai, così tardi?',
        risposte: [
          { testo: 'Cerco un posto per dormire.', vai_a: 'fienile' },
          { testo: 'Cos’è la Linea?', vai_a: 'linea', condizione: '!flag:sa_linea' },
          { testo: 'Mi hanno lasciato un velo.', vai_a: 'velo', condizione: 'oggetto:velo' },
          { testo: 'Niente. Buonanotte.', vai_a: 'fine' },
        ],
      },
      {
        id: 'linea',
        testo: 'La Linea è il sole. Ma non dirlo forte.',
        effetti: ['taccuino:parola_linea'],
        risposte: [{ testo: 'Capito.', vai_a: 'inizio', effetti: ['flag:sa_linea', 'taccuino:parola_linea barra'] }],
      },
      {
        id: 'fienile',
        testo: 'C’è il fienile dei Pedrazzini. Le Fade non entrano dove c’è fieno benedetto.',
        risposte: [
          { testo: 'Grazie.', vai_a: 'saluto', effetti: ['flag:sa_fienile', 'flag:fiducia_ottavio+=1'] },
          { testo: 'Le Fade?', vai_a: 'fade', effetti: ['taccuino:chi_sono_fade'] },
        ],
      },
      { id: 'fade', testo: 'Domani. Di notte non se ne parla.', vai_a: 'saluto' },
      { id: 'saluto', testo: 'Buonanotte, Svegliata.' },
      { id: 'velo', testo: 'Allora la Madre ti aspetta.', risposte: [{ testo: '…', vai_a: null, effetti: ['evento:campane'] }] },
    ],
  },
  ottavio_mattina: {
    personaggio: 'ottavio',
    condizione: 'dialogo:ottavio_fienile finito e giorno:>=2',
    nodi: [{ id: 'a', testo: 'Il sentiero non c’è più.', risposte: [{ testo: 'Lo vedo.', vai_a: 'fine' }] }],
  },
  ottavio_chiacchiera: {
    personaggio: 'ottavio',
    ripetibile: true,
    priorita: -1,
    nodi: [{ id: 'a', testo: 'Bella giornata.' }],
  },
  rotto: {
    personaggio: 'rosa',
    nodi: [{ id: 'a', testo: 'Ehi.', risposte: [{ testo: 'Vai', vai_a: 'nodo_che_non_esiste' }] }],
  },
};

const TACCUINO = [
  { id: 'parola_linea', tipo: 'parola', testo: 'Linea', tecnica: 'tubo solare', locale: 'Linea' },
  { id: 'chi_sono_fade', tipo: 'domanda', testo: 'Che cosa sono le Fade?' },
];

function nuova(): { n: Narrativa; f: FattiFinti } {
  const f = new FattiFinti();
  const n = new Narrativa({ dialoghi: DIALOGHI, taccuino: TACCUINO }, f);
  return { n, f };
}

describe('dialoghi', () => {
  it('mostra il nodo corrente con le risposte filtrate', () => {
    const { n } = nuova();
    const d = n.dialoghi;
    expect(d.isFinished()).toBe(true);
    expect(d.getNode()).toBeNull();
    const nodo = d.avvia('ottavio_fienile');
    expect(d.isFinished()).toBe(false);
    expect(nodo).toEqual({
      dialogo: 'ottavio_fienile',
      personaggio: 'ottavio',
      nodo: 'inizio',
      chi: 'ottavio',
      testo: 'Ti chiamano la Svegliata. Dove vai, così tardi?',
      risposte: [
        { indice: 0, testo: 'Cerco un posto per dormire.' },
        { indice: 1, testo: 'Cos’è la Linea?' },
        { indice: 2, testo: 'Niente. Buonanotte.' },
      ],
      finale: false,
    });
    expect(d.getNode()).toEqual(nodo);
  });

  it('applica gli effetti di nodi e risposte e aggiorna i filtri', () => {
    const { n } = nuova();
    const d = n.dialoghi;
    d.avvia('ottavio_fienile');
    let nodo = d.choose(1); // la Linea
    expect(nodo?.nodo).toBe('linea');
    expect(n.taccuino.ha('parola_linea')).toBe(true); // effetto d'ingresso nel nodo
    nodo = d.choose(0);
    expect(nodo?.nodo).toBe('inizio');
    expect(n.flag.vero('sa_linea')).toBe(true);
    expect(n.taccuino.parole()[0]).toMatchObject({ tecnica: 'tubo solare', locale: 'Linea', barrata: true });
    expect(nodo?.risposte.map((r) => r.testo)).toEqual(['Cerco un posto per dormire.', 'Niente. Buonanotte.']);
  });

  it('percorre fino alla fine e registra il dialogo finito', () => {
    const { n } = nuova();
    const d = n.dialoghi;
    const finiti = vi.fn();
    n.eventi.on('dialogoFinito', finiti);
    d.avvia('ottavio_fienile');
    d.choose(0); // fienile
    expect(d.choose(1)?.nodo).toBe('fade'); // nodo senza risposte con vai_a automatico
    expect(n.taccuino.domandeAperte().map((v) => v.id)).toEqual(['chi_sono_fade']);
    expect(d.getNode()?.finale).toBe(true);
    expect(() => d.choose(1)).toThrow(ErroreDialogo);
    const saluto = d.choose(0);
    expect(saluto).toMatchObject({ nodo: 'saluto', finale: true, risposte: [] });
    expect(d.isFinished()).toBe(false);
    expect(d.finito('ottavio_fienile')).toBe(false);
    expect(d.choose(0)).toBeNull();
    expect(d.isFinished()).toBe(true);
    expect(d.finito('ottavio_fienile')).toBe(true);
    expect(n.valuta('dialogo:ottavio_fienile finito')).toBe(true);
    expect(finiti).toHaveBeenCalledWith({ dialogo: 'ottavio_fienile', personaggio: 'ottavio' });
  });

  it('vai_a «fine» o null chiude il dialogo subito', () => {
    const { n } = nuova();
    n.inventario.aggiungi('velo');
    const eventi = vi.fn();
    n.eventi.on('evento', eventi);
    const d = n.dialoghi;
    d.avvia('ottavio_fienile');
    expect(d.getNode()?.risposte).toHaveLength(4);
    d.choose(2); // velo
    expect(d.choose(0)).toBeNull();
    expect(eventi).toHaveBeenCalledWith(expect.objectContaining({ nome: 'campane' }));
    expect(d.finito('ottavio_fienile')).toBe(true);

    d.avvia('ottavio_fienile');
    expect(d.choose(3)).toBeNull();
  });

  it('rifiuta indici sbagliati e dialoghi o nodi inesistenti', () => {
    const { n } = nuova();
    const d = n.dialoghi;
    expect(() => d.choose(0)).toThrow(/Nessun dialogo aperto/);
    expect(() => d.avvia('boh')).toThrow(/sconosciuto/);
    expect(() => d.avvia('ottavio_fienile', 'boh')).toThrow(/non ha il nodo/);
    d.avvia('ottavio_fienile');
    expect(() => d.choose(7)).toThrow(/inesistente/);
    expect(() => d.choose(-1)).toThrow(/inesistente/);
  });

  it('un vai_a verso un nodo inesistente chiude il dialogo e segnala il problema', () => {
    const { n } = nuova();
    const errori = vi.fn();
    n.eventi.on('errore', errori);
    n.dialoghi.avvia('rotto');
    expect(n.dialoghi.choose(0)).toBeNull();
    expect(n.dialoghi.finito('rotto')).toBe(true);
    expect(errori).toHaveBeenCalled();
    expect(n.problemi.join('\n')).toMatch(/nodo_che_non_esiste/);
  });

  it('interrompi chiude senza registrare; avviarne un altro interrompe il primo', () => {
    const { n } = nuova();
    const interrotti = vi.fn();
    n.eventi.on('dialogoInterrotto', interrotti);
    n.dialoghi.avvia('ottavio_fienile');
    n.dialoghi.interrompi();
    expect(n.dialoghi.isFinished()).toBe(true);
    expect(n.dialoghi.finito('ottavio_fienile')).toBe(false);
    expect(n.dialoghi.iniziato('ottavio_fienile')).toBe(true);
    n.dialoghi.avvia('ottavio_fienile');
    n.dialoghi.avvia('ottavio_chiacchiera');
    expect(interrotti).toHaveBeenCalledTimes(2);
    expect(n.dialoghi.aperto()).toBe('ottavio_chiacchiera');
  });

  it('sceglie il dialogo giusto per un personaggio', () => {
    const { n, f } = nuova();
    expect(n.dialoghi.disponibili('ottavio')).toEqual(['ottavio_fienile', 'ottavio_chiacchiera']);
    n.dialoghi.segnaFinito('ottavio_fienile');
    expect(n.dialoghi.perPersonaggio('ottavio')).toBe('ottavio_chiacchiera');
    f.giornoCorrente = 2;
    expect(n.dialoghi.perPersonaggio('ottavio')).toBe('ottavio_mattina');
    expect(n.parla('ottavio')?.testo).toBe('Il sentiero non c’è più.');
    n.dialoghi.choose(0);
    expect(n.parla('ottavio')?.testo).toBe('Bella giornata.');
    n.dialoghi.choose(0);
    expect(n.parla('ottavio')?.testo).toBe('Bella giornata.'); // ripetibile
    expect(n.parla('nessuno')).toBeNull();
  });

  it('un effetto che apre un altro dialogo non rompe la scelta in corso', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        dialoghi: {
          a: { personaggio: 'x', nodi: [{ id: 'n', testo: 'A', risposte: [{ testo: 'vai', vai_a: 'n', effetti: ['dialogo:b avvia'] }] }] },
          b: { personaggio: 'y', nodi: [{ id: 'm', testo: 'B' }] },
        },
      },
      f,
    );
    n.eventi.on('apriDialogo', ({ dialogo }) => n.dialoghi.avvia(dialogo));
    n.dialoghi.avvia('a');
    const dopo = n.dialoghi.choose(0);
    expect(dopo?.dialogo).toBe('b');
  });

  it('esporta e importa, anche a dialogo aperto', () => {
    const { n } = nuova();
    n.dialoghi.avvia('ottavio_fienile');
    n.dialoghi.choose(0);
    const stato = n.dialoghi.esporta();
    expect(stato).toEqual({ finiti: [], iniziati: ['ottavio_fienile'], corrente: { dialogo: 'ottavio_fienile', nodo: 'fienile' } });
    const altra = nuova().n;
    altra.dialoghi.importa(stato);
    expect(altra.dialoghi.getNode()?.nodo).toBe('fienile');
    altra.dialoghi.importa({ finiti: ['x'], iniziati: [], corrente: { dialogo: 'nessuno', nodo: 'a' } });
    expect(altra.dialoghi.isFinished()).toBe(true);
    expect(altra.dialoghi.finito('x')).toBe(true);
  });

  it('accetta nodi come mappa per id, risposte a stringa e campo inizio', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        dialoghi: [
          {
            id: 'mappa',
            personaggio: 'rosa',
            inizio: 'due',
            nodi: { uno: { testo: 'Uno' }, due: { testo: 'Due', risposte: [{ testo: 'a uno', vai_a: 'uno' }, 'Basta.'] } },
          },
        ],
      },
      f,
    );
    expect(n.dialoghi.avvia('mappa')?.testo).toBe('Due');
    expect(n.dialoghi.choose(0)?.testo).toBe('Uno');
    n.dialoghi.avvia('mappa');
    expect(n.dialoghi.choose(1)).toBeNull();
  });
});
