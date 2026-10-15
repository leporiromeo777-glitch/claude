import { describe, expect, it } from 'vitest';
import {
  ArchivioMemoria,
  ErroreSalvataggio,
  FORMATO_SALVATAGGIO,
  GestoreSalvataggi,
  RegistroMigrazioni,
  VERSIONE_SALVATAGGIO,
  archivioDaStorage,
  checksumDocumento,
  creaDocumento,
  deserializza,
  hash53,
  jsonCanonico,
  leggiDocumento,
  serializza,
  type Archivio,
} from '../src/salvataggio';
import { Narrativa, type FornitoreMondo } from '../src/narrativa';
import { FattiFinti } from './aiuti';

const ADESSO = new Date('2026-10-15T08:00:00Z');

const CONTENUTO = {
  narrativa: { flag: { a: true, n: 3 }, testo: 'Cielo di Terra: «à è ì ò ù»' },
  mondo: { giocatore: { z: 1050, theta: 42, altezza: 2 }, ora: 9.5, particelle: { p01: 'carta', p02: 'abitata' } },
  meta: { luogo: 'Corbella', giorno: 2 },
};

describe('checksum', () => {
  it('JSON canonico: ordine delle chiavi irrilevante', () => {
    expect(jsonCanonico({ b: 1, a: { d: 2, c: [3, { f: 1, e: 0 }] } })).toBe('{"a":{"c":[3,{"e":0,"f":1}],"d":2},"b":1}');
    expect(jsonCanonico({ a: 1, b: 2 })).toBe(jsonCanonico({ b: 2, a: 1 }));
  });

  it('hash53 è stabile e sensibile ai cambiamenti', () => {
    expect(hash53('ciao')).toBe(hash53('ciao'));
    expect(hash53('ciao')).not.toBe(hash53('ciaO'));
    expect(hash53('ciao')).toMatch(/^[0-9a-f]{14}$/);
    expect(hash53('')).toMatch(/^[0-9a-f]{14}$/);
  });
});

describe('serializzazione', () => {
  it('andata e ritorno', () => {
    const testo = serializza(CONTENUTO, { contatore: 4, adesso: ADESSO });
    const doc = deserializza(testo);
    expect(doc.formato).toBe(FORMATO_SALVATAGGIO);
    expect(doc.versione).toBe(VERSIONE_SALVATAGGIO);
    expect(doc.contatore).toBe(4);
    expect(doc.salvatoIl).toBe('2026-10-15T08:00:00.000Z');
    expect(doc.dati).toEqual(CONTENUTO);
  });

  it('il documento è una copia: cambiare l’originale non lo tocca', () => {
    const originale = { narrativa: { x: [1] }, mondo: null };
    const doc = creaDocumento(originale);
    originale.narrativa.x.push(2);
    expect(doc.dati.narrativa).toEqual({ x: [1] });
  });

  it('il mondo assente diventa null', () => {
    const doc = deserializza(serializza({ narrativa: {}, mondo: undefined }));
    expect(doc.dati.mondo).toBeNull();
  });

  it('rileva la corruzione', () => {
    const testo = serializza(CONTENUTO, { adesso: ADESSO });
    const rovinato = testo.replace('"n":3', '"n":4');
    expect(rovinato).not.toBe(testo);
    expect(() => deserializza(rovinato)).toThrow(/Checksum non valido/);
    expect(() => deserializza(testo.slice(0, testo.length - 5))).toThrow(/non è JSON/);
    expect(() => deserializza('[]')).toThrow(/non è un oggetto/);
    expect(() => deserializza('{"formato":"altro"}')).toThrow(/Formato sconosciuto/);
    const senzaChecksum = JSON.parse(testo) as Record<string, unknown>;
    delete senzaChecksum.checksum;
    expect(() => deserializza(JSON.stringify(senzaChecksum))).toThrow(/Checksum mancante/);
  });

  it('il checksum non dipende dall’ordine delle chiavi nel file', () => {
    const doc = JSON.parse(serializza(CONTENUTO, { adesso: ADESSO })) as Record<string, unknown>;
    const rimescolato = Object.fromEntries(Object.entries(doc).reverse());
    expect(() => leggiDocumento(JSON.stringify(rimescolato))).not.toThrow();
  });
});

describe('migrazioni', () => {
  /** Simula un gioco arrivato alla versione 3 del formato. */
  function registroFinoA3(): RegistroMigrazioni {
    return new RegistroMigrazioni()
      .registra(1, (d) => {
        // v1 → v2: i flag passano da lista di nomi a mappa nome → valore
        const n = d.narrativa as { flag: string[] };
        return { ...d, narrativa: { ...n, flag: Object.fromEntries(n.flag.map((f) => [f, true])) } };
      })
      .registra(2, (d) => {
        // v2 → v3: compare l'inventario
        const n = d.narrativa as Record<string, unknown>;
        return { ...d, narrativa: { ...n, inventario: {} } };
      });
  }

  it('applica le migrazioni in fila', () => {
    const vecchio = serializza({ narrativa: { flag: ['a', 'b'] }, mondo: { z: 3 } }, { versione: 1, adesso: ADESSO });
    const doc = deserializza(vecchio, { migrazioni: registroFinoA3(), versione: 3 });
    expect(doc.versione).toBe(3);
    expect(doc.dati).toEqual({ narrativa: { flag: { a: true, b: true }, inventario: {} }, mondo: { z: 3 } });
    // da v2 si applica solo l'ultima
    const medio = serializza({ narrativa: { flag: { c: 1 } }, mondo: null }, { versione: 2 });
    expect(deserializza(medio, { migrazioni: registroFinoA3(), versione: 3 }).dati.narrativa).toEqual({
      flag: { c: 1 },
      inventario: {},
    });
  });

  it('la migrazione lavora su una copia', () => {
    const r = new RegistroMigrazioni().registra(1, (d) => {
      (d.narrativa as Record<string, unknown>).toccato = true;
      return d;
    });
    const dati = { narrativa: {} as Record<string, unknown> };
    r.migra(dati, 1, 2);
    expect(dati.narrativa.toccato).toBeUndefined();
  });

  it('errori: migrazione mancante, salvataggio dal futuro, doppia registrazione', () => {
    const r = new RegistroMigrazioni().registra(1, (d) => d);
    expect(() => r.migra({}, 1, 3)).toThrow(/dalla versione 2 alla 3/);
    expect(() => r.migra({}, 4, 3)).toThrow(/più nuova/);
    expect(() => r.registra(1, (d) => d)).toThrow(/già registrata/);
    expect(() => r.registra(-1, (d) => d)).toThrow(ErroreSalvataggio);
    expect(r.versioni()).toEqual([1]);
    expect(r.ha(1)).toBe(true);
    const nuovo = serializza({ narrativa: {}, mondo: null }, { versione: VERSIONE_SALVATAGGIO + 1 });
    expect(() => deserializza(nuovo)).toThrow(/più nuova/);
  });

  it('una migrazione che non restituisce un oggetto è un errore', () => {
    const r = new RegistroMigrazioni().registra(1, () => null as unknown as Record<string, unknown>);
    expect(() => r.migra({}, 1, 2)).toThrow(/non ha restituito/);
  });
});

describe('due slot alternati', () => {
  it('alterna gli slot e carica il più recente', async () => {
    const archivio = new ArchivioMemoria();
    const g = new GestoreSalvataggi({ archivio, adesso: () => ADESSO });
    expect(await g.carica()).toBeNull();
    expect((await g.elenco()).map((s) => s.stato)).toEqual(['vuoto', 'vuoto']);

    const s1 = await g.salva({ narrativa: { n: 1 }, mondo: null, meta: { giorno: 1 } });
    const s2 = await g.salva({ narrativa: { n: 2 }, mondo: null });
    const s3 = await g.salva({ narrativa: { n: 3 }, mondo: null });
    expect([s1.slot, s2.slot, s3.slot]).toEqual(['a', 'b', 'a']);
    expect([s1.contatore, s2.contatore, s3.contatore]).toEqual([1, 2, 3]);
    expect(s1.meta).toEqual({ giorno: 1 });

    const r = await g.carica<{ n: number }>();
    expect(r?.slot).toBe('a');
    expect(r?.documento.dati.narrativa.n).toBe(3);
    expect(r?.avvisi).toEqual([]);
  });

  it('se lo slot più recente è rovinato carica l’altro', async () => {
    const archivio = new ArchivioMemoria();
    const g = new GestoreSalvataggi({ archivio });
    await g.salva({ narrativa: { n: 1 }, mondo: null }); // a
    await g.salva({ narrativa: { n: 2 }, mondo: null }); // b
    archivio.dati.set('cielo-di-terra.salvataggio.b', archivio.dati.get('cielo-di-terra.salvataggio.b')!.slice(0, 40));
    const r = await g.carica<{ n: number }>();
    expect(r?.slot).toBe('a');
    expect(r?.documento.dati.narrativa.n).toBe(1);
    expect(r?.avvisi[0]).toMatch(/Slot b rovinato/);
    // il prossimo salvataggio sovrascrive lo slot rovinato, non quello buono
    const s = await g.salva({ narrativa: { n: 3 }, mondo: null });
    expect(s.slot).toBe('b');
    expect(s.contatore).toBe(2);
    expect((await g.carica<{ n: number }>())?.documento.dati.narrativa.n).toBe(3);
  });

  it('una scrittura interrotta non distrugge il salvataggio precedente', async () => {
    const archivio = new ArchivioMemoria();
    let rompi = false;
    const fragile: Archivio = {
      leggi: (k) => archivio.leggi(k),
      scrivi: (k, v) => archivio.scrivi(k, rompi ? v.slice(0, v.length / 2) : v),
      rimuovi: (k) => archivio.rimuovi(k),
    };
    const g = new GestoreSalvataggi({ archivio: fragile });
    await g.salva({ narrativa: { n: 1 }, mondo: null });
    rompi = true;
    await expect(g.salva({ narrativa: { n: 2 }, mondo: null })).rejects.toThrow(/non si rilegge/);
    rompi = false;
    const r = await g.carica<{ n: number }>();
    expect(r?.documento.dati.narrativa.n).toBe(1);
  });

  it('una scrittura che lancia (spazio esaurito) lascia intatto l’altro slot', async () => {
    const archivio = new ArchivioMemoria();
    const g = new GestoreSalvataggi({ archivio });
    await g.salva({ narrativa: { n: 1 }, mondo: null });
    const pieno = new GestoreSalvataggi({
      archivio: {
        leggi: (k) => archivio.leggi(k),
        scrivi: () => {
          throw new Error('QuotaExceededError');
        },
        rimuovi: (k) => archivio.rimuovi(k),
      },
    });
    await expect(pieno.salva({ narrativa: { n: 2 }, mondo: null })).rejects.toThrow(/Quota/);
    expect((await g.carica<{ n: number }>())?.documento.dati.narrativa.n).toBe(1);
  });

  it('entrambi rovinati: errore esplicito', async () => {
    const archivio = new ArchivioMemoria();
    archivio.scrivi('cielo-di-terra.salvataggio.a', '{rotto');
    archivio.scrivi('cielo-di-terra.salvataggio.b', '{"formato":"cielo-di-terra/salvataggio"}');
    const g = new GestoreSalvataggi({ archivio });
    await expect(g.carica()).rejects.toThrow(ErroreSalvataggio);
    const elenco = await g.elenco();
    expect(elenco.map((s) => s.stato)).toEqual(['rovinato', 'rovinato']);
  });

  it('migra al caricamento con il registro del gestore', async () => {
    const archivio = new ArchivioMemoria();
    const vecchio = new GestoreSalvataggi({ archivio, versione: 1 });
    await vecchio.salva({ narrativa: { flag: ['a'] }, mondo: null });
    const migrazioni = new RegistroMigrazioni().registra(1, (d) => ({
      ...d,
      narrativa: { flag: { a: true } },
    }));
    const nuovo = new GestoreSalvataggi({ archivio, versione: 2, migrazioni });
    const r = await nuovo.carica();
    expect(r?.documento.versione).toBe(2);
    expect(r?.documento.dati.narrativa).toEqual({ flag: { a: true } });
    // senza migrazione: errore chiaro
    await expect(new GestoreSalvataggi({ archivio, versione: 2 }).carica()).rejects.toThrow(/Manca la migrazione/);
  });

  it('funziona con un archivio asincrono e con un localStorage finto', async () => {
    const mappa = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mappa.get(k) ?? null,
      setItem: (k: string, v: string) => void mappa.set(k, v),
      removeItem: (k: string) => void mappa.delete(k),
    };
    const g = new GestoreSalvataggi({ archivio: archivioDaStorage(storage), prefisso: 'prova' });
    await g.salva({ narrativa: 1, mondo: 2 });
    expect([...mappa.keys()]).toEqual(['prova.a']);
    await g.cancella();
    expect(mappa.size).toBe(0);

    const memoria = new ArchivioMemoria();
    const asincrono: Archivio = {
      leggi: async (k) => memoria.leggi(k),
      scrivi: async (k, v) => memoria.scrivi(k, v),
      rimuovi: async (k) => memoria.rimuovi(k),
    };
    const h = new GestoreSalvataggi({ archivio: asincrono });
    await h.salva({ narrativa: 'x', mondo: null });
    expect((await h.carica())?.documento.dati.narrativa).toBe('x');
  });

  it('due salvataggi lanciati insieme vanno in fila e occupano entrambi gli slot', async () => {
    const memoria = new ArchivioMemoria();
    const lento: Archivio = {
      leggi: async (k) => {
        await new Promise((r) => setTimeout(r, 5));
        return memoria.leggi(k);
      },
      scrivi: async (k, v) => {
        await new Promise((r) => setTimeout(r, 5));
        memoria.scrivi(k, v);
      },
      rimuovi: (k) => memoria.rimuovi(k),
    };
    const g = new GestoreSalvataggi({ archivio: lento });
    const contenuto = { narrativa: { n: 1 }, mondo: null };
    const p1 = g.salva(contenuto);
    contenuto.narrativa.n = 2; // il primo salvataggio ha già copiato il suo contenuto
    const p2 = g.salva(contenuto);
    const [i1, i2] = await Promise.all([p1, p2]);
    expect([i1.slot, i2.slot]).toEqual(['a', 'b']);
    expect([i1.contatore, i2.contatore]).toEqual([1, 2]);
    expect(leggiDocumento(memoria.leggi('cielo-di-terra.salvataggio.a')!).dati.narrativa).toEqual({ n: 1 });
    expect((await g.carica<{ n: number }>())?.documento.dati.narrativa.n).toBe(2);
  });

  it('checksumDocumento ignora il campo checksum', () => {
    const doc = creaDocumento({ narrativa: 1, mondo: null });
    expect(checksumDocumento(doc)).toBe(doc.checksum);
    expect(checksumDocumento({ ...doc, checksum: 'altro' })).toBe(doc.checksum);
  });
});

describe('salvataggio della narrativa con lo stato del mondo', () => {
  const CONTENUTI = {
    missioni: [
      {
        id: 'm',
        titolo: 'M',
        passi: [
          { id: 'a', obiettivo_taccuino: 'Vai al fienile', completa_quando: 'luogo:fienile raggiunto', effetti: ['taccuino:d', 'oggetto:+chiave'] },
          { id: 'b', obiettivo_taccuino: 'Parla con Ottavio', completa_quando: 'dialogo:o finito' },
        ],
      },
    ],
    dialoghi: { o: { personaggio: 'ottavio', nodi: [{ id: 'x', testo: 'Ciao', risposte: [{ testo: 'Ciao', vai_a: 'fine' }] }] } },
    taccuino: [{ id: 'd', tipo: 'domanda', testo: 'Perché?' }],
  };

  class Mondo implements FornitoreMondo {
    stato: { z: number; theta: number; ora: number; particelle: Record<string, string> } = {
      z: 900,
      theta: 30,
      ora: 7,
      particelle: { p1: 'carta' },
    };
    esporta(): unknown {
      return this.stato;
    }
    importa(blob: unknown): void {
      this.stato = blob as Mondo['stato'];
    }
  }

  it('salva e ricarica tutto, e la partita prosegue', async () => {
    const f = new FattiFinti();
    const n = new Narrativa(CONTENUTI, f);
    n.tick();
    f.luoghi.add('fienile');
    n.tick();
    n.flag.set('velo', 'nero');
    n.taccuino.impostaRigaCielo('Brace fra due ore');
    const mondo = new Mondo();
    mondo.stato.particelle.p1 = 'abitata';

    const archivio = new ArchivioMemoria();
    const g = new GestoreSalvataggi({ archivio });
    const info = await n.salva(g, mondo, { luogo: 'fienile' });
    expect(info).toMatchObject({ slot: 'a', stato: 'valido', meta: { luogo: 'fienile' } });

    const f2 = new FattiFinti();
    const n2 = new Narrativa(CONTENUTI, f2);
    const mondo2 = new Mondo();
    const r = await n2.carica(g, mondo2);
    expect(r?.slot).toBe('a');
    expect(n2.esporta()).toEqual(n.esporta());
    expect(mondo2.stato.particelle.p1).toBe('abitata');
    expect(n2.taccuino.obiettivi()).toEqual([{ missione: 'm', passo: 'b', testo: 'Parla con Ottavio' }]);
    expect(n2.inventario.ha('chiave')).toBe(true);
    expect(n2.flag.get('velo')).toBe('nero');

    // la partita ricaricata prosegue normalmente, senza ripartire dall'inizio
    n2.tick();
    expect(n2.missioni.statoPasso('m', 'a')).toBe('completato');
    n2.dialoghi.avvia('o');
    n2.dialoghi.choose(0);
    expect(n2.missioni.stato('m')).toBe('completata');
  });

  it('carica restituisce null senza salvataggi', async () => {
    const n = new Narrativa(CONTENUTI, new FattiFinti());
    expect(await n.carica(new GestoreSalvataggi({ archivio: new ArchivioMemoria() }), new Mondo())).toBeNull();
  });
});
