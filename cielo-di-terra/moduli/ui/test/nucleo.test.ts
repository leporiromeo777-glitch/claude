import { describe, expect, it, vi } from 'vitest';
import { Emettitore } from '../src/core/emettitore';
import { analizzaTesto, paragrafi, testoSemplice } from '../src/core/testo';
import { StoreImpostazioni, impostazioniPredefinite, fattoreCoriolisCorpo, type ArchivioChiaveValore } from '../src/impostazioni/store';

class Prova extends Emettitore<{ a: number; b: void }> {
  manda(n: number): void {
    this.emit('a', n);
  }
  vuoto(): void {
    this.emit('b');
  }
}

describe('Emettitore', () => {
  it('chiama gli ascoltatori nell’ordine e li toglie', () => {
    const e = new Prova();
    const visti: number[] = [];
    const togli = e.on('a', (n) => visti.push(n));
    e.on('a', (n) => visti.push(n * 10));
    e.manda(1);
    togli();
    e.manda(2);
    expect(visti).toEqual([1, 10, 20]);
  });

  it('once ascolta una volta sola e gli eventi void non hanno dato', () => {
    const e = new Prova();
    const fn = vi.fn();
    e.once('b', fn);
    e.vuoto();
    e.vuoto();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('un ascoltatore che lancia non blocca gli altri', () => {
    const e = new Prova();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fn = vi.fn();
    e.on('a', () => {
      throw new Error('rotto');
    });
    e.on('a', fn);
    e.manda(3);
    expect(fn).toHaveBeenCalledWith(3);
    err.mockRestore();
  });
});

describe('testo con markup', () => {
  it('riconosce parole barrate, corsivo e a capo', () => {
    const p = analizzaTesto('Il [[asse|Fuso]] è *lassù*\nsempre');
    expect(p).toEqual([
      { tipo: 'testo', testo: 'Il ' },
      { tipo: 'parola', tecnica: 'asse', locale: 'Fuso' },
      { tipo: 'testo', testo: ' è ' },
      { tipo: 'corsivo', testo: 'lassù' },
      { tipo: 'acapo' },
      { tipo: 'testo', testo: 'sempre' },
    ]);
    expect(testoSemplice('Il [[asse|Fuso]] è *lassù*')).toBe('Il Fuso è lassù');
  });

  it('divide in paragrafi senza usare innerHTML', () => {
    const ps = paragrafi('Uno <b>due</b>\n\nTre');
    expect(ps).toHaveLength(2);
    expect(ps[0]!.textContent).toBe('Uno <b>due</b>');
    expect(ps[0]!.querySelector('b')).toBeNull();
  });
});

/** Archivio finto, con la possibilità di farlo fallire. */
function archivio(iniziale: Record<string, string> = {}, rotto = false): ArchivioChiaveValore & { dati: Record<string, string> } {
  const dati = { ...iniziale };
  return {
    dati,
    getItem: (k) => {
      if (rotto) throw new Error('negato');
      return dati[k] ?? null;
    },
    setItem: (k, v) => {
      if (rotto) throw new Error('quota');
      dati[k] = v;
    },
    removeItem: (k) => {
      delete dati[k];
    },
  };
}

describe('StoreImpostazioni', () => {
  it('parte dai valori di base: oscillazione spenta, Coriolis ridotto, posizione sulla Pianta spenta', () => {
    const s = new StoreImpostazioni({ archivio: null });
    expect(s.get('oscillazioneTesta')).toBe(false);
    expect(s.get('coriolisCorpo')).toBe('ridotto');
    expect(fattoreCoriolisCorpo(s.all())).toBe(0.4);
    expect(s.get('posizioneSullaPianta')).toBe(false);
    expect(s.get('sottotitoli')).toBe(true);
  });

  it('salva in localStorage ed emette «cambio»', () => {
    const a = archivio();
    const s = new StoreImpostazioni({ archivio: a, chiave: 'k' });
    const cambi: string[] = [];
    s.on('cambio', (c) => cambi.push(`${c.chiave}:${String(c.valore)}`));
    expect(s.set('campoVisivo', 95)).toBe(true);
    expect(s.set('campoVisivo', 95)).toBe(false);
    expect(cambi).toEqual(['campoVisivo:95']);
    expect(JSON.parse(a.dati['k']!).impostazioni.campoVisivo).toBe(95);
    const s2 = new StoreImpostazioni({ archivio: a, chiave: 'k' });
    expect(s2.get('campoVisivo')).toBe(95);
  });

  it('porta i numeri nei limiti e ignora i tipi sbagliati', () => {
    const s = new StoreImpostazioni({ archivio: null });
    s.set('campoVisivo', 500);
    expect(s.get('campoVisivo')).toBe(110);
    expect(s.set('dimensioneTesto', 'gigante' as never)).toBe(false);
    expect(s.set('sottotitoli', 'sì' as never)).toBe(false);
    expect(s.get('dimensioneTesto')).toBe('normale');
  });

  it('sopravvive a JSON rovinato e a localStorage che lancia', () => {
    const rovinato = new StoreImpostazioni({ archivio: archivio({ 'cielo-di-terra.impostazioni': '{non è json' }) });
    expect(rovinato.all()).toEqual(impostazioniPredefinite(false));
    const negato = new StoreImpostazioni({ archivio: archivio({}, true) });
    expect(() => negato.set('volumeMusica', 0.2)).not.toThrow();
    expect(negato.get('volumeMusica')).toBe(0.2);
  });

  it('scarta i valori salvati non validi e tiene gli altri', () => {
    const a = archivio({ x: JSON.stringify({ v: 1, impostazioni: { campoVisivo: 'tanto', volumeVoci: 0.5, sconosciuta: 3 } }) });
    const s = new StoreImpostazioni({ archivio: a, chiave: 'x' });
    expect(s.get('campoVisivo')).toBe(80);
    expect(s.get('volumeVoci')).toBe(0.5);
  });

  it('reset emette un cambio per valore e poi «ripristino»', () => {
    const s = new StoreImpostazioni({ archivio: null });
    s.set('invertiAsseY', true);
    s.set('volumeGenerale', 0.1);
    const eventi: string[] = [];
    s.on('cambio', (c) => eventi.push(c.chiave));
    s.on('ripristino', () => eventi.push('ripristino'));
    s.reset();
    expect(eventi.sort()).toEqual(['invertiAsseY', 'ripristino', 'volumeGenerale']);
    expect(s.get('invertiAsseY')).toBe(false);
  });
});
