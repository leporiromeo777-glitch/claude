/**
 * Prove sul formato dei contenuti veri della Fase 1 (docs/design/FASE1.md §2):
 * si_apre, alla_fine, didascalie, contatori, passi con id unico, eventi e
 * aiuti dei passi, luoghi «raggiunti durante il passo», riga del cielo.
 */
import { describe, expect, it, vi } from 'vitest';
import { analizzaCondizione, stampaCondizione } from '../src/condizioni';
import { riempiSegnaposto } from '../src/contenuti';
import { analizzaEffetto } from '../src/effetti';
import { Narrativa } from '../src/narrativa';
import { verificaContenuti } from '../src/verifica';
import { FattiFinti } from './aiuti';

/** Fatti con «Elvira si trova in un luogo alla volta», come li darà il gioco. */
class FattiPosizione extends FattiFinti {
  posizione: string | null = null;
  override luogoRaggiunto(id: string): boolean {
    return this.posizione === id;
  }
}

const MISSIONI = [
  {
    id: 'prologo',
    titolo: 'Due secoli',
    tipo: 'prologo',
    passi: [
      {
        id: 'pr_vetro',
        obiettivo_taccuino: 'Chi ha scritto sul mio vetro?',
        attiva_quando: 'inizio',
        completa_quando: 'flag:guardato_vetro',
        effetti: ['taccuino:q_vetro'],
        luogo: 'cripta_capsula_5',
        effetti_attivazione: ['orologio:fermo 05:38', 'suggerimento:guarda'],
      },
      {
        id: 'pr_cripta',
        obiettivo_taccuino: 'Dove sono gli altri sei?',
        attiva_quando: 'passo:pr_vetro completato',
        completa_quando: 'flag:armadietto_aperto',
        effetti: [],
        eventi: [
          { quando: 'flag:esaminato:capsula_1', effetti: ['taccuino:i_capsula_1'] },
          { quando: 'luogo:cripta_scala raggiunto', effetti: ['flag:vista_scala'] },
        ],
        aiuti: [{ dopo_s: 20, effetti: ['evento:passero_vola_in_su', 'suono:campanaccio_dal_cielo'] }],
      },
      {
        id: 'pr_campane',
        obiettivo_taccuino: 'Le campane parlano.',
        attiva_quando: 'passo:pr_cripta completato',
        completa_quando: 'dialogo:d_meridiana_1 finito',
        effetti: ['missione:prologo completata', 'missione:m01'],
      },
    ],
  },
  {
    id: 'm01',
    titolo: 'Il castagno vuoto',
    tipo: 'principale',
    passi: [
      {
        id: 'm1_velati',
        obiettivo_taccuino: 'Che cosa sanno, quelli velati?',
        attiva_quando: 'inizio',
        completa_quando: 'contatore:velati>=2',
        effetti: [],
      },
      {
        id: 'm1_mattino',
        obiettivo_taccuino: 'Il mattino',
        attiva_quando: 'passo:m1_velati completato',
        completa_quando: 'ora:>=07:00',
        effetti: [],
      },
      // due passi paralleli dopo il mattino
      {
        id: 'm1_ritorno',
        obiettivo_taccuino: 'Tornare in paese.',
        attiva_quando: 'passo:m1_mattino completato',
        completa_quando: 'luogo:piazza_ore raggiunto',
        effetti: [],
      },
      {
        id: 'm1_dono',
        obiettivo_taccuino: 'Una novizia alla Bacheca.',
        attiva_quando: 'passo:m1_mattino completato',
        completa_quando: 'flag:dono e luogo:bacheca_ore raggiunto e luogo:sagrato raggiunto',
        effetti: ['germoglio:+1', 'missione:m01 completata', 'dormi:fino 05:30'],
      },
    ],
  },
];

const DIALOGHI = {
  d_meridiana_1: {
    personaggio: 'meridiana',
    si_apre: { come: 'automatico', condizione: 'passo:pr_cripta completato' },
    ripetibile: false,
    alla_fine: ['taccuino:q_indice'],
    nodi: [
      {
        id: 'n1',
        didascalia: 'Tre rintocchi da San Vigilio.',
        testo: 'Giardiniera cinque. Bentornata in servizio.',
        risposte: [{ testo: '…', vai_a: 'fine' }],
      },
    ],
  },
  d_togna: {
    personaggio: 'togna',
    si_apre: { come: 'parlando', con: 'togna' },
    ripetibile: false,
    alla_fine: ['contatore:velati+1', 'flag:parlato_togna'],
    nodi: [{ id: 'n1', testo: 'Ciao.', risposte: [{ testo: 'Ciao.', vai_a: 'fine' }] }],
  },
  d_bambini: {
    personaggio: 'bambini',
    si_apre: { come: 'parlando', con: 'bambini' },
    ripetibile: false,
    alla_fine: ['contatore:velati+1'],
    nodi: [
      { id: 'n1', chi: 'lisa', testo: 'Sei tu la Svegliata?', risposte: [{ testo: 'Sì.', vai_a: 'n2' }] },
      { id: 'n2', chi: 'gioanin', testo: 'Allora prendi la maschera!', risposte: [{ testo: '…', vai_a: 'fine' }] },
    ],
  },
  d_meridiana_campanile: {
    personaggio: 'meridiana',
    si_apre: { come: 'interagendo', con: 'altoparlante_cella', condizione: 'luogo:cella_campanaria raggiunto' },
    ripetibile: true,
    alla_fine: [],
    nodi: [{ id: 'n1', testo: 'Registro.', risposte: [{ testo: '…', vai_a: 'fine' }] }],
  },
  d_pina_figura: {
    personaggio: 'pina',
    si_apre: { come: 'effetto', condizione: 'flag:figura_presa' },
    ripetibile: false,
    alla_fine: ['flag:figura_toccata'],
    nodi: [{ id: 'n1', didascalia: 'Pina ti toglie la figura dalle dita.', testo: '', risposte: [{ testo: '…', vai_a: 'fine' }] }],
  },
  d_clelia_dono: {
    personaggio: 'clelia',
    si_apre: { come: 'automatico', condizione: 'giorno:>=2 e luogo:bacheca_ore raggiunto' },
    ripetibile: false,
    alla_fine: ['flag:dono', 'variante:E1=Abitata', 'testo:biglietto_madre'],
    nodi: [{ id: 'n1', testo: 'Per te.', risposte: [{ testo: 'Grazie.', vai_a: 'fine' }] }],
  },
};

const TACCUINO = {
  _nota: 'prova',
  riga_del_cielo: [
    { id: 'rc_meta', testo: 'Meta fra {secondi} s', priorita: 1, quando: 'flag:prima_meta_vista' },
    { id: 'rc_brace', testo: 'Brace alle 19:30', priorita: 2, quando: 'flag:ottavio_conosciuto e ora:>=12:00 e ora:<19:30' },
    { id: 'rc_alba', testo: 'Alba alle 05:30', priorita: 2, quando: 'ora:>=21:00 o ora:<05:30' },
  ],
  domande: [
    { id: 'q_vetro', mano: 'tecnica', testo: 'Chi ha scritto sul mio vetro?', indizi: ['i_capsula_1'], chiusa_quando: null },
    { id: 'q_indice', mano: 'tecnica', testo: 'Che cosa sta morendo?', indizi: [], chiusa_quando: 'flag:legge_1' },
  ],
  indizi: [{ id: 'i_capsula_1', mano: 'tecnica', testo: 'N. 1: vuota.', fonte: 'Cripta', domanda: 'q_vetro' }],
  note: [{ id: 'n_fiore', mano: 'madre', testo: 'Avrà dimenticato.', sotto: 'q_vetro' }],
  parole: [
    { id: 'w_fade_dubbio', tecnica: '?', locale: 'le Fade?', nota: 'Chi?' },
    { id: 'w_fade', tecnica: 'macchine di manutenzione', locale: 'le Fade', sostituisce: 'w_fade_dubbio', nota: 'Di notte.' },
  ],
  proverbi: [{ id: 'pv_misura', dialetto: 'Quel che la Giardinéra la mesüra…', italiano: 'Ciò che la Giardiniera ha misurato…', fonte: 'Togna' }],
  leggende: [{ id: 'lg_partenza_1', testo: '«…e la Svegliata prese la maschera.»', fonte: "L'Ombrista", testo_completo: 'testi.leggende.partenza_1' }],
};

function nuova(): { n: Narrativa; f: FattiPosizione } {
  const f = new FattiPosizione();
  f.oraCorrente = 5.6;
  const n = new Narrativa({ missioni: MISSIONI, dialoghi: DIALOGHI, taccuino: TACCUINO }, f);
  return { n, f };
}

describe('forme dei contenuti veri: condizioni ed effetti', () => {
  it('condizioni: passo con il solo id, contatori, varianti, inizio, flag con «:», ore HH:MM', () => {
    expect(stampaCondizione(analizzaCondizione('passo:m1_velati completato'))).toBe('passo:m1_velati completato');
    expect(stampaCondizione(analizzaCondizione('contatore:velati>=3'))).toBe('flag:velati>=3');
    expect(stampaCondizione(analizzaCondizione('variante:E1=Abitata'))).toBe('cella:E1 abitata');
    expect(analizzaCondizione('inizio')).toEqual({ tipo: 'costante', valore: true });
    expect(stampaCondizione(analizzaCondizione('flag:esaminato:capsula_1'))).toBe('flag:esaminato:capsula_1');
    expect(analizzaCondizione('ora:>=08:30')).toEqual({ tipo: 'atomo', atomo: { k: 'ora', confronto: { tipo: 'op', op: '>=', valore: 8.5 } } });
    expect(() => analizzaCondizione('variante:E1')).toThrow(/variante:elemento=Variante/);
  });

  it('effetti: contatori, richieste al gioco, germogli, dormi, missione completata', () => {
    expect(analizzaEffetto('contatore:velati+1')).toEqual({ tipo: 'flag-somma', nome: 'velati', delta: 1 });
    expect(analizzaEffetto('contatore:velati-2')).toEqual({ tipo: 'flag-somma', nome: 'velati', delta: -2 });
    expect(analizzaEffetto('contatore:velati=0')).toEqual({ tipo: 'flag', nome: 'velati', valore: 0 });
    expect(analizzaEffetto('contatore:velati')).toEqual({ tipo: 'flag-somma', nome: 'velati', delta: 1 });
    expect(analizzaEffetto('flag:lente:corteccia')).toEqual({ tipo: 'flag', nome: 'lente:corteccia', valore: true });
    expect(analizzaEffetto('testo:lettera_marta')).toEqual({ tipo: 'evento', nome: 'testo', argomenti: ['lettera_marta'] });
    expect(analizzaEffetto('suggerimento:guarda')).toEqual({ tipo: 'evento', nome: 'suggerimento', argomenti: ['guarda'] });
    expect(analizzaEffetto('variante:E1=Abitata')).toEqual({ tipo: 'evento', nome: 'variante', argomenti: ['E1', 'Abitata'] });
    expect(analizzaEffetto('orologio:fermo 05:38')).toEqual({ tipo: 'evento', nome: 'orologio', argomenti: ['fermo', '05:38'] });
    expect(analizzaEffetto('orologio:libero')).toEqual({ tipo: 'evento', nome: 'orologio', argomenti: ['libero'] });
    expect(analizzaEffetto('npc:ottavio->accompagna:fienile_ottavio')).toEqual({
      tipo: 'evento',
      nome: 'npc',
      argomenti: ['ottavio->accompagna:fienile_ottavio'],
    });
    for (const p of ['musica:primo_sguardo', 'suono:tre_rintocchi', 'battuta:elvira_oh', 'pianta:resoconto']) {
      expect(analizzaEffetto(p).tipo).toBe('evento');
    }
    expect(analizzaEffetto('germoglio:+1')).toEqual({ tipo: 'oggetto', id: 'germoglio', delta: 1 });
    expect(analizzaEffetto('dormi:fino 05:30')).toEqual({ tipo: 'tempo', azione: 'salta-a', ore: 5.5 });
    expect(analizzaEffetto('missione:prologo completata')).toEqual({ tipo: 'missione', id: 'prologo', azione: 'completa' });
    expect(() => analizzaEffetto('dormi:05:30')).toThrow(/dormi:fino/);
    expect(() => analizzaEffetto('variante:E1')).toThrow(/variante:elemento=Variante/);
    expect(() => analizzaEffetto('musica:')).toThrow(/manca l'argomento/);
  });
});

describe('forme dei contenuti veri: partita', () => {
  it('passi a «inizio», effetti d’attivazione, eventi e aiuti a tempo', () => {
    const { n, f } = nuova();
    expect(n.problemi).toEqual([]);
    const eventi: string[] = [];
    n.eventi.on('evento', ({ nome, argomenti }) => eventi.push([nome, ...argomenti].join(' ')));
    const attivati: unknown[] = [];
    n.eventi.on('passoAttivato', (p) => attivati.push(p));
    n.tick();
    expect(attivati[0]).toEqual({
      missione: 'prologo',
      passo: 'pr_vetro',
      obiettivo: 'Chi ha scritto sul mio vetro?',
      luogo: 'cripta_capsula_5',
    });
    expect(eventi).toEqual(['orologio fermo 05:38', 'suggerimento guarda']);
    n.flag.set('guardato_vetro');
    n.tick();
    expect(n.missioni.statoPasso(undefined, 'pr_cripta')).toBe('attivo');
    // evento del passo: una volta sola
    n.flag.set('esaminato:capsula_1');
    n.tick();
    n.tick();
    expect(n.taccuino.ha('i_capsula_1')).toBe(true);
    // evento con un luogo: Elvira passa sulla scala e se ne va
    f.posizione = 'cripta_scala';
    n.tick();
    f.posizione = 'cripta_sala';
    n.tick();
    expect(n.flag.vero('vista_scala')).toBe(true);
    // aiuto a tempo: 20 s di passo attivo
    n.tick(15);
    expect(eventi).not.toContain('passero_vola_in_su');
    n.tick(6);
    n.tick(30);
    expect(eventi.filter((e) => e === 'passero_vola_in_su')).toHaveLength(1);
    expect(eventi).toContain('suono campanaccio_dal_cielo');
    // lo stato di eventi e aiuti si salva
    const stato = n.esporta();
    expect(stato.missioni.missioni.prologo!.eventi).toEqual({ pr_cripta: [0, 1] });
    expect(stato.missioni.missioni.prologo!.aiuti).toEqual({ pr_cripta: [0] });
    const { n: m } = nuova();
    m.importa(stato);
    m.tick(100);
    expect(m.esporta().missioni).toEqual(stato.missioni);
  });

  it('dialoghi automatici: annunciati una volta, solo a dialogo chiuso, di nuovo se interrotti', () => {
    const { n } = nuova();
    const annunci: unknown[] = [];
    n.eventi.on('apriDialogo', (a) => annunci.push(a));
    n.tick();
    n.flag.set('guardato_vetro');
    n.flag.set('armadietto_aperto');
    n.dialoghi.avvia('d_togna'); // un altro dialogo aperto: l'automatico aspetta
    n.tick();
    expect(annunci).toEqual([]);
    n.dialoghi.interrompi();
    n.tick();
    n.tick();
    expect(annunci).toEqual([{ dialogo: 'd_meridiana_1', automatico: true }]);
    const nodo = n.dialoghi.avvia('d_meridiana_1');
    expect(nodo).toMatchObject({ didascalia: 'Tre rintocchi da San Vigilio.', testo: 'Giardiniera cinque. Bentornata in servizio.' });
    n.dialoghi.interrompi();
    n.tick();
    expect(annunci).toHaveLength(2); // interrotto: si riannuncia
    n.dialoghi.avvia('d_meridiana_1');
    n.dialoghi.choose(0);
    expect(n.taccuino.ha('q_indice')).toBe(true); // alla_fine
    expect(n.missioni.stato('prologo')).toBe('completata');
    expect(n.missioni.stato('m01')).toBe('attiva');
    n.tick();
    expect(annunci).toHaveLength(2);
  });

  it('parlando con, interagendo con, effetto; alla_fine con i contatori', () => {
    const { n, f } = nuova();
    expect(n.dialoghi.perPersonaggio('togna')).toBe('d_togna');
    expect(n.dialoghi.perPersonaggio('pina')).toBeNull(); // «effetto»: non si apre parlando
    expect(n.interagisci('altoparlante_cella')).toBeNull(); // condizione falsa
    f.posizione = 'cella_campanaria';
    expect(n.interagisci('altoparlante_cella')?.testo).toBe('Registro.');
    n.dialoghi.choose(0);
    expect(n.interagisci('altoparlante_cella')).not.toBeNull(); // ripetibile
    n.dialoghi.interrompi();
    const annunci: string[] = [];
    n.eventi.on('apriDialogo', ({ dialogo }) => annunci.push(dialogo));
    n.flag.set('figura_presa');
    n.tick();
    expect(annunci).toContain('d_pina_figura');
    expect(n.dialoghi.avvia('d_pina_figura')).toMatchObject({ testo: '', didascalia: 'Pina ti toglie la figura dalle dita.' });
    // contatore:velati+1 nei loro alla_fine
    n.parla('togna');
    n.dialoghi.choose(0);
    const b = n.parla('bambini');
    expect(b?.chi).toBe('lisa');
    expect(n.dialoghi.choose(0)?.chi).toBe('gioanin');
    n.dialoghi.choose(0);
    expect(n.flag.get('velati')).toBe(2);
    expect(n.parla('togna')).toBeNull(); // non ripetibile
  });

  it('luoghi: «raggiunto» vale durante il passo, non prima', () => {
    const { n, f } = nuova();
    n.tick();
    // prologo veloce
    n.missioni.completa('prologo');
    n.applicaEffetti(['missione:m01']);
    f.posizione = 'piazza_ore'; // in piazza durante m1_velati: per m1_ritorno non conta
    n.flag.set('velati', 2);
    n.tick();
    f.posizione = 'fienile_ottavio';
    f.oraCorrente = 7;
    n.tick();
    expect(n.missioni.statoPasso('m01', 'm1_ritorno')).toBe('attivo');
    expect(n.missioni.statoPasso('m01', 'm1_dono')).toBe('attivo'); // passi paralleli
    f.posizione = 'piazza_ore';
    n.tick();
    expect(n.missioni.statoPasso('m01', 'm1_ritorno')).toBe('completato');
    // m1_dono vuole due luoghi: basta esserci passati durante il passo
    f.posizione = 'sagrato';
    n.tick();
    f.giornoCorrente = 2;
    f.posizione = 'bacheca_ore';
    n.tick(); // annuncia d_clelia_dono
    n.dialoghi.avvia('d_clelia_dono');
    const ev: string[] = [];
    n.eventi.on('evento', ({ nome, argomenti }) => ev.push([nome, ...argomenti].join(' ')));
    const tempo = vi.fn();
    n.eventi.on('tempo', tempo);
    n.dialoghi.choose(0);
    expect(ev).toEqual(['variante E1 Abitata', 'testo biglietto_madre']);
    expect(n.missioni.stato('m01')).toBe('completata');
    expect(n.inventario.quantita('germoglio')).toBe(1);
    expect(tempo).toHaveBeenCalledWith(expect.objectContaining({ azione: 'salta-a', ore: 5.5 }));
  });

  it('segnalaLuogo: le visite brevi fra due tick contano; e si salvano', () => {
    const { n, f } = nuova();
    n.tick();
    n.missioni.completa('prologo');
    n.applicaEffetti(['missione:m01']);
    n.flag.set('velati', 2);
    f.oraCorrente = 7;
    n.tick();
    n.segnalaLuogo('sagrato'); // c'è passata senza che un tick la vedesse
    const stato = JSON.parse(JSON.stringify(n.esporta())) as ReturnType<Narrativa['esporta']>;
    expect(stato.luoghiPasso?.['m01/m1_dono']).toEqual(['sagrato']);
    const { n: m, f: g } = nuova();
    m.importa(stato);
    m.flag.set('dono');
    g.posizione = 'bacheca_ore';
    g.oraCorrente = 7;
    m.tick();
    expect(m.missioni.statoPasso('m01', 'm1_dono')).toBe('completato');
    expect(m.esporta().luoghiPasso?.['m01/m1_dono']).toBeUndefined(); // dimenticati a passo completato
  });

  it('taccuino raggruppato: note, proverbi, leggende, parole che sostituiscono, chiusa_quando null', () => {
    const { n } = nuova();
    n.applicaEffetti(['taccuino:q_vetro', 'taccuino:n_fiore', 'taccuino:pv_misura', 'taccuino:lg_partenza_1', 'taccuino:w_fade_dubbio']);
    n.tick();
    expect(n.taccuino.domandeAperte().map((v) => v.id)).toEqual(['q_vetro']); // chiusa_quando null: resta aperta
    expect(n.taccuino.voce('n_fiore')).toMatchObject({ tipo: 'nota', mano: 'madre', sotto: 'q_vetro' });
    expect(n.taccuino.voce('pv_misura')).toMatchObject({ tipo: 'proverbio', testo: 'Quel che la Giardinéra la mesüra…', italiano: 'Ciò che la Giardiniera ha misurato…' });
    expect(n.taccuino.voce('lg_partenza_1')).toMatchObject({ tipo: 'leggenda', fonte: "L'Ombrista" });
    expect(n.taccuino.voce('q_vetro')?.indizi).toEqual(['i_capsula_1']);
    n.applicaEffetti(['taccuino:w_fade']);
    expect(n.taccuino.parole().map((v) => [v.id, v.barrata])).toEqual([['w_fade', true]]);
    // chiusa_quando: si chiude da sola
    n.applicaEffetti(['taccuino:q_indice', 'flag:legge_1']);
    expect(n.taccuino.domandeChiuse().map((v) => v.id)).toEqual(['q_indice']);
  });

  it('riga del cielo: vince la candidata vera con priorità più alta; segnaposto', () => {
    const { n, f } = nuova();
    f.oraCorrente = 10;
    n.tick();
    expect(n.taccuino.rigaCielo()).toBeNull();
    n.flag.set('prima_meta_vista');
    n.tick();
    expect(n.taccuino.rigaCielo()).toBe('Meta fra {secondi} s');
    expect(n.taccuino.rigaCieloId()).toBe('rc_meta');
    expect(riempiSegnaposto(n.taccuino.rigaCielo()!, { secondi: 37 })).toBe('Meta fra 37 s');
    n.flag.set('ottavio_conosciuto');
    f.oraCorrente = 13;
    n.tick();
    expect(n.taccuino.rigaCielo()).toBe('Brace alle 19:30');
    f.oraCorrente = 22;
    n.tick();
    expect(n.taccuino.rigaCielo()).toBe('Alba alle 05:30');
    n.applicaEffetti(['cielo:Stanotte la Madre muove un caposaldo']);
    expect(n.taccuino.rigaCielo()).toBe('Stanotte la Madre muove un caposaldo');
    expect(n.taccuino.rigaCieloId()).toBeNull();
  });

  it('la verifica percorre tutto con questi contenuti', () => {
    const r = verificaContenuti({ missioni: MISSIONI, dialoghi: DIALOGHI, taccuino: TACCUINO });
    expect(r.errori).toEqual([]);
    expect(r.simulazione.map((s) => s.esito)).toEqual(['completata', 'completata']);
    expect(r.flagDelGioco.map((x) => x.nome)).toEqual([
      'armadietto_aperto',
      'esaminato:capsula_1',
      'figura_presa',
      'guardato_vetro',
      'legge_1',
      'ottavio_conosciuto',
      'prima_meta_vista',
    ]);
    expect(r.flagSoloScritti.map((x) => x.nome)).toEqual(['figura_toccata', 'parlato_togna', 'vista_scala']);
    expect(r.dialoghiNonGiocati).toEqual(['d_meridiana_campanile', 'd_pina_figura']);
    const traccia = r.traccia.join('\n');
    expect(traccia).toContain('va al luogo sagrato');
    expect(traccia).toContain('va al luogo bacheca_ore');
  });
});
