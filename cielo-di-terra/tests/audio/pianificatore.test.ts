import { describe, expect, it } from 'vitest';
import { Pianificatore } from '../../src/audio/pianificatore';
import { creaRng } from '../../src/audio/util';

function raccogli(p: Pianificatore, durata: number, passo: number, tasso: (t: number) => number): number[] {
  const out: number[] = [];
  for (let t = 0; t < durata; t += passo) out.push(...p.eventi(t, t + passo, tasso(t)));
  return out;
}

describe('Pianificatore (Poisson a tasso variabile)', () => {
  it('è deterministico dato il seme', () => {
    const a = raccogli(new Pianificatore(creaRng(5)), 100, 0.1, () => 2);
    const b = raccogli(new Pianificatore(creaRng(5)), 100, 0.1, () => 2);
    expect(a).toEqual(b);
  });

  it('rispetta il tasso medio e non dipende dalla grandezza dei passi', () => {
    const fini = raccogli(new Pianificatore(creaRng(1)), 2000, 0.016, () => 1.5);
    const grossi = raccogli(new Pianificatore(creaRng(2)), 2000, 0.5, () => 1.5);
    expect(fini.length / 2000).toBeGreaterThan(1.35);
    expect(fini.length / 2000).toBeLessThan(1.65);
    expect(grossi.length / 2000).toBeGreaterThan(1.35);
    expect(grossi.length / 2000).toBeLessThan(1.65);
  });

  it('restituisce istanti ordinati dentro l\'intervallo richiesto', () => {
    const p = new Pianificatore(creaRng(3));
    for (let t = 0; t < 50; t += 0.2) {
      const ev = p.eventi(t, t + 0.2, 4);
      for (const e of ev) {
        expect(e).toBeGreaterThanOrEqual(t);
        expect(e).toBeLessThan(t + 0.2);
      }
      for (let i = 1; i < ev.length; i++) expect(ev[i] as number).toBeGreaterThanOrEqual(ev[i - 1] as number);
    }
  });

  it('tasso nullo o non valido: nessun evento', () => {
    const p = new Pianificatore(creaRng(4));
    expect(p.eventi(0, 100, 0)).toEqual([]);
    expect(p.eventi(0, 100, -3)).toEqual([]);
    expect(p.eventi(0, 100, Number.NaN)).toEqual([]);
    expect(p.eventi(5, 5, 10)).toEqual([]);
  });

  it('segue i cambi di tasso (più eventi dove il tasso è alto)', () => {
    const ev = raccogli(new Pianificatore(creaRng(9)), 400, 0.1, (t) => (t < 200 ? 0.2 : 3));
    const prima = ev.filter((e) => e < 200).length;
    const dopo = ev.filter((e) => e >= 200).length;
    expect(dopo).toBeGreaterThan(prima * 8);
  });

  it('la regolarità rende gli intervalli meno dispersi', () => {
    const cv = (reg: number): number => {
      const ev = raccogli(new Pianificatore(creaRng(11), reg), 3000, 0.1, () => 1);
      const d = ev.slice(1).map((e, i) => e - (ev[i] as number));
      const m = d.reduce((a, b) => a + b, 0) / d.length;
      const v = d.reduce((a, b) => a + (b - m) ** 2, 0) / d.length;
      return Math.sqrt(v) / m;
    };
    const casuale = cv(1);
    const regolare = cv(12);
    expect(casuale).toBeGreaterThan(0.8);
    expect(regolare).toBeLessThan(0.4);
  });
});
