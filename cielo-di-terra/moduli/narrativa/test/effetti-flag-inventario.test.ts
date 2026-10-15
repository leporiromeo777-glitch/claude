import { describe, expect, it, vi } from 'vitest';
import { ErroreEffetto, analizzaEffetto, listaEffetti, stampaEffetto } from '../src/effetti';
import { ArchivioFlag } from '../src/flag';
import { Inventario } from '../src/inventario';
import { Emettitore } from '../src/eventi';

describe('effetti', () => {
  it('analizza tutte le forme note', () => {
    expect(analizzaEffetto('flag:x')).toEqual({ tipo: 'flag', nome: 'x', valore: true });
    expect(analizzaEffetto('flag:x=3')).toEqual({ tipo: 'flag', nome: 'x', valore: 3 });
    expect(analizzaEffetto('flag:x = falso')).toEqual({ tipo: 'flag', nome: 'x', valore: false });
    expect(analizzaEffetto('flag:velo=nero')).toEqual({ tipo: 'flag', nome: 'velo', valore: 'nero' });
    expect(analizzaEffetto('flag:x+=2')).toEqual({ tipo: 'flag-somma', nome: 'x', delta: 2 });
    expect(analizzaEffetto('flag:x-=1')).toEqual({ tipo: 'flag-somma', nome: 'x', delta: -1 });
    expect(analizzaEffetto('flag:porta-aperta+=1')).toEqual({ tipo: 'flag-somma', nome: 'porta-aperta', delta: 1 });
    expect(analizzaEffetto('!flag:x')).toEqual({ tipo: 'flag-rimuovi', nome: 'x' });
    expect(analizzaEffetto('flag:-x')).toEqual({ tipo: 'flag-rimuovi', nome: 'x' });
    expect(analizzaEffetto('taccuino:chi_marta')).toEqual({ tipo: 'taccuino', id: 'chi_marta', azione: 'aggiungi' });
    expect(analizzaEffetto('taccuino:chi_marta chiudi')).toEqual({ tipo: 'taccuino', id: 'chi_marta', azione: 'chiudi' });
    expect(analizzaEffetto('taccuino:meta barra')).toEqual({ tipo: 'taccuino', id: 'meta', azione: 'barra' });
    expect(analizzaEffetto('cielo:Brace della Linea fra due ore')).toEqual({ tipo: 'cielo', testo: 'Brace della Linea fra due ore' });
    expect(analizzaEffetto('missione:m1 avvia')).toEqual({ tipo: 'missione', id: 'm1', azione: 'avvia' });
    expect(analizzaEffetto('missione:m1')).toEqual({ tipo: 'missione', id: 'm1', azione: 'avvia' });
    expect(analizzaEffetto('missione:m1 completa')).toEqual({ tipo: 'missione', id: 'm1', azione: 'completa' });
    expect(analizzaEffetto('oggetto:+squadro')).toEqual({ tipo: 'oggetto', id: 'squadro', delta: 1 });
    expect(analizzaEffetto('oggetto:-lettera')).toEqual({ tipo: 'oggetto', id: 'lettera', delta: -1 });
    expect(analizzaEffetto('oggetto:velo')).toEqual({ tipo: 'oggetto', id: 'velo', delta: 1 });
    expect(analizzaEffetto('oggetto:+api_rame*3')).toEqual({ tipo: 'oggetto', id: 'api_rame', delta: 3 });
    expect(analizzaEffetto('evento:dissolvenza')).toEqual({ tipo: 'evento', nome: 'dissolvenza', argomenti: [] });
    expect(analizzaEffetto('evento:campane tre colpi')).toEqual({
      tipo: 'evento',
      nome: 'campane',
      argomenti: ['tre', 'colpi'],
    });
    expect(analizzaEffetto('tempo:salta-a 6')).toEqual({ tipo: 'tempo', azione: 'salta-a', ore: 6 });
    expect(analizzaEffetto('tempo:salta-a 6:30')).toEqual({ tipo: 'tempo', azione: 'salta-a', ore: 6.5 });
    expect(analizzaEffetto('tempo:avanza 2')).toEqual({ tipo: 'tempo', azione: 'avanza', ore: 2 });
    expect(analizzaEffetto('dialogo:ottavio_2')).toEqual({ tipo: 'dialogo', id: 'ottavio_2' });
    expect(analizzaEffetto('dialogo:ottavio_2 avvia')).toEqual({ tipo: 'dialogo', id: 'ottavio_2' });
  });

  it('rifiuta le forme sconosciute', () => {
    const cattivi: [string, RegExp][] = [
      ['', /vuoto/],
      ['niente', /manca il prefisso/],
      ['pippo:x', /prefisso sconosciuto/],
      ['flag:', /manca il nome/],
      ['flag:x=', /manca il valore/],
      ['missione:m1 esplodi', /azione di missione sconosciuta/],
      ['taccuino:x boh', /azione del taccuino sconosciuta/],
      ['tempo:salta 6', /forma: tempo/],
      ['tempo:salta-a', /manca il numero/],
      ['tempo:salta-a alba', /ore non valide/],
      ['tempo:salta-a 25', /fra 0 e 24/],
      ['oggetto:+api*0', /quantità/],
      ['!taccuino:x', /si usa solo davanti/],
      ['dialogo:a b c', /forma: dialogo/],
      ['evento:', /manca il nome/],
    ];
    for (const [s, re] of cattivi) {
      expect(() => analizzaEffetto(s), s).toThrow(ErroreEffetto);
      expect(() => analizzaEffetto(s), s).toThrow(re);
    }
  });

  it('riscrive in forma canonica', () => {
    for (const s of ['flag:x', 'flag:x=3', 'flag:x=falso', 'flag:x+=2', '!flag:x', 'taccuino:a chiudi', 'oggetto:+a*2', 'oggetto:-a', 'evento:a b', 'tempo:salta-a 6']) {
      expect(stampaEffetto(analizzaEffetto(s))).toBe(s);
    }
  });

  it('normalizza il campo effetti', () => {
    expect(listaEffetti(undefined)).toEqual([]);
    expect(listaEffetti('flag:x')).toEqual(['flag:x']);
    expect(listaEffetti(['flag:x', '', 3, 'flag:y'])).toEqual(['flag:x', 'flag:y']);
  });
});

describe('archivio dei flag', () => {
  it('imposta, legge, rimuove ed emette i cambiamenti', () => {
    const f = new ArchivioFlag();
    const cambi = vi.fn();
    f.eventi.on('cambio', cambi);
    f.set('a');
    f.set('a'); // nessun cambiamento
    f.set('n', 2);
    f.set('s', 'nero');
    expect(f.get('a')).toBe(true);
    expect(f.vero('n')).toBe(true);
    expect(f.esiste('s')).toBe(true);
    expect(cambi).toHaveBeenCalledTimes(3);
    expect(cambi).toHaveBeenCalledWith({ nome: 'n', prima: undefined, dopo: 2 });
    f.rimuovi('a');
    expect(f.get('a')).toBeUndefined();
    expect(cambi).toHaveBeenLastCalledWith({ nome: 'a', prima: true, dopo: undefined });
    f.rimuovi('a');
    expect(cambi).toHaveBeenCalledTimes(4);
  });

  it('incrementa partendo da 0 (o da 1 se era true)', () => {
    const f = new ArchivioFlag();
    expect(f.incrementa('n')).toBe(1);
    expect(f.incrementa('n', 4)).toBe(5);
    f.set('b', true);
    expect(f.incrementa('b')).toBe(2);
    f.set('s', 'x');
    expect(f.incrementa('s', -1)).toBe(-1);
  });

  it('rifiuta nomi vuoti e valori non validi', () => {
    const f = new ArchivioFlag();
    expect(() => f.set('')).toThrow();
    expect(() => f.set('x', Number.NaN)).toThrow();
  });

  it('esporta e importa senza eventi', () => {
    const f = new ArchivioFlag();
    f.set('a');
    f.set('n', 3);
    const dati = f.esporta();
    const g = new ArchivioFlag();
    const cambi = vi.fn();
    g.eventi.on('cambio', cambi);
    g.importa({ ...dati, rotto: { x: 1 } });
    expect(g.tutti()).toEqual({ a: true, n: 3 });
    expect(cambi).not.toHaveBeenCalled();
  });
});

describe('inventario', () => {
  it('aggiunge, toglie e conta', () => {
    const inv = new Inventario();
    const cambi = vi.fn();
    inv.eventi.on('cambio', cambi);
    inv.aggiungi('api_rame', 3);
    inv.aggiungi('squadro');
    expect(inv.quantita('api_rame')).toBe(3);
    expect(inv.ha('api_rame', 3)).toBe(true);
    expect(inv.ha('api_rame', 4)).toBe(false);
    expect(inv.rimuovi('api_rame', 4)).toBe(false);
    expect(inv.rimuovi('api_rame', 3)).toBe(true);
    expect(inv.ha('api_rame')).toBe(false);
    expect(inv.elenco()).toEqual([{ id: 'squadro', quantita: 1 }]);
    expect(cambi).toHaveBeenCalledTimes(3);
    expect(() => inv.aggiungi('x', 0)).toThrow();
    expect(() => inv.aggiungi('', 1)).toThrow();
  });

  it('esporta e importa', () => {
    const inv = new Inventario();
    inv.aggiungi('a', 2);
    const altro = new Inventario();
    altro.importa({ ...inv.esporta(), cattivo: -1, frazione: 1.5 });
    expect(altro.esporta()).toEqual({ a: 2 });
  });
});

describe('emettitore', () => {
  it('on, once, off, onQualsiasi', () => {
    const e = new Emettitore<{ a: number; b: string }>();
    const fa = vi.fn();
    const fo = vi.fn();
    const tutti = vi.fn();
    const stacca = e.on('a', fa);
    e.once('a', fo);
    const staccaTutti = e.onQualsiasi(tutti);
    e.emit('a', 1);
    e.emit('a', 2);
    stacca();
    e.emit('a', 3);
    e.emit('b', 'x');
    staccaTutti();
    e.emit('b', 'y');
    expect(fa.mock.calls).toEqual([[1], [2]]);
    expect(fo.mock.calls).toEqual([[1]]);
    expect(tutti.mock.calls).toEqual([
      ['a', 1],
      ['a', 2],
      ['a', 3],
      ['b', 'x'],
    ]);
  });

  it('chiama tutti gli ascoltatori anche se uno lancia, poi rilancia', () => {
    const e = new Emettitore<{ a: number }>();
    const dopo = vi.fn();
    e.on('a', () => {
      throw new Error('rotto');
    });
    e.on('a', dopo);
    expect(() => e.emit('a', 1)).toThrow('rotto');
    expect(dopo).toHaveBeenCalledWith(1);
  });
});
