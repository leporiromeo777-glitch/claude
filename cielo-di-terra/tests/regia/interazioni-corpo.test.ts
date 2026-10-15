/**
 * La regia, logica pura: i bersagli del tasto E (sguardo, portata, tenute), i controlli dello
 * sguardo e il corpo di Elvira (fiato, planate).
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Interazioni, punteggio, type Bersaglio } from '../../src/regia/interazioni';
import { Sguardi, elevazione, guardaPunto } from '../../src/regia/sguardo';
import { Corpo, SOGLIA_FIATO, type EventoCorpo, type PassoCorpo } from '../../src/regia/corpo';

const occhio = new Vector3(0, 0, 0);
const avanti = new Vector3(0, 0, -1);
const premi = { premuto: true, tenuto: true };
const tieni = { premuto: false, tenuto: true };
const niente = { premuto: false, tenuto: false };

describe('Interazioni', () => {
  it('un bersaglio si sceglie solo entro la portata, nel cono dello sguardo e se disponibile', () => {
    const b: Bersaglio = { id: 'busta', verbo: 'Prendi la busta', posizione: new Vector3(0, 0, -2) };
    expect(punteggio(b, occhio, avanti)).toBeLessThan(1);
    expect(punteggio({ ...b, posizione: new Vector3(0, 0, -3) }, occhio, avanti)).toBe(Infinity); // oltre 2,6 m
    expect(punteggio({ ...b, posizione: new Vector3(1.5, 0, -2) }, occhio, avanti)).toBe(Infinity); // fuori dal cono
    expect(punteggio({ ...b, disponibile: () => false }, occhio, avanti)).toBe(Infinity);
    expect(punteggio({ ...b, posizione: () => null }, occhio, avanti)).toBe(Infinity);
  });

  it('fra due bersagli vince quello più al centro dello sguardo', () => {
    const it = new Interazioni();
    it.registra({ id: 'a', verbo: 'A', posizione: new Vector3(0.25, 0, -2) });
    it.registra({ id: 'b', verbo: 'B', posizione: new Vector3(0.02, 0, -2) });
    expect(it.scegli(occhio, avanti)?.id).toBe('b');
    it.togli('b');
    expect(it.scegli(occhio, avanti)?.id).toBe('a');
  });

  it('E premuto chiama l\'azione una volta per pressione', () => {
    const it = new Interazioni();
    let n = 0;
    it.registra({ id: 'x', verbo: 'Apri', posizione: new Vector3(0, 0, -1.5), azione: () => n++ });
    expect(it.update(1 / 60, occhio, avanti, premi).bersaglio?.id).toBe('x');
    it.update(1 / 60, occhio, avanti, tieni);
    expect(n).toBe(1);
  });

  it('una tenuta si completa tenendo E per la sua durata; lasciando si azzera', () => {
    const it = new Interazioni();
    let fatto = 0;
    it.registra({ id: 'ramo', verbo: 'Taglia', posizione: new Vector3(0, 0, -1.5), tenuta: { durata: 1, completa: () => fatto++ } });
    for (let i = 0; i < 30; i++) it.update(1 / 60, occhio, avanti, tieni);
    expect(it.progresso('ramo')).toBeCloseTo(0.5, 2);
    it.update(1 / 60, occhio, avanti, niente);
    expect(it.progresso('ramo')).toBe(0);
    for (let i = 0; i < 61; i++) it.update(1 / 60, occhio, avanti, tieni);
    expect(fatto).toBe(1);
  });

  it('una tenuta che «riprende» conserva il progresso anche guardando altrove', () => {
    const it = new Interazioni();
    it.registra({ id: 'innesto', verbo: 'Innesta', posizione: new Vector3(0, 0, -1.5), tenuta: { durata: 1, completa: () => {}, riprende: true } });
    for (let i = 0; i < 24; i++) it.update(1 / 60, occhio, avanti, tieni);
    const p = it.progresso('innesto');
    expect(p).toBeGreaterThan(0.3);
    it.update(1 / 60, occhio, new Vector3(1, 0, 0), tieni); // sguardo altrove
    it.update(1 / 60, occhio, avanti, niente);
    expect(it.progresso('innesto')).toBeCloseTo(p, 6);
  });

  it('con «azioni tenute: premi» una pressione porta avanti la tenuta da sola', () => {
    const it = new Interazioni();
    let fatto = false;
    it.registra({ id: 'chiodo', verbo: 'Pianta', posizione: new Vector3(0, 0, -1.5), tenuta: { durata: 0.5, completa: () => (fatto = true) } });
    it.update(1 / 60, occhio, avanti, { premuto: true, tenuto: false, modoPremi: true });
    for (let i = 0; i < 40; i++) it.update(1 / 60, occhio, avanti, { premuto: false, tenuto: false, modoPremi: true });
    expect(fatto).toBe(true);
  });
});

describe('Sguardi', () => {
  it('lo sguardo deve restare sul punto per la durata; se si stacca il tempo si azzera', () => {
    const s = new Sguardi();
    let n = 0;
    s.registra({ id: 'vetro', posizione: new Vector3(0, 0, -1), raggio: 0.12, durata: 1.5, compiuto: () => n++ });
    for (let i = 0; i < 60; i++) s.update(1 / 60, occhio, avanti);
    expect(s.tempo('vetro')).toBeCloseTo(1, 3);
    s.update(1 / 60, occhio, new Vector3(0, 1, 0));
    expect(s.tempo('vetro')).toBe(0);
    for (let i = 0; i < 95; i++) s.update(1 / 60, occhio, avanti);
    expect(n).toBe(1);
    expect(s.ha('vetro')).toBe(false); // scatta una volta sola
  });

  it('un controllo sospeso non accumula; uno ripetibile riscatta dopo che lo sguardo si è staccato', () => {
    const s = new Sguardi();
    let attivo = false;
    let n = 0;
    s.registra({ id: 'lente', posizione: new Vector3(0, 0, -1), raggio: 0.3, durata: 0.5, attivo: () => attivo, ripetibile: true, compiuto: () => n++ });
    for (let i = 0; i < 60; i++) s.update(1 / 60, occhio, avanti);
    expect(n).toBe(0);
    attivo = true;
    for (let i = 0; i < 60; i++) s.update(1 / 60, occhio, avanti);
    expect(n).toBe(1);
    s.update(1 / 60, occhio, new Vector3(1, 0, 0));
    for (let i = 0; i < 40; i++) s.update(1 / 60, occhio, avanti);
    expect(n).toBe(2);
  });

  it('guardaPunto usa il cono del raggio o il cono minimo; elevazione rispetto all\'asse', () => {
    const lontano = new Vector3(3, 0, -100);
    expect(guardaPunto(occhio, avanti, lontano, 0.5)).toBe(false);
    expect(guardaPunto(occhio, avanti, lontano, 0.5, Infinity, 22)).toBe(true);
    expect(guardaPunto(occhio, avanti, lontano, 0.5, 50, 22)).toBe(false);
    const su = new Vector3(0, 1, 0);
    expect(elevazione(new Vector3(0, 1, -1).normalize(), su)).toBeCloseTo(45, 6);
    expect(elevazione(avanti, su)).toBeCloseTo(0, 6);
  });
});

describe('Corpo', () => {
  const passo = (o: Partial<PassoCorpo> = {}): PassoCorpo => ({ grounded: true, veloOpen: false, velocita: 0, corre: false, z: 1000, theta: 30, h: 40, ...o });

  it('nel prologo camminare costa fiato: dopo una ventina di metri il fiato è corto (una volta sola)', () => {
    const c = new Corpo();
    c.affaticata = true;
    const ev: EventoCorpo[] = [];
    let metri = 0;
    while (c.fiato >= SOGLIA_FIATO && metri < 60) {
      ev.push(...c.aggiorna(1 / 60, passo({ velocita: 1.4 })));
      metri += 1.4 / 60;
    }
    expect(metri).toBeGreaterThan(14);
    expect(metri).toBeLessThan(22);
    expect(ev.filter((e) => e.tipo === 'fiato_corto')).toHaveLength(1);
    expect(c.restringimento).toBeGreaterThan(0);
    expect(c.fattoreVelocita).toBeLessThan(1);
    for (let i = 0; i < 600; i++) ev.push(...c.aggiorna(1 / 60, passo({ velocita: 1.4 })));
    expect(ev.filter((e) => e.tipo === 'fiato_corto')).toHaveLength(1);
  });

  it('seduta il fiato torna pieno in sei secondi', () => {
    const c = new Corpo();
    c.fiato = 0;
    c.seduta = true;
    for (let i = 0; i < 6 * 60 + 1; i++) c.aggiorna(1 / 60, passo());
    expect(c.fiato).toBe(1);
  });

  it('una planata conta con il Velo aperto almeno 2 s, e ricorda da dove si è saltati', () => {
    const c = new Corpo();
    c.aggiorna(1 / 60, passo({ z: 1100, h: 50 }));
    const ev: EventoCorpo[] = [];
    for (let i = 0; i < 150; i++) ev.push(...c.aggiorna(1 / 60, passo({ grounded: false, veloOpen: true, z: 1100 + i * 0.1, h: 50 - i * 0.05 })));
    ev.push(...c.aggiorna(1 / 60, passo({ z: 1115, h: 42 })));
    expect(ev[0]).toMatchObject({ tipo: 'decollo', da: { z: 1100, h: 50 } });
    const a = ev.find((e) => e.tipo === 'atterraggio');
    expect(a).toMatchObject({ tipo: 'atterraggio', planata: true, decollo: { z: 1100 } });
    // un salto senza Velo non è una planata
    const ev2: EventoCorpo[] = [];
    for (let i = 0; i < 40; i++) ev2.push(...c.aggiorna(1 / 60, passo({ grounded: false })));
    ev2.push(...c.aggiorna(1 / 60, passo()));
    expect(ev2.find((e) => e.tipo === 'atterraggio')).toMatchObject({ planata: false });
  });

  it('esporta e importa il fiato e la stanchezza del prologo', () => {
    const c = new Corpo();
    c.affaticata = true;
    c.fiato = 0.5;
    const d = new Corpo();
    d.importa(c.esporta());
    expect(d.fiato).toBe(0.5);
    expect(d.affaticata).toBe(true);
    expect(d.seduta).toBe(false);
  });
});
