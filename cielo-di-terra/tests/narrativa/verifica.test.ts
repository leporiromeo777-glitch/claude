import { describe, expect, it } from 'vitest';
import { verificaContenuti } from '../../src/narrativa/verifica';

/** Contenuti in piccolo, sul modello della Fase 1: prologo e missione 1. */
function contenutiBuoni(): {
  missioni: unknown[];
  dialoghi: Record<string, unknown>;
  taccuino: unknown[];
  luoghi: unknown[];
  personaggi: unknown[];
} {
  return {
    missioni: [
      {
        id: 'prologo',
        titolo: 'La Cripta dei Giardinieri',
        passi: [
          {
            id: 'esci',
            obiettivo_taccuino: 'Esci dalla Cripta',
            completa_quando: 'luogo:castagno_morto raggiunto',
            effetti: ['taccuino:chi_marta'],
          },
          {
            id: 'ottavio',
            obiettivo_taccuino: 'Chiedi un riparo per la notte',
            completa_quando: 'dialogo:ottavio_fienile finito e flag:sa_fienile',
          },
          {
            id: 'dormi',
            obiettivo_taccuino: 'Dormi nel fienile',
            attiva_quando: 'ora:>=18 o notte',
            completa_quando: ['luogo:fienile raggiunto', 'notte'],
            effetti: ['tempo:salta-a 6', 'flag:prima_notte'],
          },
        ],
        effetti: ['missione:m1 avvia'],
      },
      {
        id: 'm1',
        titolo: 'Il castagno vuoto',
        passi: [
          {
            id: 'sentiero',
            obiettivo_taccuino: 'Il sentiero è sparito?',
            completa_quando: 'flag:prima_notte e giorno:>=2 e luogo:sentiero_fienile raggiunto',
          },
          { id: 'campanile', obiettivo_taccuino: 'Sali sul campanile', completa_quando: 'luogo:campanile_san_vigilio raggiunto' },
          {
            id: 'rilievo',
            obiettivo_taccuino: 'Collima il Pilastro 1',
            completa_quando: 'cella:terrazza_innesto rilevata e (flag:fiducia_ottavio>=1 o oggetto:velo)',
            effetti: ['taccuino:prima_legge', 'evento:matita_colore terrazza_innesto'],
          },
        ],
      },
    ],
    dialoghi: {
      ottavio_fienile: {
        personaggio: 'ottavio',
        nodi: [
          {
            id: 'inizio',
            testo: 'Dove vai, Svegliata?',
            risposte: [
              { testo: 'Cos’è la Linea?', vai_a: 'linea' },
              { testo: 'Cerco dove dormire.', vai_a: 'fienile' },
              { testo: 'Niente.', vai_a: 'fine' },
            ],
          },
          { id: 'linea', testo: 'Il sole.', risposte: [{ testo: 'Ah.', vai_a: 'inizio', effetti: ['taccuino:parola_linea barra'] }] },
          {
            id: 'fienile',
            testo: 'Il fienile dei Pedrazzini.',
            risposte: [{ testo: 'Grazie.', vai_a: 'fine', effetti: ['flag:sa_fienile', 'flag:fiducia_ottavio+=1'] }],
          },
        ],
      },
    },
    taccuino: [
      { id: 'chi_marta', tipo: 'domanda', testo: 'Chi ha scritto la lettera di Marta?' },
      { id: 'parola_linea', tipo: 'parola', tecnica: 'tubo solare', locale: 'Linea' },
      { id: 'prima_legge', tipo: 'indizio', testo: 'La notte riporta alla Carta ciò che nessuno ha verificato.', fonte: 'il sentiero' },
    ],
    luoghi: [
      { id: 'castagno_morto' },
      { id: 'fienile' },
      { id: 'sentiero_fienile' },
      { id: 'campanile_san_vigilio' },
    ],
    personaggi: [{ id: 'ottavio' }],
  };
}

describe('verifica dei contenuti', () => {
  it('contenuti corretti: nessun errore e missioni completate nella simulazione', () => {
    const r = verificaContenuti(contenutiBuoni());
    expect(r.errori).toEqual([]);
    expect(r.avvisi).toEqual([]);
    expect(r.oggettiDelGioco).toEqual([{ id: 'velo', letto: ['missione m1, passo rilievo (completamento)'] }]);
    expect(r.flagDelGioco).toEqual([]);
    expect(r.simulazione.map((s) => [s.missione, s.esito])).toEqual([
      ['prologo', 'completata'],
      ['m1', 'completata'],
    ]);
    expect(r.ipotesi).toEqual([]);
    expect(r.conteggi).toMatchObject({ missioni: 2, passi: 6, dialoghi: 1, nodi: 3, vociTaccuino: 3 });
    const traccia = r.traccia.join('\n');
    expect(traccia).toContain('▶ missione prologo');
    expect(traccia).toContain('dialogo ottavio_fienile (ottavio): scelte 1, 1, 2, 1'); // curioso: chiede della Linea, poi del fienile
    expect(traccia).not.toContain('giorno 2, ore 20');
    expect(traccia).toContain('■ missione m1 completata');
  });

  it('trova errori di sintassi, vai_a rotti, effetti sconosciuti e riferimenti mancanti', () => {
    const c = contenutiBuoni();
    const m1 = c.missioni[1] as { passi: Record<string, unknown>[] };
    m1.passi[1]!.completa_quando = 'luogo:campanile raggiunto e';
    m1.passi[2]!.effetti = ['taccuino:prima_legge', 'boh:1', 'missione:m9 avvia', 'taccuino:voce_fantasma'];
    m1.passi.push({ id: 'senza_condizione' });
    const d = c.dialoghi.ottavio_fienile as { nodi: { risposte: Record<string, unknown>[] }[] };
    d.nodi[0]!.risposte[2]!.vai_a = 'nodo_perso';
    d.nodi[0]!.risposte[0]!.condizione = 'dialogo:dialogo_fantasma finito';
    (c.dialoghi as Record<string, unknown>).isolato = {
      personaggio: 'rosa',
      nodi: [
        { id: 'a', testo: 'A', risposte: [{ testo: 'b', vai_a: 'b' }] },
        { id: 'b', testo: 'B', risposte: [{ testo: 'a', vai_a: 'a' }] },
        { id: 'c', testo: 'mai raggiunto' },
      ],
    };
    (c.missioni[0] as { passi: Record<string, unknown>[] }).passi[0]!.completa_quando = 'luogo:castagno_vivo raggiunto';
    const r = verificaContenuti(c);
    const errori = r.errori.join('\n');
    expect(errori).toMatch(/missione m1, passo campanile \(completamento\): .*incompleta/);
    expect(errori).toMatch(/prefisso sconosciuto «boh:»/);
    expect(errori).toMatch(/missione inesistente/);
    expect(errori).toMatch(/vai_a «nodo_perso» non esiste/);
    expect(errori).toMatch(/dialogo inesistente «dialogo_fantasma»/);
    expect(errori).toMatch(/dialogo isolato: nessun nodo raggiungibile chiude il dialogo/);
    expect(errori).toMatch(/passo senza_condizione: manca «completa_quando»/);
    expect(errori).toMatch(/simulazione: la missione m1 è bloccata/);
    const avvisi = r.avvisi.join('\n');
    expect(avvisi).toMatch(/voce_fantasma.*non è in taccuino.json/);
    expect(avvisi).toMatch(/il nodo «c» non è raggiungibile/);
    expect(avvisi).toMatch(/personaggio «rosa» non è in personaggi.json/);
    expect(avvisi).toMatch(/luogo «castagno_vivo» non è in luoghi.json/);
    expect(avvisi).toMatch(/manca «obiettivo_taccuino»/);
  });

  it('una missione che nessuno avvia è «mai avviata»; i flag del gioco diventano ipotesi', () => {
    const r = verificaContenuti(
      {
        missioni: [
          { id: 'a', titolo: 'A', passi: [{ id: 'p', obiettivo_taccuino: 'x', completa_quando: 'flag:leva_tirata' }] },
          { id: 'b', titolo: 'B', avvia_quando: 'flag:mai_impostato e !flag:leva_tirata', passi: [{ id: 'q', obiettivo_taccuino: 'y', completa_quando: 'vero' }] },
        ],
      },
      { missioniIniziali: ['a'] },
    );
    expect(r.simulazione.map((s) => s.esito)).toEqual(['completata', 'mai avviata']);
    expect(r.simulazione[1]!.motivo).toMatch(/leva_tirata/);
    expect(r.ipotesi).toContain('flag «leva_tirata» impostato dal gioco (nessun effetto dei contenuti lo imposta)');
    expect(r.flagDelGioco.map((f) => f.nome)).toEqual(['leva_tirata', 'mai_impostato']);
  });

  it('condizioni impossibili bloccano la simulazione con un motivo leggibile', () => {
    const r = verificaContenuti({
      missioni: [
        {
          id: 'a',
          titolo: 'A',
          passi: [{ id: 'p', obiettivo_taccuino: 'x', completa_quando: 'notte e giorno' }],
        },
      ],
    });
    expect(r.simulazione[0]).toMatchObject({ esito: 'bloccata' });
    expect(r.simulazione[0]!.motivo).toMatch(/si escludono/);
  });

  it('segue le alternative «o» e le missioni avviate da un dialogo', () => {
    const r = verificaContenuti({
      missioni: [
        {
          id: 'prologo',
          titolo: 'P',
          passi: [{ id: 'p', obiettivo_taccuino: 'x', completa_quando: 'dialogo:rosa finito' }],
        },
        {
          id: 'api',
          titolo: 'Le api',
          passi: [{ id: 'q', obiettivo_taccuino: 'y', completa_quando: 'flag:inesistente o taccuino:cisterna' }],
        },
      ],
      dialoghi: {
        rosa: {
          personaggio: 'rosa',
          nodi: [
            {
              id: 'a',
              testo: 'Vieni a vedere la cisterna?',
              risposte: [
                { testo: 'No.', vai_a: 'fine' },
                { testo: 'Sì.', vai_a: 'b', effetti: ['missione:api avvia'] },
              ],
            },
            { id: 'b', testo: 'Trecento api di rame.', effetti: ['taccuino:cisterna'] },
          ],
        },
      },
      taccuino: [{ id: 'cisterna', tipo: 'indizio', testo: 'Le api sono scariche', fonte: 'Rosa' }],
    });
    expect(r.errori).toEqual([]);
    expect(r.simulazione.map((s) => s.esito)).toEqual(['completata', 'completata']);
  });
});
