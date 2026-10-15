import { describe, expect, it, vi } from 'vitest';
import { normalizzaContenuti, normalizzaMissioni } from '../src/contenuti';
import { Narrativa, missioniOrfane } from '../src/narrativa';
import { FattiFinti } from './aiuti';

describe('facciata Narrativa', () => {
  it('collega i fatti del mondo alle condizioni', () => {
    const f = new FattiFinti();
    const n = new Narrativa({}, f);
    f.rilevate.add('c1');
    f.viste.add('c2');
    f.varianti.set('p1', 'mietuta');
    f.oggetti.set('lume', 2);
    n.inventario.aggiungi('lume');
    expect(n.valuta('cella:c1 rilevata')).toBe(true);
    expect(n.valuta('cella:c1 vista')).toBe(true);
    expect(n.valuta('cella:c2 vista')).toBe(true);
    expect(n.valuta('cella:c2 rilevata')).toBe(false);
    expect(n.valuta('cella:c3 bianca')).toBe(true);
    expect(n.valuta('cella:c2 bianca')).toBe(false);
    expect(n.valuta('particella:p1 mietuta')).toBe(true);
    expect(n.valuta('particella:p1 carta')).toBe(false);
    f.varianti.set('E1', 'Abitata'); // come in fade_fase1.json, con la maiuscola
    expect(n.valuta('particella:E1 abitata')).toBe(true);
    expect(n.valuta('cella:2599 colore')).toBe(false);
    expect(n.valuta('oggetto:lume>=3')).toBe(true);
    expect(n.valuta('oggetto:lume>=4')).toBe(false);
  });

  it('notte predefinita dalle 21 alle 5:30 (GDD) se il gioco non la fornisce', () => {
    const f = new FattiFinti();
    const n = new Narrativa({}, f);
    f.oraCorrente = 20.9;
    expect(n.valuta('notte')).toBe(false);
    f.oraCorrente = 21;
    expect(n.valuta('notte')).toBe(true);
    f.oraCorrente = 5.4;
    expect(n.valuta('notte')).toBe(true);
    f.oraCorrente = 5.5;
    expect(n.valuta('giorno')).toBe(true);
    const m = new Narrativa({}, f, { notte: { inizio: 1, fine: 4 } });
    f.oraCorrente = 2;
    expect(m.valuta('notte')).toBe(true);
    f.oraCorrente = 23;
    expect(m.valuta('notte')).toBe(false);
    const fattiConNotte = Object.assign(new FattiFinti(), { notte: () => true });
    expect(new Narrativa({}, fattiConNotte).valuta('notte')).toBe(true);
  });

  it('prefissi aggiuntivi valutati dal gioco', () => {
    const f = Object.assign(new FattiFinti(), {
      predicato: (p: string, a: string, q?: string) => p === 'fada' && a === 'prato' && q === 'vista',
    });
    const n = new Narrativa({}, f, { parser: { prefissiExtra: ['fada'] } });
    expect(n.valuta('fada:prato vista')).toBe(true);
    expect(n.valuta('fada:prato')).toBe(false);
  });

  it('raccoglie i problemi dei contenuti invece di fermarsi', () => {
    const f = new FattiFinti();
    const errori = vi.fn();
    const n = new Narrativa(
      {
        missioni: [
          {
            id: 'm',
            titolo: 'M',
            passi: [{ id: 'p', completa_quando: 'luogo:x raggiunto e', effetti: ['pippo:1', 'missione:fantasma avvia'] }],
          },
        ],
        dialoghi: { d: { personaggio: 'x', nodi: [{ id: 'a', testo: '', risposte: [{ testo: 't', condizione: 'boh', vai_a: 'fine' }] }] } },
      },
      f,
    );
    n.eventi.on('errore', errori);
    expect(n.problemi).toHaveLength(3);
    expect(n.problemi[0]).toMatch(/missione m, passo p: .*incompleta/);
    expect(n.problemi[1]).toMatch(/prefisso sconosciuto «pippo:»/);
    expect(n.problemi[2]).toMatch(/dialogo d, nodo a: .*termine sconosciuto/);
    // a runtime: la condizione malformata vale false e non viene segnalata due volte
    n.tick();
    n.tick();
    expect(n.missioni.statoPasso('m', 'p')).toBe('attivo');
    expect(n.dialoghi.avvia('d')?.risposte).toEqual([]);
    n.applicaEffetti(['missione:fantasma avvia', 'taccuino:fantasma', 'oggetto:-fantasma', 'dialogo:fantasma']);
    expect(errori.mock.calls.map((c) => (c[0] as { messaggio: string }).messaggio)).toEqual([
      expect.stringMatching(/Missione inesistente/),
      expect.stringMatching(/Voce del taccuino inesistente/),
      expect.stringMatching(/Non ci sono 1/),
      expect.stringMatching(/Dialogo inesistente/),
    ]);
  });

  it('gli errori del gioco (WorldFacts) non vengono scambiati per errori dei contenuti', () => {
    const f = Object.assign(new FattiFinti(), {
      luogoRaggiunto: (): boolean => {
        throw new Error('bug del motore');
      },
    });
    const n = new Narrativa({}, f);
    expect(() => n.valuta('luogo:x raggiunto')).toThrow('bug del motore');
    expect(n.problemi).toEqual([]);
  });

  it('in modo rigoroso lancia subito', () => {
    expect(
      () =>
        new Narrativa(
          { missioni: [{ id: 'm', titolo: 'M', passi: [{ id: 'p', completa_quando: '(flag:a' }] }] },
          new FattiFinti(),
          { rigoroso: true },
        ),
    ).toThrow(/mai chiusa/);
    const n = new Narrativa({}, new FattiFinti(), { rigoroso: true });
    expect(() => n.valuta('flag:')).toThrow();
    expect(() => n.applicaEffetto('niente')).toThrow();
  });

  it('effetti: flag, taccuino, cielo, oggetti, eventi, tempo, dialoghi', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        taccuino: [
          { id: 'd', tipo: 'domanda', testo: 'D?' },
          { id: 'w', tipo: 'parola', tecnica: 'Meta', locale: 'Sole' },
        ],
        dialoghi: { o: { personaggio: 'o', nodi: [{ id: 'a', testo: 'x' }] } },
      },
      f,
    );
    const ev = { evento: vi.fn(), tempo: vi.fn(), apriDialogo: vi.fn(), flag: vi.fn(), oggetto: vi.fn(), taccuino: vi.fn(), rigaCielo: vi.fn() };
    for (const [k, fn] of Object.entries(ev)) n.eventi.on(k as keyof typeof ev, fn);
    n.applicaEffetti(
      [
        'flag:a',
        'flag:n=2',
        'flag:n+=3',
        'flag:s=nero',
        '!flag:a',
        'taccuino:d',
        'taccuino:d chiudi',
        'taccuino:w barra',
        'cielo:Stanotte la Pesarina',
        'oggetto:+lume*2',
        'oggetto:-lume',
        'evento:campane tre',
        'tempo:salta-a 6',
        'tempo:avanza 1:30',
        'dialogo:o avvia',
      ],
      'prova',
    );
    expect(n.flag.tutti()).toEqual({ n: 5, s: 'nero' });
    expect(n.taccuino.domandeChiuse().map((v) => v.id)).toEqual(['d']);
    expect(n.taccuino.parole()[0]!.barrata).toBe(true);
    expect(n.taccuino.rigaCielo()).toBe('Stanotte la Pesarina');
    expect(n.inventario.quantita('lume')).toBe(1);
    expect(ev.evento).toHaveBeenCalledWith({ nome: 'campane', argomenti: ['tre'], origine: 'prova' });
    expect(ev.tempo.mock.calls).toEqual([
      [{ azione: 'salta-a', ore: 6, origine: 'prova' }],
      [{ azione: 'avanza', ore: 1.5, origine: 'prova' }],
    ]);
    expect(ev.apriDialogo).toHaveBeenCalledWith({ dialogo: 'o', origine: 'prova' });
    expect(ev.flag).toHaveBeenCalledTimes(5);
    expect(ev.oggetto).toHaveBeenCalledTimes(2);
    expect(ev.taccuino).toHaveBeenCalledTimes(3); // aggiunta d, chiusa d, aggiunta w (le parole nascono barrate)
    expect(ev.rigaCielo).toHaveBeenCalledTimes(1);
    n.applicaEffetti(['cielo:']);
    expect(n.taccuino.rigaCielo()).toBeNull();
  });

  it('le voci automatiche del taccuino e le missioni si sbloccano a vicenda nello stesso tick', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        missioni: [
          { id: 'a', titolo: 'A', passi: [{ id: 'p', completa_quando: 'taccuino:indizio', effetti: ['flag:fatto'] }] },
        ],
        taccuino: [{ id: 'indizio', tipo: 'indizio', testo: 'Un indizio', fonte: 'Rosa', sblocca_quando: 'luogo:pontile raggiunto' }],
      },
      f,
    );
    n.tick();
    f.luoghi.add('pontile');
    expect(n.tick()).toBe(true);
    expect(n.flag.vero('fatto')).toBe(true);
    expect(n.missioni.stato('a')).toBe('completata');
  });

  it('un tick chiamato da un ascoltatore durante un tick non rompe la cascata', () => {
    const f = new FattiFinti();
    const n = new Narrativa(
      {
        missioni: [
          { id: 'a', titolo: 'A', passi: [{ id: 'p', completa_quando: 'flag:x' }, { id: 'q', completa_quando: 'flag:y' }] },
        ],
      },
      f,
    );
    n.eventi.on('passoCompletato', ({ passo }) => {
      if (passo === 'p') {
        n.flag.set('y');
        n.tick();
      }
    });
    n.flag.set('x');
    n.tick();
    expect(n.missioni.stato('a')).toBe('completata');
  });

  it('esporta e importa uno stato completo', () => {
    const f = new FattiFinti();
    const n = new Narrativa({ missioni: [{ id: 'a', titolo: 'A', passi: [{ id: 'p', completa_quando: 'flag:x' }] }] }, f);
    n.tick();
    n.flag.set('k', 7);
    n.inventario.aggiungi('squadro');
    n.applicaEffetti(['taccuino:nota_libera']);
    const stato = JSON.parse(JSON.stringify(n.esporta())) as ReturnType<Narrativa['esporta']>;
    const m = new Narrativa({ missioni: [{ id: 'a', titolo: 'A', passi: [{ id: 'p', completa_quando: 'flag:x' }] }] }, f);
    const eventi = vi.fn();
    m.eventi.onQualsiasi(eventi);
    m.importa(stato);
    expect(eventi).not.toHaveBeenCalled();
    expect(m.esporta()).toEqual(n.esporta());
    m.importa({} as ReturnType<Narrativa['esporta']>); // stato vuoto: tutto azzerato
    expect(m.flag.tutti()).toEqual({});
    expect(m.missioni.stato('a')).toBe('inattiva');
  });

  it('riga del cielo: quella del gioco a ogni tick, quella dei contenuti ha la precedenza', () => {
    let prossimo: string | null = 'La Meta passa fra 20 secondi';
    const f = Object.assign(new FattiFinti(), { prossimoEventoCielo: () => prossimo });
    const n = new Narrativa({}, f);
    const righe: (string | null)[] = [];
    n.eventi.on('rigaCielo', ({ testo }) => righe.push(testo));
    n.tick();
    expect(n.taccuino.rigaCielo()).toBe('La Meta passa fra 20 secondi');
    n.applicaEffetti(['cielo:Stanotte la Madre muove un caposaldo']);
    prossimo = 'Brace della Linea fra due ore';
    n.tick();
    expect(n.taccuino.rigaCielo()).toBe('Stanotte la Madre muove un caposaldo');
    n.applicaEffetti(['cielo:']);
    expect(n.taccuino.rigaCielo()).toBe('Brace della Linea fra due ore');
    expect(righe).toEqual([
      'La Meta passa fra 20 secondi',
      'Stanotte la Madre muove un caposaldo',
      'Brace della Linea fra due ore',
    ]);
    expect(n.esporta().taccuino.rigaCielo).toBeNull(); // quella del gioco non si salva
  });

  it('accetta contenuti già normalizzati', () => {
    const c = normalizzaContenuti({ missioni: [{ id: 'a', titolo: 'A', passi: [] }] });
    const n = new Narrativa(c, new FattiFinti());
    expect(n.contenuti).toBe(c);
  });
});

describe('normalizzazione delle missioni', () => {
  it('accetta mappe per id, nomi di campo alternativi e segnala le stranezze', () => {
    const avvisi: string[] = [];
    const m = normalizzaMissioni(
      {
        $schema: 'ignorato',
        m1: {
          nome: 'Uno',
          attiva_quando: 'flag:via',
          passi: [{ obiettivo: 'Fai', condizione: 'flag:a', effetto: 'flag:b' }, { id: 'p2' }],
          effetti_finali: ['flag:fine'],
        },
        m2: { titolo: 'Due', passi: [] },
        m3: 'non un oggetto',
      },
      avvisi,
    );
    expect(m.map((x) => x.id)).toEqual(['m1', 'm2']);
    expect(m[0]).toMatchObject({
      titolo: 'Uno',
      avviaQuando: 'flag:via',
      effetti: ['flag:fine'],
      passi: [
        { id: 'passo1', obiettivo: 'Fai', completaQuando: 'flag:a', effetti: ['flag:b'] },
        { id: 'p2', effetti: [] },
      ],
    });
    expect(avvisi).toEqual([
      'missioni: «m3» non è un oggetto',
      'missione «m1»: il passo 1 non ha id (uso «passo1»)',
      'missione «m2»: nessun passo',
    ]);
  });

  it('missioniOrfane: senza avvio e mai avviate da un effetto', () => {
    const c = normalizzaContenuti({
      missioni: [
        { id: 'a', titolo: 'A', passi: [{ id: 'p', completa_quando: 'flag:x', effetti: ['missione:b avvia'] }] },
        { id: 'b', titolo: 'B', passi: [] },
        { id: 'c', titolo: 'C', avvia_quando: 'flag:c', passi: [] },
        { id: 'd', titolo: 'D', passi: [] },
      ],
      dialoghi: { x: { personaggio: 'p', nodi: [{ id: 'n', testo: '', risposte: [{ testo: '', effetti: ['missione:d'] }] }] } },
    });
    expect(missioniOrfane(c)).toEqual(['a']);
  });
});
