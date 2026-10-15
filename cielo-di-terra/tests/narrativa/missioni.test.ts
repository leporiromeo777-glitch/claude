import { describe, expect, it, vi } from 'vitest';
import { normalizzaMissioni } from '../../src/narrativa/contenuti';
import { Missioni } from '../../src/narrativa/missioni';
import { Narrativa } from '../../src/narrativa/narrativa';
import { FattiFinti } from './aiuti';

const MISSIONI = [
  {
    id: 'prologo',
    titolo: 'La Cripta',
    passi: [
      { id: 'sveglia', obiettivo_taccuino: 'Esci dalla Cripta', completa_quando: 'luogo:castagno_morto raggiunto' },
      {
        id: 'ottavio',
        obiettivo_taccuino: 'Parla con Ottavio',
        completa_quando: 'dialogo:ottavio_1 finito',
        effetti: ['taccuino:chi_marta', 'flag:conosce_ottavio'],
      },
      {
        id: 'notte',
        obiettivo_taccuino: 'Dormi nel fienile',
        attiva_quando: 'ora:>=18 o notte',
        completa_quando: ['luogo:fienile raggiunto', 'notte'],
        effetti: ['tempo:salta-a 6', 'missione:m1 avvia'],
      },
    ],
    effetti: ['evento:titoli_di_testa'],
  },
  {
    id: 'm1',
    titolo: 'Il castagno vuoto',
    passi: [
      { id: 'campanile', completa_quando: 'luogo:san_vigilio raggiunto' },
      { id: 'rilievo', completa_quando: 'cella:terrazza rilevata', effetti: ['flag:primo_rilievo', 'oggetto:+marze'] },
    ],
  },
  {
    id: 'secondaria',
    titolo: 'Le api',
    avvia_quando: 'missione:m1 completata e giorno:>=2',
    passi: [{ id: 'cisterna', completa_quando: 'flag:cisterna_vista' }],
  },
];

const DIALOGHI = {
  ottavio_1: {
    personaggio: 'ottavio',
    nodi: [{ id: 'a', testo: 'Sei la Svegliata?', risposte: [{ testo: 'Sì.', vai_a: 'fine' }] }],
  },
};

const TACCUINO = [{ id: 'chi_marta', tipo: 'domanda', testo: 'Chi ha scritto la lettera di Marta?' }];

function nuova(): { n: Narrativa; f: FattiFinti } {
  const f = new FattiFinti();
  const n = new Narrativa({ missioni: MISSIONI, dialoghi: DIALOGHI, taccuino: TACCUINO }, f);
  return { n, f };
}

describe('missioni attraverso la facciata', () => {
  it('le missioni senza avvio sono iniziali solo se nessun effetto le avvia', () => {
    const { n } = nuova();
    expect(n.missioni.iniziali).toEqual(['prologo']);
    expect(n.problemi).toEqual([]);
  });

  it('percorre il prologo e la missione 1 con eventi in ordine', () => {
    const { n, f } = nuova();
    const registro: string[] = [];
    n.eventi.onQualsiasi((tipo, dato) => {
      const d = dato as Record<string, unknown>;
      if (['missioneAvviata', 'passoAttivato', 'passoCompletato', 'missioneCompletata'].includes(tipo as string)) {
        registro.push(`${String(tipo)} ${String(d.missione)}${d.passo ? '/' + String(d.passo) : ''}`);
      }
      if (tipo === 'evento' || tipo === 'tempo') registro.push(`${String(tipo)} ${JSON.stringify(dato)}`);
    });

    expect(n.missioni.stato('prologo')).toBe('inattiva');
    n.tick();
    expect(n.missioni.stato('prologo')).toBe('attiva');
    expect(n.missioni.passiAttivi()).toEqual([{ missione: 'prologo', passo: 'sveglia', obiettivo: 'Esci dalla Cripta' }]);
    expect(n.taccuino.obiettivi()).toEqual([{ missione: 'prologo', passo: 'sveglia', testo: 'Esci dalla Cripta' }]);

    n.tick(); // nulla cambia
    f.luoghi.add('castagno_morto');
    expect(n.tick()).toBe(true);
    expect(n.missioni.statoPasso('prologo', 'sveglia')).toBe('completato');
    expect(n.missioni.statoPasso('prologo', 'ottavio')).toBe('attivo');

    n.dialoghi.avvia('ottavio_1');
    n.dialoghi.choose(0); // finisce il dialogo: la facciata fa subito un tick
    expect(n.missioni.statoPasso('prologo', 'ottavio')).toBe('completato');
    expect(n.flag.vero('conosce_ottavio')).toBe(true);
    expect(n.taccuino.domandeAperte().map((v) => v.id)).toEqual(['chi_marta']);
    // «notte» aspetta la sera
    expect(n.missioni.statoPasso('prologo', 'notte')).toBe('bloccato');
    f.oraCorrente = 18;
    n.tick();
    expect(n.missioni.statoPasso('prologo', 'notte')).toBe('attivo');
    f.luoghi.add('fienile');
    n.tick();
    expect(n.missioni.statoPasso('prologo', 'notte')).toBe('attivo'); // non è ancora notte
    f.oraCorrente = 22;
    n.tick();
    expect(n.missioni.stato('prologo')).toBe('completata');
    expect(n.missioni.stato('m1')).toBe('attiva');
    expect(n.missioni.passiAttivi()).toEqual([{ missione: 'm1', passo: 'campanile' }]);

    f.luoghi.add('san_vigilio');
    f.rilevate.add('terrazza');
    n.tick(); // cascata: due passi nello stesso tick
    expect(n.missioni.stato('m1')).toBe('completata');
    expect(n.inventario.quantita('marze')).toBe(1);
    expect(n.missioni.stato('secondaria')).toBe('inattiva'); // giorno 1
    f.giornoCorrente = 2;
    n.tick();
    expect(n.missioni.stato('secondaria')).toBe('attiva');
    expect(n.taccuino.obiettivi()).toEqual([]);

    expect(registro).toEqual([
      'missioneAvviata prologo',
      'passoAttivato prologo/sveglia',
      'passoCompletato prologo/sveglia',
      'passoAttivato prologo/ottavio',
      'passoCompletato prologo/ottavio',
      'passoAttivato prologo/notte',
      'passoCompletato prologo/notte',
      'missioneCompletata prologo',
      'tempo {"azione":"salta-a","ore":6,"origine":"missione prologo, passo notte"}',
      'missioneAvviata m1',
      'evento {"nome":"titoli_di_testa","argomenti":[],"origine":"missione prologo"}',
      'passoAttivato m1/campanile',
      'passoCompletato m1/campanile',
      'passoAttivato m1/rilievo',
      'passoCompletato m1/rilievo',
      'missioneCompletata m1',
      'missioneAvviata secondaria',
      'passoAttivato secondaria/cisterna',
    ]);
  });

  it("l'obiettivo può essere l'id di una voce del taccuino", () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        missioni: [{ id: 'm', titolo: 'M', passi: [{ id: 'p', obiettivo_taccuino: 'chi_marta', completa_quando: 'flag:x' }] }],
        taccuino: TACCUINO,
      },
      f,
    );
    n.tick();
    expect(n.taccuino.ha('chi_marta')).toBe(true);
    expect(n.taccuino.obiettivi()).toEqual([{ missione: 'm', passo: 'p', testo: 'Chi ha scritto la lettera di Marta?' }]);
  });

  it('missioniIniziali esplicite e avvio da effetto', () => {
    const f = new FattiFinti();
    const n = new Narrativa({ missioni: MISSIONI, dialoghi: DIALOGHI }, f, { missioniIniziali: [] });
    n.tick();
    expect(n.missioni.attive()).toEqual([]);
    n.applicaEffetti(['missione:m1 avvia']);
    expect(n.missioni.attive()).toEqual(['m1']);
    expect(n.missioni.avvia('m1')).toBe(false); // già attiva
    expect(n.missioni.avvia('inesistente')).toBe(false);
  });

  it('effetti di completamento forzato e fallimento', () => {
    const { n } = nuova();
    n.tick();
    const fallita = vi.fn();
    n.eventi.on('missioneFallita', fallita);
    n.applicaEffetti(['missione:m1 avvia', 'missione:m1 completa']);
    expect(n.missioni.stato('m1')).toBe('completata');
    expect(n.flag.vero('primo_rilievo')).toBe(false); // i passi saltati non applicano effetti
    n.applicaEffetti(['missione:prologo fallisci']);
    expect(n.missioni.stato('prologo')).toBe('fallita');
    expect(fallita).toHaveBeenCalledWith({ missione: 'prologo', titolo: 'La Cripta' });
    expect(n.taccuino.obiettivi()).toEqual([]);
  });

  it('completaPasso da codice', () => {
    const { n } = nuova();
    n.tick();
    expect(n.missioni.completaPasso('prologo', 'ottavio')).toBe(true); // era bloccato: si attiva e si completa
    expect(n.missioni.statoPasso('prologo', 'ottavio')).toBe('completato');
    expect(n.missioni.completaPasso('prologo', 'ottavio')).toBe(false);
    expect(n.missioni.completaPasso('prologo', 'nessuno')).toBe(false);
  });

  it('condizioni sui passi di altre missioni', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        missioni: [
          { id: 'a', titolo: 'A', passi: [{ id: 'uno', completa_quando: 'flag:x' }, { id: 'due', completa_quando: 'flag:y' }] },
          { id: 'b', titolo: 'B', avvia_quando: 'passo:a/uno completato', passi: [{ id: 'p', completa_quando: 'passo:a/due attivo' }] },
        ],
      },
      f,
    );
    n.tick();
    expect(n.missioni.stato('b')).toBe('inattiva');
    n.flag.set('x');
    n.tick();
    expect(n.missioni.stato('b')).toBe('completata');
  });

  it('ordine libero: i passi si attivano solo per condizione', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        missioni: [
          {
            id: 'l',
            titolo: 'Libera',
            ordine: 'libero',
            passi: [
              { id: 'a', completa_quando: 'flag:a' },
              { id: 'b', completa_quando: 'flag:b' },
              { id: 'c', attiva_quando: 'flag:c_visibile', completa_quando: 'flag:c' },
            ],
          },
        ],
      },
      f,
    );
    n.tick();
    expect(n.missioni.passiAttivi().map((p) => p.passo)).toEqual(['a', 'b']);
    n.flag.set('b');
    n.tick();
    expect(n.missioni.statoPasso('l', 'b')).toBe('completato');
    expect(n.missioni.statoPasso('l', 'a')).toBe('attivo');
    n.flag.set('c_visibile');
    n.flag.set('c');
    n.flag.set('a');
    n.tick();
    expect(n.missioni.stato('l')).toBe('completata');
  });

  it('un passo senza completa_quando non si completa da solo', () => {
    const f = new FattiFinti();
    const n = new Narrativa({ missioni: [{ id: 'm', titolo: 'M', passi: [{ id: 'p' }] }] }, f);
    n.tick();
    n.tick();
    expect(n.missioni.statoPasso('m', 'p')).toBe('attivo');
  });

  it('effetti di attivazione', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      { missioni: [{ id: 'm', titolo: 'M', passi: [{ id: 'p', effetti_attivazione: ['cielo:Brace fra un\'ora'], completa_quando: 'falso' }] }] },
      f,
    );
    n.tick();
    expect(n.taccuino.rigaCielo()).toBe("Brace fra un'ora");
  });

  it('esporta e importa lo stato, e i passi nuovi partono bloccati', () => {
    const { n, f } = nuova();
    n.tick();
    f.luoghi.add('castagno_morto');
    n.tick();
    const stato = n.missioni.esporta();
    expect(stato.inizializzate).toBe(true);
    expect(stato.missioni.prologo).toEqual({ stato: 'attiva', passi: { sveglia: 'completato', ottavio: 'attivo', notte: 'bloccato' } });

    const altra = nuova().n;
    altra.missioni.importa({
      ...stato,
      missioni: { ...stato.missioni, prologo: { stato: 'attiva', passi: { sveglia: 'completato', ottavio: 'attivo' } } },
    });
    expect(altra.missioni.statoPasso('prologo', 'notte')).toBe('bloccato');
    altra.tick(); // già inizializzate: il prologo non riparte
    expect(altra.missioni.statoPasso('prologo', 'ottavio')).toBe('attivo');
  });
});

describe('missioni da sole', () => {
  it('chiama valuta e applicaEffetti delle dipendenze', () => {
    const defs = normalizzaMissioni([
      { id: 'm', titolo: 'M', passi: [{ id: 'p', completa_quando: 'X', effetti: ['flag:y'] }], effetti: ['flag:fine'] },
    ]);
    const valuta = vi.fn((c: unknown) => c === 'X');
    const applicaEffetti = vi.fn();
    const m = new Missioni(defs, { valuta, applicaEffetti }, ['m']);
    expect(m.aggiorna()).toBe(true);
    expect(m.stato('m')).toBe('completata');
    expect(applicaEffetti.mock.calls).toEqual([
      [['flag:y'], 'missione m, passo p'],
      [['flag:fine'], 'missione m'],
    ]);
    expect(m.aggiorna()).toBe(false);
  });

  it('una missione senza passi si completa appena parte', () => {
    const m = new Missioni(normalizzaMissioni([{ id: 'vuota', titolo: 'V', passi: [] }]), { valuta: () => true, applicaEffetti: () => {} });
    m.avvia('vuota');
    expect(m.stato('vuota')).toBe('completata');
  });
});
