import { describe, expect, it } from 'vitest';
import {
  PARZIALI_CAMPANA,
  generaRispostaRiverbero,
  generaRumore,
  picco,
  rms,
  sintetizzaCampana,
  sintetizzaCoroGrilli,
  sintetizzaCorda,
} from '../../src/audio/sintesi/campioni';
import { creaRng, midiAHz } from '../../src/audio/util';
import { noteCanto, pesiSpecie, type Specie } from '../../src/audio/ambienti/vita';

const SR = 48000;

function tuttiFiniti(x: Float32Array): boolean {
  for (let i = 0; i < x.length; i++) if (!Number.isFinite(x[i] as number)) return false;
  return true;
}

/** Stima della fondamentale per autocorrelazione. */
function fondamentale(x: Float32Array, sr: number, fMin: number, fMax: number): number {
  const n = Math.min(x.length, 8192);
  let migliore = 0;
  let lagMigliore = 0;
  for (let lag = Math.floor(sr / fMax); lag <= Math.ceil(sr / fMin); lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += (x[i] as number) * (x[i + lag] as number);
    if (s > migliore) {
      migliore = s;
      lagMigliore = lag;
    }
  }
  return sr / lagMigliore;
}

describe('rumori ciclici', () => {
  for (const tipo of ['bianco', 'rosa', 'marrone'] as const) {
    it(`${tipo}: livello noto, senza continua, ciclo senza scatti`, () => {
      const x = generaRumore(tipo, SR * 2, creaRng(1));
      expect(tuttiFiniti(x)).toBe(true);
      expect(rms(x)).toBeGreaterThan(0.18);
      expect(rms(x)).toBeLessThan(0.21);
      expect(picco(x)).toBeLessThanOrEqual(1);
      let media = 0;
      for (const v of x) media += v;
      expect(Math.abs(media / x.length)).toBeLessThan(0.02);
      // il salto all'aggancio del ciclo non è più grande dei salti tipici fra campioni vicini
      let salti = 0;
      for (let i = 1; i < x.length; i++) salti += Math.abs((x[i] as number) - (x[i - 1] as number));
      const tipico = salti / (x.length - 1);
      expect(Math.abs((x[0] as number) - (x[x.length - 1] as number))).toBeLessThan(tipico * 6 + 0.05);
    });
  }
});

describe('corda del salterio', () => {
  for (const midi of [50, 62, 74, 86]) {
    it(`MIDI ${midi}: intonata, normalizzata e che si spegne`, () => {
      const f = midiAHz(midi);
      const x = sintetizzaCorda(SR, f, { durata: 2, t60: 3, durezza: 0.45, cori: 3, scordatura: 3.5 }, creaRng(midi));
      expect(tuttiFiniti(x)).toBe(true);
      expect(picco(x)).toBeCloseTo(0.9, 5);
      const stimata = fondamentale(x.subarray(SR * 0.05), SR, f * 0.7, f * 1.4);
      expect(Math.abs(1200 * Math.log2(stimata / f))).toBeLessThan(35); // entro un terzo di semitono
      const inizio = rms(x.subarray(0, SR * 0.2));
      const fine = rms(x.subarray(SR * 1.7, SR * 1.9));
      expect(fine).toBeLessThan(inizio * 0.5);
    });
  }
});

describe('campana', () => {
  it('parziali inarmonici: hum all\'ottava sotto, terza minore, nominale all\'ottava sopra', () => {
    const r = PARZIALI_CAMPANA.map((p) => p.rapporto);
    expect(r).toContain(0.5);
    expect(r).toContain(2);
    expect(r.some((x) => Math.abs(x - 1.2) < 0.03)).toBe(true);
    expect(r.some((x) => x > 1 && Number.isInteger(x) === false && Math.abs(x * 2 - Math.round(x * 2)) > 0.01)).toBe(true);
    // i parziali alti sono più deboli e più brevi: la campana resta calda
    const alti = PARZIALI_CAMPANA.filter((p) => p.rapporto > 3);
    for (const p of alti) {
      expect(p.ampiezza).toBeLessThan(0.15);
      expect(p.tau).toBeLessThan(0.6);
    }
  });

  it('il campione è finito, normalizzato e decade', () => {
    const x = sintetizzaCampana(SR, 196, 4, creaRng(3));
    expect(tuttiFiniti(x)).toBe(true);
    expect(picco(x)).toBeCloseTo(0.9, 5);
    expect(Math.abs(x[0] as number)).toBeLessThan(0.05); // attacco senza clic
    expect(rms(x.subarray(SR * 3, SR * 3.5))).toBeLessThan(rms(x.subarray(0, SR * 0.5)) * 0.4);
  });
});

describe('coro di grilli e riverbero', () => {
  it('il coro di grilli è stereo, ciclico e morbido', () => {
    const [sx, dx] = sintetizzaCoroGrilli(SR, 2, 42);
    expect(sx.length).toBe(SR * 2);
    expect(tuttiFiniti(sx) && tuttiFiniti(dx)).toBe(true);
    expect(Math.max(picco(sx), picco(dx))).toBeCloseTo(0.8, 5);
  });

  it('la risposta del riverbero decade e si scurisce', () => {
    const [sx, dx] = generaRispostaRiverbero(SR, 2.6, 777);
    expect(tuttiFiniti(sx) && tuttiFiniti(dx)).toBe(true);
    const testa = rms(sx.subarray(SR * 0.05, SR * 0.25));
    const coda = rms(sx.subarray(SR * 2, SR * 2.2));
    expect(coda).toBeLessThan(testa * 0.01);
    expect(Math.abs(sx[0] as number)).toBe(0); // predelay
  });
});

describe('canti degli uccelli', () => {
  const specie: Specie[] = ['merlo', 'cincia', 'fringuello', 'cuculo'];
  it('restano in un registro morbido (niente sopra 3,6 kHz) e durano poco', () => {
    for (const s of specie) {
      for (let seme = 0; seme < 30; seme++) {
        const note = noteCanto(s, creaRng(seme));
        expect(note.length).toBeGreaterThan(1);
        for (const n of note) {
          expect(Math.max(n.f0, n.f1)).toBeLessThanOrEqual(3600);
          expect(Math.min(n.f0, n.f1)).toBeGreaterThanOrEqual(500);
          expect(n.a).toBeGreaterThan(0);
          expect(n.a).toBeLessThanOrEqual(1);
        }
        const ultima = note[note.length - 1]!;
        expect(ultima.t + ultima.d).toBeLessThan(4);
      }
    }
  });

  it('le probabilità delle specie sono sempre positive; il cuculo canta a metà mattina', () => {
    for (let h = 0; h < 24; h += 0.5) for (const p of pesiSpecie(h)) expect(p).toBeGreaterThanOrEqual(0);
    expect(pesiSpecie(10)[3]).toBeGreaterThan(0);
    expect(pesiSpecie(6)[3]).toBe(0);
  });
});
