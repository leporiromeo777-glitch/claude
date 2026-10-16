/**
 * La coda dei dialoghi della regia (src/regia/dialoghi.ts): un dialogo automatico si apre solo
 * se la sua condizione vale ancora e chi parla è vicino; le richieste forzate della rete di
 * sicurezza saltano la condizione; i dialoghi già finiti escono dalla coda.
 */
import { describe, expect, it } from 'vitest';
import { Narrativa } from '../../src/narrativa/narrativa';
import { CONTENUTI_NARRATIVA } from '../../src/regia/contenuti';
import { DISTANZA_DIALOGO_AUTOMATICO, DirettoreDialoghi, dialogoDiUnLuogo } from '../../src/regia/dialoghi';
import { Percorso } from '../../src/regia/percorso';
import type { Regia } from '../../src/regia/regia';
import { FattiFinti } from '../narrativa/aiuti';

/** Una regia finta con quel che serve alla coda: la storia vera, persone a distanza data. */
function regiaFinta(persone: Record<string, number>) {
  const fatti = new FattiFinti();
  const narrativa = new Narrativa(CONTENUTI_NARRATIVA, fatti);
  const finestra = { visible: false, mostrati: [] as string[] };
  const r = {
    narrativa,
    ui: {
      dialogo: {
        on: () => () => {},
        show: (b: { testo: string }) => {
          finestra.visible = true;
          finestra.mostrati.push(b.testo);
        },
        hide: () => (finestra.visible = false),
        get visible() {
          return finestra.visible;
        },
      },
      lettore: { visible: false },
      titolo: { visible: false },
    },
    ponte: { attesaAperta: false, aspetto: () => undefined, nomeVisibile: (id: string) => id },
    abitanti: {
      ha: (id: string) => id in persone,
      presente: (id: string) => id in persone,
      distanzaDa: (id: string) => persone[id] ?? Infinity,
      modoOttavio: 'fermo',
      distanzaOttavioDa: () => persone['ottavio'] ?? Infinity,
      ottavioRaggiunge: () => {},
      puntoDialogo: () => null,
      voltaVerso: () => {},
    },
    game: { player: { cyl: { z: 1043, theta: 35.6, h: 38.5 } } },
    voltatiVerso: () => {},
    percorso: null as Percorso | null,
  };
  r.percorso = new Percorso(r as unknown as Regia);
  const d = new DirettoreDialoghi(r as unknown as Regia);
  return { d, fatti, narrativa };
}

describe('la coda dei dialoghi', () => {
  it('la novizia parla solo se Elvira è alla Bacheca e lei è vicina', () => {
    const { d, fatti } = regiaFinta({ clelia: 3 });
    fatti.giornoCorrente = 2;
    d.richiedi('d_clelia_dono', true);
    d.update();
    expect(d.aperto).toBe(false); // Elvira non è alla Bacheca: la richiesta aspetta
    expect(d.inCoda('d_clelia_dono')).toBe(true);
    fatti.luoghi.add('bacheca_ore');
    d.update();
    expect(d.nodo?.dialogo).toBe('d_clelia_dono');
  });

  it('chi parla per primo da lontano aspetta di essere vicino', () => {
    const { d, fatti } = regiaFinta({ clelia: DISTANZA_DIALOGO_AUTOMATICO + 10 });
    fatti.giornoCorrente = 2;
    fatti.luoghi.add('bacheca_ore');
    d.richiedi('d_clelia_dono', true);
    d.update();
    expect(d.aperto).toBe(false);
  });

  it('un dialogo automatico senza luogo (il letto nella Casa del Velo) si apre anche da lontano', () => {
    expect(dialogoDiUnLuogo('giorno:>=2 e luogo:bacheca_ore raggiunto')).toBe(true);
    expect(dialogoDiUnLuogo('flag:velo_indossato e ora:>=20:30')).toBe(false);
    const { d, narrativa, fatti } = regiaFinta({ clelia: 400 });
    fatti.giornoCorrente = 2;
    fatti.oraCorrente = 20.6;
    narrativa.flag.set('velo_indossato');
    narrativa.missioni.avvia('m01_castagno_vuoto');
    narrativa.missioni.completaPasso('m01_castagno_vuoto', 'm1_strada');
    expect(narrativa.valuta('passo:m1_strada completato')).toBe(true);
    d.richiedi('d_clelia_letto', true);
    d.update();
    expect(d.nodo?.dialogo).toBe('d_clelia_letto');
  });

  it('una richiesta forzata (la rete di sicurezza) salta la condizione', () => {
    const { d } = regiaFinta({});
    d.richiedi('d_meridiana_1', true); // la lettera non è ancora letta: la condizione è falsa
    d.update();
    expect(d.aperto).toBe(false);
    d.richiedi('d_meridiana_1', true, true);
    d.update();
    expect(d.nodo?.dialogo).toBe('d_meridiana_1');
  });

  it('un dialogo finito esce dalla coda (il pacco portato da Ottavio)', () => {
    const { d, narrativa, fatti } = regiaFinta({ clelia: 3 });
    fatti.giornoCorrente = 3;
    d.richiedi('d_clelia_dono', true);
    const st = narrativa.dialoghi.esporta();
    narrativa.dialoghi.importa({ ...st, finiti: [...st.finiti, 'd_clelia_dono'] });
    d.update();
    expect(d.inCoda('d_clelia_dono')).toBe(false);
    expect(d.aperto).toBe(false);
  });

  it('la prova alla passerella: raggiunta durante il passo, si apre anche con Elvira già uscita (Ottavio viene da lei)', () => {
    const { d, narrativa, fatti } = regiaFinta({ ottavio: 3 });
    narrativa.missioni.avvia('m01_castagno_vuoto');
    for (const p of narrativa.contenuti.missioni.find((m) => m.id === 'm01_castagno_vuoto')!.passi) {
      if (p.id === 'm1_prova') break;
      narrativa.missioni.completaPasso('m01_castagno_vuoto', p.id);
    }
    fatti.giornoCorrente = 3;
    fatti.oraCorrente = 10;
    narrativa.tick(0);
    expect(narrativa.valuta('passo:m1_prova attivo')).toBe(true);
    // Elvira arriva alla passerella (la storia annuncia la prova), poi segue il segnalino su Ottavio
    fatti.luoghi.add('passerella_messo');
    narrativa.tick(0);
    d.richiedi('d_ottavio_prova', true);
    fatti.luoghi.delete('passerella_messo');
    narrativa.tick(0);
    expect(narrativa.valuta('giorno:>=3 e luogo:passerella_messo raggiunto')).toBe(false);
    d.update();
    expect(d.nodo?.dialogo).toBe('d_ottavio_prova');
  });

  it('fuori dal passo che fa avanzare la condizione si legge com\'è adesso (la novizia lontana dalla Bacheca)', () => {
    const { d, fatti } = regiaFinta({ clelia: 3 });
    fatti.giornoCorrente = 2;
    d.richiedi('d_clelia_dono', true);
    d.update();
    expect(d.aperto).toBe(false);
  });
});
