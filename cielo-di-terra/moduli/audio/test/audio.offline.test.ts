/**
 * Rendering offline in Chromium headless: ogni suono passa per il vero AudioEngine,
 * dentro un OfflineAudioContext, e deve produrre segnale non nullo, finito, senza
 * saturazione (il limitatore è spento: il margine deve esserci già nel suono) e
 * senza troppa energia sopra i 6 kHz.
 *
 * Avvio: npm run test:offline
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
// @ts-expect-error modulo JavaScript senza tipi
import { apriBanco } from '../strumenti/banco.mjs';

interface Misura {
  id: string;
  picco: number;
  piccoDb: number;
  rms: number;
  rmsDb: number;
  rmsAttivoDb: number;
  acuti: number;
  continua: number;
  nan: number;
  campioniSaturi: number;
  msRendering: number;
}

interface Banco {
  errori: string[];
  elenco(): Promise<string[]>;
  rendi(id: string, opz?: Record<string, unknown>): Promise<Misura>;
  cicloDiVita(): Promise<Record<string, string | number | boolean>>;
  chiudi(): Promise<void>;
}

let banco: Banco;
let ids: string[] = [];
const misure: Misura[] = [];

beforeAll(async () => {
  banco = (await apriBanco()) as Banco;
  ids = await banco.elenco();
});

afterAll(async () => {
  await mkdir('risultati', { recursive: true });
  await writeFile('risultati/misure-test.json', JSON.stringify(misure, null, 2));
  await banco?.chiudi();
});

describe('ogni suono, reso offline', () => {
  it('l\'elenco delle prove copre effetti, ambienti e temi', () => {
    expect(ids.length).toBeGreaterThan(40);
    for (const prefisso of ['passo-', 'campane-', 'fade-', 'ui-', 'amb-', 'tema-']) {
      expect(ids.some((i) => i.startsWith(prefisso))).toBe(true);
    }
  });

  it('produce segnale non nullo, finito, senza clipping e senza stridori', async () => {
    const problemi: string[] = [];
    for (const id of ids) {
      const m = await banco.rendi(id);
      misure.push(m);
      if (m.nan > 0) problemi.push(`${id}: ${m.nan} campioni non finiti`);
      if (!(m.picco > 1e-3)) problemi.push(`${id}: segnale nullo (picco ${m.piccoDb} dB)`);
      if (!(m.rms > 1e-5)) problemi.push(`${id}: rms troppo basso (${m.rmsDb} dB)`);
      if (!(m.picco < 0.95) || m.campioniSaturi > 0) problemi.push(`${id}: clipping (picco ${m.piccoDb} dB)`);
      if (!(m.acuti < 0.15)) problemi.push(`${id}: troppi acuti (${(m.acuti * 100).toFixed(1)}%)`);
      if (Math.abs(m.continua) > 0.01) problemi.push(`${id}: continua ${m.continua}`);
    }
    console.table(misure.map((m) => ({ id: m.id, picco: m.piccoDb, rms: m.rmsDb, attivo: m.rmsAttivoDb, acuti: +(m.acuti * 100).toFixed(1) })));
    expect(problemi).toEqual([]);
  });

  it('nessun errore nella pagina', () => {
    expect(banco.errori).toEqual([]);
  });
});

describe('mixer nel grafo vero', () => {
  it('muto: silenzio totale', async () => {
    const m = await banco.rendi('passo-pietra', { muto: true });
    expect(m.picco).toBe(0);
  });

  it('il cursore di un bus spegne solo quel bus', async () => {
    expect((await banco.rendi('passo-pietra', { volumi: { effetti: 0 } })).picco).toBe(0);
    expect((await banco.rendi('passo-pietra', { volumi: { ambiente: 0, musica: 0 } })).picco).toBeGreaterThan(1e-3);
    expect((await banco.rendi('tema-primo-rilievo', { volumi: { musica: 0 } })).picco).toBe(0);
    expect((await banco.rendi('amb-lago', { volumi: { ambiente: 0 } })).picco).toBe(0);
  });

  it('il generale a metà abbassa di circa 12 dB', async () => {
    const pieno = await banco.rendi('passo-legno', { volumi: { generale: 1 } });
    const meta = await banco.rendi('passo-legno', { volumi: { generale: 0.5 } });
    expect(pieno.rmsDb - meta.rmsDb).toBeGreaterThan(11);
    expect(pieno.rmsDb - meta.rmsDb).toBeLessThan(13);
  });

  it('con il limitatore acceso anche il mix più carico resta sotto 0 dBFS', async () => {
    const m = await banco.rendi('mix-tutto', { limitatore: true, volumi: { generale: 1, effetti: 1, ambiente: 1, musica: 1 } });
    expect(m.picco).toBeLessThan(0.99);
    expect(m.nan).toBe(0);
  });
});

describe('ciclo di vita con un AudioContext vero', () => {
  it('avvio, aggiornamenti, eventi, pausa, ripresa, distruzione', async () => {
    const e = await banco.cicloDiVita();
    expect(e.statoIniziale).toBe('spento');
    expect(e.eventoPrimaDellAvvio).toBe(0);
    expect(e.statoAvviato).toBe('attivo');
    expect(e.contesto).toBe('running');
    expect(e.durataPasso).toBeGreaterThan(0.05);
    expect(e.temaAccettato).toBe(true);
    expect(e.temaRifiutato).toBe(false);
    expect(e.temaInCorso).toBe('primo-volo');
    expect(e.sorgente).toBe(true);
    expect(e.volumeMusica).toBe(0.2);
    expect(e.statoPausa).toBe('in-pausa');
    expect(e.eventoInPausa).toBe(0);
    expect(e.contestoInPausa).toBe('suspended');
    expect(e.statoRipreso).toBe('attivo');
    expect(e.contestoRipreso).toBe('running');
    expect(e.statoFinale).toBe('distrutto');
    expect(e.contestoFinale).toBe('closed');
  });
});
