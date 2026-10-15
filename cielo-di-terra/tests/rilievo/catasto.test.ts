import { describe, expect, it } from 'vitest';
import { Catasto, collegaAlMondo, sincronizzaMondo, type MondoCelle, type OggettiVarianti } from '../../src/rilievo/catasto';
import type { EventoCatasto } from '../../src/rilievo/tipi';
import { regoleFase1 } from './aiuti';

const r = regoleFase1();

/** Un finto `World` del motore che registra le chiamate. */
class MondoFinto implements MondoCelle {
  stati = new Uint8Array(7200).fill(1); // il motore parte tutto a matita
  rivelazioni: { ids: number[]; origine: { z: number; theta: number } }[] = [];
  setCellState(id: number, stato: 0 | 1 | 2): void {
    this.stati[id] = stato;
  }
  revealCells(ids: number[], origine: { z: number; theta: number }): void {
    this.rivelazioni.push({ ids, origine });
    for (const id of ids) this.stati[id] = 2;
  }
}

describe('la facciata Catasto', () => {
  it('tiene lo stato, distribuisce gli eventi e gli effetti', () => {
    const c = new Catasto(r);
    const visti: string[] = [];
    const tutti: EventoCatasto['tipo'][] = [];
    const via = c.on('lato_chiuso', (e) => visti.push(e.lato));
    c.on('*', (e) => tutti.push(e.tipo));
    const f = c.rileva({ stazione: 'cs_2', mira: 'cs_1', ora: 10 });
    expect(f.ok).toBe(false);
    expect(c.ultimiEffetti).toEqual(['flag:tentato_lato:2-1']);
    expect(tutti).toEqual(['rilievo_fallito']);
    c.rileva({ stazione: 'cs_3', mira: 'cs_1', ora: 10 });
    expect(visti).toEqual(['1-3']);
    expect(c.cellaRilevata(2214)).toBe(true);
    expect(c.statoParticella(2214)).toBe('colore');
    expect(c.cellaAColore(2505)).toBe(true);
    via();
    c.rileva({ stazione: 'cs_7', mira: 'cs_8', ora: 10 });
    expect(visti).toEqual(['1-3']);
    expect(c.parametriSquadro().manoCheRicorda).toBe(false);
    expect(c.info(2797).stato).toBe('colore');
    expect(c.pianta().lati).toHaveLength(3);
  });

  it('collegaAlMondo: matita, inchiostro dalla stazione, varianti agli oggetti 3D', () => {
    const c = new Catasto(r);
    const mondo = new MondoFinto();
    sincronizzaMondo(c.stato, mondo);
    expect(mondo.stati[2599]).toBe(2);
    expect(mondo.stati[2799]).toBe(0);
    const varianti: string[] = [];
    const oggetti: OggettiVarianti = { mostraVariante: (el, v, p) => varianti.push(`${el}=${v}+${p.mostra.join(',')}`) };
    const scollega = collegaAlMondo(c, mondo, oggetti);
    c.passa({ z: 1176, theta: 58.5 });
    expect(mondo.stati[2799]).toBe(1);
    c.rileva({ stazione: 'cs_3', mira: 'cs_1', ora: 10 });
    expect(mondo.rivelazioni).toHaveLength(1);
    expect(mondo.rivelazioni[0]!.origine).toEqual({ z: 946, theta: 23.6 });
    expect(mondo.rivelazioni[0]!.ids).toHaveLength(13);
    c.cicliDelGiorno({ da: '05:30', a: '21:00' });
    expect(varianti).toContain('E4=Abitata+gradini_assi_x6,decal_sentiero_battuto');
    const n = c.notte({ elvira: { cella: 2799 } });
    expect(n.resoconto.righe.length).toBeGreaterThan(0);
    expect(varianti).toContain('E1=Carta+decal_prato_pettinato,mucchio_assi_riva');
    expect(c.ultimoResoconto()).toBe(n.resoconto);
    expect(c.stato.giorno).toBe(2);
    scollega();
    c.passa({ z: 2000, theta: 45 });
    expect(mondo.stati[idSantAnna()]).toBe(0); // scollegato: il mondo non riceve più la matita
  });

  it('notte a passi, previsione, salvataggio e caricamento', () => {
    const c = new Catasto(r);
    c.cicliDelGiorno({ da: '05:30', a: '21:00' });
    const prev = c.previsione();
    expect(prev.righe).toHaveLength(4);
    c.iniziaNotte({ elvira: { sveglia: true } });
    c.avanzaNotte('22:00', { cella: 2799 });
    c.avanzaNotte('22:25', { cella: 2311 }); // dalle 22:01 è sulla scorciatoia: alle 22:20 le Fade la trovano lì
    const res = c.chiudiNotte();
    expect(res.righe.filter((x) => x.colore === 'rosso').map((x) => x.elemento)).toEqual(['E1', 'E2', 'E3']);
    expect(res.righe.filter((x) => x.colore === 'grigio').map((x) => x.elemento)).toEqual(['E4']);
    const blob = c.salva();
    const d = Catasto.carica(blob, r);
    expect(d.stato).toEqual(c.stato);
    const e = new Catasto(r);
    expect(e.ripristina(JSON.stringify(blob))).toEqual([]);
    expect(e.variante('E1')).toBe('Carta');
    expect(e.inventarioCompleto()).toBe(false);
    expect(c.impostaVariante('E1', 'Abitata').ok).toBe(true);
    expect(c.segnaCaposaldoVisto('cs_37').ok).toBe(true);
    expect(c.appunta({ bersaglio: { caposaldo: 'cs_6' }, ora: 10 }).ok).toBe(true);
    expect(c.rimettiCaposaldo('cs_6').ok).toBe(true);
    expect(c.annunciaMosse({ atto: 'I' }).eventi).toEqual([]);
    expect(c.scriviConPenna('nessuna').ok).toBe(false);
    expect(c.rimisuraScrittura('nessuna').ok).toBe(false);
    expect(c.chiudiTriangolo({ stazione: 'cs_1', mire: ['cs_12', 'cs_14'], ora: 22 }).motivo).toBe('non_attivo');
    expect(c.stazioneLibera({ punto: { z: 2800, theta: 35, altezza: 343 }, lumi: ['cs_12', 'cs_14', 'cs_17'], ora: 22 }).ok).toBe(false);
  });
});

function idSantAnna(): number {
  return Math.floor(2000 / 40) * 96 + Math.floor(45 / 3.75);
}
