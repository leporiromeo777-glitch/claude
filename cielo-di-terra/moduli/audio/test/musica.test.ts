import { describe, expect, it } from 'vitest';
import { ESTENSIONI, MODI, TEMI, generaTema, grado } from '../src/musica/temi';
import { PRIORITA_TEMI, RegiaMusica } from '../src/musica/regia';

describe('teoria', () => {
  it('converte i gradi in note MIDI, anche oltre l\'ottava e sotto la tonica', () => {
    expect(grado(62, MODI.ionico, 0)).toBe(62);
    expect(grado(62, MODI.ionico, 2)).toBe(66);
    expect(grado(62, MODI.ionico, 7)).toBe(74);
    expect(grado(62, MODI.ionico, 9)).toBe(78);
    expect(grado(57, MODI.dorico, -1)).toBe(55);
    expect(grado(67, MODI.lidio, 3)).toBe(73); // il Do diesis lidio
  });
});

describe('temi generativi', () => {
  for (const tema of TEMI) {
    describe(tema, () => {
      const p = generaTema(tema, 12345);

      it('è deterministico dato il seme e varia con il seme', () => {
        expect(generaTema(tema, 12345)).toEqual(p);
        const altri = [1, 2, 3, 4, 5].map((s) => JSON.stringify(generaTema(tema, s).note));
        expect(new Set(altri).size).toBeGreaterThan(1);
      });

      it('è breve e discreto', () => {
        expect(p.durata).toBeGreaterThan(8);
        expect(p.durata).toBeLessThan(45);
        expect(p.note.length).toBeGreaterThan(10);
        for (const n of p.note) {
          expect(n.vel).toBeGreaterThan(0);
          expect(n.vel).toBeLessThanOrEqual(0.6); // nessuna nota forte
        }
      });

      it('le note stanno nel tempo, in ordine, e dentro l\'estensione degli strumenti', () => {
        for (let i = 0; i < p.note.length; i++) {
          const n = p.note[i]!;
          expect(n.t).toBeGreaterThanOrEqual(0);
          expect(n.t + Math.min(n.durata, 2)).toBeLessThanOrEqual(p.durata + 0.5);
          if (i > 0) expect(n.t).toBeGreaterThanOrEqual(p.note[i - 1]!.t);
          const [lo, hi] = ESTENSIONI[n.strumento];
          expect(n.midi).toBeGreaterThanOrEqual(lo);
          expect(n.midi).toBeLessThanOrEqual(hi);
        }
      });

      it('tutte le note appartengono al modo del tema', () => {
        const classi = new Set(p.modo.map((x) => (p.tonica + x) % 12));
        for (const n of p.note) expect(classi.has(n.midi % 12)).toBe(true);
      });

      it('per qualsiasi seme resta nei limiti', () => {
        for (let s = 0; s < 40; s++) {
          const q = generaTema(tema, s * 7919);
          expect(q.durata).toBeLessThan(45);
          for (const n of q.note) {
            const [lo, hi] = ESTENSIONI[n.strumento];
            expect(n.midi >= lo && n.midi <= hi).toBe(true);
            expect(Number.isFinite(n.t) && Number.isFinite(n.durata)).toBe(true);
          }
        }
      });
    });
  }

  it('usa gli strumenti giusti per ogni momento', () => {
    const strumenti = (t: (typeof TEMI)[number]): Set<string> => new Set(generaTema(t, 7).note.map((n) => n.strumento));
    expect(strumenti('alba')).toEqual(new Set(['salterio', 'flauto']));
    expect(strumenti('primo-volo')).toEqual(new Set(['salterio', 'fisarmonica', 'flauto']));
    expect(strumenti('primo-rilievo').has('fisarmonica')).toBe(true);
    expect(strumenti('notte-fade').has('carillon')).toBe(true);
  });
});

describe('regia della musica', () => {
  it('un tema alla volta; un momento più importante interrompe', () => {
    const r = new RegiaMusica(20, 240);
    expect(r.valuta('alba', 0).esito).toBe('suona');
    r.avvia('alba', 0, 30);
    expect(r.inCorso(10)).toBe('alba');
    expect(r.valuta('alba', 10)).toEqual({ esito: 'rifiuta', motivo: 'in-corso' });
    expect(r.valuta('primo-volo', 10)).toEqual({ esito: 'interrompi-e-suona', interrotto: 'alba' });
    expect(PRIORITA_TEMI['primo-volo']).toBeGreaterThan(PRIORITA_TEMI.alba);
  });

  it('lascia un silenzio fra i temi e non ripete a breve', () => {
    const r = new RegiaMusica(20, 240);
    r.avvia('notte-fade', 0, 30);
    expect(r.inCorso(31)).toBeNull();
    expect(r.valuta('primo-rilievo', 35)).toEqual({ esito: 'rifiuta', motivo: 'troppo-presto' });
    expect(r.valuta('primo-rilievo', 51).esito).toBe('suona');
    expect(r.valuta('notte-fade', 100)).toEqual({ esito: 'rifiuta', motivo: 'ripetuto' });
    expect(r.valuta('notte-fade', 241).esito).toBe('suona');
    expect(r.valuta('notte-fade', 100, true).esito).toBe('suona');
  });

  it('dopo un\'interruzione il silenzio parte dall\'istante dello stop', () => {
    const r = new RegiaMusica(20, 240);
    r.avvia('alba', 0, 30);
    r.ferma(5);
    expect(r.inCorso(6)).toBeNull();
    expect(r.valuta('primo-volo', 10).esito).toBe('rifiuta');
    expect(r.valuta('primo-volo', 26).esito).toBe('suona');
  });
});
